import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { fail, success } from '../utils/responses.js';
import { fromError } from '../utils/errors.js';
import { PromptVersionRepository } from '../repositories/prompt-version.js';
import { AuditRepository, AuditService } from '../services/audit.js';
import { ALLOWED_PROMPT_KEYS, PromptVersionService } from '../services/prompt-version.js';

function deps(c: Context<{ Bindings: Env }>) {
  return {
    svc: new PromptVersionService({
      repo: new PromptVersionRepository(c.env.DB),
      audit: new AuditService(new AuditRepository(c.env.DB)),
    }),
  };
}

function handleError(c: Context, e: unknown): Response {
  const err = fromError(e);
  return fail(c, err.code, err.message, err.status as ContentfulStatusCode);
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

export const promptVersionRouter = new Hono<{ Bindings: Env }>();

promptVersionRouter.use('*', createAuthMiddleware(headerMockAuthResolver));

promptVersionRouter.get('/', requirePermission('content.aiConfig.manage'), async (c) => {
  const promptKey = c.req.query('promptKey');
  if (!promptKey || !ALLOWED_PROMPT_KEYS.includes(promptKey as (typeof ALLOWED_PROMPT_KEYS)[number])) {
    return fail(
      c,
      'VALIDATION_ERROR',
      `promptKey must be one of ${ALLOWED_PROMPT_KEYS.join(', ')}`,
      400
    );
  }
  try {
    const result = await deps(c).svc.listByKey(promptKey);
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});

promptVersionRouter.post('/', requirePermission('content.aiConfig.manage'), async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
  try {
    const result = await deps(c).svc.create(body, actor(c));
    return success(c, result, 201);
  } catch (e) {
    return handleError(c, e);
  }
});

promptVersionRouter.post('/:id/activate', requirePermission('content.aiConfig.manage'), async (c) => {
  try {
    const result = await deps(c).svc.activate(c.req.param('id'), actor(c));
    return success(c, result);
  } catch (e) {
    return handleError(c, e);
  }
});
