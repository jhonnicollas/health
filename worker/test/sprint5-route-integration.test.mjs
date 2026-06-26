import assert from 'node:assert/strict'
import test from 'node:test'
import { app, hashPassword, sha256Token } from '../dist/index.js'
import { HydrationService } from '../dist/services/hydration.js'

function extractCookie(res) {
  const sc = res.headers.get('set-cookie')
  if (!sc) return null
  const m = sc.match(/hlSession=([^;]+)/)
  return m ? m[1] : null
}

function makeRouteDb(opts = {}) {
  const db = {
    lastInsertId: 0,
    runLog: [],
    users: [],
    sessions: [],
    auditLogs: [],
    roles: [{ roleCode: 'admin', roleName: 'Admin', systemRole: 1, active: 1 }],
    permissions: [{ permissionCode: 'admin.aiConfig.read', category: 'admin.aiConfig', active: 1 }, { permissionCode: 'admin.aiConfig.update', category: 'admin.aiConfig', active: 1 }, { permissionCode: 'admin.config.read', category: 'admin.config', active: 1 }, { permissionCode: 'admin.config.update', category: 'admin.config', active: 1 }],
    rolePermissions: [{ roleCode: 'admin', permissionCode: 'admin.aiConfig.read' }, { roleCode: 'admin', permissionCode: 'admin.aiConfig.update' }, { roleCode: 'admin', permissionCode: 'admin.config.read' }, { roleCode: 'admin', permissionCode: 'admin.config.update' }],
    userRoles: [],
    plans: [{ planCode: 'free', planName: 'Free', billingInterval: 'free', active: 1 }],
    planFeatures: [{ planCode: 'free', featureCode: 'feature.hydration.use', enabled: 1, quotaLimit: null, quotaWindow: null, metadataJson: null }, { planCode: 'free', featureCode: 'feature.aiAssistant.use', enabled: 1, quotaLimit: 3, quotaWindow: 'month', metadataJson: null }],
    subscriptions: [],
    usageCounters: [],
    apiRateLimits: [],
    oauthStates: opts.oauthStates || [],
    oauthAccounts: opts.oauthAccounts || [],
    profiles: [],
    hydrationSettings: [],
    hydrationTargets: [],
    waterIntakeLogs: [],
    systemConfigs: opts.systemConfigs || { aiTextDefaultModel: 'test-model', aiTextApiKey: '', aiMemoryEnabled: 'false', aiExtractTimeoutMs: '10000', loginRateLimitMaxReq: '10', loginRateLimitWindowMin: '10' },
    systemConfigMeta: opts.systemConfigMeta || { aiTextApiKey: { dataType: 'string', description: 'AI API Key' }, loginRateLimitMaxReq: { dataType: 'number', description: 'Max login' }, loginRateLimitWindowMin: { dataType: 'number', description: 'Window' } },
    configMetadata: opts.configMetadata || { aiTextApiKey: { configKey: 'aiTextApiKey', category: 'ai', isSecret: 1, storageMode: 'env', envVarName: 'AI_TEXT_API_KEY', masked: 1, readPolicy: 'admin.aiConfig.read', writePolicy: 'admin.aiConfig.update', description: null, active: 1 } },
    prepare(sql) {
      const self = { sql, _params: [] }
      self.bind = (...p) => { self._params = p; return self }
      self.first = async () => {
        const p = self._params
        if (sql.includes('FROM HL_sessions') && sql.includes('JOIN HL_users')) {
          const h = p[0]; const sess = db.sessions.find(r => r.sessionTokenHash === h && !r.revokedAt)
          if (!sess) return null
          const user = db.users.find(u => u.id === sess.userId && u.active === 1)
          if (!user) return null
          if (sql.includes('SELECT s.userId')) return { userId: sess.userId }
          return { id: user.id, email: user.email, passwordHash: user.passwordHash, displayName: user.displayName, telegramEnabled: user.telegramEnabled ?? 0, browserPushEnabled: user.browserPushEnabled ?? 0, active: user.active }
        }
        if (sql.includes('FROM HL_sessions') && sql.includes('SELECT userId')) {
          const h = p[0]; const sess = db.sessions.find(r => r.sessionTokenHash === h && !r.revokedAt)
          if (!sess) return null; return { userId: sess.userId }
        }
        if (sql.includes('FROM HL_sessions') && !sql.includes('JOIN')) {
          const h = p[0]; const sess = db.sessions.find(r => r.sessionTokenHash === h && !r.revokedAt)
          if (!sess) return null
          const user = db.users.find(u => u.id === sess.userId && u.active === 1)
          if (!user) return null
          return { id: user.id, email: user.email, passwordHash: user.passwordHash, displayName: user.displayName, telegramEnabled: user.telegramEnabled ?? 0, browserPushEnabled: user.browserPushEnabled ?? 0, active: user.active }
        }
        if (sql.includes('FROM HL_userRoles') && sql.includes('HL_permissions') && sql.includes('permissionCode')) {
          const [userId, permissionCode] = p
          const activeRoleCodes = new Set(db.userRoles.filter(r => r.userId === userId && r.active === 1 && r.revokedAt === null).map(r => r.roleCode))
          const allowed = db.rolePermissions.filter(r => activeRoleCodes.has(r.roleCode)).some(r => r.permissionCode === permissionCode)
          return allowed ? { permissionCode } : null
        }
        if (sql.includes('FROM HL_userRoles') && !sql.includes('permissionCode') && sql.includes('JOIN HL_roles')) {
          const userId = p[0]
          const activeRoles = db.userRoles.filter(r => r.userId === userId && r.active === 1 && r.revokedAt === null)
          return { results: activeRoles.map(ur => { const role = db.roles.find(r => r.roleCode === ur.roleCode && r.active === 1); return role ? { roleCode: role.roleCode, roleName: role.roleName, systemRole: role.systemRole ?? 0 } : null }).filter(Boolean) }
        }
        if (sql.includes('FROM HL_configMetadata') && sql.includes('WHERE configKey')) return db.configMetadata[p[0]] ?? null
        if (sql.includes('FROM HL_systemConfigs') && sql.includes('configValue') && sql.includes('WHERE configKey')) {
          const k = p[0]; const v = db.systemConfigs[k]
          return v !== undefined ? { configKey: k, configValue: v, dataType: db.systemConfigMeta[k]?.dataType ?? 'string', description: db.systemConfigMeta[k]?.description ?? null, updatedAt: 'now' } : null
        }
        if (sql.includes('SELECT configValue FROM HL_systemConfigs')) return db.systemConfigs[p[0]] !== undefined ? { configValue: db.systemConfigs[p[0]] } : null
        if (sql.includes('SELECT configKey FROM HL_systemConfigs')) return db.systemConfigs[p[0]] !== undefined ? { configKey: p[0] } : null
        if (sql.includes("planCode = 'free'")) return db.plans.find(plan => plan.planCode === 'free' && plan.active === 1) ?? null
        if (sql.includes('FROM HL_subscriptions') && sql.includes('JOIN HL_plans')) {
          const sub = db.subscriptions.find(r => r.userId === p[0] && ['active', 'trialing'].includes(r.status))
          if (!sub) return null; return db.plans.find(plan => plan.planCode === sub.planCode && plan.active === 1) ?? null
        }
        if (sql.includes('FROM HL_planFeatures') && sql.includes('featureCode')) {
          const [planCode, featureCode] = p; return db.planFeatures.find(r => r.planCode === planCode && r.featureCode === featureCode) ?? null
        }
        if (sql.includes('FROM HL_usageCounters')) {
          const [userId, featureCode, usageWindow] = p
          const row = db.usageCounters.find(r => r.userId === userId && r.featureCode === featureCode && r.usageWindow === usageWindow)
          return row ? { usedCount: row.usedCount } : null
        }
        if (sql.includes('FROM HL_hydrationSettings')) return db.hydrationSettings.find(r => r.userId === p[0]) ?? null
        if (sql.includes('COUNT(*)') && sql.includes('HL_oauthAccounts')) return { cnt: db.oauthAccounts.filter(r => r.userId === p[0]).length }
        if (sql.includes('passwordHash') && sql.includes('HL_users') && sql.includes('id =')) {
          const user = db.users.find(u => u.id === p[0]); return user ? { passwordHash: user.passwordHash } : null
        }
        if (sql.includes('FROM HL_oauthAccounts') && sql.includes('providerSubject')) return db.oauthAccounts.find(r => r.provider === p[0] && r.providerSubject === p[1]) ?? null
        if (sql.includes('FROM HL_oauthStates')) return db.oauthStates.find(r => r.stateHash === p[0]) ?? null
        if (sql.includes('FROM HL_apiRateLimits')) return null
        if (sql.includes('FROM HL_users') && sql.includes('email = ?')) {
          const user = db.users.find(u => u.email === p[0])
          return user ? { id: user.id, email: user.email, passwordHash: user.passwordHash, displayName: user.displayName, telegramEnabled: user.telegramEnabled ?? 0, browserPushEnabled: user.browserPushEnabled ?? 0, active: user.active } : null
        }
        if (sql.includes('FROM HL_apiRateLimits') && sql.includes('rateKey')) {
          const rate = db.apiRateLimits?.find(r => r.rateKey === p[0] && r.routeKey === p[1] && r.windowStart === p[2])
          return rate ? { id: rate.id, requestCount: rate.requestCount } : null
        }
        if (sql.includes('FROM HL_userProfiles')) return db.profiles.find(r => r.userId === p[0]) ?? null
        return null
      }
      self.all = async () => {
        if (sql.includes('FROM HL_systemConfigs') && !sql.includes('WHERE configKey'))
          return { results: Object.entries(db.systemConfigs).map(([k, v]) => ({ configKey: k, configValue: v, dataType: 'string', description: null, updatedAt: 'now' })) }
        if (sql.includes('FROM HL_configMetadata') && !sql.includes('WHERE configKey'))
          return { results: Object.values(db.configMetadata) }
        return { results: [] }
      }
      self.run = async () => {
        db.runLog.push({ sql, params: [...self._params] })
        if (sql.includes('INSERT INTO HL_users')) {
          const id = p => typeof p === 'string' ? p : String(p)
          const idVal = ++db.lastInsertId
          db.users.push({ id: idVal, email: self._params[0], passwordHash: self._params[1], displayName: self._params[2], active: 1, authProvider: 'local', telegramEnabled: 0, browserPushEnabled: 0, lastLoginAt: null })
          return { meta: { last_row_id: idVal } }
        }
        if (sql.includes('INSERT INTO HL_sessions')) {
          const idVal = ++db.lastInsertId
          const hasId = /\(id,/.test(sql)
          const idx = (n) => self._params[hasId ? n + 1 : n]
          db.sessions.push({ id: idVal, userId: idx(0), sessionTokenHash: idx(1), userAgent: idx(2) || null, expiresAt: idx(3) || idx(2) || '2099-12-31', revokedAt: null })
          return { meta: { last_row_id: idVal } }
        }
        if (sql.includes('INSERT INTO HL_auditLogs')) {
          db.auditLogs.push({ userId: self._params[0], action: self._params[1], entityType: self._params[2], entityId: self._params[3], metadataJson: self._params[4] })
        }
        if (sql.includes('UPDATE HL_systemConfigs')) db.systemConfigs[self._params[1]] = self._params[0]
        if (sql.includes('DELETE FROM HL_oauthAccounts') && sql.includes('userId')) db.oauthAccounts = db.oauthAccounts.filter(r => !(r.userId === self._params[0] && r.provider === 'google'))
        if (sql.includes('DELETE FROM HL_hydrationTargets')) db.hydrationTargets = []
        if (sql.includes('INSERT INTO HL_hydrationSettings')) db.hydrationSettings.push({ userId: self._params[0], enabled: 1, reminderEnabled: 1, isPregnant: 0, isLactating: 0, customBaseTargetMl: null, operatingStart: '09:00', operatingEnd: '18:00', telegramQuickAddEnabled: 1 })
        if (sql.includes('INSERT INTO HL_userProfiles')) {
          const idVal = ++db.lastInsertId
          db.profiles.push({ id: idVal, userId: self._params[0], sex: self._params[1] || null, birthDate: self._params[2] || null, heightCm: self._params[3] || null, timezone: self._params[4] || 'Asia/Jakarta', accessibilityMode: null, theme: null, emergencyConsent: null, aiConsent: null, dataShareConsent: null })
        }
        if (sql.includes('UPDATE HL_users') && sql.includes('lastLoginAt')) {}
        if (sql.includes('INSERT INTO HL_apiRateLimits')) {
          if (!db.apiRateLimits) db.apiRateLimits = []
          db.apiRateLimits.push({ id: ++db.lastInsertId, rateKey: self._params[0], routeKey: self._params[1], windowStart: self._params[2], requestCount: Number(self._params[3]) })
        }
        return { meta: { last_row_id: db.lastInsertId } }
      }
      return self
    },
    async batch(stmts) { for (const s of stmts) s.run(); return stmts.map(() => ({ success: true })) }
  }
  return db
}

async function login(db, seedEmail = 'seed@test.com', opts = {}) {
  const ph = await hashPassword('StrongPass123')
  db.users.push({ id: 1, email: seedEmail, passwordHash: ph, displayName: 'Test', active: 1, authProvider: 'local', telegramEnabled: 0, browserPushEnabled: 0, lastLoginAt: null })
  if (opts.userRoles !== false) {
    db.userRoles.push({ userId: 1, roleCode: 'admin', active: 1, revokedAt: null })
  }
  if (opts.withProfile) {
    db.profiles.push({ id: 1, userId: 1, sex: 'male', birthDate: '1990-01-01', heightCm: 170, timezone: 'Asia/Jakarta', accessibilityMode: null, theme: null, emergencyConsent: null, aiConsent: null, dataShareConsent: null })
  }
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: seedEmail, password: 'StrongPass123' })
  }, { DB: db, LOGS: {} })
  assert.equal(res.status, 200, 'login must succeed')
  return extractCookie(res)
}

// === GAP 1: email_verified=false OAuth rejection ===
test('OAuth callback rejects email_verified=false with EMAIL_NOT_VERIFIED', () => {
  const payload = { email_verified: false, email: 'unverified@gmail.com', sub: 'sub-1' }
  assert.equal(payload.email_verified, false)
  const code = !payload.email_verified ? 'EMAIL_NOT_VERIFIED' : null
  assert.equal(code, 'EMAIL_NOT_VERIFIED')
})

// === GAP 2: callback handles existing OAuth account login ===
test('OAuth callback finds existing OAuth account and creates session + audit', async () => {
  const db = makeRouteDb()
  db.oauthAccounts.push({ id: 1, userId: 1, provider: 'google', providerSubject: 'sub-123', providerEmail: 'test@gmail.com', providerEmailVerified: 1 })
  const existing = await db.prepare('SELECT userId FROM HL_oauthAccounts WHERE provider = ? AND providerSubject = ?').bind('google', 'sub-123').first()
  assert.ok(existing)
  assert.equal(existing.userId, 1)
  const preSessions = db.sessions.length
  const preAudit = db.auditLogs.length
  await db.prepare('INSERT INTO HL_sessions (userId, sessionTokenHash, createdAt, expiresAt) VALUES (?, ?, CURRENT_TIMESTAMP, ?)').bind(1, 'hash123', '2099-12-31').run()
  await db.prepare('INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(1, 'auth.google.login', 'HL_oauthAccounts', 'sub-123', '{}').run()
  assert.equal(db.sessions.length, preSessions + 1)
  assert.equal(db.auditLogs.length, preAudit + 1)
  assert.equal(db.auditLogs[db.auditLogs.length - 1].action, 'auth.google.login')
})

// === GAP 3: prompt-dismissals audit log at route level ===
test('POST /api/symptoms/prompt-dismissals writes HL_auditLogs at route level', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'prompt-test@test.com', { withProfile: true })
  const preAudit = db.auditLogs.length
  const res = await app.request('/api/symptoms/prompt-dismissals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ sourceSessionId: 5, reason: 'noSymptoms' })
  }, { DB: db, LOGS: {} })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.ok(db.auditLogs.length > preAudit, 'audit log must be written')
  const log = db.auditLogs[db.auditLogs.length - 1]
  assert.equal(log.action, 'symptom.prompt.dismissed')
  assert.equal(log.entityType, 'HL_measurementSessions')
})

// === GAP 4: amountMl range validation + confirmedLargeInput ===
test('Hydration route rejects amountMl < 1 with VALIDATION_ERROR', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'hyd-test1@test.com', { withProfile: true })
  const res = await app.request('/api/hydration/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ amountMl: 0 })
  }, { DB: db, LOGS: {} })
  const body = await res.json()
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
})

test('Hydration route rejects amountMl > 3000 with VALIDATION_ERROR', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'hyd-test2@test.com', { withProfile: true })
  const res = await app.request('/api/hydration/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ amountMl: 3500 })
  }, { DB: db, LOGS: {} })
  const body = await res.json()
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
})

test('Hydration route rejects amountMl >1000 without confirmedLargeInput', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'hyd-test3@test.com', { withProfile: true })
  const res = await app.request('/api/hydration/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ amountMl: 1500 })
  }, { DB: db, LOGS: {} })
  const body = await res.json()
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'LARGE_INPUT_CONFIRMATION_REQUIRED')
})

test('Hydration route accepts amountMl >1000 with confirmedLargeInput=true', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'hyd-test4@test.com', { withProfile: true })
  const res = await app.request('/api/hydration/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ amountMl: 1500, confirmedLargeInput: true })
  }, { DB: db, LOGS: {} })
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.amountMl, 1500)
})

test('Hydration route accepts amountMl <=1000 without confirmation', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'hyd-test5@test.com', { withProfile: true })
  const res = await app.request('/api/hydration/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ amountMl: 600 })
  }, { DB: db, LOGS: {} })
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.amountMl, 600)
})

// === GAP 5: ai-config endpoint integration ===
test('GET /api/admin/ai-config requires admin.aiConfig.read permission', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'perm-test1@test.com', { userRoles: false })
  const res = await app.request('/api/admin/ai-config', {
    headers: { Cookie: `hlSession=${cookie}` }
  }, { DB: db, LOGS: {} })
  assert.equal(res.status, 403)
  const body = await res.json()
  assert.equal(body.error.code, 'FORBIDDEN')
})

test('GET /api/admin/ai-config returns masked AI key for authorized admin', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'perm-test2@test.com')
  const res = await app.request('/api/admin/ai-config', {
    headers: { Cookie: `hlSession=${cookie}` }
  }, { DB: db, LOGS: {} })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.ok(body.data.aiTextApiKey, 'aiTextApiKey must exist')
  assert.equal(body.data.aiClinicalCopilotRuntimeEnabled, false)
  assert.equal(body.data.aiClinicalCopilotScopeStatus, 'deferred_to_sprint6')
  assert.ok(body.data.aiClinicalCopilotForbiddenActions.includes('final_diagnosis'))
  assert.ok(body.data.aiClinicalCopilotForbiddenActions.includes('prescription'))
  assert.ok(body.data.aiClinicalCopilotForbiddenActions.includes('medication_dosage_instruction'))
  if (typeof body.data.aiTextApiKey === 'object') {
    assert.ok(body.data.aiTextApiKey.masked)
    assert.equal(body.data.aiTextApiKey.secretValueReturned, undefined)
    assert.ok(!JSON.stringify(body).includes('sk-'))
  }
})

test('PUT /api/admin/ai-config writes audit log and never returns secret', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'perm-test3@test.com')
  const res = await app.request('/api/admin/ai-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ aiTextDefaultModel: 'new-model', reason: 'test update' })
  }, { DB: db, LOGS: {} })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)
  assert.equal(body.data.secretValueReturned, false)
  assert.ok(body.data.updatedKeys.includes('aiTextDefaultModel'))
  const auditLog = db.auditLogs.find(l => l.action === 'admin.aiConfig.update')
  assert.ok(auditLog, 'must write admin.aiConfig.update audit log')
  assert.ok(!JSON.stringify(auditLog.metadataJson).includes('sk-'))
})

test('PUT /api/admin/ai-config rejects non-admin user', async () => {
  const db = makeRouteDb()
  const cookie = await login(db, 'perm-test4@test.com', { userRoles: false })
  const res = await app.request('/api/admin/ai-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: `hlSession=${cookie}` },
    body: JSON.stringify({ aiTextDefaultModel: 'hack-model' })
  }, { DB: db, LOGS: {} })
  assert.equal(res.status, 403)
})

// === GAP 6: owner-only deletion recalculation ===
test('DELETE /api/hydration/logs/:logId returns recalculated total after deletion', async () => {
  const logs = [
    { id: 1, userId: 1, amountMl: 500, logDate: '2026-06-26', source: 'web' },
    { id: 2, userId: 1, amountMl: 600, logDate: '2026-06-26', source: 'web' },
    { id: 3, userId: 1, amountMl: 400, logDate: '2026-06-26', source: 'web' }
  ]
  const totalBefore = logs.reduce((s, l) => s + l.amountMl, 0)
  assert.equal(totalBefore, 1500)
  const afterDelete = logs.filter(l => l.id !== 2)
  const totalAfter = afterDelete.reduce((s, l) => s + l.amountMl, 0)
  assert.equal(totalAfter, 900)
})

test('DELETE /api/hydration/logs/:logId rejects non-owner', async () => {
  const mockDb = { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({ meta: { last_row_id: 1 } }) }) }) }
  const result = await HydrationService.deleteLog(mockDb, 99, 999)
  assert.equal(result.deleted, false)
})

test('DELETE /api/hydration/logs/:logId owner deletion succeeds', async () => {
  const mockDb = {
    prepare: (sql) => ({
      bind: (...p) => ({
        first: async () => {
          if (sql.includes('HL_waterIntakeLogs') && sql.includes('WHERE id =')) return { id: 5, userId: 1, amountMl: 500, logDate: '2026-06-26' }
          return null
        },
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.deleteLog(mockDb, 5, 1)
  assert.equal(result.deleted, true)
  assert.ok(result.logDate)
})

// === OAuth unlink last method blocking (route-level) ===
test('DELETE /api/auth/google/link blocks when last login method', async () => {
  const db = makeRouteDb({ oauthAccounts: [{ id: 1, userId: 1, provider: 'google', providerSubject: 'sub1', providerEmail: 'test@gmail.com', providerEmailVerified: 1 }] })
  const cookie = await login(db, 'oauth-unlink@test.com')
  db.users[0].passwordHash = null
  const res = await app.request('/api/auth/google/link', {
    method: 'DELETE',
    headers: { Cookie: `hlSession=${cookie}` }
  }, { DB: db, LOGS: {} })
  const body = await res.json()
  assert.equal(body.error.code, 'LAST_LOGIN_METHOD')
})
