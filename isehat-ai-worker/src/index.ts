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

type Bindings = {
  DB: D1Database;
  LOGS: R2Bucket;
  VECTORIZE_INDEX: VectorizeIndex;
  AI_SEARCH: AiSearch;
  AI_KV: KVNamespace;
  AI_CHAT_SESSION_DO: DurableObjectNamespace;
  WHATSAPP_SESSION_DO: DurableObjectNamespace;
  USER_AI_LOCK_DO: DurableObjectNamespace;
  MODEL_STREAMING_DO: DurableObjectNamespace;
  JOB_PROGRESS_DO: DurableObjectNamespace;
  AI: Ai;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_GATEWAY_ID?: string;
  AI_GATEWAY_ENABLED?: string;
  VECTORIZE_MAX_VECTORS_PER_USER?: string;
  VECTORIZE_ALERT_THRESHOLD_PERCENT?: string;
  CLINICAL_COPILOT_ENABLED?: string;
  MEDICAL_SAFETY_RUNTIME_ENABLED?: string;
  MEDICAL_SAFETY_RUNTIME_STRICT_MODE?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health — live now
app.get("/health", (c) =>
  c.json({
    success: true,
    data: {
      worker: "isehat-ai-worker",
      status: "ok",
      clinicalCopilotEnabled: c.env.CLINICAL_COPILOT_ENABLED === "true",
      safetyRuntimeEnabled: c.env.MEDICAL_SAFETY_RUNTIME_ENABLED === "true",
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

// 11.1 Clinical Copilot routes (PRD §11.1) — stubbed for S6E implementation.
app.post("/api/ai/clinical/session/start", (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  if (c.env.CLINICAL_COPILOT_ENABLED !== "true") {
    return c.json({ success: false, error: { code: "CLINICAL_COPILOT_DEFERRED" } }, 503);
  }
  return c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6E-T-03" } }, 501);
});

app.post("/api/ai/clinical/message", (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  return c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6E-T-04" } }, 501);
});

app.post("/api/ai/clinical/sessions/:id/close", (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  return c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6E-T-06" } }, 501);
});

app.post("/api/ai/clinical/follow-up", (c) => {
  const auth = requireAuth(c);
  if (!auth.ok) return c.json({ success: false, error: { code: auth.code } }, auth.status);
  return c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6E-??" } }, 501);
});

app.post("/api/ai/clinical/doctor-handoff", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6F-T-11" } }, 501)
);

app.post("/api/ai/clinical/first-aid", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6F-T-06" } }, 501)
);

app.post("/api/ai/clinical/emergency-guidance", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Land in S6F-T-03" } }, 501)
);

app.post("/api/ai/clinical/safety-check", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED", message: "Internal-only; land in S6H" } }, 501)
);

// 11.2 AI Memory routes — stubs (S6C-T-02..T-08 real impls).
app.post("/api/ai/memory/index-source", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED" } }, 501)
);
app.post("/api/ai/memory/rebuild", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED" } }, 501)
);
app.delete("/api/ai/memory", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED" } }, 501)
);
app.get("/api/ai/memory/status", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED" } }, 501)
);
app.post("/api/ai/context/query", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED" } }, 501)
);
app.get("/api/ai/context-package", (c) =>
  c.json({ success: false, error: { code: "NOT_IMPLEMENTED" } }, 501)
);

export default app;
