// PromptVersionLoader — loads active prompt version from KV cache, D1 fallback.
// PRD §3 S6B §8: Flow:
//   1. Check KV (key: prompt:{taskCode}:active) → contentHash
//   2. If KV miss → query D1 HL_promptVersions WHERE promptCode=? AND status='active'
//   3. Return contentText + version + contentHash
//   4. Cache to KV with TTL 300s
// PRD §8.11: KV cache key pattern `prompt:{taskCode}:active` TTL 300s.

import type { Bindings } from '../types.js';
import type { OperatingMode } from '../safety/safetyDecision.js';

export interface PromptVersion {
  promptCode: string;
  version: string;
  contentHash: string;
  contentText: string;
}

/**
 * Load the active prompt version for a given task code.
 * KV cache first (key: prompt:{taskCode}:active), D1 fallback.
 */
export async function loadPromptVersion(
  env: Bindings,
  taskCode: string
): Promise<PromptVersion | null> {
  const cacheKey = `prompt:${taskCode}:active`;

  // KV cache check
  if (env.AI_KV) {
    try {
      const cached = await env.AI_KV.get<PromptVersion>(cacheKey, 'json');
      if (cached && typeof cached === 'object' && cached.contentText) {
        return cached;
      }
    } catch {
      // KV miss or error — fall through to D1
    }
  }

  // D1 fallback
  try {
    const row = await env.DB.prepare(
      `SELECT promptCode, version, contentHash, contentText
       FROM HL_promptVersions
       WHERE promptCode = ? AND status = 'active'
       ORDER BY activatedAt DESC, createdAt DESC
       LIMIT 1`
    ).bind(taskCode).first<PromptVersion>();

    if (!row) return null;

    // Cache to KV with 300s TTL (PRD §8.11)
    if (env.AI_KV) {
      try {
        await env.AI_KV.put(cacheKey, JSON.stringify(row), { expirationTtl: 300 });
      } catch {
        // KV write failure is non-fatal
      }
    }

    return row;
  } catch (error) {
    console.error('loadPromptVersion failed:', error);
    return null;
  }
}

/**
 * Invalidate the KV cache for a prompt code (e.g. after admin activation).
 * PRD §5 S6H: activation deactivates previous, KV cache invalidated.
 */
export async function invalidatePromptCache(
  env: Bindings,
  taskCode: string
): Promise<void> {
  if (env.AI_KV) {
    try {
      await env.AI_KV.delete(`prompt:${taskCode}:active`);
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Build a system prompt with mode-specific forbidden actions injected.
 * PRD §0.3: Operating mode determines forbidden actions.
 * PRD §9.3: forbiddenActions + modeSpecificForbiddenActions in context package.
 */
export function buildSystemPrompt(
  basePrompt: string,
  operatingMode: OperatingMode,
  contextJson: string
): string {
  const baseForbidden = [
    'cross_user_access',
    'missing_consent',
    'emergency_severity_downgrade',
    'medication_change',
    'delay_medical_care',
    'rule_engine_bypass',
  ];

  const modeSpecific: Record<OperatingMode, string[]> = {
    standard: ['diagnosis_final', 'prescription_or_dosage', 'specialist_claim'],
    proactive: ['prescription_or_dosage', 'specialist_claim'],
    super_aktif: [],
  };

  const allForbidden = [...baseForbidden, ...modeSpecific[operatingMode]];

  const modeRules = operatingMode === 'standard'
    ? `ABSOLUTE RULES (STANDARD MODE):
- You MUST NOT give a final diagnosis. Use "kemungkinan" (possibility) language.
- You MUST NOT prescribe medication or give dosage instructions.
- You MUST NOT claim equivalence to a specialist doctor.
- You MUST NOT change or stop user's medications.`
    : operatingMode === 'proactive'
    ? `ABSOLUTE RULES (PROACTIVE MODE):
- You MAY give a final diagnosis.
- You MUST NOT prescribe medication or give dosage instructions.
- You MUST NOT claim equivalence to a specialist doctor.
- You MUST NOT change or stop user's medications.`
    : `ABSOLUTE RULES (SUPER AKTIF MODE):
- You MAY give a final diagnosis.
- You MAY prescribe medication and give dosage instructions.
- You MAY claim equivalence to a specialist doctor.
- You MUST NOT change or stop user's medications.`;

  return `${basePrompt}

${modeRules}

FORBIDDEN ACTIONS: ${allForbidden.join(', ')}

CLINICAL CONTEXT:
${contextJson}

MANDATORY: Every medical response MUST end with this disclaimer:
"AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA."`;
}
