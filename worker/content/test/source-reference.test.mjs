import { test } from 'node:test';
import assert from 'node:assert';
import { SourceReferenceService } from '../dist/services/source-reference.js';
import { DraftRepository } from '../dist/repositories/draft.js';
import { RevisionRepository } from '../dist/repositories/revision.js';
import { SourceReferenceRepository } from '../dist/repositories/source-reference.js';
import { AuditRepository, AuditService } from '../dist/services/audit.js';
import { errorCodes } from '../dist/utils/errors.js';
import { draftRouter } from '../dist/routes/draft.js';
import { makeFakeDb } from './fake-db.mjs';

const BRAND_ID = 'brand-1';

function seedDraftWithRevision(db, rows) {
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
  const draftId = `draft_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  rows.drafts.set(draftId, {
    id: draftId,
    ideaId: null,
    brandId: BRAND_ID,
    campaignId: null,
    platform: 'instagram',
    contentFormat: 'carousel',
    language: 'id',
    currentRevision: 1,
    primaryHook: 'Catat tensi',
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
    healthContentStatus: 'health_content',
    safetyStatus: 'warning',
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
    contentHash: 'h1',
    changeReason: null,
    changedBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  return draftId;
}

function makeSvc(db) {
  return new SourceReferenceService({
    draftRepo: new DraftRepository(db),
    revisionRepo: new RevisionRepository(db),
    repo: new SourceReferenceRepository(db),
    audit: new AuditService(new AuditRepository(db)),
  });
}

const ACTOR = { id: 'user-1', role: 'medicalReviewer', roles: ['medicalReviewer'] };

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

test('SourceReferenceService.create persists a row and audits source_reference.create', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  const created = await svc.create(
    draftId,
    {
      revisionNumber: 1,
      title: 'WHO hypertension guideline',
      url: 'https://example.org/who',
      sourceType: 'medical_reference',
      sourceReliability: 'medical_reference',
      confidence: 'high',
      note: 'Internal source trace',
      fetchedAt: '2026-07-01T10:00:00Z',
    },
    ACTOR
  );

  assert.strictEqual(rows.sourceReferences.size, 1);
  assert.strictEqual(created.draftId, draftId);
  assert.strictEqual(created.revisionNumber, 1);
  assert.strictEqual(created.title, 'WHO hypertension guideline');
  assert.strictEqual(created.url, 'https://example.org/who');
  assert.strictEqual(created.sourceType, 'medical_reference');
  assert.strictEqual(created.sourceReliability, 'medical_reference');
  assert.strictEqual(created.confidence, 'high');
  assert.match(created.id, /^source_[a-f0-9]+$/);
});

test('SourceReferenceService.create rejects empty title', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  await assert.rejects(
    svc.create(draftId, { revisionNumber: 1, title: '   ', sourceType: 'official' }, ACTOR),
    (e) => e.code === errorCodes.VALIDATION_ERROR
  );
  assert.strictEqual(rows.sourceReferences.size, 0);
});

test('SourceReferenceService.create rejects invalid sourceType', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  await assert.rejects(
    svc.create(
      draftId,
      { revisionNumber: 1, title: 'Title', sourceType: 'competitor' },
      ACTOR
    ),
    (e) =>
      e.code === errorCodes.VALIDATION_ERROR &&
      e.message.includes('sourceType must be')
  );
});

test('SourceReferenceService.create rejects invalid confidence', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  await assert.rejects(
    svc.create(
      draftId,
      {
        revisionNumber: 1,
        title: 'Title',
        sourceType: 'official',
        confidence: 'very_high',
      },
      ACTOR
    ),
    (e) =>
      e.code === errorCodes.VALIDATION_ERROR &&
      e.message.includes('confidence must be')
  );
});

test('SourceReferenceService.create rejects invalid URL', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  await assert.rejects(
    svc.create(
      draftId,
      {
        revisionNumber: 1,
        title: 'Title',
        sourceType: 'official',
        url: 'not-a-url',
      },
      ACTOR
    ),
    (e) =>
      e.code === errorCodes.VALIDATION_ERROR &&
      e.message.includes('url must be a valid http(s) URL')
  );
});

test('SourceReferenceService.create returns NOT_FOUND when draft missing', async () => {
  const { db, rows } = makeFakeDb();
  seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  await assert.rejects(
    svc.create(
      'draft_missing',
      { revisionNumber: 1, title: 'Title', sourceType: 'official' },
      ACTOR
    ),
    (e) => e.code === errorCodes.NOT_FOUND
  );
});

test('SourceReferenceService.create returns NOT_FOUND when revision missing', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  await assert.rejects(
    svc.create(
      draftId,
      { revisionNumber: 99, title: 'Title', sourceType: 'official' },
      ACTOR
    ),
    (e) => e.code === errorCodes.NOT_FOUND
  );
});

test('SourceReferenceService.list returns rows for current revision by default', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);

  await svc.create(
    draftId,
    { revisionNumber: 1, title: 'A', sourceType: 'official' },
    ACTOR
  );
  await svc.create(
    draftId,
    {
      revisionNumber: 1,
      title: 'B',
      sourceType: 'platform_docs',
      url: 'https://example.org/b',
    },
    ACTOR
  );

  const items = await svc.list(draftId);
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].title, 'A');
  assert.strictEqual(items[1].title, 'B');
});

test('Route GET /drafts/:id/source-references returns items array', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);
  const svc = makeSvc(db);
  await svc.create(
    draftId,
    { revisionNumber: 1, title: 'A', sourceType: 'official' },
    ACTOR
  );

  const res = await draftRouter.request(
    `/${draftId}/source-references`,
    { headers: makeHeaders() },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.items.length, 1);
  assert.strictEqual(body.data.items[0].title, 'A');
});

test('Route POST /drafts/:id/source-references returns 201 with id', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);

  const res = await draftRouter.request(
    `/${draftId}/source-references`,
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({
        revisionNumber: 1,
        title: 'Source A',
        url: 'https://example.org/a',
        sourceType: 'official',
        confidence: 'medium',
      }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 201);
  const body = await res.json();
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.data.draftId, draftId);
  assert.strictEqual(body.data.title, 'Source A');
  assert.strictEqual(body.data.sourceType, 'official');
  assert.strictEqual(body.data.confidence, 'medium');
  assert.match(body.data.id, /^source_/);
});

test('Route POST /drafts/:id/source-references rejects missing title with 400', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);

  const res = await draftRouter.request(
    `/${draftId}/source-references`,
    {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ revisionNumber: 1, sourceType: 'official' }),
    },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.strictEqual(body.ok, false);
  assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
});

test('Route GET /drafts/:id/source-references without perm returns 403', async () => {
  const { db, rows } = makeFakeDb();
  const draftId = seedDraftWithRevision(db, rows);

  const res = await draftRouter.request(
    `/${draftId}/source-references`,
    { headers: makeHeaders({ roles: '' }) },
    makeEnv(db)
  );
  assert.strictEqual(res.status, 403);
});
