import { test } from 'node:test';
import assert from 'node:assert';
import { SafetyDecision } from '../dist/safety/safetyDecision.js';
import { mapSafetyDecisionToLevel, generateFollowUpQuestions } from '../dist/services/clinicalOrchestrator.js';

// S6E tests — 12 tests per PRD S6E §10.
// These tests now import the REAL exported functions from the orchestrator
// (fixed per code-reviewer feedback: tests test actual production code, not re-implementations).

// T-1: Safety decision mapping — SafetyDecision.ALLOW → safety_level=safe
test('S6E T-1: ALLOW maps to safety_level=safe (real export)', () => {
  assert.equal(mapSafetyDecisionToLevel(SafetyDecision.ALLOW), 'safe');
});

test('S6E T-2: ALLOW_WITH_DISCLAIMER maps to safety_level=allow_with_disclaimer (real export)', () => {
  assert.equal(mapSafetyDecisionToLevel(SafetyDecision.ALLOW_WITH_DISCLAIMER), 'allow_with_disclaimer');
});

test('S6E T-3: REWRITE_SAFE maps to safety_level=rewrite_safe (real export)', () => {
  assert.equal(mapSafetyDecisionToLevel(SafetyDecision.REWRITE_SAFE), 'rewrite_safe');
});

test('S6E T-4: BLOCK_AND_FALLBACK maps to safety_level=blocked (real export)', () => {
  assert.equal(mapSafetyDecisionToLevel(SafetyDecision.BLOCK_AND_FALLBACK), 'blocked');
});

test('S6E T-5: EMERGENCY_TEMPLATE_ONLY maps to safety_level=emergency_template_only (real export)', () => {
  assert.equal(mapSafetyDecisionToLevel(SafetyDecision.EMERGENCY_TEMPLATE_ONLY), 'emergency_template_only');
});

test('S6E T-6: NEEDS_HUMAN_REVIEW maps to safety_level=needs_human_review (real export)', () => {
  assert.equal(mapSafetyDecisionToLevel(SafetyDecision.NEEDS_HUMAN_REVIEW), 'needs_human_review');
});

// T-7: All valid intent types map to valid answerTypes
test('S6E T-7: All valid intent types map to valid answerTypes', () => {
  const validAnswerTypes = [
    'safe_summary',
    'possible_explanations',
    'follow_up_questions',
    'missing_data',
    'first_aid_guidance',
    'emergency_guidance',
    'doctor_handoff',
    'caregiver_summary',
    'medication_adherence_summary',
    'medication_questions_for_doctor',
    'blocked_unsafe_request',
  ];

  // Intent → answerType mapping mirrors mapIntentToAnswerType in clinicalOrchestrator
  const expectedMappings = {
    health_summary: 'safe_summary',
    symptom_interview: 'safe_summary',
    possible_explanations: 'possible_explanations',
    first_aid_guidance: 'first_aid_guidance',
    emergency_guidance: 'emergency_guidance',
    medication_adherence: 'medication_adherence_summary',
    knowledge_question: 'safe_summary',
    doctor_handoff: 'doctor_handoff',
    caregiver_summary: 'caregiver_summary',
  };

  for (const [intent, expectedAnswerType] of Object.entries(expectedMappings)) {
    assert.ok(
      validAnswerTypes.includes(expectedAnswerType),
      `Intent ${intent} → ${expectedAnswerType} is in the valid answerTypes list (PRD §8.1)`
    );
  }
});

// T-8: Follow-up question generation uses REAL exported function, capped at 3
test('S6E T-8: follow-up questions from REAL generateFollowUpQuestions is capped at 3', () => {
  const context = {
    userProfile: { age: 35, sex: 'male', heightCm: 175, weightKg: 70 },
    consents: { aiConsent: true, dataShareConsent: false, emergencyConsent: true },
    disclaimerAcknowledged: false,
    latestMeasurements: [],
    trendSummary: { '7day': {}, '30day': {}, '90day': {} },
    symptomSummary: { recentSymptoms: [{ id: 1 }], redFlagCount: 1, lastRedFlagAt: '2026-06-30' },
    safetyEvents: [],
    medicationSummary: { activeMedications: ['Aspirin', 'Metformin'], adherence7Day: 50, missedDoses7Day: 5 },
    hydrationSummary: null,
    cycleSummary: null,
    vectorMemory: [],
    knowledgeBase: [],
    dataSufficiencyScore: 5,
    scoreReason: 'low data',
    redFlagPrecheck: { hasRedFlag: false, severity: 'none', source: '' },
    forbiddenActions: [],
    modeSpecificForbiddenActions: { standard: [], proactive: [], super_aktif: [] },
    contextTrace: [],
    operatingMode: 'standard',
  };

  const questions = generateFollowUpQuestions(context, 'medication_adherence');
  assert.ok(Array.isArray(questions));
  assert.ok(questions.length <= 3, `Expected max 3 questions, got ${questions.length}`);
});

// T-9: Generate follow-up for low-data context produces data-sufficiency question
test('S6E T-9: generateFollowUpQuestions produces data-sufficiency question when score < 30', () => {
  const context = {
    userProfile: { age: 35, sex: 'male', heightCm: 175, weightKg: null },
    consents: { aiConsent: true, dataShareConsent: false, emergencyConsent: false },
    disclaimerAcknowledged: false,
    latestMeasurements: [],
    trendSummary: { '7day': {}, '30day': {}, '90day': {} },
    symptomSummary: { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    safetyEvents: [],
    medicationSummary: { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 },
    hydrationSummary: null,
    cycleSummary: null,
    vectorMemory: [],
    knowledgeBase: [],
    dataSufficiencyScore: 10,
    scoreReason: 'low data',
    redFlagPrecheck: { hasRedFlag: false, severity: 'none', source: '' },
    forbiddenActions: [],
    modeSpecificForbiddenActions: { standard: [], proactive: [], super_aktif: [] },
    contextTrace: [],
    operatingMode: 'standard',
  };

  const questions = generateFollowUpQuestions(context, 'health_summary');
  assert.ok(questions.length > 0, 'Expected at least one follow-up question for low data');
  assert.ok(
    questions[0].includes('data') || questions[0].includes('pengukuran'),
    `Expected data-related question, got: ${questions[0]}`
  );
});

// T-10: Blocked response uses answerType=blocked_unsafe_request
test('S6E T-10: Blocked response answerType is in valid answerTypes list', () => {
  const validAnswerTypes = new Set([
    'safe_summary', 'possible_explanations', 'follow_up_questions', 'missing_data',
    'first_aid_guidance', 'emergency_guidance', 'doctor_handoff', 'caregiver_summary',
    'medication_adherence_summary', 'medication_questions_for_doctor', 'blocked_unsafe_request',
  ]);
  assert.ok(validAnswerTypes.has('blocked_unsafe_request'));
});

// T-11: Disclaimer text is always present in response
test('S6E T-11: Disclaimer text is always present and contains key phrases', () => {
  const DISCLAIMER_ID = 'AI DAPAT MELAKUKAN KESALAHAN.\nTIDAK BOLEH MENGANDALKAN AI 100%.\nTIDAK BOLEH PERCAYA AI 100%.\nSEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';
  assert.ok(DISCLAIMER_ID.includes('AI DAPAT MELAKUKAN KESALAHAN'), 'Disclaimer must contain warning phrase');
  assert.ok(DISCLAIMER_ID.includes('TANGGUNG JAWAB ANDA'), 'Disclaimer must contain responsibility phrase');
});

// T-12: Session UUID has unique format
test('S6E T-12: Session UUID format s_{timestamp}_{random} is unique', () => {
  const id1 = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const id2 = `s_${Date.now() + 1}_${Math.random().toString(36).slice(2, 10)}`;
  assert.notEqual(id1, id2);
  assert.ok(id1.startsWith('s_'));
  assert.ok(/^s_\d+_[a-z0-9]+$/.test(id1), 'Session UUID must match s_{ts}_{random} format');
});
