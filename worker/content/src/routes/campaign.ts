import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { Env } from '../env.js';
import { createAuthMiddleware, headerMockAuthResolver } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { CampaignRepository } from '../repositories/campaign.js';
import { AuditRepository, AuditService } from '../services/audit.js';
import { IntegrityService } from '../services/integrity.js';
import { CampaignService } from '../services/campaign.js';
import { IdeaService } from '../services/idea.js';
import { IdeaRepository } from '../repositories/idea.js';
import { PillarRepository } from '../repositories/pillar.js';
import { BrandRepository } from '../repositories/brand.js';
import { AiConfigRepository } from '../repositories/ai-config.js';
import { PromptVersionRepository } from '../repositories/prompt-version.js';
import { AiJobRepository } from '../repositories/ai-job.js';
import { AiJobService } from '../services/ai-job.js';
import { QuotaService } from '../services/quota.js';
import { UsageService } from '../services/usage.js';
import { RateLimitService, RateLimitRepository } from '../services/rate-limit.js';
import { fromError } from '../utils/errors.js';
import { fail, notFound, success } from '../utils/responses.js';

function deps(c: Context<{ Bindings: Env }>) {
  const auditRepo = new AuditRepository(c.env.DB);
  return {
    svc: new CampaignService({
      repo: new CampaignRepository(c.env.DB),
      integrity: new IntegrityService(c.env.DB),
      audit: new AuditService(auditRepo),
    }),
  };
}

const router = new Hono<{ Bindings: Env }>()
  .use('*', createAuthMiddleware(headerMockAuthResolver))
  .get('/', requirePermission('content.campaign.read'), async (c) => {
    const { svc } = deps(c);
    const brandId = c.req.query('brandId');
    if (!brandId) return fail(c, 'VALIDATION_ERROR', 'brandId is required', 400);
    const page = Number(c.req.query('page') ?? '1');
    const pageSize = Number(c.req.query('pageSize') ?? '20');
    const status = c.req.query('status');
    const language = c.req.query('language');
    try {
      const result = await svc.list(brandId, {
        page: Number.isFinite(page) ? page : 1,
        pageSize: Number.isFinite(pageSize) ? pageSize : 20,
        status,
        language,
      });
      return success(c, result);
    } catch (e) {
      const err = fromError(e);
      return fail(c, err.code, err.message, err.status as 400);
    }
  })
  .post('/', requirePermission('content.campaign.create'), async (c) => {
    const { svc } = deps(c);
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
    try {
      const row = await svc.create(body, {
        id: user.id,
        role: user.roles?.[0],
        ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
        userAgent: c.req.header('user-agent') ?? undefined,
      });
      return success(c, row, 201);
    } catch (e) {
      const err = fromError(e);
      return fail(c, err.code, err.message, err.status as 400);
    }
  })
  .get('/:id', requirePermission('content.campaign.read'), async (c) => {
    const repo = new CampaignRepository(c.env.DB);
    const row = await repo.findById(c.req.param('id'));
    if (!row) return notFound(c);
    return success(c, row);
  })
  .patch('/:id', requirePermission('content.campaign.update'), async (c) => {
    const { svc } = deps(c);
    const user = c.get('user');
    const body = await c.req.json().catch(() => null);
    if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
    try {
      const row = await svc.update(c.req.param('id'), body, {
        id: user.id,
        role: user.roles?.[0],
        ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
        userAgent: c.req.header('user-agent') ?? undefined,
      });
      return success(c, row);
    } catch (e) {
      const err = fromError(e);
      return fail(c, err.code, err.message, err.status as 400);
    }
  })
  .post('/:id/generate-ideas', requirePermission('content.idea.generate'), async (c) => {
    const user = c.get('user');
    const idempotencyKey = c.req.header('Idempotency-Key') ?? c.req.header('idempotency-key');
    if (!idempotencyKey) return fail(c, 'VALIDATION_ERROR', 'Idempotency-Key header is required', 400);
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return fail(c, 'VALIDATION_ERROR', 'Invalid JSON body', 400);
    const db = c.env.DB;
    const svc = new IdeaService({
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
    try {
      const result = await svc.generate(c.req.param('id'), body as never, {
        id: user.id,
        role: user.roles?.[0] ?? user.roles.join(','),
        ipAddress: c.req.header('cf-connecting-ip') ?? undefined,
        userAgent: c.req.header('user-agent') ?? undefined,
      }, idempotencyKey);
      return success(c, result);
    } catch (e) {
      const err = fromError(e);
      return fail(c, err.code, err.message, err.status as ContentfulStatusCode);
    }
  });

export default router;
