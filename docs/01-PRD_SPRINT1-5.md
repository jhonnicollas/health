# PRODUCT REQUIREMENTS DOCUMENT — HL Health Companion
## Sprint 1–5 Full Scope (Foundation + 5A + 5B + 5C + 5D + 5E + 5F/X)

> **Sumber: audit langsung ke source code (`worker/src/*`, `web/src/*`, `docs/07-schema.sql`, `docs/03.SQL_SCHEMA_SPRINT5_FINAL_…`, `docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_…`).**
> **Status: Sprint 1–5 delivered; Sprint 6 AI Clinical Copilot runtime deferred.**
> **Dokumen lama: `archive/docs_legacy_2025_sprint1-5/01-PRD.docx.md`, `docs/02-PRD_UserStory.docx.md`.**

---

## 1. Product Vision & Mission

**Nama produk:** HL Health Companion (UI brand: HealthSync Pro)

**Vision:**
Membantu pengguna — terutama orang dewasa di Indonesia dan keluarganya — mencatat, memahami, dan mengelola tanda-tanda vital kesehatan harian secara aman, dengan bantuan AI vision, aturan medis deterministik, dan dukungan caregiver/keluarga.

**Tagline:**
> *"Rule-first, AI-assisted, manual-verification-first."*

**Differentiators:**
1. **Cloudflare-native** — semua di edge (Workers, D1, R2, Queues, Cron, Workers AI).
2. **Privacy-by-design** — data sensitif dienkripsi AES-GCM, gambar asli tidak disimpan.
3. **Rule-first** — status / severity selalu dari aturan medis, bukan AI.
4. **Manual override wajib** — setiap nilai AI bisa diperiksa dan dikoreksi.
5. **Bilingual (ID/EN)** — UI dan API response i18n-ready.

---

## 2. Target Users

| Persona | Need | Key flows |
|---|---|---|
| **Adult monitor** (35–55 th) | Pantau tekanan darah, gula, kolesterol harian | Capture → AI extract → validate → submit → dashboard |
| **Senior user** (>60 th) | UI besar, font besar, mudah | Senior mode, bottom-nav, caregiver link |
| **Caregiver / anak** | Pantau orang tua dari jauh | Family invite → caregiver dashboard → receive alert |
| **Doctor / family doctor** | Lihat laporan 30 hari pasien | Doctor-ready PDF → share token |
| **Admin / support** | Kelola user, plan, config, audit | Admin dashboard + RBAC |

---

## 3. Core Product Principles

1. **Rule First, AI Assisted.** Status/severity dari `HL_metricRules`. AI hanya membantu ekstraksi nilai dan narasi interpretasi.
2. **Manual Verification Mandatory.** Setiap nilai AI dapat di-edit; kalau berbeda dengan AI → `manualOverride=1`.
3. **No Original Image Storage.** Gambar dikompres + watermark di client; hanya file final yang masuk R2.
4. **No Hardcoded Config.** Timeout, rate limit, upload size, model AI baca dari `HL_systemConfigs`.
5. **Privacy & Security.** `ENCRYPTION_KEY` untuk data sensitif; no plaintext secret di D1/log/response.
6. **Free-Tier Conscious.** Rate-limited OCR, D1 indexes ringan, queue hanya untuk non-blocking jobs.
7. **Medical Safety.** AI tidak diagnose, prescribe, ubah dosis, atau putuskan emergency.

---

## 4. Sprint Roadmap

```text
Sprint 1 — Core Capture
Sprint 2 — Health Intelligence
Sprint 3 — Family & Alerts
Sprint 4 — Advanced
Sprint 5 Foundation — RBAC, Plans, Billing, Config
Sprint 5A — Google OAuth, Education, Symptom Log
Sprint 5B — Hydration Tracker
Sprint 5C — AI Clinical Infrastructure (Vectorize-ready, deferred runtime)
Sprint 5D — Cycle Tracking & Family Sensitive Permissions
Sprint 5E — Telegram Hydration UX
Sprint 5F/X — Email OTP Auth, Xendit/Mock Billing, Bilingual ID/EN
Sprint 6 (out of scope) — AI Clinical Copilot runtime
```

---

## 5. Sprint 1 — Core Capture

### 5.1 Goals

User dapat login, onboard, memilih device, mengambil foto alat kesehatan, AI extract nilai, manual override, submit, lihat dashboard hari ini, dan terima ringkasan Telegram.

### 5.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S1-1 | Register / Login (lokal) | `POST /api/auth/register`, `POST /api/auth/login`, cookie `hlSession`, `GET /api/auth/me` |
| S1-2 | Onboarding profile | `POST /api/profile/onboarding` wajib sebelum dashboard; validasi sex/birthDate/heightCm/timezone |
| S1-3 | Metrics catalog | `GET /api/metrics/catalog` → devices + metrics (oximeter, BP, glucometer, scale, thermometer, dll) |
| S1-4 | AI Vision extraction | `POST /api/measurements/extract` dengan base64 image → rawAiValue per metric. Timeout configurable. |
| S1-5 | Manual override | `ManualOverrideInput` di FE; `manualOverride=1` di `HL_measurementValues` kalau finalValue ≠ rawAiValue. |
| S1-6 | Rule validation | `POST /api/measurements/validate` → lookup `HL_metricRules` → status/severity/emergencyLevel/popup. |
| S1-7 | Submit measurement | `POST /api/measurements/submit` → insert `HL_measurementSessions` + `HL_measurementValues` + `HL_alerts` (jika severity ≥ warning). |
| S1-8 | Attachment upload | Compress + watermark webp → R2 → `HL_measurementAttachments`. Max size configurable. |
| S1-9 | Dashboard today | `GET /api/dashboard/today` → metricCount, sessionCount, emergencyCount, streak, values, alerts. |
| S1-10 | Telegram submit summary | Queue `telegram-submit-summary` → bot kirim summary ke `HL_telegramLinks.telegramChatId` yang verified. |

### 5.3 Sprint 1 Tables

`HL_users`, `HL_sessions`, `HL_userProfiles`, `HL_userConsents`, `HL_devices`, `HL_metricCatalog`, `HL_deviceMetrics`, `HL_metricRules`, `HL_measurementDrafts`, `HL_measurementSessions`, `HL_measurementValues`, `HL_measurementAttachments`, `HL_aiExtractions`, `HL_alerts`, `HL_telegramLinks`, `HL_systemConfigs`, `HL_auditLogs`, `HL_apiRateLimits`.

---

## 6. Sprint 2 — Health Intelligence

### 6.1 Goals

User mendapat insight dari data: AI recommendation, perbandingan 3/7 hari, dashboard mingguan/bulanan, laporan harian/mingguan/bulanan, knowledge base.

### 6.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S2-1 | AI Recommendation | `POST /api/ai/recommendation` menggunakan data hari ini + 3 hari + 7 hari → output i18n + `safetyStatus` |
| S2-2 | AI Assistant chat | `POST /api/ai/assistant` dengan disclaimer, forbidden phrases filter, entitlement check |
| S2-3 | Dashboard weekly | `GET /api/dashboard/weekly` → 7d aggregates, daily avg, alertCount |
| S2-4 | Dashboard monthly | `GET /api/dashboard/monthly` → 30d aggregates, daily sessionCount, latest 8 |
| S2-5 | Reports daily/weekly/monthly | `GET /api/reports/{daily,weekly,monthly}` → data + interpretation |
| S2-6 | Knowledge Base | `GET /api/kb/:slug` → artikel markdown dari `HL_knowledgeArticles` |
| S2-7 | Comparison | `GET /api/dashboard/comparison` → avg3Day/avg7Day/avg30Day |
| S2-8 | Popup interpretation | `InterpretationPopup.tsx` setelah validate, menampilkan `popupTitle`, `popupMessage`, `recommendation`, `sourceLabel` |

### 6.3 Sprint 2 Tables

`HL_aiRecommendations`, `HL_knowledgeArticles`, `HL_patternInsights`.

---

## 7. Sprint 3 — Family & Alerts

### 7.1 Goals

User dapat menghubungkan Telegram, mengatur kontak darurat, invite caregiver, mengatur reminder, menerima notifikasi in-app/Telegram/browser, dan mencatat obat.

### 7.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S3-1 | Telegram link & verify | User connect Telegram → verification code → `HL_telegramLinks.verified=1` |
| S3-2 | Emergency alert | `severity=emergency` saat submit → `HL_alerts(alertType='emergency')` → broadcast ke Telegram + caregiver |
| S3-3 | Emergency contacts | CRUD `HL_emergencyContacts`, encrypted, consent toggle via `PATCH /api/emergency/contacts/:id/consent` |
| S3-4 | Family invite & link | Owner invite via email → token → accept → `HL_familyLinks` + `HL_familyInvites` |
| S3-5 | Caregiver dashboard | Linked user dengan `canViewDashboard=1` dapat lihat data owner |
| S3-6 | Reminders | CRUD `HL_reminderSettings` (inApp/telegram/browser/email) |
| S3-7 | Browser push | VAPID push ke `HL_pushSubscriptions` |
| S3-8 | Medication tracking | CRUD `HL_medications`, `HL_medicationSchedules`, `HL_medicationLogs` |
| S3-9 | Family access check | `GET /api/family/access-check` untuk linked user |

### 7.3 Sprint 3 Tables

`HL_notifications`, `HL_pushSubscriptions`, `HL_notificationSettings`, `HL_reminderSettings`, `HL_familyLinks`, `HL_familyInvites`, `HL_emergencyContacts`, `HL_medications`, `HL_medicationSchedules`, `HL_medicationLogs`.

---

## 8. Sprint 4 — Advanced

### 8.1 Goals

User mendapat laporan dokter 30 hari, fasting timer, streak/badge, pattern detection, senior mode, PWA, CSV export, delete account.

### 8.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S4-1 | Doctor-ready report | `POST /api/reports/doctor-ready` → HTML di R2 → share token `POST /api/reports/:id/share` → publik `GET /api/reports/share/:shareToken` |
| S4-2 | Fasting timer | `POST /api/fasting/start`, `/stop`, `/current` untuk glukosa/kolesterol/asam urat/umum |
| S4-3 | Streaks & badges | Idempotent per hari: `threeDayConsistent`, `sevenDayConsistent`, `thirtyDayConsistent` |
| S4-4 | Pattern detection | `POST /api/patterns/generate/{sleep-bp,weight-bp,medication}` → `HL_patternInsights` |
| S4-5 | Senior mode | `accessibilityMode='senior'` → `SeniorAppShell`, font 19px, bottom-nav penuh |
| S4-6 | PWA | manifest + service worker + install prompt + bottom-nav + FAB |
| S4-7 | CSV export | `GET /api/reports/:id/data` → values untuk export CSV |
| S4-8 | Account deletion | `ProfileDeletePage` → hard/soft delete user + cascade |

### 8.3 Sprint 4 Tables

`HL_fastingSessions`, `HL_badges`, `HL_userBadges`, `HL_streaks`, `HL_reports`, `HL_reportShares`, `HL_patternInsights`.

---

## 9. Sprint 5 Foundation — RBAC, Plans, Billing

### 9.1 Goals

Menambahkan role-based access control, subscription plans, feature entitlements, usage counters, admin dashboards, dan billing infrastructure.

### 9.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S5F-1 | RBAC | Roles: `user`, `support`, `admin`, `superAdmin`, `billingAdmin`, `aiConfigAdmin`, `medicalReviewer`. Permission check via `services/rbac.ts`. |
| S5F-2 | Plans & features | `HL_plans` + `HL_planFeatures` dengan quota dan metadata. |
| S5F-3 | Entitlements | `services/entitlements.ts::requireEntitlement(userId, featureCode)` cek subscription + quota + window. |
| S5F-4 | Usage counters | `HL_usageCounters` (userId, featureCode, window, usedCount, quotaLimitSnapshot, resetAt). |
| S5F-5 | Feature flags | `HL_featureFlags` (flagCode, targetRoleCode, targetPlanCode, enabled). |
| S5F-6 | Admin dashboard | `GET /api/admin/dashboard/summary` (admin only). |
| S5F-7 | Plan listing | `GET /api/plans` (public). |
| S5F-8 | Subscribe | `POST /api/me/subscribe` → checkout session (mock atau Xendit). |
| S5F-9 | Config metadata | `HL_configMetadata` menyimpan storageMode, envVarName, isSecret, read/write policy. |

### 9.3 Sprint 5 Foundation Tables

`HL_roles`, `HL_permissions`, `HL_rolePermissions`, `HL_userRoles`, `HL_plans`, `HL_planFeatures`, `HL_subscriptions`, `HL_paymentEvents`, `HL_usageCounters`, `HL_featureFlags`, `HL_configMetadata`.

---

## 10. Sprint 5A — OAuth, Education, Symptom Log

### 10.1 Goals

Login/register dengan Google OAuth, edukasi in-app per topik, dan pencatatan gejala harian dengan red flag deterministik.

### 10.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S5A-1 | Google OAuth | `GET /api/auth/google`, `/callback`, link/unlink/list. State/nonce di-hash. |
| S5A-2 | Education cards | `GET /api/education/cards`, `POST /api/education/cards/:topicType/:topicCode/acknowledge`. Progress di `HL_userEducationProgress`. |
| S5A-3 | Symptom log | `POST /api/symptoms` → `HL_symptomLogs`. Red flag detection di `services/symptom.ts` → `HL_safetyEvents`. |
| S5A-4 | Symptom history | `GET /api/symptoms/history` dengan range. |
| S5A-5 | Prompt dismissal | `POST /api/symptoms/prompt-dismissals`. |
| S5A-6 | Daily health hub | `GET /api/dashboard/daily-health` menggabungkan measurement + symptom + hydration + cycle. |

### 10.3 Sprint 5A Tables

`HL_oauthAccounts`, `HL_oauthStates`, `HL_educationCards`, `HL_userEducationProgress`, `HL_symptomLogs`, `HL_safetyEvents`.

---

## 11. Sprint 5B — Hydration Tracker

### 11.1 Goals

User dapat mencatat dan memantau asupan air harian dengan target dinamis, reminder, dan quick-add via Telegram.

### 11.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S5B-1 | Hydration settings | `GET/PUT /api/hydration/settings` → operating hours, reminder, pregnancy/lactation, custom target. |
| S5B-2 | Today view | `GET /api/hydration/today` → targetMl, consumedMl, remaining, percentage, overLimit. |
| S5B-3 | Log water | `POST /api/hydration/logs` → `HL_waterIntakeLogs` (amountMl 1–3000). Over-limit → `HL_safetyEvents`. |
| S5B-4 | History | `GET /api/hydration/history` range. |
| S5B-5 | Delete log | `DELETE /api/hydration/logs/:logId`. |

### 11.3 Sprint 5B Tables

`HL_hydrationSettings`, `HL_hydrationTargets`, `HL_waterIntakeLogs`.

---

## 12. Sprint 5C — AI Clinical Infrastructure

### 12.1 Goals

Membangun infrastruktur context retrieval, vectorize metadata, audit query, dan memory jobs untuk **Sprint 6 AI Clinical Copilot**. Runtime copilot di-defer.

### 12.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S5C-1 | Context query | `POST /api/ai/context/query` → `HL_aiContextQueries` + optional vector search. |
| S5C-2 | Context package | `GET /api/ai/context-package` → assembled package (measurements, symptoms, hydration, cycle, alerts). |
| S5C-3 | Memory status | `GET /api/ai/memory/status` → count pending/indexed/failed. |
| S5C-4 | Memory rebuild | `POST /api/ai/memory/rebuild` → enqueue `HL_aiMemoryJobs`. |
| S5C-5 | Memory delete | `DELETE /api/ai/memory` → delete all user vector docs. |
| S5C-6 | Disclaimer enforce | `POST /api/ai/disclaimer/enforce` → append disclaimer, detect unsafe phrases. |
| S5C-7 | Admin readiness | `GET /api/admin/ai-clinical-copilot/readiness` → `clinicalCopilotEnabled=false` di Sprint 5. |
| S5C-8 | Recommendation context | Setiap `HL_aiRecommendations` punya 1:1 `HL_aiRecommendationContexts` (patternScore, scoreReason, modelName, usedFallback, disclaimer). |

### 12.3 Sprint 5C Tables

`HL_vectorDocuments`, `HL_aiContextQueries`, `HL_aiRecommendationContexts`, `HL_aiMemoryJobs`.

---

## 13. Sprint 5D — Cycle Tracking

### 13.1 Goals

User perempuan dapat mencatat siklus menstruasi, melihat prediksi fase, guardrail kontrasepsi, dan mengatur izin keluarga untuk data sensitif.

### 13.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S5D-1 | Access check | `GET /api/cycle/access` → allowed/reason berdasarkan sex/plan/onboarding. |
| S5D-2 | Settings | `GET/PUT /api/cycle/settings` → cycleLength, periodLength, lastPeriodStart, pregnancy/lactation/menopause flags. |
| S5D-3 | Calendar | `GET /api/cycle/calendar` → periode, fertile window, ovulation, predicted period. |
| S5D-4 | Cycle logs | `POST/GET /api/cycle/logs` → flow intensity, mood, symptoms, unprotected flag. |
| S5D-5 | Guardrails | `POST /api/cycle/guardrails/acknowledge` → `HL_cycleGuardrailAcknowledgements`. |
| S5D-6 | Family permissions | `GET/PUT /api/family-links/:id/permissions/{cycle,sensitive-health}`. |

### 13.3 Sprint 5D Tables

`HL_cycleSettings`, `HL_cycleLogs`, `HL_cycleGuardrailAcknowledgements`, `HL_familyPermissions`.

---

## 14. Sprint 5E — Telegram Hydration UX

### 14.1 Goals

User dapat menambah asupan air via inline button Telegram dan menerima reminder hydration melalui cron.

### 14.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S5E-1 | Telegram water webhook | `POST /api/webhook/telegram/water` menerima callback query → write `HL_waterIntakeLogs` + `HL_telegramCallbackEvents`. |
| S5E-2 | Callback idempotency | `callbackQueryId` UNIQUE → duplicate rejected. |
| S5E-3 | Cron hydration reminders | `POST /api/internal/cron/hydration-reminders` → kirim reminder via Telegram pada operating hours. |
| S5E-4 | Inline quick add | Button `+250ml`, `+500ml` di Telegram bot. |

### 14.3 Sprint 5E Tables

`HL_telegramCallbackEvents`.

---

## 15. Sprint 5F/X — Auth Hardening, Billing, i18n

### 15.1 Goals

Mengganti auth lokal dengan email OTP, menambahkan Xendit/mock billing, dan bilingual UI (ID/EN).

### 15.2 Features

| ID | Feature | Acceptance Criteria |
|---|---|---|
| S5X-1 | Email OTP register | `POST /api/auth/register/start` → OTP → `POST /api/auth/register/verify`. PBKDF2 hash OTP. Rate-limited. |
| S5X-2 | Email OTP login | `POST /api/auth/login/start` → `POST /api/auth/login/verify`. Lockout setelah 5x failed. |
| S5X-3 | OTP resend | `POST /api/auth/otp/resend` dengan rate limit. |
| S5X-4 | Dev test outbox | `GET /api/dev/test-email-outbox/latest` untuk E2E. |
| S5X-5 | Whatsapp field | `HL_userProfiles.whatsappNumber` via migration. |
| S5X-6 | Xendit checkout | `POST /api/me/subscribe` dengan `provider='xendit'` → invoice URL. |
| S5X-7 | Mock checkout | `provider='mock'` → immediate active subscription. |
| S5X-8 | Webhook handler | Xendit webhook → `HL_paymentEvents` → activate subscription. |
| S5X-9 | Bilingual UI | `web/src/i18n/locales/*` (ID/EN), `LanguageSwitcher.tsx`, `translateError.ts`. |

### 15.3 Sprint 5F/X Migrations

`worker/migrations/001_s5x_auth_email_otp.sql` → `HL_emailOtpChallenges`, `HL_users.emailVerifiedAt/emailVerificationMethod`.
`worker/migrations/002_s5x_whatsapp_profile.sql` → `HL_userProfiles.whatsappNumber`.

---

## 16. Non-Functional Requirements

### 16.1 Performance

- AI Vision timeout: default 5000 ms, configurable.
- API response p95 < 200 ms untuk query sederhana.
- Dashboard today: 48h window query + JS-side tz filter.
- History list: cursor pagination, limit max 100.
- Image upload: compressed webp ≤ 2 MB (configurable).

### 16.2 Security

- HTTP-only cookie `hlSession`.
- SHA-256 hash session token sebelum query D1.
- AES-GCM untuk data sensitif (`enc:v1:` prefix).
- Input validation via Zod-like manual checks di setiap route.
- Rate limiting OCR, OTP, login attempts.
- Admin mutations wajib `HL_auditLogs`.
- No plaintext secrets di D1/seed/log/response/bundle.

### 16.3 Privacy

- Gambar asli tidak disimpan.
- Delete account cascade (kecuali audit logs tetap ada).
- Consent flags: `aiConsent`, `dataShareConsent`, `emergencyConsent`.
- Family sensitive permission: owner dapat revoke.

### 16.4 Availability / Reliability

- Queue retry untuk Telegram summary.
- Cron idempotent (deduplikasi via scheduleTime + timezone).
- Graceful fallback AI Text: deterministic answer kalau semua model gagal.

### 16.5 i18n

- Default locale: `id`.
- Secondary locale: `en`.
- Locale files: 24 module di `web/src/i18n/locales/*`.
- Server error messages ID default; FE dapat translate via `translateError.ts`.

---

## 17. Out of Scope / Deferred

| Item | Rationale |
|---|---|
| AI Clinical Copilot runtime | Deferred ke Sprint 6; Sprint 5C hanya infrastruktur. |
| Two-way doctor chat | Belum ada requirement jelas. |
| Integration device Bluetooth/BLE | Tidak dijelaskan; manual/photo/input saja. |
| Multi-currency billing | IDR saja. |
| Native iOS/Android app | PWA only. |
| ML-based severity | Rule-based tetap. |

---

## 18. Acceptance Criteria Cross-Sprint

Untuk setiap fitur Sprint 5:

1. **Unit test** di `worker/test/*` (vitest-style `.mjs`) → pass.
2. **E2E smoke** di `web/e2e/smoke/*` (Playwright) → pass.
3. **Security/privacy test** → negative auth, no secret leak, encryption works.
4. **i18n test** → tidak ada missing keys di kedua bahasa.
5. **Audit log** → setiap admin/security mutation tercatat.
6. **Schema validation** → `PRAGMA foreign_key_check;` clean.

---

## 19. Metrics & Success Criteria

| Metric | Target |
|---|---|
| Measurement submission success rate | > 95% |
| AI extraction success rate | > 80% (timeout/fallback manual tersedia) |
| User onboarding completion | > 70% |
| Daily active users (DAU) | baseline measured post-launch |
| Avg API response time (p95) | < 500 ms |
| Uptime | > 99.5% |
| Critical/alert false positive | < 5% |

---

## 20. Glossary

| Term | Definition |
|---|---|
| **D1** | Cloudflare D1 SQLite database (`isehat_db`). |
| **R2** | Cloudflare R2 object storage (`multi-apps-ai-bucket`). |
| **Workers AI** | Cloudflare AI inference service (`@cf/meta/llama-3.2-11b-vision-instruct`). |
| **9router** | OpenAI-compatible text AI provider (Sprint 5). |
| **HL_*** | Prefix tabel database. |
| **rawAiValue** | Nilai dari AI Vision sebelum user edit. |
| **finalValue** | Nilai akhir yang disubmit user. |
| **manualOverride** | Flag `1` kalau finalValue ≠ rawAiValue. |
| **enc:v1:** | Prefix ciphertext AES-GCM. |
| **RBAC** | Role-Based Access Control. |
| **Entitlement** | Plan-based feature permission + quota. |

---

## 21. References

- Architecture: `docs/04-ARCHITECTURE.md`
- API Contract: `docs/05-api-contract.md`
- Design System: `docs/06-design-system.md`
- Schema: `docs/07-schema.sql`
- Seed: `docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql`
- Task Plan: `docs_sprint5/08.TASK_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL.md`
- Test Plan: `docs_sprint5/09.TEST_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_READY.md`
- TDD Plan: `docs_sprint5/11.TDD_PLAN_SPRINT5_FULL_READY_REVISED_AI_SPRINT6_MOCKUP_PONYTAIL_READY.md`
