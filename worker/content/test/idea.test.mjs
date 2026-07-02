import { test } from 'node:test';
import assert from 'node:assert';
import { IdeaService } from '../dist/services/idea.js';
import { IdeaRepository } from '../dist/repositories/idea.js';
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
import campaignRouter from '../dist/routes/campaign.js';
import { makeFakeDb } from './fake-db.mjs';

const BRAND_ID = 'brand-1';

function seedBase(db, rows) {
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
  rows.aiConfigs.set('cfg_idea', {
    id: 'cfg_idea',
    brandId: BRAND_ID,
    provider: 'mock',
    model: 'mock-1',
    purpose: 'idea_generation',
    temperature: 0.7,
    maxTokens: 1024,
    timeoutMs: 5000,
    fallbackOrder: 0,
    isActive: 1,
    secretRef: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.aiPromptVersions.set('pv_idea', {
    id: 'pv_idea',
    promptKey: 'idea_generation',
    version: 1,
    promptText: 'idea_generation prompt',
    modelRole: 'generator',
    isActive: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
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
}

function makeSvc(db) {
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

test('IdeaService.generate creates ideas for an active campaign', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeSvc(db);
  const result = await svc.generate(
    'campaign_001',
    {
      quantity: 1,
      platforms: ['instagram'],
      formats: ['carousel'],
      pillarIds: ['health_data_awareness'],
      language: 'id',
    },
    ACTOR,
    'ik-1'
  );
  assert.strictEqual(result.jobStatus, 'completed');
  assert.ok(result.ideasCreated >= 1);
  assert.ok(result.ideas.length >= 1);
  for (const idea of result.ideas) {
    assert.match(idea.id, /^idea_[a-f0-9]{12}$/);
    assert.strictEqual(idea.status, 'idea');
    assert.strictEqual(idea.targetPlatform, 'instagram');
    assert.ok(['carousel', 'post', 'story_poll', 'reels_script'].includes(idea.contentFormat));
  }
});

test('IdeaService.generate stores generated ideas in conIdeas', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeSvc(db);
  const result = await svc.generate(
    'campaign_001',
    {
      quantity: 3,
      platforms: ['instagram'],
      formats: ['carousel'],
      pillarIds: ['health_data_awareness'],
      language: 'id',
    },
    ACTOR,
    'ik-1'
  );
  assert.strictEqual(rows.ideas.size, result.ideasCreated);
  for (const idea of result.ideas) {
    const stored = rows.ideas.get(idea.id);
    assert.ok(stored, `idea ${idea.id} should be stored in conIdeas`);
    assert.strictEqual(stored.brandId, BRAND_ID);
    assert.strictEqual(stored.campaignId, 'campaign_001');
    assert.strictEqual(stored.pillarId, 'pillar-1');
    assert.ok(stored.title.length > 0);
    assert.ok(stored.angle.length > 0);
    assert.ok(stored.contentHash.length > 0);
  }
});

test('IdeaService.generate rejects missing Idempotency-Key', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const svc = makeSvc(db);
  await assert.rejects(
    svc.generate(
      'campaign_001',
      { quantity: 1, platforms: ['instagram'], formats: ['carousel'], pillarIds: ['health_data_awareness'], language: 'id' },
      ACTOR,
      ''
    ),
    (e) => e.code === errorCodes.VALIDATION_ERROR
  );
});

test('IdeaService.generate rejects archived campaign', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.campaigns.get('campaign_001').status = 'archived';
  const svc = makeSvc(db);
  await assert.rejects(
    svc.generate(
      'campaign_001',
      { quantity: 1, platforms: ['instagram'], formats: ['carousel'], pillarIds: ['health_data_awareness'], language: 'id' },
      ACTOR,
      'ik-1'
    ),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /archived/i.test(e.message)
  );
});

test('IdeaService.approve transitions idea -> idea_approved and audits', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.ideas.set('idea_001', {
    id: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'T',
    angle: 'A',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 80,
    contentHash: 'h',
    sourceType: 'ai_inferred',
    confidence: 'high',
    status: 'idea',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const svc = makeSvc(db);
  const after = await svc.approve('idea_001', ACTOR, 'looks good');
  assert.strictEqual(after.status, 'idea_approved');
  assert.strictEqual(rows.ideas.get('idea_001').status, 'idea_approved');
});

test('IdeaService.approve rejects when idea is already approved', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.ideas.set('idea_001', {
    id: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'T',
    angle: 'A',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 80,
    contentHash: 'h',
    sourceType: 'ai_inferred',
    confidence: 'high',
    status: 'idea_approved',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const svc = makeSvc(db);
  await assert.rejects(
    svc.approve('idea_001', ACTOR, 'note'),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /cannot be approved/i.test(e.message)
  );
});

test('IdeaService.reject requires a note, transitions idea -> rejected, audits', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.ideas.set('idea_001', {
    id: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'T',
    angle: 'A',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 80,
    contentHash: 'h',
    sourceType: 'ai_inferred',
    confidence: 'high',
    status: 'idea',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const svc = makeSvc(db);
  await assert.rejects(
    svc.reject('idea_001', ACTOR, ''),
    (e) => e.code === errorCodes.VALIDATION_ERROR && /note/i.test(e.message)
  );
  const after = await svc.reject('idea_001', ACTOR, 'not on-brief');
  assert.strictEqual(after.status, 'rejected');
  assert.strictEqual(rows.ideas.get('idea_001').status, 'rejected');
});

test('IdeaService.list paginates by brand', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.ideas.set('idea_a', {
    id: 'idea_a',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'A',
    angle: 'a',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 50,
    contentHash: 'h1',
    sourceType: 'ai_inferred',
    confidence: 'medium',
    status: 'idea',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.ideas.set('idea_b', {
    id: 'idea_b',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'B',
    angle: 'b',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 60,
    contentHash: 'h2',
    sourceType: 'ai_inferred',
    confidence: 'medium',
    status: 'idea_approved',
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });
  const svc = makeSvc(db);
  const page1 = await svc.list(BRAND_ID, { page: 1, pageSize: 1 });
  assert.strictEqual(page1.items.length, 1);
  assert.strictEqual(page1.pagination.total, 2);
  assert.strictEqual(page1.pagination.hasNext, true);
  const page2 = await svc.list(BRAND_ID, { page: 2, pageSize: 1 });
  assert.strictEqual(page2.items.length, 1);
  assert.strictEqual(page2.pagination.hasNext, false);
});

test('Route POST /campaigns/:id/generate-ideas returns generated ideas', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const res = await campaignRouter.request(
    '/campaign_001/generate-ideas',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        quantity: 2,
        platforms: ['instagram'],
        formats: ['carousel'],
        pillarIds: ['health_data_awareness'],
        language: 'id',
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.ok(body.data.ideasCreated >= 1);
  assert.ok(Array.isArray(body.data.ideas));
  assert.ok(rows.ideas.size >= 1);
});

test('Route POST /campaigns/:id/generate-ideas rejects missing Idempotency-Key', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  const res = await campaignRouter.request(
    '/campaign_001/generate-ideas',
    {
      method: 'POST',
      headers: { ...makeHeaders(), 'idempotency-key': '' },
      body: JSON.stringify({
        quantity: 1,
        platforms: ['instagram'],
        formats: ['carousel'],
        pillarIds: ['health_data_awareness'],
        language: 'id',
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
});

test('Route POST /ideas/:id/approve transitions the idea', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.ideas.set('idea_001', {
    id: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'T',
    angle: 'A',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 80,
    contentHash: 'h',
    sourceType: 'ai_inferred',
    confidence: 'high',
    status: 'idea',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const res = await ideaRouter.request(
    '/idea_001/approve',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ note: 'good' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.data.status, 'idea_approved');
  assert.strictEqual(rows.ideas.get('idea_001').status, 'idea_approved');
});

test('Route POST /ideas/:id/reject requires a note and transitions', async () => {
  const { db, rows } = makeFakeDb();
  seedBase(db, rows);
  rows.ideas.set('idea_001', {
    id: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    pillarId: 'pillar-1',
    title: 'T',
    angle: 'A',
    targetPlatform: 'instagram',
    contentFormat: 'carousel',
    targetAudience: null,
    painPoint: null,
    score: 80,
    contentHash: 'h',
    sourceType: 'ai_inferred',
    confidence: 'high',
    status: 'idea',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  const noNote = await ideaRouter.request(
    '/idea_001/reject',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({}),
    },
    makeEnv(db)
  );
  assert.strictEqual(noNote.status, 400);

  const ok = await ideaRouter.request(
    '/idea_001/reject',
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ note: 'off-brief' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(ok.status, 200);
  const body = await ok.json();
  assert.strictEqual(body.data.status, 'rejected');
  assert.strictEqual(rows.ideas.get('idea_001').status, 'rejected');
});
