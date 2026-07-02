import { test } from 'node:test';
import assert from 'node:assert';
import { AuditService, AuditRepository } from '../dist/services/audit.js';

function makeFakeDb() {
  const calls = [];
  const stmt = {
    bind(...args) {
      calls.push(args);
      return stmt;
    },
    async run() {
      return { success: true, meta: {} };
    },
    async all() {
      return { results: [], success: true, meta: {} };
    },
    async first() {
      return null;
    },
  };
  return {
    db: {
      prepare(sql) {
        calls.push({ sql });
        return stmt;
      },
    },
    calls,
  };
}

test('AuditService.log redacts before/after and inserts required fields', async () => {
  const { db, calls } = makeFakeDb();
  const svc = new AuditService(new AuditRepository(db));

  await svc.log({
    action: 'content.publish',
    targetType: 'content_item',
    targetId: 'ci-1',
    severity: 'warning',
    before: { api_key: 'secret-key-1', status: 'draft' },
    after: { api_key: 'secret-key-2', status: 'published' },
    actor: {
      id: 'user-1',
      role: 'editor',
      ipAddress: '127.0.0.1',
      userAgent: 'ua/1',
    },
  });

  // prepare + bind should both have been called
  assert.strictEqual(calls.length, 2);
  const sqlCall = calls[0];
  const bindCall = calls[1];

  assert.match(sqlCall.sql, /INSERT INTO conAuditLogs/);
  assert.strictEqual(bindCall.length, 12);

  const [
    id,
    actorId,
    actorRole,
    action,
    targetType,
    targetId,
    severity,
    beforeJson,
    afterJson,
    ipAddress,
    userAgent,
    createdAt,
  ] = bindCall;

  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.strictEqual(actorId, 'user-1');
  assert.strictEqual(actorRole, 'editor');
  assert.strictEqual(action, 'content.publish');
  assert.strictEqual(targetType, 'content_item');
  assert.strictEqual(targetId, 'ci-1');
  assert.strictEqual(severity, 'warning');
  assert.strictEqual(ipAddress, '127.0.0.1');
  assert.strictEqual(userAgent, 'ua/1');
  assert.match(createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

  const before = JSON.parse(beforeJson);
  const after = JSON.parse(afterJson);
  assert.strictEqual(before.api_key, '[REDACTED]');
  assert.strictEqual(before.status, 'draft');
  assert.strictEqual(after.api_key, '[REDACTED]');
  assert.strictEqual(after.status, 'published');
  // Raw secret must not appear anywhere in the serialized payload
  assert.ok(!beforeJson.includes('secret-key-1'));
  assert.ok(!afterJson.includes('secret-key-2'));
});

test('AuditService.log defaults severity to info', async () => {
  const { db, calls } = makeFakeDb();
  const svc = new AuditService(new AuditRepository(db));
  await svc.log({ action: 'a', targetType: 'b', actor: { id: 'u' } });
  const bindCall = calls[1];
  assert.strictEqual(bindCall[6], 'info');
});

test('AuditService.log leaves beforeJson/afterJson null when not provided', async () => {
  const { db, calls } = makeFakeDb();
  const svc = new AuditService(new AuditRepository(db));
  await svc.log({ action: 'a', targetType: 'b', actor: { id: 'u' } });
  const bindCall = calls[1];
  assert.strictEqual(bindCall[7], null);
  assert.strictEqual(bindCall[8], null);
});

test('AuditService.log swallows db errors', async () => {
  const db = {
    prepare() {
      throw new Error('db down');
    },
  };
  const svc = new AuditService(new AuditRepository(db));
  // Should not throw
  await svc.log({
    action: 'x',
    targetType: 'y',
    actor: { id: 'u' },
  });
});

test('AuditService.log redacts nested secrets inside before/after', async () => {
  const { db, calls } = makeFakeDb();
  const svc = new AuditService(new AuditRepository(db));
  await svc.log({
    action: 'a',
    targetType: 'b',
    before: { config: { webhook_secret: 'whsec_xyz' } },
    after: { config: { password: 'p' } },
    actor: { id: 'u' },
  });
  const bindCall = calls[1];
  const before = JSON.parse(bindCall[7]);
  const after = JSON.parse(bindCall[8]);
  assert.strictEqual(before.config.webhook_secret, '[REDACTED]');
  assert.strictEqual(after.config.password, '[REDACTED]');
});
