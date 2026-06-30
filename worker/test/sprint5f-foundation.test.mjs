import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { join } from 'node:path'

const { ConfigService } = await import('../dist/services/config.js')
const { AuditService, toSafeAuditMetadataJson } = await import('../dist/services/audit.js')

function mockDb(firstRow = null, runMeta = { last_row_id: 1 }) {
  return {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => firstRow,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: runMeta })
      })
    })
  }
}

test('ConfigService masks secret config values', async () => {
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
  const list = await ConfigService.list(db, { AI_TEXT_API_KEY: 'real-key-from-env' })
  const aiConfig = list.find((c) => c.configKey === 'aiTextApiKey')
  assert.ok(aiConfig)
  assert.equal(aiConfig.configValue, '')
  assert.equal(aiConfig.masked, true)
  assert.equal(aiConfig.secretValueReturned, false)
  assert.equal(aiConfig.configured, true)
  assert.equal(aiConfig.envVarName, 'AI_TEXT_API_KEY')
})

test('ConfigService update for secret stores configured marker only', async () => {
  const captured = []
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => ({ configKey: 'telegramBotToken', configValue: '', dataType: 'string', description: null, updatedAt: '2026-06-26' }),
        all: async () => ({ results: [] }),
        run: async () => {
          captured.push({ sql, args })
          return { meta: { last_row_id: 1 } }
        }
      })
    })
  }
  const updated = await ConfigService.update(db, { TELEGRAM_BOT_TOKEN: 'bot-token' }, 'telegramBotToken', { configured: true, envVarName: 'TELEGRAM_BOT_TOKEN' })
  assert.equal(updated.configValue, '')
  assert.equal(updated.masked, true)
  const updateArgs = captured.find((c) => c.sql.includes('UPDATE HL_systemConfigs'))?.args
  assert.ok(updateArgs)
  assert.equal(updateArgs[0], 'configured')
})

test('ConfigService update for non-secret stores real value', async () => {
  const captured = []
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => ({ configKey: 'appName', configValue: 'Old', dataType: 'string', description: null, updatedAt: '2026-06-26' }),
        all: async () => ({ results: [] }),
        run: async () => { captured.push({ sql, args }); return { meta: { last_row_id: 1 } } }
      })
    })
  }
  const updated = await ConfigService.update(db, {}, 'appName', { configValue: 'iSehat' })
  assert.equal(updated.configValue, 'iSehat')
  const updateArgs = captured.find((c) => c.sql.includes('UPDATE HL_systemConfigs'))?.args
  assert.equal(updateArgs[0], 'iSehat')
})

test('AuditService redacts sensitive keys in metadata', async () => {
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
    entityId: 'aiTextApiKey',
    metadataJson: { previousApiKey: 'abc123', token: 'xyz', nested: { password: 'secret' } }
  })
  const metadataArg = captured[0].args[4]
  const parsed = JSON.parse(metadataArg)
  assert.equal(parsed.previousApiKey, '[REDACTED]')
  assert.equal(parsed.token, '[REDACTED]')
  assert.equal(parsed.nested.password, '[REDACTED]')
})

test('toSafeAuditMetadataJson handles raw JSON string', () => {
  const raw = JSON.stringify({ apiKey: 'leaked', safe: 'ok' })
  const safe = toSafeAuditMetadataJson(raw)
  const parsed = JSON.parse(safe)
  assert.equal(parsed.apiKey, '[REDACTED]')
  assert.equal(parsed.safe, 'ok')
})

test('Source scan: no plaintext API keys/tokens in worker or web source', () => {
  const root = '/home/ubuntu/repositoryGIT/health'
  const files = [
    ...globSync('worker/src/**/*.ts', { cwd: root }),
    ...globSync('web/src/**/*.ts', { cwd: root }),
    ...globSync('web/src/**/*.tsx', { cwd: root })
  ]
  const riskyPatterns = [
    /(?:AI_TEXT_API_KEY|TELEGRAM_BOT_TOKEN|GOOGLE_OAUTH_CLIENT_SECRET|BILLING_WEBHOOK_SECRET)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/,
    /['"]\d{16,}['"]/,
    /sk-[a-zA-Z0-9]{20,}/
  ]
  const hits = []
  for (const file of files) {
    const content = readFileSync(join(root, file), 'utf8')
    for (const pattern of riskyPatterns) {
      if (pattern.test(content)) hits.push(`${file}: ${pattern.source}`)
    }
  }
  assert.deepEqual(hits, [])
})
