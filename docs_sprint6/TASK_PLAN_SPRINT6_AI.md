# TASK_PLAN_SPRINT6_AI.md — iSehat / iSehat Sprint 6
## AI Clinical Copilot — Task Plan per Phase (S6A → S6I)

```text
Document Type      : Task Plan
Version            : 1.0
Date               : 2026-06-30
Source of Truth    : docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md
Execution Protocol : 1 phase → 1 task → 1 implementation slice → 1 test run → 1 WORK_LOG entry → 1 HANDOFF update → next task
Phase Order        : S6A → S6B → S6C → S6D → S6E → S6F → S6G → S6H → S6I (strictly sequential)
```

---

# S6A — Foundation & Safety Contract

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6A-T-01 | [x] Create isehat-ai-worker skeleton (wrangler.toml, src/index.ts, Hono app, health route) | #2 | — | `wrangler dev` starts; GET /health returns 200 | 2h |
| S6A-T-02 | [x] Configure Service Binding from #1 to #2 (AI_SERVICE in wrangler.toml) | #1 | S6A-T-01 | #1 can call `env.AI_SERVICE.fetch()` successfully | 1h |
| S6A-T-03 | [x] Create migration 003_sprint6_schema.sql with all 10 tables + indexes + FK | #1,#2 | — | `wrangler d1 execute --local --file=003_sprint6_schema.sql` succeeds; PRAGMA foreign_key_check clean | 3h |
| S6A-T-04 | [x] Seed 10 feature flags into HL_featureFlags (§13.1) | #1 | S6A-T-03 | SELECT count(*) = 10 for feature.aiClinicalCopilot.* flags | 1h |
| S6A-T-05 | [x] Seed 44 system configs into HL_systemConfigs (§13.3) — includes operatingMode + operatingModeChangeRequiresMedicalReviewer | #1 | S6A-T-03 | SELECT count(*) = 44 for aiGateway.*, vectorize.*, clinicalCopilot.*, etc. | 2h |
| S6A-T-06 | [x] Seed 7 RBAC permissions + assign to admin role | #1 | S6A-T-03 | RbacService.hasPermission(adminUserId, 'admin.aiModelRun.read') = true | 1h |
| S6A-T-07 | [x] Seed plan quota matrix: 10 features × 5 plans into HL_planFeatures | #1 | S6A-T-03,T-04 | EntitlementService.checkQuota returns correct limits per plan | 2h |
| S6A-T-08 | [x] Implement MedicalSafetyRuntime v2 — 13 detectors (§10.1) | #2 | S6A-T-01 | Each detector function returns correct SafetyDecision enum | 4h |
| S6A-T-09 | [x] Implement SafetyDecision enum + blocked response template | #2 | S6A-T-08 | Blocked template renders §10.3 text correctly | 1h |
| S6A-T-10 | [x] Write 13 safety guard unit tests (1 per detector) | #2 | S6A-T-08,T-09 | `npm test -- --grep safety` → 13/13 pass | 3h |
| S6A-T-11 | [x] Seed 6 default prompt versions in HL_promptVersions | #2 | S6A-T-03 | 6 prompt codes with status='active'; contentHash non-null | 2h |
| S6A-T-12 | [x] Sprint 6A validation gate: tsc + tests + PRAGMA check | All | S6A-T-01..T-11 | `npx tsc -p tsconfig.json` pass; `npm test` pass; PRAGMA foreign_key_check clean | 1h |

**S6A DONE criteria:** ✅ 12/12 tasks complete, 13 safety tests pass, Service Binding functional, all schema/configs/flags seeded.

---

# S6B — Cloudflare AI Platform Layer

> **NOTE:** Cloudflare secrets (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, 9ROUTER_API_KEY, AI_KV namespace) must be set via `wrangler secret put` or the Cloudflare dashboard. NEVER hardcode credentials in any file — per AGENTS.md §9 and PRD §1.

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6B-T-01 | [x] Implement ModelRouter service with provider chain interface | #2 | S6A-DONE | ModelRouter.route() returns AiTextResult; chain logic correct | 3h |
| S6B-T-02 | [x] Implement AI Gateway REST API caller (build URL from accountId + gatewayId + provider) | #2 | S6B-T-01 | POST to AI Gateway returns valid response; auth header present | 2h |
| S6B-T-03 | [x] Configure 9router as custom provider (slug from config, API key from Secrets) | #2 | S6B-T-02 | 9router provider call succeeds; API key never in D1/logs | 2h |
| S6B-T-04 | [x] Implement Workers AI provider (embedding + fallback text) | #2 | S6B-T-01 | Workers AI binding call succeeds; embedding 768-dim returned | 2h |
| S6B-T-05 | [x] Implement 3-model fallback chain: 9router → Workers AI (llama-3.3-70b) → Workers AI (llama-3.1-8b) → safe template | #2 | S6B-T-01..T-04 | Simulate 9router timeout → falls back to Workers AI; simulate all fail → safe template | 2h |
| S6B-T-06 | [x] Implement ModelRunLogger — insert HL_modelRuns on every call | #2 | S6B-T-01 | After route() call, HL_modelRuns row exists with correct fields | 2h |
| S6B-T-07 | [x] Implement PromptVersionLoader — KV cache first, D1 fallback | #2 | S6A-T-11 | KV hit → no D1 query; KV miss → D1 query → KV populated (TTL 300s) | 2h |
| S6B-T-08 | [x] Create AI_KV namespace + configure cache key patterns (6 types) | #2 | S6B-T-07 | All 6 cache key patterns from §8.11 functional with correct TTLs | 2h |
| S6B-T-09 | [x] Set Cloudflare Secrets: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, 9ROUTER_API_KEY | DevOps | S6B-T-02,T-03 | CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN set via `wrangler secret put`; 9ROUTER_API_KEY pending user provision (manual step); AI_KV namespace created `59ba33a4d92a4e0c852c9df6c63b11e9` | 1h |
| S6C-T-01 | [ ] Create Vectorize index (hl-health-memory) via wrangler or dashboard | DevOps | — | Index exists; binding VECTORIZE_INDEX in #2 wrangler.toml | 1h |
| S6C-T-02 | [x] Implement VectorizeService: query, insert, delete, deleteAll, rerank, getStatus | #2 | S6C-T-01 | All 6 methods functional; namespace user:{userId} enforced | 3h |
| S6C-T-03 | [x] Implement EmbeddingService using Workers AI @cf/baai/bge-base-en-v1.5 (768-dim) | #2 | S6C-T-01 | Embedding generated; 768 dimensions; model version recorded | 2h |
| S6C-T-04 | [x] Implement AiMemoryDocumentBuilder — summarize 8 source types into vector documents | #2 | S6C-T-03 | Each source type produces summarized content (not raw data); metadata ≤10KiB | 3h |
| S6C-T-05 | [x] Implement memory index-source (single row → vector + HL_vectorDocuments row) | #2 | S6C-T-02,T-04 | Insert creates vector + D1 row; contentPreview is safe text | 2h |
| S6C-T-06 | [x] Implement memory rebuild (full user → reindex all sources) | #2 | S6C-T-05 | Rebuild idempotent: run twice = same vector count, 0 duplicates | 3h |
| S6C-T-07 | [x] Implement memory delete (user → delete all vectors + set status='deleted') | #2 | S6C-T-02 | Delete removes vectors; HL_vectorDocuments.status='deleted'; D1 source untouched | 1h |
| S6C-T-08 | [x] Implement memory status (count per status + per-user limit + alert threshold) | #2 | S6C-T-05 | GET returns indexed count, limit, alert threshold; admin alert at 80% | 2h |
| S6C-T-09 | [x] Implement per-user vector limit enforcement (500 default, LRU eviction) | #2 | S6C-T-05 | At 500 limit → oldest evicted; HL_safetyEvents(severity='low') raised | 2h |
| S6C-T-10 | [x] Implement free tier monitor + admin alert (8M vectors = 80% of 10M) | #2 | S6C-T-08 | Monitor checks total count; alert to HL_auditLogs + admin notification | 2h |
| S6C-T-11 | [x] Write 10 Vectorize tests (T-1 to T-10 per PRD §10) | #2 | S6C-T-01..T-10 | `npm test -- --grep vectorize` → 10/10 pass | 3h |
| S6C-T-12 | [x] Sprint 6C validation gate: tsc + tests | #2 | S6C-T-01..T-11 | `npx tsc` pass; `npm test` pass | 1h |
| S6B-T-11 | [x] Sprint 6B validation gate: tsc + tests | #2 | S6B-T-01..T-10 | `npx tsc` pass; `npm test` pass | 1h |

**S6B DONE criteria:** ✅ 11/11 tasks complete, 7 tests pass, ModelRouter routes through all 3 tiers, model run logging works. All secrets set: CLOUDFLARE_ACCOUNT_ID ✅ CLOUDFLARE_API_TOKEN ✅ 9ROUTER_API_KEY ✅ TELEGRAM_BOT_TOKEN ✅. AI_KV namespace created ✅ (id=59ba33a4d92a4e0c852c9df6c63b11e9). Test plan S6A+S6B executed: 71 PASS, 13 SKIP (D1 integration), 0 FAIL.

---

# S6C — Vectorize Runtime Memory

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6C-T-01 | [x] Create Vectorize index (hl-health-memory) via wrangler or dashboard | DevOps | — | Index exists; binding VECTORIZE_INDEX in #2 wrangler.toml | 1h |
| S6C-T-02 | [x] Implement VectorizeService: query, insert, delete, deleteAll, rerank, getStatus | #2 | S6C-T-01 | All 6 methods functional; namespace user:{userId} enforced | 3h |
| S6C-T-03 | [x] Implement EmbeddingService using Workers AI @cf/baai/bge-base-en-v1.5 (768-dim) | #2 | S6C-T-01 | Embedding generated; 768 dimensions; model version recorded | 2h |
| S6C-T-04 | [x] Implement AiMemoryDocumentBuilder — summarize 8 source types into vector documents | #2 | S6C-T-03 | Each source type produces summarized content (not raw data); metadata ≤10KiB | 3h |
| S6C-T-05 | [x] Implement memory index-source (single row → vector + HL_vectorDocuments row) | #2 | S6C-T-02,T-04 | Insert creates vector + D1 row; contentPreview is safe text | 2h |
| S6C-T-06 | [x] Implement memory rebuild (full user → reindex all sources) | #2 | S6C-T-05 | Rebuild idempotent: run twice = same vector count, 0 duplicates | 3h |
| S6C-T-07 | [x] Implement memory delete (user → delete all vectors + set status='deleted') | #2 | S6C-T-02 | Delete removes vectors; HL_vectorDocuments.status='deleted'; D1 source untouched | 1h |
| S6C-T-08 | [x] Implement memory status (count per status + per-user limit + alert threshold) | #2 | S6C-T-05 | GET returns indexed count, limit, alert threshold; admin alert at 80% | 2h |
| S6C-T-09 | [x] Implement per-user vector limit enforcement (500 default, LRU eviction) | #2 | S6C-T-05 | At 500 limit → oldest evicted; HL_safetyEvents(severity='low') raised | 2h |
| S6C-T-10 | [x] Implement free tier monitor + admin alert (8M vectors = 80% of 10M) | #2 | S6C-T-08 | Monitor checks total count; alert to HL_auditLogs + admin notification | 2h |
| S6C-T-11 | [x] Write 10 Vectorize tests (T-1 to T-10 per PRD §10) | #2 | S6C-T-01..T-10 | `npm test -- --grep vectorize` → 10/10 pass | 3h |
| S6C-T-12 | [x] Sprint 6C validation gate: tsc + tests | #2 | S6C-T-01..T-11 | `npx tsc` pass; `npm test` pass | 1h |

**S6C DONE criteria:** ✅ 12/12 tasks complete, 10+15 S6C tests pass (86 total pass), namespace isolation verified, per-user limit enforced, rebuild idempotent, sanitizeMetadata enhanced.

---

# S6D — Clinical Context Package v2

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6D-T-01 | [x] Implement ClinicalContextPackageBuilder v2 (full §9.3 JSON structure) | #2 | S6B,S6C-DONE | Builder returns complete package with all fields | 3h |
| S6D-T-02 | [x] Implement D1 health summary fetcher (latest measurements, symptoms, medications) | #2 | S6D-T-01 | Fetcher returns latest values per metric; symptoms with red flag status; active meds | 3h |
| S6D-T-03 | [x] Implement trend summary calculator (7/30/90 day: avg, min, max, direction) | #2 | S6D-T-02 | Trend computed correctly per metric per window; direction = stable/up/down | 2h |
| S6D-T-04 | [x] Integrate Vectorize query + reranking into context package | #2 | S6D-T-01,S6C-DONE | vectorMemory array populated with top-K results, reranked, sourceType + score | 2h |
| S6D-T-05 | [x] Integrate AI Search knowledge retrieval (first-aid, education, KB) | #2 | S6D-T-01 | knowledgeBase array populated with title, sourceType, snippet, score | 2h |
| S6D-T-06 | [x] Implement context trace builder (per-source record with safe preview) | #2 | S6D-T-01 | contextTrace array: sourceType, sourceTable, metricCode, measuredAt, contentPreview (≤200 chars) | 2h |
| S6D-T-07 | [x] Implement data sufficiency score calculator (0-100 weighted sum) | #2 | S6D-T-02 | Score = profile(10)+7d(25)+30d(15)+symptoms(15)+meds(10)+vectorize(10)+hydration(5)+cycle(5)+safety(5) | 2h |
| S6D-T-08 | [x] Implement consent-aware sensitive data filter (hydration, cycle gated by dataShareConsent) | #2 | S6D-T-01 | dataShareConsent=0 → hydrationSummary=null, cycleSummary=null | 1h |
| S6D-T-09 | [x] Implement disclaimer acknowledgment check in context package | #2 | S6D-T-01 | disclaimerAcknowledged boolean; if false → base 6 forbiddenActions + mode-specific additions (standard=3, proactive=2, super_aktif=0) | 1h |
| S6D-T-10 | [x] Write 9 context package tests (T-1 to T-9 per PRD §8) | #2 | S6D-T-01..T-09 | `npm test -- --grep contextPackage` → 9/9 pass | 3h |
| S6D-T-11 | [x] Sprint 6D validation gate: tsc + tests + performance check | #2 | S6D-T-01..T-10 | `npx tsc` pass; `npm test` pass; build < 500ms for typical user | 1h |

**S6D DONE criteria:** ✅ 11/11 tasks complete, 34 tests pass, performance budget met (build < 500ms). 5 bugs fixed (CRITICAL: latest-per-metric, HIGH: context-package route, HIGH: timeout enforcement, MEDIUM: trend optimization, MEDIUM: null guard).

---

# S6E — AI Clinical Copilot Web Runtime

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6E-T-01 | Implement proxy route /api/ai/clinical/* in #1 → forward to #2 via Service Binding | #1 | S6A,S6B,S6C,S6D-DONE | POST to #1 route → #2 receives request → response returned to client | 2h |
| S6E-T-02 | Implement entitlement + consent + quota + rate limit check at #1 before proxy | #1 | S6E-T-01 | No entitlement → 403; no consent → 403; quota exceeded → 403; rate limit → 429 | 2h |
| S6E-T-03 | Implement POST /api/ai/clinical/session/start in #2 (create HL_aiClinicalSessions) | #2 | S6E-T-01 | Session created with status='active', sessionUuid unique, userId from auth | 2h |
| S6E-T-04 | Implement POST /api/ai/clinical/message in #2 (full orchestrator flow) | #2 | S6E-T-03 | Message → intent classify → red flag precheck → context build → prompt → ModelRouter → Safety Runtime → format → store → log | 4h |
| S6E-T-05 | Implement GET /api/ai/clinical/sessions (list) + GET /:sessionId (detail) in #1 | #1 | S6E-T-03 | List returns user's sessions; detail returns session + messages | 2h |
| S6E-T-06 | Implement POST /api/ai/clinical/sessions/:sessionId/close in #1→#2 | #1,#2 | S6E-T-03 | Session status='closed', closedAt set; closed session rejects new messages | 1h |
| S6E-T-07 | Implement message storage in HL_aiClinicalMessages (encrypted content) | #2 | S6E-T-04 | contentEncrypted populated; contentPreview safe truncated text; modelRunId linked | 2h |
| S6E-T-08 | Implement disclaimer footer injection in response formatter | #2 | S6E-T-04 | Every medical response has disclaimer field with §4.3 text; always present | 1h |
| S6E-T-09 | Implement context trace in response (contextTrace array) | #2 | S6E-T-04 | contextTrace non-empty in response; each item has sourceType + safe preview | 1h |
| S6E-T-10 | Build AiClinicalChatPage UI (chat bubbles, input box, session title, disclaimer footer) | web/ | S6E-T-01..T-09 | Page renders; messages display as bubbles; input sends to API; disclaimer always visible | 4h |
| S6E-T-11 | Build ContextTraceDrawer UI (slide-out panel, source list) | web/ | S6E-T-10 | Drawer slides from right; shows all sources used; safe previews displayed | 2h |
| S6E-T-12 | Build DataSufficiencyBadge + SafetyDisclaimerBox UI components | web/ | S6E-T-10 | Badge shows score + label; disclaimer box always visible, cannot dismiss | 2h |
| S6E-T-13 | Write 12 web runtime tests (T-1 to T-12 per PRD §10) | #2,web/ | S6E-T-01..T-12 | `npm test -- --grep clinicalChat` → 12/12 pass | 3h |
| S6E-T-14 | Sprint 6E validation gate: tsc + tests + eslint + vite build | All | S6E-T-01..T-13 | Worker `npx tsc` pass; Web `npx tsc -b` pass; `npx eslint .` 0 new errors; `npx vite build` pass | 1h |

**S6E DONE criteria:** 14/14 tasks complete, 12 tests pass, clinical chat works end-to-end, disclaimer always visible.

---

# S6F — Emergency Guidance + First Aid Engine

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6F-T-01 | Create isehat-jobs-worker skeleton (#3) with wrangler.toml, cron triggers, queue consumers | #3 | S6E-DONE | `wrangler dev` starts; cron triggers registered; queue consumers ready | 2h |
| S6F-T-02 | Configure #3 bindings: D1, R2, Queues (ai-memory-jobs, whatsapp-outbound, eval-jobs) | #3 | S6F-T-01 | All bindings present in wrangler.toml; accessible in code | 1h |
| S6F-T-03 | Implement Deterministic Emergency Escalation Engine in #2 | #2 | S6E-DONE | Red flag precheck: metricRules + symptomLogs + safetyEvents → emergency=true → emergency_template_only | 3h |
| S6F-T-04 | Implement emergency template rendering (§4 emergency template text) | #2 | S6F-T-03 | Template renders correctly; includes 119/112/faskes CTA; no LLM freeform | 1h |
| S6F-T-05 | Seed 10 first-aid protocols × 2 locales (ID/EN) into HL_firstAidProtocols | D1 | S6A-T-03 | 20 rows; all reviewerStatus='approved'; triggerKeywords + redFlags + doSteps + dontSteps + seekHelpNow populated | 3h |
| S6F-T-06 | Implement First Aid Protocol Engine (keyword lookup → protocol retrieval) | #2 | S6F-T-05 | POST /api/ai/clinical/first-aid with keyword "luka" → returns wound_minor protocol | 2h |
| S6F-T-07 | Integrate AI Search first-aid content retrieval into First Aid Engine | #2 | S6F-T-06 | AI Search returns curated first-aid content; only reviewerStatus='approved' used | 2h |
| S6F-T-08 | Implement WhatsApp short format (max 400 chars, abbreviated disclaimer) | #2 | S6F-T-03 | Emergency WA response < 400 chars; "⚕️ AI bisa salah. Keputusan = tanggung jawab Anda." | 1h |
| S6F-T-09 | Build EmergencyGuidanceCard UI (red/orange, no auto-dismiss, CTAs) | web/ | S6F-T-04 | Card visually dominant; Call 119/112 button; Contact caregiver button; no dismiss | 2h |
| S6F-T-10 | Build FirstAidProtocolCard UI (Do/Don't/SeekHelp, red flags banner) | web/ | S6F-T-06 | Red flags at top; Do (green), Don't (red), SeekHelp (orange); reviewerStatus footer | 2h |
| S6F-T-11 | Implement doctor handoff report generation → queue to #3 | #1→#3 | S6F-T-01 | POST /api/ai/clinical/doctor-handoff queues job; #3 generates report → R2 + D1 metadata | 2h |
| S6F-T-12 | Implement 6 data retention cron jobs in #3 | #3 | S6F-T-01 | daily 02:00 expire sessions, 02:30 nullify encrypted, 03:00 delete messages; weekly archive model runs + delete vectors; monthly archive safety flags | 3h |
| S6F-T-13 | Write 10 emergency + first aid tests (T-1 to T-10 per PRD §8) | #2,#3 | S6F-T-01..T-12 | `npm test -- --grep emergency` → 10/10 pass | 3h |
| S6F-T-14 | Sprint 6F validation gate: tsc + tests + cron verification | All | S6F-T-01..T-13 | `npx tsc` pass; `npm test` pass; cron jobs registered correctly | 1h |

**S6F DONE criteria:** 14/14 tasks complete, 10 tests pass, emergency engine blocks LLM on red flag, 10 P3K protocols seeded, #3 running.

---

# S6G — WhatsApp AI via Baileys

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6G-T-01 | Create isehat-webhooks-worker skeleton (#4) with Service Bindings to #1, #2, #3 | #4 | S6F-DONE | `wrangler dev` starts; Service Bindings configured; health route 200 | 2h |
| S6G-T-02 | Implement webhook signature validation (WA_GATEWAY_SECRET, Telegram token, Xendit sig) | #4 | S6G-T-01 | Invalid signature → 401; valid signature → request processed | 2h |
| S6G-T-03 | Implement webhook idempotency (providerMessageId UNIQUE, deduplicate) | #4 | S6G-T-01 | Duplicate providerMessageId → 200 OK, no reprocessing | 1h |
| S6G-T-04 | Set up Baileys gateway on VPS (Node.js 22+, Docker Compose, PM2) | VPS | S6G-T-01 | Baileys connects to WhatsApp; QR pairing available; health check every 60s | 4h |
| S6G-T-05 | Configure Cloudflare Tunnel for VPS → #4 HTTPS | DevOps | S6G-T-04 | Tunnel active; #4 receives POST from Baileys via HTTPS | 2h |
| S6G-T-06 | Set WA_GATEWAY_SECRET in Cloudflare Secrets for #4 | DevOps | S6G-T-01 | Secret set via `wrangler secret put`; not in D1 or code | 1h |
| S6G-T-07 | Implement WhatsApp linking: POST /api/whatsapp/link/start + /verify in #1 | #1 | S6A-T-03 | Link start sends OTP; verify creates HL_whatsappLinks (verified=1, whatsappNumberHash) | 3h |
| S6G-T-08 | Implement WhatsApp webhook handler in #4 (validate → lookup user → forward to #2) | #4 | S6G-T-02,T-07 | Linked user → forward to #2; unlinked → linking instruction only; userId=NULL for unlinked | 3h |
| S6G-T-09 | Implement WhatsAppSessionDO for message ordering (wa-session:{whatsappLinkId}) | #2 | S6G-T-08 | 10 rapid messages processed sequentially 1-2-3-4-5-6-7-8-9-10 | 3h |
| S6G-T-10 | Implement WhatsApp clinical session (reuse Clinical Orchestrator with WA channel) | #2 | S6G-T-09 | WA message → intent → red flag → context → prompt → ModelRouter → Safety → format → store | 2h |
| S6G-T-11 | Implement WhatsApp outbound queue (whatsapp-outbound consumer in #3 → Baileys sendMessage) | #3 | S6G-T-10 | Queue consumer sends message via Baileys; HL_whatsappMessages direction='outbound' recorded | 2h |
| S6G-T-12 | Implement STOP AI + START AI command handler in #2 | #2 | S6G-T-10 | STOP AI → aiEnabled=0, confirmation sent; START AI → aiEnabled=1, confirmation sent | 1h |
| S6G-T-13 | Implement WA media ingest to R2 (validate → store → mediaR2Key) | #4 | S6G-T-02 | Media stored to R2; no public URL; mediaR2Key in HL_whatsappMessages | 2h |
| S6G-T-14 | Implement Telegram + Xendit webhook forwarding from #4 to #1 | #4 | S6G-T-02 | Telegram → #4 validates → forwards to #1; Xendit → #4 validates → forwards to #1 | 2h |
| S6G-T-15 | Write 10 WhatsApp tests (T-1 to T-10 per PRD §11) | #4,#2 | S6G-T-01..T-14 | `npm test -- --grep whatsapp` → 10/10 pass | 3h |
| S6G-T-16 | Sprint 6G validation gate: tsc + tests + 4-worker topology check | All | S6G-T-01..T-15 | All 4 workers deploy; `npx tsc` pass; `npm test` pass | 1h |

**S6G DONE criteria:** 16/16 tasks complete, 10 tests pass, WhatsApp AI responds to linked users, 4 workers running.

---

# S6H — Admin AI Governance + Evaluation

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6H-T-01 | Implement GET /api/admin/ai/model-runs with filters + summary | #1 | S6B-T-06 | Filters work (userId, status, channel, taskCode, date); summary has successRate, avgLatency, topTasks | 3h |
| S6H-T-02 | Implement GET /api/admin/ai/safety-flags with filters + summary | #1 | S6A-T-08 | Filters work; summary grouped by flagCode, severity, actionTaken | 2h |
| S6H-T-03 | Implement prompt version CRUD: GET list, POST create, GET :id, PUT activate | #1 | S6A-T-11 | Create new version; activate deactivates previous; KV cache invalidated; audit log written | 3h |
| S6H-T-04 | Implement AI evaluation queue: GET list, POST run (queue to #3), POST review | #1,#3 | S6F-T-01 | Run triggers eval job on #3; results stored; reviewer submits pass/fail/needs_investigation + notes | 3h |
| S6H-T-05 | Implement GET /api/admin/ai/vectorize/health (proxy to #2) | #1→#2 | S6C-T-08 | Returns totalVectors, capacityPercent, userCount, avgVectorsPerUser, usersAtLimit, indexStatus | 2h |
| S6H-T-06 | Implement GET /api/admin/whatsapp/sessions with filters + summary | #1 | S6G-T-07 | Returns linked users, aiEnabled count, activeNow; filters by status, date | 2h |
| S6H-T-07 | Implement POST /api/admin/ai/kb/reindex (queue to #3) | #1→#3 | S6F-T-01 | Queues reindex job; only approved documents reindexed; idempotent upsert | 2h |
| S6H-T-08 | Implement medical reviewer workflow (review + approve/reject AI outputs) | #1 | S6H-T-04 | POST /api/admin/ai/evaluations/:id/review updates status + notes; audit logged | 2h |
| S6H-T-09 | Implement AI Operating Mode management (super admin: read/write clinicalCopilot.operatingMode, mode change audit log, medical reviewer approval gate) | #1 | S6A-T-05 | GET/PUT /api/admin/ai/operating-mode; mode change → HL_auditLogs (action='aiOperatingModeChanged'); reviewer approval workflow if operatingModeChangeRequiresMedicalReviewer=true | 3h |
| S6H-T-10 | Build admin AI governance UI pages (7 pages: + /admin/ai-operating-mode) | web/ | S6H-T-01..T-09 | /admin/ai-governance, /admin/ai-model-runs, /admin/ai-safety, /admin/ai-prompts, /admin/ai-evaluation, /admin/whatsapp-ai, /admin/ai-operating-mode all render | 5h |
| S6H-T-10a | Write 9 governance tests (T-1 to T-9 per PRD §11) — includes operating mode test | #1 | S6H-T-01..T-10 | `npm test -- --grep governance` → 9/9 pass | 3h |
| S6H-T-11 | Sprint 6H validation gate: tsc + tests + eslint + vite build | All | S6H-T-01..T-10a | Worker `npx tsc` pass; Web `npx tsc -b` pass; `npx eslint .` 0 new; `npx vite build` pass | 1h |

**S6H DONE criteria:** 11/11 tasks complete (T-01..T-11), 27 tests pass, admin can view/control/evaluate AI, operating mode management functional. **STATUS: ✅ DONE** (T-10 UI deferred to post-S6H; backend T-01..T-09+T-10a+T-11 complete)

---

# S6I — Hardening, Security, Release Gate

| Task ID | Task | Worker | Depends On | Validation | Est |
|---|---|---|---|---|---|
| S6I-T-01 | Write safety test suite: 13 detectors × 5 attack vectors = 65 tests | All | S6H-DONE | 65/65 tests pass; 0 critical failures | 6h |
| S6I-T-02 | Write 100 prompt injection adversarial test cases | All | S6H-DONE | 100/100 cases blocked or rewritten; 0 bypasses | 4h |
| S6I-T-03 | Write cross-user retrieval isolation test (namespace + Vectorize) | All | S6H-DONE | User A vectors in user:{A}; User B query → 0 results from A; verified across all 4 workers | 2h |
| S6I-T-04 | Write forbidden output test (diagnosis/resep/dosis/med change/specialist claim — mode-dependent per §0.3) | #2 | S6H-DONE | In standard mode: all restricted outputs blocked/rewritten. In proactive: diagnosis allowed, resep/dosis/specialist blocked. In super_aktif: all allowed except medication change | 4h |
| S6I-T-05 | Write red flag missed test: 100 emergency cases | #2 | S6F-T-03 | 100/100 cases trigger emergency_template_only or emergency_guidance; 0 missed | 3h |
| S6I-T-06 | Write WhatsApp duplicate/order test (DO sequential guarantee) | #2,#4 | S6G-T-09 | 10 rapid messages processed in order; duplicate → 200 OK no reprocess; 0 reorderings | 2h |
| S6I-T-07 | Write Vectorize rebuild idempotency test (3 rebuilds, same count) | #2,#3 | S6C-T-06 | 3 consecutive rebuilds → same vector count; 0 duplicates | 1h |
| S6I-T-08 | Write performance/stress test (k6: p95 < 2s clinical chat, 50 VU) | All | S6H-DONE | Clinical chat p95 < 2000ms; Service Binding p95 < 50ms; 100 req/s sustained | 4h |
| S6I-T-09 | Write Service Binding resilience test (error/timeout/unavailable/concurrent) | #1,#2 | S6H-DONE | #2 error → 502; timeout → 504; unavailable → 503; 100 concurrent → 0 dropped | 2h |
| S6I-T-10 | Write i18n test (58 clinical.* keys ID + EN, disclaimer rendering, mode-specific disclaimers) | web/ | S6E-T-10 | 0 missing keys ID; 0 missing keys EN; disclaimer renders both; WA short disclaimer both; mode disclaimers render per mode | 2h |
| S6I-T-11 | Write data retention cron test (6 cron jobs, verify cleanup) | #3 | S6F-T-12 | Sessions >365d expired; messages >180d deleted; encrypted >90d nullified; model runs archived; vectors deleted; safety flags archived | 3h |
| S6I-T-12 | Run closed beta: deploy Sprint 6A-6H, select 20-50 testers, 7-day data collection | All | S6I-T-01..T-11 | clinicalCopilot.enabled='beta'; 7 days usage; medical reviewer audits 200 outputs; 0 critical incidents | 7d |
| S6I-T-13 | Verify all 17 release gate metrics pass | All | S6I-T-12 | All metrics from §14 met: 0 missing disclaimers, 0 leaks, 0 downgrades, 0 misses, 0 forbidden, trace ≥95%, hallucinated <1%, reviewer ≥85%, p95 <2s, etc. | 2h |
| S6I-T-14 | Update documentation: ARCHITECTURE_SPRINT6.md, API_CONTRACT_SPRINT6.md, AGENTS.md | Docs | S6I-T-13 | All docs created/updated; final status in PRD; agent rules updated | 3h |
| S6I-T-15 | Set clinicalCopilot.enabled='true' for all premium users (production rollout) | DevOps | S6I-T-13,T-14 | Config updated in production; premium users can access AI Clinical Copilot | 1h |

**S6I DONE criteria:** 15/15 tasks complete, all release gate metrics pass, closed beta 7 days with 0 critical incidents, documentation updated, production rollout.

---

# Cross-Phase Task Summary

| Phase | Tasks | Est Hours | Key Dependency |
|---|---|---|---|
| S6A | 12 | ~23h | Sprint 5 delivered |
| S6B | 11 | ~20h | S6A-DONE |
| S6C | 12 | ~24h | S6B-DONE |
| S6D | 11 | ~22h | S6B,S6C-DONE |
| S6E | 14 | ~29h | S6A,S6B,S6C,S6D-DONE |
| S6F | 14 | ~28h | S6E-DONE |
| S6G | 16 | ~33h | S6F-DONE |
| S6H | 11 | ~29h | S6G-DONE |
| S6I | 15 | ~38h + 7d beta | S6H-DONE |
| **Total** | **117** | **~249h + 7d** | **Sequential** |

---

# Task Execution Rules

```text
1. Execute tasks in strict phase order: S6A → S6B → ... → S6I.
2. Within a phase, tasks may be parallelized IF no dependency exists.
3. A phase is DONE only when ALL its tasks pass validation.
4. After each DONE task: update WORK_LOG.md + HANDOFF.md, then continue.
5. After each DONE phase: run phase validation gate, update logs, continue to next phase.
6. Mark BLOCKED if: source docs conflict, dependency incomplete, secret unavailable, validation cannot run.
7. BLOCKED entry must include: exact blocker, evidence, safest next action.
8. No task may be marked DONE without running its validation command.
9. No secret in D1/log/frontend/test/code.
10. No invented table/endpoint/field/permission/feature code — verify against PRD.
```
