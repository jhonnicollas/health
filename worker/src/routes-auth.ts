import { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { EducationService } from './services/education.js'
import { SymptomService } from './services/symptom.js'
import { AuditService } from './services/audit.js'

interface LocalEnv { DB: D1Database; LOGS: R2Bucket; GOOGLE_CLIENT_ID?: string; GOOGLE_CLIENT_SECRET?: string; TELEGRAM_QUEUE?: Queue }
type HC = Context<{ Bindings: LocalEnv }>

function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const h = await sha256Token(token)
  const row = await c.env.DB.prepare('SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND revokedAt IS NULL AND expiresAt > datetime("now")').bind(h).first<any>()
  return row?.userId || null
}

async function sha256Token(val: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function hashPassword(pw: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

const SAFE_RETURN_PATHS = ['/', '/dashboard', '/settings', '/settings/account-security']

export function mountAuthRoutes(app: any) {
  const SD = 30
  function safeReturnTo(raw: string | null | undefined): string {
    if (!raw) return '/'
    try { const u = new URL(raw, 'http://localhost'); if (SAFE_RETURN_PATHS.includes(u.pathname)) return u.pathname } catch {}
    return '/'
  }
  async function ssc(c: HC, uid: number) {
    const t = crypto.randomUUID(); const h = await sha256Token(t)
    await c.env.DB.prepare('INSERT INTO HL_sessions (userId, sessionTokenHash, createdAt, expiresAt) VALUES (?, ?, CURRENT_TIMESTAMP, datetime("now", "+" || ? || " days"))').bind(uid, h, SD).run()
    setCookie(c, 'hlSession', t, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SD * 86400 })
  }

  app.get('/api/auth/google', async (c: HC) => {
    const s = Date.now()
    try {
      const mode = c.req.query('mode') || 'login'
      const state = crypto.randomUUID()
      const stateHash = await sha256Token(state)
      const nonce = crypto.randomUUID()
      const nonceHash = await sha256Token(nonce)
      await c.env.DB.prepare('INSERT INTO HL_oauthStates (stateHash, nonceHash, provider, mode, returnTo, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(stateHash, nonceHash, 'google', mode, safeReturnTo(c.req.query('returnTo')), new Date(Date.now() + 600000).toISOString()).run()
      const cid = (c.env as any).GOOGLE_CLIENT_ID || ''
      const ru = `${new URL(c.req.url).origin}/api/auth/google/callback`
      return jr(c, ok({ redirectUrl: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}&redirect_uri=${encodeURIComponent(ru)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${state}` }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/auth/google/callback', async (c: HC) => {
    const s = Date.now()
    try {
      const { code, state } = c.req.query()
      if (!code || !state) return jr(c, fail('VALIDATION_ERROR', 'code dan state wajib.', 400, [], s), 400)
      const stateHash = await sha256Token(state)
      const row = await c.env.DB.prepare("SELECT id, mode, returnTo, userId FROM HL_oauthStates WHERE stateHash = ? AND consumedAt IS NULL AND expiresAt > datetime('now')").bind(stateHash).first<any>()
      if (!row) return jr(c, fail('UNAUTHORIZED', 'State invalid.', 401, [], s), 401)
      await c.env.DB.prepare('UPDATE HL_oauthStates SET consumedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id).run()
      const origin = new URL(c.req.url).origin
      const redirectUri = `${origin}/api/auth/google/callback`
      const cid = (c.env as any).GOOGLE_CLIENT_ID || ''
      const csecret = (c.env as any).GOOGLE_CLIENT_SECRET || ''
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: cid, client_secret: csecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
      })
      const tokenData = await tokenRes.json() as any
      if (!tokenData.id_token) return jr(c, fail('OAUTH_TOKEN_FAILED', 'Token exchange gagal.', 401, [], s), 401)
      const payload = JSON.parse(atob(tokenData.id_token.split('.')[1])) as any
      if (!payload.email_verified) return jr(c, fail('EMAIL_NOT_VERIFIED', 'Email Google belum diverifikasi.', 401, [], s), 401)
      const sub = String(payload.sub)
      const email = String(payload.email)
      if (row.mode === 'link') {
        const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
        const existingLink = await c.env.DB.prepare('SELECT id FROM HL_oauthAccounts WHERE provider = ? AND providerSubject = ? AND userId != ?').bind('google', sub, uid).first<any>()
        if (existingLink) return jr(c, fail('EMAIL_CONFLICT', 'Akun Google sudah tertaut ke akun lain.', 409, [], s), 409)
        await c.env.DB.prepare('INSERT OR IGNORE INTO HL_oauthAccounts (userId, provider, providerSubject, providerEmail, providerEmailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(uid, 'google', sub, email).run()
        await AuditService.write(c.env.DB, { userId: uid, action: 'auth.google.link', entityType: 'HL_oauthAccounts', entityId: sub, metadataJson: JSON.stringify({ provider: 'google' }) })
        return c.redirect(safeReturnTo(row.returnTo))
      }
      const existing = await c.env.DB.prepare('SELECT userId FROM HL_oauthAccounts WHERE provider = ? AND providerSubject = ?').bind('google', sub).first<any>()
      if (existing) { await ssc(c, existing.userId); await AuditService.write(c.env.DB, { userId: existing.userId, action: 'auth.google.login', entityType: 'HL_oauthAccounts', entityId: sub, metadataJson: JSON.stringify({ provider: 'google' }) }) } else {
        const existingEmail = await c.env.DB.prepare('SELECT id FROM HL_users WHERE email = ?').bind(email).first<any>()
        if (existingEmail) return jr(c, fail('EMAIL_CONFLICT', 'Email sudah terdaftar dengan akun lain. Silakan login lalu tautkan Google dari pengaturan.', 409, [], s), 409)
        const pw = crypto.randomUUID().replace(/-/g, '').slice(0, 16); const pwHash = await hashPassword(pw)
        const { meta } = await c.env.DB.prepare("INSERT INTO HL_users (email, passwordHash, role, createdAt, updatedAt) VALUES (?, ?, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(email, pwHash).run()
        await c.env.DB.prepare('INSERT INTO HL_oauthAccounts (userId, provider, providerSubject, providerEmail, providerEmailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(meta.last_row_id, 'google', sub, email).run()
        await ssc(c, meta.last_row_id as number)
      }
      return c.redirect(safeReturnTo(row.returnTo))
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/auth/google/link', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      await AuditService.write(c.env.DB, { userId: uid, action: 'auth.google.link.init', entityType: 'HL_oauthAccounts', entityId: String(uid) })
      return jr(c, ok({ redirectUrl: `/api/auth/google?mode=link&returnTo=${encodeURIComponent(c.req.query('returnTo') || '/settings/account-security')}` }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.delete('/api/auth/google/link', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const accounts = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM HL_oauthAccounts WHERE userId = ?').bind(uid).first<any>()
      const pwUser = await c.env.DB.prepare('SELECT passwordHash FROM HL_users WHERE id = ?').bind(uid).first<any>()
      if (!pwUser?.passwordHash && (accounts?.cnt || 0) <= 1) return jr(c, fail('LAST_LOGIN_METHOD', 'Google adalah satu-satunya metode login.', 400, [], s), 400)
      await c.env.DB.prepare("DELETE FROM HL_oauthAccounts WHERE userId = ? AND provider = 'google'").bind(uid).run()
      await AuditService.write(c.env.DB, { userId: uid, action: 'auth.google.unlink', entityType: 'HL_oauthAccounts', entityId: String(uid), metadataJson: JSON.stringify({ provider: 'google' }) })
      return jr(c, ok({ unlinked: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/education/cards', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { topicType, topicCode, firstTimeOnly } = c.req.query()
      let cards: any[]
      if (topicType && topicCode) { const cd = await EducationService.getCard(c.env.DB, topicType, topicCode); cards = cd ? [cd] : [] }
      else if (topicType) cards = await EducationService.getCardsByTopic(c.env.DB, topicType)
      else cards = []
      if (firstTimeOnly === 'true') {
        const seen = (await c.env.DB.prepare('SELECT topicType, topicCode FROM HL_userEducationProgress WHERE userId = ?').bind(uid).all<any>()).results || []
        const set = new Set(seen.map((x: any) => `${x.topicType}:${x.topicCode}`))
        cards = cards.filter((card: any) => !set.has(`${card.topicType}:${card.topicCode}`))
      }
      for (const card of cards) try { await EducationService.trackProgress(c.env.DB, uid, card.topicType, card.topicCode) } catch {}
      return jr(c, ok(cards.map((c: any) => ({ topicType: c.topicType, topicCode: c.topicCode, title: c.title, shortText: c.shortText, whyItMatters: c.whyItMatters, howToUse: c.howToUse, normalMeaning: c.normalMeaning, warningMeaning: c.warningMeaning, actionText: c.actionText, redFlagText: c.redFlagText, sourceLabel: c.sourceLabel })), 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat kartu edukasi.', 500, [], s), 500) }
  })

  app.post('/api/education/cards/:topicType/:topicCode/acknowledge', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      await EducationService.acknowledge(c.env.DB, uid, c.req.param('topicType') || "", c.req.param('topicCode') || "")
      return jr(c, ok({ acknowledged: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/symptoms', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as any; const desc = body.description || ''
      const rf = SymptomService.detectRedFlags(desc)
      const logId = await SymptomService.createLog(c.env.DB, {
        userId: uid, sourceSessionId: body.sourceSessionId || null, symptomDateTime: body.symptomDateTime || new Date().toISOString(),
        quickSymptomsJson: body.quickSymptoms ? JSON.stringify(body.quickSymptoms) : null, bodyArea: body.bodyArea || null,
        painScale: body.painScale || null, painSeverity: body.painSeverity || null, mood: body.mood || null,
        startedAt: body.startedAt || null, durationMinutes: body.durationMinutes || null, description: desc,
        redFlagsJson: rf.detected ? JSON.stringify(rf.flags) : null, isRedFlag: rf.detected ? 1 : 0, safetyEventId: null
      } as any)
      let seId: number | null = null
      if (rf.detected) {
        seId = await SymptomService.createSafetyEvent(c.env.DB, uid, 'symptomRedFlag', rf.flags[0].severity, rf.flags[0].title, rf.flags[0].message, String(logId))
        await c.env.DB.prepare('UPDATE HL_symptomLogs SET safetyEventId = ? WHERE id = ?').bind(seId, logId).run()
      }
      return jr(c, ok({ logId, safetyEventId: seId, redFlags: rf.flags, isRedFlag: rf.detected }, 201, s), 201)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal simpan keluhan.', 500, [], s), 500) }
  })

  app.get('/api/symptoms', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      return jr(c, ok(await SymptomService.getLogsByUser(c.env.DB, uid, Math.min(Number(c.req.query('limit')) || 50, 100)), 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat keluhan.', 500, [], s), 500) }
  })

  app.get('/api/symptoms/history', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const { from, to, limit, redFlagOnly, sourceSessionId } = c.req.query()
      let sql = 'SELECT id, symptomDateTime, quickSymptomsJson, bodyArea, painScale, painSeverity, isRedFlag, redFlagsJson, sourceSessionId, safetyEventId FROM HL_symptomLogs WHERE userId = ?'; const params: unknown[] = [uid]
      if (from) { sql += ' AND date(symptomDateTime) >= ?'; params.push(from) }
      if (to) { sql += ' AND date(symptomDateTime) <= ?'; params.push(to) }
      if (redFlagOnly === 'true') { sql += ' AND isRedFlag = 1' }
      if (sourceSessionId) { sql += ' AND sourceSessionId = ?'; params.push(Number(sourceSessionId)) }
      sql += ' ORDER BY symptomDateTime DESC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
      const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
      return jr(c, ok(rows.results || [], 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat riwayat keluhan.', 500, [], s), 500) }
  })

  app.get('/api/symptoms/:symptomLogId', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const logId = Number(c.req.param('symptomLogId'))
      const log = await c.env.DB.prepare('SELECT * FROM HL_symptomLogs WHERE id = ?').bind(logId).first<any>()
      if (!log) return jr(c, fail('NOT_FOUND', 'Tidak ditemukan.', 404, [], s), 404)
      if (log.userId === uid) return jr(c, ok(log, 200, s), 200)
      const fp = await c.env.DB.prepare('SELECT id FROM HL_familyPermissions WHERE grantedById = ? AND targetUserId = ? AND scope = ? LIMIT 1').bind(log.userId, uid, 'sensitive-health').first<any>()
      if (fp) return jr(c, ok(log, 200, s), 200)
      const adminRole = await c.env.DB.prepare("SELECT 1 FROM HL_userRoles ur JOIN HL_rolePermissions rp ON rp.roleCode = ur.roleCode JOIN HL_permissions p ON p.code = rp.permissionCode WHERE ur.userId = ? AND ur.active = 1 AND p.code = 'admin.sensitiveHealth.read' LIMIT 1").bind(uid).first<any>()
      if (adminRole) return jr(c, ok(log, 200, s), 200)
      return jr(c, fail('FORBIDDEN', 'Akses ditolak.', 403, [], s), 403)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.post('/api/symptoms/prompt-dismissals', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json() as { sourceSessionId?: number; reason?: string }
      await c.env.DB.prepare('INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(uid, 'symptom.prompt.dismissed', 'HL_measurementSessions', String(body.sourceSessionId || ''), JSON.stringify({ reason: body.reason || 'noSymptoms' })).run()
      return jr(c, ok({ dismissed: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/dashboard/daily-health', async (c: HC) => {
    const s = Date.now()
    try { const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const dateStr = c.req.query('date') || new Date().toISOString().slice(0, 10)
      const ms = await c.env.DB.prepare("SELECT v.metricCode, v.finalValue, v.status, v.severity, v.createdAt FROM HL_measurementValues v JOIN HL_measurementSessions s ON s.id = v.sessionId WHERE s.userId = ? AND date(s.measuredAt) = date(?) ORDER BY v.createdAt DESC").bind(uid, dateStr).all<any>()
      const sym = await c.env.DB.prepare("SELECT id, symptomDateTime, quickSymptomsJson, bodyArea, painScale, painSeverity, mood, isRedFlag FROM HL_symptomLogs WHERE userId = ? AND date(symptomDateTime) = date(?) ORDER BY symptomDateTime DESC").bind(uid, dateStr).all<any>()
      return jr(c, ok({ date: dateStr, hasData: (ms.results?.length || 0) > 0 || (sym.results?.length || 0) > 0, measurements: ms.results || [], symptoms: sym.results || [] }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat hub kesehatan.', 500, [], s), 500) }
  })
}
