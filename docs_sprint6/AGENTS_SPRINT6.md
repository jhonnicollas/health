# AGENTS_SPRINT6.md — Sprint 6 Compact AI-Agent Rules

Product: iSehat / iSehat
Scope: Sprint 6 (S6A → S6I) — AI Clinical Copilot Runtime + Emergency Guidance + WhatsApp AI + Cloudflare AI Platform
Mode: compact, resume-safe, anti-hallucination, vibe-coding safe
Status: use this file as the runtime rulebook for coding agents working on Sprint 6.

---

## 0. Anti-Hallucination Rules — CRITICAL

```text
1. NEVER invent table names, column names, endpoint paths, field names, permissions,
   feature codes, or config keys that are not in the Sprint 6 PRD or schema documents.
2. NEVER guess API behavior. Read the API contract section in the PRD before implementing
   or calling any endpoint.
3. NEVER assume a Cloudflare binding (Vectorize, AI Search, KV, Durable Objects, Queues)
   exists. Check wrangler.toml for the specific worker before using any binding.
4. NEVER assume a library is available. Check package.json for the specific workspace
   (worker/ or web/) before importing.
5. NEVER assume a Sprint 5 table has a specific column. Read the Sprint 5 schema SQL
   or use PRAGMA table_info before querying.
6. If unsure about ANY detail: STOP. Search the repo/docs. Do not guess.
7. If the docs conflict: follow Source of Truth Order (§1 below).
8. If still unsure after searching: mark task BLOCKED with exact evidence.
```

---

## 1. Source of Truth Order

When documents conflict, use this order (highest to lowest priority):

```text
1. docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md = product behavior, AI boundary,
   safety requirements, schema, feature flags, plan quota, API endpoints.
2. docs_sprint6/02-10.PRD_S6A-S6I_*.md = per-phase scope, acceptance criteria, tests.
3. docs_sprint6/TASK_PLAN_SPRINT6_AI.md = task order, dependency, validation, estimation.
4. docs_sprint6/AI_SAFETY_RUNTIME_SPEC.md = 13 detector specifications, decision logic.
5. docs_sprint6/CLINICAL_RESPONSE_SCHEMA.md = response format, answerType definitions.
6. docs_sprint6/PROMPT_GUARDRAIL_SPEC.md = prompt templates, injection points, versioning.
7. docs_sprint6/VECTORIZE_MEMORY_SCHEMA.md = namespace, vector structure, limits.
8. docs_sprint6/DATA_PRIVACY_CONSENT_MATRIX.md = consent gates, sensitive data rules.
9. docs_sprint6/WHATSAPP_BAILEYS_ARCHITECTURE.md = WA gateway, VPS, DO ordering.
10. docs_sprint6/EVAL_DATASET_SPEC_SPRINT6.md = evaluation cases, scoring, reviewer workflow.
11. docs_sprint6/TEST_PLAN_SPRINT6_AI_SAFETY.md = test coverage per phase.
12. docs_sprint6/USER_STORIES_SPRINT6_AI.md = user-facing acceptance criteria.
13. AGENTS_SPRINT6.md (this file) = execution and resume rules.
14. HANDOFF_SPRINT6.md = current resume pointer.
15. WORK_LOG_SPRINT6.md = execution history.
```

Sprint 1–5 documents (AGENTS.md, docs_sprint5/) remain authoritative for Sprint 1–5 behavior. Sprint 6 builds on top of Sprint 1–5 and must remain backward compatible.

If conflict still exists after checking all sources: STOP. Mark task `BLOCKED` in `HANDOFF_SPRINT6.md` and append `WORK_LOG_SPRINT6.md` with exact conflict.

---

## 2. Mandatory Hard Boundaries — Sprint 6

```text
- AI Operating Mode dikontrol oleh Super Admin via clinicalCopilot.operatingMode (§0.3 PRD).
- Mode values: 'standard' (default) | 'proactive' | 'super_aktif'.
- Mode change WAJIB dicatat ke HL_auditLogs (action='aiOperatingModeChanged').
- Mode change WAJIB disetujui medical reviewer jika clinicalCopilot.operatingModeChangeRequiresMedicalReviewer='true'.

STANDARD mode (default):
- AI TIDAK BOLEH memberi diagnosis final.
- AI TIDAK BOLEH memberi resep obat.
- AI TIDAK BOLEH memberi instruksi dosis.
- AI TIDAK BOLEH mengklaim setara dokter spesialis.

PROACTIVE mode:
- AI BOLEH memberi diagnosis final. (PRD §0.3)
- AI TIDAK BOLEH memberi resep obat.
- AI TIDAK BOLEH memberi instruksi dosis.
- AI TIDAK BOLEH mengklaim setara dokter spesialis.

SUPER_AKTIF mode:
- AI BOLEH memberi diagnosis final. (PRD §0.3)
- AI BOLEH memberi resep obat. (PRD §0.3)
- AI BOLEH memberi instruksi dosis. (PRD §0.3)
- AI BOLEH mengklaim setara dokter spesialis. (PRD §0.3)

SEMUA mode:
- AI TIDAK BOLEH mengubah/menghentikan obat user. (medicationChangeDetector SELALU aktif)
- AI TIDAK BOLEH menurunkan severity yang sudah ditentukan deterministic rule.
- Medical Safety Runtime v2 WAJIB berjalan di setiap output medis.
- Disclaimer WAJIB selalu ada di setiap output medis (§4.3 PRD). Tidak boleh di-skip.
- Deterministic red flag precheck WAJIB berjalan SEBELUM LLM call.
- Jika emergency=true → emergency_template_only, NO LLM freeform.
- Setiap AI call WAJIB dicatat ke HL_modelRuns.
- Setiap safety violation WAJIB dicatat ke HL_aiOutputSafetyFlags.
- No plaintext secret in D1, seed, frontend bundle, API response, log, test, or code.
- Real secrets live in Cloudflare Secrets/Env. D1 stores only 'configured' marker or envVarName.
- Vectorize namespace WAJIB user:{userId} — client cannot override.
- Cross-user data access WAJIB blocked (crossUserLeakDetector).
- Sensitive data WAJIB gated by consent (sensitiveDataLeakDetector).
- Sprint 1–5 behavior MUST remain backward compatible.
- Sprint 5C deferred endpoints (/api/ai/context/query, /api/ai/context-package,
  /api/ai/memory/*, /api/ai/disclaimer/enforce) MUST be upgraded, not replaced.
```

Forbidden names unless explicitly found in Sprint 6 PRD/schema:

```text
- Any HL_* table not in §12.1-§12.10 of the main PRD
- Any feature code not in §13.1
- Any config key not in §13.3
- Any permission not in §7 of PRD S6A
- Any answerType not in §8.1 output types (11 allowed)
- Any SafetyDecision not in §10.2 (6 values)
- Any detector code not in §10.1 (13 detectors)
- Any operating mode value not in §0.3 (only 'standard', 'proactive', 'super_aktif')
```

---

## 3. Medical and Privacy Safety — Sprint 6

AI must NOT:

```text
- prescribe medicine (prescriptionDosageDetector blocks)
- be the only source of medical severity (HL_metricRules is primary)
- downgrade emergency severity (emergencySeverityDowngradeDetector blocks)
- delay medical care on red flag (delayMedicalCareDetector blocks)
- reassure user on red flag (unsafeReassuranceDetector rewrites)
- use Vectorize as clinical proof (vectorizeAsTruthDetector rewrites)
- ignore rule engine (ruleEngineBypassDetector blocks)
- leak cross-user data (crossUserLeakDetector blocks)
- expose sensitive data without consent (sensitiveDataLeakDetector blocks)
- output without disclaimer (missingDisclaimerDetector blocks)
```

Required deterministic rules:

```text
- Measurement status/severity from HL_metricRules flow (Sprint 1-4, unchanged)
- Symptom red flag deterministic server-side (Sprint 5A, unchanged)
- Emergency escalation from HL_metricRules + HL_symptomLogs + HL_safetyEvents (Sprint 6F)
- AI medical output MUST include server-side disclaimer (Sprint 6A Safety Runtime)
- Cycle contraception guardrail blocking UI (Sprint 5, unchanged)
- Overhydration >5000ml → safety event (Sprint 5, unchanged)
```

Sensitive data (per PRD §3 + Sprint 6 additions):

```text
symptom detail, red flag detail, cycle, pregnancy, lactation, menopause,
AI memory (Vectorize content), doctor report detail, caregiver access details,
WhatsApp message content, AI clinical chat content, support/admin sensitive access
```

Access requires: owner OR explicit family permission OR restricted admin permission + audit.

---

## 4. Execution Protocol

Run Sprint 6 autonomously until the full Sprint 6 release gate is complete.

```text
1 phase → 1 task → 1 implementation slice → 1 test run → 1 WORK_LOG entry → 1 HANDOFF update → next task
```

Do not batch tasks inside one implementation slice. Complete exactly one task cycle at a time, then immediately continue to the next READY task from the task plan unless the current task is BLOCKED or the entire Sprint 6 program is DONE.

Phase order (STRICTLY sequential):

```text
S6A (Foundation) → S6B (AI Platform) → S6C (Vectorize) → S6D (Context) →
S6E (Web Runtime) → S6F (Emergency + Jobs) → S6G (WhatsApp) →
S6H (Governance) → S6I (Hardening + Release Gate)
```

Parallel work is allowed only:
- After S6A foundation is complete (schema, safety runtime, service binding)
- When tasks within a phase have no dependency on each other
- Never across phases (S6B cannot start before S6A DONE)

Autonomous continuation rules:

```text
- After each DONE task: update HANDOFF_SPRINT6.md to the next task, append WORK_LOG_SPRINT6.md, continue.
- After each DONE phase: run that phase's validation gate (tsc + tests + lint), update logs, continue.
- After S6I is DONE: execute the Cross-Phase Release Gate (§18 of PRD): full regression,
  eval dataset, safety suite, performance, closed beta, documentation update.
- Stop only for: BLOCKED conflict, missing dependency, unavailable secret, environment failure,
  or after Sprint 6 Release Gate is fully DONE.
```

---

## 5. Agent Start Checklist

Before editing code:

```text
[ ] Read HANDOFF_SPRINT6.md first — identifies current/next task.
[ ] Read latest 3–5 WORK_LOG_SPRINT6.md entries.
[ ] Identify current task ID from HANDOFF_SPRINT6.md.
[ ] Open only that task in TASK_PLAN_SPRINT6_AI.md.
[ ] Open related PRD section (02-10 sub-PRD for the current phase).
[ ] Open related API endpoint section if backend/API task (PRD §11).
[ ] Open related SQL table/seed if DB/service task (PRD §12).
[ ] Open AI_SAFETY_RUNTIME_SPEC.md if safety-related task.
[ ] Open CLINICAL_RESPONSE_SCHEMA.md if response format task.
[ ] Open VECTORIZE_MEMORY_SCHEMA.md if Vectorize task.
[ ] Open DATA_PRIVACY_CONSENT_MATRIX.md if consent/privacy task.
[ ] Open WHATSAPP_BAILEYS_ARCHITECTURE.md if WhatsApp task.
[ ] Confirm dependencies are DONE (check HANDOFF_SPRINT6.md).
[ ] Write or identify failing test first (TDD).
[ ] Update HANDOFF_SPRINT6.md status to IN_PROGRESS before major edits.
```

Do not start another task until the current one is fully validated or blocked. Once validated and marked DONE, continue immediately to the next task without waiting for user instruction.

---

## 6. TDD Rule — Sprint 6

For every code task:

```text
RED: write/identify failing test for the task.
GREEN: implement smallest passing change.
REFACTOR: clean only touched area.
SECURITY: add/confirm negative auth/privacy/secret/safety test.
LOG: update WORK_LOG_SPRINT6.md and HANDOFF_SPRINT6.md.
NEXT: continue to the next READY task, next phase, or Release Gate.
```

Safety-critical tasks (S6A Safety Runtime, S6F Emergency Engine) MUST have:
- Positive test (expected behavior works)
- Negative test (forbidden behavior blocked)
- Edge case test (boundary condition)
- Adversarial test (prompt injection / attack vector)

No test placeholder may be marked pass unless it actually runs or is explicitly documented as manual-only.

End-of-phase and final-gate validation must include the applicable files in:

```text
docs_sprint6/TEST_PLAN_SPRINT6_AI_SAFETY.md
docs_sprint6/EVAL_DATASET_SPEC_SPRINT6.md
```

---

## 7. Validation Commands

Run relevant commands before marking done.

Backend/API (Worker):

```bash
cd worker
npx tsc -p tsconfig.json
npm test
```

Frontend:

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
```

D1 migration validation:

```bash
wrangler d1 execute isehat_db --local --file=migrations/003_sprint6_schema.sql
wrangler d1 execute isehat_db --local --command="PRAGMA foreign_key_check;"
```

Safety runtime tests:

```bash
cd worker && npm test -- --grep safety
```

Specific phase tests:

```bash
cd worker
npm test -- --grep modelRouter     # S6B
npm test -- --grep vectorize       # S6C
npm test -- --grep contextPackage  # S6D
npm test -- --grep clinicalChat    # S6E
npm test -- --grep emergency       # S6F
npm test -- --grep whatsapp        # S6G
npm test -- --grep governance      # S6H
npm test -- --grep safetySuite     # S6I
```

If a command cannot run, write exact reason in `WORK_LOG_SPRINT6.md` and `HANDOFF_SPRINT6.md`.

---

## 8. Done / Blocked Rules

A task is DONE only if:

```text
[ ] implementation complete;
[ ] tests/validation run or documented manual validation completed;
[ ] no unrelated refactor;
[ ] no secret leaked;
[ ] no unsupported table/endpoint/field/permission/feature code invented;
[ ] Sprint 1–5 regression risk checked;
[ ] WORK_LOG_SPRINT6.md appended;
[ ] HANDOFF_SPRINT6.md updated with next task.
```

Mark BLOCKED when:

```text
- source docs conflict (after checking Source of Truth Order §1);
- required table/column/permission/endpoint is missing;
- secret/config is unavailable;
- dependency task is incomplete;
- validation cannot run for environment reason;
- Cloudflare binding (Vectorize, AI Search, KV, DO, Queue) not yet created.
```

Blocked entry must include: exact blocker, evidence (file + line + quote), and safest next action.

---

## 9. File Editing Discipline

```text
- Read before edit. ALWAYS.
- Modify only files needed by current task.
- Do not reformat unrelated files.
- Do not delete prior logs.
- Do not move or rename docs unless task requires it.
- Do not create new D1 database or R2 bucket — use existing isehat_db and multi-apps-ai-bucket.
- Do not deploy production unless the S6I release gate explicitly says deploy.
- Do not change Sprint 1–5 behavior unless task explicitly says upgrade.
- Do not add new npm packages without checking package.json first.
- Do not cast as "any" type — use proper types from types.ts.
- Do not hardcode secrets, API keys, or tokens in any file.
- Do not commit .env files or files with real credentials.
```

Large refactor rule: checkpoint `HANDOFF_SPRINT6.md` before starting any risky refactor.

---

## 10. Compact WORK_LOG Policy

To avoid context-limit problems:

```text
- WORK_LOG_SPRINT6.md contains Sprint 6 entries only.
- Keep each entry under 25 lines.
- Put long debug output in separate files under docs_sprint6/logs/ if needed.
- HANDOFF_SPRINT6.md is the single resume pointer.
- Agents should read only latest 3–5 WORK_LOG entries, not the entire history.
```

If old pre-Sprint-6 logs exist, they are in WORK_LOG.md (Sprint 1-4 root history) and `archive/sprint1-4/WORK_LOG_Sprint1-4.md` (canonical archived copy). Do not paste old logs into Sprint 6 prompts.

---

## 11. Worker Topology Awareness

Sprint 6 uses 4 Workers. Agents MUST know which worker they are editing:

| Worker | Directory | wrangler.toml | Purpose |
|---|---|---|---|
| #1 isehat-api-worker | worker/ | worker/wrangler.toml | Public API, auth, proxy to #2 |
| #2 isehat-ai-worker | worker/ai/ (new) | worker/ai/wrangler.toml | AI orchestrator, safety, Vectorize, models |
| #3 isehat-jobs-worker | worker/cron/ (new) | worker/cron/wrangler.toml | Cron, queue consumer, retention, eval |
| #4 isehat-webhooks-worker | worker/webhook/ (new) | worker/webhook/wrangler.toml | External webhooks (WA, Telegram, Xendit) |

```text
- Check the correct wrangler.toml for the worker you are editing.
- Service Bindings are configured in wrangler.toml — verify binding names.
- Do not use a binding that is not in the wrangler.toml for that worker.
- D1 binding is "DB" in all workers. R2 binding is "LOGS" in #1, #3, #4.
- Vectorize binding is "VECTORIZE_INDEX" in #2 only.
- AI Search binding is "AI_SEARCH" in #2 only.
- KV binding is "AI_KV" in #2 only.
- Durable Objects are in #2 only.
- AI Gateway is NOT a binding — it uses CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN env vars.
- Workers AI binding is "AI" in #2 only (via [[ai]] in wrangler.toml or platform binding).
```

---

## 12. HANDOFF_SPRINT6.md Format

```markdown
# HANDOFF_SPRINT6.md — Sprint 6 Resume State

## Current State — YYYY-MM-DD HH:MM UTC

```text
Sprint: Sprint 6 (S6A → S6I)
Phase: S6X
Status: IN_PROGRESS / DONE / BLOCKED
Current Task: S6X-T-NN
Next Task: S6X-T-NN (or S6Y-T-01 if phase done)
Workers Active: #1 + #2 (or #1+#2+#3, or all 4)
Tests: N/N PASS
tsc: Worker PASS, Web PASS
eslint: 0 new errors
```

## Last Completed Task
- Task: S6X-T-NN
- Result: [one-line summary]
- Validation: [commands run + result]

## Current Blocker (if BLOCKED)
- Blocker: [exact description]
- Evidence: [file + line + quote]
- Safest Next Action: [what to do]

## Next Task Details
- Task: S6X-T-NN
- Depends on: [task IDs]
- Validation: [commands to run]
```

---

## 13. WORK_LOG_SPRINT6.md Format

Each entry (max 25 lines):

```markdown
## S6X-T-NN — YYYY-MM-DD HH:MM UTC

- Task: [task description]
- Worker: #N
- Files changed: [list]
- Tests: [N/N pass / fail]
- Validation: [tsc pass / fail, eslint, vite build]
- Notes: [any issues, decisions, deviations]
- Status: DONE / BLOCKED
```

---

## 14. Safe Agent Prompts

First run prompt:

```text
Implement iSehat Sprint 6 AI Clinical Copilot. Read AGENTS_SPRINT6.md,
HANDOFF_SPRINT6.md, latest 3-5 WORK_LOG_SPRINT6.md entries, and only the
current task section from TASK_PLAN_SPRINT6_AI.md. Open the related sub-PRD
(02-10) for the current phase. Start with the task shown in HANDOFF_SPRINT6.md
only. Complete exactly one task cycle at a time. Follow TDD, run validation,
update WORK_LOG_SPRINT6.md and HANDOFF_SPRINT6.md, then continue to the next
READY task/phase automatically until Sprint 6 Release Gate is DONE or a real
BLOCKED condition occurs. NEVER invent table names, endpoints, fields, or
config keys — always verify against the PRD and schema docs.
```

Resume prompt:

```text
Continue iSehat Sprint 6 from HANDOFF_SPRINT6.md. Identify the current/next
task, read only relevant Sprint 6 docs (AGENTS_SPRINT6.md, current sub-PRD,
TASK_PLAN section, relevant spec docs), complete one task cycle, run
validation, update WORK_LOG_SPRINT6.md and HANDOFF_SPRINT6.md, then continue
sequentially to the next READY task/phase automatically until Sprint 6 Release
Gate is DONE or a real BLOCKED condition occurs. NEVER hallucinate — verify
every detail against source docs.
```

Failure prompt:

```text
Audit the current failed task only. Read HANDOFF_SPRINT6.md, latest
WORK_LOG_SPRINT6.md entries, the current task section from TASK_PLAN_SPRINT6_AI.md,
related PRD/spec sections, and test output. Fix the smallest cause, rerun
validation, update logs, then continue sequentially if the task becomes DONE.
Stop only if the task remains BLOCKED with exact evidence. Do not invent
solutions — verify all fixes against source docs.
```

---

## 15. Cross-Phase Release Gate (S6I)

After S6H is DONE, execute the Release Gate:

```text
1. Run full safety test suite (65 tests: 13 detectors × 5 vectors) — 0 critical failures.
2. Run 100 prompt injection adversarial cases — 0 bypasses.
3. Run cross-user isolation test — 0 leaks.
4. Run forbidden output test — all correctly blocked/rewritten.
5. Run red flag missed test (100 cases) — 0 missed.
6. Run WhatsApp order test — 0 reorderings, 0 duplicates.
7. Run Vectorize idempotency test — same count 3 rebuilds.
8. Run performance test — p95 < 2s clinical chat, p95 < 50ms Service Binding.
9. Run Service Binding resilience test — graceful degradation.
10. Run i18n test — 0 missing keys (ID + EN).
11. Run data retention cron test — all 6 jobs verified.
12. Run evaluation dataset (1000 cases) — all release gate metrics pass.
13. Medical reviewer audits 200 random outputs.
14. Closed beta: 20-50 testers, 7 days, 0 critical incidents.
15. Update documentation (ARCHITECTURE_SPRINT6.md, API_CONTRACT_SPRINT6.md, PRD final status).
16. Set clinicalCopilot.enabled = 'true' for all premium users.
```

Sprint 6 is DONE only when ALL 16 release gate steps pass.

---

## 16. Quick Reference — Key Numbers

| Item | Value |
|---|---|
| Workers | 4 (api, ai, jobs, webhooks) |
| D1 tables (new Sprint 6) | 10 |
| Safety detectors | 13 |
| Safety decisions | 6 |
| Feature flags | 10 |
| Operating modes | 3 (standard, proactive, super_aktif) |
| Operating mode configs | 2 |
| System configs | 44 |
| RBAC permissions (new) | 5 |
| Plan quota features | 10 × 5 plans |
| Prompt codes | 6 |
| Answer types (allowed) | 11 |
| Answer types (forbidden) | 5 |
| Vectorize per-user limit | 500 vectors |
| Vectorize alert threshold | 80% (8M of 10M) |
| Embedding model | @cf/baai/bge-base-en-v1.5 (768-dim) |
| Eval dataset cases | 1000 |
| Safety test suite | 65 (13 × 5) |
| Prompt injection tests | 100 |
| Red flag tests | 100 |
| Total safety tests | 283 |
| Data retention crons | 6 |
| Durable Object classes | 5 |
| i18n new keys | ~50 per locale |
| Release gate metrics | 17 |

---

## 17. Git Versioning Best Practices (Sprint 6)

### 17.1 Branch per phase

```text
- One phase = one branch: sprint6/S6A, sprint6/S6B, ..., sprint6/S6I.
- Phase branches created from main at Phase Gate of previous phase.
- Never push phase implementation directly to main.
- Tag the merge-back commit as sprint6-<phase>-DONE at the end.
```

### 17.2 Worktree per scope (only when needed)

```text
- Default: work in main worktree on phase branch.
- If scope conflict (e.g., Sprint 5 harding (Lane B) + Sprint 6 execution (Lane A)
  need to coexist), use git worktree add ../wt-<branch> -b <branch> main.
- Each worktree has its own node_modules → re-run npm install per worktree.
```

### 17.3 Commit per task

```text
- Each TASK_ID = one commit. NEVER batch multiple TASK_IDs in one slice.
- Conventional Commits scope:
  [sprint6/<phase>] <task code>: <imperative title>
- Commit body MUST cite PRD section (e.g., per docs_sprint6/02.PRD_S6A_FOUNDATION.md §4.2)
  OR spec doc (e.g., AI_SAFETY_RUNTIME_SPEC.md §10.1).
- WORK_LOG entry MUST reference the same TASK_ID and commit SHA.
```

### 17.4 Push per phase gate

```text
- Per-task: local commit only, NO push.
- Per-phase push gate sequence:
  1. worker: npx tsc -p tsconfig.json && npm test → PASS
  2. web: npx tsc -b && npx eslint . && npx vite build → PASS
  3. D1: wrangler d1 execute isehat_db --local --file migrations/003_sprint6_schema.sql
  4. wrangler d1 execute isehat_db --local --command "PRAGMA foreign_key_check;" → CLEAN
  5. Audit bundle (§15) → all P0/P1 triaged, audit findings appended to WORK_LOG
  6. HANDOFF_SPRINT6.md "Phase status" updated to DONE
  7. WORK_LOG_SPRINT6.md cycle summary appended
  8. git commit metadata docs update
  9. git push -u origin sprint6/<phase>
- NEVER git push origin main --force.
- NEVER git push --force-with-lease on shared branches.
- Use merge (not rebase) when picking up main updates on phase branch.
```

### 17.5 Forbidden without explicit user approval

```text
- git reset --hard on pushed commit.
- git push --force to main.
- git clean -fd while work in progress.
- git branch -D on branch with unpushed commits.
- Direct push to main (only via approved PR / merge).
- Skipping validation ("we'll fix tests later" = NEVER ACCEPTABLE for medical app).
```

---

## 18. Multi-Agent Parallelism Best Practices (Sprint 6)

### 18.1 When CAN a phase be split

YES if all three:
1. File-disjoint: agents touch different files (e.g., worker/ai/ vs worker/cron/).
2. Dependency-disjoint: agent A's code does not import agent B's code.
3. Quota-disjoint: agents do not write to same D1 rows simultaneously.

Sprint 6 parallelism map (per docs_sprint6/TASK_PLAN_SPRINT6_AI.md):
- S6A (12 tasks): mostly serial. Parallel subset: T-08 → T-11 after T-05 done.
- S6B (11 tasks): 3 parallel lanes (AI Gateway / Vectorize hardening / KV namespace).
- S6C (12 tasks): 2 parallel lanes (vector index pipeline / vector query).
- S6D–S6I: mostly serial within phase.

### 18.2 Per-agent rules (must cite §0 anti-hallucination)

```text
- 1 agent = 1 sub-branch: agent-<id>/<lane> from main.
- 1 agent = 1 specific TASK_ID from TASK_PLAN (NEVER invent IDs).
- 1 agent = 1 allowed file path list (touch only allowed).
- 1 agent outputs 1 commit per task:
  [agent-<id>] <task code>: <title>
- 1 agent MUST cite PRD section / spec doc in commit message.
- 1 agent DOES NOT touch:
  - AGENTS_Sprint6.md / HANDOFF_SPRINT6.md / WORK_LOG_SPRINT6.md (integrator only)
  - worker/wrangler.toml bindings (architecture)
  - shared services in worker/src/services/ that other agents also touch
```

### 18.3 Integrator (Buffy) role

```text
- Spawn each agent with explicit: task ID, allowed paths, disallowed paths, expected commit count.
- After ALL agents DONE: merge sub-branches into phase branch (one merge commit).
- Run full cycle test on merged result (§7 Validation Commands).
- Run audit bundle (§15) on merged result.
- Resolve conflicts (see §18.4).
- Update HANDOFF + WORK_LOG + commit metadata.
- Push phase branch at gate (per §17.4).
```

### 18.4 Conflict resolution

```text
- Same file edited by 2 agents → integrator cherry-picks; favors PRD-aligned version.
- 2 agents claim same TASK_ID → first to commit wins; second agent BLOCKED with redirect.
- Non-canonical column invented → rolled back post-merge review.
- Out-of-scope file touched → integrator reverts that part of commit (preserve in-scope work).
- Conflicting answers between agents → integrator asks owner; do NOT pick silently.
```

### 18.5 Cross-lane safety (Phase 0 hardening vs Sprint 6 phases)

```text
- Lane B (Sprint 5 hardening) MUST declare Sprint 6 Impact: NONE / READ-ONLY / BLOCKING
  in each commit message footer.
- Sprint 6 Impact = NONE: file/table not used by any Sprint 6 task.
- Sprint 6 Impact = READ-ONLY: Sprint 6 reads but does not modify; merge OK if data shape unchanged.
- Sprint 6 Impact = BLOCKING: hold merge until owner evaluates (Sprint 6 vs Lane B priorities).
- Sprint 6 weekly sync: fetch origin main + merge + re-run full cycle test.
```

---

## 19. Audit & Review Best Practices (Sprint 6)

### 19.1 Per-task audit (mandatory)

```text
- After every non-trivial diff, spawn code-reviewer-minimax-m3.
- Verify: anti-pattern check, dead code, naming, type safety, duplication, error handling.
- One-line feedback per finding, severity tier (CRITICAL/MAJOR/MINOR).
- ~1 min overhead per task.
```

### 19.2 Per-phase audit bundle

Spawn 5 audits in parallel after Phase Gate implementation complete:

| # | Audit | Checks |
|---|---|---|
| 1 | code-reviewer-minimax-m3 | semantic + quality + duplication + dead code |
| 2 | security-audit | secrets, OWASP top 10, IDOR, RBAC race, escalation paths, input validation |
| 3 | compliance-audit (medical) | §12.1 secret scan, §12.2 sensitive data access, §12.4 medical safety (no diagnosis, disclaimer always, contraception blocking UI not toast-only, deterministic red flag) |
| 4 | test-coverage-audit | 65-detector (Sprint 6 Safety) + 95-item (Sprint 5 back-compat) matrix mapping |
| 5 | perf-audit | N+1 detection, query plan analysis, p95 latency < 2s clinical chat, memory profile |

Merge findings into WORK_LOG-Sprint6 per phase. Fix P0 immediately, schedule P1/P2.

### 19.3 Cross-phase audit (S6I Hardening release gate only)

```text
- Full audit across all 9 phases (S6A → S6I).
- Includes: §15 Cross-Phase Release Gate 16-step + 1000-case eval dataset + 7-day closed beta.
- Medical reviewer audits 200 random outputs (human-in-the-loop).
- Mandatory before clinicalCopilot.enabled = true for premium users.
```

### 19.4 Audit vs self-declare

```text
- Agent CANNOT self-declare DONE without per-task audit feedback.
- Agent CANNOT skip per-phase audit bundle before push.
- Phase push BLOCKED if any audit returns CRITICAL or unaddressed MAJOR.
- Audit result MUST be appended to WORK_LOG_SPRINT6.md before phase push.
```

### 19.5 Audit agent provisioning status (Sprint 6 specific)

The full 5-audit bundle requires 5 audit agents. As of pre-Sprint-6-draft, only `code-reviewer-minimax-m3` is provisioned as a real agent:

| # | Audit | Provisioning | Sprint 6 ETA |
|---|---|---|---|
| 1 | code-reviewer-minimax-m3 | PROVISIONED | always available |
| 2 | security-audit | TODO skill at `skills/security-audit/SKILL.md` | S6A-T-12 |
| 3 | compliance-audit (medical) | TODO skill at `skills/medical-compliance-audit/SKILL.md` | S6A-T-13 |
| 4 | test-coverage-audit | TODO skill at `skills/test-coverage-audit/SKILL.md` | S6B-T-11 |
| 5 | perf-audit | TODO skill at `skills/perf-audit/SKILL.md` | S6C-T-12 |

Until S6A: audit bundle is `code-reviewer-minimax-m3` only (1-agent pass). It IS still mandatory per non-trivial change. Each S6A–S6I phase gate MUST include whatever audits are provisioned at that time; missing audits → BLOCKED if their target file/scope was touched by this phase.

### 19.6 Rollback playbook when audit returns CRITICAL (Sprint 6 specific)

```text
Step 1. STOP current task. Do NOT continue any further work.
Step 2. Audit finding MUST be in WORK_LOG_SPRINT6 with: severity, file path, line, what, why,
        and which PRD or spec doc is being violated.
Step 3. For each CRITICAL finding, choose ONE path:
  Path A (revert):    git revert <SHA> --no-edit (preferred for regressions, never on main).
  Path B (fix-inline): follow-up commit; if different task, open new TASK_ID with Sprint 6
                       Impact = NONE; resolve before phase gate.
  Path C (escalate):  cross-team impact, security boundary, OR AI safety violation → owner.
                       NEVER auto-resolve CRITICAL medical safety findings.
Step 4. Re-run audit bundle on chosen resolution path.
Step 5. Phase push BLOCKED until all CRITICAL findings have documented resolution passing re-audit.

NEVER mark audit WAS_WONT_FIX without explicit owner sign-off (especially for §2 §3 §20.5
violations = medical safety / forbidden actions / safety detectors).
```

---

## 20. Anti-Patterns — CRITICAL (Sprint 6 applies every task)

### 20.1 Anti-Hallucination

```text
NEVER invent (any of these = direct BLOCK):
- HL_* table names not in PRD §12.1-§12.10 (currently 10 Sprint 6 tables).
- column names not in those tables or referenced in spec docs.
- endpoint paths not in PRD §11 or sub-PRD §X.Y.
- permission codes not in §7 PRD S6A.
- feature codes not in §13.1 PRD.
- config keys not in §13.3 PRD.
- answerType values not in §8.1 (only 11 allowed).
- SafetyDecision values not in §10.2 (only 6 allowed).
- detector codes not in §10.1 (only 13 detectors).
- Cloudflare binding name (verify via wrangler.toml of TARGET worker).
- npm package name (verify via package.json of TARGET workspace).
- Worker #1–#4 task assignments (verify via §11 Worker Topology).

If unsure:
1. STOP.
2. Open PRD, schema SQL, API contract, spec doc.
3. grep candidate names via code_searcher.
4. If still not in docs: BLOCKED + exact evidence.

If conflict:
1. Follow Source of Truth Order §1.
2. Still conflict: BLOCKED; do NOT guess.
```

### 20.2 Anti-Empty-Method (no fake-pass code)

```text
FORBIDDEN in any file claiming DONE:
- Method body = "// TODO" or "// implement later" only.
- Method body = `return null;` / `return undefined;` to satisfy import.
- Method body = throw new Error("not implemented") while marked DONE.
- Test = `it('passes', () => {})` with no assertion.
- Test = `expect(true).toBe(true)` / `expect(1).toBe(1)`.
- Test mocks dependency to the point of testing nothing real.
- Test asserts mock-call not actual outcome.
- Coverage high but assertions in critical paths are trivial.
- Happy-path-only branch with no negative test.

REQUIRED for every method declared DONE:
1. Real implementation (logic, not stub).
2. At least one positive test that runs and asserts.
3. At least one negative test (wrong input / unauthorized / forbidden behavior).
4. Edge case test if method has boundary conditions.

Reviewer MUST verify assertion shape on every test.
Coverage without real assertion = lying; integrator MUST reject.
```

### 20.3 Anti-Rush

```text
FORBIDDEN shortcuts:
- Batching multiple TASK_IDs into one implementation slice.
- Skipping validation: tsc, npm test, eslint, vite build (see §7).
- Marking DONE without validation evidence in WORK_LOG.
- Skipping audit bundle before push (see §19).
- Inventing validation command that is not actually executed.
- Re-running tests against previously green baseline without re-running after change.
- Forcing task to BLOCKED → DONE to clear backlog faster.

REQUIRED discipline:
- One task cycle = 1 implementation + 1 test + 1 WORK_LOG + 1 HANDOFF update.
- Quality > speed (medical app: every bug = patient safety incident).
- Out of time → BLOCKED with safe next action. NEVER forced DONE.
- Validation for every change. No exceptions, even for "trivial" CSS / doc.
- When in doubt → timeline-based verification (cite PRD §XX.YY), NOT guess.
```

### 20.4 Anti-Over-Building (Ponytail §12 aware)

```text
- Deletion > addition. Boring > clever. Fewest files.
- BUT never at cost of:
  - Trust-boundary input validation.
  - Error handling that prevents data loss.
  - Security, accessibility, anything explicitly requested.
  - Medical safety guardrails (13 detectors, 6 base + mode-dependent forbidden actions: standard=9, proactive=8, super_aktif=6).
  - Audit logging (HL_auditLogs per §2 Sprint 5 backward compat).
- Ponytail ladder runs AFTER understanding problem end-to-end, NOT instead of.
- Correct minimal beats clever over-engineered.
```

### 20.5 Sprint-6 Specific Anti-Patterns

```text
NEVER:
- Set CLINICAL_COPILOT_ENABLED=true in production directly. Always via D1 cohort manual grant.
- Skip the 13-detector Safety Runtime v2 enforcement (every output goes through it).
- Output without server-side medical disclaimer (§3 hard boundary).
- Allow Vectorize namespace override by client (must be user:{userId} server-derived).
- Reuse unsafe response path from Sprint 5 (clinicalCopilotMode deferred; never bypass).
- Deploy to public with eval_dataset score < release gate metrics (see §15 / §16).
- Skip the 6 deterministic cron retention jobs (S6F).
- Treat Baileys VPS webhook as trusted (always verify WA_GATEWAY_SECRET, see §9 Sprint 6).
```

### 20.6 Self-Check Before Marking DONE

```text
[ ] Did I cite PRD section / schema SQL / spec doc in commit message?
[ ] Did I write at least 1 positive test + 1 negative test?
[ ] Did I run npm test (worker) or vitest (web)?
[ ] Did I run tsc + eslint + build?
[ ] Did I NOT invent any table/column/permission/feature code?
[ ] Did I NOT leave any stub / TODO / empty method?
[ ] Did I NOT skip audit (§19)?
[ ] Did I append WORK_LOG_SPRINT6.md entry with evidence?
[ ] Did I update HANDOFF_SPRINT6.md to next task ID?
[ ] Did I respect Sprint 1–5 backward compat?
[ ] Did I respect 13-detector Safety Runtime for any output?
[ ] Did I respect medical disclaimer requirement?
[ ] Did I declare Sprint 6 Impact (NONE / READ-ONLY / BLOCKING) if Lane B?
```

Any unchecked = NOT DONE. Continue until all pass.

