import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString, validateEnum } from '../utils/validation.js';
import { prescanIdea } from '../utils/safety-prescan.js';
import type {
  IdeaConfidence,
  IdeaContentFormat,
  IdeaCreateInput,
  IdeaListOptions,
  IdeaPlatform,
  IdeaRow,
  IdeaStatus,
  Paginated,
} from '../types/domain.js';
import {
  CAMPAIGN_LANGUAGES,
  IDEA_CONFIDENCES,
  IDEA_CONTENT_FORMATS,
  IDEA_PLATFORMS,
  IDEA_STATUSES,
} from '../types/domain.js';
import type { AuditActor, AuditService } from './audit.js';
import { IntegrityService } from './integrity.js';
import { IdeaRepository } from '../repositories/idea.js';
import { CampaignRepository } from '../repositories/campaign.js';
import { PillarRepository } from '../repositories/pillar.js';
import { BrandRepository } from '../repositories/brand.js';
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

export interface IdeaServiceDeps {
  db: D1Database;
  repo: IdeaRepository;
  campaignRepo: CampaignRepository;
  pillarRepo: PillarRepository;
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

export interface IdeaGenerateInput {
  quantity: number;
  platforms: IdeaPlatform[];
  formats: IdeaContentFormat[];
  pillarIds: string[];
  language: 'id' | 'en' | 'bilingual';
}

export interface IdeaGenerateResult {
  jobId: string;
  jobStatus: 'completed' | 'failed';
  ideasCreated: number;
  ideas: Array<Pick<IdeaRow, 'id' | 'title' | 'status' | 'targetPlatform' | 'contentFormat' | 'score' | 'confidence'>>;
}

function randomSuffix(len = 12): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function ensureStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new AppError(errorCodes.VALIDATION_ERROR, `${field} must be an array`, 400);
  }
  for (const v of value) {
    if (typeof v !== 'string') {
      throw new AppError(errorCodes.VALIDATION_ERROR, `${field} must contain only strings`, 400);
    }
  }
  return value;
}

interface AiIdeaOutput {
  ideas?: Array<{
    title?: string;
    pillarSlug?: string;
    angle?: string;
    painPoint?: string;
    targetPlatform?: string;
    contentFormat?: string;
    targetAudience?: string;
    score?: number;
    confidence?: string;
  }>;
}

export class IdeaService {
  constructor(private deps: IdeaServiceDeps) {}

  async list(brandId: string, options: IdeaListOptions = {}): Promise<Paginated<IdeaRow>> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const { items, total } = await this.deps.repo.findByBrandCampaign(brandId, options);
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
    campaignId: string,
    input: IdeaGenerateInput,
    actor: AuditActor,
    idempotencyKey: string
  ): Promise<IdeaGenerateResult> {
    // ---- Validate ----
    if (!isNonEmptyString(campaignId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'campaignId is required', 400);
    }
    if (!isNonEmptyString(idempotencyKey)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'idempotencyKey is required', 400);
    }
    if (
      typeof input.quantity !== 'number' ||
      !Number.isInteger(input.quantity) ||
      input.quantity < 1 ||
      input.quantity > 50
    ) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'quantity must be an integer between 1 and 50',
        400
      );
    }
    const platforms = ensureStringArray(input.platforms, 'platforms') as IdeaPlatform[];
    for (const p of platforms) validateEnum(p, IDEA_PLATFORMS);
    const formats = ensureStringArray(input.formats, 'formats') as IdeaContentFormat[];
    for (const f of formats) validateEnum(f, IDEA_CONTENT_FORMATS);
    const language = validateEnum(input.language, CAMPAIGN_LANGUAGES);

    // ---- Campaign + brand integrity ----
    const campaign = await this.deps.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError(errorCodes.NOT_FOUND, 'Campaign not found', 404);
    }
    if (campaign.status === 'archived') {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'Campaign is archived',
        400
      );
    }
    const brandId = campaign.brandId;
    if (!(await this.deps.integrity.brandExists(brandId))) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }
    const brandRow = await this.deps.brandRepo.findById(brandId);
    if (!brandRow) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }

    const requestedPillarSlugs = ensureStringArray(input.pillarIds, 'pillarIds');
    const pillars: Array<{ id: string; slug: string; name: string; description: string }> = [];
    for (const slugOrId of requestedPillarSlugs) {
      const pillar = await this.deps.pillarRepo.findBySlug(brandId, slugOrId);
      if (!pillar) {
        throw new AppError(
          errorCodes.VALIDATION_ERROR,
          `Pillar not found or inactive: ${slugOrId}`,
          400
        );
      }
      if (pillar.isActive !== 1) {
        throw new AppError(
          errorCodes.VALIDATION_ERROR,
          `Pillar not active: ${slugOrId}`,
          400
        );
      }
      pillars.push({
        id: pillar.id,
        slug: pillar.slug,
        name: pillar.name,
        description: pillar.description,
      });
    }

    // ---- Rate limit + quota ----
    const rlAction: RateLimitAction = 'generate_ideas';
    const rl = await this.deps.rateLimit.checkAndIncrement(brandId, actor.id, rlAction);
    if (!rl.allowed) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `Rate limit exceeded for ${rlAction}. Try again after ${rl.resetAt}`,
        429
      );
    }

    // ---- AI job ----
    const job = await this.deps.aiJobs.create(
      {
        brandId,
        jobType: 'idea_generation',
        idempotencyKey,
        input: { campaignId, quantity: input.quantity, platforms, formats, language },
      },
      actor
    );
    await this.deps.aiJobs.start(job.id);

    const purpose: AiPurpose = 'idea_generation';
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
    const finalPromptContext = await builder.buildForPurpose(purpose, {
      brand: brandRow,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        targetPlatformsJson: campaign.targetPlatformsJson,
        pillarIdsJson: campaign.pillarIdsJson,
        targetAudience: campaign.targetAudience,
        language: campaign.language,
      },
      pillars,
      count: input.quantity,
    });

    const inputTokens = 50;
    const outputTokens = 80;
    const costUsd = 0.0005;

    await this.deps.quota.checkQuota(this.deps.db, brandId, inputTokens, outputTokens, costUsd);

    let created: IdeaRow[] = [];
    try {
      const result = await generateWithProvider<AiIdeaOutput>(config.provider, config, finalPromptContext.promptText);
      const items = (result.data?.ideas ?? []).slice(0, input.quantity);
      const now = new Date().toISOString();
      for (const item of items) {
        const title = String(item.title ?? '').trim();
        const angle = String(item.angle ?? '').trim();
        if (!title || !angle) continue;
        let targetPlatform: IdeaPlatform;
        let contentFormat: IdeaContentFormat;
        try {
          targetPlatform = validateEnum(String(item.targetPlatform ?? ''), IDEA_PLATFORMS);
          contentFormat = validateEnum(String(item.contentFormat ?? ''), IDEA_CONTENT_FORMATS);
        } catch {
          continue;
        }
        const pillarSlug = String(item.pillarSlug ?? pillars[0]?.slug ?? '');
        const pillar = pillars.find((p) => p.slug === pillarSlug) ?? pillars[0];
        if (!pillar) continue;
        const confidence: IdeaConfidence = IDEA_CONFIDENCES.includes(item.confidence as IdeaConfidence)
          ? (item.confidence as IdeaConfidence)
          : 'medium';
        const scan = prescanIdea({ title, angle, painPoint: item.painPoint });
        if (scan.blocked) continue;
        const contentHash = await sha256(`${title}|${angle}|${targetPlatform}|${contentFormat}`);
        const row: IdeaCreateInput = {
          brandId,
          campaignId,
          pillarId: pillar.id,
          title,
          angle,
          targetPlatform,
          contentFormat,
          targetAudience: item.targetAudience ?? null,
          painPoint: item.painPoint ?? null,
          score: typeof item.score === 'number' ? Math.max(0, Math.min(100, item.score)) : 0,
          contentHash,
          sourceType: 'ai_inferred',
          confidence,
          status: 'idea' as IdeaStatus,
        };
        const id = `idea_${randomSuffix(12)}`;
        const idea = await this.deps.repo.create({ ...row, id, createdAt: now, updatedAt: now });
        created.push(idea);
      }
      const completed = await this.deps.aiJobs.complete(
        job.id,
        {
          output: { ideas: items },
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
        action: 'idea.generate',
        targetType: 'campaign',
        targetId: campaignId,
        after: { jobId: completed.id, ideasCreated: created.length },
        actor,
      });
      return {
        jobId: completed.id,
        jobStatus: 'completed',
        ideasCreated: created.length,
        ideas: created.map((c) => ({
          id: c.id,
          title: c.title,
          status: c.status,
          targetPlatform: c.targetPlatform,
          contentFormat: c.contentFormat,
          score: c.score,
          confidence: c.confidence,
        })),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'AI provider call failed';
      await this.deps.aiJobs.fail(job.id, 'AI_PROVIDER_FAILED', message, actor);
      throw e;
    }
  }

  async approve(id: string, actor: AuditActor, _note?: string): Promise<IdeaRow> {
    const before = await this.deps.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'Idea not found', 404);
    }
    if (before.status !== 'idea') {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `Idea cannot be approved from status ${before.status}`,
        409
      );
    }
    const updatedAt = new Date().toISOString();
    const after = await this.deps.repo.updateStatus(id, { status: 'idea_approved' }, updatedAt);
    if (!after) {
      throw new AppError(errorCodes.NOT_FOUND, 'Idea not found', 404);
    }
    await this.deps.audit.log({
      action: 'idea.approve',
      targetType: 'idea',
      targetId: id,
      before,
      after,
      actor,
    });
    return after;
  }

  async reject(id: string, actor: AuditActor, note?: string): Promise<IdeaRow> {
    if (!isNonEmptyString(note)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'note is required', 400);
    }
    const before = await this.deps.repo.findById(id);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'Idea not found', 404);
    }
    if (before.status !== 'idea') {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `Idea cannot be rejected from status ${before.status}`,
        409
      );
    }
    const updatedAt = new Date().toISOString();
    const after = await this.deps.repo.updateStatus(id, { status: 'rejected' }, updatedAt);
    if (!after) {
      throw new AppError(errorCodes.NOT_FOUND, 'Idea not found', 404);
    }
    await this.deps.audit.log({
      action: 'idea.reject',
      targetType: 'idea',
      targetId: id,
      before,
      after,
      actor,
    });
    return after;
  }
}

export { IDEA_STATUSES };
