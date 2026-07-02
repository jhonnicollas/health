import { test } from 'node:test';
import assert from 'node:assert';
import { AppError, errorCodes, fromError } from '../dist/utils/errors.js';

test('AppError stores code, message, and status', () => {
  const err = new AppError('CUSTOM_CODE', 'something broke', 418);
  assert.strictEqual(err.code, 'CUSTOM_CODE');
  assert.strictEqual(err.message, 'something broke');
  assert.strictEqual(err.status, 418);
  assert.strictEqual(err.name, 'AppError');
  assert.strictEqual(err.isOperational, true);
  assert.ok(err instanceof Error);
});

test('errorCodes exposes the expected string codes', () => {
  assert.strictEqual(errorCodes.NOT_FOUND, 'NOT_FOUND');
  assert.strictEqual(errorCodes.VALIDATION_ERROR, 'VALIDATION_ERROR');
  assert.strictEqual(errorCodes.UNAUTHORIZED, 'UNAUTHORIZED');
  assert.strictEqual(errorCodes.FORBIDDEN, 'FORBIDDEN');
  assert.strictEqual(errorCodes.INTERNAL_ERROR, 'INTERNAL_ERROR');
});

test('fromError passes through AppError fields', () => {
  const err = new AppError('X_CODE', 'x msg', 422);
  const out = fromError(err);
  assert.deepStrictEqual(out, { code: 'X_CODE', status: 422, message: 'x msg' });
});

test('fromError wraps generic Error as INTERNAL_ERROR 500', () => {
  const out = fromError(new Error('boom'));
  assert.strictEqual(out.code, errorCodes.INTERNAL_ERROR);
  assert.strictEqual(out.status, 500);
  assert.strictEqual(out.message, 'boom');
});

test('fromError handles string input', () => {
  const out = fromError('just a string');
  assert.strictEqual(out.code, errorCodes.INTERNAL_ERROR);
  assert.strictEqual(out.status, 500);
  assert.strictEqual(out.message, 'just a string');
});

test('fromError handles null and undefined', () => {
  const fromNull = fromError(null);
  assert.strictEqual(fromNull.code, errorCodes.INTERNAL_ERROR);
  assert.strictEqual(fromNull.status, 500);
  assert.strictEqual(fromNull.message, 'Unknown error');

  const fromUndef = fromError(undefined);
  assert.strictEqual(fromUndef.code, errorCodes.INTERNAL_ERROR);
  assert.strictEqual(fromUndef.status, 500);
  assert.strictEqual(fromUndef.message, 'Unknown error');
});
