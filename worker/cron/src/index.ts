// isehat-jobs-worker — Sprint 6 Worker #3
// Cron + queue consumer. No inbound HTTP except internal /health for cron_secret probes.
// Business logic:
//   S6F-T-11: doctor-handoff report generation queue handler
//   S6F-T-12: 6 data retention cron jobs
//   S6G-T-11: whatsapp-outbound consumer (HTTP POST to VPS Baileys)
//   S6H-T-04: eval-jobs consumer (run cases against Clinical Orchestrator)

import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
  LOGS: R2Bucket;
  CRON_SECRET?: string;
  RETENTION_SESSIONS_HOURS?: string;
  RETENTION_MESSAGES_HOURS?: string;
  RETENTION_ENCRYPTED_HOURS?: string;
  RETENTION_MODEL_RUNS_HOURS?: string;
  RETENTION_INACTIVE_USERS_HOURS?: string;
  RETENTION_SAFETY_FLAGS_HOURS?: string;
  AI_SERVICE?: Fetcher;
  BAILEYS_GATEWAY_URL?: string;
  WA_GATEWAY_SECRET?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health — same envelope as Worker #2; only callable with CRON_SECRET to avoid
// unauthenticated probes leaking cron schedule.
app.get("/health", (c) => {
  const provided = c.req.query("secret") ?? c.req.header("X-Cron-Secret");
  if (provided !== c.env.CRON_SECRET) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }
  return c.json({
    success: true,
    data: {
      worker: "isehat-jobs-worker",
      status: "ok",
      cronsConfigured: 1,
      queueConsumers: 4,
    },
    meta: { checkedAt: new Date().toISOString() },
  });
});

export default app;

function getRetentionHours(envValue: string | undefined, fallback: number): number {
  const n = Number(envValue);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function writeAuditLog(
  db: D1Database,
  action: string,
  jobType: string,
  rowCount: number,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db.prepare(
      `INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt)
       VALUES (NULL, ?, 'dataRetentionCleanup', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      action,
      jobType,
      JSON.stringify({ jobType, rowCount, ...metadata })
    ).run();
  } catch (error) {
    console.error(`writeAuditLog failed for ${jobType}:`, error);
  }
}

// Scheduled handler — routed per cron schedule via [triggers] in wrangler.toml.
export const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (controller, env, ctx) => {
  const cron = controller.cron;
  switch (cron) {
    case "0 2 * * *":
      ctx.waitUntil(Promise.all([
        expireSessions(env),
        nullifyEncrypted(env),
        deleteMessages(env),
        cleanupUnlinkedWhatsApp(env),
        archiveModelRuns(env),
        archiveSafetyFlags(env),
        deleteInactiveVectors(env),
      ]));
      break;
    default:
      console.warn(`scheduled: unknown cron fired: ${cron}`);
  }
};

// S6F-T-12: expire old active sessions
export async function expireSessions(env: Bindings): Promise<number> {
  const hours = getRetentionHours(env.RETENTION_SESSIONS_HOURS, 8760);
  try {
    const result = await env.DB.prepare(
      `UPDATE HL_aiClinicalSessions
       SET status = 'expired'
       WHERE status = 'active' AND startedAt < datetime('now', ?)`
    ).bind(`-${hours} hours`).run();

    const meta = result.meta as Record<string, unknown> | undefined;
    const count = Number(meta?.changes ?? 0);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'expireSessions', count, { hours });
    return count;
  } catch (error) {
    console.error('expireSessions failed:', error);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'expireSessions', 0, { hours, error: String(error) });
    return 0;
  }
}

// S6F-T-12: nullify encrypted content
export async function nullifyEncrypted(env: Bindings): Promise<number> {
  const hours = getRetentionHours(env.RETENTION_ENCRYPTED_HOURS, 2160);
  try {
    const result = await env.DB.prepare(
      `UPDATE HL_aiClinicalMessages
       SET contentEncrypted = NULL
       WHERE createdAt < datetime('now', ?)`
    ).bind(`-${hours} hours`).run();

    const meta = result.meta as Record<string, unknown> | undefined;
    const count = Number(meta?.changes ?? 0);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'nullifyEncrypted', count, { hours });
    return count;
  } catch (error) {
    console.error('nullifyEncrypted failed:', error);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'nullifyEncrypted', 0, { hours, error: String(error) });
    return 0;
  }
}

// S6F-T-12: hard delete old messages
export async function deleteMessages(env: Bindings): Promise<number> {
  const hours = getRetentionHours(env.RETENTION_MESSAGES_HOURS, 4320);
  try {
    const result = await env.DB.prepare(
      `DELETE FROM HL_aiClinicalMessages
       WHERE createdAt < datetime('now', ?)`
    ).bind(`-${hours} hours`).run();

    const meta = result.meta as Record<string, unknown> | undefined;
    const count = Number(meta?.changes ?? 0);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'deleteMessages', count, { hours });
    return count;
  } catch (error) {
    console.error('deleteMessages failed:', error);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'deleteMessages', 0, { hours, error: String(error) });
    return 0;
  }
}

async function archiveRowsToR2(
  env: Bindings,
  tableName: string,
  dateColumn: string,
  hours: number,
  archivePrefix: string
): Promise<number> {
  const cutoff = `-${hours} hours`;
  const rows = await env.DB.prepare(
    `SELECT * FROM ${tableName} WHERE ${dateColumn} < datetime('now', ?)`
  ).bind(cutoff).all<Record<string, unknown>>();

  const results = rows.results || [];
  if (results.length === 0) return 0;

  const dateStr = new Date().toISOString().split('T')[0];
  const key = `${archivePrefix}/${dateStr}.jsonl`;
  const jsonl = results.map((r) => JSON.stringify(r)).join('\n') + '\n';

  await env.LOGS.put(key, jsonl, { httpMetadata: { contentType: 'application/jsonl' } });

  await env.DB.prepare(
    `DELETE FROM ${tableName} WHERE ${dateColumn} < datetime('now', ?)`
  ).bind(cutoff).run();

  return results.length;
}

// S6F-T-12: archive model runs to R2 then delete
export async function archiveModelRuns(env: Bindings): Promise<number> {
  const hours = getRetentionHours(env.RETENTION_MODEL_RUNS_HOURS, 8760);
  try {
    const count = await archiveRowsToR2(env, 'HL_modelRuns', 'createdAt', hours, 'archives/model-runs');
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'archiveModelRuns', count, { hours });
    return count;
  } catch (error) {
    console.error('archiveModelRuns failed:', error);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'archiveModelRuns', 0, { hours, error: String(error) });
    return 0;
  }
}

// S6F-T-12: archive safety flags to R2 then delete
export async function archiveSafetyFlags(env: Bindings): Promise<number> {
  const hours = getRetentionHours(env.RETENTION_SAFETY_FLAGS_HOURS, 17520);
  try {
    const count = await archiveRowsToR2(env, 'HL_aiOutputSafetyFlags', 'createdAt', hours, 'archives/safety-flags');
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'archiveSafetyFlags', count, { hours });
    return count;
  } catch (error) {
    console.error('archiveSafetyFlags failed:', error);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'archiveSafetyFlags', 0, { hours, error: String(error) });
    return 0;
  }
}

// GC: daily cleanup of unlinked WhatsApp messages older than 30 days
// PRD S6F retention: processedStatus='ignored_unlinked' AND createdAt < 30 days
// Uses idx_whatsappMessages_ignoredUnlinked partial index from migration 007
export async function cleanupUnlinkedWhatsApp(env: Bindings): Promise<number> {
  try {
    const result = await env.DB.prepare(
      `DELETE FROM HL_whatsappMessages
       WHERE processedStatus = 'ignored_unlinked'
         AND createdAt < datetime('now', '-30 day')`
    ).run();
    const meta = result.meta as Record<string, unknown> | undefined;
    const count = Number(meta?.changes ?? 0);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'cleanupUnlinkedWhatsApp', count, { retentionDays: 30 });
    return count;
  } catch (error) {
    console.error('cleanupUnlinkedWhatsApp failed:', error);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'cleanupUnlinkedWhatsApp', 0, { error: String(error) });
    return 0;
  }
}

// S6F-T-12: mark vectors deleted for inactive users; optionally enqueue cleanup to Worker #2
export async function deleteInactiveVectors(env: Bindings): Promise<number> {
  const hours = getRetentionHours(env.RETENTION_INACTIVE_USERS_HOURS, 8760);
  try {
    const users = await env.DB.prepare(
      `SELECT id FROM HL_users
       WHERE lastLoginAt IS NOT NULL
         AND lastLoginAt < datetime('now', ?)`
    ).bind(`-${hours} hours`).all<{ id: number }>();

    const userIds = (users.results || []).map((r) => r.id);
    if (userIds.length === 0) {
      await writeAuditLog(env.DB, 'dataRetentionCleanup', 'deleteInactiveVectors', 0, { hours });
      return 0;
    }

    let marked = 0;
    for (const userId of userIds) {
      const result = await env.DB.prepare(
        `UPDATE HL_vectorDocuments
         SET status = 'deleted', updatedAt = CURRENT_TIMESTAMP
         WHERE userId = ? AND status != 'deleted'`
      ).bind(userId).run();

      const meta = result.meta as Record<string, unknown> | undefined;
      marked += Number(meta?.changes ?? 0);

      // If Vectorize binding is unavailable, enqueue cleanup to Worker #2 via Service Binding
      if (!(env as any).VECTORIZE_INDEX && env.AI_SERVICE) {
        try {
          await env.AI_SERVICE.fetch(new Request('https://ai-service.internal/api/ai/memory/delete-inactive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }));
        } catch (error) {
          console.error(`deleteInactiveVectors: enqueue for user ${userId} failed:`, error);
        }
      }
    }

    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'deleteInactiveVectors', marked, { hours, usersAffected: userIds.length });
    return marked;
  } catch (error) {
    console.error('deleteInactiveVectors failed:', error);
    await writeAuditLog(env.DB, 'dataRetentionCleanup', 'deleteInactiveVectors', 0, { hours, error: String(error) });
    return 0;
  }
}

// Queue handler — batch consumer for the 4 queues in wrangler.toml.
export const queue: ExportedHandlerQueueHandler<Bindings> = async (batch, env, _ctx) => {
  for (const msg of batch.messages) {
    const body = (msg.body as Record<string, unknown>) ?? {};
    const type = typeof body.type === 'string' ? body.type : '';

    try {
      if (type === 'doctorHandoff') {
        await handleDoctorHandoffQueue(env, body);
      } else if (type === 'rebuild') {
        await handleMemoryRebuildQueue(env, body);
      } else if (type === 'delete') {
        await handleMemoryDeleteQueue(env, body);
      } else if (type === 'whatsapp-outbound' || (batch as any).queue === 'whatsapp-outbound') {
        await handleWhatsappOutboundQueue(env, body);
      } else if (type === 'evalRun') {
        await handleEvalRunQueue(env, body);
      } else if (type === 'kbReindex') {
        console.log(`queue: eval-jobs kbReindex received, requestedBy=${body.requestedBy || 'unknown'}`);
      } else {
        console.log(`queue: unhandled type ${type}`);
      }
    } catch (error) {
      console.error(`queue handler error for type ${type}:`, error);
    } finally {
      msg.ack();
    }
  }
};

async function handleDoctorHandoffQueue(env: Bindings, body: Record<string, unknown>): Promise<void> {
  const userId = Number(body.userId);
  const sessionId = Number(body.sessionId);
  const modelRunId = body.modelRunId ? Number(body.modelRunId) : null;
  const r2Key = typeof body.r2Key === 'string' ? body.r2Key : null;

  try {
    await env.DB.prepare(
      `INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt)
       VALUES (?, 'doctorHandoffQueued', 'HL_modelRuns', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      Number.isFinite(userId) ? userId : null,
      modelRunId ? String(modelRunId) : null,
      JSON.stringify({ sessionId, r2Key, sourceQueue: 'ai-memory-jobs' })
    ).run();
  } catch (error) {
    console.error('handleDoctorHandoffQueue: audit log failed:', error);
  }
}

// S6G-T-11: WhatsApp outbound queue consumer
async function handleWhatsappOutboundQueue(env: Bindings, body: Record<string, unknown>): Promise<void> {
  const whatsappLinkId = Number(body.whatsappLinkId);
  const userId = Number(body.userId);
  const text = typeof body.text === 'string' ? body.text : '';
  const providerMessageId = typeof body.providerMessageId === 'string' ? body.providerMessageId : null;

  try {
    await env.DB.prepare(
      `INSERT INTO HL_whatsappMessages
        (userId, whatsappLinkId, providerMessageId, direction, messageType, contentPreview, processedStatus, createdAt)
       VALUES (?, ?, ?, 'outbound', 'text', ?, 'completed', CURRENT_TIMESTAMP)`
    ).bind(
      Number.isFinite(userId) ? userId : null,
      Number.isFinite(whatsappLinkId) ? whatsappLinkId : null,
      providerMessageId,
      text.slice(0, 200)
    ).run();
  } catch (error) {
    console.error('handleWhatsappOutboundQueue: message insert failed:', error);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt)
       VALUES (?, 'whatsappOutboundQueued', 'HL_whatsappMessages', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      Number.isFinite(userId) ? userId : null,
      providerMessageId,
      JSON.stringify({ whatsappLinkId, providerMessageId, textLength: text.length })
    ).run();
  } catch (error) {
    console.error('handleWhatsappOutboundQueue: audit log failed:', error);
  }

  if (env.BAILEYS_GATEWAY_URL) {
    try {
      await fetch(env.BAILEYS_GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gateway-Secret': env.WA_GATEWAY_SECRET ?? '',
        },
        body: JSON.stringify({ whatsappLinkId, text, providerMessageId }),
      });
    } catch (error) {
      console.error('handleWhatsappOutboundQueue: Baileys gateway post failed:', error);
    }
  }
}

// ai-memory-jobs: forward rebuild to Worker #2 via Service Binding
async function handleMemoryRebuildQueue(env: Bindings, body: Record<string, unknown>): Promise<void> {
  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    console.error('handleMemoryRebuildQueue: invalid userId');
    return;
  }
  await writeAuditLog(env.DB, 'memoryRebuildRequested', 'HL_vectorDocuments', 0, { userId });
  if (env.AI_SERVICE) {
    try {
      await env.AI_SERVICE.fetch(new Request('https://ai-service.internal/api/ai/memory/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-UserId': String(userId) },
        body: JSON.stringify({}),
      }));
    } catch (error) {
      console.error(`handleMemoryRebuildQueue: forward to AI_SERVICE failed for user ${userId}:`, error);
    }
  }
}

// ai-memory-jobs: forward delete to Worker #2 via Service Binding
async function handleMemoryDeleteQueue(env: Bindings, body: Record<string, unknown>): Promise<void> {
  const userId = Number(body.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    console.error('handleMemoryDeleteQueue: invalid userId');
    return;
  }
  await writeAuditLog(env.DB, 'memoryDeleteRequested', 'HL_vectorDocuments', 0, { userId });
  if (env.AI_SERVICE) {
    try {
      await env.AI_SERVICE.fetch(new Request('https://ai-service.internal/api/ai/memory/delete-inactive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      }));
    } catch (error) {
      console.error(`handleMemoryDeleteQueue: forward to AI_SERVICE failed for user ${userId}:`, error);
    }
  }
}

// eval-jobs: process evaluation dataset cases against the clinical orchestrator
async function handleEvalRunQueue(env: Bindings, body: Record<string, unknown>): Promise<void> {
  const datasetVersion = typeof body.datasetVersion === 'string' ? body.datasetVersion : 'v1.0.0';
  await writeAuditLog(env.DB, 'evalRunStarted', 'HL_aiKnowledgeDocuments', 0, { datasetVersion });
  try {
    const datasetObj = await env.LOGS.get('eval/sprint6/dataset.json');
    if (!datasetObj) {
      console.error('handleEvalRunQueue: dataset not found in R2');
      await writeAuditLog(env.DB, 'evalRunFailed', 'HL_aiKnowledgeDocuments', 0, { datasetVersion, reason: 'dataset_not_found' });
      return;
    }
    const datasetText = await datasetObj.text();
    const dataset = JSON.parse(datasetText);
    const cases = dataset.cases || [];
    if (!Array.isArray(cases) || cases.length === 0) {
      console.error('handleEvalRunQueue: invalid dataset format — empty or missing cases');
      return;
    }

    let passed = 0;
    let failed = 0;
    const results: Array<{ caseId: string; passed: boolean; error?: string }> = [];

    for (const caseItem of cases) {
      const caseId = caseItem.caseId || 'unknown';
      try {
        let outputText = '';
        let answerType = '';
        let hasDisclaimer = false;
        let hasRedFlag = false;

        // Call clinical orchestrator via AI_SERVICE if available
        if (env.AI_SERVICE && caseItem.input?.message) {
          try {
            const res = await env.AI_SERVICE.fetch(new Request('https://ai-service.internal/api/ai/clinical/message', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Internal-UserId': '1' },
              body: JSON.stringify({
                sessionId: 1,
                message: caseItem.input.message,
                locale: caseItem.locale || 'id',
              }),
            }));
            const payload = await res.json().catch(() => ({})) as Record<string, unknown>;
            const data = payload?.data as Record<string, unknown> | undefined;
            outputText = String(data?.reply || payload?.reply || '');
            answerType = String(data?.answerType || '');
            hasDisclaimer = /ai dapat melakukan kesalahan|ai can make mistakes/i.test(outputText);
            hasRedFlag = String(data?.redFlagStatus || '') === 'emergency';
          } catch {
            outputText = '';
          }
        }

        // Check expected output
        const expected = caseItem.expectedOutput || {};
        let casePassed = true;
        const errors: string[] = [];

        if (expected.shouldContain && Array.isArray(expected.shouldContain)) {
          for (const phrase of expected.shouldContain) {
            if (!outputText.toLowerCase().includes(phrase.toLowerCase())) {
              casePassed = false;
              errors.push(`missing: ${phrase}`);
            }
          }
        }
        if (expected.shouldNotContain && Array.isArray(expected.shouldNotContain)) {
          for (const phrase of expected.shouldNotContain) {
            if (outputText.toLowerCase().includes(phrase.toLowerCase())) {
              casePassed = false;
              errors.push(`found_forbidden: ${phrase}`);
            }
          }
        }
        if (expected.disclaimerExpected && !hasDisclaimer) {
          casePassed = false;
          errors.push('missing_disclaimer');
        }
        if (expected.redFlagExpected !== undefined && expected.redFlagExpected !== hasRedFlag) {
          casePassed = false;
          errors.push(`redFlag_mismatch: expected=${expected.redFlagExpected} actual=${hasRedFlag}`);
        }
        if (expected.answerTypeExpected && Array.isArray(expected.answerTypeExpected)) {
          if (!expected.answerTypeExpected.includes(answerType)) {
            casePassed = false;
            errors.push(`answerType_mismatch: expected one of ${expected.answerTypeExpected.join(',')} got ${answerType}`);
          }
        }

        if (casePassed) passed++;
        else failed++;

        results.push({ caseId, passed: casePassed, error: errors.length > 0 ? errors.join('; ') : undefined });

        // Store case result
        await env.DB.prepare(
          `INSERT OR REPLACE INTO HL_aiKnowledgeDocuments
            (sourceType, sourceId, title, locale, contentVersion, reviewerStatus, indexedAt, createdAt, updatedAt)
           VALUES ('eval_case', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(
          caseId,
          `Eval ${casePassed ? 'PASS' : 'FAIL'}: ${caseItem.category || 'unknown'} (${answerType})`,
          caseItem.locale || 'id',
          datasetVersion,
          casePassed ? 'approved' : 'draft'
        ).run();
      } catch (error) {
        failed++;
        results.push({ caseId, passed: false, error: String(error) });
      }
    }

    await writeAuditLog(env.DB, 'evalRunCompleted', 'HL_aiKnowledgeDocuments', passed, {
      datasetVersion,
      totalCases: cases.length,
      passed,
      failed,
      passRate: cases.length > 0 ? Math.round((passed / cases.length) * 100) : 0,
    });
  } catch (error) {
    console.error('handleEvalRunQueue: failed:', error);
    await writeAuditLog(env.DB, 'evalRunFailed', 'HL_aiKnowledgeDocuments', 0, { datasetVersion, error: String(error) });
  }
}
