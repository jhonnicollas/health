import { test } from 'node:test';
import assert from 'node:assert';
import { AiJobService } from '../dist/services/ai-job.js';
import { AiJobRepository } from '../dist/repositories/ai-job.js';
import { AuditService } from '../dist/services/audit.js';
import { AuditRepository } from '../dist/services/audit.js';
import { IntegrityService } from '../dist/services/integrity.js';
import { errorCodes } from '../dist/utils/errors.js';
import { makeFakeDb } from './fake-db.mjs';

const sampleBrand = {
  id: 'brand_isehat',
  name: 'iSehat',
  positioning: 'Daily health companion',
  productValueJson: '[]',
  targetAudienceJson: null,
  tone: 'Clear',
  languageDefault: 'id',
  disclaimerTemplate: null,
  forbiddenClaimsJson: '[]',
  allowedClaimsJson: '[]',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function setup({ withBrand = true } = {}) {
  const fake = makeFakeDb();
  if (withBrand) fake.rows.brands.set(sampleBrand.id, { ...sampleBrand });
  const audit = new AuditService(new AuditRepository(fake.db));
  const svc = new AiJobService(
    new AiJobRepository(fake.db),
    new IntegrityService(fake.db),
    audit
  );
  return { fake, svc };
}

const baseInput = {
  brandId: 'brand_isehat',
  jobType: 'idea_generation',
  idempotencyKey: 'idem-1',
  input: { prompt: 'Hello world', api_key: 'sk-secret-should-be-redacted' },
};

const actor = { id: 'user-1', role: 'aiConfigAdmin' };

test('create stores redacted inputJson', async () => {
  const { fake, svc } = setup();
  const row = await svc.create(baseInput, actor);

  assert.match(row.id, /^job_[0-9a-f-]{36}$/);
  assert.strictEqual(row.brandId, 'brand_isehat');
  assert.strictEqual(row.status, 'queued');
  assert.strictEqual(row.jobType, 'idea_generation');

  const stored = fake.rows.aiJobs.get(row.id);
  assert.ok(stored, 'job row should be persisted');
  const parsed = JSON.parse(stored.inputJson);
  assert.strictEqual(parsed.data.api_key, '[REDACTED]');
  assert.strictEqual(parsed.data.prompt, 'Hello world');
  assert.ok(!stored.inputJson.includes('sk-secret-should-be-redacted'));
  assert.match(parsed.inputHash, /^[0-9a-f]{64}$/);

  const audit = fake.calls.find((c) => c.kind === 'audit');
  assert.ok(audit);
  assert.strictEqual(audit.args[3], 'aiJob.create');
  assert.strictEqual(audit.args[4], 'ai_job');
  assert.strictEqual(audit.args[5], row.id);
});

test('idempotency same key same input returns existing job', async () => {
  const { svc } = setup();
  const first = await svc.create(baseInput, actor);
  const second = await svc.create(baseInput, actor);
  assert.strictEqual(first.id, second.id);
});

test('idempotency same key different input throws IDEMPOTENCY_CONFLICT', async () => {
  const { svc } = setup();
  await svc.create(baseInput, actor);
  await assert.rejects(
    () =>
      svc.create(
        { ...baseInput, input: { prompt: 'Different content' } },
        actor
      ),
    (err) => {
      assert.strictEqual(err.code, errorCodes.IDEMPOTENCY_CONFLICT);
      assert.strictEqual(err.status, 409);
      return true;
    }
  );
});

test('complete updates outputJson and status', async () => {
  const { fake, svc } = setup();
  const job = await svc.create(baseInput, actor);
  const completed = await svc.complete(
    job.id,
    {
      output: { ideas: ['a', 'b'], secret: 'must-be-redacted' },
      tokenUsage: { inputTokens: 100, outputTokens: 200, estimatedCostUsd: 0.001 },
      modelUsed: 'mock-ce1',
      promptVersionId: 'prompt_idea_generation_v1',
    },
    actor
  );

  assert.strictEqual(completed.status, 'completed');
  assert.strictEqual(completed.modelUsed, 'mock-ce1');
  assert.strictEqual(completed.promptVersionId, 'prompt_idea_generation_v1');
  assert.strictEqual(completed.errorCode, null);
  assert.strictEqual(completed.errorMessage, null);
  assert.ok(completed.finishedAt);

  const stored = fake.rows.aiJobs.get(job.id);
  const out = JSON.parse(stored.outputJson);
  assert.deepStrictEqual(out.ideas, ['a', 'b']);
  assert.strictEqual(out.secret, '[REDACTED]');
  assert.ok(!stored.outputJson.includes('must-be-redacted'));

  const tokenUsage = JSON.parse(stored.tokenUsageJson);
  assert.deepStrictEqual(tokenUsage, {
    inputTokens: 100,
    outputTokens: 200,
    estimatedCostUsd: 0.001,
  });

  const audit = fake.calls.filter((c) => c.kind === 'audit');
  const completeAudit = audit.find((a) => a.args[3] === 'aiJob.complete');
  assert.ok(completeAudit);
  assert.strictEqual(completeAudit.args[5], job.id);
});

test('fail updates error code and message', async () => {
  const { fake, svc } = setup();
  const job = await svc.create(baseInput, actor);
  const failed = await svc.fail(job.id, 'PROVIDER_TIMEOUT', 'took too long', actor);

  assert.strictEqual(failed.status, 'failed');
  assert.strictEqual(failed.errorCode, 'PROVIDER_TIMEOUT');
  assert.strictEqual(failed.errorMessage, 'took too long');
  assert.ok(failed.finishedAt);

  const stored = fake.rows.aiJobs.get(job.id);
  assert.strictEqual(stored.status, 'failed');
  assert.strictEqual(stored.errorCode, 'PROVIDER_TIMEOUT');

  const audits = fake.calls.filter((c) => c.kind === 'audit');
  const failAudit = audits.find((a) => a.args[3] === 'aiJob.fail');
  assert.ok(failAudit);
  assert.strictEqual(failAudit.args[6], 'warning');
});

test('create with unknown brand returns NOT_FOUND', async () => {
  const { svc } = setup({ withBrand: false });
  await assert.rejects(
    () => svc.create(baseInput, actor),
    (err) => err.code === errorCodes.NOT_FOUND
  );
});
