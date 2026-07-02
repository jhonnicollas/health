import { test } from 'node:test';
import assert from 'node:assert';
import {
  isValidSlug,
  isNonEmptyString,
  isUUID,
  isIntegerId,
  validateEnum,
  sanitizeString,
} from '../dist/utils/validation.js';
import { AppError, errorCodes } from '../dist/utils/errors.js';

test('isValidSlug accepts lowercase-kebab strings', () => {
  assert.strictEqual(isValidSlug('hello'), true);
  assert.strictEqual(isValidSlug('hello-world'), true);
  assert.strictEqual(isValidSlug('a-1-b-2'), true);
  assert.strictEqual(isValidSlug('abc123'), true);
});

test('isValidSlug rejects bad inputs', () => {
  assert.strictEqual(isValidSlug('Hello'), false);          // uppercase
  assert.strictEqual(isValidSlug('-leading'), false);       // leading dash
  assert.strictEqual(isValidSlug('trailing-'), false);      // trailing dash
  assert.strictEqual(isValidSlug('double--dash'), false);   // double dash
  assert.strictEqual(isValidSlug('with space'), false);     // space
  assert.strictEqual(isValidSlug('with_underscore'), false);// underscore
  assert.strictEqual(isValidSlug(''), false);               // empty
});

test('isNonEmptyString returns true for non-empty trimmed strings', () => {
  assert.strictEqual(isNonEmptyString('hello'), true);
  assert.strictEqual(isNonEmptyString('  hi  '), true);
});

test('isNonEmptyString returns false for empty/whitespace/non-strings', () => {
  assert.strictEqual(isNonEmptyString(''), false);
  assert.strictEqual(isNonEmptyString('   '), false);
  assert.strictEqual(isNonEmptyString(null), false);
  assert.strictEqual(isNonEmptyString(undefined), false);
  assert.strictEqual(isNonEmptyString(0), false);
  assert.strictEqual(isNonEmptyString({}), false);
});

test('isUUID accepts canonical UUIDs', () => {
  assert.strictEqual(isUUID('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.strictEqual(isUUID('A1B2C3D4-E5F6-7890-1234-567890ABCDEF'), true); // case-insensitive
});

test('isUUID rejects malformed values', () => {
  assert.strictEqual(isUUID('not-a-uuid'), false);
  assert.strictEqual(isUUID('550e8400-e29b-41d4-a716'), false);
  assert.strictEqual(isUUID(''), false);
});

test('isIntegerId accepts positive integers', () => {
  assert.strictEqual(isIntegerId(1), true);
  assert.strictEqual(isIntegerId(42), true);
});

test('isIntegerId rejects non-positive / non-integers', () => {
  assert.strictEqual(isIntegerId(0), false);
  assert.strictEqual(isIntegerId(-1), false);
  assert.strictEqual(isIntegerId(1.5), false);
  assert.strictEqual(isIntegerId('1'), false);
  assert.strictEqual(isIntegerId(null), false);
});

test('validateEnum returns value when allowed', () => {
  const allowed = ['a', 'b', 'c'];
  assert.strictEqual(validateEnum('b', allowed), 'b');
});

test('validateEnum throws AppError on bad value', () => {
  const allowed = ['a', 'b', 'c'];
  assert.throws(
    () => validateEnum('z', allowed),
    (err) => {
      assert.ok(err instanceof AppError);
      assert.strictEqual(err.code, errorCodes.VALIDATION_ERROR);
      assert.strictEqual(err.status, 400);
      return true;
    }
  );
});

test('sanitizeString trims and collapses internal whitespace', () => {
  assert.strictEqual(sanitizeString('  hello   world  '), 'hello world');
  assert.strictEqual(sanitizeString('a\t\nb'), 'a b');
  assert.strictEqual(sanitizeString('nochange'), 'nochange');
  assert.strictEqual(sanitizeString(''), '');
});
