import { test } from 'node:test';
import assert from 'node:assert';
import { SafetyCheckService } from '../dist/services/safety-check.js';
import { DraftRepository } from '../dist/repositories/draft.js';
import { RevisionRepository } from '../dist/repositories/revision.js';
import { BrandRepository } from '../dist/repositories/brand.js';
import { AiConfigRepository } from '../dist/repositories/ai-config.js';
import { PromptVersionRepository } from '../dist/repositories/prompt-version.js';
import { SafetyReportRepository } from '../dist/repositories/safety-report.js';
import { AiJobRepository } from '../dist/repositories/ai-job.js';
import { AuditService, AuditRepository } from '../dist/services/audit.js';
import { IntegrityService } from '../dist/services/integrity.js';
import { AiJobService } from '../dist/services/ai-job.js';
import { QuotaService } from '../dist/services/quota.js';
import { UsageService } from '../dist/services/usage.js';
import { RateLimitService, RateLimitRepository } from '../dist/services/rate-limit.js';
import { errorCodes } from '../dist/utils/errors.js';
import { safetyRouter } from '../dist/routes/safety.js';
import { makeFakeDb } from './fake-db.mjs';

const BRAND_ID = 'brand-1';
const ACTOR = { id: 'user-1', role: 'medicalReviewer' };

function seedSafetyContext(db, rows, { hookText = 'Catat tensi dengan konteks' } = {}) {
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
    status: 'idea_approved',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const draftId = `draft_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  rows.drafts.set(draftId, {
    id: draftId,
    ideaId: 'idea_001',
    brandId: BRAND_ID,
    campaignId: 'campaign_001',
    platform: 'instagram',
    contentFormat: 'carousel',
    language: 'id',
    currentRevision: 1,
    primaryHook: hookText,
    hookAlternativesJson: null,
    mainContent: 'Catat waktu pengukuran, aktivitas, dan keluhan yang terasa.',
    carouselSlidesJson: null,
    scriptJson: null,
    caption: 'iSehat membantu kamu mencatat data kesehatan harian.',
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
  rows.revisions.set(`rev_${draftId}_1`, {
    id: `rev_${draftId}_1`,
    draftId,
    revisionNumber: 1,
    snapshotJson: JSON.stringify({ primaryHook: hookText }),
    contentHash: 'h-rev-1',
    changeReason: 'Initial draft generation',
    changedBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
  });

  rows.aiConfigs.set('cfg_classifier', {
    id: 'cfg_classifier',
    brandId: BRAND_ID,
    provider: 'mock',
    model: 'mock-model',
    purpose: 'health_classifier',
    temperature: 0.0,
    maxTokens: 256,
    timeoutMs: 5000,
    fallbackOrder: 0,
    isActive: 1,
    secretRef: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.aiConfigs.set('cfg_safety', {
    id: 'cfg_safety',
    brandId: BRAND_ID,
    provider: 'mock',
    model: 'mock-model',
    purpose: 'safety_check',
    temperature: 0.0,
    maxTokens: 256,
    timeoutMs: 5000,
    fallbackOrder: 0,
    isActive: 1,
    secretRef: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.aiPromptVersions.set('pv_classifier', {
    id: 'pv_classifier',
    promptKey: 'health_classifier',
    version: 1,
    promptText: 'health_classifier\nClassify whether this content is health-related.',
    modelRole: 'classifier',
    isActive: 1,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  rows.aiPromptVersions.set('pv_safety', {
    id: 'pv_safety',
    promptKey: 'safety_check',
    version: 1,
    promptText: 'safety_check\nCheck for safety violations.',
    modelRole: 'safety_checker',
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

  return draftId;
}

function makeSafetySvc(db) {
  return new SafetyCheckService({
    db,
    draftRepo: new DraftRepository(db),
    revisionRepo: new RevisionRepository(db),
    brandRepo: new BrandRepository(db),
    safetyReportRepo: new SafetyReportRepository(db),
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
  });
}

function makeHeaders({ id = 'user-1', roles = 'medicalReviewer', idempotencyKey = 'ik-1' } = {}) {
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

test('SafetyCheckService.run succeeds for safe health content', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows);
  const svc = makeSafetySvc(db);

  const result = await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-safe');

  assert.strictEqual(result.jobStatus, 'completed');
  assert.strictEqual(result.draftId, draftId);
  assert.strictEqual(result.revisionNumber, 1);
  assert.strictEqual(result.healthContentStatus, 'health_content');
  assert.strictEqual(result.safetyStatus, 'safe');
  assert.strictEqual(result.status, 'needs_review');
  assert.strictEqual(result.sourceTraceRequired, false);

  // Safety report persisted.
  assert.strictEqual(rows.safetyReports.size, 1);
  const report = [...rows.safetyReports.values()][0];
  assert.strictEqual(report.draftId, draftId);
  assert.strictEqual(report.healthContentStatus, 'health_content');
  assert.strictEqual(report.safetyStatus, 'safe');
  assert.strictEqual(report.sourceTraceRequired, 0);

  // Draft updated to needs_review.
  const draft = rows.drafts.get(draftId);
  assert.strictEqual(draft.healthContentStatus, 'health_content');
  assert.strictEqual(draft.safetyStatus, 'safe');
  assert.strictEqual(draft.status, 'needs_review');
  assert.strictEqual(draft.approvalStatus, 'needs_review');
});

test('SafetyCheckService.run with MOCK_NON_HEALTH auto-marks non_health_content and skips medical checker', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows, { hookText: 'MOCK_NON_HEALTH content' });
  const svc = makeSafetySvc(db);

  const result = await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-non-health');

  assert.strictEqual(result.healthContentStatus, 'non_health_content');
  assert.strictEqual(result.safetyStatus, 'safe');
  assert.strictEqual(result.status, 'needs_review');
  assert.strictEqual(result.note, 'Non-health content; medical safety check not required.');

  const report = [...rows.safetyReports.values()][0];
  assert.strictEqual(report.healthContentStatus, 'non_health_content');
  assert.strictEqual(report.safetyStatus, 'safe');
  assert.strictEqual(report.warningsJson, null);
  assert.strictEqual(report.blockedReasonsJson, null);

  // Only one AI job row created (classifier; safety checker was skipped).
  assert.strictEqual(rows.aiJobs.size, 1);
});

test('SafetyCheckService.run with MOCK_WARNING_SOURCE returns warning with sourceTraceRequired', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows, { hookText: 'MOCK_WARNING_SOURCE claim' });
  const svc = makeSafetySvc(db);

  const result = await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-warning');

  assert.strictEqual(result.healthContentStatus, 'health_content');
  assert.strictEqual(result.safetyStatus, 'warning');
  assert.strictEqual(result.status, 'needs_review');
  assert.strictEqual(result.sourceTraceRequired, true);
  assert.ok(Array.isArray(result.warnings) && result.warnings.length > 0);

  const report = [...rows.safetyReports.values()][0];
  assert.strictEqual(report.safetyStatus, 'warning');
  assert.strictEqual(report.sourceTraceRequired, 1);

  const draft = rows.drafts.get(draftId);
  assert.strictEqual(draft.status, 'needs_review');
  assert.strictEqual(draft.safetyStatus, 'warning');
});

test('SafetyCheckService.run with MOCK_BLOCK_DOCTOR_REPLACE marks draft as safety_blocked and rejected', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows, { hookText: 'MOCK_BLOCK_DOCTOR_REPLACE' });
  const svc = makeSafetySvc(db);

  const result = await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-block');

  assert.strictEqual(result.healthContentStatus, 'health_content');
  assert.strictEqual(result.safetyStatus, 'blocked');
  assert.strictEqual(result.status, 'safety_blocked');
  assert.ok(Array.isArray(result.blockedReasons) && result.blockedReasons.length > 0);

  const report = [...rows.safetyReports.values()][0];
  assert.strictEqual(report.safetyStatus, 'blocked');

  const draft = rows.drafts.get(draftId);
  assert.strictEqual(draft.status, 'safety_blocked');
  assert.strictEqual(draft.approvalStatus, 'rejected');
  assert.strictEqual(draft.safetyStatus, 'blocked');
});

test('SafetyCheckService.run throws REVISION_MISMATCH when revisionNumber does not match', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows);
  const svc = makeSafetySvc(db);

  await assert.rejects(
    svc.run(draftId, { revisionNumber: 2 }, ACTOR, 'ik-mismatch'),
    (e) => e.code === errorCodes.REVISION_MISMATCH && e.status === 409
  );
  assert.strictEqual(rows.safetyReports.size, 0);
});

test('SafetyCheckService.run throws NOT_FOUND when draft does not exist', async () => {
  const { db } = makeFakeDb();
  const svc = makeSafetySvc(db);

  await assert.rejects(
    svc.run('draft_missing', { revisionNumber: 1 }, ACTOR, 'ik-missing'),
    (e) => e.code === errorCodes.NOT_FOUND && e.status === 404
  );
});

test('SafetyCheckService.run is idempotent on the same key', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows);
  const svc = makeSafetySvc(db);

  const first = await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-idem');
  const second = await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-idem');

  assert.strictEqual(first.draftId, second.draftId);
  assert.strictEqual(first.revisionNumber, second.revisionNumber);
  assert.strictEqual(first.safetyStatus, second.safetyStatus);
  assert.strictEqual(first.healthContentStatus, second.healthContentStatus);
  // Second call must not create additional rows.
  assert.strictEqual(rows.safetyReports.size, 1);
  assert.strictEqual(rows.aiJobs.size, 1);
});

test('Route POST /drafts/:id/safety-check returns 200 with ok:true', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows);
  const res = await safetyRouter.request(
    `/${draftId}/safety-check`,
    {
      method: 'POST',
      headers: makeHeaders({ idempotencyKey: 'ik-route' }),
      body: JSON.stringify({ revisionNumber: 1 }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.draftId, draftId);
  assert.strictEqual(body.data.safetyStatus, 'safe');
});

test('Route GET /drafts/:id/safety-report returns latest report', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows);
  const svc = makeSafetySvc(db);
  await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-get-latest');

  const res = await safetyRouter.request(
    `/${draftId}/safety-report`,
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.draftId, draftId);
  assert.strictEqual(body.data.revisionNumber, 1);
  assert.strictEqual(body.data.safetyStatus, 'safe');
});

test('Route GET /drafts/:id/safety-report?revisionNumber=... returns specific report', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedSafetyContext(db, rows);
  const svc = makeSafetySvc(db);
  await svc.run(draftId, { revisionNumber: 1 }, ACTOR, 'ik-get-specific');

  const res = await safetyRouter.request(
    `/${draftId}/safety-report?revisionNumber=1`,
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.draftId, draftId);
  assert.strictEqual(body.data.revisionNumber, 1);
});
