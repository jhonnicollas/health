# S5X-I18N — Bilingual iSehat Task Plan

```text
Product: iSehat / HL Health Companion
Document Type: Task Plan
Task Group: S5X-I18N — Indonesian + English Localization
Version: 1.0 EXECUTION READY
Date: 2026-06-28
Scope: Web frontend, Worker API error localization, email templates, safety/medical copy, billing/payment pages, AI disclaimer, education/content translation foundation
Default Locale: id-ID
Secondary Locale: en-US
Execution Mode: One task → one implementation slice → one test run → WORK_LOG update → HANDOFF update → stop
```

---

## 1. Objective

Membuat aplikasi iSehat mendukung dua bahasa:

```text
id-ID = Bahasa Indonesia
en-US = English
```

Target akhir:

```text
1. User bisa memilih bahasa di login/register/settings.
2. Pilihan bahasa tersimpan sebagai user preference.
3. UI utama tampil konsisten dalam bahasa yang dipilih.
4. API tetap mengirim error code, bukan hardcoded message.
5. Frontend menerjemahkan error code ke bahasa user.
6. Email OTP dan email billing memakai bahasa user.
7. Medical/safety text memakai approved translation, bukan AI translate bebas.
8. AI output mengikuti locale user tetapi disclaimer tetap dari server-approved template.
9. Education/content siap mendukung translation database.
10. Playwright E2E membuktikan flow Indonesia dan English berjalan.
```

---

## 2. Non-Negotiable Rules

```text
- Default locale aplikasi adalah id-ID.
- Fallback locale adalah en-US.
- Jangan hardcode string UI baru langsung di component.
- Jangan menerjemahkan medical/safety copy dengan AI secara bebas.
- Safety/disclaimer copy harus berasal dari approved translation file atau approved DB content.
- Backend API harus mengembalikan error code stabil, bukan message hardcoded sebagai source utama.
- Secret/token/API key tidak boleh masuk translation file, email template snapshot, log, atau frontend bundle.
- AI Doctor-like Clinical Copilot tetap Sprint 6 scope; bilingual support tidak boleh mengaktifkan AI dokter di Sprint 5.
- `clinicalCopilotMode=true` tetap harus ditolak dengan `AI_CLINICAL_COPILOT_DEFERRED` dalam semua bahasa.
```

---

## 3. Locale Policy

Supported locales:

```ts
export const SUPPORTED_LOCALES = ['id-ID', 'en-US'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: SupportedLocale = 'id-ID';
export const FALLBACK_LOCALE: SupportedLocale = 'en-US';
```

Locale priority:

```text
1. Authenticated user preference: preferredLocale
2. Explicit frontend setting/cookie: hl_locale
3. Accept-Language header
4. Default: id-ID
```

Frontend should send:

```text
Accept-Language: id-ID | en-US
X-HL-Locale: id-ID | en-US
```

---

## 4. Proposed File Structure

```text
web/src/i18n/
  index.ts
  locales/
    id-ID/
      common.json
      auth.json
      dashboard.json
      billing.json
      otp.json
      admin.json
      hydration.json
      symptom.json
      cycle.json
      ai.json
      safety.json
      errors.json
    en-US/
      common.json
      auth.json
      dashboard.json
      billing.json
      otp.json
      admin.json
      hydration.json
      symptom.json
      cycle.json
      ai.json
      safety.json
      errors.json

web/src/components/i18n/
  LanguageSwitcher.tsx
  LocaleProvider.tsx

worker/src/i18n/
  locale.ts
  error-codes.ts
  templates/
    otp.ts
    billing.ts
    safety.ts
```

---

## 5. Database Changes

### 5.1 User Preference

If user preference table already exists, extend it additively. If no preference table exists, add a minimal table.

Preferred additive field/table requirement:

```sql
-- Additive only; agent must inspect existing schema before applying.
-- If HL_userPreferences exists, add preferredLocale if missing.
-- If no preference table exists, create HL_userPreferences.

CREATE TABLE IF NOT EXISTS HL_userPreferences (
  userId INTEGER PRIMARY KEY,
  preferredLocale TEXT NOT NULL DEFAULT 'id-ID' CHECK (preferredLocale IN ('id-ID', 'en-US')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 Content Translation Foundation

For education/knowledge/admin-managed content, create a reusable translation table:

```sql
CREATE TABLE IF NOT EXISTS HL_contentTranslations (
  id TEXT PRIMARY KEY,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('id-ID', 'en-US')),
  title TEXT NULL,
  summary TEXT NULL,
  body TEXT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  reviewedBy INTEGER NULL,
  reviewedAt TEXT NULL,
  metadataJson TEXT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entityType, entityId, locale)
);

CREATE INDEX IF NOT EXISTS idx_HL_contentTranslations_entity
ON HL_contentTranslations(entityType, entityId, locale, status);
```

Entity examples:

```text
educationCard
knowledgeArticle
emailTemplate
safetyCopy
planDescription
aiDisclaimer
```

---

## 6. Task List

## I18N-001 — Install and Configure Frontend i18n

**Priority:** P0  
**Area:** `web/src/i18n`, `web/src/main.tsx`, `web/src/App.tsx`

### Deliverables

```text
- Add react-i18next/i18next or use existing i18n library if already installed.
- Create i18n initialization with id-ID and en-US.
- Add namespace loading.
- Add fallback locale.
- Add safe missing-key behavior in development.
```

### Acceptance Criteria

```text
[ ] App boots with default id-ID.
[ ] App can switch to en-US.
[ ] Missing key is visible in development but does not crash production.
[ ] No large translation file is loaded unnecessarily if lazy loading is already supported.
```

### Validation

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
```

---

## I18N-002 — Add Locale Detection and Language Switcher

**Priority:** P0  
**Area:** `web/src/components/i18n`, login/register/settings/admin topbar

### Deliverables

```text
- LanguageSwitcher component.
- Store pre-login locale in localStorage/cookie as hl_locale.
- Send X-HL-Locale / Accept-Language on API requests.
- Add language switcher to Login/Register and Settings.
```

### Acceptance Criteria

```text
[ ] User can choose Bahasa Indonesia.
[ ] User can choose English.
[ ] Locale persists after page refresh.
[ ] Login/register pages can switch language before auth.
[ ] Authenticated user setting saves preferredLocale server-side once endpoint exists.
```

### Validation

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
```

---

## I18N-003 — Backend Locale Utility and User Preference API

**Priority:** P0  
**Area:** `worker/src/i18n`, `worker/src/routes/me-preferences.ts`

### Endpoints

```text
GET /api/me/preferences
PUT /api/me/preferences
```

### Deliverables

```text
- Locale parser from X-HL-Locale and Accept-Language.
- Normalize locale to id-ID/en-US.
- Fallback to id-ID.
- User preference read/write endpoint.
- Audit log for preference update is optional, not required unless project policy says all profile mutations are audited.
```

### Acceptance Criteria

```text
[ ] Invalid locale falls back safely.
[ ] PUT rejects unsupported locale.
[ ] GET returns preferredLocale.
[ ] Anonymous API still supports Accept-Language for OTP/register/login.
```

### Validation

```bash
cd worker
npx tsc -p tsconfig.json
npm test
```

---

## I18N-004 — Convert Auth, Register, Login, OTP Screens

**Priority:** P0  
**Area:** `web/src/pages/auth`, `web/src/i18n/locales/*/auth.json`, `otp.json`, `errors.json`

### Deliverables

```text
- Convert login page static text.
- Convert register page static text.
- Convert Google OAuth button text.
- Convert OTP verification screen.
- Convert OTP error states.
- Keep email/password login existing behavior.
```

### Acceptance Criteria

```text
[ ] Login UI fully id-ID.
[ ] Login UI fully en-US.
[ ] Register UI fully id-ID.
[ ] Register UI fully en-US.
[ ] OTP screen fully id-ID/en-US.
[ ] No OAuth secret in frontend bundle.
```

### Validation

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
npx playwright test e2e/smoke/i18n-auth-otp.spec.ts --project=chromium
```

---

## I18N-005 — Localize API Error Codes in Frontend

**Priority:** P0  
**Area:** `web/src/api`, `web/src/i18n/locales/*/errors.json`

### Deliverables

```text
- API client maps error.code to translation key.
- Keep raw server error code visible in dev/debug only.
- Add translations for Sprint 5 error codes.
```

Minimum error codes:

```text
OTP_REQUIRED
OTP_INVALID
OTP_EXPIRED
OTP_TOO_MANY_ATTEMPTS
OTP_RESEND_COOLDOWN
EMAIL_NOT_VERIFIED
ENTITLEMENT_REQUIRED
QUOTA_EXCEEDED
AI_CLINICAL_COPILOT_DEFERRED
INVALID_WEBHOOK_TOKEN
PAYMENT_PENDING
PAYMENT_FAILED
PAYMENT_EXPIRED
```

### Acceptance Criteria

```text
[ ] API response can omit human message and UI still displays localized message.
[ ] Unsupported error code falls back to generic localized error.
[ ] No mixed Indonesian/English on one screen.
```

### Validation

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
```

---

## I18N-006 — Localize Billing and Payment Flow

**Priority:** P0  
**Area:** `/premium/upgrade`, `/pricing` alias, `/billing/success`, `/billing/cancel`, `/settings/billing`

### Deliverables

```text
- Localize PremiumUpgradePage.
- Localize UpgradePrompt.
- Localize checkout loading/error states.
- Localize billing success/cancel/pending pages.
- Localize current plan and quota display.
```

### Acceptance Criteria

```text
[ ] Free user upgrade prompt works in id-ID.
[ ] Free user upgrade prompt works in en-US.
[ ] Payment success page does not trust redirect; still polls backend.
[ ] Payment status text localized.
[ ] Keep one maintained page: /premium/upgrade.
[ ] Add /pricing as alias/redirect to /premium/upgrade.
```

### Validation

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
npx playwright test e2e/smoke/i18n-billing.spec.ts --project=chromium
```

---

## I18N-007 — Localize Dashboard, Hydration, Symptom, Cycle

**Priority:** P1  
**Area:** Dashboard and feature pages

### Deliverables

```text
- Daily Health Hub localized.
- Hydration page/settings/history localized.
- Symptom form, VAS labels, emergency blocking UI localized.
- Cycle page/settings/calendar/guardrail localized.
```

### Acceptance Criteria

```text
[ ] Hydration warning is localized and remains medically safe.
[ ] Red flag/emergency blocking UI is localized and remains blocking.
[ ] Cycle contraception guardrail is localized and remains blocking, not toast-only.
[ ] Mobile 360px remains usable for both languages.
```

### Validation

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
npx playwright test e2e/smoke/i18n-health-features.spec.ts --project=chromium
```

---

## I18N-008 — Localize AI Disclaimer and AI Infrastructure UI

**Priority:** P0  
**Area:** AI Assistant, AI Memory, Admin AI Config, context trace

### Deliverables

```text
- Localize AI Clinical Infrastructure UI.
- Localize context trace labels.
- Localize dataSufficiencyScore explanation.
- Localize Sprint 6 readiness disabled state.
- Server-approved disclaimer templates for id-ID and en-US.
```

### Acceptance Criteria

```text
[ ] AI output contains disclaimer in selected locale.
[ ] Disclaimer text is inserted server-side or from approved server template.
[ ] AI does not freely translate safety disclaimer.
[ ] clinicalCopilotMode=true still returns AI_CLINICAL_COPILOT_DEFERRED.
[ ] English mode still does not claim AI doctor is active.
```

### Validation

```bash
cd worker
npx tsc -p tsconfig.json
npm test

cd ../web
npx tsc -b
npx eslint .
npx vite build
```

---

## I18N-009 — Localize Email Templates

**Priority:** P0  
**Area:** Resend OTP, payment email, security notification

### Deliverables

```text
- OTP email template id-ID.
- OTP email template en-US.
- Payment success email template id-ID/en-US if billing email exists.
- Security email template id-ID/en-US if present.
- Locale resolved from request/user preference.
```

### Acceptance Criteria

```text
[ ] Register with id-ID sends Indonesian OTP subject/body.
[ ] Register with en-US sends English OTP subject/body.
[ ] OTP email never includes secret/token beyond OTP code.
[ ] OTP code is not logged.
[ ] Resend API key remains Cloudflare secret only.
```

### Validation

```bash
cd worker
npx tsc -p tsconfig.json
npm test
```

---

## I18N-010 — Add Database-Backed Content Translation Foundation

**Priority:** P1  
**Area:** `HL_contentTranslations`, education/admin content service

### Deliverables

```text
- Migration for HL_contentTranslations.
- ContentTranslationService.
- Education service can return localized content when translation exists.
- Fallback to id-ID or existing content when translation missing.
- Admin translation approval is optional for MVP, but schema supports it.
```

### Acceptance Criteria

```text
[ ] GET /api/education/cards returns locale-specific title/body when available.
[ ] Missing translation falls back safely.
[ ] Only approved content is used for medical/safety copy if status enforcement is enabled.
[ ] No regression to existing education cards.
```

### Validation

```bash
cd worker
npx tsc -p tsconfig.json
npm test
```

---

## I18N-011 — Admin UI Localization

**Priority:** P1  
**Area:** Admin shell/pages

### Deliverables

```text
- Admin navigation localized.
- Users/Roles/Plans/Config/Audit/AI Config localized.
- Secret masked/configured labels localized.
- Audit filter labels localized.
```

### Acceptance Criteria

```text
[ ] Admin UI can switch id-ID/en-US.
[ ] Secret fields remain masked in both languages.
[ ] Admin tables remain readable on desktop/tablet.
```

### Validation

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
npx playwright test e2e/smoke/i18n-admin.spec.ts --project=chromium
```

---

## I18N-012 — Bilingual E2E Release Gate

**Priority:** P0  
**Area:** Playwright QA

### Deliverables

```text
- E2E smoke for auth/OTP in id-ID and en-US.
- E2E smoke for premium upgrade/payment in id-ID and en-US.
- E2E smoke for dashboard/hydration/symptom safety copy.
- Console/network failure gate reused.
- Mobile 360px check for major localized pages.
```

### Acceptance Criteria

```text
[ ] Chromium smoke passes for id-ID.
[ ] Chromium smoke passes for en-US.
[ ] No console error.
[ ] No /api/* 404/500.
[ ] No missing translation key visible in production build.
[ ] No mixed language on tested screens.
```

### Validation

```bash
cd web
npx playwright test e2e/smoke/i18n --project=chromium
```

---

## 7. Recommended Execution Order

```text
I18N-001 → I18N-002 → I18N-003 → I18N-004 → I18N-005 → I18N-009 → I18N-006 → I18N-008 → I18N-007 → I18N-010 → I18N-011 → I18N-012
```

Rationale:

```text
1. Setup library and locale switching first.
2. Auth/OTP first because it is user entry point and security-critical.
3. API error mapping next because it affects all screens.
4. Email OTP localization before release.
5. Billing next because paid flow is now implemented.
6. AI/safety next because medical copy must be controlled.
7. Feature pages/admin can follow after core flows are stable.
```

---

## 8. Agent Prompt

```text
You are S5X-I18N execution agent for iSehat / HL Health Companion.

Goal:
Implement bilingual id-ID/en-US support safely, without breaking Sprint 5 security, billing, OTP, AI safety, or medical guardrails.

Read:
- AGENTS.md
- HANDOFF.md
- WORK_LOG_TAIL.md
- this task plan
- relevant current code only

Rules:
- Do not hardcode new UI text directly in components.
- Use i18n keys.
- Backend returns error codes; frontend translates.
- Medical/safety/disclaimer copy must use approved templates.
- No AI doctor activation in Sprint 5.
- No secret/token in translation files, logs, snapshots, emails, or frontend bundle.
- One task at a time.
- Run validation before marking DONE.
- Update WORK_LOG.md and HANDOFF.md.

Start with I18N-001 only.
```

---

## 9. Definition of Done

```text
[ ] id-ID and en-US are supported locales.
[ ] Default locale is id-ID.
[ ] User can switch language before login and after login.
[ ] preferredLocale persists for logged-in user.
[ ] Auth/register/login/OTP localized.
[ ] Billing/payment/upgrade localized.
[ ] Core dashboard/health pages localized.
[ ] AI disclaimer localized with approved templates.
[ ] Email OTP localized.
[ ] API error code mapping localized.
[ ] Translation coverage test passes.
[ ] Playwright bilingual smoke passes in Chromium.
[ ] No missing keys on tested screens.
[ ] No mixed language on tested screens.
[ ] No security/medical safety regression.
```
