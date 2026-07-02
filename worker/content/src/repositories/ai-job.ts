import type {
  AiGenerationJobRow,
  AiJobStatus,
  AiJobType,
} from '../types/ai.js';

const COLUMNS =
  'id, brandId, jobType, status, idempotencyKey, inputJson, outputJson, errorCode, errorMessage, modelUsed, promptVersionId, tokenUsageJson, attemptCount, maxAttempts, startedAt, finishedAt, createdAt';

export interface ListJobsOptions {
  status?: AiJobStatus;
  jobType?: AiJobType;
  page?: number;
  pageSize?: number;
}

export interface ListJobsResult {
  items: AiGenerationJobRow[];
  total: number;
}

export class AiJobRepository {
  constructor(private db: D1Database) {}

  async findById(id: string): Promise<AiGenerationJobRow | null> {
    const row = await this.db
      .prepare(`SELECT ${COLUMNS} FROM conAiGenerationJobs WHERE id = ?`)
      .bind(id)
      .first<AiGenerationJobRow>();
    return row ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<AiGenerationJobRow | null> {
    const row = await this.db
      .prepare(`SELECT ${COLUMNS} FROM conAiGenerationJobs WHERE idempotencyKey = ?`)
      .bind(key)
      .first<AiGenerationJobRow>();
    return row ?? null;
  }

  async create(row: AiGenerationJobRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO conAiGenerationJobs
          (id, brandId, jobType, status, idempotencyKey, inputJson, outputJson, errorCode, errorMessage, modelUsed, promptVersionId, tokenUsageJson, attemptCount, maxAttempts, startedAt, finishedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id,
        row.brandId,
        row.jobType,
        row.status,
        row.idempotencyKey,
        row.inputJson,
        row.outputJson,
        row.errorCode,
        row.errorMessage,
        row.modelUsed,
        row.promptVersionId,
        row.tokenUsageJson,
        row.attemptCount,
        row.maxAttempts,
        row.startedAt,
        row.finishedAt,
        row.createdAt
      )
      .run();
  }

  async updateStatus(row: AiGenerationJobRow): Promise<void> {
    await this.db
      .prepare(
        `UPDATE conAiGenerationJobs SET
          status = ?,
          outputJson = ?,
          errorCode = ?,
          errorMessage = ?,
          modelUsed = ?,
          promptVersionId = ?,
          tokenUsageJson = ?,
          startedAt = ?,
          finishedAt = ?
        WHERE id = ?`
      )
      .bind(
        row.status,
        row.outputJson,
        row.errorCode,
        row.errorMessage,
        row.modelUsed,
        row.promptVersionId,
        row.tokenUsageJson,
        row.startedAt,
        row.finishedAt,
        row.id
      )
      .run();
  }

  async incrementAttempt(id: string): Promise<void> {
    await this.db
      .prepare('UPDATE conAiGenerationJobs SET attemptCount = attemptCount + 1 WHERE id = ?')
      .bind(id)
      .run();
  }

  async findByBrand(brandId: string, options: ListJobsOptions): Promise<ListJobsResult> {
    const filters: string[] = ['brandId = ?'];
    const args: unknown[] = [brandId];
    if (options.status) {
      filters.push('status = ?');
      args.push(options.status);
    }
    if (options.jobType) {
      filters.push('jobType = ?');
      args.push(options.jobType);
    }
    const where = filters.join(' AND ');
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(200, options.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const totalRow = await this.db
      .prepare(`SELECT COUNT(*) AS n FROM conAiGenerationJobs WHERE ${where}`)
      .bind(...args)
      .first<{ n: number }>();
    const total = totalRow?.n ?? 0;

    const listRes = await this.db
      .prepare(
        `SELECT ${COLUMNS} FROM conAiGenerationJobs WHERE ${where}
         ORDER BY createdAt DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...args, pageSize, offset)
      .all<AiGenerationJobRow>();

    return { items: listRes.results ?? [], total };
  }
}
