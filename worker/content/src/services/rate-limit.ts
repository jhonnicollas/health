import type { AuditService } from './audit.js';

export type RateLimitAction =
  | 'generate_ideas'
  | 'generate_draft'
  | 'safety_check'
  | 'export_markdown'
  | 'ai_config_update';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
}

export const RATE_LIMITS: Record<RateLimitAction, { window: 'hour' | 'day'; max: number }> = {
  generate_ideas: { window: 'hour', max: 5 },
  generate_draft: { window: 'day', max: 100 },
  safety_check: { window: 'day', max: 200 },
  export_markdown: { window: 'day', max: 300 },
  ai_config_update: { window: 'day', max: 20 },
};

export interface RateLimitCounterRow {
  count: number;
  windowEnd: string;
}

export class RateLimitRepository {
  constructor(private db: D1Database) {}

  async getCounter(
    brandId: string,
    actorId: string,
    action: RateLimitAction,
    windowStart: string
  ): Promise<RateLimitCounterRow | null> {
    const row = await this.db
      .prepare(
        'SELECT count AS count, windowEnd AS windowEnd FROM conRateLimitCounters WHERE brandId = ? AND actorId = ? AND action = ? AND windowStart = ?'
      )
      .bind(brandId, actorId, action, windowStart)
      .first<RateLimitCounterRow>();
    return row ?? null;
  }

  async upsertCounter(
    brandId: string,
    actorId: string,
    action: RateLimitAction,
    windowStart: string,
    windowEnd: string,
    count: number
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT INTO conRateLimitCounters
          (id, brandId, actorId, action, windowStart, windowEnd, count, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(brandId, actorId, action, windowStart)
         DO UPDATE SET count = excluded.count, updatedAt = excluded.updatedAt`
      )
      .bind(crypto.randomUUID(), brandId, actorId, action, windowStart, windowEnd, count, nowIso, nowIso)
      .run();
  }
}

function computeWindow(now: Date, window: 'hour' | 'day'): { start: string; end: string } {
  if (window === 'hour') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export class RateLimitService {
  constructor(private repo: RateLimitRepository, private audit?: AuditService) {}

  async checkAndIncrement(
    brandId: string,
    actorId: string,
    action: RateLimitAction,
    now: Date = new Date()
  ): Promise<RateLimitResult> {
    const { max, window } = RATE_LIMITS[action];
    const { start: windowStart, end: windowEnd } = computeWindow(now, window);

    const existing = await this.repo.getCounter(brandId, actorId, action, windowStart);
    const currentCount = existing?.count ?? 0;

    if (currentCount >= max) {
      if (this.audit) {
        await this.audit.log({
          action: 'rate_limit.exceeded',
          targetType: 'rate_limit',
          targetId: `${brandId}:${action}`,
          severity: 'warning',
          actor: { id: actorId },
        });
      }
      return { allowed: false, limit: max, remaining: 0, resetAt: windowEnd };
    }

    const newCount = currentCount + 1;
    await this.repo.upsertCounter(brandId, actorId, action, windowStart, windowEnd, newCount);
    return { allowed: true, limit: max, remaining: max - newCount, resetAt: windowEnd };
  }
}
