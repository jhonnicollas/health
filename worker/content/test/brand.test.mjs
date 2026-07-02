import { test } from 'node:test';
import assert from 'node:assert';
import brand from '../dist/routes/brand.js';
import { errorCodes } from '../dist/utils/errors.js';
import { makeFakeDb } from './fake-db.mjs';

function makeEnv(db) {
  return { DB: db, ENVIRONMENT: 'local' };
}

function makeHeaders({ id = 'user-1', roles = 'owner' } = {}) {
  return {
    'x-content-user-id': id,
    'x-content-user-roles': roles,
    'content-type': 'application/json',
  };
}

const sampleBrand = {
  id: 'brand_isehat',
  name: 'iSehat',
  positioning: 'Daily health companion',
  productValueJson: '["logging","reports"]',
  targetAudienceJson: '["caregivers"]',
  tone: 'Clear, trustworthy',
  languageDefault: 'id',
  disclaimerTemplate: 'Educational only',
  forbiddenClaimsJson: '["diagnosis"]',
  allowedClaimsJson: '["logging"]',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('GET /:id returns 200 with brand fields', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand_isehat', { ...sampleBrand });
  const res = await brand.request('/brand_isehat', { headers: makeHeaders() }, makeEnv(db));

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.id, 'brand_isehat');
  assert.strictEqual(body.data.name, 'iSehat');
  assert.strictEqual(body.data.languageDefault, 'id');
  assert.strictEqual(body.data.positioning, 'Daily health companion');
});

test('GET /:id missing returns 404', async () => {
  const { db } = makeFakeDb();
  const res = await brand.request('/missing', { headers: makeHeaders() }, makeEnv(db));

  assert.strictEqual(res.status, 404);
  const body = await res.json();
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error.code, errorCodes.NOT_FOUND);
});

test('PATCH /:id updates allowed fields and writes audit', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set('brand_isehat', { ...sampleBrand });
  const res = await brand.request(
    '/brand_isehat',
    {
      method: 'PATCH',
      headers: makeHeaders(),
      body: JSON.stringify({
        positioning: 'New positioning',
        languageDefault: 'en',
        productValueJson: ['x', 'y'],
      }),
    },
    makeEnv(db)
  );

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.positioning, 'New positioning');
  assert.strictEqual(body.data.languageDefault, 'en');
  assert.deepStrictEqual(JSON.parse(body.data.productValueJson), ['x', 'y']);

  const update = calls.find((c) => c.kind === 'update');
  assert.ok(update, 'expected an UPDATE statement to be captured');
  assert.match(update.sql, /UPDATE conBrands/i);
  assert.match(update.sql, /positioning = \?/);
  assert.match(update.sql, /languageDefault = \?/);
  assert.match(update.sql, /productValueJson = \?/);
  assert.match(update.sql, /updatedAt = \?/);
  assert.match(update.sql, /WHERE id = \?/);

  assert.strictEqual(update.args[update.args.length - 1], 'brand_isehat');
  assert.strictEqual(update.args[0], 'New positioning');
  assert.strictEqual(update.args[1], 'en');
  assert.strictEqual(update.args[2], '["x","y"]');

  const audit = calls.find((c) => c.kind === 'audit');
  assert.ok(audit, 'expected an audit INSERT statement to be captured');
  assert.match(audit.sql, /INSERT INTO conAuditLogs/i);
  assert.strictEqual(audit.args[3], 'brandMemory.update');
  assert.strictEqual(audit.args[4], 'brand');
  assert.strictEqual(audit.args[5], 'brand_isehat');
  assert.strictEqual(audit.args[6], 'info');
  assert.strictEqual(audit.args[1], 'user-1');
  assert.strictEqual(audit.args[2], 'owner');

  const before = JSON.parse(audit.args[7]);
  const after = JSON.parse(audit.args[8]);
  assert.strictEqual(before.positioning, 'Daily health companion');
  assert.strictEqual(after.positioning, 'New positioning');
  assert.strictEqual(after.languageDefault, 'en');
});

test('PATCH /:id with invalid languageDefault returns validation error', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set('brand_isehat', { ...sampleBrand });
  const res = await brand.request(
    '/brand_isehat',
    {
      method: 'PATCH',
      headers: makeHeaders(),
      body: JSON.stringify({ languageDefault: 'fr' }),
    },
    makeEnv(db)
  );

  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error.code, errorCodes.VALIDATION_ERROR);
  assert.match(body.error.message, /id.*en.*bilingual/);

  assert.strictEqual(calls.find((c) => c.kind === 'update'), undefined);
  assert.strictEqual(calls.find((c) => c.kind === 'audit'), undefined);
});

test('PATCH /:id by viewer returns 403', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set('brand_isehat', { ...sampleBrand });
  const res = await brand.request(
    '/brand_isehat',
    {
      method: 'PATCH',
      headers: makeHeaders({ roles: 'viewer' }),
      body: JSON.stringify({ positioning: 'Hacked positioning' }),
    },
    makeEnv(db)
  );

  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error.code, errorCodes.FORBIDDEN);

  assert.strictEqual(calls.find((c) => c.kind === 'update'), undefined);
  assert.strictEqual(calls.find((c) => c.kind === 'audit'), undefined);
});
