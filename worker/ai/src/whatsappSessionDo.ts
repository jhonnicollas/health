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

async function enqueueOutbound(
  env: Bindings,
  payload: { whatsappLinkId: number; userId: number; text: string; providerMessageId: string }
): Promise<void> {
  if (!env.WHATSAPP_OUTBOUND_QUEUE) return;
  try {
    await env.WHATSAPP_OUTBOUND_QUEUE.send({ type: "whatsapp-outbound", ...payload });
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
