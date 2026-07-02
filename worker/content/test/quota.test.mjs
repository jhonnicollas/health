import { test } from 'node:test';
import assert from 'node:assert';
import { QuotaService } from '../dist/services/quota.js';
import { errorCodes } from '../dist/utils/errors.js';
import { makeFakeDb } from './fake-db.mjs';

const sampleBrand = {
  id: 'brand_isehat',
  name: 'iSehat',
  positioning: 'x',
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

function setup() {
  const fake = makeFakeDb();
  fake.rows.brands.set(sampleBrand.id, { ...sampleBrand });
  return { fake, svc: new QuotaService() };
}

const fixedNow = new Date('2026-06-15T12:00:00.000Z');

test('checkQuota allows under limit and creates default rows', async () => {
  const { fake, svc } = setup();
  await svc.checkQuota(fake.db, 'brand_isehat', 100, 200, 0.01, fixedNow);

  assert.strictEqual(fake.rows.aiQuotas.size, 2, 'expected daily and monthly rows');
  const periods = [...fake.rows.aiQuotas.values()].map((r) => r.period).sort();
  assert.deepStrictEqual(periods, ['daily', 'monthly']);
  for (const row of fake.rows.aiQuotas.values()) {
    assert.strictEqual(row.maxJobs, 1000);
    assert.strictEqual(row.maxTokens, 1_000_000);
    assert.strictEqual(row.maxCostUsd, 10);
    assert.strictEqual(row.usedJobs, 0);
    assert.strictEqual(row.usedTokens, 0);
    assert.strictEqual(row.usedCostUsd, 0);
  }
});

test('checkQuota throws QUOTA_EXCEEDED when jobs limit hit', async () => {
  const { fake, svc } = setup();
  const dailyRow = {
    id: 'q-d',
    brandId: 'brand_isehat',
    period: 'daily',
    maxJobs: 1,
    maxTokens: null,
    maxCostUsd: null,
    usedJobs: 1,
    usedTokens: 0,
    usedCostUsd: 0,
    resetsAt: new Date(Date.UTC(2026, 5, 16)).toISOString(),
    createdAt: fixedNow.toISOString(),
    updatedAt: fixedNow.toISOString(),
  };
  fake.rows.aiQuotas.set(dailyRow.id, { ...dailyRow });

  await assert.rejects(
    () => svc.checkQuota(fake.db, 'brand_isehat', 0, 0, 0, fixedNow),
    (err) => {
      assert.strictEqual(err.code, errorCodes.QUOTA_EXCEEDED);
      assert.strictEqual(err.status, 429);
      assert.match(err.message, /daily/);
      return true;
    }
  );
});

test('checkQuota throws QUOTA_EXCEEDED when tokens limit hit', async () => {
  const { fake, svc } = setup();
  fake.rows.aiQuotas.set('q-m', {
    id: 'q-m',
    brandId: 'brand_isehat',
    period: 'monthly',
    maxJobs: null,
    maxTokens: 100,
    maxCostUsd: null,
    usedJobs: 0,
    usedTokens: 90,
    usedCostUsd: 0,
    resetsAt: new Date(Date.UTC(2026, 6, 1)).toISOString(),
    createdAt: fixedNow.toISOString(),
    updatedAt: fixedNow.toISOString(),
  });

  await assert.rejects(
    () => svc.checkQuota(fake.db, 'brand_isehat', 20, 20, 0, fixedNow),
    (err) => {
      assert.strictEqual(err.code, errorCodes.QUOTA_EXCEEDED);
      assert.match(err.message, /Token/);
      return true;
    }
  );
});

test('incrementUsage updates daily and monthly rows', async () => {
  const { fake, svc } = setup();
  await svc.checkQuota(fake.db, 'brand_isehat', 10, 20, 0.05, fixedNow);
  await svc.incrementUsage(
    fake.db,
    'brand_isehat',
    { inputTokens: 100, outputTokens: 200, estimatedCostUsd: 0.5 },
    fixedNow
  );

  assert.strictEqual(fake.rows.aiQuotas.size, 2);
  for (const row of fake.rows.aiQuotas.values()) {
    assert.strictEqual(row.usedJobs, 1);
    assert.strictEqual(row.usedTokens, 300);
    assert.strictEqual(row.usedCostUsd, 0.5);
  }

  await svc.incrementUsage(
    fake.db,
    'brand_isehat',
    { inputTokens: 50, outputTokens: 50, estimatedCostUsd: 0.1 },
    fixedNow
  );
  for (const row of fake.rows.aiQuotas.values()) {
    assert.strictEqual(row.usedJobs, 2);
    assert.strictEqual(row.usedTokens, 400);
    assert.strictEqual(Math.round(row.usedCostUsd * 1000) / 1000, 0.6);
  }
});
