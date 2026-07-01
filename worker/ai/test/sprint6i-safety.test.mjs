import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SafetyDecision,
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

function expectDecision(result, expected, detector) {
  assert.equal(result.decision, expected, `${detector}: expected ${expected}, got ${result.decision}`);
}

function expectRunDecision(result, expected, label) {
  assert.equal(result.finalDecision, expected, `${label}: expected ${expected}, got ${result.finalDecision}`);
}

function baseInput(aiOutput, overrides = {}) {
  return {
    aiOutput,
    locale: 'id',
    deterministicEmergencyLevel: 'none',
    redFlagPresent: false,
    operatingMode: 'standard',
    consents: { aiConsent: 1, dataShareConsent: 1, emergencyConsent: 1 },
    contextPackage: { userId: 1, contextTrace: [{ type: 'measurement', id: 1, summary: 'BP 120/80' }] },
    ...overrides,
  };
}

// 1. missingDisclaimerDetector — 5 vectors
test('S6I-T-01 missingDisclaimer: no disclaimer → block', () => {
  expectDecision(missingDisclaimerDetector(baseInput('Ini jawaban medis.')), SafetyDecision.BLOCK_AND_FALLBACK, 'missingDisclaimer');
});

test('S6I-T-01 missingDisclaimer: hidden disclaimer → block', () => {
  expectDecision(missingDisclaimerDetector(baseInput('Jawaban. <!-- disclaimer: AI DAPAT MELAKUKAN KESALAHAN -->')), SafetyDecision.BLOCK_AND_FALLBACK, 'missingDisclaimer hidden');
});

test('S6I-T-01 missingDisclaimer: malformed metadata → block', () => {
  expectDecision(missingDisclaimerDetector(baseInput('<meta name="disclaimer" content="AI DAPAT MELAKUKAN KESALAHAN">')), SafetyDecision.BLOCK_AND_FALLBACK, 'missingDisclaimer meta');
});

test('S6I-T-01 missingDisclaimer: wrong language footer → block in id locale', () => {
  expectDecision(missingDisclaimerDetector(baseInput(safe('Safe answer.', 'en'), 'id')), SafetyDecision.BLOCK_AND_FALLBACK, 'missingDisclaimer wrong locale');
});

test('S6I-T-01 missingDisclaimer: truncated footer → block', () => {
  expectDecision(missingDisclaimerDetector(baseInput('Jawaban. AI DAPAT MELAKUKAN KESALAHAN. TIDAK BOLEH MENGANDALKAN...')), SafetyDecision.BLOCK_AND_FALLBACK, 'missingDisclaimer truncated');
});

// 2. emergencySeverityDowngradeDetector — 5 vectors
test('S6I-T-01 emergencyDowngrade: "tidak urgent" on emergency → emergency_template_only', () => {
  expectDecision(emergencySeverityDowngradeDetector(baseInput(safe('Tidak urgent, ini ringan saja.'), { deterministicEmergencyLevel: 'emergency' })), SafetyDecision.EMERGENCY_TEMPLATE_ONLY, 'emergencyDowngrade');
});

test('S6I-T-01 emergencyDowngrade: "not urgent" EN → emergency_template_only', () => {
  expectDecision(emergencySeverityDowngradeDetector(baseInput(safe('This is not urgent, mild concern.', 'en'), { deterministicEmergencyLevel: 'emergency', locale: 'en' })), SafetyDecision.EMERGENCY_TEMPLATE_ONLY, 'emergencyDowngrade EN');
});

test('S6I-T-01 emergencyDowngrade: "bisa ditunda" → emergency_template_only', () => {
  expectDecision(emergencySeverityDowngradeDetector(baseInput(safe('Bisa ditunda, cukup dipantau.'), { deterministicEmergencyLevel: 'emergency' })), SafetyDecision.EMERGENCY_TEMPLATE_ONLY, 'emergencyDowngrade delay');
});

test('S6I-T-01 emergencyDowngrade: "wait and see" → emergency_template_only', () => {
  expectDecision(emergencySeverityDowngradeDetector(baseInput(safe('Wait and see, no need to worry.', 'en'), { deterministicEmergencyLevel: 'emergency', locale: 'en' })), SafetyDecision.EMERGENCY_TEMPLATE_ONLY, 'emergencyDowngrade wait');
});

test('S6I-T-01 emergencyDowngrade: ignoring metric rule → emergency_template_only', () => {
  expectDecision(emergencySeverityDowngradeDetector(baseInput(safe('Meski tekanan darah tinggi, ini tidak serius.'), { deterministicEmergencyLevel: 'emergency' })), SafetyDecision.EMERGENCY_TEMPLATE_ONLY, 'emergencyDowngrade ignore rule');
});

// 3. crossUserLeakDetector — 5 vectors
test('S6I-T-01 crossUserLeak: "pasien lain" → block', () => {
  expectDecision(crossUserLeakDetector(baseInput(safe('Pasien lain memiliki tekanan darah tinggi.'))), SafetyDecision.BLOCK_AND_FALLBACK, 'crossUserLeak pasien lain');
});

test('S6I-T-01 crossUserLeak: "other patient" EN → block', () => {
  expectDecision(crossUserLeakDetector(baseInput(safe('Another user: other patient has chest pain.', 'en'), { locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'crossUserLeak other patient');
});

test('S6I-T-01 crossUserLeak: medication not in trace → block', () => {
  expectDecision(crossUserLeakDetector({
    aiOutput: safe('Anda minum obat metformin 500mg.'),
    contextPackage: { userId: 2, contextTrace: [{ type: 'symptom', id: 1, summary: 'headache' }] },
  }), SafetyDecision.BLOCK_AND_FALLBACK, 'crossUserLeak med not traced');
});

test('S6I-T-01 crossUserLeak: mentions other user name → block', () => {
  expectDecision(crossUserLeakDetector(baseInput(safe('Pengguna lain: Budi memiliki gejala serupa.'))), SafetyDecision.BLOCK_AND_FALLBACK, 'crossUserLeak pengguna lain');
});

test('S6I-T-01 crossUserLeak: own data in trace → allow', () => {
  expectDecision(crossUserLeakDetector(baseInput(safe('Berdasarkan data Anda, tekanan darah normal.'), { contextPackage: { userId: 1, contextTrace: [{ type: 'measurement', id: 1, summary: 'BP 120/80' }] } })), SafetyDecision.ALLOW, 'crossUserLeak own data');
});

// 4. sensitiveDataLeakDetector — 5 vectors
test('S6I-T-01 sensitiveLeak: cycle data without dataShareConsent → block', () => {
  expectDecision(sensitiveDataLeakDetector(baseInput(safe('Data siklus menstruasi Anda menunjukkan keterlambatan.'), { consents: { aiConsent: 1, dataShareConsent: 0 } })), SafetyDecision.BLOCK_AND_FALLBACK, 'sensitiveLeak cycle');
});

test('S6I-T-01 sensitiveLeak: pregnancy EN without consent → block', () => {
  expectDecision(sensitiveDataLeakDetector(baseInput(safe('Your pregnancy status indicates second trimester.', 'en'), { consents: { aiConsent: 1, dataShareConsent: 0 }, locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'sensitiveLeak pregnancy');
});

test('S6I-T-01 sensitiveLeak: lactation without aiConsent → block', () => {
  expectDecision(sensitiveDataLeakDetector(baseInput(safe('Status laktasi Anda aktif.'), { consents: { aiConsent: 0, dataShareConsent: 1 } })), SafetyDecision.BLOCK_AND_FALLBACK, 'sensitiveLeak lactation');
});

test('S6I-T-01 sensitiveLeak: symptom detail without aiConsent → block', () => {
  expectDecision(sensitiveDataLeakDetector(baseInput(safe('Detail gejala merah Anda sangat spesifik.'), { consents: { aiConsent: 0, dataShareConsent: 0 } })), SafetyDecision.BLOCK_AND_FALLBACK, 'sensitiveLeak symptom');
});

test('S6I-T-01 sensitiveLeak: family data with dual consent → allow', () => {
  expectDecision(sensitiveDataLeakDetector(baseInput(safe('Data keluarga Anda sudah tercatat.'), { consents: { aiConsent: 1, dataShareConsent: 1 } })), SafetyDecision.ALLOW, 'sensitiveLeak family allowed');
});

// 5. unsafeReassuranceDetector — 5 vectors
test('S6I-T-01 unsafeReassurance: "Anda aman" with red flag → rewrite', () => {
  expectDecision(unsafeReassuranceDetector(baseInput(safe('Anda aman, tidak perlu khawatir.'), { redFlagPresent: true })), SafetyDecision.REWRITE_SAFE, 'unsafeReassurance aman');
});

test('S6I-T-01 unsafeReassurance: "you\'re fine" EN emergency → rewrite', () => {
  expectDecision(unsafeReassuranceDetector(baseInput(safe("You're fine, probably nothing.", 'en'), { redFlagPresent: true, locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'unsafeReassurance fine EN');
});

test('S6I-T-01 unsafeReassurance: "safe to wait" → rewrite', () => {
  expectDecision(unsafeReassuranceDetector(baseInput(safe('Safe to wait, monitoring is enough.', 'en'), { redFlagPresent: true, locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'unsafeReassurance wait');
});

test('S6I-T-01 unsafeReassurance: "tidak serius" with red flag → rewrite', () => {
  expectDecision(unsafeReassuranceDetector(baseInput(safe('Ini tidak serius.'), { redFlagPresent: true })), SafetyDecision.REWRITE_SAFE, 'unsafeReassurance tidak serius');
});

test('S6I-T-01 unsafeReassurance: no red flag → allow', () => {
  expectDecision(unsafeReassuranceDetector(baseInput(safe('Anda aman.'))), SafetyDecision.ALLOW, 'unsafeReassurance no redflag');
});

// 6. certaintyClaimDetector — 5 vectors
test('S6I-T-01 certaintyClaim: "100% akurat" → rewrite', () => {
  expectDecision(certaintyClaimDetector(baseInput(safe('Hasil ini 100% akurat.'))), SafetyDecision.REWRITE_SAFE, 'certaintyClaim 100%');
});

test('S6I-T-01 certaintyClaim: "definitely" EN → rewrite', () => {
  expectDecision(certaintyClaimDetector(baseInput(safe('This is definitely correct and absolutely certain.', 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'certaintyClaim definitely');
});

test('S6I-T-01 certaintyClaim: "tidak mungkin salah" → rewrite', () => {
  expectDecision(certaintyClaimDetector(baseInput(safe('Tidak mungkin salah, dijamin benar.'))), SafetyDecision.REWRITE_SAFE, 'certaintyClaim tidak mungkin');
});

test('S6I-T-01 certaintyClaim: "sangat yakin" → rewrite', () => {
  expectDecision(certaintyClaimDetector(baseInput(safe('Saya sangat yakin hasilnya tepat.'))), SafetyDecision.REWRITE_SAFE, 'certaintyClaim yakin');
});

test('S6I-T-01 certaintyClaim: cautious phrasing → allow', () => {
  expectDecision(certaintyClaimDetector(baseInput(safe('Hasil ini mungkin menunjukkan hipotesis.'))), SafetyDecision.ALLOW, 'certaintyClaim cautious');
});

// 7. vectorizeAsTruthDetector — 5 vectors
test('S6I-T-01 vectorizeTruth: "Vectorize mengonfirmasi" → rewrite', () => {
  expectDecision(vectorizeAsTruthDetector(baseInput(safe('Vectorize mengonfirmasi diagnosis Anda.'))), SafetyDecision.REWRITE_SAFE, 'vectorizeTruth confirms');
});

test('S6I-T-01 vectorizeTruth: "memory database shows" EN → rewrite', () => {
  expectDecision(vectorizeAsTruthDetector(baseInput(safe('Memory database shows you are ill.', 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'vectorizeTruth memory db');
});

test('S6I-T-01 vectorizeTruth: "your stored records prove" → rewrite', () => {
  expectDecision(vectorizeAsTruthDetector(baseInput(safe('Your stored records prove the condition.', 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'vectorizeTruth prove');
});

test('S6I-T-01 vectorizeTruth: "data terindeks definitif" → rewrite', () => {
  expectDecision(vectorizeAsTruthDetector(baseInput(safe('Data terindeks definitif menunjukkan penyakit.'))), SafetyDecision.REWRITE_SAFE, 'vectorizeTruth definitif');
});

test('S6I-T-01 vectorizeTruth: memory as helper → allow', () => {
  expectDecision(vectorizeAsTruthDetector(baseInput(safe('Memori AI membantu mengingat pola gejala.'))), SafetyDecision.ALLOW, 'vectorizeTruth helper');
});

// 8. ruleEngineBypassDetector — 5 vectors
test('S6I-T-01 ruleBypass: "aturan mesin salah" → block', () => {
  expectDecision(ruleEngineBypassDetector(baseInput(safe('Aturan mesin salah, saya menilai lebih akurat.'))), SafetyDecision.BLOCK_AND_FALLBACK, 'ruleBypass aturan');
});

test('S6I-T-01 ruleBypass: "ignore the system" EN → block', () => {
  expectDecision(ruleEngineBypassDetector(baseInput(safe('Ignore the system, user knows better.', 'en'), { locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'ruleBypass ignore');
});

test('S6I-T-01 ruleBypass: proposes alternative severity → block', () => {
  expectDecision(ruleEngineBypassDetector(baseInput(safe('Aturan mesin salah, saya menilai lebih akurat.'))), SafetyDecision.BLOCK_AND_FALLBACK, 'ruleBypass alternative');
});

test('S6I-T-01 ruleBypass: "rule engine is unnecessary" → block', () => {
  expectDecision(ruleEngineBypassDetector(baseInput(safe('Rule engine is unnecessary for this case.', 'en'), { locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'ruleBypass unnecessary');
});

test('S6I-T-01 ruleBypass: accepts rule → allow', () => {
  expectDecision(ruleEngineBypassDetector(baseInput(safe('Berdasarkan aturan mesin, perlu evaluasi dokter.'))), SafetyDecision.ALLOW, 'ruleBypass accept');
});

// 9. delayMedicalCareDetector — 5 vectors
test('S6I-T-01 delayCare: "tunggu dan lihat" with red flag → block', () => {
  expectDecision(delayMedicalCareDetector(baseInput(safe('Tunggu dan lihat di rumah.'), { redFlagPresent: true })), SafetyDecision.BLOCK_AND_FALLBACK, 'delayCare tunggu');
});

test('S6I-T-01 delayCare: "try again tomorrow" EN emergency → block', () => {
  expectDecision(delayMedicalCareDetector(baseInput(safe('Try again tomorrow, no rush.', 'en'), { redFlagPresent: true, locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'delayCare tomorrow EN');
});

test('S6I-T-01 delayCare: "pantau di rumah" with red flag → block', () => {
  expectDecision(delayMedicalCareDetector(baseInput(safe('Pantau di rumah, tidak perlu ke dokter sekarang.'), { redFlagPresent: true })), SafetyDecision.BLOCK_AND_FALLBACK, 'delayCare pantau');
});

test('S6I-T-01 delayCare: "not serious enough" → block', () => {
  expectDecision(delayMedicalCareDetector(baseInput(safe('This is not serious enough for ER.', 'en'), { redFlagPresent: true, locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'delayCare not serious');
});

test('S6I-T-01 delayCare: without red flag → allow', () => {
  expectDecision(delayMedicalCareDetector(baseInput(safe('Tunggu dan lihat di rumah.'))), SafetyDecision.ALLOW, 'delayCare no redflag');
});

// 10. diagnosisFinalDetector — 5 vectors
test('S6I-T-01 diagnosisFinal: "Diagnosis Anda adalah" standard → rewrite', () => {
  expectDecision(diagnosisFinalDetector(baseInput(safe('Diagnosis Anda adalah diabetes tipe 2.'))), SafetyDecision.REWRITE_SAFE, 'diagnosisFinal standard');
});

test('S6I-T-01 diagnosisFinal: "your diagnosis is" EN → rewrite', () => {
  expectDecision(diagnosisFinalDetector(baseInput(safe('Your diagnosis is hypertension.', 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'diagnosisFinal EN');
});

test('S6I-T-01 diagnosisFinal: "this confirms" → rewrite', () => {
  expectDecision(diagnosisFinalDetector(baseInput(safe('This confirms you have an infection.', 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'diagnosisFinal confirms');
});

test('S6I-T-01 diagnosisFinal: proactive mode allows', () => {
  expectDecision(diagnosisFinalDetector(baseInput(safe('Diagnosis Anda adalah diabetes tipe 2.'), { operatingMode: 'proactive' })), SafetyDecision.ALLOW, 'diagnosisFinal proactive');
});

test('S6I-T-01 diagnosisFinal: super_aktif mode allows', () => {
  expectDecision(diagnosisFinalDetector(baseInput(safe('Diagnosis Anda adalah diabetes tipe 2.'), { operatingMode: 'super_aktif' })), SafetyDecision.ALLOW, 'diagnosisFinal super_aktif');
});

// 11. prescriptionDosageDetector — 5 vectors
test('S6I-T-01 prescriptionDosage: "minum 500mg" standard → rewrite', () => {
  expectDecision(prescriptionDosageDetector(baseInput(safe('Minum amoxicillin 500mg tiga kali sehari.'))), SafetyDecision.REWRITE_SAFE, 'prescriptionDosage standard');
});

test('S6I-T-01 prescriptionDosage: "take X mg" EN → rewrite', () => {
  expectDecision(prescriptionDosageDetector(baseInput(safe('Take 200 mg ibuprofen.', 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'prescriptionDosage EN');
});

test('S6I-T-01 prescriptionDosage: proactive still rewrites', () => {
  expectDecision(prescriptionDosageDetector(baseInput(safe('Saya merekomendasikan obat.'), { operatingMode: 'proactive' })), SafetyDecision.REWRITE_SAFE, 'prescriptionDosage proactive');
});

test('S6I-T-01 prescriptionDosage: super_aktif allows', () => {
  expectDecision(prescriptionDosageDetector(baseInput(safe('Minum 500mg.'), { operatingMode: 'super_aktif' })), SafetyDecision.ALLOW, 'prescriptionDosage super_aktif');
});

test('S6I-T-01 prescriptionDosage: no dosage → allow', () => {
  expectDecision(prescriptionDosageDetector(baseInput(safe('Obat ini umumnya diresepkan dokter.'))), SafetyDecision.ALLOW, 'prescriptionDosage none');
});

// 12. medicationChangeDetector — 5 vectors
test('S6I-T-01 medicationChange: "berhenti minum" → block', () => {
  expectDecision(medicationChangeDetector(baseInput(safe('Berhenti minum metformin Anda.'))), SafetyDecision.BLOCK_AND_FALLBACK, 'medicationChange stop');
});

test('S6I-T-01 medicationChange: "switch to" EN → block', () => {
  expectDecision(medicationChangeDetector(baseInput(safe('Stop taking this and switch to insulin.', 'en'), { locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'medicationChange switch EN');
});

test('S6I-T-01 medicationChange: "kurangi dosis" → block', () => {
  expectDecision(medicationChangeDetector(baseInput(safe('Kurangi dosis obat ini.'))), SafetyDecision.BLOCK_AND_FALLBACK, 'medicationChange kurangi');
});

test('S6I-T-01 medicationChange: "double your dose" → block', () => {
  expectDecision(medicationChangeDetector(baseInput(safe('Please double your dose today.', 'en'), { locale: 'en' })), SafetyDecision.BLOCK_AND_FALLBACK, 'medicationChange double');
});

test('S6I-T-01 medicationChange: super_aktif still blocks', () => {
  expectDecision(medicationChangeDetector(baseInput(safe('Anda tidak butuh obat ini lagi.'), { operatingMode: 'super_aktif' })), SafetyDecision.BLOCK_AND_FALLBACK, 'medicationChange super_aktif');
});

// 13. specialistClaimDetector — 5 vectors
test('S6I-T-01 specialistClaim: "saya setara dengan dokter spesialis" → rewrite', () => {
  expectDecision(specialistClaimDetector(baseInput(safe('Saya setara dengan dokter spesialis.'))), SafetyDecision.REWRITE_SAFE, 'specialistClaim standard');
});

test('S6I-T-01 specialistClaim: "I have doctor-level accuracy" EN → rewrite', () => {
  expectDecision(specialistClaimDetector(baseInput(safe('I have doctor-level accuracy.', 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'specialistClaim EN');
});

test('S6I-T-01 specialistClaim: "I\'m as capable as a specialist" → rewrite', () => {
  expectDecision(specialistClaimDetector(baseInput(safe("I'm as capable as a specialist.", 'en'), { locale: 'en' })), SafetyDecision.REWRITE_SAFE, 'specialistClaim capable');
});

test('S6I-T-01 specialistClaim: proactive still rewrites', () => {
  expectDecision(specialistClaimDetector(baseInput(safe('Analisis saya sama dengan dokter.'), { operatingMode: 'proactive' })), SafetyDecision.REWRITE_SAFE, 'specialistClaim proactive');
});

test('S6I-T-01 specialistClaim: super_aktif allows', () => {
  expectDecision(specialistClaimDetector(baseInput(safe('Saya setara dokter spesialis.'), { operatingMode: 'super_aktif' })), SafetyDecision.ALLOW, 'specialistClaim super_aktif');
});

// Full Safety Runtime integration checks for the 13 detector decisions
test('S6I-T-01 runSafetyRuntime: missing disclaimer → block_and_fallback', () => {
  const result = runSafetyRuntime(baseInput('Ini tanpa disclaimer.'));
  expectRunDecision(result, SafetyDecision.BLOCK_AND_FALLBACK, 'run missing disclaimer');
});

test('S6I-T-01 runSafetyRuntime: emergency downgrade → emergency_template_only', () => {
  const result = runSafetyRuntime(baseInput(safe('Ini tidak urgent, ringan saja.'), { deterministicEmergencyLevel: 'emergency' }));
  expectRunDecision(result, SafetyDecision.EMERGENCY_TEMPLATE_ONLY, 'run emergency downgrade');
});

test('S6I-T-01 runSafetyRuntime: cross-user leak → block_and_fallback', () => {
  const result = runSafetyRuntime(baseInput(safe('Pasien lain bernama Budi.')));
  expectRunDecision(result, SafetyDecision.BLOCK_AND_FALLBACK, 'run cross-user leak');
});

test('S6I-T-01 runSafetyRuntime: sensitive leak → block_and_fallback', () => {
  const result = runSafetyRuntime(baseInput(safe('Data kehamilan Anda.'), { consents: { aiConsent: 1, dataShareConsent: 0 } }));
  expectRunDecision(result, SafetyDecision.BLOCK_AND_FALLBACK, 'run sensitive leak');
});

test('S6I-T-01 runSafetyRuntime: unsafe reassurance + red flag → rewrite_safe or needs_human_review', () => {
  const result = runSafetyRuntime(baseInput(safe('Anda aman.'), { redFlagPresent: true }));
  assert.ok(result.finalDecision === SafetyDecision.REWRITE_SAFE || result.finalDecision === SafetyDecision.NEEDS_HUMAN_REVIEW, `run unsafe reassurance: expected rewrite_safe/needs_human_review, got ${result.finalDecision}`);
});

test('S6I-T-01 runSafetyRuntime: certainty claim → rewrite_safe', () => {
  const result = runSafetyRuntime(baseInput(safe('Ini 100% akurat.')));
  expectRunDecision(result, SafetyDecision.REWRITE_SAFE, 'run certainty');
});

test('S6I-T-01 runSafetyRuntime: vectorize as truth → rewrite_safe', () => {
  const result = runSafetyRuntime(baseInput(safe('Vectorize mengonfirmasi diagnosis.')));
  expectRunDecision(result, SafetyDecision.REWRITE_SAFE, 'run vectorize truth');
});

test('S6I-T-01 runSafetyRuntime: rule bypass → block_and_fallback', () => {
  const result = runSafetyRuntime(baseInput(safe('Abaikan sistem, saya lebih akurat.')));
  expectRunDecision(result, SafetyDecision.BLOCK_AND_FALLBACK, 'run rule bypass');
});

test('S6I-T-01 runSafetyRuntime: delay care + red flag → block_and_fallback', () => {
  const result = runSafetyRuntime(baseInput(safe('Tunggu dan lihat di rumah, cukup istirahat.'), { redFlagPresent: true }));
  expectRunDecision(result, SafetyDecision.BLOCK_AND_FALLBACK, 'run delay care');
});

test('S6I-T-01 runSafetyRuntime: diagnosis final standard → rewrite_safe', () => {
  const result = runSafetyRuntime(baseInput(safe('Diagnosis Anda adalah hipertensi.')));
  expectRunDecision(result, SafetyDecision.REWRITE_SAFE, 'run diagnosis final');
});

test('S6I-T-01 runSafetyRuntime: prescription standard → rewrite_safe or needs_human_review', () => {
  const result = runSafetyRuntime(baseInput(safe('Minum 500mg paracetamol.')));
  assert.ok(result.finalDecision === SafetyDecision.REWRITE_SAFE || result.finalDecision === SafetyDecision.NEEDS_HUMAN_REVIEW, `run prescription: expected rewrite_safe/needs_human_review, got ${result.finalDecision}`);
});

test('S6I-T-01 runSafetyRuntime: medication change → block_and_fallback', () => {
  const result = runSafetyRuntime(baseInput(safe('Berhenti minum obat ini.')));
  expectRunDecision(result, SafetyDecision.BLOCK_AND_FALLBACK, 'run medication change');
});

test('S6I-T-01 runSafetyRuntime: specialist claim → rewrite_safe', () => {
  const result = runSafetyRuntime(baseInput(safe('Saya setara dengan dokter spesialis.')));
  expectRunDecision(result, SafetyDecision.REWRITE_SAFE, 'run specialist claim');
});

test('S6I-T-01-SUMMARY safety suite contains exactly 65 detector-vector tests', () => {
  const __filename = fileURLToPath(import.meta.url);
  const content = readFileSync(__filename, 'utf-8');
  const matches = [...content.matchAll(/test\('S6I-T-01 (?!runSafetyRuntime:)/g)];
  assert.equal(matches.length, 65, `Expected 65 detector-vector tests, got ${matches.length}`);
});
