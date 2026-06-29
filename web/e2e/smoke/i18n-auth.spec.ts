import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'

test.describe('I18N Auth — Bilingual', () => {
  test('login page shows Indonesian by default', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    // Indonesian title should be visible
    await expect(page.getByText('Masuk ke catatan kesehatan')).toBeVisible({ timeout: 10000 })
  })

  test('login page switches to English', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    // Click language switcher
    const switcher = page.locator('button:has-text("Indonesia")').first()
    if (await switcher.isVisible()) {
      await switcher.click()
      await page.getByText('English').click()
      // English title should appear
      await expect(page.getByText('Sign in to your health log')).toBeVisible({ timeout: 5000 })
    }
  })

  test('register page shows Indonesian', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await expect(page.getByText('Buat akun baru')).toBeVisible({ timeout: 10000 })
  })

  test('no raw translation keys visible on login page', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    const bodyText = await page.locator('body').innerText()
    // Should not contain raw key patterns like "auth.loginTitle"
    expect(bodyText).not.toMatch(/auth\.\w+/)
    expect(bodyText).not.toMatch(/common\.\w+/)
  })
})
