import { test, expect } from '@playwright/test';

test.describe('S5X Billing Mock', () => {
  test('premium/upgrade page loads', async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://app.isehat.biz.id';
    await page.context().addCookies([{
      name: 'hlSession', value: 'e2e-bill-session',
      domain: new URL(baseUrl).hostname, path: '/', httpOnly: true,
      sameSite: 'Lax' as const, secure: true,
    }]);
    await page.goto('/premium/upgrade', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Premium Bulanan').or(page.locator('text=Upgrade Plan'))).toBeVisible({ timeout: 5000 });
  });

  test('billing success and cancel pages load', async ({ page }) => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://app.isehat.biz.id';
    await page.context().addCookies([{
      name: 'hlSession', value: 'e2e-bill-session',
      domain: new URL(baseUrl).hostname, path: '/', httpOnly: true,
      sameSite: 'Lax' as const, secure: true,
    }]);
    await page.goto('/billing/success', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h2').filter({ hasText: /Pembayaran/i }).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/billing/cancel', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h2').filter({ hasText: /Pembayaran|batal/i }).first()).toBeVisible({ timeout: 10000 });

    await page.goto('/settings/billing', { waitUntil: 'networkidle', timeout: 20000 });
    await expect(page.locator('h2').filter({ hasText: /Billing|Langganan/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('no fatal console errors on billing pages', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'https://app.isehat.biz.id';
    await page.context().addCookies([{
      name: 'hlSession', value: 'e2e-bill-session',
      domain: new URL(baseUrl).hostname, path: '/', httpOnly: true,
      sameSite: 'Lax' as const, secure: true,
    }]);
    await page.goto('/premium/upgrade', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(3000);

    expect(errors).toHaveLength(0);
  });
});
