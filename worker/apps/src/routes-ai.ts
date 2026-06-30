import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { AiMemoryService } from './services/ai-memory.js'
import { AuditService } from './services/audit.js'
import { RbacService } from './services/rbac.js'
import { EntitlementService } from './services/entitlements.js'
import {
  insertAndGetId,
  getRecentValues,
  filterUnsafeContent,
  extractPatternScore,
  callConfiguredTextAi
} from './utils/index-helpers.js'
import { parseLocale } from './i18n/locale.js'
import { getAiDisclaimer } from './i18n/disclaimer-templates.js'

interface LocalEnv { DB: D1Database; AI_MEMORY_QUEUE?: Queue; VECTORIZE_INDEX?: any; AI_SERVICE?: Fetcher }
type HC = Context<{ Bindings: LocalEnv }>
function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

function base64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}
async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const h = `sha256:${base64Url(buf)}`
  const row = await c.env.DB.prepare('SELECT s.userId FROM HL_sessions s JOIN HL_users u ON u.id = s.userId WHERE s.sessionTokenHash = ? AND s.revokedAt IS NULL AND s.expiresAt > datetime("now") AND u.active = 1').bind(h).first<any>()
  return row?.userId || null
}

const VALID_PURPOSES = ['contextReadiness','assistantContext','reportContext','sprint6Readiness']
const VALID_SOURCE_TYPES = ['measurement','symptom','safetyEvent','hydration','cycle','medication','fasting','pattern','report','education']

export function mountAiRoutes(app: any) {
  // Service Binding health probe — S6A-T-02
  app.get('/api/ai/probe', async (c: HC) => {
    const s = Date.now()
    try {
      if (!c.env.AI_SERVICE) {
        return jr(c, fail('INTERNAL_ERROR', 'AI_SERVICE binding not configured.', 503, [], s), 503)
      }
      const res = await c.env.AI_SERVICE.fetch(new Request('https://ai-service.internal/health', { method: 'GET' }))
      if (!res.ok) {
        return jr(c, fail('AI_SERVICE_UNAVAILABLE', `AI worker returned HTTP ${res.status}.`, 502, [], s), 502)
      }
      const payload = await res.json() as any
      const status = payload?.data?.status || payload?.status || 'unknown'
      return c.json({ ok: status === 'ok', aiWorker: { status, worker: payload?.data?.worker || payload?.worker }, meta: { checkedAt: new Date().toISOString() } }, 200)
    } catch (e) {
      console.error('AI service probe failed:', e)
      return jr(c, fail('AI_SERVICE_ERROR', 'Failed to reach AI worker via Service Binding.', 502, [], s), 502)
    }
  })

  app.post('/api/ai/context/query', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, uid, 'feature.vectorMemory.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur AI Memory memerlukan paket Premium.', 403, [], s), 403)
      const body = await c.req.json() as { query?: string; topK?: number; clinicalCopilotMode?: boolean; purpose?: string; sourceTypes?: string[]; minScore?: number }
      if (body.clinicalCopilotMode) return jr(c, { body: { success: false, error: { code: 'AI_CLINICAL_COPILOT_DEFERRED', message: 'AI Clinical Copilot runtime is deferred to Sprint 6.', details: [{ scopeStatus: 'deferred_to_sprint6' }] }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status: 403 } as any, 403)
      const topK = Math.min(Math.max(body.topK || 8, 1), 20)
      if (body.purpose && !VALID_PURPOSES.includes(body.purpose)) return jr(c, fail('VALIDATION_ERROR', 'purpose tidak valid.', 400, [], s), 400)
      if (body.sourceTypes) { const invalid = body.sourceTypes.filter(t => !VALID_SOURCE_TYPES.includes(t)); if (invalid.length) return jr(c, fail('VALIDATION_ERROR', `sourceTypes tidak valid: ${invalid.join(',')}`, 400, [], s), 400) }
      const minScore = body.minScore ?? 0
      const namespace = `user:${uid}`
      let usedVectorContext = false; let matches: any[] = []; let fallbackReason: string | null = 'VECTORIZE_UNAVAILABLE'
      if (c.env.VECTORIZE_INDEX) {
        try {
          const results = await c.env.VECTORIZE_INDEX.query(body.query || '', { topK, namespace, returnValues: false, returnMetadata: true })
          matches = (results.matches || []).filter((m: any) => (m.score || 0) >= minScore).map((m: any) => ({ vectorId: m.id, sourceType: m.metadata?.sourceType, sourceId: m.metadata?.sourceId, score: m.score, textPreview: m.metadata?.textPreview, occurredAt: m.metadata?.occurredAt }))
          usedVectorContext = true; fallbackReason = null
        } catch { fallbackReason = 'VECTORIZE_ERROR' }
      }
      const queryId = await AiMemoryService.logContextQuery(c.env.DB, uid, body.query || '', topK, usedVectorContext, fallbackReason, Date.now() - s, JSON.stringify(matches.slice(0, 3)))
      const data: any = { usedVectorContext, queryId, namespace, scopeStatus: 'sprint5_infrastructure_only', sprint6ClinicalCopilotReady: false, matches }
      if (!usedVectorContext) data.fallbackReason = fallbackReason
      return jr(c, ok(data, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/ai/context-package', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const limit = Math.min(Number(c.req.query('limit')) || 10, 50)
      const context = await AiMemoryService.buildContextPackage(c.env.DB, uid, limit)
      const sufficiency = AiMemoryService.calculateDataSufficiency(context)
      return jr(c, ok({ context, sufficiency, clinicalCopilotMode: 'deferred_to_sprint6' }, 200, s), 200)
    } catch (e) { console.error('context package error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/ai/memory/status', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const status = await AiMemoryService.getMemoryStatus(c.env.DB, uid)
      return jr(c, ok(status, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/ai/memory/rebuild', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, uid, 'feature.vectorMemory.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur AI Memory memerlukan paket Premium.', 403, [], s), 403)
      const context = await AiMemoryService.buildContextPackage(c.env.DB, uid)
      const { jobId, estimatedDocuments } = await AiMemoryService.rebuildMemory(c.env.DB, uid, context, c.env.AI_MEMORY_QUEUE)
      await AuditService.write(c.env.DB, { userId: uid, action: 'aiMemory.rebuild', entityType: 'HL_vectorDocuments', entityId: String(uid), metadataJson: JSON.stringify({ jobId, estimatedDocuments }) })
      return jr(c, ok({ queued: true, jobId, jobType: 'rebuild', estimatedDocuments, scopeStatus: 'sprint5_infrastructure_only', sprint6ClinicalCopilotRuntimeEnabled: false }, 202, s), 202)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.delete('/api/ai/memory', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { jobId } = await AiMemoryService.deleteMemory(c.env.DB, uid, c.env.AI_MEMORY_QUEUE)
      await AuditService.write(c.env.DB, { userId: uid, action: 'aiMemory.delete.request', entityType: 'HL_vectorDocuments', entityId: String(uid), metadataJson: JSON.stringify({ jobId }) })
      return jr(c, ok({ queued: true, jobId, jobType: 'delete', sprint6ClinicalCopilotImpact: 'All vector context for this user will be removed. Sprint 6 AI Clinical Copilot will need a rebuild to regain context.', scopeStatus: 'sprint5_infrastructure_only' }, 202, s), 202)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/ai/disclaimer/enforce', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as { text?: string; modelName?: string; recommendationId?: number }
      if (!body.text) return jr(c, fail('VALIDATION_ERROR', 'text wajib.', 400, [], s), 400)
      const enforced = AiMemoryService.enforceDisclaimer(body.text, body.modelName || 'AI')
      if (body.recommendationId) await AiMemoryService.logDisclaimer(c.env.DB, uid, body.recommendationId, body.modelName || 'AI', enforced)
      return jr(c, ok({ enforced: enforced !== body.text, text: enforced }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/admin/users/:userId/ai-memory/status', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await RbacService.hasPermission(c.env.DB, uid, 'admin.aiMemory.read')) return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
      const targetUid = Number(c.req.param('userId'))
      const status = await AiMemoryService.getMemoryStatus(c.env.DB, targetUid)
      await AuditService.write(c.env.DB, { userId: uid, action: 'admin.aiMemory.read', entityType: 'HL_vectorDocuments', entityId: String(targetUid), metadataJson: JSON.stringify({ targetUserId: targetUid }) })
      return jr(c, ok({ ...status, rawVectorContent: undefined }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/admin/users/:userId/ai-memory/rebuild', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await RbacService.hasPermission(c.env.DB, uid, 'admin.aiMemory.manage')) return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
      const targetUid = Number(c.req.param('userId'))
      const context = await AiMemoryService.buildContextPackage(c.env.DB, targetUid)
      const { jobId, estimatedDocuments } = await AiMemoryService.rebuildMemory(c.env.DB, targetUid, context, c.env.AI_MEMORY_QUEUE)
      await AuditService.write(c.env.DB, { userId: uid, action: 'admin.aiMemory.rebuild', entityType: 'HL_vectorDocuments', entityId: String(targetUid), metadataJson: JSON.stringify({ targetUserId: targetUid, jobId, estimatedDocuments }) })
      return jr(c, ok({ queued: true, jobId, jobType: 'rebuild', estimatedDocuments }, 202, s), 202)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/admin/ai-clinical-copilot/readiness', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await RbacService.hasPermission(c.env.DB, uid, 'admin.aiMemory.read')) return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
      return jr(c, ok({
        scopeStatus: 'deferred_to_sprint6',
        sprint6ClinicalCopilot: { scopeStatus: 'deferred_to_sprint6', runtimeEnabled: false, readinessPurpose: 'context_infrastructure_only', readyChecks: { vectorNamespaceReady: true, memoryLifecycleReady: true, contextTraceReady: true, safetyBoundaryReady: true, clinicalInterviewRuntimeReady: false, differentialReasoningRuntimeReady: false, doctorHandoffRuntimeReady: false } },
        allowedActions: ['prepare_context','store_memory_metadata','query_user_namespace','return_context_trace','enforce_disclaimer','report_readiness_status'],
        forbiddenActions: ['final_diagnosis','emergency_decision','prescription','medication_dosage_instruction','replace_doctor_claim','cross_user_retrieval']
      }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/ai/recommendation', async (c: HC) => {
    const s = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as { sessionId?: string }
      const sessionId = body?.sessionId

      const todayValues = sessionId
        ? await c.env.DB.prepare(
            'SELECT metricCode, finalValue, unit, status, severity FROM HL_measurementValues WHERE sessionId = ?'
          ).bind(sessionId).all<{ metricCode: string; finalValue: number; unit: string; status: string; severity: string }>()
        : { results: [] as any[] }

      const last3Days = await getRecentValues(c as any, userId, 3)
      const last7Days = await getRecentValues(c as any, userId, 7)

      const summary = {
        today: (todayValues.results || []).map(v => `${v.metricCode}=${v.finalValue}${v.unit} (${v.status})`),
        last3DaysCount: last3Days.length,
        last7DaysCount: last7Days.length
      }

      const prompt = `Anda analis kesehatan senior. Analisis data berikut dan beri interpretasi SPESIFIK:

Data: ${JSON.stringify(summary)}

WAJIB:
- Beri skor kesehatan (1-10) berdasarkan data
- Sebut kondisi jika indikasi jelas (misal: hipertensi, underweight, dll)
- Rekomendasi konkret berdasarkan data aktual
- Jangan bermain aman, langsung pada data
- MAKSIMAL 3 kalimat dalam Bahasa Indonesia`

      let recommendationText = 'Rekomendasi tidak tersedia saat ini. Jaga pola makan seimbang, istirahat cukup, dan hidrasi yang baik.'
      let safetyStatus: 'safe' | 'filtered' | 'fallback' = 'fallback'
      let modelName = 'deterministic-fallback'

      const aiResult = await callConfiguredTextAi(c as any, [
        {
          role: 'system',
          content: 'Anda analis kesehatan senior. Bersikap spesifik dan berani berdasarkan data. Beri skor dan interpretasi langsung dalam Bahasa Indonesia.'
        },
        { role: 'user', content: prompt }
      ], 300)
      if (aiResult) {
        const filtered = filterUnsafeContent(aiResult.text)
        recommendationText = filtered.filtered
        safetyStatus = filtered.safe ? 'safe' : 'filtered'
        modelName = aiResult.model
      }

      const recId = await insertAndGetId(c.env.DB.prepare(
        `INSERT INTO HL_aiRecommendations
         (userId, sessionId, summaryText, todayJson, threeDayJson, sevenDayJson, ruleStatusJson, modelName, durationMs, safetyStatus, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        userId,
        sessionId || null,
        recommendationText,
        JSON.stringify(summary.today),
        JSON.stringify(last3Days),
        JSON.stringify(last7Days),
        JSON.stringify((todayValues.results || []).map(v => ({ metric: v.metricCode, status: v.status, severity: v.severity }))),
        modelName,
        Date.now() - s,
        safetyStatus
      ))

      const has3Day = last3Days.length >= 3
      const has7Day = last7Days.length >= 7
      const dataMessages: string[] = []
      if (!has3Day) dataMessages.push('Belum cukup data 3 hari untuk perbandingan.')
      if (!has7Day) dataMessages.push('Belum cukup data 7 hari untuk perbandingan.')

      return jr(c, ok({
        recommendationId: recId,
        recommendation: recommendationText,
        safetyStatus,
        has3DayComparison: has3Day,
        has7DayComparison: has7Day,
        dataMessages,
        summary
      }, 200, s), 200)
    } catch (error) {
      console.error('AI recommendation endpoint error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Rekomendasi AI gagal.', 500, [], s), 500)
    }
  })

  app.post('/api/ai/assistant', async (c: HC) => {
    const s = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      const body = await c.req.json().catch(() => ({})) as { question?: string; clinicalCopilotMode?: boolean }
      if (body.clinicalCopilotMode) return jr(c, { body: { success: false, error: { code: 'AI_CLINICAL_COPILOT_DEFERRED', message: 'AI Clinical Copilot runtime is deferred to Sprint 6.', details: [{ scopeStatus: 'deferred_to_sprint6' }] }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status: 403 } as any, 403)
      const ent = await EntitlementService.requireEntitlement(c.env.DB, userId, 'feature.aiAssistant.use')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur AI memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], s), 403)
      const question = (body.question || '').trim()
      if (!question) return jr(c, fail('VALIDATION_ERROR', 'question wajib.', 400, [], s), 400)

      const profile = await c.env.DB.prepare(
        `SELECT u.displayName, p.heightCm, p.sex, p.birthDate
         FROM HL_users u
         LEFT JOIN HL_userProfiles p ON p.userId = u.id
         WHERE u.id = ?`
      ).bind(userId).first<{ displayName: string; heightCm: number | null; sex: string | null; birthDate: string | null }>()

      const latestValues = await c.env.DB.prepare(
        `SELECT metricCode, finalValue, unit, status, severity, measuredAt
         FROM HL_measurementValues
         WHERE userId = ?
         ORDER BY measuredAt DESC
         LIMIT 8`
      ).bind(userId).all<{
        metricCode: string
        finalValue: number
        unit: string
        status: string
        severity: string
        measuredAt: string
      }>()

      const vitals = (latestValues.results || []).map((value) => ({
        metricCode: value.metricCode,
        finalValue: value.finalValue,
        unit: value.unit,
        status: value.status,
        severity: value.severity,
        measuredAt: value.measuredAt
      }))

      const contextSummary = vitals.length > 0
        ? vitals
            .map((value) => `${value.metricCode}: ${value.finalValue} ${value.unit} (${value.status}, ${value.severity})`)
            .join('; ')
        : 'Belum ada data vital terbaru.'

      let reply = [
        `Pertanyaan Anda: ${question}.`,
        `Konteks pengukuran saat ini: ${contextSummary}`,
        'Saran umum: pilih makanan rendah garam, cukup minum air, istirahat cukup, dan tetap konsultasikan keputusan medis ke dokter.'
      ].join(' ')
      let model = 'deterministic-fallback'
      let usedFallback = true

      const aiResult = await callConfiguredTextAi(c as any, [
        {
          role: 'system',
          content:
            'Anda adalah seorang Dokter Senior dan Spesialis Medis untuk aplikasi iSehat. Anda memiliki akses ke seluruh data historis dan metrik kesehatan pengguna. Lakukan analisa mendalam terhadap kondisi pasien berdasarkan data yang diberikan. Berikan "Clinical Confidence Score" (1-100) terhadap analisa Anda. Berikan rekomendasi medis, peringatan, dan insight layaknya dokter spesialis. WAJIB akhiri respons Anda dengan teks berikut tanpa diubah: \n"[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."'
        },
        {
          role: 'user',
          content: `Profil: ${JSON.stringify(profile || {})}\nVitals terbaru: ${JSON.stringify(vitals)}\nPertanyaan: ${question}`
        }
      ], 220)
      if (aiResult) {
        const filtered = filterUnsafeContent(aiResult.text)
        let assistantReply = filtered.filtered
        assistantReply = AiMemoryService.enforceDisclaimer(assistantReply, aiResult.model)
        const patternScore = extractPatternScore(assistantReply)
        reply = assistantReply
        model = aiResult.model
        usedFallback = false
        const context = await AiMemoryService.buildContextPackage(c.env.DB, userId)
        const { score: dataSufficiencyScore, scoreReason } = AiMemoryService.calculateDataSufficiency(context)
        const contextTrace = vitals.map(v => ({ metricCode: v.metricCode, measuredAt: v.measuredAt, sourceType: 'measurement', source: 'HL_measurementValues' }))

        return jr(c, ok({
          reply,
          patternScore,
          disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)),
          model,
          usedFallback,
          vitals,
          profile: profile || null,
          dataSufficiencyScore,
          scoreReason,
          contextTrace,
          usedVectorContext: false
        }, 200, s), 200)
      }

      return jr(c, ok({
        reply,
        patternScore: 0,
        disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)),
        model,
        usedFallback,
        vitals,
        profile: profile || null,
        dataSufficiencyScore: 0,
        scoreReason: 'Data kurang untuk analisis',
        contextTrace: vitals.map(v => ({ metricCode: v.metricCode, measuredAt: v.measuredAt, sourceType: 'measurement', source: 'HL_measurementValues' })),
        usedVectorContext: false
      }, 200, s), 200)
    } catch (error) {
      console.error('ai assistant endpoint error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Asisten AI gagal merespons.', 500, [], s), 500)
    }
  })

  app.post('/api/ai/report-analysis', async (c: HC) => {
    const s = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      const body = await c.req.json() as { reportType?: string; context?: string; clinicalCopilotMode?: boolean }
      if (body.clinicalCopilotMode) return jr(c, { body: { success: false, error: { code: 'AI_CLINICAL_COPILOT_DEFERRED', message: 'AI Clinical Copilot runtime is deferred to Sprint 6.', details: [{ scopeStatus: 'deferred_to_sprint6' }] }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status: 403 } as any, 403)
      const reportType = body?.reportType
      if (reportType !== 'daily' && reportType !== 'weekly' && reportType !== 'monthly') {
        return jr(c, fail('VALIDATION_ERROR', 'reportType harus daily/weekly/monthly.', 400, [], s), 400)
      }
      const context = (body?.context || '').slice(0, 2000)

      const prompt = `Anda adalah seorang Dokter Senior dan Spesialis Medis untuk aplikasi iSehat. Anda memiliki akses ke seluruh data historis dan metrik kesehatan pengguna.
1. Lakukan ANALISA MENDALAM dan AGRESIF terhadap kondisi pasien berdasarkan data laporan berikut.
2. Berikan "Clinical Confidence Score" (1-100) terhadap analisa Anda beserta justifikasi singkat.
3. Berikan rekomendasi medis, peringatan, dan insight layaknya dokter spesialis yang sedang mendiagnosis pasien.

Data laporan ${reportType}:
${context}

WAJIB sertakan teks ini tepat di akhir respons Anda TANPA DIUBAH sedikit pun:
"[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."`

      const messages = [
        { role: 'system', content: 'Anda adalah Dokter Senior dan Spesialis Medis. Analisa pasien secara mendalam, berikan Clinical Confidence Score, dan akhiri dengan disclaimer tanggung jawab medis.' },
        { role: 'user', content: prompt }
      ] as any

      const aiResult = await callConfiguredTextAi(c as any, messages, 400)
      if (aiResult) {
        let analysis = aiResult.text
        analysis = AiMemoryService.enforceDisclaimer(analysis, aiResult.model)
        const patternScore = extractPatternScore(analysis)
        return jr(c, ok({ analysis, patternScore, model: aiResult.model, disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)), usedFallback: false }, 200, s), 200)
      }
      return jr(c, ok({
        analysis: 'AI tidak tersedia saat ini. Silakan konsultasi dengan dokter untuk interpretasi data Anda.',
        patternScore: 0,
        model: 'fallback',
        disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)),
        usedFallback: true
      }, 200, s), 200)
    } catch (error) {
      console.error('report analysis error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal menganalisa data.', 500, [], s), 500)
    }
  })
}
