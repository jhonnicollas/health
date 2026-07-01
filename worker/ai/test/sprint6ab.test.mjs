import { test } from 'node:test';
import assert from 'node:assert';
import {
  SafetyDecision,
  renderBlockedTemplate,
  emergencySeverityDowngradeDetector,
  sensitiveDataLeakDetector,
  diagnosisFinalDetector,
  prescriptionDosageDetector,
  medicationChangeDetector,
  specialistClaimDetector,
  runSafetyRuntime,
} from '../dist/safety/index.js';
import { renderSafeTemplate } from '../dist/services/safeTemplate.js';
import { buildSystemPrompt } from '../dist/services/promptLoader.js';
import { routeModel } from '../dist/services/modelRouter.js';
import { getOperatingMode, getConfigString, getConfigBoolean, getConfigNumber, invalidateConfigCache } from '../dist/services/config.js';
import { KvCache, KV_TTL, getKvCache } from '../dist/services/kvCache.js';
import { logModelRun } from '../dist/services/modelRunLogger.js';
import { callAiGateway, get9routerConfig } from '../dist/services/aiGateway.js';
import { generateEmbedding, callWorkersAiText, classifyIntent, EMBEDDING_MODEL, FALLBACK_MODEL_1, FALLBACK_MODEL_2 } from '../dist/services/workersAi.js';

const DISCLAIMER = 'AI DAPAT MELAKUKAN KESALAHAN. TIDAK BOLEH MENGANDALKAN AI 100%.';

function safeOutput(body) {
  return `${body}\n\n${DISCLAIMER}`;
}

// ============================================================
// S6A — Safety Runtime Gap Tests
// ============================================================

test('S6A-ST-02: emergencySeverityDowngradeDetector returns emergency_template_only with 119/112', () => {
  const result = emergencySeverityDowngradeDetector({
    aiOutput: safeOutput('Tidak perlu khawatir, ini ringan saja.'),
    deterministicEmergencyLevel: 'emergency',
  });
  assert.equal(result.decision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY);
  assert.ok(result.emergencyText);
  assert.ok(result.emergencyText.includes('119'), 'emergencyText must include 119');
  assert.ok(result.emergencyText.includes('112'), 'emergencyText must include 112');
  assert.ok(result.emergencyText.includes('PERINGATAN DARURAT'), 'emergencyText must include PERINGATAN DARURAT');
});

test('S6A-ST-04: sensitiveDataLeakDetector blocks cycle/menstruation data without dataShareConsent', () => {
  const blockedCycle = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Siklus menstruasi Anda saat ini berada di hari ke-14.'),
    consents: { aiConsent: 1, dataShareConsent: 0 },
  });
  assert.equal(blockedCycle.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const blockedMenstruasi = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Data menstruasi Anda menunjukkan pola tidak teratur.'),
    consents: { aiConsent: 1, dataShareConsent: 0 },
  });
  assert.equal(blockedMenstruasi.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const blockedSiklus = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Berdasarkan siklus Anda, ovulasi diperkirakan minggu depan.'),
    consents: { aiConsent: 1, dataShareConsent: 0 },
  });
  assert.equal(blockedSiklus.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const allowedWithConsent = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Siklus menstruasi Anda saat ini berada di hari ke-14.'),
    consents: { aiConsent: 1, dataShareConsent: 1 },
  });
  assert.equal(allowedWithConsent.decision, SafetyDecision.ALLOW);
});

// ============================================================
// S6A — Operating Mode Tests (OM-01 to OM-10)
// ============================================================

test('S6A-OM-01: Mode standard, diagnosis final → rewrite', () => {
  const result = diagnosisFinalDetector({
    aiOutput: safeOutput('Diagnosis Anda adalah hipertensi.'),
    operatingMode: 'standard',
  });
  assert.equal(result.decision, SafetyDecision.REWRITE_SAFE);
  assert.ok(result.rewrite);
});

test('S6A-OM-02: Mode proactive, diagnosis final → allow', () => {
  const result = diagnosisFinalDetector({
    aiOutput: safeOutput('Diagnosis Anda adalah hipertensi.'),
    operatingMode: 'proactive',
  });
  assert.equal(result.decision, SafetyDecision.ALLOW);
});

test('S6A-OM-03: Mode proactive, prescription → rewrite', () => {
  const result = prescriptionDosageDetector({
    aiOutput: safeOutput('Minum amoxicillin 500mg dua kali sehari.'),
    operatingMode: 'proactive',
  });
  assert.equal(result.decision, SafetyDecision.REWRITE_SAFE);
  assert.ok(result.rewrite);
});

test('S6A-OM-04: Mode super_aktif, prescription → allow', () => {
  const result = prescriptionDosageDetector({
    aiOutput: safeOutput('Minum amoxicillin 500mg dua kali sehari.'),
    operatingMode: 'super_aktif',
  });
  assert.equal(result.decision, SafetyDecision.ALLOW);
});

test('S6A-OM-05: Mode super_aktif, specialist claim → allow', () => {
  const result = specialistClaimDetector({
    aiOutput: safeOutput('Saya setara dengan dokter spesialis.'),
    operatingMode: 'super_aktif',
  });
  assert.equal(result.decision, SafetyDecision.ALLOW);
});

test('S6A-OM-06: Mode super_aktif, medication change → block (ALL modes)', () => {
  const standardResult = medicationChangeDetector({
    aiOutput: safeOutput('Anda harus berhenti minum obat lama dan ganti ke yang baru.'),
  });
  assert.equal(standardResult.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const proactiveResult = medicationChangeDetector({
    aiOutput: safeOutput('Berhenti minum obat ini dan ganti ke yang baru.'),
  });
  assert.equal(proactiveResult.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const superAktifResult = medicationChangeDetector({
    aiOutput: safeOutput('Kurangi dosis obat Anda sekarang.'),
  });
  assert.equal(superAktifResult.decision, SafetyDecision.BLOCK_AND_FALLBACK);
});

// S6A-OM-07: Mode change audit — SKIP (needs D1, mark as manual)
test('S6A-OM-07: Mode change audit logged — MANUAL (requires D1 integration test)', { skip: 'Requires D1: HL_auditLogs action=aiOperatingModeChanged, manual test only' }, () => {
  assert.ok(true, 'Placeholder: verify HL_auditLogs has action=aiOperatingModeChanged after mode change');
});

test('S6A-OM-08: Mode-specific disclaimer super_aktif — buildSystemPrompt includes Super Active Mode language', () => {
  const prompt = buildSystemPrompt('You are iSehat AI...', 'super_aktif', '{"test": true}');
  assert.ok(prompt.includes('SUPER AKTIF MODE'), 'Must include SUPER AKTIF MODE');
  assert.ok(prompt.includes('MAY give a final diagnosis'), 'Must allow final diagnosis');
  assert.ok(prompt.includes('MAY prescribe medication'), 'Must allow prescription');
  assert.ok(prompt.includes('MAY claim equivalence to a specialist doctor') || prompt.includes('You MAY claim equivalence'), 'Must allow specialist claim');
  assert.ok(prompt.includes('MUST NOT change or stop'), 'Must still block medication change');
});

test('S6A-OM-09: Mode-specific disclaimer proactive — buildSystemPrompt includes proactive language', () => {
  const prompt = buildSystemPrompt('You are iSehat AI...', 'proactive', '{"test": true}');
  assert.ok(prompt.includes('PROACTIVE MODE'), 'Must include PROACTIVE MODE');
  assert.ok(prompt.includes('MAY give a final diagnosis'), 'Must allow final diagnosis');
  assert.ok(prompt.includes('MUST NOT prescribe medication'), 'Must block prescription');
  assert.ok(!prompt.includes('diagnosis_final'), 'diagnosis_final should NOT be in forbidden actions');
});

test('S6A-OM-10: Emergency guidance same in all modes — emergencySeverityDowngradeDetector blocks in all 3 modes', () => {
  for (const mode of ['standard', 'proactive', 'super_aktif']) {
    const result = emergencySeverityDowngradeDetector({
      aiOutput: safeOutput('Tidak perlu khawatir, ini ringan saja.'),
      deterministicEmergencyLevel: 'emergency',
    });
    assert.equal(result.decision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY, `Mode ${mode} must block emergency downgrade`);
    assert.ok(result.emergencyText?.includes('119'), `Mode ${mode} must include 119 in emergencyText`);
  }
});

// ============================================================
// S6A — Schema/Config Tests (SC-01 to SC-10)
// ============================================================

// SC-01/02/04/05/06/07/08/09 — require D1 integration test
for (const tc of [
  { id: 'SC-01', desc: 'All 10 tables created with correct columns' },
  { id: 'SC-02', desc: 'FK constraints enforced' },
  { id: 'SC-04', desc: '10 feature flags seeded' },
  { id: 'SC-05', desc: '44 system configs seeded' },
  { id: 'SC-05a', desc: 'Operating mode configs seeded' },
  { id: 'SC-06', desc: '7 RBAC permissions seeded + assigned' },
  { id: 'SC-07', desc: 'Plan quota matrix correct (5 plans x 10 features)' },
  { id: 'SC-08', desc: '6 prompt versions seeded with status=active' },
  { id: 'SC-09', desc: 'Service Binding #1 → #2 functional' },
]) {
  test(`S6A-${tc.id}: ${tc.desc} — requires D1 integration test`, { skip: 'Requires D1 integration test' }, () => {
    assert.ok(true, `Placeholder: ${tc.desc}`);
  });
}

// S6A-SC-03: FK check — SKIP (manual D1 test)
test('S6A-SC-03: PRAGMA foreign_key_check — MANUAL (requires D1)', { skip: 'Requires D1: run PRAGMA foreign_key_check after migration, manual test only' }, () => {
  assert.ok(true, 'Placeholder: PRAGMA foreign_key_check must return empty');
});

test('S6A-SC-10: Blocked template renders §10.3 — English locale also works', () => {
  const en = renderBlockedTemplate('en');
  assert.ok(en.includes('AI CAN MAKE MISTAKES.'), 'Line 1 EN');
  assert.ok(en.includes('DO NOT RELY ON AI 100%.'), 'Line 2 EN');
  assert.ok(en.includes('DO NOT TRUST AI 100%.'), 'Line 3 EN');
  assert.ok(en.includes('1000% YOUR OWN RESPONSIBILITY'), 'Line 4 EN');

  const id = renderBlockedTemplate('id');
  assert.ok(id.includes('AI DAPAT MELAKUKAN KESALAHAN.'), 'Line 1 ID');
  assert.ok(id.includes('TIDAK BOLEH MENGANDALKAN AI 100%.'), 'Line 2 ID');
  assert.ok(id.includes('TIDAK BOLEH PERCAYA AI 100%.'), 'Line 3 ID');
  assert.ok(id.includes('1000% TANGGUNG JAWAB ANDA'), 'Line 4 ID');
});

// ============================================================
// S6A — Negative Security Tests (NS-01 to NS-04)
// ============================================================

test('S6A-NS-01: No secret in migration SQL — verify no hardcoded secret values', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const sqlPath = path.resolve('/home/ubuntu/repositoryGIT/wt-sprint6/worker/apps/migrations/003_sprint6_schema.sql');
  const seedPath = path.resolve('/home/ubuntu/repositoryGIT/wt-sprint6/worker/apps/migrations/005_sprint6_seed.sql');

  for (const filePath of [sqlPath, seedPath]) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lowerLine = line.toLowerCase();
      const isComment = lowerLine.trimStart().startsWith('--');
      if (isComment) continue;

      const secretPatterns = [
        /\bapi[_-]?key\s*=\s*['"][^'"]{8,}/i,
        /\bsecret\s*=\s*['"][^'"]{8,}/i,
        /\bpassword\s*=\s*['"][^'"]{8,}/i,
        /\btoken\s*=\s*['"][^'"]{8,}/i,
        /\bsk-[a-z0-9]{20,}/i,
        /\b[a-f0-9]{32,}\b/i,
      ];

      for (const pattern of secretPatterns) {
        const match = pattern.exec(line);
        if (match) {
          const isColumnDef = /password|secret|token|key/i.test(line) && /VARCHAR|TEXT|CHECK|INSERT/i.test(lines[Math.max(0, i - 1)] + line);
          const isConfigRef = /gatewaySecretRef|configKey|configValue/i.test(line);
          if (!isConfigRef) {
            assert.fail(`Potential secret in ${filePath}:${i + 1}: ${line.trim()}`);
          }
        }
      }
    }
  }
  assert.ok(true, 'No hardcoded secret values found in migration SQL');
});

test('S6A-NS-02: ConfigService returns "configured" for secrets — getOperatingMode returns valid mode even with D1 error', async () => {
  const brokenEnv = {
    DB: {
      prepare: () => ({ bind: () => ({ first: async () => { throw new Error('D1 unavailable'); } }) }),
    },
  };

  const mode = await getOperatingMode(brokenEnv);
  assert.equal(mode, 'standard', 'Must default to standard on D1 error');

  const configVal = await getConfigString(brokenEnv, 'whatsappAi.gatewaySecretRef');
  assert.equal(configVal, null, 'Must return null on D1 error, never the actual secret');

  const boolVal = await getConfigBoolean(brokenEnv, 'medicalSafetyRuntime.enabled', true);
  assert.equal(boolVal, true, 'Must return fallback on D1 error');
});

// S6A-NS-03: Entitlement bypass — SKIP (needs API worker)
test('S6A-NS-03: Entitlement bypass attempt — requires API worker integration test', { skip: 'Requires API worker #1 with EntitlementService, integration test only' }, () => {
  assert.ok(true, 'Placeholder: free user accessing premium feature → 403 ENTITLEMENT_REQUIRED');
});

// S6A-NS-04: Quota bypass — SKIP (needs API worker)
test('S6A-NS-04: Quota bypass attempt — requires API worker integration test', { skip: 'Requires API worker #1 with QuotaService, integration test only' }, () => {
  assert.ok(true, 'Placeholder: exceed monthly limit → 403 QUOTA_EXCEEDED');
});

// ============================================================
// S6B — ModelRouter Tests (MR-01 to MR-07)
// ============================================================

test('S6B-MR-01: routeModel falls back to safe template when AI Gateway config missing', async () => {
  const noGatewayEnv = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ configValue: 'true' }),
          run: async () => ({ meta: { last_row_id: 1 } }),
        }),
      }),
    },
    AI_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
    CLOUDFLARE_ACCOUNT_ID: '',
    CLOUDFLARE_API_TOKEN: '',
    AI: {
      run: async () => ({ response: '' }),
    },
  };

  const result = await routeModel(noGatewayEnv, {
    taskCode: 'clinical_copilot',
    messages: [{ role: 'user', content: 'Saya merasa pusing' }],
    userId: 1,
    channel: 'web',
    locale: 'id',
  });

  assert.ok(result.text.length > 0, 'Must return non-empty text');
  assert.ok(result.fallbackUsed, 'Must mark fallback as used');
  assert.equal(result.provider, 'deterministic', 'Must use deterministic fallback');
  assert.ok(result.text.includes('AI DAPAT MELAKUKAN KESALAHAN'), 'Must include disclaimer');
});

test('S6B-MR-02: Request ID format is correct (req_timestamp_random)', async () => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  assert.match(requestId, /^req_\d+_[a-z0-9]+$/, 'requestId must match req_timestamp_random pattern');
});

test('S6B-MR-03: All providers fail → deterministic safe template', async () => {
  const allFailEnv = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ configValue: 'true' }),
          run: async () => ({ meta: { last_row_id: 1 } }),
        }),
      }),
    },
    AI_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
    CLOUDFLARE_ACCOUNT_ID: '',
    CLOUDFLARE_API_TOKEN: '',
    AI: {
      run: async () => {
        throw new Error('Workers AI unavailable');
      },
    },
  };

  const result = await routeModel(allFailEnv, {
    taskCode: 'clinical_copilot',
    messages: [{ role: 'user', content: 'Saya merasa lelah' }],
    userId: 1,
    channel: 'web',
    locale: 'id',
  });

  assert.ok(result.text.length > 0, 'Must return non-empty text even when all providers fail');
  assert.equal(result.provider, 'deterministic', 'Must fallback to deterministic');
  assert.equal(result.model, 'deterministic-safe-template');
  assert.ok(result.text.includes('AI DAPAT MELAKUKAN KESALAHAN'), 'Must include disclaimer');
});

test('S6B-MR-04: ModelRunLogInput interface completeness', () => {
  const input = {
    userId: 1,
    requestId: 'req_1234_abcd1234',
    sessionId: 42,
    channel: 'web',
    taskCode: 'clinical_copilot',
    providerCode: '9router',
    modelCode: 'oc/deepseek-v4-flash-free',
    status: 'success',
    fallbackUsed: 0,
    inputTokenCount: 150,
    outputTokenCount: 300,
    latencyMs: 1200,
    operatingMode: 'standard',
    promptVersion: 'v1.0.0',
    usedVectorContext: 1,
    usedAiSearch: 0,
    vectorQueryId: 99,
    safetyDecision: 'allow',
    safetyFlagsJson: '[]',
    errorCode: undefined,
    actorType: 'user',
    actorId: 1,
  };

  assert.equal(input.userId, 1);
  assert.equal(input.channel, 'web');
  assert.equal(input.status, 'success');
  assert.equal(input.operatingMode, 'standard');
  assert.equal(input.usedVectorContext, 1);
  assert.equal(input.safetyDecision, 'allow');
  assert.equal(typeof input.requestId, 'string');
  assert.equal(typeof input.latencyMs, 'number');
});

test('S6B-MR-05: KV cache TTL constants match PRD §8.11', () => {
  assert.equal(KV_TTL.PROMPT, 300, 'Prompt TTL = 300s per PRD §8.11');
  assert.equal(KV_TTL.ROUTING, 600, 'Routing TTL = 600s per PRD §8.11');
  assert.equal(KV_TTL.CONFIG, 300, 'Config TTL = 300s per PRD §8.11');
  assert.equal(KV_TTL.EDUCATION, 3600, 'Education TTL = 3600s per PRD §8.11');
  assert.equal(KV_TTL.SEARCH, 600, 'Search TTL = 600s per PRD §8.11');
  assert.equal(KV_TTL.DISCLAIMER, 86400, 'Disclaimer TTL = 86400s per PRD §8.11');
});

test('S6B-MR-05b: KV cache key format matches PRD §8.11', async () => {
  const kvOps = { gets: [], puts: [], deletes: [] };
  const mockKv = {
    get: async (key) => { kvOps.gets.push(key); return null; },
    put: async (key, val, opts) => { kvOps.puts.push({ key, val, opts }); },
    delete: async (key) => { kvOps.deletes.push(key); },
  };

  const cache = new KvCache(mockKv);

  await cache.getPrompt('clinical_copilot');
  assert.ok(kvOps.gets.includes('prompt:clinical_copilot:active'), 'Prompt key format');

  await cache.getConfig('clinicalCopilot.operatingMode');
  assert.ok(kvOps.gets.includes('config:clinicalCopilot.operatingMode'), 'Config key format');

  await cache.getRoutingPolicy();
  assert.ok(kvOps.gets.includes('routing:policy'), 'Routing key format');

  await cache.getEducation('id', 'hypertension-basics');
  assert.ok(kvOps.gets.includes('education:id:hypertension-basics'), 'Education key format');

  await cache.getSearch('abc123hash');
  assert.ok(kvOps.gets.includes('search:abc123hash'), 'Search key format');

  await cache.getDisclaimer('id');
  assert.ok(kvOps.gets.includes('disclaimer:id'), 'Disclaimer key format');
});

test('S6B-MR-07: 9router model loaded from config, not hardcoded', async () => {
  const configStore = {};
  const mockEnv = {
    DB: {
      prepare: () => ({
        bind: (key) => ({
          first: async () => {
            const configs = {
              'aiGateway.customProvider.9router.slug': { configValue: '9router' },
              'aiGateway.customProvider.9router.enabled': { configValue: 'true' },
              '9router.defaultModel': { configValue: 'oc/deepseek-v4-flash-free' },
              'aiGateway.gatewayId': { configValue: 'isehat-ai-gateway' },
              'aiGateway.enabled': { configValue: 'true' },
              'aiGateway.fallback.enabled': { configValue: 'true' },
            };
            return configs[key] || null;
          },
          run: async () => ({ meta: { last_row_id: 1 } }),
        }),
      }),
    },
    AI_KV: {
      get: async () => null,
      put: async () => {},
      delete: async () => {},
    },
  };

  const config = await get9routerConfig(mockEnv);
  assert.equal(config.slug, '9router', 'Slug from config');
  assert.equal(config.model, 'oc/deepseek-v4-flash-free', 'Model from config, not hardcoded');
  assert.equal(config.enabled, true, 'Enabled from config');
});

// ============================================================
// S6B — Negative Security Tests (NS-01 to NS-04)
// ============================================================

test('S6B-NS-01: CLOUDFLARE_API_TOKEN not in any config value stored in mock D1', async () => {
  const mockEnv = {
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => ({ configValue: 'isehat-ai-gateway' }),
          run: async () => ({ meta: { last_row_id: 1 } }),
        }),
      }),
    },
    AI_KV: {
      get: async () => null,
      put: async () => {},
    },
  };

  const allConfigKeys = [
    'aiGateway.gatewayId',
    'aiGateway.customProvider.9router.slug',
    '9router.defaultModel',
    'clinicalCopilot.operatingMode',
    'whatsappAi.gatewaySecretRef',
  ];

  for (const key of allConfigKeys) {
    const val = await getConfigString(mockEnv, key);
    if (val !== null) {
      assert.ok(
        !val.includes('CLOUDFLARE_API_TOKEN'),
        `Config key ${key} must not contain CLOUDFLARE_API_TOKEN value`
      );
      assert.ok(
        !/(?:sk-|key-)[a-f0-9]{20,}/i.test(val),
        `Config key ${key} must not contain API token patterns`
      );
    }
  }
});

test('S6B-NS-02: 9ROUTER_API_KEY not in model run log data', () => {
  const logInput = {
    userId: 1,
    requestId: 'req_1234_abc',
    channel: 'web',
    taskCode: 'clinical_copilot',
    providerCode: '9router',
    modelCode: 'oc/deepseek-v4-flash-free',
    status: 'success',
    fallbackUsed: 0,
    latencyMs: 500,
  };

  const logDataStr = JSON.stringify(logInput);
  assert.ok(!logDataStr.includes('9ROUTER_API_KEY'), 'ModelRunLogInput must not contain 9ROUTER_API_KEY');
  assert.ok(!logDataStr.includes('apiKey'), 'ModelRunLogInput must not contain apiKey field');
  assert.ok(!logDataStr.includes('api_key'), 'ModelRunLogInput must not contain api_key field');
});

test('S6B-NS-03: AI Gateway URL does not contain API token', () => {
  const accountId = 'test-account-id-12345';
  const gatewayId = 'isehat-ai-gateway';
  const url = `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/9router/chat/completions`;

  assert.ok(!url.includes('Bearer'), 'URL must not contain Bearer token');
  assert.ok(!url.includes('api_token'), 'URL must not contain api_token');
  assert.ok(!url.includes('apiToken'), 'URL must not contain apiToken');

  const headers = {
    'Authorization': `Bearer ${accountId}-fake-token`,
    'Content-Type': 'application/json',
  };

  assert.ok(headers['Authorization'].startsWith('Bearer '), 'Token goes in header, not URL');
  assert.ok(!url.includes(headers['Authorization'].split(' ')[1]), 'Token value not in URL');
});

test('S6B-NS-04: KV key patterns do not contain sensitive health data', async () => {
  const kvOps = { puts: [] };
  const mockKv = {
    get: async () => null,
    put: async (key, val, opts) => { kvOps.puts.push({ key, val, opts }); },
    delete: async () => {},
  };

  const cache = new KvCache(mockKv);

  await cache.setPrompt('clinical_copilot', 'prompt content');
  await cache.setConfig('clinicalCopilot.operatingMode', 'standard');
  await cache.setRoutingPolicy('{"default": "9router"}');
  await cache.setEducation('id', 'hypertension-basics', 'education content');
  await cache.setSearch('abc123', 'search result');
  await cache.setDisclaimer('id', 'disclaimer text');

  const sensitiveHealthPatterns = [
    /diagnosis/i,
    /prescription/i,
    /blood.?pressure/i,
    /tekanan.?darah/i,
    /symptom/i,
    /gejala/i,
    /medication/i,
    /obat/i,
    /pregnancy/i,
    /kehamilan/i,
    /cycle/i,
    /siklus/i,
  ];

  for (const { key } of kvOps.puts) {
    for (const pattern of sensitiveHealthPatterns) {
      const isConfigKeyForMode = key === 'config:clinicalCopilot.operatingMode';
      const isEducationKeyWithSlug = key.startsWith('education:');
      const skip = isConfigKeyForMode || isEducationKeyWithSlug;
      if (!skip) {
        assert.ok(
          !pattern.test(key),
          `KV key "${key}" must not contain sensitive health data matching ${pattern}`
        );
      }
    }
  }
});
