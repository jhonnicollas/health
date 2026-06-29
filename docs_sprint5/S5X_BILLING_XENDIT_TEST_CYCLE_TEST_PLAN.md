# S5X-BILLING-XENDIT-TEST-CYCLE — Test Plan

```text
Product: iSehat / HL Health Companion
Document Type: Test Plan
Task ID: S5X-BILLING-XENDIT-TEST-CYCLE
Version: 1.0 READY FOR AI AGENT EXECUTION
Scope: Mock billing provider, Xendit Test Mode checkout creation, Xendit webhook verification, subscription activation, entitlement refresh, frontend paid upgrade flow, and Chromium-only E2E smoke.
```

---

## 1. Test Goals

This test plan proves that a customer can upgrade from Free to Paid in a safe test environment:

```text
Free user
→ paid feature blocked
→ UpgradePrompt
→ /pricing
→ checkout created
→ mock payment or Xendit Test Mode payment
→ verified webhook
→ subscription active
→ entitlements paid
→ premium feature opens
```

This test plan also proves that payment security is not bypassed:

```text
- Frontend redirect cannot activate subscription.
- Invalid webhook token cannot activate subscription.
- Duplicate webhook cannot double-activate subscription.
- Amount/currency/plan mismatch cannot activate subscription.
- Secrets are not exposed.
```

---

## 2. Test Modes

## 2.1 Fast Local/CI Mode — Mock Provider

```text
BILLING_PROVIDER=mock
XENDIT_MODE=test
```

Purpose:

```text
- Runs fast.
- Does not call Xendit.
- Can be automated in Playwright.
- Must be required for every release gate.
```

## 2.2 Staging Integration Mode — Xendit Test Mode

```text
BILLING_PROVIDER=xendit_test
XENDIT_MODE=test
```

Purpose:

```text
- Calls Xendit Test Mode.
- Creates a real Xendit-hosted test checkout/payment link.
- Receives or simulates Xendit webhook payload.
- Does not require Xendit Live Mode or completed business verification.
```

## 2.3 Live Mode — Explicitly Out of Scope

```text
BILLING_PROVIDER=xendit_live
XENDIT_MODE=live
```

Live mode is blocked until business verification is complete and production secrets are set.

---

## 3. Required Test Data

Use synthetic users only:

```text
free.user+billing@example.test
premium.user+billing@example.test
admin.billing@example.test
```

Required plans from seed or existing DB:

```text
free
premiumMonthly
premiumQuarterly
premiumYearly
familyPremium
```

Never use:

```text
real customer email
real patient data
real card/payment data
real Xendit secret key in test fixture
real webhook token in test fixture
```

Use placeholder env only:

```text
TEST_XENDIT_SECRET_KEY_PLACEHOLDER
TEST_XENDIT_WEBHOOK_TOKEN_PLACEHOLDER
```

---

## 4. Unit Test Suite

## 4.1 Billing Config Tests

```text
[ ] BILLING_PROVIDER=mock selects MockBillingProvider.
[ ] BILLING_PROVIDER=xendit_test selects Xendit provider in test mode.
[ ] xendit_test without XENDIT_SECRET_KEY returns safe config error.
[ ] webhook verification without XENDIT_WEBHOOK_TOKEN rejects webhook.
[ ] xendit_live is blocked unless XENDIT_MODE=live.
[ ] Config formatter never returns secret values.
```

## 4.2 Checkout Session Service Tests

```text
[ ] Creates pending checkout session for active paid plan.
[ ] Rejects invalid planCode.
[ ] Rejects inactive planCode.
[ ] Rejects free plan checkout if plan amount is 0.
[ ] Amount is read from HL_plans, not request body.
[ ] merchantRef is unique.
[ ] providerCheckoutId and checkoutUrl can be attached.
[ ] markPaid is idempotent.
[ ] user can only read own checkout session.
```

## 4.3 Mock Provider Tests

```text
[ ] Mock provider returns /billing/mock-checkout URL.
[ ] Mock provider does not call external API.
[ ] Mock paid webhook activates subscription.
[ ] Duplicate mock paid webhook does not double-activate.
[ ] Mock webhook disabled when BILLING_PROVIDER is not mock unless test override exists.
```

## 4.4 Xendit Provider Tests

Use mocked `fetch`, not real Xendit, in unit tests.

```text
[ ] Xendit provider sends request to configured XENDIT_BASE_URL.
[ ] Request includes external_id/merchantRef.
[ ] Request includes amount and currency.
[ ] Request includes payer email.
[ ] Request includes success/failure redirect URLs.
[ ] Response invoice_url/checkout URL is mapped to checkoutUrl.
[ ] Response id is mapped to providerCheckoutId.
[ ] Xendit API error is converted to safe application error.
[ ] Authorization header is never logged.
```

## 4.5 Subscription Activation Tests

```text
[ ] Paid monthly plan creates active subscription.
[ ] Paid quarterly plan creates correct period end.
[ ] Paid yearly plan creates correct period end.
[ ] Paid family plan creates active family subscription if supported.
[ ] Duplicate provider event does not create duplicate subscription.
[ ] Existing active plan replacement follows existing project policy.
[ ] Disabled plan cannot be activated.
[ ] /api/me/entitlements returns paid features after activation.
```

---

## 5. API Contract Tests

## 5.1 POST /api/billing/checkout

```text
[ ] Missing session returns 401.
[ ] Invalid planCode returns 400.
[ ] Free/non-payable plan returns 400.
[ ] Active paid plan creates pending checkout.
[ ] Response envelope is standard success/data/meta.
[ ] checkoutUrl exists.
[ ] amount/currency match server-side plan.
[ ] HL_billingCheckoutSessions row created.
[ ] HL_paymentEvents checkout.created row created.
[ ] HL_auditLogs billing.checkout.created row created.
[ ] Response does not contain Xendit secret or webhook token.
```

## 5.2 POST /api/billing/webhook/mock

```text
[ ] Disabled outside mock/test mode.
[ ] Missing checkoutId/merchantRef rejected.
[ ] Valid mock paid event activates subscription.
[ ] Duplicate mock paid event returns success but no double activation.
[ ] Failed mock event does not activate subscription.
```

## 5.3 POST /api/billing/webhook/xendit

```text
[ ] Missing x-callback-token returns 403.
[ ] Invalid x-callback-token returns 403.
[ ] Malformed body returns 400.
[ ] Unknown merchantRef is safely handled and audited.
[ ] Amount mismatch rejected and audited.
[ ] Currency mismatch rejected and audited.
[ ] Provider event duplicate is idempotent.
[ ] Paid/settled/succeeded status activates subscription.
[ ] Pending status does not activate subscription.
[ ] Failed/expired/cancelled status does not activate subscription.
[ ] rawPayloadJson is sanitized.
[ ] Response contains no secret.
```

## 5.4 GET /api/billing/my-subscription

```text
[ ] Missing session returns 401.
[ ] Free user sees free/current status.
[ ] Paid user sees active plan.
[ ] User cannot see other user's subscription.
[ ] Response contains period start/end.
```

## 5.5 GET /api/billing/checkout/:checkoutId

```text
[ ] Missing session returns 401.
[ ] User can read own checkout session.
[ ] User cannot read another user's checkout session.
[ ] Pending/paid/failed/expired statuses are returned correctly.
```

## 5.6 GET /api/me/entitlements

```text
[ ] Free user before payment does not have premium feature enabled.
[ ] After verified paid webhook, premium feature becomes enabled.
[ ] Entitlement response includes quota/remaining/resetAt where applicable.
```

---

## 6. Frontend Smoke Tests

## 6.1 /pricing

```text
[ ] Page loads without blank screen.
[ ] Free plan visible.
[ ] Premium Monthly visible.
[ ] Premium Quarterly visible if seeded.
[ ] Premium Yearly visible.
[ ] Family Premium visible if seeded.
[ ] Upgrade button visible for paid plan.
[ ] Current plan badge visible if user already paid.
[ ] Loading state visible during fetch.
[ ] Error state visible if API fails.
[ ] Mobile 360px usable.
[ ] No console error.
[ ] No /api/* 404 or 5xx.
```

## 6.2 UpgradePrompt

```text
[ ] Free user opening paid feature sees UpgradePrompt.
[ ] CTA goes to /pricing.
[ ] Paid user does not see UpgradePrompt for same feature.
```

## 6.3 /billing/mock-checkout

```text
[ ] Page displays plan name.
[ ] Page displays amount/currency.
[ ] Simulate Paid button visible.
[ ] Click Simulate Paid calls mock webhook.
[ ] Success redirects to /billing/success.
[ ] No console error.
[ ] No /api/* 404 or 5xx.
```

## 6.4 /billing/success

```text
[ ] Does not immediately assume paid from redirect.
[ ] Shows pending state while subscription pending.
[ ] Polls /api/billing/my-subscription or /api/me/entitlements.
[ ] Shows paid active state after webhook activation.
[ ] CTA opens premium feature.
[ ] Mobile 360px usable.
```

## 6.5 /billing/cancel

```text
[ ] Explains payment was not completed.
[ ] Does not activate subscription.
[ ] CTA returns to /pricing.
```

## 6.6 /settings/billing

```text
[ ] Current plan displayed.
[ ] Current period displayed for paid user.
[ ] Payment status displayed.
[ ] Recent invoice/payment rows displayed if available.
[ ] No secret or raw webhook payload displayed.
```

---

## 7. Playwright E2E — Chromium Only

## 7.1 Global Failure Gate

Every Playwright spec must attach global gates:

```text
console.error = FAIL
pageerror = FAIL
/api/* 404 = FAIL
/api/* >=500 = FAIL
important requestfailed = FAIL
```

## 7.2 Required Spec Files

```text
web/e2e/smoke/s5x-billing-mock.spec.ts
web/e2e/smoke/s5x-billing-xendit-test.spec.ts
```

## 7.3 Mock Full-Cycle E2E

Test name:

```text
S5X Billing Mock — free user upgrades to paid and unlocks premium feature
```

Steps:

```text
1. Login as free user.
2. Open a premium-gated route or component.
3. Assert UpgradePrompt appears.
4. Click Upgrade.
5. Assert /pricing opens.
6. Click Premium Monthly Upgrade.
7. Assert redirected to /billing/mock-checkout.
8. Click Simulate Paid.
9. Assert redirected to /billing/success.
10. Poll /api/me/entitlements.
11. Assert premiumMonthly or paid entitlement is active.
12. Open the previously blocked premium feature.
13. Assert feature opens without UpgradePrompt.
14. Assert no console/network failure.
```

Acceptance:

```text
[ ] PASS in Chromium.
```

## 7.4 Xendit Test Checkout Creation E2E

Test name:

```text
S5X Billing Xendit Test — checkout URL is created in Test Mode
```

Steps:

```text
1. Login as free user.
2. Open /pricing.
3. Click Premium Monthly Upgrade.
4. Intercept POST /api/billing/checkout response.
5. Assert provider=xendit.
6. Assert mode=test.
7. Assert checkoutUrl exists.
8. Assert checkoutUrl is external Xendit-hosted URL or configured test checkout URL.
9. Do not automate Xendit external UI by default.
10. Assert no console/network failure.
```

Acceptance:

```text
[ ] PASS in Chromium on staging or local with mocked Xendit fetch.
```

## 7.5 Xendit Webhook Simulation Integration

This can run as API test or Playwright `request` test.

Steps:

```text
1. Create checkout session with xendit_test provider.
2. Send fixture paid webhook to /api/billing/webhook/xendit with valid x-callback-token.
3. Assert 200/202 success.
4. Fetch /api/me/entitlements.
5. Assert paid feature enabled.
6. Send same webhook again.
7. Assert no duplicate subscription and no double period extension.
```

Acceptance:

```text
[ ] PASS.
```

---

## 8. Security Tests

```text
[ ] XENDIT_SECRET_KEY never appears in API response.
[ ] XENDIT_WEBHOOK_TOKEN never appears in API response.
[ ] XENDIT_SECRET_KEY never appears in frontend bundle.
[ ] XENDIT_WEBHOOK_TOKEN never appears in frontend bundle.
[ ] Audit metadata does not include Authorization header.
[ ] Audit metadata does not include x-callback-token.
[ ] Raw webhook payload is sanitized.
[ ] Billing checkout cannot be created for another userId.
[ ] Frontend cannot request arbitrary amount.
[ ] Frontend cannot activate subscription directly.
[ ] Success redirect alone does not activate subscription.
[ ] Invalid webhook token cannot activate subscription.
```

Suggested secret scan:

```bash
rg -n "XENDIT_SECRET_KEY|XENDIT_WEBHOOK_TOKEN|xnd_|secret|callback-token" web/dist worker/src worker/test web/e2e
```

Expected:

```text
Only placeholder variable names may appear. No real secret values.
```

---

## 9. Idempotency and Data Integrity Tests

```text
[ ] Same providerEventId received twice creates only one processed payment event.
[ ] Same merchantRef paid twice does not create duplicate subscription.
[ ] Paid after expired follows policy: reject or handle safely.
[ ] Failed after paid does not downgrade active subscription unless refund/cancellation policy explicitly supports it.
[ ] Expired pending checkout remains expired and does not activate.
[ ] FK check remains clean.
```

Database validation:

```bash
wrangler d1 execute multi_Ai_db --local --command="PRAGMA foreign_key_check;"
```

Expected:

```text
0 rows
```

---

## 10. Manual Xendit Test Mode Full-Cycle Checklist

Use only Xendit Test Mode.

```text
[ ] Xendit dashboard is in Test Mode.
[ ] XENDIT_SECRET_KEY uses Test Mode key.
[ ] XENDIT_WEBHOOK_TOKEN configured as Cloudflare secret.
[ ] Webhook URL is configured:
    https://app.isehat.biz.id/api/billing/webhook/xendit
[ ] Login as free user on staging.
[ ] Open /pricing.
[ ] Click Upgrade Premium Monthly.
[ ] Xendit checkout/payment link opens.
[ ] Complete/simulate payment in Xendit Test Mode.
[ ] Xendit sends webhook to iSehat.
[ ] HL_paymentEvents row recorded.
[ ] HL_subscriptions row active.
[ ] /api/me/entitlements shows premium enabled.
[ ] Premium feature opens.
[ ] Duplicate webhook replay is safe.
```

---

## 11. Required Commands

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

### Playwright Mock Billing

```bash
cd web
npx playwright test e2e/smoke/s5x-billing-mock.spec.ts --project=chromium
```

### Playwright Xendit Test Checkout

```bash
cd web
PLAYWRIGHT_BASE_URL=https://app.isehat.biz.id \
PLAYWRIGHT_SKIP_WEB_SERVER=true \
BILLING_PROVIDER=xendit_test \
npx playwright test e2e/smoke/s5x-billing-xendit-test.spec.ts --project=chromium
```

---

## 12. Release Gate

S5X-BILLING-XENDIT-TEST-CYCLE cannot be marked DONE unless:

```text
[ ] Worker tsc PASS.
[ ] Worker tests PASS.
[ ] Web tsc PASS.
[ ] Web eslint PASS.
[ ] Web build PASS.
[ ] Chromium Playwright mock full-cycle PASS.
[ ] Xendit Test Mode checkout creation PASS.
[ ] Xendit webhook token validation PASS.
[ ] Paid webhook activates subscription PASS.
[ ] Duplicate webhook idempotency PASS.
[ ] /api/me/entitlements updates after payment PASS.
[ ] Premium feature opens after paid PASS.
[ ] Secret scan PASS.
[ ] WORK_LOG.md updated.
[ ] HANDOFF.md updated.
```

---

## 13. Bug Classification

```text
BLOCKER:
- subscription activates without verified webhook
- invalid webhook token activates subscription
- Xendit secret appears in frontend/response/log
- duplicate webhook double-activates subscription
- /api/me/entitlements does not update after payment

P0:
- checkout creation fails for valid paid plan
- paid user still sees UpgradePrompt after activation
- success page trusts redirect without polling server
- amount/currency mismatch not validated

P1:
- billing history UI incomplete
- pricing copy/layout mismatch
- mobile 360px layout issue not blocking payment
```
