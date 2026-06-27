# S5X-AUTH-OTP Task Plan

```text
Product: HL Health Companion / iSehat
Document Type: Implementation Task Plan
Version: 1.0
Date: 2026-06-27
Priority: P0 Security / Release Blocker
Scope: Email OTP Verification for Registration + Login + Resend Integration
```

---

## 1. Problem

Registration allows any email without ownership proof. Account identity unsafe.

**Fix:** No session until email OTP verified.

---

## 2. Cross-Check Findings (Doc vs Source)

| # | Gap | Resolution |
|---|-----|-----------|
| 1 | `HL_emailOtpChallenges` table doesn't exist, `worker/migrations/` dir doesn't exist | Create dir + migration |
| 2 | `emailVerifiedAt` / `emailVerificationMethod` columns missing from `HL_users` | ALTER TABLE in migration |
| 3 | `RESEND_API_KEY` not in Env type, wrangler.toml, or any code | Add to consolidated Env + wrangler secret |
| 4 | No email services exist | Create email-otp.ts + email-sender.ts |
| 5 | Register creates active=1 user + session immediately | Change to active=0, no session, OTP required |
| 6 | Login creates session immediately | Change to OTP challenge, no session until verified |
| 7 | routes-auth.ts uses `LocalEnv`, not shared `Env` | Consolidate all Env to types.ts |
| 8 | Three duplicate Env definitions | Consolidate to single types.ts |
| 9 | forgot-password is stub | Out of scope for this task, log separately |
| 10 | No frontend auth components dir | Create web/src/components/auth/ |
| 11 | No OTP E2E spec | Create auth-email-otp.spec.ts |
| 12 | hashPassword in routes-auth.ts uses bare SHA-256 (index.ts uses PBKDF2) | Fix in this task |
| 13 | EMAIL_NOT_VERIFIED error code used in routes-auth.ts but not in shared union | Add to shared error codes |
| 14 | New endpoint paths needed | Add /register/start, /register/verify, /login/start, /login/verify, /otp/resend |
| 15 | Exposed Resend API key `re_i8HLA6u5_Ee6hGnwc3s6MickUC9MgRHuV` | Must revoke, never commit real key |

---

## 3. Design Decisions

### 3.1 Two-Step Auth Flow

Keep existing `/api/auth/register` and `/api/auth/login` endpoints but change behavior:
- `POST /api/auth/register` → creates user `active=0`, no session, returns `otpRequired=true` + `challengeId`
- `POST /api/auth/login` → validates credentials, no session, returns `otpRequired=true` + `challengeId`

Add new explicit two-step endpoints (preferred by frontend):
- `POST /api/auth/register/start` → same as above
- `POST /api/auth/register/verify` → verify OTP, activate user, create session
- `POST /api/auth/login/start` → same as login above
- `POST /api/auth/login/verify` → verify OTP, create session
- `POST /api/auth/otp/resend` → resend OTP with cooldown

### 3.2 Env Consolidation

Delete duplicate `Env` from `index.ts` and `LocalEnv` from `routes-auth.ts`. Single `Env` in `types.ts`. Both files import from `types.ts`.

### 3.3 User Schema

Add `emailVerifiedAt TEXT` and `emailVerificationMethod TEXT` to `HL_users` via ALTER TABLE.

### 3.4 Hash Bug Fix

Google OAuth callback in `routes-auth.ts` uses bare SHA-256. Fix to use PBKDF2 (extract shared hash helpers or import from common location).

### 3.5 Resend Provider

Use `fetch` to Resend API directly. No SDK dependency. Sender: `iSehat <otp@mail.isehat.biz.id>`. Never use `onboarding@resend.dev` in production.

### 3.6 Mock Provider

When `EMAIL_PROVIDER=mock` + `EMAIL_OTP_TEST_MODE=true`, mock sender stores sent OTPs in-memory for test retrieval. Dev-only outbox endpoint returns 403 in production.

---

## 4. Task Breakdown

### Phase A: Database + Foundation (Backend)

**Task A1: Create migration directory + migration file**
- Create `worker/migrations/`
- Create `worker/migrations/001_s5x_auth_email_otp.sql`
- Contents:
  - `CREATE TABLE IF NOT EXISTS HL_emailOtpChallenges` (id, userId, normalizedEmail, otpHash, salt, purpose, failedAttempts, maxAttempts, expiresAt, consumedAt, resendCount, maxResends, lastResendAt, ipHash, createdAt)
  - `ALTER TABLE HL_users ADD COLUMN emailVerifiedAt TEXT`
  - `ALTER TABLE HL_users ADD COLUMN emailVerificationMethod TEXT`
- Run on local D1, verify with `PRAGMA foreign_key_check`

**Task A2: Consolidate Env types**
- Update `worker/src/types.ts` Env with all OTP vars + Google OAuth vars
- Delete duplicate Env from `index.ts`, import from types.ts
- Delete LocalEnv from `routes-auth.ts`, import from types.ts
- Add new env vars: `RESEND_API_KEY`, `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_OTP_TTL_SECONDS`, `EMAIL_OTP_MAX_ATTEMPTS`, `EMAIL_OTP_RESEND_COOLDOWN_SECONDS`, `EMAIL_OTP_MAX_RESENDS`, `EMAIL_OTP_TEST_MODE`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Run `npx tsc -p tsconfig.json`

**Task A3: Add error codes**
- Add OTP/AUTH error codes to shared type in `types.ts`:
  `OTP_REQUIRED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_TOO_MANY_ATTEMPTS`, `OTP_RESEND_COOLDOWN`, `OTP_RATE_LIMITED`, `EMAIL_NOT_VERIFIED`, `EMAIL_OTP_SEND_FAILED`, `EMAIL_INVALID_FORMAT`, `EMAIL_ALREADY_VERIFIED`
- Run `npx tsc -p tsconfig.json`

### Phase B: Service Layer (Backend)

**Task B1: Create EmailOtpService**
- File: `worker/src/services/email-otp.ts`
- Functions: normalizeEmail, validateEmailFormat, generateOtp, hashOtp (HMAC-SHA256 with env pepper), createChallenge, verifyChallenge, consumeChallenge, resendChallenge, assertRateLimit, maskEmail
- OTP: 6 digits, TTL 600s, max 5 attempts, resend cooldown 60s, max 3 resends
- OTP never stored plaintext, never in response, never in logs
- Unit tests for all functions

**Task B2: Create EmailSenderService**
- File: `worker/src/services/email-sender.ts`
- Two providers: `resend` (fetch-based, no SDK), `mock` (in-memory outbox for tests)
- Resend: POST to `https://api.resend.com/emails` with Bearer token from `env.RESEND_API_KEY`
- Sender: `iSehat <otp@mail.isehat.biz.id>`
- Subject: `Kode verifikasi iSehat`
- HTML: 6-digit OTP, 10-min expiry notice, ignore-if-not-requested notice
- Mock: stores in Map, accessible via dev-only endpoint when `EMAIL_OTP_TEST_MODE=true`
- Dev endpoint: `GET /api/dev/test-email-outbox/latest?email=...` — 403 if not test mode

### Phase C: Auth Endpoints (Backend)

**Task C1: Add register/start + register/verify endpoints**
- In `worker/src/routes-auth.ts`
- `POST /api/auth/register/start`: validate email/password, normalize email, create user `active=0`, create OTP challenge, send email, return `challengeId` + `maskedEmail` + `expiresInSeconds`
- `POST /api/auth/register/verify`: verify OTP, set user `active=1`, set `emailVerifiedAt=now()`, set `emailVerificationMethod='otp'`, create session, return user + redirect
- Update existing `POST /api/auth/register` to same behavior (backward compat)

**Task C2: Add login/start + login/verify endpoints**
- `POST /api/auth/login/start`: validate credentials, create OTP challenge, send email, return `challengeId` + `maskedEmail` — no session
- `POST /api/auth/login/verify`: verify OTP, ensure purpose=login, ensure user active, create session, return user + redirect
- Update existing `POST /api/auth/login` to same behavior
- Invalid credentials still use safe error style (no user enumeration)

**Task C3: Add otp/resend endpoint**
- `POST /api/auth/otp/resend`: enforce cooldown + max resend count, generate new OTP hash, send email, return `maskedEmail` + `expiresInSeconds`

**Task C4: Fix hashPassword inconsistency**
- Extract PBKDF2 hash/verify from `index.ts` into shared location (e.g., `worker/src/services/crypto.ts` or inline in types.ts utils)
- Update `routes-auth.ts` Google OAuth callback to use PBKDF2 instead of bare SHA-256
- Migrate existing Google-created users? ponytail: no migration, new logins will re-hash on next password change

**Task C5: Update Google OAuth for emailVerifiedAt**
- On Google user creation (callback): set `emailVerifiedAt=now()` + `emailVerificationMethod='google'` if `email_verified=true`
- Keep existing `email_verified=false` rejection (already in routes-auth.ts)

### Phase D: Frontend

**Task D1: Create OtpInput component**
- File: `web/src/components/auth/OtpInput.tsx`
- 6-digit input, auto-focus next, paste support, numeric-only

**Task D2: Create EmailOtpVerificationStep component**
- File: `web/src/components/auth/EmailOtpVerificationStep.tsx`
- Props: challengeId, maskedEmail, expiresInSeconds, onVerified, purpose
- States: entering OTP, verifying, error (invalid/expired/too many attempts), resend countdown

**Task D3: Update RegisterPage**
- After form submit: if `otpRequired=true`, show `EmailOtpVerificationStep`
- On OTP verified: call `setAuthenticated()` with session data
- Display masked email, resend button
- Forbidden: OTP in localStorage/sessionStorage

**Task D4: Update LoginPage**
- After form submit: if `otpRequired=true`, show `EmailOtpVerificationStep`
- On OTP verified: call `setAuthenticated()` with session data
- Google OAuth button remains unchanged
- Existing error style preserved

### Phase E: Tests + Validation

**Task E1: EmailOtpService unit tests**
- File: `worker/src/services/__tests__/email-otp.test.ts` (or project test convention)
- Cases: normalizeEmail, invalid email rejected, OTP 6 digits, hash verifies, hash persists not plaintext, expired rejected, consumed rejected, wrong OTP increments attempts, max attempts locks, resend cooldown, max resends enforced

**Task E2: API integration tests**
- Register start returns otpRequired + no session cookie
- Register verify valid creates user/session
- Register verify invalid returns OTP_INVALID
- Login start valid returns otpRequired + no session cookie
- Login verify valid creates session
- Login verify invalid returns OTP_INVALID
- OTP response never includes plaintext OTP
- Audit metadata never includes OTP or API key
- Google OAuth email_verified=false → EMAIL_NOT_VERIFIED
- Google OAuth email_verified=true → no OTP required

**Task E3: Playwright E2E**
- File: `web/e2e/smoke/auth-email-otp.spec.ts`
- Chromium only
- Register flow: submit → OTP screen → verify → session
- Login flow: submit → OTP screen → verify → session
- Invalid OTP → error, no session
- Resend countdown
- Google OAuth button visible
- Global console/network failure gate

**Task E4: Secret scan**
- Grep repo for: `RESEND_API_KEY` real value, `re_` prefixed tokens, OTP plaintext from tests, `Authorization: Bearer` with real token, `GOOGLE_CLIENT_SECRET`, `TELEGRAM_BOT_TOKEN`
- Allowed: `RESEND_API_KEY_PLACEHOLDER`, `TEST_RESEND_API_KEY_PLACEHOLDER`, `TEST_EMAIL_OTP_CODE`

### Phase F: Config + Wrangler

**Task F1: Update wrangler.toml**
- Add `[vars]` section with non-secret email/OTP config
- `RESEND_API_KEY` via `wrangler secret put` (documented, not committed)
- Add `[vars]` to `.dev.vars` for local dev (EMAIL_PROVIDER=mock, EMAIL_OTP_TEST_MODE=true)

---

## 5. Execution Order

```text
A1 → A2 → A3 → B1 → B2 → C1 → C2 → C3 → C4 → C5 → D1 → D2 → D3 → D4 → E1 → E2 → E3 → E4 → F1
```

Sequential. No parallel agents touching same files. See Section 17 of original S5X doc for conflict matrix.

---

## 6. Security Non-Negotiables

- OTP never plaintext in DB, response, log, audit, frontend bundle, or localStorage
- Session only after OTP verify
- Register creates inactive user until OTP verified
- Google OAuth `email_verified=false` rejected
- Exposed Resend key must be revoked before production
- `RESEND_API_KEY` stored only as Cloudflare Worker secret
- Rate limit per normalized email + IP hash
- Resend API key never in source/docs/bundle/snapshots

---

## 7. Definition of Done

```text
[ ] Real Resend key revoked, new key in Cloudflare secret only
[ ] mail.isehat.biz.id sender used, not onboarding@resend.dev
[ ] Register requires OTP, user inactive until verified
[ ] Login requires OTP, no session until verified
[ ] Google OAuth sets emailVerifiedAt + emailVerificationMethod
[ ] Google OAuth rejects email_verified=false
[ ] OTP stored only as hash + salt
[ ] OTP never in response/log/audit/frontend bundle
[ ] Rate limit, expiry, max attempts, resend cooldown work
[ ] PBKDF2 used everywhere (no bare SHA-256 for passwords)
[ ] Env consolidated to single types.ts
[ ] Worker tsc + tests pass
[ ] Web tsc + eslint + build pass
[ ] Playwright Chromium auth OTP smoke passes
[ ] Secret scan clean
[ ] WORK_LOG.md updated
[ ] HANDOFF.md updated
```

---

## 8. Ponytail Notes

- No Resend SDK dependency. `fetch` to API. Zero new npm packages.
- Password hash fix: extract PBKDF2 to shared, no migration for existing Google-created users (next login rehashes).
- Forgot-password stub: out of scope, log as separate bug.
- Mock provider: in-memory Map, no D1 test table needed.
- Migration: single file, additive only, no destructive changes.
