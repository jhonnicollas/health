import { test } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /NetworkError/i, /proxy/i, /UNAUTHORIZED/i, /403/i, /Forbidden/i, /aborted/i],
  allowApi404: [/\/api\/dashboard\/daily-health/, /\/api\/me\/entitlements/, /\/api\/dashboard\/comparison/, /\/api\/reports\/daily/],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/dashboard\//, /\/api\/measurements\//, /\/api\/reports\//],
};

test.describe('Sprint 1-4 Regression Smoke — login dashboard measurement report PWA', () => {
  test('consolidated regression smoke — core routes still open after Sprint 5', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'free', page);

    for (const path of ['/dashboard', '/measurements/new', '/measurements/history', '/reports/daily', '/settings/profile']) {
      await page.goto(path);
      await expectAppNotBlank(page);
    }

    await assertNoGlobalFailures();
  });
});
