import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ConfigService,
  formatConfigForResponse,
  isSensitiveConfigKey
} from '../dist/services/config.js'

class ConfigStatementMock {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.params = []
  }

  bind(...params) {
    this.params = params
    return this
  }

  async first() {
    if (this.sql.includes('FROM HL_systemConfigs')) {
      const row = this.db.configs[this.params[0]]
      return row ? { ...row } : null
    }
    if (this.sql.includes('FROM HL_configMetadata')) {
      const row = this.db.metadata[this.params[0]]
      return row ? { ...row } : null
    }
    return null
  }

  async all() {
    if (this.sql.includes('FROM HL_systemConfigs')) {
      return { results: Object.values(this.db.configs) }
    }
    if (this.sql.includes('FROM HL_configMetadata')) {
      return { results: Object.values(this.db.metadata) }
    }
    return { results: [] }
  }

  async run() {
    if (this.sql.includes('UPDATE HL_systemConfigs')) {
      const [configValue, configKey] = this.params
      this.db.configs[configKey].configValue = configValue
    }
    if (this.sql.includes('INSERT INTO HL_systemConfigs')) {
      const [configKey, configValue, dataType, description] = this.params
      this.db.configs[configKey] = { configKey, configValue, dataType, description, updatedAt: 'now' }
    }
    if (this.sql.includes('INSERT INTO HL_configMetadata')) {
      const [configKey, envVarName] = this.params
      this.db.metadata[configKey] = {
        configKey,
        category: 'security',
        isSecret: 1,
        storageMode: 'env',
        envVarName,
        masked: 1,
        readPolicy: 'admin.config.read',
        writePolicy: 'admin.config.update',
        description: null,
        active: 1
      }
    }
    return { success: true }
  }
}

class ConfigDbMock {
  constructor() {
    this.configs = {
      aiTextApiKey: {
        configKey: 'aiTextApiKey',
        configValue: '',
        dataType: 'string',
        description: 'AI key',
        updatedAt: 'now'
      },
      aiTextDefaultModel: {
        configKey: 'aiTextDefaultModel',
        configValue: 'old-model',
        dataType: 'string',
        description: 'Model',
        updatedAt: 'now'
      }
    }
    this.metadata = {
      aiTextApiKey: {
        configKey: 'aiTextApiKey',
        category: 'ai',
        isSecret: 1,
        storageMode: 'env',
        envVarName: 'AI_TEXT_API_KEY',
        masked: 1,
        readPolicy: 'admin.config.read',
        writePolicy: 'admin.aiConfig.update',
        description: 'Secret',
        active: 1
      }
    }
  }

  prepare(sql) {
    return new ConfigStatementMock(this, sql)
  }
}

test('formatConfigForResponse never returns secret plaintext', () => {
  const row = {
    configKey: 'telegramBotToken',
    configValue: 'plaintext-token',
    dataType: 'string',
    description: 'Token',
    updatedAt: 'now'
  }
  const safe = formatConfigForResponse(row, null, { TELEGRAM_BOT_TOKEN: 'env-token' })

  assert.equal(safe.configValue, '')
  assert.equal(safe.isSecret, true)
  assert.equal(safe.configured, true)
  assert.equal(safe.masked, true)
  assert.equal(safe.envVarName, 'TELEGRAM_BOT_TOKEN')
  assert.equal(safe.secretValueReturned, false)
  assert.equal(JSON.stringify(safe).includes('plaintext-token'), false)
})

test('ConfigService.update stores only marker for secret configs', async () => {
  const db = new ConfigDbMock()
  const safe = await ConfigService.update(db, {}, 'aiTextApiKey', {
    configValue: 'new-plaintext-secret',
    envVarName: 'AI_TEXT_API_KEY'
  })

  assert.equal(db.configs.aiTextApiKey.configValue, 'configured')
  assert.equal(safe.configValue, '')
  assert.equal(JSON.stringify(safe).includes('new-plaintext-secret'), false)
})

test('ConfigService.update keeps normal D1 config editable', async () => {
  const db = new ConfigDbMock()
  const safe = await ConfigService.update(db, {}, 'aiTextDefaultModel', {
    configValue: 'cmc/deepseek/deepseek-v4-pro'
  })

  assert.equal(db.configs.aiTextDefaultModel.configValue, 'cmc/deepseek/deepseek-v4-pro')
  assert.equal(safe.configValue, 'cmc/deepseek/deepseek-v4-pro')
  assert.equal(isSensitiveConfigKey('aiTextDefaultModel'), false)
})
