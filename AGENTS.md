# AGENTS.md — HL Health Companion Multi-Agent Rules

## 1. Purpose

This file is the main operating rulebook for every AI coding agent working on **HL Health Companion**.

The project is a Cloudflare-first health logging web app. It uses:

- Cloudflare Workers
- Hono.js
- Cloudflare Workers AI Vision Model
- Cloudflare Workers AI Text LLM
- Cloudflare D1 binding `DB`
- Cloudflare R2 binding `LOGS`
- Cloudflare Queues
- Cloudflare Cron Triggers
- Wrangler
- React SPA / PWA frontend

Every agent must prioritize resume-safe work. Any sprint may be interrupted, so every task must leave enough logs and checklist updates for the next agent to continue.

---

## 2. Mandatory Project Context Files

Before starting any task, every agent must read these files in this order:

1. `PRD.docx.md` or exported PRD markdown, if available
2. `PRD_UserStory.docx.md` or exported user story markdown, if available
3. `ARCHITECTURE.md`
4. `api-contract.md`
5. `schema.sql`
6. `seed.sql`
7. `design-system.md`
8. `TASKS.md`
9. `WORK_LOG.md`
10. `HANDOFF.md`

If a file does not exist yet, the agent must create it only when the current task requires it.

---

## 3. Non-Negotiable Product Rules

### 3.1 Rule First, AI Assisted

Medical status must never be decided freely by AI.

Required flow:

```text
finalValue
→ HL_metricRules rules engine
→ status, severity, popup, emergencyLevel
→ AI only generates safe explanation, summary, or trend insight
```

AI must not:

- diagnose disease
- prescribe medicine
- change medication dosage
- replace doctor advice
- claim certainty from correlations

### 3.2 Manual Override Is Mandatory

Every extracted AI value must be editable before submit.

Required fields in final measurement value:

```text
rawAiValue
finalValue
confidence
manualOverride
status
severity
ruleId
```

If `finalValue` differs from `rawAiValue`, set:

```text
manualOverride = 1
```

### 3.3 Original Image Must Not Be Stored

Original images are never stored in R2.

Allowed storage:

```text
final compressed watermarked attachment only
```

R2 path pattern:

```text
HL/users/{userId}/measurements/{sessionId}/{metricCode}-{attachmentId}.webp
```

### 3.4 AI Vision Must Not Block User

AI Vision must target completion within a configurable timeout limit (from DB).

Required behavior:

```text
AI success <= timeout limit → fill text box
AI timeout > timeout limit → show manual input
AI failed → show manual input
No automatic AI retry by default
```

### 3.5 Use Existing Cloudflare Resources Only

Do not create a new database or bucket.

Required D1:

```toml
[[d1_databases]]
binding = "DB"
database_name = "multi_Ai_db"
database_id = "b80ca989-6771-427f-a656-c7ab6ffc17ce"
```

Required R2:

```toml
[[r2_buckets]]
binding = "LOGS"
bucket_name = "multi-apps-ai-bucket"
```

### 3.6 Naming Rules

Database tables:

```text
Must start with HL_
No underscore after HL_
```

Valid:

```text
HL_users
HL_userProfiles
HL_measurementSessions
HL_measurementValues
```

Invalid:

```text
HL_user_profiles
measurement_sessions
users
```

Fields:

```text
camelCase only
```

Valid:

```text
userId
createdAt
manualOverride
finalValue
```

Invalid:

```text
user_id
created_at
manual_override
final_value
```

---

## 4. Multi-Agent Work Protocol

### 4.1 One Agent, One Task

TASKS.md is the absolute single source of truth for execution.
Jangan pernah melompat task, jalankan task harus berurutan. Do not attempt to do all sprints or multiple tasks at once. Use Auto-Sequential mode to do one task per cycle.
Each agent must work on exactly one checklist task at a time. Only proceed to the next task if the current one has fully passed validation and documentation updates.

Before editing code:

1. Open `TASKS.md`.
2. Pick one unchecked task.
3. Change it to `[-] In Progress`.
4. Add an entry to `WORK_LOG.md`.
5. Update `HANDOFF.md` with the current task.

Task states:

```text
[ ] Not Started
[-] In Progress
[x] Done
[!] Blocked
[~] Needs Review
```

### 4.2 Do Not Overwrite Other Agents

Before editing any file:

1. Read the file.
2. Identify the exact section to change.
3. Modify only the section required by the current task.
4. Do not reformat unrelated sections.
5. Do not delete another agent's log or comments.

### 4.3 Always Update Documentation After Each Task

After completing any task, update all relevant docs:

- `TASKS.md`
- `WORK_LOG.md`
- `HANDOFF.md`
- `api-contract.md`, if endpoint behavior changed
- `ARCHITECTURE.md`, if flow/component changed
- `design-system.md`, if UI component or theme changed
- `schema.sql`, if database changed
- `seed.sql`, if seed data changed
- README, if setup or command changed

If no documentation update is needed, still add this line to `WORK_LOG.md`:

```text
Documentation reviewed; no changes required.
```

### 4.4 Completion Definition

A task is not done (cannot be marked `[x]`) until all are strictly true:

```text
Implementation complete
Validation or tests run (typecheck/build/test)
No unrelated changes
Docs updated (api-contract, architecture, schema, UI)
TASKS.md updated (change [-] to [x])
WORK_LOG.md updated (append entry)
HANDOFF.md updated
Known issues documented
```

---

## 5. Branching and Commit Rules

Recommended branch naming:

```text
sprint-{number}/{taskId}-{shortName}
```

Example:

```text
sprint-1/US-1.3.4-ai-timeout
```

Recommended commit format:

```text
{taskId}: {short summary}
```

Example:

```text
US-1.3.4: enforce AI extraction timeout fallback
```

Each commit should include:

- code change
- tests or validation evidence
- documentation update

---

## 6. Logging Rules

Every agent must append to `WORK_LOG.md`.

Required log format:

```markdown
## YYYY-MM-DD HH:mm UTC — Agent: {agentName}

### Task
- Task ID: {taskId}
- Sprint: {sprintNumber}
- Status: Started | Completed | Blocked | Needs Review

### Files Read
- path/to/file

### Files Changed
- path/to/file

### What Changed
- Bullet summary

### Validation
- Command run or manual verification

### Documentation Updated
- TASKS.md
- HANDOFF.md
- api-contract.md if relevant

### Next Agent Notes
- What to continue next
- Known issue if any
```

No agent may delete previous log entries.

---

## 7. Handoff Rules

At the end of every task or interruption, update `HANDOFF.md`.

Required handoff content:

```text
Current sprint
Current task
Current status
Last completed task
Files changed
Commands run
Known issues
Next recommended task
```

If the task is interrupted, write exactly where to resume.
HANDOFF.md is the primary resume point. If the handoff says the project is ready for implementation and the next task is US-1.1.1, the next agent must strictly start from US-1.1.1. Do not jump to other tasks.

---

## 8. Testing and Validation Rules

### 8.1 Minimum Validation Per Task Type

Backend/API task:

```text
Every backend task must run typecheck, build, and test
Run relevant tests from TEST_PLAN.md (especially medical features like rule engine, AI timeout, manual override, idempotency, emergency consent)
Run unit/integration test if available
Verify API contract payload manually
Confirm D1 table/field naming rule
```

Database task:

```text
Run schema migration locally or against dev D1
Run seed validation
Confirm no new database was created
Confirm all table names use HL_ prefix
Confirm fields are camelCase
```

Frontend task:

```text
Run lint/typecheck/build
Test mobile viewport
Test senior/high contrast mode if UI touched
Confirm form validation behavior
```

AI task:

```text
Confirm timeout according to configured limit
Confirm fallback manual input
Confirm rawAiValue and finalValue handling
Confirm no original image is stored
```

Notification task:

```text
Confirm submit does not wait more than allowed
Confirm notification failure does not roll back measurement
Confirm HL_notifications is logged
```

### 8.2 Never Skip Safety Validation

For medical, emergency, or AI recommendation flows, always verify:

```text
No diagnosis language
No medication dosage instruction
No emergency alert without rule-based severity
No caregiver access without permission
```

---

## 9. API Rules

1. All API routes must be defined in `api-contract.md`.
2. If a new endpoint is added, update `api-contract.md` in the same task.
3. Use consistent JSON response envelope.
4. Never expose raw stack traces to client.
5. Never return private R2 key unless endpoint is authenticated and authorized.
6. Signed URL or streamed download must verify ownership/role first.

Standard success response:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Standard error response:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message",
    "details": {}
  }
}
```

---

## 10. Cloudflare Free-Tier Efficiency Rules

1. Do not store original image.
2. Compress image in browser before upload.
3. Store only final watermarked file.
4. AI Vision only runs when user explicitly clicks automatic extraction.
5. No automatic retries for AI Vision by default.
6. OCR is not queued by default.
7. Generate PDF only on demand.
8. Use D1 batch writes when possible.
9. Keep AI recommendation input as summarized JSON, not full history.
10. Use indexes defined in `schema.sql`.

---

## 11. Sprint Priority Rules

**Deployment & UAT Rules:** Setelah selesai sprint WAJIB DEPLOY KE production dan lakukan testing, full uat di production.
- Cloudflare Account ID: 79dea2845a4b62ea5229c8676dea02c0
- Cloudflare Token: <CLOUDFLARE_TOKEN>

Do not jump to later sprint task if current sprint has P0 blocker.

Priority order:

```text
P0 = required for core safety or data integrity
P1 = required for feature completeness
P2 = enhancement or polish
```

**Sprint Gates:** Sprint 1 must not be considered complete until auth, onboarding, measurement capture, AI timeout, manual override, submit D1, R2 evidence, Telegram, and dashboard today have passed all critical tests from TEST_PLAN.md.

**Prioritize Safe Build Order within Sprint 1:** apply schema/seed -> verify bindings -> auth/register/login/session -> onboarding -> metric catalog -> validate endpoint -> AI extract -> submit -> R2 upload -> Telegram -> dashboard.

If a P1/P2 task reveals missing P0 infrastructure, stop and create/update the P0 task before continuing.

---

## 12. Forbidden Actions

Agents must not:

- create a new D1 database
- create a new R2 bucket
- store raw base64 images in D1
- store original unwatermarked images in R2
- skip manual override
- let AI decide medical severity
- generate medication dosage advice
- send emergency alert without consent/permission
- delete previous work logs
- mark a task done without docs update
- rename existing schema tables without migration plan
- change naming convention away from `HL_` + camelCase
- invent or create new tables carelessly. Wajib cek konsistensi nama table di schema.sql sebelum coding. Gunakan tabel yang sudah ada (seperti HL_systemConfigs, HL_userProfiles) jika fungsinya sama.

---

## 13. Recommended Task Start Prompt for Agents

Use this prompt when assigning a task to an AI agent:

```text
You are working on HL Health Companion.
Read AGENTS.md first, then TASKS.md, WORK_LOG.md, HANDOFF.md, PRD.docx.md, User Stories, ARCHITECTURE.md, api-contract.md, schema.sql, seed.sql, and design-system.md.
Pick only the specified task.
Do not work on unrelated files.
Use TASKS.md as the absolute single source of truth. Before coding, mark the task as In Progress [-] in TASKS.md and append a Started entry in WORK_LOG.md.
After coding, run validation, update docs, change to Done [x] in TASKS.md, append Completed or Blocked entry in WORK_LOG.md, and update HANDOFF.md. Do not work on multiple tasks at once.
Never store original images. Never let AI decide medical status. Use existing Cloudflare D1 DB and R2 bucket only.
```
