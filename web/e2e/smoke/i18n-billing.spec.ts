import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'

test.describe('I18N Billing — Bilingual', () => {
  test('premium upgrade page shows Indonesian title', async ({ page }) => {
    await page.goto(`${BASE_URL}/premium/upgrade`)
    // Should show Indonesian title by default
    await expect(page.getByText('Upgrade Plan Anda')).toBeVisible({ timeout: 10000 })
  })

  test('premium upgrade page has comparison table', async ({ page }) => {
    await page.goto(`${BASE_URL}/premium/upgrade`)
    // Comparison table should be visible
    await expect(page.getByText('Perbandingan Fitur')).toBeVisible({ timeout: 10000 })
  })

  test('no raw translation keys on premium page', async ({ page }) => {
    await page.goto(`${BASE_URL}/premium/upgrade`)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/billing\.\w+\s/)
  })
})
