import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AuditService,
  sanitizeAuditMetadata,
  toSafeAuditMetadataJson
} from '../dist/services/audit.js'

class AuditStatementMock {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.params = []
  }

  bind(...params) {
    this.params = params
    return this
  }

  async run() {
    this.db.rows.push({ sql: this.sql, params: this.params })
    return { success: true }
  }
}

class AuditDbMock {
  constructor() {
    this.rows = []
  }

  prepare(sql) {
    return new AuditStatementMock(this, sql)
  }
}

test('sanitizeAuditMetadata redacts sensitive audit keys recursively', () => {
  const clean = sanitizeAuditMetadata({
    updatedKeys: ['aiTextDefaultModel'],
    token: 'plain-token',
    nested: {
      apiKey: 'plain-key',
      oauthCode: 'plain-code',
      webhookSignature: 'plain-signature',
      safe: 'kept'
    }
  })

  assert.deepEqual(clean, {
    updatedKeys: ['aiTextDefaultModel'],
    token: '[REDACTED]',
    nested: {
      apiKey: '[REDACTED]',
      oauthCode: '[REDACTED]',
      webhookSignature: '[REDACTED]',
      safe: 'kept'
    }
  })
})

test('AuditService.write uses existing HL_auditLogs columns only', async () => {
  const db = new AuditDbMock()

  await AuditService.write(db, {
    userId: 7,
    action: 'admin.aiConfig.update',
    entityType: 'HL_systemConfigs',
    entityId: 'ai',
    metadataJson: { token: 'secret', updatedKeys: ['aiTextDefaultModel'] }
  })

  assert.equal(db.rows.length, 1)
  assert.match(
    db.rows[0].sql,
    /INSERT INTO HL_auditLogs \(userId, action, entityType, entityId, metadataJson, createdAt\)/
  )
  assert.equal(db.rows[0].params[0], 7)
  assert.equal(db.rows[0].params[1], 'admin.aiConfig.update')
  assert.equal(db.rows[0].params[2], 'HL_systemConfigs')
  assert.equal(db.rows[0].params[3], 'ai')
  assert.equal(db.rows[0].params[4].includes('secret'), false)
  assert.deepEqual(JSON.parse(db.rows[0].params[4]), {
    token: '[REDACTED]',
    updatedKeys: ['aiTextDefaultModel']
  })
})

test('toSafeAuditMetadataJson accepts existing JSON metadata strings', () => {
  const json = toSafeAuditMetadataJson('{"telegramBotToken":"abc","safe":true}')
  assert.deepEqual(JSON.parse(json), {
    telegramBotToken: '[REDACTED]',
    safe: true
  })
})
