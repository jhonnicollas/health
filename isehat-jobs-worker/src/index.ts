// isehat-jobs-worker — Sprint 6 Worker #3
// Cron + queue consumer. No inbound HTTP except internal /health for cron_secret probes.
// Business logic lands in subsequent phases:
//   S6F-T-01: skeleton + cron / queue wiring (this file)
//   S6F-T-12: 6 retention cron jobs (see wrangler.toml [triggers])
//   S6F-T-11: doctor-handoff report generation queue handler
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
      cronsConfigured: 6,
      queueConsumers: 4,
    },
    meta: { checkedAt: new Date().toISOString() },
  });
});

export default app;

// Scheduled handler — routed per cron schedule via [triggers] in wrangler.toml.
// Each cron must be implemented in S6F-T-12; the dispatcher below is a steady-state
// skeleton. Real implementations write to HL_auditLogs action='dataRetentionCleanup'
// per PRD §15.4.
export const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (controller, env, ctx) => {
  const cron = controller.cron;
  // cron is a regex-like string of the schedule pattern that fired; not full cron
  // expression details. We dispatch by exact pattern (verified against wrangler.toml).
  switch (cron) {
    case "0 2 * * *":
      // expireSessions: HL_aiClinicalSessions.status WHERE startedAt < now-365d → 'expired'
      ctx.waitUntil(expireSessions(env));
      break;
    case "30 2 * * *":
      // nullifyEncrypted: HL_aiClinicalMessages.contentEncrypted = NULL WHERE createdAt < now-90d
      ctx.waitUntil(nullifyEncrypted(env));
      break;
    case "0 3 * * *":
      // deleteMessages: HL_aiClinicalMessages WHERE createdAt < now-180d → DELETE
      ctx.waitUntil(deleteMessages(env));
      break;
    case "0 4 * * 0":
      // archiveModelRuns: HL_modelRuns WHERE createdAt < now-365d → R2 archive + D1 delete
      ctx.waitUntil(archiveModelRuns(env));
      break;
    case "30 4 * * 0":
      // deleteInactiveVectors: Vectorize + HL_vectorDocuments.status='deleted' WHERE
      // HL_users.lastLoginAt < now-365d. Implemented with Worker #2 Service Binding in S6F-T-12.
      // Worker #3 only enqueues the job; the actual Vectorize ops require #2.
      ctx.waitUntil(deleteInactiveVectors(env));
      break;
    case "0 5 1 * *":
      // archiveSafetyFlags: HL_aiOutputSafetyFlags WHERE createdAt < now-730d → R2 archive + D1 delete
      ctx.waitUntil(archiveSafetyFlags(env));
      break;
    default:
      // Unknown cron pattern — log for ops triage.
      console.warn(`scheduled: unknown cron fired: ${cron}`);
  }
};

async function expireSessions(env: Bindings): Promise<void> {
  // S6F-T-12 implementation: UPDATE HL_aiClinicalSessions SET status='expired' ...
  void env;
}
async function nullifyEncrypted(env: Bindings): Promise<void> {
  // S6F-T-12 implementation: UPDATE HL_aiClinicalMessages SET contentEncrypted = NULL ...
  void env;
}
async function deleteMessages(env: Bindings): Promise<void> {
  // S6F-T-12 implementation: DELETE FROM HL_aiClinicalMessages WHERE ...
  void env;
}
async function archiveModelRuns(env: Bindings): Promise<void> {
  // S6F-T-12 implementation: SELECT rows → LOGS.put → DELETE FROM HL_modelRuns
  void env;
}
async function deleteInactiveVectors(_env: Bindings): Promise<void> {
  // S6F-T-12 + Sprint 6F-T-12 cross-worker: this Worker enqueues a job for
  // Worker #2 which owns Vectorize. Real implementation lands in S6F-T-12.
  void _env;
}
async function archiveSafetyFlags(env: Bindings): Promise<void> {
  // S6F-T-12 implementation: same pattern as archiveModelRuns
  void env;
}

// Queue handler — batch consumer for the 4 queues in wrangler.toml.
// Real per-queue branches: S6G (whatsapp-outbound), S6H (eval-jobs), S6F (memory + handoff).
export const queue: ExportedHandlerQueueHandler<Bindings> = async (batch, env, _ctx) => {
  for (const msg of batch.messages) {
    const queueName = msg.body.queue ? "" : batch.queue;
    void queueName;
    // S6G-T-11 / S6H-T-04 branching lands here in their respective phases.
    msg.ack();
  }
  void env;
};
