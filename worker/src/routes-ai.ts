import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { AiMemoryService } from './services/ai-memory.js'
import { AuditService } from './services/audit.js'
import { RbacService } from './services/rbac.js'
import { EntitlementService } from './services/entitlements.js'

interface LocalEnv { DB: D1Database; AI_MEMORY_QUEUE?: Queue; VECTORIZE_INDEX?: any }
type HC = Context<{ Bindings: LocalEnv }>
function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
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

const VALID_PURPOSES = ['contextReadiness','assistantContext','reportContext','sprint6Readiness']
const VALID_SOURCE_TYPES = ['measurement','symptom','safetyEvent','hydration','cycle','medication','fasting','pattern','report','education']

export function mountAiRoutes(app: any) {
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
}
