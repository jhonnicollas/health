// isehat-ai-worker — Sprint 6 Worker #2
// AI Clinical Copilot orchestrator (PRD §6.2 Worker #2 scope).
// This file is the S6A-T-01 skeleton; business logic lands in subsequent phases:
//   S6A: MedicalSafetyRuntime v2 (13 detectors) + prompt version loader
//   S6B: ModelRouter (AI Gateway -> 9router -> Workers AI fallback chain)
//   S6C: VectorizeService (query / insert / delete / rebuild)
//   S6D: ClinicalContextPackageBuilder v2 (D1 + Vectorize + AI Search)
//   S6E: /api/ai/clinical/* routes (session start / message / session detail / close)
//   S6F: Emergency Engine + First Aid Engine
//   S6G: WhatsAppSessionDO + STOP/START handlers
//
// Health / GET endpoints below are live. POST endpoints are placeholder 501 responses
// to mark which routes MUST be wired up before the release gate.

import { Hono } from "hono";
import type { Bindings } from "./types.js";
import { WhatsAppSessionDO } from "./whatsappSessionDo.js";
import {
  VectorizeService,
  indexSource,
  rebuildMemory,
  deleteMemory,
  fetchAllSources,
  checkFreeTierStatus,
  processClinicalMessage,
  createClinicalSession,
  closeClinicalSession,
  getSessionDetail,
  listSessions,
  buildContextPackage,
  getSufficiencyLabel,
  lookupFirstAidProtocol,
  renderFirstAidProtocol,
  renderFirstAidFallback,
  encryptContent,
  renderEmergencyTemplate,
  logEmergencyEvent,
  generateFollowUpQuestions,
  getOperatingMode,
  getConfigBoolean,
  routeModel,
} from "./services/index.js";
import { runSafetyRuntime } from "./safety/safetyRuntime.js";
import { SafetyDecision } from "./safety/safetyDecision.js";
import type { DetectorInput } from "./safety/detectors.js";

const app = new Hono<{ Bindings: Bindings }>();

// Health — live now
app.get("/health", (c) =>
  c.json({
    success: true,
    data: {
      worker: "isehat-ai-worker",
      status: "ok",
    },
    meta: { checkedAt: new Date().toISOString() },
  })
);

// Authorization: every Clinical AI route requires authenticated user.
// Sprint 6 sessions are presented via shared HL_session cookie OR direct
// userId query param validated against Service Binding call from #1.
function requireAuth(c: any): { ok: true; userId: number } | { ok: false; status: 401 | 403; code: string } {
  // Sprint 5-compatible session decode is performed by Worker #1 before Service
  // Binding forward. This Worker trusts caller-supplied userId header
  // `X-Internal-UserId` once #1 has already validated the HL_session cookie.
  const raw = c.req.header("X-Internal-UserId");
  if (!raw) return { ok: false, status: 401, code: "UNAUTHORIZED" };
  const userId = Number.parseInt(raw, 10);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, status: 401, code: "UNAUTHORIZED" };
  }
  return { ok: true, userId };
}

// 11.1 Clinical Copilot routes (PRD §11.1) — S6E implementation.
// PRD S6E §3: Proxy flow — #1 forwards to #2 via Service Binding.
// These routes are called by #1 with X-Internal-UserId header.

// Text generation fallback for API Worker (internal use only)
app.post("/api/ai/text-generate", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);

  try {
    const body = await c.req.json() as { messages?: Array<{ role: string; content: string }>; maxTokens?: number; temperature?: number };
    if (!body.messages?.length) return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "messages required" } }, 400);

    const messages = body.messages.map(m => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content }));
    const maxTokens = body.maxTokens ?? 2048;
    const temperature = body.temperature ?? 0.3;

    const result = await routeModel(c.env, {
      taskCode: 'text_generate',
      messages,
      userId: auth.userId,
      channel: 'internal',
      maxTokens,
      temperature,
    });

    return c.json({
      success: true,
      data: { text: result.text, model: result.model },
    });
  } catch (error) {
    console.error("text-generate error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate text" } }, 500);
  }
});

// S6E-T-03: Start session
app.post("/api/ai/clinical/session/start", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  if (c.env.CLINICAL_COPILOT_ENABLED !== "true") {
    return c.json({ success: false, error: { code: "CLINICAL_COPILOT_DEFERRED" } }, 503);
  }

  try {
    const body = await c.req.json().catch(() => ({})) as { sessionType?: string; channel?: string };
    const channel = (body.channel === "whatsapp" ? "whatsapp" : "web") as "web" | "whatsapp";
    const sessionType = body.sessionType ?? "general";

    const { sessionId, sessionUuid } = await createClinicalSession(c.env, userId, channel, sessionType);

    return c.json({
      success: true,
      data: { sessionId, sessionUuid, channel, sessionType, status: "active" },
    });
  } catch (error) {
    console.error("session/start error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create session" } }, 500);
  }
});

// S6E-T-04: Send message — full orchestrator flow
app.post("/api/ai/clinical/message", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  if (c.env.CLINICAL_COPILOT_ENABLED !== "true") {
    return c.json({ success: false, error: { code: "CLINICAL_COPILOT_DEFERRED" } }, 503);
  }

  try {
    const body = await c.req.json() as { sessionId?: number; message?: string; locale?: string };
    if (!body.sessionId || !body.message) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "sessionId and message are required" } }, 400);
    }
    if (body.message.length > 5000) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Message too long (max 5000 chars)" } }, 400);
    }

    // Verify session belongs to user and is active
    const session = await c.env.DB.prepare(
      "SELECT id, status FROM HL_aiClinicalSessions WHERE id = ? AND userId = ?"
    ).bind(body.sessionId, userId).first<{ id: number; status: string }>();

    if (!session) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
    }
    if (session.status !== "active") {
      return c.json({ success: false, error: { code: "SESSION_CLOSED", message: "Session is not active" } }, 400);
    }

    const locale = (body.locale === "en" ? "en" : "id") as "id" | "en";

    const result = await processClinicalMessage(c.env, {
      userId,
      sessionId: body.sessionId,
      message: body.message,
      channel: "web",
      locale,
    });

    return c.json({
      success: true,
      data: {
        messageId: result.messageId,
        reply: result.reply,
        answerType: result.answerType,
        disclaimer: result.disclaimer,
        contextTrace: result.contextTrace,
        dataSufficiencyScore: result.dataSufficiencyScore,
        dataSufficiencyLabel: result.dataSufficiencyLabel,
        redFlagStatus: result.redFlagStatus,
        followUpQuestions: result.followUpQuestions,
        forbiddenActions: result.forbiddenActions ?? [],
        modelName: result.modelName,
        usedFallback: result.usedFallback,
        safetyDecision: result.safetyDecision,
      },
      meta: { requestId: `req_${Date.now()}`, durationMs: result.durationMs },
    });
  } catch (error) {
    console.error("clinical/message error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to process message" } }, 500);
  }
});

// S6E-T-05: List sessions
app.get("/api/ai/clinical/sessions", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
    const sessions = await listSessions(c.env, userId, limit);
    return c.json({ success: true, data: sessions });
  } catch (error) {
    console.error("sessions list error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list sessions" } }, 500);
  }
});

// S6E-T-05: Get session detail
app.get("/api/ai/clinical/sessions/:id", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const sessionId = Number(c.req.param("id"));
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid session ID" } }, 400);
    }

    const detail = await getSessionDetail(c.env, userId, sessionId);
    if (!detail.session) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
    }

    return c.json({ success: true, data: detail });
  } catch (error) {
    console.error("session detail error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get session" } }, 500);
  }
});

// S6E-T-06: Close session
app.post("/api/ai/clinical/sessions/:id/close", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const sessionId = Number(c.req.param("id"));
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid session ID" } }, 400);
    }

    const closed = await closeClinicalSession(c.env, userId, sessionId);
    if (!closed) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Session not found or already closed" } }, 404);
    }

    return c.json({ success: true, data: { sessionId, status: "closed" } });
  } catch (error) {
    console.error("session close error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to close session" } }, 500);
  }
});

// S6E-T-09/S6H follow-up: Generate follow-up questions
app.post("/api/ai/clinical/follow-up", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const body = await c.req.json() as { sessionId?: number; message?: string; locale?: string };
    if (!body.sessionId || !body.message) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "sessionId and message are required" } }, 400);
    }

    const session = await c.env.DB.prepare(
      "SELECT id, status FROM HL_aiClinicalSessions WHERE id = ? AND userId = ?"
    ).bind(body.sessionId, userId).first<{ id: number; status: string }>();

    if (!session) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
    }
    if (session.status !== "active") {
      return c.json({ success: false, error: { code: "SESSION_CLOSED", message: "Session is not active" } }, 400);
    }

    const locale = (body.locale === "en" ? "en" : "id") as "id" | "en";
    const contextPackage = await buildContextPackage(c.env, userId, {
      queryText: body.message,
      disclaimerAcknowledged: false,
      timeoutMs: 3000,
    });

    const questions = generateFollowUpQuestions(contextPackage, 'symptom_interview');
    const disclaimer = locale === 'en'
      ? 'AI CAN MAKE MISTAKES.\nDO NOT RELY ON AI 100%.\nDO NOT TRUST AI 100%.\nALL DECISIONS YOU MAKE BASED ON THIS AI OUTPUT ARE 1000% YOUR OWN RESPONSIBILITY.'
      : 'AI DAPAT MELAKUKAN KESALAHAN.\nTIDAK BOLEH MENGANDALKAN AI 100%.\nTIDAK BOLEH PERCAYA AI 100%.\nSEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';

    return c.json({
      success: true,
      data: {
        questions,
        dataSufficiencyScore: contextPackage.dataSufficiencyScore,
        dataSufficiencyLabel: getSufficiencyLabel(contextPackage.dataSufficiencyScore),
        disclaimer,
        contextTrace: contextPackage.contextTrace,
        redFlagStatus: contextPackage.redFlagPrecheck.severity,
      },
    });
  } catch (error) {
    console.error("clinical/follow-up error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate follow-up" } }, 500);
  }
});

// S6F-T-06/T-07: First Aid Protocol Engine
app.post("/api/ai/clinical/first-aid", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const body = await c.req.json() as { keyword?: string; locale?: string; sessionId?: number };
    const locale = (body.locale === "en" ? "en" : "id") as "id" | "en";
    const keyword = (body.keyword ?? "").trim();

    // Build context package to detect emergency red flags
    const contextPackage = await buildContextPackage(c.env, userId, {
      queryText: keyword,
      disclaimerAcknowledged: false,
      timeoutMs: 3000,
    });

    if (contextPackage.redFlagPrecheck.severity === 'emergency') {
      const emergencyBody = renderEmergencyTemplate(locale);
      const operatingMode = contextPackage.operatingMode;
      const modeAddition = locale === 'en'
        ? (operatingMode === 'proactive' ? '\n\nProactive Mode: AI may give a final diagnosis, but CANNOT prescribe medication or dosage.' : operatingMode === 'super_aktif' ? '\n\nSuper Active Mode: AI may prescribe medication and dosage. Still consult with a doctor.' : '')
        : (operatingMode === 'proactive' ? '\n\nMode Proaktif: AI boleh memberi diagnosis final, tetapi TIDAK boleh memberi resep atau dosis.' : operatingMode === 'super_aktif' ? '\n\nMode Super Aktif: AI boleh memberi resep dan dosis. Tetap konsultasikan dengan dokter.' : '');
      const disclaimerBase = locale === 'en'
        ? 'AI CAN MAKE MISTAKES.\nDO NOT RELY ON AI 100%.\nDO NOT TRUST AI 100%.\nALL DECISIONS YOU MAKE BASED ON THIS AI OUTPUT ARE 1000% YOUR OWN RESPONSIBILITY.'
        : 'AI DAPAT MELAKUKAN KESALAHAN.\nTIDAK BOLEH MENGANDALKAN AI 100%.\nTIDAK BOLEH PERCAYA AI 100%.\nSEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';
      const disclaimer = disclaimerBase + modeAddition;
      const fullReply = `${emergencyBody}\n\n${disclaimer}`;

      if (body.sessionId) {
        await logEmergencyEvent(c.env, userId, body.sessionId, undefined);
      }

      return c.json({
        success: true,
        data: {
          answerType: 'emergency_guidance',
          reply: fullReply,
          contextTrace: contextPackage.contextTrace,
          redFlagStatus: 'emergency',
          protocolCode: null,
        },
      });
    }

    if (!keyword) {
      return c.json({
        success: true,
        data: {
          answerType: 'first_aid_guidance',
          reply: renderFirstAidFallback(locale),
          redFlagStatus: contextPackage.redFlagPrecheck.severity,
          protocolCode: null,
        },
      });
    }

    const protocol = await lookupFirstAidProtocol(c.env, keyword, locale);
    if (!protocol) {
      return c.json({
        success: true,
        data: {
          answerType: 'first_aid_guidance',
          reply: renderFirstAidFallback(locale),
          redFlagStatus: contextPackage.redFlagPrecheck.severity,
          protocolCode: null,
        },
      });
    }

    const rendered = renderFirstAidProtocol(protocol, locale);

    // Store assistant response as a message if sessionId provided
    if (body.sessionId) {
      try {
        await c.env.DB.prepare(
          `INSERT INTO HL_aiClinicalMessages
            (userId, sessionId, role, channel, contentPreview, contentEncrypted,
             answerType, safetyLevel, contextTraceJson, createdAt)
           VALUES (?, ?, 'assistant', 'web', ?, ?, 'first_aid_guidance', 'safe', ?, CURRENT_TIMESTAMP)`
        ).bind(
          userId,
          body.sessionId,
          rendered.slice(0, 200),
          await encryptContent(c.env, rendered, userId),
          JSON.stringify(contextPackage.contextTrace)
        ).run();
      } catch (error) {
        console.error("first-aid message storage failed:", error);
      }
    }

    return c.json({
      success: true,
      data: {
        answerType: 'first_aid_guidance',
        reply: rendered,
        redFlagStatus: contextPackage.redFlagPrecheck.severity,
        protocolCode: protocol.protocolCode,
        protocolTitle: protocol.title,
      },
    });
  } catch (error) {
    console.error("clinical/first-aid error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get first-aid guidance" } }, 500);
  }
});

// S6F-T-11: Doctor Handoff Report
app.post("/api/ai/clinical/doctor-handoff", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const body = await c.req.json() as { sessionId?: number; locale?: string; reason?: string };
    if (!body.sessionId) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "sessionId is required" } }, 400);
    }

    const locale = (body.locale === "en" ? "en" : "id") as "id" | "en";
    const startTime = Date.now();

    const session = await c.env.DB.prepare(
      "SELECT id, sessionUuid, channel FROM HL_aiClinicalSessions WHERE id = ? AND userId = ?"
    ).bind(body.sessionId, userId).first<{ id: number; sessionUuid: string; channel: string }>();

    if (!session) {
      return c.json({ success: false, error: { code: "NOT_FOUND", message: "Session not found" } }, 404);
    }

    const contextPackage = await buildContextPackage(c.env, userId, {
      queryText: body.reason ?? 'doctor handoff report',
      disclaimerAcknowledged: false,
      timeoutMs: 5000,
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const r2Key = `doctor-handoff/${userId}/${session.id}/${timestamp}.txt`;

    const report = generateDoctorHandoffReport(contextPackage, session, body.reason ?? '', locale);

    // Store report content to R2 if LOGS bucket is available
    try {
      await c.env.LOGS.put(r2Key, report, { httpMetadata: { contentType: "text/plain; charset=utf-8" } });
    } catch (error) {
      console.error("doctor-handoff R2 put failed:", error);
    }

    // Persist metadata to HL_modelRuns
    const modelRunResult = await c.env.DB.prepare(
      `INSERT INTO HL_modelRuns
        (userId, actorType, requestId, sessionId, channel, taskCode, providerCode, modelCode,
         status, fallbackUsed, latencyMs, operatingMode, createdAt)
       VALUES (?, 'user', ?, ?, ?, 'doctor_handoff', 'deterministic', 'doctor-handoff-template',
               'success', 1, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      `req_handoff_${startTime}`,
      session.id,
      session.channel ?? 'web',
      Date.now() - startTime,
      contextPackage.operatingMode
    ).run();

    const meta = modelRunResult.meta as Record<string, unknown> | undefined;
    const modelRunId = Number(meta?.last_row_id ?? meta?.lastRowId ?? 0) || undefined;

    // Write audit log
    try {
      await c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, 'doctorHandoffGenerated', 'HL_modelRuns', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        userId,
        modelRunId ? String(modelRunId) : null,
        JSON.stringify({ sessionId: session.id, r2Key, userId })
      ).run();
    } catch (error) {
      console.error("doctor-handoff audit log failed:", error);
    }

    // Enqueue job for Worker #3
    if (c.env.AI_MEMORY_QUEUE) {
      try {
        await c.env.AI_MEMORY_QUEUE.send({
          type: 'doctorHandoff',
          userId,
          sessionId: session.id,
          modelRunId,
          r2Key,
          locale,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("doctor-handoff queue send failed:", error);
      }
    }

    return c.json({
      success: true,
      data: {
        modelRunId,
        r2Key,
        reportPreview: report.slice(0, 500),
      },
    });
  } catch (error) {
    console.error("clinical/doctor-handoff error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to generate doctor handoff" } }, 500);
  }
});

// S6F-T-03/T-04: Deterministic Emergency Guidance
app.post("/api/ai/clinical/emergency-guidance", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const body = await c.req.json() as { sessionId?: number; locale?: string };
    const locale = (body.locale === "en" ? "en" : "id") as "id" | "en";
    const operatingMode = await getOperatingMode(c.env);
    const contextPackage = await buildContextPackage(c.env, userId, {
      queryText: 'emergency guidance',
      disclaimerAcknowledged: false,
      timeoutMs: 3000,
    });

    const emergencyBody = renderEmergencyTemplate(locale);
    const disclaimerBase = locale === 'en'
      ? 'AI CAN MAKE MISTAKES.\nDO NOT RELY ON AI 100%.\nDO NOT TRUST AI 100%.\nALL DECISIONS YOU MAKE BASED ON THIS AI OUTPUT ARE 1000% YOUR OWN RESPONSIBILITY.'
      : 'AI DAPAT MELAKUKAN KESALAHAN.\nTIDAK BOLEH MENGANDALKAN AI 100%.\nTIDAK BOLEH PERCAYA AI 100%.\nSEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.';

    const modeAddition = locale === 'en'
      ? (operatingMode === 'proactive' ? '\n\nProactive Mode: AI may give a final diagnosis, but CANNOT prescribe medication or dosage.' : operatingMode === 'super_aktif' ? '\n\nSuper Active Mode: AI may prescribe medication and dosage. Still consult with a doctor.' : '')
      : (operatingMode === 'proactive' ? '\n\nMode Proaktif: AI boleh memberi diagnosis final, tetapi TIDAK boleh memberi resep atau dosis.' : operatingMode === 'super_aktif' ? '\n\nMode Super Aktif: AI boleh memberi resep dan dosis. Tetap konsultasikan dengan dokter.' : '');

    const disclaimer = disclaimerBase + modeAddition;
    const fullReply = `${emergencyBody}\n\n${disclaimer}`;

    if (body.sessionId) {
      await logEmergencyEvent(c.env, userId, body.sessionId, undefined);
    }

    return c.json({
      success: true,
      data: {
        answerType: 'emergency_guidance',
        reply: fullReply,
        disclaimer,
        contextTrace: contextPackage.contextTrace,
        redFlagStatus: contextPackage.redFlagPrecheck.severity,
        dataSufficiencyScore: contextPackage.dataSufficiencyScore,
        dataSufficiencyLabel: getSufficiencyLabel(contextPackage.dataSufficiencyScore),
        safetyDecision: 'emergency_template_only',
      },
    });
  } catch (error) {
    console.error("clinical/emergency-guidance error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get emergency guidance" } }, 500);
  }
});

// S6H: Safety Check — run Safety Runtime on provided text (internal/admin)
app.post("/api/ai/clinical/safety-check", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const body = await c.req.json() as {
      text?: string;
      locale?: string;
      operatingMode?: string;
      redFlagPresent?: boolean;
    };

    if (!body.text) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "text is required" } }, 400);
    }

    const locale = (body.locale === "en" ? "en" : "id") as "id" | "en";
    const mode = (body.operatingMode === 'proactive' || body.operatingMode === 'super_aktif') ? body.operatingMode : 'standard';
    const safetyEnabled = await getConfigBoolean(c.env, 'medicalSafetyRuntime.enabled', true);

    if (!safetyEnabled) {
      return c.json({
        success: true,
        data: { decision: 'allow', output: body.text, flags: [] },
      });
    }

    const safetyInput: DetectorInput = {
      aiOutput: body.text,
      locale,
      redFlagPresent: body.redFlagPresent ?? false,
      operatingMode: mode as 'standard' | 'proactive' | 'super_aktif',
    };

    const safetyResult = runSafetyRuntime(safetyInput);

    return c.json({
      success: true,
      data: {
        decision: safetyResult.finalDecision,
        output: safetyResult.output,
        flags: safetyResult.flags,
      },
    });
  } catch (error) {
    console.error("clinical/safety-check error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to run safety check" } }, 500);
  }
});

// 11.2 AI Memory routes — S6C implementation.
// PRD S6C §5: VectorizeService query/insert/delete/deleteAll/getStatus
// Namespace is ALWAYS user:{userId} — derived from auth, never from client.

app.post("/api/ai/memory/index-source", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const body = await c.req.json() as { sourceType?: string; sourceId?: string; content?: string; metadata?: Record<string, unknown> };
    if (!body.sourceType || !body.sourceId || !body.content) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "sourceType, sourceId, content are required" } }, 400);
    }

    const vectorId = await indexSource(c.env, {
      userId,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      content: body.content,
      metadata: body.metadata ?? {},
    });

    return c.json({ success: true, data: { vectorId, namespace: `user:${userId}` } });
  } catch (error) {
    console.error("memory/index-source error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to index source" } }, 500);
  }
});

app.post("/api/ai/memory/rebuild", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    // Check aiConsent + dataShareConsent
    const consent = await c.env.DB.prepare(
      "SELECT aiConsent, dataShareConsent FROM HL_userProfiles WHERE userId = ?"
    ).bind(userId).first<{ aiConsent: number; dataShareConsent: number }>();

    if (!consent || consent.aiConsent !== 1) {
      return c.json({ success: false, error: { code: "CONSENT_REQUIRED", message: "AI consent required for memory operations" } }, 403);
    }

    const includeConsentGated = consent.dataShareConsent === 1;

    // Fetch all source data
    const sources = await fetchAllSources(c.env, userId, includeConsentGated);

    // Rebuild (idempotent)
    const result = await rebuildMemory(c.env, userId, sources);

    return c.json({
      success: true,
      data: {
        jobId: result.jobId,
        totalProcessed: result.totalProcessed,
        totalIndexed: result.totalIndexed,
        totalFailed: result.totalFailed,
        durationMs: result.durationMs,
        namespace: `user:${userId}`,
      },
    });
  } catch (error) {
    console.error("memory/rebuild error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to rebuild memory" } }, 500);
  }
});

app.delete("/api/ai/memory", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const result = await deleteMemory(c.env, userId);
    return c.json({
      success: true,
      data: {
        jobId: result.jobId,
        vectorsDeleted: result.vectorsDeleted,
        durationMs: result.durationMs,
        namespace: `user:${userId}`,
      },
    });
  } catch (error) {
    console.error("memory/delete error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete memory" } }, 500);
  }
});

app.get("/api/ai/memory/status", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const service = new VectorizeService(c.env);
    const status = await service.getStatus(userId);
    return c.json({ success: true, data: status });
  } catch (error) {
    console.error("memory/status error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get memory status" } }, 500);
  }
});

app.post("/api/ai/context/query", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  try {
    const body = await c.req.json() as { query?: string; topK?: number; minScore?: number };
    if (!body.query) {
      return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "query is required" } }, 400);
    }

    const topK = Math.min(Math.max(body.topK ?? 8, 1), 20);
    const minScore = body.minScore ?? 0;

    const service = new VectorizeService(c.env);
    const results = await service.query(userId, body.query, topK, minScore);

    return c.json({
      success: true,
      data: {
        namespace: `user:${userId}`,
        topK,
        minScore,
        matches: results,
        count: results.length,
      },
    });
  } catch (error) {
    console.error("context/query error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to query context" } }, 500);
  }
});

  app.get("/api/ai/context-package", async (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
    const userId = auth.userId;

    try {
      const queryText = c.req.query("query") ?? "";
      const disclaimerAcknowledged = c.req.query("disclaimerAcknowledged") === "true";
      const pkg = await buildContextPackage(c.env, userId, {
        queryText,
        disclaimerAcknowledged,
        timeoutMs: 3000,
      });
      return c.json({ success: true, data: pkg });
    } catch (error) {
      console.error("context-package error:", error);
      return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get context package" } }, 500);
    }
  });

// Admin: free tier monitor (S6C-T-10)
// RBAC check: requires admin.aiModelRun.read permission (defense-in-depth even behind Service Binding)
app.get("/api/ai/admin/vectorize/health", async (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  const userId = auth.userId;

  // RBAC check — verify admin permission
  try {
    const permRow = await c.env.DB.prepare(
      `SELECT 1 FROM HL_rolePermissions rp
       JOIN HL_userRoles ur ON ur.roleCode = rp.roleCode
       WHERE ur.userId = ? AND rp.permissionCode = 'admin.aiModelRun.read'
       LIMIT 1`
    ).bind(userId).first();
    if (!permRow) {
      return c.json({ success: false, error: { code: "FORBIDDEN", message: "Admin permission required" } }, 403);
    }
  } catch {
    return c.json({ success: false, error: { code: "FORBIDDEN", message: "Permission check failed" } }, 403);
  }

  try {
    const status = await checkFreeTierStatus(c.env);
    return c.json({ success: true, data: status });
  } catch (error) {
    console.error("vectorize/health error:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get vectorize health" } }, 500);
  }
});

// S6G-T-10: WhatsApp clinical event — forward to WhatsAppSessionDO for ordering.
app.post("/api/ai/clinical/whatsapp/event", async (c) => {
  const internalUserId = c.req.header("X-Internal-UserId");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid JSON body" } }, 400);
  }

  const whatsappLinkId = Number(body.whatsappLinkId);
  const userId = Number(internalUserId ?? body.userId);
  if (!Number.isFinite(whatsappLinkId) || whatsappLinkId <= 0 || !Number.isFinite(userId) || userId <= 0) {
    return c.json({ success: false, error: { code: "VALIDATION_ERROR", message: "whatsappLinkId and userId are required" } }, 400);
  }

  if (!c.env.WHATSAPP_SESSION_DO) {
    return c.json({ success: false, error: { code: "NOT_CONFIGURED", message: "WHATSAPP_SESSION_DO binding missing" } }, 503);
  }

  const id = c.env.WHATSAPP_SESSION_DO.idFromName(`wa-session:${whatsappLinkId}`);
  const stub = c.env.WHATSAPP_SESSION_DO.get(id);
  try {
    const res = await stub.fetch(new Request("https://ai-service.internal/whatsapp-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, userId }),
    }));
    return new Response(res.body, { status: res.status, headers: res.headers });
  } catch (error) {
    console.error("whatsapp event DO fetch failed:", error);
    return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Failed to process WhatsApp event" } }, 500);
  }
});

// Durable Object implementations — PRD §8.12 FR-12
// AiChatSessionDO, UserAiLockDO, ModelStreamingDO, JobProgressDO
// WhatsAppSessionDO is imported from ./whatsappSessionDo.js

export class AiChatSessionDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'append') {
      const messages = body.messages as Array<Record<string, unknown>> | undefined;
      if (messages) {
        const existing = (await this.storage.get<Array<Record<string, unknown>>>('messages')) || [];
        existing.push(...messages);
        await this.storage.put('messages', existing);
        // Reset idle alarm — 30 min after last activity
        await this.state.storage.setAlarm(Date.now() + 30 * 60 * 1000);
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'flush') {
      const messages = (await this.storage.get<Array<Record<string, unknown>>>('messages')) || [];
      await this.storage.delete('messages');
      await this.state.storage.setAlarm(Date.now() + 30 * 60 * 1000);
      return new Response(JSON.stringify({ success: true, count: messages.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Read stored messages
    const stored = (await this.storage.get<Array<Record<string, unknown>>>('messages')) || [];
    return new Response(JSON.stringify({ success: true, count: stored.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async alarm(): Promise<void> {
    // Persist pending messages to D1 and clear buffer
    // (D1 persist happens in ClinicalOrchestrator after each message)
    await this.storage.delete('messages');
  }
}
export { WhatsAppSessionDO };

export class UserAiLockDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'acquire') {
      const locked = await this.storage.get<boolean>('locked');
      if (locked) {
        return new Response(JSON.stringify({ success: false, reason: 'ALREADY_LOCKED' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
      }
      await this.storage.put('locked', true);
      await this.storage.put('lockedAt', Date.now());
      // Auto-release alarm after 5 min
      await this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000);
      return new Response(JSON.stringify({ success: true, action: 'acquired' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'release') {
      await this.storage.delete('locked');
      await this.storage.delete('lockedAt');
      return new Response(JSON.stringify({ success: true, action: 'released' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const locked = await this.storage.get<boolean>('locked');
    return new Response(JSON.stringify({ success: true, locked: !!locked }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async alarm(): Promise<void> {
    // Auto-release lock on alarm (safety release for abandoned locks)
    await this.storage.delete('locked');
    await this.storage.delete('lockedAt');
  }
}

export class ModelStreamingDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'append') {
      const chunk = String(body.chunk || '');
      const existing = (await this.storage.get<string>('buffer')) || '';
      await this.storage.put('buffer', existing + chunk);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (action === 'flush') {
      const buffer = (await this.storage.get<string>('buffer')) || '';
      await this.storage.delete('buffer');
      return new Response(JSON.stringify({ success: true, text: buffer }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const buffer = (await this.storage.get<string>('buffer')) || '';
    return new Response(JSON.stringify({ success: true, length: buffer.length }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async alarm(): Promise<void> {
    await this.storage.delete('buffer');
  }
}

export class JobProgressDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;

  constructor(state: DurableObjectState, env: Bindings) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'progress') {
      const processed = Number(body.processed ?? 0);
      const total = Number(body.total ?? 0);
      await this.storage.put('processed', processed);
      await this.storage.put('total', total);
      await this.storage.put('updatedAt', Date.now());
      // Alarm-based expiry: 1 hour
      await this.state.storage.setAlarm(Date.now() + 60 * 60 * 1000);
      return new Response(JSON.stringify({ success: true, processed, total }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const processed = (await this.storage.get<number>('processed')) || 0;
    const total = (await this.storage.get<number>('total')) || 0;
    const updatedAt = (await this.storage.get<number>('updatedAt')) || 0;
    return new Response(JSON.stringify({ success: true, processed, total, updatedAt }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  async alarm(): Promise<void> {
    await this.storage.deleteAll();
  }
}

function generateDoctorHandoffReport(
  context: Awaited<ReturnType<typeof buildContextPackage>>,
  session: { id: number; sessionUuid: string; channel: string },
  reason: string,
  locale: 'id' | 'en'
): string {
  const sufficiencyLabel = getSufficiencyLabel(context.dataSufficiencyScore);
  const idHeader = `RINGKASAN UNTUK DOKTER
ID Sesi: ${session.sessionUuid}
Kanal: ${session.channel}
Alasan: ${reason || '-'}
Mode: ${context.operatingMode}
Skor Data: ${context.dataSufficiencyScore}/100 (${sufficiencyLabel})

`;
  const enHeader = `DOCTOR HANDOFF SUMMARY
Session ID: ${session.sessionUuid}
Channel: ${session.channel}
Reason: ${reason || '-'}
Mode: ${context.operatingMode}
Data Score: ${context.dataSufficiencyScore}/100 (${sufficiencyLabel})

`;

  let body = locale === 'en' ? enHeader : idHeader;

  if (context.redFlagPrecheck.hasRedFlag) {
    body += locale === 'en'
      ? `RED FLAG PRE-CHECK: ${context.redFlagPrecheck.severity} (${context.redFlagPrecheck.source})\n\n`
      : `PRECHECK TANDA BAHAYA: ${context.redFlagPrecheck.severity} (${context.redFlagPrecheck.source})\n\n`;
  }

  body += locale === 'en' ? 'LATEST MEASUREMENTS\n' : 'PENGUKURAN TERBARU\n';
  if (context.latestMeasurements.length === 0) {
    body += locale === 'en' ? 'No recent measurements.\n' : 'Tidak ada pengukuran terbaru.\n';
  } else {
    for (const m of context.latestMeasurements) {
      body += `- ${m.metricCode}: ${m.finalValue}${m.unit} (${m.status}) at ${m.measuredAt}\n`;
    }
  }
  body += '\n';

  body += locale === 'en' ? 'RECENT SYMPTOMS\n' : 'KELUHAN TERBARU\n';
  if (context.symptomSummary.recentSymptoms.length === 0) {
    body += locale === 'en' ? 'No recent symptoms.\n' : 'Tidak ada keluhan terbaru.\n';
  } else {
    for (const s of context.symptomSummary.recentSymptoms.slice(0, 5)) {
      body += `- ${String(s.bodyArea || '-')}, pain=${String(s.painScale || '-')}/10${s.isRedFlag ? ' [RED FLAG]' : ''}\n`;
    }
  }
  body += '\n';

  body += locale === 'en' ? 'MEDICATIONS\n' : 'OBAT\n';
  if (context.medicationSummary.activeMedications.length === 0) {
    body += locale === 'en' ? 'No active medications.\n' : 'Tidak ada obat aktif.\n';
  } else {
    body += `${context.medicationSummary.activeMedications.join(', ')} (adherence 7d: ${context.medicationSummary.adherence7Day}%)\n`;
  }
  body += '\n';

  body += locale === 'en'
    ? `\nDISCLAIMER: This report is generated by AI as an information aid. It is not a diagnosis. The clinician must verify all data and make independent decisions.`
    : `\nDISCLAIMER: Laporan ini dibuat oleh AI sebagai bantu informasi. Bukan diagnosis. Dokter harus memverifikasi semua data dan membuat keputusan mandiri.`;

  return body;
}

export default app;
