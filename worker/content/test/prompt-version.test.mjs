import { test } from 'node:test';
import assert from 'node:assert';
import { promptVersionRouter } from '../dist/routes/prompt-version.js';
import { PromptVersionService } from '../dist/services/prompt-version.js';
import { PromptVersionRepository } from '../dist/repositories/prompt-version.js';
import { AuditService, AuditRepository } from '../dist/services/audit.js';
import { errorCodes } from '../dist/utils/errors.js';
import { makeFakeDb } from './fake-db.mjs';

function makeSvc(db) {
  return new PromptVersionService({
    repo: new PromptVersionRepository(db),
    audit: new AuditService(new AuditRepository(db)),
  });
}

function makeEnv(db) {
  return { DB: db, ENVIRONMENT: 'local' };
}

function makeHeaders({ id = 'user-1', roles = 'aiConfigAdmin' } = {}) {
  return {
    'x-content-user-id': id,
    'x-content-user-roles': roles,
    'content-type': 'application/json',
  };
}

function promptRow(over = {}) {
  return {
    id: 'prompt_idea_generation_v1_aaaaaaaa',
    promptKey: 'idea_generation',
    version: 1,
    promptText: 'Generate 3 ideas',
    modelRole: 'system',
    isActive: 0,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const ACTOR = { id: 'user-1', role: 'aiConfigAdmin' };

test('create persists a new prompt version and audits', async () => {
  const { db, calls } = makeFakeDb();
  const res = await promptVersionRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        promptKey: 'idea_generation',
        version: 1,
        promptText: 'Generate 3 ideas',
        modelRole: 'system',
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.promptKey, 'idea_generation');
  assert.strictEqual(body.data.version, 1);
  assert.strictEqual(body.data.isActive, false);
  assert.match(body.data.id, /^prompt_idea_generation_v1_/);

  const audit = calls.find((c) => c.kind === 'audit');
  assert.ok(audit);
  assert.strictEqual(audit.args[3], 'promptVersion.create');
});

test('create rejects duplicate version per key', async () => {
  const { db, rows } = makeFakeDb();
  rows.aiPromptVersions.set('existing', promptRow({ id: 'existing' }));
  const res = await promptVersionRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        promptKey: 'idea_generation',
        version: 1,
        promptText: 'Other text',
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error.code, errorCodes.VALIDATION_ERROR);
  assert.match(body.error.message, /already exists/);
});

test('create rejects unknown promptKey', async () => {
  const { db } = makeFakeDb();
  const res = await promptVersionRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ promptKey: 'unknown_key', version: 1, promptText: 't' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
});

test('create rejects version < 1', async () => {
  const { db } = makeFakeDb();
  const res = await promptVersionRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ promptKey: 'idea_generation', version: 0, promptText: 't' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
});

test('activate flips isActive and deactivates others for same key', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.aiPromptVersions.set('p1', promptRow({ id: 'p1', version: 1, isActive: 1 }));
  rows.aiPromptVersions.set('p2', promptRow({ id: 'p2', version: 2, isActive: 0 }));
  rows.aiPromptVersions.set('p3', promptRow({ id: 'p3', version: 3, isActive: 0 }));

  const res = await promptVersionRouter.request(
    '/p3/activate',
    { method: 'POST', headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.id, 'p3');
  assert.strictEqual(body.data.isActive, true);

  assert.strictEqual(rows.aiPromptVersions.get('p1').isActive, 0);
  assert.strictEqual(rows.aiPromptVersions.get('p2').isActive, 0);
  assert.strictEqual(rows.aiPromptVersions.get('p3').isActive, 1);

  const audit = calls.filter((c) => c.kind === 'audit').pop();
  assert.strictEqual(audit.args[3], 'promptVersion.activate');
});

test('activate keeps already-active row idempotent (no audit duplicate noise)', async () => {
  const { db, rows, calls } = makeFakeDb();
  rows.aiPromptVersions.set('p1', promptRow({ id: 'p1', isActive: 1 }));
  const before = calls.filter((c) => c.kind === 'audit').length;
  const res = await promptVersionRouter.request(
    '/p1/activate',
    { method: 'POST', headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.isActive, true);
  const after = calls.filter((c) => c.kind === 'audit').length;
  assert.strictEqual(after, before, 'no audit log when already active');
});

test('activate returns 404 for unknown id', async () => {
  const { db } = makeFakeDb();
  const res = await promptVersionRouter.request(
    '/missing/activate',
    { method: 'POST', headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 404);
});

test('list filters by promptKey and returns versions desc', async () => {
  const { db, rows } = makeFakeDb();
  rows.aiPromptVersions.set('p1', promptRow({ id: 'p1', version: 1 }));
  rows.aiPromptVersions.set('p2', promptRow({ id: 'p2', version: 2 }));
  rows.aiPromptVersions.set('p3', promptRow({ id: 'p3', version: 3 }));
  const res = await promptVersionRouter.request(
    '/?promptKey=idea_generation',
    { headers: makeHeaders() },
    makeEnv(db)
  );
  const body = await res.json();
  assert.strictEqual(body.data.items.length, 3);
  assert.strictEqual(body.data.items[0].version, 3);
});

test('list rejects invalid promptKey', async () => {
  const { db } = makeFakeDb();
  const res = await promptVersionRouter.request(
    '/?promptKey=garbage',
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
});

test('permission denied for viewer', async () => {
  const { db, calls } = makeFakeDb();
  const res = await promptVersionRouter.request(
    '/',
    {
      method: 'POST',
      headers: makeHeaders({ roles: 'viewer' }),
      body: JSON.stringify({ promptKey: 'idea_generation', version: 1, promptText: 't' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 403);
  assert.strictEqual(calls.find((c) => c.kind === 'insert_prompt_version'), undefined);
});

test('source_reference_prompt and fallback_rewrite_prompt are rejected per CE-1 PRD', async () => {
  const { db } = makeFakeDb();
  for (const promptKey of ['source_reference_prompt', 'fallback_rewrite_prompt']) {
    const res = await promptVersionRouter.request(
      '/',
      {
        method: 'POST',
        headers: makeHeaders(),
        body: JSON.stringify({ promptKey, version: 1, promptText: 't' }),
      },
      makeEnv(db)
    );
    assert.strictEqual(res.status, 400, `${promptKey} should be rejected`);
    const body = await res.json();
    assert.strictEqual(body.error.code, errorCodes.VALIDATION_ERROR);
  }
});
