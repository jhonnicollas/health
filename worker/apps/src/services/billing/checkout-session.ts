import type { BillingProviderCode } from './provider.js'

export interface CheckoutSession {
  id: string
  userId: number
  planCode: string
  provider: string
  mode: string
  merchantRef: string
  providerCheckoutId: string | null
  checkoutUrl: string | null
  amount: number
  currency: string
  status: string
  successUrl: string | null
  cancelUrl: string | null
  paidAt: string | null
  expiresAt: string | null
  metadataJson: string | null
  createdAt: string
  updatedAt: string
}

function randomId(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  let result = ''
  for (let i = 0; i < length; i++) result += chars[bytes[i] % chars.length]
  return result
}

export const CheckoutSessionService = {
  async createPendingCheckout(
    db: D1Database,
    userId: number,
    planCode: string,
    currency: string,
    provider: BillingProviderCode,
    mode: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<CheckoutSession> {
    const plan = await db.prepare('SELECT planCode, planName, priceAmount, currency, active FROM HL_plans WHERE planCode = ?')
      .bind(planCode).first<{ planCode: string; planName: string; priceAmount: number; currency: string; active: number }>()
    if (!plan) throw Object.assign(new Error('Plan tidak ditemukan.'), { code: 'PLAN_NOT_FOUND', status: 400 })
    if (!plan.active) throw Object.assign(new Error('Plan tidak aktif.'), { code: 'PLAN_INACTIVE', status: 400 })
    if (plan.priceAmount <= 0) throw Object.assign(new Error('Plan gratis tidak memerlukan pembayaran.'), { code: 'FREE_PLAN', status: 400 })

    const id = `chk_${randomId(12)}`
    const merchantRef = `ISEHAT-${randomId(8)}`
    const providerCode = provider === 'xendit_test' || provider === 'xendit_live' ? 'xendit' : 'mock'
    const amount = plan.priceAmount
    const cur = currency || plan.currency || 'IDR'

    await db.prepare(`INSERT INTO HL_billingCheckoutSessions (id, userId, planCode, provider, mode, merchantRef, amount, currency, status, successUrl, cancelUrl, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now','+1 day'))`)
      .bind(id, userId, planCode, providerCode, mode, merchantRef, amount, cur, successUrl, cancelUrl).run()

    const session = await db.prepare('SELECT * FROM HL_billingCheckoutSessions WHERE id = ?').bind(id).first<CheckoutSession>()
    return session!
  },

  async attachProviderCheckout(
    db: D1Database,
    merchantRef: string,
    providerCheckoutId: string,
    checkoutUrl: string
  ): Promise<void> {
    await db.prepare(`UPDATE HL_billingCheckoutSessions SET providerCheckoutId = ?, checkoutUrl = ?, updatedAt = CURRENT_TIMESTAMP WHERE merchantRef = ?`)
      .bind(providerCheckoutId, checkoutUrl, merchantRef).run()
  },

  async getByMerchantRef(db: D1Database, merchantRef: string): Promise<CheckoutSession | null> {
    return db.prepare('SELECT * FROM HL_billingCheckoutSessions WHERE merchantRef = ?').bind(merchantRef).first<CheckoutSession>()
      .then(r => r || null)
  },

  async getById(db: D1Database, id: string): Promise<CheckoutSession | null> {
    return db.prepare('SELECT * FROM HL_billingCheckoutSessions WHERE id = ?').bind(id).first<CheckoutSession>()
      .then(r => r || null)
  },

  async getByProviderCheckoutId(db: D1Database, provider: string, providerCheckoutId: string): Promise<CheckoutSession | null> {
    return db.prepare('SELECT * FROM HL_billingCheckoutSessions WHERE provider = ? AND providerCheckoutId = ?')
      .bind(provider, providerCheckoutId).first<CheckoutSession>().then(r => r || null)
  },

  async markPaid(db: D1Database, id: string, paidAt?: string): Promise<void> {
    await db.prepare(`UPDATE HL_billingCheckoutSessions SET status = 'paid', paidAt = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'`)
      .bind(paidAt || new Date().toISOString(), id).run()
  },

  async markFailed(db: D1Database, id: string): Promise<void> {
    await db.prepare(`UPDATE HL_billingCheckoutSessions SET status = 'failed', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(id).run()
  },

  async markExpired(db: D1Database, id: string): Promise<void> {
    await db.prepare(`UPDATE HL_billingCheckoutSessions SET status = 'expired', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(id).run()
  },

  async markCancelled(db: D1Database, id: string): Promise<void> {
    await db.prepare(`UPDATE HL_billingCheckoutSessions SET status = 'cancelled', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(id).run()
  },

  async listUserSessions(db: D1Database, userId: number, limit = 50): Promise<CheckoutSession[]> {
    const result = await db.prepare('SELECT * FROM HL_billingCheckoutSessions WHERE userId = ? ORDER BY createdAt DESC LIMIT ?')
      .bind(userId, limit).all<CheckoutSession>()
    return result.results || []
  }
}
