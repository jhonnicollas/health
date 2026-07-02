import { test } from 'node:test';
import assert from 'node:assert';
import { makeFakeDb } from './fake-db.mjs';
import { PillarService } from '../dist/services/pillar.js';
import { PillarRepository } from '../dist/repositories/pillar.js';
import { IntegrityService } from '../dist/services/integrity.js';
import { AuditService, AuditRepository } from '../dist/services/audit.js';
import { errorCodes } from '../dist/utils/errors.js';

const BRAND_ID = '11111111-1111-4111-8111-111111111111';

function makeSvc(db) {
  return new PillarService(
    new PillarRepository(db),
    new IntegrityService(db),
    new AuditService(new AuditRepository(db))
  );
}

function makeRow(over = {}) {
  return {
    id: 'pillar_default',
    brandId: BRAND_ID,
    name: 'Default',
    slug: 'default',
    description: 'desc',
    targetAudience: null,
    priority: 0,
    isActive: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...over,
  };
}

function actor(roles = ['owner']) {
  return { id: 'u1', role: roles.join(',') };
}

function importRoute() {
  return import('../dist/routes/pillar.js');
}

test('PillarService.list returns paginated items with boolean isActive', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.pillars.set('p1', makeRow({ id: 'p1', slug: 'a', priority: 1, isActive: 1, createdAt: '2024-01-02T00:00:00.000Z' }));
  rows.pillars.set('p2', makeRow({ id: 'p2', slug: 'b', priority: 2, isActive: 0, createdAt: '2024-01-01T00:00:00.000Z' }));

  const res = await makeSvc(db).list(BRAND_ID, { page: 1, pageSize: 10 });
  assert.strictEqual(res.items.length, 2);
  assert.strictEqual(res.items[0].id, 'p2');
  assert.strictEqual(typeof res.items[0].isActive, 'boolean');
  assert.strictEqual(res.items[0].isActive, false);
  assert.strictEqual(res.items[1].isActive, true);
  assert.strictEqual(res.pagination.total, 2);
  assert.strictEqual(res.pagination.hasNext, false);
});

test('PillarService.list respects isActive filter and pagination hasNext', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  for (let i = 0; i < 5; i++) {
    rows.pillars.set(
      `p${i}`,
      makeRow({ id: `p${i}`, slug: `s${i}`, isActive: i % 2 === 0 ? 1 : 0, createdAt: `2024-01-0${i + 1}T00:00:00.000Z`, priority: i })
    );
  }
  const res = await makeSvc(db).list(BRAND_ID, { page: 1, pageSize: 2, isActive: true });
  assert.strictEqual(res.items.length, 2);
  assert.strictEqual(res.pagination.total, 3);
  assert.strictEqual(res.pagination.hasNext, true);
  for (const it of res.items) assert.strictEqual(it.isActive, true);
});

test('PillarService.create success: slug -> id, defaults isActive=true priority=0, audits', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const result = await makeSvc(db).create(
    { brandId: BRAND_ID, name: '  Wellness  ', slug: 'wellness_tips', description: 'Tips for wellness' },
    actor(['owner'])
  );

  assert.strictEqual(result.id, 'pillar_wellness_tips');
  assert.strictEqual(result.isActive, true);
  assert.strictEqual(result.priority, 0);
  assert.strictEqual(result.name, 'Wellness');

  const auditInsert = calls.find((c) => c.kind === 'audit');
  assert.ok(auditInsert, 'audit row was inserted');
  assert.strictEqual(auditInsert.args[3], 'pillar.create');
  assert.strictEqual(auditInsert.args[5], 'pillar_wellness_tips');
});

test('PillarService.create rejects duplicate slug within same brand', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.pillars.set('pillar_wellness', makeRow({ id: 'pillar_wellness', slug: 'wellness' }));
  await assert.rejects(
    () => makeSvc(db).create({ brandId: BRAND_ID, name: 'Dup', slug: 'wellness', description: 'd' }, actor(['owner'])),
    (err) => err.code === errorCodes.VALIDATION_ERROR
  );
});

test('PillarService.create rejects invalid slug format', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  await assert.rejects(
    () => makeSvc(db).create({ brandId: BRAND_ID, name: 'X', slug: 'Bad-Slug!', description: 'd' }, actor(['owner'])),
    (err) => err.code === errorCodes.VALIDATION_ERROR
  );
});

test('PillarService.create fails if brand does not exist', async () => {
  const { db } = makeFakeDb();
  await assert.rejects(
    () => makeSvc(db).create({ brandId: '22222222-2222-4222-8222-222222222222', name: 'X', slug: 'foo', description: 'd' }, actor(['owner'])),
    (err) => err.code === errorCodes.NOT_FOUND
  );
});

test('PillarService.update success: applies fields, ignores slug, audits', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.pillars.set('pillar_x', makeRow({ id: 'pillar_x', slug: 'x', name: 'Old', priority: 0 }));
  const result = await makeSvc(db).update(
    'pillar_x',
    { name: 'New', priority: 5, isActive: false, slug: 'should_be_ignored' },
    actor(['owner'])
  );

  assert.strictEqual(result.name, 'New');
  assert.strictEqual(result.priority, 5);
  assert.strictEqual(result.isActive, false);
  assert.strictEqual(rows.pillars.get('pillar_x').slug, 'x');

  const auditInsert = calls.find((c) => c.kind === 'audit');
  assert.ok(auditInsert);
  assert.strictEqual(auditInsert.args[3], 'pillar.update');
});

test('PillarService.update 404 when pillar missing', async () => {
  const { db } = makeFakeDb();
  await assert.rejects(
    () => makeSvc(db).update('missing', { name: 'X' }, actor(['owner'])),
    (err) => err.code === errorCodes.NOT_FOUND
  );
});

const HEADERS = {
  'x-content-user-id': 'u1',
  'x-content-user-roles': 'viewer',
  'content-type': 'application/json',
};

test('GET / returns 200 with items + pagination for viewer', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  rows.pillars.set('p1', makeRow({ id: 'p1', slug: 'a' }));
  const { pillarRouter } = await importRoute();
  const res = await pillarRouter.request(`/?brandId=${BRAND_ID}&page=1&pageSize=10`, { headers: HEADERS }, { DB: db, ENVIRONMENT: 'test' });
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.items.length, 1);
  assert.strictEqual(typeof body.data.items[0].isActive, 'boolean');
  assert.strictEqual(body.data.pagination.total, 1);
});

test('GET / rejects missing/invalid brandId', async () => {
  const { db } = makeFakeDb();
  const { pillarRouter } = await importRoute();
  const res = await pillarRouter.request('/', { headers: HEADERS }, { DB: db, ENVIRONMENT: 'test' });
  assert.strictEqual(res.status, 400);
});

test('POST / returns 201 on create for marketingAdmin', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const { pillarRouter } = await importRoute();
  const res = await pillarRouter.request(
    '/',
    {
      method: 'POST',
      headers: { ...HEADERS, 'x-content-user-roles': 'marketingAdmin' },
      body: JSON.stringify({ brandId: BRAND_ID, name: 'Tips', slug: 'tips', description: 'd' }),
    },
    { DB: db, ENVIRONMENT: 'test' }
  );
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.data.id, 'pillar_tips');
});

test('POST / returns 403 for viewer', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set(BRAND_ID, { id: BRAND_ID });
  const { pillarRouter } = await importRoute();
  const res = await pillarRouter.request(
    '/',
    {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ brandId: BRAND_ID, name: 'Tips', slug: 'tips', description: 'd' }),
    },
    { DB: db, ENVIRONMENT: 'test' }
  );
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.error.code, errorCodes.FORBIDDEN);
});

test('PATCH /:id returns 200 on update', async () => {
  const { db, rows } = makeFakeDb();
  rows.pillars.set('pillar_x', makeRow({ id: 'pillar_x', slug: 'x' }));
  const { pillarRouter } = await importRoute();
  const res = await pillarRouter.request(
    '/pillar_x',
    {
      method: 'PATCH',
      headers: { ...HEADERS, 'x-content-user-roles': 'owner' },
      body: JSON.stringify({ name: 'Renamed' }),
    },
    { DB: db, ENVIRONMENT: 'test' }
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.name, 'Renamed');
});

test('PATCH /:id returns 404 when missing', async () => {
  const { db } = makeFakeDb();
  const { pillarRouter } = await importRoute();
  const res = await pillarRouter.request(
    '/missing',
    {
      method: 'PATCH',
      headers: { ...HEADERS, 'x-content-user-roles': 'owner' },
      body: JSON.stringify({ name: 'X' }),
    },
    { DB: db, ENVIRONMENT: 'test' }
  );
  assert.strictEqual(res.status, 404);
});
