import { test } from 'node:test';
import assert from 'node:assert';
import { DraftService } from '../dist/services/draft.js';
import { IdeaService } from '../dist/services/idea.js';
import { DraftRepository } from '../dist/repositories/draft.js';
import { IdeaRepository } from '../dist/repositories/idea.js';
import { RevisionRepository } from '../dist/repositories/revision.js';
import { CampaignRepository } from '../dist/repositories/campaign.js';
import { BrandRepository } from '../dist/repositories/brand.js';
import { PillarRepository } from '../dist/repositories/pillar.js';
import { AiConfigRepository } from '../dist/repositories/ai-config.js';
import { PromptVersionRepository } from '../dist/repositories/prompt-version.js';
import { AiJobRepository } from '../dist/repositories/ai-job.js';
import { AuditService, AuditRepository } from '../dist/services/audit.js';
import { IntegrityService } from '../dist/services/integrity.js';
import { AiJobService } from '../dist/services/ai-job.js';
import { QuotaService } from '../dist/services/quota.js';
import { UsageService } from '../dist/services/usage.js';
import { RateLimitService, RateLimitRepository } from '../dist/services/rate-limit.js';
import { errorCodes } from '../dist/utils/errors.js';
import { ideaRouter } from '../dist/routes/idea.js';
import { draftRouter } from '../dist/routes/draft.js';
import { makeFakeDb } from './fake-db.mjs';

const BRAND_ID = 'brand-1';

function seedBase(db, rows, { ideaStatus = 'idea_approved' } = {}) {
  rows.brands.set(BRAND_ID, {
    id: BRAND_ID,
    name: 'iSehat',
    positioning: 'Daily health companion',
    productValueJson: '["Health logging"]',
    targetAudienceJson: '["Adults"]',
    tone: 'Clear, trustworthy',
    languageDefault: 'id',
    disclaimerTemplate: 'Konten ini bersifat edukatif.',
    forbiddenClaimsJson: '["AI doctor"]',
    allowedClaimsJson: '["Records health data"]',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.campaigns.set('campaign_001', {
    id: 'campaign_001',
    brandId: BRAND_ID,
    name: 'Spring',
    objective: 'Awareness',
    targetPlatformsJson: '["instagram"]',
    pillarIdsJson: '["pillar-1"]',
    targetAudience: null,
    language: 'id',
    startDate: null,
    endDate: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.pillars.set('pillar-1', {
    id: 'pillar-1',
    brandId: BRAND_ID,
    name: 'Awareness',
    slug: 'health_data_awareness',
    description: 'desc',
    targetAudience: 'adults',
    priority: 10,
    isActive: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.aiConfigs.set('cfg_draft', {
    id: 'cfg_draft',
    brandId: BRAND_ID,
    provider: 'mock',
    model: 'mock-1',
    purpose: 'draft_generation',
    temperature: 0.7,
    maxTokens: 1024,
    timeoutMs: 5000,
    fallbackOrder: 0,
    isActive: 1,
    secretRef: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.aiPromptVersions.set('pv_draft', {
    id: 'pv_draft',
    promptKey: 'draft_generation',
    version: 1,
    promptText: 'draft_generation prompt',
    modelRole: 'generator',
    isActive: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  // High-limit quota so quota check does not block tests.
  rows.aiQuotas.set('quota_daily', {
    id: 'quota_daily',
    brandId: BRAND_ID,
    period: 'daily',
    maxJobs: 99999,
    maxTokens: 99999999,
    maxCostUsd: 9999,
    usedJobs: 0,
    usedTokens: 0,
    usedCostUsd: 0,
    resetsAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.aiQuotas.set('quota_monthly', {
    id: 'quota_monthly',
    brandId: BRAND_ID,
    period: 'monthly',
    maxJobs: 99999,
    maxTokens: 99999999,
    maxCostUsd: 9999,
    usedJobs: 0,
    usedTokens: 0,
    usedCostUsd: 0,
    resetsAt: '2099-02-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.ideas.set('idea_001', {
    id: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'Catat tensi, bukan cuma angka',
    angle: 'Context matters',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 80,
    contentHash: 'h1',
    sourceType: 'ai_inferred',
    confidence: 'high',
    status: ideaStatus,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
}

function makeDraftSvc(db) {
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

function makeIdeaSvc(db) {
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

const ACTOR = { id: 'user-1', role: 'owner' };

function makeHeaders({ id = 'user-1', roles = 'owner', idempotencyKey = 'ik-1' } = {}) {
  return {
    'x-content-user-id': id,
    'x-content-user-roles': roles,
    'content-type': 'application/json',
    'idempotency-key': idempotencyKey,
  };
}

function makeEnv(db) {
  return { DB: db, ENVIRONMENT: 'local' };
}

test('DraftService.generate requires idea.status === idea_approved', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows, { ideaStatus: 'idea' });
  const svc = makeDraftSvc(db);
  await assert.rejects(
    svc.generate('idea_001', { language: 'id' }, ACTOR, 'ik-1'),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /approved/i.test(e.message)
  );
});

test('DraftService.generate creates a draft and revision snapshot', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeDraftSvc(db);
  const result = await svc.generate('idea_001', { language: 'id' }, ACTOR, 'ik-1');
  assert.strictEqual(result.jobStatus, 'completed');
  assert.match(result.draftId, /^draft_[a-f0-9]{12}$/);
  assert.strictEqual(result.revisionNumber, 1);
  assert.strictEqual(result.status, 'draft_ready');
  assert.strictEqual(result.safetyStatus, 'needs_check');
  assert.strictEqual(result.approvalStatus, 'not_submitted');

  // Draft row stored
  assert.strictEqual(rows.drafts.size, 1);
  const draft = rows.drafts.get(result.draftId);
  assert.strictEqual(draft.ideaId, 'idea_001');
  assert.strictEqual(draft.brandId, BRAND_ID);
  assert.strictEqual(draft.platform, 'instagram');
  assert.strictEqual(draft.currentRevision, 1);

  // Revision snapshot stored
  assert.strictEqual(rows.revisions.size, 1);
  const rev = [...rows.revisions.values()][0];
  assert.strictEqual(rev.draftId, result.draftId);
  assert.strictEqual(rev.revisionNumber, 1);
  assert.strictEqual(rev.changeReason, 'Initial draft generation');
  assert.ok(rev.snapshotJson.length > 0);
});

test('DraftService.update creates a new revision, increments currentRevision, resets status', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeDraftSvc(db);
  const created = await svc.generate('idea_001', { language: 'id' }, ACTOR, 'ik-1');
  const updated = await svc.update(
    created.draftId,
    { primaryHook: 'Updated hook', changeReason: 'Manual copy improvement' },
    ACTOR
  );
  assert.strictEqual(updated.currentRevision, 2);
  assert.strictEqual(updated.status, 'draft_ready');
  assert.strictEqual(updated.safetyStatus, 'needs_check');
  assert.strictEqual(updated.approvalStatus, 'not_submitted');
  assert.strictEqual(updated.healthContentStatus, 'uncertain');
  assert.strictEqual(updated.primaryHook, 'Updated hook');

  const revisions = [...rows.revisions.values()].sort(
    (a, b) => a.revisionNumber - b.revisionNumber
  );
  assert.strictEqual(revisions.length, 2);
  assert.strictEqual(revisions[1].revisionNumber, 2);
  assert.strictEqual(revisions[1].changeReason, 'Manual copy improvement');
});

test('DraftService.update rejects when changeReason is missing', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeDraftSvc(db);
  const created = await svc.generate('idea_001', { language: 'id' }, ACTOR, 'ik-1');
  await assert.rejects(
    svc.update(created.draftId, { primaryHook: 'X' }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /changeReason/i.test(e.message)
  );
});

test('DraftService.list paginates by brand', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.drafts.set('draft_a', {
    id: 'draft_a',
    ideaId: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    platform: 'instagram',
    contentFormat: 'carousel',
    language: 'id',
    currentRevision: 1,
    primaryHook: 'A',
    hookAlternativesJson: null,
    mainContent: 'a',
    carouselSlidesJson: null,
    scriptJson: null,
    caption: null,
    cta: null,
    hashtagsJson: null,
    visualBriefJson: null,
    thumbnailText: null,
    altText: null,
    disclaimer: null,
    healthContentStatus: 'uncertain',
    safetyStatus: 'needs_check',
    approvalStatus: 'not_submitted',
    status: 'draft_ready',
    publishReadinessScore: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.drafts.set('draft_b', {
    id: 'draft_b',
    ideaId: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    platform: 'instagram',
    contentFormat: 'carousel',
    language: 'id',
    currentRevision: 1,
    primaryHook: 'B',
    hookAlternativesJson: null,
    mainContent: 'b',
    carouselSlidesJson: null,
    scriptJson: null,
    caption: null,
    cta: null,
    hashtagsJson: null,
    visualBriefJson: null,
    thumbnailText: null,
    altText: null,
    disclaimer: null,
    healthContentStatus: 'uncertain',
    safetyStatus: 'needs_check',
    approvalStatus: 'not_submitted',
    status: 'draft_ready',
    publishReadinessScore: 0,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });
  const svc = makeDraftSvc(db);
  const page1 = await svc.list(BRAND_ID, { page: 1, pageSize: 1 });
  assert.strictEqual(page1.items.length, 1);
  assert.strictEqual(page1.pagination.total, 2);
  assert.strictEqual(page1.pagination.hasNext, true);
  const page2 = await svc.list(BRAND_ID, { page: 2, pageSize: 1 });
  assert.strictEqual(page2.items.length, 1);
  assert.strictEqual(page2.pagination.hasNext, false);
});

test('Route POST /ideas/:id/generate-draft creates a draft', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const res = await ideaRouter.request(
    '/idea_001/generate-draft',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ language: 'id' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.revisionNumber, 1);
  assert.strictEqual(body.data.status, 'draft_ready');
  assert.strictEqual(rows.drafts.size, 1);
});

test('Route POST /ideas/:id/generate-draft rejects missing Idempotency-Key', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const res = await ideaRouter.request(
    '/idea_001/generate-draft',
    {
      method: 'POST',
      headers: { ...makeHeaders(), 'idempotency-key': '' },
      body: JSON.stringify({ language: 'id' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
});

test('Route POST /ideas/:id/generate-draft rejects non-approved idea', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows, { ideaStatus: 'idea' });
  const res = await ideaRouter.request(
    '/idea_001/generate-draft',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ language: 'id' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.error.code, errorCodes.VALIDATION_ERROR);
});

test('Route PATCH /drafts/:id updates a draft and creates a revision', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeDraftSvc(db);
  const created = await svc.generate('idea_001', { language: 'id' }, ACTOR, 'ik-1');
  const res = await draftRouter.request(
    `/${created.draftId}`,
    {
      method: 'PATCH',
      headers: makeHeaders(),
      body: JSON.stringify({ primaryHook: 'New', changeReason: 'Copy fix' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.currentRevision, 2);
  assert.strictEqual(body.data.status, 'draft_ready');
  assert.strictEqual(body.data.safetyStatus, 'needs_check');
  assert.strictEqual(body.data.approvalStatus, 'not_submitted');
});

test('Route GET /drafts paginates by brand', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeDraftSvc(db);
  await svc.generate('idea_001', { language: 'id' }, ACTOR, 'ik-1');
  const res = await draftRouter.request(
    `/?brandId=${BRAND_ID}`,
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.items.length, 1);
  assert.strictEqual(body.data.pagination.total, 1);
});

test('Route GET /drafts requires brandId', async () => {
  const { db } = makeFakeDb();
  const res = await draftRouter.request('/', { headers: makeHeaders() }, makeEnv(db));
  assert.strictEqual(res.status, 400);
});

test('Route GET /drafts/:id/revisions returns the revision list', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeDraftSvc(db);
  const created = await svc.generate('idea_001', { language: 'id' }, ACTOR, 'ik-1');
  await svc.update(created.draftId, { primaryHook: 'X', changeReason: 'r2' }, ACTOR);
  const res = await draftRouter.request(
    `/${created.draftId}/revisions`,
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.items.length, 2);
  assert.deepStrictEqual(
    body.data.items.map((r) => r.revisionNumber),
    [1, 2]
  );
});
