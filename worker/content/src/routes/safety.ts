import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { fail, success } from '../utils/responses.js';
import { fromError } from '../utils/errors.js';
import { isNonEmptyString } from '../utils/validation.js';
import { DraftRepository } from '../repositories/draft.js';
import { RevisionRepository } from '../repositories/revision.js';
import { BrandRepository } from '../repositories/brand.js';
import { AiConfigRepository } from '../repositories/ai-config.js';
import { PromptVersionRepository } from '../repositories/prompt-version.js';
import { SafetyReportRepository } from '../repositories/safety-report.js';
import { AiJobRepository } from '../repositories/ai-job.js';
import { AuditService, AuditRepository } from '../services/audit.js';
import { IntegrityService } from '../services/integrity.js';
import { AiJobService } from '../services/ai-job.js';
import { QuotaService } from '../services/quota.js';
import { UsageService } from '../services/usage.js';
import { RateLimitService, RateLimitRepository } from '../services/rate-limit.js';
import { SafetyCheckService } from '../services/safety-check.js';

export const safetyRouter = new Hono<{ Bindings: Env }>();

safetyRouter.use('*', createAuthMiddleware(headerMockAuthResolver));

function actor(c: Context) {
  const user = c.get('user');
  return {
    id: user.id,
    role: user.roles?.[0] ?? user.roles.join(','),
    ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  };
}

function handleError(c: Context, e: unknown): Response {
  const err = fromError(e);
  return fail(c, err.code, err.message, err.status as ContentfulStatusCode);
}

function buildSvc(c: Context<{ Bindings: Env }>): SafetyCheckService {
  const db = c.env.DB;
  return new SafetyCheckService({
    db,
    draftRepo: new DraftRepository(db),
    revisionRepo: new RevisionRepository(db),
    brandRepo: new BrandRepository(db),
    safetyReportRepo: new SafetyReportRepository(db),
    aiConfigRepo: new AiConfigRepository(db),
    promptLoader: new PromptVersionRepository(db),
    aiJobs: new AiJobService(
      new AiJobRepository(db),
      new IntegrityService(db),
      new AuditService(new AuditRepository(db))
    ),
    quota: new QuotaService(),
    usage: new UsageService(db),
    rateLimit: new RateLimitService(new RateLimitRepository(db)),
    audit: new AuditService(new AuditRepository(db)),
  });
}

safetyRouter.post('/:id/safety-check', requirePermission('content.safety.run'), async (c) => {
  const idempotencyKey =
    c.req.header('Idempotency-Key') ?? c.req.header('idempotency-key');
  if (!isNonEmptyString(idempotencyKey)) {
    return fail(c, 'VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
  }
  const body = (await c.req.json().catch(() => null)) as
    | { revisionNumber?: unknown }
    | null;
  if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
  if (!Number.isInteger(body.revisionNumber) || (body.revisionNumber as number) < 1) {
    return fail(c, 'VALIDATION_ERROR', 'revisionNumber must be a positive integer', 400);
  }
  try {
    const svc = buildSvc(c);
    const result = await svc.run(
      c.req.param('id'),
      { revisionNumber: body.revisionNumber as number },
      actor(c),
      idempotencyKey
    );
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

safetyRouter.get('/:id/safety-report', requirePermission('content.safety.review'), async (c) => {
  const revisionNumberRaw = c.req.query('revisionNumber');
  let revisionNumber: number | null = null;
  if (revisionNumberRaw !== undefined) {
    const parsed = Number(revisionNumberRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return fail(c, 'VALIDATION_ERROR', 'revisionNumber must be a positive integer', 400);
    }
    revisionNumber = parsed;
  }
  try {
    const svc = buildSvc(c);
    const report = revisionNumber === null
      ? await svc.getLatestReport(c.req.param('id'))
      : await svc.getReport(c.req.param('id'), revisionNumber);
    if (!report) return fail(c, 'NOT_FOUND', 'Safety report not found', 404);
    return success(c, report);
  } catch (e) {
    return handleError(c, e);
  }
});
