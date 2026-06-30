# iSehat

Cloudflare-first health logging PWA — record vitals via photo, extract values with AI vision, validate with rule-based severity, push to Telegram, and share dashboards with family/caregivers.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Cloudflare Workers (TypeScript) |
| API | Hono.js |
| Database | Cloudflare D1 (`DB` → `isehat_db`, 69 HL tables Sprint 1–5 + 10 new Sprint 6 tables) |
| Storage | Cloudflare R2 (`LOGS` → `multi-apps-ai-bucket`) |
| AI Vision | `@cf/meta/llama-3.2-11b-vision-instruct` (configurable via `HL_systemConfigs`) |
| AI Text | 9router OpenAI-compatible endpoint, 3-model fallback (`deepseek-v4-flash-free`, `mimo-v2.5-free`, `poolside/laguna-m.1:free`) |
| Async | Cloudflare Queues (`telegram-submit-summary`) |
| Scheduler | Cloudflare Cron Triggers |
| Frontend | React 19 + Vite 8 + TypeScript 6 (vanilla CSS) |
| Auth | HTTP-only cookie sessions (`hlSession`) |
| PWA | Service worker + manifest, installable on mobile |

## Project Structure

```
hl-health-companion/
├── docs/                        # PRD, architecture, api-contract, schema, tasks, test-plan
├── docs_sprint5/                # Sprint 5 planning: PRD, schema, seed, API contract, task plan, test plans
├── web/                         # React SPA frontend
│   ├── src/
│   │   ├── pages/               # 19 page groups (auth, dashboard, measurement, reports, etc.)
│   │   ├── components/          # Shared React components
│   │   ├── hooks/               # useAiExtract
│   │   ├── utils/               # imageCompressor, watermark, dateFormat, validation, bmiCalculator
│   │   ├── context/             # AuthContext + auth (useAuth)
│   │   ├── styles/              # senior-mode.css, high-contrast.css
│   │   └── App.tsx              # SPA shell (sidebar + topbar + bottom nav)
│   ├── public/                  # manifest.json, icons, sw.js, favicon.svg
│   └── functions/api/           # Pages Function proxy → Worker URL
├── worker/                      # Hono.js Worker (~4900 lines)
│   └── src/
│       ├── index.ts             # Main routes (auth, profile, measurements, dashboard, AI, reports, etc.)
│       └── routes-extra.ts      # Extra routes (emergency, family, medications, fasting, streaks, patterns, cron)
├── functions/api/[[path]].ts    # Pages Function proxy (rewrites /api/* → Worker origin)
├── package.json                 # Monorepo root (workspaces: web, worker)
└── AGENTS.md                    # Multi-agent operating rules
```

## Sprint Status

All **5 implementation Sprints** complete (69 HL tables, 336/336 tests, 153-item §10 test plan 100% coverage). **Sprint 6** now ready to start — AI Clinical Copilot runtime, Emergency, WhatsApp via Baileys, Admin AI Governance.

| Sprint | Scope | Status |
|---|---|---|
| Sprint 1 | Core Capture: auth, onboarding, measurement, AI vision, manual override, submit, R2, Telegram, dashboard today | ✅ |
| Sprint 2 | Health Intelligence: rules engine, popup, AI recommendation, comparison, weekly/monthly dashboards, reports, KB | ✅ |
| Sprint 3 | Family & Alerts: Telegram link, emergency alerts, family/caregiver RBAC, reminders, browser push, medication | ✅ |
| Sprint 4 | Advanced: Doctor Ready PDF, fasting timer, gamification, pattern detection, senior mode, PWA, export, privacy | ✅ |
| Sprint 5 | Commercial Foundation + OAuth + Education + Symptom + Hydration + AI Infrastructure + Cycle + Telegram | ✅ |
| Sprint 6 | AI Clinical Copilot + Emergency + WhatsApp/Baileys + Admin AI Governance + Hardening + Closed Beta | 🚧 Ready, S6A-T-01 next |

> For Sprint 6 resume state, see [`HANDOFF_SPRINT6.md`](./HANDOFF_SPRINT6.md).
> For legacy Sprint 1–5 deploy-state, see [`archive/sprint1-5/HANDOFF.md`](./archive/sprint1-5/HANDOFF.md).

## Cloudflare Bindings

```toml
# Worker #1 — isehat-api-worker (= worker/)
[[d1_databases]]
binding = "DB"
database_name = "isehat_db"           # D1 cross-migrated 2026-06-27 (was multi_Ai_db)
database_id = "d777e991-ddc9-4072-8522-06cb08a6538c"

[[r2_buckets]]
binding = "LOGS"
bucket_name = "multi-apps-ai-bucket"

# Sprint 6: Worker #1 now has a Service binding to Worker #2 (isehat-ai-worker).
[[services]]
binding = "AI_SERVICE"
service = "isehat-ai-worker"

[[queues.producers]]
queue = "telegram-submit-summary"
binding = "TELEGRAM_QUEUE"

[[queues.consumers]]
queue = "telegram-submit-summary"
max_batch_size = 10
max_batch_timeout = 5
```

Additional Workers are scaffolded for Sprint 6 (skeletons on disk):

| Worker | Path | Status |
|---|---|---|
| #1 `isehat-api-worker` | `worker/` | active (Sprint 1–5) |
| #2 `isehat-ai-worker` | `worker/ai/` | S6A-T-01 next |
| #3 `isehat-jobs-worker` | `worker/cron/` | S6F (cron + retention) |
| #4 `isehat-webhooks-worker` | `worker/webhook/` | S6G (Xendit + Telegram + WhatsApp) |

## Development

```bash
npm install          # install all workspaces (web + worker)
npm run dev:web      # vite dev server → localhost:5173 (proxies /api to worker)
npm run dev:worker   # wrangler dev → localhost:8787
```

## Deployed URLs

| App | URL |
|---|---|
| Worker API | `https://hl-health-companion-api.indiehomesungairaya.workers.dev` |
| Pages Frontend | `https://hl-health-companion.pages.dev` |

Pages proxies `/api/*` to Worker via `functions/api/[[path]].ts`.

## Database

79 tables with `HL_` prefix, camelCase fields. **69 tables** come from Sprint 1–5 (D1 cross-migrated 2026-06-27 from `multi_Ai_db` to `isehat_db`). **10 new tables** are Sprint 6 (`worker/migrations/003_sprint6_schema.sql`):

Apply local D1 schema and seed in this order (database `isehat_db` — D1 cross-migrated 2026-06-27 from `multi_Ai_db`):

```bash
cd worker
npx wrangler d1 execute isehat_db --local --file ../docs/07-schema.sql
npx wrangler d1 execute isehat_db --local --file ../docs/08-seed.sql
npx wrangler d1 execute isehat_db --local --file ../docs_sprint5/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql
npx wrangler d1 execute isehat_db --local --file ../docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql
# Sprint 6 — optional, only if isehat-ai-worker tables desired in local D1:
npx wrangler d1 execute isehat_db --local --file ./migrations/003_sprint6_schema.sql
npx wrangler d1 execute isehat_db --local --command "PRAGMA foreign_key_check;"
```

**Sprint 1–4 (38 tables):**

- `HL_users` / `HL_sessions` / `HL_userProfiles` — auth & profiles
- `HL_devices` / `HL_metricCatalog` / `HL_deviceMetrics` — device-metric catalog
- `HL_metricRules` — rule-based severity engine
- `HL_measurementSessions` / `HL_measurementValues` — measurement data
- `HL_measurementAttachments` / `HL_lastMeasurements` — evidence & autofill cache
- `HL_aiExtractions` / `HL_aiRecommendations` — AI logs
- `HL_alerts` / `HL_notifications` / `HL_telegramLinks` — alerts & notifications
- `HL_familyLinks` / `HL_familyInvites` / `HL_emergencyContacts` — family & emergency
- `HL_medications` / `HL_medicationSchedules` / `HL_medicationLogs` — medication tracking
- `HL_fastingSessions` — fasting timer
- `HL_badges` / `HL_userBadges` / `HL_streaks` — gamification
- `HL_reports` / `HL_reportShares` — reports & doctor sharing
- `HL_patternInsights` — pattern detection
- `HL_knowledgeArticles` — knowledge base
- `HL_systemConfigs` — DB-backed config (no hardcoding)
- `HL_auditLogs` / `HL_apiRateLimits` — audit & rate limiting

**Sprint 5 Foundation (11 tables):**

- `HL_roles` / `HL_permissions` / `HL_rolePermissions` / `HL_userRoles` — RBAC
- `HL_plans` / `HL_planFeatures` / `HL_subscriptions` / `HL_paymentEvents` — billing & subscriptions
- `HL_usageCounters` / `HL_featureFlags` / `HL_configMetadata` — usage & config

**Sprint 5A — OAuth / Education / Symptoms (6 tables):**

- `HL_oauthAccounts` / `HL_oauthStates` — Google OAuth
- `HL_educationCards` / `HL_userEducationProgress` — education content & progress
- `HL_symptomLogs` / `HL_safetyEvents` — symptom logging & safety

**Sprint 5B — Hydration (3 tables):**

- `HL_hydrationSettings` / `HL_hydrationTargets` / `HL_waterIntakeLogs` — water intake tracking

**Sprint 5C — AI Infrastructure (4 tables):**

- `HL_vectorDocuments` / `HL_aiContextQueries` / `HL_aiRecommendationContexts` / `HL_aiMemoryJobs` — AI context & memory

**Sprint 5D — Cycle Tracking (4 tables):**

- `HL_cycleSettings` / `HL_cycleLogs` / `HL_cycleGuardrailAcknowledgements` / `HL_familyPermissions` — cycle tracking & family permissions

**Sprint 5E — Telegram Hydration (1 table):**

- `HL_telegramCallbackEvents` — Telegram webhook callbacks

**Sprint 5X — Post-Deploy Hardening (2 tables):**

- `HL_billingCheckoutSessions` — Xendit/Mock checkout session lifecycle (added 2026-06-28 via S5X-BILL-001..014)
- `HL_emailOtpChallenges` — Email OTP challenges for register/login (added 2026-06-27 via migration `001_s5x_auth_email_otp.sql`)

**Sprint 6 — AI Clinical Copilot Runtime (10 tables, optional):**

- `HL_aiClinicalSessions` / `HL_modelRuns` / `HL_aiClinicalMessages` / `HL_aiClinicalIntakeAnswers` — clinical copilot chat
- `HL_aiOutputSafetyFlags` — 13-detector safety decision log
- `HL_promptVersions` — versioned prompt template registry
- `HL_whatsappLinks` / `HL_whatsappMessages` — WhatsApp/Baileys link + message log
- `HL_firstAidProtocols` — emergency first-aid reviewable protocols
- `HL_aiKnowledgeDocuments` — knowledge source-of-truth registry

## API Routes (~155 endpoints)

**Auth**: register, login, logout, me, forgot-password, forgot-password
**Profile**: get, update, onboarding, UI settings
**Metrics**: catalog
**Measurements**: validate, submit, history, today, last, attachments, sync, drafts
**Dashboard**: today, weekly, monthly, comparison
**AI**: extract, recommendation, assistant, report-analysis
**Reports**: daily, weekly, monthly, doctor-ready, download, share, share-token
**Telegram**: connect, verify, test, settings, webhook
**Family**: invite, accept, links, permissions, access-check, dashboard, caregiver dashboard
**Emergency**: contacts CRUD, consent toggle, notify
**Medications**: CRUD, logs, adherence
**Fasting**: start, stop, current
**Alerts**: list, acknowledge
**Notifications**: list, browser subscribe
**Patterns**: generate (sleep-bp, weight-bp, medication)
**Reminders**: CRUD
**Streaks / Badges**: list
**Admin**: configs CRUD
**Export**: CSV
**Privacy**: delete account

### Sprint 5 Routes

**Admin RBAC**: roles, permissions, user roles CRUD
**Admin Billing**: plans, features, subscriptions, payment webhooks
**Admin Config**: system config, AI config, feature flags
**Admin Master Data**: metric catalog, metric rules, education cards, knowledge articles
**Admin Audit**: audit logs, safety events
**OAuth**: Google login/register/link/unlink
**Education**: cards, progress, first-time guidance
**Symptoms**: log, history, red flag detection
**Hydration**: today, logs, history, settings
**AI Clinical Infra**: context query, memory status/rebuild/delete
**Cycle**: access check, settings, calendar, logs, guardrails, family permissions
**Telegram Hydration**: webhook, cron reminders

## Critical Rules

1. **Rule First, AI Assisted** — `HL_metricRules` determines severity, not AI.
2. **Manual Override Mandatory** — Every AI-extracted value is editable; `manualOverride=1` if changed.
3. **No Original Image Stored** — Only compressed (50%) + watermarked webp saved to R2.
4. **Configurable Timeout** — AI extraction timeout read from `HL_systemConfigs`, not hardcoded.
5. **Naming** — Tables start with `HL_` (no underscore after); fields use camelCase.
6. **No New DB/Bucket** — Use existing `isehat_db` and `multi-apps-ai-bucket`.
7. **Sensitive Data Encryption** — AES-GCM via `ENCRYPTION_KEY` secret for Telegram chat IDs, emergency contacts, medication notes.

### Sprint 5 Rules

8. **Safety Events** — Sprint 5 non-metric safety events use `HL_safetyEvents`, not `HL_alerts`.
9. **AI Clinical Copilot Deferred (now shipping)** — Sprint 6A wiring resumes here. 13-detector Safety Runtime v2 per `docs_sprint6/AI_SAFETY_RUNTIME_SPEC.md`.
10. **Audit Logs Required** — All admin mutations must write to `HL_auditLogs`.
11. **No Plaintext Secrets** — No secrets in D1, API responses, logs, or frontend bundle. Secrets live in Cloudflare Secrets/Env only.

### Sprint 6 Hard Boundaries (added 2026-06-30)

12. **AI must not prescribe or diagnose.** Sprint 6 forbids `forbiddenActions` × 9 entries; medical safety = 13-detector server-side ABES.
13. **Sprint 5C context data = sprint6 basis** — `HL_vectorDocuments` / `HL_aiContextQueries` maps cleanly into new Sprint 6 tables. No destructive migration.
14. **WhatsApp via Baileys VPS** — out-of-Cloudflare process; only `isehat-webhooks-worker` accepts WA webhooks (signed via `WA_GATEWAY_SECRET`).

## Account

- **Cloudflare Account ID**: `79dea2845a4b62ea5229c8676dea02c0`
- **Token**: Set via `CLOUDFLARE_API_TOKEN` env var

## Multi-Agent Protocol

See `AGENTS.md` (root) for cross-sprint task ordering, handoff, logging, and validation rules. **Sprint 6-specific** rules are in [`docs_sprint6/AGENTS_SPRINT6.md`](./docs_sprint6/AGENTS_SPRINT6.md).

Resume pointers:

- **Sprint 6 active:** [`HANDOFF_SPRINT6.md`](./HANDOFF_SPRINT6.md) + [`WORK_LOG_SPRINT6.md`](./WORK_LOG_SPRINT6.md)
- **Sprint 1–5 legacy:** [`archive/sprint1-5/HANDOFF.md`](./archive/sprint1-5/HANDOFF.md) + [`archive/sprint1-5/WORK_LOG.md`](./archive/sprint1-5/WORK_LOG.md)
- **Sprint 1–4 legacy:** [`archive/sprint1-4/AGENTS_Sprint1-4.md`](./archive/sprint1-4/AGENTS_Sprint1-4.md) (rulebook superseded by `/AGENTS.md`)
