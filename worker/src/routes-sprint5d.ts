import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { CycleService } from './services/cycle.js'
import { AuditService } from './services/audit.js'
import { EntitlementService } from './services/entitlements.js'
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

async function isCycleEligible(db: D1Database, uid: number): Promise<boolean> {
  const profile = await db.prepare('SELECT sex, birthDate FROM HL_userProfiles WHERE userId = ?').bind(uid).first<any>()
  if (!profile || profile.sex !== 'female') return false
  if (profile.birthDate) {
    const age = Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / (365.25 * 86400000))
    if (age < 15 || age > 48) return false
  }
  return true
}

export function mountSprint5DRoutes(app: any) {
  app.get('/api/cycle/access', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const eligible = await isCycleEligible(c.env.DB, uid)
      return jr(c, ok({ eligible, reason: eligible ? null : 'NOT_ELIGIBLE' }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await isCycleEligible(c.env.DB, uid)) return jr(c, fail('CYCLE_NOT_ELIGIBLE', 'Anda tidak memenuhi syarat untuk pelacakan siklus.', 403, [], s), 403)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, uid, 'feature.cycleTracking.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur ini memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], s), 403)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      const prediction = settings ? CycleService.predictFertileWindow(settings) : null
      const irregularity = settings ? CycleService.detectIrregularity(settings) : null
      return jr(c, ok({ settings, prediction, irregularity }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.put('/api/cycle/settings', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await isCycleEligible(c.env.DB, uid)) return jr(c, fail('CYCLE_NOT_ELIGIBLE', 'Anda tidak memenuhi syarat untuk pelacakan siklus.', 403, [], s), 403)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, uid, 'feature.cycleTracking.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur ini memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], s), 403)
      const body = await c.req.json() as any
      await CycleService.upsertSettings(c.env.DB, uid, body)
      await AuditService.write(c.env.DB, { userId: uid, action: 'cycle.settings.update', entityType: 'HL_cycleSettings', entityId: String(uid), metadataJson: JSON.stringify(body) })
      return jr(c, ok({ updated: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/calendar', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await isCycleEligible(c.env.DB, uid)) return jr(c, fail('CYCLE_NOT_ELIGIBLE', 'Anda tidak memenuhi syarat untuk pelacakan siklus.', 403, [], s), 403)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, uid, 'feature.cycleTracking.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur ini memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], s), 403)
      const { month, year } = c.req.query()
      const settings = await CycleService.getSettings(c.env.DB, uid)
      if (!settings || !settings.lastPeriodStart || settings.predictionPaused) return jr(c, ok({ phases: [], message: settings?.predictionPaused ? 'Prediksi dijeda.' : 'Atur siklus terlebih dahulu.' }, 200, s), 200)
      const prediction = CycleService.predictFertileWindow(settings)
      return jr(c, ok({ prediction, phaseLegend: { period: 'Haid', fertile: 'Subur', ovulation: 'Ovulasi', luteal: 'Luteal' } }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/cycle/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await isCycleEligible(c.env.DB, uid)) return jr(c, fail('CYCLE_NOT_ELIGIBLE', 'Anda tidak memenuhi syarat untuk pelacakan siklus.', 403, [], s), 403)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, uid, 'feature.cycleTracking.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur ini memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], s), 403)
      const body = await c.req.json() as any
      if (!body.logDate) return jr(c, fail('VALIDATION_ERROR', 'logDate wajib.', 400, [], s), 400)
      await CycleService.logDay(c.env.DB, uid, body)
      const settings = await CycleService.getSettings(c.env.DB, uid)
      const logs = await CycleService.getLogs(c.env.DB, uid, (body.logDate || '').slice(0, 7) + '-01', body.logDate)
      const prediction = settings ? CycleService.predictFertileWindow(settings) : null
      const guardrail = CycleService.checkContraceptionGuardrail(logs, prediction)
      if (guardrail?.needsGuardrail) {
        await c.env.DB.prepare('INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(uid, 'cycle', body.logDate, 'cycleContraceptionWarning', 'warning', guardrail.type, guardrail.message, 'queued').run()
      }
      return jr(c, ok({ logDate: body.logDate, guardrail: guardrail?.needsGuardrail ? guardrail : null }, 201, s), 201)
    } catch (e) { console.error('cycle log error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/cycle/logs', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await isCycleEligible(c.env.DB, uid)) return jr(c, fail('CYCLE_NOT_ELIGIBLE', 'Anda tidak memenuhi syarat untuk pelacakan siklus.', 403, [], s), 403)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, uid, 'feature.cycleTracking.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur ini memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], s), 403)
      const { from, to } = c.req.query()
      const logs = await CycleService.getLogs(c.env.DB, uid, from || '2026-01-01', to || '2099-12-31')
      return jr(c, ok(logs, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/cycle/guardrails/acknowledge', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await isCycleEligible(c.env.DB, uid)) return jr(c, fail('CYCLE_NOT_ELIGIBLE', 'Anda tidak memenuhi syarat untuk pelacakan siklus.', 403, [], s), 403)
      const body = await c.req.json() as { logDate?: string; acknowledgementType?: string }
      if (!body.logDate) return jr(c, fail('VALIDATION_ERROR', 'logDate wajib.', 400, [], s), 400)
      await c.env.DB.prepare('INSERT INTO HL_cycleGuardrailAcknowledgements (userId, logDate, acknowledgementType, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').bind(uid, body.logDate, body.acknowledgementType || 'contraception').run()
      await AuditService.write(c.env.DB, { userId: uid, action: 'cycle.guardrail.acknowledge', entityType: 'HL_cycleGuardrailAcknowledgements', entityId: body.logDate, metadataJson: JSON.stringify({ acknowledgementType: body.acknowledgementType || 'contraception' }) })
      return jr(c, ok({ acknowledged: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/family-links/:familyLinkId/permissions/cycle', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const familyLinkId = Number(c.req.param('familyLinkId'))
      const perm = await c.env.DB.prepare('SELECT canViewCycle, canViewSymptoms, canViewHydration, canViewAiReport FROM HL_familyPermissions WHERE familyLinkId = ?').bind(familyLinkId).first<any>()
      return jr(c, ok(perm || { canViewCycle: false, canViewSymptoms: false, canViewHydration: false, canViewAiReport: false }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.put('/api/family-links/:familyLinkId/permissions/sensitive-health', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as { canViewCycle?: boolean; canViewSymptoms?: boolean; canViewHydration?: boolean; canViewAiReport?: boolean }
      const familyLinkId = Number(c.req.param('familyLinkId'))
      const existing = await c.env.DB.prepare('SELECT id FROM HL_familyPermissions WHERE familyLinkId = ?').bind(familyLinkId).first<any>()
      if (existing) {
        const sets: string[] = []; const vals: unknown[] = []
        if (body.canViewCycle !== undefined) { sets.push('canViewCycle = ?'); vals.push(body.canViewCycle ? 1 : 0) }
        if (body.canViewSymptoms !== undefined) { sets.push('canViewSymptoms = ?'); vals.push(body.canViewSymptoms ? 1 : 0) }
        if (body.canViewHydration !== undefined) { sets.push('canViewHydration = ?'); vals.push(body.canViewHydration ? 1 : 0) }
        if (body.canViewAiReport !== undefined) { sets.push('canViewAiReport = ?'); vals.push(body.canViewAiReport ? 1 : 0) }
        if (sets.length) { sets.push('updatedAt = CURRENT_TIMESTAMP'); await c.env.DB.prepare(`UPDATE HL_familyPermissions SET ${sets.join(', ')} WHERE familyLinkId = ?`).bind(...vals as any[], familyLinkId).run() }
      } else {
        await c.env.DB.prepare('INSERT INTO HL_familyPermissions (familyLinkId, canViewCycle, canViewSymptoms, canViewHydration, canViewAiReport, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(familyLinkId, body.canViewCycle ? 1 : 0, body.canViewSymptoms ? 1 : 0, body.canViewHydration ? 1 : 0, body.canViewAiReport ? 1 : 0).run()
      }
      await AuditService.write(c.env.DB, { userId: uid, action: 'family.sensitiveHealth.permissions.update', entityType: 'HL_familyPermissions', entityId: String(familyLinkId), metadataJson: JSON.stringify(body) })
      return jr(c, ok({ updated: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })
}
