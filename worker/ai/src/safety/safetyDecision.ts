export enum SafetyDecision {
  ALLOW = 'allow',
  ALLOW_WITH_DISCLAIMER = 'allow_with_disclaimer',
  REWRITE_SAFE = 'rewrite_safe',
  BLOCK_AND_FALLBACK = 'block_and_fallback',
  EMERGENCY_TEMPLATE_ONLY = 'emergency_template_only',
  NEEDS_HUMAN_REVIEW = 'needs_human_review',
}

export type OperatingMode = 'standard' | 'proactive' | 'super_aktif';
