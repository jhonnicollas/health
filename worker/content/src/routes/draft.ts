import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { fail, success } from '../utils/responses.js';
import { fromError } from '../utils/errors.js';
import { DraftRepository } from '../repositories/draft.js';
import { RevisionRepository } from '../repositories/revision.js';
import { IdeaRepository } from '../repositories/idea.js';
import { CampaignRepository } from '../repositories/campaign.js';
import { BrandRepository } from '../repositories/brand.js';
import { AiConfigRepository } from '../repositories/ai-config.js';
import { PromptVersionRepository } from '../repositories/prompt-version.js';
import { AiJobRepository } from '../repositories/ai-job.js';
import { SourceReferenceRepository } from '../repositories/source-reference.js';
import { AuditRepository, AuditService } from '../services/audit.js';
import { IntegrityService } from '../services/integrity.js';
import { DraftService } from '../services/draft.js';
import { SourceReferenceService } from '../services/source-reference.js';
import { AiJobService } from '../services/ai-job.js';
import { QuotaService } from '../services/quota.js';
import { UsageService } from '../services/usage.js';
import { RateLimitService, RateLimitRepository } from '../services/rate-limit.js';
import { isNonEmptyString } from '../utils/validation.js';

export const draftRouter = new Hono<{ Bindings: Env }>();

draftRouter.use('*', createAuthMiddleware(headerMockAuthResolver));

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

function buildSvc(c: Context<{ Bindings: Env }>): DraftService {
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

draftRouter.get('/', requirePermission('content.draft.read'), async (c) => {
  try {
    const brandId = c.req.query('brandId');
    if (!isNonEmptyString(brandId)) {
      return fail(c, 'VALIDATION_ERROR', 'brandId is required', 400);
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
      campaignId: c.req.query('campaignId') ?? undefined,
      ideaId: c.req.query('ideaId') ?? undefined,
      platform: c.req.query('platform') as never,
      contentFormat: c.req.query('contentFormat') as never,
      status: c.req.query('status') as never,
      safetyStatus: c.req.query('safetyStatus') as never,
      approvalStatus: c.req.query('approvalStatus') as never,
      healthContentStatus: c.req.query('healthContentStatus') as never,
      page,
      pageSize,
    });
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

draftRouter.get('/:id', requirePermission('content.draft.read'), async (c) => {
  try {
    const repo = new DraftRepository(c.env.DB);
    const row = await repo.findById(c.req.param('id'));
    if (!row) return fail(c, 'NOT_FOUND', 'Draft not found', 404);
    return success(c, row);
  } catch (e) {
    return handleError(c, e);
  }
});

draftRouter.get('/:id/revisions', requirePermission('content.revision.read'), async (c) => {
  try {
    const revRepo = new RevisionRepository(c.env.DB);
    const rows = await revRepo.findByDraft(c.req.param('id'));
    return success(c, { items: rows });
  } catch (e) {
    return handleError(c, e);
  }
});

draftRouter.patch('/:id', requirePermission('content.draft.update'), async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
    const svc = buildSvc(c);
    const updated = await svc.update(c.req.param('id'), body as never, actor(c));
    return success(c, {
      draftId: updated.id,
      currentRevision: updated.currentRevision,
      status: updated.status,
      healthContentStatus: updated.healthContentStatus,
      safetyStatus: updated.safetyStatus,
      approvalStatus: updated.approvalStatus,
    });
  } catch (e) {
    return handleError(c, e);
  }
});

function buildSourceRefSvc(c: Context<{ Bindings: Env }>): SourceReferenceService {
  const db = c.env.DB;
  return new SourceReferenceService({
    draftRepo: new DraftRepository(db),
    revisionRepo: new RevisionRepository(db),
    repo: new SourceReferenceRepository(db),
    audit: new AuditService(new AuditRepository(db)),
  });
}

draftRouter.get(
  '/:id/source-references',
  requirePermission('content.draft.read'),
  async (c) => {
    try {
      const revisionRaw = c.req.query('revisionNumber');
      let revisionNumber: number | undefined;
      if (revisionRaw !== undefined) {
        const parsed = Number(revisionRaw);
        if (!Number.isInteger(parsed) || parsed < 1) {
          return fail(c, 'VALIDATION_ERROR', 'revisionNumber must be a positive integer', 400);
        }
        revisionNumber = parsed;
      }
      const svc = buildSourceRefSvc(c);
      const items = await svc.list(c.req.param('id'), revisionNumber);
      return success(c, { items });
    } catch (e) {
      return handleError(c, e);
    }
  }
);

draftRouter.post(
  '/:id/source-references',
  requirePermission('content.source_reference.manage'),
  async (c) => {
    try {
      const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
      const svc = buildSourceRefSvc(c);
      const created = await svc.create(c.req.param('id'), body as never, actor(c));
      return success(
        c,
        {
          id: created.id,
          draftId: created.draftId,
          revisionNumber: created.revisionNumber,
          title: created.title,
          url: created.url,
          sourceType: created.sourceType,
          sourceReliability: created.sourceReliability,
          confidence: created.confidence,
          note: created.note,
          fetchedAt: created.fetchedAt,
          createdAt: created.createdAt,
        },
        201
      );
    } catch (e) {
      return handleError(c, e);
    }
  }
);
