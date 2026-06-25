import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { HydrationService } from './services/hydration.js'
import { AuditService } from './services/audit.js'

interface LocalEnv { DB: D1Database }
type HC = Context<{ Bindings: LocalEnv }>
function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const h = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  const row = await c.env.DB.prepare('SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND revokedAt IS NULL AND expiresAt > datetime("now")').bind(h).first<any>()
  return row?.userId || null
}

export function mountSprint5BRoutes(app: any) {
  app.get('/api/hydration/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const settings = await HydrationService.getSettings(c.env.DB, uid)
      return jr(c, ok(settings || { enabled: true, reminderEnabled: true, operatingStart: '09:00', operatingEnd: '18:00', telegramQuickAddEnabled: true, customBaseTargetMl: null, isPregnant: 0, isLactating: 0 }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.put('/api/hydration/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as any
      await HydrationService.upsertSettings(c.env.DB, uid, body)
      await AuditService.write(c.env.DB, { userId: uid, action: 'hydration.settings.update', entityType: 'HL_hydrationSettings', entityId: String(uid), metadataJson: JSON.stringify({ isPregnant: body.isPregnant, isLactating: body.isLactating }) })
      return jr(c, ok({ updated: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/hydration/today', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const dateStr = c.req.query('date') || new Date().toISOString().slice(0, 10)
      const target = await HydrationService.getOrCalculateTarget(c.env.DB, uid, dateStr)
      const logs = await HydrationService.getTodayLogs(c.env.DB, uid, dateStr)
      const totalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)
      const settings = await HydrationService.getSettings(c.env.DB, uid)
      const overhydration = totalMl > target.targetMl * 1.5
      return jr(c, ok({ date: dateStr, targetMl: target.targetMl, baseTargetMl: target.baseTargetMl, totalMl, percent: Math.round((totalMl / target.targetMl) * 100), targetReasons: target.reasons, overhydrationWarning: overhydration, settings: settings || {}, logs }, 200, s), 200)
    } catch (e) { console.error('hydration today error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/hydration/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as { amountMl: number; loggedAt?: string; notes?: string }
      if (!body.amountMl || body.amountMl < 1 || body.amountMl > 3000) return jr(c, fail('VALIDATION_ERROR', 'amountMl 1-3000.', 400, [], s), 400)
      const logId = await HydrationService.logWater(c.env.DB, uid, body.amountMl, 'web', body.loggedAt, body.notes)
      const dateStr = (body.loggedAt || new Date().toISOString()).slice(0, 10)
      const logs = await HydrationService.getTodayLogs(c.env.DB, uid, dateStr)
      const totalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)
      await HydrationService.checkOverhydration(c.env.DB, uid, dateStr, totalMl)
      return jr(c, ok({ logId, totalMl }, 201, s), 201)
    } catch (e) { console.error('hydration log error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/hydration/history', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { from, to, limit } = c.req.query()
      const logs = await HydrationService.getHistory(c.env.DB, uid, from || '2026-01-01', to || '2099-12-31', Math.min(Number(limit) || 50, 200))
      return jr(c, ok(logs, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.delete('/api/hydration/logs/:logId', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const logId = Number(c.req.param('logId'))
      const existing = await c.env.DB.prepare('SELECT id, userId, logDate FROM HL_waterIntakeLogs WHERE id = ? AND userId = ?').bind(logId, uid).first<any>()
      if (!existing) return jr(c, fail('NOT_FOUND', 'Log tidak ditemukan.', 404, [], s), 404)
      await c.env.DB.prepare('DELETE FROM HL_waterIntakeLogs WHERE id = ? AND userId = ?').bind(logId, uid).run()
      const dateStr = existing.logDate || new Date().toISOString().slice(0, 10)
      const logs = await HydrationService.getTodayLogs(c.env.DB, uid, dateStr)
      const recalculatedTotalMl = logs.reduce((sum: number, l: any) => sum + l.amountMl, 0)
      return jr(c, ok({ deleted: true, recalculatedTotalMl, overhydrationWarning: false }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal menghapus log.', 500, [], s), 500) }
  })
}
