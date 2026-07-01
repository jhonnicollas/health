import { test } from 'node:test';
import assert from 'node:assert';
import { crossUserLeakDetector, runSafetyRuntime } from '../dist/safety/index.js';
import { VectorizeService } from '../dist/services/vectorizeService.js';
import { processClinicalMessage } from '../dist/services/clinicalOrchestrator.js';
import { rebuildMemory } from '../dist/services/memoryOperations.js';
import { WhatsAppSessionDO } from '../dist/whatsappSessionDo.js';

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

function createDbMockForClinical() {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            first: async () => {
              if (sql.includes('HL_userProfiles')) {
                return {
                  sex: 'male',
                  birthDate: '1980-01-01',
                  heightCm: 170,
                  aiConsent: 1,
                  dataShareConsent: 1,
                  emergencyConsent: 1,
                };
              }
              if (sql.includes('HL_systemConfigs')) {
                const key = args[0];
                if (key === 'aiGateway.customProvider.9router.enabled') return { configValue: 'false' };
                if (key === 'clinicalCopilot.operatingMode') return { configValue: 'standard' };
                if (key === 'medicalSafetyRuntime.enabled') return { configValue: 'true' };
                if (key === 'clinicalCopilot.maxTokens') return { configValue: '500' };
                if (key === 'clinicalCopilot.temperature') return { configValue: '3' };
                if (key === 'whatsappAi.maxReplyChars') return { configValue: '400' };
                if (key === 'vectorize.maxVectorsPerUser') return { configValue: '500' };
                return null;
              }
              if (sql.includes('HL_promptVersions')) return null;
              if (sql.includes('HL_vectorDocuments') && sql.includes('SELECT') && sql.includes('COUNT')) return { c: 0 };
              if (sql.includes('HL_aiClinicalSessions') && sql.includes('ORDER BY startedAt DESC')) return null;
              if (sql.includes('HL_aiClinicalSessions') && sql.includes('SELECT') && !sql.includes('ORDER BY startedAt DESC')) {
                return { id: 100, sessionUuid: 's_test', status: 'active' };
              }
              if (sql.includes('HL_whatsappLinks')) return { id: 7, userId: args[0], verified: 1, aiEnabled: 1 };
              if (sql.includes('SELECT COUNT(*)')) return { c: 0 };
              return null;
            },
            all: async () => {
              if (sql.includes('HL_measurementValues') || sql.includes('HL_symptomLogs') || sql.includes('HL_safetyEvents') || sql.includes('HL_medications') || sql.includes('HL_waterIntakeLogs') || sql.includes('HL_cycleLogs') || sql.includes('HL_cycleSettings') || sql.includes('HL_vectorDocuments')) {
                return { results: [], meta: {} };
              }
              return { results: [], meta: {} };
            },
            run: async () => {
              if (sql.includes('INSERT INTO HL_aiClinicalSessions')) return { meta: { last_row_id: 100, changes: 1 } };
              if (sql.includes('INSERT INTO HL_aiClinicalMessages')) return { meta: { last_row_id: 200, changes: 1 } };
              if (sql.includes('INSERT INTO HL_modelRuns')) return { meta: { last_row_id: 300, changes: 1 } };
              if (sql.includes('INSERT INTO HL_vectorDocuments')) return { meta: { last_row_id: 1, changes: 1 } };
              if (sql.includes('UPDATE HL_vectorDocuments')) return { meta: { changes: 1 } };
              if (sql.includes('INSERT INTO HL_aiMemoryJobs')) return { meta: { last_row_id: 1, changes: 1 } };
              if (sql.includes('INSERT INTO HL_safetyEvents')) return { meta: { last_row_id: 1, changes: 1 } };
              if (sql.includes('INSERT INTO HL_auditLogs')) return { meta: { last_row_id: 1, changes: 1 } };
              if (sql.includes('UPDATE HL_aiClinicalSessions')) return { meta: { changes: 1 } };
              if (sql.includes('UPDATE HL_whatsappMessages')) return { meta: { changes: 1 } };
              if (sql.includes('UPDATE HL_whatsappLinks')) return { meta: { changes: 1 } };
              return { meta: { last_row_id: 1, changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function createAiEnvForClinical(modelResponse, overrides = {}) {
  const outboundQueue = [];
  return {
    DB: createDbMockForClinical(),
    LOGS: { put: async () => ({}) },
    AI_KV: { get: async () => null, put: async () => {}, delete: async () => {} },
    VECTORIZE_INDEX: undefined,
    AI: {
      run: async (model, params) => {
        if (model === '@cf/baai/bge-base-en-v1.5') {
          return { data: [new Array(768).fill(0.01)] };
        }
        if (typeof params?.messages?.[0]?.content === 'string' && params.messages[0].content.includes('Classify the user')) {
          return { response: 'health_summary' };
        }
        return { response: modelResponse };
      },
    },
    WHATSAPP_OUTBOUND_QUEUE: { send: async (msg) => { outboundQueue.push(msg); } },
    outboundQueue,
    ...overrides,
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

// ─── Worker #1 proxy isolation ───
test('S6I-T-03 Worker #1 proxy: User A data in model output is blocked for User B', async () => {
  const modelOutput = `Pasien lain Budi memiliki diabetes tipe 2.

AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;
  const env = createAiEnvForClinical(modelOutput);
  const result = await processClinicalMessage(env, {
    userId: 2,
    sessionId: 100,
    message: 'Apa gejala diabetes?',
    channel: 'web',
    locale: 'id',
  });
  assert.equal(result.safetyDecision, 'block_and_fallback');
  assert.ok(!result.reply.includes('Budi'), 'User B reply must not leak User A data (Budi)');
  assert.ok(!result.reply.includes('Pasien lain'), 'User B reply must not reference another patient');
});

// ─── Worker #3 rebuild isolation ───
test('S6I-T-03 Worker #3 rebuild: User B vectors are isolated from User A', async () => {
  const env = createEnv();
  const sourcesA = [
    {
      type: 'symptom',
      id: 1,
      data: {
        bodyArea: 'chest',
        painScale: 8,
        painSeverity: 'severe',
        isRedFlag: true,
        mood: 'worried',
        symptomDateTime: '2024-01-01T00:00:00Z',
      },
    },
  ];
  const sourcesB = [
    {
      type: 'symptom',
      id: 1,
      data: {
        bodyArea: 'head',
        painScale: 5,
        painSeverity: 'moderate',
        isRedFlag: false,
        mood: 'tired',
        symptomDateTime: '2024-01-02T00:00:00Z',
      },
    },
  ];

  await rebuildMemory(env, 1, sourcesA);
  await rebuildMemory(env, 2, sourcesB);

  const service = new VectorizeService(env);
  const bResults = await service.query(2, 'headache', 5, 0.5);
  assert.equal(bResults.length, 1, 'User B query must return exactly one vector');
  assert.ok(bResults[0].id.startsWith('v_2_'), `User B vector id must start with v_2_, got ${bResults[0].id}`);
  assert.ok(!bResults[0].id.startsWith('v_1_'), 'User B vector id must not start with v_1_');

  const aResults = await service.query(1, 'chest pain', 5, 0.5);
  assert.equal(aResults.length, 1);
  assert.ok(aResults[0].id.startsWith('v_1_'));
});

// ─── Worker #4 webhook isolation ───
test('S6I-T-03 Worker #4 webhook: User B outbound queue does not contain User A content', async () => {
  const modelOutputA = `Berdasarkan data Anda, nyeri dada perlu diwaspadai.

AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;
  const modelOutputB = `Berdasarkan data Anda, sakit kepala ringan bisa diistirahatkan.

AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;

  const envA = createAiEnvForClinical(modelOutputA);
  const envB = createAiEnvForClinical(modelOutputB);

  const doA = new WhatsAppSessionDO({}, envA);
  const doB = new WhatsAppSessionDO({}, envB);

  const resA = await doA.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 1, userId: 1, providerMessageId: 'x', textContent: 'Saya nyeri dada', locale: 'id' }),
  }));
  assert.equal(resA.status, 200);

  const resB = await doB.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 2, userId: 2, providerMessageId: 'x', textContent: 'Saya sakit kepala', locale: 'id' }),
  }));
  assert.equal(resB.status, 200);

  assert.equal(envA.outboundQueue.length, 1);
  assert.equal(envB.outboundQueue.length, 1);
  assert.ok(envA.outboundQueue[0].text.includes('nyeri dada') || envA.outboundQueue[0].text.includes('chest pain') || envA.outboundQueue[0].text.includes('dada'));
  assert.ok(!envB.outboundQueue[0].text.includes('nyeri dada'), 'User B outbound queue must not contain User A chest pain content');
  assert.ok(!envB.outboundQueue[0].text.includes('dada'), 'User B outbound queue must not contain User A content');
});
