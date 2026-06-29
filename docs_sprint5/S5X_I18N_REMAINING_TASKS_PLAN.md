# S5X-I18N — Remaining Tasks Plan (I18N-005 → I18N-013)

```text
Product: iSehat / HL Health Companion
Document Type: Task Plan (detailed, codebase-aware)
Version: 1.0 — melanjutkan I18N-001/002/003/004 yang sudah selesai
Date: 2026-06-28
Scope: 9 remaining tasks from S5X_I18N_TASK_PLAN_CODEBASE_AWARE.md
Prerequisite: I18N-001/002/003/004 DONE
  - web/src/i18n/index.tsx (Context + Provider + useI18n + t())
  - web/src/i18n/locales/common.ts, errors.ts, auth.ts (90+ keys)
  - LanguageSwitcher in App.tsx sidebar footer + Login + Register pages
  - LoginPage.tsx, RegisterPage.tsx, EmailOtpVerificationStep.tsx use t()
  - Worker GET/PUT /api/me/preferences + locale.ts + error-codes.ts + DB preferredLocale
  - Deployed: https://63510e28.hl-health-companion.pages.dev
```

---

## I18N-005 — Localize API Error Messages in Frontend

### Priority: P0
### Files to modify

**NEW FILE**
- `web/src/api/translateError.ts` — utility function `translateErrorCode(code: string, locale: SupportedLocale): string`

**Files to update (add error message translation)**
- `web/src/pages/auth/LoginPage.tsx` — use translateErrorCode() instead of raw `body.error?.message`
- `web/src/pages/auth/RegisterPage.tsx` — same
- `web/src/pages/hydration/HydrationPage.tsx` — same
- `web/src/pages/symptoms/SymptomPage.tsx` — same
- `web/src/pages/cycle/CyclePage.tsx` — same
- `web/src/pages/settings/ProfileSettingsPage.tsx` — same
- `web/src/pages/emergency/EmergencyContactsPage.tsx` — same
- `web/src/pages/telegram/TelegramSettingsPage.tsx` — same
- `web/src/components/Toast.tsx` — Toast can show translated errors

### Code template (translateError.ts)

```typescript
import { getErrorMessage, type SupportedLocale } from '../i18n/locales/errors'

export function translateErrorCode(code: string, locale: SupportedLocale = 'id-ID'): string {
  return getErrorMessage(code, locale)
}
```

### Acceptance Criteria
- [ ] `translateError.ts` created with `translateErrorCode(code, locale)` function
- [ ] All pages with error handling use `translateErrorCode()` instead of raw API messages
- [ ] Unknown error codes fall back to API message
- [ ] No mixed language on error displays
- [ ] web tsc PASS

### Verification
```bash
cd web && npx tsc -b && npx eslint . && npx vite build
```

---

## I18N-006 — Localize Email Templates

### Priority: P0
### Files to modify

**Backend**
- `worker/src/i18n/email-templates.ts` (NEW) — export `getOtpEmailTemplate(locale: SupportedLocale, otp: string): { subject: string; html: string }`
- `worker/src/services/email-sender.ts` — `sendOtp(env, email, otp, locale)` accepts locale param, uses `getOtpEmailTemplate`
- `worker/src/routes-auth.ts` — call `sendOtp(c.env, normalizedEmail, otp, locale)` in all 3 places:
  - Line ~208: register start OTP
  - Line ~289: login start OTP
  - Line ~352: verify-resend OTP
- `worker/src/index.ts` — line ~1001: onboarding OTP — call `sendOtp(c.env, normalizedEmail, otp, locale)`

### Locale resolution priority
1. `user.preferredLocale` from `HL_userProfiles` (from /api/me/preferences)
2. `X-HL-Locale` header
3. `Accept-Language` header
4. Default: `id-ID`

### Acceptance Criteria
- [ ] `getOtpEmailTemplate()` returns id-ID template for `id-ID`, en-US for `en-US`
- [ ] All `sendOtp()` calls pass locale
- [ ] OTP email never contains secret/token beyond OTP code
- [ ] OTP code not logged
- [ ] Worker tests pass

### Verification
```bash
cd worker && npx tsc -p tsconfig.json && npm test
```

---

## I18N-007 — Localize Billing/Payment Pages

### Priority: P0
### Files to modify

**NEW FILE**
- `web/src/i18n/locales/billing.ts` — export translations for billing strings
- Import in `web/src/App.tsx`

**Files to update**
- `web/src/pages/premium/PremiumUpgradePage.tsx`
- `web/src/pages/billing/BillingSuccessPage.tsx`
- `web/src/pages/billing/BillingCancelPage.tsx`
- `web/src/pages/billing/BillingSettingsPage.tsx`
- `web/src/components/UpgradePrompt.tsx`

### Strings to translate (billing.ts keys)

```typescript
registerTranslations('billing', {
  upgradeTitle: { 'id-ID': 'Upgrade Plan Anda', 'en-US': 'Upgrade Your Plan' },
  upgradeSubtitle: { 'id-ID': 'Plan aktif:', 'en-US': 'Active plan:' },
  compareTitle: { 'id-ID': 'Perbandingan Fitur Free vs Premium', 'en-US': 'Free vs Premium Comparison' },
  featureLabel: { 'id-ID': 'Fitur', 'en-US': 'Feature' },
  freeLabel: { 'id-ID': 'Free', 'en-US': 'Free' },
  premiumLabel: { 'id-ID': 'Premium', 'en-US': 'Premium' },
  planActive: { 'id-ID': 'Plan Aktif', 'en-US': 'Active Plan' },
  planFree: { 'id-ID': 'Plan Gratis Aktif', 'en-US': 'Free Plan Active' },
  upgradeNow: { 'id-ID': 'Upgrade ke Premium', 'en-US': 'Upgrade to Premium' },
  processing: { 'id-ID': 'Memproses...', 'en-US': 'Processing...' },
  // Billing success/cancel
  successTitle: { 'id-ID': 'Pembayaran Berhasil', 'en-US': 'Payment Successful' },
  successMessage: { 'id-ID': 'Selamat! Plan Premium Anda sudah aktif.', 'en-US': 'Congratulations! Your Premium plan is now active.' },
  cancelTitle: { 'id-ID': 'Pembayaran Dibatalkan', 'en-US': 'Payment Cancelled' },
  cancelMessage: { 'id-ID': 'Pembayaran dibatalkan. Tidak ada perubahan.', 'en-US': 'Payment cancelled. No changes made.' },
  backToDashboard: { 'id-ID': 'Kembali ke Dashboard', 'en-US': 'Back to Dashboard' },
  // Settings
  billingSettingsTitle: { 'id-ID': 'Pengaturan Billing', 'en-US': 'Billing Settings' },
  currentPlan: { 'id-ID': 'Plan Saat Ini', 'en-US': 'Current Plan' },
  cancelSubscription: { 'id-ID': 'Batalkan Subscription', 'en-US': 'Cancel Subscription' },
})
```

### Acceptance Criteria
- [ ] billing.ts created with 15+ keys
- [ ] All 5 billing pages use t() for visible strings
- [ ] web tsc PASS

### Verification
```bash
cd web && npx tsc -b && npx vite build
```

---

## I18N-008 — Localize AI Pages + Disclaimer

### Priority: P0
### Files to modify

**NEW FILES**
- `web/src/i18n/locales/ai.ts` — AI-related translations
- `worker/src/i18n/disclaimer-templates.ts` — server-approved disclaimer in id-ID + en-US

**Files to update**
- `web/src/pages/ai/AiAssistantPage.tsx`
- `web/src/pages/ai/AiMemorySettingsPage.tsx`
- `web/src/routes-ai.ts` — append disclaimer from approved template to AI responses
- `worker/src/services/ai-memory.ts` — if any hardcoded Indonesian

### Strings to translate (ai.ts)

```typescript
registerTranslations('ai', {
  assistantTitle: { 'id-ID': 'AI Assistant', 'en-US': 'AI Assistant' },
  assistantSubtitle: { 'id-ID': 'Tanyakan pertanyaan kesehatan. AI tidak menggantikan dokter.', 'en-US': 'Ask health questions. AI does not replace doctors.' },
  inputPlaceholder: { 'id-ID': 'Ketik pertanyaan Anda...', 'en-US': 'Type your question...' },
  sendButton: { 'id-ID': 'Kirim', 'en-US': 'Send' },
  sending: { 'id-ID': 'Mengirim...', 'en-US': 'Sending...' },
  aiMemoryTitle: { 'id-ID': 'AI Memory', 'en-US': 'AI Memory' },
  aiMemorySubtitle: { 'id-ID': 'Infrastruktur memori untuk fitur AI Sprint 6.', 'en-US': 'Memory infrastructure for Sprint 6 AI features.' },
  rebuildButton: { 'id-ID': 'Rebuild Memory', 'en-US': 'Rebuild Memory' },
  deleting: { 'id-ID': 'Menghapus...', 'en-US': 'Deleting...' },
  deleteButton: { 'id-ID': 'Hapus Memory', 'en-US': 'Delete Memory' },
  sprint6Ready: { 'id-ID': 'Sprint 6 Readiness', 'en-US': 'Sprint 6 Readiness' },
  clinicalCopilotDeferred: { 'id-ID': 'AI Clinical Copilot ditangguhkan ke Sprint 6.', 'en-US': 'AI Clinical Copilot deferred to Sprint 6.' },
})
```

### Disclaimer templates (worker/src/i18n/disclaimer-templates.ts)

```typescript
export const AI_DISCLAIMER = {
  'id-ID': '⚠️ Disclaimer: AI bukan pengganti dokter. Selalu konsultasi profesional kesehatan untuk keputusan medis.',
  'en-US': '⚠️ Disclaimer: AI is not a substitute for doctors. Always consult a healthcare professional for medical decisions.',
}
```

### Acceptance Criteria
- [ ] ai.ts created with 10+ keys
- [ ] Disclaimer templates approved in id-ID + en-US (NOT AI-translated)
- [ ] AI responses append localized disclaimer
- [ ] clinicalCopilotMode=true still returns AI_CLINICAL_COPILOT_DEFERRED in both languages
- [ ] Worker tests pass + web tsc PASS

### Verification
```bash
cd worker && npm test
cd web && npx tsc -b && npx vite build
```

---

## I18N-009 — Localize Dashboard + Health Feature Pages

### Priority: P1
### Files to modify

**NEW FILES**
- `web/src/i18n/locales/dashboard.ts`
- `web/src/i18n/locales/hydration.ts`
- `web/src/i18n/locales/symptom.ts`
- `web/src/i18n/locales/cycle.ts`

**Files to update**
- `web/src/pages/dashboard/DailyHealthHubPage.tsx`
- `web/src/pages/hydration/HydrationPage.tsx`
- `web/src/pages/hydration/HydrationHistoryPage.tsx`
- `web/src/pages/hydration/HydrationSettingsPage.tsx`
- `web/src/pages/symptoms/SymptomPage.tsx`
- `web/src/pages/cycle/CyclePage.tsx`

### Key strings to translate

**dashboard.ts**: `dashboardTitle`, `todayStatus`, `normal`, `warning`, `critical`, `vitalSigns`, `activeSymptoms`, `hydrationCard`, `quickActions`, `addMeasurement`, `myReports`, `findHelp`

**hydration.ts**: `hydrationTitle`, `todayTarget`, `quickAdd`, `largeInputConfirm`, `overhydrationWarning`, `historyTitle`, `dateFilter`, `sourceFilter`, `amountFilter`

**symptom.ts**: `symptomsTitle`, `selectSymptom`, `vasScale`, `saveButton`, `redFlagWarning`, `emergencyCall`

**cycle.ts**: `cycleTitle`, `calendar`, `guardrailWarning`, `contraceptionWarning`, `predictionPaused`, `dailyLog`

### Acceptance Criteria
- [ ] 4 new translation files created with 8+ keys each
- [ ] All 6 pages use t() for visible strings
- [ ] Medical/safety strings preserved exactly (no AI translation)
- [ ] Hydration overhydration warning localized + medically safe
- [ ] Red flag emergency UI localized + remains blocking
- [ ] Cycle guardrail localized + remains blocking
- [ ] web tsc PASS

### Verification
```bash
cd web && npx tsc -b && npx vite build
```

---

## I18N-010 — Localize Admin Panel

### Priority: P1
### Files to modify

**NEW FILE**
- `web/src/i18n/locales/admin.ts`

**Files to update**
- `web/src/pages/admin/AdminPage.tsx`

### Strings to translate (admin.ts keys)

```typescript
registerTranslations('admin', {
  adminTitle: { 'id-ID': 'Admin Panel', 'en-US': 'Admin Panel' },
  tabOverview: { 'id-ID': 'Overview', 'en-US': 'Overview' },
  tabUsers: { 'id-ID': 'Users', 'en-US': 'Users' },
  tabRoles: { 'id-ID': 'Roles', 'en-US': 'Roles' },
  tabPlans: { 'id-ID': 'Plans', 'en-US': 'Plans' },
  tabPlanFeatures: { 'id-ID': 'Plan Features', 'en-US': 'Plan Features' },
  tabAiConfig: { 'id-ID': 'AI Config', 'en-US': 'AI Config' },
  tabAiMemory: { 'id-ID': 'AI Memory', 'en-US': 'AI Memory' },
  tabConfigs: { 'id-ID': 'Configs', 'en-US': 'Configs' },
  tabFeatureFlags: { 'id-ID': 'Features', 'en-US': 'Features' },
  tabAudit: { 'id-ID': 'Audit', 'en-US': 'Audit' },
  tabSafety: { 'id-ID': 'Safety', 'en-US': 'Safety' },
  tabMetrics: { 'id-ID': 'Metrics', 'en-US': 'Metrics' },
  tabRules: { 'id-ID': 'Rules', 'en-US': 'Rules' },
  tabKb: { 'id-ID': 'KB', 'en-US': 'KB' },
  totalUsers: { 'id-ID': 'Total Users', 'en-US': 'Total Users' },
  totalPlans: { 'id-ID': 'Total Plans', 'en-US': 'Total Plans' },
  totalSubscriptions: { 'id-ID': 'Total Subscriptions', 'en-US': 'Total Subscriptions' },
  totalSafetyEvents: { 'id-ID': 'Total Safety Events', 'en-US': 'Total Safety Events' },
  totalAuditLogs: { 'id-ID': 'Total Audit Logs', 'en-US': 'Total Audit Logs' },
})
```

### Acceptance Criteria
- [ ] admin.ts created with 20+ keys
- [ ] AdminPage tab labels, status chips, and table headers use t()
- [ ] Secret masked fields remain masked in both languages
- [ ] web tsc PASS

### Verification
```bash
cd web && npx tsc -b && npx vite build
```

---

## I18N-011 — Localize Settings + KB + FAQ + Manual

### Priority: P1
### Files to modify

**NEW FILES**
- `web/src/i18n/locales/settings.ts`
- `web/src/i18n/locales/kb.ts`

**Files to update**
- `web/src/pages/settings/ProfileSettingsPage.tsx`
- `web/src/pages/kb/KnowledgeBasePage.tsx`
- `web/src/pages/kb/FaqPage.tsx`
- `web/src/pages/kb/UserManualPage.tsx`
- `web/src/pages/alerts/AlertsPage.tsx`
- `web/src/pages/reminders/RemindersPage.tsx`
- `web/src/pages/emergency/EmergencyContactsPage.tsx`
- `web/src/pages/telegram/TelegramSettingsPage.tsx`
- `web/src/pages/family/FamilyPage.tsx`

### Key strings to translate

**settings.ts**: `profileTitle`, `height`, `theme`, `displayMode`, `notifications`, `consent`, `dataExport`, `deleteAccount`, `changePassword`, `currentPassword`, `newPassword`, `confirmPassword`, `saveButton`

**kb.ts**: `kbTitle`, `workflowTitle`, `appGuide`, `toolsTitle`, `educationTitle`, `workflowSteps`

### Acceptance Criteria
- [ ] 2 new translation files created with 10+ keys each
- [ ] All 9 pages use t() for visible strings
- [ ] KB articles available in both languages
- [ ] FAQ Q&A in both languages
- [ ] User manual in both languages
- [ ] web tsc PASS

### Verification
```bash
cd web && npx tsc -b && npx vite build
```

---

## I18N-012 — Localize Navigation + Shell + Remaining Pages

### Priority: P1
### Files to modify

**NEW FILE**
- `web/src/i18n/locales/nav.ts`

**Files to update**
- `web/src/App.tsx` — NAV_GROUPS labels, sidebar footer, welcome wizard, topbar search placeholder, notifications empty state
- `web/src/components/WelcomeWizard.tsx` — all step titles + descriptions
- `web/src/components/Toast.tsx` — if any hardcoded messages
- `web/src/pages/reports/DailyReportPage.tsx` — AI button, labels
- `web/src/pages/reports/WeeklyReportPage.tsx`
- `web/src/pages/reports/MonthlyReportPage.tsx`
- `web/src/pages/reports/DoctorReportPage.tsx`
- `web/src/pages/measurement/HistoryPage.tsx`
- `web/src/pages/measurement/SeniorMeasurementFlow.tsx`
- `web/src/pages/fasting/FastingPage.tsx`
- `web/src/pages/medications/MedicationsPage.tsx`
- `web/src/pages/patterns/PatternsPage.tsx`
- `web/src/pages/caregiver/CaregiverDashboardPage.tsx`
- `web/src/pages/onboarding/OnboardingPage.tsx`

### Key strings to translate (nav.ts)

```typescript
registerTranslations('nav', {
  dashboard: { 'id-ID': 'Dashboard', 'en-US': 'Dashboard' },
  measurements: { 'id-ID': 'Pengukuran', 'en-US': 'Measurements' },
  reports: { 'id-ID': 'Laporan', 'en-US': 'Reports' },
  healthTracking: { 'id-ID': 'Pelacakan Kesehatan', 'en-US': 'Health Tracking' },
  lifestyle: { 'id-ID': 'Gaya Hidup', 'en-US': 'Lifestyle' },
  aiInsights: { 'id-ID': 'AI & Wawasan', 'en-US': 'AI & Insights' },
  familySafety: { 'id-ID': 'Keluarga & Keamanan', 'en-US': 'Family & Safety' },
  education: { 'id-ID': 'Edukasi', 'en-US': 'Education' },
  settings: { 'id-ID': 'Pengaturan', 'en-US': 'Settings' },
  adminPanel: { 'id-ID': 'Admin Panel', 'en-US': 'Admin Panel' },
  search: { 'id-ID': 'Cari...', 'en-US': 'Search...' },
  notifEmpty: { 'id-ID': 'Tidak ada notifikasi baru.', 'en-US': 'No new notifications.' },
  // Welcome wizard steps
  wizardStep1Title: { 'id-ID': 'Dashboard', 'en-US': 'Dashboard' },
  // ... etc for all 8 wizard steps
})
```

### Acceptance Criteria
- [ ] nav.ts created with 20+ keys
- [ ] NAV_GROUPS labels use t()
- [ ] Sidebar footer (Tour Aplikasi, Help Center, Logout) uses t()
- [ ] Welcome wizard all steps use t()
- [ ] Topbar search/notifications use t()
- [ ] Remaining 13 pages use t() for visible strings
- [ ] web tsc PASS

### Verification
```bash
cd web && npx tsc -b && npx vite build
```

---

## I18N-013 — Bilingual E2E Release Gate

### Priority: P0
### Files to create

**NEW FILES**
- `web/e2e/smoke/i18n-auth.spec.ts`
- `web/e2e/smoke/i18n-billing.spec.ts`
- `web/e2e/smoke/i18n-health.spec.ts`
- `web/e2e/smoke/i18n-admin.spec.ts`
- `web/test/missing-keys.test.mjs` — unit test scanning for untranslated keys in production build

### Acceptance Criteria
- [ ] E2E smoke tests pass in Chromium for both locales
- [ ] No missing translation key visible in production build
- [ ] No mixed language on tested screens
- [ ] No console errors
- [ ] No /api/* 404/500

### Verification
```bash
cd web && npx playwright test e2e/smoke/i18n --project=chromium
```

---

## Execution Order

```text
I18N-005 → I18N-006 → I18N-007 → I18N-008 → I18N-009 → I18N-010 → I18N-011 → I18N-012 → I18N-013
```

## Batch Strategy (Recommended)

Given the massive scope (9 remaining tasks touching ~40 files), batch into 3 deploy rounds:

**Batch 6**: I18N-005 + I18N-006 + I18N-007 (API errors + email + billing)
**Batch 7**: I18N-008 + I18N-009 + I18N-010 (AI + health features + admin)
**Batch 8**: I18N-011 + I18N-012 + I18N-013 (settings/KB + nav/shell + E2E gate)

## Definition of Done (for all remaining tasks)

```text
[ ] All 9 remaining i18N tasks completed
[ ] Worker tests pass (336+)
[ ] Web tsc + eslint + build pass (0 errors)
[ ] Pages deployed to live URL
[ ] No missing translation keys
[ ] No mixed language on any screen
[ ] No security/medical safety regression
[ ] Bilingual E2E gate passes
```
