import { test, expect } from '@playwright/test'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
const IS_LOCAL = BASE.includes('localhost') || BASE.includes('127.0.0.1')
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates'
import { expectNoSecretLikeText } from '../support/selectors'

const GATE_OPTS = {
  // 400 is expected when /api/auth/register/verify receives an intentionally invalid OTP.
  // Other 4xx (401, 403) are also expected from auth endpoints with missing/closed sessions.
  // The gate strips a noise filter for HTTP load failures, not a regression assertion filter.
  allowConsoleError: [/Failed to fetch/i, /NetworkError/i, /proxy/i, /400/i, /401/i, /403/i, /aborted/i, /ERR_ABORTED/i, /sesi/i],
  allowApi404: [/\/api\/dev\/test-email-outbox/],
  allowFailedApiRequests: [/\/api\/dev\/test-email-outbox/, /\/api\/auth/],
}

test.describe('Auth Email OTP', () => {
  if (!IS_LOCAL) {
    test.skip('OTP tests require local email test infrastructure', () => {})
    return
  }
  test('register: shows OTP step after form submit', async ({ page }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)

    await page.goto('/register')
    await expectAppNotBlank(page)

    await page.fill('input[name="email"]', 'e2e-otp@test.example')
    await page.fill('input[name="password"]', 'StrongPass123')
    await page.fill('input[name="displayName"]', 'E2E User')
    await page.click('button[type="submit"]')

    await expect(page.getByText('Verifikasi Email')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/\*{1,}@test\.example/)).toBeVisible()

    await expectNoSecretLikeText(page)
    await assertNoGlobalFailures()
  })

  test('register: valid OTP creates session and redirects', async ({ page }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)

    await page.goto('/register')
    await expectAppNotBlank(page)

    await page.fill('input[name="email"]', 'e2e-verify@test.example')
    await page.fill('input[name="password"]', 'StrongPass123')
    await page.fill('input[name="displayName"]', 'E2E Verify')
    await page.click('button[type="submit"]')

    await expect(page.getByText('Verifikasi Email')).toBeVisible({ timeout: 10_000 })

    const outboxRes = await page.request.get('/api/dev/test-email-outbox/latest?email=e2e-verify@test.example')
    if (outboxRes.ok()) {
      const outbox = await outboxRes.json()
      const otp: string | undefined = outbox.data?.otp
      if (otp) {
        for (let i = 0; i < 6; i++) {
          await page.fill(`input[aria-label="Digit ${i + 1}"]`, otp[i])
        }
        await page.click('button:has-text("Verifikasi")')
        await expect(page).toHaveURL(/\/(onboarding|dashboard)/, { timeout: 15_000 })
        await expectNoSecretLikeText(page)
      }
    }

    await assertNoGlobalFailures()
  })

  test('register: invalid OTP shows error', async ({ page }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)

    await page.goto('/register')
    await expectAppNotBlank(page)

    await page.fill('input[name="email"]', 'e2e-invalid@test.example')
    await page.fill('input[name="password"]', 'StrongPass123')
    await page.fill('input[name="displayName"]', 'E2E Invalid')
    await page.click('button[type="submit"]')

    await expect(page.getByText('Verifikasi Email')).toBeVisible({ timeout: 10_000 })

    for (let i = 0; i < 6; i++) {
      await page.fill(`input[aria-label="Digit ${i + 1}"]`, '0')
    }
    await page.click('button:has-text("Verifikasi")')

    await expect(page.getByText(/tidak valid|gagal/i)).toBeVisible({ timeout: 10_000 })
    await assertNoGlobalFailures()
  })

  test('login: shows OTP step after form submit', async ({ page }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)

    await page.goto('/login')
    await expectAppNotBlank(page)

    await page.fill('input[name="email"]', 'e2e-login@test.example')
    await page.fill('input[name="password"]', 'StrongPass123')
    await page.click('button[type="submit"]')

    await expect(page.getByText('Verifikasi Email')).toBeVisible({ timeout: 10_000 })
    await assertNoGlobalFailures()
  })

  test('google oauth button visible on login page', async ({ page }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)

    await page.goto('/login')
    await expectAppNotBlank(page)

    const googleBtn = page.locator('a[href*="/api/auth/google"]')
    await expect(googleBtn).toBeVisible()
    await expect(googleBtn).toContainText(/Google/i)

    await expectNoSecretLikeText(page)
    await assertNoGlobalFailures()
  })
})
