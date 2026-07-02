import { test } from 'node:test';
import assert from 'node:assert';
import { CampaignService } from '../dist/services/campaign.js';
import { CampaignRepository } from '../dist/repositories/campaign.js';
import { IntegrityService } from '../dist/services/integrity.js';
import { AuditService, AuditRepository } from '../dist/services/audit.js';
import { errorCodes } from '../dist/utils/errors.js';
import { makeFakeDb } from './fake-db.mjs';

function makeSvc(db) {
  return new CampaignService({
    repo: new CampaignRepository(db),
    integrity: new IntegrityService(db),
    audit: new AuditService(new AuditRepository(db)),
  });
}

const ACTOR = { id: 'user-1', role: 'owner' };

function campaignRow(over = {}) {
  return {
    id: 'campaign_a_aaaaaaaa',
    brandId: 'brand-1',
    name: 'A',
    objective: '',
    targetPlatformsJson: '["instagram"]',
    pillarIdsJson: '["pillar-1"]',
    targetAudience: null,
    language: 'id',
    startDate: null,
    endDate: null,
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

test('list returns paginated campaigns for a brand', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  rows.campaigns.set('campaign_a_aaaaaaaa', campaignRow());
  const svc = makeSvc(db);
  const result = await svc.list('brand-1', { page: 1, pageSize: 20 });
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.pagination.total, 1);
  assert.strictEqual(result.pagination.hasNext, false);
});

test('list filters by status', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.campaigns.set('campaign_a_aaaaaaaa', campaignRow({ status: 'draft' }));
  rows.campaigns.set('campaign_b_bbbbbbbb', campaignRow({
    id: 'campaign_b_bbbbbbbb',
    name: 'B',
    status: 'archived',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  }));
  const svc = makeSvc(db);
  const result = await svc.list('brand-1', { status: 'archived' });
  assert.strictEqual(result.items.length, 1);
  assert.strictEqual(result.items[0].status, 'archived');
  assert.strictEqual(result.pagination.total, 1);
});

test('create persists row, generates id, audits', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  const svc = makeSvc(db);
  const row = await svc.create({
    brandId: 'brand-1',
    name: 'Spring Push',
    objective: 'Grow followers',
    targetPlatformsJson: ['instagram', 'linkedin'],
    pillarIdsJson: ['pillar-1'],
    language: 'id',
  }, ACTOR);
  assert.match(row.id, /^campaign_spring_push_[a-f0-9]{8}$/);
  assert.strictEqual(row.objective, 'Grow followers');
  assert.deepStrictEqual(JSON.parse(row.targetPlatformsJson), ['instagram', 'linkedin']);
  assert.strictEqual(row.status, 'draft');
  assert.strictEqual(rows.campaigns.get(row.id).name, 'Spring Push');
  const auditInsert = calls.find((c) => /INSERT INTO conAuditLogs/.test(c.sql));
  assert.ok(auditInsert);
  assert.strictEqual(auditInsert.args[3], 'campaign.create');
  assert.strictEqual(auditInsert.args[5], row.id);
});

test('create defaults objective to empty string', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  const svc = makeSvc(db);
  const row = await svc.create({
    brandId: 'brand-1',
    name: 'No Objective',
    targetPlatformsJson: ['instagram'],
    pillarIdsJson: ['pillar-1'],
  }, ACTOR);
  assert.strictEqual(row.objective, '');
});

test('create rejects invalid platform (tiktok)', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  const svc = makeSvc(db);
  await assert.rejects(
    svc.create({
      brandId: 'brand-1',
      name: 'X',
      targetPlatformsJson: ['tiktok'],
      pillarIdsJson: ['pillar-1'],
    }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /invalid platform/i.test(e.message)
  );
});

test('create rejects non-array targetPlatformsJson', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  const svc = makeSvc(db);
  await assert.rejects(
    svc.create({
      brandId: 'brand-1',
      name: 'X',
      targetPlatformsJson: 'instagram',
      pillarIdsJson: ['pillar-1'],
    }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /array/i.test(e.message)
  );
});

test('create rejects inactive pillar', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  // pillar-1 intentionally absent -> pillarExistsAndActive returns false
  const svc = makeSvc(db);
  await assert.rejects(
    svc.create({
      brandId: 'brand-1',
      name: 'X',
      targetPlatformsJson: ['instagram'],
      pillarIdsJson: ['pillar-missing'],
    }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /pillar/i.test(e.message)
  );
});

test('create rejects unknown brand', async () => {
  const { db } = makeFakeDb();
  const svc = makeSvc(db);
  await assert.rejects(
    svc.create({
      brandId: 'brand-missing',
      name: 'X',
      targetPlatformsJson: ['instagram'],
      pillarIdsJson: ['pillar-1'],
    }, ACTOR),
    (e) => e.code === errorCodes.NOT_FOUND
  );
});

test('create rejects endDate < startDate', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  const svc = makeSvc(db);
  await assert.rejects(
    svc.create({
      brandId: 'brand-1',
      name: 'X',
      targetPlatformsJson: ['instagram'],
      pillarIdsJson: ['pillar-1'],
      startDate: '2026-03-01',
      endDate: '2026-02-01',
    }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /endDate/i.test(e.message)
  );
});

test('create rejects invalid language enum', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  const svc = makeSvc(db);
  await assert.rejects(
    svc.create({
      brandId: 'brand-1',
      name: 'X',
      targetPlatformsJson: ['instagram'],
      pillarIdsJson: ['pillar-1'],
      language: 'jp',
    }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR
  );
});

test('update archives a campaign', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.pillars.set('pillar-1', { id: 'pillar-1', brandId: 'brand-1', isActive: 1 });
  rows.campaigns.set('campaign_a_aaaaaaaa', campaignRow({ status: 'active' }));
  const svc = makeSvc(db);

  const updated = await svc.update('campaign_a_aaaaaaaa', { status: 'archived' }, ACTOR);
  assert.strictEqual(updated.status, 'archived');
  assert.strictEqual(rows.campaigns.get('campaign_a_aaaaaaaa').status, 'archived');
});

test('update rejects status outside enum', async () => {
  const { db, rows } = makeFakeDb();
  rows.brands.set('brand-1', { id: 'brand-1' });
  rows.campaigns.set('campaign_a_aaaaaaaa', campaignRow());
  const svc = makeSvc(db);
  await assert.rejects(
    svc.update('campaign_a_aaaaaaaa', { status: 'unknown' }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR
  );
});
