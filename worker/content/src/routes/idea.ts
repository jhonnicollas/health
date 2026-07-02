import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { fail, success } from '../utils/responses.js';
import { fromError } from '../utils/errors.js';
import { IdeaRepository } from '../repositories/idea.js';
import { CampaignRepository } from '../repositories/campaign.js';
import { PillarRepository } from '../repositories/pillar.js';
import { BrandRepository } from '../repositories/brand.js';
import { AiConfigRepository } from '../repositories/ai-config.js';
import { DraftRepository } from '../repositories/draft.js';
import { RevisionRepository } from '../repositories/revision.js';
import { AuditRepository, AuditService } from '../services/audit.js';
import { IntegrityService } from '../services/integrity.js';
import { IdeaService, IDEA_STATUSES } from '../services/idea.js';
import { DraftService } from '../services/draft.js';
import { AiJobService } from '../services/ai-job.js';
import { AiJobRepository } from '../repositories/ai-job.js';
import { QuotaService } from '../services/quota.js';
import { UsageService } from '../services/usage.js';
import { RateLimitService, RateLimitRepository } from '../services/rate-limit.js';
import { PromptVersionRepository } from '../repositories/prompt-version.js';
import { isNonEmptyString } from '../utils/validation.js';

export const ideaRouter = new Hono<{ Bindings: Env }>();

ideaRouter.use('*', createAuthMiddleware(headerMockAuthResolver));

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

function buildSvc(c: Context<{ Bindings: Env }>): IdeaService {
  const db = c.env.DB;
  return new IdeaService({
    db,
    repo: new IdeaRepository(db),
    campaignRepo: new CampaignRepository(db),
    pillarRepo: new PillarRepository(db),
    brandRepo: new BrandRepository(db),
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
    integrity: new IntegrityService(db),
  });
}

function buildDraftSvc(c: Context<{ Bindings: Env }>): DraftService {
  const db = c.env.DB;
  return new DraftService({
    db,
    repo: new DraftRepository(db),
    revisionRepo: new RevisionRepository(db),
    ideaRepo: new IdeaRepository(db),
    campaignRepo: new CampaignRepository(db),
    brandRepo: new BrandRepository(db),
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
    integrity: new IntegrityService(db),
  });
}



ideaRouter.get('/', requirePermission('content.idea.read'), async (c) => {
  try {
    const brandId = c.req.query('brandId');
    if (!isNonEmptyString(brandId)) {
      return fail(c, 'VALIDATION_ERROR', 'brandId is required', 400);
    }
    const status = c.req.query('status');
    if (status !== undefined && !IDEA_STATUSES.includes(status as (typeof IDEA_STATUSES)[number])) {
      return fail(c, 'VALIDATION_ERROR', `status must be one of ${IDEA_STATUSES.join(', ')}`, 400);
    }
    const page = Number(c.req.query('page') ?? '1');
    const pageSize = Number(c.req.query('pageSize') ?? '20');
    if (!Number.isInteger(page) || page < 1) {
      return fail(c, 'VALIDATION_ERROR', 'page must be >= 1', 400);
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return fail(c, 'VALIDATION_ERROR', 'pageSize must be 1..100', 400);
    }
    const svc = buildSvc(c);
    const result = await svc.list(brandId, {
      campaignId: c.req.query('campaignId'),
      pillarId: c.req.query('pillarId'),
      status: status as never,
      targetPlatform: c.req.query('targetPlatform') as never,
      contentFormat: c.req.query('contentFormat') as never,
      page,
      pageSize,
    });
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

ideaRouter.get('/:id', requirePermission('content.idea.read'), async (c) => {
  try {
    const repo = new IdeaRepository(c.env.DB);
    const row = await repo.findById(c.req.param('id'));
    if (!row) return fail(c, 'NOT_FOUND', 'Idea not found', 404);
    return success(c, row);
  } catch (e) {
    return handleError(c, e);
  }
});

ideaRouter.post('/:id/approve', requirePermission('content.idea.approve'), async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as { note?: string };
    const svc = buildSvc(c);
    const after = await svc.approve(c.req.param('id'), actor(c), body.note);
    return success(c, { ideaId: after.id, status: after.status, updatedAt: after.updatedAt });
  } catch (e) {
    return handleError(c, e);
  }
});

ideaRouter.post('/:id/reject', requirePermission('content.idea.approve'), async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as { note?: string } | null;
    if (!body || !isNonEmptyString(body.note)) {
      return fail(c, 'VALIDATION_ERROR', 'note is required', 400);
    }
    const svc = buildSvc(c);
    const after = await svc.reject(c.req.param('id'), actor(c), body.note);
    return success(c, { ideaId: after.id, status: after.status, note: body.note });
  } catch (e) {
    return handleError(c, e);
  }
});

ideaRouter.post('/:id/generate-draft', requirePermission('content.draft.generate'), async (c) => {
  try {
    const idempotencyKey = c.req.header('Idempotency-Key') ?? c.req.header('idempotency-key');
    if (!isNonEmptyString(idempotencyKey)) {
      return fail(c, 'VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
    }
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
    const draftSvc = buildDraftSvc(c);
    const result = await draftSvc.generate(c.req.param('id'), body as never, actor(c), idempotencyKey);
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});
