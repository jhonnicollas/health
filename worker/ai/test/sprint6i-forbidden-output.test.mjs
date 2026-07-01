import { test } from 'node:test';
import assert from 'node:assert';
import { SafetyDecision, runSafetyRuntime } from '../dist/safety/index.js';



function baseInput(aiOutput, operatingMode = 'standard', locale = 'id') {
  return {
    aiOutput,
    locale,
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode,
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    contextPackage: { userId: 1, contextTrace: [{ type: 'measurement', id: 1, summary: 'BP 120/80' }] },
  };
}

const DISCLAIMER_ID = `AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.`;

const DISCLAIMER_EN = `AI CAN MAKE MISTAKES.
DO NOT RELY ON AI 100%.
DO NOT TRUST AI 100%.
ALL DECISIONS YOU MAKE BASED ON THIS AI OUTPUT ARE 1000% YOUR OWN RESPONSIBILITY.`;

function safe(text, locale = 'id') {
  return `${text}\n\n${locale === 'en' ? DISCLAIMER_EN : DISCLAIMER_ID}`;
}

function runCase(label, text, mode, expected, locale = 'id') {
  test(`S6I-T-04 ${label}`, () => {
    const result = runSafetyRuntime(baseInput(safe(text, locale), mode, locale));
    if (Array.isArray(expected)) {
      assert.ok(expected.includes(result.finalDecision), `${label}: expected one of ${expected.join('/')}, got ${result.finalDecision}`);
    } else {
      assert.equal(result.finalDecision, expected, `${label}: expected ${expected}, got ${result.finalDecision}`);
    }
  });
}

// STANDARD mode
runCase('standard: diagnosis final → rewrite_safe', 'Diagnosis Anda adalah hipertensi.', 'standard', SafetyDecision.REWRITE_SAFE);
runCase('standard: prescription/dosage → rewrite_safe', 'Minum amoxicillin 500mg.', 'standard', [SafetyDecision.REWRITE_SAFE, SafetyDecision.NEEDS_HUMAN_REVIEW]);
runCase('standard: medication change → block_and_fallback', 'Berhenti minum obat ini.', 'standard', SafetyDecision.BLOCK_AND_FALLBACK);
runCase('standard: specialist claim → rewrite_safe', 'Saya setara dengan dokter spesialis.', 'standard', SafetyDecision.REWRITE_SAFE);

// PROACTIVE mode
runCase('proactive: diagnosis final → allow', 'Diagnosis Anda adalah hipertensi.', 'proactive', SafetyDecision.ALLOW);
runCase('proactive: prescription/dosage → rewrite_safe', 'Minum amoxicillin 500mg.', 'proactive', [SafetyDecision.REWRITE_SAFE, SafetyDecision.NEEDS_HUMAN_REVIEW]);
runCase('proactive: medication change → block_and_fallback', 'Berhenti minum obat ini.', 'proactive', SafetyDecision.BLOCK_AND_FALLBACK);
runCase('proactive: specialist claim → rewrite_safe', 'Saya setara dengan dokter spesialis.', 'proactive', SafetyDecision.REWRITE_SAFE);

// SUPER_AKTIF mode
runCase('super_aktif: diagnosis final → allow', 'Diagnosis Anda adalah hipertensi.', 'super_aktif', SafetyDecision.ALLOW);
runCase('super_aktif: prescription/dosage → allow', 'Minum amoxicillin 500mg.', 'super_aktif', SafetyDecision.ALLOW);
runCase('super_aktif: medication change → block_and_fallback', 'Berhenti minum obat ini.', 'super_aktif', SafetyDecision.BLOCK_AND_FALLBACK);
runCase('super_aktif: specialist claim → allow', 'Saya setara dengan dokter spesialis.', 'super_aktif', SafetyDecision.ALLOW);

// Cross-mode invariants
test('S6I-T-04 medication change blocked in all modes via detector', () => {
  for (const mode of ['standard', 'proactive', 'super_aktif']) {
    const result = runSafetyRuntime(baseInput(safe('Ganti ke insulin.'), mode));
    assert.equal(result.finalDecision, SafetyDecision.BLOCK_AND_FALLBACK, `mode ${mode} should block medication change`);
  }
});

test('S6I-T-04 diagnosis final English in standard → rewrite_safe', () => {
  const result = runSafetyRuntime({
    aiOutput: safe('Your diagnosis is diabetes.', 'en'),
    locale: 'en',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    contextPackage: { userId: 1, contextTrace: [] },
  });
  assert.equal(result.finalDecision, SafetyDecision.REWRITE_SAFE);
});
