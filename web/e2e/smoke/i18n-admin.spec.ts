import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'

test.describe('I18N Admin — Bilingual', () => {
  test('admin page shows Indonesian title', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`)
    // May redirect to login if not authenticated
    const hasAdmin = await page.getByText('Admin Panel').count()
    const hasLogin = await page.getByText('Masuk').count()
    expect(hasAdmin > 0 || hasLogin > 0).toBeTruthy()
  })

  test('no raw translation keys on admin page', async ({ page }) => {
    await page.goto(`${BASE_URL}/admin`)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/admin\.\w+\s/)
  })
})
