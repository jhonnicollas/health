import { test } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible } from '../support/selectors';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /Failed to load resource/i, /NetworkError/i, /proxy/i, /UNAUTHORIZED/i, /Sesi tidak valid/i, /401/i, /403/i, /aborted/i, /ERR_ABORTED/i],
  allowApi404: [/\/api\/dashboard\/daily-health/, /\/api\/me\/entitlements/],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/dashboard\//, /\/api\/education\//],
};

test.describe('Sprint 5A Smoke — Mockup: #google-oauth #daily-health-hub #education-layer #symptom-logger #red-flag-flow #history-integration', () => {
  test('consolidated 5A smoke — login, daily hub, symptoms, mobile', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);

    await page.goto('/login');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Google/i, /Email/i, /Password/i, /Masuk/i, /Login/i]);

    await loginByApi(null, context, 'free', page);

    await page.goto('/dashboard');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Today/i, /Hari ini/i, /Health/i, /Kesehatan/i, /Dashboard/i, /Good/i]);

    await page.goto('/symptoms');
    await expectAppNotBlank(page);
    await page.waitForTimeout(1500); // wait for SymptomPage to render
    await expectAnyVisible(page, [/Symptom/i, /Keluhan/i, /Nyeri/i, /Pain/i, /Ringa/i, /Sedang/i, /Berat/i, /Catat/i, /symptom/i, /Gejala/i, /Health/i]);

    await page.setViewportSize({ width: 360, height: 800 });
    for (const path of ['/dashboard', '/symptoms', '/measurements/history']) {
      await page.goto(path);
      await expectAppNotBlank(page);
    }

    await assertNoGlobalFailures();
  });
});
