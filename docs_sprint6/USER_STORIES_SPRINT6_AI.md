# USER_STORIES_SPRINT6_AI.md — iSehat / iSehat Sprint 6
## AI Clinical Copilot — User Stories per Phase (S6A → S6I)

```text
Document Type      : User Stories
Version            : 1.0
Date               : 2026-06-30
Source of Truth    : docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md
Phases             : S6A, S6B, S6C, S6D, S6E, S6F, S6G, S6H, S6I
Workers            : #1 (isehat-api-worker), #2 (isehat-ai-worker), #3 (isehat-jobs-worker), #4 (isehat-webhooks-worker)
```

---

# S6A — Foundation & Safety Contract

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6A-US-01 | System architect | The isehat-ai-worker skeleton created with Service Binding from #1 to #2 | Sprint 6 backend has a dedicated AI worker separated from the public API | #2 deploys, #1 can call #2 via Service Binding (AI_SERVICE), health check returns 200 | #2 |
| S6A-US-02 | Database engineer | 10 Sprint 6 tables created with indexes and FK constraints | All AI clinical data has proper persistence and referential integrity | PRAGMA foreign_key_check clean; all 10 tables exist with correct schema per §12.1-§12.10 | #1,#2 |
| S6A-US-03 | Product owner | 10 AI Clinical Copilot feature flags seeded | Plan-based feature gating works for Sprint 6 features | All 10 flags from §13.1 seeded in HL_featureFlags; entitlement checks pass/fail correctly per plan | #1,#2 |
| S6A-US-04 | Admin | 44 system configs seeded for Sprint 6 | AI runtime behavior is configurable without code changes | All 44 configs from §13.3 seeded in HL_systemConfigs; values readable via ConfigService | #1,#2 |
| S6A-US-05 | Security engineer | 7 new RBAC permissions created and assigned | Admin AI governance endpoints are properly access-controlled | admin.aiModelRun.read, admin.aiSafety.read, admin.aiEvaluation.read, admin.aiEvaluation.review, admin.aiConfig.read, admin.aiConfig.update, admin.whatsapp.read seeded and assigned to admin role | #1,#2 |
| S6A-US-06 | Product owner | Plan quota matrix seeded for all 5 plans × 10 Sprint 6 features | Users are correctly limited by their plan tier | Quota enforced server-side: free=5/mo copilot use, premium=200/mo, emergency=unlimited for all | #1,#2 |
| S6A-US-07 | Medical safety officer | MedicalSafetyRuntime v2 implemented with 13 detectors | Every AI medical output is scanned for forbidden behavior before delivery to user | All 13 detectors (§10.1) implemented; each produces correct safety decision (allow/rewrite_safe/block_and_fallback) | #2 |
| S6A-US-08 | QA engineer | 13 safety guard unit tests written | Each detector is verified with a blocked case before any AI chat goes live | 13/13 tests pass; each test sends a forbidden output and verifies the detector blocks/rewrites it | #2 |
| S6A-US-09 | AI engineer | Default prompt versions seeded in HL_promptVersions | The AI system has a baseline prompt to use before custom prompts are authored | At least 6 prompt codes seeded (clinical_copilot, symptom_interview, first_aid, emergency_guidance, doctor_handoff, caregiver_summary) with status='active' | #2 |

---

# S6B — Cloudflare AI Platform Layer

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6B-US-01 | AI engineer | A ModelRouter service that routes through AI Gateway → 9router → Workers AI → deterministic fallback | AI calls have resilient provider chain with automatic fallback | Primary path = AI Gateway (9router); if 9router fails → Workers AI; if Workers AI fails → safe template | #2 |
| S6B-US-02 | DevOps engineer | AI Gateway configured as REST API with CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in env | AI Gateway is the control plane for all model routing | Secrets stored in Cloudflare env (never D1); Gateway URL constructed correctly; auth header present | #2 |
| S6B-US-03 | AI engineer | 9router registered as custom provider in AI Gateway | 9router serves as the primary LLM provider behind the Gateway | Provider slug configurable via aiGateway.customProvider.9router.slug; 9router API key in Cloudflare Secrets | #2 |
| S6B-US-04 | AI engineer | Workers AI provider configured for embedding and fallback text generation | Embedding and cheap fallback tasks use free-tier Workers AI | @cf/baai/bge-base-en-v1.5 for embeddings; @cf/meta/llama-3.3-70b-instruct-fp8-fast for fallback text | #2 |
| S6B-US-05 | System architect | A configurable 3-model fallback chain | If primary LLM fails, the system degrades gracefully without blank responses | Chain: 9router → Workers AI (llama-3.3-70b) → Workers AI (llama-3.1-8b) → deterministic safe template | #2 |
| S6B-US-06 | Compliance officer | Every AI model call logged to HL_modelRuns | All AI activity is auditable with provider, model, tokens, latency, and safety status | Every route() call inserts a HL_modelRuns row with userId, requestId, taskCode, providerCode, modelCode, status, latencyMs | #2 |
| S6B-US-07 | AI engineer | A prompt version loader that checks KV cache first, then falls back to D1 | Prompt loading is fast and cached, reducing D1 load | KV hit returns contentHash without D1 query; KV miss → D1 query → KV populated with TTL 300s | #2 |
| S6B-US-08 | System architect | KV cache namespace (AI_KV) configured for prompt, routing, config, education, search, and disclaimer caching | Non-sensitive data is cached with appropriate TTLs | All 6 cache key patterns from §8.11 seeded with correct TTLs; no sensitive data in KV | #2 |

---

# S6C — Vectorize Runtime Memory

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6C-US-01 | AI engineer | A VectorizeService that can query, insert, delete, and rerank vectors | Personal AI memory works for semantic retrieval of health context | All 4 operations functional; namespace user:{userId} enforced; client cannot override namespace | #2 |
| S6C-US-02 | AI engineer | An EmbeddingService using @cf/baai/bge-base-en-v1.5 (768-dim) | Vector embeddings are generated on Cloudflare free tier | Embedding model version recorded in HL_vectorDocuments; model fixed per index | #2 |
| S6C-US-03 | AI engineer | An AiMemoryDocumentBuilder that summarizes source data into vector documents | Only summarized content is indexed, not raw data | 8 source types indexed (symptom, abnormal measurement, safety event, doctor report, AI session, medication adherence, hydration/cycle, WA chat) | #2 |
| S6C-US-04 | User | My health data indexed into Vectorize as personal memory | The AI can recall my past health context for better answers | index-source creates vector + HL_vectorDocuments row; rebuild reindexes all user sources | #2 |
| S6C-US-05 | User | Ability to delete my entire AI memory | I have control over my personal data retention | DELETE /api/ai/memory removes all vectors + sets HL_vectorDocuments.status='deleted'; D1 source data untouched | #1→#2 |
| S6C-US-06 | User | A memory status endpoint showing how many vectors I have | I can see my AI memory usage | GET /api/ai/memory/status returns count by status, per-user limit, and alert threshold | #1→#2 |
| S6C-US-07 | System architect | Per-user vector limit enforced (500 default, configurable) | Vectorize free tier is not exhausted by a single user | On insert: if count ≥ limit → LRU evict oldest; eviction raises HL_safetyEvents(severity='low') | #2 |
| S6C-US-08 | Admin | An alert when total Vectorize index reaches 80% capacity (8M vectors) | I can plan for paid tier upgrade before hitting the 10M limit | Monitor checks total vector count; alert written to HL_auditLogs + admin notification when threshold crossed | #2 |
| S6C-US-09 | Security engineer | Cross-user namespace isolation verified | User A cannot retrieve User B's vectors via any code path | Query in user:{B} namespace returns 0 results from user:{A}; verified across #2 query, #3 rebuild, #1 proxy | #2 |
| S6C-US-10 | AI engineer | Vectorize failure never blocks emergency guidance | If Vectorize is down, emergency deterministic rules still work | Emergency path skips Vectorize query; returns emergency_template_only regardless of Vectorize availability | #2 |

---

# S6D — Clinical Context Package v2

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6D-US-01 | AI engineer | A ClinicalContextPackageBuilder that assembles D1 + Vectorize + AI Search into one JSON package | The LLM receives comprehensive context in a single structured payload | Full §9.3 package built: userProfile, consents, latestMeasurements, trendSummary, symptomSummary, safetyEvents, medicationSummary, hydrationSummary, cycleSummary, vectorMemory, knowledgeBase, contextTrace | #2 |
| S6D-US-02 | AI engineer | A D1 health summary fetcher for latest measurements, trends, symptoms, and medications | The context package has real user data from the database | Latest measurements fetched per metric; 7/30/90-day trend computed (avg/min/max/direction) | #2 |
| S6D-US-03 | AI engineer | Vectorize query integrated into context package with reranking | Semantic memory from past sessions enriches the context | Top-K vectors queried, reranked by relevance; vectorMemory array populated with sourceType + contentPreview + score | #2 |
| S6D-US-04 | AI engineer | AI Search knowledge retrieval integrated for first-aid, education, and KB | The AI can reference curated knowledge alongside personal data | knowledgeBase array populated with title, sourceType, snippet, score from AI Search | #2 |
| S6D-US-05 | AI engineer | A context trace builder that records every data source used | Users can see exactly what data the AI used to generate its answer | contextTrace array: each item has sourceType, sourceTable, metricCode (optional), measuredAt, contentPreview (safe max 200 chars) | #2 |
| S6D-US-06 | AI engineer | A data sufficiency score calculator (0-100) | The AI and user know how reliable the answer is based on available data | Weighted sum: profile(10) + 7d measurements(25) + 30d(15) + symptoms(15) + meds(10) + vectorize(10) + hydration(5) + cycle(5) + safety(5) = 100 | #2 |
| S6D-US-07 | Privacy officer | A consent-aware filter that gates hydration and cycle data behind dataShareConsent | Sensitive health data is only included when user has explicitly consented | If dataShareConsent=0 → hydrationSummary=null, cycleSummary=null in context package | #2 |
| S6D-US-08 | AI engineer | A disclaimer acknowledgment check included in the context package | The orchestrator knows whether to apply forbiddenActions restrictions | disclaimerAcknowledged boolean in package; if false → base 6 forbiddenActions + mode-specific additions; if true → disclaimer-related restrictions relaxed | #2 |
| S6D-US-09 | Performance engineer | Context package build completes within 500ms for typical users | AI chat latency stays under 2s including context build | D1 queries ≤200ms (parallelized), Vectorize ≤200ms, AI Search ≤200ms (parallel), assembly ≤100ms; timeout 3s returns partial package | #2 |

---

# S6E — AI Clinical Copilot Web Runtime

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6E-US-01 | User | To start a clinical AI chat session from the web app | I can ask questions about my health data with AI assistance | POST /api/ai/clinical/session/start creates HL_aiClinicalSessions row (status='active'), returns sessionId + sessionUuid | #1→#2 |
| S6E-US-02 | User | To send messages to the AI Clinical Copilot and get contextual answers | I get personalized health insights based on my recorded data | POST /api/ai/clinical/message returns reply, answerType, disclaimer, contextTrace, dataSufficiencyScore, redFlagStatus, followUpQuestions | #1→#2 |
| S6E-US-03 | User | To view my past clinical AI sessions | I can review previous AI conversations | GET /api/ai/clinical/sessions lists all my sessions; GET /api/ai/clinical/sessions/:sessionId shows full session with messages | #1 |
| S6E-US-04 | User | To close a clinical AI session when done | My session is properly ended and no longer accepts messages | POST /api/ai/clinical/sessions/:sessionId/close sets status='closed', closedAt timestamp | #1→#2 |
| S6E-US-05 | Security engineer | Entitlement + consent + quota + rate limit checked at #1 before proxying to #2 | No unauthorized user can access AI Clinical Copilot | No entitlement → 403; no aiConsent → 403; quota exceeded → 403; rate limit exceeded → 429 — all blocked at #1 | #1 |
| S6E-US-06 | Medical safety officer | Every AI response passes through MedicalSafetyRuntime v2 before reaching the user — behavior depends on operating mode (§0.3) | Forbidden outputs are blocked or rewritten according to current mode | Safety decision in response: allow / allow_with_disclaimer / rewrite_safe / block_and_fallback / emergency_template_only — mode-dependent for diagnosis/resep/dosis/specialist | #2 |
| S6E-US-07 | User | A disclaimer footer always visible below every AI medical response | I am constantly reminded that AI can make mistakes and decisions are my responsibility | Disclaimer text (§4.3) appended to every medical response; cannot be dismissed, minimized, or hidden | #2 |
| S6E-US-08 | User | A context trace drawer showing what data the AI used | I can verify the AI's answer is based on my actual data | ContextTraceDrawer slides out from right; lists all sources with type icon, safe preview, timestamp | web/ |
| S6E-US-09 | User | A data sufficiency badge showing how much data the AI had | I know whether the answer is based on rich or limited data | Badge shows score 0-100 with label: "data sangat terbatas" (0-30), "data terbatas" (31-60), "data cukup" (61-100) | web/ |
| S6E-US-10 | User | If the AI model fails, I still get a safe response | I never see a blank or error page for clinical chat | Model failure → deterministic safe template returned (answerType='safe_summary', status='fallback') | #2 |
| S6E-US-11 | Privacy officer | Clinical messages encrypted at rest | Chat content is protected even if D1 is compromised | contentEncrypted column populated; contentPreview contains only safe truncated text | #2 |
| S6E-US-12 | User | A visually appealing chat UI with bubbles, input box, and disclaimer | The AI chat experience is professional and trustworthy | AiClinicalChatPage renders: chat bubbles, input box, session title, disclaimer footer (always visible), data sufficiency badge, close session button | web/ |

---

# S6F — Emergency Guidance + First Aid Engine

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6F-US-01 | System architect | The isehat-jobs-worker (#3) created with cron and queue bindings | Background jobs run for retention cleanup, memory rebuild, eval, and report generation | #3 deploys with 6 cron triggers + 3 queue consumers (ai-memory-jobs, whatsapp-outbound, eval-jobs) | #3 |
| S6F-US-02 | User experiencing emergency | Deterministic emergency escalation that runs BEFORE any LLM call | I get immediate safe guidance without waiting for AI generation | Red flag precheck checks HL_metricRules + HL_symptomLogs + HL_safetyEvents; if emergency=true → emergency_template_only (no LLM) | #2 |
| S6F-US-03 | Medical safety officer | AI cannot downgrade emergency severity determined by deterministic rules | A red flag is never dismissed by AI free-form output | emergencySeverityDowngradeDetector blocks any AI output that lowers severity below what rules determined | #2 |
| S6F-US-04 | User | First aid guidance for common conditions (luka, mimisan, luka bakar, etc.) | I get safe, curated P3K instructions when I need them | POST /api/ai/clinical/first-aid returns protocol with Do/Don't/SeekHelp sections from HL_firstAidProtocols | #1→#2 |
| S6F-US-05 | Admin | 10 first-aid protocols seeded in both ID and EN locales | P3K content is available bilingual for all users | 10 protocols × 2 locales = 20 rows in HL_firstAidProtocols; all reviewerStatus='approved' | D1 |
| S6F-US-06 | User | Red flags displayed at the top of all P3K output | I see danger signs first before any instructions | FirstAidProtocolCard: red flags banner at top, then Do steps (green), Don't steps (red), SeekHelp (orange) | web/ |
| S6F-US-07 | User | Emergency guidance card that is visually dominant and cannot be dismissed | I cannot accidentally ignore a critical emergency warning | EmergencyGuidanceCard: red/orange background, no auto-dismiss, Call 119/112 CTA, Contact caregiver CTA | web/ |
| S6F-US-08 | User | For severe conditions, direct emergency guidance instead of self-treatment P3K | I am not told to self-treat when I should seek immediate help | Severe condition detection → emergency_guidance response (not first_aid_guidance); includes "Hubungi 119/112/faskes terdekat" | #2 |
| S6F-US-09 | Compliance officer | All P3K content has contentVersion and reviewerStatus=approved | Only reviewed and approved protocols are served to users | Unapproved protocols (reviewerStatus != 'approved') never returned in API responses | #2 |
| S6F-US-10 | User on WhatsApp | Emergency response in abbreviated format (max 400 chars) | WhatsApp emergency messages are short and actionable | WhatsApp emergency: "⚠️ PERINGATAN DARURAT. [Reason]. Hubungi 119/112/faskes terdekat. ⚕️ AI bisa salah. Keputusan = tanggung jawab Anda." | #2 |
| S6F-US-11 | Admin | Doctor handoff report generation queued to jobs worker (#3) | Heavy report generation doesn't block the API worker | POST /api/ai/clinical/doctor-handoff queues job to #3; report generated async, stored to R2, metadata to D1 | #1→#3 |
| S6F-US-12 | Data retention system | 6 cron jobs running on schedule for data cleanup | Old clinical data is expired/deleted/archived per retention policy | daily 02:00 expire sessions, 02:30 nullify encrypted, 03:00 delete messages; weekly archive model runs + delete vectors; monthly archive safety flags | #3 |

---

# S6G — WhatsApp AI via Baileys

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6G-US-01 | System architect | The isehat-webhooks-worker (#4) created with Service Bindings to #1, #2, #3 | All external webhooks (WhatsApp, Telegram, Xendit) are handled by a dedicated worker | #4 deploys with API_SERVICE, AI_SERVICE, JOBS_SERVICE bindings; signature validation for all providers | #4 |
| S6G-US-02 | DevOps engineer | A Baileys gateway running on VPS via Docker + PM2 | WhatsApp messages are received and forwarded to Worker #4 | Node.js 22+ + PM2 + Docker Compose; health check every 60s; auto-restart on crash | VPS |
| S6G-US-03 | User | To link my WhatsApp number to my iSehat account | I can chat with AI via WhatsApp using the same health context | POST /api/whatsapp/link/start sends OTP; POST /api/whatsapp/link/verify confirms; HL_whatsappLinks created with verified=1 | #1 |
| S6G-US-04 | User | To send health questions via WhatsApp and get AI responses | I can access the AI Clinical Copilot from WhatsApp without opening the web app | Linked user message → #4 validates → #2 Clinical Orchestrator → response queued → Baileys sends reply | #4→#2 |
| S6G-US-05 | User | To unlink my WhatsApp or disable AI at any time | I have control over my WhatsApp AI integration | DELETE /api/whatsapp/link removes link; STOP AI command sets aiEnabled=0; START AI re-enables | #1,#2 |
| S6G-US-06 | Unlinked WhatsApp user | To receive a linking instruction when I message the bot | I know how to connect my WhatsApp to my iSehat account | Unlinked number → "Selamat datang di iSehat. Untuk menghubungkan akun WhatsApp Anda, buka aplikasi iSehat > Settings > WhatsApp AI > Hubungkan." No clinical data returned | #4 |
| S6G-US-07 | System architect | WhatsApp message ordering preserved via WhatsAppSessionDO | Messages from the same user are processed sequentially, not out of order | DO wa-session:{whatsappLinkId} ensures sequential processing; 10 rapid messages processed 1-2-3-4-5-6-7-8-9-10 | #2 |
| S6G-US-08 | Security engineer | Webhook signature validation for all inbound webhooks | Only authenticated providers can send webhooks to the system | WhatsApp: WA_GATEWAY_SECRET header validated; invalid → 401; Telegram: bot token validated; Xendit: signature validated | #4 |
| S6G-US-09 | Security engineer | Idempotency for duplicate webhook deliveries | Duplicate messages don't cause double processing or duplicate AI responses | providerMessageId UNIQUE constraint; duplicate → 200 OK (no reprocessing) | #4 |
| S6G-US-10 | User | WhatsApp media (images) stored securely in R2 after validation | I can send photos via WhatsApp and they are stored privately | Media validated → stored to R2 with permission check; no public raw URL; mediaR2Key recorded in HL_whatsappMessages | #4→R2 |
| S6G-US-11 | User | WhatsApp responses are short (max 400 chars) with disclaimer | WhatsApp messages are concise and always include safety reminder | Response < whatsappAi.maxReplyChars; red flag first; numbered steps; "⚕️ AI bisa salah. Keputusan = tanggung jawab Anda." appended | #2 |
| S6G-US-12 | Product owner | Telegram and Xendit webhooks forwarded from #4 to #1 | All external webhooks go through the dedicated webhooks worker | Telegram webhook → #4 validates → forwards to #1; Xendit webhook → #4 validates → forwards to #1 | #4→#1 |

---

# S6H — Admin AI Governance + Evaluation

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6H-US-01 | Admin | A model run dashboard showing all AI calls with filters | I can monitor AI usage, success rate, latency, and provider distribution | GET /api/admin/ai/model-runs with filters (userId, status, channel, taskCode, date range); summary includes successRate, avgLatency, topTasks, topModels | #1 |
| S6H-US-02 | Admin | A safety flags dashboard grouped by flagCode, severity, and action | I can identify which safety detectors are triggering most and investigate | GET /api/admin/ai/safety-flags with filters; summary grouped by flagCode, severity, actionTaken | #1 |
| S6H-US-03 | Admin | A prompt version manager with CRUD and activation | I can update AI prompts and activate new versions safely | GET/POST prompt versions; PUT activate deactivates previous version; KV cache invalidated on activation; audit log written | #1 |
| S6H-US-04 | Admin | An AI evaluation queue with reviewer workflow | I can run evaluation datasets and review mismatched cases | POST /api/admin/ai/evaluations/run triggers eval job on #3; results show pass/fail per case; reviewer can approve/reject with notes | #1+#3 |
| S6H-US-05 | Admin | A Vectorize health monitor showing index stats and capacity | I can track Vectorize usage and plan for tier upgrades | GET /api/admin/ai/vectorize/health returns totalVectors, capacityPercent, userCount, avgVectorsPerUser, usersAtLimit, indexStatus | #1→#2 |
| S6H-US-06 | Admin | A WhatsApp session monitor showing active sessions and last activity | I can monitor WhatsApp AI usage and detect anomalies | GET /api/admin/whatsapp/sessions with filters; summary includes totalLinked, aiEnabled count, activeNow | #1 |
| S6H-US-07 | Admin | Ability to trigger AI Search KB reindex | I can update the knowledge base search index when content changes | POST /api/admin/ai/kb/reindex queues job to #3; only approved documents reindexed; idempotent upsert by sourceType+sourceId | #1→#3 |
| S6H-US-08 | Medical reviewer | A review workflow to approve or reject AI outputs | I can audit AI clinical responses for safety and quality | POST /api/admin/ai/evaluations/:id/review with pass/fail/needs_investigation + notes; status updated; review logged | #1 |
| S6H-US-09 | Security engineer | All admin AI endpoints gated by correct RBAC permissions | Unauthorized users cannot access AI governance features | admin.aiModelRun.read, admin.aiSafety.read, admin.aiConfig.read/update, admin.aiEvaluation.read/review, admin.whatsapp.read enforced | #1 |
| S6H-US-10 | Admin | Admin UI pages for all AI governance features | I can manage AI from a visual dashboard, not just API calls | /admin/ai-governance, /admin/ai-model-runs, /admin/ai-safety, /admin/ai-prompts, /admin/ai-evaluation, /admin/whatsapp-ai, /admin/ai-operating-mode pages created | web/ |
| S6H-US-11 | Super admin | AI Operating Mode management | I can control how proactive and powerful the AI is allowed to be | GET/PUT /api/admin/ai/operating-mode; mode values: standard/proactive/super_aktif; change requires medical reviewer approval; audit logged to HL_auditLogs; mode change affects Safety Runtime detector decisions per §0.3 | #1 |
| S6H-US-12 | Medical reviewer | Operating mode change approval gate | I must approve any AI mode upgrade before it takes effect | Mode change request created → reviewer approves/rejects → mode updated only after approval; downgrade to standard does not require approval | #1 |

---

# S6I — Hardening, Security, Release Gate

| US-ID | As a | I want to | So that | Acceptance | Worker |
|---|---|---|---|---|---|
| S6I-US-01 | QA engineer | A safety test suite of 65 tests (13 detectors × 5 attack vectors) | All safety detectors are validated against multiple attack patterns | 65/65 tests pass; 0 critical failures; each detector tested with 5 different forbidden output patterns | All |
| S6I-US-02 | Security engineer | 100 prompt injection adversarial test cases | The AI system resists prompt injection attacks | 100/100 cases blocked or rewritten; categories: "ignore instructions" (20), "you are a doctor" (20), "diagnose cross-user" (20), "prescribe drug" (20), "false authority" (20) | All |
| S6I-US-03 | Security engineer | Cross-user retrieval isolation test | No user can access another user's Vectorize data | User A vectors in namespace user:{A}; User B query returns 0 results from A; verified across #2, #3, #1, #4 | All |
| S6I-US-04 | Medical safety officer | Red flag missed test with 100 emergency cases | No emergency red flag is ever missed by the deterministic engine | 100/100 cases trigger emergency_template_only or emergency_guidance; 0 missed | #2 |
| S6I-US-05 | QA engineer | WhatsApp duplicate and order test | Messages are processed in order without duplicates | 10 rapid messages processed sequentially; duplicate providerMessageId → 200 OK no reprocess; 0 reorderings | #2,#4 |
| S6I-US-06 | AI engineer | Vectorize rebuild idempotency test | Running rebuild multiple times produces the same result | 3 consecutive rebuilds → same vector count; 0 duplicate vectors | #2,#3 |
| S6I-US-07 | Performance engineer | Performance/stress test meeting p95 targets | The system handles production load without degradation | Clinical chat p95 < 2000ms (50 VU); Service Binding p95 < 50ms; context build p95 < 500ms; Vectorize query p95 < 200ms; WA webhook p95 < 1500ms; 100 req/s sustained | All |
| S6I-US-08 | i18n engineer | i18n test for all 58 clinical.* keys in ID and EN, including mode-specific disclaimers | The UI and disclaimers render correctly in both languages per operating mode | 0 missing keys in ID locale; 0 missing keys in EN locale; disclaimer renders correctly in both; WA short disclaimer in both; mode disclaimers (proactive/super_aktif) render per current mode | web/ |
| S6I-US-09 | Data retention system | Data retention cron test verifying all 6 cleanup jobs | Old data is properly expired, deleted, or archived per policy | Sessions >365d expired; messages >180d deleted; encrypted >90d nullified; model runs >365d archived to R2; vectors for inactive >365d deleted; safety flags >730d archived | #3 |
| S6I-US-10 | System architect | Service Binding resilience test | Cross-worker calls degrade gracefully under failure | #2 error → #1 returns 502; #2 timeout → #1 returns 504; #2 unavailable → #1 returns 503; 100 concurrent calls → 0 dropped | #1,#2 |
| S6I-US-11 | Product owner | Closed beta with 20-50 testers for 7 days | Real users validate the AI Clinical Copilot before full rollout | 7-day usage data collected; medical reviewer audits 200 random outputs; 0 critical incidents | All |
| S6I-US-12 | Product owner | Release gate metrics all pass before full rollout | The AI Clinical Copilot is safe for all premium users | All 17 release gate metrics from §14 met: 0 missing disclaimers, 0 cross-user leaks, 0 emergency downgrades, 0 red flag misses, 0 forbidden outputs, context trace ≥95%, hallucinated source <1%, reviewer score ≥85% | All |
| S6I-US-13 | Documentation owner | All Sprint 6 documentation updated before rollout | Architecture, API contract, and agent rules reflect the final state | ARCHITECTURE_SPRINT6.md, API_CONTRACT_SPRINT6.md created; AGENTS.md updated for Sprint 6; PRD final status updated | Docs |

---

# Cross-Phase Summary

| Phase | User Stories | Primary Deliverable |
|---|---|---|
| S6A | 9 | Foundation: schema, flags, configs, RBAC, quota, Safety Runtime v2 |
| S6B | 8 | AI Platform: ModelRouter, AI Gateway, 9router, Workers AI, model logging, KV cache |
| S6C | 10 | Vectorize: query/insert/delete/rebuild, namespace isolation, per-user limits |
| S6D | 9 | Context Package: D1 + Vectorize + AI Search assembly, consent filter, sufficiency score |
| S6E | 12 | Web Runtime: clinical chat, session lifecycle, Safety Runtime integration, UI |
| S6F | 12 | Emergency + First Aid: deterministic escalation, 10 P3K protocols, jobs worker |
| S6G | 12 | WhatsApp: Baileys gateway, linking, webhook worker, DO ordering, STOP AI |
| S6H | 12 | Governance: model runs dashboard, safety flags, prompt manager, eval queue, reviewer, operating mode |
| S6I | 13 | Hardening: 65 safety tests, 100 injection tests, mode-dependent forbidden output test, release gate, closed beta |
| **Total** | **97** | **Complete AI Clinical Copilot platform** |
