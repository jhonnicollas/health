#!/usr/bin/env node
// S6I-T-08 lightweight local performance benchmark.
// Runs 50 concurrent clinical message flows using a mock ModelRouter.
// Asserts: context build p95 < 500ms, full orchestrator p95 < 2000ms.

import { buildContextPackage, computeDataSufficiencyScore } from '../../worker/ai/dist/services/contextPackageBuilder.js';
import { processClinicalMessage } from '../../worker/ai/dist/services/clinicalOrchestrator.js';

function percentile(sorted, p) {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function createEnv(useEmergency = false) {
  let cfgIndex = 0;
  let insertId = 0;
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
                  const key = args[0];
                  if (key === 'clinicalCopilot.operatingMode') return { configValue: 'standard' };
                  if (key === 'clinicalCopilot.maxTokens') return { configValue: '500' };
                  if (key === 'clinicalCopilot.temperature') return { configValue: '3' };
                  if (key === 'medicalSafetyRuntime.enabled') return { configValue: 'true' };
                  if (key === 'aiGateway.fallback.enabled') return { configValue: 'false' };
                  return null;
                }
                if (sql.includes('HL_promptVersions')) return null;
                return null;
              },
              all: async () => {
                if (sql.includes('HL_measurementValues') && sql.includes('MAX')) {
                  return { results: useEmergency ? [{ metricCode: 'systolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: '2026-06-30T08:00:00Z' }] : [{ metricCode: 'systolic', finalValue: 120, unit: 'mmHg', status: 'normal', measuredAt: '2026-06-30T08:00:00Z' }], meta: {} };
                }
                if (sql.includes('HL_symptomLogs')) {
                  return { results: useEmergency ? [{ id: 1, symptomDateTime: '2026-06-30T08:00:00Z', bodyArea: 'chest', painScale: 9, painSeverity: 'severe', mood: 'anxious', isRedFlag: 1 }] : [], meta: {} };
                }
                return { results: [], meta: {} };
              },
              run: async () => ({ meta: { last_row_id: ++insertId, changes: 1 } }),
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

async function benchmark() {
  console.log('S6I-T-08 Performance benchmark: 50 concurrent clinical flows');
  const CONCURRENCY = 50;

  // 1) Context build latencies
  const contextLatencies = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async (_, i) => {
    const env = createEnv(i % 3 === 0);
    const start = performance.now();
    await buildContextPackage(env, 1, { queryText: 'Saya pusing', timeoutMs: 3000 });
    contextLatencies.push(performance.now() - start);
  }));

  contextLatencies.sort((a, b) => a - b);
  const ctxP95 = percentile(contextLatencies, 95);
  const ctxP50 = percentile(contextLatencies, 50);

  // 2) Full orchestrator latencies with mocked ModelRouter
  const fullLatencies = [];
  await Promise.all(Array.from({ length: CONCURRENCY }, async (_, i) => {
    const env = createEnv(i % 5 === 0);
    const start = performance.now();
    await processClinicalMessage(env, {
      userId: 1,
      sessionId: i + 1,
      message: 'Saya merasa pusing dan batuk',
      channel: 'web',
      locale: 'id',
    });
    fullLatencies.push(performance.now() - start);
  }));

  fullLatencies.sort((a, b) => a - b);
  const fullP95 = percentile(fullLatencies, 95);
  const fullP50 = percentile(fullLatencies, 50);

  console.log(`Context build p50=${ctxP50.toFixed(2)}ms p95=${ctxP95.toFixed(2)}ms`);
  console.log(`Full orchestrator p50=${fullP50.toFixed(2)}ms p95=${fullP95.toFixed(2)}ms`);

  const ok = ctxP95 < 500 && fullP95 < 2000;
  console.log(ok ? 'PASS: p95 targets met' : 'FAIL: p95 targets missed');
  process.exit(ok ? 0 : 1);
}

benchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
