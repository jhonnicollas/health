# API CONTRACT — HL Health Companion

> **Sumber: audit langsung ke `worker/src/index.ts` (122 endpoint), `routes-extra.ts` (28), `routes-admin.ts` (3), `routes-ai.ts` (10), `routes-auth.ts` (20), `routes-cycle.ts` (9), `routes-hydration.ts` (6), `routes-telegram.ts` (3). Total ~200 endpoint aktif.**
> Dokumen lama: `archive/docs_legacy_2025_sprint1-5/05-api-contract.md`.

---

## 1. Base URL, Auth, Response Envelope

### 1.1 Base URL

| Env | URL |
|---|---|
| Production Worker | `https://hl-health-companion-api.indiehomesungairaya.workers.dev` |
| Pages (frontend) | `https://app.isehat.biz.id` |
| Local dev (worker) | `http://localhost:8787` |
| Local dev (vite) | `http://localhost:5173` (Vite proxy `/api` → worker) |

Pages mem-proxy `/api/*` → Worker lewat `functions/api/[[path]].ts`.

### 1.2 Authentication

- **Cookie**: `hlSession` (HTTP-only, Secure, SameSite=Lax). Diset oleh `POST /api/auth/login`, `POST /api/auth/login/verify`, `/api/auth/google/callback`. Divalidasi server-side via `getCurrentSession(c)` → lookup `HL_sessions` dengan SHA-256 hash token.
- **Bearer (cron only)**: `Authorization: Bearer ${CRON_SECRET}` untuk `/api/internal/cron/*`.
- **Telegram webhook**: diverifikasi via `telegramBotToken` (resolve dari `HL_systemConfigs` atau `env.TELEGRAM_BOT_TOKEN`).

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

### 2.7 AI

| Method | Path | Auth | Body / Response | Sumber |
|---|---|---|---|---|
| POST | `/api/ai/recommendation` | 🔒 | `{ sessionId? }` → `{ recommendationId, recommendation, safetyStatus, has3DayComparison, has7DayComparison, dataMessages, summary }` | index.ts:2929 |
| POST | `/api/ai/assistant` | 🔒 💎 `feature.aiAssistant.use` | `{ question, clinicalCopilotMode? }` → `{ reply, patternScore, disclaimer, model, usedFallback, vitals, profile, dataSufficiencyScore, scoreReason, contextTrace, usedVectorContext }`. Kalau `clinicalCopilotMode:true` → 403 deferred. | index.ts:3022 |
| GET | `/api/ai/recommendations` | 🔒 | list recommendation history | routes-extra.ts:780 |
| POST | `/api/ai/context/query` | 🔒 💎 `feature.vectorMemory.use` | `{ queryText, sourceTypes?, topK?, minScore? }` → `{ results: [{vectorId, content, score, metadata}], usedVectorContext, fallbackReason, durationMs }` | routes-ai.ts:30 |
| GET | `/api/ai/context-package` | 🔒 | assembled context package (untuk AI Clinical Copilot Sprint 6) | routes-ai.ts:57 |
| GET | `/api/ai/memory/status` | 🔒 | `{ indexedCount, pendingCount, failedCount, lastJobAt }` | routes-ai.ts:67 |
| POST | `/api/ai/memory/rebuild` | 🔒 | `{ sourceTypes?, rangeStart?, rangeEnd? }` → enqueue `HL_aiMemoryJobs` (jobType=rebuild) | routes-ai.ts:75 |
| DELETE | `/api/ai/memory` | 🔒 | hapus semua vector documents user | routes-ai.ts:87 |
| POST | `/api/ai/disclaimer/enforce` | 🔒 | `{ text, modelName }` → `{ text, disclaimerAppended, wasFiltered }` | routes-ai.ts:96 |

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

### 2.22 Admin — AI / Memory

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/admin/users/:userId/ai-memory/status` | 🔒 👑 `admin.aiMemory.read` | per-user vector index status | routes-ai.ts:107 |
| POST | `/api/admin/users/:userId/ai-memory/rebuild` | 🔒 👑 `admin.aiMemory.manage` | trigger rebuild untuk user tertentu | routes-ai.ts:118 |
| GET | `/api/admin/ai-clinical-copilot/readiness` | 🔒 👑 `admin.aiClinicalCopilot.manage` | `{ ready, missingTables, missingConfigs, clinicalCopilotEnabled, deferredToSprint:6 }` | routes-ai.ts:130 |

### 2.23 Billing / Plans / Subscription

| Method | Path | Auth | Keterangan | Sumber |
|---|---|---|---|---|
| GET | `/api/plans` | 🔒 | list `HL_plans` (public pricing) | routes-admin.ts:56 |
| POST | `/api/me/subscribe` | 🔒 💎 | `{ planCode, provider?, returnUrl? }` → checkout session (mock or xendit) | routes-admin.ts:71 |

(Plan CRUD admin, subscription admin, payment webhook — ada di service `services/billing/*`; lihat implementasi lengkap di worker.)

### 2.24 Admin — System Config / AI Config / Feature Flags / Master Data / Education / Audit / Users

Selengkapnya ada di modul admin lain (lihat `routes-admin.ts` + services). Ringkasan permission:

```text
admin.config.read              → GET HL_systemConfigs (non-secret only, masked)
admin.config.update            → PUT HL_systemConfigs (validasi storageMode)
admin.aiConfig.update          → PUT aiTextEndpoint, aiTextModels, aiTextDefaultModel, aiVisionTimeoutMs, clinicalCopilotEnabled
admin.aiMemory.read            → GET /api/ai/memory/status (all users)
admin.aiMemory.manage          → POST /api/ai/memory/rebuild (all users)
admin.aiClinicalCopilot.manage → GET/PUT readiness
admin.billing.read             → GET HL_subscriptions, HL_paymentEvents
admin.billing.manage           → POST manual subscription, cancel, refund
admin.metricCatalog.manage     → CRUD HL_metricCatalog
admin.metricRules.manage       → CRUD HL_metricRules (rule priority, severity)
admin.education.manage         → CRUD HL_educationCards
admin.kb.manage                → CRUD HL_knowledgeArticles
admin.featureFlags.manage      → CRUD HL_featureFlags
admin.audit.read               → GET HL_auditLogs (filtered)
admin.security.read            → GET HL_safetyEvents
admin.sensitiveHealth.read     → GET HL_symptomLogs/HL_cycleLogs (audit-wajib)
admin.roles.read               → GET HL_roles, HL_permissions, HL_userRoles
admin.roles.manage             → POST/PUT/DELETE role assignments
admin.users.read               → GET HL_users list + summary
admin.users.update             → PUT HL_users (active, displayName)
admin.support.limitedView      → GET HL_users tanpa PII/sensitive
admin.support.impersonateLimited → audited impersonation
```

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
```

Field **dilarang**: `actorId`, `targetType`, `targetId` — gunakan `userId`, `entityType`, `entityId`.

---

## 9. Known Limits (Sprint 5)

```text
- AI Clinical Copilot runtime       → DEFERRED to Sprint 6 (AI_CLINICAL_COPILOT_DEFERRED)
- Vectorize runtime                 → infrastructure only; no live index di Sprint 5
- Payment provider production       → Xendit (Sprint 5F). Midtrans/Stripe deferred.
- Two-way doctor chat               → out of scope
- Original image storage            → DILARANG (privacy)
- Multi-language UI                 → ID (default) + EN (Sprint 5X i18n)
- Free plan AI Assistant            → 3 / month
- Free plan medication reminder     → 3 / lifetime
- Free plan history retention       → 30 hari
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
- Design System: `docs/06-design-system.md`
- Architecture: `docs/04-ARCHITECTURE.md`
- PRD Sprint 1–5: `docs/01-PRD_SPRINT1-5.md`
