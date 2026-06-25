import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { AiMemoryService } from './services/ai-memory.js'
import { AuditService } from './services/audit.js'
import { RbacService } from './services/rbac.js'

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

export function mountSprint5CRoutes(app: any) {
  app.post('/api/ai/context/query', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as { query?: string; topK?: number; clinicalCopilotMode?: boolean; purpose?: string }
      if (body.clinicalCopilotMode) return jr(c, { body: { success: false, error: { code: 'AI_CLINICAL_COPILOT_DEFERRED', message: 'AI Clinical Copilot runtime is deferred to Sprint 6.', details: [{ scopeStatus: 'deferred_to_sprint6' }] }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status: 403 } as any, 403)
      const topK = Math.min(body.topK || 8, 20)
      const queryId = await AiMemoryService.logContextQuery(c.env.DB, uid, body.query || '', topK, false, 'VECTORIZE_UNAVAILABLE', Date.now() - s, '{}')
      return jr(c, ok({ usedVectorContext: false, queryId, matches: [], fallbackReason: 'VECTORIZE_UNAVAILABLE', scopeStatus: 'sprint5_infrastructure_only' }, 200, s), 200)
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
      return jr(c, ok({ ...status, sprint6Readiness: 'deferred', clinicalCopilotRuntimeEnabled: false }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/ai/memory/rebuild', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const context = await AiMemoryService.buildContextPackage(c.env.DB, uid)
      const count = await AiMemoryService.rebuildMemory(c.env.DB, uid, context)
      await AuditService.write(c.env.DB, { userId: uid, action: 'aiMemory.rebuild', entityType: 'HL_vectorDocuments', entityId: String(uid), metadataJson: JSON.stringify({ documentsCreated: count }) })
      return jr(c, ok({ documentsCreated: count, status: 'rebuilding', vectorizeBinding: 'configured_at_deploy' }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.delete('/api/ai/memory', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      await AiMemoryService.deleteMemory(c.env.DB, uid)
      await AuditService.write(c.env.DB, { userId: uid, action: 'aiMemory.delete.request', entityType: 'HL_vectorDocuments', entityId: String(uid) })
      return jr(c, ok({ deleted: true }, 200, s), 200)
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

  // Admin AI memory endpoints
  app.get('/api/admin/users/:userId/ai-memory/status', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await RbacService.hasPermission(c.env.DB, uid, 'admin.aiMemory.read')) return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
      const targetUid = Number(c.req.param('userId'))
      const status = await AiMemoryService.getMemoryStatus(c.env.DB, targetUid)
      await AuditService.write(c.env.DB, { userId: uid, action: 'admin.aiMemory.read', entityType: 'HL_vectorDocuments', entityId: String(targetUid), metadataJson: JSON.stringify({ targetUserId: targetUid }) })
      return jr(c, ok({ ...status, sprint6Readiness: 'deferred', clinicalCopilotMode: 'disabled', rawVectorContent: undefined }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/admin/users/:userId/ai-memory/rebuild', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await RbacService.hasPermission(c.env.DB, uid, 'admin.aiMemory.manage')) return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
      const targetUid = Number(c.req.param('userId'))
      const context = await AiMemoryService.buildContextPackage(c.env.DB, targetUid)
      const count = await AiMemoryService.rebuildMemory(c.env.DB, targetUid, context)
      await AuditService.write(c.env.DB, { userId: uid, action: 'admin.aiMemory.rebuild', entityType: 'HL_vectorDocuments', entityId: String(targetUid), metadataJson: JSON.stringify({ targetUserId: targetUid, documentsCreated: count }) })
      return jr(c, ok({ documentsCreated: count, status: 'rebuilding' }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/admin/ai-clinical-copilot/readiness', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      if (!await RbacService.hasPermission(c.env.DB, uid, 'admin.aiMemory.read')) return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
      return jr(c, ok({ scopeStatus: 'deferred_to_sprint6', aiClinicalCopilotRuntimeEnabled: false, sprint5InfrastructureReady: true, allowedActions: ['prepare_context', 'store_memory_metadata', 'query_user_namespace', 'return_context_trace', 'enforce_disclaimer', 'report_readiness_status'], forbiddenActions: ['final_diagnosis', 'emergency_decision', 'prescription', 'medication_dosage_instruction', 'replace_doctor_claim', 'cross_user_retrieval'] }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })
}
