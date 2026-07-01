# API CONTRACT — iSehat

> **Sumber: audit langsung ke `worker/apps/src/index.ts`, `routes-*.ts` (api-worker), `worker/ai/src/index.ts` (ai-worker), `worker/cron/src/index.ts` (jobs-worker), `worker/webhook/src/index.ts` (webhooks-worker). Total ~270 endpoint aktif setelah Sprint 6.**
> Dokumen lama: `archive/docs_legacy_2025_sprint1-5/05-api-contract.md`.

---

## 1. Base URL, Auth, Response Envelope

### 1.1 Base URL

| Env | URL |
|---|---|
| Production Worker #1 | `https://hl-health-companion-api.indiehomesungairaya.workers.dev` |
| Production Worker #2 | `https://isehat-ai-worker.indiehomesungairaya.workers.dev` (internal, Service Binding only) |
| Production Worker #3 | `https://isehat-jobs-worker.indiehomesungairaya.workers.dev` (cron + queues, no public API) |
| Production Worker #4 | `https://isehat-webhooks-worker.indiehomesungairaya.workers.dev` |
| Pages (frontend) | `https://app.isehat.biz.id` |
| Local dev (worker) | `http://localhost:8787` |
| Local dev (vite) | `http://localhost:5173` (Vite proxy `/api` → worker) |

Pages mem-proxy `/api/*` → Worker lewat `functions/api/[[path]].ts`.

### 1.2 Authentication

- **Cookie**: `hlSession` (HTTP-only, Secure, SameSite=Lax). Diset oleh `POST /api/auth/login`, `POST /api/auth/login/verify`, `/api/auth/google/callback`. Divalidasi server-side via `getCurrentSession(c)` → lookup `HL_sessions` dengan SHA-256 hash token.
- **Bearer (cron only)**: `Authorization: Bearer ${CRON_SECRET}` untuk `/api/internal/cron/*` dan Worker #3 health.
- **Telegram webhook**: diverifikasi via `telegramBotToken` (resolve dari `HL_systemConfigs` atau `env.TELEGRAM_BOT_TOKEN`).
- **WhatsApp webhook**: diverifikasi via `WA_GATEWAY_SECRET` (env var, shared antara VPS Baileys gateway ↔ Worker #4).
- **Xendit webhook**: diverifikasi via `XENDIT_WEBHOOK_SECRET` (env var).

Tidak ada JWT. Tidak ada API key untuk user. RBAC/Entitlement dicek **server-side**.

### 1.3 Response Envelope (universal)

Semua response JSON mengikuti envelope:

```json
// Success
{
  "success": true,
  "data": { /* endpoint-specific payload */ },
  "meta": {
    "requestId": "req_<base36>",
    "durationMs": 42
  }
}

// Failure
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Pesan error i18n-ready (ID default).",
    "details": [/* optional structured detail */]
  },
  "meta": {
    "requestId": "req_<base36>",
    "durationMs": 12
  }
}
```

### 1.4 Error Codes (server-side enum)

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Tidak ada sesi valid / sesi kadaluarsa / revoked |
| `VALIDATION_ERROR` | 400 | Field request tidak valid |
| `NOT_FOUND` | 404 | Resource tidak ada / tidak milik user |
| `FORBIDDEN` | 403 | Akses ditolak (family permission, RBAC, expired share) |
| `CONFLICT` | 409 | Duplicate (e.g. username/email sudah ada) |
| `RATE_LIMITED` | 429 | OCR rate limit / OTP resend limit |
| `ENTITLEMENT_REQUIRED` | 403 | Plan tidak mengizinkan fitur (premium-only) |
| `PAYMENT_REQUIRED` | 402 | Subscription expired |
| `INTERNAL_ERROR` | 500 | Bug / unhandled error |
| `AI_CLINICAL_COPILOT_DEFERRED` | 403 | Sprint 6 placeholder, belum diaktifkan |
| `ONBOARDING_REQUIRED` | 403 | User belum `POST /api/profile/onboarding` |
| `REVIEWER_APPROVAL_REQUIRED` | 403 | Operating mode change butuh medical reviewer approval (S6H) |
| `AI_SERVICE_UNAVAILABLE` | 503 | AI Worker #2 Service Binding gagal / unavailable (S6E/S6I) |

### 1.5 Headers penting

- `Content-Type: application/json; charset=utf-8` (default)
- `Cache-Control: no-store` (default untuk endpoint dinamis)
- Untuk upload: `multipart/form-data` (`POST /api/measurements/attachments/upload`)
- Untuk share download: `text/html; charset=utf-8` (no auth required kalau ada `shareToken` valid)
- Untuk attachment download: `Content-Type: <mime>` + `Content-Disposition: inline; filename="..."`

---

## 2. Daftar Endpoint (semua ~200)

> Symbol: 🔒 butuh sesi `hlSession` · 👑 butuh `admin.*` permission · 💎 butuh entitlement (plan berbayar) · ⏰ butuh `CRON_SECRET` · 🤖 dipanggil Telegram · 🌍 publik (share/download).

### 2.1 Health & Root

| Method | Path | Auth | Keterangan |
|---|---|---|---|
| GET | `/` | — | Health check: `{ name, status, db, r2, queue, ai, version }` (worker/src/index.ts:916) |

### 2.2 Authentication & Onboarding

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/auth/register` | — | `{ email, password, displayName }` → set hlSession. Deprecated, digantikan start/verify | index.ts:923 |
| POST | `/api/auth/register/start` | — | `{ email, password, displayName, locale? }` → `{ challengeId, expiresAt, devOtp? }`. Kirim OTP ke email. | routes-auth.ts:182 |
| POST | `/api/auth/register/verify` | — | `{ challengeId, otp }` → set hlSession | routes-auth.ts:223 |
| POST | `/api/auth/login` | — | `{ email, password }` → set hlSession. Deprecated, digantikan start/verify | index.ts:1063 |
| POST | `/api/auth/login/start` | — | `{ email, password?, locale? }` → `{ challengeId, expiresAt, devOtp? }` (kalau password valid) | routes-auth.ts:259 |
| POST | `/api/auth/login/verify` | — | `{ challengeId, otp }` → set hlSession | routes-auth.ts:302 |
| POST | `/api/auth/otp/resend` | — | `{ challengeId, locale? }` → `{ challengeId, expiresAt, devOtp? }`. Rate-limited. | routes-auth.ts:339 |
| POST | `/api/auth/logout` | 🔒 | revoke sesi saat ini | index.ts:1762 |
| GET | `/api/auth/me` | 🔒 | `{ user, profile, requiresOnboarding, roles, permissions, planCode }` | index.ts:1216 |
| POST | `/api/auth/forgot-password` | 🔒 | `{ email }` → trigger reset email | index.ts:1785 |
| POST | `/api/auth/change-password` | 🔒 | `{ oldPassword, newPassword }` | routes-auth.ts:481 |
| GET | `/api/auth/google` | — | redirect ke Google OAuth (`mode=login` or `link`) | routes-auth.ts:46 |
| GET | `/api/auth/google/callback` | — | `{ code, state }` → set hlSession OR error | routes-auth.ts:64 |
| POST | `/api/auth/google/link` | 🔒 | link akun Google ke akun saat ini | routes-auth.ts:145 |
| DELETE | `/api/auth/google/link` | 🔒 | unlink Google | routes-auth.ts:153 |
| GET | `/api/auth/google/accounts` | 🔒 | daftar akun Google tertaut | routes-auth.ts:165 |
| GET | `/api/dev/test-email-outbox/latest` | — (dev) | latest OTP terkirim (untuk e2e) | routes-auth.ts:366 |
| POST | `/api/profile/onboarding` | 🔒 | `{ sex, birthDate, heightCm, timezone, accessibilityMode?, theme?, emergencyConsent, aiConsent, dataShareConsent, whatsappNumber? }` | index.ts:1306 |

### 2.3 Profile & Preferences

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/me/preferences` | 🔒 | baca `dataShareConsent`, `aiConsent`, locale, notif preferences | index.ts:1427 |
| PUT | `/api/me/preferences` | 🔒 | update preferensi (consent, locale) | index.ts:1437 |
| GET | `/api/profile` | 🔒 | baca `HL_userProfiles` lengkap | index.ts:1450 |
| PUT | `/api/profile` | 🔒 | update profile (sex, birthDate, heightCm, timezone, theme, accessibilityMode, whatsappNumber) | index.ts:1493 |
| PUT | `/api/settings/ui` | 🔒 | update theme / accessibility mode (ringan) | index.ts:1618 |
| PUT | `/api/settings/consent` | 🔒 | update consent flags (ai, dataShare, emergency) | routes-extra.ts:826 |

### 2.4 Metrics Catalog

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/metrics/catalog` | 🔒 | `{ devices: [{deviceCode, deviceName, metrics: [{metricCode, metricName, unit, inputType, requiresAttachment, requiresFasting, ...}]}] }` | index.ts:1709 |

### 2.5 Measurements

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/measurements/extract` | 🔒 | `{ imageBase64, mimeType, deviceCode, metricGroup, selectedMetrics[] }` → `{ values: { metricCode, rawAiValue, confidence, unit }[], modelName, durationMs }`. Rate-limited via `ocrRateLimitMax/WindowMin`. | index.ts (legacy, lihat juga routes-extra.ts:limit-check) |
| POST | `/api/measurements/extract/limit-check` | 🔒 | pre-check rate limit; return `{ allowed, remaining }` | routes-extra.ts:369 |
| POST | `/api/measurements/validate` | 🔒 | `{ deviceCode, values: [{metricCode, finalValue, unit, manualOverride}] }` → rules lookup → `{ values: [{ metricCode, status, severity, emergencyLevel, ruleId, popupTitle, popupMessage, recommendation, sourceLabel, recommendationRequired }] }` | index.ts:1829 |
| POST | `/api/measurements/submit` | 🔒 | full submit: session + values + alerts + recommendations + telegram enqueue + streak + badges | index.ts:2129 |
| GET | `/api/measurements/history` | 🔒 | `?from&to&limit=20` → `{ sessions: [{ id, measuredAt, source, hasAttachment, hasEmergency, values, attachments }] }` | index.ts:2461 |
| GET | `/api/measurements/today` | 🔒 | `{ sessions, date }` filtered by user tz | index.ts:2602 |
| GET | `/api/measurements/last` | 🔒 | `[{ metricCode, deviceCode, finalValue, unit, measuredAt }]` (auto-fill cache) | index.ts:2564 |
| POST | `/api/measurements/last/save` | 🔒 | `{ metricCode, deviceCode, finalValue, unit, measuredAt }` upsert | index.ts:2580 |
| GET | `/api/measurements/drafts` | 🔒 | active drafts list | routes-extra.ts:705 |
| DELETE | `/api/measurements/:id` | 🔒 | hapus session + attachments + alerts (cascade) | routes-extra.ts:717 |
| POST | `/api/measurements/attachments/upload` | 🔒 | multipart `{ sessionId, metricCode, file, width, height }` → `{ attachmentId, r2Key, sizeBytes, width, height }`. Max `maxUploadSizeBytes`. | index.ts:2381 |
| GET | `/api/measurements/attachments/:id` | 🔒 | binary stream (webp) — own only | index.ts:2647 |

### 2.6 Dashboards

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| GET | `/api/dashboard/today` | 🔒 | `{ date, metricCount, sessionCount, emergencyCount, hasData, streak, bestStreak, aiInsight, sessions[], values[], alerts[] }`. 48h window + JS-side tz filter. | index.ts:2683 |
| GET | `/api/dashboard/weekly` | 🔒 | `{ period:'7d', metrics[{metricCode,avgValue,minValue,maxValue,cnt}], daily[{day,sessionCount}], measurementDays, bestDay, worstDay, alertCount, adherence }` | index.ts:3153 |
| GET | `/api/dashboard/monthly` | 🔒 | `{ period:'30d', metrics, measurementDays, alertCount, daily, latest[8] }` | index.ts:3203+ |
| GET | `/api/dashboard/comparison` | 🔒 | avg3Day / avg7Day / avg30Day per metric | routes-extra.ts:744 |
| GET | `/api/dashboard/daily-health` | 🔒 | today's combined health hub (measurements + symptoms + hydration + cycle summary) | routes-auth.ts:471 |

### 2.7 AI (Sprint 1–5 + Sprint 6)

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/ai/recommendation` | 🔒 | `{ sessionId? }` → `{ recommendationId, recommendation, safetyStatus, has3DayComparison, has7DayComparison, dataMessages, summary }` | index.ts:2929 |
| POST | `/api/ai/assistant` | 🔒 💎 `feature.aiAssistant.use` | `{ question, clinicalCopilotMode? }` → `{ reply, patternScore, disclaimer, model, usedFallback, vitals, profile, dataSufficiencyScore, scoreReason, contextTrace, usedVectorContext }`. Kalau `clinicalCopilotMode:true` → 403 deferred. | index.ts:3022 |
| GET | `/api/ai/recommendations` | 🔒 | list recommendation history | routes-extra.ts:780 |
| POST | `/api/ai/context/query` | 🔒 💎 `feature.aiClinicalCopilot.vectorMemory` (S6) | `{ queryText, sourceTypes?, topK?, minScore? }` → `{ results: [{vectorId, content, score, metadata}], usedVectorContext, fallbackReason, durationMs }` | routes-ai.ts:30 |
| GET | `/api/ai/context-package` | 🔒 | assembled context package v2 (Sprint 6 upgraded: includes operatingMode, forbiddenActions, dataSufficiencyScore) | routes-ai.ts:57 |
| GET | `/api/ai/memory/status` | 🔒 | `{ indexedCount, pendingCount, failedCount, lastJobAt }` | routes-ai.ts:67 |
| POST | `/api/ai/memory/rebuild` | 🔒 | `{ sourceTypes?, rangeStart?, rangeEnd? }` → enqueue `HL_aiMemoryJobs` (jobType=rebuild) | routes-ai.ts:75 |
| DELETE | `/api/ai/memory` | 🔒 | hapus semua vector documents user | routes-ai.ts:87 |
| POST | `/api/ai/disclaimer/enforce` | 🔒 | `{ text, modelName }` → `{ text, disclaimerAppended, wasFiltered }` | routes-ai.ts:96 |

### 2.7a AI Clinical Copilot (Sprint 6 — S6E/S6F)

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/ai/clinical/session/start` | 🔒 💎 `feature.aiClinicalCopilot.use` | `{ channel?, sessionType? }` → proxy ke #2 → `{ sessionId, sessionUuid, dataSufficiencyScore, redFlagStatus, operatingMode }` | routes-ai.ts (→ #2) |
| POST | `/api/ai/clinical/message` | 🔒 💎 `feature.aiClinicalCopilot.use` | `{ sessionId, message, locale? }` → proxy ke #2 → `{ answerType, content, disclaimer, safetyDecision, contextTrace, dataSufficiencyScore }`. Message max 5000 chars. | routes-ai.ts (→ #2) |
| GET | `/api/ai/clinical/sessions` | 🔒 | list user sessions | routes-ai.ts (→ #2) |
| GET | `/api/ai/clinical/sessions/:id` | 🔒 | session detail | routes-ai.ts (→ #2) |
| POST | `/api/ai/clinical/sessions/:id/close` | 🔒 | close session | routes-ai.ts (→ #2) |
| POST | `/api/ai/clinical/follow-up` | 🔒 💎 `feature.aiClinicalCopilot.use` | `{ sessionId }` → generate follow-up questions | routes-ai.ts (→ #2) |
| POST | `/api/ai/clinical/first-aid` | 🔒 💎 `feature.aiClinicalCopilot.firstAid` | `{ keyword, locale? }` → first aid protocol (lookup → AI Search → fallback). Emergency red flags trigger deterministic template. | routes-ai.ts (→ #2) |
| POST | `/api/ai/clinical/emergency-guidance` | 🔒 💎 `feature.aiClinicalCopilot.emergencyGuidance` | `{ sessionId? }` → deterministic emergency template (119/112/faskes/caregiver). NO LLM freeform. | routes-ai.ts (→ #2) |
| POST | `/api/ai/clinical/doctor-handoff` | 🔒 💎 `feature.aiClinicalCopilot.doctorHandoff` | `{ sessionId, rangeDays? }` → queue to #3 → R2 report + D1 metadata | routes-ai.ts (→ #2 → #3) |
| POST | `/api/ai/clinical/safety-check` | 🔒 👑 | `{ text, modelName }` → run Safety Runtime v2 on text (admin test) | #2 internal/admin |

### 2.7b WhatsApp (Sprint 6 — S6G)

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/whatsapp/link/start` | 🔒 💎 `feature.aiClinicalCopilot.whatsapp` | `{ phoneNumber }` → `{ whatsappLinkId, otpExpiresAt }` → OTP ke WA | routes-whatsapp.ts |
| POST | `/api/whatsapp/link/verify` | 🔒 | `{ whatsappLinkId, otp }` → verify + link (atomic CAS, OTP_EXPIRED/OTP_INVALID/OTP_ALREADY_USED) | routes-whatsapp.ts |
| GET | `/api/whatsapp/status` | 🔒 | `{ linked, aiEnabled, phoneNumber, lastMessageAt }` | routes-whatsapp.ts |
| DELETE | `/api/whatsapp/link` | 🔒 | unlink WA number | routes-whatsapp.ts |
| POST | `/api/whatsapp/webhook` | 🤖 `WA_GATEWAY_SECRET` | Baileys inbound message → Worker #4 → Service Binding → #2 (clinical) or #1 (link/unlinked) | webhook/src/index.ts |
| POST | `/api/whatsapp/media/ingest` | 🤖 `WA_GATEWAY_SECRET` | WA media upload → R2 (MIME allowlist: jpeg/png/jpg/pdf, max 10MB) | webhook/src/index.ts |
| GET | `/api/whatsapp/health` | ⏰ `CRON_SECRET` | Baileys gateway health check | webhook/src/index.ts |

### 2.8 Reports

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| GET | `/api/reports/daily` | 🔒 | `{ date, sessions, values }` filtered by tz | index.ts (after monthly) |
| GET | `/api/reports/weekly` | 🔒 | weekly aggregate | index.ts |
| GET | `/api/reports/monthly` | 🔒 | monthly aggregate | index.ts |
| POST | `/api/reports/doctor-ready` | 🔒 💎 `feature.doctorPdf.generate` | generate HTML report 30 hari → R2 + `HL_reports` row. Return `{ reportId, status }` | routes-extra.ts:456 |
| GET | `/api/reports/:id/download` | 🔒 | HTML stream from R2 (own + caregiver w/ `canViewDashboard`) | routes-extra.ts:486 |
| GET | `/api/reports/:id/data` | 🔒 | `{ reportId, patientName, rangeStart, rangeEnd, count, values[] }` untuk CSV export | routes-extra.ts:531 |
| POST | `/api/reports/:id/share` | 🔒 | `{ recipientLabel?, expiresInHours? (1..168) }` → `{ shareToken, expiresAt, shareUrl }` | routes-extra.ts:507 |
| GET | `/api/reports/share/:shareToken` | 🌍 | public HTML view (no auth, no cookie). 404 kalau expired/revoked. | routes-extra.ts:566 |

### 2.9 Knowledge Base

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/kb/:slug` | 🔒 | `{ slug, title, category, contentMarkdown, sortOrder }` dari `HL_knowledgeArticles` | routes-extra.ts:803 |
| GET | `/api/kb` | 🔒 | list artikel | (internal/list mungkin via dashboard) |

### 2.10 Telegram (Bot & Webhook)

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| POST | `/api/webhook/telegram/water` | 🤖 | Telegram callback query (hydration quick-add) → write `HL_waterIntakeLogs` + ack `answerCallbackQuery` | routes-telegram.ts:61 |
| POST | `/api/telegram/water-webhook` | 🤖 | redirect 307 ke `/api/webhook/telegram/water` (legacy path) | routes-telegram.ts:161 |
| POST | `/api/internal/cron/hydration-reminders` | ⏰ | cron trigger hydration reminders via Telegram | routes-telegram.ts:164 |
| POST | `/api/internal/cron/reminders` | ⏰ | cron generic: kirim HL_reminderSettings sesuai `scheduleTime` & `channel` | routes-extra.ts:404 |
| POST | `/api/emergency/contacts/notify` | 🔒 | manual trigger kirim emergency alert (untuk testing) | routes-extra.ts:390 |

### 2.11 Family & Caregiver

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/family/access-check` | 🔒 | `{ roles: [{memberId, role, permissions}] }` untuk user saat ini sebagai linked user | routes-extra.ts:313 |
| GET | `/api/family-links/:familyLinkId/permissions/cycle` | 🔒 | `{ allowed, permissionCode }` apakah family member boleh lihat cycle | routes-cycle.ts:151 |
| PUT | `/api/family-links/:familyLinkId/permissions/sensitive-health` | 🔒 👑 | `{ allowed }` set sensitive-health permission (cycle/symptom/etc) | routes-cycle.ts:162 |

### 2.12 Emergency Contacts

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| PATCH | `/api/emergency/contacts/:id/consent` | 🔒 | `{ consentGiven: boolean }` toggle consent per kontak (audit) | routes-extra.ts:288 |
| POST | `/api/emergency/contacts/notify` | 🔒 | manual trigger (testing) | routes-extra.ts:390 |

### 2.13 Medications & Adherence

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/medications/adherence` | 🔒 | `{ date, adherence (%), taken, total }` 7-day window | routes-extra.ts:434 |

(Lainnya seperti CRUD medications/logs ada di `routes-extra.ts` — lihat implementasi Sprint 3.)

### 2.14 Fasting

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/fasting/start` | 🔒 | `{ fastingType, targetHours }` → `{ sessionId, startedAt }` | routes-extra.ts:586 |
| POST | `/api/fasting/stop` | 🔒 | stop active session → `{ sessionId, durationMinutes, completed }` | routes-extra.ts:606 |
| GET | `/api/fasting/current` | 🔒 | `{ active: boolean, session?, elapsedMinutes, targetHours }` | routes-extra.ts:625 |

### 2.15 Streaks & Badges (Gamification)

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/streaks` | 🔒 | `{ currentCount, bestCount, lastDate, type }` per `streakType` | routes-extra.ts:640 |
| GET | `/api/badges` | 🔒 | earned badges list `{ badgeCode, badgeName, description, icon, earnedAt }` | routes-extra.ts:653 |

### 2.16 Patterns

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/patterns` | 🔒 | list `HL_patternInsights` (cursor pagination) | routes-extra.ts:977 |
| POST | `/api/patterns/generate/sleep-bp` | 🔒 | analisis tidur vs sistolik (14 hari). Returns `{ insight, hasEnoughData, lowSleepAvg, normalSleepAvg }` | routes-extra.ts:340 |
| POST | `/api/patterns/generate/weight-bp` | 🔒 | analisis berat badan vs tekanan darah | routes-extra.ts:666 |
| POST | `/api/patterns/generate/medication` | 🔒 | adherence pattern | routes-extra.ts:686 |

### 2.17 Education (Sprint 5A)

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| GET | `/api/education/cards` | 🔒 | `?topicType=&topicCode=&locale=` → list `HL_educationCards` user belum ack | routes-auth.ts:376 |
| POST | `/api/education/cards/:topicType/:topicCode/acknowledge` | 🔒 | upsert `HL_userEducationProgress.acknowledgedAt` | routes-auth.ts:394 |

### 2.18 Symptoms (Sprint 5A)

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/symptoms` | 🔒 | `{ symptomDateTime, quickSymptoms[], bodyArea?, painScale?, painSeverity?, mood?, durationMinutes?, description?, redFlagsJson? }` → deterministic red-flag detection → `HL_symptomLogs` + optional `HL_safetyEvents` | routes-auth.ts:402 |
| GET | `/api/symptoms` | 🔒 | list today | routes-auth.ts:425 |
| GET | `/api/symptoms/history` | 🔒 | `?from&to&limit=` history | routes-auth.ts:432 |
| GET | `/api/symptoms/:symptomLogId` | 🔒 | detail | routes-auth.ts:447 |
| POST | `/api/symptoms/prompt-dismissals` | 🔒 | dismiss daily symptom prompt | routes-auth.ts:462 |

### 2.19 Hydration (Sprint 5B)

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| GET | `/api/hydration/settings` | 🔒 | `{ enabled, reminderEnabled, operatingStart, operatingEnd, telegramQuickAddEnabled, customBaseTargetMl, isPregnant, isLactating }` | routes-hydration.ts:34 |
| PUT | `/api/hydration/settings` | 🔒 | update settings | routes-hydration.ts:43 |
| GET | `/api/hydration/today` | 🔒 | `{ date, targetMl, consumedMl, remainingMl, percentage, overLimit, logs[] }` | routes-hydration.ts:60 |
| POST | `/api/hydration/logs` | 🔒 | `{ amountMl (1..3000), loggedAt?, notes? }` → log + auto `HL_safetyEvents` kalau over | routes-hydration.ts:75 |
| GET | `/api/hydration/history` | 🔒 | `?from&to&limit=` history | routes-hydration.ts:95 |
| DELETE | `/api/hydration/logs/:logId` | 🔒 | hapus log | routes-hydration.ts:119 |

### 2.20 Cycle Tracking (Sprint 5D)

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| GET | `/api/cycle/access` | 🔒 | `{ allowed, reason }` cek eligibility (sex, onboarding, plan) | routes-cycle.ts:47 |
| GET | `/api/cycle/settings` | 🔒 | `{ cycleLengthDays, periodLengthDays, lastPeriodStart, isPregnant, isLactating, isMenopause, predictionPaused, pauseReason }` | routes-cycle.ts:56 |
| PUT | `/api/cycle/settings` | 🔒 | update settings | routes-cycle.ts:67 |
| GET | `/api/cycle/calendar` | 🔒 | `?from&to&months=` → `{ days: [{date, phase, isPeriod, isFertile, isOvulation, isPredictedPeriod, isPredictedFertile}] }` | routes-cycle.ts:81 |
| POST | `/api/cycle/logs` | 🔒 | `{ logDate, hasPeriodFlow, flowIntensity?, mood?, physicalSymptoms[], unprotected, contraceptionGuardrailAcknowledgedAt?, notes? }` | routes-cycle.ts:99 |
| GET | `/api/cycle/logs` | 🔒 | `?from&to&limit=` history | routes-cycle.ts:125 |
| POST | `/api/cycle/guardrails/acknowledge` | 🔒 | `{ guardrailType, relatedDate, messageVersion? }` → `HL_cycleGuardrailAcknowledgements` (audit) | routes-cycle.ts:136 |

### 2.21 Admin — Foundation & Dashboard

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/admin/dashboard/summary` | 🔒 👑 | counts (users, sessions, alerts, subscriptions, etc) | routes-admin.ts:39 |

### 2.22 Admin — AI / Memory (Sprint 5 + 6)

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/admin/users/:userId/ai-memory/status` | 🔒 👑 `admin.aiMemory.read` | per-user vector index status | routes-ai.ts:107 |
| POST | `/api/admin/users/:userId/ai-memory/rebuild` | 🔒 👑 `admin.aiMemory.manage` | trigger rebuild untuk user tertentu | routes-ai.ts:118 |
| GET | `/api/admin/ai-clinical-copilot/readiness` | 🔒 👑 `admin.aiClinicalCopilot.manage` | `{ ready, missingTables, missingConfigs, clinicalCopilotEnabled }` | routes-ai.ts:130 |

### 2.22a Admin — AI Governance (Sprint 6 — S6H)

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/admin/ai/model-runs` | 🔒 👑 `admin.aiModelRun.read` | Model run dashboard (filters: userId, status, channel, taskCode, date). Summary: successRate, avgLatencyMs, topTasks, topModels. | routes-admin.ts |
| GET | `/api/admin/ai/safety-flags` | 🔒 👑 `admin.aiSafety.read` | Safety flags dashboard (grouped by flagCode, severity, actionTaken) | routes-admin.ts |
| GET | `/api/admin/ai/prompt-versions` | 🔒 👑 `admin.aiConfig.read` | List prompt versions | routes-admin.ts |
| POST | `/api/admin/ai/prompt-versions` | 🔒 👑 `admin.aiConfig.update` | Create prompt version (status=draft) | routes-admin.ts |
| GET | `/api/admin/ai/prompt-versions/:id` | 🔒 👑 `admin.aiConfig.read` | Get single prompt version | routes-admin.ts |
| PUT | `/api/admin/ai/prompt-versions/:id/activate` | 🔒 👑 `admin.aiConfig.update` | Activate prompt: deprecate previous active + invalidate KV cache + audit log (action=promptVersionActivated) | routes-admin.ts |
| GET | `/api/admin/ai/evaluations` | 🔒 👑 `admin.aiEvaluation.read` | List evaluation runs | routes-admin.ts |
| POST | `/api/admin/ai/evaluations/run` | 🔒 👑 `admin.aiEvaluation.review` | Queue eval batch job to #3 | routes-admin.ts |
| POST | `/api/admin/ai/evaluations/:id/review` | 🔒 👑 `admin.aiEvaluation.review` | Submit review (status: pass/fail/needs_investigation + notes + audit) | routes-admin.ts |
| GET | `/api/admin/ai/vectorize/health` | 🔒 👑 `admin.aiConfig.read` | Proxy ke #2 → `{ totalVectors, capacityPercent, userCount, avgVectorsPerUser, usersAtLimit, indexStatus }` | routes-admin.ts (→ #2) |
| GET | `/api/admin/whatsapp/sessions` | 🔒 👑 `admin.whatsapp.read` | WA session monitor (linked users, aiEnabled count, activeNow) | routes-admin.ts |
| POST | `/api/admin/ai/kb/reindex` | 🔒 👑 `admin.aiConfig.update` | Queue KB reindex job (only approved docs). Returns 202. | routes-admin.ts (→ #3) |
| GET | `/api/admin/ai/kb/reindex` | 🔒 👑 `admin.aiConfig.read` | KB reindex status | routes-admin.ts |
| GET | `/api/admin/ai/operating-mode` | 🔒 👑 `admin.aiConfig.read` | Get current operating mode (standard/proactive/super_aktif) | routes-admin.ts |
| PUT | `/api/admin/ai/operating-mode` | 🔒 👑 `admin.aiConfig.update` | Change operating mode. Super admin only. Reviewer approval gate if config `clinicalCopilot.operatingModeChangeRequiresMedicalReviewer=true`. Downgrade to standard skips reviewer. Audit: action=aiOperatingModeChanged. Max 1 change/hour. | routes-admin.ts |
| POST | `/api/admin/ai/operating-mode/:requestId/approve` | 🔒 👑 `admin.aiEvaluation.review` | Medical reviewer approves mode change request | routes-admin.ts |

### 2.23 Billing / Plans / Subscription

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/plans` | 🔒 | list `HL_plans` (public pricing) | routes-admin.ts:56 |
| POST | `/api/me/subscribe` | — | **DEPRECATED (410)** — replaced by `POST /api/billing/checkout` | routes-admin.ts:71 |
| POST | `/api/billing/checkout` | 🔒 💎 | `{ planCode, provider?, returnUrl? }` → create `HL_billingCheckoutSessions` + return checkout URL | index.ts:5660 |
| GET | `/api/billing/checkout/:checkoutId` | 🔒 | get checkout session status | index.ts:5716 |
| GET | `/api/billing/my-subscription` | 🔒 | current user's `HL_subscriptions` + plan | index.ts:5732 |
| GET | `/api/billing/invoices` | 🔒 | list `HL_billingCheckoutSessions` history | index.ts:5743 |
| POST | `/api/billing/webhook/:provider` | 🤖 | Xendit / generic / mock webhook → `HL_paymentEvents` + subscription activation | index.ts:5754 |

### 2.24 Admin — Users, Roles, Permissions

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/admin/me` | 🔒 👑 | current admin profile + permissions | index.ts:4633 |
| GET | `/api/admin/metrics` | 🔒 👑 | system metrics | index.ts:4657 |
| GET | `/api/admin/users` | 🔒 👑 | list users | index.ts:4684 |
| GET | `/api/admin/users/:userId` | 🔒 👑 | user detail | index.ts:4731 |
| PUT | `/api/admin/users/:userId/status` | 🔒 👑 | activate/deactivate user | index.ts:4772 |
| GET | `/api/admin/roles` | 🔒 👑 | list roles | index.ts:4805 |
| POST | `/api/admin/roles` | 🔒 👑 | create role | index.ts:4833 |
| PUT | `/api/admin/roles/:roleCode` | 🔒 👑 | update role | index.ts:4900 |
| DELETE | `/api/admin/roles/:roleCode` | 🔒 👑 | delete role | index.ts:4946 |
| PUT | `/api/admin/roles/:roleCode/permissions` | 🔒 👑 | assign permissions to role | index.ts:4863 |
| GET | `/api/admin/permissions` | 🔒 👑 | list permissions | index.ts:4929 |
| POST | `/api/admin/users/:userId/roles` | 🔒 👑 | assign role to user | index.ts:4966 |
| DELETE | `/api/admin/users/:userId/roles/:roleCode` | 🔒 👑 | revoke role from user | index.ts:4998 |

### 2.25 Admin — Plans, Subscriptions, Billing

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/admin/plans` | 🔒 👑 | list plans | index.ts:5038 |
| POST | `/api/admin/plans` | 🔒 👑 | create plan | index.ts:5061 |
| PUT | `/api/admin/plans/:planCode` | 🔒 👑 | update plan | index.ts:5085 |
| DELETE | `/api/admin/plans/:planCode` | 🔒 👑 | delete plan | index.ts:5106 |
| GET | `/api/admin/plans/:planCode/features` | 🔒 👑 | list plan features | index.ts:5124 |
| PUT | `/api/admin/plans/:planCode/features` | 🔒 👑 | update plan features | index.ts:5143 |
| GET | `/api/admin/subscriptions` | 🔒 👑 | list subscriptions | index.ts:5169 |
| POST | `/api/admin/users/:userId/subscriptions` | 🔒 👑 | manual create subscription | index.ts:5189 |
| PUT | `/api/admin/subscriptions/:subscriptionId` | 🔒 👑 | update/cancel subscription | index.ts:5210 |

### 2.26 Admin — Config, AI Config, Feature Flags

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/admin/configs` | 🔒 👑 `admin.config.read` | list `HL_systemConfigs` + `HL_configMetadata` | index.ts:5265 |
| POST | `/api/admin/configs` | 🔒 👑 `admin.config.update` | create config | index.ts:5317 |
| PUT | `/api/admin/configs/:configKey` | 🔒 👑 `admin.config.update` | update config | index.ts:5280 |
| DELETE | `/api/admin/configs/:configKey` | 🔒 👑 `admin.config.update` | delete config | index.ts:5359 |
| GET | `/api/admin/ai-config` | 🔒 👑 `admin.aiConfig.update` | get AI config | index.ts:5392 |
| PUT | `/api/admin/ai-config` | 🔒 👑 `admin.aiConfig.update` | update AI config | index.ts:5409 |
| GET | `/api/admin/feature-flags` | 🔒 👑 | list feature flags | index.ts:5430 |
| POST | `/api/admin/feature-flags` | 🔒 👑 | create feature flag | index.ts:5451 |
| PUT | `/api/admin/feature-flags/:flagCode` | 🔒 👑 | update feature flag | index.ts:5485 |
| DELETE | `/api/admin/feature-flags/:flagCode` | 🔒 👑 | delete feature flag | index.ts:5527 |
| GET | `/api/me/entitlements` | 🔒 | current user's entitlements | index.ts:5230 |
| POST | `/api/internal/usage/consume` | 🔒 👑 / internal | consume usage quota (internal) | index.ts:5249 |

### 2.27 Admin — Master Data, Education, KB, Audit

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET/POST/PUT/DELETE | `/api/admin/metric-catalog*` | 🔒 👑 | CRUD `HL_metricCatalog` | (di worker/src/index.ts) |
| GET/POST/PUT/DELETE | `/api/admin/metric-rules*` | 🔒 👑 | CRUD `HL_metricRules` | (di worker/src/index.ts) |
| GET/POST/PUT/DELETE | `/api/admin/education-cards*` | 🔒 👑 | CRUD `HL_educationCards` | (di worker/src/index.ts) |
| GET/POST/PUT/DELETE | `/api/admin/kb*` | 🔒 👑 | CRUD `HL_knowledgeArticles` | (di worker/src/index.ts) |
| GET | `/api/admin/audit-logs` | 🔒 👑 `admin.audit.read` | filtered audit logs | (di worker/src/index.ts) |
| GET | `/api/admin/safety-events` | 🔒 👑 `admin.security.read` | `HL_safetyEvents` summary | (di worker/src/index.ts) |
| GET | `/api/admin/sensitive-access/symptoms` | 🔒 👑 `admin.sensitiveHealth.read` | audited symptom access | (di worker/src/index.ts) |
| GET | `/api/admin/sensitive-access/cycles` | 🔒 👑 `admin.sensitiveHealth.read` | audited cycle access | (di worker/src/index.ts) |

### 2.28 Telegram (General)

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/telegram/status` | 🔒 | linked Telegram status | index.ts:3553 |
| POST | `/api/telegram/connect` | 🔒 | link/init Telegram verification | index.ts:3568 |
| POST | `/api/telegram/test` | 🔒 | send test message | index.ts:3587 |
| POST | `/api/telegram/webhook` | 🤖 | general Telegram update webhook | index.ts:6262 |

---

## 3. Payload Skema (sampel)

### 3.1 `POST /api/measurements/submit`

```json
{
  "deviceCode": "yuwell_oximeter",
  "measuredAt": "2026-06-30T08:15:00.000Z",
  "source": "photo",
  "values": [
    { "metricCode": "spo2", "finalValue": 98, "unit": "%", "manualOverride": false },
    { "metricCode": "heartRate", "finalValue": 72, "unit": "bpm", "manualOverride": false }
  ],
  "notes": "Pagi setelah bangun tidur",
  "selectedMetrics": ["spo2", "heartRate"]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "sessionId": 12345,
    "values": [
      { "metricCode": "spo2", "finalValue": 98, "status": "normal", "severity": "normal", "emergencyLevel": "none" },
      { "metricCode": "heartRate", "finalValue": 72, "status": "normal", "severity": "normal", "emergencyLevel": "none" }
    ],
    "streak": { "currentCount": 7, "bestCount": 12 },
    "awardedBadges": [],
    "aiRecommendationId": 888
  },
  "meta": { "requestId": "req_lz01abc", "durationMs": 184 }
}
```

### 3.2 `POST /api/ai/assistant`

```json
// Request
{ "question": "Apakah tekanan darah saya pagi ini aman?", "clinicalCopilotMode": false }
```

```json
// Response
{
  "success": true,
  "data": {
    "reply": "... narasi AI ...",
    "patternScore": 78,
    "disclaimer": "...",
    "model": "deepseek-v4-flash-free",
    "usedFallback": false,
    "vitals": [{ "metricCode": "systolic", "finalValue": 128, "unit": "mmHg", "status": "warning", "severity": "warning", "measuredAt": "..." }],
    "profile": { "displayName": "...", "heightCm": 170, "sex": "male", "birthDate": "..." },
    "dataSufficiencyScore": 72,
    "scoreReason": "...",
    "contextTrace": [{ "metricCode": "systolic", "measuredAt": "...", "sourceType": "measurement", "source": "HL_measurementValues" }],
    "usedVectorContext": false
  },
  "meta": { "requestId": "req_...", "durationMs": 2130 }
}
```

### 3.3 `POST /api/cycle/logs`

```json
{
  "logDate": "2026-06-30",
  "hasPeriodFlow": true,
  "flowIntensity": "medium",
  "mood": "tired",
  "physicalSymptoms": ["cramp", "headache"],
  "unprotected": false,
  "contraceptionGuardrailAcknowledgedAt": null,
  "notes": ""
}
```

### 3.4 `POST /api/hydration/logs`

```json
{ "amountMl": 250, "loggedAt": "2026-06-30T10:15:00.000Z", "notes": "Setelah sarapan" }
```

Response kalau over limit → trigger `HL_safetyEvents` (severity=warning):

```json
{
  "success": true,
  "data": {
    "logId": 98765,
    "todayTotal": 2350,
    "targetMl": 2000,
    "overLimit": true,
    "safetyEventId": 444
  }
}
```

### 3.5 `POST /api/ai/clinical/message` (Sprint 6)

```json
// Request
{ "sessionId": 42, "message": "Apakah tekanan darah saya pagi ini aman?", "locale": "id" }
```

```json
// Response
{
  "success": true,
  "data": {
    "answerType": "safe_summary",
    "content": "Berdasarkan data Anda...",
    "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
    "safetyDecision": "allow_with_disclaimer",
    "contextTrace": [
      { "metricCode": "systolic", "measuredAt": "2026-07-01T08:00:00Z", "sourceType": "measurement" }
    ],
    "dataSufficiencyScore": 72,
    "operatingMode": "standard"
  },
  "meta": { "requestId": "req_abc123", "durationMs": 1850 }
}
```

### 3.6 `PUT /api/admin/ai/operating-mode` (Sprint 6)

```json
// Request
{ "operatingMode": "proactive", "reason": "Increase diagnostic capability" }
```

```json
// Response (approval needed)
{
  "success": true,
  "data": {
    "currentMode": "standard",
    "requestedMode": "proactive",
    "status": "pending_review",
    "requestId": "om-req-123",
    "reviewerApprovalRequired": true
  }
}
```

### 3.7 `POST /api/whatsapp/link/start` (Sprint 6)

```json
// Request
{ "phoneNumber": "+6281234567890" }
```

```json
// Response
{
  "success": true,
  "data": {
    "whatsappLinkId": 1,
    "otpExpiresAt": "2026-07-01T10:05:00Z"
  }
}
```

---

## 4. RBAC + Entitlement Checks (Backend)

```text
getCurrentSession(c)                  → HL_sessions.userId (return null kalau invalid)
RBACService.requirePermission(...)    → 403 admin.permission.required kalau tidak punya
EntitlementService.requireEntitlement(userId, featureCode)
  → cek HL_subscriptions.status='active'
  → cek HL_planFeatures.featureCode enabled=1
  → cek HL_usageCounters quotaLimit vs usedCount (window: day|month|quarter|year|lifetime)
  → return { allowed:false } kalau salah satu gagal (respon ENTITLEMENT_REQUIRED)
```

Contoh di `index.ts`:

```ts
const ent = await EntitlementService.requireEntitlement(c.env.DB, userId, 'feature.aiAssistant.use')
if (!ent.allowed) return jsonResponse(c, failure('ENTITLEMENT_REQUIRED', 'Fitur AI memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], startedAt))
```

---

## 5. Cron & Scheduled Handler

`scheduledHandler(event, env, ctx)` di `routes-extra.ts` — dipanggil Cloudflare Cron Triggers.

Tasks yang dijalankan:

1. **Reminders** — `HL_reminderSettings` yang `enabled=1` dan `nowInTz(tz) === scheduleTime`. Kirim via inApp (always), Telegram (kalau channel=`telegram` dan link verified), Browser Push (kalau channel=`browser` dan `VAPID_PRIVATE_KEY` ada).
2. **Telegram submit summary** — consumer queue `telegram-submit-summary` (di tempat lain: handler queue consumer).
3. **Streak update** — dijalankan via measurement submit (idempotent per hari).
4. **Hydration reminders** — `routes-telegram.ts::cron hydration-reminders` (endpoint, bukan scheduled handler langsung).

Auth: `Authorization: Bearer ${CRON_SECRET}`.

---

## 6. Webhook Security

### 6.1 Telegram Webhook

- Bot token resolved server-side (HL_systemConfigs.telegramBotToken ATAU env.TELEGRAM_BOT_TOKEN).
- Setiap `callback_query.id` dicatat di `HL_telegramCallbackEvents` (UNIQUE) → idempotent.
- `telegramChatId` di-decrypt via `services/crypto.ts` sebelum dipakai.

### 6.2 Billing Webhook (Xendit)

- Signature verification via `XENDIT_WEBHOOK_SECRET`.
- Idempotent: `HL_paymentEvents (provider, providerEventId)` UNIQUE.
- Payment event → `subscription-activation.ts` activate `HL_subscriptions`.

---

## 7. Rate Limiting

| Endpoint | Limit | Config |
|---|---|---|
| `POST /api/measurements/extract` | `ocrRateLimitMax` per `ocrRateLimitWindowMin` menit per user | HL_systemConfigs |
| `POST /api/auth/otp/resend` | hardcoded (3/hour, 10/day) — `routes-auth.ts` |
| `POST /api/auth/login/start` | hardcoded (5 failed → lock 15 menit) | `routes-auth.ts` |
| `POST /api/whatsapp/link/start` | 5/hour per user | `routes-whatsapp.ts` (S6G) |
| `PUT /api/admin/ai/operating-mode` | 1 per hour | `routes-admin.ts` (S6H) |
| AI clinical message | Quota-gated per plan | `feature.aiClinicalCopilot.use` + HL_usageCounters (S6E) |

429 response: `{ success:false, error:{ code:'RATE_LIMITED', message, details } }`.

---

## 8. Audit Logging (WAJIB untuk admin mutation)

```sql
INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
```

Contoh actions:

```text
profileOnboardingComplete
profileUpdate
settingsUiUpdate
consentUpdate
alertCreate            -- HL_alerts insert dari severity emergency
badgeEarned            -- HL_userBadges insert
reportGenerate         -- HL_reports insert
emergencyConsentGiven
emergencyConsentRevoked
aiMemoryRebuild
aiMemoryDelete
planUpdate
metricRuleUpdate
educationCardUpdate
kbArticleUpdate
aiOperatingModeChanged     -- Sprint 6 (S6H): operating mode change
promptVersionActivated     -- Sprint 6 (S6H): prompt version activation
evaluationReview          -- Sprint 6 (S6H): eval case review submitted
whatsappLinkCreated        -- Sprint 6 (S6G): WA number linked
whatsappLinkDeleted        -- Sprint 6 (S6G): WA number unlinked
whatsappOtpVerified        -- Sprint 6 (S6G): WA OTP verify (atomic CAS)
emergencyEvent             -- Sprint 6 (S6F): emergency event logged
```

Field **dilarang**: `actorId`, `targetType`, `targetId` — gunakan `userId`, `entityType`, `entityId`.

---

## 9. Known Limits (Sprint 6)

```text
- AI Clinical Copilot runtime       → LIVE (S6A–S6H ✅). Feature flag: clinicalCopilot.enabled
- AI Operating Mode                  → 3 modes: standard (default), proactive, super_aktif
- Vectorize runtime                  → Active (S6C). Free Tier, 768-dim, 500 vectors/user
- AI Search instance                 → NOT YET PROVISIONED (wrangler.toml commented out)
- Payment provider production        → Xendit (Sprint 5F). Midtrans/Stripe deferred.
- Two-way doctor chat                → out of scope (doctor handoff report via R2)
- Original image storage             → DILARANG (privacy)
- Multi-language UI                  → ID (default) + EN (Sprint 5X i18n)
- Free plan AI Clinical Copilot      → feature.aiClinicalCopilot.use (premium only)
- Free plan AI Assistant             → 3 / month
- Free plan medication reminder      → 3 / lifetime
- Free plan history retention        → 30 hari
- WA message max reply chars         → configurable (whatsappAi.maxReplyChars, default 400)
- Clinical message max length        → 5000 chars
- Operating mode change rate limit   → 1 per hour
> Vectorize per-user limit           → 500 vectors default
- Closed beta                        → T-12/T-15 pending (manual)
```

---

## 10. Versioning & Deprecation

- Base path: `/api/*` (no `/v1/` prefix). Perubahan breaking → header `Sunset` + `Deprecation` (RFC 8594).
- Deprecated endpoints (planned removal Sprint 7):
  - `POST /api/auth/register` (ganti `register/start` + `register/verify`)
  - `POST /api/auth/login` (ganti `login/start` + `login/verify`)

---

Lihat juga:
- Schema: `docs/07-schema.sql`
- Sprint 6 Schema: `worker/migrations/003_sprint6_schema.sql` (10 tables S6), `004-008` (additive migrations)
- Design System: `docs/06-design-system.md`
- Architecture: `docs/04-ARCHITECTURE.md`
- PRD Sprint 1–5: `docs/01-PRD_SPRINT1-5.md`
- PRD Sprint 6: `docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md`
- Sub-PRDs Sprint 6: `docs_sprint6/02-10.PRD_S6A-S6I_*.md`

---

## A. Complete Endpoint Index (Source-of-Truth Audit)

> Generated directly from `worker/src/index.ts` and `worker/src/routes-*.ts`. Total 199 route registrations. Use this as the authoritative checklist.

| Method | Path | Auth | Notes |
|---|---|---|---|
| get | `/` | 🌍 |  |
| post | `/api/account/delete` | 🔒 |  |
| get | `/api/admin/ai-clinical-copilot/readiness` | 🔒 👑 |  |
| get | `/api/admin/ai-config` | 🔒 👑 |  |
| put | `/api/admin/ai-config` | 🔒 👑 |  |
| get | `/api/admin/audit-logs` | 🔒 👑 |  |
| get | `/api/admin/configs` | 🔒 👑 |  |
| post | `/api/admin/configs` | 🔒 👑 |  |
| delete | `/api/admin/configs/:configKey` | 🔒 👑 |  |
| put | `/api/admin/configs/:configKey` | 🔒 👑 |  |
| get | `/api/admin/dashboard/summary` | 🔒 👑 |  |
| get | `/api/admin/education/cards` | 🔒 👑 |  |
| put | `/api/admin/education/cards/:topicType/:topicCode` | 🔒 👑 |  |
| get | `/api/admin/feature-flags` | 🔒 👑 |  |
| put | `/api/admin/feature-flags/:flagCode` | 🔒 👑 |  |
| get | `/api/admin/knowledge-articles` | 🔒 👑 |  |
| put | `/api/admin/knowledge-articles/:slug` | 🔒 👑 |  |
| get | `/api/admin/me` | 🔒 👑 |  |
| get | `/api/admin/metric-catalog` | 🔒 👑 |  |
| put | `/api/admin/metric-catalog/:metricCode` | 🔒 👑 |  |
| get | `/api/admin/metric-rules` | 🔒 👑 |  |
| put | `/api/admin/metric-rules/:ruleCode` | 🔒 👑 |  |
| get | `/api/admin/metrics` | 🔒 👑 |  |
| get | `/api/admin/permissions` | 🔒 👑 |  |
| get | `/api/admin/plans` | 🔒 👑 |  |
| post | `/api/admin/plans` | 🔒 👑 |  |
| delete | `/api/admin/plans/:planCode` | 🔒 👑 |  |
| put | `/api/admin/plans/:planCode` | 🔒 👑 |  |
| get | `/api/admin/plans/:planCode/features` | 🔒 👑 |  |
| put | `/api/admin/plans/:planCode/features` | 🔒 👑 |  |
| get | `/api/admin/roles` | 🔒 👑 |  |
| post | `/api/admin/roles` | 🔒 👑 |  |
| delete | `/api/admin/roles/:roleCode` | 🔒 👑 |  |
| put | `/api/admin/roles/:roleCode` | 🔒 👑 |  |
| put | `/api/admin/roles/:roleCode/permissions` | 🔒 👑 |  |
| get | `/api/admin/safety-events` | 🔒 👑 |  |
| get | `/api/admin/subscriptions` | 🔒 👑 |  |
| put | `/api/admin/subscriptions/:subscriptionId` | 🔒 👑 |  |
| get | `/api/admin/users` | 🔒 👑 |  |
| get | `/api/admin/users/:userId` | 🔒 👑 |  |
| post | `/api/admin/users/:userId/ai-memory/rebuild` | 🔒 👑 |  |
| get | `/api/admin/users/:userId/ai-memory/status` | 🔒 👑 |  |
| post | `/api/admin/users/:userId/roles` | 🔒 👑 |  |
| delete | `/api/admin/users/:userId/roles/:roleCode` | 🔒 👑 |  |
| put | `/api/admin/users/:userId/status` | 🔒 👑 |  |
| post | `/api/admin/users/:userId/subscriptions` | 🔒 👑 |  |
| get | `/api/admin/ai/model-runs` | 🔒 👑 | S6H governance |
| get | `/api/admin/ai/safety-flags` | 🔒 👑 | S6H governance |
| get | `/api/admin/ai/prompt-versions` | 🔒 👑 | S6H governance |
| post | `/api/admin/ai/prompt-versions` | 🔒 👑 | S6H governance |
| put | `/api/admin/ai/prompt-versions/:id/activate` | 🔒 👑 | S6H governance |
| get | `/api/admin/ai/evaluations` | 🔒 👑 | S6H governance |
| post | `/api/admin/ai/evaluations/run` | 🔒 👑 | S6H governance |
| post | `/api/admin/ai/evaluations/:id/review` | 🔒 👑 | S6H governance |
| get | `/api/admin/ai/vectorize/health` | 🔒 👑 | S6H governance |
| get | `/api/admin/whatsapp/sessions` | 🔒 👑 | S6H governance |
| post | `/api/admin/ai/kb/reindex` | 🔒 👑 | S6H governance |
| get | `/api/admin/ai/kb/reindex` | 🔒 👑 | S6H governance |
| get | `/api/admin/ai/operating-mode` | 🔒 👑 | S6H governance |
| put | `/api/admin/ai/operating-mode` | 🔒 👑 | S6H governance |
| post | `/api/admin/ai/operating-mode/:requestId/approve` | 🔒 👑 | S6H governance |
| get | `/api/whatsapp/status` | 🔒 | S6G |
| post | `/api/whatsapp/link/start` | 🔒 | 💎 S6G |
| post | `/api/whatsapp/link/verify` | 🔒 | S6G |
| delete | `/api/whatsapp/link` | 🔒 | S6G |
| post | `/api/whatsapp/webhook` | 🤖 | S6G (Worker #4) |
| post | `/api/whatsapp/media/ingest` | 🤖 | S6G (Worker #4) |
| post | `/api/ai/assistant` | 🔒 | 💎 |
| get | `/api/ai/context-package` | 🔒 |  |
| post | `/api/ai/context/query` | 🔒 | S6: Vectorize context query |
| post | `/api/ai/disclaimer/enforce` | 🔒 |  |
| delete | `/api/ai/memory` | 🔒 |  |
| post | `/api/ai/memory/rebuild` | 🔒 |  |
| get | `/api/ai/memory/status` | 🔒 |  |
| post | `/api/ai/recommendation` | 🔒 |  |
| get | `/api/ai/recommendations` | 🔒 |  |
| post | `/api/ai/report-analysis` | 🔒 |  |
| post | `/api/ai/clinical/session/start` | 🔒 | 💎 S6E |
| post | `/api/ai/clinical/message` | 🔒 | 💎 S6E |
| get | `/api/ai/clinical/sessions` | 🔒 | S6E |
| get | `/api/ai/clinical/sessions/:id` | 🔒 | S6E |
| post | `/api/ai/clinical/sessions/:id/close` | 🔒 | S6E |
| post | `/api/ai/clinical/follow-up` | 🔒 | 💎 S6E |
| post | `/api/ai/clinical/first-aid` | 🔒 | 💎 S6F |
| post | `/api/ai/clinical/emergency-guidance` | 🔒 | 💎 S6F |
| post | `/api/ai/clinical/doctor-handoff` | 🔒 | 💎 S6F |
| get | `/api/alerts` | 🔒 |  |
| post | `/api/alerts/:id/acknowledge` | 🔒 |  |
| post | `/api/auth/change-password` | — |  |
| post | `/api/auth/forgot-password` | — |  |
| get | `/api/auth/google` | — |  |
| get | `/api/auth/google/accounts` | — |  |
| get | `/api/auth/google/callback` | — |  |
| delete | `/api/auth/google/link` | — |  |
| post | `/api/auth/google/link` | — |  |
| post | `/api/auth/login` | — |  |
| post | `/api/auth/login/start` | — |  |
| post | `/api/auth/login/verify` | — |  |
| post | `/api/auth/logout` | 🔒 |  |
| get | `/api/auth/me` | 🔒 |  |
| post | `/api/auth/otp/resend` | — |  |
| post | `/api/auth/register` | — |  |
| post | `/api/auth/register/start` | — |  |
| post | `/api/auth/register/verify` | — |  |
| get | `/api/badges` | 🔒 |  |
| post | `/api/billing/checkout` | 🔒 | 💎 |
| get | `/api/billing/checkout/:checkoutId` | 🔒 |  |
| get | `/api/billing/invoices` | 🔒 |  |
| get | `/api/billing/my-subscription` | 🔒 |  |
| post | `/api/billing/webhook/:provider` | 🤖/⏰ |  |
| get | `/api/caregiver/monitor/:userId` | 🔒 |  |
| get | `/api/cycle/access` | 🔒 |  |
| get | `/api/cycle/calendar` | 🔒 |  |
| post | `/api/cycle/guardrails/acknowledge` | 🔒 |  |
| get | `/api/cycle/logs` | 🔒 |  |
| post | `/api/cycle/logs` | 🔒 |  |
| get | `/api/cycle/settings` | 🔒 |  |
| put | `/api/cycle/settings` | 🔒 |  |
| get | `/api/dashboard/comparison` | 🔒 |  |
| get | `/api/dashboard/daily-health` | 🔒 |  |
| get | `/api/dashboard/monthly` | 🔒 |  |
| get | `/api/dashboard/today` | 🔒 |  |
| get | `/api/dashboard/weekly` | 🔒 |  |
| post | `/api/dev/seed-test-data` | 🔒 |  |
| get | `/api/dev/test-email-outbox/latest` | — |  |
| get | `/api/education/cards` | 🔒 |  |
| post | `/api/education/cards/:topicType/:topicCode/acknowledge` | 🔒 |  |
| get | `/api/emergency/contacts` | 🔒 |  |
| post | `/api/emergency/contacts` | 🔒 |  |
| delete | `/api/emergency/contacts/:id` | 🔒 |  |
| patch | `/api/emergency/contacts/:id/consent` | 🔒 |  |
| post | `/api/emergency/contacts/notify` | 🔒 |  |
| get | `/api/export/csv` | 🔒 |  |
| get | `/api/family-links/:familyLinkId/permissions/cycle` | 🔒 |  |
| put | `/api/family-links/:familyLinkId/permissions/sensitive-health` | 🔒 |  |
| delete | `/api/family/:id` | 🔒 |  |
| post | `/api/family/accept` | 🔒 |  |
| get | `/api/family/access-check` | 🔒 |  |
| get | `/api/family/caregiver/dashboard` | 🔒 |  |
| get | `/api/family/dashboard` | 🔒 |  |
| post | `/api/family/invite` | 🔒 |  |
| get | `/api/family/links` | 🔒 |  |
| put | `/api/family/members/:id/permissions` | 🔒 |  |
| get | `/api/fasting/current` | 🔒 |  |
| post | `/api/fasting/start` | 🔒 |  |
| post | `/api/fasting/stop` | 🔒 |  |
| get | `/api/history/timeline` | 🔒 |  |
| get | `/api/hydration/history` | 🔒 |  |
| post | `/api/hydration/logs` | 🔒 |  |
| delete | `/api/hydration/logs/:logId` | 🔒 |  |
| get | `/api/hydration/settings` | 🔒 |  |
| put | `/api/hydration/settings` | 🔒 |  |
| get | `/api/hydration/today` | 🔒 |  |
| post | `/api/internal/cron/hydration-reminders` | 🤖/⏰ |  |
| post | `/api/internal/cron/reminders` | 🤖/⏰ |  |
| post | `/api/internal/usage/consume` | 🤖/⏰ |  |
| get | `/api/kb` | 🔒 |  |
| get | `/api/kb/:slug` | 🔒 |  |
| get | `/api/me/entitlements` | 🔒 |  |
| get | `/api/me/preferences` | 🔒 |  |
| put | `/api/me/preferences` | 🔒 |  |
| post | `/api/me/subscribe` | 🔒 |  |
| delete | `/api/measurements/:id` | 🔒 |  |
| get | `/api/measurements/attachments/:id` | 🔒 |  |
| post | `/api/measurements/attachments/upload` | 🔒 |  |
| get | `/api/measurements/drafts` | 🔒 |  |
| post | `/api/measurements/extract` | 🔒 |  |
| post | `/api/measurements/extract/limit-check` | 🔒 |  |
| get | `/api/measurements/history` | 🔒 |  |
| get | `/api/measurements/last` | 🔒 |  |
| post | `/api/measurements/last/save` | 🔒 |  |
| post | `/api/measurements/submit` | 🔒 |  |
| post | `/api/measurements/sync` | 🔒 |  |
| get | `/api/measurements/today` | 🔒 |  |
| post | `/api/measurements/validate` | 🔒 |  |
| get | `/api/medication-logs` | 🔒 |  |
| post | `/api/medication-logs` | 🔒 |  |
| get | `/api/medications` | 🔒 |  |
| post | `/api/medications` | 🔒 |  |
| delete | `/api/medications/:id` | 🔒 |  |
| put | `/api/medications/:id` | 🔒 |  |
| post | `/api/medications/:id/log` | 🔒 |  |
| get | `/api/medications/adherence` | 🔒 |  |
| get | `/api/medications/logs` | 🔒 |  |
| get | `/api/metrics/catalog` | 🔒 |  |
| get | `/api/notifications` | 🔒 |  |
| post | `/api/notifications/browser/subscribe` | 🔒 |  |
| get | `/api/patterns` | 🔒 |  |
| post | `/api/patterns/generate` | 🔒 |  |
| post | `/api/patterns/generate/medication` | 🔒 |  |
| post | `/api/patterns/generate/sleep-bp` | 🔒 |  |
| post | `/api/patterns/generate/weight-bp` | 🔒 |  |
| get | `/api/plans` | 🔒 |  |
| post | `/api/privacy/deleteAccount` | 🔒 |  |
| get | `/api/profile` | 🔒 |  |
| put | `/api/profile` | 🔒 |  |
| post | `/api/profile/onboarding` | 🔒 |  |
| post | `/api/push/subscribe` | 🔒 |  |
| post | `/api/push/test` | 🔒 |  |
| delete | `/api/push/unsubscribe` | 🔒 |  |
| get | `/api/push/vapid-key` | 🔒 |  |
| get | `/api/reminders` | 🔒 |  |
| post | `/api/reminders` | 🔒 |  |
| delete | `/api/reminders/:id` | 🔒 |  |
| put | `/api/reminders/:id` | 🔒 |  |
| get | `/api/reports/:id/data` | 🔒 |  |
| get | `/api/reports/:id/download` | 🔒 |  |
| post | `/api/reports/:id/share` | 🔒 |  |
| get | `/api/reports/daily` | 🔒 |  |
| post | `/api/reports/doctor-ready` | 🔒 | 💎 |
| get | `/api/reports/monthly` | 🔒 |  |
| get | `/api/reports/share/:shareToken` | 🌍 |  |
| get | `/api/reports/weekly` | 🔒 |  |
| put | `/api/settings/consent` | 🔒 |  |
| put | `/api/settings/ui` | 🔒 |  |
| get | `/api/streaks` | 🔒 |  |
| get | `/api/symptoms` | 🔒 |  |
| post | `/api/symptoms` | 🔒 |  |
| get | `/api/symptoms/:symptomLogId` | 🔒 |  |
| get | `/api/symptoms/history` | 🔒 |  |
| post | `/api/symptoms/prompt-dismissals` | 🔒 |  |
| post | `/api/telegram/connect` | 🔒 |  |
| put | `/api/telegram/settings` | 🔒 |  |
| get | `/api/telegram/status` | 🔒 |  |
| post | `/api/telegram/test` | 🔒 |  |
| post | `/api/telegram/verify` | 🔒 |  |
| post | `/api/telegram/water-webhook` | 🤖/⏰ |  |
| post | `/api/telegram/webhook` | 🤖/⏰ |  |
| post | `/api/webhook/telegram/water` | 🤖/⏰ |  |
