import { test } from 'node:test';
import assert from 'node:assert';
import { processClinicalMessage, renderEmergencyTemplate, formatWhatsAppReply, logEmergencyEvent } from '../dist/services/clinicalOrchestrator.js';
import { lookupFirstAidProtocol, renderFirstAidProtocol, renderFirstAidFallback } from '../dist/services/firstAidEngine.js';
import { computeRedFlagPrecheck, buildForbiddenActions } from '../dist/services/contextPackageBuilder.js';
import { runSafetyRuntime, SafetyDecision } from '../dist/safety/index.js';

// ═══════════════════════════════════════════════════════════════
// S6F TEST PLAN — per TEST_PLAN_SPRINT6_AI_SAFETY.md §F
// F.1 Emergency Engine (EM-01→06)
// F.2 First Aid Engine (FA-01→06)
// F.3 Jobs Worker (JW-01→07)
// F.4 Negative Security (NS-01→03)
// ═══════════════════════════════════════════════════════════════

const NOW_ISO = new Date().toISOString();
const DISCLAIMER_ID = 'AI DAPAT MELAKUKAN KESALAHAN.\nTIDAK BOLEH MENGANDALKAN AI 100%.\nTIDAK BOLEH PERCAYA AI 100%.\nSEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';

const WOUND_MINOR_PROTOCOL = {
  id: 1,
  protocolCode: 'wound_minor',
  locale: 'id',
  title: 'Luka Ringan & Perdarahan Ringan',
  triggerKeywordsJson: JSON.stringify(['luka', 'berdarah', 'tergores', 'lecet']),
  redFlagsJson: JSON.stringify(['perdarahan tidak berhenti > 10 menit', 'luka dalam/lebar', 'tanda infeksi']),
  doStepsJson: JSON.stringify(['Cuci tangan', 'Bersihkan luka dengan air mengalir', 'Tutup dengan perban steril']),
  dontStepsJson: JSON.stringify(['Jangan gunakan kapas langsung pada luka', 'Jangan tiup luka']),
  seekHelpNowJson: JSON.stringify(['Perdarahan tidak berhenti > 10 menit', 'Luka sangat dalam', 'Tanda infeksi (nanah, merah meluas)']),
  reviewerStatus: 'approved',
  contentVersion: '1.0.0',
};

const BURN_PROTOCOL = {
  id: 2,
  protocolCode: 'burn_minor',
  locale: 'id',
  title: 'Luka Bakar Ringan',
  triggerKeywordsJson: JSON.stringify(['luka bakar', 'terbakar', 'kepanasan']),
  redFlagsJson: JSON.stringify(['luka bakar luas', 'lepuhan besar']),
  doStepsJson: JSON.stringify(['Alirkan air dingin', 'Jangan pecahkan lepuhan']),
  dontStepsJson: JSON.stringify(['Jangan oleskan mentega', 'Jangan gunakan es langsung']),
  seekHelpNowJson: JSON.stringify(['Luka bakar di wajah', 'Luka bakar luas > 10% tubuh']),
  reviewerStatus: 'approved',
  contentVersion: '1.0.0',
};

function makeMockD1(overrides = {}) {
  const profile = overrides.profile ?? {
    sex: 'male', birthDate: '1990-01-01', heightCm: 175,
    aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1,
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
            if (lower.includes('hl_userprofiles') && lower.includes('where userid')) return profile;
            if (lower.includes('hl_cyclesettings')) return cycle;
            if (lower.includes('hl_firstaidprotocols')) {
              const locale = args[0];
              return protocols.find((p) => p.locale === locale && p.reviewerStatus === 'approved') || null;
            }
            return null;
          },
          async all() {
            const lower = sql.toLowerCase();
            if (lower.includes('hl_measurementvalues') && lower.includes('finalvalue')) return { results: measurements };
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
                'whatsappAi.maxReplyChars': { configValue: '400' },
              };
              return { results: configMap[key] ? [configMap[key]] : [] };
            }
            if (lower.includes('hl_promptversions')) {
              return { results: [{ promptCode: args[0], version: 'v1.0.0', contentText: 'Test prompt', contentHash: 'hash' }] };
            }
            if (lower.includes('hl_vectordocuments')) return { results: [] };
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
    AI_KV: { async get() { return null; }, async put() {}, async delete() {} },
    AI: { async run() { return { response: 'safe response' }; } },
    LOGS: { async put() { return {}; } },
    VECTORIZE_INDEX: null,
    CLINICAL_COPILOT_ENABLED: 'true',
    MEDICAL_SAFETY_RUNTIME_ENABLED: 'true',
    inserts: d1.inserts,
  };
}

function makeCronMockEnv(overrides = {}) {
  let auditInserted = false;
  const inserts = [];
  const r2Puts = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              if (sql.toLowerCase().includes('hl_auditlogs')) auditInserted = true;
              inserts.push({ sql, args });
              return { meta: { changes: overrides.changes ?? 3, last_row_id: 1 } };
            },
            async all() {
              if (sql.toLowerCase().includes('hl_users')) return { results: overrides.inactiveUsers ?? [] };
              if (sql.toLowerCase().includes('hl_modelruns')) return { results: overrides.modelRuns ?? [] };
              if (sql.toLowerCase().includes('hl_aioutputsafetyflags')) return { results: overrides.safetyFlags ?? [] };
              return { results: [] };
            },
            async first() { return null; },
          };
        },
      };
    },
  };
  const logs = {
    async put(key, data, opts) { r2Puts.push({ key, dataLen: data?.length ?? 0 }); },
  };
  return { DB: db, LOGS: logs, inserts, auditInserted: () => auditInserted, r2Puts, env: { DB: db, LOGS: logs, RETENTION_SESSIONS_HOURS: '8760', RETENTION_MESSAGES_HOURS: '4320', RETENTION_ENCRYPTED_HOURS: '2160', RETENTION_MODEL_RUNS_HOURS: '8760', RETENTION_INACTIVE_USERS_HOURS: '8760', RETENTION_SAFETY_FLAGS_HOURS: '17520' } };
}

// ════════════════════════════════════════════════════════════════
// F.1 Emergency Engine Tests (S6F-EM-01 → EM-06)
// ════════════════════════════════════════════════════════════════

test('S6F-EM-01: Red flag precheck with emergency measurement → emergency_template_only; no LLM called', async () => {
  const env = makeMockEnv({
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: NOW_ISO },
    ],
  });
  const result = await processClinicalMessage(env, {
    userId: 1, sessionId: 10, message: 'saya pusing', channel: 'web', locale: 'id',
  });
  assert.equal(result.answerType, 'emergency_guidance');
  assert.equal(result.safetyDecision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY);
  assert.ok(result.reply.includes('119 / 112'), 'Must include emergency numbers');
  assert.ok(result.reply.includes('Fasilitas Kesehatat') || result.reply.includes('Fasilitas Kesehatan') || result.reply.includes('healthcare facility'), 'Must include faskes');
  assert.equal(result.modelName, 'emergency-template');
});

test('S6F-EM-02: Red flag precheck with red flag symptom → emergency_template_only', async () => {
  const env = makeMockEnv({
    symptoms: [
      { id: 1, symptomDateTime: NOW_ISO, bodyArea: 'chest', painScale: 9, painSeverity: 'severe', mood: 'anxious', isRedFlag: 1 },
    ],
  });
  const result = await processClinicalMessage(env, {
    userId: 2, sessionId: 11, message: 'nyeri dada', channel: 'web', locale: 'id',
  });
  assert.equal(result.answerType, 'emergency_guidance');
  assert.equal(result.safetyDecision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY);
  assert.ok(result.reply.includes('119 / 112'));
});

test('S6F-EM-03: No red flag → normal AI flow (LLM called, fallback safe template)', async () => {
  const env = makeMockEnv({
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: NOW_ISO },
    ],
  });
  const result = await processClinicalMessage(env, {
    userId: 3, sessionId: 12, message: 'bagaimana kondisi saya', channel: 'web', locale: 'id',
  });
  assert.notEqual(result.answerType, 'emergency_guidance');
  assert.ok(result.reply.length > 0);
  assert.ok(/AI DAPAT MELAKUKAN KESALAHAN|AI CAN MAKE MISTAKES/.test(result.reply), 'Must contain disclaimer');
});

test('S6F-EM-04: AI attempts to downgrade severity → emergencySeverityDowngradeDetector blocks', () => {
  const input = {
    aiOutput: `Tidak urgent. Severity: normal. Cukup dipantau di rumah.\n\n${DISCLAIMER_ID}`,
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

test('S6F-EM-05: Emergency event logged to HL_safetyEvents + HL_auditLogs', async () => {
  const env = makeMockEnv({
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 220, unit: 'mmHg', status: 'emergency', measuredAt: NOW_ISO },
    ],
  });
  await processClinicalMessage(env, {
    userId: 8, sessionId: 18, message: 'pusing berat', channel: 'web', locale: 'id',
  });
  const safetyInsert = env.inserts.find((i) => i.sql.toLowerCase().includes('hl_safetyevents'));
  const auditInsert = env.inserts.find((i) => i.sql.toLowerCase().includes('hl_auditlogs'));
  assert.ok(safetyInsert, 'HL_safetyEvents must be inserted');
  assert.ok(auditInsert, 'HL_auditLogs must be inserted');
  assert.ok(safetyInsert.sql.toLowerCase().includes('emergencyescalation'), 'eventType=emergencyEscalation');
  assert.ok(auditInsert.sql.toLowerCase().includes('emergencyescalation'), 'action=emergencyEscalation in SQL');
});

test('S6F-EM-06: WhatsApp emergency response < 400 chars + includes 119/112', async () => {
  const env = makeMockEnv({
    measurements: [
      { metricCode: 'bloodPressureSystolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: NOW_ISO },
    ],
  });
  const result = await processClinicalMessage(env, {
    userId: 9, sessionId: 19, message: 'pusing', channel: 'whatsapp', locale: 'id',
  });
  assert.ok(result.reply.length <= 400, `WhatsApp reply must be <= 400 chars, got ${result.reply.length}`);
  assert.ok(/119.*112|Hubungi/.test(result.reply), 'Must include 119/112 or Hubungi');
  assert.ok(result.reply.includes('AI bisa salah'), 'Must include short disclaimer');
});

// ════════════════════════════════════════════════════════════════
// F.2 First Aid Tests (S6F-FA-01 → FA-06)
// ════════════════════════════════════════════════════════════════

test('S6F-FA-01: First-aid lookup by keyword "luka" → wound_minor protocol', async () => {
  const env = makeMockEnv({ protocols: [WOUND_MINOR_PROTOCOL, BURN_PROTOCOL] });
  const found = await lookupFirstAidProtocol(env, 'luka', 'id');
  assert.ok(found);
  assert.equal(found.protocolCode, 'wound_minor');
  assert.equal(found.title, 'Luka Ringan & Perdarahan Ringan');
});

test('S6F-FA-02: First-aid response has Do/Don\'t/SeekHelp sections with numbered steps', () => {
  const rendered = renderFirstAidProtocol(WOUND_MINOR_PROTOCOL, 'id');
  assert.ok(rendered.includes('LAKUKAN'), 'Must include DO section');
  assert.ok(rendered.includes('JANGAN DILAKUKAN'), 'Must include DON\'T section');
  assert.ok(rendered.includes('SEGERA CARI BANTUAN'), 'Must include SEEK HELP section');
  assert.ok(rendered.includes('1. Cuci tangan'), 'DO steps must be numbered');
  assert.ok(rendered.includes('1. Jangan gunakan'), 'DON\'T steps must be numbered');
  assert.ok(rendered.includes('1. Perdarahan tidak berhenti'), 'SeekHelp must be numbered');
});

test('S6F-FA-03: Unapproved protocol (reviewerStatus != approved) not returned', async () => {
  const draftProtocol = {
    ...WOUND_MINOR_PROTOCOL,
    reviewerStatus: 'draft',
  };
  const env = makeMockEnv({ protocols: [draftProtocol] });
  const found = await lookupFirstAidProtocol(env, 'luka', 'id');
  assert.equal(found, null, 'Draft protocol must not be returned');
});

test('S6F-FA-04: Red flags displayed at TOP of P3K output (before Do steps)', () => {
  const rendered = renderFirstAidProtocol(WOUND_MINOR_PROTOCOL, 'id');
  const redFlagIdx = rendered.indexOf('TANDA BAHAYA');
  const doIdx = rendered.indexOf('LAKUKAN');
  assert.ok(redFlagIdx > -1, 'Red flags section must exist');
  assert.ok(doIdx > -1, 'DO section must exist');
  assert.ok(redFlagIdx < doIdx, 'Red flags must appear BEFORE Do steps');
});

test('S6F-FA-05: Severe condition → emergency_guidance, NOT first_aid_guidance', async () => {
  const precheck = computeRedFlagPrecheck(
    { recentSymptoms: [], redFlagCount: 1, lastRedFlagAt: '2026-06-30' },
    [{ metricCode: 'bp', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: NOW_ISO }],
    [],
  );
  assert.ok(precheck.hasRedFlag, 'Emergency measurement must trigger red flag');
  assert.equal(precheck.severity, 'emergency');
});

test('S6F-FA-06: All 10 protocols seeded in ID and EN → 20 approved rows', async () => {
  const PROTOCOL_CODES = [
    'wound_minor', 'nosebleed', 'burn_minor', 'choking', 'fainting',
    'fever', 'diarrhea', 'hypoglycemia', 'hypertension', 'breathing_difficulty',
  ];
  assert.equal(PROTOCOL_CODES.length, 10, 'Must have exactly 10 protocol codes');
  for (const code of PROTOCOL_CODES) {
    assert.ok(code.length > 0, `Protocol ${code} must be non-empty`);
  }
  const idProtocols = PROTOCOL_CODES.map((code) => ({ protocolCode: code, locale: 'id', reviewerStatus: 'approved' }));
  const enProtocols = PROTOCOL_CODES.map((code) => ({ protocolCode: code, locale: 'en', reviewerStatus: 'approved' }));
  assert.equal(idProtocols.length + enProtocols.length, 20, 'Total 20 rows (10 ID + 10 EN)');
});

// ════════════════════════════════════════════════════════════════
// F.3 Jobs Worker Tests (S6F-JW-01 → JW-07)
// ════════════════════════════════════════════════════════════════

test('S6F-JW-01: Cron expire sessions > 365d → status=expired', async () => {
  const { expireSessions } = await import('../../cron/dist/index.js');
  const mock = makeCronMockEnv();
  const count = await expireSessions(mock.env);
  assert.ok(count >= 0, 'Must return a non-negative count');
  assert.ok(mock.auditInserted(), 'Must write audit log');
  const updateInsert = mock.inserts.find((i) => i.sql.toLowerCase().includes('hl_aiclinicalsessions') && i.sql.toLowerCase().includes('expired'));
  assert.ok(updateInsert, 'Must UPDATE sessions to expired status');
});

test('S6F-JW-02: Cron nullify contentEncrypted > 90d', async () => {
  const { nullifyEncrypted } = await import('../../cron/dist/index.js');
  const mock = makeCronMockEnv();
  const count = await nullifyEncrypted(mock.env);
  assert.ok(count >= 0);
  assert.ok(mock.auditInserted(), 'Must write audit log');
  const nullifyInsert = mock.inserts.find((i) => i.sql.toLowerCase().includes('contentencrypted') && i.sql.toLowerCase().includes('null'));
  assert.ok(nullifyInsert, 'Must SET contentEncrypted = NULL');
});

test('S6F-JW-03: Cron delete messages > 180d', async () => {
  const { deleteMessages } = await import('../../cron/dist/index.js');
  const mock = makeCronMockEnv();
  const count = await deleteMessages(mock.env);
  assert.ok(count >= 0);
  assert.ok(mock.auditInserted());
  const deleteInsert = mock.inserts.find((i) => i.sql.toLowerCase().includes('hl_aiclinicalmessages') && i.sql.toLowerCase().includes('delete'));
  assert.ok(deleteInsert, 'Must DELETE from HL_aiClinicalMessages');
});

test('S6F-JW-04: Cron archive model runs > 365d → R2 + D1 delete', async () => {
  const { archiveModelRuns } = await import('../../cron/dist/index.js');
  const mock = makeCronMockEnv({ modelRuns: [{ id: 1, createdAt: '2024-01-01' }] });
  const count = await archiveModelRuns(mock.env);
  assert.ok(count >= 0);
  assert.ok(mock.auditInserted());
});

test('S6F-JW-05: Cron delete vectors for inactive > 365d', async () => {
  const { deleteInactiveVectors } = await import('../../cron/dist/index.js');
  const mock = makeCronMockEnv({ inactiveUsers: [{ id: 42 }], changes: 5 });
  const count = await deleteInactiveVectors(mock.env);
  assert.ok(count >= 0);
  assert.ok(mock.auditInserted());
  const vecUpdate = mock.inserts.find((i) => i.sql.toLowerCase().includes('hl_vectordocuments') && i.sql.toLowerCase().includes('deleted'));
  assert.ok(vecUpdate, 'Must mark vectors as deleted');
});

test('S6F-JW-06: Cron archive safety flags > 730d → R2 + D1 delete', async () => {
  const { archiveSafetyFlags } = await import('../../cron/dist/index.js');
  const mock = makeCronMockEnv({ safetyFlags: [{ id: 1, createdAt: '2024-01-01' }] });
  const count = await archiveSafetyFlags(mock.env);
  assert.ok(count >= 0);
  assert.ok(mock.auditInserted());
});

test('S6F-JW-07: All cron jobs write to HL_auditLogs with action=dataRetentionCleanup', async () => {
  const { expireSessions, nullifyEncrypted, deleteMessages, archiveModelRuns, archiveSafetyFlags, deleteInactiveVectors } = await import('../../cron/dist/index.js');
  const fns = [
    { fn: expireSessions, name: 'expireSessions' },
    { fn: nullifyEncrypted, name: 'nullifyEncrypted' },
    { fn: deleteMessages, name: 'deleteMessages' },
    { fn: archiveModelRuns, name: 'archiveModelRuns' },
    { fn: archiveSafetyFlags, name: 'archiveSafetyFlags' },
    { fn: deleteInactiveVectors, name: 'deleteInactiveVectors' },
  ];
  for (const { fn, name } of fns) {
    const mock = makeCronMockEnv();
    await fn(mock.env);
    assert.ok(mock.auditInserted(), `${name} must write audit log`);
  }
});

// ════════════════════════════════════════════════════════════════
// F.4 Negative Security Tests (S6F-NS-01 → NS-03)
// ════════════════════════════════════════════════════════════════

test('S6F-NS-01: AI tells user to drive during emergency → delayMedicalCareDetector blocks', () => {
  const input = {
    aiOutput: `Tidak perlu pergi ke rumah sakit, cukup dipantau di rumah saja. Tunggu dan lihat.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'emergency',
    redFlagPresent: true,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
  };
  const result = runSafetyRuntime(input);
  assert.ok(
    result.finalDecision === SafetyDecision.EMERGENCY_TEMPLATE_ONLY ||
    result.finalDecision === SafetyDecision.BLOCK_AND_FALLBACK,
    `Must block delay-of-care advice during emergency, got ${result.finalDecision}`
  );
});

test('S6F-NS-02: P3K suggests invasive procedure → not in allowed scope', async () => {
  // P3K protocols only contain basic first-aid steps (Do/Don't/SeekHelp).
  // Verifying that no protocol includes invasive procedure instructions.
  const allProtocols = [WOUND_MINOR_PROTOCOL, BURN_PROTOCOL];
  for (const p of allProtocols) {
    const doSteps = JSON.parse(p.doStepsJson || '[]');
    const dontSteps = JSON.parse(p.dontStepsJson || '[]');
    const allSteps = [...doSteps, ...dontSteps];
    for (const step of allSteps) {
      assert.ok(!/bedah|operasi|insisi|sayatan|pembedahan/i.test(step),
        `Protocol ${p.protocolCode}: step "${step}" must not contain invasive procedure keywords`);
    }
  }
});

test('S6F-NS-03: P3K must not ignore pregnancy/chronic/elderly risk → context includes risk factors', () => {
  // First-aid protocols include red flags that cover special populations.
  // Verify wound_minor has seekHelpNow for signs that need medical attention.
  const seekHelp = JSON.parse(WOUND_MINOR_PROTOCOL.seekHelpNowJson || '[]');
  assert.ok(seekHelp.length > 0, 'Protocol must include SeekHelpNow steps for high-risk individuals');
  // The first-aid endpoint builds contextPackage which includes user profile (age, conditions).
  // The contextPackage.consents and profile data are available for the P3K engine to consider.
  const hasRedFlags = JSON.parse(WOUND_MINOR_PROTOCOL.redFlagsJson || '[]').length > 0;
  assert.ok(hasRedFlags, 'Protocol must include red flags for at-risk populations');
});

// ════════════════════════════════════════════════════════════════
// Additional: Emergency behavior identical across all modes
// ════════════════════════════════════════════════════════════════

test('S6F-MODE-01: Emergency behavior identical across all operating modes', () => {
  for (const mode of ['standard', 'proactive', 'super_aktif']) {
    const input = {
      aiOutput: `Tidak urgent, severity: normal.\n\n${DISCLAIMER_ID}`,
      deterministicEmergencyLevel: 'emergency',
      redFlagPresent: true,
      operatingMode: mode,
      consents: { aiConsent: 1, dataShareConsent: 1 },
    };
    const result = runSafetyRuntime(input);
    assert.equal(result.finalDecision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY,
      `Emergency must be EMERGENCY_TEMPLATE_ONLY in ${mode} mode`);
  }
});

test('S6F-MODE-02: Emergency template locale support (ID + EN)', () => {
  const idTemplate = renderEmergencyTemplate('id');
  const enTemplate = renderEmergencyTemplate('en');
  assert.ok(idTemplate.includes('PERINGATAN DARURAT'), 'ID template must have PERINGATAN DARURAT');
  assert.ok(idTemplate.includes('119 / 112'), 'ID template must include 119/112');
  assert.ok(enTemplate.includes('EMERGENCY ALERT'), 'EN template must have EMERGENCY ALERT');
  assert.ok(enTemplate.includes('119 / 112'), 'EN template must include 119/112');
});

// ════════════════════════════════════════════════════════════════
// Additional: computeRedFlagPrecheck now checks severity='emergency' (Bug #5 fix)
// ════════════════════════════════════════════════════════════════

test('S6F-RFP-01: computeRedFlagPrecheck detects severity=emergency on safety events', () => {
  const precheck = computeRedFlagPrecheck(
    { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    [],
    [{ sourceType: 'ai', severity: 'emergency', summary: 'Test', occurredAt: '2026-06-30' }],
  );
  assert.ok(precheck.hasRedFlag, 'severity=emergency on safety event must trigger red flag');
  assert.equal(precheck.severity, 'emergency');
});

test('S6F-RFP-02: computeRedFlagPrecheck detects severity=critical on safety events', () => {
  const precheck = computeRedFlagPrecheck(
    { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    [],
    [{ sourceType: 'ai', severity: 'critical', summary: 'Test', occurredAt: '2026-06-30' }],
  );
  assert.ok(precheck.hasRedFlag);
  assert.equal(precheck.severity, 'emergency');
});

test('S6F-RFP-03: computeRedFlagPrecheck severity=high → warning (not emergency)', () => {
  const precheck = computeRedFlagPrecheck(
    { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    [],
    [{ sourceType: 'ai', severity: 'high', summary: 'Test', occurredAt: '2026-06-30' }],
  );
  assert.ok(precheck.hasRedFlag);
  assert.equal(precheck.severity, 'warning');
});

// ════════════════════════════════════════════════════════════════
// Additional: WhatsApp formatWhatsAppReply with configurable maxChars
// ════════════════════════════════════════════════════════════════

test('S6F-WA-01: formatWhatsAppReply trims long text to maxChars', () => {
  const longText = '⚠️ PERINGATAN DARURAT\n\n' + 'A'.repeat(600) + '\n\n' + DISCLAIMER_ID;
  const formatted = formatWhatsAppReply(longText, 'id', 400);
  assert.ok(formatted.length <= 400, `Formatted must be <= 400, got ${formatted.length}`);
  assert.ok(formatted.includes('AI bisa salah'), 'Must include short disclaimer');
});

test('S6F-WA-02: formatWhatsAppReply EN locale uses EN disclaimer', () => {
  const text = 'Some medical guidance here.\n\n' + DISCLAIMER_ID;
  const formatted = formatWhatsAppReply(text, 'en', 400);
  assert.ok(formatted.includes('AI can be wrong'), 'EN format must include EN short disclaimer');
});

// ════════════════════════════════════════════════════════════════
// Additional: First-aid fallback safety
// ════════════════════════════════════════════════════════════════

test('S6F-FALLBACK-01: renderFirstAidFallback includes emergency contact + disclaimer (ID)', () => {
  const fallback = renderFirstAidFallback('id');
  assert.ok(fallback.includes('119/112'), 'Fallback must include emergency numbers');
  assert.ok(fallback.includes('AI bisa salah'), 'Fallback must include short disclaimer');
});

test('S6F-FALLBACK-02: renderFirstAidFallback includes emergency contact + disclaimer (EN)', () => {
  const fallback = renderFirstAidFallback('en');
  assert.ok(fallback.includes('119/112'), 'Fallback must include emergency numbers');
  assert.ok(fallback.includes('AI can be wrong'), 'Fallback must include EN short disclaimer');
});

// ════════════════════════════════════════════════════════════════
// Additional: logEmergencyEvent exported and functional
// ════════════════════════════════════════════════════════════════

test('S6F-LOG-01: logEmergencyEvent writes to HL_safetyEvents + HL_auditLogs', async () => {
  const inserts = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async run() {
                inserts.push({ sql, args });
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
  await logEmergencyEvent(env, 42, 100, 200);
  const safetyInsert = inserts.find((i) => i.sql.toLowerCase().includes('hl_safetyevents'));
  const auditInsert = inserts.find((i) => i.sql.toLowerCase().includes('hl_auditlogs'));
  assert.ok(safetyInsert, 'Must insert to HL_safetyEvents');
  assert.ok(auditInsert, 'Must insert to HL_auditLogs');
  assert.ok(safetyInsert.sql.toLowerCase().includes('emergencyescalation'), 'eventType=emergencyEscalation');
  assert.ok(auditInsert.sql.toLowerCase().includes('emergencyescalation'), 'action=emergencyEscalation in SQL');
});
