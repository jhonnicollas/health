import { test, expect, request } from '@playwright/test'
import { loginByApi } from '../support/auth'
import { attachGlobalFailureGates } from '../support/global-gates'

// Sprint 6 E2E — WhatsApp linking flow (PRD §8.1, §8.3; S6G-T-07).
//
// These tests cover worker/apps/src/routes-whatsapp.ts end-to-end without requiring the
// Baileys VPS / WhatsApp Cloud API. They use direct API calls so they're hermetic — at
// least until the spec needs the routed AI worker, in which case we rely on the proxy
// graceful-degradation path.
const WORKER_BASE = (process.env.PLAYWRIGHT_WORKER_URL ?? 'http://127.0.0.1:8787') as string
const GATE_OPTS = {
  allowConsoleError: [/Failed to fetch/i, /NetworkError/i, /proxy/i],
  allowFailedApiRequests: [/\/api\/me\/entitlements/, /\/api\/auth\/me/, /\/api\/ai\//],
}

function assertWaGatewayCookie(context: any) {
  const cookies = context.cookies()
  const v = cookies.find((c: any) => c.name === 'hlSession')
  expect(v?.value, 'expected hlSession cookie after loginByApi').toBeTruthy()
  return v as { name: string; value: string }
}

test.describe('Sprint 6G — WhatsApp linking flow', () => {
  test('POST /api/whatsapp/link/start returns linkId + 6-digit OTP for valid E.164', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)
    await loginByApi(null, context, 'premium', page)
    const cookie = assertWaGatewayCookie(context)
    const ctx = await request.newContext({ baseURL: WORKER_BASE })
    const res = await ctx.post('/api/whatsapp/link/start', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { whatsappNumber: '+628123456789' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toBeTruthy()
    expect(body.data?.linkId ?? body.linkId).toBeTruthy()
    const otp = body.data?.otp ?? body.otp
    expect(typeof otp).toBe('string')
    expect(otp).toMatch(/^\d{6}$/)
    await assertNoGlobalFailures()
  })

  test('link/start rejects invalid E.164 with 400 VALIDATION_ERROR', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)
    await loginByApi(null, context, 'premium', page)
    const cookie = assertWaGatewayCookie(context)
    const ctx = await request.newContext({ baseURL: WORKER_BASE })
    for (const bad of ['08123456789', '+abc', '   ', '+123']) {
      const res = await ctx.post('/api/whatsapp/link/start', {
        headers: { Cookie: `hlSession=${cookie.value}` },
        data: { whatsappNumber: bad },
      })
      expect(res.status()).toBe(400)
      const body = await res.json()
      expect(body.error?.code ?? body.code).toMatch(/VALIDATION_ERROR/)
    }
    await assertNoGlobalFailures()
  })

  test('OTP verify with wrong code returns 400 OTP_INVALID', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)
    await loginByApi(null, context, 'premium', page)
    const cookie = assertWaGatewayCookie(context)
    const ctx = await request.newContext({ baseURL: WORKER_BASE })
    const start = await ctx.post('/api/whatsapp/link/start', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { whatsappNumber: '+628999000111' },
    })
    const startBody = await start.json()
    const linkId = startBody.data?.linkId ?? startBody.linkId
    const wrong = await ctx.post('/api/whatsapp/link/verify', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { linkId, otp: '000000' },
    })
    expect(wrong.status()).toBe(400)
    const wrongBody = await wrong.json()
    expect(wrongBody.error?.code ?? wrongBody.code).toMatch(/OTP_INVALID/)
    await assertNoGlobalFailures()
  })

  test('OTP verify is one-time use: second verify returns OTP_ALREADY_USED', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)
    await loginByApi(null, context, 'premium', page)
    const cookie = assertWaGatewayCookie(context)
    const ctx = await request.newContext({ baseURL: WORKER_BASE })
    const start = await ctx.post('/api/whatsapp/link/start', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { whatsappNumber: '+628999000222' },
    })
    const startBody = await start.json()
    const linkId = startBody.data?.linkId ?? startBody.linkId
    const otp = startBody.data?.otp ?? startBody.otp
    // First verify succeeds
    const ok = await ctx.post('/api/whatsapp/link/verify', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { linkId, otp },
    })
    expect(ok.status()).toBe(200)
    // Second verify with same OTP — atomic CAS via UPDATE...WHERE otpHash=? must yield 0 changes
    // so the route surfaces OTP_ALREADY_USED even though the OTP itself was correct.
    const again = await ctx.post('/api/whatsapp/link/verify', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { linkId, otp },
    })
    expect(again.status()).toBe(400)
    const againBody = await again.json()
    expect(againBody.error?.code ?? againBody.code).toMatch(/OTP_ALREADY_USED/)
    await assertNoGlobalFailures()
  })

  test('GET /api/whatsapp/status returns linked=true after successful verify', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)
    await loginByApi(null, context, 'premium', page)
    const cookie = assertWaGatewayCookie(context)
    const ctx = await request.newContext({ baseURL: WORKER_BASE })
    // re-link
    await ctx.post('/api/whatsapp/link/start', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { whatsappNumber: '+628999000333' },
    })
    const reStart = await ctx.post('/api/whatsapp/link/start', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { whatsappNumber: '+628999000333' },
    })
    const b = await reStart.json()
    await ctx.post('/api/whatsapp/link/verify', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { linkId: b.data?.linkId ?? b.linkId, otp: b.data?.otp ?? b.otp },
    })
    const status = await ctx.get('/api/whatsapp/status', {
      headers: { Cookie: `hlSession=${cookie.value}` },
    })
    expect(status.status()).toBe(200)
    const statusBody = await status.json()
    const data = statusBody.data ?? statusBody
    expect(data.linked).toBe(true)
    expect(data.verified).toBe(true)
    expect(data.aiEnabled).toBe(true)
    await assertNoGlobalFailures()
  })

  test('DELETE /api/whatsapp/link sets aiEnabled=0/verified=0 (PRD §8.3 STOP AI semantics)', async ({ page, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, GATE_OPTS)
    await loginByApi(null, context, 'premium', page)
    const cookie = assertWaGatewayCookie(context)
    const ctx = await request.newContext({ baseURL: WORKER_BASE })
    // ensure there's a link first
    await ctx.post('/api/whatsapp/link/start', {
      headers: { Cookie: `hlSession=${cookie.value}` },
      data: { whatsappNumber: '+628999000444' },
    })
    const del = await ctx.delete('/api/whatsapp/link', {
      headers: { Cookie: `hlSession=${cookie.value}` },
    })
    expect(del.status()).toBe(200)
    const status = await ctx.get('/api/whatsapp/status', {
      headers: { Cookie: `hlSession=${cookie.value}` },
    })
    const statusBody = await status.json()
    const data = statusBody.data ?? statusBody
    expect(data.linked).toBe(true) // row remains for future re-link
    expect(data.verified).toBe(false)
    expect(data.aiEnabled).toBe(false)
    await assertNoGlobalFailures()
  })

  test('link/start is rate-limited after 5/hour per user', async ({ page, context }) => {
    await loginByApi(null, context, 'premium', page)
    const cookie = assertWaGatewayCookie(context)
    const ctx = await request.newContext({ baseURL: WORKER_BASE })
    let lastStatus = 0
    for (let i = 0; i < 7; i++) {
      const r = await ctx.post('/api/whatsapp/link/start', {
        headers: { Cookie: `hlSession=${cookie.value}` },
        data: { whatsappNumber: `+628${String(900000000 + i).padStart(9, '0')}` },
      })
      lastStatus = r.status()
      if (r.status() === 429) break
    }
    expect(lastStatus).toBe(429)
  })
})
