# PRD Traceability Matrix — HL Health Companion

> Maps each major PRD feature to its source files, API endpoints, database tables, UI routes, test evidence, and implementation status.

**Source map:**

| Layer | Location |
|-------|----------|
| Worker (API) | `worker/src/index.ts`, `worker/src/routes-extra.ts` |
| Frontend | `web/src/App.tsx`, `web/src/pages/*`, `web/src/components/*` |
| DB Schema | `docs/schema.sql` |
| Tests | `worker/test/register.test.mjs` |
| API Routes | All under `/api/*` |

---

## Traceability Table

| # | Feature | User Stories | API Endpoints | DB Tables | UI Routes | Test Evidence | Status |
|---|---------|-------------|---------------|-----------|-----------|---------------|--------|
| 1 | **Auth & Profile** | US-1.1.x | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/profile/onboarding` · `PUT /api/profile` | `HL_users` · `HL_sessions` · `HL_userProfiles` · `HL_userConsents` · `HL_auditLogs` | `/register` · `/login` · `/onboarding` · `/settings/profile` | `register.test.mjs` | ✅ Done |
| 2 | **Measurement Input** | US-1.2.x | `GET /api/metrics/catalog` · `POST /api/measurements/submit` · `POST /api/measurements/attachments/upload` | `HL_metricCatalog` · `HL_devices` · `HL_deviceMetrics` · `HL_measurementSessions` · `HL_measurementValues` · `HL_measurementAttachments` | `/measurements/new` · `/measurements/history` | — | ✅ Done (EP-P2.x device-first flow) |
| 3 | **AI Vision Extraction** | US-1.3.x | `POST /api/measurements/extract` | `HL_aiExtractions` | `DynamicMetricForm.tsx` (AI button) | — | ✅ Done |
| 4 | **Metric Rules Engine** | US-2.1.x | `POST /api/measurements/validate` (inline in submit) | `HL_metricRules` | — | — | ✅ Done |
| 5 | **Dashboard** | US-1.6.2 · US-2.4.x | `GET /api/dashboard/today` · `GET /api/dashboard/weekly` · `GET /api/dashboard/monthly` | `HL_measurementValues` · `HL_measurementSessions` · `HL_streaks` · `HL_aiRecommendations` · `HL_alerts` | `/dashboard` · `/dashboard/week` · `/dashboard/month` | — | ✅ Done |
| 6 | **Reports** | US-2.5.x | `GET /api/reports/daily` · `GET /api/reports/weekly` · `GET /api/reports/monthly` · `POST /api/reports/doctor-ready` · `GET /api/reports/:id/download` · `POST /api/reports/:id/share` | `HL_reports` · `HL_reportShares` | `/reports/daily` · `/reports/weekly` · `/reports/monthly` | — | ✅ Done |
| 7 | **Telegram Integration** | US-3.1.x | `POST /api/telegram/connect` · `POST /api/telegram/verify` · `POST /api/telegram/test` | `HL_telegramLinks` · `HL_notifications` · `HL_notificationSettings` | `/telegram` | — | ✅ Done |
| 8 | **Family & Caregiver** | US-3.2.x | `POST /api/family/invite` · `POST /api/family/accept` · `PUT /api/family/members/:id/permissions` · `GET /api/family/dashboard` | `HL_familyInvites` · `HL_familyLinks` | `/family` · `/caregiver` | — | ✅ Done |
| 9 | **Emergency Alerts** | US-3.3.x | `POST /api/alerts/:id/acknowledge` · `GET /api/alerts` | `HL_alerts` · `HL_emergencyContacts` | `/alerts` · `/emergency` | — | ✅ Done |
| 10 | **Reminders & Notifications** | US-3.4.x | `POST /api/reminders` · `PUT /api/reminders/:id` · `DELETE /api/reminders/:id` · `POST /api/notifications/browser/subscribe` · `POST /api/internal/cron/reminders` | `HL_reminderSettings` · `HL_notifications` · `HL_pushSubscriptions` | `/reminders` | — | ✅ Done |
| 11 | **Medication Tracker** | US-3.5.x | `POST /api/medications` · `PUT /api/medications/:id` · `DELETE /api/medications/:id` · `POST /api/medications/:id/log` · `GET /api/medications/adherence` | `HL_medications` · `HL_medicationSchedule` · `HL_medicationLogs` | `/medications` | — | ✅ Done |
| 12 | **Doctor PDF** | US-4.1.x | `POST /api/reports/doctor-ready` · `GET /api/reports/:id/download` · `POST /api/reports/:id/share` · `GET /api/reports/share/:shareToken` | `HL_reports` · `HL_reportShares` · R2 storage | `/reports/doctor` | — | ✅ Done |
| 13 | **Fasting Timer** | US-4.2.x | `POST /api/fasting/start` · `POST /api/fasting/stop` · `GET /api/fasting/current` | `HL_fastingSessions` | `/fasting` | — | ✅ Done |
| 14 | **Gamification** | US-4.3.x | `GET /api/streaks` · `GET /api/badges` | `HL_streaks` · `HL_userBadges` · `HL_badges` | — | — | ✅ Done |
| 15 | **Pattern Detection** | US-4.4.x | `POST /api/patterns/generate` · `POST /api/patterns/generate/sleep-bp` · `POST /api/patterns/generate/weight-bp` · `POST /api/patterns/generate/medication` | `HL_patternInsights` | `/patterns` | — | ✅ Done |
| 16 | **Accessibility** | US-4.5.x | — | — | `data-accessibility` attribute · `SeniorMeasurementFlow.tsx` | — | ✅ Done |
| 17 | **PWA** | US-4.6.x | `POST /api/measurements/sync` | `HL_measurementDrafts` | `manifest.json` · `sw.js` | — | ✅ Done |
| 18 | **Data Export & Privacy** | US-4.7.x | `GET /api/export/csv` · `POST /api/privacy/deleteAccount` · `POST /api/account/delete` | — | — | — | ✅ Done |
| 19 | **Knowledge Base** | US-2.5.4 | `GET /api/kb` | `HL_knowledgeArticles` | `/kb` | — | ✅ Done (EP-P4.2 workflow redesign) |
| 20 | **Admin Config** | US-ADMIN.x | `GET /api/admin/configs` · `PUT /api/admin/configs/:key` · `POST /api/admin/configs` · `DELETE /api/admin/configs/:key` | `HL_systemConfigs` | `/admin/configs` · `/settings/profile` (admin panel) | — | ✅ Done |
| 21 | **AI Assistant** | GAP-10 | `POST /api/ai/assistant` | — | `/ai-assistant` | — | ✅ Done |
| 22 | **Integer ID Migration** | EP-P1.x | — | — | — | — | ✅ Backend + Frontend done · Production migration pending |
| 23 | **Enterprise UI** | EP-P2.x · EP-P3.x | — | — | — | — | ✅ Done |

---

## Feature Detail Breakdown

### 1 — Auth & Profile (US-1.1.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Register, Login, Onboarding, Edit Profile |
| **API** | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/profile/onboarding`, `PUT /api/profile` |
| **DB** | `HL_users`, `HL_sessions`, `HL_userProfiles`, `HL_userConsents`, `HL_auditLogs` |
| **UI** | `/register`, `/login`, `/onboarding`, `/settings/profile` |
| **Tests** | `worker/test/register.test.mjs` |
| **Status** | ✅ Done |

### 2 — Measurement Input (US-1.2.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Device selection, dynamic form, photo upload, compression, watermark |
| **API** | `GET /api/metrics/catalog`, `POST /api/measurements/submit`, `POST /api/measurements/attachments/upload` |
| **DB** | `HL_metricCatalog`, `HL_devices`, `HL_deviceMetrics`, `HL_measurementSessions`, `HL_measurementValues`, `HL_measurementAttachments` |
| **UI** | `/measurements/new`, `/measurements/history` |
| **Status** | ✅ Done (EP-P2.x device-first flow) |

### 3 — AI Vision Extraction (US-1.3.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Extract from photo, timeout handling, manual override |
| **API** | `POST /api/measurements/extract` |
| **DB** | `HL_aiExtractions` |
| **UI** | `DynamicMetricForm.tsx` with AI button |
| **Status** | ✅ Done |

### 4 — Metric Rules Engine (US-2.1.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Rule evaluation, fallback logic |
| **API** | `POST /api/measurements/validate` (inline in submit) |
| **DB** | `HL_metricRules` |
| **Status** | ✅ Done |

### 5 — Dashboard (US-1.6.2, US-2.4.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Today view, Weekly view, Monthly view |
| **API** | `GET /api/dashboard/today`, `GET /api/dashboard/weekly`, `GET /api/dashboard/monthly` |
| **DB** | `HL_measurementValues`, `HL_measurementSessions`, `HL_streaks`, `HL_aiRecommendations`, `HL_alerts` |
| **UI** | `/dashboard`, `/dashboard/week`, `/dashboard/month` |
| **Status** | ✅ Done |

### 6 — Reports (US-2.5.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Daily, Weekly, Monthly, Doctor PDF |
| **API** | `GET /api/reports/daily`, `GET /api/reports/weekly`, `GET /api/reports/monthly`, `POST /api/reports/doctor-ready`, `GET /api/reports/:id/download`, `POST /api/reports/:id/share` |
| **DB** | `HL_reports`, `HL_reportShares` |
| **UI** | `/reports/daily`, `/reports/weekly`, `/reports/monthly` |
| **Status** | ✅ Done |

### 7 — Telegram Integration (US-3.1.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Connect account, Test message, Submit summary |
| **API** | `POST /api/telegram/connect`, `POST /api/telegram/verify`, `POST /api/telegram/test` |
| **DB** | `HL_telegramLinks`, `HL_notifications`, `HL_notificationSettings` |
| **UI** | `/telegram` |
| **Status** | ✅ Done |

### 8 — Family & Caregiver (US-3.2.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Invite member, Accept invite, Manage permissions, Caregiver dashboard |
| **API** | `POST /api/family/invite`, `POST /api/family/accept`, `PUT /api/family/members/:id/permissions`, `GET /api/family/dashboard` |
| **DB** | `HL_familyInvites`, `HL_familyLinks` |
| **UI** | `/family`, `/caregiver` |
| **Status** | ✅ Done |

### 9 — Emergency Alerts (US-3.3.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Create alert, Send via Telegram, Acknowledge alert |
| **API** | `POST /api/alerts/:id/acknowledge`, `GET /api/alerts` |
| **DB** | `HL_alerts`, `HL_emergencyContacts` |
| **UI** | `/alerts`, `/emergency` |
| **Status** | ✅ Done |

### 10 — Reminders & Notifications (US-3.4.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Reminder settings, Cron scheduler, Browser push |
| **API** | `POST /api/reminders`, `PUT /api/reminders/:id`, `DELETE /api/reminders/:id`, `POST /api/notifications/browser/subscribe`, `POST /api/internal/cron/reminders` |
| **DB** | `HL_reminderSettings`, `HL_notifications`, `HL_pushSubscriptions` |
| **UI** | `/reminders` |
| **Status** | ✅ Done |

### 11 — Medication Tracker (US-3.5.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Add medication, Daily checklist, Adherence tracking |
| **API** | `POST /api/medications`, `PUT /api/medications/:id`, `DELETE /api/medications/:id`, `POST /api/medications/:id/log`, `GET /api/medications/adherence` |
| **DB** | `HL_medications`, `HL_medicationSchedule`, `HL_medicationLogs` |
| **UI** | `/medications` |
| **Status** | ✅ Done |

### 12 — Doctor PDF (US-4.1.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Generate PDF, Save to R2, Download, Share link |
| **API** | `POST /api/reports/doctor-ready`, `GET /api/reports/:id/download`, `POST /api/reports/:id/share`, `GET /api/reports/share/:shareToken` |
| **DB** | `HL_reports`, `HL_reportShares`, R2 object storage |
| **UI** | `/reports/doctor` |
| **Status** | ✅ Done |

### 13 — Fasting Timer (US-4.2.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Start timer, Stop timer, Fasting reminder |
| **API** | `POST /api/fasting/start`, `POST /api/fasting/stop`, `GET /api/fasting/current` |
| **DB** | `HL_fastingSessions` |
| **UI** | `/fasting` |
| **Status** | ✅ Done |

### 14 — Gamification (US-4.3.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Streak tracking, Badge awards, Safe gamification rules |
| **API** | `GET /api/streaks`, `GET /api/badges` |
| **DB** | `HL_streaks`, `HL_userBadges`, `HL_badges` |
| **Status** | ✅ Done |

### 15 — Pattern Detection (US-4.4.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Sleep vs BP, Weight vs BP, Medication vs Metric |
| **API** | `POST /api/patterns/generate`, `POST /api/patterns/generate/sleep-bp`, `POST /api/patterns/generate/weight-bp`, `POST /api/patterns/generate/medication` |
| **DB** | `HL_patternInsights` |
| **UI** | `/patterns` |
| **Status** | ✅ Done |

### 16 — Accessibility (US-4.5.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Senior mode, High contrast theme, Senior measurement flow |
| **UI** | `data-accessibility` attribute, `SeniorMeasurementFlow.tsx` |
| **Status** | ✅ Done |

### 17 — PWA (US-4.6.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Installable app, Offline shell, Background sync |
| **API** | `POST /api/measurements/sync` |
| **DB** | `HL_measurementDrafts` |
| **UI** | `manifest.json`, `sw.js` |
| **Status** | ✅ Done |

### 18 — Data Export & Privacy (US-4.7.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | CSV export, Delete account (GDPR) |
| **API** | `GET /api/export/csv`, `POST /api/privacy/deleteAccount`, `POST /api/account/delete` |
| **Status** | ✅ Done |

### 19 — Knowledge Base (US-2.5.4)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Device guides |
| **API** | `GET /api/kb` |
| **DB** | `HL_knowledgeArticles` |
| **UI** | `/kb` |
| **Status** | ✅ Done (EP-P4.2 workflow redesign) |

### 20 — Admin Config (US-ADMIN.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Config CRUD |
| **API** | `GET /api/admin/configs`, `PUT /api/admin/configs/:key`, `POST /api/admin/configs`, `DELETE /api/admin/configs/:key` |
| **DB** | `HL_systemConfigs` |
| **UI** | `/admin/configs`, `/settings/profile` (admin panel) |
| **Status** | ✅ Done |

### 21 — AI Assistant (GAP-10)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Conversational health chat |
| **API** | `POST /api/ai/assistant` |
| **UI** | `/ai-assistant` |
| **Status** | ✅ Done |

### 22 — Integer ID Migration (EP-P1.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Schema alignment, Backend refactor, Frontend type updates |
| **Docs** | `INTEGER_ID_MIGRATION_PLAN.md`, `migrations/INTEGER_IDS_V2.sql` |
| **Status** | ✅ Backend + Frontend done · Production migration pending |

### 23 — Enterprise UI (EP-P2.x, EP-P3.x)

| Aspect | Details |
|--------|---------|
| **Sub-features** | Device selection, reading cards, collapsible sidebar, user menu, enterprise inputs |
| **Status** | ✅ Done |

---

## Summary

| Metric | Count |
|--------|-------|
| Total features | 23 |
| Fully done | 22 |
| Partial (migration pending) | 1 |
| Total API endpoints | ~55 |
| Total DB tables | ~35 |
| Total UI routes | ~20 |

---

*Last updated: auto-generated from PRD, source tree, and task plans.*
