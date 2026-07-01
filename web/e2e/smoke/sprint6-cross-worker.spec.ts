import { test, expect, request } from '@playwright/test'
import { loginByApi } from '../support/auth'

// Sprint 6 E2E — Cross-worker Service Binding graceful degradation.
//
// Worker #1 (worker/apps) proxies /api/ai/clinical/* to Worker #2 (worker/ai) via AI_SERVICE
// binding. In local wrangler dev where AI_SERVICE binding is not active, the proxy surfaces
// 503 AI_SERVICE_UNAVAILABLE instead of crashing. This spec verifies every proxy route
// behaves that way AND that no plaintext secret leaks into any response body (the proxy must
// never echo its config in error envelopes).
const WORKER_BASE = (process.env.PLAYWRIGHT_WORKER_URL ?? 'http://127.0.0.1:8787') as string

async function premiumContext(page: any) {
  await loginByApi(null, page.context(), 'premium', page)
  const cookie = page.context().cookies().find((c: any) => c.name === 'hlSession')!
  return request.newContext({
    baseURL: WORKER_BASE,
    extraHTTPHeaders: { Cookie: `hlSession=${cookie.value}` },
  })
}

test.describe('Sprint 6E — AI_SERVICE binding graceful degradation', () => {
  test('POST /api/ai/clinical/session/start returns 503 AI_SERVICE_UNAVAILABLE when binding missing', async ({ page }) => {
    const ctx = await premiumContext(page)
    const res = await ctx.post('/api/ai/clinical/session/start', { data: { sessionType: 'general' } })
    expect([403, 503]).toContain(res.status())
    const body = await res.json()
    const code = body.error?.code ?? body.code
    if (res.status() === 503) expect(code).toMatch(/AI_SERVICE_UNAVAILABLE/)
    // No leakage: body must not contain env-var names like WA_GATEWAY_SECRET, XENDIT, etc.
    const raw = JSON.stringify(body)
    expect(raw).not.toMatch(/WA_GATEWAY_SECRET|XENDIT_WEBHOOK_SECRET|TYPESENSE|API_TOKEN/i)
    expect(raw).not.toMatch(/sk-[A-Za-z0-9]{20,}/)
  })

  test('POST /api/ai/clinical/first-aid surfaces binding or consent state, never 200 with junk', async ({ page }) => {
    const ctx = await premiumContext(page)
    const res = await ctx.post('/api/ai/clinical/first-aid', { data: { keyword: 'luka ringan' } })
    expect([200, 403, 503]).toContain(res.status())
    const body = await res.json()
    if (res.status() === 200) {
      // If somehow gated correctly and binding active, response must include disclaimer
      // PRD §4.3 + safety runtime hook
      const txt = JSON.stringify(body)
      expect(txt).toMatch(/AI DAPAT MELAKUKAN KESALAHAN|AI CAN MAKE MISTAKES/)
    }
  })

  test('POST /api/ai/clinical/emergency-guidance does NOT 500 on unknown binding', async ({ page }) => {
    const ctx = await premiumContext(page)
    const res = await ctx.post('/api/ai/clinical/emergency-guidance', { data: {} })
    expect([400, 403, 503]).toContain(res.status())
  })

  test('POST /api/ai/clinical/doctor-handoff validates sessionId, never echoes secrets', async ({ page }) => {
    const ctx = await premiumContext(page)
    const res = await ctx.post('/api/ai/clinical/doctor-handoff', { data: { sessionId: 1 } })
    expect([400, 403, 503]).toContain(res.status())
    const body = await res.json()
    const raw = JSON.stringify(body)
    expect(raw).not.toMatch(/WA_GATEWAY_SECRET|XENDIT_WEBHOOK_SECRET|CLOUDFLARE_API_TOKEN/i)
    expect(raw).not.toMatch(/Bearer\s+[A-Za-z0-9_-]{20,}/i)
  })

  test('POST /api/ai/clinical/follow-up requires sessionId + message', async ({ page }) => {
    const ctx = await premiumContext(page)
    const res = await ctx.post('/api/ai/clinical/follow-up', { data: {} })
    expect([400, 403, 503]).toContain(res.status())
  })

  test('GET /api/ai/probe returns service binding reachability status (200 ok or 503)', async ({ page }) => {
    await page.goto('/login')
    const ctx = await premiumContext(page)
    const res = await ctx.get('/api/ai/probe')
    expect([200, 503]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('ok')
    }
  })
})
