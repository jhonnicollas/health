import { test } from 'node:test';
import assert from 'node:assert';
import { rebuildMemory } from '../dist/services/memoryOperations.js';

function createVectorizeMock() {
  const store = new Map();
  return {
    inserts: [],
    async insert(rows) {
      for (const row of rows) {
        this.inserts.push(row);
        store.set(row.id, row);
      }
    },
    async query() {
      return { matches: [] };
    },
    async deleteByIds(ids) {
      for (const id of ids) store.delete(id);
    },
    count() {
      return store.size;
    },
    ids() {
      return Array.from(store.keys()).sort();
    },
  };
}

function createEnv() {
  const vectorize = createVectorizeMock();
  let insertId = 0;
  return {
    VECTORIZE_INDEX: vectorize,
    AI: { run: async () => ({ data: [new Array(768).fill(0.01)] }) },
    AI_KV: { get: async () => null, put: async () => {}, delete: async () => {} },
    LOGS: { put: async () => ({}) },
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              first: async () => {
                if (sql.includes('SELECT vectorId FROM HL_vectorDocuments WHERE userId')) return { results: [] };
                if (sql.includes('HL_systemConfigs')) return null;
                return null;
              },
              all: async () => {
                if (sql.includes('SELECT vectorId FROM HL_vectorDocuments')) return { results: [], meta: {} };
                return { results: [], meta: {} };
              },
              run: async () => ({ meta: { last_row_id: ++insertId, changes: 1 } }),
            };
          },
        };
      },
    },
  };
}

const sources = [
  { type: 'symptom', id: 1, data: { bodyArea: 'chest', painScale: 8, painSeverity: 'severe', isRedFlag: 1, mood: 'anxious', symptomDateTime: '2026-06-30T10:00:00Z' } },
  { type: 'measurement', id: 2, data: { metricCode: 'systolic', finalValue: 180, status: 'emergency', severity: 'critical', measuredAt: '2026-06-30T08:00:00Z' } },
  { type: 'medicationAdherence', id: 3, data: { medicationName: 'Amlodipine', status: 'taken', takenAt: '2026-06-30T07:00:00Z' } },
];

test('S6I-T-07 rebuildMemory 3x produces same vector count and no duplicates', async () => {
  const env = createEnv();
  const results = [];
  for (let i = 0; i < 3; i += 1) {
    const result = await rebuildMemory(env, 1, sources);
    results.push(result);
  }

  assert.equal(results[0].totalProcessed, 3);
  assert.equal(results[1].totalProcessed, 3);
  assert.equal(results[2].totalProcessed, 3);

  const counts = results.map((r) => r.totalIndexed);
  assert.ok(counts.every((c) => c === counts[0]), `Counts must be equal across runs: ${counts.join(', ')}`);

  const vectorCount = env.VECTORIZE_INDEX.count();
  assert.equal(vectorCount, counts[0], `Vectorize mock count ${vectorCount} must match indexed count ${counts[0]}`);

  const ids = env.VECTORIZE_INDEX.ids();
  assert.equal(new Set(ids).size, ids.length, 'All vector IDs must be unique');
  assert.equal(ids.length, sources.length, `Expected ${sources.length} vectors, got ${ids.length}`);

  // Deterministic IDs
  assert.ok(ids.includes('v_1_symptom_1'));
  assert.ok(ids.includes('v_1_measurement_2'));
  assert.ok(ids.includes('v_1_medicationAdherence_3'));
});
