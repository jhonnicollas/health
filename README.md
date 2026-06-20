# HL Health Companion

HL Health Companion is a Cloudflare-first health logging Progressive Web Application (PWA) designed to track, validate, and summarize user health measurements. It emphasizes strict data privacy, rule-based medical safety severity determination, dynamic AI vision extraction, and offline availability.

## 🚀 Technology Stack

### Backend
- **Framework:** Hono.js running on Cloudflare Workers
- **Database:** Cloudflare D1 SQL database (Binding name: `DB`)
- **Storage:** Cloudflare R2 bucket (Binding name: `LOGS`)
- **AI Models:** Cloudflare Workers AI Vision Model & Cloudflare Workers AI Text LLM
- **Background Tasks:** Cloudflare Queues
- **Scheduler:** Cloudflare Cron Triggers

### Frontend
- **Framework:** React SPA built with Vite
- **Styling:** Vanilla CSS (TailwindCSS avoided unless explicitly requested)
- **Deployment:** PWA-ready static assets deployed to Cloudflare

---

## 📂 Project Structure

```text
hl-health-companion/
├── docs/                      # Core specification & architecture files
│   ├── ARCHITECTURE.md        # Architectural flow and system design
│   ├── api-contract.md        # REST API endpoints specifications
│   ├── schema.sql             # SQL DDL for database
│   ├── seed.sql               # Seed data for system config & catalog
│   ├── TASKS.md               # Source of Truth task backlog
│   ├── TEST_PLAN.md           # Testing instructions & validation rules
│   └── design-system.md       # UI components & aesthetics specs
├── web/                       # React Frontend application
├── worker/                    # Hono.js Cloudflare Worker API
├── AGENTS.md                  # Mandatory rules for AI Agents
├── HANDOFF.md                 # Current handoff/resume state
├── WORK_LOG.md                # Agent activity log (append-only)
└── package.json               # Monorepo workspaces definition
```

---

## ⚙️ Cloudflare Bindings & Credentials

This project runs on existing Cloudflare resources. Do not create new databases or buckets.

### Wrangler Configuration (`worker/wrangler.toml`)
```toml
[[d1_databases]]
binding = "DB"
database_name = "multi_Ai_db"
database_id = "b80ca989-6771-427f-a656-c7ab6ffc17ce"

[[r2_buckets]]
binding = "LOGS"
bucket_name = "multi-apps-ai-bucket"
```

### Production Deployment Credentials
- **Account ID:** `79dea2845a4b62ea5229c8676dea02c0`
- **Token:** `<CLOUDFLARE_TOKEN>`

---

## 🛠️ Development & Setup

### Prerequisites
- Node.js (v18+)
- Wrangler CLI installed globally (`npm i -g wrangler`)

### Installation
To install all dependencies across the monorepo, run from the root:
```bash
npm install
```

### Local Development
To run the local development servers for both frontend and backend:
- **Run Frontend:** `npm run dev:web` (Starts Vite dev server at http://localhost:5173)
- **Run Backend (Worker):** `npm run dev:worker` (Starts wrangler local dev server)

---

## ⚠️ Non-Negotiable Core Rules

All developers and AI agents must strictly follow these rules (detailed in [AGENTS.md](file:///c:/codex/health/AGENTS.md)):

1. **Rule First, AI Assisted:** Medical severity/alerts are calculated solely by the `HL_metricRules` engine. AI is only used to generate summaries/insight. AI must not diagnose or prescribe.
2. **Manual Override is Mandatory:** All AI-extracted fields must be editable before submission. If the user overrides an AI-extracted value, set `manualOverride = 1`.
3. **No Original Image Storage:** Do not store original images. Only store watermarked, compressed webp files in R2:
   `HL/users/{userId}/measurements/{sessionId}/{metricCode}-{attachmentId}.webp`
4. **No Hardcoded Configs:** Values like AI timeout (`aiExtractTimeoutMs`) or max upload size (`maxUploadSizeBytes`) must be fetched from `HL_systemConfigs` table in D1.
5. **Database Naming Conventions:**
   - Table names must start with `HL_` followed by camelCase name (no extra underscores, e.g., `HL_users`, `HL_userProfiles`).
   - Fields must use `camelCase` (e.g., `userId`, `createdAt`).

---

## 🤖 Multi-Agent Execution Protocol

If you are an AI agent working on this repo:
1. **SSOT Tasks:** Always check [TASKS.md](file:///c:/codex/health/docs/TASKS.md). Pick only one task, mark it as `[-] In Progress`.
2. **Work Log:** Append a "Started" log to [WORK_LOG.md](file:///c:/codex/health/WORK_LOG.md).
3. **Handoff:** Update `Current Owner` in [HANDOFF.md](file:///c:/codex/health/HANDOFF.md).
4. **Deploy & Validate:** After completing a sprint task, you **MUST** run validation (`typecheck`, `build`, `test`), deploy to production using Wrangler, and perform UAT in production.
5. **Handoff & Complete:** Update documentation, mark task as `[x] Done` in `TASKS.md`, append completion details to `WORK_LOG.md`, and update `HANDOFF.md`.
