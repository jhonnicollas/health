import { describe, it } from 'node:test'
import assert from 'node:assert'

const { TelegramConfigService } = await import('../dist/services/telegram-config.js')
const { TelegramClientService } = await import('../dist/services/telegram-client.js')
const { TelegramCallbackService } = await import('../dist/services/telegram-callback.js')

function mockDb(rows = []) {
  const runResults = []
  return {
    _runResults: runResults,
    prepare(sql) {
      const self = { sql, binds: [] }
      self.bind = (...args) => { self.binds = args; return self }
      self.first = async () => rows.shift() ?? null
      self.all = async () => ({ results: rows.splice(0) })
      self.run = async () => { runResults.push({ sql: self.sql, binds: self.binds }); return { meta: { last_row_id: runResults.length } } }
      return self
    }
  }
}

describe('TelegramConfigService', () => {
  it('detects configured bot token', () => {
    const status = TelegramConfigService.isConfigured({ TELEGRAM_BOT_TOKEN: 'abc123', TELEGRAM_WATER_WEBHOOK_SECRET: 'secret' })
    assert.equal(status.botTokenConfigured, true)
    assert.equal(status.webhookSecretConfigured, true)
    assert.equal(status.allConfigured, true)
  })

  it('detects missing token', () => {
    const status = TelegramConfigService.isConfigured({})
    assert.equal(status.allConfigured, false)
  })

  it('returns webhook secret', () => {
    assert.equal(TelegramConfigService.getWebhookSecret({ TELEGRAM_WATER_WEBHOOK_SECRET: 'whsec_test' }), 'whsec_test')
  })

  it('returns empty webhook secret when missing', () => {
    assert.equal(TelegramConfigService.getWebhookSecret({}), '')
  })

  it('returns bot token', () => {
    assert.equal(TelegramConfigService.getBotToken({ TELEGRAM_BOT_TOKEN: 'bot:token' }), 'bot:token')
  })
})

describe('TelegramClientService', () => {
  it('builds inline keyboard', () => {
    const kb = TelegramClientService.buildInlineKeyboard([
      [{ text: '\u{1F6B0}+200ml', callback_data: 'ADD_WATER_200' }],
      [{ text: 'Buka Aplikasi', url: 'https://app.com' }]
    ])
    assert.deepEqual(kb, {
      inline_keyboard: [
        [{ text: '\u{1F6B0}+200ml', callback_data: 'ADD_WATER_200' }],
        [{ text: 'Buka Aplikasi', url: 'https://app.com' }]
      ]
    })
  })
})

describe('TelegramCallbackService', () => {
  it('validateSecret returns true on match', () => {
    assert.equal(TelegramCallbackService.validateSecret({ TELEGRAM_WATER_WEBHOOK_SECRET: 'sec' }, 'sec'), true)
  })

  it('validateSecret returns false on mismatch', () => {
    assert.equal(TelegramCallbackService.validateSecret({ TELEGRAM_WATER_WEBHOOK_SECRET: 'sec' }, 'wrong'), false)
  })

  it('validateSecret returns false when no secret configured', () => {
    assert.equal(TelegramCallbackService.validateSecret({}, 'sec'), false)
  })

  it('parseCallbackBody parses valid Telegram callback', () => {
    const body = {
      callback_query: {
        id: 'cbq_123',
        from: { id: 999888777 },
        message: { message_id: 42, chat: { id: 999888777 } },
        data: 'ADD_WATER_200'
      }
    }
    const cq = TelegramCallbackService.parseCallbackBody(body)
    assert.notEqual(cq, null)
    assert.equal(cq.id, 'cbq_123')
    assert.equal(cq.data, 'ADD_WATER_200')
    assert.equal(cq.message.message_id, 42)
  })

  it('parseCallbackBody returns null on invalid body', () => {
    assert.equal(TelegramCallbackService.parseCallbackBody({}), null)
    assert.equal(TelegramCallbackService.parseCallbackBody('not an object'), null)
    assert.equal(TelegramCallbackService.parseCallbackBody(null), null)
  })

  it('validateCallbackData returns amount for ADD_WATER_200', () => {
    assert.equal(TelegramCallbackService.validateCallbackData('ADD_WATER_200'), 200)
  })

  it('validateCallbackData returns amount for ADD_WATER_600', () => {
    assert.equal(TelegramCallbackService.validateCallbackData('ADD_WATER_600'), 600)
  })

  it('validateCallbackData returns null for invalid data', () => {
    assert.equal(TelegramCallbackService.validateCallbackData('ADD_WATER_999'), null)
    assert.equal(TelegramCallbackService.validateCallbackData('INVALID'), null)
  })

  it('checkIdempotency returns not duplicate for new callback', async () => {
    const result = await TelegramCallbackService.checkIdempotency(mockDb([]), 'cbq_new')
    assert.equal(result.duplicate, false)
  })

  it('checkIdempotency returns duplicate for existing callback', async () => {
    const result = await TelegramCallbackService.checkIdempotency(mockDb([{ status: 'processed' }]), 'cbq_dup')
    assert.equal(result.duplicate, true)
    assert.equal(result.status, 'processed')
  })

  it('findUserByChatId returns null for unknown chat', async () => {
    const user = await TelegramCallbackService.findUserByChatId(mockDb([]), 999)
    assert.equal(user, null)
  })

  it('recordCallbackEvent inserts event', async () => {
    const db = mockDb([])
    await TelegramCallbackService.recordCallbackEvent(db, {
      callbackQueryId: 'cbq_rec',
      userId: 1,
      telegramChatId: '123',
      telegramMessageId: '42',
      callbackData: 'ADD_WATER_200',
      eventType: 'hydrationQuickAdd',
      amountMl: 200,
      status: 'processed'
    })
    assert.equal(db._runResults.length, 1)
    assert.match(db._runResults[0].sql, /INSERT INTO HL_telegramCallbackEvents/)
  })

  it('validateFullCallback rejects invalid format', async () => {
    const result = await TelegramCallbackService.validateFullCallback({}, {}, {})
    assert.equal(result.valid, false)
  })
})
