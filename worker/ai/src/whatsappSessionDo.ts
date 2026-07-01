// WhatsAppSessionDO — serializes inbound WhatsApp AI processing per whatsappLinkId.
// PRD S6G-T-09: id namespace 'wa-session:{whatsappLinkId}', single-threaded ordering.

import type { Bindings } from "./types.js";
import { processClinicalMessage, createClinicalSession } from "./services/clinicalOrchestrator.js";

export interface WhatsAppEventBody {
  whatsappLinkId: number;
  userId: number;
  whatsappNumber: string;
  messageType: string;
  textContent?: string;
  providerMessageId: string;
  locale?: "id" | "en";
}

function commandReply(command: string, locale: "id" | "en"): string {
  const upper = command.toUpperCase();
  if (upper === "STOP" || upper === "STOP AI") {
    return locale === "en"
      ? "iSehat AI disabled. Send START AI to re-enable."
      : "AI iSehat dinonaktifkan. Kirim START AI untuk mengaktifkan kembali.";
  }
  if (upper === "START" || upper === "START AI") {
    return locale === "en"
      ? "iSehat AI is active again."
      : "AI iSehat aktif kembali.";
  }
  return "";
}

async function findActiveSession(env: Bindings, userId: number, whatsappLinkId: number): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT id FROM HL_aiClinicalSessions
     WHERE userId = ? AND channel = 'whatsapp' AND status = 'active'
     ORDER BY startedAt DESC LIMIT 1`
  ).bind(userId).first<{ id: number }>();
  return row?.id ?? null;
}

// PRD §7.1 + §11.1: WhatsApp outbound replies truncated to whatsappAi.maxReplyChars.
// Default 400 chars; falls back to env WHATSAPP_MAX_REPLY_CHARS if D1 config missing.
async function getMaxReplyChars(env: Bindings): Promise<number> {
  try {
    const row = await env.DB.prepare(
      "SELECT configValue FROM HL_systemConfigs WHERE configKey = ? LIMIT 1"
    ).bind("whatsappAi.maxReplyChars").first<{ configValue: string }>();
    const fromDb = Number(row?.configValue);
    if (Number.isFinite(fromDb) && fromDb > 50) return fromDb;
  } catch {
    // Ignore — fall through to env/default.
  }
  const fromEnv = Number(env.WHATSAPP_MAX_REPLY_CHARS);
  if (Number.isFinite(fromEnv) && fromEnv > 50) return fromEnv;
  return 400;
}

// Codepoint-aware truncation: WhatsApp UI breaks on mid-BMP/codepoint slice
// (emoji 🤒🚨, combining marks, surrogate pairs). Iterate by code points to keep rendering intact.
// Sentence-boundary cut drops the boundary character (e.g. ". " or "\n\n") itself to avoid
// double-space artifacts like "X.  ...". trimEnd() finishes cleanup for either branch.
export function truncateForWhatsapp(text: string, maxChars: number): string {
  const codePoints = Array.from(text);
  if (codePoints.length <= maxChars) return text;
  const sliceLen = Math.max(1, maxChars - 4);
  const sliceText = codePoints.slice(0, sliceLen).join("");
  const sentenceFloor = Math.floor(sliceLen * 0.6);
  // Boundary tokens — when we cut at idx, we keep characters 0..idx-1 (the boundary itself
  // is excluded). This avoids double-space artifacts like "X.  ..." since '. ' at idx=N
  // means we keep up to N and start a new sentence with ' ...'.
  const boundaries = [". ", ".\n", "\n\n", "• "];
  let latestCut = -1;
  for (const b of boundaries) {
    const idx = sliceText.lastIndexOf(b);
    if (idx >= 0 && idx >= sentenceFloor) latestCut = Math.max(latestCut, idx);
  }
  if (latestCut > 0) {
    // Re-slice via codePoints so any emoji surrogate pair straddling recents without breaking.
    const keep = codePoints.slice(0, latestCut).join("").trimEnd();
    return `${keep} ...`;
  }
  return `${sliceText.trimEnd()} ...`;
}

async function enqueueOutbound(
  env: Bindings,
  payload: { whatsappLinkId: number; userId: number; text: string; providerMessageId: string }
): Promise<void> {
  if (!env.WHATSAPP_OUTBOUND_QUEUE) return;
  const maxChars = await getMaxReplyChars(env);
  const text = truncateForWhatsapp(payload.text, maxChars);
  try {
    await env.WHATSAPP_OUTBOUND_QUEUE.send({ type: "whatsapp-outbound", ...payload, text });
  } catch (error) {
    console.error("whatsapp outbound enqueue failed:", error);
  }
}

async function updateMessageCompleted(env: Bindings, whatsappLinkId: number, providerMessageId: string): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE HL_whatsappMessages
       SET processedStatus = 'completed'
       WHERE whatsappLinkId = ? AND providerMessageId = ?`
    ).bind(whatsappLinkId, providerMessageId).run();
  } catch (error) {
    console.error("update whatsapp message completed failed:", error);
  }
}

async function updateLinkLastMessage(env: Bindings, whatsappLinkId: number): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE HL_whatsappLinks
       SET lastMessageAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(whatsappLinkId).run();
  } catch (error) {
    console.error("update whatsapp link lastMessageAt failed:", error);
  }
}

export class WhatsAppSessionDO implements DurableObject {
  private processedIds = new Set<string>();

  constructor(private state: DurableObjectState, private env: Bindings) {}

  async fetch(request: Request): Promise<Response> {
    let body: WhatsAppEventBody;
    try {
      body = (await request.json()) as WhatsAppEventBody;
    } catch {
      return new Response(JSON.stringify({ success: false, error: { code: "VALIDATION_ERROR" } }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const { whatsappLinkId, userId, textContent, providerMessageId } = body;
    const locale = body.locale === "en" ? "en" : "id";

    if (!whatsappLinkId || !userId || !providerMessageId) {
      return new Response(JSON.stringify({ success: false, error: { code: "VALIDATION_ERROR" } }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Idempotency: duplicate providerMessageId within this DO session is acknowledged without reprocessing.
    if (this.processedIds.has(providerMessageId)) {
      return new Response(
        JSON.stringify({ success: true, duplicate: true, providerMessageId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    this.processedIds.add(providerMessageId);

    const normalizedText = (textContent ?? "").trim().toUpperCase();
    if (normalizedText === "STOP" || normalizedText === "STOP AI" || normalizedText === "START AI" || normalizedText === "START") {
      const enabled = normalizedText === "START AI" || normalizedText === "START" ? 1 : 0;
      try {
        await this.env.DB.prepare(
          "UPDATE HL_whatsappLinks SET aiEnabled = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?"
        ).bind(enabled, whatsappLinkId, userId).run();
      } catch (error) {
        console.error("whatsapp command link update failed:", error);
      }
      const reply = commandReply(normalizedText, locale);
      await enqueueOutbound(this.env, { whatsappLinkId, userId, text: reply, providerMessageId });
      return new Response(JSON.stringify({ success: true, command: normalizedText, queued: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    let sessionId = await findActiveSession(this.env, userId, whatsappLinkId);
    if (!sessionId) {
      const session = await createClinicalSession(this.env, userId, "whatsapp", "general");
      sessionId = session.sessionId;
    }

    const result = await processClinicalMessage(this.env, {
      userId,
      sessionId,
      message: textContent ?? "",
      channel: "whatsapp",
      locale,
    });

    await updateMessageCompleted(this.env, whatsappLinkId, providerMessageId);
    await updateLinkLastMessage(this.env, whatsappLinkId);
    // PRD §7.1 — truncate to maxReplyChars before enqueueing outbound (handled in enqueueOutbound).
    await enqueueOutbound(this.env, {
      whatsappLinkId,
      userId,
      text: result.reply,
      providerMessageId,
    });

    return new Response(
      JSON.stringify({ success: true, processed: true, sessionId, answerType: result.answerType, redFlagStatus: result.redFlagStatus }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}
