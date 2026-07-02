import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { success, fail } from '../utils/responses.js';
import { fromError } from '../utils/errors.js';
import { BrandService } from '../services/brand.js';

const brand = new Hono<{ Bindings: Env }>();

brand.use('*', createAuthMiddleware(headerMockAuthResolver));

const handleError = (c: Context, e: unknown): Response => {
  const err = fromError(e);
  return fail(c, err.code, err.message, err.status as ContentfulStatusCode);
};

brand.get('/:id', requirePermission('content.brand.read'), async (c) => {
  try {
    const svc = new BrandService(c.env.DB);
    const data = await svc.getById(c.req.param('id'));
    return success(c, data);
  } catch (e) {
    return handleError(c, e);
  }
});

brand.patch('/:id', requirePermission('content.brand.update'), async (c) => {
  try {
    const svc = new BrandService(c.env.DB);
    const body = (await c.req.json()) as unknown;
    const data = await svc.update(c.req.param('id'), body, c.get('user'));
    return success(c, data);
  } catch (e) {
    return handleError(c, e);
  }
});

export default brand;
