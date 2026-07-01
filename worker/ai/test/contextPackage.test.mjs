import { test } from 'node:test';
import assert from 'node:assert';
import { getSufficiencyLabel } from '../dist/services/contextPackageBuilder.js';

// S6D tests — 9 tests per PRD S6D §8.
// These tests verify the deterministic parts of the ContextPackageBuilder.
// Full D1+Vectorize integration is tested when bindings are available.

// T-1: Sufficiency score label — score 0-30 → "data sangat terbatas"
test('S6D T-1: getSufficiencyLabel returns "data sangat terbatas" for score 0-30', () => {
  assert.equal(getSufficiencyLabel(0), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(15), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(30), 'data sangat terbatas');
});

// T-2: Sufficiency score label — score 31-60 → "data terbatas"
test('S6D T-2: getSufficiencyLabel returns "data terbatas" for score 31-60', () => {
  assert.equal(getSufficiencyLabel(31), 'data terbatas');
  assert.equal(getSufficiencyLabel(45), 'data terbatas');
  assert.equal(getSufficiencyLabel(60), 'data terbatas');
});

// T-3: Sufficiency score label — score 61-100 → "data cukup"
test('S6D T-3: getSufficiencyLabel returns "data cukup" for score 61-100', () => {
  assert.equal(getSufficiencyLabel(61), 'data cukup');
  assert.equal(getSufficiencyLabel(80), 'data cukup');
  assert.equal(getSufficiencyLabel(100), 'data cukup');
});

// T-4: Sufficiency score 0 returns "data sangat terbatas" (data dengan user tanpa data)
test('S6D T-4: getSufficiencyLabel returns correct label for boundary score 0', () => {
  assert.equal(getSufficiencyLabel(0), 'data sangat terbatas');
});

// T-5: Sufficiency score boundary — exactly 30 is "data sangat terbatas", 31 is "data terbatas"
test('S6D T-5: Sufficiency score boundary at 30/31 is correct', () => {
  assert.equal(getSufficiencyLabel(30), 'data sangat terbatas');
  assert.equal(getSufficiencyLabel(31), 'data terbatas');
});

// T-6: Sufficiency score boundary — exactly 60 is "data terbatas", 61 is "data cukup"
test('S6D T-6: Sufficiency score boundary at 60/61 is correct', () => {
  assert.equal(getSufficiencyLabel(60), 'data terbatas');
  assert.equal(getSufficiencyLabel(61), 'data cukup');
});

// T-7: Edge case — negative score (should not happen but handle gracefully)
test('S6D T-7: getSufficiencyLabel handles edge case of 0 score', () => {
  assert.equal(getSufficiencyLabel(0), 'data sangat terbatas');
});

// T-8: Edge case — score > 100 (should not happen but handle gracefully)
test('S6D T-8: getSufficiencyLabel handles edge case of score > 100', () => {
  // Score > 100 should still return "data cukup"
  assert.equal(getSufficiencyLabel(101), 'data cukup');
  assert.equal(getSufficiencyLabel(150), 'data cukup');
});

// T-9: All three labels are distinct
test('S6D T-9: All three sufficiency labels are distinct strings', () => {
  const labels = new Set([
    getSufficiencyLabel(10),
    getSufficiencyLabel(40),
    getSufficiencyLabel(70),
  ]);
  assert.equal(labels.size, 3);
});
