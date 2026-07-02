export const CONTENT_TYPES = ['educational', 'promotional', 'engagement', 'news', 'reminder'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ['draft', 'in_review', 'scheduled', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const IDEA_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const DRAFT_STATUSES = ['draft', 'ready_for_review', 'approved', 'rejected'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

export const REVISION_STATUSES = ['draft', 'current', 'archived'] as const;
export type RevisionStatus = (typeof REVISION_STATUSES)[number];

export const SAFETY_STATUSES = ['pending', 'pass', 'fail', 'warning', 'needs_review'] as const;
export type SafetyStatus = (typeof SAFETY_STATUSES)[number];

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested'] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const AI_PROVIDERS = ['mock', 'openai', 'google', 'anthropic'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_JOB_TYPES = ['idea_generation', 'draft_generation', 'health_classifier', 'safety_check'] as const;
export type AiJobType = (typeof AI_JOB_TYPES)[number];

export const AI_JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
export type AiJobStatus = (typeof AI_JOB_STATUSES)[number];

export const HEALTH_CONTENT_STATUSES = [
  'not_health',
  'consumer_health',
  'medical',
  'emergency',
  'sensitive',
] as const;
export type HealthContentStatus = (typeof HEALTH_CONTENT_STATUSES)[number];

export const HEALTH_CLAIM_STATUSES = ['none', 'verified', 'unsupported', 'disputed'] as const;
export type HealthClaimStatus = (typeof HEALTH_CLAIM_STATUSES)[number];

export const OPERATING_MODES = ['standard', 'proactive', 'super_aktif'] as const;
export type OperatingMode = (typeof OPERATING_MODES)[number];
