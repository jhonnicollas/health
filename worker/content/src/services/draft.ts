import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString, validateEnum } from '../utils/validation.js';
import { prescanDraft } from '../utils/safety-prescan.js';
import type {
  DraftHealthContentStatus,
  DraftLanguage,
  DraftListOptions,
  DraftPlatform,
  DraftRevisionRow,
  DraftRow,
  Paginated,
} from '../types/domain.js';
import { DRAFT_LANGUAGES, DRAFT_PLATFORMS } from '../types/domain.js';
import type { AuditActor, AuditService } from './audit.js';
import { IntegrityService } from './integrity.js';
import { DraftRepository } from '../repositories/draft.js';
import { IdeaRepository } from '../repositories/idea.js';
import { CampaignRepository } from '../repositories/campaign.js';
import { BrandRepository } from '../repositories/brand.js';
import { RevisionRepository } from '../repositories/revision.js';
import { AiConfigRepository } from '../repositories/ai-config.js';
import { AiJobService } from './ai-job.js';
import { QuotaService } from './quota.js';
import { UsageService } from './usage.js';
import { RateLimitService, type RateLimitAction } from './rate-limit.js';
import {
  PromptContextBuilder,
  type PromptLoader,
} from './prompt-context.js';
import {
  generateWithProvider,
  selectConfig,
} from './ai-provider.js';
import type { AiConfigRow, AiPurpose } from '../types/ai.js';

export interface DraftServiceDeps {
  db: D1Database;
  repo: DraftRepository;
  revisionRepo: RevisionRepository;
  ideaRepo: IdeaRepository;
  campaignRepo: CampaignRepository;
  brandRepo: BrandRepository;
  aiConfigRepo: AiConfigRepository;
  promptLoader: PromptLoader;
  aiJobs: AiJobService;
  quota: QuotaService;
  usage: UsageService;
  rateLimit: RateLimitService;
  audit: AuditService;
  integrity: IntegrityService;
}

export interface DraftGenerateInput {
  language?: DraftLanguage;
  toneVariant?: string;
  platform?: DraftPlatform;
  contentFormat?: 'carousel' | 'post' | 'story_poll' | 'reels_script';
}

export interface DraftGenerateResult {
  jobId: string;
  jobStatus: 'completed' | 'failed';
  draftId: string;
  revisionNumber: number;
  status: DraftRow['status'];
  safetyStatus: DraftRow['safetyStatus'];
  approvalStatus: DraftRow['approvalStatus'];
}

export interface DraftUpdateApiInput {
  primaryHook?: string;
  hookAlternativesJson?: unknown;
  mainContent?: string;
  carouselSlidesJson?: unknown;
  scriptJson?: unknown;
  caption?: unknown;
  cta?: unknown;
  hashtagsJson?: unknown;
  visualBriefJson?: unknown;
  thumbnailText?: unknown;
  altText?: unknown;
  disclaimer?: unknown;
  changeReason?: string;
}

function randomSuffix(len = 12): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function encodeJsonField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed);
    } catch {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'JSON field must be valid JSON string',
        400
      );
    }
  }
  return JSON.stringify(value);
}

interface AiDraftOutput {
  primaryHook?: string;
  hookAlternatives?: string[];
  mainContent?: string;
  carouselSlides?: unknown[];
  script?: unknown;
  caption?: string;
  cta?: string;
  hashtags?: string[];
  visualBrief?: unknown;
  thumbnailText?: string;
  altText?: string;
  disclaimer?: string;
}

export class DraftService {
  constructor(private deps: DraftServiceDeps) {}

  async list(brandId: string, options: DraftListOptions = {}): Promise<Paginated<DraftRow>> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const { items, total } = await this.deps.repo.findByBrand(brandId, options);
    return {
      items,
      pagination: {
        page,
        pageSize,
        total,
        hasNext: page * pageSize < total,
      },
    };
  }

  async generate(
    ideaId: string,
    input: DraftGenerateInput,
    actor: AuditActor,
    idempotencyKey: string
  ): Promise<DraftGenerateResult> {
    if (!isNonEmptyString(ideaId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'ideaId is required', 400);
    }
    if (!isNonEmptyString(idempotencyKey)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'idempotencyKey is required', 400);
    }

    const idea = await this.deps.ideaRepo.findById(ideaId);
    if (!idea) {
      throw new AppError(errorCodes.NOT_FOUND, 'Idea not found', 404);
    }
    if (idea.status !== 'idea_approved') {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `Idea must be approved to generate draft (current status: ${idea.status})`,
        400
      );
    }
    const brandId = idea.brandId;
    const brandRow = await this.deps.brandRepo.findById(brandId);
    if (!brandRow) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }
    const campaign = await this.deps.campaignRepo.findById(idea.campaignId);

    const language: DraftLanguage = input.language
      ? validateEnum(input.language, DRAFT_LANGUAGES)
      : (campaign?.language && DRAFT_LANGUAGES.includes(campaign.language as DraftLanguage)
          ? (campaign.language as DraftLanguage)
          : 'id');
    const platform: DraftPlatform = input.platform
      ? validateEnum(input.platform, DRAFT_PLATFORMS)
      : validateEnum(idea.targetPlatform, DRAFT_PLATFORMS);

    // Rate limit + quota
    const rlAction: RateLimitAction = 'generate_draft';
    const rl = await this.deps.rateLimit.checkAndIncrement(brandId, actor.id, rlAction);
    if (!rl.allowed) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `Rate limit exceeded for ${rlAction}. Try again after ${rl.resetAt}`,
        429
      );
    }

    const job = await this.deps.aiJobs.create(
      {
        brandId,
        jobType: 'draft_generation',
        idempotencyKey,
        input: { ideaId, language, toneVariant: input.toneVariant ?? null },
      },
      actor
    );
    await this.deps.aiJobs.start(job.id);

    const purpose: AiPurpose = 'draft_generation';
    const configs = await this.deps.aiConfigRepo.findActiveByPurpose(brandId, purpose);
    const config: AiConfigRow | null = selectConfig(configs);
    if (!config) {
      await this.deps.aiJobs.fail(
        job.id,
        'AI_CONFIG_NOT_FOUND',
        `No active AI config for purpose ${purpose}`,
        actor
      );
      throw new AppError(errorCodes.AI_PROVIDER_FAILED, `No active AI config for purpose ${purpose}`, 500);
    }

    const builder = new PromptContextBuilder(this.deps.promptLoader);
    const ctx = await builder.buildForPurpose(purpose, {
      brand: brandRow,
      idea: {
        id: idea.id,
        title: idea.title,
        angle: idea.angle,
        targetPlatform: idea.targetPlatform,
        contentFormat: idea.contentFormat,
        pillarSlug: idea.pillarId,
      },
      campaign: campaign ?? {
        id: '',
        name: '',
        objective: '',
        targetPlatformsJson: '[]',
        pillarIdsJson: '[]',
        targetAudience: null,
        language,
      },
      platform,
      contentFormat: input.contentFormat ?? idea.contentFormat,
      language,
    });

    const inputTokens = 50;
    const outputTokens = 80;
    const costUsd = 0.0005;
    await this.deps.quota.checkQuota(this.deps.db, brandId, inputTokens, outputTokens, costUsd);

    const now = new Date().toISOString();
    const draftId = `draft_${randomSuffix(12)}`;
    try {
      const result = await generateWithProvider<AiDraftOutput>(config.provider, config, ctx.promptText);
      const draft = result.data ?? {};
      const scan = prescanDraft({
        primaryHook: draft.primaryHook,
        mainContent: draft.mainContent,
        caption: draft.caption,
      });

      const snapshot = {
        primaryHook: String(draft.primaryHook ?? ''),
        hookAlternativesJson: encodeJsonField(draft.hookAlternatives ?? null),
        mainContent: String(draft.mainContent ?? ''),
        carouselSlidesJson: encodeJsonField(draft.carouselSlides ?? null),
        scriptJson: encodeJsonField(draft.script ?? null),
        caption: draft.caption ?? null,
        cta: draft.cta ?? null,
        hashtagsJson: encodeJsonField(draft.hashtags ?? null),
        visualBriefJson: encodeJsonField(draft.visualBrief ?? null),
        thumbnailText: draft.thumbnailText ?? null,
        altText: draft.altText ?? null,
        disclaimer: draft.disclaimer ?? brandRow.disclaimerTemplate ?? null,
      };

      const row: DraftRow = {
        id: draftId,
        ideaId: idea.id,
        brandId,
        campaignId: idea.campaignId,
        platform,
        contentFormat: input.contentFormat ?? idea.contentFormat,
        language,
        currentRevision: 1,
        primaryHook: snapshot.primaryHook,
        hookAlternativesJson: snapshot.hookAlternativesJson,
        mainContent: snapshot.mainContent,
        carouselSlidesJson: snapshot.carouselSlidesJson,
        scriptJson: snapshot.scriptJson,
        caption: snapshot.caption,
        cta: snapshot.cta,
        hashtagsJson: snapshot.hashtagsJson,
        visualBriefJson: snapshot.visualBriefJson,
        thumbnailText: snapshot.thumbnailText,
        altText: snapshot.altText,
        disclaimer: snapshot.disclaimer,
        healthContentStatus: 'uncertain' as DraftHealthContentStatus,
        safetyStatus: scan.blocked ? 'blocked' : 'needs_check',
        approvalStatus: 'not_submitted',
        status: 'draft_ready',
        publishReadinessScore: 0,
        createdAt: now,
        updatedAt: now,
      };

      await this.deps.repo.create(row);

      const snapshotContentHash = await sha256(JSON.stringify(snapshot));
      const revision: DraftRevisionRow = {
        id: `revision_${randomSuffix(12)}`,
        draftId,
        revisionNumber: 1,
        snapshotJson: JSON.stringify(snapshot),
        contentHash: snapshotContentHash,
        changeReason: 'Initial draft generation',
        changedBy: actor.id,
        createdAt: now,
      };
      await this.deps.revisionRepo.create(revision);

      const completed = await this.deps.aiJobs.complete(
        job.id,
        {
          output: draft,
          tokenUsage: { inputTokens, outputTokens, estimatedCostUsd: costUsd },
          modelUsed: config.model,
          promptVersionId: null,
        },
        actor
      );
      await this.deps.usage.logUsage({
        brandId,
        jobId: completed.id,
        provider: config.provider,
        model: config.model,
        inputTokens,
        outputTokens,
        estimatedCostUsd: costUsd,
      });
      await this.deps.quota.incrementUsage(this.deps.db, brandId, {
        inputTokens,
        outputTokens,
        estimatedCostUsd: costUsd,
        jobs: 1,
      });
      await this.deps.audit.log({
        action: 'draft.generate',
        targetType: 'draft',
        targetId: draftId,
        after: { jobId: completed.id, revisionNumber: 1 },
        actor,
      });

      return {
        jobId: completed.id,
        jobStatus: 'completed',
        draftId,
        revisionNumber: 1,
        status: row.status,
        safetyStatus: row.safetyStatus,
        approvalStatus: row.approvalStatus,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI provider call failed';
      await this.deps.aiJobs.fail(job.id, 'AI_PROVIDER_FAILED', message, actor);
      throw e;
    }
  }

  async update(
    id: string,
    input: DraftUpdateApiInput,
    actor: AuditActor
  ): Promise<DraftRow> {
    if (!input.changeReason || typeof input.changeReason !== 'string' || !input.changeReason.trim()) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'changeReason is required', 400);
    }
    if (actor.role && String(actor.role).includes('medicalReviewer')) {
      throw new AppError(errorCodes.FORBIDDEN, 'medicalReviewer cannot update draft content', 403);
    }

    const before = await this.deps.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }

    const patch: Record<string, unknown> = {};
    if (input.primaryHook !== undefined) patch.primaryHook = input.primaryHook;
    if (input.mainContent !== undefined) patch.mainContent = input.mainContent;
    if (input.hookAlternativesJson !== undefined) patch.hookAlternativesJson = encodeJsonField(input.hookAlternativesJson);
    if (input.carouselSlidesJson !== undefined) patch.carouselSlidesJson = encodeJsonField(input.carouselSlidesJson);
    if (input.scriptJson !== undefined) patch.scriptJson = encodeJsonField(input.scriptJson);
    if (input.caption !== undefined) patch.caption = input.caption === null ? null : String(input.caption);
    if (input.cta !== undefined) patch.cta = input.cta === null ? null : String(input.cta);
    if (input.hashtagsJson !== undefined) patch.hashtagsJson = encodeJsonField(input.hashtagsJson);
    if (input.visualBriefJson !== undefined) patch.visualBriefJson = encodeJsonField(input.visualBriefJson);
    if (input.thumbnailText !== undefined) patch.thumbnailText = input.thumbnailText === null ? null : String(input.thumbnailText);
    if (input.altText !== undefined) patch.altText = input.altText === null ? null : String(input.altText);
    if (input.disclaimer !== undefined) patch.disclaimer = input.disclaimer === null ? null : String(input.disclaimer);

    const newRevisionNumber = before.currentRevision + 1;
    const now = new Date().toISOString();

    const updatedAt = now;
    const updated = await this.deps.repo.update(id, { ...(patch as object), changeReason: input.changeReason } as never, updatedAt);
    if (!updated) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }

    // After update, set currentRevision, status resets.
    await this.deps.db
      .prepare(
        'UPDATE conDrafts SET currentRevision = ?, status = ?, safetyStatus = ?, approvalStatus = ?, healthContentStatus = ?, updatedAt = ? WHERE id = ?'
      )
      .bind(newRevisionNumber, 'draft_ready', 'needs_check', 'not_submitted', 'uncertain', now, id)
      .run();

    const snapshot = {
      primaryHook: (patch.primaryHook as string) ?? before.primaryHook,
      hookAlternativesJson: (patch.hookAlternativesJson as string | null) ?? before.hookAlternativesJson,
      mainContent: (patch.mainContent as string) ?? before.mainContent,
      carouselSlidesJson: (patch.carouselSlidesJson as string | null) ?? before.carouselSlidesJson,
      scriptJson: (patch.scriptJson as string | null) ?? before.scriptJson,
      caption: (patch.caption as string | null) ?? before.caption,
      cta: (patch.cta as string | null) ?? before.cta,
      hashtagsJson: (patch.hashtagsJson as string | null) ?? before.hashtagsJson,
      visualBriefJson: (patch.visualBriefJson as string | null) ?? before.visualBriefJson,
      thumbnailText: (patch.thumbnailText as string | null) ?? before.thumbnailText,
      altText: (patch.altText as string | null) ?? before.altText,
      disclaimer: (patch.disclaimer as string | null) ?? before.disclaimer,
    };
    const snapshotContentHash = await sha256(JSON.stringify(snapshot));
    const revision: DraftRevisionRow = {
      id: `revision_${randomSuffix(12)}`,
      draftId: id,
      revisionNumber: newRevisionNumber,
      snapshotJson: JSON.stringify(snapshot),
      contentHash: snapshotContentHash,
      changeReason: input.changeReason,
      changedBy: actor.id,
      createdAt: now,
    };
    await this.deps.revisionRepo.create(revision);

    const finalRow = await this.deps.repo.findById(id);
    if (!finalRow) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }

    await this.deps.audit.log({
      action: 'draft.update',
      targetType: 'draft',
      targetId: id,
      before,
      after: finalRow,
      actor,
    });
    return finalRow;
  }
}
