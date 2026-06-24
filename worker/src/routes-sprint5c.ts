import { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import { AiMemoryService } from './services/ai-memory.js'

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
  app.get('/api/ai/context-package', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const limit = Math.min(Number(c.req.query('limit')) || 10, 50)
      const context = await AiMemoryService.buildContextPackage(c.env.DB, uid, limit)
      const sufficiency = AiMemoryService.calculateDataSufficiency(context)
      return jr(c, ok({ context, sufficiency, clinicalCopilotMode: 'deferred_to_sprint6' }, 200, s), 200)
    } catch (e) { console.error('context package error:', e); return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/ai/memory', async (c: HC) => {
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
      return jr(c, ok({ documentsCreated: count, status: 'rebuilding', vectorizeBinding: 'configured_at_deploy' }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.delete('/api/ai/memory', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      await AiMemoryService.deleteMemory(c.env.DB, uid)
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

  // Admin endpoints
  app.get('/api/admin/ai-memory', async (c: HC) => {
    const s = Date.now()
    try {
      const uid = await getSession(c)
      if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const admin = await c.env.DB.prepare("SELECT role FROM HL_users WHERE id = ? AND role = 'admin'").bind(uid).first<any>()
      if (!admin) return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
      const total = await c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_vectorDocuments').first<any>()
      const indexed = await c.env.DB.prepare("SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE status = 'indexed'").first<any>()
      return jr(c, ok({ totalDocuments: total?.c || 0, indexedDocuments: indexed?.c || 0, vectorizeConfigured: false, sprint6Readiness: 'deferred', clinicalCopilotMode: 'disabled' }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })
}
