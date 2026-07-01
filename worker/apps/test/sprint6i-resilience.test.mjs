import { test } from 'node:test';
import assert from 'node:assert';
import app from '../dist/index.js';

function createCtx() {
  return { waitUntil() {}, passThroughOnException() {} };
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

async function callProbe(env) {
  const req = new Request('https://test.example/api/ai/probe', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  return app.fetch(req, env, createCtx());
}

test('S6I-T-09 normal AI_SERVICE response → 200', async () => {
  const env = {
    DB: createDbMock(),
    AI_SERVICE: { fetch: async () => new Response(JSON.stringify({ data: { status: 'ok', worker: 'isehat-ai-worker' } }), { status: 200 }) },
  };
  const res = await callProbe(env);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
});

test('S6I-T-09 AI_SERVICE error response → 502', async () => {
  const env = {
    DB: createDbMock(),
    AI_SERVICE: { fetch: async () => new Response(JSON.stringify({ error: 'bad gateway' }), { status: 502 }) },
  };
  const res = await callProbe(env);
  assert.equal(res.status, 502);
});

test('S6I-T-09 AI_SERVICE timeout (throw) → 504 AI_SERVICE_TIMEOUT', async () => {
  const env = {
    DB: createDbMock(),
    AI_SERVICE: { fetch: async () => { throw new Error('upstream timeout'); } },
  };
  const res = await callProbe(env);
  assert.equal(res.status, 504);
  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.error?.code, 'AI_SERVICE_TIMEOUT');
});

test('S6I-T-09 AI_SERVICE unavailable (undefined binding) → 503 with Retry-After: 30', async () => {
  const env = {
    DB: createDbMock(),
  };
  const res = await callProbe(env);
  assert.equal(res.status, 503);
  assert.equal(res.headers.get('retry-after'), '30');
  const json = await res.json();
  assert.equal(json.success, false);
  assert.equal(json.error?.code, 'AI_SERVICE_UNAVAILABLE');
});

test('S6I-T-09 100 concurrent resilience calls → no crashes and expected codes', async () => {
  const variants = [
    { status: 200 },
    { status: 502 },
    { throw: true },
    { unavailable: true },
  ];

  const requests = Array.from({ length: 100 }, (_, i) => {
    const v = variants[i % variants.length];
    const env = { DB: createDbMock() };
    if (v.unavailable) {
      // no AI_SERVICE
    } else if (v.throw) {
      env.AI_SERVICE = { fetch: async () => { throw new Error('timeout'); } };
    } else {
      env.AI_SERVICE = { fetch: async () => new Response(JSON.stringify({ data: { status: v.status === 200 ? 'ok' : 'down' } }), { status: v.status }) };
    }
    return callProbe(env);
  });

  const responses = await Promise.all(requests);
  const codes = responses.map((r) => r.status);
  assert.equal(codes.length, 100);
  assert.ok(codes.every((c) => [200, 502, 503, 504].includes(c)), `Unexpected status codes: ${codes.filter((c) => ![200, 502, 503, 504].includes(c)).join(',')}`);
  assert.ok(codes.filter((c) => c === 200).length >= 20, 'Expected at least 20 successes');
  assert.ok(codes.filter((c) => c === 502).length >= 20, 'Expected at least 502 errors');
  assert.ok(codes.filter((c) => c === 503).length >= 20, 'Expected at least 503 unavailable');
  assert.ok(codes.filter((c) => c === 504).length >= 20, 'Expected at least 504 timeouts');

  for (const res of responses) {
    if (res.status === 503) {
      assert.equal(res.headers.get('retry-after'), '30', '503 responses must include Retry-After: 30');
    }
  }
});
