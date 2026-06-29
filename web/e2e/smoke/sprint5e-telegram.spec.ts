import { test } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible, expectNoSecretLikeText } from '../support/selectors';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /NetworkError/i, /proxy/i, /aborted/i, /ERR_ABORTED/i],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/telegram\//, /\/api\/hydration\//],
};

test.describe('Sprint 5E Telegram Smoke — Mockup: #telegram-hydration #hydration-tracker', () => {
  test('consolidated 5E smoke — telegram settings, hydration settings, no secrets', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'premium', page);

    await page.goto('/telegram');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Telegram/i, /Linked/i, /Not linked/i, /Terhubung/i, /Belum/i, /Reminder/i, /Settings/i, /Status/i]);
    await expectNoSecretLikeText(page);

    await page.goto('/hydration/settings');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Telegram/i, /Reminder/i, /Quick/i, /Hidrasi/i, /Hydration/i, /Target/i]);
    await expectNoSecretLikeText(page);

    await assertNoGlobalFailures();
  });
});
