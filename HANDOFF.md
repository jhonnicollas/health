# HANDOFF.md — Sprint 5 Compact Resume State

Product: HL Health Companion  
Scope: Sprint 5 Foundation + 5A + 5B + 5C + 5D + 5E  
Mode: compact resume pointer for AI coding agents

---

## Current State

```text
Sprint: Sprint 5 Full Release Program
Current Phase: Sprint 5 Foundation
Current Task: S5F-009 — Plan, feature, subscription, entitlement APIs
Current Status: IN_PROGRESS
Last Completed Task: S5F-008 — Role dan permission admin APIs
Next Recommended Task: S5F-009 — Plan, feature, subscription, entitlement APIs
Active Agent: Codex
Last Updated: 2026-06-24 19:40 UTC
```

---

## Source Documents

Use these final docs only:

```text
docs_sprint5/01.PRD_SPRINT5_FULL_FINAL_REVISED_AI_SPRINT6_READY.md
docs_sprint5/02.PRD_USER_STORIES_SPRINT5_FULL_FINAL_REVISED_AI_SPRINT6_READY.md
docs_sprint5/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql
docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql
docs_sprint5/05-ARCHITECTURE_REVISED_AI_SPRINT6_READY.md
docs_sprint5/06-design-system_REVISED_AI_SPRINT6_MOCKUP_READY.md
docs_sprint5/07.API_CONTRACT_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.md
docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md
docs_sprint5/08.a.SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html
docs_sprint5/08.B.SPRINT5_MOCKUP_TASKPLAN_ANCHOR_REGISTRY.md
docs_sprint5/09.TEST_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_READY.md
docs_sprint5/10.STRESS_TEST_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_READY.md
docs_sprint5/11.TDD_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL_READY.md
AGENTS.md
HANDOFF.md
WORK_LOG.md
```

Do not use older draft docs as implementation source unless a task explicitly says to compare/archive them.

---

## Resume Algorithm

Every agent must do this first:

```text
1. Read this HANDOFF.md.
2. Read AGENTS.md.
3. Read latest 3–5 entries in WORK_LOG.md.
4. Open only the current task section in docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md.
5. Open only related API/SQL/PRD/Test sections.
6. Implement one task only.
7. Run validation.
8. Append WORK_LOG.md.
9. Update this HANDOFF.md.
10. Stop.
```

If timeout/token limit happens, the next agent resumes from `Current Task` + latest `WORK_LOG.md` entry.

---

## Hard Boundaries to Preserve

```text
- Use HL_safetyEvents for Sprint 5 red flag, overhydration, cycle irregularity, and Telegram security events.
- Do not use HL_alerts except existing measurement-centric Sprint 1–4 alerts.
- Use HL_userEducationProgress, not HL_educationViews.
- Secret values must not be stored in D1, seed, frontend bundle, API response, logs, audit metadata, screenshots, or test snapshots.
- Admin/security-sensitive mutation audit uses HL_auditLogs: userId, action, entityType, entityId, metadataJson.
- Server-side guards are required for auth, permission, entitlement, quota, family permission, cycle eligibility, webhook/cron secrets, red flag, and AI disclaimer.
- Sprint 1–4 login, measurement submit, AI Vision, manual override, rule engine, family alert, medication, fasting, report/PDF, history, export, PWA, and settings must not regress.
```

---

## Active Task Slot

Update this section before and after every task.

```text
Task ID: S5F-009
Task Title: Plan, feature, subscription, entitlement APIs
Phase: Sprint 5 Foundation
Status: IN_PROGRESS
Dependencies: S5F-006 (Done), S5F-003 (Done)
Files Planned: worker/routes/admin-billing, worker/routes/me or nearest existing worker module
Validation Planned: worker tsc/test and web tsc/eslint/build if touched
Blocker: none
```

---

## Last Validation Summary

```text
Commands Run:
- cd worker && npx tsc -p tsconfig.json — PASS
- cd worker && npm test — PASS (47/47)
- cd web && npx tsc -b — PASS
- cd web && npx eslint . — PASS
- cd web && npx vite build — PASS
Result: S5F-008 completed; role/permission admin APIs added with RBAC, permission replacement, user role assign, soft revoke, and audit writes.
```

---

## Known Risks

```text
1. Role admin APIs are backend-ready; S5F-009 must wire billing/entitlement APIs using EntitlementService and QuotaService.
2. Old production secrets or partial tokens must never be copied into Sprint 5 docs, logs, prompts, or tests.
3. Sprint 5 is large; agents must not batch multiple tasks.
4. If a final doc mismatch is found, block and log it instead of guessing.
```

---

## Next Task Queue

Start strictly in this order:

```text
S5F-000 — Document and source-of-truth preflight
S5F-001 — Apply and validate SQL schema + seed Sprint 5
S5F-002 — Type domain, DTO, shared constants
S5F-003 — Audit service wrapper
S5F-004 — Secret-safe config service
```

After that, continue from `docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md` phase order.

---

## Handoff Update Template

Replace the active task slot after every task:

```markdown
## Current State

```text
Sprint: Sprint 5 Full Release Program
Current Phase: <phase>
Current Task: <next task id>
Current Status: IN_PROGRESS | IN_PROGRESS | BLOCKED | NEEDS_REVIEW | DONE
Last Completed Task: <task id or none>
Next Recommended Task: <task id + title>
Active Agent: <agent name or none>
Last Updated: YYYY-MM-DD HH:mm UTC
```

## Last Validation Summary

```text
Commands Run:
- <command> — PASS/FAIL/NOT_RUN(reason)
Result: <short result>
```

## Known Risks

```text
- <only current relevant risk>
```
```








