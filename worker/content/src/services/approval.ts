import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString } from '../utils/validation.js';
import type {
  ApprovalBlocker,
  ApprovalQueueFilters,
  ApprovalQueueItem,
  ApprovalQueuePage,
  ApprovalRow,
} from '../types/source-reference.js';
import type { AuditActor, AuditService } from './audit.js';
import type { DraftRepository } from '../repositories/draft.js';
import type { SafetyReportRepository } from '../repositories/safety-report.js';
import type { SourceReferenceRepository } from '../repositories/source-reference.js';
import type { ApprovalRepository } from '../repositories/approval.js';

export interface ApprovalServiceDeps {
  db: D1Database;
  draftRepo: DraftRepository;
  safetyReportRepo: SafetyReportRepository;
  sourceRefRepo: SourceReferenceRepository;
  repo: ApprovalRepository;
  audit: AuditService;
}

function randomSuffix(len = 12): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

function canApproveContentType(
  healthContentStatus: string,
  roles: readonly string[]
): boolean {
  if (healthContentStatus === 'non_health_content') {
    return roles.includes('owner') || roles.includes('marketingAdmin');
  }
  // health_content | uncertain
  return roles.includes('owner') || roles.includes('medicalReviewer');
}

function canOverrideWarning(roles: readonly string[]): boolean {
  return roles.includes('owner') || roles.includes('medicalReviewer');
}

const QUEUE_STATUSES = ['needs_review', 'safety_warning', 'safety_safe'] as const;

function isInQueue(
  status: string,
  approvalStatus: string
): boolean {
  return (
    (QUEUE_STATUSES as readonly string[]).includes(status) ||
    approvalStatus === 'needs_review'
  );
}

export interface QueueOptions {
  page?: number;
  pageSize?: number;
}

export interface RejectInput {
  revisionNumber: number;
  reviewerNote: string;
}

export interface RequestRevisionInput {
  revisionNumber: number;
  reviewerNote: string;
}

export interface ApprovalActionResult {
  draftId: string;
  revisionNumber: number;
  approvalStatus: string;
  status?: string;
  approvedAt?: string;
}

export class ApprovalService {
  constructor(private deps: ApprovalServiceDeps) {}

  async queue(
    filters: ApprovalQueueFilters,
    options: QueueOptions = {}
  ): Promise<ApprovalQueuePage> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    // ponytail: fetch all matching drafts for the brand then apply the
    // queue filter (status OR approvalStatus) in-memory. The fake-DB repo
    // only supports AND filters, and queue sets are tiny.
    const { items: drafts } = await this.deps.draftRepo.findByBrand(
      filters.brandId ?? '',
      {
        healthContentStatus: filters.healthContentStatus as never,
        safetyStatus: filters.safetyStatus as never,
        platform: filters.platform as never,
        contentFormat: filters.contentFormat as never,
        page: 1,
        pageSize: 100,
      }
    );

    const queueCandidates = drafts.filter((d) =>
      isInQueue(d.status, d.approvalStatus)
    );

    const items: ApprovalQueueItem[] = [];
    for (const draft of queueCandidates) {
      const report = await this.deps.safetyReportRepo.findByDraftAndRevision(
        draft.id,
        draft.currentRevision
      );
      const sourceRefCount = await this.deps.sourceRefRepo.countByDraftAndRevision(
        draft.id,
        draft.currentRevision
      );
      items.push(this.buildQueueItem(draft, report, sourceRefCount));
    }

    const total = items.length;
    const slice = items.slice(offset, offset + pageSize);
    return {
      items: slice,
      pagination: {
        page,
        pageSize,
        total,
        hasNext: offset + pageSize < total,
      },
    };
  }

  async approve(
    draftId: string,
    input: { revisionNumber: number; reviewerNote?: string; warningOverrideReason?: string },
    actor: AuditActor
  ): Promise<ApprovalActionResult> {
    if (!isNonEmptyString(draftId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'draftId is required', 400);
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

    const report = await this.deps.safetyReportRepo.findByDraftAndRevision(
      draftId,
      draft.currentRevision
    );
    if (!report) {
      throw new AppError(
        errorCodes.APPROVAL_REQUIRED,
        'Safety report is required before approval',
        400
      );
    }
    if (report.revisionNumber !== draft.currentRevision) {
      throw new AppError(
        errorCodes.REVISION_MISMATCH,
        'Safety report is for a different revision',
        409
      );
    }

    const roles = actor.roles ?? (actor.role ? [actor.role] : []);
    if (!canApproveContentType(draft.healthContentStatus, roles)) {
      throw new AppError(
        errorCodes.APPROVAL_PERMISSION_DENIED,
        'Reviewer role is not allowed to approve this content type',
        403
      );
    }

    if (report.safetyStatus === 'blocked') {
      throw new AppError(
        errorCodes.SAFETY_BLOCKED,
        'Draft is blocked and cannot be approved',
        409
      );
    }

    if (report.sourceTraceRequired === 1) {
      const sourceRefCount = await this.deps.sourceRefRepo.countByDraftAndRevision(
        draftId,
        draft.currentRevision
      );
      if (sourceRefCount === 0) {
        throw new AppError(
          errorCodes.SOURCE_TRACE_REQUIRED,
          'At least one source reference is required before approval',
          400
        );
      }
    }

    if (report.safetyStatus === 'warning') {
      if (!isNonEmptyString(input.warningOverrideReason)) {
        throw new AppError(
          errorCodes.VALIDATION_ERROR,
          'warningOverrideReason is required when safetyStatus is warning',
          400
        );
      }
      if (!canOverrideWarning(roles)) {
        throw new AppError(
          errorCodes.APPROVAL_PERMISSION_DENIED,
          'Warning override requires owner or medicalReviewer',
          403
        );
      }
    }

    const now = new Date().toISOString();
    const approvalRow: ApprovalRow = {
      id: `approval_${randomSuffix(12)}`,
      draftId,
      revisionNumber: draft.currentRevision,
      status: 'approved',
      reviewerId: actor.id,
      reviewerRole: actor.role ?? roles[0] ?? 'unknown',
      reviewerNote: input.reviewerNote?.trim() || null,
      warningOverrideReason: input.warningOverrideReason?.trim() || null,
      approvedAt: now,
      createdAt: now,
    };
    await this.deps.repo.create(approvalRow);

    await this.deps.db
      .prepare(
        'UPDATE conDrafts SET approvalStatus = ?, status = ?, updatedAt = ? WHERE id = ?'
      )
      .bind('approved', 'approved', now, draftId)
      .run();

    await this.deps.audit.log({
      action: 'approval.approve',
      targetType: 'draft',
      targetId: draftId,
      after: {
        draftId,
        revisionNumber: draft.currentRevision,
        approvalStatus: 'approved',
        status: 'approved',
        warningOverrideReason: approvalRow.warningOverrideReason,
      },
      actor,
    });

    return {
      draftId,
      revisionNumber: draft.currentRevision,
      approvalStatus: 'approved',
      status: 'approved',
      approvedAt: now,
    };
  }

  async reject(
    draftId: string,
    input: RejectInput,
    actor: AuditActor
  ): Promise<ApprovalActionResult> {
    if (!isNonEmptyString(draftId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'draftId is required', 400);
    }
    if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'revisionNumber must be a positive integer',
        400
      );
    }
    if (!isNonEmptyString(input.reviewerNote)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'reviewerNote is required', 400);
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

    const roles = actor.roles ?? (actor.role ? [actor.role] : []);
    if (!canApproveContentType(draft.healthContentStatus, roles)) {
      throw new AppError(
        errorCodes.APPROVAL_PERMISSION_DENIED,
        'Reviewer role is not allowed to reject this content type',
        403
      );
    }

    const now = new Date().toISOString();
    const approvalRow: ApprovalRow = {
      id: `approval_${randomSuffix(12)}`,
      draftId,
      revisionNumber: draft.currentRevision,
      status: 'rejected',
      reviewerId: actor.id,
      reviewerRole: actor.role ?? roles[0] ?? 'unknown',
      reviewerNote: input.reviewerNote.trim(),
      warningOverrideReason: null,
      approvedAt: null,
      createdAt: now,
    };
    await this.deps.repo.create(approvalRow);

    await this.deps.db
      .prepare(
        'UPDATE conDrafts SET approvalStatus = ?, status = ?, updatedAt = ? WHERE id = ?'
      )
      .bind('rejected', 'rejected', now, draftId)
      .run();

    await this.deps.audit.log({
      action: 'approval.reject',
      targetType: 'draft',
      targetId: draftId,
      after: {
        draftId,
        revisionNumber: draft.currentRevision,
        approvalStatus: 'rejected',
        status: 'rejected',
        reviewerNote: approvalRow.reviewerNote,
      },
      actor,
    });

    return {
      draftId,
      revisionNumber: draft.currentRevision,
      approvalStatus: 'rejected',
      status: 'rejected',
    };
  }

  async requestRevision(
    draftId: string,
    input: RequestRevisionInput,
    actor: AuditActor
  ): Promise<ApprovalActionResult> {
    if (!isNonEmptyString(draftId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'draftId is required', 400);
    }
    if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'revisionNumber must be a positive integer',
        400
      );
    }
    if (!isNonEmptyString(input.reviewerNote)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'reviewerNote is required', 400);
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

    const roles = actor.roles ?? (actor.role ? [actor.role] : []);
    if (!canApproveContentType(draft.healthContentStatus, roles)) {
      throw new AppError(
        errorCodes.APPROVAL_PERMISSION_DENIED,
        'Reviewer role is not allowed to request revision for this content type',
        403
      );
    }

    const now = new Date().toISOString();
    const approvalRow: ApprovalRow = {
      id: `approval_${randomSuffix(12)}`,
      draftId,
      revisionNumber: draft.currentRevision,
      status: 'revision_requested',
      reviewerId: actor.id,
      reviewerRole: actor.role ?? roles[0] ?? 'unknown',
      reviewerNote: input.reviewerNote.trim(),
      warningOverrideReason: null,
      approvedAt: null,
      createdAt: now,
    };
    await this.deps.repo.create(approvalRow);

    await this.deps.db
      .prepare(
        'UPDATE conDrafts SET approvalStatus = ?, status = ?, updatedAt = ? WHERE id = ?'
      )
      .bind('revision_requested', 'revision_requested', now, draftId)
      .run();

    await this.deps.audit.log({
      action: 'approval.request_revision',
      targetType: 'draft',
      targetId: draftId,
      after: {
        draftId,
        revisionNumber: draft.currentRevision,
        approvalStatus: 'revision_requested',
        status: 'revision_requested',
        reviewerNote: approvalRow.reviewerNote,
      },
      actor,
    });

    return {
      draftId,
      revisionNumber: draft.currentRevision,
      approvalStatus: 'revision_requested',
      status: 'revision_requested',
    };
  }

  private buildQueueItem(
    draft: {
      id: string;
      brandId: string;
      currentRevision: number;
      primaryHook: string;
      platform: string;
      contentFormat: string;
      healthContentStatus: string;
      safetyStatus: string;
      approvalStatus: string;
      status: string;
    },
    report: { revisionNumber: number; safetyStatus: string; sourceTraceRequired: number } | null,
    sourceRefCount: number
  ): ApprovalQueueItem {
    const blockers: ApprovalBlocker[] = [];
    if (!report) {
      blockers.push('APPROVAL_REQUIRED');
    } else {
      if (report.revisionNumber !== draft.currentRevision) {
        blockers.push('REVISION_MISMATCH');
      }
      if (report.safetyStatus === 'blocked') {
        blockers.push('SAFETY_BLOCKED');
      }
      if (report.sourceTraceRequired === 1 && sourceRefCount === 0) {
        blockers.push('SOURCE_TRACE_REQUIRED');
      }
      if (report.safetyStatus === 'warning') {
        blockers.push('WARNING_OVERRIDE_REQUIRED');
      }
    }
    return {
      draftId: draft.id,
      brandId: draft.brandId,
      currentRevision: draft.currentRevision,
      primaryHook: draft.primaryHook,
      platform: draft.platform,
      contentFormat: draft.contentFormat,
      healthContentStatus: draft.healthContentStatus,
      safetyStatus: draft.safetyStatus,
      approvalStatus: draft.approvalStatus,
      status: draft.status,
      sourceTraceRequired: report?.sourceTraceRequired === 1,
      sourceReferenceCount: sourceRefCount,
      canApprove: blockers.length === 0,
      approvalBlockers: blockers,
    };
  }
}
