import { test } from 'node:test';
import assert from 'node:assert';
import {
  SafetyDecision,
  renderBlockedTemplate,
  missingDisclaimerDetector,
  emergencySeverityDowngradeDetector,
  crossUserLeakDetector,
  sensitiveDataLeakDetector,
  unsafeReassuranceDetector,
  certaintyClaimDetector,
  vectorizeAsTruthDetector,
  ruleEngineBypassDetector,
  delayMedicalCareDetector,
  diagnosisFinalDetector,
  prescriptionDosageDetector,
  medicationChangeDetector,
  specialistClaimDetector,
  runSafetyRuntime,
} from '../dist/safety/index.js';

const DISCLAIMER = 'AI DAPAT MELAKUKAN KESALAHAN. TIDAK BOLEH MENGANDALKAN AI 100%.';

function safeOutput(body) {
  return `${body}\n\n${DISCLAIMER}`;
}

test('SafetyDecision enum values match PRD §10.2', () => {
  assert.equal(SafetyDecision.ALLOW, 'allow');
  assert.equal(SafetyDecision.ALLOW_WITH_DISCLAIMER, 'allow_with_disclaimer');
  assert.equal(SafetyDecision.REWRITE_SAFE, 'rewrite_safe');
  assert.equal(SafetyDecision.BLOCK_AND_FALLBACK, 'block_and_fallback');
  assert.equal(SafetyDecision.EMERGENCY_TEMPLATE_ONLY, 'emergency_template_only');
  assert.equal(SafetyDecision.NEEDS_HUMAN_REVIEW, 'needs_human_review');
});

test('Blocked response template renders PRD §10.3 text', () => {
  const id = renderBlockedTemplate('id');
  assert.ok(id.includes('AI DAPAT MELAKUKAN KESALAHAN.'));
  assert.ok(id.includes('TIDAK BOLEH MENGANDALKAN AI 100%.'));
  assert.ok(id.includes('TIDAK BOLEH PERCAYA AI 100%.'));
  assert.ok(id.includes('SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.'));

  const en = renderBlockedTemplate('en');
  assert.ok(en.includes('AI CAN MAKE MISTAKES.'));
});

// 13 detector tests — one per detector required by S6A-T-10
test('Safety detector: missingDisclaimerDetector', () => {
  const blocked = missingDisclaimerDetector({ aiOutput: 'Ini jawaban medis.' });
  assert.equal(blocked.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const allowed = missingDisclaimerDetector({ aiOutput: safeOutput('Jawaban aman.') });
  assert.equal(allowed.decision, SafetyDecision.ALLOW);
});

test('Safety detector: emergencySeverityDowngradeDetector', () => {
  const emergency = emergencySeverityDowngradeDetector({
    aiOutput: safeOutput('Tidak perlu khawatir, ini ringan saja.'),
    deterministicEmergencyLevel: 'emergency',
  });
  assert.equal(emergency.decision, SafetyDecision.EMERGENCY_TEMPLATE_ONLY);
  assert.ok(emergency.emergencyText);

  const warning = emergencySeverityDowngradeDetector({
    aiOutput: safeOutput('Tidak perlu khawatir.'),
    deterministicEmergencyLevel: 'warning',
  });
  assert.equal(warning.decision, SafetyDecision.ALLOW);
});

test('Safety detector: crossUserLeakDetector', () => {
  const blocked = crossUserLeakDetector({
    aiOutput: safeOutput('Pasien lain memiliki tekanan darah tinggi.'),
  });
  assert.equal(blocked.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const allowed = crossUserLeakDetector({
    aiOutput: safeOutput('Berdasarkan data Anda, tekanan darah normal.'),
    contextPackage: { userId: 1, contextTrace: [{ type: 'measurement', id: 1 }] },
  });
  assert.equal(allowed.decision, SafetyDecision.ALLOW);
});

test('Safety detector: sensitiveDataLeakDetector', () => {
  const blocked = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Data kehamilan Anda menunjukkan risiko.'),
    consents: { aiConsent: 1, dataShareConsent: 0 },
  });
  assert.equal(blocked.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const allowed = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Data kehamilan Anda menunjukkan risiko.'),
    consents: { aiConsent: 1, dataShareConsent: 1 },
  });
  assert.equal(allowed.decision, SafetyDecision.ALLOW);
});

test('Safety detector: unsafeReassuranceDetector', () => {
  const rewrite = unsafeReassuranceDetector({
    aiOutput: safeOutput('Anda aman, tidak perlu khawatir.'),
    redFlagPresent: true,
  });
  assert.equal(rewrite.decision, SafetyDecision.REWRITE_SAFE);
  assert.ok(rewrite.rewrite);

  const allowed = unsafeReassuranceDetector({
    aiOutput: safeOutput('Anda aman.'),
    redFlagPresent: false,
  });
  assert.equal(allowed.decision, SafetyDecision.ALLOW);
});

test('Safety detector: certaintyClaimDetector', () => {
  const rewrite = certaintyClaimDetector({
    aiOutput: safeOutput('Hasil ini 100% akurat dan pasti benar.'),
  });
  assert.equal(rewrite.decision, SafetyDecision.REWRITE_SAFE);
  assert.ok(rewrite.rewrite);

  const allowed = certaintyClaimDetector({
    aiOutput: safeOutput('Hasil ini mungkin menunjukkan hipotesis.'),
  });
  assert.equal(allowed.decision, SafetyDecision.ALLOW);
});

test('Safety detector: vectorizeAsTruthDetector', () => {
  const rewrite = vectorizeAsTruthDetector({
    aiOutput: safeOutput('Vectorize mengonfirmasi diagnosis Anda.'),
  });
  assert.equal(rewrite.decision, SafetyDecision.REWRITE_SAFE);
  assert.ok(rewrite.rewrite);
});

test('Safety detector: ruleEngineBypassDetector', () => {
  const blocked = ruleEngineBypassDetector({
    aiOutput: safeOutput('Aturan mesin salah, saya menilai lebih akurat.'),
  });
  assert.equal(blocked.decision, SafetyDecision.BLOCK_AND_FALLBACK);
});

test('Safety detector: delayMedicalCareDetector', () => {
  const blocked = delayMedicalCareDetector({
    aiOutput: safeOutput('Cukup istirahat di rumah, coba lagi besok.'),
    redFlagPresent: true,
  });
  assert.equal(blocked.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const allowed = delayMedicalCareDetector({
    aiOutput: safeOutput('Cukup istirahat di rumah.'),
    redFlagPresent: false,
  });
  assert.equal(allowed.decision, SafetyDecision.ALLOW);
});

test('Safety detector: diagnosisFinalDetector', () => {
  const standard = diagnosisFinalDetector({
    aiOutput: safeOutput('Diagnosis Anda adalah diabetes tipe 2.'),
    operatingMode: 'standard',
  });
  assert.equal(standard.decision, SafetyDecision.REWRITE_SAFE);

  const proactive = diagnosisFinalDetector({
    aiOutput: safeOutput('Diagnosis Anda adalah diabetes tipe 2.'),
    operatingMode: 'proactive',
  });
  assert.equal(proactive.decision, SafetyDecision.ALLOW);

  const superAktif = diagnosisFinalDetector({
    aiOutput: safeOutput('Diagnosis Anda adalah diabetes tipe 2.'),
    operatingMode: 'super_aktif',
  });
  assert.equal(superAktif.decision, SafetyDecision.ALLOW);
});

test('Safety detector: prescriptionDosageDetector', () => {
  const standard = prescriptionDosageDetector({
    aiOutput: safeOutput('Minum amoxicillin 500mg dua kali sehari.'),
    operatingMode: 'standard',
  });
  assert.equal(standard.decision, SafetyDecision.REWRITE_SAFE);

  const proactive = prescriptionDosageDetector({
    aiOutput: safeOutput('Minum amoxicillin 500mg.'),
    operatingMode: 'proactive',
  });
  assert.equal(proactive.decision, SafetyDecision.REWRITE_SAFE);

  const superAktif = prescriptionDosageDetector({
    aiOutput: safeOutput('Minum amoxicillin 500mg.'),
    operatingMode: 'super_aktif',
  });
  assert.equal(superAktif.decision, SafetyDecision.ALLOW);
});

test('Safety detector: medicationChangeDetector', () => {
  const blocked = medicationChangeDetector({
    aiOutput: safeOutput('Berhenti minum obat ini dan ganti ke yang baru.'),
  });
  assert.equal(blocked.decision, SafetyDecision.BLOCK_AND_FALLBACK);
});

test('Safety detector: specialistClaimDetector', () => {
  const standard = specialistClaimDetector({
    aiOutput: safeOutput('Saya setara dengan dokter spesialis.'),
    operatingMode: 'standard',
  });
  assert.equal(standard.decision, SafetyDecision.REWRITE_SAFE);

  const proactive = specialistClaimDetector({
    aiOutput: safeOutput('Saya punya akurasi dokter.'),
    operatingMode: 'proactive',
  });
  assert.equal(proactive.decision, SafetyDecision.REWRITE_SAFE);

  const superAktif = specialistClaimDetector({
    aiOutput: safeOutput('Saya setara dengan dokter spesialis.'),
    operatingMode: 'super_aktif',
  });
  assert.equal(superAktif.decision, SafetyDecision.ALLOW);
});

test('Safety detector: sensitiveDataLeakDetector — aiConsent required for AI context', () => {
  const blockedNoAiConsent = sensitiveDataLeakDetector({
    aiOutput: safeOutput('AI memory menunjukkan riwayat Anda.'),
    consents: { aiConsent: 0, dataShareConsent: 1 },
  });
  assert.equal(blockedNoAiConsent.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const allowedWithAiConsent = sensitiveDataLeakDetector({
    aiOutput: safeOutput('AI memory menunjukkan riwayat Anda.'),
    consents: { aiConsent: 1, dataShareConsent: 1 },
  });
  assert.equal(allowedWithAiConsent.decision, SafetyDecision.ALLOW);

  const blockedNoDualConsent = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Data kehamilan Anda menunjukkan risiko.'),
    consents: { aiConsent: 1, dataShareConsent: 0 },
  });
  assert.equal(blockedNoDualConsent.decision, SafetyDecision.BLOCK_AND_FALLBACK);

  const allowedDualConsent = sensitiveDataLeakDetector({
    aiOutput: safeOutput('Data kehamilan Anda menunjukkan risiko.'),
    consents: { aiConsent: 1, dataShareConsent: 1 },
  });
  assert.equal(allowedDualConsent.decision, SafetyDecision.ALLOW);
});

test('Safety runtime: rewrite chaining — second detector scans rewritten output', () => {
  const withDisclaimer = 'Vectorize mengonfirmasi diagnosis Anda adalah hipertensi.\n\nAI DAPAT MELAKUKAN KESALAHAN. TIDAK BOLEH MENGANDALKAN AI 100%. TIDAK BOLEH PERCAYA AI 100%. SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';
  const result = runSafetyRuntime({
    aiOutput: withDisclaimer,
    operatingMode: 'standard',
  });
  assert.ok(result.flags.length >= 1, 'should flag vectorizeAsTruthDetector');
  assert.ok(result.output !== withDisclaimer, 'output should be rewritten');
  assert.ok(result.flags.some(f => f.flagCode === 'vectorizeAsTruthDetector'));
});

test('Safety runtime: needs_human_review when high-severity rewrite fires', () => {
  const result = runSafetyRuntime({
    aiOutput: safeOutput('Minum amoxicillin 500mg dua kali sehari.'),
    operatingMode: 'standard',
    redFlagPresent: true,
  });
  assert.equal(result.finalDecision, SafetyDecision.NEEDS_HUMAN_REVIEW);
});
test('Safety runtime: blocks medication change and returns blocked template', () => {
  const result = runSafetyRuntime({
    aiOutput: safeOutput('Anda harus berhenti minum obat lama.'),
  });
  assert.equal(result.finalDecision, SafetyDecision.BLOCK_AND_FALLBACK);
  assert.ok(result.output.includes('AI DAPAT MELAKUKAN KESALAHAN.'));
  assert.ok(result.flags.some((f) => f.flagCode === 'medicationChangeDetector'));
});

test('Safety runtime: rewrites diagnosis in standard mode', () => {
  const result = runSafetyRuntime({
    aiOutput: safeOutput('Diagnosis Anda adalah hipertensi.'),
    operatingMode: 'standard',
  });
  assert.equal(result.finalDecision, SafetyDecision.REWRITE_SAFE);
  assert.ok(result.flags.some((f) => f.flagCode === 'diagnosisFinalDetector'));
});
