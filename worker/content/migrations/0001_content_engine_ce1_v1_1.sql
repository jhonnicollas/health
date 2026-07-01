-- DB_SCHEMA.sql — iSehat Content Engine CE-1 v1.1
-- Target: Cloudflare D1 / SQLite
-- Scope: CE-1 Text Content Engine + Safety Checker
-- Based on: ISEHAT_CONTENT_ENGINE_SRS_v1.1_REVISED.md and ISEHAT_CONTENT_ENGINE_ARCHITECTURE_v1.1_REVISED.md
-- Date: 2026-07-01
--
-- Important CE-1 boundaries:
-- 1. D1 is the only source of truth for CE-1.
-- 2. CE-1 must run without R2, Vectorize, Queues, Workflows, OAuth, renderer, analytics import, or auto-publish.
-- 3. Repository/service-layer referential integrity checks are mandatory before insert/update.
-- 4. Foreign keys are intentionally not used in this migration to keep D1 migration behavior simple and aligned with the SRS repository-integrity rule.
-- 5. Secrets must never be stored plaintext in D1. Store only secretRef metadata.
-- 6. Every draft revision must receive exactly one safety report row before approval/export.
-- 7. Final export requires current revision, matching safety report, matching approval, and source trace if required.
--
-- Database binding: multi_Ai_db (b80ca989-6771-427f-a656-c7ab6ffc17ce)
-- Worker: worker/content/
-- Naming convention: tables con* (PascalCase after prefix), columns camelCase.
--

BEGIN TRANSACTION;

-- -----------------------------------------------------------------------------
-- 0. Migration tracking
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conSchemaMigrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  appliedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

-- -----------------------------------------------------------------------------
-- 1. Brand Memory
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conBrands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  positioning TEXT NOT NULL,
  productValueJson TEXT NOT NULL,
  targetAudienceJson TEXT,
  tone TEXT NOT NULL,
  languageDefault TEXT NOT NULL DEFAULT 'id'
    CHECK(languageDefault IN ('id','en','bilingual')),
  disclaimerTemplate TEXT,
  forbiddenClaimsJson TEXT NOT NULL,
  allowedClaimsJson TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2. Content Pillars
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conPillars (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL,
  targetAudience TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1 CHECK(isActive IN (0,1)),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(brandId, slug)
);

CREATE INDEX IF NOT EXISTS idxPillarsBrandActive
  ON conPillars(brandId, isActive);

CREATE INDEX IF NOT EXISTS idxPillarsBrandPriority
  ON conPillars(brandId, priority);

-- -----------------------------------------------------------------------------
-- 3. Campaigns
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conCampaigns (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL,
  targetPlatformsJson TEXT NOT NULL,
  pillarIdsJson TEXT NOT NULL,
  targetAudience TEXT,
  language TEXT NOT NULL DEFAULT 'id'
    CHECK(language IN ('id','en','bilingual')),
  startDate TEXT,
  endDate TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','active','paused','completed','archived')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxCampaignsBrandStatus
  ON conCampaigns(brandId, status);

CREATE INDEX IF NOT EXISTS idxCampaignsBrandCreated
  ON conCampaigns(brandId, createdAt);

-- -----------------------------------------------------------------------------
-- 4. Ideas — owns IdeaStatus
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conIdeas (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  campaignId TEXT NOT NULL,
  pillarId TEXT NOT NULL,
  title TEXT NOT NULL,
  angle TEXT NOT NULL,
  targetPlatform TEXT NOT NULL
    CHECK(targetPlatform IN ('instagram','linkedin')),
  contentFormat TEXT NOT NULL
    CHECK(contentFormat IN ('carousel','post','story_poll','reels_script')),
  targetAudience TEXT,
  painPoint TEXT,
  score INTEGER NOT NULL DEFAULT 0 CHECK(score >= 0 AND score <= 100),
  contentHash TEXT NOT NULL,
  sourceType TEXT NOT NULL DEFAULT 'ai_inferred'
    CHECK(sourceType IN ('official','medical_reference','platform_docs','competitor','social_observation','ai_inferred')),
  confidence TEXT NOT NULL DEFAULT 'medium'
    CHECK(confidence IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'idea'
    CHECK(status IN ('idea','idea_approved','rejected','archived')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(brandId, contentHash)
);

CREATE INDEX IF NOT EXISTS idxIdeasCampaignStatus
  ON conIdeas(campaignId, status);

CREATE INDEX IF NOT EXISTS idxIdeasBrandPlatform
  ON conIdeas(brandId, targetPlatform, contentFormat);

CREATE INDEX IF NOT EXISTS idxIdeasBrandStatusCreated
  ON conIdeas(brandId, status, createdAt);

CREATE INDEX IF NOT EXISTS idxIdeasPillar
  ON conIdeas(pillarId);

-- -----------------------------------------------------------------------------
-- 5. Drafts — owns DraftStatus and latest editable projection
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conDrafts (
  id TEXT PRIMARY KEY,
  ideaId TEXT,
  brandId TEXT NOT NULL,
  campaignId TEXT,
  platform TEXT NOT NULL CHECK(platform IN ('instagram','linkedin')),
  contentFormat TEXT NOT NULL
    CHECK(contentFormat IN ('carousel','post','story_poll','reels_script')),
  language TEXT NOT NULL DEFAULT 'id'
    CHECK(language IN ('id','en','bilingual')),
  currentRevision INTEGER NOT NULL DEFAULT 1 CHECK(currentRevision >= 1),
  primaryHook TEXT NOT NULL,
  hookAlternativesJson TEXT,
  mainContent TEXT NOT NULL,
  carouselSlidesJson TEXT,
  scriptJson TEXT,
  caption TEXT,
  cta TEXT,
  hashtagsJson TEXT,
  visualBriefJson TEXT,
  thumbnailText TEXT,
  altText TEXT,
  disclaimer TEXT,
  healthContentStatus TEXT NOT NULL DEFAULT 'uncertain'
    CHECK(healthContentStatus IN ('health_content','non_health_content','uncertain')),
  safetyStatus TEXT NOT NULL DEFAULT 'needs_check'
    CHECK(safetyStatus IN ('needs_check','safe','warning','blocked')),
  approvalStatus TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK(approvalStatus IN ('not_submitted','needs_review','approved','rejected','revision_requested')),
  status TEXT NOT NULL DEFAULT 'draft_ready'
    CHECK(status IN ('draft_generating','draft_ready','safety_checking','safety_safe','safety_warning','safety_blocked','needs_review','revision_requested','approved','exported','archived','failed')),
  publishReadinessScore INTEGER NOT NULL DEFAULT 0
    CHECK(publishReadinessScore >= 0 AND publishReadinessScore <= 100),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxDraftsBrandStatus
  ON conDrafts(brandId, status);

CREATE INDEX IF NOT EXISTS idxDraftsApproval
  ON conDrafts(approvalStatus, safetyStatus);

CREATE INDEX IF NOT EXISTS idxDraftsBrandCreated
  ON conDrafts(brandId, createdAt);

CREATE INDEX IF NOT EXISTS idxDraftsCampaign
  ON conDrafts(campaignId);

CREATE INDEX IF NOT EXISTS idxDraftsIdea
  ON conDrafts(ideaId);

-- -----------------------------------------------------------------------------
-- 6. Draft Revisions — immutable snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conDraftRevisions (
  id TEXT PRIMARY KEY,
  draftId TEXT NOT NULL,
  revisionNumber INTEGER NOT NULL CHECK(revisionNumber >= 1),
  snapshotJson TEXT NOT NULL,
  contentHash TEXT NOT NULL,
  changeReason TEXT,
  changedBy TEXT,
  createdAt TEXT NOT NULL,
  UNIQUE(draftId, revisionNumber)
);

CREATE INDEX IF NOT EXISTS idxRevisionsDraft
  ON conDraftRevisions(draftId, revisionNumber);

CREATE INDEX IF NOT EXISTS idxRevisionsHash
  ON conDraftRevisions(contentHash);

-- -----------------------------------------------------------------------------
-- 7. Safety Reports — mandatory per draft revision
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conSafetyReports (
  id TEXT PRIMARY KEY,
  draftId TEXT NOT NULL,
  revisionNumber INTEGER NOT NULL CHECK(revisionNumber >= 1),
  healthContentStatus TEXT NOT NULL
    CHECK(healthContentStatus IN ('health_content','non_health_content','uncertain')),
  safetyStatus TEXT NOT NULL CHECK(safetyStatus IN ('safe','warning','blocked')),
  blockedReasonsJson TEXT,
  warningsJson TEXT,
  rewrittenSuggestion TEXT,
  requiredDisclaimer TEXT,
  sourceTraceRequired INTEGER NOT NULL DEFAULT 0 CHECK(sourceTraceRequired IN (0,1)),
  checkerNote TEXT,
  checkedBy TEXT NOT NULL,
  modelUsed TEXT,
  promptVersionId TEXT,
  checkedAt TEXT NOT NULL,
  UNIQUE(draftId, revisionNumber)
);

CREATE INDEX IF NOT EXISTS idxSafetyDraftRevision
  ON conSafetyReports(draftId, revisionNumber);

CREATE INDEX IF NOT EXISTS idxSafetyStatus
  ON conSafetyReports(safetyStatus, healthContentStatus);

-- -----------------------------------------------------------------------------
-- 8. Source References — required if sourceTraceRequired=1
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conSourceReferences (
  id TEXT PRIMARY KEY,
  draftId TEXT NOT NULL,
  revisionNumber INTEGER NOT NULL CHECK(revisionNumber >= 1),
  title TEXT NOT NULL,
  url TEXT,
  sourceType TEXT NOT NULL
    CHECK(sourceType IN ('official','medical_reference','platform_docs','competitor','social_observation','ai_inferred')),
  sourceReliability TEXT
    CHECK(sourceReliability IN ('official','medical_reference','platform_docs','competitor','social_observation','ai_inferred')),
  confidence TEXT CHECK(confidence IN ('low','medium','high')),
  note TEXT,
  fetchedAt TEXT,
  createdAt TEXT NOT NULL,
  UNIQUE(draftId, revisionNumber, title, url)
);

CREATE INDEX IF NOT EXISTS idxSourcesDraftRevision
  ON conSourceReferences(draftId, revisionNumber);

CREATE INDEX IF NOT EXISTS idxSourcesType
  ON conSourceReferences(sourceType, confidence);

-- -----------------------------------------------------------------------------
-- 9. Approvals — reviewer decisions bound to draft revision
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conApprovals (
  id TEXT PRIMARY KEY,
  draftId TEXT NOT NULL,
  revisionNumber INTEGER NOT NULL CHECK(revisionNumber >= 1),
  status TEXT NOT NULL CHECK(status IN ('approved','rejected','revision_requested')),
  reviewerId TEXT NOT NULL,
  reviewerRole TEXT NOT NULL,
  reviewerNote TEXT,
  warningOverrideReason TEXT,
  approvedAt TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxApprovalsDraftRevision
  ON conApprovals(draftId, revisionNumber);

CREATE INDEX IF NOT EXISTS idxApprovalsStatusCreated
  ON conApprovals(status, createdAt);

-- Partial index: only one approved approval row per draft revision.
CREATE UNIQUE INDEX IF NOT EXISTS idxApprovalsOneApprovedPerRevision
  ON conApprovals(draftId, revisionNumber)
  WHERE status = 'approved';

-- -----------------------------------------------------------------------------
-- 10. Audit Logs — append-only operational audit trail
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conAuditLogs (
  id TEXT PRIMARY KEY,
  actorId TEXT,
  actorRole TEXT,
  action TEXT NOT NULL,
  targetType TEXT NOT NULL,
  targetId TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK(severity IN ('info','warning','critical')),
  beforeJson TEXT,
  afterJson TEXT,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxAuditTarget
  ON conAuditLogs(targetType, targetId);

CREATE INDEX IF NOT EXISTS idxAuditActionDate
  ON conAuditLogs(action, createdAt);

CREATE INDEX IF NOT EXISTS idxAuditActorDate
  ON conAuditLogs(actorId, createdAt);

-- -----------------------------------------------------------------------------
-- 11. AI Configs — metadata only, never raw secret values
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conAiConfigs (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  purpose TEXT NOT NULL
    CHECK(purpose IN ('idea_generation','draft_generation','safety_check','health_classifier')),
  temperature REAL CHECK(temperature IS NULL OR (temperature >= 0 AND temperature <= 2)),
  maxTokens INTEGER CHECK(maxTokens IS NULL OR maxTokens > 0),
  timeoutMs INTEGER CHECK(timeoutMs IS NULL OR timeoutMs > 0),
  fallbackOrder INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 1 CHECK(isActive IN (0,1)),
  secretRef TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxAiConfigsBrandPurpose
  ON conAiConfigs(brandId, purpose, isActive);

CREATE INDEX IF NOT EXISTS idxAiConfigsFallback
  ON conAiConfigs(brandId, purpose, isActive, fallbackOrder);

-- -----------------------------------------------------------------------------
-- 12. AI Prompt Versions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conAiPromptVersions (
  id TEXT PRIMARY KEY,
  promptKey TEXT NOT NULL,
  version INTEGER NOT NULL CHECK(version >= 1),
  promptText TEXT NOT NULL,
  modelRole TEXT,
  isActive INTEGER NOT NULL DEFAULT 0 CHECK(isActive IN (0,1)),
  createdBy TEXT,
  createdAt TEXT NOT NULL,
  UNIQUE(promptKey, version)
);

CREATE INDEX IF NOT EXISTS idxPromptsActive
  ON conAiPromptVersions(promptKey, isActive);

-- Only one active prompt per promptKey.
CREATE UNIQUE INDEX IF NOT EXISTS idxPromptsOneActive
  ON conAiPromptVersions(promptKey)
  WHERE isActive = 1;

-- -----------------------------------------------------------------------------
-- 13. AI Generation Jobs — synchronous-with-job-log in CE-1
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conAiGenerationJobs (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  jobType TEXT NOT NULL
    CHECK(jobType IN ('idea_generation','draft_generation','safety_check','health_classifier')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK(status IN ('queued','running','completed','failed','cancelled')),
  idempotencyKey TEXT NOT NULL,
  inputJson TEXT NOT NULL,
  outputJson TEXT,
  errorCode TEXT,
  errorMessage TEXT,
  modelUsed TEXT,
  promptVersionId TEXT,
  tokenUsageJson TEXT,
  attemptCount INTEGER NOT NULL DEFAULT 0 CHECK(attemptCount >= 0),
  maxAttempts INTEGER NOT NULL DEFAULT 3 CHECK(maxAttempts >= 1),
  startedAt TEXT,
  finishedAt TEXT,
  createdAt TEXT NOT NULL,
  UNIQUE(idempotencyKey)
);

CREATE INDEX IF NOT EXISTS idxJobsStatus
  ON conAiGenerationJobs(status, jobType);

CREATE INDEX IF NOT EXISTS idxJobsBrandCreated
  ON conAiGenerationJobs(brandId, createdAt);

CREATE INDEX IF NOT EXISTS idxJobsPrompt
  ON conAiGenerationJobs(promptVersionId);

-- -----------------------------------------------------------------------------
-- 14. AI Usage Logs — append-only
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conAiUsageLogs (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  jobId TEXT,
  provider TEXT,
  model TEXT,
  inputTokens INTEGER DEFAULT 0 CHECK(inputTokens >= 0),
  outputTokens INTEGER DEFAULT 0 CHECK(outputTokens >= 0),
  estimatedCostUsd REAL DEFAULT 0 CHECK(estimatedCostUsd >= 0),
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idxAiUsageBrandDate
  ON conAiUsageLogs(brandId, createdAt);

CREATE INDEX IF NOT EXISTS idxAiUsageJob
  ON conAiUsageLogs(jobId);

-- -----------------------------------------------------------------------------
-- 15. AI Quotas
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conAiQuotas (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  period TEXT NOT NULL CHECK(period IN ('daily','monthly')),
  maxJobs INTEGER CHECK(maxJobs IS NULL OR maxJobs >= 0),
  maxTokens INTEGER CHECK(maxTokens IS NULL OR maxTokens >= 0),
  maxCostUsd REAL CHECK(maxCostUsd IS NULL OR maxCostUsd >= 0),
  usedJobs INTEGER DEFAULT 0 CHECK(usedJobs >= 0),
  usedTokens INTEGER DEFAULT 0 CHECK(usedTokens >= 0),
  usedCostUsd REAL DEFAULT 0 CHECK(usedCostUsd >= 0),
  resetsAt TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(brandId, period, resetsAt)
);

CREATE INDEX IF NOT EXISTS idxAiQuotasBrandPeriod
  ON conAiQuotas(brandId, period, resetsAt);

-- -----------------------------------------------------------------------------
-- 16. Rate Limit Counters
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS conRateLimitCounters (
  id TEXT PRIMARY KEY,
  brandId TEXT NOT NULL,
  actorId TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  windowStart TEXT NOT NULL,
  windowEnd TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK(count >= 0),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(brandId, actorId, action, windowStart)
);

CREATE INDEX IF NOT EXISTS idxRateLimitLookup
  ON conRateLimitCounters(brandId, actorId, action, windowStart, windowEnd);

-- -----------------------------------------------------------------------------
-- 17. Seed: Default iSehat Brand
-- -----------------------------------------------------------------------------

INSERT OR IGNORE INTO conBrands (
  id,
  name,
  positioning,
  productValueJson,
  targetAudienceJson,
  tone,
  languageDefault,
  disclaimerTemplate,
  forbiddenClaimsJson,
  allowedClaimsJson,
  createdAt,
  updatedAt
) VALUES (
  'brand_isehat',
  'iSehat',
  'iSehat is a daily health companion that helps users record, understand, monitor, and prepare home health data for safer and clearer consultation. iSehat is not a diagnosis app and is not a doctor replacement.',
  '["Health measurement logging","Doctor-ready report","Family/caregiver monitoring with consent","AI-assisted input with manual override","Rule-first safety boundary"]',
  '["People who monitor health at home","Families and caregivers","Users preparing for doctor consultation","Founder/build-in-public audience"]',
  'Clear, trustworthy, human, practical, educational, not fearmongering, not overclaiming.',
  'id',
  'Konten ini bersifat edukatif dan bukan pengganti konsultasi medis. Jika mengalami keluhan berat, memburuk, atau kondisi darurat, segera hubungi tenaga medis.',
  '["AI doctor","guaranteed diagnosis","doctor replacement","prescription recommendation","dosage instruction","emergency authority","100% medical accuracy","guaranteed cure"]',
  '["iSehat helps users record health data","iSehat helps users understand health history","iSehat helps prepare doctor-ready reports","AI assists input and explanation, not final diagnosis","Manual override remains available","Content is educational, not medical consultation"]',
  datetime('now'),
  datetime('now')
);

-- -----------------------------------------------------------------------------
-- 18. Seed: CE-1 Default Content Pillars
-- -----------------------------------------------------------------------------

INSERT OR IGNORE INTO conPillars (
  id,
  brandId,
  name,
  slug,
  description,
  targetAudience,
  priority,
  isActive,
  createdAt,
  updatedAt
) VALUES
(
  'pillar_health_data_awareness',
  'brand_isehat',
  'Health Data Awareness',
  'health_data_awareness',
  'Educates users that daily health data is useful when recorded with context and reviewed over time.',
  'People who check blood pressure, glucose, SpO2, temperature, or symptoms at home.',
  10,
  1,
  datetime('now'),
  datetime('now')
),
(
  'pillar_doctor_ready_report',
  'brand_isehat',
  'Doctor-Ready Report',
  'doctor_ready_report',
  'Explains the value of organized health history and reports before consultation.',
  'Users preparing for doctor consultation and families helping relatives explain health patterns.',
  20,
  1,
  datetime('now'),
  datetime('now')
),
(
  'pillar_family_caregiver_monitoring',
  'brand_isehat',
  'Family/Caregiver Monitoring',
  'family_caregiver_monitoring',
  'Highlights family and caregiver use cases with consent-first monitoring.',
  'Adult children, caregivers, and family members supporting parents or relatives.',
  30,
  1,
  datetime('now'),
  datetime('now')
),
(
  'pillar_build_in_public',
  'brand_isehat',
  'Build in Public',
  'build_in_public',
  'Builds trust by sharing founder journey, product decisions, safety boundaries, and development progress.',
  'LinkedIn audience, founders, builders, early adopters, and healthtech observers.',
  40,
  1,
  datetime('now'),
  datetime('now')
);

-- -----------------------------------------------------------------------------
-- 19. Seed: CE-1 Prompt Versions
-- Prompts are intentionally short. Full production prompts may be expanded in PROMPTS_CE1_v1.1.md.
-- -----------------------------------------------------------------------------

INSERT OR IGNORE INTO conAiPromptVersions (
  id,
  promptKey,
  version,
  promptText,
  modelRole,
  isActive,
  createdBy,
  createdAt
) VALUES
(
  'prompt_idea_generation_v1',
  'idea_generation',
  1,
  'Generate safe, brand-consistent iSehat social content ideas. Output valid JSON only. Use the provided brand memory, campaign, pillars, platform, format, and language. Do not claim diagnosis, prescription, emergency authority, doctor replacement, guaranteed outcome, or 100% accuracy. Mark unsupported assumptions as ai_inferred and include confidence.',
  'system',
  1,
  'system_seed',
  datetime('now')
),
(
  'prompt_draft_generation_v1',
  'draft_generation',
  1,
  'Create a complete iSehat content draft from an approved idea. Output valid JSON only. Include hook, hook alternatives, main content, caption, CTA, hashtags, visual brief, alt text, and disclaimer when health topic is present. Avoid diagnosis, prescription, dosage, doctor replacement, emergency authority, guaranteed outcome, and fearmongering.',
  'system',
  1,
  'system_seed',
  datetime('now')
),
(
  'prompt_health_classifier_v1',
  'health_classifier',
  1,
  'Classify the draft revision as health_content, non_health_content, or uncertain. Health content includes symptoms, measurements, disease, medication, emergency signs, medical devices, doctor consultation, hydration/nutrition in health context, pregnancy/lactation/cycle, and any body/illness/risk/treatment/prevention/health outcome claim. Output valid JSON only.',
  'system',
  1,
  'system_seed',
  datetime('now')
),
(
  'prompt_safety_check_v1',
  'safety_check',
  1,
  'Review the draft revision for iSehat medical and brand safety. Output valid JSON only. Return safe, warning, or blocked. Block final diagnosis, doctor replacement, prescription/dosage instruction, emergency authority, guaranteed outcome, 100% accuracy, misleading medical device claims, and unsupported cure/prevention claims. Require source trace for statistical or specific medical factual claims.',
  'system',
  1,
  'system_seed',
  datetime('now')
);

-- -----------------------------------------------------------------------------
-- 20. Seed: Mock AI Configs for local/test bootstrap
-- Replace provider/model/secretRef in production via admin config.
-- -----------------------------------------------------------------------------

INSERT OR IGNORE INTO conAiConfigs (
  id,
  brandId,
  provider,
  model,
  purpose,
  temperature,
  maxTokens,
  timeoutMs,
  fallbackOrder,
  isActive,
  secretRef,
  createdAt,
  updatedAt
) VALUES
('ai_config_mock_idea_generation', 'brand_isehat', 'mock', 'mock-ce1', 'idea_generation', 0.7, 4000, 30000, 0, 1, NULL, datetime('now'), datetime('now')),
('ai_config_mock_draft_generation', 'brand_isehat', 'mock', 'mock-ce1', 'draft_generation', 0.7, 5000, 30000, 0, 1, NULL, datetime('now'), datetime('now')),
('ai_config_mock_health_classifier', 'brand_isehat', 'mock', 'mock-ce1', 'health_classifier', 0.1, 1000, 15000, 0, 1, NULL, datetime('now'), datetime('now')),
('ai_config_mock_safety_check', 'brand_isehat', 'mock', 'mock-ce1', 'safety_check', 0.1, 3000, 20000, 0, 1, NULL, datetime('now'), datetime('now'));

-- -----------------------------------------------------------------------------
-- 21. Seed: Default AI Quotas
-- Conservative defaults. Adjust via admin config before production use.
-- -----------------------------------------------------------------------------

INSERT OR IGNORE INTO conAiQuotas (
  id,
  brandId,
  period,
  maxJobs,
  maxTokens,
  maxCostUsd,
  usedJobs,
  usedTokens,
  usedCostUsd,
  resetsAt,
  createdAt,
  updatedAt
) VALUES
(
  'ai_quota_brand_isehat_daily_default',
  'brand_isehat',
  'daily',
  200,
  300000,
  10.00,
  0,
  0,
  0,
  date('now', '+1 day'),
  datetime('now'),
  datetime('now')
),
(
  'ai_quota_brand_isehat_monthly_default',
  'brand_isehat',
  'monthly',
  3000,
  5000000,
  100.00,
  0,
  0,
  0,
  date('now', 'start of month', '+1 month'),
  datetime('now'),
  datetime('now')
);

-- -----------------------------------------------------------------------------
-- 22. Mark migration applied
-- -----------------------------------------------------------------------------

INSERT OR IGNORE INTO conSchemaMigrations (id, name, appliedAt)
VALUES ('0001_content_engine_ce1_v1_1', 'Content Engine CE-1 v1.1 base schema', datetime('now'));

COMMIT;
