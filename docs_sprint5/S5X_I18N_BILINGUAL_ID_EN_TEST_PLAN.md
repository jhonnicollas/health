# S5X-I18N — Bilingual iSehat Test Plan

```text
Product: iSehat / HL Health Companion
Document Type: Test Plan
Task Group: S5X-I18N — Indonesian + English Localization
Version: 1.0 EXECUTION READY
Date: 2026-06-28
Supported Locales: id-ID, en-US
Default Locale: id-ID
Primary Browser for E2E: Chromium only
```

---

## 1. Test Goals

Test plan ini memastikan bilingual support tidak hanya mengganti teks, tetapi juga aman untuk auth, OTP, billing, AI safety, medical copy, dan Playwright smoke.

Goals:

```text
1. Semua layar utama bisa tampil id-ID dan en-US.
2. Locale tersimpan dan dipakai setelah refresh/login.
3. API error code diterjemahkan di frontend.
4. Email OTP memakai bahasa yang benar.
5. Billing/payment flow memakai bahasa yang benar.
6. Medical/safety copy tidak rusak atau di-translate bebas oleh AI.
7. AI Clinical Copilot tetap disabled/deferred di Sprint 5 dalam semua bahasa.
8. Tidak ada missing translation key pada production build/E2E smoke.
9. Tidak ada console error atau /api 404/500 pada E2E.
```

---

## 2. Test Commands

### Worker

```bash
cd worker
npx tsc -p tsconfig.json
npm test
```

### Web

```bash
cd web
npx tsc -b
npx eslint .
npx vite build
```

### Playwright Chromium Only

```bash
cd web
npx playwright test e2e/smoke/i18n --project=chromium
```

### Full i18n verification

```bash
cd web
npm run verify:i18n
```

If the project uses pnpm:

```bash
cd web
pnpm verify:i18n
```

---

## 3. Required Test Fixtures

Synthetic users:

```text
E2E_FREE_ID_EMAIL=id-free@example.test
E2E_FREE_EN_EMAIL=en-free@example.test
E2E_PREMIUM_ID_EMAIL=id-premium@example.test
E2E_PREMIUM_EN_EMAIL=en-premium@example.test
E2E_ADMIN_ID_EMAIL=id-admin@example.test
E2E_ADMIN_EN_EMAIL=en-admin@example.test
```

Environment flags:

```text
EMAIL_PROVIDER=mock
EMAIL_OTP_TEST_MODE=true
BILLING_PROVIDER=mock
PLAYWRIGHT_BASE_URL=http://localhost:5173
PLAYWRIGHT_API_BASE_URL=http://localhost:8787
```

Forbidden real data:

```text
- real patient data
- real email OTP from production
- real Resend API key
- real Xendit key
- real user cookie
- real webhook token
```

---

## 4. Translation Coverage Tests

### I18N-TC-001 — Locale files exist

```text
Given the project supports id-ID and en-US
When translation validation runs
Then all required namespaces exist for both locales
```

Required namespaces:

```text
common
auth
dashboard
billing
otp
admin
hydration
symptom
cycle
ai
safety
errors
```

Acceptance:

```text
[ ] id-ID namespace files exist.
[ ] en-US namespace files exist.
[ ] JSON parses successfully.
```

---

### I18N-TC-002 — Key parity between locales

```text
Given id-ID is the source locale
When the validation compares id-ID and en-US
Then en-US must contain the same keys
```

Acceptance:

```text
[ ] No key exists only in id-ID.
[ ] No key exists only in en-US unless explicitly allowed.
[ ] Nested key structure matches.
```

---

### I18N-TC-003 — No secret-like strings in translation files

Scan translation files for:

```text
sk-
re_
xnd_
cf_
ghp_
AIza
TELEGRAM_BOT_TOKEN
XENDIT_SECRET_KEY
RESEND_API_KEY
BEGIN PRIVATE KEY
```

Acceptance:

```text
[ ] No secret-like string exists in translation files.
[ ] No real webhook token exists.
[ ] No real OTP exists in snapshots.
```

---

## 5. Locale Detection Tests

### I18N-TC-010 — Default locale

```text
Given no user preference, no cookie, and no Accept-Language
When the app loads
Then locale is id-ID
```

Acceptance:

```text
[ ] Login page appears in Bahasa Indonesia by default.
```

---

### I18N-TC-011 — Switch to English before login

```text
Given user is on login page
When user selects English
Then UI changes to English
And locale persists after refresh
```

Acceptance:

```text
[ ] Login heading is English.
[ ] Register link is English.
[ ] Cookie/localStorage stores en-US.
```

---

### I18N-TC-012 — Save authenticated locale preference

```text
Given authenticated user opens settings
When user changes language to English
Then PUT /api/me/preferences stores preferredLocale=en-US
And future sessions load en-US
```

Acceptance:

```text
[ ] GET /api/me/preferences returns en-US.
[ ] UI remains English after reload.
```

---

### I18N-TC-013 — Invalid locale fallback

```text
Given request header X-HL-Locale=fr-FR
When backend parses locale
Then fallback is id-ID
```

Acceptance:

```text
[ ] Backend does not crash.
[ ] Response uses valid locale.
```

---

## 6. Auth + OTP Localization Tests

### I18N-TC-020 — Register in Indonesian

```text
Given user selects Bahasa Indonesia
When user starts email registration
Then OTP screen is in Indonesian
And mock OTP email subject/body is Indonesian
```

Expected subject:

```text
Kode OTP iSehat Anda
```

Acceptance:

```text
[ ] OTP UI uses Indonesian copy.
[ ] Mock email outbox stores locale id-ID.
[ ] OTP code is not logged.
```

---

### I18N-TC-021 — Register in English

```text
Given user selects English
When user starts email registration
Then OTP screen is in English
And mock OTP email subject/body is English
```

Expected subject:

```text
Your iSehat OTP Code
```

Acceptance:

```text
[ ] OTP UI uses English copy.
[ ] Mock email outbox stores locale en-US.
```

---

### I18N-TC-022 — OTP error localization

Error codes:

```text
OTP_INVALID
OTP_EXPIRED
OTP_TOO_MANY_ATTEMPTS
OTP_RESEND_COOLDOWN
EMAIL_NOT_VERIFIED
```

Acceptance:

```text
[ ] Indonesian mode displays Indonesian errors.
[ ] English mode displays English errors.
[ ] UI does not display raw code as main message unless dev mode.
```

---

## 7. API Error Localization Tests

### I18N-TC-030 — API client maps code to localized message

```text
Given API returns { error: { code: 'ENTITLEMENT_REQUIRED' } }
When locale is id-ID
Then UI displays Indonesian upgrade message
```

Acceptance:

```text
[ ] ENTITLEMENT_REQUIRED localized in id-ID.
[ ] ENTITLEMENT_REQUIRED localized in en-US.
[ ] Unknown error code uses generic localized message.
```

---

### I18N-TC-031 — AI Clinical Copilot deferred localized

```text
Given locale is en-US
When frontend receives AI_CLINICAL_COPILOT_DEFERRED
Then UI displays English message saying AI Clinical Copilot is not active yet
```

Acceptance:

```text
[ ] English does not say AI doctor is active.
[ ] Indonesian does not say AI dokter is active.
[ ] Sprint 6 wording remains handoff/deferred.
```

---

## 8. Billing Localization Tests

### I18N-TC-040 — Premium upgrade page Indonesian

```text
Given locale id-ID
When user opens /premium/upgrade
Then plan cards, CTA, quota, and billing messages are Indonesian
```

Acceptance:

```text
[ ] Upgrade button localized.
[ ] Plan names/descriptions localized where available.
[ ] Payment pending/success/error text localized.
```

---

### I18N-TC-041 — Premium upgrade page English

```text
Given locale en-US
When user opens /premium/upgrade
Then plan cards, CTA, quota, and billing messages are English
```

Acceptance:

```text
[ ] No Indonesian copy appears on the tested English billing screen.
```

---

### I18N-TC-042 — Payment success localization

```text
Given user completes mock payment
When redirected to /billing/success
Then page text matches selected locale
And page polls backend entitlement instead of trusting redirect only
```

Acceptance:

```text
[ ] id-ID success page localized.
[ ] en-US success page localized.
[ ] /api/me/entitlements called.
```

---

## 9. Health Feature Localization Tests

### I18N-TC-050 — Dashboard bilingual smoke

```text
Given user has selected id-ID/en-US
When opening dashboard
Then Daily Health Hub copy follows selected locale
```

Acceptance:

```text
[ ] id-ID dashboard has no English UI labels except brand/technical terms.
[ ] en-US dashboard has no Indonesian UI labels except brand/medical metric names if intentionally preserved.
```

---

### I18N-TC-051 — Hydration warning bilingual

```text
Given user exceeds overhydration warning threshold
When hydration warning appears
Then text is localized and remains a warning, not diagnosis
```

Acceptance:

```text
[ ] id-ID warning says warning/periksa input/konsultasi if symptoms.
[ ] en-US warning says warning/review input/consult if symptoms.
[ ] No language claims diagnosis.
```

---

### I18N-TC-052 — Red flag blocking UI bilingual

```text
Given symptom text contains red flag keyword
When symptom is submitted
Then emergency blocking UI is localized and remains blocking
```

Acceptance:

```text
[ ] id-ID blocking UI visible.
[ ] en-US blocking UI visible.
[ ] Modal does not auto-dismiss.
[ ] AI is not authority for emergency.
```

---

### I18N-TC-053 — Cycle guardrail bilingual

```text
Given eligible cycle user opens contraception guardrail
When guardrail appears
Then copy is localized and blocking
```

Acceptance:

```text
[ ] id-ID copy localized.
[ ] en-US copy localized.
[ ] Not toast-only.
[ ] Does not claim cycle tracking is contraception.
```

---

## 10. AI/Safety Localization Tests

### I18N-TC-060 — AI disclaimer Indonesian

```text
Given locale id-ID
When AI assistant/report returns output
Then Indonesian approved disclaimer is present
```

Acceptance:

```text
[ ] Disclaimer says not diagnosis/prescription/doctor replacement.
[ ] Disclaimer is not generated freely by AI.
```

---

### I18N-TC-061 — AI disclaimer English

```text
Given locale en-US
When AI assistant/report returns output
Then English approved disclaimer is present
```

Acceptance:

```text
[ ] Disclaimer says not diagnosis/prescription/doctor replacement.
[ ] No instruction to change medication dosage.
```

---

### I18N-TC-062 — clinicalCopilotMode remains deferred in both locales

```text
Given user sends clinicalCopilotMode=true
When API handles request
Then API rejects with AI_CLINICAL_COPILOT_DEFERRED
And frontend displays localized deferred message
```

Acceptance:

```text
[ ] id-ID localized deferred message.
[ ] en-US localized deferred message.
[ ] No AI doctor runtime enabled.
```

---

## 11. Admin Localization Tests

### I18N-TC-070 — Admin shell bilingual

```text
Given admin switches language
When admin opens /admin
Then navigation and tab labels are localized
```

Acceptance:

```text
[ ] Users/Roles/Plans/AI Config/Audit labels localized.
[ ] Tables remain readable.
[ ] No secret values shown in either locale.
```

---

### I18N-TC-071 — Secret masking labels bilingual

```text
Given admin opens AI config/system config
When config contains secret fields
Then UI displays localized masked/configured labels
And never displays secret value
```

Acceptance:

```text
[ ] id-ID: configured/masked label localized.
[ ] en-US: configured/masked label localized.
[ ] No token/API key visible.
```

---

## 12. Content Translation Tests

### I18N-TC-080 — Education card translation available

```text
Given education card has approved en-US translation
When user locale is en-US
Then API returns English card content
```

Acceptance:

```text
[ ] title/body are English.
[ ] entityId/source remains stable.
```

---

### I18N-TC-081 — Missing content translation fallback

```text
Given education card lacks en-US translation
When user locale is en-US
Then API falls back safely to id-ID or existing source content
And response marks fallbackUsed=true if implemented
```

Acceptance:

```text
[ ] No API crash.
[ ] No empty title/body.
```

---

## 13. Playwright E2E Smoke Plan

Folder:

```text
web/e2e/smoke/i18n/
  i18n-auth-otp.spec.ts
  i18n-billing.spec.ts
  i18n-health-features.spec.ts
  i18n-ai-safety.spec.ts
  i18n-admin.spec.ts
```

Each spec must attach global failure gate:

```text
- console.error => FAIL
- pageerror => FAIL
- /api/* 404 => FAIL
- /api/* 5xx => FAIL
- failed important request => FAIL
```

Run:

```bash
cd web
npx playwright test e2e/smoke/i18n --project=chromium
```

---

## 14. Mobile Tests

Minimum mobile routes:

```text
/login
/register
/premium/upgrade
/dashboard
/hydration
/symptoms/new
```

Viewport:

```text
360x800
```

Acceptance:

```text
[ ] Language switcher usable on mobile.
[ ] OTP input usable on mobile.
[ ] Upgrade page readable on mobile.
[ ] Emergency blocking UI readable on mobile.
[ ] No text overflow that hides CTA.
```

---

## 15. Release Gate

S5X-I18N cannot be marked DONE unless:

```text
[ ] Worker typecheck PASS.
[ ] Worker tests PASS.
[ ] Web typecheck PASS.
[ ] Web lint PASS.
[ ] Web build PASS.
[ ] Translation key parity PASS.
[ ] Secret scan translation/email templates PASS.
[ ] Playwright i18n Chromium smoke PASS.
[ ] id-ID default verified.
[ ] en-US switch verified.
[ ] OTP email bilingual verified.
[ ] Billing flow bilingual verified.
[ ] AI/safety disclaimer bilingual verified.
[ ] No AI doctor Sprint 5 activation regression.
```

---

## 16. WORK_LOG Entry Template

```markdown
## YYYY-MM-DD HH:mm UTC — Agent: <agent/tool>

### Task
- Task ID: S5X-I18N-<number>
- Status: Completed | Blocked | Needs Review

### Files Read
- <compact list>

### Files Changed
- <compact list>

### What Changed
- <compact bullets>

### Validation
- `cd worker && npx tsc -p tsconfig.json` — PASS/FAIL/NOT_RUN
- `cd worker && npm test` — PASS/FAIL/NOT_RUN
- `cd web && npx tsc -b` — PASS/FAIL/NOT_RUN
- `cd web && npx eslint .` — PASS/FAIL/NOT_RUN
- `cd web && npx vite build` — PASS/FAIL/NOT_RUN
- `cd web && npx playwright test e2e/smoke/i18n --project=chromium` — PASS/FAIL/NOT_RUN

### Next Agent Notes
- <next task / blocker>
```
