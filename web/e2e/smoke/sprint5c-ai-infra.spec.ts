import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible, expectNoSecretLikeText } from '../support/selectors';

const GATE_OPTS = {
  allowConsoleError: [/entitlements/i, /quota/i, /Failed to fetch/i, /NetworkError/i, /proxy/i],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/],
};

test.describe('Sprint 5C AI Infrastructure Smoke — Mockup: #ai-clinical-infra #ai-memory #context-package #sprint6-ready', () => {
  test('consolidated 5C smoke — AI memory page, no active AI doctor, no secrets', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS);
    await loginByApi(null, context, 'premium', page);

    await page.goto('/ai-memory');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/AI/i, /Memory/i, /Clinical/i, /Infrastructure/i, /Sprint/i, /Readiness/i, /Vector/i, /Status/i]);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/AI dokter aktif/i);
    expect(bodyText).not.toMatch(/diagnosis pasti/i);
    expect(bodyText).not.toMatch(/resep obat/i);

    await expectNoSecretLikeText(page);
    await assertNoGlobalFailures();
  });

  test('clinicalCopilotMode true is deferred in Sprint 5', async ({ page, context }) => {
    await loginByApi(null, context, 'premium', page);

    // Navigate to a page first to establish the origin for relative fetch URLs
    await page.goto('/ai-memory');
    // Use page.evaluate to carry browser cookies in the fetch
    const text = await page.evaluate(async () => {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'test clinical copilot mode', clinicalCopilotMode: true }),
      });
      return await res.text();
    }) as string;
    expect(text).toMatch(/AI_CLINICAL_COPILOT_DEFERRED|deferred_to_sprint6|UNAUTHORIZED|401|403/i);
  });
});
