# AGENTS.md — Sprint 5 Compact AI-Agent Rules

Product: iSehat  
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
- Put long debug output in separate files under archive/docs/logs/ if needed.
- HANDOFF.md is the single resume pointer.
- Agents should read only latest WORK_LOG entries, not the entire history.
```

If old pre-Sprint-5 logs exist, archive them outside the active context. Do not paste old logs into prompts.

---

## 11. Safe Agent Prompts

First run prompt:

```text
Implement iSehat Sprint 5. Read AGENTS.md, HANDOFF.md, latest WORK_LOG.md, and only the current task section from docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md. Start with the task shown in HANDOFF.md only. Complete exactly one task cycle at a time. Follow TDD, run validation, update WORK_LOG.md and HANDOFF.md, then continue to the next READY task/phase automatically until Sprint 5 Cross-Phase Release Gate is DONE or a real BLOCKED condition occurs.
```

Resume prompt:

```text
Continue iSehat Sprint 5 from HANDOFF.md. Identify the current/next task, read only relevant final docs, complete one task cycle, run validation, update WORK_LOG.md and HANDOFF.md, then continue sequentially to the next READY task/phase automatically until Sprint 5 Cross-Phase Release Gate is DONE or a real BLOCKED condition occurs.
```

Failure prompt:

```text
Audit the current failed task only. Read HANDOFF.md, latest WORK_LOG.md, the current task section, related API/SQL sections, and test output. Fix the smallest cause, rerun validation, update logs, then continue sequentially if the task becomes DONE. Stop only if the task remains BLOCKED with exact evidence.
```

---

## 12. Ponytail — Lazy Senior Dev (Instruction-Only Fallback)

### iSehat ↔ Ponytail precedence (read this first)

Ponytail governs the *shape* (deletion over addition, fewest files,
shortest working diff). iSehat governs the *substance* (source-of-truth
order in §1, hard-boundary rules in §2, TDD in §6, done/blocked in §8).
When in doubt: hard-boundary rule wins, then source-of-truth, then the
Ponytail ladder. Ponytail *never* overrides medical-safety, secret-handling,
Cloudflare-D1 invariants, or backward-compatibility with Sprint 1–4.

### Persistence

ACTIVE EVERY RESPONSE. No drift back to over-building. Still active if
unsure. Off only: explicit "stop ponytail" / "normal mode".

### Mode

Default: `full`. Override with: `lite | full | ultra`.

### OpenCode plugin wins (when both loaded)

If `skills/ponytail/SKILL.md` is also loaded by your host adapter
(e.g. the OpenCode plugin via `./.opencode/plugins/ponytail.mjs`),
treat THAT file as canonical. This §12 is the **fallback only** for
agents that read project-root `AGENTS.md` and cannot load the plugin
(Codebuff / Freebuff / Claude Code / Codex extension in VS Code).

### Source

`https://github.com/DietrichGebert/ponytail` (MIT).

### The ladder

Stop at the first rung that holds:

```text
1. Does this need to exist at all?         YAGNI, skip it.
2. Already in this codebase?               reuse it. Grep first.
3. Stdlib does it?                         use stdlib.
4. Native platform feature covers it?      use native. <input type="date">, CSS over JS, DB constraint over app code.
5. Already-installed dependency solves it? use it. Don't add a new one for what a few lines can do.
6. Can it be one line?                     one line.
7. Only then:                              the minimum code that works.
```

The ladder runs *after* you understand the problem, not instead of it.
Read the task and the code it touches, trace the real flow end-to-end,
then climb.

### Bug fix = root cause, not symptom

A report names a symptom. Grep every caller of the function you will
touch. Fix once in the shared function — one guard there is a smaller
diff than one per caller, and patching only the ticket-named path leaves
sibling callers still broken.

### Rules

```text
- No unrequested abstractions (no interface with one implementation, no factory for one product, no config for a constant).
- No new dependency if avoidable. No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins — but only once you understand the problem.
- Question complex requests: "Do you actually need X, or does Y cover it?".
- Mark deliberate simplifications with a `ponytail:` comment; if there's a known ceiling (global lock, O(n²) scan, naive heuristic), the comment names the ceiling AND the upgrade path.
```

### When NOT to be lazy

```text
- Trust-boundary input validation.
- Error handling that prevents data loss.
- Security, accessibility, anything explicitly requested.
- Understanding the problem: read fully, trace the real flow, THEN be lazy.
- One runnable check behind non-trivial logic (assert-based demo() or one test file). YAGNI applies to tests too; trivial one-liners need no test.
```

---

## 13. Git Versioning Best Practices

### 13.1 Branch per phase

```text
- One phase = one branch: sprint6/S6A, sprint6/S6B, ..., sprint6/S6I.
- Never commit phase implementation directly to main. Phase branches only.
- Tag the merge commit of each phase as sprint6-<phase>-DONE.
```

### 13.2 Worktree per scope (only when needed)

```text
- Default: work in main worktree on the phase branch.
- If scope conflict (e.g., Lane A Sprint 6 + Lane B Sprint 5 fixes touch main),
  use git worktree add ../wt-<branch> -b <branch> main for isolation.
- Worktrees share .git/ but isolate working tree + index + staged changes.
```

### 13.3 Commit per task

```text
- One task ID = one commit. No batching.
- Conventional Commits scope: [sprint6/<phase>] <task code>: <imperative title>
  or [fix/...] <scope>: <title> for Lane B.
- Commit message body MUST cite the PRD section or spec doc being implemented.
```

### 13.4 Push per phase gate (not per task)

```text
- Local commits accumulate per task. No push per task.
- Push only at the phase gate, AFTER:
  1. Full cycle test green (worker tsc + npm test, web tsc + eslint + build).
  2. D1 migration applied + PRAGMA foreign_key_check clean.
  3. Audit bundle complete (code-reviewer + security-audit + compliance-audit + coverage + perf).
  4. HANDOFF update + WORK_LOG entry per task complete.
- Then: git push -u origin sprint6/<phase>.
- NEVER git push origin main --force.
- NEVER git push --force-with-lease to main (use merge, not rebase, on shared branches).
```

### 13.5 Forbidden destructive operations (without explicit user approval)

```text
- git reset --hard once pushed.
- git push --force to main.
- git clean -fd while uncommitted work exists.
- git branch -D on a branch with unpushed commits.
- git push origin main directly (main only accepts merges from approved branches).
- git fetch origin && git rebase on pushed branches (use merge instead).
```

---

## 14. Multi-Agent Parallelism Best Practices

### 14.1 When CAN a sprint be split across agents

```text
YES, only if all three:
1. File-disjoint: no shared source file between agents.
2. Dependency-disjoint: no inter-task import / function call between agents.
3. Quota-disjoint: no shared D1 write target race condition.
```

### 14.2 Per-agent rules

```text
- 1 agent = 1 sub-branch: agent-<id>/<lane> from main.
- 1 agent = 1 specific task ID from TASK_PLAN (never invent task IDs).
- 1 agent = 1 allowed file path list (touch only allowed paths; integrator rejects out-of-scope).
- 1 agent outputs 1 commit per task with scope: [agent-<id>] <task code>: <title>.
- 1 agent NEVER invents: permission codes, table columns, config keys, endpoint paths.
- 1 agent's commit message MUST cite PRD section or TASK_PLAN task ID.
```

### 14.3 Integrator (Buffy) role

```text
- Spawn each agent with disjoint scope verification.
- After ALL agents DONE: merge sub-branches into phase branch.
- Run full cycle test on merged result.
- Resolve conflicts (favor canonical PRD-aligned version).
- Update HANDOFF + WORK_LOG + commit meta.
- Spawn audit bundle per §15.
```

### 14.4 Conflict resolution

```text
- Same file edited by 2 agents: integrator picks version (default = later agent if PRD-aligned,
  else integrator rewrites to PRD canonical).
- Same task ID claimed by 2 agents: first to commit wins; second agent BLOCKED.
- Non-canonical column invented by agent: rolled back post-review.
- Out-of-scope file touched by agent: integrator reverts that part of commit, keep in-scope.
```

### 14.5 Failure mode triages

| Mode | Detection | Response |
|---|---|---|
| Same file, different changes | git merge conflict | Integrator runs git diff + cherry-picks |
| Same permission code, different meaning | post-merge audit | Reverted to PRD canonical |
| Agent declared DONE without validation | WORK_LOG entry check | Rollback to last verified commit |
| Agent invents task ID | TASK_PLAN grep | Reject commit, redirect to next valid task |
| Sprint 6 Impact = BLOCKING from Lane B | cross-lane check | Hold merge; escalate to owner |

---

## 15. Audit & Review Best Practices

### 15.1 Per-task audit (mandatory for non-trivial changes)

```text
- After every non-trivial diff, spawn code-reviewer-minimax-m3.
- Verify: anti-pattern, dead code, naming, type safety, duplication, error handling.
- Output: per-line feedback, severity tiers.
- ~1 min per task. Worth it.
```

### 15.2 Per-phase audit bundle (after Phase Gate passes implementation)

Spawn 5 audits in parallel after phase implementation complete:

| # | Audit | Checks |
|---|---|---|
| 1 | code-reviewer-minimax-m3 | semantic + quality + duplication + dead code |
| 2 | security-audit | secrets, OWASP top 10, IDOR, RBAC race, escalation paths, input validation |
| 3 | compliance-audit (medical) | §12.1 secret scan, §12.2 sensitive data access, §12.4 medical safety (no diagnosis, disclaimer always, guardrail blocking not toast-only) |
| 4 | test-coverage-audit | 95-item (Sprint 5) / 65-detector (Sprint 6) matrix mapping; gaps identified |
| 5 | perf-audit | N+1 detection, query plan analysis, p95 latency, memory profile |

After all 5 complete: integrator merges findings, addresses P0 immediately, schedules P1/P2.

### 15.3 Cross-phase audit (only at S6I Hardening release gate)

```text
- Full audit pass across all 9 phases (S6A → S6I).
- Includes: §18 Cross-Phase Release Gate steps + 1000-case eval dataset + 7-day closed beta.
- Mandatory before setting clinicalCopilot.enabled = true for premium users.
```

### 15.4 Audit vs self-declare

```text
- NEVER allow agent to self-declare DONE without per-task audit feedback.
- NEVER allow agent to skip per-phase audit bundle before push.
- NEVER allow phase push without all 5 audits returning clean (or P1/P2 triaged).
- Audit result MUST be appended to WORK_LOG before phase push.
```

### 15.5 Audit agent provisioning status

Only `code-reviewer-minimax-m3` is provisioned as an actual agent today. Others are spec-only and require a registered skill OR custom agent definition before they can be spawned.

| # | Audit | Status | Where it lives now |
|---|---|---|---|
| 1 | code-reviewer-minimax-m3 | PROVISIONED | built-in `code-reviewer-minimax-m3` tool |
| 2 | security-audit | SPEC-ONLY | needs `skills/security-audit/SKILL.md` or custom agent |
| 3 | compliance-audit (medical) | SPEC-ONLY | needs `skills/medical-compliance-audit/SKILL.md` |
| 4 | test-coverage-audit | SPEC-ONLY | needs `skills/test-coverage-audit/SKILL.md` |
| 5 | perf-audit | SPEC-ONLY | needs `skills/perf-audit/SKILL.md` |

Until #2–#5 are provisioned, the per-phase audit bundle (§15.2) is a single-agent pass with `code-reviewer-minimax-m3` — acceptable as fallback but not equivalent to full multi-audit coverage. Provisioning backlog tracked in `docs_sprint6/AGENTS_SPRINT6.md` §19 reference.

### 15.6 Rollback playbook when audit returns CRITICAL

```text
Step 1. STOP current task. Do NOT continue any further work.
Step 2. Audit finding MUST be in WORK_LOG with: severity, file path, line, what, why,
        and which PRD or spec doc is being violated.
Step 3. For each CRITICAL finding, choose ONE path:
  Path A (revert):    git revert <SHA> --no-commit (preferred for regressions; never on main).
  Path B (fix-inline): follow-up commit; if different task → open new TASK_ID with
                       Sprint-Impact = NONE; resolve before phase gate.
  Path C (escalate):  cross-team impact, security boundary, OR PRD hard-boundary violation
                       (see §2) → escalate to owner. NEVER auto-resolve.

Step 4. Re-run audit bundle on the chosen resolution path.
Step 5. Only proceed to next phase push after all CRITICAL findings have a documented
       resolution path that re-passes the audit.

NEVER silence an audit finding by marking WAS_WONT_FIX without explicit owner sign-off.
Audit findings are evidence; deleting evidence without resolution = bug-mask.
```

---

## 16. Anti-Patterns (CRITICAL — applies every task)

### 16.1 Anti-Hallucination (NEVER invent)

```text
NEVER invent:
- table names (verify via PRAGMA table_info or schema SQL)
- column names (verify via schema SQL, not PRD narrative)
- endpoint paths (verify via API contract §)
- permission codes (verify via seed SQL feature codes)
- feature codes (verify via seed SQL)
- config keys (verify via systemConfigs seed)
- answerType values (verify via CLINICAL_RESPONSE_SCHEMA §8.1, only 11 allowed)
- SafetyDecision values (verify via AI_SAFETY_RUNTIME_SPEC, only 6 allowed)
- detector codes (verify via AI_SAFETY_RUNTIME_SPEC §10.1, only 13 detectors)
- Cloudflare binding name (verify via wrangler.toml of target worker)
- npm package name (verify via package.json of target workspace)

If unsure:
1. STOP.
2. Open the relevant Sprint doc (PRD, schema, API contract, spec).
3. Use code_searcher or file_picker to grep candidate names.
4. If still not in docs: BLOCKED with exact evidence.

If conflict:
1. Follow Source of Truth Order (§1 of root AGENTS, §1 of AGENTS_Sprint6).
2. If still conflict: mark BLOCKED, do NOT guess.
```

### 16.2 Anti-Empty-Method (no fake-pass code)

```text
FORBIDDEN patterns (any of these = invalid DONE claim):
- Method containing only "// TODO" or "// implement later" comment.
- Method containing only `return null;` or `return undefined;` to satisfy import.
- Method throwing "NotImplementedError" while marked DONE.
- Test marked pass without any assertion (e.g., `it('passes', () => {})`).
- Test using only `expect(true).toBe(true)` or `expect(1).toBe(1)`.
- Test mocking dependency so heavily it does not test real behavior.
- Test asserting mock was called (not actual outcome).
- Coverage number high (e.g. 95%) but no real assertion in critical paths.
- Implementing a "happy path only" branch without negative test.

REQUIRED for every method declared DONE:
1. Real implementation body (logic, not stub).
2. At least one test that runs and asserts behavior.
3. At least one negative test (wrong input fails, unauthorized rejected, etc.).
4. Edge case test if method has boundary conditions.

Reviewer MUST verify assertion shape on every test added.
Coverage without real assertions = lying; integrator MUST reject.
```

### 16.3 Anti-Rush (no fast-pass through tasks)

```text
FORBIDDEN shortcuts:
- Batching multiple TASK_IDs into one implementation slice.
- Skipping validation (tsc / npm test / eslint / vite build).
- Marking DONE without validation evidence in WORK_LOG.
- Skipping audit bundle before push (see §15).
- Inventing validation command that is not actually executed.
- Running tests against previous green baseline without re-running after change.
- Declaring BLOCKED as DONE to clear backlog faster.

REQUIRED discipline:
- One task cycle = 1 implementation slice + 1 test + 1 WORK_LOG entry + 1 HANDOFF update.
- Quality over speed (medical app — every bug = potential patient safety incident).
- If running out of time → mark BLOCKED + write safe next action. NEVER forced DONE.
- Validation FOR every change — no exceptions, even for "trivial" CSS or doc fixes.
- WHEN in doubt → timeline-based (PRD section §XX.YY) verification, NOT guess.
```

### 16.4 Anti-Over-Building (Ponytail-aware, see §12)

```text
- Deletion > addition. Boring > clever. Fewest files.
- BUT never at the cost of:
  - Trust-boundary input validation
  - Error handling that prevents data loss
  - Security, accessibility, anything explicitly requested
  - Medical safety guardrails
  - Audit logging
- Ponytail ladder runs AFTER understanding the problem end-to-end, NOT instead of.
- A correct minimal implementation beats a clever over-engineered one.
```

### 16.5 Self-Check Before Marking DONE

For every implementation slice, agent MUST self-check against this list before writing DONE in WORK_LOG:

```text
[ ] Did I cite PRD section / schema SQL / spec doc in commit message?
[ ] Did I write at least 1 positive test + 1 negative test?
[ ] Did I run npm test (worker) or vitest (web)?
[ ] Did I run tsc + eslint + build?
[ ] Did I NOT invent any table/column/permission/feature code?
[ ] Did I NOT leave any stub / TODO / empty method?
[ ] Did I NOT skip audit (per §15)?
[ ] Did I append WORK_LOG entry with evidence (commands run + result)?
[ ] Did I update HANDOFF to next task ID?
[ ] Did I respect Sprint 1–5 backward compat (no breaking change)?
```

If any checkbox unchecked: NOT DONE. Continue the task until all pass.
