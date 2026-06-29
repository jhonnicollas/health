import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { HydrationService } from './services/hydration.js'
import { TelegramConfigService } from './services/telegram-config.js'
import { TelegramClientService } from './services/telegram-client.js'
import { TelegramCallbackService } from './services/telegram-callback.js'
import { AuditService } from './services/audit.js'

const APP_URL = 'https://d11e4d6e.hl-health-companion.pages.dev'

interface LocalEnv { DB: D1Database; TELEGRAM_BOT_TOKEN?: string; TELEGRAM_WATER_WEBHOOK_SECRET?: string }
type HC = Context<{ Bindings: LocalEnv }>
function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now(), metaExtra?: Record<string, unknown>) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s, ...metaExtra } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

function base64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const h = `sha256:${base64Url(buf)}`
  const row = await c.env.DB.prepare('SELECT s.userId FROM HL_sessions s JOIN HL_users u ON u.id = s.userId WHERE s.sessionTokenHash = ? AND s.revokedAt IS NULL AND s.expiresAt > datetime("now") AND u.active = 1').bind(h).first<any>()
  return row?.userId || null
}

async function createSafetyEvent(db: D1Database, userId: number, sourceId: string, eventType: string, severity: string, title: string, message: string): Promise<void> {
  const existing = await db.prepare("SELECT id FROM HL_safetyEvents WHERE userId = ? AND eventType = ? AND sourceId = ? LIMIT 1").bind(userId, eventType, sourceId).first<any>()
  if (existing) return
  await db.prepare("INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, 'telegram', ?, ?, ?, ?, ?, 'queued', CURRENT_TIMESTAMP)").bind(userId, sourceId, eventType, severity, title, message).run()
}

const REMINDER_BUTTONS = [[
  { text: '🚰 +200ml', callback_data: 'ADD_WATER_200' },
  { text: '💧 +600ml', callback_data: 'ADD_WATER_600' }
], [
  { text: 'Buka Aplikasi', url: APP_URL }
]]

export function mountTelegramRoutes(app: any) {
  // S5E-003: Telegram water webhook (no session, validated by callback service)
  app.post('/api/webhook/telegram/water', async (c: HC) => {
    const s = Date.now()
    try {
      const secretHeader = c.req.header('X-HL-Telegram-Water-Secret') || ''
      if (!TelegramCallbackService.validateSecret(c.env as any, secretHeader)) {
        await AuditService.write(c.env.DB, { userId: null, action: 'telegram.webhook.rejected', entityType: 'HL_telegramCallbackEvents', entityId: 'unknown', metadataJson: { reason: 'invalid_secret' } })
        return jr(c, fail('TELEGRAM_WEBHOOK_FORBIDDEN', 'Telegram webhook tidak valid.', 403, [], s), 403)
      }

      const body = await c.req.json()
      const validation = await TelegramCallbackService.validateFullCallback(c.env.DB, c.env as any, body)

      if (!validation.valid) {
        const cq = TelegramCallbackService.parseCallbackBody(body)
        if (validation.code === 'TELEGRAM_CALLBACK_DUPLICATE') {
          return jr(c, ok({ callbackQueryId: validation.callbackQueryId, duplicate: true, processed: false, message: 'Callback already processed. No duplicate water log inserted.' }, 200, s, { warningCode: 'TELEGRAM_CALLBACK_DUPLICATE' }), 200)
        }
        await TelegramCallbackService.recordCallbackEvent(c.env.DB, {
          callbackQueryId: validation.callbackQueryId || cq?.id || 'unknown',
          userId: null,
          telegramChatId: cq?.message?.chat?.id != null ? String(cq.message.chat.id) : null,
          telegramMessageId: cq?.message?.message_id != null ? String(cq.message.message_id) : null,
          callbackData: cq?.data || 'unknown',
          eventType: 'unknown',
          amountMl: null,
          status: 'rejected',
          rejectionReason: validation.reason
        })
        if (validation.code === 'TELEGRAM_CHAT_NOT_LINKED' || validation.code === 'INVALID_CALLBACK_DATA') {
          await AuditService.write(c.env.DB, { userId: null, action: 'telegram.webhook.rejected', entityType: 'HL_telegramCallbackEvents', entityId: validation.callbackQueryId || 'unknown', metadataJson: { reason: validation.reason, code: validation.code } })
        }
        return jr(c, fail('TELEGRAM_WEBHOOK_FORBIDDEN', validation.reason, 403, [], s), 403)
      }

      // Process the callback
      const { user, callbackQueryId, chatId, messageId, amountMl } = validation

      // Atomically claim the callback ID before processing to prevent race conditions
      const claimed = await TelegramCallbackService.claimCallback(c.env.DB, callbackQueryId)
      if (!claimed) {
        return jr(c, ok({ callbackQueryId, duplicate: true, processed: false, message: 'Callback already processed. No duplicate water log inserted.' }, 200, s, { warningCode: 'TELEGRAM_CALLBACK_DUPLICATE' }), 200)
      }

      const dateStr = new Date().toISOString().slice(0, 10)
      const logId = await HydrationService.logWater(c.env.DB, user.userId, amountMl, 'telegram', undefined, `Via Telegram: ${callbackQueryId}`)

      await c.env.DB.prepare('UPDATE HL_waterIntakeLogs SET telegramCallbackId = ?, telegramMessageId = ? WHERE id = ?')
        .bind(callbackQueryId, String(messageId), logId).run()

      // Recalculate total/target
      const target = await HydrationService.getOrCalculateTarget(c.env.DB, user.userId, dateStr)
      const logs = await HydrationService.getTodayLogs(c.env.DB, user.userId, dateStr)
      const totalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)

      // Check overhydration
      const overCheck = await HydrationService.checkOverhydration(c.env.DB, user.userId, dateStr, totalMl)

      // Update Telegram message with progress
      const token = TelegramConfigService.getBotToken(c.env as any)
      let telegramMessageEdited = false
      if (token) {
        const messageText = `Sudahkah Anda minum air yang cukup hari ini?\nTotal: ${totalMl} / ${target.targetMl} ml.`
        const editResult = await TelegramClientService.editMessageText(token, String(chatId), messageId, messageText, TelegramClientService.buildInlineKeyboard(REMINDER_BUTTONS as any))
        telegramMessageEdited = editResult.ok
      }

      // Record callback event
      await TelegramCallbackService.recordCallbackEvent(c.env.DB, {
        callbackQueryId,
        userId: user.userId,
        telegramChatId: user.telegramChatId,
        telegramMessageId: String(messageId),
        callbackData: amountMl === 200 ? 'ADD_WATER_200' : 'ADD_WATER_600',
        eventType: 'hydrationQuickAdd',
        amountMl,
        status: 'processed',
        waterIntakeLogId: logId
      })

      // Answer callback query to stop Telegram from retrying
      if (token) { try { await TelegramClientService.answerCallbackQuery(token, callbackQueryId) } catch {} }

      return jr(c, ok({
        callbackQueryId,
        addedMl: amountMl,
        totalMl,
        targetMl: target.targetMl,
        overhydrationWarning: overCheck.triggered,
        telegramMessageEdited,
        waterIntakeLogId: logId
      }, 200, s), 200)
    } catch (e: any) {
      console.error('webhook error:', e)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500)
    }
  })

  // Legacy alias — backward compat
  app.post('/api/telegram/water-webhook', async (c: HC) => { return c.redirect('/api/webhook/telegram/water', 307) })

  // S5E-005: Hydration reminder cron route
  app.post('/api/internal/cron/hydration-reminders', async (c: HC) => {
    const s = Date.now()
    try {
      const internalSecret = (c.env as any).INTERNAL_API_SECRET || ''
      const header = c.req.header('X-HL-Internal-Cron-Secret') || c.req.header('authorization') || ''
      if (internalSecret && header !== internalSecret) return jr(c, fail('UNAUTHORIZED', 'Invalid secret.', 401, [], s), 401)

      const body = await c.req.json().catch(() => ({})) as { runAt?: string; dryRun?: boolean }
      const runAt = body.runAt || new Date().toISOString()
      const dryRun = !!body.dryRun
      const hour = new Date(runAt).getUTCHours().toString().padStart(2, '0') + ':00'

      const users = await c.env.DB.prepare(`
        SELECT hs.userId, hs.telegramQuickAddEnabled, tl.telegramChatId
        FROM HL_hydrationSettings hs
        JOIN HL_telegramLinks tl ON tl.userId = hs.userId
        WHERE hs.enabled = 1 AND hs.reminderEnabled = 1 AND hs.operatingStart <= ? AND hs.operatingEnd >= ?
          AND tl.verified = 1 AND tl.enabled = 1 AND hs.telegramQuickAddEnabled = 1
      `).bind(hour, hour).all<any>()

      const token = TelegramConfigService.getBotToken(c.env as any)
      let sent = 0; let skipped = 0; let failed = 0

      for (const u of users.results || []) {
        if (!u.telegramChatId) { skipped++; continue }
        if (dryRun) { skipped++; continue }
        const dateStr = new Date(runAt).toISOString().slice(0, 10)
        const target = await HydrationService.getOrCalculateTarget(c.env.DB, u.userId, dateStr)
        const logs = await HydrationService.getTodayLogs(c.env.DB, u.userId, dateStr)
        const totalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)
        const messageText = `Sudahkah Anda minum air yang cukup hari ini?\nTotal: ${totalMl} / ${target.targetMl} ml.`

        if (token) {
          const result = await TelegramClientService.sendMessage(token, u.telegramChatId, messageText, TelegramClientService.buildInlineKeyboard(REMINDER_BUTTONS as any))
          if (result.ok) {
            sent++
            try {
              await c.env.DB.prepare(
                "INSERT INTO HL_notifications (userId, channel, notificationType, title, message, status, createdAt) VALUES (?, 'telegram', 'hydrationReminder', ?, ?, 'sent', CURRENT_TIMESTAMP)"
              ).bind(u.userId, 'Pengingat Hidrasi', messageText).run()
            } catch {}
          } else { failed++ }
        } else { failed++ }
      }

      return jr(c, ok({ runAt, eligibleUsers: users.results?.length || 0, sent, skipped, failed, dryRun }, 200, s), 200)
    } catch (e) { console.error('cron error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })
}
