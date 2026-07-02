import { test } from 'node:test';
import assert from 'node:assert';
import {
  CONTENT_TYPES,
  CONTENT_STATUSES,
  IDEA_STATUSES,
  DRAFT_STATUSES,
  REVISION_STATUSES,
  SAFETY_STATUSES,
  APPROVAL_STATUSES,
  AI_PROVIDERS,
  AI_JOB_TYPES,
  AI_JOB_STATUSES,
  HEALTH_CONTENT_STATUSES,
  HEALTH_CLAIM_STATUSES,
  OPERATING_MODES,
} from '../dist/types/enums.js';

test('CONTENT_TYPES contains expected snake_case values', () => {
  assert.deepStrictEqual(
    [...CONTENT_TYPES],
    ['educational', 'promotional', 'engagement', 'news', 'reminder']
  );
  assert.strictEqual(CONTENT_TYPES.length, 5);
});

test('CONTENT_STATUSES has 5 entries', () => {
  assert.strictEqual(CONTENT_STATUSES.length, 5);
  assert.ok(CONTENT_STATUSES.includes('draft'));
  assert.ok(CONTENT_STATUSES.includes('published'));
});

test('IDEA_STATUSES has 3 entries', () => {
  assert.strictEqual(IDEA_STATUSES.length, 3);
  assert.deepStrictEqual([...IDEA_STATUSES], ['pending', 'approved', 'rejected']);
});

test('DRAFT_STATUSES has 4 entries', () => {
  assert.strictEqual(DRAFT_STATUSES.length, 4);
  assert.ok(DRAFT_STATUSES.includes('ready_for_review'));
});

test('REVISION_STATUSES has 3 entries', () => {
  assert.strictEqual(REVISION_STATUSES.length, 3);
});

test('SAFETY_STATUSES has 5 entries including needs_review', () => {
  assert.strictEqual(SAFETY_STATUSES.length, 5);
  assert.ok(SAFETY_STATUSES.includes('needs_review'));
});

test('APPROVAL_STATUSES has 4 entries including changes_requested', () => {
  assert.strictEqual(APPROVAL_STATUSES.length, 4);
  assert.ok(APPROVAL_STATUSES.includes('changes_requested'));
});

test('AI_PROVIDERS lists mock/openai/google/anthropic', () => {
  assert.strictEqual(AI_PROVIDERS.length, 4);
  assert.deepStrictEqual([...AI_PROVIDERS], ['mock', 'openai', 'google', 'anthropic']);
});

test('AI_JOB_TYPES has 4 entries', () => {
  assert.strictEqual(AI_JOB_TYPES.length, 4);
  assert.ok(AI_JOB_TYPES.includes('health_classifier'));
});

test('AI_JOB_STATUSES has 5 entries', () => {
  assert.strictEqual(AI_JOB_STATUSES.length, 5);
  assert.ok(AI_JOB_STATUSES.includes('cancelled'));
});

test('HEALTH_CONTENT_STATUSES has 5 entries', () => {
  assert.strictEqual(HEALTH_CONTENT_STATUSES.length, 5);
  assert.ok(HEALTH_CONTENT_STATUSES.includes('emergency'));
});

test('HEALTH_CLAIM_STATUSES has 4 entries', () => {
  assert.strictEqual(HEALTH_CLAIM_STATUSES.length, 4);
});

test('OPERATING_MODES includes super_aktif', () => {
  assert.strictEqual(OPERATING_MODES.length, 3);
  assert.ok(OPERATING_MODES.includes('super_aktif'));
});
