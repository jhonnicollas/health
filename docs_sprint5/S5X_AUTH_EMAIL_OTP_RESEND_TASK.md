# S5X-AUTH-OTP — Email OTP Verification for Registration and Email Login

```text
Product: HL Health Companion / iSehat
Document Type: Implementation Task for AI Agent
Version: 1.0 — Email OTP Security Fix + Resend Integration
Date: 2026-06-27
Priority: P0 Security / Release Blocker
Scope: Sprint 5 Cross-Phase Auth Hardening
Related Sprint Boundary:
- Sprint 5 must be release-safe, subscription-ready, and security-first.
- This task is NOT AI Doctor / Clinical Copilot work.
- This task must not change Sprint 5C AI scope.
```

---

## 0. Critical Security Notice

A Resend API token was pasted during planning. Treat that token as compromised.

Required action before production use:

```text
1. Revoke/delete the exposed Resend API key in Resend dashboard.
2. Create a new Resend API key.
3. Store the new key only in Cloudflare Worker secret / CI secret.
4. Never commit the key to markdown, source code, SQL seed, frontend bundle, logs, screenshots, or test snapshots.
```

Do not write the real key into this repository.

Use placeholders only:

```text
RESEND_API_KEY=<set via wrangler secret>
```

---

## 1. Problem Statement

Current registration allows a user to input any email address without proving ownership.

Impact:

```text
- User can register with fake/random email.
- User can register with someone else's email.
- Password reset / notification / billing identity becomes unsafe.
- Account ownership is not verified.
- Release should not proceed until email ownership is verified.
```

Required fix:

```text
No verified email ownership = no active account and no authenticated session.
```

---

## 2. Goal

Implement email OTP verification for manual email flows:

```text
1. Email/password registration must require OTP before account activation/session creation.
2. Email/password login must require OTP before session creation.
3. Email-only/passwordless login can reuse the same OTP service if present.
4. Google OAuth continues to use Google's email_verified=true claim and does not need internal OTP.
5. Google OAuth email_verified=false must be rejected.
```

---

## 3. Current Email Provider State

Resend domain is already configured and verified:

```text
Domain: mail.isehat.biz.id
Status: Verified
Recommended sender: iSehat <otp@mail.isehat.biz.id>
```

Do not use Resend onboarding sender in production:

```text
Do not use: onboarding@resend.dev
Use: iSehat <otp@mail.isehat.biz.id>
```

---

## 4. Non-Negotiable Rules

```text
- OTP must never be stored as plaintext.
- OTP must never be returned in API response.
- OTP must never be logged.
- OTP must never appear in audit metadata.
- OTP must never be stored in localStorage/sessionStorage.
- Session must only be created after OTP verification succeeds.
- Register must not create an active verified user before OTP verification.
- Email must be normalized server-side: lowercase + trim.
- Email format must be validated server-side.
- Rate limit must apply per normalized email and IP hash.
- Resend API key must be stored in Cloudflare secret only.
- Production must not expose dev/test OTP outbox endpoints.
```

---

## 5. Required Environment / Secrets

### Cloudflare Worker Secrets

```bash
wrangler secret put RESEND_API_KEY
```

### Non-secret vars

```toml
[vars]
EMAIL_PROVIDER = "resend"
EMAIL_FROM = "iSehat <otp@mail.isehat.biz.id>"
EMAIL_OTP_TTL_SECONDS = "600"
EMAIL_OTP_MAX_ATTEMPTS = "5"
EMAIL_OTP_RESEND_COOLDOWN_SECONDS = "60"
EMAIL_OTP_MAX_RESENDS = "3"
EMAIL_OTP_TEST_MODE = "false"
```

### Test/local vars

```env
EMAIL_PROVIDER=mock
EMAIL_OTP_TEST_MODE=true
EMAIL_FROM="iSehat <otp@mail.isehat.biz.id>"
EMAIL_OTP_TTL_SECONDS=600
EMAIL_OTP_MAX_ATTEMPTS=5
EMAIL_OTP_RESEND_COOLDOWN_SECONDS=60
EMAIL_OTP_MAX_RESENDS=3
```

---

## 6. Database Migration

Create additive migration only.

File suggestion:

```text
worker/migrations/XXXX_s5x_auth_email_otp.sql
```

Required table:

```sql
CREATE TABLE IF NOT EXISTS HL_emailOtpChallenges



## 7. Backend Services

### 7.1 Email OTP Service

Create:

```text
worker/src/services/email-otp.ts
```

Required functions:

```text
normalizeEmail(email)
validateEmailFormat(email)
generateOtp(length=6)
generateSalt()
hashOtp(otp, salt, secretPepper)
createChallenge(params)
verifyChallenge(params)
consumeChallenge(challengeId)
resendChallenge(challengeId)
assertRateLimit(normalizedEmail, ipHash)
maskEmail(email)
```

Rules:

```text
OTP length: 6 digits
TTL: 10 minutes
Max attempts: 5
Resend cooldown: 60 seconds
Max resend: 3
Hash: HMAC-SHA256 or salted SHA-256 with server secret/pepper
Single-use: consumedAt must be null before verify
Expired: now > expiresAt must fail
```

### 7.2 Email Sender Service

Create:

```text
worker/src/services/email-sender.ts
```

Required provider modes:

```text
resend
mock
```

Recommended implementation for Cloudflare Workers: use `fetch` to Resend API to avoid unnecessary SDK/runtime issues.

Resend API request pattern:

```ts
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from: env.EMAIL_FROM || 'iSehat <otp@mail.isehat.biz.id>',
    to: [email],
    subject: 'Kode verifikasi iSehat',
    html,
  }),
});
```

Do not hardcode the API key.

Email content requirements:

```text
Subject: Kode verifikasi iSehat
Contains 6-digit OTP
Mentions expiry: 10 minutes
Mentions: ignore if user did not request
No medical data
No secret/config values
```

---

## 8. API Endpoints

Add routes under existing auth route module.

Suggested file:

```text
worker/src/routes-auth.ts
```

### 8.1 Register Start

```text
POST /api/auth/register/start
```

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Test User"
}
```

Behavior:

```text
1. Validate email/password.
2. Normalize email.
3. Do not create session.
4. Create pending registration state or OTP challenge.
5. Send OTP to email.
6. Return challengeId + maskedEmail + expiresInSeconds.
```

Response:

```json
{
  "success": true,
  "data": {
    "otpRequired": true,
    "challengeId": "otp_xxx",
    "maskedEmail": "u***@example.com",
    "expiresInSeconds": 600
  }
}
```

### 8.2 Register Verify

```text
POST /api/auth/register/verify
```

Request:

```json
{
  "challengeId": "otp_xxx",
  "otp": "123456"
}
```

Behavior:

```text
1. Verify OTP.
2. Create/activate user only after OTP passes.
3. Set emailVerifiedAt.
4. Set emailVerificationMethod='otp'.
5. Assign default free plan if project requires it.
6. Create session.
7. Return redirect target.
```

### 8.3 Login Start

```text
POST /api/auth/login/start
```

Request:

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

Behavior:

```text
1. Validate credentials.
2. If credentials valid, send OTP.
3. Do not create session yet.
4. Return challengeId + maskedEmail.
5. For invalid credentials, use existing safe login error style.
```

### 8.4 Login Verify

```text
POST /api/auth/login/verify
```

Request:

```json
{
  "challengeId": "otp_xxx",
  "otp": "123456"
}
```

Behavior:

```text
1. Verify OTP.
2. Ensure challenge purpose is login.
3. Ensure user still exists and is active.
4. Create session.
5. Return redirect target.
```

### 8.5 Resend OTP

```text
POST /api/auth/otp/resend
```

Request:

```json
{
  "challengeId": "otp_xxx"
}
```

Behavior:

```text
1. Enforce resend cooldown.
2. Enforce max resend count.
3. Generate new OTP hash for same challenge or create replacement challenge.
4. Send email.
5. Return maskedEmail + expiresInSeconds.
```

---

## 9. Error Codes

Add to shared API error code union:

```text
OTP_REQUIRED
OTP_INVALID
OTP_EXPIRED
OTP_TOO_MANY_ATTEMPTS
OTP_RESEND_COOLDOWN
OTP_RATE_LIMITED
EMAIL_NOT_VERIFIED
EMAIL_OTP_SEND_FAILED
EMAIL_INVALID_FORMAT
EMAIL_ALREADY_VERIFIED
```

---

## 10. Google OAuth Rules

Existing Google OAuth remains valid, but enforce:

```text
if googlePayload.email_verified !== true:
  reject EMAIL_NOT_VERIFIED
```

Do not require internal OTP for Google OAuth if `email_verified=true`.

Do not auto-merge password account by matching email when user is not already authenticated.

Google account linking must only happen from authenticated settings flow.

---

## 11. Frontend Work

### 11.1 Components

Create reusable components:

```text
web/src/components/auth/OtpInput.tsx
web/src/components/auth/EmailOtpVerificationStep.tsx
```

### 11.2 RegisterPage

Update:

```text
web/src/pages/auth/RegisterPage.tsx
```

Required UX:

```text
1. User submits register form.
2. If response otpRequired=true, show OTP step.
3. Display masked email.
4. 6-digit OTP input.
5. Verify button.
6. Resend button with countdown.
7. Error state for invalid/expired OTP.
8. Success redirects to onboarding/dashboard.
```

### 11.3 LoginPage

Update:

```text
web/src/pages/auth/LoginPage.tsx
```

Required UX:

```text
1. User submits email/password.
2. If response otpRequired=true, show OTP step.
3. Existing Google OAuth button remains.
4. Existing password error remains safe and readable.
5. Session only starts after OTP verify.
```

### 11.4 Storage Rule

```text
Allowed in component state: challengeId, maskedEmail, expiresAt
Forbidden in localStorage/sessionStorage: OTP, raw email+password, secret, API key
```

---

## 12. Local/Test Mock Email Outbox

To make E2E fast, implement mock provider in test mode.

When:

```text
EMAIL_PROVIDER=mock
EMAIL_OTP_TEST_MODE=true
```

Then:

```text
EmailSenderService stores latest sent OTP in test-only in-memory outbox or D1 test-only table/fixture.
```

Optional dev-only endpoint:

```text
GET /api/dev/test-email-outbox/latest?email=test@example.test
```

Hard rules:

```text
- This endpoint must return 404/403 in production.
- This endpoint must only work when EMAIL_OTP_TEST_MODE=true.
- This endpoint must never be deployed active in production.
```

If dev-only endpoint is too risky, expose mock outbox only inside Playwright test fixture / worker test harness.

---

## 13. Playwright E2E Requirements

Add tests to existing one-browser Playwright smoke plan.

Suggested file:

```text
web/e2e/smoke/auth-email-otp.spec.ts
```

Test only Chromium.

Required tests:

```text
[ ] Register email/password opens OTP screen.
[ ] Register invalid OTP shows error and does not create session.
[ ] Register valid OTP creates session and redirects.
[ ] Login email/password opens OTP screen.
[ ] Login invalid OTP shows error and does not create session.
[ ] Login valid OTP creates session and redirects.
[ ] Resend OTP button respects countdown.
[ ] Google OAuth button remains visible.
[ ] No console.error, pageerror, /api/* 404, or /api/* 5xx.
```

Use existing global console/network failure gate.

---

## 14. Unit/API Tests

### EmailOtpService Unit Tests

```text
[ ] normalizeEmail trims and lowercases.
[ ] invalid email rejected.
[ ] OTP is 6 digits.
[ ] OTP hash verifies correctly.
[ ] OTP plaintext is not persisted.
[ ] expired OTP rejected.
[ ] consumed OTP rejected.
[ ] wrong OTP increments failedAttempts.
[ ] max failed attempts locks challenge.
[ ] resend cooldown enforced.
[ ] max resend count enforced.
```

### API Tests

```text
[ ] Register start returns otpRequired and no session cookie.
[ ] Register verify valid creates user/session.
[ ] Register verify invalid returns OTP_INVALID.
[ ] Login start valid returns otpRequired and no session cookie.
[ ] Login verify valid creates session.
[ ] Login verify invalid returns OTP_INVALID.
[ ] OTP response never includes plaintext OTP.
[ ] Audit/log metadata never includes OTP or Resend API key.
[ ] Google OAuth email_verified=false returns EMAIL_NOT_VERIFIED.
[ ] Google OAuth email_verified=true does not require OTP.
```

---

## 15. Secret Scan Requirements

Before marking done, run or implement scan ensuring none of these appear in source/docs/bundle/test snapshots:

```text
RESEND_API_KEY real value
re_ prefixed real Resend token
OTP plaintext from tests
Authorization: Bearer <real token>
GOOGLE_CLIENT_SECRET real value
TELEGRAM_BOT_TOKEN real value
```

Allowed placeholders:

```text
RESEND_API_KEY_PLACEHOLDER
TEST_RESEND_API_KEY_PLACEHOLDER
TEST_EMAIL_OTP_CODE
```

---

## 16. Validation Commands

Run all relevant gates:

```bash
cd worker
npx tsc -p tsconfig.json
npm test

cd ../web
npx tsc -b
npx eslint .
npx vite build
npx playwright test e2e/smoke/auth-email-otp.spec.ts --project=chromium
```

If full smoke is already configured:

```bash
cd web
npx playwright test e2e/smoke --project=chromium
```

---

## 17. OpenCode / Sub-Agent Execution Strategy

This task should not be split into many agents editing the same files at once.

Recommended order:

```text
Primary Agent:
1. Add DB migration.
2. Add EmailOtpService.
3. Add EmailSenderService with resend/mock provider.
4. Add auth endpoints.
5. Run worker tests.

Frontend Agent:
1. Add OtpInput.
2. Add EmailOtpVerificationStep.
3. Update RegisterPage.
4. Update LoginPage.
5. Run web build.

QA Agent:
1. Add Playwright auth-email-otp.spec.ts.
2. Use mock provider/test outbox.
3. Run Chromium-only E2E.
4. Update WORK_LOG/HANDOFF.
```

Do not run these subagents in parallel if they modify:

```text
worker/src/routes-auth.ts
web/src/pages/auth/RegisterPage.tsx
web/src/pages/auth/LoginPage.tsx
package.json
playwright.config.ts
WORK_LOG.md
HANDOFF.md
```

---

## 18. Definition of Done

This task is DONE only when:

```text
[ ] Real Resend key is revoked/replaced and stored only as Cloudflare secret.
[ ] `mail.isehat.biz.id` sender is used, not onboarding@resend.dev.
[ ] Register email/password requires OTP.
[ ] Login email/password requires OTP.
[ ] Session is not created before OTP verification.
[ ] Google OAuth uses email_verified and does not require internal OTP.
[ ] OTP stored only as hash + salt.
[ ] OTP never appears in response/log/audit/frontend bundle.
[ ] Rate limit, expiry, max attempts, and resend cooldown work.
[ ] Worker typecheck and tests pass.
[ ] Web typecheck/eslint/build pass.
[ ] Playwright Chromium auth OTP smoke passes.
[ ] WORK_LOG.md updated.
[ ] HANDOFF.md updated.
```

---

## 19. Agent Prompt

Use this prompt in OpenCode/Codex agent:

```text
You are implementing S5X-AUTH-OTP for HL Health Companion / iSehat.

Goal:
Fix unsafe email registration/login by requiring email OTP verification using Resend.

Read only:
- AGENTS.md
- HANDOFF.md
- WORK_LOG_TAIL.md
- S5X_AUTH_EMAIL_OTP_RESEND_TASK.md
- Current auth route/service files only

Hard rules:
- Do not hardcode real Resend API key.
- Treat any previously pasted Resend key as compromised and do not reuse it.
- Use RESEND_API_KEY from Cloudflare Worker secret/env.
- Use sender: iSehat <otp@mail.isehat.biz.id>.
- OTP must be hashed, single-use, max attempts, expiring, rate-limited.
- Session must only be created after OTP verify.
- Google OAuth email_verified=true does not need OTP; email_verified=false must be rejected.
- Add tests first where possible.
- Use Ponytail: minimal change, reuse existing auth/session helpers, do not bypass security.

Implement:
1. Add HL_emailOtpChallenges migration.
2. Add EmailOtpService.
3. Add EmailSenderService with resend and mock modes.
4. Add register/start, register/verify, login/start, login/verify, otp/resend endpoints.
5. Update RegisterPage and LoginPage with OTP step.
6. Add Playwright Chromium smoke for register/login OTP.
7. Run worker tsc/test, web tsc/eslint/build, and Playwright auth smoke.
8. Update WORK_LOG.md and HANDOFF.md.

Stop after this task.
```
