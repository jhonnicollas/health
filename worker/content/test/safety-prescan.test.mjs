import { test } from 'node:test';
import assert from 'node:assert';
import { prescanIdea, prescanDraft } from '../dist/utils/safety-prescan.js';

test('prescanIdea blocks doctor replacement', () => {
  const r = prescanIdea({ title: 'This app is a doctor replacement', angle: 'x', painPoint: 'y' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('doctor_replacement')));
});

test('prescanIdea blocks final diagnosis', () => {
  const r = prescanIdea({ title: 'final diagnosis from your phone', angle: 'x' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('final_diagnosis')));
});

test('prescanIdea blocks prescription', () => {
  const r = prescanIdea({ title: 'Get a prescription online', angle: 'x' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('prescription')));
});

test('prescanIdea blocks dosage instructions', () => {
  const r = prescanIdea({ title: 'x', angle: 'dosage instructions for your blood pressure pill' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('dosage')));
});

test('prescanIdea blocks guaranteed cure', () => {
  const r = prescanIdea({ title: 'guaranteed cure for headaches', angle: 'x' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('guaranteed_outcome')));
});

test('prescanIdea blocks 100% medical accuracy', () => {
  const r = prescanIdea({ title: '100% medical accuracy', angle: 'x' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('accuracy_100')));
});

test('prescanIdea blocks cures cancer', () => {
  const r = prescanIdea({ title: 'This herb cures cancer', angle: 'x' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('cure')));
});

test('prescanIdea blocks prevents diabetes', () => {
  const r = prescanIdea({ title: 'Daily walk prevents diabetes', angle: 'x' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('prevention')));
});

test('prescanIdea passes safe phrases', () => {
  const r1 = prescanIdea({ title: 'Catat tensi, bukan cuma angka', angle: 'Context matters', painPoint: 'Forget to log activity' });
  assert.strictEqual(r1.blocked, false);
  assert.deepStrictEqual(r1.blockedReasons, []);

  const r2 = prescanIdea({ title: 'Mempersiapkan konsultasi pertama dengan rapi', angle: 'Bring structured data' });
  assert.strictEqual(r2.blocked, false);
  assert.deepStrictEqual(r2.blockedReasons, []);
});

test('prescanDraft blocks forbidden claims in primaryHook', () => {
  const r = prescanDraft({ primaryHook: 'This app is a doctor replacement for daily care' });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('doctor_replacement')));
});

test('prescanDraft blocks forbidden claims in mainContent', () => {
  const r = prescanDraft({
    mainContent: 'Get a prescription from your phone with this guaranteed cure.',
  });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('prescription')));
  assert.ok(r.blockedReasons.some((s) => s.includes('guaranteed_outcome')));
});

test('prescanDraft blocks forbidden claims in caption', () => {
  const r = prescanDraft({
    caption: 'Daily walk prevents diabetes. 100% medical accuracy.',
  });
  assert.strictEqual(r.blocked, true);
  assert.ok(r.blockedReasons.some((s) => s.includes('prevention')));
  assert.ok(r.blockedReasons.some((s) => s.includes('accuracy_100')));
});

test('prescanDraft passes safe content', () => {
  const r = prescanDraft({
    title: 'Catat tensi dengan konteks',
    primaryHook: 'Satu angka tensi belum cukup untuk melihat pola tubuh.',
    mainContent:
      'Catat juga waktu pengukuran, aktivitas sebelumnya, dan keluhan yang terasa agar lebih siap saat berkonsultasi dengan tenaga medis.',
    caption:
      'iSehat membantu kamu mencatat data kesehatan harian agar lebih siap saat konsultasi.',
  });
  assert.strictEqual(r.blocked, false);
  assert.deepStrictEqual(r.blockedReasons, []);
});
