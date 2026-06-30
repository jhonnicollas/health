import { SafetyDecision } from './safetyDecision.js';
import { renderBlockedTemplate } from './blockedTemplate.js';
import {
  missingDisclaimerDetector,
  emergencySeverityDowngradeDetector,
  crossUserLeakDetector,
  sensitiveDataLeakDetector,
  ruleEngineBypassDetector,
  delayMedicalCareDetector,
  medicationChangeDetector,
  unsafeReassuranceDetector,
  certaintyClaimDetector,
  vectorizeAsTruthDetector,
  diagnosisFinalDetector,
  prescriptionDosageDetector,
  specialistClaimDetector,
  type DetectorInput,
  type DetectorResult,
} from './detectors.js';

export interface SafetyRuntimeResult {
  finalDecision: SafetyDecision;
  output: string;
  flags: Array<{
    flagCode: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    actionTaken: SafetyDecision;
    detectedTextPreview?: string;
  }>;
}

const BLOCK_DETECTORS = [
  { code: 'missingDisclaimerDetector', fn: missingDisclaimerDetector },
  { code: 'emergencySeverityDowngradeDetector', fn: emergencySeverityDowngradeDetector },
  { code: 'crossUserLeakDetector', fn: crossUserLeakDetector },
  { code: 'sensitiveDataLeakDetector', fn: sensitiveDataLeakDetector },
  { code: 'ruleEngineBypassDetector', fn: ruleEngineBypassDetector },
  { code: 'delayMedicalCareDetector', fn: delayMedicalCareDetector },
  { code: 'medicationChangeDetector', fn: medicationChangeDetector },
];

const REWRITE_DETECTORS = [
  { code: 'unsafeReassuranceDetector', fn: unsafeReassuranceDetector },
  { code: 'certaintyClaimDetector', fn: certaintyClaimDetector },
  { code: 'vectorizeAsTruthDetector', fn: vectorizeAsTruthDetector },
  { code: 'diagnosisFinalDetector', fn: diagnosisFinalDetector },
  { code: 'prescriptionDosageDetector', fn: prescriptionDosageDetector },
  { code: 'specialistClaimDetector', fn: specialistClaimDetector },
];

function recordFlag(
  flags: SafetyRuntimeResult['flags'],
  code: string,
  result: DetectorResult
): void {
  if (result.decision !== SafetyDecision.ALLOW) {
    flags.push({
      flagCode: code,
      severity: result.severity ?? 'medium',
      actionTaken: result.decision,
      detectedTextPreview: result.detectedTextPreview,
    });
  }
}

export function runSafetyRuntime(input: DetectorInput): SafetyRuntimeResult {
  const flags: SafetyRuntimeResult['flags'] = [];

  // Phase 1 — block detectors
  for (const { code, fn } of BLOCK_DETECTORS) {
    const result = fn(input);
    if (result.decision !== SafetyDecision.ALLOW) {
      recordFlag(flags, code, result);
      if (
        result.decision === SafetyDecision.BLOCK_AND_FALLBACK ||
        result.decision === SafetyDecision.EMERGENCY_TEMPLATE_ONLY
      ) {
        return {
          finalDecision: result.decision,
          output: result.emergencyText ?? renderBlockedTemplate(input.locale ?? 'id'),
          flags,
        };
      }
    }
  }

  // Phase 2 — rewrite detectors (chain: each detector scans progressively-rewritten output)
  let output = input.aiOutput;
  for (const { code, fn } of REWRITE_DETECTORS) {
    const result = fn({ ...input, aiOutput: output });
    if (result.decision === SafetyDecision.REWRITE_SAFE && result.rewrite) {
      recordFlag(flags, code, result);
      output = result.rewrite;
    }
  }

  // Disclaimer presence check: if missing disclaimer in final output, mark allow_with_disclaimer
  const footer = output.slice(-200).toLowerCase();
  const hasDisclaimer = /ai dapat melakukan kesalahan|ai can make mistakes/.test(footer);

  // Needs human review: any flag with severity high/critical from a rewrite detector
  const hasCriticalFlag = flags.some(
    (f) => (f.severity === 'high' || f.severity === 'critical')
      && f.actionTaken === SafetyDecision.REWRITE_SAFE
  );

  let finalDecision: SafetyDecision;
  if (hasCriticalFlag) {
    finalDecision = SafetyDecision.NEEDS_HUMAN_REVIEW;
  } else if (flags.length > 0) {
    finalDecision = SafetyDecision.REWRITE_SAFE;
  } else if (hasDisclaimer) {
    finalDecision = SafetyDecision.ALLOW;
  } else {
    finalDecision = SafetyDecision.ALLOW_WITH_DISCLAIMER;
  }

  return { finalDecision, output, flags };
}
