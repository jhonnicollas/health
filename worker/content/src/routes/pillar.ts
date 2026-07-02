import { Hono, type Context } from 'hono';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { AuditRepository, AuditService } from '../services/audit.js';
import { IntegrityService } from '../services/integrity.js';
import { PillarRepository } from '../repositories/pillar.js';
import { PillarService } from '../services/pillar.js';
import type { PillarCreateInput, PillarUpdateInput } from '../types/domain.js';
import { isUUID } from '../utils/validation.js';
import { fromError } from '../utils/errors.js';
import { fail, success } from '../utils/responses.js';

function badRequest(c: Context, message: string) {
  return fail(c, 'VALIDATION_ERROR', message, 400);
}

function parseBool(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return undefined;
}

function buildService(c: Context<{ Bindings: Env }>): PillarService {
  const db = c.env.DB;
  return new PillarService(
    new PillarRepository(db),
    new IntegrityService(db),
    new AuditService(new AuditRepository(db))
  );
}

export const pillarRouter = new Hono<{ Bindings: Env }>();

pillarRouter.use('*', createAuthMiddleware(headerMockAuthResolver));

pillarRouter.get('/', requirePermission('content.pillar.read'), async (c) => {
  try {
    const brandId = c.req.query('brandId');
    if (!brandId || !isUUID(brandId)) return badRequest(c, 'brandId must be a valid UUID');

    const page = Number(c.req.query('page') ?? '1');
    const pageSize = Number(c.req.query('pageSize') ?? '20');
    if (!Number.isInteger(page) || page < 1) return badRequest(c, 'page must be >= 1');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return badRequest(c, 'pageSize must be 1..100');
    }

    const isActive = parseBool(c.req.query('isActive'));
    if (c.req.query('isActive') !== undefined && isActive === undefined) {
      return badRequest(c, 'isActive must be true|false|1|0');
    }

    const result = await buildService(c).list(brandId, { page, pageSize, isActive });
    return success(c, result);
  } catch (e) {
    const { code, status, message } = fromError(e);
    return fail(c, code, message, status as 400);
  }
});

pillarRouter.post('/', requirePermission('content.pillar.manage'), async (c) => {
  try {
    const body = (await c.req.json()) as Partial<PillarCreateInput>;
    const user = c.get('user');
    const actor = {
      id: user.id,
      role: user.roles.join(','),
      ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    };
    const result = await buildService(c).create(body as PillarCreateInput, actor);
    return success(c, result, 201);
  } catch (e) {
    const { code, status, message } = fromError(e);
    return fail(c, code, message, status as 400);
  }
});

pillarRouter.patch('/:id', requirePermission('content.pillar.manage'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = (await c.req.json()) as Partial<PillarUpdateInput>;
    const user = c.get('user');
    const actor = {
      id: user.id,
      role: user.roles.join(','),
      ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    };
    const result = await buildService(c).update(id, body as PillarUpdateInput, actor);
    return success(c, result);
  } catch (e) {
    const { code, status, message } = fromError(e);
    return fail(c, code, message, status as 400);
  }
});
