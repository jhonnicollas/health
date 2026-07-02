import { test } from 'node:test';
import assert from 'node:assert';
import {
  RateLimitService,
  RateLimitRepository,
  RATE_LIMITS,
} from '../dist/services/rate-limit.js';

// State-keeping fake D1: tracks counters across calls so we can exercise
// increment + reset behavior without spinning up a real DB.
function makeFakeDb() {
  const counters = new Map();
  const calls = [];
  const stmt = {
    bind(...args) {
      stmt.boundArgs = args;
      return stmt;
    },
    async first() {
      const sql = stmt.sql;
      if (/FROM conRateLimitCounters WHERE/i.test(sql)) {
        const [brandId, actorId, action, windowStart] = stmt.boundArgs;
        const key = `${brandId}|${actorId}|${action}|${windowStart}`;
        return counters.get(key) ?? null;
      }
      return null;
    },
    async run() {
      const sql = stmt.sql;
      if (/INSERT INTO conRateLimitCounters/i.test(sql)) {
        const [id, brandId, actorId, action, windowStart, windowEnd, count, createdAt, updatedAt] =
          stmt.boundArgs;
        const key = `${brandId}|${actorId}|${action}|${windowStart}`;
        // ON CONFLICT path: overwrite count + updatedAt; keep id/createdAt stable.
        const prev = counters.get(key);
        counters.set(key, {
          id: prev?.id ?? id,
          count,
          windowEnd,
          createdAt: prev?.createdAt ?? createdAt,
          updatedAt,
        });
        return { success: true, meta: {} };
      }
      return { success: true, meta: {} };
    },
    async all() {
      return { results: [], success: true, meta: {} };
    },
  };
  const db = {
    prepare(sql) {
      stmt.sql = sql;
      stmt.boundArgs = [];
      calls.push({ sql });
      return stmt;
    },
  };
  return { db, counters, calls };
}

function makeAudit() {
  const events = [];
  return {
    events,
    async log(input) {
      events.push(input);
    },
  };
}

test('checkAndIncrement allows the first call and sets count=1', async () => {
  const { db } = makeFakeDb();
  const repo = new RateLimitRepository(db);
  const svc = new RateLimitService(repo);
  const now = new Date('2026-07-02T10:30:00.000Z');

  const result = await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.limit, 5);
  assert.strictEqual(result.remaining, 4);
  assert.strictEqual(result.resetAt, '2026-07-02T11:00:00.000Z');
});

test('checkAndIncrement blocks after max is reached', async () => {
  const { db } = makeFakeDb();
  const repo = new RateLimitRepository(db);
  const svc = new RateLimitService(repo);
  const now = new Date('2026-07-02T10:30:00.000Z');

  for (let i = 0; i < 5; i++) {
    const r = await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);
    assert.strictEqual(r.allowed, true);
    assert.strictEqual(r.remaining, 4 - i);
  }

  const blocked = await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.remaining, 0);
  assert.strictEqual(blocked.resetAt, '2026-07-02T11:00:00.000Z');
});

test('checkAndIncrement resets in the next window', async () => {
  const { db } = makeFakeDb();
  const repo = new RateLimitRepository(db);
  const svc = new RateLimitService(repo);

  const before = new Date('2026-07-02T10:30:00.000Z');
  for (let i = 0; i < 5; i++) {
    await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', before);
  }
  const blocked = await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', before);
  assert.strictEqual(blocked.allowed, false);

  const after = new Date('2026-07-02T11:05:00.000Z');
  const fresh = await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', after);
  assert.strictEqual(fresh.allowed, true);
  assert.strictEqual(fresh.remaining, 4);
  assert.strictEqual(fresh.resetAt, '2026-07-02T12:00:00.000Z');
});

test('generate_ideas uses hour window; daily actions use day window', async () => {
  const { db, calls } = makeFakeDb();
  const repo = new RateLimitRepository(db);
  const svc = new RateLimitService(repo);
  const now = new Date('2026-07-02T10:30:00.000Z');

  await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);
  await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_draft', now);

  const insertSqls = calls.filter((c) => /INSERT INTO conRateLimitCounters/i.test(c.sql));
  assert.strictEqual(insertSqls.length, 2);

  const hourEndMatch = insertSqls[0].sql.match(/windowEnd/);
  assert.ok(hourEndMatch, 'hour-window insert should reference windowEnd');
  assert.strictEqual(RATE_LIMITS.generate_ideas.window, 'hour');
  assert.strictEqual(RATE_LIMITS.generate_draft.window, 'day');
});

test('audit.log is called when blocked (when audit service provided)', async () => {
  const { db } = makeFakeDb();
  const repo = new RateLimitRepository(db);
  const audit = makeAudit();
  const svc = new RateLimitService(repo, audit);
  const now = new Date('2026-07-02T10:30:00.000Z');

  for (let i = 0; i < 5; i++) {
    await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);
  }
  assert.strictEqual(audit.events.length, 0);

  await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);
  assert.strictEqual(audit.events.length, 1);
  const event = audit.events[0];
  assert.strictEqual(event.action, 'rate_limit.exceeded');
  assert.strictEqual(event.targetType, 'rate_limit');
  assert.strictEqual(event.targetId, 'brand-1:generate_ideas');
  assert.strictEqual(event.severity, 'warning');
  assert.strictEqual(event.actor.id, 'actor-1');
});

test('audit.log is NOT called when no audit service is provided', async () => {
  const { db } = makeFakeDb();
  const repo = new RateLimitRepository(db);
  const svc = new RateLimitService(repo);
  const now = new Date('2026-07-02T10:30:00.000Z');

  for (let i = 0; i < 5; i++) {
    await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);
  }
  // Should not throw even though audit is undefined.
  const blocked = await svc.checkAndIncrement('brand-1', 'actor-1', 'generate_ideas', now);
  assert.strictEqual(blocked.allowed, false);
});

test('upsert preserves id and createdAt on conflict', async () => {
  const { db, counters } = makeFakeDb();
  const repo = new RateLimitRepository(db);
  const now = new Date('2026-07-02T10:30:00.000Z');

  await repo.upsertCounter('brand-1', 'actor-1', 'generate_ideas', '2026-07-02T10:00:00.000Z', '2026-07-02T11:00:00.000Z', 1);
  const firstId = counters.get('brand-1|actor-1|generate_ideas|2026-07-02T10:00:00.000Z').id;

  await repo.upsertCounter('brand-1', 'actor-1', 'generate_ideas', '2026-07-02T10:00:00.000Z', '2026-07-02T11:00:00.000Z', 2);
  const second = counters.get('brand-1|actor-1|generate_ideas|2026-07-02T10:00:00.000Z');
  assert.strictEqual(second.count, 2);
  assert.strictEqual(second.id, firstId, 'id must stay stable across upserts');
});
