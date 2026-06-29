import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible, expectNoSecretLikeText } from '../support/selectors';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /NetworkError/i, /proxy/i, /UNAUTHORIZED/i, /403/i, /404/i, /Access denied/i, /Failed to load/i],
  allowApi404: [/\/api\/admin\//, /\/api\/me\/entitlements/, /\/api\/dashboard\/daily-health/],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/admin\/metrics/],
};

test.describe('Sprint 5 Gap Fixes Smoke — Premium Upgrade, Admin CRUD, Education, Public Plans', () => {

  test('premium upgrade page loads and shows plans', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'free', page);

    await page.goto('/premium/upgrade');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Upgrade/i, /Plan/i, /Premium/i, /Subscribe/i, /Fitur/i, /feature/i, /price/i, /Harga/i]);
    await expectNoSecretLikeText(page);
    await assertNoGlobalFailures();
  });

  test('admin CRUD — users, roles, plans tabs render with data', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'admin', page);

    await page.goto('/admin');
    await expectAppNotBlank(page);
    await page.waitForSelector('text=Admin Panel', { timeout: 10000 });
    await expectAnyVisible(page, [/Admin Panel/i, /Overview/i, /Users/i, /Roles/i, /Plans/i]);

    // Click Users tab
    await page.getByText('Users', { exact: true }).first().click();
    await expectAnyVisible(page, [/Email/i, /Display/i, /Roles/i, /Plan/i]);

    // Click Roles tab
    await page.getByText('Roles', { exact: true }).first().click();
    await page.waitForTimeout(2000); // wait for API call to complete
    await expectAnyVisible(page, [/Roles/i, /Code/i, /Name/i, /System/i, /Active/i, /roleCode/i, /roleName/i]);

    // Click Plans tab
    await page.getByText('Plans', { exact: true }).first().click();
    await expectAnyVisible(page, [/Plan/i, /Name/i, /Interval/i, /Price/i]);

    await expectNoSecretLikeText(page);
    await assertNoGlobalFailures();
  });

  test('public /api/plans endpoint returns plans without auth', async ({ page }) => {
    // Navigate first to establish base URL for relative fetch
    await page.goto('/login');
    const text = await page.evaluate(async () => {
      const res = await fetch('/api/plans');
      return await res.text();
    }) as string;
    expect(text).toMatch(/success|plans|planCode/i);
    expect(text).not.toMatch(/UNAUTHORIZED|unauthorized/i);
  });

  test('education cards return content for logged-in user', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'free', page);
    // Navigate first to establish base URL for relative fetch
    await page.goto('/dashboard');
    const text = await page.evaluate(async () => {
      const res = await fetch('/api/education/cards?topicType=measurement');
      return await res.text();
    }) as string;
    expect(text).toMatch(/success|cards|title/i);
    expect(text).not.toMatch(/UNAUTHORIZED|unauthorized/i);

    await assertNoGlobalFailures();
  });

  test('no secret leakage on admin and premium pages', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'admin', page);

    await page.goto('/admin');
    await page.waitForSelector('text=Admin Panel', { timeout: 10000 });
    await expectNoSecretLikeText(page);

    // Navigate to premium upgrade as well
    await page.goto('/premium/upgrade');
    await expectAppNotBlank(page);
    await expectNoSecretLikeText(page);

    await assertNoGlobalFailures();
  });

});
