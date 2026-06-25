import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { HydrationService } from './services/hydration.js'
interface LocalEnv { DB: D1Database; TELEGRAM_BOT_TOKEN?: string }
type HC = Context<{ Bindings: LocalEnv }>
function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const h = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  const row = await c.env.DB.prepare('SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND revokedAt IS NULL AND expiresAt > datetime("now")').bind(h).first<any>()
  return row?.userId || null
}

export function mountSprint5ERoutes(app: any) {
  // Telegram water webhook (no session, signature validated by internal secret)
  app.post('/api/webhook/telegram/water', async (c: HC) => {
    const s = Date.now()
    try {
      const secret = (c.env as any).INTERNAL_API_SECRET || ''
      const sig = c.req.header('x-webhook-signature') || ''
      if (secret && sig !== secret) return c.json({ ok: false, error: 'invalid signature' })
      const body = await c.req.json() as { userId?: number; amountMl?: number; loggedAt?: string; notes?: string; callbackQueryId?: string }
      if (!body.userId || !body.amountMl) return c.json({ ok: false, error: 'userId and amountMl required' })
      const logId = await HydrationService.logWater(c.env.DB, body.userId, body.amountMl, 'telegram', body.loggedAt, body.notes || 'Via Telegram')
      if (body.callbackQueryId) {
        try {
          const token = c.env.TELEGRAM_BOT_TOKEN || (c.env as any).TELEGRAM_BOT_TOKEN || ''
          if (token) await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ callback_query_id: body.callbackQueryId, text: '✅ Air dicatat!' }) })
        } catch {}
      }
      return c.json({ ok: true, data: { logId } })
    } catch (e) { return c.json({ ok: false, error: String(e) }) }
  })

  // Legacy alias — backward compat
  app.post('/api/telegram/water-webhook', async (c: HC) => { return c.json({ ok: true, message: 'Use /api/webhook/telegram/water' }, 301) })

  // Cron: send hydration reminders (internal endpoint)
  app.post('/api/internal/cron/hydration-reminders', async (c: HC) => {
    const s = Date.now()
    try {
      const secret = (c.env as any).INTERNAL_API_SECRET || (c.env as any).CRON_SECRET || ''
      const header = c.req.header('x-cron-secret') || c.req.header('authorization') || ''
      if (!header.includes(secret)) return jr(c, fail('UNAUTHORIZED', 'Invalid secret.', 401, [], s), 401)
      const hour = new Date().getUTCHours().toString().padStart(2, '0') + ':00'
      const users = await c.env.DB.prepare(`
        SELECT hs.userId, tl.telegramChatId FROM HL_hydrationSettings hs 
        JOIN HL_telegramLinks tl ON tl.userId = hs.userId 
        WHERE hs.enabled = 1 AND hs.reminderEnabled = 1 AND hs.operatingStart <= ? AND hs.operatingEnd >= ? AND tl.verified = 1 AND tl.enabled = 1
      `).bind(hour, hour).all<any>()
      const token = c.env.TELEGRAM_BOT_TOKEN || ''
      let sent = 0
      for (const u of users.results || []) {
        if (u.telegramChatId) {
          try { await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: u.telegramChatId, text: '💧 Waktunya minum air! Catat asupan Anda.', reply_markup: { inline_keyboard: [[{ text: '💧 +200ml', callback_data: 'ADD_WATER_200' }, { text: '🥤 +600ml', callback_data: 'ADD_WATER_600' }]] } }) }); sent++ } catch {}
        }
      }
      return jr(c, ok({ usersFound: users.results?.length || 0, remindersSent: sent }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })
}
