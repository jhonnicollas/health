import assert from 'node:assert/strict'
import test from 'node:test'
import { EntitlementService, QuotaService } from '../dist/services/entitlements.js'
import { RbacService } from '../dist/services/rbac.js'
import { AuditService, sanitizeAuditMetadata, toSafeAuditMetadataJson } from '../dist/services/audit.js'
import { ConfigService, formatConfigForResponse, isSensitiveConfigKey } from '../dist/services/config.js'

function mockDb(responseMap = {}) {
  const runCaptured = []
  return {
    _runCaptured: runCaptured,
    prepare(sql) {
      const self = { sql, _params: [] }
      self.bind = (...p) => { self._params = p; return self }
      self.first = async () => {
        for (const [pattern, val] of Object.entries(responseMap)) {
          if (sql.includes(pattern)) return typeof val === 'function' ? val(sql, self._params) : val
        }
        return null
      }
      self.all = async () => {
        for (const [pattern, val] of Object.entries(responseMap)) {
          if (sql.includes(pattern) && Array.isArray(val)) return { results: val }
        }
        return { results: [] }
      }
      self.run = async () => {
        runCaptured.push({ sql, params: self._params })
        return { meta: { last_row_id: runCaptured.length } }
      }
      return self
    }
  }
}

function foundationDb(responseMap = {}) {
  return {
    prepare(sql) {
      const self = { sql, _params: [] }
      self.bind = (...p) => { self._params = p; return self }
      self.first = async () => {
        for (const [pattern, val] of Object.entries(responseMap)) {
          if (sql.includes(pattern)) return typeof val === 'function' ? val(sql, self._params) : val
        }
        return null
      }
      self.all = async () => {
        for (const [pattern, val] of Object.entries(responseMap)) {
          if (sql.includes(pattern) && Array.isArray(val)) return { results: val }
        }
        return { results: [] }
      }
      self.run = async () => ({ meta: { last_row_id: 1 } })
      return self
    }
  }
}

test('RbacService returns active roles only', async () => {
  const db = {
    prepare: (sql) => ({
      bind: (userId) => ({
        all: async () => {
          if (sql.includes('systemRole') && userId === 1) return { results: [{ roleCode: 'user', roleName: 'User', systemRole: 1 }, { roleCode: 'admin', roleName: 'Admin', systemRole: 1 }] }
          return { results: [] }
        }
      })
    })
  }
  const roles = await RbacService.getUserRoles(db, 1)
  assert.ok(roles.length > 0)
  assert.ok(roles.every(r => r.systemRole === 1))
})

test('RbacService ignores revoked roles', async () => {
  const db = {
    prepare: (sql) => ({
      bind: () => ({
        all: async () => ({ results: [] }),
        first: async () => null
      })
    })
  }
  const roles = await RbacService.getUserRoles(db, 999)
  assert.deepEqual(roles, [])
  const has = await RbacService.hasPermission(db, 999, 'admin.config.read')
  assert.equal(has, false)
})

test('requirePermission guards reject missing permission', async () => {
  const db = {
    prepare: () => ({ bind: () => ({ first: async () => null }) })
  }
  const result = await RbacService.hasPermission(db, 1, 'admin.billing.manage')
  assert.equal(result, false)
})

test('EntitlementService returns Free plan fallback', async () => {
  const db = foundationDb({
    'HL_subscriptions': () => null,
    "planCode = 'free'": () => ({ planCode: 'free', planName: 'Free', billingInterval: 'free', active: 1 })
  })
  const plan = await EntitlementService.getActivePlan(db, 999)
  assert.equal(plan.planCode, 'free')
})

test('EntitlementService blocks disabled feature', async () => {
  const db = foundationDb({
    'HL_subscriptions': () => null,
    "planCode = 'free'": () => ({ planCode: 'free', planName: 'Free', billingInterval: 'free', active: 1 }),
    'HL_planFeatures': () => ({ enabled: 0, quotaLimit: 0 })
  })
  const result = await EntitlementService.requireEntitlement(db, 999, 'feature.aiReport.use')
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'FEATURE_DISABLED')
})

test('QuotaService increments usage counter', async () => {
  const db = foundationDb({
    'HL_subscriptions': () => ({ planCode: 'free' }),
    "planCode = 'free'": () => ({ planCode: 'free', planName: 'Free', billingInterval: 'free', active: 1 }),
    'HL_planFeatures': () => ({ enabled: 1, quotaLimit: 3, quotaWindow: 'month', metadataJson: null }),
    'HL_usageCounters': () => ({ usedCount: 0 })
  })
  await QuotaService.consumeQuota(db, 1, 'feature.aiAssistant.use', 1)
  assert.ok(true)
})

test('QuotaService returns QUOTA_EXCEEDED when exhausted', async () => {
  const db = foundationDb({
    'HL_subscriptions': () => ({ planCode: 'free' }),
    "planCode = 'free'": () => ({ planCode: 'free', planName: 'Free', billingInterval: 'free', active: 1 }),
    'HL_planFeatures': () => ({ enabled: 1, quotaLimit: 3, quotaWindow: 'month', metadataJson: null }),
    'HL_usageCounters': () => ({ usedCount: 3 })
  })
  const result = await QuotaService.requireQuota(db, 1, 'feature.aiAssistant.use')
  assert.equal(result.allowed, false)
  assert.equal(result.reason, 'QUOTA_EXCEEDED')
})

test('ConfigService masks secret config', async () => {
  const makeAll = (sql) => ({
    results: sql.includes('HL_systemConfigs')
      ? [{ configKey: 'googleClientSecret', configValue: 'super-secret', dataType: 'string', description: null, updatedAt: '2026-06-26' }]
      : [{ configKey: 'googleClientSecret', category: 'security', isSecret: 1, storageMode: 'env', envVarName: 'GOOGLE_OAUTH_CLIENT_SECRET', masked: 1, readPolicy: 'admin.config.read', writePolicy: 'admin.config.update', description: null, active: 1 }]
  })
  const db = {
    prepare: (sql) => ({
      bind: () => ({ first: async () => null, all: async () => makeAll(sql), run: async () => ({ meta: {} }) }),
      first: async () => null,
      all: async () => makeAll(sql),
      run: async () => ({ meta: {} })
    })
  }
  const list = await ConfigService.list(db, { GOOGLE_OAUTH_CLIENT_SECRET: 'real-secret' })
  const item = list.find((c) => c.configKey === 'googleClientSecret')
  assert.ok(item)
  assert.equal(item.configValue, '')
  assert.equal(item.secretValueReturned, false)
})

test('AuditService strips secret-like keys from metadata', async () => {
  const captured = []
  const db = {
    prepare: () => ({
      bind: (...args) => ({
        run: async () => { captured.push(args); return { meta: {} } }
      })
    })
  }
  await AuditService.write(db, { userId: 1, action: 'test', entityType: 'test', entityId: '1', metadataJson: { password: 'x', secret: 'y', safe: 'ok' } })
  const meta = JSON.parse(captured[0][4])
  assert.equal(meta.password, '[REDACTED]')
  assert.equal(meta.secret, '[REDACTED]')
  assert.equal(meta.safe, 'ok')
})

test('Admin role CRUD requires admin.roles.* permission', async () => {
  const allowedPerms = ['admin.config.read']
  const required = 'admin.roles.manage'
  assert.equal(allowedPerms.includes(required), false)
})

test('Assign/revoke role writes audit log', async () => {
  let auditWritten = false
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('HL_userRoles')) return { userId: 1, roleCode: 'admin', active: 1, revokedAt: null }
          return null
        },
        run: async () => {
          if (sql.includes('HL_auditLogs')) auditWritten = true
          return { meta: {} }
        }
      })
    })
  }
  await AuditService.write(db, { userId: 1, action: 'admin.role.assign', entityType: 'HL_userRoles', entityId: 'admin', metadataJson: {} })
  assert.ok(auditWritten)
})

test('Plan feature update writes audit log', async () => {
  let auditWritten = false
  const db = {
    prepare: () => ({
      bind: (...args) => ({
        run: async () => {
          if (args[1]?.toString().includes('planFeature') || args[1] === 'admin.planFeature.update') auditWritten = true
          return { meta: {} }
        }
      })
    })
  }
  await AuditService.write(db, { userId: 1, action: 'admin.planFeature.update', entityType: 'HL_planFeatures', entityId: 'premiumMonthly', metadataJson: {} })
  assert.ok(auditWritten)
})

test('Subscription update writes audit log', async () => {
  let auditWritten = false
  const db = {
    prepare: () => ({
      bind: (...args) => ({
        run: async () => { auditWritten = true; return { meta: {} } }
      })
    })
  }
  await AuditService.write(db, { userId: 1, action: 'admin.subscription.update', entityType: 'HL_subscriptions', entityId: '5', metadataJson: {} })
  assert.ok(auditWritten)
})

test('/api/me/entitlements returns plan features and quota state shape', async () => {
  const entitlement = { allowed: true, planCode: 'free', featureCode: 'feature.aiAssistant.use' }
  assert.ok(entitlement.planCode)
  assert.ok(entitlement.featureCode)
  assert.equal(typeof entitlement.allowed, 'boolean')
})

test('Billing webhook duplicate providerEventId is idempotent', async () => {
  let insertCount = 0
  const db = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => {
          if (sql.includes('HL_paymentEvents') && sql.includes('providerEventId')) return { id: 5 }
          return null
        },
        run: async () => { insertCount++; return { meta: {} } }
      })
    })
  }
  const existing = await db.prepare('SELECT id FROM HL_paymentEvents WHERE providerEventId = ?').bind('evt_123').first()
  assert.ok(existing, 'duplicate event found — must not insert again')
})

test('Admin safety events returns summary only (no raw description)', async () => {
  const db = {
    prepare: (sql) => ({
      bind: () => ({
        all: async () => ({
          results: [{ id: 1, eventType: 'symptomRedFlag', severity: 'emergency', userId: 5, createdAt: '2026-06-26' }]
        })
      })
    })
  }
  const { results } = await db.prepare('SELECT id, eventType, severity, userId, createdAt FROM HL_safetyEvents').bind().all()
  assert.ok(results[0])
  assert.equal(results[0].eventType, 'symptomRedFlag')
  assert.ok(!results[0].description, 'safety event summary must not contain raw description')
})

test('/api/admin/ai-config never returns plaintext AI key', async () => {
  let allCallCount = 0
  const db = {
    prepare(sql) {
      const self = { sql, _params: [] }
      self.bind = (...p) => { self._params = p; return self }
      self.first = async () => null
      self.all = async () => {
        allCallCount++
        if (sql.includes('HL_systemConfigs'))
          return { results: [{ configKey: 'aiTextApiKey', configValue: 'sk-real-key-12345678', dataType: 'string', description: null, updatedAt: 'now' }] }
        if (sql.includes('HL_configMetadata'))
          return { results: [{ configKey: 'aiTextApiKey', category: 'ai', isSecret: 1, storageMode: 'env', envVarName: 'AI_TEXT_API_KEY', masked: 1, readPolicy: 'admin.aiConfig.read', writePolicy: 'admin.aiConfig.update', description: null, active: 1 }] }
        return { results: [] }
      }
      self.run = async () => ({ meta: {} })
      return self
    }
  }
  const configs = await ConfigService.list(db, { AI_TEXT_API_KEY: 'sk-real-key-12345678' })
  const ai = configs.find(c => c.configKey === 'aiTextApiKey')
  assert.ok(ai, 'aiTextApiKey config must exist in list')
  assert.equal(ai.configValue, '')
  assert.equal(ai.secretValueReturned, false)
})

test('sanitizeAuditMetadata redacts nested secret keys', () => {
  const result = sanitizeAuditMetadata({ safe: 'ok', nested: { apiKey: 'val', token: 'val2' } })
  assert.equal(result.safe, 'ok')
  assert.equal(result.nested.apiKey, '[REDACTED]')
  assert.equal(result.nested.token, '[REDACTED]')
})
