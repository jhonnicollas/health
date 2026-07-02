import { test } from 'node:test';
import assert from 'node:assert';
import { redact, REDACTED_KEYS } from '../dist/utils/redact.js';

test('redacts top-level secret key', () => {
  const out = redact({ api_key: 'sk-123', name: 'foo' });
  assert.deepStrictEqual(out, { api_key: '[REDACTED]', name: 'foo' });
});

test('redacts nested secret key', () => {
  const out = redact({ user: { password: 'hunter2', name: 'alice' } });
  assert.deepStrictEqual(out, { user: { password: '[REDACTED]', name: 'alice' } });
});

test('redacts secret keys inside arrays of objects', () => {
  const out = redact({ items: [{ token: 'abc' }, { token: 'def' }, { name: 'x' }] });
  assert.deepStrictEqual(out, {
    items: [{ token: '[REDACTED]' }, { token: '[REDACTED]' }, { name: 'x' }],
  });
});

test('case-insensitive key matching', () => {
  const out = redact({ API_KEY: 'a', Password: 'b', Authorization: 'c', SECRET: 'd' });
  assert.deepStrictEqual(out, {
    API_KEY: '[REDACTED]',
    Password: '[REDACTED]',
    Authorization: '[REDACTED]',
    SECRET: '[REDACTED]',
  });
});

test('leaves normal keys intact and recurses into nested objects', () => {
  const out = redact({ a: 1, b: 'two', c: [1, 2, { d: true, e: { f: 'hi' } }] });
  assert.deepStrictEqual(out, { a: 1, b: 'two', c: [1, 2, { d: true, e: { f: 'hi' } }] });
});

test('returns null for null input', () => {
  assert.strictEqual(redact(null), null);
});

test('returns primitives unchanged', () => {
  assert.strictEqual(redact(42), 42);
  assert.strictEqual(redact('hello'), 'hello');
  assert.strictEqual(redact(true), true);
  assert.strictEqual(redact(undefined), undefined);
});

test('does not recurse into redacted object/array values', () => {
  const out = redact({
    api_key: { nested: 'still-secret', password: 'also-secret' },
    secret: ['a', 'b', 'c'],
  });
  assert.strictEqual(out.api_key, '[REDACTED]');
  assert.strictEqual(out.secret, '[REDACTED]');
});

test('does not mutate input', () => {
  const input = { a: { password: 'x' }, list: [{ token: 't' }] };
  const before = JSON.stringify(input);
  redact(input);
  assert.strictEqual(JSON.stringify(input), before);
});

test('REDACTED_KEYS set contains expected entries', () => {
  for (const k of [
    'authorization',
    'access_token',
    'refresh_token',
    'api_key',
    'secret',
    'password',
    'token',
    'client_secret',
    'webhook_secret',
    'cookie',
    'session',
  ]) {
    assert.ok(REDACTED_KEYS.has(k), `missing ${k}`);
  }
});
