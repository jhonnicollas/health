import { test } from 'node:test';
import assert from 'node:assert';
import {
  expireSessions,
  nullifyEncrypted,
  deleteMessages,
  archiveModelRuns,
  archiveSafetyFlags,
} from '../dist/index.js';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function hoursAgo(hours) {
  return new Date(Date.now() - hours * HOUR_MS).toISOString();
}

function daysAgo(days) {
  return hoursAgo(days * 24);
}

function createInMemoryDB(initialTables = {}) {
  const tables = {};
  const auditLogs = [];
  let lastRowId = 0;

  for (const [name, rows] of Object.entries(initialTables)) {
    tables[name] = rows.map((r) => ({ ...r }));
  }

  function parseWhere(sql) {
    // We only need to support the specific WHERE patterns used by retention functions.
    const conditions = [];
    if (sql.includes("status = 'active'")) conditions.push({ col: 'status', val: 'active' });
    // Date column may appear after AND (e.g. WHERE status='active' AND startedAt < datetime('now', ?))
    const colMatch = sql.match(/(?:WHERE|AND)\s+(\w+)\s*<\s*datetime\('now',\s*\?\)/i);
    if (colMatch) conditions.push({ col: colMatch[1], dateCutoff: true });
    return conditions;
  }

  function matchRow(row, conditions, params) {
    for (const cond of conditions) {
      if ('val' in cond && row[cond.col] !== cond.val) return false;
      if (cond.dateCutoff) {
        const cutoffParam = params[params.length - 1];
        const hours = Number(String(cutoffParam).replace(/[^0-9]/g, ''));
        const cutoff = new Date(Date.now() - hours * HOUR_MS);
        const val = new Date(row[cond.col]);
        if (!(val < cutoff)) return false;
      }
    }
    return true;
  }

  function extractTable(sql) {
    const m = sql.match(/(?:FROM|INTO|UPDATE)\s+(HL_\w+)/i);
    return m ? m[1] : null;
  }

  function insertRow(tableName, sql, params) {
    if (tableName === 'HL_auditLogs') {
      auditLogs.push({ action: params[0], entityType: params[1], entityId: params[2], metadataJson: params[3], createdAt: new Date().toISOString() });
      return { meta: { last_row_id: ++lastRowId, changes: 1 } };
    }
    if (!tables[tableName]) tables[tableName] = [];
    const row = {};
    // Parse column names from INSERT INTO table (cols) VALUES (?,?...)
    const colMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
    if (colMatch) {
      const cols = colMatch[1].split(',').map((c) => c.trim());
      for (let i = 0; i < cols.length; i += 1) row[cols[i]] = params[i];
    }
    tables[tableName].push(row);
    return { meta: { last_row_id: ++lastRowId, changes: 1 } };
  }

  return {
    tables,
    auditLogs,
    getArchived: () => (tables.__archived ? tables.__archived.slice() : []),
    prepare(sql) {
      return {
        bind(...params) {
          const tableName = extractTable(sql);
          return {
            first: async () => {
              if (sql.includes('COUNT(*)')) {
                const conds = parseWhere(sql);
                const rows = tables[tableName] || [];
                const count = rows.filter((r) => matchRow(r, conds, params)).length;
                return { c: count };
              }
              return null;
            },
            all: async () => {
              if (sql.startsWith('SELECT * FROM')) {
                const conds = parseWhere(sql);
                const rows = (tables[tableName] || []).filter((r) => matchRow(r, conds, params));
                return { results: rows.map((r) => ({ ...r })), meta: {} };
              }
              return { results: [], meta: {} };
            },
            run: async () => {
              if (sql.startsWith('INSERT INTO')) {
                return insertRow(tableName, sql, params);
              }
              if (sql.startsWith('UPDATE')) {
                const conds = parseWhere(sql);
                const rows = tables[tableName] || [];
                let changes = 0;
                for (const row of rows) {
                  if (matchRow(row, conds, params)) {
                    if (sql.includes("SET status = 'expired'")) row.status = 'expired';
                    if (sql.includes('SET contentEncrypted = NULL')) row.contentEncrypted = null;
                    if (sql.includes("SET status = 'deleted'")) row.status = 'deleted';
                    changes += 1;
                  }
                }
                return { meta: { last_row_id: ++lastRowId, changes } };
              }
              if (sql.startsWith('DELETE FROM')) {
                const conds = parseWhere(sql);
                const rows = tables[tableName] || [];
                const kept = [];
                const removed = [];
                for (const row of rows) {
                  if (matchRow(row, conds, params)) {
                    removed.push(row);
                  } else {
                    kept.push(row);
                  }
                }
                tables[tableName] = kept;
                // Simulate R2 archive by storing removed rows in __archived
                if (!tables.__archived) tables.__archived = [];
                tables.__archived.push(...removed.map((r) => ({ ...r, _archivedFrom: tableName })));
                return { meta: { last_row_id: ++lastRowId, changes: removed.length } };
              }
              return { meta: { last_row_id: ++lastRowId, changes: 0 } };
            },
          };
        },
      };
    },
  };
}

function createEnv(db) {
  return {
    DB: db,
    LOGS: {
      put: async (key, body) => {
        // Simulate R2 archive by storing on db.__archived via a side table
        if (!db.tables.__archived) db.tables.__archived = [];
        db.tables.__archived.push({ key, body: String(body).slice(0, 200) });
      },
    },
    RETENTION_SESSIONS_HOURS: '8760',
    RETENTION_MESSAGES_HOURS: '4320',
    RETENTION_ENCRYPTED_HOURS: '2160',
    RETENTION_MODEL_RUNS_HOURS: '8760',
    RETENTION_SAFETY_FLAGS_HOURS: '17520',
  };
}

test('S6I-T-11 expireSessions sets old active sessions to expired', async () => {
  const db = createInMemoryDB({
    HL_aiClinicalSessions: [
      { id: 1, status: 'active', startedAt: daysAgo(400) },
      { id: 2, status: 'active', startedAt: daysAgo(10) },
      { id: 3, status: 'closed', startedAt: daysAgo(400) },
    ],
  });
  const count = await expireSessions(createEnv(db));
  assert.equal(count, 1);
  assert.equal(db.tables.HL_aiClinicalSessions[0].status, 'expired');
  assert.equal(db.tables.HL_aiClinicalSessions[1].status, 'active');
  assert.ok(db.auditLogs.some((l) => l.action === 'dataRetentionCleanup' && l.entityType === 'expireSessions'));
});

test('S6I-T-11 nullifyEncrypted clears old encrypted content', async () => {
  const db = createInMemoryDB({
    HL_aiClinicalMessages: [
      { id: 1, contentEncrypted: 'secret1', createdAt: daysAgo(100) },
      { id: 2, contentEncrypted: 'secret2', createdAt: daysAgo(10) },
    ],
  });
  const count = await nullifyEncrypted(createEnv(db));
  assert.equal(count, 1);
  assert.equal(db.tables.HL_aiClinicalMessages[0].contentEncrypted, null);
  assert.equal(db.tables.HL_aiClinicalMessages[1].contentEncrypted, 'secret2');
  assert.ok(db.auditLogs.some((l) => l.action === 'dataRetentionCleanup' && l.entityType === 'nullifyEncrypted'));
});

test('S6I-T-11 deleteMessages hard deletes old messages', async () => {
  const db = createInMemoryDB({
    HL_aiClinicalMessages: [
      { id: 1, contentPreview: 'old', createdAt: daysAgo(200) },
      { id: 2, contentPreview: 'recent', createdAt: daysAgo(10) },
    ],
  });
  const count = await deleteMessages(createEnv(db));
  assert.equal(count, 1);
  assert.equal(db.tables.HL_aiClinicalMessages.length, 1);
  assert.equal(db.tables.HL_aiClinicalMessages[0].id, 2);
  assert.ok(db.auditLogs.some((l) => l.action === 'dataRetentionCleanup' && l.entityType === 'deleteMessages'));
});

test('S6I-T-11 archiveModelRuns archives old rows and deletes from D1', async () => {
  const db = createInMemoryDB({
    HL_modelRuns: [
      { id: 1, status: 'success', createdAt: daysAgo(400) },
      { id: 2, status: 'fallback', createdAt: daysAgo(10) },
    ],
  });
  const count = await archiveModelRuns(createEnv(db));
  assert.equal(count, 1);
  assert.equal(db.tables.HL_modelRuns.length, 1);
  assert.equal(db.tables.HL_modelRuns[0].id, 2);
  assert.ok(db.tables.__archived.some((r) => r.id === 1));
  assert.ok(db.auditLogs.some((l) => l.action === 'dataRetentionCleanup' && l.entityType === 'archiveModelRuns'));
});

test('S6I-T-11 archiveSafetyFlags archives old rows and deletes from D1', async () => {
  const db = createInMemoryDB({
    HL_aiOutputSafetyFlags: [
      { id: 1, flagCode: 'diagnosisFinalDetector', createdAt: daysAgo(800) },
      { id: 2, flagCode: 'prescriptionDosageDetector', createdAt: daysAgo(10) },
    ],
  });
  const count = await archiveSafetyFlags(createEnv(db));
  assert.equal(count, 1);
  assert.equal(db.tables.HL_aiOutputSafetyFlags.length, 1);
  assert.equal(db.tables.HL_aiOutputSafetyFlags[0].id, 2);
  assert.ok(db.tables.__archived.some((r) => r.id === 1));
  assert.ok(db.auditLogs.some((l) => l.action === 'dataRetentionCleanup' && l.entityType === 'archiveSafetyFlags'));
});

test('S6I-T-11 all retention jobs run without crashing', async () => {
  const db = createInMemoryDB({
    HL_aiClinicalSessions: [{ id: 1, status: 'active', startedAt: daysAgo(400) }],
    HL_aiClinicalMessages: [{ id: 1, contentEncrypted: 'x', createdAt: daysAgo(200) }],
    HL_modelRuns: [{ id: 1, status: 'success', createdAt: daysAgo(400) }],
    HL_aiOutputSafetyFlags: [{ id: 1, flagCode: 'x', createdAt: daysAgo(800) }],
  });
  const env = createEnv(db);
  const r1 = await expireSessions(env);
  const r2 = await nullifyEncrypted(env);
  const r3 = await deleteMessages(env);
  const r4 = await archiveModelRuns(env);
  const r5 = await archiveSafetyFlags(env);
  assert.ok([r1, r2, r3, r4, r5].every((n) => n >= 0));
  assert.ok(db.auditLogs.length >= 5);
});
