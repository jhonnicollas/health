import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { fail, success } from '../utils/responses.js';
import { fromError } from '../utils/errors.js';
import { isUUID } from '../utils/validation.js';
import { AiConfigRepository } from '../repositories/ai-config.js';
import { IntegrityService } from '../services/integrity.js';
import { AuditRepository, AuditService } from '../services/audit.js';
import { AiConfigService, AI_PURPOSES } from '../services/ai-config.js';

function deps(c: Context<{ Bindings: Env }>) {
  return {
    svc: new AiConfigService({
      repo: new AiConfigRepository(c.env.DB),
      integrity: new IntegrityService(c.env.DB),
      audit: new AuditService(new AuditRepository(c.env.DB)),
      envName: c.env.ENVIRONMENT,
    }),
  };
}

function handleError(c: Context, e: unknown): Response {
  const err = fromError(e);
  return fail(c, err.code, err.message, err.status as ContentfulStatusCode);
}

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

function actor(c: Context) {
  const user = c.get('user');
  return {
    id: user.id,
    role: user.roles?.[0],
    ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
    userAgent: c.req.header('user-agent') ?? undefined,
  };
}

export const aiConfigRouter = new Hono<{ Bindings: Env }>();

aiConfigRouter.use('*', createAuthMiddleware(headerMockAuthResolver));

aiConfigRouter.get('/', requirePermission('content.aiConfig.manage'), async (c) => {
  const brandId = c.req.query('brandId');
  if (!brandId || !isUUID(brandId)) {
    return fail(c, 'VALIDATION_ERROR', 'brandId must be a valid UUID', 400);
  }
  const purpose = c.req.query('purpose');
  if (purpose !== undefined && !AI_PURPOSES.includes(purpose as (typeof AI_PURPOSES)[number])) {
    return fail(c, 'VALIDATION_ERROR', `purpose must be one of ${AI_PURPOSES.join(', ')}`, 400);
  }
  const isActive = parseBool(c.req.query('isActive'));
  if (c.req.query('isActive') !== undefined && isActive === undefined) {
    return fail(c, 'VALIDATION_ERROR', 'isActive must be true|false|1|0', 400);
  }
  const page = Number(c.req.query('page') ?? '1');
  const pageSize = Number(c.req.query('pageSize') ?? '20');
  if (!Number.isInteger(page) || page < 1) {
    return fail(c, 'VALIDATION_ERROR', 'page must be >= 1', 400);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return fail(c, 'VALIDATION_ERROR', 'pageSize must be 1..100', 400);
  }
  try {
    const result = await deps(c).svc.list(brandId, {
      purpose: purpose as never,
      isActive,
      page,
      pageSize,
    });
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

aiConfigRouter.get('/:id', requirePermission('content.aiConfig.manage'), async (c) => {
  try {
    const result = await deps(c).svc.getById(c.req.param('id'));
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

aiConfigRouter.post('/', requirePermission('content.aiConfig.manage'), async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
  try {
    const result = await deps(c).svc.create(body, actor(c));
    return success(c, result, 201);
  } catch (e) {
    return handleError(c, e);
  }
});

aiConfigRouter.patch('/:id', requirePermission('content.aiConfig.manage'), async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
  try {
    const result = await deps(c).svc.update(c.req.param('id'), body, actor(c));
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

aiConfigRouter.patch('/:id/active', requirePermission('content.aiConfig.manage'), async (c) => {
  const body = await c.req.json().catch(() => null) as { isActive?: unknown } | null;
  if (!body || typeof body.isActive !== 'boolean') {
    return fail(c, 'VALIDATION_ERROR', 'isActive (boolean) is required', 400);
  }
  try {
    const result = await deps(c).svc.setActive(c.req.param('id'), body.isActive, actor(c));
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});
