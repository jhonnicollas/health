import { test } from 'node:test';
import assert from 'node:assert';
import { IntegrityService } from '../dist/services/integrity.js';

// Fake D1: returns a row when SQL+params match the configured table/conditions,
// otherwise null. Lets us assert the exact WHERE clauses each method emits.
function makeFakeDb(config) {
  // config: { brands: Set, campaigns: Map<id,brandId>, pillarsActive: Map<id,brandId>,
  //           ideasApproved: Map<id,brandId>, drafts: Map<id,brandId>,
  //           revisions: Map<draftId|rev, brandId> }
  const calls = [];
  const stmt = {
    bind(...args) {
      stmt.boundArgs = args;
      return stmt;
    },
    async first() {
      calls.push({ sql: stmt.sql, args: stmt.boundArgs });
      const sql = stmt.sql;
      const args = stmt.boundArgs;

      let m;
      m = sql.match(/FROM conBrands WHERE id = \?/);
      if (m) {
        return config.brands.has(args[0]) ? { one: 1 } : null;
      }

      m = sql.match(/FROM conCampaigns WHERE id = \? AND brandId = \?/);
      if (m) {
        const [id, brandId] = args;
        return config.campaigns.get(id) === brandId ? { one: 1 } : null;
      }

      m = sql.match(/FROM conPillars WHERE id = \? AND brandId = \? AND isActive = 1/);
      if (m) {
        const [id, brandId] = args;
        return config.pillarsActive.get(id) === brandId ? { one: 1 } : null;
      }

      m = sql.match(/FROM conIdeas WHERE id = \? AND brandId = \? AND status = 'idea_approved'/);
      if (m) {
        const [id, brandId] = args;
        return config.ideasApproved.get(id) === brandId ? { one: 1 } : null;
      }

      m = sql.match(/FROM conDrafts WHERE id = \? AND brandId = \?/);
      if (m) {
        const [id, brandId] = args;
        return config.drafts.get(id) === brandId ? { one: 1 } : null;
      }

      m = sql.match(/FROM conDraftRevisions WHERE draftId = \? AND brandId = \? AND revisionNumber = \?/);
      if (m) {
        const [draftId, brandId, revisionNumber] = args;
        const key = `${draftId}|${revisionNumber}`;
        return config.revisions.get(key) === brandId ? { one: 1 } : null;
      }

      return null;
    },
    async run() {
      return { success: true, meta: {} };
    },
    async all() {
      return { results: [], success: true, meta: {} };
    },
  };
  const db = {
    prepare(sql) {
      stmt.sql = sql;
      stmt.boundArgs = [];
      return stmt;
    },
  };
  return { db, calls };
}

test('brandExists returns true when brand is present', async () => {
  const { db } = makeFakeDb({ brands: new Set(['brand-1']) });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.brandExists('brand-1'), true);
});

test('brandExists returns false when brand is absent', async () => {
  const { db } = makeFakeDb({ brands: new Set() });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.brandExists('brand-missing'), false);
});

test('campaignExists true when id+brandId match', async () => {
  const { db } = makeFakeDb({
    campaigns: new Map([['camp-1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.campaignExists('brand-1', 'camp-1'), true);
});

test('campaignExists false when brandId does not match', async () => {
  const { db } = makeFakeDb({
    campaigns: new Map([['camp-1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.campaignExists('brand-2', 'camp-1'), false);
});

test('campaignExists false when id missing', async () => {
  const { db } = makeFakeDb({ campaigns: new Map() });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.campaignExists('brand-1', 'camp-missing'), false);
});

test('pillarExistsAndActive requires isActive = 1', async () => {
  const { db, calls } = makeFakeDb({
    pillarsActive: new Map([['pillar-1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.pillarExistsAndActive('brand-1', 'pillar-1'), true);
  // The fake never returns the row unless isActive = 1 is part of the SQL,
  // so a missing isActive check would already fail this test. Belt-and-braces:
  assert.match(calls[0].sql, /isActive = 1/);
});

test('pillarExistsAndActive false when not active', async () => {
  // pillar-1 belongs to brand-1 but is NOT in the active map -> returns null
  const { db } = makeFakeDb({ pillarsActive: new Map() });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.pillarExistsAndActive('brand-1', 'pillar-1'), false);
});

test('ideaExistsAndApproved requires status=idea_approved', async () => {
  const { db, calls } = makeFakeDb({
    ideasApproved: new Map([['idea-1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.ideaExistsAndApproved('brand-1', 'idea-1'), true);
  assert.match(calls[0].sql, /status = 'idea_approved'/);
});

test('ideaExistsAndApproved false when not approved', async () => {
  const { db } = makeFakeDb({ ideasApproved: new Map() });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.ideaExistsAndApproved('brand-1', 'idea-1'), false);
});

test('draftExists true when id+brandId match', async () => {
  const { db } = makeFakeDb({
    drafts: new Map([['draft-1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.draftExists('brand-1', 'draft-1'), true);
});

test('draftExists false when brandId mismatches', async () => {
  const { db } = makeFakeDb({
    drafts: new Map([['draft-1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.draftExists('brand-2', 'draft-1'), false);
});

test('revisionExists true when draftId+brandId+revisionNumber match', async () => {
  const { db } = makeFakeDb({
    revisions: new Map([['draft-1|2', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.revisionExists('brand-1', 'draft-1', 2), true);
});

test('revisionExists false when revisionNumber mismatches', async () => {
  const { db } = makeFakeDb({
    revisions: new Map([['draft-1|1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.revisionExists('brand-1', 'draft-1', 2), false);
});

test('revisionExists false when brandId mismatches', async () => {
  const { db } = makeFakeDb({
    revisions: new Map([['draft-1|1', 'brand-1']]),
  });
  const svc = new IntegrityService(db);
  assert.strictEqual(await svc.revisionExists('brand-2', 'draft-1', 1), false);
});
