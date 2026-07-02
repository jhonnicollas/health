import { AppError, errorCodes } from '../utils/errors.js';
import { isNonEmptyString } from '../utils/validation.js';
import type {
  Confidence,
  SourceReferenceCreateInput,
  SourceReferenceRow,
  SourceReferenceType,
  SourceReliability,
} from '../types/source-reference.js';
import {
  CONFIDENCES,
  SOURCE_REFERENCE_TYPES,
  SOURCE_RELIABILITIES,
  isConfidence,
  isSourceReferenceType,
  isSourceReliability,
} from '../types/source-reference.js';
import type { AuditActor, AuditService } from './audit.js';
import type { DraftRepository } from '../repositories/draft.js';
import type { RevisionRepository } from '../repositories/revision.js';
import type { SourceReferenceRepository } from '../repositories/source-reference.js';

export interface SourceReferenceServiceDeps {
  draftRepo: DraftRepository;
  revisionRepo: RevisionRepository;
  repo: SourceReferenceRepository;
  audit: AuditService;
}

function randomSuffix(len = 12): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export class SourceReferenceService {
  constructor(private deps: SourceReferenceServiceDeps) {}

  async list(
    draftId: string,
    revisionNumber?: number
  ): Promise<SourceReferenceRow[]> {
    if (!isNonEmptyString(draftId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'draftId is required', 400);
    }
    const draft = await this.deps.draftRepo.findById(draftId);
    if (!draft) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }
    const target = revisionNumber ?? draft.currentRevision;
    if (!Number.isInteger(target) || target < 1) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'revisionNumber must be a positive integer',
        400
      );
    }
    return this.deps.repo.findByDraftAndRevision(draftId, target);
  }

  async create(
    draftId: string,
    input: SourceReferenceCreateInput,
    actor: AuditActor
  ): Promise<SourceReferenceRow> {
    if (!isNonEmptyString(draftId)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'draftId is required', 400);
    }
    if (!input || typeof input !== 'object') {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'Request body is required', 400);
    }
    if (!Number.isInteger(input.revisionNumber) || input.revisionNumber < 1) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'revisionNumber must be a positive integer',
        400
      );
    }
    if (!isNonEmptyString(input.title)) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'title is required', 400);
    }
    if (!isSourceReferenceType(input.sourceType)) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `sourceType must be one of: ${SOURCE_REFERENCE_TYPES.join(', ')}`,
        400
      );
    }
    if (
      input.sourceReliability !== undefined &&
      input.sourceReliability !== null &&
      !isSourceReliability(input.sourceReliability)
    ) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `sourceReliability must be one of: ${SOURCE_RELIABILITIES.join(', ')}`,
        400
      );
    }
    if (
      input.confidence !== undefined &&
      input.confidence !== null &&
      !isConfidence(input.confidence)
    ) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        `confidence must be one of: ${CONFIDENCES.join(', ')}`,
        400
      );
    }
    if (
      input.url !== undefined &&
      input.url !== null &&
      input.url !== '' &&
      !isValidUrl(input.url)
    ) {
      throw new AppError(
        errorCodes.VALIDATION_ERROR,
        'url must be a valid http(s) URL',
        400
      );
    }

    const draft = await this.deps.draftRepo.findById(draftId);
    if (!draft) {
      throw new AppError(errorCodes.NOT_FOUND, 'Draft not found', 404);
    }
    const revision = await this.deps.revisionRepo.findByDraftAndNumber(
      draftId,
      input.revisionNumber
    );
    if (!revision) {
      throw new AppError(errorCodes.NOT_FOUND, 'Revision not found', 404);
    }

    const now = new Date().toISOString();
    const row: SourceReferenceRow = {
      id: `source_${randomSuffix(12)}`,
      draftId,
      revisionNumber: input.revisionNumber,
      title: input.title.trim(),
      url: input.url?.trim() || null,
      sourceType: input.sourceType as SourceReferenceType,
      sourceReliability:
        (input.sourceReliability as SourceReliability | null | undefined) ?? null,
      confidence: (input.confidence as Confidence | null | undefined) ?? null,
      note: input.note ?? null,
      fetchedAt: input.fetchedAt ?? null,
      createdAt: now,
    };
    const created = await this.deps.repo.create(row);

    await this.deps.audit.log({
      action: 'source_reference.create',
      targetType: 'draft',
      targetId: draftId,
      after: {
        id: created.id,
        draftId: created.draftId,
        revisionNumber: created.revisionNumber,
        title: created.title,
        url: created.url,
        sourceType: created.sourceType,
        sourceReliability: created.sourceReliability,
        confidence: created.confidence,
      },
      actor,
    });

    return created;
  }
}
