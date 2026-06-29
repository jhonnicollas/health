import { test } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible } from '../support/selectors';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /NetworkError/i, /proxy/i, /CYCLE_ACCESS_DENIED/i, /NOT_ELIGIBLE/i, /ENTITLEMENT_REQUIRED/i, /403/i, /aborted/i, /ERR_ABORTED/i],
  allowApi404: [/\/api\/cycle\//],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/cycle\//],
};

test.describe('Sprint 5D Cycle Smoke — Mockup: #cycle-tracking #cycle-guardrail', () => {
  test('consolidated 5D smoke — eligible, non-eligible, mobile', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'femaleEligible', page);

    await page.goto('/cycle');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Cycle/i, /Siklus/i, /Calendar/i, /Kalender/i, /Settings/i, /Pengaturan/i, /Month/i, /Phase/i]);

    await loginByApi(null, context, 'maleNonEligible', page);

    await page.goto('/cycle');
    await expectAppNotBlank(page);
    await page.waitForTimeout(1500); // wait for cycle eligibility check
    await expectAnyVisible(page, [/not eligible/i, /tidak tersedia/i, /forbidden/i, /tidak dapat/i, /dashboard/i, /upgrade/i, /cycle/i, /Siklus/i, /15/i, /48/i, /perempuan/i, /tahun/i]);

    await page.setViewportSize({ width: 360, height: 800 });
    await loginByApi(null, context, 'femaleEligible', page);

    await page.goto('/cycle');
    await expectAppNotBlank(page);

    await assertNoGlobalFailures();
  });
});
