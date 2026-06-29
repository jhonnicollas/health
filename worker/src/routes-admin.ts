// Sprint 5 Foundation — Admin Routes (unique routes only)
// Duplicates removed: education, ai context/memory, symptoms, cron are in routes-auth/ai/telegram.
// This file only registers routes NOT present in any other route module.
import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { AuditService } from './services/audit.js'
import { EntitlementService, QuotaService } from './services/entitlements.js'
import { RbacService } from './services/rbac.js'

interface LocalEnv { DB: D1Database; TELEGRAM_WATER_WEBHOOK_SECRET?: string; INTERNAL_API_SECRET?: string; LOGS?: R2Bucket }
type HC = Context<{ Bindings: LocalEnv }>

function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

function base64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
async function sha256Token(val: string): Promise<string> { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val)); return `sha256:${base64Url(buf)}` }

async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const h = await sha256Token(token)
  const row = await c.env.DB.prepare('SELECT s.userId FROM HL_sessions s JOIN HL_users u ON u.id = s.userId WHERE s.sessionTokenHash = ? AND s.revokedAt IS NULL AND s.expiresAt > datetime("now") AND u.active = 1').bind(h).first<any>()
  return row?.userId || null
}

function getInsertedId(result: D1Result<unknown>): number { const meta = result.meta as any; return Number(meta?.last_row_id ?? 0) }

async function requireAdmin(db: D1Database, uid: number) { if (!await RbacService.hasPermission(db, uid, 'admin.access')) throw new Error('FORBIDDEN') }

export function mountAdminRoutes(app: any) {

  // Admin dashboard summary (unique)
  app.get('/api/admin/dashboard/summary', async (c: HC) => {
    const s = Date.now()
    try {
      const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      await requireAdmin(c.env.DB, uid)
      const [totalUsers, activeSubs, totalSafetyEvents, totalAuditLogs, totalMeasurements] = await Promise.all([
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_users WHERE active = 1').first<any>(),
        c.env.DB.prepare("SELECT COUNT(*) as c FROM HL_subscriptions WHERE status IN ('active','trialing')").first<any>(),
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_safetyEvents').first<any>(),
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_auditLogs').first<any>(),
        c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_measurementSessions').first<any>()
      ])
      return jr(c, ok({ totalUsers: totalUsers?.c ?? 0, activeSubscriptions: activeSubs?.c ?? 0, totalSafetyEvents: totalSafetyEvents?.c ?? 0, totalAuditLogs: totalAuditLogs?.c ?? 0, totalMeasurements: totalMeasurements?.c ?? 0 }, 200, s), 200)
    } catch (e: any) { if (e.message === 'FORBIDDEN') return jr(c, fail('FORBIDDEN', 'Akses admin diperlukan.', 403, [], s), 403); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  // Public plan listing (unique — no auth)
  app.get('/api/plans', async (c: HC) => {
    const s = Date.now()
    try {
      const rows = await c.env.DB.prepare('SELECT planCode, planName, billingInterval, durationDays, priceAmount, currency, trialDays, description, active, sortOrder FROM HL_plans WHERE active = 1 ORDER BY sortOrder ASC').all<any>()
      const plans = await Promise.all((rows.results || []).map(async (p: any) => {
        const feats = await c.env.DB.prepare('SELECT featureCode, enabled, quotaLimit, quotaWindow FROM HL_planFeatures WHERE planCode = ?').bind(p.planCode).all<any>()
        const fmap: Record<string, any> = {}
        for (const f of (feats.results || [])) fmap[f.featureCode] = { enabled: f.enabled === 1, quotaLimit: f.quotaLimit, quotaWindow: f.quotaWindow }
        return { ...p, features: fmap }
      }))
      return jr(c, ok({ plans }, 200, s), 200)
    } catch (e: any) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  // Deprecated: self-service subscribe — replaced by POST /api/billing/checkout
  app.post('/api/me/subscribe', async (c: HC) => {
    const s = Date.now()
    return jr(c, fail('DEPRECATED', 'Gunakan POST /api/billing/checkout untuk upgrade. Endpoint ini sudah tidak digunakan.', 410, [], s), 410)
  })
}
