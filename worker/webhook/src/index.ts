// isehat-webhooks-worker — Sprint 6 Worker #4
// Public-but-single-purpose: only receives external webhooks (WhatsApp / Telegram /
// Xendit / Resend). Validates signatures, dedups via providerMessageId UNIQUE, then
// forwards to the correct internal Worker via Service Binding.
//
// Business logic lands in S6G / S6H:
//   S6G-T-01 — this skeleton (S6G-T-02..T-15 wire each webhook)
//   S6G-T-08 — /api/whatsapp/webhook forwards to AI_SERVICE
//   S6G-T-13 — /api/whatsapp/media/ingest stores R2 + forwards
//   S6G-T-14 — /api/telegram/webhook + /api/billing/webhook/xendit forward to API_SERVICE

import { Hono } from "hono";

type Bindings = {
  DB: D1Database;
  LOGS: R2Bucket;
  API_SERVICE: Fetcher;
  AI_SERVICE: Fetcher;
  JOBS_SERVICE: Fetcher;
  CRON_SECRET?: string;
  WA_GATEWAY_SECRET?: string;
  XENDIT_WEBHOOK_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// timingSafeEqual-equivalent: this Worker runs in V8 isolated context; we
// implement with constant-time per-char XOR. Used in validateGatewaySecret below.
function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function validateGatewaySecret(c: any, env: Bindings): boolean {
  const provided = c.req.header("X-Gateway-Secret") ?? "";
  if (!env.WA_GATEWAY_SECRET) return false;
  return timingSafeStringEqual(provided, env.WA_GATEWAY_SECRET);
}

// Health — exposed for VPS Baileys heartbeat + Cloudflare monitoring.
app.get("/health", (c) => {
  const provided = c.req.query("secret") ?? c.req.header("X-Cron-Secret");
  if (provided !== c.env.CRON_SECRET) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }
  return c.json({
    success: true,
    data: {
      worker: "isehat-webhooks-worker",
      status: "ok",
      serviceBindingsActive: ["API_SERVICE", "AI_SERVICE", "JOBS_SERVICE"].every(
        (k) => Boolean((c.env as Record<string, unknown>)[k])
      ),
    },
    meta: { checkedAt: new Date().toISOString() },
  });
});

// 11.3 WhatsApp webhook — S6G-T-08. Stub delegates to AI_SERVICE.
app.post("/api/whatsapp/webhook", async (c) => {
  if (!validateGatewaySecret(c, c.env)) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }
  // S6G-T-08 real impl:
  //   1. Parse normalized inbound payload (providerMessageId, whatsappNumber, messageType, textContent)
  //   2. Idempotency: SELECT HL_whatsappMessages WHERE providerMessageId=...
  //      → if exists, return 200 (dup) without further processing
  //   3. HL_whatsappLinks lookup: SELECT userId WHERE whatsappNumberHash=sha256(number) AND verified=1 AND aiEnabled=1
  //      → unlinked / not-verified / aiEnabled=0: respond with onboarding / link instruction / STOP-AI confirmation
  //   4. Forward to AI_SERVICE /api/ai/clinical/event (Worker #2 WhatsAppSessionDO serializes; orchestrator runs)
  //   5. queue outbound reply via whatsapp-outbound queue (Worker #3 consumer drives Baileys sendMessage)
  // For skeleton: reject all real calls until S6G-T-08 implementations lands.
  return c.json(
    {
      success: false,
      error: { code: "NOT_IMPLEMENTED", message: "Land in S6G-T-08" },
    },
    501
  );
});

// 11.3 WhatsApp media ingest — S6G-T-13 stub.
app.post("/api/whatsapp/media/ingest", async (c) => {
  if (!validateGatewaySecret(c, c.env)) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }
  return c.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6G-T-13" } },
    501
  );
});

// 11.3 Telegram webhook — S6G-T-14 stub. Forwards to API_SERVICE.
app.post("/api/telegram/webhook", async (c) => {
  // S6G-T-14 validation: bot token in path or header; signature validation per
  // Telegram docs. For skeleton: 501.
  void c.env.API_SERVICE;
  return c.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6G-T-14" } },
    501
  );
});

// 11.3 Xendit billing webhook — S6G-T-14 stub.
app.post("/api/billing/webhook/xendit", async (c) => {
  // S6G-T-14 validation: verify Xendit signature using XENDIT_WEBHOOK_SECRET.
  return c.json(
    { success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6G-T-14" } },
    501
  );
});

export default app;
