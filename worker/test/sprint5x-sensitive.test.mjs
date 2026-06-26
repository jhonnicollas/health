import assert from 'node:assert/strict'
import test from 'node:test'

const { SymptomService } = await import('../dist/services/symptom.js')
const { CycleService } = await import('../dist/services/cycle.js')
const { AiMemoryService, sanitizeMetadata } = await import('../dist/services/ai-memory.js')
const { ConfigService } = await import('../dist/services/config.js')
const { AuditService, toSafeAuditMetadataJson } = await import('../dist/services/audit.js')

test('Symptom red flag safety event uses only severity/title/message, not full description', async () => {
  const redFlags = SymptomService.detectRedFlags('severe chest pain')
  assert.equal(redFlags.detected, true)
  assert.equal(redFlags.flags[0].severity, 'emergency')
  assert.equal(redFlags.flags[0].title, 'Nyeri Dada')
  assert.ok(!redFlags.flags[0].description, 'red flag object must not contain raw description field')
})

test('AiMemoryService sanitizeMetadata redacts sensitive fields', () => {
  const redacted = sanitizeMetadata({ description: 'very sensitive detail', notes: 'private', flowIntensity: 'medium', amountMl: 200 })
  assert.match(redacted.description, /^\[\d+ chars\]$/)
  assert.match(redacted.notes, /^\[\d+ chars\]$/)
  assert.equal(redacted.flowIntensity, 'medium')
  assert.equal(redacted.amountMl, 200)
})

test('Cycle contraception guardrail returns deterministic public message', () => {
  const prediction = CycleService.predictFertileWindow({ lastPeriodStart: '2026-06-01', cycleLengthDays: 28, periodLengthDays: 5 })
  const guardrail = CycleService.checkContraceptionGuardrail({ logDate: '2026-06-14', unprotected: 1 }, prediction)
  assert.equal(guardrail.needsGuardrail, true)
  assert.ok(guardrail.message.includes('Peringatan: Metode kalender'))
  assert.ok(!guardrail.message.includes('private'))
})

test('ConfigService never returns secret value in response', async () => {
  const makeAll = (sql) => ({
    results: sql.includes('HL_systemConfigs')
      ? [{ configKey: 'aiTextApiKey', configValue: 'super-secret-key', dataType: 'string', description: null, updatedAt: '2026-06-26' }]
      : [{ configKey: 'aiTextApiKey', category: 'security', isSecret: 1, storageMode: 'env', envVarName: 'AI_TEXT_API_KEY', masked: 1, readPolicy: 'admin.config.read', writePolicy: 'admin.config.update', description: null, active: 1 }]
  })
  const db = {
    prepare: (sql) => ({
      bind: () => ({ first: async () => null, all: async () => makeAll(sql), run: async () => ({ meta: {} }) }),
      first: async () => null,
      all: async () => makeAll(sql),
      run: async () => ({ meta: {} })
    })
  }
  const list = await ConfigService.list(db, { AI_TEXT_API_KEY: 'env-value' })
  const aiConfig = list.find((c) => c.configKey === 'aiTextApiKey')
  assert.equal(aiConfig.configValue, '')
  assert.equal(aiConfig.masked, true)
  assert.equal(aiConfig.secretValueReturned, false)
})

test('AuditService redacts sensitive keys before writing metadata', async () => {
  const captured = []
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => { captured.push({ sql, args }); return { meta: {} } }
      })
    })
  }
  await AuditService.write(db, {
    userId: 1,
    action: 'config.update',
    entityType: 'HL_systemConfigs',
    entityId: 'telegramBotToken',
    metadataJson: { previousToken: 'abc123', apiKey: 'xyz', safe: 'ok' }
  })
  const metadataArg = captured[0].args[4]
  const parsed = JSON.parse(metadataArg)
  assert.equal(parsed.previousToken, '[REDACTED]')
  assert.equal(parsed.apiKey, '[REDACTED]')
  assert.equal(parsed.safe, 'ok')
})

test('Telegram callback validation does not expose user details for unlinked chat', async () => {
  const { TelegramCallbackService } = await import('../dist/services/telegram-callback.js')
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        run: async () => ({ meta: {} })
      })
    })
  }
  const result = await TelegramCallbackService.validateFullCallback(
    mockDb,
    { TELEGRAM_WATER_WEBHOOK_SECRET: 'sec' },
    { callback_query: { id: 'cbq_123', from: { id: 999888777 }, message: { message_id: 42, chat: { id: 999888777 } }, data: 'ADD_WATER_200' } }
  )
  assert.equal(result.valid, false)
  assert.equal(result.code, 'TELEGRAM_CHAT_NOT_LINKED')
  assert.equal((result).user, undefined)
})
