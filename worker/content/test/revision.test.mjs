import { test } from 'node:test';
import assert from 'node:assert';
import { RevisionRepository } from '../dist/repositories/revision.js';
import { draftRouter } from '../dist/routes/draft.js';
import { makeFakeDb } from './fake-db.mjs';

function makeHeaders({ id = 'user-1', roles = 'owner' } = {}) {
  return {
    'x-content-user-id': id,
    'x-content-user-roles': roles,
    'content-type': 'application/json',
  };
}

function makeEnv(db, envName = 'local') {
  return { DB: db, ENVIRONMENT: envName };
}

function revisionRow(over = {}) {
  return {
    id: 'revision_aaaaaaaaaaaa',
    draftId: 'draft_001',
    revisionNumber: 1,
    snapshotJson: '{"primaryHook":"hook"}',
    contentHash: 'hash1',
    changeReason: 'Initial generation',
    changedBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

test('RevisionRepository.findByDraft returns revisions ordered by revisionNumber ASC', async () => {
  const { db, rows } = makeFakeDb();
  rows.drafts.set('draft_001', { id: 'draft_001', brandId: 'brand-1' });
  rows.revisions.set('r1', revisionRow({ id: 'r1', revisionNumber: 2 }));
  rows.revisions.set('r2', revisionRow({ id: 'r2', revisionNumber: 3 }));
  rows.revisions.set('r3', revisionRow({ id: 'r3', revisionNumber: 1 }));
  const repo = new RevisionRepository(db);
  const list = await repo.findByDraft('draft_001');
  assert.strictEqual(list.length, 3);
  assert.deepStrictEqual(list.map((r) => r.revisionNumber), [1, 2, 3]);
});

test('RevisionRepository.findByDraft returns empty list when no revisions exist', async () => {
  const { db } = makeFakeDb();
  const repo = new RevisionRepository(db);
  const list = await repo.findByDraft('draft_empty');
  assert.deepStrictEqual(list, []);
});

test('RevisionRepository.findByDraft returns only revisions for the requested draft', async () => {
  const { db, rows } = makeFakeDb();
  rows.revisions.set('r1', revisionRow({ id: 'r1', draftId: 'draft_A', revisionNumber: 1 }));
  rows.revisions.set('r2', revisionRow({ id: 'r2', draftId: 'draft_B', revisionNumber: 1 }));
  rows.revisions.set('r3', revisionRow({ id: 'r3', draftId: 'draft_A', revisionNumber: 2 }));
  const repo = new RevisionRepository(db);
  const list = await repo.findByDraft('draft_A');
  assert.strictEqual(list.length, 2);
  assert.deepStrictEqual(list.map((r) => r.revisionNumber), [1, 2]);
  assert.ok(list.every((r) => r.draftId === 'draft_A'));
});

test('RevisionRepository.create inserts a row with all fields', async () => {
  const { db, rows } = makeFakeDb();
  const repo = new RevisionRepository(db);
  const row = revisionRow({ id: 'revision_new', revisionNumber: 5 });
  const inserted = await repo.create(row);
  assert.deepStrictEqual(inserted, row);
  const stored = rows.revisions.get('revision_new');
  assert.ok(stored);
  assert.strictEqual(stored.draftId, 'draft_001');
  assert.strictEqual(stored.revisionNumber, 5);
  assert.strictEqual(stored.contentHash, 'hash1');
  assert.strictEqual(stored.changeReason, 'Initial generation');
  assert.strictEqual(stored.changedBy, 'user-1');
});

test('RevisionRepository.findByDraftAndNumber returns the matching revision', async () => {
  const { db, rows } = makeFakeDb();
  rows.revisions.set('r1', revisionRow({ id: 'r1', revisionNumber: 1 }));
  rows.revisions.set('r2', revisionRow({ id: 'r2', revisionNumber: 2 }));
  const repo = new RevisionRepository(db);
  const row = await repo.findByDraftAndNumber('draft_001', 2);
  assert.ok(row);
  assert.strictEqual(row.id, 'r2');
});

test('RevisionRepository.findByDraftAndNumber returns null when missing', async () => {
  const { db } = makeFakeDb();
  const repo = new RevisionRepository(db);
  const row = await repo.findByDraftAndNumber('draft_missing', 1);
  assert.strictEqual(row, null);
});

test('Route GET /drafts/:id/revisions returns the revision list', async () => {
  const { db, rows } = makeFakeDb();
  rows.drafts.set('draft_001', { id: 'draft_001', brandId: 'brand-1' });
  rows.revisions.set('r1', revisionRow({ id: 'r1', revisionNumber: 1 }));
  rows.revisions.set('r2', revisionRow({ id: 'r2', revisionNumber: 2 }));
  const res = await draftRouter.request(
    '/draft_001/revisions',
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.items.length, 2);
  assert.deepStrictEqual(
    body.data.items.map((r) => r.revisionNumber),
    [1, 2]
  );
});

test('Route GET /drafts/:id/revisions returns empty list when draft has no revisions', async () => {
  const { db } = makeFakeDb();
  const res = await draftRouter.request(
    '/draft_empty/revisions',
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.deepStrictEqual(body.data.items, []);
});
