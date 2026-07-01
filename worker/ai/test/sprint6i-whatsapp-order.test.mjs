import { test } from 'node:test';
import assert from 'node:assert';
import { WhatsAppSessionDO } from '../dist/whatsappSessionDo.js';

function createMockDb(handlers = {}) {
  const calls = [];
  const { first = {}, all = {}, run = {} } = handlers;
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          const find = (map) => {
            for (const key of Object.keys(map)) {
              if (sql.includes(key)) return map[key];
            }
            return undefined;
          };
          return {
            first: async () => {
              const v = find(first);
              return typeof v === 'function' ? v(args, sql) : (v ?? null);
            },
            all: async () => {
              const v = find(all);
              return { results: typeof v === 'function' ? v(args, sql) : (v ?? []), meta: {} };
            },
            run: async () => {
              const v = find(run);
              return typeof v === 'function' ? v(args, sql) : { meta: { last_row_id: 1, changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function createAiEnv(overrides = {}) {
  const outboundQueue = [];
  const db = createMockDb({
    first: {
      'HL_whatsappLinks': { id: 7, userId: 42, verified: 1, aiEnabled: 1 },
      'HL_aiClinicalSessions': null,
      'HL_userProfiles': { sex: 'male', birthDate: '1980-01-01', heightCm: 170, aiConsent: 1, dataShareConsent: 0, emergencyConsent: 1 },
      'HL_systemConfigs': (args) => {
        const key = args[0];
        if (key === 'whatsappAi.maxInboundPerMinute') return { configValue: '100' };
        if (key === 'clinicalCopilot.maxTokens') return { configValue: '500' };
        if (key === 'clinicalCopilot.temperature') return { configValue: '3' };
        if (key === 'medicalSafetyRuntime.enabled') return { configValue: 'false' };
        return null;
      },
      'HL_promptVersions': null,
    },
    all: {
      'HL_measurementValues': [],
      'HL_symptomLogs': [],
      'HL_safetyEvents': [],
      'HL_medications': [],
      'HL_waterIntakeLogs': [],
      'HL_cycleLogs': [],
    },
  });
  return {
    DB: db,
    LOGS: { put: async () => ({}) },
    AI_KV: { get: async () => null, put: async () => {}, delete: async () => {} },
    VECTORIZE_INDEX: undefined,
    AI: undefined,
    WHATSAPP_OUTBOUND_QUEUE: { send: async (msg) => { outboundQueue.push(msg); } },
    outboundQueue,
    ...overrides,
  };
}

test('S6I-T-06 WhatsAppSessionDO preserves order for 10 sequential messages', async () => {
  const env = createAiEnv();
  const dbCalls = [];
  let sessionLookupCount = 0;
  env.DB.prepare = function (sql) {
    return {
      bind(...args) {
        dbCalls.push({ sql, args });
        if (sql.includes('HL_aiClinicalSessions') && sql.includes('ORDER BY startedAt DESC')) {
          sessionLookupCount += 1;
          return { first: async () => (sessionLookupCount > 1 ? { id: 1 } : null), all: async () => ({ results: [], meta: {} }), run: async () => ({ meta: { last_row_id: 1, changes: 1 } }) };
        }
        return { first: async () => null, all: async () => ({ results: [], meta: {} }), run: async () => ({ meta: { last_row_id: 1, changes: 1 } }) };
      },
    };
  };

  const doObj = new WhatsAppSessionDO({}, env);
  const ids = [];
  for (let i = 1; i <= 10; i += 1) {
    ids.push(`order-${i}`);
  }

  for (const id of ids) {
    const res = await doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsappLinkId: 7, userId: 42, providerMessageId: id, textContent: `Pesan ${id}`, locale: 'id' }),
    }));
    assert.equal(res.status, 200);
  }

  assert.equal(env.outboundQueue.length, 10);
  for (let i = 0; i < ids.length; i += 1) {
    assert.equal(env.outboundQueue[i].providerMessageId, ids[i], `Outbound order mismatch at index ${i}`);
  }

  const completedCalls = dbCalls.filter((c) => c.sql.includes('HL_whatsappMessages') && c.sql.includes('processedStatus'));
  assert.equal(completedCalls.length, 10, 'Expected 10 HL_whatsappMessages completion updates');
  for (let i = 0; i < ids.length; i += 1) {
    assert.equal(completedCalls[i].args[1], ids[i], `DB completion order mismatch at index ${i}`);
  }
});

test('S6I-T-06 concurrent messages are queued and processed sequentially', async () => {
  const env = createAiEnv();
  env.DB.prepare = function (sql) {
    return {
      bind(...args) {
        if (sql.includes('HL_aiClinicalSessions') && sql.includes('ORDER BY startedAt DESC')) {
          return { first: async () => ({ id: 1 }), all: async () => ({ results: [], meta: {} }), run: async () => ({ meta: { last_row_id: 1, changes: 1 } }) };
        }
        return { first: async () => null, all: async () => ({ results: [], meta: {} }), run: async () => ({ meta: { last_row_id: 1, changes: 1 } }) };
      },
    };
  };

  const doObj = new WhatsAppSessionDO({}, env);
  const ids = [];
  for (let i = 1; i <= 5; i += 1) {
    ids.push(`concurrent-${i}`);
  }

  const promises = ids.map((id) => doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 7, userId: 42, providerMessageId: id, textContent: `Pesan ${id}`, locale: 'id' }),
  })));

  const results = await Promise.all(promises);
  for (const res of results) {
    assert.equal(res.status, 200);
  }

  assert.equal(env.outboundQueue.length, 5);
  for (let i = 0; i < ids.length; i += 1) {
    assert.equal(env.outboundQueue[i].providerMessageId, ids[i], `Concurrent order mismatch at index ${i}`);
  }
});

test('S6I-T-06 second message waits while first is still processing', async () => {
  const outboundQueue = [];

  const db = createMockDb({
    first: {
      'HL_whatsappLinks': { id: 7, userId: 42, verified: 1, aiEnabled: 1 },
      'HL_aiClinicalSessions': { id: 1 },
      'HL_userProfiles': { sex: 'male', birthDate: '1980-01-01', heightCm: 170, aiConsent: 1, dataShareConsent: 0, emergencyConsent: 1 },
      'HL_systemConfigs': (args) => {
        const key = args[0];
        if (key === 'whatsappAi.maxInboundPerMinute') return { configValue: '100' };
        if (key === 'clinicalCopilot.maxTokens') return { configValue: '500' };
        if (key === 'clinicalCopilot.temperature') return { configValue: '3' };
        if (key === 'medicalSafetyRuntime.enabled') return { configValue: 'false' };
        if (key === 'aiGateway.customProvider.9router.enabled') return { configValue: 'false' };
        return null;
      },
      'HL_promptVersions': null,
    },
    all: {
      'HL_measurementValues': [],
      'HL_symptomLogs': [],
      'HL_safetyEvents': [],
      'HL_medications': [],
      'HL_waterIntakeLogs': [],
      'HL_cycleLogs': [],
    },
  });

  let aiCallCount = 0;
  const env = {
    DB: db,
    LOGS: { put: async () => ({}) },
    AI_KV: { get: async () => null, put: async () => {}, delete: async () => {} },
    VECTORIZE_INDEX: undefined,
    AI: {
      run: async () => {
        aiCallCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return { response: 'Balasan AI.' };
      },
    },
    WHATSAPP_OUTBOUND_QUEUE: { send: async (msg) => { outboundQueue.push(msg); } },
    outboundQueue,
  };

  const doObj = new WhatsAppSessionDO({}, env);

  const p1 = doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 7, userId: 42, providerMessageId: 'slow-1', textContent: 'Pesan pertama', locale: 'id' }),
  }));

  const p2 = doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 7, userId: 42, providerMessageId: 'slow-2', textContent: 'Pesan kedua', locale: 'id' }),
  }));

  await p1;
  await p2;

  assert.equal(env.outboundQueue.length, 2);
  assert.equal(env.outboundQueue[0].providerMessageId, 'slow-1');
  assert.equal(env.outboundQueue[1].providerMessageId, 'slow-2');
  assert.ok(aiCallCount >= 2, 'Both messages must trigger AI processing');
});

test('S6I-T-06 duplicate providerMessageId returns 200 without reprocessing', async () => {
  const env = createAiEnv();
  env.DB.prepare = function (sql) {
    return {
      bind(...args) {
        if (sql.includes('HL_aiClinicalSessions') && sql.includes('ORDER BY startedAt DESC')) {
          return { first: async () => ({ id: 1 }), all: async () => ({ results: [], meta: {} }), run: async () => ({ meta: { last_row_id: 1, changes: 1 } }) };
        }
        return { first: async () => null, all: async () => ({ results: [], meta: {} }), run: async () => ({ meta: { last_row_id: 1, changes: 1 } }) };
      },
    };
  };

  const doObj = new WhatsAppSessionDO({}, env);
  const body = { whatsappLinkId: 7, userId: 42, providerMessageId: 'dup-1', textContent: 'Halo', locale: 'id' };

  const first = await doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  assert.equal(first.status, 200);
  const firstJson = await first.json();
  assert.equal(firstJson.duplicate, undefined);

  const second = await doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));
  assert.equal(second.status, 200);
  const secondJson = await second.json();
  assert.equal(secondJson.duplicate, true);
  assert.equal(secondJson.providerMessageId, 'dup-1');

  assert.equal(env.outboundQueue.length, 1, 'Duplicate must not produce second outbound message');
});
