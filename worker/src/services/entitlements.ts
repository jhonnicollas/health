export type PlanRow = {
  planCode: string
  planName: string
  billingInterval: string
  active: number
}

export type PlanFeatureRow = {
  planCode: string
  featureCode: string
  enabled: number
  quotaLimit: number | null
  quotaWindow: 'day' | 'month' | 'quarter' | 'year' | 'lifetime' | null
  metadataJson: string | null
}

export type EntitlementResult = {
  allowed: boolean
  planCode: string
  featureCode: string
  feature?: PlanFeatureRow
  reason?: 'FEATURE_NOT_FOUND' | 'FEATURE_DISABLED'
}

export type QuotaResult = Omit<EntitlementResult, 'reason'> & {
  quotaWindow: string | null
  quotaLimit: number | null
  usedCount: number
  remaining: number | null
  resetAt: string | null
  reason?: EntitlementResult['reason'] | 'QUOTA_EXCEEDED'
}

export function usageWindowKey(window: PlanFeatureRow['quotaWindow'], now = new Date()): string {
  if (!window || window === 'lifetime') return 'lifetime'
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const day = String(now.getUTCDate()).padStart(2, '0')
  if (window === 'day') return `${year}-${month}-${day}`
  if (window === 'month') return `${year}-${month}`
  if (window === 'quarter') return `${year}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`
  return String(year)
}

export function usageResetAt(window: PlanFeatureRow['quotaWindow'], now = new Date()): string | null {
  if (!window || window === 'lifetime') return null
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  if (window === 'day') return new Date(Date.UTC(year, month, now.getUTCDate() + 1)).toISOString()
  if (window === 'month') return new Date(Date.UTC(year, month + 1, 1)).toISOString()
  if (window === 'quarter') return new Date(Date.UTC(year, Math.floor(month / 3) * 3 + 3, 1)).toISOString()
  return new Date(Date.UTC(year + 1, 0, 1)).toISOString()
}

async function getFreePlan(db: D1Database): Promise<PlanRow> {
  const row = await db.prepare(
    "SELECT planCode, planName, billingInterval, active FROM HL_plans WHERE planCode = 'free' AND active = 1 LIMIT 1"
  ).first<PlanRow>()
  if (!row) throw new Error('FREE_PLAN_NOT_FOUND')
  return row
}

export const EntitlementService = {
  async getActivePlan(db: D1Database, userId: number): Promise<PlanRow> {
    const row = await db.prepare(
      `SELECT p.planCode, p.planName, p.billingInterval, p.active
       FROM HL_subscriptions s
       JOIN HL_plans p ON p.planCode = s.planCode
       WHERE s.userId = ?
         AND s.status IN ('active','trialing')
         AND p.active = 1
         AND (s.currentPeriodEnd IS NULL OR s.currentPeriodEnd >= CURRENT_TIMESTAMP)
       ORDER BY COALESCE(s.currentPeriodEnd, '9999-12-31') DESC, s.id DESC
       LIMIT 1`
    ).bind(userId).first<PlanRow>()
    return row ?? getFreePlan(db)
  },

  async getPlanFeature(db: D1Database, planCode: string, featureCode: string): Promise<PlanFeatureRow | null> {
    return await db.prepare(
      `SELECT planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson
       FROM HL_planFeatures
       WHERE planCode = ? AND featureCode = ?
       LIMIT 1`
    ).bind(planCode, featureCode).first<PlanFeatureRow>()
  },

  async requireEntitlement(db: D1Database, userId: number, featureCode: string): Promise<EntitlementResult> {
    const plan = await this.getActivePlan(db, userId)
    const feature = await this.getPlanFeature(db, plan.planCode, featureCode)
    if (!feature) return { allowed: false, planCode: plan.planCode, featureCode, reason: 'FEATURE_NOT_FOUND' }
    if (feature.enabled !== 1) return { allowed: false, planCode: plan.planCode, featureCode, feature, reason: 'FEATURE_DISABLED' }
    return { allowed: true, planCode: plan.planCode, featureCode, feature }
  }
}

export const QuotaService = {
  async requireQuota(db: D1Database, userId: number, featureCode: string, now = new Date()): Promise<QuotaResult> {
    const entitlement = await EntitlementService.requireEntitlement(db, userId, featureCode)
    const feature = entitlement.feature
    if (!entitlement.allowed || !feature) {
      return { ...entitlement, quotaWindow: null, quotaLimit: null, usedCount: 0, remaining: null, resetAt: null }
    }
    if (feature.quotaLimit === null) {
      return { ...entitlement, quotaWindow: null, quotaLimit: null, usedCount: 0, remaining: null, resetAt: null }
    }

    const usageWindow = usageWindowKey(feature.quotaWindow, now)
    const row = await db.prepare(
      'SELECT usedCount FROM HL_usageCounters WHERE userId = ? AND featureCode = ? AND usageWindow = ? LIMIT 1'
    ).bind(userId, featureCode, usageWindow).first<{ usedCount: number }>()
    const usedCount = row?.usedCount ?? 0
    const remaining = Math.max(feature.quotaLimit - usedCount, 0)
    if (remaining <= 0) {
      return {
        ...entitlement,
        allowed: false,
        quotaWindow: usageWindow,
        quotaLimit: feature.quotaLimit,
        usedCount,
        remaining: 0,
        resetAt: usageResetAt(feature.quotaWindow, now),
        reason: 'QUOTA_EXCEEDED'
      }
    }

    return {
      ...entitlement,
      quotaWindow: usageWindow,
      quotaLimit: feature.quotaLimit,
      usedCount,
      remaining,
      resetAt: usageResetAt(feature.quotaWindow, now)
    }
  },

  async consumeQuota(db: D1Database, userId: number, featureCode: string, amount = 1, now = new Date()): Promise<QuotaResult> {
    const quota = await this.requireQuota(db, userId, featureCode, now)
    if (!quota.allowed || quota.quotaLimit === null || !quota.quotaWindow) return quota

    await db.prepare(
      `INSERT INTO HL_usageCounters (userId, featureCode, usageWindow, usedCount, quotaLimitSnapshot, resetAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(userId, featureCode, usageWindow) DO UPDATE SET
         usedCount = usedCount + excluded.usedCount,
         quotaLimitSnapshot = excluded.quotaLimitSnapshot,
         resetAt = excluded.resetAt,
         updatedAt = CURRENT_TIMESTAMP`
    ).bind(userId, featureCode, quota.quotaWindow, amount, quota.quotaLimit, quota.resetAt).run()

    return {
      ...quota,
      usedCount: quota.usedCount + amount,
      remaining: quota.remaining === null ? null : Math.max(quota.remaining - amount, 0)
    }
  }
}
