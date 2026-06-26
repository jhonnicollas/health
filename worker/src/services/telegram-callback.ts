import { TelegramConfigService } from './telegram-config.js'

const VALID_CALLBACK_DATA = ['ADD_WATER_200', 'ADD_WATER_600']

type CallbackQuery = {
  id: string
  from: { id: number }
  message: { message_id: number; chat: { id: number } }
  data: string
}

export type UserLinkInfo = { userId: number; telegramChatId: string; quickAddEnabled: boolean }

export type CallbackValidationResult =
  | { valid: true; user: UserLinkInfo; callbackQueryId: string; chatId: number; messageId: number; amountMl: number }
  | { valid: false; reason: string; code: string; callbackQueryId?: string }

export type IdempotencyResult =
  | { duplicate: true; status: string }
  | { duplicate: false }

export const TelegramCallbackService = {
  validateSecret(env: Record<string, unknown>, headerValue: string | null): boolean {
    const secret = TelegramConfigService.getWebhookSecret(env)
    if (!secret) return false
    return secret === headerValue
  },

  parseCallbackBody(body: unknown): CallbackQuery | null {
    if (!body || typeof body !== 'object') return null
    const b = body as Record<string, unknown>
    const cq = b.callback_query
    if (!cq || typeof cq !== 'object') return null
    const cqo = cq as Record<string, unknown>
    if (typeof cqo.id !== 'string' || typeof cqo.data !== 'string') return null
    const from = cqo.from as Record<string, unknown> | undefined
    if (!from || typeof from.id !== 'number') return null
    const msg = cqo.message as Record<string, unknown> | undefined
    if (!msg || typeof msg.message_id !== 'number') return null
    const chat = msg.chat as Record<string, unknown> | undefined
    if (!chat || typeof chat.id !== 'number') return null
    return { id: cqo.id, from: { id: from.id }, message: { message_id: msg.message_id, chat: { id: chat.id } }, data: cqo.data }
  },

  validateCallbackData(data: string): number | null {
    if (!VALID_CALLBACK_DATA.includes(data)) return null
    return data === 'ADD_WATER_200' ? 200 : 600
  },

  async findUserByChatId(db: D1Database, chatId: number): Promise<UserLinkInfo | null> {
    const settings = await db.prepare(
      `SELECT hs.userId, tl.telegramChatId, hs.telegramQuickAddEnabled
       FROM HL_telegramLinks tl
       JOIN HL_hydrationSettings hs ON hs.userId = tl.userId
       WHERE tl.telegramChatId = ? AND tl.verified = 1 AND tl.enabled = 1`
    ).bind(String(chatId)).first<{ userId: number; telegramChatId: string; telegramQuickAddEnabled: number }>()
    if (!settings) return null
    return { userId: settings.userId, telegramChatId: settings.telegramChatId, quickAddEnabled: !!settings.telegramQuickAddEnabled }
  },

  async checkIdempotency(db: D1Database, callbackQueryId: string): Promise<IdempotencyResult> {
    const existing = await db.prepare(
      'SELECT status FROM HL_telegramCallbackEvents WHERE callbackQueryId = ? LIMIT 1'
    ).bind(callbackQueryId).first<{ status: string }>()
    if (existing) return { duplicate: true, status: existing.status }
    return { duplicate: false }
  },

  async claimCallback(db: D1Database, callbackQueryId: string): Promise<boolean> {
    try {
      await db.prepare(
        `INSERT OR IGNORE INTO HL_telegramCallbackEvents (callbackQueryId, callbackData, eventType, status, createdAt) VALUES (?, '', 'unknown', 'received', CURRENT_TIMESTAMP)`
      ).bind(callbackQueryId).run()
      const row = await db.prepare('SELECT id FROM HL_telegramCallbackEvents WHERE callbackQueryId = ?').bind(callbackQueryId).first<{ id: number }>()
      return !!row
    } catch {
      return false
    }
  },

  async recordCallbackEvent(db: D1Database, event: {
    callbackQueryId: string
    userId: number | null
    telegramChatId: string | null
    telegramMessageId: string | null
    callbackData: string
    eventType: 'hydrationQuickAdd' | 'unknown'
    amountMl: number | null
    status: string
    waterIntakeLogId?: number | null
    rejectionReason?: string | null
    payloadJson?: string | null
  }): Promise<void> {
    await db.prepare(
      `INSERT INTO HL_telegramCallbackEvents
       (callbackQueryId, userId, telegramChatId, telegramMessageId, callbackData, eventType, amountMl, status, waterIntakeLogId, rejectionReason, payloadJson, createdAt, processedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP,
         CASE WHEN ? IN ('processed','rejected','duplicate','failed') THEN CURRENT_TIMESTAMP ELSE NULL END)`
    ).bind(
      event.callbackQueryId,
      event.userId,
      event.telegramChatId,
      event.telegramMessageId,
      event.callbackData,
      event.eventType,
      event.amountMl,
      event.status,
      event.waterIntakeLogId ?? null,
      event.rejectionReason ?? null,
      event.payloadJson ?? null,
      event.status
    ).run()
  },

  async validateFullCallback(
    db: D1Database,
    env: Record<string, unknown>,
    body: unknown
  ): Promise<CallbackValidationResult> {
    const cq = this.parseCallbackBody(body)
    if (!cq) return { valid: false, reason: 'Invalid callback_query format', code: 'INVALID_CALLBACK_FORMAT' }

    const idempotency = await this.checkIdempotency(db, cq.id)
    if (idempotency.duplicate) return { valid: false, reason: `Duplicate callback: ${idempotency.status}`, code: 'TELEGRAM_CALLBACK_DUPLICATE', callbackQueryId: cq.id }

    const amountMl = this.validateCallbackData(cq.data)
    if (!amountMl) return { valid: false, reason: `Invalid callback_data: ${cq.data}`, code: 'INVALID_CALLBACK_DATA', callbackQueryId: cq.id }

    const user = await this.findUserByChatId(db, cq.message.chat.id)
    if (!user) return { valid: false, reason: 'Chat ID not linked to active user', code: 'TELEGRAM_CHAT_NOT_LINKED', callbackQueryId: cq.id }

    if (!user.quickAddEnabled) return { valid: false, reason: 'telegramQuickAddEnabled is disabled', code: 'TELEGRAM_QUICK_ADD_DISABLED', callbackQueryId: cq.id }

    return { valid: true, user, callbackQueryId: cq.id, chatId: cq.message.chat.id, messageId: cq.message.message_id, amountMl }
  }
}
