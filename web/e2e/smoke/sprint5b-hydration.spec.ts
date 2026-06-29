import { test } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible } from '../support/selectors';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /NetworkError/i, /proxy/i, /UNAUTHORIZED/i, /403/i, /aborted/i, /ERR_ABORTED/i],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/hydration\//, /\/api\/education\//],
};

test.describe('Sprint 5B Hydration Smoke — Mockup: #hydration-tracker #daily-health-hub', () => {
  test('consolidated 5B smoke — hydration, settings, history, mobile', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'free', page);

    await page.goto('/hydration');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Hydration/i, /Hidrasi/i, /200/i, /600/i, /Custom/i, /Target/i, /ml/i, /water/i]);

    for (const path of ['/hydration/settings', '/hydration/history']) {
      await page.goto(path);
      await expectAppNotBlank(page);
    }

    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/hydration');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/200/i, /600/i, /Custom/i, /Target/i, /ml/i, /water/i]);

    await assertNoGlobalFailures();
  });
});
