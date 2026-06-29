import { test } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible, expectNoSecretLikeText } from '../support/selectors';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /NetworkError/i, /proxy/i, /UNAUTHORIZED/i, /403/i],
  allowApi404: [/\/api\/admin\//, /\/api\/dashboard\/daily-health/, /\/api\/me\/entitlements/],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/admin\//],
};

test.describe('Foundation Admin Smoke — Mockup: #foundation-admin #admin-users-roles #admin-plans #admin-ai-config #admin-audit', () => {
  test('admin and access control browser smoke', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);

    // Test 1: admin can open admin page
    await loginByApi(null, context, 'admin', page);
    await page.goto('/admin');
    await expectAppNotBlank(page);
    // Wait for AdminPage shell to mount (sidebar always renders regardless of API status)
    await page.waitForSelector('text=Admin Panel', { timeout: 10000 });
    await expectAnyVisible(page, [/Admin Panel/i, /Admin Area/i, /Overview/i, /Users/i, /Roles/i, /Plans/i]);
    await expectNoSecretLikeText(page);

    // Test 2: admin page content visible  
    await expectAnyVisible(page, [/Admin Panel/i, /Overview/i, /Users/i, /Roles/i, /Plans/i]);

    // Clear cookies for free user
    await context.clearCookies();

    // Test 3: free user sees fallback
    await loginByApi(null, context, 'free', page);
    await page.goto('/admin');
    await expectAppNotBlank(page);
    // Wait for auth state to settle (Pages CDN cold-start can delay SPA hydration)
    await page.waitForTimeout(3000);
    // Free user either sees admin but forbidden, or gets redirected
    const bodyText = await page.locator('body').innerText();
    const hasDashboard = /Dashboard|Good/i.test(bodyText);
    const hasForbidden = /forbidden|unauthorized|access denied|tidak memiliki akses|403/i.test(bodyText);
    if (!hasDashboard && !hasForbidden) {
      throw new Error(`Free user on /admin: expected dashboard or forbidden text, got: ${bodyText.slice(0, 200)}`);
    }

    await assertNoGlobalFailures();
  });
});
