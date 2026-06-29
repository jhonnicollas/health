import { AuditService } from '../audit.js'

export const SubscriptionActivationService = {
  async activatePaidSubscription(
    db: D1Database,
    userId: number,
    planCode: string,
    checkoutSessionId: string,
    providerEventId: string,
    provider: string = 'xendit'
  ): Promise<{ subscriptionId: number; planCode: string; periodEnd: string }> {
    const plan = await db.prepare('SELECT planCode, planName, billingInterval, durationDays FROM HL_plans WHERE planCode = ? AND active = 1')
      .bind(planCode).first<{ planCode: string; planName: string; billingInterval: string; durationDays: number | null }>()
    if (!plan) throw Object.assign(new Error('Plan tidak ditemukan atau tidak aktif.'), { code: 'PLAN_NOT_FOUND' })

    const periodNow = new Date().toISOString()
    const periodEnd = new Date(Date.now() + daysForInterval(plan.billingInterval, plan.durationDays) * 86400000).toISOString()

    await db.prepare(`UPDATE HL_subscriptions SET status = 'expired', updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND status = 'active'`)
      .bind(userId).run()

    const result =     await db.prepare(`INSERT INTO HL_subscriptions (userId, planCode, status, provider, providerSubscriptionId, currentPeriodStart, currentPeriodEnd, createdAt, updatedAt)
      VALUES (?, ?, 'active', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
      .bind(userId, planCode, provider, checkoutSessionId, periodNow, periodEnd).run()

    const meta = result.meta as { last_row_id?: number } | undefined
    const subscriptionId = Number(meta?.last_row_id ?? 0)

    await AuditService.write(db, {
      userId,
      action: 'billing.subscription.activated',
      entityType: 'HL_subscriptions',
      entityId: String(subscriptionId),
      metadataJson: { planCode, checkoutSessionId, providerEventId, periodEnd }
    })

    return { subscriptionId, planCode, periodEnd }
  }
}

function daysForInterval(interval: string, durationDays: number | null): number {
  if (durationDays) return durationDays
  switch (interval) {
    case 'monthly': return 30
    case 'quarterly': return 90
    case 'yearly': return 365
    default: return 30
  }
}
