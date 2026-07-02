import { test } from 'node:test';
import assert from 'node:assert';
import {
  mockAuthResolver,
  headerMockAuthResolver,
  createAuthMiddleware,
} from '../dist/middleware/auth.js';
import { errorCodes } from '../dist/utils/errors.js';

function makeContext({ env, headers = {} } = {}) {
  const store = {};
  const calls = [];
  const c = {
    env,
    req: {
      header(name) {
        return headers[name.toLowerCase()];
      },
    },
    get(key) {
      return store[key];
    },
    set(key, value) {
      store[key] = value;
    },
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

test('createAuthMiddleware sets user and calls next when resolver returns a user', async () => {
  const user = { id: 'u1', roles: ['owner'] };
  const mw = createAuthMiddleware(mockAuthResolver(user));
  const c = makeContext();
  let nextCalled = false;
  await mw(c, async () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(c._store.user, user);
  assert.strictEqual(c._calls.length, 0);
});

test('createAuthMiddleware returns 401 UNAUTHORIZED when resolver returns null', async () => {
  const mw = createAuthMiddleware(mockAuthResolver(null));
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

test('createAuthMiddleware returns 401 when resolver returns undefined', async () => {
  const mw = createAuthMiddleware(mockAuthResolver(undefined));
  const c = makeContext();
  await mw(c, async () => {});
  assert.strictEqual(c._calls.length, 1);
  assert.strictEqual(c._calls[0].status, 401);
});

test('headerMockAuthResolver resolves user from headers in local env', async () => {
  const c = makeContext({
    env: { ENVIRONMENT: 'local' },
    headers: {
      'x-content-user-id': 'u1',
      'x-content-user-roles': 'owner, marketingAdmin',
    },
  });
  const user = await headerMockAuthResolver(c);
  assert.deepStrictEqual(user, { id: 'u1', roles: ['owner', 'marketingAdmin'] });
});

test('headerMockAuthResolver filters out unknown roles', async () => {
  const c = makeContext({
    env: { ENVIRONMENT: 'local' },
    headers: {
      'x-content-user-id': 'u1',
      'x-content-user-roles': 'owner, wizard, designer',
    },
  });
  const user = await headerMockAuthResolver(c);
  assert.deepStrictEqual(user, { id: 'u1', roles: ['owner', 'designer'] });
});

test('headerMockAuthResolver returns null when x-content-user-id is missing in local env', async () => {
  const c = makeContext({
    env: { ENVIRONMENT: 'local' },
    headers: { 'x-content-user-roles': 'owner' },
  });
  const user = await headerMockAuthResolver(c);
  assert.strictEqual(user, null);
});

test('headerMockAuthResolver returns null in production env even with headers', async () => {
  const c = makeContext({
    env: { ENVIRONMENT: 'production' },
    headers: {
      'x-content-user-id': 'u1',
      'x-content-user-roles': 'owner',
    },
  });
  const user = await headerMockAuthResolver(c);
  assert.strictEqual(user, null);
});

test('headerMockAuthResolver returns null when env is missing', async () => {
  const c = makeContext({
    headers: {
      'x-content-user-id': 'u1',
      'x-content-user-roles': 'owner',
    },
  });
  const user = await headerMockAuthResolver(c);
  assert.strictEqual(user, null);
});

test('headerMockAuthResolver allows test env', async () => {
  const c = makeContext({
    env: { ENVIRONMENT: 'test' },
    headers: {
      'x-content-user-id': 'u1',
      'x-content-user-roles': 'viewer',
    },
  });
  const user = await headerMockAuthResolver(c);
  assert.deepStrictEqual(user, { id: 'u1', roles: ['viewer'] });
});

test('headerMockAuthResolver returns user with empty roles when header missing in local', async () => {
  const c = makeContext({
    env: { ENVIRONMENT: 'local' },
    headers: { 'x-content-user-id': 'u1' },
  });
  const user = await headerMockAuthResolver(c);
  assert.deepStrictEqual(user, { id: 'u1', roles: [] });
});
