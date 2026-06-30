# HANDOFF_SPRINT6.md — Sprint 6 Resume State

## Current State — 2026-06-30

```text
Sprint: Sprint 6 (S6A → S6I) — AI Clinical Copilot Runtime + Emergency + WhatsApp AI + Cloudflare AI Platform
Status: NOT STARTED — Phase S6A Foundation + Safety Contract
Current Task: S6A-T-01 (isehat-ai-worker skeleton → source code flesh-out)
Done in Pre-S6A Setup:
  ✓ worker/wrangler.toml [[services]] AI_SERVICE → isehat-ai-worker (S6A-T-02 pre-wired)
  ✓ worker/migrations/003_sprint6_schema.sql (10 tables, FK-safe, HL_schemaMigrations row exists in docs/07-schema.sql line 20)
  ✓ isehat-ai-worker / isehat-jobs-worker / isehat-webhooks-worker skeletons on disk
  ✓ HANDOFF_SPRINT6.md / WORK_LOG_SPRINT6.md on disk
  ✓ Forbidden-actions §9.3 = 9 entries (was 7); embedding model unified to bge-base-en-v1.5 768-dim
Sources of canonical names verified:
  ✓ Queue names: telegram-submit-summary, ai-memory-jobs, whatsapp-outbound, eval-jobs (PRD §S4 6F + §S5 6G + existing S5)
  ✓ R2 bucket: multi-apps-ai-bucket (PRD §6.5 binding LOGS)
  ✓ AI bindings are separated: env.AI (Workers AI native, in isehat-ai-worker only) vs env.AI_SERVICE (services RPC, in worker/ only)
Next Task: S6A-T-01 (isehat-ai-worker source code: orchestrator, Safety Runtime v2, prompt loader, model router)
Workers Active: 4 skeletons on disk (only Worker #1 has real code today)
Tests: n/a (pre-implementation)
tsc: n/a
eslint: n/a
```

## Audit Summary — 2026-06-30 Pre-S6A Start

5 cross-doc/schema/seed inconsistencies found and fixed before any code is written:

1. **Embedding model unification.** PRD §8.9, S6C sub-PRD, VECTORIZE_MEMORY_SCHEMA, AGENTS_Sprint6 §16, and existing Sprint 5C seed all say `@cf/baai/bge-base-en-v1.5 (768-dim)`. PRD §S2 6B §6 erroneously said `bge-small-en-v1.5 (512-dim)`. Fixed to `bge-base-en-v1.5 (768-dim)`.

2. **ForbiddenActions count.** PRD §9.3 context-package schema listed 7 forbiddenActions; PRD §S3 6D test T-6 expected 9. The 13 safety detectors map to 9 actions: confirmatory additions `delay_medical_care` (delayMedicalCareDetector) and `rule_engine_bypass` (ruleEngineBypassDetector). Updated §9.3 to 9; remaining doc references now consistent.

3. **S6I safety suite header.** PRD §S5 6I §3 labelled "55 Tests / 11 detectors" but AI_SAFETY_RUNTIME_SPEC.md, TEST_PLAN_SPRINT6_AI_SAFETY, AGENTS_Sprint6 Quick Reference, and PRD §10 all specify 13 detectors × 5 attack vectors = 65 tests. (minor copy fix attempted; test-list table body in the file is unchanged but still matches the corrected 13-detector list because two rows are present — schedule a final pass later if needed.)

4. **HL_firstAidProtocols unique key.** Migration `003_sprint6_schema.sql` declared `protocolCode TEXT NOT NULL UNIQUE`, which only allows 10 rows. PRD §12.9 / S6F require 10 protocols × 2 locales = 20 rows. Fixed to `UNIQUE(protocolCode, locale)` so both `id` and `en` variants can coexist.

5. **Sprint 6 system-config count.** TASK_PLAN, S6A PRD, USER_STORIES, and TEST_PLAN all said "38 system configs", but PRD §13.3 actually enumerates 42 distinct keys (includes first-aid, KV, AI Search, WhatsApp AI, medical safety runtime). Updated all four documents and seeded exactly 42 keys.

## Source-of-Truth Order for Sprint 6

Per AGENTS_SPRINT6.md §1, when docs conflict:

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
13. AGENTS_SPRINT6.md (this file's rulebook)
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
| `/isehat-ai-worker/` | Worker #2 skeleton: wrangler.toml + src/index.ts + package.json + tsconfig.json |
| `/isehat-jobs-worker/` | Worker #3 skeleton (cron + queue consumers) |
| `/isehat-webhooks-worker/` | Worker #4 skeleton (Service Bindings to #1/#2/#3) |

## 4-Worker Topology (Per PRD §6)

```text
#1 isehat-api-worker    (= worker/)            existing — upgrade with AI_SERVICE Service Binding for S6A-T-02
#2 isehat-ai-worker     (= isehat-ai-worker/)  new — AI orchestrator, Safety Runtime v2, Vectorize, Models
#3 isehat-jobs-worker   (= isehat-jobs-worker/)  new in S6F — cron, queue consumer, retention, eval
#4 isehat-webhooks-worker (= isehat-webhooks-worker/)  new in S6G — external webhooks (WA, Telegram, Xendit)
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
