import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString } from '../utils/validation.js';
import type {
  DraftHealthContentStatus,
  DraftLifecycleStatus,
  DraftRow,
  DraftSafetyStatus,
} from '../types/domain.js';
import type {
  HealthClassifierOutput,
  MedicalSafetyOutput,
  SafetyCheckResult,
  SafetyReportRow,
} from '../types/safety.js';
import type { AuditActor, AuditService } from './audit.js';
import type { AiJobService } from './ai-job.js';
import { QuotaService } from './quota.js';
import { RateLimitService, type RateLimitAction } from './rate-limit.js';
import { UsageService } from './usage.js';
import {
  PromptContextBuilder,
  type PromptLoader,
} from './prompt-context.js';
import {
  generateWithProvider,
  selectConfig,
} from './ai-provider.js';
import type { AiConfigRepository } from '../repositories/ai-config.js';
import type { AiConfigRow } from '../types/ai.js';
import type { DraftRepository } from '../repositories/draft.js';
import type { RevisionRepository } from '../repositories/revision.js';
import type { SafetyReportRepository } from '../repositories/safety-report.js';
import type { BrandRepository } from '../repositories/brand.js';

export interface SafetyCheckServiceDeps {
  db: D1Database;
  draftRepo: DraftRepository;
  revisionRepo: RevisionRepository;
  brandRepo: BrandRepository;
  safetyReportRepo: SafetyReportRepository;
  aiConfigRepo: AiConfigRepository;
  promptLoader: PromptLoader;
  aiJobs: AiJobService;
  quota: QuotaService;
  usage: UsageService;
  rateLimit: RateLimitService;
  audit: AuditService;
}

export interface SafetyRunInput {
  revisionNumber: number;
}

function randomSuffix(len = 12): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

const SAFETY_DISCLAIMER =
  'Konten ini bersifat edukatif dan bukan pengganti konsultasi medis. Jika mengalami keluhan berat, memburuk, atau kondisi darurat, segera hubungi tenaga medis.';

function parseJsonArray(s: string | null): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

export class SafetyCheckService {
  constructor(private deps: SafetyCheckServiceDeps) {}

  async run(
    draftId: string,
    input: SafetyRunInput,
    actor: AuditActor,
    idempotencyKey: string
  ): Promise<SafetyCheckResult> {
    if (!isNonEmptyString(draftId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'draftId is required', 400);
    }
    if (!isNonEmptyString(idempotencyKey)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'Idempotency-Key is required', 400);
    }
    if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'revisionNumber must be a positive integer',
        400
      );
    }

    const draft = await this.deps.draftRepo.findById(draftId);
    if (!draft) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }
    if (input.revisionNumber !== draft.currentRevision) {
      throw new AppError(
        errorCodes.REVISION_MISMATCH,
        `revisionNumber must equal draft.currentRevision (${draft.currentRevision})`,
        409
      );
    }
    const revision = await this.deps.revisionRepo.findByDraftAndNumber(
      draftId,
      input.revisionNumber
    );
    if (!revision) {
      throw new AppError(errorCodes.NOT_FOUND, 'Revision not found', 404);
    }

    // Idempotency: UNIQUE(draftId, revisionNumber) means a safety report
    // already exists for this revision iff a previous run completed. We
    // short-circuit here so the same call returns the same result.
    const existingReport = await this.deps.safetyReportRepo.findByDraftAndRevision(
      draftId,
      input.revisionNumber
    );
    if (existingReport) {
      return this.reportToResult(existingReport, `job_${randomSuffix(12)}`, 'completed');
    }

    const rlAction: RateLimitAction = 'safety_check';
    const rl = await this.deps.rateLimit.checkAndIncrement(
      draft.brandId,
      actor.id,
      rlAction
    );
    if (!rl.allowed) {
      throw new AppError(
        errorCodes.RATE_LIMITED,
        `Rate limit exceeded for ${rlAction}. Try again after ${rl.resetAt}`,
        429
      );
    }

    const job = await this.deps.aiJobs.create(
      {
        brandId: draft.brandId,
        jobType: 'safety_check',
        idempotencyKey,
        input: { draftId, revisionNumber: input.revisionNumber },
      },
      actor
    );
    await this.deps.aiJobs.start(job.id);

    try {
      const brandRow = await this.deps.brandRepo.findById(draft.brandId);
      if (!brandRow) {
        throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
      }

      const builder = new PromptContextBuilder(this.deps.promptLoader);

      // --- Step 1: health classifier ---
      const classifierCfg = await this.requireConfig(draft.brandId, 'health_classifier', job.id, actor);
      const revisionText = [
        draft.primaryHook ?? '',
        draft.mainContent ?? '',
        draft.caption ?? '',
      ]
        .filter(Boolean)
        .join('\n');
      const classifierCtx = await builder.buildForPurpose('health_classifier', {
        text: revisionText,
      });
      const classifierRes = await generateWithProvider<HealthClassifierOutput>(
        classifierCfg.provider,
        classifierCfg,
        classifierCtx.promptText
      );
      const classifier = this.parseClassifierOutput(classifierRes.data);
      // Spec: uncertain → treat as health_content.
      const healthContentStatus: DraftHealthContentStatus =
        classifier.healthContentStatus === 'non_health_content'
          ? 'non_health_content'
          : 'health_content';

      let report: SafetyReportRow;
      let modelUsed = classifierCfg.model;
      let promptVersionId: string | null = null;

      if (healthContentStatus === 'non_health_content') {
        // Auto-create safe report; skip the medical safety checker.
        const now = new Date().toISOString();
        report = await this.deps.safetyReportRepo.create({
          id: `safety_${randomSuffix(12)}`,
          draftId,
          revisionNumber: input.revisionNumber,
          healthContentStatus: 'non_health_content',
          safetyStatus: 'safe',
          blockedReasonsJson: null,
          warningsJson: null,
          rewrittenSuggestion: null,
          requiredDisclaimer: null,
          sourceTraceRequired: 0,
          checkerNote: 'Non-health content; medical safety check not required.',
          checkedBy: 'ai',
          modelUsed,
          promptVersionId,
          checkedAt: now,
        });
        await this.updateDraftAfterCheck(draft, {
          healthContentStatus: 'non_health_content',
          safetyStatus: 'safe',
          status: 'needs_review',
          approvalStatus: 'needs_review',
        });
      } else {
        // --- Step 2: medical safety checker ---
        const safetyCfg = await this.requireConfig(draft.brandId, 'safety_check', job.id, actor);
        modelUsed = safetyCfg.model;
        const safetyCtx = await builder.buildForPurpose('safety_check', {
          brand: brandRow,
          draft: this.draftForContext(draft),
        });
        const safetyRes = await generateWithProvider<MedicalSafetyOutput>(
          safetyCfg.provider,
          safetyCfg,
          safetyCtx.promptText
        );
        const safety = this.parseSafetyOutput(safetyRes.data);
        const now = new Date().toISOString();
        report = await this.deps.safetyReportRepo.create({
          id: `safety_${randomSuffix(12)}`,
          draftId,
          revisionNumber: input.revisionNumber,
          healthContentStatus: 'health_content',
          safetyStatus: safety.safetyStatus,
          blockedReasonsJson: safety.blockedReasons.length
            ? JSON.stringify(safety.blockedReasons)
            : null,
          warningsJson: safety.warnings.length ? JSON.stringify(safety.warnings) : null,
          rewrittenSuggestion: safety.rewrittenSuggestion,
          requiredDisclaimer: safety.requiredDisclaimer,
          sourceTraceRequired: safety.sourceTraceRequired ? 1 : 0,
          checkerNote: null,
          checkedBy: 'ai',
          modelUsed,
          promptVersionId,
          checkedAt: now,
        });
        const draftSafetyStatus: DraftSafetyStatus = safety.safetyStatus;
        const nextLifecycle: DraftLifecycleStatus =
          safety.safetyStatus === 'blocked' ? 'safety_blocked' : 'needs_review';
        const nextApproval =
          safety.safetyStatus === 'blocked' ? 'rejected' : 'needs_review';
        await this.updateDraftAfterCheck(draft, {
          healthContentStatus: 'health_content',
          safetyStatus: draftSafetyStatus,
          status: nextLifecycle,
          approvalStatus: nextApproval,
        });
      }

      // --- Step 3: usage + quota + audit ---
      const inputTokens = 50;
      const outputTokens = 80;
      const costUsd = 0.0005;
      await this.deps.quota.checkQuota(this.deps.db, draft.brandId, inputTokens, outputTokens, costUsd);
      const completed = await this.deps.aiJobs.complete(
        job.id,
        {
          output: {
            healthContentStatus: report.healthContentStatus,
            safetyStatus: report.safetyStatus,
            reportId: report.id,
          },
          tokenUsage: { inputTokens, outputTokens, estimatedCostUsd: costUsd },
          modelUsed,
          promptVersionId,
        },
        actor
      );
      await this.deps.usage.logUsage({
        brandId: draft.brandId,
        jobId: completed.id,
        provider: classifierCfg.provider,
        model: classifierCfg.model,
        inputTokens,
        outputTokens,
        estimatedCostUsd: costUsd,
      });
      await this.deps.quota.incrementUsage(this.deps.db, draft.brandId, {
        inputTokens,
        outputTokens,
        estimatedCostUsd: costUsd,
        jobs: 1,
      });
      await this.deps.audit.log({
        action: 'safety.check',
        targetType: 'draft',
        targetId: draftId,
        after: {
          jobId: completed.id,
          revisionNumber: input.revisionNumber,
          healthContentStatus: report.healthContentStatus,
          safetyStatus: report.safetyStatus,
        },
        actor,
      });

      return this.reportToResult(report, completed.id, 'completed');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Safety check failed';
      if (e instanceof AppError && e.status >= 500) {
        await this.deps.aiJobs.fail(job.id, 'AI_PROVIDER_FAILED', message, actor);
      }
      throw e;
    }
  }

  async getReport(
    draftId: string,
    revisionNumber: number | null
  ): Promise<SafetyReportRow | null> {
    const draft = await this.deps.draftRepo.findById(draftId);
    if (!draft) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }
    const target = revisionNumber ?? draft.currentRevision;
    if (revisionNumber !== null && revisionNumber !== draft.currentRevision) {
      // Allow fetching any known revision; only check existence.
    }
    return this.deps.safetyReportRepo.findByDraftAndRevision(draftId, target);
  }

  async getLatestReport(draftId: string): Promise<SafetyReportRow | null> {
    const draft = await this.deps.draftRepo.findById(draftId);
    if (!draft) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }
    return this.deps.safetyReportRepo.findLatestByDraft(draftId);
  }

  private async requireConfig(
    brandId: string,
    purpose: 'health_classifier' | 'safety_check',
    jobId: string,
    actor: AuditActor
  ): Promise<AiConfigRow> {
    const configs = await this.deps.aiConfigRepo.findActiveByPurpose(brandId, purpose);
    const config = selectConfig(configs);
    if (!config) {
      await this.deps.aiJobs.fail(jobId, 'AI_CONFIG_NOT_FOUND', `No active AI config for purpose ${purpose}`, actor);
      throw new AppError(
        errorCodes.AI_PROVIDER_FAILED,
        `No active AI config for purpose ${purpose}`,
        500
      );
    }
    return config;
  }

  private parseClassifierOutput(raw: unknown): HealthClassifierOutput {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const status = String(obj.healthContentStatus ?? 'health_content');
    const valid: DraftHealthContentStatus[] = ['health_content', 'non_health_content', 'uncertain'];
    const healthContentStatus: DraftHealthContentStatus = (valid as string[]).includes(status)
      ? (status as DraftHealthContentStatus)
      : 'health_content';
    const confidenceRaw = String(obj.confidence ?? 'medium');
    const confidence = ['low', 'medium', 'high'].includes(confidenceRaw)
      ? (confidenceRaw as 'low' | 'medium' | 'high')
      : 'medium';
    return { healthContentStatus, confidence };
  }

  private parseSafetyOutput(raw: unknown): MedicalSafetyOutput {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const status = String(obj.safetyStatus ?? 'safe');
    const safetyStatus = (['safe', 'warning', 'blocked'] as const).includes(
      status as 'safe' | 'warning' | 'blocked'
    )
      ? (status as 'safe' | 'warning' | 'blocked')
      : 'safe';
    const blockedReasons = Array.isArray(obj.blockedReasons)
      ? (obj.blockedReasons as unknown[]).map((v) => String(v)).filter(Boolean)
      : [];
    const warnings = Array.isArray(obj.warnings)
      ? (obj.warnings as unknown[]).map((v) => String(v)).filter(Boolean)
      : [];
    const rewrittenSuggestion =
      obj.rewrittenSuggestion === null || obj.rewrittenSuggestion === undefined
        ? null
        : String(obj.rewrittenSuggestion);
    const requiredDisclaimer = String(obj.requiredDisclaimer ?? SAFETY_DISCLAIMER);
    const sourceTraceRequired = obj.sourceTraceRequired === true;
    return {
      safetyStatus,
      blockedReasons,
      warnings,
      requiredDisclaimer,
      rewrittenSuggestion,
      sourceTraceRequired,
    };
  }

  private draftForContext(draft: DraftRow): Record<string, unknown> {
    return {
      id: draft.id,
      primaryHook: draft.primaryHook,
      mainContent: draft.mainContent,
      caption: draft.caption,
      hashtagsJson: draft.hashtagsJson,
    };
  }

  private async updateDraftAfterCheck(
    draft: DraftRow,
    next: {
      healthContentStatus: DraftHealthContentStatus;
      safetyStatus: DraftSafetyStatus;
      status: DraftLifecycleStatus;
      approvalStatus: 'needs_review' | 'rejected';
    }
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.deps.db
      .prepare(
        'UPDATE conDrafts SET healthContentStatus = ?, safetyStatus = ?, approvalStatus = ?, status = ?, updatedAt = ? WHERE id = ?'
      )
      .bind(
        next.healthContentStatus,
        next.safetyStatus,
        next.approvalStatus,
        next.status,
        now,
        draft.id
      )
      .run();
  }

  private reportToResult(
    report: SafetyReportRow,
    jobId: string,
    jobStatus: 'completed' | 'failed'
  ): SafetyCheckResult {
    const result: SafetyCheckResult = {
      jobId,
      jobStatus,
      draftId: report.draftId,
      revisionNumber: report.revisionNumber,
      healthContentStatus: report.healthContentStatus,
      safetyStatus: report.safetyStatus as DraftSafetyStatus,
      status:
        report.safetyStatus === 'blocked'
          ? 'safety_blocked'
          : 'needs_review',
      sourceTraceRequired: report.sourceTraceRequired === 1,
    };
    if (report.requiredDisclaimer) result.requiredDisclaimer = report.requiredDisclaimer;
    if (report.checkerNote) result.note = report.checkerNote;
    const warnings = parseJsonArray(report.warningsJson);
    if (warnings.length) result.warnings = warnings;
    const blockedReasons = parseJsonArray(report.blockedReasonsJson);
    if (blockedReasons.length) result.blockedReasons = blockedReasons;
    if (report.rewrittenSuggestion) result.rewrittenSuggestion = report.rewrittenSuggestion;
    return result;
  }
}
