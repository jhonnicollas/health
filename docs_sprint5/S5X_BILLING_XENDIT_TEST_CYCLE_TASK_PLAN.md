# S5X-BILLING-XENDIT-TEST-CYCLE — Task Plan

```text
Product: iSehat / HL Health Companion
Document Type: Execution Task Plan
Task ID: S5X-BILLING-XENDIT-TEST-CYCLE
Version: 1.0 READY FOR AI AGENT EXECUTION
Scope: Paid feature checkout, Xendit Test Mode integration, mock billing provider, webhook-driven subscription activation, frontend upgrade flow, and E2E payment smoke.
Browser Test Scope: Chromium only.
Important Boundary: This task enables full payment-cycle testing and paid entitlement activation. It must not require Xendit Live Mode or completed business verification for test execution.
```

---

## 0. Why This Task Exists

Current Sprint 5 already has plan, subscription, entitlement, quota, billing webhook foundation, and upgrade prompt concepts. The missing piece is a real customer-facing checkout flow that can be tested end-to-end:

```text
Free user
→ sees paid feature blocked
→ clicks Upgrade
→ checkout session is created
→ user pays via mock or Xendit Test Mode
→ verified webhook activates subscription
→ /api/me/entitlements changes to paid
→ paid feature unlocks
```

This task adds that missing lifecycle.

---

## 1. Existing Sprint 5 Source-of-Truth

UpgradePrompt
```

Do not duplicate existing plan, entitlement, or subscription logic. Extend it.

---

## 2. Non-Negotiable Rules

```text
1. Do not put Xendit secret key in code, frontend, markdown, SQL seed, log, audit metadata, or test snapshots.
2. Do not activate paid plan from frontend redirect alone.
3. Only verified server-side webhook may activate subscription.
4. Webhook must be idempotent.
5. Amount, currency, planCode, userId, provider, and merchantRef must be verified before subscription activation.
6. Duplicate webhook must not double-activate or double-extend subscription.
7. Test Mode must work without Xendit business verification.
8. Live Mode must remain disabled until `XENDIT_MODE=live` and business verification is completed.
9. Mock provider must exist for fast Playwright E2E.
10. Xendit Test Mode must exist for real integration smoke.
11. Paid feature unlock must happen through `/api/me/entitlements`, not local frontend flags.
12. Use Ponytail discipline: smallest safe change, reuse existing services/components, do not bypass security/test validation.
```

---

## 3. Environment and Secrets

### 3.1 Required Cloudflare Secrets

Set these via Wrangler or Cloudflare dashboard:

```bash
wrangler secret put XENDIT_SECRET_KEY
wrangler secret put XENDIT_WEBHOOK_TOKEN
```

Use Xendit **Test Mode** secret key for this task.

### 3.2 Required Non-Secret Variables

Add to `wrangler.toml` or equivalent environment config:

```toml
[vars]
BILLING_PROVIDER = "mock" # mock | xendit_test | xendit_live
XENDIT_MODE = "test"      # test | live
XENDIT_BASE_URL = "https://api.xendit.co"
BILLING_CURRENCY = "IDR"
BILLING_SUCCESS_URL = "https://app.isehat.biz.id/billing/success"
BILLING_CANCEL_URL = "https://app.isehat.biz.id/billing/cancel"
BILLING_WEBHOOK_URL = "https://app.isehat.biz.id/api/billing/webhook/xendit"
```

For local test:

```env
BILLING_PROVIDER=mock
XENDIT_MODE=test
PLAYWRIGHT_BASE_URL=http://localhost:5173
PLAYWRIGHT_API_BASE_URL=http://localhost:8787
```

For staging Xendit Test Mode:

```env
BILLING_PROVIDER=xendit_test
XENDIT_MODE=test
PLAYWRIGHT_BASE_URL=https://app.isehat.biz.id
```

---

## 4. Xendit Dashboard Setup

In Xendit Dashboard Test Mode:

```text
1. Use Test Mode API Key.
2. Configure webhook URL:
   https://app.isehat.biz.id/api/billing/webhook/xendit
3. Copy webhook verification/callback token.
4. Save token as Cloudflare secret `XENDIT_WEBHOOK_TOKEN`.
5. Keep live transactions disabled until business verification is completed.
```

Do not paste Xendit secret key or webhook token into this file.

---

## 5. Implementation Architecture

### 5.1 Billing Provider Interface

Create or extend:

```text
worker/src/services/billing-provider.ts
```

Interface:

```ts
export type BillingProviderCode = 'mock' | 'xendit_test' | 'xendit_live';

export interface CreateCheckoutInput {
  userId: number;
  email: string;
  planCode: string;
  planName: string;
  amount: number;
  currency: string;
  merchantRef: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCheckoutResult {
  provider: 'mock' | 'xendit';
  mode: 'mock' | 'test' | 'live';
  providerCheckoutId: string;
  merchantRef: string;
  checkoutUrl: string;
  rawProviderResponse?: unknown;
}

export interface BillingProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
}
```

### 5.2 Providers

Implement:

```text
worker/src/services/billing-providers/mock.ts
worker/src/services/billing-providers/xendit.ts
```

#### Mock Provider

```text
- No external API call.
- Return internal checkout URL: /billing/mock-checkout?checkoutId=<id>
- Used by local Playwright and CI.
```

#### Xendit Test Provider

Use Xendit Payment Link / Invoice API through `fetch`, not necessarily SDK, to reduce dependency risk in Cloudflare Workers.

Expected provider behavior:

```text
- Create a hosted payment page.
- Store returned provider checkout/invoice ID.
- Store returned checkout URL / invoice_url.
- Use external_id / reference_id / merchantRef that maps to internal checkout session.
```

Minimal request fields to Xendit invoice/payment-link API should include equivalent of:

```json
{
  "external_id": "ISEHAT-<checkoutSessionId>",
  "amount": 49000,
  "currency": "IDR",
  "payer_email": "user@example.test",
  "description": "iSehat Premium Monthly",
  "success_redirect_url": "https://app.isehat.biz.id/billing/success?checkoutId=...",
  "failure_redirect_url": "https://app.isehat.biz.id/billing/cancel?checkoutId=..."
}
```

Agent must verify current Xendit payload field names against official docs during implementation.

---

## 6. Database Changes

### 6.1 First Inspect Existing Schema

Before adding a table, inspect whether a checkout/session/order table already exists.

```bash
rg "checkout|invoice|payment|subscription" worker docs_sprint5 -n
```

If there is already a suitable table, reuse it. If not, add additive table below.

### 6.2 Additive Table: `HL_billingCheckoutSessions`

Create migration:

```text
worker/migrations/<timestamp>_s5x_billing_checkout_sessions.sql
```

SQL:

```sql
CREATE TABLE IF NOT EXISTS HL_billingCheckoutSessions (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  planCode TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('mock','xendit')),
  mode TEXT NOT NULL CHECK (mode IN ('mock','test','live')),
  merchantRef TEXT NOT NULL UNIQUE,
  providerCheckoutId TEXT NULL,
  checkoutUrl TEXT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired','cancelled')),
  successUrl TEXT NULL,
  cancelUrl TEXT NULL,
  paidAt TEXT NULL,
  expiresAt TEXT NULL,
  metadataJson TEXT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id),
  FOREIGN KEY (planCode) REFERENCES HL_plans(planCode)
);

CREATE INDEX IF NOT EXISTS idx_HL_billingCheckoutSessions_userId_status
  ON HL_billingCheckoutSessions(userId, status);

CREATE INDEX IF NOT EXISTS idx_HL_billingCheckoutSessions_providerCheckoutId
  ON HL_billingCheckoutSessions(provider, providerCheckoutId);

CREATE INDEX IF NOT EXISTS idx_HL_billingCheckoutSessions_merchantRef
  ON HL_billingCheckoutSessions(merchantRef);
```

### 6.3 Reuse Existing Tables

```text
HL_paymentEvents:
- Store checkout.created, webhook.received, payment.paid, payment.failed, payment.expired events.
- Deduplicate by provider + providerEventId when available.
- rawPayloadJson must be sanitized.

HL_subscriptions:
- Create/update active subscription only after verified paid webhook.

HL_auditLogs:
- billing.checkout.created
- billing.webhook.received
- billing.subscription.activated
- billing.webhook.duplicate
- billing.webhook.rejected
```

---

## 7. Backend Tasks

## S5X-BILL-001 — Billing Config and Provider Factory

### Files

```text
worker/src/services/billing/config.ts
worker/src/services/billing/provider-factory.ts
worker/src/services/billing-provider.ts
```

### Deliverables

```text
- Read BILLING_PROVIDER.
- Read XENDIT_MODE.
- Read XENDIT_BASE_URL.
- Read secrets from env only.
- Select mock or xendit provider.
```

### Acceptance Criteria

```text
[ ] Missing XENDIT_SECRET_KEY blocks xendit_test/xendit_live checkout with safe error.
[ ] Missing XENDIT_WEBHOOK_TOKEN blocks webhook verification with 403.
[ ] Live mode rejected unless `BILLING_PROVIDER=xendit_live` and `XENDIT_MODE=live`.
[ ] No secret returned in API or logs.
```

---

## S5X-BILL-002 — Checkout Session Service

### Files

```text
worker/src/services/billing/checkout-session.ts
worker/test/billing-checkout-session.test.mjs
```

### Deliverables

```text
- createPendingCheckoutSession(userId, planCode)
- getCheckoutSessionById(id)
- getCheckoutSessionByMerchantRef(merchantRef)
- attachProviderCheckout(sessionId, providerCheckoutId, checkoutUrl)
- markPaid(sessionId, paidAt)
- markFailed/expired/cancelled(sessionId)
```

### Acceptance Criteria

```text
[ ] planCode must exist and be active.
[ ] amount must come from HL_plans, not request body.
[ ] currency defaults to IDR or configured value.
[ ] merchantRef is unique and unpredictable enough.
[ ] userId is taken from session, not request body.
```

---

## S5X-BILL-003 — POST /api/billing/checkout

### Endpoint

```text
POST /api/billing/checkout
```

### Request

```json
{
  "planCode": "premiumMonthly"
}
```

### Response

```json
{
  "success": true,
  "data": {
    "checkoutId": "chk_...",
    "provider": "xendit",
    "mode": "test",
    "merchantRef": "ISEHAT-...",
    "checkoutUrl": "https://...",
    "amount": 49000,
    "currency": "IDR",
    "status": "pending"
  }
}
```

### Acceptance Criteria

```text
[ ] Requires active user session.
[ ] Rejects invalid/inactive plan.
[ ] Rejects free plan checkout if not payable.
[ ] Amount calculated server-side from HL_plans.
[ ] Creates HL_billingCheckoutSessions pending row.
[ ] Creates HL_paymentEvents checkout.created row.
[ ] Writes audit log.
[ ] Returns checkoutUrl.
[ ] Does not expose provider secret.
```

---

## S5X-BILL-004 — Mock Billing Provider and Mock Checkout UI

### Backend

```text
POST /api/billing/webhook/mock
```

Only enabled when:

```text
BILLING_PROVIDER=mock
NODE_ENV=test or explicit BILLING_MOCK_ENABLED=true
```

### Frontend

```text
/billing/mock-checkout?checkoutId=<id>
```

### Deliverables

```text
- Mock checkout page with plan summary.
- Button: Simulate Paid.
- Button calls mock webhook endpoint.
- Redirects to /billing/success.
```

### Acceptance Criteria

```text
[ ] Mock provider never enabled in production unless explicitly allowed for staging test.
[ ] Simulate Paid creates same downstream effect as paid webhook.
[ ] Duplicate mock paid callback is idempotent.
[ ] Playwright can complete full cycle without external Xendit UI.
```

---

## S5X-BILL-005 — Xendit Test Provider

### Files

```text
worker/src/services/billing-providers/xendit.ts
worker/test/xendit-provider.test.mjs
```

### Deliverables

```text
- Create Xendit payment link/invoice in Test Mode.
- Use Basic Auth or official supported auth for secret key.
- Map Xendit response to CreateCheckoutResult.
- Persist providerCheckoutId and checkoutUrl.
```

### Acceptance Criteria

```text
[ ] Uses env secret only.
[ ] Uses XENDIT_BASE_URL.
[ ] Sends external_id/merchantRef.
[ ] Sets success and failure redirect URLs.
[ ] Returns checkoutUrl/invoice_url.
[ ] Handles Xendit API error with safe error message.
[ ] Does not log request Authorization header.
```

---

## S5X-BILL-006 — Xendit Webhook Handler

### Endpoint

```text
POST /api/billing/webhook/xendit
```

### Required Header Check

```text
x-callback-token must equal env.XENDIT_WEBHOOK_TOKEN
```

### Webhook Behavior

```text
- Parse provider event.
- Resolve merchantRef/external_id/reference_id to checkout session.
- Check amount/currency/planCode.
- Upsert/deduplicate HL_paymentEvents.
- Mark checkout paid/failed/expired.
- Activate subscription on paid/settled/succeeded status only.
- Write audit log.
```

### Acceptance Criteria

```text
[ ] Missing x-callback-token returns 403.
[ ] Invalid x-callback-token returns 403.
[ ] Unknown merchantRef returns safe 404 or 202 ignored based on existing webhook policy.
[ ] Amount mismatch rejected and audited.
[ ] Currency mismatch rejected and audited.
[ ] Duplicate webhook returns success but does not double-activate.
[ ] Paid webhook activates subscription.
[ ] Failed/expired webhook does not activate subscription.
[ ] rawPayloadJson is sanitized.
```

---

## S5X-BILL-007 — Subscription Activation Service

### Files

```text
worker/src/services/billing/subscription-activation.ts
worker/test/subscription-activation.test.mjs
```

### Deliverables

```text
- activatePaidSubscription(userId, planCode, checkoutSessionId, providerEventId)
- calculate currentPeriodStart/currentPeriodEnd from HL_plans.billingInterval
- cancel/replace previous active subscription if product model allows one active plan
- reset or update quota windows if required
```

### Acceptance Criteria

```text
[ ] Activates correct plan.
[ ] Does not activate disabled plan.
[ ] Does not create duplicate active subscriptions from duplicate webhook.
[ ] currentPeriodEnd matches monthly/quarterly/yearly/family interval.
[ ] /api/me/entitlements reflects paid status after activation.
```

---

## S5X-BILL-008 — Billing Status APIs

### Endpoints

```text
GET /api/billing/my-subscription
GET /api/billing/checkout/:checkoutId
GET /api/billing/invoices
```

### Acceptance Criteria

```text
[ ] Requires session.
[ ] User can only see own billing records.
[ ] Response contains no provider secret.
[ ] Billing success page can poll checkout/subscription status.
```

---

## 8. Frontend Tasks

## S5X-BILL-009 — Pricing Page

### Route

```text
/pricing
```

### Deliverables

```text
- Show Free, Premium Monthly, Premium Quarterly, Premium Yearly, Family Premium.
- Show feature highlights from entitlement/plan data if available.
- Upgrade button for paid plans.
- Current plan badge.
```

### Acceptance Criteria

```text
[ ] Free user can click Upgrade.
[ ] Paid user sees current plan.
[ ] Loading/error/empty states exist.
[ ] Mobile 360px usable.
```

---

## S5X-BILL-010 — Upgrade Button + Checkout Redirect

### Files

```text
web/src/components/billing/UpgradeButton.tsx
web/src/components/billing/PlanCard.tsx
```

### Behavior

```text
Click Upgrade
→ POST /api/billing/checkout
→ receive checkoutUrl
→ window.location.href = checkoutUrl
```

### Acceptance Criteria

```text
[ ] Button disabled while request is loading.
[ ] API error shown clearly.
[ ] checkoutUrl redirect works.
[ ] No provider secret in frontend bundle.
```

---

## S5X-BILL-011 — Billing Success and Cancel Pages

### Routes

```text
/billing/success
/billing/cancel
```

### Behavior

```text
Success page:
- Do not trust redirect alone.
- Poll /api/billing/my-subscription and /api/me/entitlements.
- Show "Payment pending" until webhook activates subscription.
- Show "Premium active" after entitlement changes.

Cancel page:
- Explain payment was not completed.
- CTA back to pricing.
```

### Acceptance Criteria

```text
[ ] Success page handles pending state.
[ ] Success page handles paid state.
[ ] Cancel page does not activate subscription.
[ ] Mobile 360px usable.
```

---

## S5X-BILL-012 — Settings Billing Page

### Route

```text
/settings/billing
```

### Deliverables

```text
- Current plan.
- Current period.
- Paid status.
- Recent payment events/invoices.
- Link to pricing.
```

---

## S5X-BILL-013 — Upgrade Prompt Integration

### Target

Existing paid feature gates must route users to `/pricing`.

### Acceptance Criteria

```text
[ ] Free user opening premium feature sees UpgradePrompt.
[ ] UpgradePrompt CTA goes to /pricing.
[ ] After successful payment, same feature opens.
[ ] Entitlement is read from /api/me/entitlements, not local state only.
```

---

## 9. Playwright E2E Tasks — Chromium Only

### Files

```text
web/e2e/smoke/s5x-billing-mock.spec.ts
web/e2e/smoke/s5x-billing-xendit-test.spec.ts
web/e2e/support/global-gates.ts
web/e2e/support/auth.ts
web/e2e/support/billing.ts
```

### Required E2E Modes

```text
1. Fast CI/local: BILLING_PROVIDER=mock
2. Manual/staging integration: BILLING_PROVIDER=xendit_test
```

### Required Test: Mock Full Cycle

```text
Free user login
→ /pricing
→ click Premium Monthly Upgrade
→ redirect to /billing/mock-checkout
→ click Simulate Paid
→ /billing/success
→ poll entitlement
→ premium feature opens
```

### Required Test: Xendit Test Checkout Creation

```text
Free user login
→ /pricing
→ click Premium Monthly Upgrade
→ POST /api/billing/checkout
→ checkoutUrl starts with Xendit-hosted URL or configured Xendit test checkout URL
→ do not automate external Xendit UI by default
```

### Required Test: Webhook Simulation

```text
Call /api/billing/webhook/xendit with fixture payload + correct x-callback-token
→ subscription active
→ duplicate webhook
→ still one subscription activation
```

---

## 10. Validation Commands

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
npx playwright test e2e/smoke/s5x-billing-mock.spec.ts --project=chromium
```

### Optional Staging Xendit Test Mode Smoke

```bash
cd web
PLAYWRIGHT_BASE_URL=https://app.isehat.biz.id \
PLAYWRIGHT_SKIP_WEB_SERVER=true \
BILLING_PROVIDER=xendit_test \
npx playwright test e2e/smoke/s5x-billing-xendit-test.spec.ts --project=chromium
```

---

## 11. Definition of Done

This task is DONE only if:

```text
[ ] Mock billing provider can complete full free → paid cycle.
[ ] Xendit Test Mode checkout can be created.
[ ] Xendit webhook endpoint validates x-callback-token.
[ ] Paid webhook activates HL_subscriptions.
[ ] Duplicate webhook is idempotent.
[ ] /api/me/entitlements changes after payment.
[ ] Paid feature opens after entitlement refresh.
[ ] Billing success page does not trust redirect alone.
[ ] Chromium Playwright mock billing E2E passes.
[ ] Worker tests pass.
[ ] Web typecheck/lint/build pass.
[ ] No secret appears in frontend bundle, response, log, audit metadata, or test snapshots.
[ ] WORK_LOG.md updated.
[ ] HANDOFF.md updated.
```

---

## 12. Agent Execution Prompt

Use this prompt in OpenCode/Codex:

```text
You are implementing S5X-BILLING-XENDIT-TEST-CYCLE for iSehat / HL Health Companion.

Goal:
Enable full-cycle paid feature testing from Free user to Paid entitlement using mock billing provider and Xendit Test Mode.

Read only:
- AGENTS.md
- HANDOFF.md
- WORK_LOG_TAIL.md or latest 120 lines of WORK_LOG.md
- S5X_BILLING_XENDIT_TEST_CYCLE_TASK_PLAN.md
- S5X_BILLING_XENDIT_TEST_CYCLE_TEST_PLAN.md
- Relevant existing billing/entitlement route/service files only

Do not load full PRD/API/Test/Mockup/SQL docs unless blocked.
Use Ponytail: reuse existing billing webhook, entitlement, subscription, audit, and UpgradePrompt code.

Implement in this order:
1. Billing provider interface/factory.
2. Checkout session service/table if no existing equivalent exists.
3. POST /api/billing/checkout.
4. Mock provider + mock checkout UI.
5. Xendit Test provider.
6. Xendit webhook handler or extend existing /api/billing/webhook/:provider.
7. Subscription activation service.
8. Billing frontend pages: /pricing, /billing/success, /billing/cancel, /settings/billing.
9. Playwright Chromium smoke for mock full-cycle.
10. Webhook idempotency tests.

Run validation:
- cd worker && npx tsc -p tsconfig.json && npm test
- cd web && npx tsc -b && npx eslint . && npx vite build
- cd web && npx playwright test e2e/smoke/s5x-billing-mock.spec.ts --project=chromium

Hard rules:
- Do not expose XENDIT_SECRET_KEY or XENDIT_WEBHOOK_TOKEN.
- Do not activate subscription from frontend redirect.
- Only verified webhook activates paid subscription.
- Duplicate webhook must be idempotent.
- If any route/API/UI smoke fails, fix it before marking DONE.

Update WORK_LOG.md and HANDOFF.md. Stop after this task.
```
