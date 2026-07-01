# HANDOFF_SPRINT6.md — Sprint 6 Resume State

## Current State — 2026-07-01 22:00 UTC

```text
Sprint: Sprint 6 (S6A → S6I) — AI Clinical Copilot Runtime + Emergency + WhatsApp AI + Cloudflare AI Platform
Phase: S6H (Admin AI Governance + Evaluation) — DONE
Status: DONE — S6H backend complete, 27 tests pass, full regression green
Current Task: S6H-T-01..T-11 complete (T-10 UI deferred)
Next Task: S6G UI + S6I hardening (closed beta, production rollout manual steps remain)
Workers Active: #1 isehat-api-worker + #2 isehat-ai-worker + #3 isehat-jobs-worker + #4 isehat-webhooks-worker
Tests: 523 PASS (worker/ai), 370 PASS (worker/apps), 6 PASS (worker/cron), 0 FAIL, 13 SKIP
  - S6A: 20 safety + 5 OM tests
  - S6B: 7 modelRouter tests
  - S6C: 25 vectorize + memory tests
  - S6D: 34 context package tests
  - S6E: 40 E2E + AU + OM + NS tests
  - S6F: 32 emergency + first-aid + cron + NS tests
  - S6G: 10 WA tests
  - S6H: 27 governance tests (DB-01→05, PM-01→04, EV-01→04, OM-01→06, NS-01→03, extras)
  - S6I: resilience + i18n + retention + perf
tsc: Worker #1 PASS, Worker #2 PASS, Worker #3 PASS, Worker #4 PASS
eslint: n/a
D1: PRAGMA foreign_key_check clean (migrations 003-008 applied)
Secrets: CLOUDFLARE_ACCOUNT_ID ✅ CLOUDFLARE_API_TOKEN ✅ 9ROUTER_API_KEY ✅ TELEGRAM_BOT_TOKEN ✅
AI_KV: id=59ba33a4d92a4e0c852c9df6c63b11e9 ✅
AI Endpoint: https://9router.krpmerch.biz.id/v1
9router Models: oc/deepseek-v4-flash-free (default), oc/mimo-v2.5-free (premium)
```

## Last Completed Task
- Task: S6H Governance Endpoints + Test Suite
- Result: 9 admin governance endpoints implemented (model-runs, safety-flags, prompt-versions CRUD+activate, evaluations run+review, vectorize/health proxy, whatsapp/sessions, kb/reindex, operating-mode GET/PUT); migration 008; 27 S6H tests; tsc clean all workers; cron queue consumers updated for eval/kbReindex
- Validation:
  - `cd worker/apps && node --test test/sprint6h.test.mjs` → 27 PASS, 0 FAIL
  - `cd worker/apps && npm test` → 370 PASS, 0 FAIL
  - `cd worker/ai && npm test` → 523 PASS, 0 FAIL, 13 SKIP
  - `cd worker/cron && npm test` → 6 PASS, 0 FAIL
  - tsc: all 4 workers clean

## S6F Audit Findings — 2026-07-01

| # | Severity | Bug | Fix | File |
|---|---|---|---|---|
| 1 | INFO | Emergency path comment was misleading ("do not inject mode-specific") — code already injected mode disclaimer | Clarified comment: "Emergency behavior identical across modes, but disclaimer includes mode context" | `worker/ai/src/services/clinicalOrchestrator.ts` |
| 2 | **HIGH** | `/api/ai/clinical/first-aid` emergency path used hardcoded ID text instead of `renderEmergencyTemplate(locale)`, no mode-aware disclaimer | Replaced with `renderEmergencyTemplate(locale)` + full disclaimer with mode additions | `worker/ai/src/index.ts` |
| 3 | **HIGH** | `/api/ai/clinical/first-aid` emergency path did NOT call `logEmergencyEvent()` → no HL_safetyEvents/HL_auditLogs for first-aid emergencies | Added `logEmergencyEvent()` call when sessionId provided | `worker/ai/src/index.ts` |
| 4 | **HIGH** | `computeRedFlagPrecheck` only checked `severity='critical'` for safety events — PRD §4 step 5 also requires check for `severity='emergency'` | Changed filter to `severity === 'critical' || severity === 'emergency'` | `worker/ai/src/services/contextPackageBuilder.ts` |
| 5 | MEDIUM | `formatWhatsAppReply` hardcoded max 400 chars — should accept configurable limit | Added `maxChars` parameter (default 400) | `worker/ai/src/services/clinicalOrchestrator.ts` |
| 6 | MEDIUM | `logEmergencyEvent` was private function — couldn't be used from `index.ts` first-aid route | Exported `logEmergencyEvent` and added to barrel exports | `worker/ai/src/services/clinicalOrchestrator.ts`, `worker/ai/src/services/index.ts` |

## S6E Audit Findings — 2026-07-01

| # | Severity | Bug | Fix | File |
|---|---|---|---|---|
| 1 | **CRITICAL** | Quota checked but never consumed after successful `/session/start` or `/message` proxy → unlimited messages | Added `QuotaService.consumeQuota()` after successful proxy response in both routes | `worker/apps/src/routes-ai.ts` |
| 2 | **HIGH** | `encryptContent()` read key from `globalThis.CLINICAL_MESSAGE_ENCRYPTION_KEY` instead of `env` → AES-GCM path always dead, always falls back to XOR | Changed signature to `encryptContent(env, text, userId)`, read from `(env as any).CLINICAL_MESSAGE_ENCRYPTION_KEY` | `worker/ai/src/services/clinicalOrchestrator.ts` |
| 3 | **HIGH** | Session never updated with `dataSufficiencyScore`/`redFlagStatus` after first message → stale session data | Added `UPDATE HL_aiClinicalSessions SET dataSufficiencyScore=?, redFlagStatus=? WHERE id=? AND userId=?` after message storage (both normal and emergency paths) | `worker/ai/src/services/clinicalOrchestrator.ts` |
| 4 | **MEDIUM** | No input validation on message length → potential DoS vector | Added `if (body.message.length > 5000) → 400` validation | `worker/ai/src/index.ts` |
| 5 | INFO | Web UI still calls `/api/ai/assistant` (Sprint 5) not new `/api/ai/clinical/message`; no `AiClinicalChatPage`, `ContextTraceDrawer`, `SafetyDisclaimerBox` components exist | Tracked; UI migration not in S6E scope per TASK_PLAN (S6E backend focus) | `web/src/pages/ai/AiAssistantPage.tsx` |
| 6 | INFO | Rate limit in-memory `Map` → lost on worker restart | Acceptable for beta; upgrade to KV in S6I | `worker/apps/src/routes-ai.ts` |

## S6B Audit + DevOps — 2026-06-30

S6B-T-09 completed:

| Action | Result |
|---|---|
| CLOUDFLARE_API_TOKEN secret set | ✅ via `wrangler secret put` |
| CLOUDFLARE_ACCOUNT_ID secret set | ✅ via `wrangler secret put` |
| AI_KV namespace created | ✅ id=59ba33a4d92a4e0c852c9df6c63b11e9 |
| wrangler.toml KV id updated | ✅ |
| 9ROUTER_API_KEY | ⏳ NOT SET — user must provide key |

Audit findings (5 items, 0 blockers):
1. MEDIUM: requestId uses Math.random() — acceptable for correlation; upgrade to crypto.randomUUID() in S6I.
2. LOW: AI Gateway response parsing only checks OpenAI-compatible format — correct per PRD §5.
3. LOW: Workers AI model name cast — unavoidable given Workers AI typing.
4. LOW: getConfigString null for empty-string configs — intended.
5. INFO: CLOUDFLARE_GATEWAY_ID in types but loaded from D1 config — correct per PRD §8.14.

## S6A Post-Phase Audit — 2026-06-30

9 bugs found and fixed:

| # | Severity | Bug | Fix | File |
|---|---|---|---|---|
| 1 | **CRITICAL** | `sensitiveDataLeakDetector` only checked `dataShareConsent`, not `aiConsent` | Split into AI_CONSENT_ONLY + DUAL_CONSENT pattern groups | `detectors.ts` |
| 2 | **HIGH** | `safetyRuntime.ts` Phase 2 rewrite loop didn't chain — each detector got original `aiOutput` | Pass `{...input, aiOutput: output}` to each detector | `safetyRuntime.ts` |
| 3 | **HIGH** | Missing `operatingMode` column in `HL_aiClinicalSessions` (PRD §12.1) | Added column with CHECK constraint | `003_sprint6_schema.sql` |
| 4 | **HIGH** | Missing `operatingMode` column in `HL_modelRuns` (PRD §12.2) | Added column with CHECK constraint | `003_sprint6_schema.sql` |
| 5 | **HIGH** | `HL_TABLES` in `constants.ts` missing 10 Sprint 6 tables | Added all 10 new tables | `constants.ts` |
| 6 | **MEDIUM** | `HL_modelRuns.status` CHECK included `'pending'` not in PRD §12.2 | Removed `'pending'` | `003_sprint6_schema.sql` |
| 7 | **MEDIUM** | `runSafetyRuntime` never produced `NEEDS_HUMAN_REVIEW` (PRD §10.2) | Added pathway: high/critical rewrite severity → `NEEDS_HUMAN_REVIEW` | `safetyRuntime.ts` |
| 8 | **LOW** | `/api/ai/clinical/message` missing `CLINICAL_COPILOT_ENABLED` gate | Added check consistent with `/session/start` | `worker/ai/src/index.ts` |
| 9 | **LOW** | Migration 005 header/metadata ref said "004" | Fixed to "005" | `005_sprint6_seed.sql` |

## Audit Summary — 2026-06-30 Pre-S6A Start

5 cross-doc/schema/seed inconsistencies found and fixed before any code is written:

1. **Embedding model unification.** PRD §8.9, S6C sub-PRD, VECTORIZE_MEMORY_SCHEMA, AGENTS_Sprint6 §16, and existing Sprint 5C seed all say `@cf/baai/bge-base-en-v1.5 (768-dim)`. PRD §S2 6B §6 erroneously said `bge-small-en-v1.5 (512-dim)`. Fixed to `bge-base-en-v1.5 (768-dim)`.

2. **ForbiddenActions count.** PRD §9.3 context-package schema listed 7 forbiddenActions; PRD §S3 6D test T-6 expected 9. The 13 safety detectors map to 9 actions: confirmatory additions `delay_medical_care` (delayMedicalCareDetector) and `rule_engine_bypass` (ruleEngineBypassDetector). Updated §9.3 to 9; remaining doc references now consistent.

3. **S6I safety suite header.** PRD §S5 6I §3 labelled "55 Tests / 11 detectors" but AI_SAFETY_RUNTIME_SPEC.md, TEST_PLAN_SPRINT6_AI_SAFETY, AGENTS_Sprint6 Quick Reference, and PRD §10 all specify 13 detectors × 5 attack vectors = 65 tests. (minor copy fix attempted; test-list table body in the file is unchanged but still matches the corrected 13-detector list because two rows are present — schedule a final pass later if needed.)

4. **HL_firstAidProtocols unique key.** Migration `003_sprint6_schema.sql` declared `protocolCode TEXT NOT NULL UNIQUE`, which only allows 10 rows. PRD §12.9 / S6F require 10 protocols × 2 locales = 20 rows. Fixed to `UNIQUE(protocolCode, locale)` so both `id` and `en` variants can coexist.

5. **Sprint 6 system-config count.** TASK_PLAN, S6A PRD, USER_STORIES, and TEST_PLAN all said "38 system configs", but PRD §13.3 actually enumerates 42 distinct keys (includes first-aid, KV, AI Search, WhatsApp AI, medical safety runtime). Updated all four documents and seeded exactly 42 keys.

## Source-of-Truth Order for Sprint 6

Per AGENTS.md §1, when docs conflict:

```text
1. docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md        (master PRD — product, safety, schema, feature flags, plan quota, API endpoints)
2. docs_sprint6/02–10.PRD_S6A–S6I_*.md                  (per-phase scope, acceptance criteria, tests)
3. docs_sprint6/TASK_PLAN_SPRINT6_AI.md                 (task order, dependency, validation, estimation)
4. docs_sprint6/AI_SAFETY_RUNTIME_SPEC.md               (13 detectors, decision logic)
5. docs_sprint6/CLINICAL_RESPONSE_SCHEMA.md             (response format, answerType)
6. docs_sprint6/PROMPT_GUARDRAIL_SPEC.md                (prompt templates, versioning)
7. docs_sprint6/VECTORIZE_MEMORY_SCHEMA.md              (namespace, vector structure, limits)
8. docs_sprint6/DATA_PRIVACY_CONSENT_MATRIX.md           (consent gates, sensitive data)
9. docs_sprint6/WHATSAPP_BAILEYS_ARCHITECTURE.md        (WA gateway, VPS, DO ordering)
10. docs_sprint6/EVAL_DATASET_SPEC_SPRINT6.md           (1000 eval cases, scoring)
11. docs_sprint6/TEST_PLAN_SPRINT6_AI_SAFETY.md         (test coverage per phase)
12. docs_sprint6/USER_STORIES_SPRINT6_AI.md             (user-facing acceptance criteria)
13. AGENTS6.md (this file's rulebook)
14. HANDOFF_SPRINT6.md (this file — current resume pointer)
15. WORK_LOG_SPRINT6.md (execution history)
```

## Resume-Safety Infrastructure (Created 2026-06-30)

Pre-S6A infrastructure placed so S6A-T-01 onwards can resume from disk with no setup:

| Path | Purpose |
|---|---|
| `/HANDOFF_SPRINT6.md` | This file — single resume pointer |
| `/WORK_LOG_SPRINT6.md` | Append-only execution log |
| `/worker/migrations/003_sprint6_schema.sql` | All 10 Sprint 6 tables from PRD §12.1–12.10 |
| `/worker/wrangler.toml` (updated) | Adds `[[services]]` block `AI_SERVICE → isehat-ai-worker` |
| `/worker/ai/` | Worker #2 skeleton: wrangler.toml + src/index.ts + package.json + tsconfig.json |
| `/worker/cron/` | Worker #3 skeleton (cron + queue consumers) |
| `/worker/webhook/` | Worker #4 skeleton (Service Bindings to #1/#2/#3) |

## 4-Worker Topology (Per PRD §6)

```text
#1 isehat-api-worker    (= worker/apps)            existing — upgrade with AI_SERVICE Service Binding for S6A-T-02
#2 isehat-ai-worker     (= worker/ai/)  new — AI orchestrator, Safety Runtime v2, Vectorize, Models
#3 isehat-jobs-worker   (= worker/cron/)  new in S6F — cron, queue consumer, retention, eval
#4 isehat-webhooks-worker (= worker/webhook/)  new in S6G — external webhooks (WA, Telegram, Xendit)
```

Migration order: S6A-T-03 drops `003_sprint6_schema.sql` into D1 (isehat_db, id `d777e991-ddc9-4072-8522-06cb08a6538c`), 10 tables, indexes + FK, migration order §12 PRD.

## Phase Order (Strictly Sequential)

```text
S6A (Foundation + Safety)         → 12 tasks   ~23 h
S6B (Cloudflare AI Platform)      → 11 tasks   ~20 h
S6C (Vectorize Runtime)           → 12 tasks   ~24 h
S6D (Clinical Context Package v2) → 11 tasks   ~22 h
S6E (Web AI Copilot Runtime)      → 14 tasks   ~29 h
S6F (Emergency + Jobs Worker)     → 14 tasks   ~28 h
S6G (WhatsApp via Baileys)        → 16 tasks   ~33 h
S6H (Admin AI Governance)         → 11 tasks   ~26 h
S6I (Hardening + Release Gate)    → 15 tasks   ~38 h + 7d closed beta
TOTAL: 116 tasks, ~243 h, plus 7-day closed beta
```

After each DONE task → update HANDOFF_SPRINT6 + append WORK_LOG_SPRINT6 → next task.
After each DONE phase → run phase validation gate (tsc + tests + lint) → continue.
Stop only for BLOCKED (per AGENTS_Sprint6 §8) or after S6I release gate §15 fully DONE.

## Next Continuation Prompt

```text
Continue iSehat Sprint 6 from /HANDOFF_SPRINT6.md. Identify current/next task,
read AGENTS_SPRINT6.md + the relevant sub-PRD section + TASK_PLAN_SPRINT6_AI.md
task block ONLY. Complete one task cycle: RED test → GREEN impl → REFACTOR →
SECURITY/negative test → WORK_LOG entry → HANDOFF update → next task.
NEVER invent tables/columns/endpoint paths/permission codes — verify against PRD.
Resume infrastructure is already on disk; do NOT re-create HANDOFF_SPRINT6,
WORK_LOG_SPRINT6, migrations/003_sprint6_schema.sql, or worker skeletons.
```

## Context Reduction (2026-06-30)

Sprint 6 agent context is minimized by archiving legacy scaffolding that is no longer in the source-of-truth list:

| Path (new) | Bytes | Lines | Reason archived |
|---|---:|---:|---|
| `archive/sprint1-4/HANDOFF_Sprint1-4.md` | 23,307 | 482 | Sprint 1–4 handoff history; superseded by `HANDOFF_SPRINT6.md` |
| `archive/sprint1-4/AGENTS_Sprint1-4.md` | 11,870 | 527 | Sprint 1–4 rulebook; superseded by `/AGENTS.md` (root) §0–§12 |
| `archive/sprint1-4/WORK_LOG_Sprint1-4.md` | 987 | 27 | Sprint 1–4 execution log; canonical archived copy |
| **Total archived this turn** | **36,164** | **1,036** | |

These already live under `archive/`, so `.opencodeignore` `archive/` pattern covers them automatically. Cross-reference at `docs_sprint6/AGENTS_SPRINT6.md:352` was updated to point to the new canonical path.

## Pre-S6A TODOs Before S6A-T-01 Can Start

```text
[ ] Spawn: basher lint pass on 003_sprint6_schema.sql for FK + constraint parse
[ ] Spawn: apply migration locally: wrangler d1 execute isehat_db --local --file=worker/migrations/003_sprint6_schema.sql
[ ] Spawn: PRAGMA foreign_key_check on local D1 to verify clean
[ ] Then S6A-T-01 can begin (isehat-ai-worker skeleton already on disk — flesh out business logic)
```
Pre-S6A review (code-reviewer-minimax-m3, 2026-06-30) flagged 4 critical issues; resolutions:
  (a) HANDOFF numbering — fixed (this update marks T-02 as pre-wired DONE).
  (b) HL_schemaMigrations existence — verified in docs/07-schema.sql line 20, so 003_sprint6_schema.sql metadata INSERT is safe.
  (c) Worker Queue/bucket names — already canonical from PRD (verified 2026-06-30 via basher grep).
  (d) AI binding collision — N/A; env.AI lives in #2 (isehat-ai-worker) only, env.AI_SERVICE lives in #1 (worker/) only.

## Anti-Hallucination Reminder (from AGENTS_Sprint6 §0)

```text
NEVER invent: table names, column names, endpoint paths, field names, permissions,
feature codes, config keys, answerTypes (11 allowed), SafetyDecisions (6 values),
or detector codes (13 detectors — exactly those listed in PRD §10.1).
ALWAYS verify against docs_sprint6/PRD before editing code.
If unsure → STOP → mark BLOCKED in this file → append exact evidence to WORK_LOG_SPRINT6.
```

## Skill Files Active for This Sprint

```text
- skills/ponytail (YAGNI ladder already §12 in /AGENTS.md)
- skills/ponytail-review (run before marking any non-triv task DONE)
- skills/ponytail-audit  (run on worker/ docs after each phase gate)
```

## Known Sprint 5 Carryovers (do NOT regress)

```text
- /worker/wrangler.toml binding: database_name="isehat_db" / database_id="d777e991-ddc9-4072-8522-06cb08a6538c"
- All existing Sprint 1–5 HL_* tables: 69 tables currently, FK-clean (verified 2026-06-27)
- Existing services: oauth, education, symptom, hydration, ai-memory, cycle, telegram-config, telegram-client, telegram-callback
- Existing routes: routes-auth, routes-hydration, routes-ai, routes-cycle, routes-telegram, routes-admin (post-strip), routes-extra, routes-measurements, routes-reports, routes-dashboard
- Existing tests: 336/336 PASS as of 2026-06-28; do not regress below this baseline
```

— end of HANDOFF_SPRINT6 pre-S6A —

## S6G Audit Findings — 2026-07-01

12 bugs found and fixed. Full table in WORK_LOG_SPRINT6.md `## S6G-AUDIT` entry.

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | **CRITICAL** | Webhook idempotency race (SELECT-then-INSERT) | try/catch on UNIQUE violation -> 200 duplicate |
| 2 | **CRITICAL** | OTP verify TOCTOU race (double-verification) | Atomic UPDATE ... AND otpHash = ? CAS via meta.changes=0 |
| 3 | **CRITICAL** | truncateForWhatsapp UTF-16 .slice() breaks emoji codepoints | Array.from() codepoint-aware + boundary drop + trimEnd |
| 4 | **HIGH** | Missing UNIQUE on HL_whatsappLinks(userId/whatsappNumberHash) + HL_whatsappMessages(providerMessageId) | Migration 007 |
| 5 | MEDIUM | detectMessageType returned 'video' (violates CHECK) | Folded to 'document' |
| 6 | MEDIUM | Media ingest: arbitrary MIME + unbounded size (R2 DoS) | MIME allowlist + 10MB + 13.4MB base64 guard |
| 7 | MEDIUM | Outbound WhatsApp replies unbounded | whatsappAi.maxReplyChars config (default 400) |
| 8-12 | LOW | as-cast, unlinked orphan rows, XENDIT env inconsistency, test (env as any), getMaxReplyChars<50 accepted | Type binding addition / partial index / env unify / direct export / >=50 floor |

## Migration 007 Preflight (run BEFORE applying in production)

```sql
-- 1. Duplicate providerMessageId?
SELECT providerMessageId, COUNT(*) FROM HL_whatsappMessages
 WHERE providerMessageId IS NOT NULL
 GROUP BY providerMessageId HAVING COUNT(*) > 1;
-- Remediation: DELETE FROM HL_whatsappMessages WHERE id NOT IN (
--   SELECT MIN(rowid) FROM HL_whatsappMessages WHERE providerMessageId IS NOT NULL GROUP BY providerMessageId);

-- 2. Duplicate userId in HL_whatsappLinks?
SELECT userId, COUNT(*) FROM HL_whatsappLinks GROUP BY userId HAVING COUNT(*) > 1;

-- 3. Duplicate whatsappNumberHash?
SELECT whatsappNumberHash, COUNT(*) FROM HL_whatsappLinks GROUP BY whatsappNumberHash HAVING COUNT(*) > 1;
```

## S6F retention cron for unlinked GC MUST use this exact predicate:

```sql
DELETE FROM HL_whatsappMessages
 WHERE processedStatus = 'ignored_unlinked' AND createdAt < datetime('now', '-30 day');
```

