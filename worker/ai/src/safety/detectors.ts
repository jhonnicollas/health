import { SafetyDecision, type OperatingMode } from './safetyDecision.js';

export interface SafetyConsents {
  aiConsent?: number;
  dataShareConsent?: number;
  emergencyConsent?: number;
}

export interface ContextTraceItem {
  type: string;
  id: number;
  summary?: string;
}

export interface SafetyContextPackage {
  userId: number;
  contextTrace: ContextTraceItem[];
}

export interface DetectorInput {
  aiOutput: string;
  locale?: 'id' | 'en';
  deterministicEmergencyLevel?: 'emergency' | 'warning' | 'none';
  redFlagPresent?: boolean;
  operatingMode?: OperatingMode;
  consents?: SafetyConsents;
  contextPackage?: SafetyContextPackage;
  deterministicRuleResult?: string;
}

export interface DetectorResult {
  decision: SafetyDecision;
  rewrite?: string;
  emergencyText?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  detectedTextPreview?: string;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  const normalized = text.toLowerCase();
  return patterns.some((re) => re.test(normalized));
}

function firstMatch(text: string, patterns: RegExp[]): string | undefined {
  const normalized = text.toLowerCase();
  for (const re of patterns) {
    const m = normalized.match(re);
    if (m) return m[0];
  }
  return undefined;
}

// 3.1 missingDisclaimerDetector
export function missingDisclaimerDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, locale = 'id' } = input;
  const footer = aiOutput.slice(-200);

  const idMarkers = /ai dapat melakukan kesalahan|tidak boleh mengandalkan ai 100%|tidak boleh percaya ai 100%|tanggung jawab anda/;
  const enMarkers = /ai can make mistakes|do not rely on ai 100%|do not trust ai 100%|your responsibility/;

  const hasMarker = locale === 'en' ? enMarkers.test(footer.toLowerCase()) : idMarkers.test(footer.toLowerCase());

  if (!hasMarker) {
    return {
      decision: SafetyDecision.BLOCK_AND_FALLBACK,
      severity: 'critical',
      detectedTextPreview: footer.slice(0, 200),
    };
  }

  // Malformed checks: hidden/commented/truncated
  const malformed = /<!--[\s\S]*?disclaimer[\s\S]*?-->|style=\"display:\s*none\"|<meta[^>]*disclaimer|\.\.\.$/.test(footer.toLowerCase());
  if (malformed) {
    return {
      decision: SafetyDecision.BLOCK_AND_FALLBACK,
      severity: 'critical',
      detectedTextPreview: footer.slice(0, 200),
    };
  }

  return { decision: SafetyDecision.ALLOW };
}

// 3.2 emergencySeverityDowngradeDetector
export function emergencySeverityDowngradeDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, deterministicEmergencyLevel = 'none' } = input;
  if (deterministicEmergencyLevel !== 'emergency') {
    return { decision: SafetyDecision.ALLOW };
  }
  const patterns = [
    /tidak urgent/,
    /not urgent/,
    /tidak perlu khawatir/,
    /no need to worry/,
    /bisa ditunda/,
    /can wait/,
    /keparahan:\s*normal/,
    /severity:\s*normal/,
    /ringan saja/,
    /mild concern/,
    /cukup dipantau/,
    /just monitor/,
    /tidak serius/,
    /not serious/,
    /wait and see/,
    /coba lagi besok/,
    /try again tomorrow/,
  ];
  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.EMERGENCY_TEMPLATE_ONLY,
      severity: 'critical',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      emergencyText: `⚠️ PERINGATAN DARURAT\nBerdasarkan data yang tercatat, Anda memiliki tanda bahaya yang memerlukan perhatian medis segera. JANGAN menunda. Segera hubungi:\n- Layanan Darurat: 119 / 112\n- Fasilitas Kesehatan terdekat\n- Contact caregiver Anda (jika tersedia)`,
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.3 crossUserLeakDetector
export function crossUserLeakDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, contextPackage } = input;
  const otherUserPatterns = [
    /pasien lain/,
    /other patient/,
    /user lain/,
    /pengguna lain/,
    /anggota keluarga lain:\s*(?!\bsaya\b)/,
  ];
  if (matchesAny(aiOutput, otherUserPatterns)) {
    return {
      decision: SafetyDecision.BLOCK_AND_FALLBACK,
      severity: 'critical',
      detectedTextPreview: firstMatch(aiOutput, otherUserPatterns),
    };
  }

  // If contextPackage provided, verify every referenced medication/symptom traces back.
  if (contextPackage && contextPackage.contextTrace.length > 0) {
    const traceableTypes = new Set(contextPackage.contextTrace.map((t) => `${t.type}:${t.id}`));
    // Heuristic: if output mentions specific meds/symptoms not in trace → leak risk
    const medicationLeak = /(?:obat|medication|resep)\s+([a-z0-9\s]+)/i.exec(aiOutput);
    if (medicationLeak) {
      const hasMedicationTrace = contextPackage.contextTrace.some((t) => t.type === 'medication');
      if (!hasMedicationTrace) {
        return {
          decision: SafetyDecision.BLOCK_AND_FALLBACK,
          severity: 'critical',
          detectedTextPreview: medicationLeak[0].slice(0, 200),
        };
      }
    }
  }

  return { decision: SafetyDecision.ALLOW };
}

// 3.4 sensitiveDataLeakDetector
const AI_CONSENT_ONLY_PATTERNS = [
  /gejala merah/,
  /red flag/,
  /detail gejala/,
  /symptom detail/,
  /catatan dokter/,
  /doctor report/,
  /ai memory/,
  /memori ai/,
  /whatsapp message/,
  /pesan whatsapp/,
  /chat ai/,
  /ai chat/,
  /konteks klinis ai/,
  /ai clinical context/,
];

const DUAL_CONSENT_PATTERNS = [
  /menstruasi/,
  /menstruation/,
  /kehamilan/,
  /pregnancy/,
  /laktasi/,
  /lactation/,
  /menopause/,
  /siklus/,
  /cycle/,
  /data keluarga/,
  /family data/,
];

export function sensitiveDataLeakDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, consents = {} } = input;

  if (matchesAny(aiOutput, AI_CONSENT_ONLY_PATTERNS)) {
    if (consents.aiConsent !== 1) {
      return {
        decision: SafetyDecision.BLOCK_AND_FALLBACK,
        severity: 'high',
        detectedTextPreview: firstMatch(aiOutput, AI_CONSENT_ONLY_PATTERNS),
      };
    }
  }

  if (matchesAny(aiOutput, DUAL_CONSENT_PATTERNS)) {
    if (consents.aiConsent !== 1 || consents.dataShareConsent !== 1) {
      return {
        decision: SafetyDecision.BLOCK_AND_FALLBACK,
        severity: 'high',
        detectedTextPreview: firstMatch(aiOutput, DUAL_CONSENT_PATTERNS),
      };
    }
  }

  return { decision: SafetyDecision.ALLOW };
}

// 3.5 unsafeReassuranceDetector
export function unsafeReassuranceDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, redFlagPresent = false } = input;
  if (!redFlagPresent) return { decision: SafetyDecision.ALLOW };

  const patterns = [
    /anda aman/,
    /you're safe/,
    /you are safe/,
    /you're fine/,
    /you are fine/,
    /tidak perlu khawatir/,
    /no need to worry/,
    /mungkin tidak ada apa-apa/,
    /probably nothing/,
    /aman untuk menunggu/,
    /safe to wait/,
    /pantauan cukup/,
    /monitoring is enough/,
    /tidak serius/,
    /not serious/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.REWRITE_SAFE,
      severity: 'high',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      rewrite: 'Berdasarkan data Anda, terdapat tanda yang perlu dievaluasi oleh dokter. Jangan mengabaikan tanda bahaya. Konsultasikan dengan fasilitas kesehatan.',
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.6 certaintyClaimDetector
export function certaintyClaimDetector(input: DetectorInput): DetectorResult {
  const { aiOutput } = input;
  const patterns = [
    /100% akurat/,
    /100% accurate/,
    /pasti benar/,
    /definitely/,
    /absolutely certain/,
    /tidak mungkin salah/,
    /cannot be wrong/,
    /dijamin benar/,
    /guaranteed correct/,
    /sangat yakin/,
    /very confident/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.REWRITE_SAFE,
      severity: 'medium',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      rewrite: 'AI dapat melakukan kesalahan. Informasi ini bersifat kemungkinan, bukan kepastian.',
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.7 vectorizeAsTruthDetector
export function vectorizeAsTruthDetector(input: DetectorInput): DetectorResult {
  const { aiOutput } = input;
  const patterns = [
    /vectorize mengonfirmasi/,
    /vectorize confirms/,
    /database memori menunjukkan/,
    /memory database shows/,
    /catatan tersimpan anda membuktikan/,
    /your stored records prove/,
    /data terindeks definitif menunjukkan/,
    /indexed records definitively show/,
    /berdasarkan rekam medis tersimpan/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.REWRITE_SAFE,
      severity: 'medium',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      rewrite: 'Vectorize adalah memori semantik untuk membantu konteks, bukan bukti klinis final. Selalu konsultasikan dengan dokter untuk diagnosis pasti.',
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.8 ruleEngineBypassDetector
export function ruleEngineBypassDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, deterministicRuleResult } = input;
  const patterns = [
    /aturan mesin salah/,
    /the rule is wrong/,
    /saya menilai lebih akurat/,
    /i assess more accurately/,
    /abaikan sistem/,
    /ignore the system/,
    /user tahu lebih baik/,
    /user knows better/,
    /rule engine is unnecessary/,
    /mesin aturan tidak perlu/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.BLOCK_AND_FALLBACK,
      severity: 'critical',
      detectedTextPreview: firstMatch(aiOutput, patterns),
    };
  }

  // If deterministic rule says emergency but AI downgrades -> caught by emergencySeverityDowngradeDetector
  return { decision: SafetyDecision.ALLOW };
}

// 3.9 delayMedicalCareDetector
export function delayMedicalCareDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, redFlagPresent = false } = input;
  if (!redFlagPresent) return { decision: SafetyDecision.ALLOW };

  const patterns = [
    /tunggu dan lihat/,
    /wait and see/,
    /coba lagi besok/,
    /try again tomorrow/,
    /tidak perlu buru-buru/,
    /no rush/,
    /pantau di rumah/,
    /monitor at home/,
    /tidak cukup serius/,
    /not serious enough/,
    /tidak perlu ke dokter sekarang/,
    /no need to see doctor now/,
    /cukup istirahat/,
    /just rest/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.BLOCK_AND_FALLBACK,
      severity: 'critical',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      emergencyText: `⚠️ PERINGATAN DARURAT\nBerdasarkan data yang tercatat, Anda memiliki tanda bahaya yang memerlukan perhatian medis segera. JANGAN menunda. Segera hubungi:\n- Layanan Darurat: 119 / 112\n- Fasilitas Kesehatan terdekat\n- Contact caregiver Anda (jika tersedia)`,
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.10 diagnosisFinalDetector
export function diagnosisFinalDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, operatingMode = 'standard' } = input;
  if (operatingMode !== 'standard') return { decision: SafetyDecision.ALLOW };

  const patterns = [
    /diagnosis anda adalah/,
    /your diagnosis is/,
    /anda menderita/,
    /you have\s+[a-z]/,
    /ini mengonfirmasi/,
    /this confirms/,
    /diagnosis:\s*/,
    /berdasarkan hasil, anda memiliki/,
    /based on results, you have/,
    /anda terkena/,
    /you are suffering from/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.REWRITE_SAFE,
      severity: 'low',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      rewrite: 'Kemungkinan yang perlu dipertimbangkan termasuk [X]. Namun, ini bukan diagnosis final. Konsultasikan dengan dokter untuk diagnosis yang pasti.',
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.11 prescriptionDosageDetector
export function prescriptionDosageDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, operatingMode = 'standard' } = input;
  if (operatingMode === 'super_aktif') return { decision: SafetyDecision.ALLOW };

  const patterns = [
    /minum\s+\d+\s*mg/,
    /take\s+\d+\s*mg/,
    /saya merekomendasikan obat/,
    /i recommend medication/,
    /anda harus minum/,
    /you should take/,
    /dosis yang tepat adalah/,
    /the dosage is/,
    /mulai dengan\s+\d+\s*mg/,
    /start with\s+\d+\s*mg/,
    /resep untuk anda/,
    /prescription for you/,
    /[a-z]+\s+\d+\s*mg/, // drug + dosage
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.REWRITE_SAFE,
      severity: 'high',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      rewrite: 'Pemberian resep dan dosis obat harus dilakukan oleh dokter. Konsultasikan dengan dokter atau apoteker untuk resep dan dosis yang tepat.',
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.12 medicationChangeDetector
export function medicationChangeDetector(input: DetectorInput): DetectorResult {
  const { aiOutput } = input;
  const patterns = [
    /berhenti minum/,
    /stop taking/,
    /ganti ke/,
    /switch to/,
    /kurangi dosis/,
    /reduce your dose/,
    /naikkan dosis/,
    /increase your dose/,
    /dobel dosis/,
    /double your dose/,
    /anda tidak butuh obat ini lagi/,
    /you don't need this anymore/,
    /hentikan pengobatan/,
    /stop the medication/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.BLOCK_AND_FALLBACK,
      severity: 'critical',
      detectedTextPreview: firstMatch(aiOutput, patterns),
    };
  }
  return { decision: SafetyDecision.ALLOW };
}

// 3.13 specialistClaimDetector
export function specialistClaimDetector(input: DetectorInput): DetectorResult {
  const { aiOutput, operatingMode = 'standard' } = input;
  if (operatingMode === 'super_aktif') return { decision: SafetyDecision.ALLOW };

  const patterns = [
    /saya setara dengan dokter spesialis/,
    /i'm equal to a specialist/,
    /analisis saya sama dengan dokter/,
    /my analysis matches a doctor/,
    /saya punya akurasi dokter/,
    /i have doctor-level accuracy/,
    /saya sekompeten spesialis/,
    /i'm as capable as a specialist/,
    /percaya saja, saya setara md/,
    /trust me, i'm equivalent to md/,
  ];

  if (matchesAny(aiOutput, patterns)) {
    return {
      decision: SafetyDecision.REWRITE_SAFE,
      severity: 'medium',
      detectedTextPreview: firstMatch(aiOutput, patterns),
      rewrite: 'AI adalah asisten kesehatan, bukan pengganti dokter spesialis. Konsultasikan dengan dokter untuk evaluasi medis yang komprehensif.',
    };
  }
  return { decision: SafetyDecision.ALLOW };
}
