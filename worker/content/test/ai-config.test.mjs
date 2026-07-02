import { test } from 'node:test';
import assert from 'node:assert';
import { aiConfigRouter } from '../dist/routes/ai-config.js';
import { AiConfigService } from '../dist/services/ai-config.js';
import { AiConfigRepository } from '../dist/repositories/ai-config.js';
import { IntegrityService } from '../dist/services/integrity.js';
import { AuditService, AuditRepository } from '../dist/services/audit.js';
import { errorCodes } from '../dist/utils/errors.js';
import { makeFakeDb } from './fake-db.mjs';

const BRAND_ID = '11111111-1111-4111-8111-111111111111';

function makeSvc(db, envName = 'local') {
  return new AiConfigService({
    repo: new AiConfigRepository(db),
    integrity: new IntegrityService(db),
    audit: new AuditService(new AuditRepository(db)),
    envName,
  });
}

function makeEnv(db, envName = 'local') {
  return { DB: db, ENVIRONMENT: envName };
}

function makeHeaders({ id = 'user-1', roles = 'aiConfigAdmin' } = {}) {
  return {
    'x-content-user-id': id,
    'x-content-user-roles': roles,
    'content-type': 'application/json',
  };
}

function aiRow(over = {}) {
  return {
    id: 'aiconfig_idea_generation_aaaaaaaa',
    brandId: BRAND_ID,
    provider: 'mock',
    model: 'mock-1',
    purpose: 'idea_generation',
    temperature: 0.7,
    maxTokens: 1024,
    timeoutMs: 30000,
    fallbackOrder: 0,
    isActive: 1,
    secretRef: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const ACTOR = { id: 'user-1', role: 'aiConfigAdmin' };

test('list returns paginated configs filtered by brand', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.aiConfigs.set('a1', aiRow({ id: 'a1', fallbackOrder: 0 }));
  rows.aiConfigs.set('a2', aiRow({ id: 'a2', purpose: 'safety_check', fallbackOrder: 1 }));

  const res = await aiConfigRouter.request(
    `/?brandId=${BRAND_ID}`,
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.items.length, 2);
  assert.strictEqual(body.data.pagination.total, 2);
  assert.strictEqual(body.data.items[0].isActive, true);
  assert.strictEqual(body.data.items[0].provider, 'mock');
});

test('list filters by purpose and isActive', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.aiConfigs.set('a1', aiRow({ id: 'a1', purpose: 'idea_generation', isActive: 1 }));
  rows.aiConfigs.set('a2', aiRow({ id: 'a2', purpose: 'safety_check', isActive: 0 }));
  rows.aiConfigs.set('a3', aiRow({ id: 'a3', purpose: 'idea_generation', isActive: 0 }));

  const res = await aiConfigRouter.request(
    `/?brandId=${BRAND_ID}&purpose=idea_generation&isActive=false`,
    { headers: makeHeaders() },
    makeEnv(db)
  );
  const body = await res.json();
  assert.strictEqual(body.data.items.length, 1);
  assert.strictEqual(body.data.items[0].id, 'a3');
  assert.strictEqual(body.data.items[0].isActive, false);
  assert.strictEqual(body.data.pagination.total, 1);
});

test('list requires brandId', async () => {
  const { db } = makeFakeDb();
  const res = await aiConfigRouter.request('/', { headers: makeHeaders() }, makeEnv(db));
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error.code, errorCodes.VALIDATION_ERROR);
});

test('create persists row with defaults, audits, defaults provider=mock in local', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const res = await aiConfigRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        brandId: BRAND_ID,
        model: 'gpt-4o-mini',
        purpose: 'idea_generation',
        temperature: 0.5,
      }),
    },
    makeEnv(db, 'local')
  );
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.provider, 'mock');
  assert.strictEqual(body.data.isActive, true);
  assert.strictEqual(body.data.model, 'gpt-4o-mini');
  assert.match(body.data.id, /^aiconfig_idea_generation_/);

  const audit = calls.find((c) => c.kind === 'audit');
  assert.ok(audit);
  assert.strictEqual(audit.args[3], 'aiConfig.create');
  assert.strictEqual(audit.args[4], 'aiConfig');
});

test('create rejects invalid provider', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const res = await aiConfigRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        brandId: BRAND_ID,
        provider: 'bogus',
        model: 'x',
        purpose: 'idea_generation',
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error.code, errorCodes.VALIDATION_ERROR);
});

test('create rejects temperature out of range', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const res = await aiConfigRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        brandId: BRAND_ID,
        provider: 'openai',
        model: 'x',
        purpose: 'idea_generation',
        temperature: 3,
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /temperature must be <= 2/);
});

test('create rejects negative maxTokens', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const res = await aiConfigRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        brandId: BRAND_ID,
        provider: 'openai',
        model: 'x',
        purpose: 'idea_generation',
        maxTokens: -1,
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.match(body.error.message, /maxTokens must be a positive integer/);
});

test('create returns 404 for unknown brand', async () => {
  const { db } = makeFakeDb();
  const res = await aiConfigRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        brandId: '99999999-9999-4999-8999-999999999999',
        model: 'x',
        purpose: 'idea_generation',
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 404);
});

test('update modifies allowed fields and audits', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.aiConfigs.set('a1', aiRow({ id: 'a1', model: 'old' }));
  const res = await aiConfigRouter.request(
    '/a1',
    {
      method: 'PATCH',
      headers: makeHeaders(),
      body: JSON.stringify({ model: 'new-model', temperature: 0.9 }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.model, 'new-model');
  assert.strictEqual(body.data.temperature, 0.9);

  const audit = calls.find((c) => c.kind === 'audit');
  assert.ok(audit);
  assert.strictEqual(audit.args[3], 'aiConfig.update');
  const before = JSON.parse(audit.args[7]);
  const after = JSON.parse(audit.args[8]);
  assert.strictEqual(before.model, 'old');
  assert.strictEqual(after.model, 'new-model');
});

test('activate toggles isActive and audits aiConfig.activate', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.aiConfigs.set('a1', aiRow({ id: 'a1', isActive: 1 }));
  const res = await aiConfigRouter.request(
    '/a1/active',
    { method: 'PATCH', headers: makeHeaders(), body: JSON.stringify({ isActive: false }) },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.isActive, false);

  const audit = calls.filter((c) => c.kind === 'audit').pop();
  assert.strictEqual(audit.args[3], 'aiConfig.deactivate');

  // reactivate
  const res2 = await aiConfigRouter.request(
    '/a1/active',
    { method: 'PATCH', headers: makeHeaders(), body: JSON.stringify({ isActive: true }) },
    makeEnv(db)
  );
  const audit2 = calls.filter((c) => c.kind === 'audit').pop();
  assert.strictEqual(audit2.args[3], 'aiConfig.activate');
});

test('activate rejects missing isActive', async () => {
  const { db, rows } = makeFakeDb();
  rows.aiConfigs.set('a1', aiRow({ id: 'a1' }));
  const res = await aiConfigRouter.request(
    '/a1/active',
    { method: 'PATCH', headers: makeHeaders(), body: JSON.stringify({}) },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
});

test('permission denied for viewer role', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const res = await aiConfigRouter.request(
    `/?brandId=${BRAND_ID}`,
    { headers: makeHeaders({ roles: 'viewer' }) },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.error.code, errorCodes.FORBIDDEN);
  assert.strictEqual(calls.find((c) => c.kind === 'audit'), undefined);
});

test('permission denied for create as designer', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const res = await aiConfigRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders({ roles: 'designer' }),
      body: JSON.stringify({ brandId: BRAND_ID, model: 'x', purpose: 'idea_generation' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 403);
  assert.strictEqual(calls.find((c) => c.kind === 'insert_ai_config'), undefined);
});

test('findActiveByPurpose returns active rows ordered by fallbackOrder', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.aiConfigs.set('a1', aiRow({ id: 'a1', fallbackOrder: 2, isActive: 1 }));
  rows.aiConfigs.set('a2', aiRow({ id: 'a2', fallbackOrder: 0, isActive: 1 }));
  rows.aiConfigs.set('a3', aiRow({ id: 'a3', fallbackOrder: 1, isActive: 0 }));
  const repo = new AiConfigRepository(db);
  const result = await repo.findActiveByPurpose(BRAND_ID, 'idea_generation');
  assert.deepStrictEqual(result.map((r) => r.id), ['a2', 'a1']);
});
