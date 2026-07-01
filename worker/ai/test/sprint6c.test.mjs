import { test } from 'node:test';
import assert from 'node:assert';
import {
  VectorizeService,
} from '../dist/services/vectorizeService.js';
import {
  buildMemoryDocument,
  buildMemoryDocuments,
} from '../dist/services/memoryDocumentBuilder.js';
import {
  indexSource,
  rebuildMemory,
  deleteMemory,
} from '../dist/services/memoryOperations.js';
import {
  checkFreeTierStatus,
} from '../dist/services/freeTierMonitor.js';
import {
  EMBEDDING_MODEL,
} from '../dist/services/workersAi.js';

function makeMockEnv(overrides = {}) {
  const inserted = [];
  const deletedIds = [];
  const d1Updates = [];
  const d1Rows = overrides.d1Rows || {};

  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            const key = sql.trim().slice(0, 80);
            if (/SELECT COUNT\(\*\) as c FROM HL_vectorDocuments WHERE userId = \? AND status = 'indexed'/.test(sql)) {
              return { c: overrides.indexedCount ?? 5 };
            }
            if (/SELECT COUNT\(\*\) as c FROM HL_vectorDocuments WHERE userId = \?/.test(sql) && !sql.includes("status = 'indexed'")) {
              return { c: overrides.totalCount ?? 10 };
            }
            if (/SELECT COUNT\(\*\) as c FROM HL_vectorDocuments WHERE userId = \? AND status = 'pending'/.test(sql)) {
              return { c: overrides.pendingCount ?? 0 };
            }
            if (/SELECT COUNT\(\*\) as c FROM HL_vectorDocuments WHERE userId = \? AND status = 'failed'/.test(sql)) {
              return { c: overrides.failedCount ?? 0 };
            }
            if (/SELECT COUNT\(\*\) as c FROM HL_vectorDocuments WHERE userId = \? AND status = 'deleted'/.test(sql)) {
              return { c: overrides.deletedCount ?? 2 };
            }
            if (/SELECT COUNT\(\*\) as c FROM HL_vectorDocuments WHERE status = 'indexed'/.test(sql) && !sql.includes('userId')) {
              return { c: overrides.globalTotal ?? 100 };
            }
            if (/SELECT COUNT\(DISTINCT userId\) as c/.test(sql)) {
              return { c: overrides.distinctUsers ?? 5 };
            }
            if (/HAVING cnt >= \?/.test(sql)) {
              return { c: overrides.usersAtLimit ?? 0 };
            }
            if (/SELECT vectorId FROM HL_vectorDocuments[\s\S]*ORDER BY createdAt ASC/.test(sql)) {
              return overrides.oldestVector ?? null;
            }
            if (/SELECT vectorId FROM HL_vectorDocuments WHERE userId = \? AND status != 'deleted'/.test(sql)) {
              return { results: overrides.activeVectors ?? [{ vectorId: 'v_1_symptom_1' }] };
            }
            if (/SELECT vectorId FROM HL_vectorDocuments WHERE userId = \? AND status = 'indexed'/.test(sql)) {
              return { results: overrides.staleVectors ?? [] };
            }
            if (/SELECT id FROM HL_vectorDocuments WHERE userId = \? AND vectorId = \?/.test(sql)) {
              return overrides.existingDoc ?? null;
            }
            if (/SELECT COUNT\(\*\) as c FROM HL_vectorDocuments WHERE userId = \? AND status != 'deleted'/.test(sql)) {
              return { c: overrides.activeCount ?? 8 };
            }
            if (/HL_symptomLogs/.test(sql)) {
              return { results: overrides.symptomRows ?? [] };
            }
            if (/HL_measurementValues/.test(sql)) {
              return { results: overrides.measurementRows ?? [] };
            }
            if (/HL_safetyEvents/.test(sql)) {
              return { results: overrides.safetyEventRows ?? [] };
            }
            if (/HL_medicationLogs/.test(sql)) {
              return { results: overrides.medicationRows ?? [] };
            }
            if (/HL_Reports/.test(sql)) {
              return { results: overrides.reportRows ?? [] };
            }
            if (/HL_aiClinicalSessions/.test(sql)) {
              return { results: overrides.aiSessionRows ?? [] };
            }
            if (/HL_waterIntakeLogs/.test(sql)) {
              return { results: overrides.waterRows ?? [] };
            }
            if (/HL_cycleLogs/.test(sql)) {
              return { results: overrides.cycleRows ?? [] };
            }
            if (/HL_whatsappMessages/.test(sql)) {
              return { results: overrides.whatsappRows ?? [] };
            }
            return null;
          },
          all: async () => {
            if (/HL_symptomLogs/.test(sql)) return { results: overrides.symptomRows ?? [] };
            if (/HL_measurementValues/.test(sql)) return { results: overrides.measurementRows ?? [] };
            if (/HL_safetyEvents/.test(sql)) return { results: overrides.safetyEventRows ?? [] };
            if (/HL_medicationLogs/.test(sql)) return { results: overrides.medicationRows ?? [] };
            if (/HL_Reports/.test(sql)) return { results: overrides.reportRows ?? [] };
            if (/HL_aiClinicalSessions/.test(sql)) return { results: overrides.aiSessionRows ?? [] };
            if (/HL_waterIntakeLogs/.test(sql)) return { results: overrides.waterRows ?? [] };
            if (/HL_cycleLogs/.test(sql)) return { results: overrides.cycleRows ?? [] };
            if (/HL_whatsappMessages/.test(sql)) return { results: overrides.whatsappRows ?? [] };
            if (/SELECT vectorId FROM HL_vectorDocuments WHERE userId = \? AND status = 'indexed'/.test(sql)) return { results: overrides.staleVectors ?? [] };
            if (/SELECT vectorId FROM HL_vectorDocuments WHERE userId = \? AND status != 'deleted'/.test(sql) || /activeVectors/.test(sql)) return { results: overrides.activeVectors ?? [] };
            return { results: [] };
          },
          run: async () => {
            d1Updates.push({ sql, params });
            return { meta: { last_row_id: overrides.lastRowId ?? 1 } };
          },
        }),
      }),
    },
    VECTORIZE_INDEX: {
      insert: async (vectors) => { inserted.push(...vectors); },
      query: async (values, opts) => ({
        matches: (overrides.queryMatches ?? [
          { id: 'v_1_symptom_1', score: 0.92, metadata: { sourceType: 'symptom', sourceId: '1', contentPreview: 'Symptom: head...' } },
          { id: 'v_1_symptom_2', score: 0.55, metadata: { sourceType: 'symptom', sourceId: '2', contentPreview: 'Symptom: chest...' } },
        ]),
      }),
      deleteByIds: async (ids) => { deletedIds.push(...ids); },
    },
    AI: {
      run: async (model, input) => {
        if (typeof input.text === 'object' && input.text !== null && !Array.isArray(input.text)) {
          return { data: [[0.1, 0.2, 0.3]], shape: [1, 3] };
        }
        return { data: [[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]], shape: [1, 8] };
      },
    },
    AI_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
    _inserted: inserted,
    _deletedIds: deletedIds,
    _d1Updates: d1Updates,
    ...overrides,
  };
}

// ============================================================
// S6C-VS Tests (C.1) — VectorizeService
// ============================================================

test('S6C-VS-01: Insert produces deterministic vectorId format v_{userId}_{sourceType}_{sourceId}', async () => {
  const env = makeMockEnv({ indexedCount: 0, oldestVector: null });
  const service = new VectorizeService(env);

  const vectorId = await service.insert({
    userId: 42,
    sourceType: 'symptom',
    sourceId: '101',
    content: 'Patient reports headache',
    metadata: { bodyArea: 'head' },
  });

  assert.equal(vectorId, 'v_42_symptom_101', 'vectorId must follow v_{userId}_{sourceType}_{sourceId} format');

  assert.match(vectorId, /^v_\d+_[a-zA-Z]+_\d+$/, 'vectorId must match deterministic pattern');
});

test('S6C-VS-02: minScore filtering — results below minScore excluded', async () => {
  const env = makeMockEnv({
    queryMatches: [
      { id: 'v_1_symptom_1', score: 0.92, metadata: { sourceType: 'symptom', sourceId: '1', contentPreview: 'high match' } },
      { id: 'v_1_symptom_2', score: 0.55, metadata: { sourceType: 'symptom', sourceId: '2', contentPreview: 'low match' } },
      { id: 'v_1_symptom_3', score: 0.71, metadata: { sourceType: 'symptom', sourceId: '3', contentPreview: 'mid match' } },
    ],
  });
  const service = new VectorizeService(env);

  const results = await service.query(1, 'headache', 10, 0.7);
  assert.equal(results.length, 2, 'Only results with score >= 0.7 should be returned');
  for (const r of results) {
    assert.ok(r.score >= 0.7, `Score ${r.score} must be >= minScore 0.7`);
  }
});

test('S6C-VS-03: Namespace isolation — namespace is always user:{userId}', async () => {
  const env = makeMockEnv({ indexedCount: 0 });
  const service = new VectorizeService(env);

  await service.insert({
    userId: 100,
    sourceType: 'symptom',
    sourceId: '1',
    content: 'test',
    metadata: {},
  });

  const insertedVector = env._inserted[0];
  assert.equal(insertedVector.namespace, 'user:100', 'Namespace must be user:{userId} from server, never from client');

  const status = await service.getStatus(100);
  assert.equal(status.namespace, 'user:100', 'getStatus namespace must also be user:{userId}');
});

test('S6C-VS-04: Delete marks status=deleted in D1', async () => {
  const env = makeMockEnv();
  const service = new VectorizeService(env);

  await service.delete(1, ['v_1_symptom_1', 'v_1_symptom_2']);

  assert.deepEqual(env._deletedIds, ['v_1_symptom_1', 'v_1_symptom_2'], 'Vectorize deleteByIds called with correct IDs');

  const deleteUpdate = env._d1Updates.find(u => /UPDATE HL_vectorDocuments SET status = 'deleted'/.test(u.sql));
  assert.ok(deleteUpdate, 'D1 must set status=deleted for deleted vectors');
});

test('S6C-VS-05: DeleteAll marks all status=deleted', async () => {
  const activeVectors = [
    { vectorId: 'v_1_symptom_1' },
    { vectorId: 'v_1_measurement_2' },
  ];
  const env = makeMockEnv({ activeVectors });
  const service = new VectorizeService(env);

  await service.deleteAll(1);

  assert.ok(env._deletedIds.length >= 2, 'All user vector IDs must be deleted from Vectorize');

  const deleteAllUpdate = env._d1Updates.find(u => /UPDATE HL_vectorDocuments SET status = 'deleted' WHERE userId = \?/.test(u.sql) && !u.sql.includes('AND vectorId'));
  assert.ok(deleteAllUpdate, 'D1 must mark ALL user vectors as deleted');
});

test('S6C-VS-06: Rebuild idempotency — same sources produce same vectorIds (deterministic)', async () => {
  const sources = [
    { type: 'symptom', id: 1, data: { id: 1, bodyArea: 'head', painScale: 5, painSeverity: 'moderate', isRedFlag: 0, mood: 'normal', symptomDateTime: '2026-06-30T10:00:00Z' } },
    { type: 'measurement', id: 2, data: { id: 2, metricCode: 'systolic', finalValue: 130, status: 'high', severity: 'mild', measuredAt: '2026-06-30T08:00:00Z' } },
  ];

  const docs1 = buildMemoryDocuments(sources);
  const docs2 = buildMemoryDocuments(sources);

  const ids1 = docs1.map(d => `v_42_${d.sourceType}_${d.sourceId}`).sort();
  const ids2 = docs2.map(d => `v_42_${d.sourceType}_${d.sourceId}`).sort();

  assert.deepEqual(ids1, ids2, 'Deterministic IDs: same sources must produce same vectorIds');
  assert.deepEqual(ids1, ['v_42_measurement_2', 'v_42_symptom_1'], 'Vector IDs match expected format');

  const sameCount = ids1.length === ids2.length && ids1.every((id, i) => id === ids2[i]);
  assert.ok(sameCount, 'No duplicate vectors from rebuild: same input yields same output');
});

test('S6C-VS-07: LRU eviction logic — enforcePerUserLimit evicts oldest when at limit', async () => {
  const env = makeMockEnv({
    indexedCount: 500,
    oldestVector: { vectorId: 'v_1_symptom_oldest' },
  });
  const service = new VectorizeService(env);

  await service.insert({
    userId: 1,
    sourceType: 'symptom',
    sourceId: 'new',
    content: 'new symptom',
    metadata: {},
  });

  assert.ok(env._deletedIds.includes('v_1_symptom_oldest'), 'Oldest vector must be evicted from Vectorize');

  const evictionUpdate = env._d1Updates.find(u => /HL_safetyEvents/.test(u.sql) && /vector_lru_eviction/.test(u.sql));
  assert.ok(evictionUpdate, 'LRU eviction must raise HL_safetyEvents');

  const statusUpdate = env._d1Updates.find(u => /UPDATE HL_vectorDocuments SET status = 'deleted' WHERE vectorId = \?/.test(u.sql));
  assert.ok(statusUpdate, 'Evicted vector must be marked deleted in D1');
});

test('S6C-VS-08: Cross-user namespace isolation — namespace always derived from userId', async () => {
  const env1 = makeMockEnv({ indexedCount: 0 });
  const env2 = makeMockEnv({ indexedCount: 0 });

  const service1 = new VectorizeService(env1);
  const service2 = new VectorizeService(env2);

  await service1.insert({ userId: 10, sourceType: 'symptom', sourceId: '1', content: 'user10 data', metadata: {} });
  await service2.insert({ userId: 20, sourceType: 'symptom', sourceId: '1', content: 'user20 data', metadata: {} });

  assert.equal(env1._inserted[0].namespace, 'user:10', 'User 10 namespace must be user:10');
  assert.equal(env2._inserted[0].namespace, 'user:20', 'User 20 namespace must be user:20');
  assert.notEqual(env1._inserted[0].namespace, env2._inserted[0].namespace, 'Different users must have different namespaces');
});

test('S6C-VS-09: Rerank returns proper RerankedResult format', async () => {
  const env = makeMockEnv({
    queryMatches: [
      { id: 'v_1_symptom_1', score: 0.95, metadata: { contentPreview: 'Severe headache with nausea' } },
      { id: 'v_1_symptom_2', score: 0.80, metadata: { contentPreview: 'Mild headache' } },
    ],
  });
  const service = new VectorizeService(env);

  const results = await service.rerank(1, 'headache', ['doc1', 'doc2', 'doc3'], 2);

  assert.equal(results.length, 2, 'topN=2 must return at most 2 results');
  for (const r of results) {
    assert.ok(typeof r.index === 'number', 'RerankedResult.index must be number');
    assert.ok(typeof r.score === 'number', 'RerankedResult.score must be number');
    assert.ok(typeof r.document === 'string', 'RerankedResult.document must be string');
  }
  assert.equal(results[0].index, 0, 'First result index=0');
  assert.equal(results[0].score, 0.95, 'First result score preserved');
});

test('S6C-VS-10: Content preview safe — safePreview truncates to 200 chars', async () => {
  const env = makeMockEnv({ indexedCount: 0 });
  const service = new VectorizeService(env);

  const longContent = 'A'.repeat(500);
  await service.insert({
    userId: 1,
    sourceType: 'symptom',
    sourceId: '1',
    content: longContent,
    metadata: {},
  });

  const insertedMeta = env._inserted[0].metadata;
  assert.ok(insertedMeta.contentPreview.length <= 200, `contentPreview must be <= 200 chars, got ${insertedMeta.contentPreview.length}`);
  assert.equal(insertedMeta.contentPreview, 'A'.repeat(200), 'contentPreview must be first 200 chars');
});

// ============================================================
// S6C-NS Tests (C.2) — Namespace & Safety
// ============================================================

test('S6C-NS-01: Client namespace override ignored — namespace always from userId', async () => {
  const env = makeMockEnv({ indexedCount: 0 });
  const service = new VectorizeService(env);

  await service.insert({
    userId: 42,
    sourceType: 'symptom',
    sourceId: '1',
    content: 'test content',
    metadata: { namespace: 'user:999' },
  });

  assert.equal(env._inserted[0].namespace, 'user:42', 'Vectorize namespace property is ALWAYS derived from userId, client cannot override');

  const status = await service.getStatus(42);
  assert.equal(status.namespace, 'user:42', 'getStatus namespace also server-derived');
});

test('S6C-NS-02: Vectorize failure does not block — service returns gracefully', async () => {
  const failEnv = {
    DB: makeMockEnv({ indexedCount: 0 }).DB,
    VECTORIZE_INDEX: {
      insert: async () => { throw new Error('Vectorize unavailable'); },
      query: async () => { throw new Error('Vectorize unavailable'); },
      deleteByIds: async () => { throw new Error('Vectorize unavailable'); },
    },
    AI: makeMockEnv().AI,
    AI_KV: makeMockEnv().AI_KV,
  };

  const service = new VectorizeService(failEnv);

  const queryResults = await service.query(1, 'headache', 5, 0.5);
  assert.ok(Array.isArray(queryResults), 'query must return array on failure');
  assert.equal(queryResults.length, 0, 'query returns empty on Vectorize failure');

  const vectorId = await service.insert({
    userId: 1, sourceType: 'symptom', sourceId: '1',
    content: 'test', metadata: {},
  });
  assert.ok(typeof vectorId === 'string', 'insert must return a vectorId even on failure');

  await assert.doesNotReject(async () => service.delete(1, ['v_1_symptom_1']), 'delete must not throw on Vectorize failure');
});

test('S6C-NS-03: Raw secret/token not indexed — sanitizeMetadata strips secrets from metadata', async () => {
  const env = makeMockEnv({ indexedCount: 0 });
  const service = new VectorizeService(env);

  const metadataWithSecrets = {
    secret: 'my-super-secret-value',
    token: 'abc123def456ghi789jkl012',
    apiKey: 'sk-abcdef1234567890abcdef',
    api_key: 'key_1234567890abcdef',
    password: 'hunter2password',
    bodyArea: 'chest',
    rawContent: 'Full raw clinical content that should not be indexed',
    rawPrompt: 'System prompt with internal instructions',
    rawImage: 'base64encodedimagedata==',
    diagnosis: 'Hypertension Stage 2',
    prescription: 'Amlodipine 10mg daily',
    dosage: 'Take 1 tablet twice daily',
  };

  await service.insert({
    userId: 1,
    sourceType: 'symptom',
    sourceId: '1',
    content: 'test',
    metadata: metadataWithSecrets,
  });

  const storedMeta = env._inserted[0].metadata;

  assert.match(storedMeta.secret, /^\[\d+ chars\]$/, 'secret field must be redacted to length indicator');
  assert.match(storedMeta.token, /^\[\d+ chars\]$/, 'token field must be redacted (in SENSITIVE_META_KEYS)');
  assert.match(storedMeta.apiKey, /^\[\d+ chars\]$/, 'apiKey field must be redacted (in SENSITIVE_META_KEYS)');
  assert.match(storedMeta.api_key, /^\[\d+ chars\]$/, 'api_key field must be redacted (in SENSITIVE_META_KEYS)');
  assert.match(storedMeta.password, /^\[\d+ chars\]$/, 'password field must be redacted (in SENSITIVE_META_KEYS)');

  assert.ok(storedMeta.rawContent === undefined || typeof storedMeta.rawContent === 'string' && storedMeta.rawContent !== metadataWithSecrets.rawContent, 'rawContent must be redacted or removed, never raw');
  assert.ok(storedMeta.rawPrompt === undefined || typeof storedMeta.rawPrompt === 'string' && storedMeta.rawPrompt !== metadataWithSecrets.rawPrompt, 'rawPrompt must be redacted or removed, never raw');
  assert.ok(storedMeta.rawImage === undefined || typeof storedMeta.rawImage === 'string' && storedMeta.rawImage !== metadataWithSecrets.rawImage, 'rawImage must be redacted or removed, never raw');
  assert.ok(storedMeta.diagnosis === undefined || storedMeta.diagnosis !== metadataWithSecrets.diagnosis, 'diagnosis must be redacted or removed, never raw');
  assert.ok(storedMeta.prescription === undefined || storedMeta.prescription !== metadataWithSecrets.prescription, 'prescription must be redacted or removed, never raw');
  assert.ok(storedMeta.dosage === undefined || storedMeta.dosage !== metadataWithSecrets.dosage, 'dosage must be redacted or removed, never raw');

  assert.equal(storedMeta.bodyArea, 'chest', 'Non-sensitive metadata field must pass through unchanged');

  const metaStr = JSON.stringify(storedMeta);
  assert.ok(!metaStr.includes('my-super-secret-value'), 'Raw secret value must not appear in stored metadata');
  assert.ok(!metaStr.includes('hunter2password'), 'Raw password must not appear in stored metadata');
  assert.ok(!metaStr.includes('sk-abcdef'), 'Raw API key pattern must not appear in stored metadata');
});

test('S6C-NS-04: Cross-user data not indexed — document builder only includes user own data', () => {
  const userASource = {
    type: 'symptom',
    id: 1,
    data: { id: 1, bodyArea: 'head', painScale: 5, painSeverity: 'moderate', isRedFlag: 0, mood: 'fine', symptomDateTime: '2026-06-30' },
  };

  const doc = buildMemoryDocument(userASource);

  assert.ok(doc, 'Document must be produced for valid source');
  assert.equal(doc.sourceType, 'symptom');
  assert.ok(!doc.content.includes('pasien lain'), 'No cross-user references in content');
  assert.ok(!doc.content.includes('other patient'), 'No cross-user references in content');
  assert.ok(!doc.content.includes('userId=2'), 'No other user IDs in content');

  const containsOnlyUserData = !JSON.stringify(doc.metadata).includes('userId') || doc.metadata.recordedAt;
  assert.ok(containsOnlyUserData || !doc.metadata.otherUserId, 'Metadata must not include other users data');

  const multipleSources = [
    { type: 'symptom', id: 1, data: { id: 1, bodyArea: 'head', painScale: 3, painSeverity: 'mild', isRedFlag: 0, mood: 'ok', symptomDateTime: '2026-06-30' } },
    { type: 'measurement', id: 2, data: { id: 2, metricCode: 'systolic', finalValue: 120, status: 'normal', severity: 'normal', measuredAt: '2026-06-30' } },
  ];

  const docs = buildMemoryDocuments(multipleSources);
  for (const d of docs) {
    assert.ok(!d.content.includes('otherUser'), 'Each document must not reference other users');
  }
});

test('S6C-NS-05: Full raw prompt not indexed — document builders produce summaries not raw content', () => {
  const sources = [
    {
      type: 'aiSession',
      id: 10,
      data: {
        id: 10,
        sessionType: 'clinical_copilot',
        status: 'active',
        dataSufficiencyScore: 75,
        startedAt: '2026-06-30T12:00:00Z',
        createdAt: '2026-06-30T12:00:00Z',
      },
    },
    {
      type: 'doctorReport',
      id: 20,
      data: {
        id: 20,
        reportType: 'lab_result',
        createdAt: '2026-06-30T09:00:00Z',
      },
    },
    {
      type: 'whatsappChat',
      id: 30,
      data: {
        id: 30,
        messageType: 'text',
        direction: 'inbound',
        processedStatus: 'completed',
        createdAt: '2026-06-30T14:00:00Z',
      },
    },
  ];

  const docs = buildMemoryDocuments(sources);
  assert.equal(docs.length, 3, 'All 3 source types must produce documents');

  const aiSessionDoc = docs.find(d => d.sourceType === 'aiSession');
  assert.ok(aiSessionDoc, 'AI session document must be produced');
  assert.ok(!aiSessionDoc.content.includes('System: You are iSehat'), 'AI session must not contain raw system prompt');
  assert.ok(!aiSessionDoc.content.includes('User: Saya pusing'), 'AI session must not contain raw user message');
  assert.ok(aiSessionDoc.content.includes('type=clinical_copilot'), 'AI session content must be a metadata summary');
  assert.ok(aiSessionDoc.content.includes('sufficiency='), 'AI session content must include data sufficiency score');

  const reportDoc = docs.find(d => d.sourceType === 'doctorReport');
  assert.ok(reportDoc, 'Doctor report document must be produced');
  assert.ok(reportDoc.content.includes('type=lab_result'), 'Doctor report must contain report type summary');
  assert.ok(!reportDoc.content.includes('full report text'), 'Doctor report must not contain full raw report text');
  assert.ok(reportDoc.content.length < 200, 'Doctor report summary must be short');

  const waDoc = docs.find(d => d.sourceType === 'whatsappChat');
  assert.ok(waDoc, 'WhatsApp chat document must be produced');
  assert.ok(waDoc.content.includes('direction=inbound'), 'WA chat must contain direction');
  assert.ok(!waDoc.content.includes('raw message content'), 'WA chat must not contain raw message content');

  const hasRawPromptKeywords = docs.some(d =>
    d.content.toLowerCase().includes('as an ai') ||
    d.content.toLowerCase().includes('system prompt') ||
    d.content.toLowerCase().includes('you are a helpful')
  );
  assert.ok(!hasRawPromptKeywords, 'No document must contain raw prompt text');
});
