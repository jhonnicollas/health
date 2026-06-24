# AGENTS.md — Sprint 5 Compact AI-Agent Rules

Product: HL Health Companion  
Scope: Sprint 5 Foundation + 5A + 5B + 5C + 5D + 5E  
Mode: compact, resume-safe, vibe-coding safe  
Status: use this file as the runtime rulebook for coding agents.

---

## 0. Compact Context Rule

Do not paste whole PRD/API/SQL/Test docs into the model context. Read only:

1. this `AGENTS.md`;
2. `HANDOFF.md`;
3. latest 3–5 entries in `WORK_LOG.md`;
4. current task section from `docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md`;
5. directly relevant endpoint section from `docs_sprint5/07.API_CONTRACT_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.md`;
6. directly relevant schema/table from `docs_sprint5/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql` and seed code from `docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql`.

All Sprint 5 final docs are in the `docs_sprint5/` folder.

If unsure, search the repo/docs. Do not invent tables, endpoints, fields, permissions, or feature codes.

---

## 1. Source of Truth Order

When documents conflict, use this order:

```text
1. docs_sprint5/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql = table names, columns, constraints, indexes.
2. docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql = role, permission, plan, feature, config codes.
3. docs_sprint5/07.API_CONTRACT_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.md = endpoint path, method, auth guard, response envelope, table usage.
4. docs_sprint5/02.PRD_USER_STORIES_SPRINT5_FULL_FINAL_REVISED_AI_SPRINT6_READY.md = product behavior, UX behavior, acceptance criteria, safety behavior.
5. docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md = task order, dependency, owner, validation.
6. docs_sprint5/05-ARCHITECTURE_REVISED_AI_SPRINT6_READY.md = architecture reference.
7. docs_sprint5/09.TEST_PLAN + docs_sprint5/11.TDD_PLAN + docs_sprint5/10.STRESS_TEST_PLAN = validation strategy.
8. AGENTS/HANDOFF/WORK_LOG = execution and resume state only.
```

If conflict still exists, stop. Mark task `BLOCKED` in `HANDOFF.md` and append `WORK_LOG.md` with exact conflict.

---

## 2. Mandatory Hard Boundaries

```text
- Sprint 5 non-metric safety events use HL_safetyEvents, not HL_alerts.
- HL_alerts stays only for existing Sprint 1–4 measurement-centric alerts.
- Education progress uses HL_userEducationProgress, not HL_educationViews.
- No plaintext secret in D1, seed, frontend bundle, API response, log, test snapshot, or audit metadata.
- Real secrets live in Cloudflare Secrets/Env. D1 may store only configured/masked/envVarName/secretRef metadata.
- Admin/security-sensitive mutations write existing HL_auditLogs using: userId, action, entityType, entityId, metadataJson.
- All auth, admin permission, entitlement, quota, family permission, cycle eligibility, webhook, cron, red flag, disclaimer checks are server-side.
- Sprint 1–4 behavior must remain backward compatible.
```

Forbidden names unless explicitly found in final docs:

```text
HL_educationViews
HL_userPreferences for education progress
actorId/targetType/targetId in HL_auditLogs
plaintext Google/OAuth/Telegram/AI/Billing/Internal secrets
```

---

## 3. Medical and Privacy Safety

AI must not:

```text
- decide emergency;
- diagnose definitively;
- prescribe medicine;
- change medication dosage;
- claim it replaces doctors;
- be the only source of medical severity/guardrail.
```

Required deterministic rules:

```text
- Measurement status/severity comes from existing HL_metricRules flow.
- Symptom red flag is deterministic server-side.
- Overhydration is warning only, not diagnosis.
- Cycle contraception guardrail is blocking UI, not toast-only.
- AI medical output must include server-side disclaimer.
```

Sensitive data:

```text
symptom detail, red flag detail, cycle, pregnancy, lactation, menopause, AI memory, doctor report detail, caregiver access, support/admin sensitive access
```

Access requires owner OR explicit family permission OR restricted admin permission + audit.

---

## 4. Execution Protocol

Run Sprint 5 autonomously until the full Sprint 5 release gate is complete.

```text
1 phase → 1 task → 1 implementation slice → 1 test run → 1 WORK_LOG entry → 1 HANDOFF update → next task
```

Do not batch tasks inside one implementation slice. Complete exactly one task cycle at a time, then immediately continue to the next READY task from the task plan unless the current task is BLOCKED or the entire Sprint 5 program is DONE.

Phase order:

```text
Foundation → 5A → 5B → 5C → 5D → 5E → Cross-Phase Release Gate
```

Parallel work is allowed only after Foundation backend guards are complete and dependencies are satisfied.

Autonomous continuation rules:

```text
- After each DONE task, update HANDOFF.md to the next task and continue execution immediately.
- After each DONE phase, run that phase's required tests/UAT checks, update WORK_LOG.md and HANDOFF.md, then continue to the next phase.
- After 5E is DONE, execute the Cross-Phase Release Gate: full regression, TDD plan checks, UAT plan checks, stress test plan checks, documentation update, and only then deployment if the gate explicitly requires it.
- Stop only for BLOCKED conflict/missing dependency/unavailable secret/environment failure, or after Sprint 5 Cross-Phase Release Gate is fully DONE.
```

---

## 5. Agent Start Checklist

Before editing code:

```text
[ ] Read HANDOFF.md first.
[ ] Read latest 3–5 WORK_LOG.md entries.
[ ] Identify current/next task ID from HANDOFF.md.
[ ] Open only that task in docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md.
[ ] Open related API endpoint section if backend/API task.
[ ] Open related SQL table/seed rows if DB/service task.
[ ] Confirm dependencies are done.
[ ] Write or identify failing test first when task is code-related.
[ ] Update HANDOFF.md status to IN_PROGRESS before major edits.
```

Do not start another task until the current one is fully validated or blocked. Once validated and marked DONE, continue immediately to the next task without waiting for user instruction.

---

## 6. TDD Rule

For every code task:

```text
RED: write/identify failing test for the task.
GREEN: implement smallest passing change.
REFACTOR: clean only touched area.
SECURITY: add/confirm negative auth/privacy/secret test.
LOG: update WORK_LOG and HANDOFF.
NEXT: continue to the next READY task, next phase, or Cross-Phase Release Gate.
```

No test placeholder may be marked pass unless it actually runs or is explicitly documented as manual-only.

End-of-phase and final-gate validation must include the applicable files in:

```text
docs_sprint5/09.TEST_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_READY.md
docs_sprint5/10.STRESS_TEST_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_READY.md
docs_sprint5/11.TDD_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL_READY.md
```

---

## 7. Validation Commands

Run relevant commands before marking done.

Backend/API:

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

D1 migration/local validation:

```bash
wrangler d1 execute multi_Ai_db --local --file=07-schema.sql
wrangler d1 execute multi_Ai_db --local --file=08-seed.sql
wrangler d1 execute multi_Ai_db --local --file=docs_sprint5/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql
wrangler d1 execute multi_Ai_db --local --file=docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql
wrangler d1 execute multi_Ai_db --local --command="PRAGMA foreign_key_check;"
```

If a command cannot run, write exact reason in `WORK_LOG.md` and `HANDOFF.md`.

---

## 8. Done / Blocked Rules

A task is DONE only if:

```text
[ ] implementation complete;
[ ] tests/validation run or documented manual validation completed;
[ ] no unrelated refactor;
[ ] no secret leaked;
[ ] no unsupported table/endpoint invented;
[ ] Sprint 1–4 regression risk checked;
[ ] WORK_LOG.md appended;
[ ] HANDOFF.md updated with next task.
```

Mark BLOCKED when:

```text
- source docs conflict;
- required table/column/permission/endpoint is missing;
- secret/config is unavailable;
- dependency task is incomplete;
- validation cannot run for environment reason.
```

Blocked entry must include exact blocker, evidence, and safest next action.

---

## 9. File Editing Discipline

```text
- Read before edit.
- Modify only files needed by current task.
- Do not reformat unrelated files.
- Do not delete prior logs.
- Do not move or rename docs unless task requires it.
- Do not create new D1 database/R2 bucket.
- Do not deploy production unless the current task/release gate explicitly says deploy.
```

Large refactor rule: checkpoint `HANDOFF.md` before starting any risky refactor.

---

## 10. Compact WORK_LOG Policy

To avoid context-limit problems:

```text
- WORK_LOG.md contains Sprint 5 entries only.
- Keep each entry under 25 lines.
- Put long debug output in separate files under docs/logs/ if needed.
- HANDOFF.md is the single resume pointer.
- Agents should read only latest WORK_LOG entries, not the entire history.
```

If old pre-Sprint-5 logs exist, archive them outside the active context. Do not paste old logs into prompts.

---

## 11. Safe Agent Prompts

First run prompt:

```text
Implement HL Health Companion Sprint 5. Read AGENTS.md, HANDOFF.md, latest WORK_LOG.md, and only the current task section from docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md. Start with the task shown in HANDOFF.md only. Complete exactly one task cycle at a time. Follow TDD, run validation, update WORK_LOG.md and HANDOFF.md, then continue to the next READY task/phase automatically until Sprint 5 Cross-Phase Release Gate is DONE or a real BLOCKED condition occurs.
```

Resume prompt:

```text
Continue HL Health Companion Sprint 5 from HANDOFF.md. Identify the current/next task, read only relevant final docs, complete one task cycle, run validation, update WORK_LOG.md and HANDOFF.md, then continue sequentially to the next READY task/phase automatically until Sprint 5 Cross-Phase Release Gate is DONE or a real BLOCKED condition occurs.
```

Failure prompt:

```text
Audit the current failed task only. Read HANDOFF.md, latest WORK_LOG.md, the current task section, related API/SQL sections, and test output. Fix the smallest cause, rerun validation, update logs, then continue sequentially if the task becomes DONE. Stop only if the task remains BLOCKED with exact evidence.
```
