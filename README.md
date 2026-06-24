# HL Health Companion

Cloudflare-first health logging PWA — record vitals via photo, extract values with AI vision, validate with rule-based severity, push to Telegram, and share dashboards with family/caregivers.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Cloudflare Workers (TypeScript) |
| API | Hono.js |
| Database | Cloudflare D1 (`DB` → `multi_Ai_db`, 38 tables) |
| Storage | Cloudflare R2 (`LOGS` → `multi-apps-ai-bucket`) |
| AI Vision | `@cf/meta/llama-3.2-11b-vision-instruct` (configurable via `HL_systemConfigs`) |
| AI Text | 9router OpenAI-compatible endpoint, 3-model fallback (`deepseek-v4-flash-free`, `mimo-v2.5-free`, `poolside/laguna-m.1:free`) |
| Async | Cloudflare Queues (`telegram-submit-summary`) |
| Scheduler | Cloudflare Cron Triggers |
| Frontend | React 19 + Vite 8 + TypeScript 6 (vanilla CSS) |
| Auth | HTTP-only cookie sessions (`hlSession`) |
| PWA | Service worker + manifest, installable on mobile |
| **Auth** | HTTP-only cookie sessions (`hlSession`) |

## Project Structure

```
hl-health-companion/
├── docs/                        # PRD, architecture, api-contract, schema, tasks, test-plan
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

All **4 Sprints** complete — 151 user stories + gap remediations + enterprise production fixes.

| Sprint | Scope | Status |
|---|---|---|
| Sprint 1 | Core Capture: auth, onboarding, measurement, AI vision, manual override, submit, R2, Telegram, dashboard today | ✅ |
| Sprint 2 | Health Intelligence: rules engine, popup, AI recommendation, comparison, weekly/monthly dashboards, reports, KB | ✅ |
| Sprint 3 | Family & Alerts: Telegram link, emergency alerts, family/caregiver RBAC, reminders, browser push, medication | ✅ |
| Sprint 4 | Advanced: Doctor Ready PDF, fasting timer, gamification, pattern detection, senior mode, PWA, export, privacy | ✅ |

## Cloudflare Bindings

```toml
[[d1_databases]]
binding = "DB"
database_name = "multi_Ai_db"
database_id = "b80ca989-6771-427f-a656-c7ab6ffc17ce"

[[r2_buckets]]
binding = "LOGS"
bucket_name = "multi-apps-ai-bucket"

[[queues.producers]]
queue = "telegram-submit-summary"
binding = "TELEGRAM_QUEUE"

[[queues.consumers]]
queue = "telegram-submit-summary"
max_batch_size = 10
max_batch_timeout = 5
```

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

38 tables with `HL_` prefix, camelCase fields. Key tables:

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

## API Routes (~80 endpoints)

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

## Critical Rules

1. **Rule First, AI Assisted** — `HL_metricRules` determines severity, not AI.
2. **Manual Override Mandatory** — Every AI-extracted value is editable; `manualOverride=1` if changed.
3. **No Original Image Stored** — Only compressed (50%) + watermarked webp saved to R2.
4. **Configurable Timeout** — AI extraction timeout read from `HL_systemConfigs`, not hardcoded.
5. **Naming** — Tables start with `HL_` (no underscore after); fields use camelCase.
6. **No New DB/Bucket** — Use existing `multi_Ai_db` and `multi-apps-ai-bucket`.
7. **Sensitive Data Encryption** — AES-GCM via `ENCRYPTION_KEY` secret for Telegram chat IDs, emergency contacts, medication notes.

## Account

- **Cloudflare Account ID**: `79dea2845a4b62ea5229c8676dea02c0`
- **Token**: Set via `CLOUDFLARE_API_TOKEN` env var

## Multi-Agent Protocol

See `AGENTS.md` for task ordering, handoff, logging, and validation rules.
