import { test } from 'node:test';
import assert from 'node:assert';
import { processClinicalMessage, renderEmergencyTemplate, formatWhatsAppReply } from '../dist/services/clinicalOrchestrator.js';
import { lookupFirstAidProtocol, renderFirstAidProtocol, renderFirstAidFallback } from '../dist/services/firstAidEngine.js';
import { runSafetyRuntime, SafetyDecision } from '../dist/safety/index.js';

// ═══════════════════════════════════════════════════════════════
// S6F TEST PLAN — per PRD S6F §8 / TEST_PLAN S6F
// ═══════════════════════════════════════════════════════════════

const NOW_ISO = new Date().toISOString();
const SEVEN_DAYS_AGO = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

function makeMockD1(overrides = {}) {
  const profile = overrides.profile ?? {
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 175,
    aiConsent: 1,
    dataShareConsent: 1,
    emergencyConsent: 1,
  };
  const measurements = overrides.measurements ?? [];
  const symptoms = overrides.symptoms ?? [];
  const safetyEvents = overrides.safetyEvents ?? [];
  const meds = overrides.meds ?? { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 };
  const hydration = overrides.hydration ?? null;
  const cycle = overrides.cycle ?? null;
  const protocols = overrides.protocols ?? [];

  const inserts = [];

  function prepare(sql) {
    return {
      bind(...args) {
        return {
          async first() {
            const lower = sql.toLowerCase();
            if (lower.includes('hl_userprofiles') && lower.includes('where userid')) {
              return profile;
            }
            if (lower.includes('hl_cyclesettings')) return cycle;
            if (lower.includes('hl_firstaidprotocols')) {
              const locale = args[0];
              return protocols.find((p) => p.locale === locale) || null;
            }
            return null;
          },
          async all() {
            const lower = sql.toLowerCase();
            if (lower.includes('hl_measurementvalues') && lower.includes('max(s2.measuredat)')) {
              return { results: measurements };
            }
            if (lower.includes('hl_measurementvalues') && lower.includes('s.measuredat >= ?')) {
              return { results: measurements.filter((m) => new Date(m.measuredAt) >= new Date(args[1])) };
            }
            if (lower.includes('hl_symptomlogs')) return { results: symptoms };
            if (lower.includes('hl_safetyevents')) return { results: safetyEvents };
            if (lower.includes('hl_medications') && lower.includes('active = 1')) return { results: meds.activeMedications.map((m) => ({ medicationName: m })) };
            if (lower.includes('hl_medicationlogs')) return { results: [] };
            if (lower.includes('hl_waterintakelogs')) return { results: hydration ? [hydration] : [] };
            if (lower.includes('hl_firstaidprotocols')) {
              const locale = args[0];
              return { results: protocols.filter((p) => p.locale === locale && p.reviewerStatus === 'approved') };
            }
            if (lower.includes('hl_systemconfigs')) {
              const key = args[0];
              const configMap = {
                'clinicalCopilot.operatingMode': { configValue: 'standard' },
                'medicalSafetyRuntime.enabled': { configValue: 'true' },
                'clinicalCopilot.maxTokens': { configValue: '2048' },
                'clinicalCopilot.temperature': { configValue: '3' },
                'aiGateway.fallback.enabled': { configValue: 'true' },
                'whatsappAi.maxReplyChars': { configValue: '400' },
              };
              return { results: configMap[key] ? [configMap[key]] : [] };
            }
            if (lower.includes('hl_promptversions')) {
              return { results: [{ promptCode: args[0], version: 'v1.0.0', contentText: 'Test prompt', contentHash: 'hash' }] };
            }
            return { results: [] };
          },
          async run() {
            inserts.push({ sql, args });
            return { meta: { changes: 1, last_row_id: Math.floor(Math.random() * 1000000) } };
          },
        };
      },
    };
  }

  return { prepare, inserts };
}

function makeMockEnv(overrides = {}) {
  const d1 = makeMockD1(overrides);
  return {
    DB: d1,
    AI_KV: {
      async get() { return null; },
      async put() {},
      async delete() {},
    },
    AI: {
      async run() { return { response: 'safe response' }; },
    },
    LOGS: {
      async put() { return {}; },
    },
    VECTORIZE_INDEX: null,
    CLINICAL_COPILOT_ENABLED: 'true',
    MEDICAL_SAFETY_RUNTIME_ENABLED: 'true',
    inserts: d1.inserts,
  };
}

// T-1: emergency measurement triggers emergency_template_only

test('S6F T-1: emergency measurement triggers emergency_template_only', async () => {
  const env = makeMockEnv({
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: NOW_ISO },
    ],
  });

  const result = await processClinicalMessage(env, {
    userId: 1,
    sessionId: 10,
    message: 'saya pusing',
    channel: 'web',
    locale: 'id',
  });

  assert.equal(result.answerType, 'emergency_guidance');
  assert.equal(result.safetyDecision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY);
  assert.ok(result.reply.includes('119 / 112'), 'Emergency reply must include 119/112');
  assert.ok(result.reply.includes('Fasilitas Kesehatan') || result.reply.includes('healthcare facility'), 'Emergency reply must include faskes CTA');
  assert.ok(result.modelName === 'emergency-template');
});

// T-2: red flag symptom triggers emergency_template_only

test('S6F T-2: red flag symptom triggers emergency_template_only', async () => {
  const env = makeMockEnv({
    symptoms: [
      { id: 1, symptomDateTime: NOW_ISO, bodyArea: 'chest', painScale: 9, painSeverity: 'severe', mood: 'anxious', isRedFlag: 1 },
    ],
  });

  const result = await processClinicalMessage(env, {
    userId: 2,
    sessionId: 11,
    message: 'nyeri dada',
    channel: 'web',
    locale: 'id',
  });

  assert.equal(result.answerType, 'emergency_guidance');
  assert.equal(result.safetyDecision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY);
  assert.ok(result.reply.includes('119 / 112'), 'Emergency reply must include 119/112');
});

// T-3: no red flag → normal AI flow (all providers fail → safe template)

test('S6F T-3: no red flag → normal AI flow with safe fallback', async () => {
  const env = makeMockEnv({
    profile: { sex: 'male', birthDate: '1990-01-01', heightCm: 175, aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: NOW_ISO },
    ],
  });

  const result = await processClinicalMessage(env, {
    userId: 3,
    sessionId: 12,
    message: 'bagaimana kondisi saya',
    channel: 'web',
    locale: 'id',
  });

  assert.notEqual(result.answerType, 'emergency_guidance');
  assert.ok(result.reply.length > 0);
  assert.ok(result.reply.includes('AI DAPAT MELAKUKAN KESALAHAN') || result.reply.includes('AI CAN MAKE MISTAKES'), 'Reply must contain disclaimer');
});

// T-4: AI downgrade severity is blocked by emergencySeverityDowngradeDetector

test('S6F T-4: emergencySeverityDowngradeDetector blocks AI downgrade', () => {
  const input = {
    aiOutput: 'Tidak urgent. Severity: normal. Cukup dipantau di rumah.\n\nAI DAPAT MELAKUKAN KESALAHAN.',
    locale: 'id',
    deterministicEmergencyLevel: 'emergency',
    redFlagPresent: true,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
  };
  const result = runSafetyRuntime(input);
  assert.equal(result.finalDecision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY);
  assert.ok(result.output.includes('119 / 112') || result.output.includes('DARURAT'), 'Downgrade blocked → emergency template');
});

// T-5: first-aid lookup by keyword "luka" returns wound_minor protocol

test('S6F T-5: first-aid lookup by keyword "luka" returns wound_minor protocol', async () => {
  const protocol = {
    id: 1,
    protocolCode: 'wound_minor',
    locale: 'id',
    title: 'Luka Ringan & Perdarahan Ringan',
    triggerKeywordsJson: JSON.stringify(['luka', 'berdarah', 'tergores', 'lecet']),
    redFlagsJson: JSON.stringify(['perdarahan tidak berhenti > 10 menit']),
    doStepsJson: JSON.stringify(['Cuci tangan', 'Bersihkan luka', 'Tutup perban']),
    dontStepsJson: JSON.stringify(['Jangan tiup luka']),
    seekHelpNowJson: JSON.stringify(['Perdarahan tidak berhenti']),
    reviewerStatus: 'approved',
    contentVersion: '1.0.0',
  };
  const env = makeMockEnv({ protocols: [protocol] });

  const found = await lookupFirstAidProtocol(env, 'luka', 'id');
  assert.ok(found);
  assert.equal(found.protocolCode, 'wound_minor');
  assert.equal(found.title, 'Luka Ringan & Perdarahan Ringan');
});

// T-6: first-aid response has Do/Don't/SeekHelp sections

test('S6F T-6: first-aid response has Do, Don\'t, and SeekHelp sections', () => {
  const protocol = {
    id: 1,
    protocolCode: 'wound_minor',
    locale: 'id',
    title: 'Luka Ringan',
    triggerKeywordsJson: JSON.stringify(['luka']),
    redFlagsJson: JSON.stringify(['perdarahan tidak berhenti']),
    doStepsJson: JSON.stringify(['Cuci tangan', 'Bersihkan luka']),
    dontStepsJson: JSON.stringify(['Jangan tiup luka']),
    seekHelpNowJson: JSON.stringify(['Perdarahan tidak berhenti', 'Luka dalam']),
    reviewerStatus: 'approved',
    contentVersion: '1.0.0',
  };
  const rendered = renderFirstAidProtocol(protocol, 'id');
  assert.ok(rendered.includes('LAKUKAN'), 'Rendered must include DO section');
  assert.ok(rendered.includes('JANGAN DILAKUKAN'), 'Rendered must include DON\'T section');
  assert.ok(rendered.includes('SEGERA CARI BANTUAN'), 'Rendered must include SEEK HELP section');
  assert.ok(rendered.includes('Status reviewer: approved v1.0.0'), 'Rendered must include reviewer footer');
});

// T-7: unapproved protocol not returned

test('S6F T-7: unapproved protocol is not returned', async () => {
  const protocol = {
    id: 1,
    protocolCode: 'wound_minor',
    locale: 'id',
    title: 'Luka Ringan',
    triggerKeywordsJson: JSON.stringify(['luka']),
    redFlagsJson: JSON.stringify([]),
    doStepsJson: JSON.stringify([]),
    dontStepsJson: JSON.stringify([]),
    seekHelpNowJson: JSON.stringify([]),
    reviewerStatus: 'draft',
    contentVersion: '1.0.0',
  };
  const env = makeMockEnv({ protocols: [protocol] });

  const found = await lookupFirstAidProtocol(env, 'luka', 'id');
  assert.equal(found, null);
});

// T-8: emergency event logged (HL_safetyEvents + HL_auditLogs)

test('S6F T-8: emergency triggers HL_safetyEvents and HL_auditLogs inserts', async () => {
  const env = makeMockEnv({
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 220, unit: 'mmHg', status: 'emergency', measuredAt: NOW_ISO },
    ],
  });

  await processClinicalMessage(env, {
    userId: 8,
    sessionId: 18,
    message: 'pusing berat',
    channel: 'web',
    locale: 'id',
  });

  const safetyInsert = env.inserts.find((i) => i.sql.toLowerCase().includes('hl_safetyevents'));
  const auditInsert = env.inserts.find((i) => i.sql.toLowerCase().includes('hl_auditlogs'));

  assert.ok(safetyInsert, 'HL_safetyEvents must be inserted');
  assert.ok(auditInsert, 'HL_auditLogs must be inserted');
  assert.ok(safetyInsert.sql.toLowerCase().includes('emergencyescalation'), 'Safety eventType must be emergencyEscalation');
  assert.ok(auditInsert.sql.toLowerCase().includes('emergencyescalation') || auditInsert.args.includes('emergencyEscalation'), 'Audit action must be emergencyEscalation');
});

// T-9: WhatsApp emergency response < 400 chars

test('S6F T-9: WhatsApp emergency response is under 400 chars', async () => {
  const env = makeMockEnv({
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: NOW_ISO },
    ],
  });

  const result = await processClinicalMessage(env, {
    userId: 9,
    sessionId: 19,
    message: 'pusing',
    channel: 'whatsapp',
    locale: 'id',
  });

  assert.ok(result.reply.length <= 400, `WhatsApp reply must be <= 400 chars, got ${result.reply.length}`);
  assert.ok(result.reply.includes('AI bisa salah'), 'WhatsApp reply must contain short disclaimer');
});

// T-10: cron retention job runs (test by importing expireSessions etc. with mock env)

test('S6F T-10: cron retention functions run and audit log is written', async () => {
  const { expireSessions, nullifyEncrypted, deleteMessages } = await import('../cron/src/index.js').catch(() => {
    // If cron source isn't resolvable from worker/ai, fall back to relative path discovery
    return import('../../cron/dist/index.js');
  });

  let auditInserted = false;
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.toLowerCase().includes('hl_auditlogs')) auditInserted = true;
              return { meta: { changes: 3 } };
            },
            async all() { return { results: [] }; },
            async first() { return null; },
          };
        },
      };
    },
  };

  const env = { DB: db, RETENTION_SESSIONS_HOURS: '8760' };
  const count = await expireSessions(env);
  assert.equal(count, 3);
  assert.ok(auditInserted, 'Retention job must write audit log');
});
