// isehat-webhooks-worker — Sprint 6 Worker #4
// Public-but-single-purpose: receives external webhooks (WhatsApp / Telegram /
// Xendit / Resend), validates signatures, dedups via providerMessageId UNIQUE, then
// forwards to the correct internal Worker via Service Binding.

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

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < byteArray.length; i += 1) binary += String.fromCharCode(byteArray[i]);
  return btoa(binary).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sha256Token(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return `sha256:${base64Url(buf)}`;
}

function validateGatewaySecret(c: any, env: Bindings): boolean {
  const provided = c.req.header("X-Gateway-Secret") ?? "";
  if (!env.WA_GATEWAY_SECRET) return false;
  return timingSafeStringEqual(provided, env.WA_GATEWAY_SECRET);
}

function normalizeWhatsappNumber(raw: string): string {
  const stripped = raw.replace(/@s\.whatsapp\.net$/i, "").replace(/[^\d+]/g, "");
  return stripped.startsWith("+") ? stripped : `+${stripped.replace(/^\+/, "")}`;
}

// PRD §7.1: HL_whatsappMessages.messageType CHECK allows text/image/document/audio/command.
// 'video' is intentionally folded into 'document' to satisfy the CHECK constraint
// (no separate video tracking in PRD §12.8) and prevent INSERT failures on outbound.
function detectMessageType(body: Record<string, unknown>): string {
  if (typeof body.messageType === "string") {
    return body.messageType === "video" ? "document" : body.messageType;
  }
  const msg = (body.message as Record<string, unknown>) ?? {};
  const mime = body.mediaMimeType?.toString() ?? "";
  if (msg.imageMessage || mime.startsWith("image/")) return "image";
  if (msg.audioMessage || mime.startsWith("audio/")) return "audio";
  if (msg.videoMessage || mime.startsWith("video/")) return "document";
  if (msg.documentMessage || mime.startsWith("application/")) return "document";
  return "text";
}

// PRD §7.1: Mime allowlist (image/jpeg, image/png, application/pdf) + 10 MB / 13.3 MB base64 size cap.
const ALLOWED_MEDIA_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/jpg",
  "application/pdf",
]);
const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10 MB
// base64 is ~4/3 larger than raw bytes; reject base64 strings > 13.4 MB to stay under 10 MB decoded.
const MAX_MEDIA_BASE64_CHARS = Math.ceil((MAX_MEDIA_BYTES / 3) * 4) + 64;

function isAllowedMediaMime(mime: string): boolean {
  return ALLOWED_MEDIA_MIMES.has(mime.toLowerCase());
}

function extractTextContent(body: Record<string, unknown>): string | undefined {
  if (typeof body.textContent === "string") return body.textContent;
  const msg = (body.message as Record<string, unknown>) ?? {};
  const conversation = (msg.conversation as string) ?? undefined;
  if (conversation) return conversation;
  const extended = (msg.extendedTextMessage as Record<string, unknown>) ?? {};
  if (typeof extended.text === "string") return extended.text;
  return undefined;
}

async function getConfigNumber(db: D1Database, key: string, fallback: number): Promise<number> {
  try {
    const row = await db.prepare("SELECT configValue FROM HL_systemConfigs WHERE configKey = ?").bind(key).first<{ configValue: string }>();
    const n = row?.configValue ? Number(row.configValue) : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

// Per-number per-minute inbound rate limit (in-memory; PRD §14 upgrade to KV in S6I)
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

async function checkInboundRateLimit(db: D1Database, whatsappNumber: string, now = Date.now()): Promise<boolean> {
  const limit = await getConfigNumber(db, "whatsappAi.maxInboundPerMinute", 100);
  const windowMs = 60_000;
  const bucket = Math.floor(now / windowMs);
  const key = `${whatsappNumber}:${bucket}`;
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}

function linkingInstruction(locale: "id" | "en"): string {
  return locale === "en"
    ? "This WhatsApp number is not linked to iSehat. Please link it in the iSehat app: Settings > WhatsApp AI."
    : "Nomor WhatsApp ini belum tertaut ke iSehat. Hubungkan melalui aplikasi iSehat: Pengaturan > WhatsApp AI.";
}

// Health — exposed for VPS Baileys heartbeat + Cloudflare monitoring.
app.get("/health", (c) => {
  const provided = c.req.query("secret") ?? c.req.header("X-Cron-Secret");
  if (provided !== c.env.CRON_SECRET) {
    return c.json({ success: true, data: { worker: "isehat-webhooks-worker", status: "ok" } });
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

interface NormalizedInbound {
  providerMessageId: string;
  whatsappNumber: string;
  messageType: string;
  textContent?: string;
  mediaUrl?: string;
  timestamp: number;
}

function normalizeInbound(body: Record<string, unknown>): NormalizedInbound | null {
  const messages = body.messages as Array<Record<string, unknown>> | undefined;
  const first = messages?.[0] ?? body;
  const providerMessageId = (first.providerMessageId as string) ?? (first.key && (first.key as Record<string, unknown>).id as string) ?? "";
  const rawNumber = (first.whatsappNumber as string) ?? (first.key && (first.key as Record<string, unknown>).remoteJid as string) ?? "";
  const whatsappNumber = normalizeWhatsappNumber(rawNumber);
  if (!providerMessageId || !whatsappNumber) return null;
  const textContent = extractTextContent(first);
  const mediaUrl = typeof first.mediaUrl === "string" ? first.mediaUrl : undefined;
  const timestamp = first.messageTimestamp ? Number(first.messageTimestamp) * 1000 : Date.now();
  const messageType = detectMessageType(first);
  return { providerMessageId, whatsappNumber, messageType, textContent, mediaUrl, timestamp };
}

// 11.3 WhatsApp webhook — S6G-T-08
app.post("/api/whatsapp/webhook", async (c) => {
  if (!validateGatewaySecret(c, c.env)) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
  }

  const inbound = normalizeInbound(body);
  if (!inbound) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Missing providerMessageId or whatsappNumber" } }, 400);
  }

  // Idempotency
  const existing = await c.env.DB.prepare(
    "SELECT id FROM HL_whatsappMessages WHERE providerMessageId = ? LIMIT 1"
  ).bind(inbound.providerMessageId).first<{ id: number }>();
  if (existing) {
    return c.json({ success: true, duplicate: true }, 200);
  }

  // Rate limit
  if (!(await checkInboundRateLimit(c.env.DB, inbound.whatsappNumber))) {
    return c.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many messages. Try again later." } }, 429);
  }

  const numberHash = await sha256Token(inbound.whatsappNumber);
  const link = await c.env.DB.prepare(
    "SELECT id, userId, verified, aiEnabled FROM HL_whatsappLinks WHERE whatsappNumberHash = ? LIMIT 1"
  ).bind(numberHash).first<{ id: number; userId: number; verified: number; aiEnabled: number }>();

  const locale: "id" | "en" = body.locale === "en" ? "en" : "id";

  if (!link || link.verified !== 1 || link.aiEnabled !== 1) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO HL_whatsappMessages
          (userId, whatsappLinkId, providerMessageId, direction, messageType, contentPreview, processedStatus, createdAt)
         VALUES (NULL, NULL, ?, 'inbound', ?, ?, 'ignored_unlinked', CURRENT_TIMESTAMP)`
      ).bind(inbound.providerMessageId, inbound.messageType, inbound.textContent?.slice(0, 200) ?? null).run();
    } catch (err) {
      // Race: UNIQUE(providerMessageId) from migration 007. Surface as duplicate so VPS Baileys stops retrying.
      const msg = err instanceof Error ? err.message : String(err);
      if (/UNIQUE constraint failed/i.test(msg) || /providerMessageId/i.test(msg)) {
        return c.json({ success: true, duplicate: true, unlinked: true }, 200);
      }
      throw err;
    }
    return c.json({ success: true, unlinked: true, reply: linkingInstruction(locale) }, 200);
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO HL_whatsappMessages
        (userId, whatsappLinkId, providerMessageId, direction, messageType, contentPreview, processedStatus, createdAt)
       VALUES (?, ?, ?, 'inbound', ?, ?, 'processing', CURRENT_TIMESTAMP)`
    ).bind(link.userId, link.id, inbound.providerMessageId, inbound.messageType, inbound.textContent?.slice(0, 200) ?? null).run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(msg) || /providerMessageId/i.test(msg)) {
      return c.json({ success: true, duplicate: true }, 200);
    }
    throw err;
  }

  if (!c.env.AI_SERVICE) {
    return c.json({ success: false, error: { code: "AI_SERVICE_UNAVAILABLE" } }, 503);
  }

  try {
    const res = await c.env.AI_SERVICE.fetch(new Request("https://ai-service.internal/api/ai/clinical/whatsapp/event", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-UserId": String(link.userId) },
      body: JSON.stringify({
        whatsappLinkId: link.id,
        userId: link.userId,
        whatsappNumber: inbound.whatsappNumber,
        messageType: inbound.messageType,
        textContent: inbound.textContent,
        providerMessageId: inbound.providerMessageId,
        locale,
      }),
    }));
    return c.json({ success: true, accepted: true }, (res.ok ? 202 : res.status) as any);
  } catch (error) {
    console.error("whatsapp webhook forward failed:", error);
    return c.json({ success: false, error: { code: "AI_SERVICE_ERROR" } }, 502);
  }
});

// 11.3 WhatsApp media ingest — S6G-T-13 (PRD §7.1: 10MB cap + MIME allowlist)
app.post("/api/whatsapp/media/ingest", async (c) => {
  if (!validateGatewaySecret(c, c.env)) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
  }

  const providerMessageId = typeof body.providerMessageId === "string" ? body.providerMessageId : "";
  const rawNumber = typeof body.whatsappNumber === "string" ? body.whatsappNumber : "";
  const mediaMimeType = typeof body.mediaMimeType === "string" ? body.mediaMimeType : "application/octet-stream";
  const mediaBufferBase64 = typeof body.mediaBufferBase64 === "string" ? body.mediaBufferBase64 : "";

  if (!providerMessageId || !rawNumber || !mediaBufferBase64) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "providerMessageId, whatsappNumber and mediaBufferBase64 are required" } }, 400);
  }

  // PRD §7.1 — MIME allowlist: image/jpeg, image/png, application/pdf.
  if (!isAllowedMediaMime(mediaMimeType)) {
    return c.json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: `mediaMimeType not allowed. Allowed: ${Array.from(ALLOWED_MEDIA_MIMES).join(", ")}` },
    }, 400);
  }

  // PRD §7.1 — File size < 10MB. base64-encoded length is the cheapest pre-decode guard.
  if (mediaBufferBase64.length > MAX_MEDIA_BASE64_CHARS) {
    return c.json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: `mediaBufferBase64 length exceeds ${MAX_MEDIA_BASE64_CHARS} chars (≈10 MB decoded)` },
    }, 400);
  }

  const whatsappNumber = normalizeWhatsappNumber(rawNumber);
  const numberHash = await sha256Token(whatsappNumber);
  const link = await c.env.DB.prepare(
    "SELECT id, userId FROM HL_whatsappLinks WHERE whatsappNumberHash = ? LIMIT 1"
  ).bind(numberHash).first<{ id: number; userId: number }>();

  const extension = mediaMimeType.split("/").pop()?.replace(/[^a-z0-9]/gi, "") || "bin";
  const ownerId = link ? String(link.userId) : "unlinked";
  const mediaR2Key = `whatsapp-media/${ownerId}/${providerMessageId}.${extension}`;

  const binary = atob(mediaBufferBase64);
  const buffer = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) buffer[i] = binary.charCodeAt(i);

  // Belt-and-suspenders: actual decoded-bytes check (catch malformed base64 that
  // declared its length but actually encodes less — still bounded).
  if (buffer.byteLength > MAX_MEDIA_BYTES) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Decoded media exceeds 10 MB limit" } }, 400);
  }

  if (c.env.LOGS) {
    try {
      await c.env.LOGS.put(mediaR2Key, buffer, { httpMetadata: { contentType: mediaMimeType } });
    } catch (error) {
      console.error("whatsapp media R2 put failed:", error);
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO HL_whatsappMessages
      (userId, whatsappLinkId, providerMessageId, direction, messageType, contentPreview, mediaR2Key, processedStatus, createdAt)
     VALUES (?, ?, ?, 'inbound', ?, ?, ?, 'received', CURRENT_TIMESTAMP)`
  ).bind(link?.userId ?? null, link?.id ?? null, providerMessageId, detectMessageType(body), mediaMimeType, mediaR2Key).run();

  return c.json({ success: true, mediaR2Key }, 200);
});

// 11.3 Telegram webhook — S6G-T-14
app.post("/api/telegram/webhook", async (c) => {
  const token = c.env.TELEGRAM_BOT_TOKEN ?? "";
  if (!token) {
    return c.json({ success: false, error: { code: "NOT_CONFIGURED", message: "TELEGRAM_BOT_TOKEN not set" } }, 503);
  }
  const provided = c.req.header("X-Telegram-Bot-Api-Secret-Token") ?? c.req.query("secret") ?? "";
  if (!timingSafeStringEqual(provided, token)) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
  }

  if (!c.env.API_SERVICE) {
    return c.json({ success: false, error: { code: "API_SERVICE_UNAVAILABLE" } }, 503);
  }

  try {
    const res = await c.env.API_SERVICE.fetch(new Request("https://api-service.internal/api/webhook/telegram/water", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-HL-Telegram-Water-Secret": token },
      body: JSON.stringify(body),
    }));
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch (error) {
    console.error("telegram webhook forward failed:", error);
    return c.json({ success: false, error: { code: "API_SERVICE_ERROR" } }, 502);
  }
});

// 11.3 Xendit billing webhook — S6G-T-14
app.post("/api/billing/webhook/xendit", async (c) => {
  const secret = c.env.XENDIT_WEBHOOK_SECRET ?? "";
  const provided = c.req.header("X-Callback-Token") ?? "";
  if (!secret || !timingSafeStringEqual(provided, secret)) {
    return c.json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
  }

  if (!c.env.API_SERVICE) {
    return c.json({ success: false, error: { code: "API_SERVICE_UNAVAILABLE" } }, 503);
  }

  try {
    const res = await c.env.API_SERVICE.fetch(new Request("https://api-service.internal/api/billing/webhook/xendit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Callback-Token": provided },
      body: JSON.stringify(body),
    }));
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch (error) {
    console.error("xendit webhook forward failed:", error);
    return c.json({ success: false, error: { code: "API_SERVICE_ERROR" } }, 502);
  }
});

export default app;
