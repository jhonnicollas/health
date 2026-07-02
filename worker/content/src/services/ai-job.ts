import { AppError, errorCodes } from '../utils/errors.js';
import { redact } from '../utils/redact.js';
import { AuditService } from './audit.js';
import { IntegrityService } from './integrity.js';
import {
  AiJobRepository,
  type ListJobsOptions,
} from '../repositories/ai-job.js';
import type {
  AiGenerationJobRow,
  AiJobStatus,
  AiJobType,
  AiPurpose,
  TokenUsage,
} from '../types/ai.js';
import type { AuditActor } from './audit.js';

export interface AiJobCreateInput {
  brandId: string;
  jobType: AiPurpose;
  idempotencyKey: string;
  input: unknown;
  maxAttempts?: number;
}

export interface AiJobCompleteInput {
  output: unknown;
  tokenUsage: TokenUsage;
  modelUsed: string;
  promptVersionId: string | null;
}

export interface ListJobsApiOptions {
  status?: AiJobStatus;
  jobType?: AiJobType;
  page?: number;
  pageSize?: number;
}

export interface AiJobListResult {
  items: AiGenerationJobRow[];
  pagination: { page: number; pageSize: number; total: number; hasNext: boolean };
}

const JOB_TYPES: readonly AiJobType[] = [
  'idea_generation',
  'draft_generation',
  'safety_check',
  'health_classifier',
];

async function hashInput(input: unknown): Promise<string> {
  const json = JSON.stringify(input);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function parsedInputHash(inputJson: string): string {
  const parsed = JSON.parse(inputJson) as { inputHash?: string };
  return parsed.inputHash ?? '';
}

function validateJobType(value: unknown): AiJobType {
  if (typeof value !== 'string' || !JOB_TYPES.includes(value as AiJobType)) {
    throw new AppError(
      errorCodes.VALIDATION_ERROR,
      `jobType must be one of: ${JOB_TYPES.join(', ')}`,
      400
    );
  }
  return value as AiJobType;
}

export class AiJobService {
  constructor(
    private repo: AiJobRepository,
    private integrity: IntegrityService,
    private audit: AuditService
  ) {}

  async create(input: AiJobCreateInput, actor: AuditActor): Promise<AiGenerationJobRow> {
    if (typeof input.brandId !== 'string' || input.brandId.length === 0) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'brandId is required', 400);
    }
    if (typeof input.idempotencyKey !== 'string' || input.idempotencyKey.length === 0) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'idempotencyKey is required', 400);
    }
    const jobType = validateJobType(input.jobType);
    if (input.input === undefined || input.input === null) {
      throw new AppError(errorCodes.VALIDATION_ERROR, 'input is required', 400);
    }

    if (!(await this.integrity.brandExists(input.brandId))) {
      throw new AppError(errorCodes.NOT_FOUND, 'Brand not found', 404);
    }

    const existing = await this.repo.findByIdempotencyKey(input.idempotencyKey);
    const inputHash = await hashInput(input.input);

    if (existing) {
      const existingHash = parsedInputHash(existing.inputJson);
      if (existingHash !== inputHash) {
        throw new AppError(
          errorCodes.IDEMPOTENCY_CONFLICT,
          'Idempotency key already used with a different input',
          409
        );
      }
      return existing;
    }

    const redactedInput = redact(input.input);
    const now = new Date().toISOString();
    const row: AiGenerationJobRow = {
      id: `job_${crypto.randomUUID()}`,
      brandId: input.brandId,
      jobType,
      status: 'queued',
      idempotencyKey: input.idempotencyKey,
      inputJson: JSON.stringify({ inputHash, data: redactedInput }),
      outputJson: null,
      errorCode: null,
      errorMessage: null,
      modelUsed: null,
      promptVersionId: null,
      tokenUsageJson: null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 3,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
    };

    try {
      await this.repo.create(row);
    } catch (err) {
      // Race: another caller inserted the same idempotency key concurrently.
      const race = await this.repo.findByIdempotencyKey(input.idempotencyKey);
      if (race) {
        const raceHash = parsedInputHash(race.inputJson);
        if (raceHash !== inputHash) {
          throw new AppError(
            errorCodes.IDEMPOTENCY_CONFLICT,
            'Idempotency key already used with a different input',
            409
          );
        }
        return race;
      }
      throw err;
    }

    await this.audit.log({
      action: 'aiJob.create',
      targetType: 'ai_job',
      targetId: row.id,
      after: row,
      actor,
    });

    return row;
  }

  async start(jobId: string): Promise<AiGenerationJobRow> {
    const before = await this.repo.findById(jobId);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI job not found', 404);
    }
    const now = new Date().toISOString();
    const updated: AiGenerationJobRow = {
      ...before,
      status: 'running',
      startedAt: before.startedAt ?? now,
    };
    await this.repo.updateStatus(updated);
    await this.repo.incrementAttempt(jobId);
    return this.repo.findById(jobId) as Promise<AiGenerationJobRow>;
  }

  async complete(
    jobId: string,
    payload: AiJobCompleteInput,
    actor: AuditActor
  ): Promise<AiGenerationJobRow> {
    const before = await this.repo.findById(jobId);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI job not found', 404);
    }
    const now = new Date().toISOString();
    const updated: AiGenerationJobRow = {
      ...before,
      status: 'completed',
      outputJson: JSON.stringify(redact(payload.output)),
      errorCode: null,
      errorMessage: null,
      modelUsed: payload.modelUsed,
      promptVersionId: payload.promptVersionId,
      tokenUsageJson: JSON.stringify(payload.tokenUsage),
      finishedAt: now,
    };
    await this.repo.updateStatus(updated);
    await this.audit.log({
      action: 'aiJob.complete',
      targetType: 'ai_job',
      targetId: jobId,
      after: updated,
      actor,
    });
    return updated;
  }

  async fail(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    actor: AuditActor
  ): Promise<AiGenerationJobRow> {
    const before = await this.repo.findById(jobId);
    if (!before) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI job not found', 404);
    }
    const now = new Date().toISOString();
    const updated: AiGenerationJobRow = {
      ...before,
      status: 'failed',
      errorCode,
      errorMessage,
      finishedAt: now,
    };
    await this.repo.updateStatus(updated);
    await this.audit.log({
      action: 'aiJob.fail',
      targetType: 'ai_job',
      targetId: jobId,
      severity: 'warning',
      after: updated,
      actor,
    });
    return updated;
  }

  async get(id: string): Promise<AiGenerationJobRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new AppError(errorCodes.NOT_FOUND, 'AI job not found', 404);
    }
    return row;
  }

  async list(brandId: string, options: ListJobsApiOptions = {}): Promise<AiJobListResult> {
    const repoOptions: ListJobsOptions = {
      status: options.status,
      jobType: options.jobType,
      page: options.page,
      pageSize: options.pageSize,
    };
    const { items, total } = await this.repo.findByBrand(brandId, repoOptions);
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
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
}
