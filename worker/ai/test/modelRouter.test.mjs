import { test } from 'node:test';
import assert from 'node:assert';
import { renderSafeTemplate } from '../dist/services/safeTemplate.js';
import { buildSystemPrompt } from '../dist/services/promptLoader.js';
// S6B tests — 7 tests per PRD §3 S6B §11
// These tests verify the deterministic parts of ModelRouter that don't require
// live Cloudflare bindings (AI Gateway, Workers AI, KV). The full route() flow
// is integration-tested in S6E when the full orchestrator is wired.

test('S6B T-1: Safe template produces valid response with disclaimer', () => {
  const result = renderSafeTemplate({ taskCode: 'clinical_copilot', locale: 'id' });
  assert.ok(result.text.includes('AI DAPAT MELAKUKAN KESALAHAN'));
  assert.ok(result.text.includes('TIDAK BOLEH MENGANDALKAN AI 100%'));
  assert.ok(result.text.includes('TIDAK BOLEH PERCAYA AI 100%'));
  assert.ok(result.text.includes('TANGGUNG JAWAB ANDA'));
  assert.equal(result.model, 'deterministic-safe-template');
});

test('S6B T-2: Safe template English locale renders correctly', () => {
  const result = renderSafeTemplate({ taskCode: 'clinical_copilot', locale: 'en' });
  assert.ok(result.text.includes('AI CAN MAKE MISTAKES'));
  assert.ok(result.text.includes('DO NOT RELY ON AI 100%'));
  assert.ok(result.text.includes('DO NOT TRUST AI 100%'));
  assert.ok(result.text.includes('YOUR OWN RESPONSIBILITY'));
});

test('S6B T-3: Safe template for first_aid task produces P3K fallback', () => {
  const result = renderSafeTemplate({ taskCode: 'first_aid', locale: 'id' });
  assert.ok(result.text.includes('P3K') || result.text.includes('pertolongan') || result.text.includes('119'));
  assert.ok(result.text.includes('AI DAPAT MELAKUKAN KESALAHAN'));
});

test('S6B T-4: Safe template for emergency_guidance produces emergency text', () => {
  const result = renderSafeTemplate({ taskCode: 'emergency_guidance', locale: 'id' });
  assert.ok(result.text.includes('PERINGATAN DARURAT') || result.text.includes('119'));
  assert.ok(result.text.includes('AI DAPAT MELAKUKAN KESALAHAN'));
});

test('S6B T-5: buildSystemPrompt injects standard mode forbidden actions', () => {
  const prompt = buildSystemPrompt('You are iSehat AI...', 'standard', '{"test": true}');
  assert.ok(prompt.includes('STANDARD MODE'));
  assert.ok(prompt.includes('MUST NOT give a final diagnosis'));
  assert.ok(prompt.includes('MUST NOT prescribe medication'));
  assert.ok(prompt.includes('diagnosis_final'));
  assert.ok(prompt.includes('prescription_or_dosage'));
  assert.ok(prompt.includes('specialist_claim'));
  assert.ok(prompt.includes('medication_change'));
  assert.ok(prompt.includes('AI DAPAT MELAKUKAN KESALAHAN'));
});

test('S6B T-6: buildSystemPrompt injects super_aktif mode allowed actions', () => {
  const prompt = buildSystemPrompt('You are iSehat AI...', 'super_aktif', '{"test": true}');
  assert.ok(prompt.includes('SUPER AKTIF MODE'));
  assert.ok(prompt.includes('MAY give a final diagnosis'));
  assert.ok(prompt.includes('MAY prescribe medication'));
  assert.ok(prompt.includes('MUST NOT change or stop'));
  assert.ok(!prompt.includes('diagnosis_final'));
});

test('S6B T-7: buildSystemPrompt injects proactive mode — diagnosis allowed, resep blocked', () => {
  const prompt = buildSystemPrompt('You are iSehat AI...', 'proactive', '{"test": true}');
  assert.ok(prompt.includes('PROACTIVE MODE'));
  assert.ok(prompt.includes('MAY give a final diagnosis'));
  assert.ok(prompt.includes('MUST NOT prescribe medication'));
  assert.ok(!prompt.includes('diagnosis_final'));
  assert.ok(prompt.includes('prescription_or_dosage'));
  assert.ok(prompt.includes('specialist_claim'));
});
