import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { HydrationService } from './services/hydration.js'
import { AuditService } from './services/audit.js'
import { EntitlementService } from './services/entitlements.js'

interface LocalEnv { DB: D1Database }
type HC = Context<{ Bindings: LocalEnv }>
function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now(), metaExtra?: Record<string, unknown>) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s, ...metaExtra } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

function base64Url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const h = `sha256:${base64Url(buf)}`
  const row = await c.env.DB.prepare('SELECT s.userId FROM HL_sessions s JOIN HL_users u ON u.id = s.userId WHERE s.sessionTokenHash = ? AND s.revokedAt IS NULL AND s.expiresAt > datetime("now") AND u.active = 1').bind(h).first<any>()
  return row?.userId || null
}

async function requireHydration(db: D1Database, userId: number): Promise<{ ok: boolean; error?: any }> {
  try { await EntitlementService.requireEntitlement(db, userId, 'feature.hydration.use'); return { ok: true } } catch (e: any) {
    const msg = e?.message || String(e)
    if (msg.includes('ENTITLEMENT') || msg.includes('QUOTA') || msg.includes('PLAN')) return { ok: false, error: msg }
    return { ok: true }
  }
}

export function mountHydrationRoutes(app: any) {
  app.get('/api/hydration/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await requireHydration(c.env.DB, uid); if (!ent.ok) return jr(c, fail('ENTITLEMENT_REQUIRED', ent.error!, 403, [], s), 403)
      const settings = await HydrationService.getSettings(c.env.DB, uid)
      return jr(c, ok(settings || { enabled: true, reminderEnabled: true, operatingStart: '09:00', operatingEnd: '18:00', telegramQuickAddEnabled: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.put('/api/hydration/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await requireHydration(c.env.DB, uid); if (!ent.ok) return jr(c, fail('ENTITLEMENT_REQUIRED', ent.error!, 403, [], s), 403)
      const body = await c.req.json() as any
      const prev = await HydrationService.getSettings(c.env.DB, uid)
      await HydrationService.upsertSettings(c.env.DB, uid, body)
      const changed: Record<string, unknown> = {}
      for (const k of ['isPregnant','isLactating','customBaseTargetMl','enabled','reminderEnabled','operatingStart','operatingEnd','telegramQuickAddEnabled'] as const) {
        if (body[k] !== undefined && body[k] !== (prev as any)?.[k]) changed[k] = { from: (prev as any)?.[k], to: body[k] }
      }
      await AuditService.write(c.env.DB, { userId: uid, action: 'hydration.settings.update', entityType: 'HL_hydrationSettings', entityId: String(uid), metadataJson: changed })
      await c.env.DB.prepare("DELETE FROM HL_hydrationTargets WHERE userId = ? AND targetDate >= date('now')").bind(uid).run()
      return jr(c, ok({ updated: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/hydration/today', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await requireHydration(c.env.DB, uid); if (!ent.ok) return jr(c, fail('ENTITLEMENT_REQUIRED', ent.error!, 403, [], s), 403)
      const dateStr = c.req.query('date') || new Date().toISOString().slice(0, 10)
      const target = await HydrationService.getOrCalculateTarget(c.env.DB, uid, dateStr)
      const logs = await HydrationService.getTodayLogs(c.env.DB, uid, dateStr)
      const totalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)
      const overCheck = await HydrationService.checkOverhydration(c.env.DB, uid, dateStr, totalMl)
      const settings = await HydrationService.getSettings(c.env.DB, uid)
      const contractSettings = settings ? { enabled: !!settings.enabled, reminderEnabled: !!settings.reminderEnabled, operatingStart: settings.operatingStart, operatingEnd: settings.operatingEnd, telegramQuickAddEnabled: !!settings.telegramQuickAddEnabled } : { enabled: true, reminderEnabled: true, operatingStart: '09:00', operatingEnd: '18:00', telegramQuickAddEnabled: true }
      return jr(c, ok({ date: dateStr, targetMl: target.targetMl, baseTargetMl: target.baseTargetMl, totalMl, percent: Math.round((totalMl / target.targetMl) * 100), targetReasons: target.reasons, overhydrationWarning: overCheck.triggered, safetyEventId: overCheck.safetyEventId || null, settings: contractSettings, logs }, 200, s), 200)
    } catch (e) { console.error('hydration today error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/hydration/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await requireHydration(c.env.DB, uid); if (!ent.ok) return jr(c, fail('ENTITLEMENT_REQUIRED', ent.error!, 403, [], s), 403)
      const body = await c.req.json() as { amountMl: number; loggedAt?: string; notes?: string; confirmedLargeInput?: boolean }
      if (!body.amountMl || body.amountMl < 1 || body.amountMl > 3000) return jr(c, fail('VALIDATION_ERROR', 'amountMl 1-3000.', 400, [], s), 400)
      if (body.amountMl > 1000 && !body.confirmedLargeInput) return jr(c, fail('LARGE_INPUT_CONFIRMATION_REQUIRED', 'Jumlah >1000ml memerlukan konfirmasi. Kirim confirmedLargeInput=true.', 400, [], s), 400)
      const logId = await HydrationService.logWater(c.env.DB, uid, body.amountMl, 'web', body.loggedAt, body.notes, body.amountMl > 1000)
      await AuditService.write(c.env.DB, { userId: uid, action: 'hydration.log.create', entityType: 'HL_waterIntakeLogs', entityId: String(logId), metadataJson: { amountMl: body.amountMl, source: 'web' } })
      const dateStr = (body.loggedAt || new Date().toISOString()).slice(0, 10)
      const target = await HydrationService.getOrCalculateTarget(c.env.DB, uid, dateStr)
      const logs = await HydrationService.getTodayLogs(c.env.DB, uid, dateStr)
      const totalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)
      const overCheck = await HydrationService.checkOverhydration(c.env.DB, uid, dateStr, totalMl)
      const metaExtra: Record<string, unknown> = {}
      if (overCheck.triggered) metaExtra.warningCode = 'HYDRATION_OVER_LIMIT'
      return jr(c, ok({ logId, amountMl: body.amountMl, totalMl, targetMl: target.targetMl, percent: Math.round((totalMl / target.targetMl) * 100), overhydrationWarning: overCheck.triggered, safetyEventId: overCheck.safetyEventId || null, warningMessage: overCheck.triggered ? 'Minum terlalu banyak air dalam waktu singkat bisa berbahaya. Periksa kembali catatan Anda.' : undefined }, 201, s, metaExtra), 201)
    } catch (e) { console.error('hydration log error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/hydration/history', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await requireHydration(c.env.DB, uid); if (!ent.ok) return jr(c, fail('ENTITLEMENT_REQUIRED', ent.error!, 403, [], s), 403)
      const { from, to, limit } = c.req.query()
      const now = new Date()
      const defaultFrom = new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10)
      const dailyLogs = await HydrationService.getHistoryDaily(c.env.DB, uid, from || defaultFrom, to || now.toISOString().slice(0, 10), Math.min(Number(limit) || 50, 200))
      const enriched = await Promise.all(dailyLogs.map(async (row: any) => {
        const target = await HydrationService.getOrCalculateTarget(c.env.DB, uid, row.date)
        const totalMl = Number(row.totalMl) || 0
        return { date: row.date, targetMl: target.targetMl, totalMl, percent: Math.round((totalMl / target.targetMl) * 100), overhydrationWarning: totalMl > 5000, logCount: Number(row.logCount) || 0 }
      }))
      return jr(c, ok(enriched, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.delete('/api/hydration/logs/:logId', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await requireHydration(c.env.DB, uid); if (!ent.ok) return jr(c, fail('ENTITLEMENT_REQUIRED', ent.error!, 403, [], s), 403)
      const logId = Number(c.req.param('logId'))
      const result = await HydrationService.deleteLog(c.env.DB, logId, uid)
      if (!result.deleted) return jr(c, fail('NOT_FOUND', 'Log tidak ditemukan.', 404, [], s), 404)
      await AuditService.write(c.env.DB, { userId: uid, action: 'hydration.log.delete', entityType: 'HL_waterIntakeLogs', entityId: String(logId), metadataJson: {} })
      const dateStr = result.logDate || new Date().toISOString().slice(0, 10)
      const target = await HydrationService.getOrCalculateTarget(c.env.DB, uid, dateStr)
      const logs = await HydrationService.getTodayLogs(c.env.DB, uid, dateStr)
      const recalculatedTotalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)
      return jr(c, ok({ deleted: true, recalculatedTotalMl, targetMl: target.targetMl, overhydrationWarning: recalculatedTotalMl > 5000 }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal menghapus log.', 500, [], s), 500) }
  })
}
