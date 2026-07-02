// Domain row types for conBrands, conPillars, conCampaigns.
// JSON columns are stored as strings in D1; services parse/stringify them.

export interface BrandRow {
  id: string;
  name: string;
  positioning: string;
  productValueJson: string;
  targetAudienceJson: string | null;
  tone: string;
  languageDefault: 'id' | 'en' | 'bilingual';
  disclaimerTemplate: string | null;
  forbiddenClaimsJson: string;
  allowedClaimsJson: string;
  createdAt: string;
  updatedAt: string;
}

export type BrandUpdateInput = Partial<
  Pick<
    BrandRow,
    | 'positioning'
    | 'productValueJson'
    | 'targetAudienceJson'
    | 'tone'
    | 'languageDefault'
    | 'disclaimerTemplate'
    | 'forbiddenClaimsJson'
    | 'allowedClaimsJson'
  >
>;

export interface PillarRow {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  description: string;
  targetAudience: string | null;
  priority: number;
  isActive: number; // D1 stores 0 or 1
  createdAt: string;
  updatedAt: string;
}

export interface PillarCreateInput {
  brandId: string;
  name: string;
  slug: string;
  description: string;
  targetAudience?: string;
  priority?: number;
  isActive?: boolean;
}

export type PillarUpdateInput = Partial<
  Pick<PillarRow, 'name' | 'description' | 'targetAudience' | 'priority' | 'isActive'>
>;

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface CampaignRow {
  id: string;
  brandId: string;
  name: string;
  objective: string;
  targetPlatformsJson: string;
  pillarIdsJson: string;
  targetAudience: string | null;
  language: 'id' | 'en' | 'bilingual';
  startDate: string | null;
  endDate: string | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignCreateInput {
  brandId: string;
  name: string;
  objective?: string;
  targetPlatformsJson: string | string[];
  pillarIdsJson: string | string[];
  targetAudience?: string;
  language?: 'id' | 'en' | 'bilingual';
  startDate?: string;
  endDate?: string;
  status?: CampaignStatus;
}

export type CampaignUpdateInput = Partial<
  Pick<
    CampaignRow,
    | 'name'
    | 'objective'
    | 'targetPlatformsJson'
    | 'pillarIdsJson'
    | 'targetAudience'
    | 'language'
    | 'startDate'
    | 'endDate'
    | 'status'
  >
>;

export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
}

// -----------------------------------------------------------------------------
// Ideas — conIdeas
// -----------------------------------------------------------------------------

export const IDEA_STATUSES = ['idea', 'idea_approved', 'rejected', 'archived'] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_PLATFORMS = ['instagram', 'linkedin'] as const;
export type IdeaPlatform = (typeof IDEA_PLATFORMS)[number];

export const IDEA_CONTENT_FORMATS = ['carousel', 'post', 'story_poll', 'reels_script'] as const;
export type IdeaContentFormat = (typeof IDEA_CONTENT_FORMATS)[number];

export const IDEA_SOURCE_TYPES = [
  'official',
  'medical_reference',
  'platform_docs',
  'competitor',
  'social_observation',
  'ai_inferred',
] as const;
export type IdeaSourceType = (typeof IDEA_SOURCE_TYPES)[number];

export const IDEA_CONFIDENCES = ['low', 'medium', 'high'] as const;
export type IdeaConfidence = (typeof IDEA_CONFIDENCES)[number];

export const CAMPAIGN_LANGUAGES = ['id', 'en', 'bilingual'] as const;
export type CampaignLanguage = (typeof CAMPAIGN_LANGUAGES)[number];

export interface IdeaRow {
  id: string;
  brandId: string;
  campaignId: string;
  pillarId: string;
  title: string;
  angle: string;
  targetPlatform: IdeaPlatform;
  contentFormat: IdeaContentFormat;
  targetAudience: string | null;
  painPoint: string | null;
  score: number;
  contentHash: string;
  sourceType: IdeaSourceType;
  confidence: IdeaConfidence;
  status: IdeaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaCreateInput {
  brandId: string;
  campaignId: string;
  pillarId: string;
  title: string;
  angle: string;
  targetPlatform: IdeaPlatform;
  contentFormat: IdeaContentFormat;
  targetAudience?: string | null;
  painPoint?: string | null;
  score?: number;
  contentHash: string;
  sourceType?: IdeaSourceType;
  confidence?: IdeaConfidence;
  status?: IdeaStatus;
}

export type IdeaUpdateInput = Partial<
  Pick<IdeaRow, 'status' | 'score' | 'confidence'>
>;

export interface IdeaListOptions {
  campaignId?: string;
  pillarId?: string;
  status?: IdeaStatus;
  targetPlatform?: IdeaPlatform;
  contentFormat?: IdeaContentFormat;
  page?: number;
  pageSize?: number;
}

// -----------------------------------------------------------------------------
// Drafts — conDrafts
// -----------------------------------------------------------------------------

export const DRAFT_PLATFORMS = ['instagram', 'linkedin'] as const;
export type DraftPlatform = (typeof DRAFT_PLATFORMS)[number];

export const DRAFT_CONTENT_FORMATS = ['carousel', 'post', 'story_poll', 'reels_script'] as const;
export type DraftContentFormat = (typeof DRAFT_CONTENT_FORMATS)[number];

export const DRAFT_LANGUAGES = ['id', 'en', 'bilingual'] as const;
export type DraftLanguage = (typeof DRAFT_LANGUAGES)[number];

export const DRAFT_HEALTH_CONTENT_STATUSES = [
  'health_content',
  'non_health_content',
  'uncertain',
] as const;
export type DraftHealthContentStatus = (typeof DRAFT_HEALTH_CONTENT_STATUSES)[number];

export const DRAFT_SAFETY_STATUSES = [
  'needs_check',
  'safe',
  'warning',
  'blocked',
] as const;
export type DraftSafetyStatus = (typeof DRAFT_SAFETY_STATUSES)[number];

export const DRAFT_APPROVAL_STATUSES = [
  'not_submitted',
  'needs_review',
  'approved',
  'rejected',
  'revision_requested',
] as const;
export type DraftApprovalStatus = (typeof DRAFT_APPROVAL_STATUSES)[number];

export const DRAFT_LIFECYCLE_STATUSES = [
  'draft_generating',
  'draft_ready',
  'safety_checking',
  'safety_safe',
  'safety_warning',
  'safety_blocked',
  'needs_review',
  'revision_requested',
  'approved',
  'exported',
  'archived',
  'failed',
] as const;
export type DraftLifecycleStatus = (typeof DRAFT_LIFECYCLE_STATUSES)[number];

export interface DraftRow {
  id: string;
  ideaId: string | null;
  brandId: string;
  campaignId: string | null;
  platform: DraftPlatform;
  contentFormat: DraftContentFormat;
  language: DraftLanguage;
  currentRevision: number;
  primaryHook: string;
  hookAlternativesJson: string | null;
  mainContent: string;
  carouselSlidesJson: string | null;
  scriptJson: string | null;
  caption: string | null;
  cta: string | null;
  hashtagsJson: string | null;
  visualBriefJson: string | null;
  thumbnailText: string | null;
  altText: string | null;
  disclaimer: string | null;
  healthContentStatus: DraftHealthContentStatus;
  safetyStatus: DraftSafetyStatus;
  approvalStatus: DraftApprovalStatus;
  status: DraftLifecycleStatus;
  publishReadinessScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftUpdateInput {
  primaryHook?: string;
  hookAlternativesJson?: string | null;
  mainContent?: string;
  carouselSlidesJson?: string | null;
  scriptJson?: string | null;
  caption?: string | null;
  cta?: string | null;
  hashtagsJson?: string | null;
  visualBriefJson?: string | null;
  thumbnailText?: string | null;
  altText?: string | null;
  disclaimer?: string | null;
  changeReason: string;
}

export interface DraftListOptions {
  campaignId?: string;
  ideaId?: string;
  platform?: DraftPlatform;
  contentFormat?: DraftContentFormat;
  status?: DraftLifecycleStatus;
  safetyStatus?: DraftSafetyStatus;
  approvalStatus?: DraftApprovalStatus;
  healthContentStatus?: DraftHealthContentStatus;
  page?: number;
  pageSize?: number;
}

// -----------------------------------------------------------------------------
// Draft revisions — conDraftRevisions (immutable snapshots)
// -----------------------------------------------------------------------------

export interface DraftRevisionRow {
  id: string;
  draftId: string;
  revisionNumber: number;
  snapshotJson: string;
  contentHash: string;
  changeReason: string | null;
  changedBy: string | null;
  createdAt: string;
}

