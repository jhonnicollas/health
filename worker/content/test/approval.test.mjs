import { test } from 'node:test';
import assert from 'node:assert';
import { ApprovalService } from '../dist/services/approval.js';
import { DraftRepository } from '../dist/repositories/draft.js';
import { SafetyReportRepository } from '../dist/repositories/safety-report.js';
import { SourceReferenceRepository } from '../dist/repositories/source-reference.js';
import { ApprovalRepository } from '../dist/repositories/approval.js';
import { AuditService, AuditRepository } from '../dist/services/audit.js';
import { approvalRouter } from '../dist/routes/approval.js';
import { errorCodes } from '../dist/utils/errors.js';
import { makeFakeDb } from './fake-db.mjs';

const BRAND_ID = 'brand-1';

function seedApprovalContext(
  db,
  rows,
  {
    safetyStatus = 'safe',
    healthContentStatus = 'health_content',
    sourceTraceRequired = false,
    withSourceRef = false,
  } = {}
) {
  rows.brands.set(BRAND_ID, {
    id: BRAND_ID,
    name: 'iSehat',
    positioning: 'Daily health companion',
    productValueJson: '["Health logging"]',
    targetAudienceJson: '["Adults"]',
    tone: 'Clear',
    languageDefault: 'id',
    disclaimerTemplate: null,
    forbiddenClaimsJson: '[]',
    allowedClaimsJson: '[]',
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
    primaryHook: 'Catat tensi dengan konteks',
    hookAlternativesJson: null,
    mainContent: 'Main content',
    carouselSlidesJson: null,
    scriptJson: null,
    caption: null,
    cta: null,
    hashtagsJson: null,
    visualBriefJson: null,
    thumbnailText: null,
    altText: null,
    disclaimer: null,
    healthContentStatus,
    safetyStatus,
    approvalStatus: 'needs_review',
    status: 'needs_review',
    publishReadinessScore: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
  rows.revisions.set(`rev_${draftId}_1`, {
    id: `rev_${draftId}_1`,
    draftId,
    revisionNumber: 1,
    snapshotJson: '{}',
    contentHash: 'h-rev-1',
    changeReason: null,
    changedBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  rows.safetyReports.set(`safety_${draftId}_1`, {
    id: `safety_${draftId}_1`,
    draftId,
    revisionNumber: 1,
    healthContentStatus,
    safetyStatus,
    blockedReasonsJson: null,
    warningsJson: null,
    rewrittenSuggestion: null,
    requiredDisclaimer: null,
    sourceTraceRequired: sourceTraceRequired ? 1 : 0,
    checkerNote: null,
    checkedBy: 'user-1',
    modelUsed: 'mock',
    promptVersionId: null,
    checkedAt: '2026-01-01T00:00:00.000Z',
  });
  if (withSourceRef) {
    rows.sourceReferences.set(`source_${draftId}_1`, {
      id: `source_${draftId}_1`,
      draftId,
      revisionNumber: 1,
      title: 'WHO hypertension guideline',
      url: 'https://example.org/who',
      sourceType: 'medical_reference',
      sourceReliability: 'medical_reference',
      confidence: 'high',
      note: null,
      fetchedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  }
  return { db, rows, draftId };
}

function makeSvc(db) {
  return new ApprovalService({
    db,
    draftRepo: new DraftRepository(db),
    safetyReportRepo: new SafetyReportRepository(db),
    sourceRefRepo: new SourceReferenceRepository(db),
    repo: new ApprovalRepository(db),
    audit: new AuditService(new AuditRepository(db)),
  });
}

const MEDICAL_REVIEWER = {
  id: 'user-1',
  role: 'medicalReviewer',
  roles: ['medicalReviewer'],
};
const MARKETING_ADMIN = {
  id: 'user-2',
  role: 'marketingAdmin',
  roles: ['marketingAdmin'],
};

function makeHeaders({ id = 'user-1', roles = 'medicalReviewer' } = {}) {
  return {
    'x-content-user-id': id,
    'x-content-user-roles': roles,
    'content-type': 'application/json',
  };
}

function makeEnv(db) {
  return { DB: db, ENVIRONMENT: 'local' };
}

test('ApprovalService.approve succeeds for safe health content as medicalReviewer', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });
  const svc = makeSvc(db);

  const result = await svc.approve(
    draftId,
    { revisionNumber: 1, reviewerNote: 'LGTM' },
    MEDICAL_REVIEWER
  );

  assert.strictEqual(result.draftId, draftId);
  assert.strictEqual(result.revisionNumber, 1);
  assert.strictEqual(result.approvalStatus, 'approved');
  assert.strictEqual(result.status, 'approved');
  assert.ok(result.approvedAt);

  assert.strictEqual(rows.approvals.size, 1);
  const approval = [...rows.approvals.values()][0];
  assert.strictEqual(approval.status, 'approved');
  assert.strictEqual(approval.draftId, draftId);
  assert.strictEqual(approval.revisionNumber, 1);

  const draft = rows.drafts.get(draftId);
  assert.strictEqual(draft.approvalStatus, 'approved');
  assert.strictEqual(draft.status, 'approved');
});

test('ApprovalService.approve succeeds for non-health content as marketingAdmin', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'non_health_content',
  });
  const svc = makeSvc(db);

  const result = await svc.approve(
    draftId,
    { revisionNumber: 1 },
    MARKETING_ADMIN
  );

  assert.strictEqual(result.draftId, draftId);
  assert.strictEqual(result.approvalStatus, 'approved');
  assert.strictEqual(result.status, 'approved');
  assert.ok(result.approvedAt);

  assert.strictEqual(rows.approvals.size, 1);
  const approval = [...rows.approvals.values()][0];
  assert.strictEqual(approval.status, 'approved');
  assert.strictEqual(approval.reviewerRole, 'marketingAdmin');

  assert.strictEqual(rows.drafts.get(draftId).status, 'approved');
});

test('ApprovalService.approve fails for health content as marketingAdmin (403)', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });
  const svc = makeSvc(db);

  await assert.rejects(
    svc.approve(draftId, { revisionNumber: 1 }, MARKETING_ADMIN),
    (e) =>
      e.code === errorCodes.APPROVAL_PERMISSION_DENIED && e.status === 403
  );
  assert.strictEqual(rows.approvals.size, 0);
  assert.strictEqual(rows.drafts.get(draftId).status, 'needs_review');
});

test('ApprovalService.approve fails for blocked draft (SAFETY_BLOCKED)', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'blocked',
    healthContentStatus: 'health_content',
  });
  const svc = makeSvc(db);

  await assert.rejects(
    svc.approve(draftId, { revisionNumber: 1 }, MEDICAL_REVIEWER),
    (e) => e.code === errorCodes.SAFETY_BLOCKED && e.status === 409
  );
  assert.strictEqual(rows.approvals.size, 0);
  assert.strictEqual(rows.drafts.get(draftId).status, 'needs_review');
});

test('ApprovalService.approve fails when source trace required but no source refs', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
    sourceTraceRequired: true,
    withSourceRef: false,
  });
  const svc = makeSvc(db);

  await assert.rejects(
    svc.approve(draftId, { revisionNumber: 1 }, MEDICAL_REVIEWER),
    (e) => e.code === errorCodes.SOURCE_TRACE_REQUIRED && e.status === 400
  );
  assert.strictEqual(rows.approvals.size, 0);
  assert.strictEqual(rows.drafts.get(draftId).status, 'needs_review');
});

test('ApprovalService.approve fails when warning and no warningOverrideReason', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'warning',
    healthContentStatus: 'health_content',
  });
  const svc = makeSvc(db);

  await assert.rejects(
    svc.approve(draftId, { revisionNumber: 1 }, MEDICAL_REVIEWER),
    (e) => e.code === errorCodes.VALIDATION_ERROR && e.status === 400
  );
  assert.strictEqual(rows.approvals.size, 0);
  assert.strictEqual(rows.drafts.get(draftId).status, 'needs_review');
});

test('ApprovalService.approve succeeds with warning when warningOverrideReason provided by medicalReviewer', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'warning',
    healthContentStatus: 'health_content',
  });
  const svc = makeSvc(db);

  const result = await svc.approve(
    draftId,
    {
      revisionNumber: 1,
      warningOverrideReason: 'Manual review acknowledged',
    },
    MEDICAL_REVIEWER
  );

  assert.strictEqual(result.approvalStatus, 'approved');
  assert.strictEqual(result.status, 'approved');
  assert.ok(result.approvedAt);

  assert.strictEqual(rows.approvals.size, 1);
  const approval = [...rows.approvals.values()][0];
  assert.strictEqual(approval.status, 'approved');
  assert.strictEqual(
    approval.warningOverrideReason,
    'Manual review acknowledged'
  );

  assert.strictEqual(rows.drafts.get(draftId).status, 'approved');
});

test('ApprovalService.reject requires reviewerNote and updates draft to rejected', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });
  const svc = makeSvc(db);

  // Missing reviewerNote → validation error.
  await assert.rejects(
    svc.reject(
      draftId,
      { revisionNumber: 1, reviewerNote: '   ' },
      MEDICAL_REVIEWER
    ),
    (e) => e.code === errorCodes.VALIDATION_ERROR && e.status === 400
  );
  assert.strictEqual(rows.approvals.size, 0);

  // With reviewerNote → updates to rejected.
  const result = await svc.reject(
    draftId,
    { revisionNumber: 1, reviewerNote: 'Hook overclaims medical benefit' },
    MEDICAL_REVIEWER
  );
  assert.strictEqual(result.draftId, draftId);
  assert.strictEqual(result.approvalStatus, 'rejected');
  assert.strictEqual(result.status, 'rejected');

  assert.strictEqual(rows.approvals.size, 1);
  const approval = [...rows.approvals.values()][0];
  assert.strictEqual(approval.status, 'rejected');
  assert.strictEqual(approval.reviewerNote, 'Hook overclaims medical benefit');

  const draft = rows.drafts.get(draftId);
  assert.strictEqual(draft.approvalStatus, 'rejected');
  assert.strictEqual(draft.status, 'rejected');
});

test('ApprovalService.requestRevision requires note and updates draft to revision_requested', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });
  const svc = makeSvc(db);

  // Missing reviewerNote → validation error.
  await assert.rejects(
    svc.requestRevision(
      draftId,
      { revisionNumber: 1, reviewerNote: '' },
      MEDICAL_REVIEWER
    ),
    (e) => e.code === errorCodes.VALIDATION_ERROR && e.status === 400
  );
  assert.strictEqual(rows.approvals.size, 0);

  // With reviewerNote → updates to revision_requested.
  const result = await svc.requestRevision(
    draftId,
    { revisionNumber: 1, reviewerNote: 'Soften the CTA' },
    MEDICAL_REVIEWER
  );
  assert.strictEqual(result.draftId, draftId);
  assert.strictEqual(result.approvalStatus, 'revision_requested');
  assert.strictEqual(result.status, 'revision_requested');

  assert.strictEqual(rows.approvals.size, 1);
  const approval = [...rows.approvals.values()][0];
  assert.strictEqual(approval.status, 'revision_requested');
  assert.strictEqual(approval.reviewerNote, 'Soften the CTA');

  const draft = rows.drafts.get(draftId);
  assert.strictEqual(draft.approvalStatus, 'revision_requested');
  assert.strictEqual(draft.status, 'revision_requested');
});

test('ApprovalService.queue returns drafts needing review with blockers (SOURCE_TRACE_REQUIRED)', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'warning',
    healthContentStatus: 'health_content',
    sourceTraceRequired: true,
    withSourceRef: false,
  });
  const svc = makeSvc(db);

  const page = await svc.queue(
    { brandId: BRAND_ID },
    { page: 1, pageSize: 20 }
  );

  assert.strictEqual(page.items.length, 1);
  const item = page.items[0];
  assert.strictEqual(item.draftId, draftId);
  assert.strictEqual(item.brandId, BRAND_ID);
  assert.strictEqual(item.currentRevision, 1);
  assert.strictEqual(item.healthContentStatus, 'health_content');
  assert.strictEqual(item.safetyStatus, 'warning');
  assert.strictEqual(item.sourceTraceRequired, true);
  assert.strictEqual(item.sourceReferenceCount, 0);
  assert.strictEqual(item.canApprove, false);
  assert.deepStrictEqual(item.approvalBlockers, ['SOURCE_TRACE_REQUIRED']);

  assert.strictEqual(page.pagination.page, 1);
  assert.strictEqual(page.pagination.pageSize, 20);
  assert.strictEqual(page.pagination.total, 1);
  assert.strictEqual(page.pagination.hasNext, false);
});

test('Route GET /approvals/queue?brandId=... returns queue', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });

  const res = await approvalRouter.request(
    `/queue?brandId=${BRAND_ID}`,
    { headers: makeHeaders() },
    makeEnv(db)
  );

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.items.length, 1);
  assert.strictEqual(body.data.items[0].draftId, draftId);
  assert.strictEqual(body.data.pagination.total, 1);
});

test('Route POST /drafts/:id/approve returns approved result', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });

  const res = await approvalRouter.request(
    `/${draftId}/approve`,
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ revisionNumber: 1, reviewerNote: 'Approved' }),
    },
    makeEnv(db)
  );

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.draftId, draftId);
  assert.strictEqual(body.data.revisionNumber, 1);
  assert.strictEqual(body.data.approvalStatus, 'approved');
  assert.strictEqual(body.data.status, 'approved');
  assert.ok(body.data.approvedAt);

  assert.strictEqual(rows.approvals.size, 1);
  assert.strictEqual(rows.drafts.get(draftId).status, 'approved');
});

test('Route POST /drafts/:id/reject returns rejected result', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });

  const res = await approvalRouter.request(
    `/${draftId}/reject`,
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        revisionNumber: 1,
        reviewerNote: 'Not for publish',
      }),
    },
    makeEnv(db)
  );

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.draftId, draftId);
  assert.strictEqual(body.data.revisionNumber, 1);
  assert.strictEqual(body.data.approvalStatus, 'rejected');

  assert.strictEqual(rows.approvals.size, 1);
  assert.strictEqual(rows.drafts.get(draftId).status, 'rejected');
});

test('Route POST /drafts/:id/request-revision returns revision_requested result', async () => {
  const { db, rows } = makeFakeDb();
  const { draftId } = seedApprovalContext(db, rows, {
    safetyStatus: 'safe',
    healthContentStatus: 'health_content',
  });

  const res = await approvalRouter.request(
    `/${draftId}/request-revision`,
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        revisionNumber: 1,
        reviewerNote: 'Soften the CTA',
      }),
    },
    makeEnv(db)
  );

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.draftId, draftId);
  assert.strictEqual(body.data.revisionNumber, 1);
  assert.strictEqual(body.data.approvalStatus, 'revision_requested');

  assert.strictEqual(rows.approvals.size, 1);
  assert.strictEqual(rows.drafts.get(draftId).status, 'revision_requested');
});
