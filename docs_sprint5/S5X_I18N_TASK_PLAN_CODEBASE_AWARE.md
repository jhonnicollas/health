# S5X-I18N — Bilingual (id-ID/en-US) Task Plan & Test Plan

```text
Product: iSehat / HL Health Companion
Document Type: Task Plan + Test Plan
Task Group: S5X-I18N — Indonesian + English Localization
Version: 2.0 CODEBASE-AWARE — disesuaikan dengan source code aktual
Date: 2026-06-28
Scope: Web frontend (React SPA), Worker API (Hono), email templates (Resend), DB schema
Default Locale: id-ID
Secondary Locale: en-US
```

---

## 0. Codebase Audit Findings (REALITY CHECK)

Berikut hasil audit source code aktual sebelum plan dibuat:

### 0.1 Frontend (web/)
- **Tidak ada library i18n** — tidak ada `react-i18next`, `i18next`, atau library translation apapun di `package.json`
- **Tidak ada folder `web/src/i18n/`** — belum ada infrastructure translation sama sekali
- **Semua string hardcoded** di component langsung — Bahasa Indonesia campur English (labels: "User Profile", "Settings Center", "Save Settings", dll)
- **Tidak ada LanguageSwitcher component**
- **Tidak ada locale detection** — tidak baca `Accept-Language`, `localStorage`, atau cookie
- **API calls tidak kirim `Accept-Language` atau `X-HL-Locale` header**

### 0.2 Backend (worker/)
- **API error pattern**: `fail(code, indonesianMessage, status)` — error code stabil tapi message hardcoded Indonesian
- **50+ error codes** tersebar di: `routes-auth.ts`, `routes-hydration.ts`, `routes-ai.ts`, `routes-cycle.ts`, `routes-telegram.ts`, `index.ts`
- **Email templates** di `services/email-sender.ts` — subject dan body HTML hardcoded Indonesian
- **Tidak ada locale parameter** di endpoint manapun
- **Tidak ada `HL_userPreferences` table** — schema tidak punya field `preferredLocale`

### 0.3 Database Schema
- **`HL_userProfiles`** table ADA (dengan sex, birthDate, heightCm, timezone, theme, accessibilityMode, aiConsent, emergencyConsent, dataShareConsent) — tapi TIDAK ada `preferredLocale` field
- **`HL_contentTranslations`** table TIDAK ADA — perlu dibuat untuk education/content translation

### 0.4 Error Code Inventory (cataloged from source)

| Code | Current Message (ID) | Used In |
|---|---|---|
| UNAUTHORIZED | Sesi tidak valid. | All route files |
| INTERNAL_ERROR | Gagal. / Gagal menghapus log. | All route files |
| ENTITLEMENT_REQUIRED | Fitur memerlukan paket Premium. | routes-hydration, routes-ai |
| VALIDATION_ERROR | amountMl 1-3000. / text wajib. | routes-hydration, routes-ai |
| LARGE_INPUT_CONFIRMATION_REQUIRED | Jumlah >1000ml memerlukan konfirmasi. | routes-hydration |
| NOT_FOUND | Log tidak ditemukan. | routes-hydration |
| FORBIDDEN | Permission admin diperlukan. / Akses ditolak. | index.ts, routes-ai |
| TELEGRAM_WEBHOOK_FORBIDDEN | Telegram webhook tidak valid. | routes-telegram |
| OTP_REQUIRED / OTP_INVALID / OTP_EXPIRED | Kode verifikasi tidak valid. | routes-auth |
| OTP_TOO_MANY_ATTEMPTS | Terlalu banyak percobaan. | routes-auth |
| OTP_RATE_LIMITED | Terlalu banyak permintaan. | routes-auth |
| EMAIL_ALREADY_EXISTS | Email sudah terdaftar. | routes-auth |
| EMAIL_INVALID_FORMAT | Format email tidak valid. | routes-auth |
| EMAIL_OTP_SEND_FAILED | Gagal mengirim kode verifikasi. | routes-auth |
| ACCOUNT_SUSPENDED | Akun di-suspend. | routes-auth |
| CYCLE_ACCESS_DENIED | Fitur cycle tracking hanya untuk perempuan usia 15-48. | routes-cycle |
| AI_CLINICAL_COPILOT_DEFERRED | (Sprint 6) | routes-ai |
| AUTH_PROVIDER_MISMATCH | Akun Google tidak bisa ganti password. | routes-auth |
| INVALID_CREDENTIALS | Password lama salah. | routes-auth |
| QUOTA_EXCEEDED | (quota messages) | services/ |

### 0.5 Dependencies
- **React 19.2.6** — modern React, support Suspense for lazy loading
- **Vite 8.0** — bundler, support dynamic imports
- **No i18n dependency** — perlu install `i18next` + `react-i18next` atau build custom lightweight solution

---

## 1. Architecture Decision: Custom i18n vs Library

### Decision: Custom lightweight i18n (NO new dependency)

**Alasan:**
1. Ponytail principle — jangan tambah dependency kalau bisa dibuat sederhana
2. Hanya 2 locale (id-ID, en-US) — tidak butuh library kompleks
3. React Context + JSON files sudah cukup
4. Bundle size tetap kecil — tidak perlu i18next (~40KB)
5. Tidak butuh pluralization/interpolation kompleks — sebagian besar string statis

**Implementasi:**
- `web/src/i18n/` folder dengan Context provider + hook `useI18n()`
- JSON files per namespace: `common.json`, `auth.json`, `errors.json`, dll
- `LocaleProvider` component wrapping app
- `useTranslation()` hook returning `t(key)` function
- LanguageSwitcher component

---

## 2. Task Plan (12 Tasks)

### I18N-001 — Create Frontend i18n Infrastructure (P0)

**Files:**
- `web/src/i18n/index.ts` — types, constants, context, provider, hook
- `web/src/i18n/locales/id-ID/common.json` — common UI strings
- `web/src/i18n/locales/en-US/common.json`
- `web/src/i18n/locales/id-ID/errors.json` — API error code → message mapping
- `web/src/i18n/locales/en-US/errors.json`

**Deliverables:**
```typescript
// web/src/i18n/index.ts
export const SUPPORTED_LOCALES = ['id-ID', 'en-US'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]
export const DEFAULT_LOCALE: SupportedLocale = 'id-ID'
export const FALLBACK_LOCALE: SupportedLocale = 'en-US'

// Context + Provider + useI18n hook + t() function
// Locale detection: localStorage('hl_locale') → browser → default
// Missing key: return key itself (no crash)
```

**Acceptance Criteria:**
- [ ] `LocaleProvider` wraps app in `App.tsx`
- [ ] `useI18n()` returns `{ locale, setLocale, t }`
- [ ] `t('common.save')` returns translated string
- [ ] Missing key returns key string (no crash)
- [ ] Default locale is id-ID
- [ ] `npx tsc -b` PASS

**Verify:**
```bash
cd web && npx tsc -b && npx eslint . && npx vite build
```

---

### I18N-002 — LanguageSwitcher Component + Locale Persistence (P0)

**Files:**
- `web/src/components/i18n/LanguageSwitcher.tsx`
- Edit `web/src/App.tsx` — add switcher to sidebar footer + login/register + topbar

**Deliverables:**
- Dropdown/toggle: "🇮🇩 Indonesia" / "🇬🇧 English"
- Pre-login: simpan di `localStorage('hl_locale')`
- Post-login: simpan di localStorage + kirim ke backend (once endpoint exists)
- Semua API calls kirim header `Accept-Language: <locale>`

**Acceptance Criteria:**
- [ ] Switcher visible di login page, register page, sidebar footer
- [ ] Locale persists after refresh (localStorage)
- [ ] Switching language instantly updates UI without reload
- [ ] API calls include `Accept-Language` header

**Verify:**
```bash
cd web && npx tsc -b && npx eslint . && npx vite build
```

---

### I18N-003 — Backend Locale Utility + User Preference API (P0)

**Files:**
- `worker/src/i18n/locale.ts` — locale parser + normalizer
- `worker/src/i18n/error-codes.ts` — error code → message map (id-ID + en-US)
- Edit `worker/src/services/email-sender.ts` — accept locale parameter
- New endpoint: `GET /api/me/preferences` + `PUT /api/me/preferences`
- DB migration: `ALTER TABLE HL_userProfiles ADD COLUMN preferredLocale TEXT DEFAULT 'id-ID'`

**Deliverables:**
```typescript
// worker/src/i18n/locale.ts
export function parseLocale(headers: Headers): SupportedLocale
export function normalizeLocale(input: string): SupportedLocale
// Priority: X-HL-Locale > Accept-Language > default id-ID
```

```typescript
// worker/src/i18n/error-codes.ts
export const ERROR_MESSAGES: Record<string, Record<SupportedLocale, string>> = {
  UNAUTHORIZED: { 'id-ID': 'Sesi tidak valid.', 'en-US': 'Invalid session.' },
  // ... all 50+ codes
}
export function localizeError(code: string, locale: SupportedLocale): string
```

**API:**
```
GET /api/me/preferences → { preferredLocale: 'id-ID' }
PUT /api/me/preferences → body: { preferredLocale: 'en-US' } → { updated: true }
```

**DB Migration:**
```sql
ALTER TABLE HL_userProfiles ADD COLUMN preferredLocale TEXT NOT NULL DEFAULT 'id-ID';
```

**Acceptance Criteria:**
- [ ] `parseLocale` handles missing/invalid headers → fallback id-ID
- [ ] `PUT /api/me/preferences` rejects unsupported locale
- [ ] `GET /api/me/preferences` returns current preferredLocale
- [ ] DB migration runs without error on local D1
- [ ] `worker tsc + npm test` PASS (update D1Mock for new column)

**Verify:**
```bash
cd worker && npx tsc -p tsconfig.json && npm test
```

---

### I18N-004 — Localize Auth/Login/Register/OTP Pages (P0)

**Files:**
- `web/src/i18n/locales/id-ID/auth.json` + `en-US/auth.json`
- Edit `web/src/pages/auth/LoginPage.tsx`
- Edit `web/src/pages/auth/RegisterPage.tsx`
- Edit `web/src/components/auth/EmailOtpVerificationStep.tsx`

**Deliverables:**
- Replace semua hardcoded strings dengan `t('auth.xxx')`
- Login: title, email label, password label, button text, error messages
- Register: title, fields, button, success/error
- OTP: title, description, input label, resend button, countdown text
- Google OAuth button text

**Acceptance Criteria:**
- [ ] Login page fully id-ID when locale=id-ID
- [ ] Login page fully en-US when locale=en-US
- [ ] Register page fully localized both languages
- [ ] OTP verification step fully localized
- [ ] No hardcoded Indonesian or English string remains in these files
- [ ] `tsc + eslint + build` PASS

---

### I18N-005 — Localize API Error Messages in Frontend (P0)

**Files:**
- `web/src/i18n/locales/id-ID/errors.json` + `en-US/errors.json`
- Edit `web/src/api/client.ts` or create error mapping utility
- Edit all pages that display API errors

**Deliverables:**
- Frontend error mapping: API returns `{ error: { code, message } }` → frontend uses `code` to lookup localized message
- If code not in translation map, fallback to API message
- All 50+ error codes cataloged in both languages

**Acceptance Criteria:**
- [ ] `UNAUTHORIZED` shows "Sesi tidak valid." in ID, "Invalid session." in EN
- [ ] `ENTITLEMENT_REQUIRED` shows localized message
- [ ] Unknown error code falls back to API message
- [ ] No mixed language on any error display
- [ ] `tsc + eslint + build` PASS

---

### I18N-006 — Localize Email Templates (P0)

**Files:**
- Edit `worker/src/services/email-sender.ts`
- `worker/src/i18n/templates/otp-id-ID.ts` + `otp-en-US.ts`

**Deliverables:**
- `sendOtp(env, email, otp, locale)` — accepts locale parameter
- OTP email subject + body in both languages
- Locale resolved from: user preference > X-HL-Locale header > default id-ID
- Update all callers of `sendOtp` to pass locale

**Acceptance Criteria:**
- [ ] Register with id-ID → Indonesian OTP email
- [ ] Register with en-US → English OTP email
- [ ] OTP code never logged
- [ ] No secret in email body
- [ ] `worker tsc + test` PASS

**Verify:**
```bash
cd worker && npx tsc -p tsconfig.json && npm test
```

---

### I18N-007 — Localize Billing/Payment Pages (P0)

**Files:**
- `web/src/i18n/locales/id-ID/billing.json` + `en-US/billing.json`
- Edit `web/src/pages/premium/PremiumUpgradePage.tsx`
- Edit `web/src/pages/billing/BillingSuccessPage.tsx`
- Edit `web/src/pages/billing/BillingCancelPage.tsx`
- Edit `web/src/pages/billing/BillingSettingsPage.tsx`
- Edit `web/src/components/UpgradePrompt.tsx`

**Deliverables:**
- Plan names, prices, feature labels, buttons, success/cancel messages
- Payment status text localized

**Acceptance Criteria:**
- [ ] Premium upgrade page fully localized
- [ ] Billing success/cancel pages localized
- [ ] No hardcoded string remains
- [ ] `tsc + eslint + build` PASS

---

### I18N-008 — Localize Dashboard + Health Feature Pages (P1)

**Files:**
- `web/src/i18n/locales/id-ID/dashboard.json`, `hydration.json`, `symptom.json`, `cycle.json`
- `en-US/` equivalents
- Edit: `DailyHealthHubPage`, `HydrationPage`, `HydrationHistoryPage`, `SymptomPage`, `CyclePage`

**Deliverables:**
- Dashboard greeting, status labels, quick actions
- Hydration: target, quick add, warning, history labels
- Symptom: chip labels, VAS labels, emergency modal
- Cycle: calendar labels, guardrail text, settings

**Acceptance Criteria:**
- [ ] Hydration overhydration warning localized + medically safe
- [ ] Red flag emergency modal localized + remains blocking
- [ ] Cycle guardrail localized + remains blocking
- [ ] `tsc + eslint + build` PASS

---

### I18N-009 — Localize AI Pages + Disclaimer (P0)

**Files:**
- `web/src/i18n/locales/id-ID/ai.json` + `en-US/ai.json`
- `worker/src/i18n/templates/disclaimer-id-ID.ts` + `disclaimer-en-US.ts`
- Edit: `AiAssistantPage`, `AiMemorySettingsPage`
- Edit: AI response handler to append localized disclaimer

**Deliverance Criteria:**
- [ ] AI disclaimer server-side approved template (not AI-translated)
- [ ] `clinicalCopilotMode=true` returns `AI_CLINICAL_COPILOT_DEFERRED` in both languages
- [ ] AI Memory page labels localized
- [ ] `tsc + eslint + build + worker test` PASS

---

### I18N-010 — Localize Admin Panel (P1)

**Files:**
- `web/src/i18n/locales/id-ID/admin.json` + `en-US/admin.json`
- Edit: `AdminPage.tsx` — all tab labels, table headers, buttons

**Acceptance Criteria:**
- [ ] Admin tab labels localized
- [ ] Secret fields remain masked in both languages
- [ ] `tsc + eslint + build` PASS

---

### I18N-011 — Localize Settings + Knowledge Base + FAQ + Manual (P1)

**Files:**
- `web/src/i18n/locales/id-ID/settings.json`, `kb.json`
- `en-US/` equivalents
- Edit: `ProfileSettingsPage`, `KnowledgeBasePage`, `FaqPage`, `UserManualPage`, `AlertsPage`, `RemindersPage`, `EmergencyContactsPage`, `TelegramSettingsPage`, `FamilyPage`

**Acceptance Criteria:**
- [ ] All settings labels localized
- [ ] Knowledge base articles available in both languages
- [ ] FAQ Q&A in both languages
- [ ] User manual in both languages
- [ ] `tsc + eslint + build` PASS

---

### I18N-012 — Localize Navigation + Shell + Remaining Pages (P1)

**Files:**
- `web/src/i18n/locales/id-ID/nav.json` + `en-US/nav.json`
- Edit: `App.tsx` — NAV_GROUPS labels, sidebar, topbar, user dropdown, welcome wizard, toast messages
- Edit: remaining pages not covered above (Reports, Measurements, Fasting, Medications, Patterns, Caregiver, Onboarding)

**Acceptance Criteria:**
- [ ] All nav group labels localized
- [ ] Sidebar footer buttons localized
- [ ] Welcome wizard localized
- [ ] Toast messages localized
- [ ] `tsc + eslint + build` PASS

---

### I18N-013 — Bilingual E2E Release Gate (P0)

**Files:**
- `web/e2e/smoke/i18n-auth.spec.ts`
- `web/e2e/smoke/i18n-billing.spec.ts`
- `web/e2e/smoke/i18n-health-features.spec.ts`

**Deliverables:**
- E2E smoke: login/register/OTP in both locales
- E2E smoke: premium upgrade in both locales
- E2E smoke: dashboard/hydration/symptom safety copy in both locales
- Assert: no missing translation key, no mixed language

**Acceptance Criteria:**
- [ ] All i18n E2E tests pass in Chromium
- [ ] No console error
- [ ] No missing key visible
- [ ] No mixed language

---

## 3. Execution Order

```text
I18N-001 (frontend infra) → I18N-002 (switcher) → I18N-003 (backend locale + API) →
I18N-004 (auth pages) → I18N-005 (error mapping) → I18N-006 (email templates) →
I18N-007 (billing) → I18N-009 (AI + disclaimer) → I18N-008 (health features) →
I18N-010 (admin) → I18N-011 (settings + KB + FAQ) → I18N-012 (nav + shell) →
I18N-013 (E2E gate)
```

---

## 4. Test Plan

### 4.1 Unit Tests (worker)

**File:** `worker/test/sprint5-i18n.test.mjs`

| Test | Description |
|---|---|
| `parseLocale returns id-ID for no header` | Default locale when no Accept-Language |
| `parseLocale returns en-US for Accept-Language: en` | English detection |
| `parseLocale returns id-ID for Accept-Language: id` | Indonesian detection |
| `parseLocale falls back to id-ID for unsupported locale` | e.g. `ja-JP` → `id-ID` |
| `normalizeLocale accepts 'id' and 'en' short codes` | Short code normalization |
| `localizeError returns Indonesian for id-ID` | Error message in ID |
| `localizeError returns English for en-US` | Error message in EN |
| `localizeError falls back to code for unknown error` | Unknown error → code string |
| `GET /api/me/preferences returns preferredLocale` | Preference read |
| `PUT /api/me/preferences rejects unsupported locale` | Validation |
| `PUT /api/me/preferences updates preferredLocale` | Preference write |
| `sendOtp uses Indonesian template for id-ID` | Email locale |
| `sendOtp uses English template for en-US` | Email locale |
| `OTP email never contains secret/token` | Security check |

### 4.2 Frontend Validation

| Check | Command |
|---|---|
| TypeScript compiles | `cd web && npx tsc -b` |
| ESLint passes | `cd web && npx eslint .` |
| Vite build passes | `cd web && npx vite build` |
| No hardcoded Indonesian in EN mode | Manual check after switching |
| No hardcoded English in ID mode | Manual check after switching |

### 4.3 E2E Tests (Playwright)

**File:** `web/e2e/smoke/i18n-*.spec.ts`

| Test | Description |
|---|---|
| `login page shows Indonesian by default` | Assert text "Masuk" visible |
| `login page switches to English` | Click switcher, assert "Login" visible |
| `register page localized both languages` | Switch and assert |
| `dashboard localized after login` | Login → switch → assert |
| `hydration page localized` | Switch → assert labels |
| `symptom page localized` | Switch → assert chip labels |
| `no missing translation keys visible` | Assert no `auth.` or `common.` raw keys |
| `no mixed language on screen` | All visible text same locale |
| `error message localized` | Trigger error → assert localized message |
| `locale persists after refresh` | Set EN → refresh → still EN |

### 4.4 Security & Safety Tests

| Test | Description |
|---|---|
| No secret in translation JSON files | `grep -r "token\|secret\|key\|password" web/src/i18n/` |
| No secret in email templates | Check email-sender.ts |
| AI disclaimer server-side only | Disclaimer comes from approved template, not AI |
| clinicalCopilotMode still deferred | Test in both locales |
| Cycle guardrail still blocking | Test in both locales |
| Red flag still blocking | Test in both locales |

---

## 5. Translation Key Naming Convention

```text
namespace.section.key

Examples:
  common.save
  common.cancel
  common.loading
  auth.login.title
  auth.login.emailLabel
  auth.login.passwordLabel
  auth.login.submitButton
  auth.register.title
  errors.UNAUTHORIZED
  errors.ENTITLEMENT_REQUIRED
  nav.dashboard
  nav.measurements
  hydration.target
  hydration.quickAdd
  symptom.chips.headache
  cycle.guardrail.title
  billing.upgrade.title
  ai.disclaimer
  admin.tabs.users
  settings.profile.name
  settings.profile.password
```

---

## 6. File Structure

```text
web/src/i18n/
  index.ts                    # Context, Provider, useI18n hook, t() function
  locales/
    id-ID/
      common.json             # Common UI: save, cancel, loading, error, etc
      auth.json               # Login, register, OTP
      errors.json             # API error code → message
      nav.json                # Navigation labels
      dashboard.json          # Dashboard page
      hydration.json          # Hydration pages
      symptom.json            # Symptom page
      cycle.json              # Cycle page
      billing.json            # Billing/premium pages
      ai.json                 # AI assistant + memory
      admin.json              # Admin panel
      settings.json           # Settings page
      kb.json                 # Knowledge base + FAQ + manual
      reports.json            # Report pages
    en-US/
      (same structure)

worker/src/i18n/
  locale.ts                   # parseLocale, normalizeLocale
  error-codes.ts              # ERROR_MESSAGES map + localizeError()
  templates/
    otp-id-ID.ts              # Indonesian OTP email template
    otp-en-US.ts              # English OTP email template
    disclaimer-id-ID.ts       # Indonesian AI disclaimer
    disclaimer-en-US.ts       # English AI disclaimer

web/src/components/i18n/
  LanguageSwitcher.tsx        # Dropdown toggle component
  LocaleProvider.tsx          # Wraps app, provides locale context
```

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Missing translation key in production | `t()` returns key string, not crash. E2E test checks for raw keys. |
| API error code changes | Error codes are stable (already in production). Frontend fallback to API message. |
| Email template HTML injection | OTP code is numeric only, no user input in template beyond code. |
| Locale not persisting for anonymous users | localStorage fallback before login. |
| DB migration breaks existing data | `ALTER TABLE ADD COLUMN ... DEFAULT 'id-ID'` is additive, safe. |
| Bundle size increase from JSON files | Lazy load locale files via dynamic import. Only load active locale. |
| Medical/safety copy mistranslation | Use approved templates only. No AI translation for medical text. |

---

## 8. Definition of Done

```text
[ ] Frontend i18n infrastructure created (no new dependency)
[ ] LanguageSwitcher in login/register/sidebar
[ ] Backend locale parser + user preference API
[ ] DB migration: preferredLocale column added
[ ] Auth/login/register/OTP fully localized
[ ] API error codes mapped in frontend
[ ] Email templates bilingual
[ ] Billing pages localized
[ ] AI disclaimer from approved template
[ ] Dashboard/hydration/symptom/cycle localized
[ ] Admin panel localized
[ ] Settings/KB/FAQ/manual localized
[ ] Navigation/shell/wizard/toast localized
[ ] E2E bilingual smoke passes
[ ] No missing keys on tested screens
[ ] No mixed language
[ ] No security/medical safety regression
[ ] Worker tests pass
[ ] Web tsc/eslint/build pass
```
