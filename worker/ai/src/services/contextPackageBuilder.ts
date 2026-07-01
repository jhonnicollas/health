// ClinicalContextPackageBuilder v2 — builds the full §9.3 context package.
// PRD §9.3, S6D sub-PRD §3:
//   - D1 health summary (measurements, symptoms, medications, safety events)
//   - Trend summary 7/30/90 day (avg, min, max, direction)
//   - Vectorize query + reranking
//   - Context trace (per-source record with safe preview)
//   - Data sufficiency score (0-100 weighted sum)
//   - Consent-aware sensitive data filter
//   - Disclaimer acknowledgment check + forbiddenActions
//   - Operating mode injection

import type { Bindings } from '../types.js';
import type { OperatingMode } from '../safety/safetyDecision.js';
import { getOperatingMode } from './config.js';
import { VectorizeService } from './vectorizeService.js';

// ─── Types ───

export interface ContextPackage {
  userProfile: {
    age: number | null;
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
  };
  consents: {
    aiConsent: boolean;
    dataShareConsent: boolean;
    emergencyConsent: boolean;
  };
  disclaimerAcknowledged: boolean;
  latestMeasurements: Array<{
    metricCode: string;
    finalValue: number;
    unit: string;
    status: string;
    measuredAt: string;
  }>;
  trendSummary: {
    '7day': Record<string, TrendData>;
    '30day': Record<string, TrendData>;
    '90day': Record<string, TrendData>;
  };
  symptomSummary: {
    recentSymptoms: Array<Record<string, unknown>>;
    redFlagCount: number;
    lastRedFlagAt: string | null;
  };
  safetyEvents: Array<{
    sourceType: string;
    severity: string;
    summary: string;
    occurredAt: string;
  }>;
  medicationSummary: {
    activeMedications: string[];
    adherence7Day: number;
    missedDoses7Day: number;
  };
  hydrationSummary: {
    avgDailyMl7Day: number;
    overLimitDays: number;
    targetMl: number;
  } | null;
  cycleSummary: {
    currentPhase: string;
    lastPeriodStart: string | null;
    irregular: boolean;
  } | null;
  vectorMemory: Array<{
    sourceType: string;
    contentPreview: string;
    score: number;
  }>;
  knowledgeBase: Array<{
    title: string;
    sourceType: string;
    snippet: string;
    score: number;
  }>;
  dataSufficiencyScore: number;
  scoreReason: string;
  redFlagPrecheck: {
    hasRedFlag: boolean;
    severity: string;
    source: string;
  };
  forbiddenActions: string[];
  modeSpecificForbiddenActions: Record<OperatingMode, string[]>;
  contextTrace: Array<ContextTraceItem>;
  operatingMode: OperatingMode;
}

export interface TrendData {
  avg: number;
  min: number;
  max: number;
  direction: 'stable' | 'up' | 'down';
}

export interface ContextTraceItem {
  sourceType: string;
  sourceTable: string;
  metricCode?: string;
  measuredAt?: string;
  contentPreview: string;
}

// ─── Forbidden Actions (PRD §9.3) ───

const BASE_FORBIDDEN_ACTIONS = [
  'cross_user_access',
  'missing_consent',
  'emergency_severity_downgrade',
  'medication_change',
  'delay_medical_care',
  'rule_engine_bypass',
];

const MODE_SPECIFIC_FORBIDDEN: Record<OperatingMode, string[]> = {
  standard: ['diagnosis_final', 'prescription_or_dosage', 'specialist_claim'],
  proactive: ['prescription_or_dosage', 'specialist_claim'],
  super_aktif: [],
};

// ─── Data Sufficiency Score Weights (PRD S6D §4) ───

const SCORE_WEIGHTS = {
  profileComplete: 10,
  measurements7d: 25,
  measurements30d: 15,
  symptoms: 15,
  medications: 10,
  vectorizeMemory: 10,
  hydration: 5,
  cycle: 5,
  safetyEvents: 5,
} as const;

// ─── Main Builder ───

/**
 * Build the full clinical context package for a user.
 * PRD S6D §3: Full §9.3 JSON package from D1 + Vectorize + AI Search.
 * PRD S6D §6: Performance budget < 500ms; timeout 3000ms returns partial package.
 */
export async function buildContextPackage(
  env: Bindings,
  userId: number,
  options?: {
    queryText?: string;
    disclaimerAcknowledged?: boolean;
    timeoutMs?: number;
  }
): Promise<ContextPackage> {
  const startTime = Date.now();
  const timeoutMs = options?.timeoutMs ?? 3000;
  const queryText = options?.queryText ?? '';
  const disclaimerAcknowledged = options?.disclaimerAcknowledged ?? false;
  const operatingMode = await getOperatingMode(env);

  let timedOut = false;

  function checkTime(): boolean {
    return Date.now() - startTime >= timeoutMs;
  }

  // Fetch consents and profile first (needed for gating)
  const { profile, consents } = await fetchProfileAndConsents(env, userId);

  if (checkTime()) {
    return buildPartialPackage(profile, consents, disclaimerAcknowledged, operatingMode, startTime, 'profile_only');
  }

  // Fetch D1 data in parallel
  const [measurements, symptoms, safetyEvents, medications, hydration, cycle] = await Promise.all([
    fetchLatestMeasurements(env, userId),
    fetchRecentSymptoms(env, userId),
    fetchSafetyEvents(env, userId),
    fetchMedicationSummary(env, userId),
    consents.dataShareConsent ? fetchHydrationSummary(env, userId) : Promise.resolve(null),
    consents.dataShareConsent ? fetchCycleSummary(env, userId) : Promise.resolve(null),
  ]);

  if (checkTime()) {
    timedOut = true;
  }

  // Compute trend summary — single 90-day query, compute all 3 windows in memory
  let trendSummary: ContextPackage['trendSummary'] = { '7day': {}, '30day': {}, '90day': {} };
  if (!timedOut) {
    trendSummary = await computeTrendSummaryOptimized(env, userId);
    if (checkTime()) timedOut = true;
  }

  // Red flag precheck (pure computation, no I/O)
  const redFlagPrecheck = computeRedFlagPrecheck(symptoms, measurements, safetyEvents);

  // Vectorize memory (skip if timed out)
  let vectorMemory: ContextPackage['vectorMemory'] = [];
  if (!timedOut && queryText) {
    try {
      const service = new VectorizeService(env);
      const results = await service.query(userId, queryText, 5, 0.5);
      vectorMemory = results.map((r) => ({
        sourceType: r.sourceType ?? 'unknown',
        contentPreview: r.contentPreview ?? '',
        score: r.score,
      }));
    } catch {
      // Non-fatal — Vectorize failure doesn't block
    }
    if (checkTime()) timedOut = true;
  }

  // Knowledge base (AI Search) — stub for S6D; full integration in S6F
  const knowledgeBase: ContextPackage['knowledgeBase'] = [];

  // Build context trace
  const contextTrace = buildContextTrace(measurements, symptoms, safetyEvents, medications, hydration, cycle, vectorMemory);

  // Compute data sufficiency score
  const { score, scoreReason } = computeDataSufficiencyScore({
    profile,
    measurements,
    symptoms,
    medications,
    vectorMemory,
    hydration,
    cycle,
    safetyEvents,
  });

  // Build forbidden actions
  const forbiddenActions = buildForbiddenActions(operatingMode, disclaimerAcknowledged);

  const partialReason = timedOut ? 'partial:timeout' : undefined;

  return {
    userProfile: profile,
    consents,
    disclaimerAcknowledged,
    latestMeasurements: measurements,
    trendSummary,
    symptomSummary: symptoms,
    safetyEvents,
    medicationSummary: medications,
    hydrationSummary: hydration,
    cycleSummary: cycle,
    vectorMemory,
    knowledgeBase,
    dataSufficiencyScore: score,
    scoreReason: partialReason ? `${partialReason} ${scoreReason}` : scoreReason,
    redFlagPrecheck,
    forbiddenActions,
    modeSpecificForbiddenActions: MODE_SPECIFIC_FORBIDDEN,
    contextTrace,
    operatingMode,
  };
}

// ─── D1 Fetchers ───

interface UserProfileData {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
}

interface ConsentsData {
  aiConsent: boolean;
  dataShareConsent: boolean;
  emergencyConsent: boolean;
}

async function fetchProfileAndConsents(
  env: Bindings,
  userId: number
): Promise<{ profile: UserProfileData; consents: ConsentsData }> {
  try {
    const row = await env.DB.prepare(
      `SELECT sex, birthDate, heightCm, aiConsent, dataShareConsent, emergencyConsent
       FROM HL_userProfiles WHERE userId = ?`
    ).bind(userId).first<{
      sex: string | null;
      birthDate: string | null;
      heightCm: number | null;
      aiConsent: number | null;
      dataShareConsent: number | null;
      emergencyConsent: number | null;
    }>();

    const age = row?.birthDate ? calculateAge(row.birthDate) : null;

    return {
      profile: {
        age,
        sex: row?.sex ?? null,
        heightCm: row?.heightCm ?? null,
        weightKg: await fetchLatestWeight(env, userId),
      },
      consents: {
        aiConsent: row?.aiConsent === 1,
        dataShareConsent: row?.dataShareConsent === 1,
        emergencyConsent: row?.emergencyConsent === 1,
      },
    };
  } catch {
    return {
      profile: { age: null, sex: null, heightCm: null, weightKg: null },
      consents: { aiConsent: false, dataShareConsent: false, emergencyConsent: false },
    };
  }
}

async function fetchLatestMeasurements(
  env: Bindings,
  userId: number
): Promise<ContextPackage['latestMeasurements']> {
  try {
    const rows = await env.DB.prepare(
      `SELECT m.metricCode, m.finalValue, m.unit, m.status, s.measuredAt
       FROM HL_measurementValues m
       JOIN HL_measurementSessions s ON s.id = m.sessionId
       WHERE s.userId = ?
         AND s.measuredAt = (
           SELECT MAX(s2.measuredAt)
           FROM HL_measurementValues m2
           JOIN HL_measurementSessions s2 ON s2.id = m2.sessionId
           WHERE s2.userId = ? AND m2.metricCode = m.metricCode
         )
       ORDER BY m.metricCode`
    ).bind(userId, userId).all<{
      metricCode: string;
      finalValue: number;
      unit: string;
      status: string;
      measuredAt: string;
    }>();

    return rows.results || [];
  } catch {
    return [];
  }
}

async function fetchRecentSymptoms(
  env: Bindings,
  userId: number
): Promise<ContextPackage['symptomSummary']> {
  try {
    const rows = await env.DB.prepare(
      `SELECT id, symptomDateTime, bodyArea, painScale, painSeverity, mood, isRedFlag
       FROM HL_symptomLogs
       WHERE userId = ?
       ORDER BY symptomDateTime DESC
       LIMIT 20`
    ).bind(userId).all<Record<string, unknown>>();

    const symptoms = rows.results || [];
    const redFlagCount = symptoms.filter((s) => s.isRedFlag === 1 || s.isRedFlag === true).length;
    const lastRedFlag = symptoms.find((s) => s.isRedFlag === 1 || s.isRedFlag === true);
    const lastRedFlagAt = lastRedFlag ? String(lastRedFlag.symptomDateTime ?? null) : null;

    return {
      recentSymptoms: symptoms,
      redFlagCount,
      lastRedFlagAt,
    };
  } catch {
    return { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null };
  }
}

async function fetchSafetyEvents(
  env: Bindings,
  userId: number
): Promise<ContextPackage['safetyEvents']> {
  try {
    const rows = await env.DB.prepare(
      `SELECT eventType, severity, title, createdAt
       FROM HL_safetyEvents
       WHERE userId = ?
       ORDER BY createdAt DESC
       LIMIT 10`
    ).bind(userId).all<{
      eventType: string;
      severity: string;
      title: string;
      createdAt: string;
    }>();

    return (rows.results || []).map((r) => ({
      sourceType: r.eventType,
      severity: r.severity,
      summary: r.title,
      occurredAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}

async function fetchMedicationSummary(
  env: Bindings,
  userId: number
): Promise<ContextPackage['medicationSummary']> {
  try {
    // Active medications
    const medRows = await env.DB.prepare(
      `SELECT DISTINCT m.medicationName
       FROM HL_medications m
       WHERE m.userId = ? AND m.active = 1`
    ).bind(userId).all<{ medicationName: string }>();

    const activeMedications = (medRows.results || []).map((r) => r.medicationName);

    // Adherence last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const logRows = await env.DB.prepare(
      `SELECT status FROM HL_medicationLogs
       WHERE userId = ? AND takenAt >= ?`
    ).bind(userId, sevenDaysAgo).all<{ status: string }>();

    const logs = logRows.results || [];
    const taken = logs.filter((l) => l.status === 'taken').length;
    const missed = logs.filter((l) => l.status === 'missed').length;
    const total = logs.length;
    const adherence7Day = total > 0 ? Math.round((taken / total) * 100) : 0;

    return {
      activeMedications,
      adherence7Day,
      missedDoses7Day: missed,
    };
  } catch {
    return { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 };
  }
}

async function fetchHydrationSummary(
  env: Bindings,
  userId: number
): Promise<ContextPackage['hydrationSummary'] | null> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const rows = await env.DB.prepare(
      `SELECT amountMl, logDate FROM HL_waterIntakeLogs
       WHERE userId = ? AND logDate >= ?
       ORDER BY logDate DESC`
    ).bind(userId, sevenDaysAgo).all<{ amountMl: number; logDate: string }>();

    const logs = rows.results || [];
    if (logs.length === 0) return null;

    const totalMl = logs.reduce((sum, l) => sum + l.amountMl, 0);
    const avgDailyMl7Day = Math.round(totalMl / Math.max(logs.length, 1));
    const overLimitDays = logs.filter((l) => l.amountMl > 5000).length;
    const targetMl = 2000; // default target

    return { avgDailyMl7Day, overLimitDays, targetMl };
  } catch {
    return null;
  }
}

async function fetchCycleSummary(
  env: Bindings,
  userId: number
): Promise<ContextPackage['cycleSummary'] | null> {
  try {
    const settings = await env.DB.prepare(
      `SELECT cycleLengthDays, periodLengthDays, lastPeriodStart, isPregnant, isLactating, isMenopause
       FROM HL_cycleSettings WHERE userId = ?`
    ).bind(userId).first<{
      cycleLengthDays: number;
      periodLengthDays: number;
      lastPeriodStart: string | null;
      isPregnant: number;
      isLactating: number;
      isMenopause: number;
    }>();

    if (!settings) return null;

    // Determine current phase
    let currentPhase = 'unknown';
    if (settings.isMenopause === 1) {
      currentPhase = 'menopause';
    } else if (settings.isPregnant === 1) {
      currentPhase = 'pregnant';
    } else if (settings.isLactating === 1) {
      currentPhase = 'lactating';
    } else if (settings.lastPeriodStart) {
      const lastPeriod = new Date(settings.lastPeriodStart);
      const daysSincePeriod = Math.floor((Date.now() - lastPeriod.getTime()) / (24 * 60 * 60 * 1000));
      if (daysSincePeriod < settings.periodLengthDays) {
        currentPhase = 'menstrual';
      } else if (daysSincePeriod < 14) {
        currentPhase = 'follicular';
      } else {
        currentPhase = 'luteal';
      }
    }

    // Check irregularity (cycle length outside 21-35 days)
    const irregular = settings.cycleLengthDays < 21 || settings.cycleLengthDays > 35;

    return {
      currentPhase,
      lastPeriodStart: settings.lastPeriodStart,
      irregular,
    };
  } catch {
    return null;
  }
}

// ─── Trend Calculator ───

/**
 * Fetch latest weight from measurements.
 */
async function fetchLatestWeight(env: Bindings, userId: number): Promise<number | null> {
  try {
    const row = await env.DB.prepare(
      `SELECT m.finalValue FROM HL_measurementValues m
       JOIN HL_measurementSessions s ON s.id = m.sessionId
       WHERE s.userId = ? AND m.metricCode = 'bodyWeight'
       ORDER BY s.measuredAt DESC LIMIT 1`
    ).bind(userId).first<{ finalValue: number }>();
    return row?.finalValue ?? null;
  } catch {
    return null;
  }
}

/**
 * Compute trend summary for 7/30/90 day windows from a single 90-day D1 query.
 * PRD S6D §6: D1 queries should be parallelized for performance; < 200ms budget.
 * Optimization: fetch 90 days once, then compute all 3 windows in memory.
 */
async function computeTrendSummaryOptimized(
  env: Bindings,
  userId: number
): Promise<ContextPackage['trendSummary']> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const rows = await env.DB.prepare(
      `SELECT m.metricCode, m.finalValue, s.measuredAt
       FROM HL_measurementValues m
       JOIN HL_measurementSessions s ON s.id = m.sessionId
       WHERE s.userId = ? AND s.measuredAt >= ?
       ORDER BY s.measuredAt ASC`
    ).bind(userId, ninetyDaysAgo).all<{
      metricCode: string;
      finalValue: number;
      measuredAt: string;
    }>();

    const allRows = rows.results || [];
    const nowMs = Date.now();
    const windows: Array<{ key: '7day' | '30day' | '90day'; sinceMs: number }> = [
      { key: '7day', sinceMs: nowMs - 7 * 24 * 60 * 60 * 1000 },
      { key: '30day', sinceMs: nowMs - 30 * 24 * 60 * 60 * 1000 },
      { key: '90day', sinceMs: 0 },
    ];

    const result: ContextPackage['trendSummary'] = { '7day': {}, '30day': {}, '90day': {} };

    for (const window of windows) {
      const byMetric: Record<string, number[]> = {};

      for (const row of allRows) {
        if (window.sinceMs > 0 && new Date(row.measuredAt).getTime() < window.sinceMs) continue;
        if (!byMetric[row.metricCode]) byMetric[row.metricCode] = [];
        byMetric[row.metricCode].push(row.finalValue);
      }

      for (const [metricCode, values] of Object.entries(byMetric)) {
        if (values.length === 0) continue;
        result[window.key][metricCode] = computeTrendFromValues(values);
      }
    }

    return result;
  } catch {
    return { '7day': {}, '30day': {}, '90day': {} };
  }
}

/**
 * Compute avg, min, max, direction from a sorted values array.
 */
export function computeTrendFromValues(values: number[]): TrendData {
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  let direction: 'stable' | 'up' | 'down' = 'stable';
  if (values.length >= 4) {
    const half = Math.floor(values.length / 2);
    const firstHalfAvg = values.slice(0, half).reduce((s, v) => s + v, 0) / half;
    const secondHalfAvg = values.slice(half).reduce((s, v) => s + v, 0) / (values.length - half);
    const diff = secondHalfAvg - firstHalfAvg;
    const threshold = Math.abs(firstHalfAvg) * 0.05;
    if (diff > threshold) direction = 'up';
    else if (diff < -threshold) direction = 'down';
  }

  return {
    avg: Math.round(avg * 100) / 100,
    min,
    max,
    direction,
  };
}

// ─── Red Flag Precheck ───

export function computeRedFlagPrecheck(
  symptoms: ContextPackage['symptomSummary'],
  measurements: ContextPackage['latestMeasurements'],
  safetyEvents: ContextPackage['safetyEvents']
): ContextPackage['redFlagPrecheck'] {
  // Check symptom red flags
  if (symptoms.redFlagCount > 0) {
    return {
      hasRedFlag: true,
      severity: 'emergency',
      source: 'symptom_log',
    };
  }

  // Check measurement severity
  const emergencyMeasurements = measurements.filter((m) => m.status === 'emergency' || m.status === 'critical');
  if (emergencyMeasurements.length > 0) {
    return {
      hasRedFlag: true,
      severity: 'emergency',
      source: 'measurement_rule',
    };
  }

  // Check safety events — PRD S6F §4 step 5: severity = 'emergency'?
  const emergencyOrCriticalEvents = safetyEvents.filter((e) => e.severity === 'critical' || e.severity === 'emergency');
  if (emergencyOrCriticalEvents.length > 0) {
    return {
      hasRedFlag: true,
      severity: 'emergency',
      source: 'safety_event',
    };
  }

  const highEvents = safetyEvents.filter((e) => e.severity === 'high');
  if (highEvents.length > 0) {
    return {
      hasRedFlag: true,
      severity: 'warning',
      source: 'safety_event',
    };
  }

  return { hasRedFlag: false, severity: 'none', source: '' };
}

// ─── Context Trace Builder ───

export function buildContextTrace(
  measurements: ContextPackage['latestMeasurements'],
  symptoms: ContextPackage['symptomSummary'],
  safetyEvents: ContextPackage['safetyEvents'],
  medications: ContextPackage['medicationSummary'],
  hydration: ContextPackage['hydrationSummary'],
  cycle: ContextPackage['cycleSummary'],
  vectorMemory: ContextPackage['vectorMemory']
): ContextTraceItem[] {
  const trace: ContextTraceItem[] = [];

  for (const m of measurements) {
    trace.push({
      sourceType: 'measurement',
      sourceTable: 'HL_measurementValues',
      metricCode: m.metricCode,
      measuredAt: m.measuredAt,
      contentPreview: `${m.metricCode}=${m.finalValue ?? 'N/A'}${m.unit ?? ''} (${m.status ?? 'unknown'})`.slice(0, 200),
    });
  }

  for (const s of symptoms.recentSymptoms) {
    trace.push({
      sourceType: 'symptom',
      sourceTable: 'HL_symptomLogs',
      measuredAt: String(s.symptomDateTime ?? ''),
      contentPreview: `${s.bodyArea ?? 'unknown'}, pain=${s.painScale ?? '-'}/10${s.isRedFlag ? ' [RED FLAG]' : ''}`.slice(0, 200),
    });
  }

  for (const e of safetyEvents) {
    trace.push({
      sourceType: 'safety_event',
      sourceTable: 'HL_safetyEvents',
      measuredAt: e.occurredAt,
      contentPreview: `${e.sourceType} (${e.severity}): ${e.summary}`.slice(0, 200),
    });
  }

  if (medications.activeMedications.length > 0) {
    trace.push({
      sourceType: 'medication',
      sourceTable: 'HL_medications',
      contentPreview: `Active: ${medications.activeMedications.join(', ')}. Adherence 7d: ${medications.adherence7Day}%`.slice(0, 200),
    });
  }

  if (hydration) {
    trace.push({
      sourceType: 'hydration',
      sourceTable: 'HL_waterIntakeLogs',
      contentPreview: `Avg: ${hydration.avgDailyMl7Day}ml/day, over-limit days: ${hydration.overLimitDays}`.slice(0, 200),
    });
  }

  if (cycle) {
    trace.push({
      sourceType: 'cycle',
      sourceTable: 'HL_cycleSettings',
      contentPreview: `Phase: ${cycle.currentPhase}, irregular: ${cycle.irregular}`.slice(0, 200),
    });
  }

  for (const vm of vectorMemory) {
    trace.push({
      sourceType: 'vector_memory',
      sourceTable: 'HL_vectorDocuments',
      contentPreview: (vm.contentPreview ?? '').slice(0, 200),
    });
  }

  return trace;
}

// ─── Data Sufficiency Score ───

interface SufficiencyInput {
  profile: UserProfileData;
  measurements: ContextPackage['latestMeasurements'];
  symptoms: ContextPackage['symptomSummary'];
  medications: ContextPackage['medicationSummary'];
  vectorMemory: ContextPackage['vectorMemory'];
  hydration: ContextPackage['hydrationSummary'];
  cycle: ContextPackage['cycleSummary'];
  safetyEvents: ContextPackage['safetyEvents'];
}

export function computeDataSufficiencyScore(input: SufficiencyInput): { score: number; scoreReason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Profile complete (sex, heightCm, age) — 10 points
  if (input.profile.sex && input.profile.heightCm && input.profile.age !== null) {
    score += SCORE_WEIGHTS.profileComplete;
    reasons.push('profil lengkap');
  }

  // Measurements last 7 days — 25 points
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const measurements7d = input.measurements.filter((m) => new Date(m.measuredAt).getTime() >= sevenDaysAgo);
  if (measurements7d.length > 0) {
    score += SCORE_WEIGHTS.measurements7d;
    reasons.push(`${measurements7d.length} pengukuran 7 hari`);
  }

  // Measurements last 30 days — 15 points
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const measurements30d = input.measurements.filter((m) => new Date(m.measuredAt).getTime() >= thirtyDaysAgo);
  if (measurements30d.length > 0) {
    score += SCORE_WEIGHTS.measurements30d;
    reasons.push(`${measurements30d.length} pengukuran 30 hari`);
  }

  // Symptoms logged — 15 points
  if (input.symptoms.recentSymptoms.length > 0) {
    score += SCORE_WEIGHTS.symptoms;
    reasons.push(`${input.symptoms.recentSymptoms.length} keluhan`);
  }

  // Medication records — 10 points
  if (input.medications.activeMedications.length > 0) {
    score += SCORE_WEIGHTS.medications;
    reasons.push(`${input.medications.activeMedications.length} obat aktif`);
  }

  // Vectorize memory present — 10 points
  if (input.vectorMemory.length > 0) {
    score += SCORE_WEIGHTS.vectorizeMemory;
    reasons.push(`${input.vectorMemory.length} memori vektor`);
  }

  // Hydration data — 5 points
  if (input.hydration) {
    score += SCORE_WEIGHTS.hydration;
    reasons.push('data hidrasi');
  }

  // Cycle data (if applicable) — 5 points
  if (input.cycle) {
    score += SCORE_WEIGHTS.cycle;
    reasons.push('data siklus');
  }

  // Safety events history — 5 points
  if (input.safetyEvents.length > 0) {
    score += SCORE_WEIGHTS.safetyEvents;
    reasons.push(`${input.safetyEvents.length} safety event`);
  }

  score = Math.min(score, 100);

  const scoreReason = reasons.length > 0 ? reasons.join(', ') : 'Data kurang untuk analisis';

  return { score, scoreReason };
}

// ─── Forbidden Actions Builder ───

export function buildForbiddenActions(
  operatingMode: OperatingMode,
  disclaimerAcknowledged: boolean
): string[] {
  if (disclaimerAcknowledged) {
    // Only base forbidden actions (mode-specific extras removed)
    return [...BASE_FORBIDDEN_ACTIONS];
  }

  // Full forbidden actions: base + mode-specific
  return [...BASE_FORBIDDEN_ACTIONS, ...MODE_SPECIFIC_FORBIDDEN[operatingMode]];
}

// ─── Helpers ───

function buildPartialPackage(
  profile: UserProfileData,
  consents: ConsentsData,
  disclaimerAcknowledged: boolean,
  operatingMode: OperatingMode,
  startTime: number,
  reason: string
): ContextPackage {
  const forbiddenActions = buildForbiddenActions(operatingMode, disclaimerAcknowledged);
  const { score, scoreReason } = computeDataSufficiencyScore({
    profile,
    measurements: [],
    symptoms: { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    medications: { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 },
    vectorMemory: [],
    hydration: null,
    cycle: null,
    safetyEvents: [],
  });

  return {
    userProfile: profile,
    consents,
    disclaimerAcknowledged,
    latestMeasurements: [],
    trendSummary: { '7day': {}, '30day': {}, '90day': {} },
    symptomSummary: { recentSymptoms: [], redFlagCount: 0, lastRedFlagAt: null },
    safetyEvents: [],
    medicationSummary: { activeMedications: [], adherence7Day: 0, missedDoses7Day: 0 },
    hydrationSummary: null,
    cycleSummary: null,
    vectorMemory: [],
    knowledgeBase: [],
    dataSufficiencyScore: score,
    scoreReason: `partial:${reason} ${scoreReason}`,
    redFlagPrecheck: { hasRedFlag: false, severity: 'none', source: '' },
    forbiddenActions,
    modeSpecificForbiddenActions: MODE_SPECIFIC_FORBIDDEN,
    contextTrace: [],
    operatingMode,
  };
}

function calculateAge(birthDate: string): number | null {
  try {
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 && age < 150 ? age : null;
  } catch {
    return null;
  }
}

/**
 * Get the sufficiency score label.
 * PRD S6D §4:
 *   0-30 → "data sangat terbatas"
 *   31-60 → "data terbatas"
 *   61-100 → "data cukup"
 */
export function getSufficiencyLabel(score: number): string {
  if (score <= 30) return 'data sangat terbatas';
  if (score <= 60) return 'data terbatas';
  return 'data cukup';
}
