import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { CycleService } from './services/cycle.js'
import { AuditService } from './services/audit.js'
import { EntitlementService } from './services/entitlements.js'
interface LocalEnv { DB: D1Database; AI_MEMORY_QUEUE?: Queue }
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

async function isCycleEligible(db: D1Database, uid: number): Promise<{ eligible: boolean; reason?: string; sex?: string; ageYears?: number }> {
  const profile = await db.prepare('SELECT sex, birthDate FROM HL_userProfiles WHERE userId = ?').bind(uid).first<any>()
  if (!profile || profile.sex !== 'female') return { eligible: false, reason: 'NOT_ELIGIBLE', sex: profile?.sex }
  let ageYears: number | undefined
  if (profile.birthDate) {
    ageYears = Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 86400000))
    if (ageYears < 15 || ageYears > 48) return { eligible: false, reason: 'NOT_ELIGIBLE', sex: 'female', ageYears }
  }
  return { eligible: true, sex: 'female', ageYears }
}

async function requireCycleEligible(db: D1Database, uid: number): Promise<{ eligible: boolean; info?: any }> {
  const info = await isCycleEligible(db, uid)
  if (!info.eligible) return { eligible: false, info }
  const ent = await EntitlementService.requireEntitlement(db, uid, 'feature.cycleTracking.use')
  if (!ent.allowed) return { eligible: false, info: { reason: 'ENTITLEMENT_REQUIRED' } }
  return { eligible: true, info }
}

export function mountCycleRoutes(app: any) {
  app.get('/api/cycle/access', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const info = await isCycleEligible(c.env.DB, uid)
      if (!info.eligible) return jr(c, fail('CYCLE_ACCESS_DENIED', 'Fitur cycle tracking hanya tersedia untuk pengguna perempuan usia 15–48 tahun.', 403, [{ reason: info.reason }], s), 403)
      return jr(c, ok({ eligible: true, reason: null, sex: info.sex, ageYears: info.ageYears, canSeeMenu: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { eligible, info } = await requireCycleEligible(c.env.DB, uid)
      if (!eligible) return jr(c, fail(info?.reason === 'ENTITLEMENT_REQUIRED' ? 'ENTITLEMENT_REQUIRED' : 'CYCLE_ACCESS_DENIED', 'Akses ditolak.', 403, [], s), 403)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      const prediction = settings ? CycleService.predictFertileWindow(settings) : null
      return jr(c, ok({ settings, prediction }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.put('/api/cycle/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { eligible, info } = await requireCycleEligible(c.env.DB, uid)
      if (!eligible) return jr(c, fail(info?.reason === 'ENTITLEMENT_REQUIRED' ? 'ENTITLEMENT_REQUIRED' : 'CYCLE_ACCESS_DENIED', 'Akses ditolak.', 403, [], s), 403)
      const body = await c.req.json() as any
      try {
        const result = await CycleService.upsertSettings(c.env.DB, uid, body)
        await AuditService.write(c.env.DB, { userId: uid, action: 'cycle.settings.update', entityType: 'HL_cycleSettings', entityId: String(uid), metadataJson: JSON.stringify(body) })
        return jr(c, ok({ updated: true, predictionPaused: result.predictionPaused, pauseReason: result.pauseReason, hydrationRecalculationQueued: result.hydrationSync }, 200, s), 200)
      } catch (e: any) { if (e?.message?.startsWith('VALIDATION:')) return jr(c, fail('VALIDATION_ERROR', `Validasi gagal: ${e.message.split(':')[1]}`, 400, [], s), 400); throw e }
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/calendar', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { eligible, info } = await requireCycleEligible(c.env.DB, uid)
      if (!eligible) return jr(c, fail(info?.reason === 'ENTITLEMENT_REQUIRED' ? 'ENTITLEMENT_REQUIRED' : 'CYCLE_ACCESS_DENIED', 'Akses ditolak.', 403, [], s), 403)
      const month = c.req.query('month') || new Date().toISOString().slice(0, 7)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      if (!settings || !settings.lastPeriodStart) return jr(c, ok({ month, predictionPaused: false, pauseReason: null, days: [], phaseLegend: { period: 'Haid', fertile: 'Masa subur', ovulation: 'Puncak ovulasi', outsideFertile: 'Di luar prediksi masa subur', paused: 'Prediksi dijeda' }, message: 'Atur siklus terlebih dahulu.' }, 200, s), 200)
      if (settings.predictionPaused) return jr(c, ok({ month, predictionPaused: true, pauseReason: settings.pauseReason, days: [], copyPolicy: { avoidLabel: 'Masa Aman', outsideFertileLabel: 'Di luar prediksi masa subur' }, phaseLegend: { period: 'Haid', fertile: 'Masa subur', ovulation: 'Puncak ovulasi', outsideFertile: 'Di luar prediksi masa subur', paused: 'Prediksi dijeda' }, message: 'Prediksi siklus dijeda karena status hamil/menopause/siklus tidak teratur.' }, 200, s), 200)
      const [y, m] = month.split('-').map(Number)
      const from = `${y}-${String(m).padStart(2,'0')}-01`
      const to = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`
      const logs = await CycleService.getLogs(c.env.DB, uid, from, to)
      const days = CycleService.buildCalendarDays(settings, logs, month)
      return jr(c, ok({ month, predictionPaused: false, pauseReason: null, copyPolicy: { avoidLabel: 'Masa Aman', outsideFertileLabel: 'Di luar prediksi masa subur' }, phaseLegend: { period: 'Haid', fertile: 'Masa subur', ovulation: 'Puncak ovulasi', outsideFertile: 'Di luar prediksi masa subur', paused: 'Prediksi dijeda' }, days }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/cycle/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { eligible, info } = await requireCycleEligible(c.env.DB, uid)
      if (!eligible) return jr(c, fail(info?.reason === 'ENTITLEMENT_REQUIRED' ? 'ENTITLEMENT_REQUIRED' : 'CYCLE_ACCESS_DENIED', 'Akses ditolak.', 403, [], s), 403)
      const body = await c.req.json() as any
      if (!body.logDate) return jr(c, fail('VALIDATION_ERROR', 'logDate wajib.', 400, [], s), 400)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      const prediction = settings ? CycleService.predictFertileWindow(settings) : null
      if (body.unprotected && !body.contraceptionGuardrailAcknowledged) {
        const guardrail = CycleService.checkContraceptionGuardrail(body, prediction)
        return jr(c, ok({ saved: false, requiresContraceptionGuardrail: true, guardrailType: guardrail?.type || 'unprotected', guardrailMessage: guardrail?.message || '' }, 200, s), 200)
      }
      await CycleService.logDay(c.env.DB, uid, body)
      const { meta: logMeta } = await c.env.DB.prepare('SELECT id FROM HL_cycleLogs WHERE userId = ? AND logDate = ?').bind(uid, body.logDate).first<any>()
      let irregularitySafetyEventId: number | null = null
      let predictionPaused = false
      if (settings) {
        const irregularity = await CycleService.detectIrregularity(c.env.DB, settings, uid)
        if (irregularity?.isIrregular) { irregularitySafetyEventId = irregularity.safetyEventId || null; predictionPaused = true }
      }
      return jr(c, ok({ logId: logMeta || null, saved: true, requiresContraceptionGuardrail: false, irregularitySafetyEventId, predictionPaused }, 201, s), 201)
    } catch (e) { console.error('cycle log error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { eligible, info } = await requireCycleEligible(c.env.DB, uid)
      if (!eligible) return jr(c, fail(info?.reason === 'ENTITLEMENT_REQUIRED' ? 'ENTITLEMENT_REQUIRED' : 'CYCLE_ACCESS_DENIED', 'Akses ditolak.', 403, [], s), 403)
      const { from, to } = c.req.query()
      const logs = await CycleService.getLogs(c.env.DB, uid, from || '2026-01-01', to || '2099-12-31')
      return jr(c, ok(logs, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/cycle/guardrails/acknowledge', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { eligible } = await requireCycleEligible(c.env.DB, uid)
      if (!eligible) return jr(c, fail('CYCLE_ACCESS_DENIED', 'Akses ditolak.', 403, [], s), 403)
      const body = await c.req.json() as { relatedDate?: string; guardrailType?: string }
      if (!body.relatedDate) return jr(c, fail('VALIDATION_ERROR', 'relatedDate wajib.', 400, [], s), 400)
      const gtype = body.guardrailType || 'outsideFertileWindow'
      if (!['outsideFertileWindow','unprotected','calendarMethod'].includes(gtype)) return jr(c, fail('VALIDATION_ERROR', 'guardrailType tidak valid.', 400, [], s), 400)
      await c.env.DB.prepare('INSERT INTO HL_cycleGuardrailAcknowledgements (userId, guardrailType, relatedDate, messageVersion, acknowledgedAt, createdAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(uid, gtype, body.relatedDate, 'sprint5.v1').run()
      await AuditService.write(c.env.DB, { userId: uid, action: 'cycle.guardrail.acknowledge', entityType: 'HL_cycleGuardrailAcknowledgements', entityId: body.relatedDate, metadataJson: JSON.stringify({ guardrailType: gtype }) })
      return jr(c, ok({ acknowledged: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/family-links/:familyLinkId/permissions/cycle', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const familyLinkId = Number(c.req.param('familyLinkId'))
      const perms = await c.env.DB.prepare("SELECT permissionCode, allowed FROM HL_familyPermissions WHERE familyLinkId = ? AND permissionCode IN ('family.cycle.read','family.symptom.read','family.hydration.read','family.aiReport.read')").bind(familyLinkId).all<any>()
      const permMap: Record<string, boolean> = { 'family.cycle.read': false, 'family.symptom.read': false, 'family.hydration.read': false, 'family.aiReport.read': false }
      for (const r of (perms.results || [])) { if (r.permissionCode in permMap) permMap[r.permissionCode] = !!r.allowed }
      return jr(c, ok({ permissions: permMap }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.put('/api/family-links/:familyLinkId/permissions/sensitive-health', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as Record<string, boolean>
      const familyLinkId = Number(c.req.param('familyLinkId'))
      const link = await c.env.DB.prepare('SELECT ownerUserId FROM HL_familyLinks WHERE id = ?').bind(familyLinkId).first<any>()
      if (link && link.ownerUserId !== uid) return jr(c, fail('FORBIDDEN', 'Hanya owner yang dapat mengubah permission.', 403, [], s), 403)
      const permCodes: Record<string, string> = { canViewCycle: 'family.cycle.read', canViewSymptoms: 'family.symptom.read', canViewHydration: 'family.hydration.read', canViewAiReport: 'family.aiReport.read' }
      for (const [bodyKey, permCode] of Object.entries(permCodes)) {
        if (body[bodyKey] !== undefined) {
          const al = body[bodyKey] ? 1 : 0
          await c.env.DB.prepare('INSERT INTO HL_familyPermissions (familyLinkId, permissionCode, allowed, grantedBy, grantedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(familyLinkId, permissionCode) DO UPDATE SET allowed = ?, grantedBy = ?, grantedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP').bind(familyLinkId, permCode, al, uid, al, uid).run()
        }
      }
      await AuditService.write(c.env.DB, { userId: uid, action: 'family.sensitiveHealth.permissions.update', entityType: 'HL_familyPermissions', entityId: String(familyLinkId), metadataJson: JSON.stringify(body) })
      return jr(c, ok({ updated: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })
}
