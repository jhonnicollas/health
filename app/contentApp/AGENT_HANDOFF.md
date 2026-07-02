# AGENT_HANDOFF — iSehat Content Engine CE-1

Operational resume file for the coding agent executing CE-1.

```text
Current scope: CE-1 Text Content Engine + Safety Checker
Worker: worker/content/
Database: multi_Ai_db (b80ca989-6771-427f-a656-c7ab6ffc17ce)
D1 binding: DB
Start file: app/contentApp/current-task.md
```

---

## 1. Read First

Before touching code, read in this order:

```text
1. app/contentApp/AGENT_HANDOFF.md       ← this file
2. app/contentApp/current-task.md        ← live current/next task
3. app/contentApp/IMPLEMENTATION_GUIDE.md
4. app/contentApp/docs/07.TASK_CE1.md    ← current sprint/phase/task
5. Related spec for the current task:
   - 02.SRS_ISEHAT_CONTENT_ENGINE.md
   - 05.ISEHAT_CONTENT_ENGINE_ARCHITECTURE.md
   - 03.DB_SCHEMA.sql
   - 04.API_CONTRACT.md
   - 06.PROMPTS_CE1.md
   - 08.TEST_PLAN_CE1.md
```

---

## 2. Do Not Implement CE-2+

Forbidden in CE-1:

```text
R2 rendering, image/video generation, auto-publish, platform OAuth,
external scheduler, analytics import, Vectorize learning loop,
TikTok/YouTube/Facebook publishing, platform webhooks,
public content editor, multi-brand SaaS, content scoring analytics.
```

If a forbidden route is accidentally created, return:

```json
{ "ok": false, "error": { "code": "NOT_FOUND", "message": "This feature is not part of CE-1." } }
```

---

## 3. Start Task ID

CE-1 starts at **CE1-T010** (install DB migration).

Sprint order:

```text
CE1.1 Foundation          → CE1-T010 ... CE1-T035
CE1.2 Core Content & AI   → CE1-T040 ... CE1-T071
CE1.3 Safety/Export/Dashboard → CE1-T080 ... CE1-T111
CE1.4 Frontend/Hardening  → CE1-T120 ... CE1-T14x
```

See `app/contentApp/docs/07.TASK_CE1.md` for exact task IDs.

---

## 4. Tests After Each Phase

Run after every task:

```bash
cd worker/content
npm run typecheck
node --test test/<domain>.test.mjs
```

Run at the end of every sprint:

```bash
cd worker/content
npm run typecheck
npm test
npx wrangler d1 execute multi_Ai_db --local --command="PRAGMA foreign_key_check;"
```

Run at end of CE1.4:

```bash
npm run typecheck
npm test
npx wrangler deploy --dry-run
```

---

## 5. If a Test Fails — Bug Report

Stop. Do not mark the task DONE. Write a bug report in `app/contentApp/logs/`:

```text
- Task ID:
- File + line:
- Expected:
- Actual:
- Repro command:
- Root cause hypothesis:
- Safest next action:
```

Then fix the smallest cause, rerun the test, and update `current-task.md`.

---

## 6. If Context Is Interrupted

Resume from `app/contentApp/current-task.md`.

```text
1. Read current-task.md.
2. Read the task section in 07.TASK_CE1.md.
3. Read only the spec sections related to that task.
4. Continue from the status shown (pending/in_progress/blocked).
5. Run validation before claiming DONE.
```

---

## 7. Do Not Change Schema/API Without Updating Docs

If a schema or API change is unavoidable:

```text
1. Update 03.DB_SCHEMA.sql first.
2. Update 04.API_CONTRACT.md.
3. Update 06.PROMPTS_CE1.md if AI output shape changes.
4. Update 08.TEST_PLAN_CE1.md.
5. Update 02.SRS / 05.ARCHITECTURE if behavior changes.
6. Re-run migration and tests.
```

Never let code drift ahead of the docs.
