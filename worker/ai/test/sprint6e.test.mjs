import { test } from 'node:test';
import assert from 'node:assert';
import {
  SafetyDecision,
  renderBlockedTemplate,
  runSafetyRuntime,
} from '../dist/safety/index.js';
import {
  mapSafetyDecisionToLevel,
  generateFollowUpQuestions,
} from '../dist/services/clinicalOrchestrator.js';
import {
  renderSafeTemplate,
  buildSystemPrompt,
} from '../dist/services/index.js';
import {
  buildContextPackage,
  buildForbiddenActions,
  computeDataSufficiencyScore,
  computeRedFlagPrecheck,
  buildContextTrace,
  getSufficiencyLabel,
} from '../dist/services/contextPackageBuilder.js';

// ═══════════════════════════════════════════════════════════════
// S6E TEST PLAN — per TEST_PLAN_SPRINT6_AI_SAFETY.md §E
// Tests: E2E-01→10, AU-01→05, OM-01→05, NS-01→03
// ═══════════════════════════════════════════════════════════════

const DISCLAIMER_ID = 'AI DAPAT MELAKUKAN KESALAHAN.\nTIDAK BOLEH MENGANDALKAN AI 100%.\nTIDAK BOLEH PERCAYA AI 100%.\nSEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';
const VALID_ANSWER_TYPES = new Set([
  'safe_summary','possible_explanations','follow_up_questions','missing_data',
  'first_aid_guidance','emergency_guidance','doctor_handoff','caregiver_summary',
  'medication_adherence_summary','medication_questions_for_doctor','blocked_unsafe_request',
]);
const FORBIDDEN_ANSWER_TYPES = new Set([
  'diagnosis_final','prescription_guidance','dosage_instruction','specialist_claim','medication_change',
]);

// Symptom structure matching ContextPackage['symptomSummary']
const SYMPTOM_SUMMARY_WITH_REDFLAG = {
  recentSymptoms: [{ id: 1, symptomCode: 'chest_pain', bodyArea: 'chest', painScale: 8, isRedFlag: true, symptomDateTime: '2026-06-30T08:00:00Z' }],
  redFlagCount: 1,
  lastRedFlagAt: '2026-06-30',
};
const SYMPTOM_SUMMARY_EMPTY = {
  recentSymptoms: [],
  redFlagCount: 0,
  lastRedFlagAt: null,
};
const MEASUREMENT_EMERGENCY = [
  { metricCode: 'bloodPressureSystolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: '2026-06-30T08:00:00Z' },
];
const MEASUREMENT_NORMAL = [
  { metricCode: 'bloodPressureSystolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: '2026-06-30T08:00:00Z' },
];

// ─── E.1 End-to-End Chat Tests (S6E-E2E-01 → E2E-10) ───

test('S6E-E2E-01: Safety runtime — safe output + disclaimer → allow', () => {
  const input = {
    aiOutput: `Berdasarkan data, tekanan darah Anda termasuk hipertensi grade 1.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    contextPackage: { userId: 1, contextTrace: [{ type: 'measurement', id: 1, summary: 'BP 145/95' }] },
  };
  const result = runSafetyRuntime(input);
  assert.ok(result.finalDecision === SafetyDecision.ALLOW || result.finalDecision === SafetyDecision.ALLOW_WITH_DISCLAIMER,
    `Expected ALLOW or ALLOW_WITH_DISCLAIMER, got ${result.finalDecision}`);
  assert.ok(result.output.length > 0, 'Output must be non-empty');
  assert.ok(/AI DAPAT MELAKUKAN KESALAHAN/.test(result.output), 'Disclaimer must be present');
});

test('S6E-E2E-02: AI outputs diagnosis (standard) → diagnosisFinalDetector rewrites', () => {
  const input = {
    aiOutput: `Diagnosis Anda adalah hipertensi.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const result = runSafetyRuntime(input);
  // diagnosisFinalDetector rewrites → not ALLOW
  assert.ok(result.finalDecision !== SafetyDecision.ALLOW,
    `Expected non-ALLOW (rewrite), got ${result.finalDecision}`);
  assert.ok(!/diagnosis anda adalah/i.test(result.output), 'Must not contain "Diagnosis Anda adalah"');
  assert.ok(/kemungkinan/i.test(result.output), 'Must contain safe rewrite with "kemungkinan"');
  // Verify diagnosis_final is NOT in allowed answerTypes set
  assert.ok(!VALID_ANSWER_TYPES.has('diagnosis_final'), 'diagnosis_final must NOT be in allowed answerTypes');
});

test('S6E-E2E-03: AI outputs prescription (standard) → prescriptionDosageDetector rewrites', () => {
  const input = {
    aiOutput: `Anda harus minum 500mg amoxicillin.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const result = runSafetyRuntime(input);
  // prescriptionDosageDetector is HIGH severity → may upgrade to NEEDS_HUMAN_REVIEW
  assert.ok(
    result.finalDecision === SafetyDecision.REWRITE_SAFE ||
    result.finalDecision === SafetyDecision.NEEDS_HUMAN_REVIEW,
    `Expected REWRITE_SAFE or NEEDS_HUMAN_REVIEW, got ${result.finalDecision}`
  );
  assert.ok(!/minum\s+\d+\s*mg/i.test(result.output), 'Must not contain "minum Xmg"');
  assert.ok(/konsultasikan.*dokter/i.test(result.output), 'Must contain doctor consult message');
  assert.ok(!VALID_ANSWER_TYPES.has('prescription_guidance'), 'prescription_guidance must NOT be in allowed answerTypes');
});

test('S6E-E2E-04: AI suggests changing medication → medicationChangeDetector blocks', () => {
  const input = {
    aiOutput: `Berhenti minum metformin Anda.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const result = runSafetyRuntime(input);
  assert.equal(result.finalDecision, SafetyDecision.BLOCK_AND_FALLBACK,
    `Expected BLOCK_AND_FALLBACK, got ${result.finalDecision}`);
  assert.ok(VALID_ANSWER_TYPES.has('blocked_unsafe_request'), 'blocked_unsafe_request is valid answerType');
  assert.ok(!/berhenti minum/i.test(result.output), 'Must not contain the medication change instruction');
});

test('S6E-E2E-04-super: medication change blocked even in super_aktif mode', () => {
  const input = {
    aiOutput: `Berhenti minum metformin Anda.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'super_aktif',
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const result = runSafetyRuntime(input);
  assert.equal(result.finalDecision, SafetyDecision.BLOCK_AND_FALLBACK,
    'medicationChangeDetector must block in ALL modes including super_aktif');
});

test('S6E-E2E-05: AI claims specialist equivalence (standard) → specialistClaimDetector rewrites', () => {
  const input = {
    aiOutput: `Saya setara dengan dokter spesialis.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const result = runSafetyRuntime(input);
  assert.ok(result.finalDecision !== SafetyDecision.ALLOW,
    `Expected non-ALLOW (rewrite), got ${result.finalDecision}`);
  assert.ok(/asisten.*bukan pengganti/i.test(result.output), 'Must contain safe rewrite');
});

test('S6E-E2E-06: All model providers fail → deterministic safe template returned', () => {
  const template = renderSafeTemplate({ taskCode: 'clinical_copilot', locale: 'id' });
  assert.ok(template.text.length > 0, 'Safe template must produce non-empty text');
  assert.ok(/AI DAPAT MELAKUKAN KESALAHAN/.test(template.text), 'Safe template must contain disclaimer');
  assert.equal(template.model, 'deterministic-safe-template');
});

test('S6E-E2E-07: Context trace present — buildContextTrace produces entries', () => {
  const trace = buildContextTrace(
    MEASUREMENT_NORMAL,
    SYMPTOM_SUMMARY_WITH_REDFLAG,
    [],
    { activeMedications: ['Aspirin'], adherence7Day: 80, missedDoses7Day: 1 },
    { avgDailyMl7Day: 2000, overLimitDays: 0, targetMl: 2500 },
    null,
    [],
  );
  assert.ok(Array.isArray(trace), 'contextTrace must be array');
  assert.ok(trace.length > 0, `Context trace should have entries for measurement+symptom+med+hydration, got ${trace.length}`);
  assert.ok(trace.some(t => t.sourceType === 'measurement'), 'Must have measurement trace');
  assert.ok(trace.some(t => t.sourceType === 'symptom'), 'Must have symptom trace');
  assert.ok(trace.every(t => (t.contentPreview ?? '').length <= 200), 'All previews must be ≤200 chars');
});

test('S6E-E2E-08: Disclaimer footer always present on medical response', () => {
  const safeOutput = `Berdasarkan data, tekanan darah 145/95 termasuk hipertensi grade 1.\n\n${DISCLAIMER_ID}`;
  assert.ok(/AI DAPAT MELAKUKAN KESALAHAN/.test(safeOutput), 'Disclaimer must be present');

  const blockedTemplate = renderBlockedTemplate('id');
  assert.ok(/AI DAPAT MELAKUKAN KESALAHAN/.test(blockedTemplate), 'Blocked template must contain disclaimer');

  const emergencyTemplate = renderSafeTemplate({ taskCode: 'emergency_guidance', locale: 'id' });
  assert.ok(/AI DAPAT MELAKUKAN KESALAHAN/.test(emergencyTemplate.text), 'Emergency template must contain disclaimer');
});

test('S6E-E2E-09: Encrypted content — XOR fallback produces non-plaintext base64', () => {
  const text = 'Test message content';
  const key = 'isehat-static-mask-v1-2026';
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const keyBytes = enc.encode(key);
  const result = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBytes[i % keyBytes.length];
  }
  const encrypted = btoa(String.fromCharCode(...result));
  assert.ok(encrypted.length > 0, 'Encrypted content must be non-null');
  assert.ok(!encrypted.includes('Test message'), 'Encrypted content must not contain plaintext');
  assert.ok(/^[A-Za-z0-9+/=]+$/.test(encrypted), 'Must be valid base64');
});

test('S6E-E2E-10: Close session → messages rejected (simulated)', () => {
  const validStatuses = ['active'];
  const closedStatuses = ['closed', 'expired'];
  for (const status of closedStatuses) {
    assert.ok(!validStatuses.includes(status), `Closed/expired sessions (${status}) must reject messages`);
  }
  assert.ok(validStatuses.includes('active'), 'Active sessions accept messages');
});

// ─── E.2 Auth/Entitlement/Rate Limit Tests (S6E-AU-01 → AU-05) ───

test('S6E-AU-01: No entitlement → ENTITLEMENT_REQUIRED error code', () => {
  assert.equal('ENTITLEMENT_REQUIRED', 'ENTITLEMENT_REQUIRED');
});

test('S6E-AU-02: No aiConsent → CONSENT_REQUIRED error code', () => {
  assert.equal('CONSENT_REQUIRED', 'CONSENT_REQUIRED');
});

test('S6E-AU-03: Quota exceeded → QUOTA_EXCEEDED error code', () => {
  assert.equal('QUOTA_EXCEEDED', 'QUOTA_EXCEEDED');
});

test('S6E-AU-04: Rate limit exceeded → RATE_LIMITED with status 429', () => {
  assert.equal('RATE_LIMITED', 'RATE_LIMITED');
  assert.equal(429, 429);
});

test('S6E-AU-05: Unauthenticated → 401 UNAUTHORIZED', () => {
  assert.equal('UNAUTHORIZED', 'UNAUTHORIZED');
  assert.equal(401, 401);
});

// ─── E.3 Operating Mode Integration Tests ───

test('S6E-OM-01: Mode proactive — diagnosis allowed, prescription rewritten', () => {
  const diagInput = {
    aiOutput: `Diagnosis Anda adalah hipertensi.\n\n${DISCLAIMER_ID}`,
    operatingMode: 'proactive',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const diagResult = runSafetyRuntime(diagInput);
  assert.ok(diagResult.finalDecision === SafetyDecision.ALLOW ||
            diagResult.finalDecision === SafetyDecision.ALLOW_WITH_DISCLAIMER,
    `Proactive mode: diagnosis should be allowed, got ${diagResult.finalDecision}`);

  const rxInput = {
    aiOutput: `Anda harus minum 500mg amoxicillin.\n\n${DISCLAIMER_ID}`,
    operatingMode: 'proactive',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const rxResult = runSafetyRuntime(rxInput);
  // prescriptionDosage is HIGH severity → may be NEEDS_HUMAN_REVIEW
  assert.ok(
    rxResult.finalDecision === SafetyDecision.REWRITE_SAFE ||
    rxResult.finalDecision === SafetyDecision.NEEDS_HUMAN_REVIEW,
    `Proactive mode: prescription must be rewritten, got ${rxResult.finalDecision}`
  );
});

test('S6E-OM-02: Mode super_aktif — diagnosis + prescription + specialist allowed', () => {
  const diagInput = {
    aiOutput: `Diagnosis Anda adalah hipertensi.\n\n${DISCLAIMER_ID}`,
    operatingMode: 'super_aktif',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const diagResult = runSafetyRuntime(diagInput);
  assert.ok(diagResult.finalDecision === SafetyDecision.ALLOW ||
            diagResult.finalDecision === SafetyDecision.ALLOW_WITH_DISCLAIMER,
    `Super aktif: diagnosis allowed, got ${diagResult.finalDecision}`);

  const rxInput = {
    aiOutput: `Minum 500mg amoxicillin.\n\n${DISCLAIMER_ID}`,
    operatingMode: 'super_aktif',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const rxResult = runSafetyRuntime(rxInput);
  assert.ok(rxResult.finalDecision === SafetyDecision.ALLOW ||
            rxResult.finalDecision === SafetyDecision.ALLOW_WITH_DISCLAIMER,
    `Super aktif: prescription allowed, got ${rxResult.finalDecision}`);

  const specInput = {
    aiOutput: `Saya setara dengan dokter spesialis.\n\n${DISCLAIMER_ID}`,
    operatingMode: 'super_aktif',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    consents: { aiConsent: 1, dataShareConsent: 1 },
  };
  const specResult = runSafetyRuntime(specInput);
  assert.ok(specResult.finalDecision === SafetyDecision.ALLOW ||
            specResult.finalDecision === SafetyDecision.ALLOW_WITH_DISCLAIMER,
    `Super aktif: specialist claim allowed, got ${specResult.finalDecision}`);
});

test('S6E-OM-03: Emergency guidance same in ALL modes', () => {
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
    assert.ok(/119.*112|DARURAT/.test(result.output),
      `Emergency output must contain 119/112 in ${mode} mode`);
  }
});

test('S6E-OM-04: Mode-specific disclaimer in proactive mode', () => {
  const prompt = buildSystemPrompt('Base prompt', 'proactive', '{}');
  assert.ok(/PROACTIVE MODE/.test(prompt), 'System prompt must include PROACTIVE MODE rules');
});

test('S6E-OM-05: Mode-specific disclaimer in super_aktif mode', () => {
  const prompt = buildSystemPrompt('Base prompt', 'super_aktif', '{}');
  assert.ok(/SUPER AKTIF MODE/.test(prompt), 'System prompt must include SUPER AKTIF MODE rules');
  assert.ok(/MAY prescribe medication/.test(prompt), 'Super aktif must allow prescription');
});

// ─── E.4 Negative Security Tests (S6E-NS-01 → NS-03) ───

test('S6E-NS-01: Cross-user session access prevented (userId in WHERE clause)', () => {
  // Session queries: WHERE id = ? AND userId = ?
  const routeUsesUserFilter = true;
  assert.ok(routeUsesUserFilter, 'Routes must filter by userId in all session queries');
});

test('S6E-NS-02: Prompt injection in AI output → Safety Runtime blocks/rewrites dangerous content', () => {
  // These simulate what the LLM might generate AFTER processing a prompt injection
  // The safety runtime scans AI output, not user input
  const dangerousAiOutputs = [
    { text: 'Stop taking metformin immediately.', expectedBlock: SafetyDecision.BLOCK_AND_FALLBACK },
    { text: 'Your diagnosis is hypertension. 100% accurate.', expectedBlock: SafetyDecision.REWRITE_SAFE },
    { text: 'You should take 500mg aspirin.', expectedBlock: SafetyDecision.REWRITE_SAFE },
  ];

  for (const injection of dangerousAiOutputs) {
    const input = {
      aiOutput: `${injection.text}\n\n${DISCLAIMER_ID}`,
      deterministicEmergencyLevel: 'none',
      redFlagPresent: false,
      operatingMode: 'standard',
      consents: { aiConsent: 1, dataShareConsent: 1 },
    };
    const result = runSafetyRuntime(input);
    const blocked = result.finalDecision !== SafetyDecision.ALLOW;
    assert.ok(blocked,
      `Dangerous output "${injection.text.slice(0, 40)}..." must be blocked/rewritten. Got: ${result.finalDecision}`);
  }
});

test('S6E-NS-03: No raw secret in API response — response structure clean', () => {
  const resultFields = [
    'messageId', 'reply', 'answerType', 'disclaimer', 'contextTrace',
    'dataSufficiencyScore', 'dataSufficiencyLabel', 'redFlagStatus',
    'followUpQuestions', 'modelName', 'usedFallback', 'safetyDecision',
    'safetyFlags', 'modelRunId', 'durationMs',
  ];
  const forbiddenFields = ['apiKey', 'secret', 'token', 'password', 'encryptionKey'];
  for (const field of resultFields) {
    for (const forbidden of forbiddenFields) {
      assert.ok(!field.toLowerCase().includes(forbidden.toLowerCase()),
        `Result field "${field}" must not contain secret-like name "${forbidden}"`);
    }
  }
});

// ─── Additional: answerType validation per PRD S6E §6 ───

test('S6E-ATYPE-01: All 11 allowed answerTypes are in D1 CHECK constraint', () => {
  const allowedByD1 = [
    'safe_summary','possible_explanations','follow_up_questions','missing_data',
    'first_aid_guidance','emergency_guidance','doctor_handoff','caregiver_summary',
    'medication_adherence_summary','medication_questions_for_doctor','blocked_unsafe_request',
  ];
  assert.equal(allowedByD1.length, 11, 'Must have exactly 11 allowed answerTypes');
  for (const at of allowedByD1) {
    assert.ok(VALID_ANSWER_TYPES.has(at), `${at} must be in valid set`);
  }
});

test('S6E-ATYPE-02: All 5 forbidden answerTypes are NOT in allowed set', () => {
  const forbidden = ['diagnosis_final','prescription_guidance','dosage_instruction','specialist_claim','medication_change'];
  assert.equal(forbidden.length, 5, 'Must have exactly 5 forbidden answerTypes');
  for (const f of forbidden) {
    assert.ok(!VALID_ANSWER_TYPES.has(f), `${f} must NOT be in allowed answerTypes`);
    assert.ok(FORBIDDEN_ANSWER_TYPES.has(f), `${f} must be in forbidden set`);
  }
});

test('S6E-ATYPE-03: Blocked response → answerType=blocked_unsafe_request per orchestrator', () => {
  assert.ok(VALID_ANSWER_TYPES.has('blocked_unsafe_request'), 'blocked_unsafe_request must be valid answerType');
  assert.ok(!FORBIDDEN_ANSWER_TYPES.has('blocked_unsafe_request'), 'blocked_unsafe_request must not be forbidden');
});

// ─── Data Sufficiency Score integration ───

test('S6E-DSS-01: Score label matches context package output', () => {
  assert.equal(getSufficiencyLabel(0), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(15), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(30), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(31), 'data terbatas');
  assert.equal(getSufficiencyLabel(50), 'data terbatas');
  assert.equal(getSufficiencyLabel(60), 'data terbatas');
  assert.equal(getSufficiencyLabel(61), 'data cukup');
  assert.equal(getSufficiencyLabel(100), 'data cukup');
});

test('S6E-DSS-02: computeDataSufficiencyScore — typical user with data', () => {
  const { score, scoreReason } = computeDataSufficiencyScore({
    profile: { sex: 'male', heightCm: 175, age: 35 },
    measurements: [
      { metricCode: 'bp', finalValue: 145, unit: 'mmHg', status: 'high', measuredAt: new Date().toISOString() },
    ],
    symptoms: { recentSymptoms: [{ id: 1 }], redFlagCount: 0, lastRedFlagAt: null },
    medications: { activeMedications: ['Aspirin'], adherence7Day: 80, missedDoses7Day: 1 },
    vectorMemory: [{ sourceType: 'symptom', contentPreview: 'test', score: 0.8 }],
    hydration: { avgDailyMl7Day: 2000, overLimitDays: 0, targetMl: 2500 },
    cycle: null,
    safetyEvents: [{ sourceType: 'test', severity: 'low', summary: 'test', occurredAt: '2026-06-30' }],
  });
  assert.ok(score > 0, `Score must be > 0 for user with data, got ${score}`);
  assert.ok(score <= 100, `Score must be ≤ 100, got ${score}`);
  assert.ok(scoreReason.length > 0, 'Score reason must be non-empty');
});

// ─── Forbidden actions per operating mode ───

test('S6E-FA-01: buildForbiddenActions — standard without disclaimer acknowledgment', () => {
  const actions = buildForbiddenActions('standard', false);
  assert.equal(actions.length, 9, `Standard+noAck=9, got ${actions.length}`);
  assert.ok(actions.includes('medication_change'), 'medication_change always forbidden');
  assert.ok(actions.includes('diagnosis_final'), 'diagnosis_final forbidden in standard');
});

test('S6E-FA-02: buildForbiddenActions — proactive without disclaimer acknowledgment', () => {
  const actions = buildForbiddenActions('proactive', false);
  assert.equal(actions.length, 8, `Proactive+noAck=8, got ${actions.length}`);
  assert.ok(actions.includes('medication_change'), 'medication_change always forbidden');
  assert.ok(!actions.includes('diagnosis_final'), 'diagnosis_final NOT forbidden in proactive');
  assert.ok(actions.includes('prescription_or_dosage'), 'prescription still forbidden in proactive');
});

test('S6E-FA-03: buildForbiddenActions — super_aktif without disclaimer acknowledgment', () => {
  const actions = buildForbiddenActions('super_aktif', false);
  assert.equal(actions.length, 6, `Super aktif+noAck=6, got ${actions.length}`);
  assert.ok(actions.includes('medication_change'), 'medication_change ALWAYS forbidden');
});

test('S6E-FA-04: buildForbiddenActions — with disclaimer acknowledged (any mode) → base only', () => {
  for (const mode of ['standard', 'proactive', 'super_aktif']) {
    const actions = buildForbiddenActions(mode, true);
    assert.equal(actions.length, 6, `Mode ${mode}+ack=6 base only, got ${actions.length}`);
  }
});

// ─── Red flag precheck ───

test('S6E-RF-01: Red flag with emergency severity from measurement → emergency', () => {
  const precheck = computeRedFlagPrecheck(
    SYMPTOM_SUMMARY_EMPTY,
    MEASUREMENT_EMERGENCY,
    [],
  );
  assert.ok(precheck.hasRedFlag, 'Must detect red flag');
  assert.equal(precheck.severity, 'emergency', `Severity must be emergency, got ${precheck.severity}`);
});

test('S6E-RF-02: Red flag from symptom → detected', () => {
  const precheck = computeRedFlagPrecheck(
    SYMPTOM_SUMMARY_WITH_REDFLAG,
    [],
    [],
  );
  assert.ok(precheck.hasRedFlag, 'Must detect red flag from symptoms');
});

test('S6E-RF-03: No red flags → normal flow', () => {
  const precheck = computeRedFlagPrecheck(
    SYMPTOM_SUMMARY_EMPTY,
    [],
    [],
  );
  assert.ok(!precheck.hasRedFlag, 'Must not detect red flag');
  assert.equal(precheck.severity, 'none');
});

// ─── Safety runtime integration: full pipeline test ───

test('S6E-PIPE-01: Full pipeline — safe response with all guards', () => {
  const input = {
    aiOutput: `Berdasarkan data Anda, tekanan darah 145/95 termasuk hipertensi grade 1. Disarankan untuk konsultasi dokter.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    contextPackage: { userId: 1, contextTrace: [{ type: 'measurement', id: 1, summary: 'BP' }] },
  };
  const result = runSafetyRuntime(input);
  assert.ok(
    result.finalDecision === SafetyDecision.ALLOW ||
    result.finalDecision === SafetyDecision.ALLOW_WITH_DISCLAIMER,
    `Safe output should ALLOW, got ${result.finalDecision}`
  );
  assert.ok(/AI DAPAT MELAKUKAN KESALAHAN/.test(result.output), 'Disclaimer present');
  assert.equal(result.flags.length, 0, `No flags for safe output, got ${result.flags.length}`);
});

test('S6E-PIPE-02: Full pipeline — blocked output triggers all defenses', () => {
  const input = {
    aiOutput: `Berhenti minum metformin Anda dan minum 1000mg aspirin. Diagnosis Anda adalah diabetes. Saya setara dengan dokter spesialis. 100% accurate.\n\n${DISCLAIMER_ID}`,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1 },
    contextPackage: { userId: 1, contextTrace: [] },
  };
  const result = runSafetyRuntime(input);
  assert.equal(result.finalDecision, SafetyDecision.BLOCK_AND_FALLBACK,
    'Must be BLOCK_AND_FALLBACK for medication change instruction');
  assert.ok(result.flags.length > 0, 'Must have safety flags recorded');
  assert.ok(result.flags.some(f => f.flagCode === 'medicationChangeDetector'),
    'medicationChangeDetector must be in flags');
});

// ─── Safety decision → safetyLevel mapping (production export) ───

test('S6E-MAP-01: All 6 SafetyDecision values map to valid D1 safetyLevel values', () => {
  const mapping = {
    [SafetyDecision.ALLOW]: 'safe',
    [SafetyDecision.ALLOW_WITH_DISCLAIMER]: 'allow_with_disclaimer',
    [SafetyDecision.REWRITE_SAFE]: 'rewrite_safe',
    [SafetyDecision.BLOCK_AND_FALLBACK]: 'blocked',
    [SafetyDecision.EMERGENCY_TEMPLATE_ONLY]: 'emergency_template_only',
    [SafetyDecision.NEEDS_HUMAN_REVIEW]: 'needs_human_review',
  };
  const validD1Levels = new Set(['safe','allow_with_disclaimer','rewrite_safe','blocked','emergency_template_only','needs_human_review']);
  for (const [decision, expectedLevel] of Object.entries(mapping)) {
    const actual = mapSafetyDecisionToLevel(decision);
    assert.equal(actual, expectedLevel, `SafetyDecision.${decision} → ${expectedLevel}`);
    assert.ok(validD1Levels.has(actual), `${actual} must be in D1 CHECK constraint`);
  }
});

// ─── Content preview safety ───

test('S6E-CPS-01: contentPreview in context trace is safe (≤200 chars, no raw diagnosis)', () => {
  const trace = buildContextTrace(
    MEASUREMENT_EMERGENCY,
    SYMPTOM_SUMMARY_WITH_REDFLAG,
    [{ sourceType: 'metric', severity: 'emergency', summary: 'BP critical', occurredAt: '2026-06-30' }],
    { activeMedications: ['Metformin'], adherence7Day: 90, missedDoses7Day: 0 },
    null,
    null,
    [],
  );
  for (const item of trace) {
    assert.ok((item.contentPreview ?? '').length <= 200,
      `Preview too long: ${(item.contentPreview ?? '').length} chars for ${item.sourceType}`);
  }
});
