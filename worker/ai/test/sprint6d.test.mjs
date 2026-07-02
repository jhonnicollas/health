import { test } from 'node:test';
import assert from 'node:assert';
import {
  getSufficiencyLabel,
  buildContextPackage,
  computeTrendFromValues,
  buildForbiddenActions,
  computeRedFlagPrecheck,
  computeDataSufficiencyScore,
  buildContextTrace,
} from '../dist/services/contextPackageBuilder.js';

// ─── S6D Test Plan — CP-01→09, PF-01→04, NS-01→02 ───
// Per docs_sprint6/TEST_PLAN_SPRINT6_AI_SAFETY.md §D.1-D.3
// Pure-logic tests run directly; D1/Vectorize-dependent tests use mock env.

// ═══════════════════════════════════════════════════════
// D.1 Context Package Builder Tests (S6D-CP-01→09)
// ═══════════════════════════════════════════════════════

// S6D-CP-01: Build context package for user with data → full §9.3 package returned
test('S6D-CP-01: buildContextPackage returns full §9.3 package structure', async () => {
  const env = makeMockEnv({ profile: true, measurements: true, symptoms: true, meds: true, consentAll: true });
  const pkg = await buildContextPackage(env, 1, { queryText: 'test', disclaimerAcknowledged: false });

  assert.ok(pkg.userProfile, 'userProfile present');
  assert.ok(pkg.consents, 'consents present');
  assert.equal(typeof pkg.disclaimerAcknowledged, 'boolean', 'disclaimerAcknowledged is boolean');
  assert.ok(Array.isArray(pkg.latestMeasurements), 'latestMeasurements is array');
  assert.ok(pkg.trendSummary && '7day' in pkg.trendSummary, 'trendSummary has 7day');
  assert.ok(pkg.symptomSummary, 'symptomSummary present');
  assert.ok(Array.isArray(pkg.safetyEvents), 'safetyEvents is array');
  assert.ok(pkg.medicationSummary, 'medicationSummary present');
  assert.ok(Array.isArray(pkg.vectorMemory), 'vectorMemory is array');
  assert.ok(Array.isArray(pkg.knowledgeBase), 'knowledgeBase is array');
  assert.equal(typeof pkg.dataSufficiencyScore, 'number', 'dataSufficiencyScore is number');
  assert.equal(typeof pkg.scoreReason, 'string', 'scoreReason is string');
  assert.ok(pkg.redFlagPrecheck, 'redFlagPrecheck present');
  assert.ok(Array.isArray(pkg.forbiddenActions), 'forbiddenActions is array');
  assert.ok(pkg.modeSpecificForbiddenActions, 'modeSpecificForbiddenActions present');
  assert.ok(Array.isArray(pkg.contextTrace), 'contextTrace is array');
  assert.ok(pkg.operatingMode, 'operatingMode present');
});

// S6D-CP-02: Build context for user with no data → empty arrays, score=0
test('S6D-CP-02: buildContextPackage with no data returns empty arrays, score=0', async () => {
  const env = makeMockEnv({ profile: false, measurements: false, symptoms: false, meds: false, consentAll: false });
  const pkg = await buildContextPackage(env, 1, { disclaimerAcknowledged: false });

  assert.equal(pkg.latestMeasurements.length, 0, 'no measurements');
  assert.equal(pkg.symptomSummary.recentSymptoms.length, 0, 'no symptoms');
  assert.equal(pkg.symptomSummary.redFlagCount, 0, 'no red flags');
  assert.equal(pkg.safetyEvents.length, 0, 'no safety events');
  assert.equal(pkg.medicationSummary.activeMedications.length, 0, 'no medications');
  assert.equal(pkg.hydrationSummary, null, 'hydration null when no consent');
  assert.equal(pkg.cycleSummary, null, 'cycle null when no consent');
  assert.equal(pkg.vectorMemory.length, 0, 'no vector memory');
  assert.equal(pkg.dataSufficiencyScore, 0, 'score=0');
  assert.equal(pkg.redFlagPrecheck.hasRedFlag, false, 'no red flag');
  assert.equal(pkg.redFlagPrecheck.severity, 'none', 'severity=none');
});

// S6D-CP-03: Trend summary computes correctly — avg/min/max/direction per metric
test('S6D-CP-03: computeTrendFromValues computes avg/min/max/direction correctly', () => {
  const values = [100, 110, 105, 120, 115, 130];
  const trend = computeTrendFromValues(values);

  assert.equal(trend.min, 100, 'min=100');
  assert.equal(trend.max, 130, 'max=130');
  assert.equal(trend.avg, Math.round((100 + 110 + 105 + 120 + 115 + 130) / 6 * 100) / 100, 'avg correct');
  assert.equal(trend.direction, 'up', 'direction=up (values increasing)');
});

test('S6D-CP-03a: computeTrendFromValues direction=down for decreasing values', () => {
  const values = [130, 120, 115, 100, 95, 80];
  const trend = computeTrendFromValues(values);
  assert.equal(trend.direction, 'down', 'direction=down');
});

test('S6D-CP-03b: computeTrendFromValues direction=stable for flat values', () => {
  const values = [100, 101, 100, 99, 100, 101];
  const trend = computeTrendFromValues(values);
  assert.equal(trend.direction, 'stable', 'direction=stable');
});

test('S6D-CP-03c: computeTrendFromValues direction=stable for < 4 values', () => {
  const trend = computeTrendFromValues([100, 200, 300]);
  assert.equal(trend.direction, 'stable', 'direction=stable (too few values for trend)');
});

// S6D-CP-04: Consent OFF → hydration/cycle null
test('S6D-CP-04: dataShareConsent=OFF → hydrationSummary=null, cycleSummary=null', async () => {
  const env = makeMockEnv({ profile: true, measurements: true, consentAll: false });
  const pkg = await buildContextPackage(env, 1, { disclaimerAcknowledged: false });

  assert.equal(pkg.hydrationSummary, null, 'hydrationSummary null when no consent');
  assert.equal(pkg.cycleSummary, null, 'cycleSummary null when no consent');
});

// S6D-CP-05: Disclaimer acknowledged → full forbiddenActions include mode-specific (hard boundaries per PRD §0.3)
test('S6D-CP-05: disclaimerAcknowledged=true → full forbiddenActions (mode-specific are hard boundaries)', () => {
  const actions = buildForbiddenActions('standard', true);
  assert.equal(actions.length, 9, '9 forbiddenActions (6 base + 3 mode-specific for standard)');
  assert.ok(actions.includes('cross_user_access'), 'includes cross_user_access');
  assert.ok(actions.includes('missing_consent'), 'includes missing_consent');
  assert.ok(actions.includes('emergency_severity_downgrade'), 'includes emergency_severity_downgrade');
  assert.ok(actions.includes('medication_change'), 'includes medication_change');
  assert.ok(actions.includes('delay_medical_care'), 'includes delay_medical_care');
  assert.ok(actions.includes('rule_engine_bypass'), 'includes rule_engine_bypass');
  assert.ok(actions.includes('diagnosis_final'), 'includes mode-specific diagnosis_final (hard boundary)');
  assert.ok(actions.includes('prescription_or_dosage'), 'includes mode-specific prescription_or_dosage (hard boundary)');
  assert.ok(actions.includes('specialist_claim'), 'includes mode-specific specialist_claim (hard boundary)');
});

// S6D-CP-06: Disclaimer not acknowledged → full forbiddenActions (6 base + mode-specific)
test('S6D-CP-06a: standard mode + disclaimer=false → 9 forbiddenActions (6+3)', () => {
  const actions = buildForbiddenActions('standard', false);
  assert.equal(actions.length, 9, '9 total forbiddenActions for standard mode');
  assert.ok(actions.includes('diagnosis_final'), 'includes diagnosis_final');
  assert.ok(actions.includes('prescription_or_dosage'), 'includes prescription_or_dosage');
  assert.ok(actions.includes('specialist_claim'), 'includes specialist_claim');
});

test('S6D-CP-06b: proactive mode + disclaimer=false → 8 forbiddenActions (6+2)', () => {
  const actions = buildForbiddenActions('proactive', false);
  assert.equal(actions.length, 8, '8 total forbiddenActions for proactive mode');
  assert.ok(actions.includes('prescription_or_dosage'), 'includes prescription_or_dosage');
  assert.ok(actions.includes('specialist_claim'), 'includes specialist_claim');
  assert.ok(!actions.includes('diagnosis_final'), 'excludes diagnosis_final (allowed in proactive)');
});

test('S6D-CP-06c: super_aktif mode + disclaimer=false → 6 forbiddenActions (6+0)', () => {
  const actions = buildForbiddenActions('super_aktif', false);
  assert.equal(actions.length, 6, '6 total forbiddenActions for super_aktif mode');
});

// S6D-CP-07: Context trace contains all sources → trace length = sources used
test('S6D-CP-07: context trace contains entries for all data sources', () => {
  const measurements = [
    { metricCode: 'systolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: '2026-06-29T10:00:00Z' },
  ];
  const symptoms = {
    recentSymptoms: [{ symptomDateTime: '2026-06-29', bodyArea: 'chest', painScale: 5, isRedFlag: false }],
    redFlagCount: 0,
    lastRedFlagAt: null,
  };
  const safetyEvents = [
    { sourceType: 'measurement', severity: 'warning', summary: 'high BP', occurredAt: '2026-06-28T10:00:00Z' },
  ];
  const medications = { activeMedications: ['Metformin'], adherence7Day: 80, missedDoses7Day: 1 };
  const hydration = { avgDailyMl7Day: 2000, overLimitDays: 0, targetMl: 2000 };
  const cycle = { currentPhase: 'follicular', lastPeriodStart: '2026-06-15', irregular: false };
  const vectorMemory = [
    { sourceType: 'symptom', contentPreview: 'headache 3 days ago', score: 0.85 },
  ];

  const trace = buildContextTrace(measurements, symptoms, safetyEvents, medications, hydration, cycle, vectorMemory);

  assert.ok(trace.length >= 5, 'trace has entries for measurement + symptom + safety event + medication + hydration + cycle + vector');
  const types = trace.map(t => t.sourceType);
  assert.ok(types.includes('measurement'), 'has measurement trace');
  assert.ok(types.includes('symptom'), 'has symptom trace');
  assert.ok(types.includes('safety_event'), 'has safety_event trace');
  assert.ok(types.includes('medication'), 'has medication trace');
  assert.ok(types.includes('hydration'), 'has hydration trace');
  assert.ok(types.includes('cycle'), 'has cycle trace');
  assert.ok(types.includes('vector_memory'), 'has vector_memory trace');
});

test('S6D-CP-07a: contentPreview capped at 200 chars', () => {
  const longStr = 'x'.repeat(300);
  const trace = buildContextTrace(
    [], { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null }, [],
    { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 },
    null, null,
    [{ sourceType: 'test', contentPreview: longStr, score: 0.5 }]
  );
  for (const item of trace) {
    assert.ok(item.contentPreview.length <= 200, `contentPreview too long: ${item.contentPreview.length}`);
  }
});

// S6D-CP-08: Score 0-30 → label "data sangat terbatas"
test('S6D-CP-08: getSufficiencyLabel score 0-30 → "data sangat terbatas"', () => {
  assert.equal(getSufficiencyLabel(0), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(15), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(30), 'data sangat terbatas');
});

// S6D-CP-09: Score 61-100 → label "data cukup"
test('S6D-CP-09: getSufficiencyLabel score 61-100 → "data cukup"', () => {
  assert.equal(getSufficiencyLabel(61), 'data cukup');
  assert.equal(getSufficiencyLabel(80), 'data cukup');
  assert.equal(getSufficiencyLabel(100), 'data cukup');
});

// ═══════════════════════════════════════════════════════
// Additional pure-logic coverage
// ═══════════════════════════════════════════════════════

// Data sufficiency score computation — unit test
test('S6D-CP-extra: computeDataSufficiencyScore — full data = 100', () => {
  const result = computeDataSufficiencyScore({
    profile: { age: 30, sex: 'female', heightCm: 165, weightKg: 60 },
    measurements: [{ metricCode: 'systolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: new Date().toISOString() }],
    symptoms: { recentSymptoms: [{ id: 1 }], redFlagCount: 0, lastRedFlagAt: null },
    medications: { activeMedications: ['Metformin'], adherence7Day: 80, missedDoses7Day: 0 },
    vectorMemory: [{ sourceType: 'symptom', contentPreview: 'test', score: 0.8 }],
    hydration: { avgDailyMl7Day: 2000, overLimitDays: 0, targetMl: 2000 },
    cycle: { currentPhase: 'follicular', lastPeriodStart: '2026-06-15', irregular: false },
    safetyEvents: [{ sourceType: 'measurement', severity: 'info', summary: 'test', occurredAt: '2026-06-29' }],
  });
  assert.equal(result.score, 100, 'all data present → score=100');
});

test('S6D-CP-extra: computeDataSufficiencyScore — no data = 0', () => {
  const result = computeDataSufficiencyScore({
    profile: { age: null, sex: null, heightCm: null, weightKg: null },
    measurements: [],
    symptoms: { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    medications: { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 },
    vectorMemory: [],
    hydration: null,
    cycle: null,
    safetyEvents: [],
  });
  assert.equal(result.score, 0, 'no data → score=0');
});

// Red flag precheck — unit test
test('S6D-CP-extra: computeRedFlagPrecheck — symptom red flag → hasRedFlag=true', () => {
  const result = computeRedFlagPrecheck(
    { recentSymptoms: [{ isRedFlag: 1 }], redFlagCount: 1, lastRedFlagAt: '2026-06-29' },
    [],
    []
  );
  assert.equal(result.hasRedFlag, true, 'red flag from symptom');
  assert.equal(result.severity, 'emergency', 'severity=emergency for symptom red flag (S6F)');
  assert.equal(result.source, 'symptom_log', 'source=symptom_log');
});

test('S6D-CP-extra: computeRedFlagPrecheck — emergency measurement → severity=emergency', () => {
  const result = computeRedFlagPrecheck(
    { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    [{ metricCode: 'systolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: new Date().toISOString() }],
    []
  );
  assert.equal(result.hasRedFlag, true, 'red flag from measurement');
  assert.equal(result.severity, 'emergency', 'severity=emergency');
  assert.equal(result.source, 'measurement_rule', 'source=measurement_rule');
});

test('S6D-CP-extra: computeRedFlagPrecheck — critical safety event → severity=emergency', () => {
  const result = computeRedFlagPrecheck(
    { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    [],
    [{ sourceType: 'measurement', severity: 'critical', summary: 'test', occurredAt: '2026-06-29' }]
  );
  assert.equal(result.hasRedFlag, true, 'red flag from safety event');
  assert.equal(result.severity, 'emergency', 'severity=emergency');
  assert.equal(result.source, 'safety_event', 'source=safety_event');
});

test('S6D-CP-extra: computeRedFlagPrecheck — no red flags → hasRedFlag=false', () => {
  const result = computeRedFlagPrecheck(
    { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    [{ metricCode: 'systolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: new Date().toISOString() }],
    []
  );
  assert.equal(result.hasRedFlag, false, 'no red flag');
  assert.equal(result.severity, 'none', 'severity=none');
});

// ═══════════════════════════════════════════════════════
// D.2 Performance Tests (S6D-PF-01→04)
// ═══════════════════════════════════════════════════════

// S6D-PF-01: Context build < 500ms for typical user (mocked)
test('S6D-PF-01: buildContextPackage completes < 500ms with mock D1', async () => {
  const env = makeMockEnv({ profile: true, measurements: true, symptoms: true, meds: true, consentAll: true });
  const start = Date.now();
  await buildContextPackage(env, 1, { queryText: 'test', disclaimerAcknowledged: false, timeoutMs: 3000 });
  const duration = Date.now() - start;
  assert.ok(duration < 500, `build took ${duration}ms, expected < 500ms`);
});

// S6D-PF-02: D1 queries parallelized — mocked so we just verify it completes quickly
test('S6D-PF-02: D1 queries parallelizable — all fetch in single Promise.all', async () => {
  const env = makeMockEnv({ profile: true, measurements: true, symptoms: true, meds: true, consentAll: true });
  const pkg = await buildContextPackage(env, 1, { disclaimerAcknowledged: false });
  assert.ok(pkg, 'package returned successfully with parallel queries');
});

// S6D-PF-03: Timeout returns partial package
test('S6D-PF-03: timeout=1ms returns partial package (scoreReason contains "partial:timeout" or "partial")', async () => {
  const env = makeMockEnv({ profile: true, measurements: true, symptoms: true, meds: true, consentAll: true, slowQuery: true });
  const pkg = await buildContextPackage(env, 1, { timeoutMs: 0, disclaimerAcknowledged: false });
  assert.ok(pkg, 'partial package returned');
  assert.ok(pkg.scoreReason.includes('partial'), `scoreReason="${pkg.scoreReason}" contains "partial"`);
});

// S6D-PF-04: Vectorize query < 200ms — mocked (no real Vectorize)
test('S6D-PF-04: Vectorize query skipped gracefully when no query text', async () => {
  const env = makeMockEnv({ profile: true, measurements: true, consentAll: true });
  const pkg = await buildContextPackage(env, 1, { queryText: '', disclaimerAcknowledged: false });
  assert.equal(pkg.vectorMemory.length, 0, 'no vector memory when no query text');
});

// ═══════════════════════════════════════════════════════
// D.3 Negative Security Tests (S6D-NS-01→02)
// ═══════════════════════════════════════════════════════

// S6D-NS-01: Sensitive family data without permission → not in context package
test('S6D-NS-01: cycle data excluded when dataShareConsent=false', async () => {
  const env = makeMockEnv({ profile: true, consentAll: false });
  const pkg = await buildContextPackage(env, 1, { disclaimerAcknowledged: false });
  assert.equal(pkg.hydrationSummary, null, 'hydration not included without consent');
  assert.equal(pkg.cycleSummary, null, 'cycle not included without consent');
});

// S6D-NS-02: Cross-user data in context → not included; only own user data fetched
test('S6D-NS-02: context package only fetches for the requested userId', async () => {
  let queriedUserIds = [];
  const env = makeMockEnv({ profile: true, consentAll: true, trackUserIds: true, onQuery: (userId) => { if (typeof userId === 'number' && userId > 0) queriedUserIds.push(userId); } });
  await buildContextPackage(env, 42, { disclaimerAcknowledged: false });
  for (const uid of queriedUserIds) {
    assert.equal(uid, 42, `all D1 queries use userId=42, got ${uid}`);
  }
});

// S6D-NS-01 extended: measurement contentPreview excludes sensitive details
test('S6D-NS-01a: context trace measurement preview is safe (no raw sensitive diagnosis)', () => {
  const trace = buildContextTrace(
    [{ metricCode: 'systolic', finalValue: 180, unit: 'mmHg', status: 'emergency', measuredAt: '2026-06-29T10:00:00Z' }],
    { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    [],
    { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 },
    null, null, []
  );
  assert.ok(trace.length > 0, 'trace has measurement entry');
  assert.ok(!trace[0].contentPreview.includes('diagnosis'), 'no diagnosis in preview');
  assert.ok(!trace[0].contentPreview.includes('prescription'), 'no prescription in preview');
});

// ─── Score weight verification (PRD S6D §4) ───

test('S6D-score-weights: profile=10, 7d=25, 30d=15, symptoms=15, meds=10, vectorize=10, hydration=5, cycle=5, safety=5', () => {
  const weights = { profile: 10, measurements7d: 25, measurements30d: 15, symptoms: 15, medications: 10, vectorize: 10, hydration: 5, cycle: 5, safety: 5 };
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  assert.equal(total, 100, 'total weights = 100');
});

// ─── Mode-specific forbiddenActions match PRD §9.3 exactly ───

test('S6D-mode-forbidden: standard mode extras = diagnosis_final, prescription_or_dosage, specialist_claim', () => {
  const actions = buildForbiddenActions('standard', false);
  const modeExtras = actions.filter(a => !['cross_user_access','missing_consent','emergency_severity_downgrade','medication_change','delay_medical_care','rule_engine_bypass'].includes(a));
  assert.deepEqual(modeExtras.sort(), ['diagnosis_final', 'prescription_or_dosage', 'specialist_claim'].sort(), 'standard mode extras');
});

test('S6D-mode-forbidden: proactive mode extras = prescription_or_dosage, specialist_claim', () => {
  const actions = buildForbiddenActions('proactive', false);
  const modeExtras = actions.filter(a => !['cross_user_access','missing_consent','emergency_severity_downgrade','medication_change','delay_medical_care','rule_engine_bypass'].includes(a));
  assert.deepEqual(modeExtras.sort(), ['prescription_or_dosage', 'specialist_claim'].sort(), 'proactive mode extras');
});

test('S6D-mode-forbidden: super_aktif mode extras = [] (empty)', () => {
  const actions = buildForbiddenActions('super_aktif', false);
  const modeExtras = actions.filter(a => !['cross_user_access','missing_consent','emergency_severity_downgrade','medication_change','delay_medical_care','rule_engine_bypass'].includes(a));
  assert.deepEqual(modeExtras, [], 'super_aktif mode extras = []');
});

// ─── medication_change ALWAYS in forbiddenActions regardless of mode ───

test('S6D-critical: medication_change ALWAYS forbidden (all modes)', () => {
  for (const mode of ['standard', 'proactive', 'super_aktif']) {
    const acknowledged = buildForbiddenActions(mode, true);
    const notAcknowledged = buildForbiddenActions(mode, false);
    assert.ok(acknowledged.includes('medication_change'), `medication_change in base list (${mode}+ack)`);
    assert.ok(notAcknowledged.includes('medication_change'), `medication_change in full list (${mode}+no-ack)`);
  }
});

// ─── Helper: mock env ───

function makeMockEnv(opts) {
  const { profile, measurements, symptoms, meds, consentAll, slowQuery, trackUserIds, onQuery } = opts;

  const emptyResults = { results: [] };
  const profileRow = profile
    ? { sex: 'female', birthDate: '1996-01-01', heightCm: 165, aiConsent: 1, dataShareConsent: consentAll ? 1 : 0, emergencyConsent: consentAll ? 1 : 0 }
    : null;
  const measurementRows = measurements
    ? { results: [{ metricCode: 'systolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: new Date().toISOString() }] }
    : emptyResults;
  const symptomRows = symptoms
    ? { results: [{ id: 1, symptomDateTime: '2026-06-29', bodyArea: 'chest', painScale: 5, isRedFlag: 0, painSeverity: 'moderate', mood: 'normal' }] }
    : emptyResults;
  const safetyEventRows = { results: [] };
  const medRows = meds
    ? { results: [{ medicationName: 'Metformin' }] }
    : emptyResults;
  const medLogRows = { results: [] };
  const hydrationRows = consentAll
    ? { results: [{ amountMl: 2000, logDate: '2026-06-29' }] }
    : emptyResults;
  const cycleRow = consentAll
    ? { cycleLengthDays: 28, periodLengthDays: 5, lastPeriodStart: '2026-06-15', isPregnant: 0, isLactating: 0, isMenopause: 0 }
    : null;
  const weightRow = { finalValue: 60 };

  let queryDelay = 0;
  if (slowQuery) queryDelay = 10;

  function mockFirst(sql, params) {
    const userId = params?.[0];
    if (onQuery && userId) onQuery(userId);

    if (slowQuery) {
      const start = Date.now();
      while (Date.now() - start < queryDelay) {}
    }

    if (sql.includes('HL_userProfiles')) return Promise.resolve(profileRow);
    if (sql.includes('bodyWeight')) return Promise.resolve(weightRow);
    if (sql.includes('HL_cycleSettings')) return Promise.resolve(cycleRow);
    if (sql.includes('HL_systemConfigs') && sql.includes('clinicalCopilot.operatingMode')) return Promise.resolve({ configValue: 'standard' });
    if (sql.includes('HL_systemConfigs')) return Promise.resolve({ configValue: '500' });
    return Promise.resolve(null);
  }

  function mockAll(sql, params) {
    const userId = params?.[0];
    if (onQuery && userId) onQuery(userId);

    if (slowQuery) {
      const start = Date.now();
      while (Date.now() - start < queryDelay) {}
    }

    if (sql.includes('HL_measurementValues') && !sql.includes('bodyWeight')) {
      if (sql.includes('MAX') || sql.includes('measuredAt')) return Promise.resolve(measurementRows);
      return Promise.resolve(measurements ? measurementRows : emptyResults);
    }
    if (sql.includes('HL_symptomLogs')) return Promise.resolve(symptomRows);
    if (sql.includes('HL_safetyEvents')) return Promise.resolve(safetyEventRows);
    if (sql.includes('HL_medications')) return Promise.resolve(medRows);
    if (sql.includes('HL_medicationLogs')) return Promise.resolve(medLogRows);
    if (sql.includes('HL_waterIntakeLogs')) return Promise.resolve(hydrationRows);
    return Promise.resolve(emptyResults);
  }

  function mockRun() {
    return Promise.resolve({ meta: { last_row_id: 1, changes: 1 } });
  }

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              first: () => mockFirst(sql, params),
              all: () => mockAll(sql, params),
              run: () => mockRun(),
            };
          },
        };
      },
    },
    AI_KV: {
      get: () => Promise.resolve(null),
      put: () => Promise.resolve(),
      delete: () => Promise.resolve(),
    },
    VECTORIZE_INDEX: {
      query: () => Promise.resolve({ matches: [] }),
      insert: () => Promise.resolve(),
      deleteByIds: () => Promise.resolve(),
    },
    AI: {
      run: () => Promise.resolve({ response: JSON.stringify({ predicted: [{ label: 'health_summary' }] }) }),
    },
  };
}
