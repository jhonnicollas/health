# iSehat Sprint 6 API Contract

## Worker #1 — isehat-api-worker (`worker/apps`)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/register/verify`
- `POST /api/auth/login`
- `GET /api/auth/me`
- OAuth Google endpoints

### Profile / Settings
- `POST /api/profile/onboarding`
- `GET /api/profile`
- `PUT /api/profile`
- `PUT /api/settings/ui`

### Measurements / Symptoms / Hydration / Cycle
- `GET /api/metrics/catalog`
- `GET /api/measurements/last`
- `GET /api/measurements/today`
- `POST /api/measurements/submit`
- `POST /api/symptoms`
- `GET /api/symptoms/:id`
- `POST /api/hydration/logs`
- `DELETE /api/hydration/logs/:logId`
- Cycle settings/logs/calendar endpoints

### AI Clinical Copilot (proxied to #2)
- `POST /api/ai/clinical/session/start`
- `POST /api/ai/clinical/message`
- `GET /api/ai/clinical/sessions`
- `GET /api/ai/clinical/sessions/:id`
- `POST /api/ai/clinical/sessions/:id/close`
- `POST /api/ai/clinical/follow-up`
- `POST /api/ai/clinical/first-aid`

### AI Memory
- `GET /api/ai/context/query`
- `GET /api/ai/context-package`
- `GET /api/ai/memory/status`
- `POST /api/ai/memory/rebuild`
- `DELETE /api/ai/memory`
- `POST /api/ai/disclaimer/enforce`

### WhatsApp
- `POST /api/whatsapp/link/start`
- `POST /api/whatsapp/link/verify`
- `GET /api/whatsapp/link/status`
- `DELETE /api/whatsapp/link`

### Admin
- `GET /api/admin/users/:userId/ai-memory/status`
- `POST /api/admin/users/:userId/ai-memory/rebuild`
- `GET /api/admin/ai-clinical-copilot/readiness`
- `GET /api/admin/ai-config`
- `PUT /api/admin/ai-config`
- System config / roles / plans / billing endpoints

### Service Binding Probe
- `GET /api/ai/probe` → proxies `GET /health` to #2 via `AI_SERVICE`

## Worker #2 — isehat-ai-worker (`worker/ai`)

### Health
- `GET /health`

### Clinical Copilot
- `POST /api/ai/clinical/session/start`
- `POST /api/ai/clinical/message`
- `GET /api/ai/clinical/sessions`
- `GET /api/ai/clinical/sessions/:id`
- `POST /api/ai/clinical/sessions/:id/close`
- `POST /api/ai/clinical/follow-up`
- `POST /api/ai/clinical/first-aid`

### AI Memory
- `GET /api/ai/context/query`
- `GET /api/ai/context-package`
- `POST /api/ai/memory/index-source`
- `POST /api/ai/memory/rebuild`
- `DELETE /api/ai/memory`
- `GET /api/ai/memory/status`

### WhatsApp Session DO
- Internal `POST /whatsapp-session` consumed by #4 via Service Binding

## Worker #3 — isehat-jobs-worker (`worker/cron`)

### Health
- `GET /health` (requires `CRON_SECRET`)

### Cron Jobs
- `expireSessions` — `0 2 * * *`
- `nullifyEncrypted` — `30 2 * * *`
- `deleteMessages` — `0 3 * * *`
- `archiveModelRuns` — `0 4 * * 0`
- `deleteInactiveVectors` — `30 4 * * 0`
- `archiveSafetyFlags` — `0 5 1 * *`

### Queue Consumers
- `doctorHandoff`
- `whatsapp-outbound`
- `ai-memory-jobs` (rebuild/delete)
- `eval-jobs`

## Worker #4 — isehat-webhooks-worker (`worker/webhook`)

### Health
- `GET /health` (requires `CRON_SECRET`)

### Webhooks
- `POST /api/whatsapp/webhook` — Baileys inbound (requires `X-Gateway-Secret`)
- `POST /api/whatsapp/media/ingest`
- `POST /api/webhook/telegram/*` — Telegram callbacks
- Xendit billing webhooks

## Cross-Worker Communication

| Caller | Callee | Binding | Purpose |
|---|---|---|---|
| #1 | #2 | `AI_SERVICE` | Clinical copilot + memory ops |
| #1 | #2 | `AI_SERVICE` | `/api/ai/probe` health check |
| #4 | #2 | `AI_SERVICE` | WhatsApp session DO |
| #4 | #1 | `API_SERVICE` | Telegram / other routing |
| #4 | #3 | `JOBS_SERVICE` | Queue enqueue |
| #3 | #2 | `AI_SERVICE` | Inactive vector cleanup |

## Response Envelope

All JSON responses use:

```json
{
  "success": true | false,
  "data": {},
  "error": { "code": "...", "message": "...", "details": [] },
  "meta": { "requestId": "...", "durationMs": 0 }
}
```
