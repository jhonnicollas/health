import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { fail, success } from '../utils/responses.js';
import { fromError } from '../utils/errors.js';
import { isNonEmptyString } from '../utils/validation.js';
import { DraftRepository } from '../repositories/draft.js';
import { SafetyReportRepository } from '../repositories/safety-report.js';
import { SourceReferenceRepository } from '../repositories/source-reference.js';
import { ApprovalRepository } from '../repositories/approval.js';
import { AuditRepository, AuditService } from '../services/audit.js';
import { ApprovalService } from '../services/approval.js';

export const approvalRouter = new Hono<{ Bindings: Env }>();

approvalRouter.use('*', createAuthMiddleware(headerMockAuthResolver));

function actor(c: Context) {
  const user = c.get('user');
  return {
    id: user.id,
    role: user.roles?.[0] ?? user.roles.join(','),
    roles: user.roles,
    ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  };
}

function handleError(c: Context, e: unknown): Response {
  const err = fromError(e);
  return fail(c, err.code, err.message, err.status as ContentfulStatusCode);
}

function buildSvc(c: Context<{ Bindings: Env }>): ApprovalService {
  const db = c.env.DB;
  return new ApprovalService({
    db,
    draftRepo: new DraftRepository(db),
    safetyReportRepo: new SafetyReportRepository(db),
    sourceRefRepo: new SourceReferenceRepository(db),
    repo: new ApprovalRepository(db),
    audit: new AuditService(new AuditRepository(db)),
  });
}

approvalRouter.get('/queue', requirePermission('content.draft.read'), async (c) => {
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
    const result = await svc.queue(
      {
        brandId,
        healthContentStatus: c.req.query('healthContentStatus') ?? undefined,
        safetyStatus: c.req.query('safetyStatus') ?? undefined,
        platform: c.req.query('platform') ?? undefined,
        contentFormat: c.req.query('contentFormat') ?? undefined,
      },
      { page, pageSize }
    );
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

approvalRouter.post('/:id/approve', requirePermission('content.approve'), async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
    const svc = buildSvc(c);
    const result = await svc.approve(c.req.param('id'), body as never, actor(c));
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

approvalRouter.post('/:id/reject', requirePermission('content.reject'), async (c) => {
  try {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
    const svc = buildSvc(c);
    const result = await svc.reject(c.req.param('id'), body as never, actor(c));
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

approvalRouter.post(
  '/:id/request-revision',
  requirePermission('content.reject'),
  async (c) => {
    try {
      const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
      const svc = buildSvc(c);
      const result = await svc.requestRevision(c.req.param('id'), body as never, actor(c));
      return success(c, result);
    } catch (e) {
      return handleError(c, e);
    }
  }
);
