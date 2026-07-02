import { test } from 'node:test';
import assert from 'node:assert';
import { UsageService } from '../dist/services/usage.js';
import { makeFakeDb } from './fake-db.mjs';

test('logUsage inserts a row with expected fields', async () => {
  const { db, calls, rows } = makeFakeDb();
  const svc = new UsageService(db);

  await svc.logUsage({
    brandId: 'brand_isehat',
    jobId: 'job_abc',
    provider: 'mock',
    model: 'mock-ce1',
    inputTokens: 123,
    outputTokens: 456,
    estimatedCostUsd: 0.0021,
  });

  const insert = calls.find((c) => c.kind === 'aiUsageInsert');
  assert.ok(insert, 'expected an aiUsageInsert call');
  assert.match(insert.sql, /INSERT INTO conAiUsageLogs/);
  const [
    id, brandId, jobId, provider, model,
    inputTokens, outputTokens, estimatedCostUsd, createdAt,
  ] = insert.args;
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.strictEqual(brandId, 'brand_isehat');
  assert.strictEqual(jobId, 'job_abc');
  assert.strictEqual(provider, 'mock');
  assert.strictEqual(model, 'mock-ce1');
  assert.strictEqual(inputTokens, 123);
  assert.strictEqual(outputTokens, 456);
  assert.strictEqual(estimatedCostUsd, 0.0021);
  assert.match(createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

  assert.strictEqual(rows.aiUsage.size, 1);
  const stored = [...rows.aiUsage.values()][0];
  assert.strictEqual(stored.id, id);
  assert.strictEqual(stored.brandId, 'brand_isehat');
});

test('logUsage allows nullable jobId/provider/model', async () => {
  const { db, calls, rows } = makeFakeDb();
  const svc = new UsageService(db);
  await svc.logUsage({
    brandId: 'brand_isehat',
    jobId: null,
    provider: null,
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
  });

  const insert = calls.find((c) => c.kind === 'aiUsageInsert');
  assert.ok(insert);
  assert.strictEqual(insert.args[2], null);
  assert.strictEqual(insert.args[3], null);
  assert.strictEqual(insert.args[4], null);
  assert.strictEqual(rows.aiUsage.size, 1);
});
