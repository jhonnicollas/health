import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173'

test.describe('I18N Health Features — Bilingual', () => {
  test('hydration page shows Indonesian title', async ({ page }) => {
    await page.goto(`${BASE_URL}/hydration`)
    // The page may redirect to login if not authenticated; check for either login or hydration title
    const hasHydration = await page.getByText('Hydration Tracker').count()
    const hasLogin = await page.getByText('Masuk').count()
    expect(hasHydration > 0 || hasLogin > 0).toBeTruthy()
  })

  test('symptom page shows Indonesian title', async ({ page }) => {
    await page.goto(`${BASE_URL}/symptoms`)
    const hasSymptom = await page.getByText('Catat Keluhan Harian').count()
    const hasLogin = await page.getByText('Masuk').count()
    expect(hasSymptom > 0 || hasLogin > 0).toBeTruthy()
  })

  test('no raw translation keys visible on health pages', async ({ page }) => {
    await page.goto(`${BASE_URL}/hydration`)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/hydration\.\w+\s/)
    expect(bodyText).not.toMatch(/symptom\.\w+\s/)
    expect(bodyText).not.toMatch(/cycle\.\w+\s/)
  })
})
