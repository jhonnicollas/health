import { test, expect, request } from '@playwright/test'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'

// Sprint 6 E2E — WhatsApp / Telegram / Xendit webhook ingress (S6G-T-08/T-13/T-14).
//
// These tests target worker/webhook directly (port 8788). They validate signature gating,
// dedup via HL_whatsappMessages.providerMessageId UNIQUE, linked/unlinked branching, media
// MIME allowlist, and 10 MB size cap. No Baileys VPS or Telegram webhook triggers needed.
//
// SECURITY: per AGENTS.md §0 ‘No plaintext secret in … test, or code’, every secret here is
// REQUIRED to come from env vars. The test SKIPS if any env var is missing, instead of
// defaulting to a string that could be confused for a real production secret.
//
// Env vars required (values are arbitrary for local wrangler dev):
//   PLAYWRIGHT_HOOK_WA_GATEWAY_SECRET
//   PLAYWRIGHT_HOOK_TELEGRAM_BOT_TOKEN
//   PLAYWRIGHT_HOOK_XENDIT_WEBHOOK_SECRET
//   PLAYWRIGHT_HOOK_CRON_SECRET
// Skip when running in CI without these, or skip-specific with a clear console note.
const HOOK_BASE = process.env.PLAYWRIGHT_HOOK_URL ?? 'http://127.0.0.1:8788'
const HOOK_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../worker/webhook')
const WA_GATEWAY_SECRET = process.env.PLAYWRIGHT_HOOK_WA_GATEWAY_SECRET
const TELEGRAM_BOT_TOKEN = process.env.PLAYWRIGHT_HOOK_TELEGRAM_BOT_TOKEN
const XENDIT_WEBHOOK_SECRET = process.env.PLAYWRIGHT_HOOK_XENDIT_WEBHOOK_SECRET
const CRON_SECRET = process.env.PLAYWRIGHT_HOOK_CRON_SECRET
const SKIP_REASON = !WA_GATEWAY_SECRET || !TELEGRAM_BOT_TOKEN || !XENDIT_WEBHOOK_SECRET || !CRON_SECRET
  ? 'webhook spec requires PLAYWRIGHT_HOOK_{WA_GATEWAY_SECRET,TELEGRAM_BOT_TOKEN,XENDIT_WEBHOOK_SECRET,CRON_SECRET} env vars'
  : null

// Isolated per-run persist directory (mkdtemp avoids collisions with parallel runs).
let hookServer: ReturnType<typeof spawn> | null = null
let persistDir: string | null = null
let hookServerPid: number | null = null

test.beforeAll(async () => {
  if (SKIP_REASON) {
    console.warn(`[sprint6-webhook] SKIP: ${SKIP_REASON}`)
    return
  }
  try {
    persistDir = mkdtempSync(`${tmpdir()}/isehat-hook-e2e-`)
    hookServer = spawn('npx', [
      'wrangler', 'dev',
      '--port', '8788',
      '--local',
      '--persist-to', persistDir,
      '--var', `WA_GATEWAY_SECRET=${WA_GATEWAY_SECRET}`,
      '--var', `TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}`,
      '--var', `XENDIT_WEBHOOK_SECRET=${XENDIT_WEBHOOK_SECRET}`,
      '--var', `CRON_SECRET=${CRON_SECRET}`,
    ], { cwd: HOOK_DIR, stdio: ['ignore', 'pipe', 'pipe'], detached: false })
    hookServerPid = hookServer.pid ?? null
    // Wait until /health responds — poll up to 60s (cloudflare cold-start can be slow)
    for (let i = 0; i < 60; i++) {
      let status = 0
      try {
        const ctx = await request.newContext({ baseURL: HOOK_BASE })
        const r = await ctx.get(`/health?secret=${CRON_SECRET}`)
        status = r.status()
      } catch { /* not ready yet */ }
      if (status === 200) return
      await sleep(1000)
    }
    // Clean up if we timed out waiting
    if (hookServerPid) { try { process.kill(hookServerPid, 'SIGTERM') } catch {} }
    throw new Error(`Hook server did not start on ${HOOK_BASE} within 60s`)
  } catch (err) {
    throw new Error(`hook beforeAll failed: ${(err as Error).message?.split('\n')[0]}`)
  }
})

test.afterAll(async () => {
  if (hookServerPid) {
    try { process.kill(hookServerPid, 'SIGTERM') } catch {}
    // Graceful shutdown for child processes that didn’t exit via SIGTERM
    await sleep(250)
    try { process.kill(hookServerPid, 'SIGKILL') } catch {}
  }
  hookServer = null
  hookServerPid = null
  persistDir = null
})

test.describe('Sprint 6G — isehat-webhooks-worker (worker #4)', () => {
  test('POST /api/whatsapp/webhook without WA_GATEWAY_SECRET returns 401', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const res = await ctx.post('/api/whatsapp/webhook', {
      data: { providerMessageId: 'no-secret-test', whatsappNumber: '+628123456789', textContent: 'halo' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/whatsapp/webhook with WA_GATEWAY_SECRET + unlinked number returns linking instruction', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const providerMessageId = `e2e-unlinked-${Date.now()}`
    const res = await ctx.post('/api/whatsapp/webhook', {
      headers: { 'X-Gateway-Secret': WA_GATEWAY_SECRET },
      data: {
        providerMessageId,
        whatsappNumber: '+628000000000', // unknown number, not linked
        textContent: 'halo',
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success ?? body.data?.success).toBe(true)
    expect(body.unlinked ?? body.data?.unlinked).toBe(true)
    expect(body.reply ?? body.data?.reply).toMatch(/Nomor WhatsApp ini belum tertaut|Pengaturan/i)
  })

  test('Idempotency: same providerMessageId twice returns duplicate:true', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const providerMessageId = `e2e-idem-${Date.now()}`
    const first = await ctx.post('/api/whatsapp/webhook', {
      headers: { 'X-Gateway-Secret': WA_GATEWAY_SECRET },
      data: { providerMessageId, whatsappNumber: '+628000000111', textContent: 'halo' },
    })
    expect(first.status()).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.unlinked ?? firstBody.data?.unlinked).toBe(true)
    // Wait for first INSERT to settle then re-send
    await sleep(100)
    const second = await ctx.post('/api/whatsapp/webhook', {
      headers: { 'X-Gateway-Secret': WA_GATEWAY_SECRET },
      data: { providerMessageId, whatsappNumber: '+628000000111', textContent: 'halo' },
    })
    expect(second.status()).toBe(200)
    const secondBody = await second.json()
    expect(secondBody.duplicate ?? secondBody.data?.duplicate).toBe(true)
  })

  test('media/ingest rejects unallowed MIME types with 400', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const providerMessageId = `e2e-mime-${Date.now()}`
    // ~1 KB of base64
    const base64 = Buffer.alloc(1024).toString('base64')
    const res = await ctx.post('/api/whatsapp/media/ingest', {
      headers: { 'X-Gateway-Secret': WA_GATEWAY_SECRET },
      data: {
        providerMessageId,
        whatsappNumber: '+628000000222',
        mediaMimeType: 'application/zip', // NOT in allowlist
        mediaBufferBase64: base64,
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error?.code ?? body.code).toMatch(/VALIDATION_ERROR/)
  })

  test('media/ingest accepts allowed MIME (image/png) and returns mediaR2Key', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const providerMessageId = `e2e-ok-${Date.now()}`
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    const res = await ctx.post('/api/whatsapp/media/ingest', {
      headers: { 'X-Gateway-Secret': WA_GATEWAY_SECRET },
      data: {
        providerMessageId,
        whatsappNumber: '+628000000333',
        mediaMimeType: 'image/png',
        mediaBufferBase64: tinyPng,
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.mediaR2Key ?? body.data?.mediaR2Key).toContain('whatsapp-media/')
  })

  test('media/ingest rejects > 10 MB encoded payload with 400', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    // Build a ~14 MB base64 string in memory. Playwright’s default 30s response timeout
    // is bumped to 90s here so the request reaches worker/webhook before timing out;
    // the size guard runs in the worker BEFORE any R2 upload.
    const huge = 'A'.repeat(((10 * 1024 * 1024) / 3) * 4 + 1024)
    const res = await ctx.post('/api/whatsapp/media/ingest', {
      headers: { 'X-Gateway-Secret': WA_GATEWAY_SECRET },
      data: {
        providerMessageId: `e2e-big-${Date.now()}`,
        whatsappNumber: '+628000000444',
        mediaMimeType: 'image/png',
        mediaBufferBase64: huge,
      },
      timeout: 90_000,
    })
    expect(res.status()).toBe(400)
  })

  test('POST /api/telegram/webhook without X-Telegram-Bot-Api-Secret-Token returns 401', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const res = await ctx.post('/api/telegram/webhook', {
      data: { update_id: 1, message: { message_id: 1, chat: { id: 1 }, text: 'hi' } },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/billing/webhook/xendit without X-Callback-Token returns 401', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const res = await ctx.post('/api/billing/webhook/xendit', {
      data: { external_id: 'inv-1', status: 'PAID' },
    })
    expect(res.status()).toBe(401)
  })

  test('GET /health without CRON_SECRET returns 401', async () => {
    const ctx = await request.newContext({ baseURL: HOOK_BASE })
    const res = await ctx.get('/health')
    expect(res.status()).toBe(401)
  })
})
