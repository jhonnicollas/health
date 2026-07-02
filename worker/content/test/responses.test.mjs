import { test } from 'node:test';
import assert from 'node:assert';
import {
  success,
  fail,
  notFound,
  unauthorized,
  forbidden,
} from '../dist/utils/responses.js';
import { errorCodes } from '../dist/utils/errors.js';

function fakeContext() {
  const calls = [];
  const c = {
    json(body, status) {
      const captured = { body, status };
      calls.push(captured);
      return captured;
    },
    _calls: calls,
  };
  return c;
}

test('success returns { ok: true, data } with status 200', () => {
  const c = fakeContext();
  const data = { id: 1, name: 'hello' };
  const res = success(c, data);

  assert.strictEqual(res.body.ok, true);
  assert.strictEqual(res.body.data, data);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(c._calls.length, 1);
});

test('success honours custom status', () => {
  const c = fakeContext();
  const res = success(c, { ok: 1 }, 201);
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.ok, true);
});

test('fail returns { ok: false, error: { code, message } }', () => {
  const c = fakeContext();
  const res = fail(c, 'BAD_THING', 'it broke', 400);

  assert.strictEqual(res.body.ok, false);
  assert.deepStrictEqual(res.body.error, { code: 'BAD_THING', message: 'it broke' });
  assert.strictEqual(res.status, 400);
});

test('notFound returns NOT_FOUND 404', () => {
  const c = fakeContext();
  const res = notFound(c);

  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.ok, false);
  assert.strictEqual(res.body.error.code, errorCodes.NOT_FOUND);
  assert.strictEqual(res.body.error.message, 'Resource not found');
});

test('unauthorized returns UNAUTHORIZED 401', () => {
  const c = fakeContext();
  const res = unauthorized(c);

  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.body.error.code, errorCodes.UNAUTHORIZED);
  assert.strictEqual(res.body.error.message, 'Unauthorized');
});

test('forbidden returns FORBIDDEN 403', () => {
  const c = fakeContext();
  const res = forbidden(c);

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.body.error.code, errorCodes.FORBIDDEN);
  assert.strictEqual(res.body.error.message, 'Forbidden');
});
