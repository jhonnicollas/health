import { test } from 'node:test';
import assert from 'node:assert';
import {
  AI_PROVIDER_NAMES,
  createProvider,
  selectConfig,
  parseJson,
  buildTimeoutPromise,
} from '../dist/services/ai-provider.js';
import { MockProvider } from '../dist/services/mock-provider.js';
import { errorCodes } from '../dist/utils/errors.js';

function makeConfig(overrides = {}) {
  return {
    id: 'cfg-1',
    brandId: 'brand-1',
    provider: 'mock',
    model: 'mock-default',
    purpose: 'idea_generation',
    temperature: 0.7,
    maxTokens: 1024,
    timeoutMs: 5000,
    fallbackOrder: 1,
    isActive: 1,
    secretRef: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('AI_PROVIDER_NAMES contains expected providers', () => {
  assert.ok(AI_PROVIDER_NAMES.has('mock'));
  assert.ok(AI_PROVIDER_NAMES.has('openai'));
  assert.ok(AI_PROVIDER_NAMES.has('google'));
  assert.ok(AI_PROVIDER_NAMES.has('anthropic'));
  assert.ok(AI_PROVIDER_NAMES.has('workersai'));
});

test('createProvider returns MockProvider for mock', () => {
  const p = createProvider('mock');
  assert.strictEqual(p.name, 'mock');
  assert.ok(p instanceof MockProvider);
});

test('MockProvider.generateJson returns parsed ideas', async () => {
  const p = new MockProvider();
  const result = await p.generateJson(makeConfig(), 'idea_generation prompt');
  assert.ok(Array.isArray(result.data.ideas));
  assert.strictEqual(result.data.ideas.length, 3);
  const idea = result.data.ideas[0];
  assert.ok(idea.title);
  assert.strictEqual(idea.sourceType, 'ai_inferred');
  assert.ok(typeof idea.score === 'number');
  assert.ok(['instagram', 'linkedin'].includes(idea.targetPlatform));
  assert.ok(['carousel', 'post', 'story_poll', 'reels_script'].includes(idea.contentFormat));
  assert.strictEqual(result.modelUsed, 'mock-mock-default');
  assert.strictEqual(result.tokenUsage.inputTokens, 50);
  assert.strictEqual(result.tokenUsage.outputTokens, 80);
  assert.strictEqual(result.promptVersionId, 'cfg-1');
});

test('MockProvider.generateJson returns draft object', async () => {
  const p = new MockProvider();
  const result = await p.generateJson(makeConfig(), 'draft_generation prompt');
  const d = result.data;
  assert.ok(d.primaryHook);
  assert.ok(Array.isArray(d.hookAlternatives));
  assert.ok(typeof d.mainContent === 'string');
  assert.ok(d.carouselSlides === null || Array.isArray(d.carouselSlides));
  assert.ok(d.script === null || typeof d.script === 'object');
  assert.ok(typeof d.caption === 'string');
  assert.ok(typeof d.cta === 'string');
  assert.ok(Array.isArray(d.hashtags));
  assert.ok(typeof d.visualBrief === 'object');
  assert.ok(typeof d.thumbnailText === 'string');
});

test('MockProvider.generateJson returns safety report', async () => {
  const p = new MockProvider();
  const result = await p.generateJson(makeConfig(), 'safety_check prompt');
  const r = result.data;
  assert.ok(['health_content', 'non_health_content', 'uncertain'].includes(r.healthContentStatus));
  assert.ok(['safe', 'warning', 'blocked'].includes(r.safetyStatus));
  assert.ok(Array.isArray(r.blockedReasons));
  assert.ok(Array.isArray(r.warnings));
  assert.ok(typeof r.sourceTraceRequired === 'boolean');
});

test('MockProvider returns deterministic identical output across calls', async () => {
  const p = new MockProvider();
  const a = await p.generateJson(makeConfig(), 'idea_generation prompt');
  const b = await p.generateJson(makeConfig(), 'idea_generation prompt');
  assert.deepStrictEqual(a.data, b.data);
});

test('parseJson returns parsed data on valid JSON', () => {
  const r = parseJson('{"a":1}');
  assert.deepStrictEqual(r.data, { a: 1 });
  assert.strictEqual(r.repaired, false);
});

test('parseJson extracts JSON from triple-backtick fences', () => {
  const raw = '```json\n{"x":2}\n```';
  const r = parseJson(raw);
  assert.deepStrictEqual(r.data, { x: 2 });
  assert.strictEqual(r.repaired, true);
});

test('parseJson extracts inline JSON object', () => {
  const raw = 'noise before {"a":1,"b":[1,2]} noise after';
  const r = parseJson(raw);
  assert.deepStrictEqual(r.data, { a: 1, b: [1, 2] });
  assert.strictEqual(r.repaired, true);
});

test('parseJson throws AI_PROVIDER_FAILED on garbage', () => {
  assert.throws(
    () => parseJson('not json at all'),
    (err) => err.code === errorCodes.AI_PROVIDER_FAILED
  );
});

test('buildTimeoutPromise rejects with AI_PROVIDER_FAILED', async () => {
  await assert.rejects(
    buildTimeoutPromise(1),
    (err) => err.code === errorCodes.AI_PROVIDER_FAILED
  );
});

test('selectConfig picks lowest fallbackOrder active config', () => {
  const cfgs = [
    makeConfig({ id: 'a', fallbackOrder: 5, isActive: 1 }),
    makeConfig({ id: 'b', fallbackOrder: 1, isActive: 1 }),
    makeConfig({ id: 'c', fallbackOrder: 3, isActive: 1 }),
  ];
  const picked = selectConfig(cfgs);
  assert.strictEqual(picked.id, 'b');
});

test('selectConfig ignores inactive configs even if fallbackOrder lower', () => {
  const cfgs = [
    makeConfig({ id: 'a', fallbackOrder: 0, isActive: 0 }),
    makeConfig({ id: 'b', fallbackOrder: 5, isActive: 1 }),
  ];
  const picked = selectConfig(cfgs);
  assert.strictEqual(picked.id, 'b');
});

test('selectConfig returns null when no active config', () => {
  const cfgs = [makeConfig({ id: 'a', fallbackOrder: 1, isActive: 0 })];
  assert.strictEqual(selectConfig(cfgs), null);
  assert.strictEqual(selectConfig([]), null);
});
