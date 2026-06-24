import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { CycleService } from './services/cycle.js'
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

export function mountSprint5DRoutes(app: any) {
  app.get('/api/cycle/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      const prediction = settings ? CycleService.predictFertileWindow(settings) : null
      const irregularity = settings ? CycleService.detectIrregularity(settings) : null
      return jr(c, ok({ settings, prediction, irregularity }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.put('/api/cycle/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as any
      await CycleService.upsertSettings(c.env.DB, uid, body)
      return jr(c, ok({ updated: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/cycle/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as any
      if (!body.logDate) return jr(c, fail('VALIDATION_ERROR', 'logDate wajib.', 400, [], s), 400)
      await CycleService.logDay(c.env.DB, uid, body)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      const logs = await CycleService.getLogs(c.env.DB, uid, (body.logDate || '').slice(0, 7) + '-01', body.logDate)
      const prediction = settings ? CycleService.predictFertileWindow(settings) : null
      const guardrail = CycleService.checkContraceptionGuardrail(logs, prediction)
      if (guardrail?.needsGuardrail) {
        await c.env.DB.prepare('INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(uid, 'cycle', body.logDate, 'cycleIrregularity', 'warning', guardrail.type, guardrail.message, 'queued').run()
      }
      return jr(c, ok({ logDate: body.logDate, guardrail: guardrail?.needsGuardrail ? guardrail : null }, 201, s), 201)
    } catch (e) { console.error('cycle log error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { from, to } = c.req.query()
      const logs = await CycleService.getLogs(c.env.DB, uid, from || '2026-01-01', to || '2099-12-31')
      return jr(c, ok(logs, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/prediction', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      if (!settings || !settings.lastPeriodStart) return jr(c, ok({ prediction: null, message: 'Atur siklus terlebih dahulu.' }, 200, s), 200)
      const prediction = CycleService.predictFertileWindow(settings)
      const irregularity = CycleService.detectIrregularity(settings)
      return jr(c, ok({ prediction, irregularity }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })
}
