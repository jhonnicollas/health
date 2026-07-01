import { test } from 'node:test';
import assert from 'node:assert';
import { computeRedFlagPrecheck } from '../dist/services/contextPackageBuilder.js';
import { processClinicalMessage, renderEmergencyTemplate } from '../dist/services/clinicalOrchestrator.js';

function makeSymptom(bodyArea, isRedFlag = true) {
  return {
    recentSymptoms: [{ id: 1, bodyArea, painScale: 8, painSeverity: 'severe', isRedFlag, symptomDateTime: '2026-06-30T08:00:00Z' }],
    redFlagCount: isRedFlag ? 1 : 0,
    lastRedFlagAt: isRedFlag ? '2026-06-30T08:00:00Z' : null,
  };
}

function makeMeasurement(metricCode, finalValue, unit, status) {
  return [{ metricCode, finalValue, unit, status, measuredAt: '2026-06-30T08:00:00Z' }];
}

const symptomCases = [
  'chest_pain', 'shortness_of_breath', 'stroke_weakness', 'severe_allergic_reaction',
  'uncontrolled_bleeding', 'loss_of_consciousness', 'seizure', 'suicidal_ideation',
  'severe_abdominal_pain', 'high_fever', 'dehydration', 'poisoning', 'severe_head_injury',
  'eye_injury', 'severe_burn', 'anaphylaxis', 'unresponsive', 'difficulty_breathing',
  'chest_tightness', 'irregular_heartbeat', 'severe_dizziness', 'slurred_speech',
  'one_sided_weakness', 'sudden_confusion', 'sudden_severe_headache', 'vision_loss',
  'severe_back_pain', 'persistent_vomiting', 'blood_in_stool', 'blood_in_urine',
  'severe_joint_swelling', 'high_blood_sugar', 'low_blood_sugar', 'severe_hypotension',
  'severe_hypertension', 'rapid_heart_rate', 'slow_heart_rate', 'cyanosis',
  'severe_abdominal_cramping', 'ectopic_pregnancy_risk', 'placental_abruption_risk',
  'severe_pelvic_pain', 'postpartum_hemorrhage', 'neonatal_fever', 'severe_asthma_attack',
  'anaphylactic_shock', 'drug_overdose', 'alcohol_poisoning', 'carbon_monoxide',
];

const measurementCases = [
  ['bloodPressureSystolic', 220, 'mmHg', 'emergency'],
  ['bloodPressureSystolic', 40, 'mmHg', 'emergency'],
  ['heartRate', 180, 'bpm', 'emergency'],
  ['heartRate', 28, 'bpm', 'emergency'],
  ['bloodGlucose', 600, 'mg/dL', 'emergency'],
  ['bloodGlucose', 25, 'mg/dL', 'emergency'],
  ['oxygenSaturation', 75, '%', 'emergency'],
  ['bodyTemperature', 41.5, 'C', 'emergency'],
  ['respiratoryRate', 40, 'bpm', 'emergency'],
  ['respiratoryRate', 6, 'bpm', 'emergency'],
];

const safetyEventCases = [
  { sourceType: 'ai', severity: 'critical', summary: 'Fall detected', occurredAt: '2026-06-30T08:00:00Z' },
  { sourceType: 'rule', severity: 'critical', summary: 'Hypertensive crisis', occurredAt: '2026-06-30T08:00:00Z' },
  { sourceType: 'sensor', severity: 'critical', summary: 'No movement 24h', occurredAt: '2026-06-30T08:00:00Z' },
];

const cases = [];

// Symptom-based red flag cases
for (let i = 0; i < 50; i++) {
  const bodyArea = symptomCases[i % symptomCases.length];
  cases.push({
    label: `symptom-${i + 1}-${bodyArea}`,
    symptoms: makeSymptom(bodyArea, true),
    measurements: [],
    safetyEvents: [],
  });
}

// Measurement-based emergency cases (40)
for (let i = 0; i < 40; i++) {
  const [metricCode, finalValue, unit, status] = measurementCases[i % measurementCases.length];
  cases.push({
    label: `measurement-${i + 1}-${metricCode}`,
    symptoms: { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    measurements: makeMeasurement(metricCode, finalValue + (i * 0.1), unit, status),
    safetyEvents: [],
  });
}

// Safety event critical cases (10)
for (let i = 0; i < 10; i++) {
  cases.push({
    label: `safetyevent-${i + 1}`,
    symptoms: { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    measurements: [],
    safetyEvents: [safetyEventCases[i % safetyEventCases.length]],
  });
}

let misses = 0;

for (const c of cases) {
  test(`S6I-T-05 red flag case: ${c.label}`, () => {
    const precheck = computeRedFlagPrecheck(c.symptoms, c.measurements, c.safetyEvents);
    if (!precheck.hasRedFlag || precheck.severity !== 'emergency') {
      misses += 1;
    }
    assert.equal(precheck.hasRedFlag, true, `${c.label}: hasRedFlag must be true`);
    assert.equal(precheck.severity, 'emergency', `${c.label}: severity must be emergency`);
  });
}

test('S6I-T-05 zero missed red flags across 100 deterministic cases', () => {
  assert.equal(misses, 0, `Expected 0 missed red flags, got ${misses}`);
});

// Orchestrator emergency path smoke test with mock env
function createEnv() {
  let callIndex = 0;
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              first: async () => {
                if (sql.includes('HL_userProfiles')) {
                  return { sex: 'male', birthDate: '1980-01-01', heightCm: 170, aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 };
                }
                if (sql.includes('HL_systemConfigs')) {
                  if (sql.includes('clinicalCopilot.operatingMode')) return { configValue: 'standard' };
                  if (sql.includes('clinicalCopilot.maxTokens')) return { configValue: '500' };
                  if (sql.includes('clinicalCopilot.temperature')) return { configValue: '3' };
                  if (sql.includes('medicalSafetyRuntime.enabled')) return { configValue: 'true' };
                  return null;
                }
                if (sql.includes('HL_aiClinicalSessions') && sql.includes('INSERT')) {
                  return null;
                }
                if (sql.includes('HL_promptVersions')) return null;
                return null;
              },
              all: async () => {
                if (sql.includes('HL_measurementValues') && sql.includes('MAX')) {
                  return { results: [], meta: {} };
                }
                if (sql.includes('HL_symptomLogs')) {
                  return { results: [{ id: 1, symptomDateTime: '2026-06-30T08:00:00Z', bodyArea: 'chest', painScale: 9, painSeverity: 'severe', mood: 'anxious', isRedFlag: 1 }], meta: {} };
                }
                return { results: [], meta: {} };
              },
              run: async () => ({ meta: { last_row_id: 1 + callIndex++, changes: 1 } }),
            };
          },
        };
      },
    },
    AI_KV: { get: async () => null, put: async () => {}, delete: async () => {} },
    VECTORIZE_INDEX: undefined,
    AI: undefined,
    LOGS: { put: async () => ({}) },
    WHATSAPP_OUTBOUND_QUEUE: undefined,
  };
}

test('S6I-T-05 orchestrator returns emergency_guidance for red flag symptom', async () => {
  const result = await processClinicalMessage(createEnv(), {
    userId: 1,
    sessionId: 1,
    message: 'Saya nyeri dada',
    channel: 'web',
    locale: 'id',
  });
  assert.equal(result.answerType, 'emergency_guidance');
  assert.equal(result.redFlagStatus, 'emergency');
  assert.ok(result.reply.includes('119') || result.reply.includes('112') || result.reply.includes('PERINGATAN DARURAT') || result.reply.includes('EMERGENCY'));
});

test('S6I-T-05 renderEmergencyTemplate bilingual', () => {
  const id = renderEmergencyTemplate('id');
  const en = renderEmergencyTemplate('en');
  assert.ok(id.includes('PERINGATAN DARURAT'));
  assert.ok(en.includes('EMERGENCY ALERT'));
  assert.ok(id.includes('119'));
  assert.ok(en.includes('119'));
});
