# IMPLEMENTATION_GUIDE — iSehat Content Engine CE-1

Document for AI coding agents executing iSehat Content Engine CE-1.

```text
Product: iSehat Content Engine
Scope: CE-1 Text Content Engine + Safety Checker
Target: Cloudflare Workers + Hono + Cloudflare D1
Database: multi_Ai_db (b80ca989-6771-427f-a656-c7ab6ffc17ce)
Worker: worker/content/
Status: Execution-ready
```

---

## 1. How to Read the Documents

Read in this order before writing code:

```text
1. app/contentApp/AGENT_HANDOFF.md        ← start here
2. app/contentApp/docs/02.SRS_ISEHAT_CONTENT_ENGINE.md
3. app/contentApp/docs/05.ISEHAT_CONTENT_ENGINE_ARCHITECTURE.md
4. app/contentApp/docs/03.DB_SCHEMA.sql
5. app/contentApp/docs/04.API_CONTRACT.md
6. app/contentApp/docs/06.PROMPTS_CE1.md
7. app/contentApp/docs/07.TASK_CE1.md
8. app/contentApp/docs/08.TEST_PLAN_CE1.md
```

Conflict resolution priority:

```text
1. SRS v1.1 — product and safety requirements
2. API_CONTRACT.md — endpoint behavior
3. DB_SCHEMA.sql — persisted data shape
4. PROMPTS_CE1.md — AI output contracts
5. ARCHITECTURE.md — module boundaries
6. TASK_CE1.md — execution sequence
```

---

## 2. Execution Order

Execute sprints sequentially. Do not start a sprint until the previous sprint is DONE.

| Sprint | Phases (TASK_CE1.md) | Goal |
|---|---|---|
| CE1.1 Foundation | 0, 1, 2, 3 | Scope guard, DB migration/seeds, shared types, auth, permission, audit, integrity |
| CE1.2 Core Content & AI | 4, 5, 6, 7 | Core CRUD, AI infrastructure, idea workflow, draft/revision workflow |
| CE1.3 Safety, Approval, Export & Dashboard | 8, 9, 10, 11 | Safety check, approval queue, markdown export, dashboard/AI jobs APIs |
| CE1.4 Frontend, Security & Hardening | 12, 13, 14 | Admin UI, security hardening, regression/smoke tests |

Rules:

```text
- One task = one commit.
- Commit message must contain the task ID, e.g., [ce1] CE1-T010: install DB migration.
- Update app/contentApp/current-task.md after each task status change.
- Never skip validation before marking a task DONE.
```

---

## 3. Monorepo Structure

```text
repositoryGIT/wt-sprint6/
├── app/contentApp/
│   ├── AGENT_HANDOFF.md              ← operational resume pointer
│   ├── IMPLEMENTATION_GUIDE.md       ← this file
│   ├── current-task.md               ← live current/next task
│   └── docs/
│       ├── 01.PRD_ISEHAT_CONTENT_ENGINE.md
│       ├── 02.SRS_ISEHAT_CONTENT_ENGINE.md
│       ├── 03.DB_SCHEMA.sql
│       ├── 04.API_CONTRACT.md
│       ├── 05.ISEHAT_CONTENT_ENGINE_ARCHITECTURE.md
│       ├── 06.PROMPTS_CE1.md
│       ├── 07.TASK_CE1.md
│       └── 08.TEST_PLAN_CE1.md
├── worker/
│   ├── content/                      ← CE-1 Worker (this is the target)
│   │   ├── wrangler.toml
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── env.ts
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── ai/
│   │   │   ├── safety/
│   │   │   ├── state/
│   │   │   ├── export/
│   │   │   └── utils/
│   │   └── test/
│   ├── ai/                           ← Sprint 6 Clinical Copilot (do not touch for CE-1)
│   ├── cron/                         ← Sprint 6 jobs worker
│   └── webhook/                      ← Sprint 6 webhooks worker
└── web/                              ← iSehat web app (CE-1 admin UI if needed)
```

CE-1 must not touch files in `worker/ai/`, `worker/cron/`, `worker/webhook/` for Sprint 6 logic.

---

## 4. Workers to Build

Only one new worker is required for CE-1:

```text
worker/content/ — isehat-content-worker
```

It is bound to:

```text
D1 database: multi_Ai_db
D1 binding:  DB
```

No R2, Vectorize, Queues, Durable Objects, or AI bindings are required for CE-1.

---

## 5. D1 Binding

`worker/content/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "multi_Ai_db"
database_id = "b80ca989-6771-427f-a656-c7ab6ffc17ce"
```

Access in Worker code:

```ts
const result = await env.DB.prepare('SELECT * FROM conBrands WHERE id = ?').bind('brand_isehat').first();
```

CE-1 tables (prefix `con`):

```text
conSchemaMigrations, conBrands, conPillars, conCampaigns, conIdeas, conDrafts,
conDraftRevisions, conSafetyReports, conApprovals, conAuditLogs, conAiConfigs,
conAiPromptVersions, conAiGenerationJobs, conAiUsageLogs, conAiQuotas,
conSourceReferences, conRateLimitCounters
```

---

## 6. Environment Variables

Required for `wrangler` CLI:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Set secrets only when using real AI providers:

```bash
cd worker/content
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put 9ROUTER_API_KEY
```

For local development, use the mock provider seeded in `03.DB_SCHEMA.sql`. No real API keys are required.

---

## 7. Local Development Commands

```bash
# Install dependencies
cd worker/content
npm install

# Type-check
npm run typecheck

# Run local Worker
npx wrangler dev

# Run all tests
npm test

# Run tests for one area
node --test test/brand.test.mjs
node --test test/idea.test.mjs
```

---

## 8. Migration Command

1. Copy the canonical schema to the migration folder:

```bash
cp app/contentApp/docs/03.DB_SCHEMA.sql worker/content/migrations/0001_content_engine_ce1_v1_1.sql
```

2. Execute locally:

```bash
cd worker/content
npx wrangler d1 execute multi_Ai_db --local --file=migrations/0001_content_engine_ce1_v1_1.sql
```

3. Validate foreign keys and integrity:

```bash
npx wrangler d1 execute multi_Ai_db --local --command="PRAGMA foreign_key_check;"
```

4. Verify seeds:

```bash
npx wrangler d1 execute multi_Ai_db --local --command="SELECT id FROM conBrands; SELECT slug FROM conPillars; SELECT promptKey FROM conAiPromptVersions WHERE isActive=1;"
```

---

## 9. Test Command

Run after every task and at the end of every sprint:

```bash
cd worker/content
npm run typecheck
npm test
```

If tests are organized per domain:

```bash
node --test test/brand.test.mjs
node --test test/pillar.test.mjs
node --test test/campaign.test.mjs
node --test test/idea.test.mjs
node --test test/draft.test.mjs
node --test test/safety.test.mjs
node --test test/approval.test.mjs
node --test test/export.test.mjs
node --test test/ai.test.mjs
node --test test/quota.test.mjs
node --test test/rate-limit.test.mjs
node --test test/audit.test.mjs
```

At end of CE1.4 run full smoke tests:

```bash
npm run typecheck
npm test
npx wrangler deploy --dry-run
```

---

## 10. How to Use MockProvider

The mock provider is the default for local/test. It is configured by seed rows in `conAiConfigs`:

```text
provider = 'mock'
model    = 'mock-ce1'
purpose  = 'idea_generation' | 'draft_generation' | 'safety_check' | 'health_classifier'
```

Implementation requirements:

```text
1. AIProviderAdapter must resolve provider='mock' to MockProvider.
2. MockProvider returns deterministic, parseable JSON for each purpose.
3. MockProvider output must pass the same safety/validation pipeline as real providers.
4. AI job rows in conAiGenerationJobs must still be created with jobType, status, modelUsed, etc.
5. Quota usage must still be recorded in conAiUsageLogs.
```

Example mock behavior:

```text
purpose=idea_generation          → returns array of idea objects
purpose=draft_generation         → returns draft object with primaryHook, mainContent, etc.
purpose=health_classifier        → returns { healthContentStatus, confidence, reasonCodes, detectedTopics }
purpose=safety_check             → returns { safetyStatus, healthContentStatus, blockedReasons, warnings, ... }
```

---

## 11. Forbidden CE-2+ Implementations

Do not build, route, or seed:

```text
R2 asset rendering
Carousel PNG / image generation
Video / MP4 generation
Auto-publish to platforms
Platform OAuth
External scheduler
API analytics import
Vectorize learning loop
Semantic duplicate detection via Vectorize
TikTok / YouTube / Facebook publishing
Platform webhooks
Public user-facing content editor
Multi-brand SaaS
Content scoring analytics
```

Forbidden routes must return:

```json
{
  "ok": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "This feature is not part of CE-1."
  }
}
```

---

## 12. Definition of Done

A task is DONE only when all of the following are true:

```text
[ ] Implementation matches SRS, API_CONTRACT, DB_SCHEMA, and PROMPTS.
[ ] Type-check passes: npm run typecheck
[ ] Tests pass: npm test (or targeted domain test)
[ ] No CE-2+ code, routes, or tables introduced.
[ ] No secrets hardcoded in code, logs, or responses.
[ ] Audit logs are written for sensitive mutations.
[ ] Permission checks are enforced server-side.
[ ] Current task file updated: app/contentApp/current-task.md
[ ] Commit contains task ID and cites PRD/spec section.
```

A sprint is DONE when:

```text
[ ] All tasks in the sprint are DONE.
[ ] Full type-check and test pass.
[ ] DB migration runs cleanly on local D1.
[ ] No forbidden CE-2+ features are present.
[ ] HANDOFF/WORK_LOG updated if required by project rules.
```

---

## 13. Start Execution Prompt

Use exactly this prompt when starting CE-1 implementation:

```text
Implement iSehat Content Engine CE-1 from app/contentApp/docs/.
Read app/contentApp/AGENT_HANDOFF.md first, then app/contentApp/current-task.md.
Read the task in app/contentApp/docs/07.TASK_CE1.md for the current sprint/phase.
Open the related SRS, Architecture, API_CONTRACT, DB_SCHEMA, PROMPTS, and TEST_PLAN sections.
Execute exactly one task at a time. Follow TDD: write/identify the failing test first,
then implement the smallest change, then run validation.
Do not implement CE-2+ features. Use the mock provider for local/test AI calls.
Update app/contentApp/current-task.md after every task status change.
When a sprint finishes, run the full validation commands from IMPLEMENTATION_GUIDE.md §7-9.
```

---

## 14. Resume After Interruption Prompt

Use this prompt if the agent context is interrupted:

```text
Resume iSehat Content Engine CE-1 from app/contentApp/current-task.md.
Re-read app/contentApp/AGENT_HANDOFF.md and the current task section in
app/contentApp/docs/07.TASK_CE1.md. Read the relevant SRS, Architecture,
API_CONTRACT, DB_SCHEMA, PROMPTS, and TEST_PLAN sections for that task only.
Continue from the task/status shown in current-task.md. Do not skip tasks.
Run validation before marking any task DONE.
```
