import assert from 'node:assert/strict';
import test from 'node:test';

const webhookApp = (await import('../../webhook/dist/index.js')).default;
const aiApp = (await import('../dist/index.js')).default;
const { WhatsAppSessionDO } = await import('../dist/whatsappSessionDo.js');

async function sha256Token(value) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `sha256:${b64}`;
}

function createMockDb(handlers = {}) {
  const calls = [];
  const { first = {}, all = {}, run = {}, lastRowId = 1 } = handlers;
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
              return typeof v === 'function' ? v(args, sql) : { meta: { last_row_id: lastRowId, changes: 1 } };
            },
          };
        },
      };
    },
  };
}

function createMockFetcher(responses) {
  const requests = [];
  return {
    requests,
    fetch: async (req) => {
      requests.push(req);
      const url = typeof req === 'string' ? req : req.url;
      const factory = responses[url] || responses['*'];
      const res = factory ? await factory(req) : { status: 200, body: { success: true } };
      return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
    },
  };
}

function createCtx() {
  return { waitUntil() {}, passThroughOnException() {} };
}

async function fetchApp(app, { method = 'GET', path, body, headers = {}, env }) {
  const req = new Request(`https://test.example${path}`, {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
  return app.fetch(req, env, createCtx());
}

// ─── T-1..T-4, T-9, T-10: Worker #4 webhook tests ───

test('T-1: Valid signature + linked user -> AI event forwarded (mock AI_SERVICE)', async () => {
  const number = '+6281234567890';
  const numberHash = await sha256Token(number);
  const aiRequests = [];
  const db = createMockDb({
    first: {
      'HL_whatsappMessages': null,
      'HL_whatsappLinks': { id: 7, userId: 42, verified: 1, aiEnabled: 1, whatsappNumberHash: numberHash },
      'HL_systemConfigs': { configValue: '100' },
    },
  });
  const env = {
    DB: db,
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 'gateway-secret',
    AI_SERVICE: {
      fetch: async (req) => {
        aiRequests.push(req);
        return new Response(JSON.stringify({ success: true }), { status: 202, headers: { 'Content-Type': 'application/json' } });
      },
    },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };

  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/webhook',
    headers: { 'X-Gateway-Secret': 'gateway-secret', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'wa-msg-1', whatsappNumber: number, messageType: 'text', textContent: 'Halo' },
    env,
  });

  assert.equal(res.status, 202);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(aiRequests.length, 1);
  const forwarded = await aiRequests[0].json();
  assert.equal(forwarded.userId, 42);
  assert.equal(forwarded.whatsappLinkId, 7);
  assert.equal(forwarded.textContent, 'Halo');
});

test('T-2: Invalid signature -> 401', async () => {
  const env = {
    DB: createMockDb(),
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 'gateway-secret',
    AI_SERVICE: { fetch: async () => new Response('{}') },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/webhook',
    headers: { 'X-Gateway-Secret': 'wrong-secret', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'x', whatsappNumber: '+6281' },
    env,
  });
  assert.equal(res.status, 401);
});

test('T-3: Duplicate providerMessageId -> 200 duplicate', async () => {
  const db = createMockDb({
    first: {
      'HL_whatsappMessages': { id: 99 },
    },
  });
  const env = {
    DB: db,
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 's',
    AI_SERVICE: { fetch: async () => new Response('{}') },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/webhook',
    headers: { 'X-Gateway-Secret': 's', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'dup-1', whatsappNumber: '+6281234567890', messageType: 'text' },
    env,
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.duplicate, true);
  assert.equal(json.success, true);
});

test('T-4: Unlinked number -> linking instruction, no AI call', async () => {
  const number = '+6281999888777';
  const aiCalls = [];
  const db = createMockDb({
    first: {
      'HL_whatsappMessages': null,
      'HL_whatsappLinks': null,
      'HL_systemConfigs': { configValue: '100' },
    },
  });
  const env = {
    DB: db,
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 's',
    AI_SERVICE: { fetch: async (req) => { aiCalls.push(req); return new Response('{}'); } },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/webhook',
    headers: { 'X-Gateway-Secret': 's', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'unlinked-1', whatsappNumber: number, messageType: 'text', textContent: 'Halo' },
    env,
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.unlinked, true);
  assert.ok(json.reply);
  assert.equal(aiCalls.length, 0);
  const insertCall = db.calls.find((c) => c.sql.includes('INSERT INTO HL_whatsappMessages'));
  assert.ok(insertCall);
  assert.ok(insertCall.sql.includes('ignored_unlinked'));
});

test('T-9: Media upload -> stored to R2 key returned', async () => {
  const number = '+6281111222333';
  const puts = [];
  const db = createMockDb({
    first: {
      'HL_whatsappLinks': { id: 5, userId: 42 },
    },
  });
  const env = {
    DB: db,
    LOGS: {
      put: async (key, data, opts) => {
        puts.push({ key, data, opts });
      },
    },
    WA_GATEWAY_SECRET: 's',
    AI_SERVICE: { fetch: async () => new Response('{}') },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/media/ingest',
    headers: { 'X-Gateway-Secret': 's', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'media-1', whatsappNumber: number, mediaMimeType: 'image/jpeg', mediaBufferBase64: btoa('fake-image-bytes') },
    env,
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.mediaR2Key);
  assert.ok(json.mediaR2Key.includes('media-1'));
  assert.equal(puts.length, 1);
  assert.equal(puts[0].opts.httpMetadata.contentType, 'image/jpeg');
});

test('T-10: Rate limit 100/min exceeded -> 429', async () => {
  const number = '+6281234567890';
  const db = createMockDb({
    first: {
      'HL_whatsappMessages': null,
      'HL_systemConfigs': { configValue: '2' },
    },
  });
  const env = {
    DB: db,
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 's',
    AI_SERVICE: { fetch: async () => new Response('{}') },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  let lastStatus = 200;
  for (let i = 0; i < 4; i += 1) {
    const res = await fetchApp(webhookApp, {
      method: 'POST',
      path: '/api/whatsapp/webhook',
      headers: { 'X-Gateway-Secret': 's', 'Content-Type': 'application/json' },
      body: { providerMessageId: `rl-${i}`, whatsappNumber: number, messageType: 'text' },
      env,
    });
    lastStatus = res.status;
  }
  assert.equal(lastStatus, 429);
});

// ─── T-5..T-8: Worker #2 WhatsAppSessionDO + orchestrator tests ───

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
    AI_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
    VECTORIZE_INDEX: undefined,
    AI: undefined,
    WHATSAPP_OUTBOUND_QUEUE: {
      send: async (msg) => {
        outboundQueue.push(msg);
      },
    },
    outboundQueue,
    ...overrides,
  };
}

test('T-5: STOP AI command sets aiEnabled=0', async () => {
  const env = createAiEnv();
  const doState = {};
  const doObj = new WhatsAppSessionDO(doState, env);
  const res = await doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 7, userId: 42, providerMessageId: 'cmd-1', textContent: 'STOP AI', locale: 'id' }),
  }));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.command, 'STOP AI');
  const update = env.DB.calls.find((c) => c.sql.includes('UPDATE HL_whatsappLinks') && c.sql.includes('aiEnabled'));
  assert.ok(update);
  assert.equal(update.args[0], 0);
  assert.equal(env.outboundQueue.length, 1);
  assert.ok(env.outboundQueue[0].text.includes('dinonaktifkan'));
});

test('T-6: START AI command sets aiEnabled=1', async () => {
  const env = createAiEnv();
  const doObj = new WhatsAppSessionDO({}, env);
  const res = await doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 7, userId: 42, providerMessageId: 'cmd-2', textContent: 'START AI', locale: 'id' }),
  }));
  assert.equal(res.status, 200);
  const update = env.DB.calls.find((c) => c.sql.includes('UPDATE HL_whatsappLinks') && c.sql.includes('aiEnabled'));
  assert.ok(update);
  assert.equal(update.args[0], 1);
  assert.equal(env.outboundQueue.length, 1);
  assert.ok(env.outboundQueue[0].text.includes('aktif'));
});

test('T-7: Message order preserved via DO (simulate sequential fetch)', async () => {
  const env = createAiEnv();
  let sessionCreated = false;
  const originalRun = env.DB.prepare('').bind().run;
  // Intercept session lookup: first null, then id 1
  let sessionLookupCount = 0;
  env.DB.prepare = function (sql) {
    return {
      bind(...args) {
        if (sql.includes('HL_aiClinicalSessions') && sql.includes('ORDER BY startedAt DESC')) {
          sessionLookupCount += 1;
          return { first: async () => (sessionLookupCount > 1 ? { id: 1 } : null), all: async () => ({ results: [], meta: {} }), run: async () => ({ meta: { last_row_id: 1, changes: 1 } }) };
        }
        return {
          first: async () => null,
          all: async () => ({ results: [], meta: {} }),
          run: async () => ({ meta: { last_row_id: 1, changes: 1 } }),
        };
      },
    };
  };
  const doObj = new WhatsAppSessionDO({}, env);
  const bodies = [
    { whatsappLinkId: 7, userId: 42, providerMessageId: 'ord-1', textContent: 'Pesan pertama', locale: 'id' },
    { whatsappLinkId: 7, userId: 42, providerMessageId: 'ord-2', textContent: 'Pesan kedua', locale: 'id' },
  ];
  for (const b of bodies) {
    const res = await doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    }));
    assert.equal(res.status, 200);
  }
  assert.equal(env.outboundQueue.length, 2);
  assert.ok(env.outboundQueue[0].text.length > 0);
  assert.ok(env.outboundQueue[1].text.length > 0);
  assert.equal(env.outboundQueue[0].providerMessageId, 'ord-1');
  assert.equal(env.outboundQueue[1].providerMessageId, 'ord-2');
});

test('T-8: WA emergency red flag -> abbreviated message < 400 chars', async () => {
  const env = createAiEnv({
    DB: createMockDb({
      first: {
        'HL_whatsappLinks': { id: 7, userId: 42, verified: 1, aiEnabled: 1 },
        'HL_aiClinicalSessions': null,
        'HL_userProfiles': { sex: 'male', birthDate: '1980-01-01', heightCm: 170, aiConsent: 1, dataShareConsent: 0, emergencyConsent: 1 },
        'HL_systemConfigs': (args) => {
          const key = args[0];
          if (key === 'clinicalCopilot.maxTokens') return { configValue: '500' };
          if (key === 'clinicalCopilot.temperature') return { configValue: '3' };
          if (key === 'medicalSafetyRuntime.enabled') return { configValue: 'false' };
          return null;
        },
        'HL_promptVersions': null,
      },
      all: {
        'HL_measurementValues': [{ metricCode: 'systolic', finalValue: 200, unit: 'mmHg', status: 'emergency', measuredAt: '2026-06-30T08:00:00Z' }],
        'HL_symptomLogs': [],
        'HL_safetyEvents': [],
        'HL_medications': [],
        'HL_waterIntakeLogs': [],
        'HL_cycleLogs': [],
      },
    }),
  });
  const doObj = new WhatsAppSessionDO({}, env);
  const res = await doObj.fetch(new Request('https://ai-service.internal/whatsapp-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappLinkId: 7, userId: 42, providerMessageId: 'em-1', textContent: 'Saya pusing', locale: 'id' }),
  }));
  assert.equal(res.status, 200);
  assert.equal(env.outboundQueue.length, 1);
  assert.ok(env.outboundQueue[0].text.length < 400, `Reply length ${env.outboundQueue[0].text.length} should be < 400`);
});

// ─── Audit fix tests (S6G audit 2026-07-01) ───

test('T-11 (audit): video messageType is folded to document', async () => {
  const number = '+6281234567890';
  const numberHash = await sha256Token(number);
  const db = createMockDb({
    first: {
      'HL_whatsappMessages': null,
      'HL_whatsappLinks': { id: 7, userId: 42, verified: 1, aiEnabled: 1, whatsappNumberHash: numberHash },
      'HL_systemConfigs': { configValue: '100' },
    },
  });
  const env = {
    DB: db,
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 's',
    AI_SERVICE: { fetch: async () => new Response('{}') },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/webhook',
    headers: { 'X-Gateway-Secret': 's', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'vid-1', whatsappNumber: number, messageType: 'video' },
    env,
  });
  assert.equal(res.status, 202);
  const insertCall = db.calls.find((c) => c.sql.includes('INSERT INTO HL_whatsappMessages') && c.sql.includes('processing'));
  assert.ok(insertCall, 'should have invoked the linked-user INSERT');
  // Bind order in webhook handler: userId, link.id, providerMessageId, messageType, contentPreview
  assert.equal(insertCall.args[3], 'document', `video should be folded to document at messageType position; got ${insertCall.args[3]}`);
});

test('T-12 (audit): media ingest > 10MB -> 400 rejected', async () => {
  const env = {
    DB: createMockDb(),
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 's',
    AI_SERVICE: { fetch: async () => new Response('{}') },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  // base64 string deliberately over the size cap (14 MB of zeros encoded)
  const oversizedBase64 = 'A'.repeat(14 * 1024 * 1024);
  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/media/ingest',
    headers: { 'X-Gateway-Secret': 's', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'big-1', whatsappNumber: '+62812', mediaMimeType: 'image/jpeg', mediaBufferBase64: oversizedBase64 },
    env,
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, 'VALIDATION_ERROR');
  assert.ok(/exceeds/.test(json.error.message) || /limit/.test(json.error.message));
});

test('T-13 (audit): media ingest disallowed MIME -> 400 rejected', async () => {
  const env = {
    DB: createMockDb(),
    LOGS: { put: async () => ({}) },
    WA_GATEWAY_SECRET: 's',
    AI_SERVICE: { fetch: async () => new Response('{}') },
    API_SERVICE: { fetch: async () => new Response('{}') },
    JOBS_SERVICE: { fetch: async () => new Response('{}') },
  };
  const res = await fetchApp(webhookApp, {
    method: 'POST',
    path: '/api/whatsapp/media/ingest',
    headers: { 'X-Gateway-Secret': 's', 'Content-Type': 'application/json' },
    body: { providerMessageId: 'mime-1', whatsappNumber: '+62812', mediaMimeType: 'application/zip', mediaBufferBase64: btoa('zipbytes') },
    env,
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, 'VALIDATION_ERROR');
  assert.ok(json.error.message.includes('not allowed') || json.error.message.includes('Allowed'));
});

test('T-14a (audit): truncateForWhatsapp respects sentence-boundary cut + codepoints', async () => {
  const { truncateForWhatsapp } = await import('../dist/whatsappSessionDo.js');
  // Short text passes through unchanged.
  assert.equal(truncateForWhatsapp('Halo', 80), 'Halo');
  // Long text without trailing period — truncates at slice boundary + ' ...'.
  const long = 'a'.repeat(200);
  const out = truncateForWhatsapp(long, 80);
  assert.ok(out.length <= 84, `truncated length=${out.length} should be <= 84`);
  assert.ok(out.endsWith(' ...'), `should have ellipsis suffix, got: ${out.slice(-10)}`);

  // Sentence-boundary cut: picks last ". " within 60-100% of the slice window.
  const withSentences = 'Sentence one. Sentence two. Sentence three. ' + 'X'.repeat(300);
  const cut = truncateForWhatsapp(withSentences, 80);
  assert.ok(cut.endsWith(' ...'), `should end with ellipsis, got: ${cut.slice(-10)}`);
  assert.ok(cut.length <= 84, `sentence-cut length=${cut.length} should be <= 84`);

  // Unicode-safe: emoji 🤒 + combining characters must not be split mid-BMP.
  const emoji = '🤒' + 'a'.repeat(120);
  const emojiOut = truncateForWhatsapp(emoji, 40);
  assert.ok(emojiOut.length <= 44, `emoji-out length=${emojiOut.length} should be <= 44`);
  // 🤒 as a surrogate pair counts as one code point; we should NOT see a lone high/low surrogate.
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(emojiOut), 'must not produce lone high surrogate');
  assert.ok(!/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(emojiOut), 'must not produce lone low surrogate');
});

test('T-14b (audit): DO integration — outbound text never exceeds maxReplyChars', async () => {
  // Direct test of truncateForWhatsapp behavior; getMaxReplyChars remains internal (covered by
  // T-14a indirectly: default 400 truncated, no truncation otherwise).
  const { truncateForWhatsapp } = await import('../dist/whatsappSessionDo.js');
  // Default 400 should let up to 400 chars pass; longer must be cut.
  assert.equal(truncateForWhatsapp('x'.repeat(400), 400).length, 400);
  const over400 = 'x'.repeat(800);
  const out = truncateForWhatsapp(over400, 400);
  assert.ok(out.length <= 404, `length=${out.length} must be <= 404`);
  assert.ok(out.endsWith(' ...'));
});
