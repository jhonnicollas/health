import { AppError, errorCodes } from '../utils/errors.js';
import type { AiQuotaRow, QuotaPeriod } from '../types/ai.js';

const DEFAULT_LIMITS = {
  maxJobs: 1000,
  maxTokens: 1_000_000,
  maxCostUsd: 10,
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return x.toISOString();
}

function endOfUtcDay(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return x.toISOString();
}

function endOfUtcMonth(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
}

function buildResetsAt(period: QuotaPeriod, now: Date): string {
  return period === 'daily' ? endOfUtcDay(now) : endOfUtcMonth(now);
}

function buildWindowStart(period: QuotaPeriod, now: Date): string {
  return period === 'daily' ? startOfUtcDay(now) : isoDate(now).slice(0, 7) + '-01T00:00:00.000Z';
}

async function findCurrentQuota(
  db: D1Database,
  brandId: string,
  period: QuotaPeriod,
  now: Date
): Promise<AiQuotaRow | null> {
  // ponytail: simple "current period" = window start <= now < resetsAt
  const start = buildWindowStart(period, now);
  const row = await db
    .prepare(
      `SELECT id, brandId, period, maxJobs, maxTokens, maxCostUsd,
              usedJobs, usedTokens, usedCostUsd, resetsAt, createdAt, updatedAt
         FROM conAiQuotas
        WHERE brandId = ? AND period = ? AND resetsAt > ?
        ORDER BY resetsAt DESC
        LIMIT 1`
    )
    .bind(brandId, period, start)
    .first<AiQuotaRow>();
  return row ?? null;
}

async function ensureQuota(
  db: D1Database,
  brandId: string,
  period: QuotaPeriod,
  now: Date
): Promise<AiQuotaRow> {
  const existing = await findCurrentQuota(db, brandId, period, now);
  if (existing) return existing;
  const nowIso = now.toISOString();
  const row: AiQuotaRow = {
    id: `ai_quota_${brandId}_${period}_${nowIso}`,
    brandId,
    period,
    maxJobs: DEFAULT_LIMITS.maxJobs,
    maxTokens: DEFAULT_LIMITS.maxTokens,
    maxCostUsd: DEFAULT_LIMITS.maxCostUsd,
    usedJobs: 0,
    usedTokens: 0,
    usedCostUsd: 0,
    resetsAt: buildResetsAt(period, now),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await db
    .prepare(
      `INSERT INTO conAiQuotas
        (id, brandId, period, maxJobs, maxTokens, maxCostUsd,
         usedJobs, usedTokens, usedCostUsd, resetsAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      row.id,
      row.brandId,
      row.period,
      row.maxJobs,
      row.maxTokens,
      row.maxCostUsd,
      row.usedJobs,
      row.usedTokens,
      row.usedCostUsd,
      row.resetsAt,
      row.createdAt,
      row.updatedAt
    )
    .run();
  return row;
}

export class QuotaService {
  async checkQuota(
    db: D1Database,
    brandId: string,
    inputTokens: number,
    outputTokens: number,
    costUsd: number,
    now: Date = new Date()
  ): Promise<void> {
    const [daily, monthly] = await Promise.all([
      ensureQuota(db, brandId, 'daily', now),
      ensureQuota(db, brandId, 'monthly', now),
    ]);

    const totalTokens = inputTokens + outputTokens;
    const checks: Array<{ row: AiQuotaRow; period: QuotaPeriod }> = [
      { row: daily, period: 'daily' },
      { row: monthly, period: 'monthly' },
    ];

    for (const { row, period } of checks) {
      if (row.maxJobs !== null && row.usedJobs + 1 > row.maxJobs) {
        throw new AppError(
          errorCodes.QUOTA_EXCEEDED,
          `Job quota exceeded for ${period} period`,
          429
        );
      }
      if (row.maxTokens !== null && row.usedTokens + totalTokens > row.maxTokens) {
        throw new AppError(
          errorCodes.QUOTA_EXCEEDED,
          `Token quota exceeded for ${period} period`,
          429
        );
      }
      if (row.maxCostUsd !== null && row.usedCostUsd + costUsd > row.maxCostUsd) {
        throw new AppError(
          errorCodes.QUOTA_EXCEEDED,
          `Cost quota exceeded for ${period} period`,
          429
        );
      }
    }
  }

  async incrementUsage(
    db: D1Database,
    brandId: string,
    usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number; jobs?: number },
    now: Date = new Date()
  ): Promise<void> {
    const tokens = usage.inputTokens + usage.outputTokens;
    const jobs = usage.jobs ?? 1;
    const updatedAt = now.toISOString();

    for (const period of ['daily', 'monthly'] as const) {
      const row = await ensureQuota(db, brandId, period, now);
      await db
        .prepare(
          `UPDATE conAiQuotas SET
            usedJobs = usedJobs + ?,
            usedTokens = usedTokens + ?,
            usedCostUsd = usedCostUsd + ?,
            updatedAt = ?
          WHERE id = ?`
        )
        .bind(jobs, tokens, usage.estimatedCostUsd, updatedAt, row.id)
        .run();
    }
  }
}
