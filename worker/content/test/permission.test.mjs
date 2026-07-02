import { test } from 'node:test';
import assert from 'node:assert';
import {
  getPermissionsForRoles,
  hasPermission,
  requirePermission,
} from '../dist/middleware/permission.js';
import { errorCodes } from '../dist/utils/errors.js';

function makeContext() {
  const store = {};
  const calls = [];
  const c = {
    env: {},
    req: { header() { return undefined; } },
    get(key) { return store[key]; },
    set(key, value) { store[key] = value; },
    json(body, status) {
      const captured = { body, status };
      calls.push(captured);
      return captured;
    },
    _calls: calls,
    _store: store,
  };
  return c;
}

test('viewer only has read permissions', () => {
  const perms = getPermissionsForRoles(['viewer']);
  assert.ok(perms.has('content.dashboard.read'));
  assert.ok(perms.has('content.brand.read'));
  assert.ok(perms.has('content.pillar.read'));
  assert.ok(perms.has('content.campaign.read'));
  assert.ok(perms.has('content.idea.read'));
  assert.ok(perms.has('content.draft.read'));
  assert.ok(perms.has('content.revision.read'));
  assert.ok(!perms.has('content.draft.update'));
  assert.ok(!perms.has('content.campaign.create'));
  assert.ok(!perms.has('content.approve'));
  assert.ok(!perms.has('content.aiConfig.manage'));
});

test('marketingAdmin includes content.draft.update', () => {
  const perms = getPermissionsForRoles(['marketingAdmin']);
  assert.ok(perms.has('content.draft.update'));
  assert.ok(perms.has('content.campaign.create'));
  assert.ok(perms.has('content.approve'));
});

test('medicalReviewer does NOT include content.draft.update', () => {
  const perms = getPermissionsForRoles(['medicalReviewer']);
  assert.ok(!perms.has('content.draft.update'));
  assert.ok(!perms.has('content.campaign.create'));
  assert.ok(perms.has('content.safety.review'));
  assert.ok(perms.has('content.approve'));
  assert.ok(perms.has('content.draft.export'));
});

test('owner includes all permissions including audit and aiConfig', () => {
  const perms = getPermissionsForRoles(['owner']);
  assert.ok(perms.has('content.audit.read'));
  assert.ok(perms.has('content.aiConfig.manage'));
  assert.ok(perms.has('content.quota.manage'));
  assert.ok(perms.has('content.brand.update'));
  assert.ok(perms.has('content.draft.update'));
});

test('hasPermission returns true when role grants permission', () => {
  const user = { id: 'u', roles: ['marketingAdmin'] };
  assert.strictEqual(hasPermission(user, 'content.draft.update'), true);
});

test('hasPermission returns false when role lacks permission', () => {
  const user = { id: 'u', roles: ['viewer'] };
  assert.strictEqual(hasPermission(user, 'content.draft.update'), false);
});

test('hasPermission honors explicit user.permissions override', () => {
  const user = { id: 'u', roles: ['viewer'], permissions: ['content.draft.update'] };
  assert.strictEqual(hasPermission(user, 'content.draft.update'), true);
});

test('getPermissionsForRoles merges across multiple roles', () => {
  const perms = getPermissionsForRoles(['viewer', 'aiConfigAdmin']);
  assert.ok(perms.has('content.draft.read'));
  assert.ok(perms.has('content.aiConfig.manage'));
});

test('requirePermission allows owner and calls next', async () => {
  const mw = requirePermission('content.draft.update');
  const c = makeContext();
  c.set('user', { id: 'u1', roles: ['owner'] });
  let nextCalled = false;
  await mw(c, async () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(c._calls.length, 0);
});

test('requirePermission returns 403 FORBIDDEN for viewer', async () => {
  const mw = requirePermission('content.draft.update');
  const c = makeContext();
  c.set('user', { id: 'u1', roles: ['viewer'] });
  let nextCalled = false;
  await mw(c, async () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(c._calls.length, 1);
  assert.strictEqual(c._calls[0].status, 403);
  assert.strictEqual(c._calls[0].body.error.code, errorCodes.FORBIDDEN);
});

test('requirePermission returns 401 UNAUTHORIZED if no user set', async () => {
  const mw = requirePermission('content.draft.update');
  const c = makeContext();
  let nextCalled = false;
  await mw(c, async () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(c._calls.length, 1);
  assert.strictEqual(c._calls[0].status, 401);
  assert.strictEqual(c._calls[0].body.error.code, errorCodes.UNAUTHORIZED);
});
