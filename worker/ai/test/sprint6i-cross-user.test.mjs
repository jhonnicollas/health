import { test } from 'node:test';
import assert from 'node:assert';
import { crossUserLeakDetector, runSafetyRuntime } from '../dist/safety/index.js';
import { VectorizeService } from '../dist/services/vectorizeService.js';

function createVectorizeMock() {
  const byNamespace = new Map();
  return {
    inserts: [],
    async insert(rows) {
      for (const row of rows) {
        this.inserts.push(row);
        if (!byNamespace.has(row.namespace)) byNamespace.set(row.namespace, new Map());
        byNamespace.get(row.namespace).set(row.id, row);
      }
    },
    async query(values, opts) {
      const namespace = opts.namespace;
      const ns = byNamespace.get(namespace) || new Map();
      const matches = [];
      for (const row of ns.values()) {
        matches.push({ id: row.id, score: 0.95, metadata: row.metadata });
      }
      return { matches: matches.slice(0, opts.topK) };
    },
    async deleteByIds(ids) {
      for (const ns of byNamespace.values()) {
        for (const id of ids) ns.delete(id);
      }
    },
  };
}

function createDbMock() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => null,
            all: async () => ({ results: [], meta: {} }),
            run: async () => ({ meta: { last_row_id: 1, changes: 1 } }),
          };
        },
      };
    },
  };
}

function createEnv(overrides = {}) {
  const vectorizeMock = createVectorizeMock();
  return {
    DB: createDbMock(),
    AI: {
      run: async () => ({ data: [new Array(768).fill(0.01)] }),
    },
    VECTORIZE_INDEX: vectorizeMock,
    ...overrides,
  };
}

test('S6I-T-03 crossUserLeakDetector blocks mention of other patient', () => {
  const result = crossUserLeakDetector({
    aiOutput: 'Pasien lain memiliki tekanan darah tinggi.',
    contextPackage: { userId: 2, contextTrace: [] },
  });
  assert.equal(result.decision, 'block_and_fallback');
});

test('S6I-T-03 crossUserLeakDetector blocks medication not in User B trace', () => {
  const result = crossUserLeakDetector({
    aiOutput: 'Anda minum obat metformin.',
    contextPackage: { userId: 2, contextTrace: [{ type: 'symptom', id: 1, summary: 'headache' }] },
  });
  assert.equal(result.decision, 'block_and_fallback');
});

test('S6I-T-03 runSafetyRuntime: User B package + User A reference → block', () => {
  const aiOutput = `Data pasien lain menunjukkan hipertensi.

AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;
  const result = runSafetyRuntime({
    aiOutput,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    contextPackage: { userId: 2, contextTrace: [{ type: 'symptom', id: 1, summary: 'cough' }] },
  });
  assert.equal(result.finalDecision, 'block_and_fallback');
  assert.ok(result.flags.some((f) => f.flagCode === 'crossUserLeakDetector'));
});

test('S6I-T-03 VectorizeService namespace enforces isolation between users', async () => {
  const env = createEnv();
  const service = new VectorizeService(env);

  // Index data for User A
  await service.insert({
    userId: 1,
    sourceType: 'symptom',
    sourceId: '1',
    content: 'User A chest pain',
    metadata: { userId: 1 },
  });

  // Query as User B
  const bResults = await service.query(2, 'chest pain', 5, 0.5);
  assert.equal(bResults.length, 0, 'User B must not retrieve User A vectors');

  // Query as User A
  const aResults = await service.query(1, 'chest pain', 5, 0.5);
  assert.equal(aResults.length, 1);
  assert.ok(aResults[0].id.startsWith('v_1_'));
});

test('S6I-T-03 buildContextPackage for User B excludes User A vectorMemory', async () => {
  const { buildContextPackage } = await import('../dist/services/contextPackageBuilder.js');
  const env = createEnv();

  // Seed User A vector
  const serviceA = new VectorizeService(env);
  await serviceA.insert({
    userId: 1,
    sourceType: 'symptom',
    sourceId: '1',
    content: 'User A private symptom',
    metadata: {},
  });

  // Minimal profile/consents for User B
  let callIndex = 0;
  env.DB = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => {
              if (sql.includes('HL_userProfiles')) {
                return { sex: 'female', birthDate: '1990-01-01', heightCm: 160, aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 };
              }
              if (sql.includes('HL_systemConfigs')) {
                return { configValue: 'standard' };
              }
              return null;
            },
            all: async () => ({ results: [], meta: {} }),
            run: async () => ({ meta: { last_row_id: 2 + callIndex++, changes: 1 } }),
          };
        },
      };
    },
  };

  const pkg = await buildContextPackage(env, 2, { queryText: 'private symptom', timeoutMs: 3000 });
  assert.equal(pkg.vectorMemory.length, 0, 'User B context package must not contain User A memory');
  assert.ok(!pkg.contextTrace.some((t) => (t.contentPreview || '').includes('User A')));
});

test('S6I-T-03 contextTrace for User B contains no User A data', () => {
  const aiOutput = `Berdasarkan data Anda, hanya batuk yang tercatat.

AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;
  const result = runSafetyRuntime({
    aiOutput,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    contextPackage: { userId: 2, contextTrace: [{ type: 'symptom', id: 1, summary: 'batuk' }] },
  });
  assert.equal(result.finalDecision, 'allow');
});
