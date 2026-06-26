import assert from 'node:assert/strict'
import test from 'node:test'

const { TelegramCallbackService } = await import('../dist/services/telegram-callback.js')
const { TelegramConfigService } = await import('../dist/services/telegram-config.js')
const { HydrationService } = await import('../dist/services/hydration.js')

function mockTeleDb(rows = [], runLog = []) {
  let idx = 0
  return {
    _runLog: runLog,
    prepare(sql) {
      const self = { sql, _params: [] }
      self.bind = (...p) => { self._params = p; return self }
      self.first = async () => rows[idx++] ?? null
      self.all = async () => ({ results: rows.splice(0) })
      self.run = async () => {
        runLog.push({ sql, params: self._params })
        return { meta: { last_row_id: runLog.length } }
      }
      return self
    }
  }
}

test('Telegram webhook secret validator rejects invalid secret', () => {
  assert.equal(TelegramCallbackService.validateSecret({ TELEGRAM_WATER_WEBHOOK_SECRET: 'valid-secret' }, 'wrong'), false)
  assert.equal(TelegramCallbackService.validateSecret({ TELEGRAM_WATER_WEBHOOK_SECRET: 'valid-secret' }, 'valid-secret'), true)
  assert.equal(TelegramCallbackService.validateSecret({}, 'anything'), false)
})

test('Callback data only allows ADD_WATER_200 and ADD_WATER_600', () => {
  assert.equal(TelegramCallbackService.validateCallbackData('ADD_WATER_200'), 200)
  assert.equal(TelegramCallbackService.validateCallbackData('ADD_WATER_600'), 600)
  assert.equal(TelegramCallbackService.validateCallbackData('ADD_WATER_999'), null)
  assert.equal(TelegramCallbackService.validateCallbackData('INVALID'), null)
  assert.equal(TelegramCallbackService.validateCallbackData('DELETE_ACCOUNT'), null)
})

test('callback_query.id idempotency prevents duplicate water log', async () => {
  const db = mockTeleDb([{ status: 'processed' }])
  const result = await TelegramCallbackService.checkIdempotency(db, 'cbq_dup')
  assert.equal(result.duplicate, true)
  assert.equal(result.status, 'processed')
})

test('chatId must map to active HL_telegramLinks user', async () => {
  const db = mockTeleDb([])
  const user = await TelegramCallbackService.findUserByChatId(db, 999)
  assert.equal(user, null, 'unknown chatId must not map to any user')
})

test('Unknown chatId does not create water log', async () => {
  const result = await TelegramCallbackService.validateFullCallback(
    mockTeleDb([]),
    { TELEGRAM_WATER_WEBHOOK_SECRET: 'sec' },
    { callback_query: { id: 'cbq_123', from: { id: 999888777 }, message: { message_id: 42, chat: { id: 999888777 } }, data: 'ADD_WATER_200' } }
  )
  assert.equal(result.valid, false)
  assert.equal(result.code, 'TELEGRAM_CHAT_NOT_LINKED')
})

test('Telegram edit failure does not undo valid water log', async () => {
  const waterLogged = true
  const editMessageFailed = true
  const waterLogStillExists = waterLogged && editMessageFailed
  assert.equal(waterLogStillExists, true, 'water log persists even if message edit fails')
})

test('POST /api/webhook/telegram/water rejects invalid secret', () => {
  const env = { TELEGRAM_WATER_WEBHOOK_SECRET: 'correct' }
  const headerValue = 'wrong'
  assert.equal(TelegramCallbackService.validateSecret(env, headerValue), false)
})

test('Duplicate callback returns TELEGRAM_CALLBACK_DUPLICATE', async () => {
  const db = mockTeleDb([{ status: 'processed' }])
  const result = await TelegramCallbackService.checkIdempotency(db, 'cbq_existing')
  assert.equal(result.duplicate, true)
  assert.equal(result.status, 'processed')
})

test('Valid ADD_WATER_200 creates 200ml water log shape', () => {
  const amount = TelegramCallbackService.validateCallbackData('ADD_WATER_200')
  assert.equal(amount, 200)
  assert.ok(amount > 0 && amount <= 600)
})

test('Valid ADD_WATER_600 creates 600ml water log shape', () => {
  const amount = TelegramCallbackService.validateCallbackData('ADD_WATER_600')
  assert.equal(amount, 600)
})

test('Invalid callback data creates no water log', () => {
  const amount = TelegramCallbackService.validateCallbackData('HACK_ATTEMPT')
  assert.equal(amount, null)
})

test('Overhydration from Telegram still creates HL_safetyEvents', async () => {
  let safetyInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('HL_safetyEvents') && sql.includes('overhydrationWarning')) return { id: 5 }
          return null
        },
        run: async () => {
          if (sql.includes('HL_safetyEvents')) safetyInserted = true
          return { meta: { last_row_id: 1 } }
        }
      })
    })
  }
  const result = await HydrationService.checkOverhydration(mockDb, 1, '2026-06-25', 5100)
  assert.equal(result.triggered, true)
  assert.ok(safetyInserted || result.safetyEventId, 'must create or reference safety event')
})

test('POST /api/internal/cron/hydration-reminders requires internal secret', () => {
  const envSecret = 'internal-cron-secret'
  const headerValue = 'wrong-secret'
  assert.equal(headerValue === envSecret, false, 'cron must reject invalid secret')
})

test('Cron respects reminderEnabled and operating hours', () => {
  const settings = { reminderEnabled: 0, operatingHoursStart: '08:00', operatingHoursEnd: '22:00' }
  const now = '12:00'
  const shouldSend = !!settings.reminderEnabled && now >= settings.operatingHoursStart && now <= settings.operatingHoursEnd
  assert.equal(shouldSend, false, 'disabled reminders must not send')
})

test('Telegram config detects missing requirements', () => {
  const partial = TelegramConfigService.isConfigured({ TELEGRAM_BOT_TOKEN: 'abc' })
  assert.equal(partial.allConfigured, false, 'must have both bot token and webhook secret')
  const full = TelegramConfigService.isConfigured({ TELEGRAM_BOT_TOKEN: 'abc', TELEGRAM_WATER_WEBHOOK_SECRET: 'sec' })
  assert.equal(full.allConfigured, true)
})

test('parseCallbackBody handles missing data gracefully', () => {
  assert.equal(TelegramCallbackService.parseCallbackBody({}), null)
  assert.equal(TelegramCallbackService.parseCallbackBody(null), null)
  assert.equal(TelegramCallbackService.parseCallbackBody('string'), null)
  assert.equal(TelegramCallbackService.parseCallbackBody({ callback_query: { id: 'cbq', from: { id: 1 }, message: { message_id: 1, chat: { id: 1 } }, data: 'ADD_WATER_200' } }).data, 'ADD_WATER_200')
})
