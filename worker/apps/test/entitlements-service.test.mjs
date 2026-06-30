import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EntitlementService,
  QuotaService,
  usageResetAt,
  usageWindowKey
} from '../dist/services/entitlements.js'

class EntitlementStatementMock {
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
    if (this.sql.includes('FROM HL_subscriptions')) {
      const userId = this.params[0]
      const subscription = this.db.subscriptions.find((row) => row.userId === userId && ['active', 'trialing'].includes(row.status))
      if (!subscription) return null
      return this.db.plans.find((plan) => plan.planCode === subscription.planCode && plan.active === 1) ?? null
    }
    if (this.sql.includes("WHERE planCode = 'free'")) {
      return this.db.plans.find((plan) => plan.planCode === 'free' && plan.active === 1) ?? null
    }
    if (this.sql.includes('FROM HL_planFeatures')) {
      const [planCode, featureCode] = this.params
      return this.db.planFeatures.find((row) => row.planCode === planCode && row.featureCode === featureCode) ?? null
    }
    if (this.sql.includes('FROM HL_usageCounters')) {
      const [userId, featureCode, usageWindow] = this.params
      const key = `${userId}:${featureCode}:${usageWindow}`
      return this.db.usageCounters[key] ? { usedCount: this.db.usageCounters[key].usedCount } : null
    }
    return null
  }

  async run() {
    if (this.sql.includes('INSERT INTO HL_usageCounters')) {
      const [userId, featureCode, usageWindow, amount, quotaLimitSnapshot, resetAt] = this.params
      const key = `${userId}:${featureCode}:${usageWindow}`
      const current = this.db.usageCounters[key]?.usedCount ?? 0
      this.db.usageCounters[key] = {
        userId,
        featureCode,
        usageWindow,
        usedCount: current + amount,
        quotaLimitSnapshot,
        resetAt
      }
    }
    return { success: true }
  }
}

class EntitlementDbMock {
  constructor() {
    this.plans = [
      { planCode: 'free', planName: 'Free', billingInterval: 'free', active: 1 },
      { planCode: 'premiumMonthly', planName: 'Premium Monthly', billingInterval: 'monthly', active: 1 }
    ]
    this.subscriptions = [
      { userId: 2, planCode: 'premiumMonthly', status: 'active', currentPeriodEnd: null }
    ]
    this.planFeatures = [
      { planCode: 'free', featureCode: 'feature.aiAssistant.use', enabled: 1, quotaLimit: 3, quotaWindow: 'month', metadataJson: null },
      { planCode: 'free', featureCode: 'feature.aiReport.use', enabled: 0, quotaLimit: 0, quotaWindow: 'month', metadataJson: null },
      { planCode: 'premiumMonthly', featureCode: 'feature.aiAssistant.use', enabled: 1, quotaLimit: 100, quotaWindow: 'month', metadataJson: null },
      { planCode: 'premiumMonthly', featureCode: 'feature.vectorMemory.use', enabled: 1, quotaLimit: null, quotaWindow: null, metadataJson: null }
    ]
    this.usageCounters = {}
  }

  prepare(sql) {
    return new EntitlementStatementMock(this, sql)
  }
}

test('EntitlementService falls back to free plan when user has no subscription', async () => {
  const db = new EntitlementDbMock()
  const plan = await EntitlementService.getActivePlan(db, 1)
  const entitlement = await EntitlementService.requireEntitlement(db, 1, 'feature.aiAssistant.use')
  const blocked = await EntitlementService.requireEntitlement(db, 1, 'feature.aiReport.use')

  assert.equal(plan.planCode, 'free')
  assert.equal(entitlement.allowed, true)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.reason, 'FEATURE_DISABLED')
})

test('EntitlementService allows premium plan features', async () => {
  const db = new EntitlementDbMock()
  const plan = await EntitlementService.getActivePlan(db, 2)
  const entitlement = await EntitlementService.requireEntitlement(db, 2, 'feature.vectorMemory.use')

  assert.equal(plan.planCode, 'premiumMonthly')
  assert.equal(entitlement.allowed, true)
  assert.equal(entitlement.feature.quotaLimit, null)
})

test('QuotaService checks, consumes, and blocks exhausted monthly quota', async () => {
  const db = new EntitlementDbMock()
  const now = new Date('2026-06-24T12:00:00.000Z')

  const initial = await QuotaService.requireQuota(db, 1, 'feature.aiAssistant.use', now)
  assert.equal(initial.allowed, true)
  assert.equal(initial.remaining, 3)
  assert.equal(initial.quotaWindow, '2026-06')

  await QuotaService.consumeQuota(db, 1, 'feature.aiAssistant.use', 3, now)
  const exhausted = await QuotaService.requireQuota(db, 1, 'feature.aiAssistant.use', now)
  assert.equal(exhausted.allowed, false)
  assert.equal(exhausted.reason, 'QUOTA_EXCEEDED')
  assert.equal(exhausted.resetAt, '2026-07-01T00:00:00.000Z')
})

test('usageWindowKey supports day/month/quarter/year/lifetime', () => {
  const now = new Date('2026-06-24T12:00:00.000Z')

  assert.equal(usageWindowKey('day', now), '2026-06-24')
  assert.equal(usageWindowKey('month', now), '2026-06')
  assert.equal(usageWindowKey('quarter', now), '2026-Q2')
  assert.equal(usageWindowKey('year', now), '2026')
  assert.equal(usageWindowKey('lifetime', now), 'lifetime')
  assert.equal(usageResetAt('quarter', now), '2026-07-01T00:00:00.000Z')
})
