import { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { EducationService } from './services/education.js'
import { SymptomService } from './services/symptom.js'
import { AuditService } from './services/audit.js'
import { CryptoService } from './services/crypto.js'
import { EmailOtpService } from './services/email-otp.js'
import { EmailSenderService } from './services/email-sender.js'
import { sendEmergencyToContacts } from './routes-extra.js'
import type { Env } from './types.js'

type HC = Context<{ Bindings: Env }>

function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const h = await CryptoService.sha256Token(token)
  const row = await c.env.DB.prepare('SELECT s.userId FROM HL_sessions s JOIN HL_users u ON u.id = s.userId WHERE s.sessionTokenHash = ? AND s.revokedAt IS NULL AND s.expiresAt > datetime("now") AND u.active = 1').bind(h).first<any>()
  return row?.userId || null
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
    const t = crypto.randomUUID(); const h = await CryptoService.sha256Token(t)
    await c.env.DB.prepare('INSERT INTO HL_sessions (userId, sessionTokenHash, createdAt, expiresAt) VALUES (?, ?, CURRENT_TIMESTAMP, datetime("now", "+" || ? || " days"))').bind(uid, h, SD).run()
    setCookie(c, 'hlSession', t, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SD * 86400 })
  }

  app.get('/api/auth/google', async (c: HC) => {
    const s = Date.now()
    try {
      const mode = c.req.query('mode') || 'login'
      const state = crypto.randomUUID()
      const stateHash = await CryptoService.sha256Token(state)
      const nonce = crypto.randomUUID()
      const nonceHash = await CryptoService.sha256Token(nonce)
      await c.env.DB.prepare('INSERT INTO HL_oauthStates (stateHash, nonceHash, provider, mode, returnTo, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(stateHash, nonceHash, 'google', mode, safeReturnTo(c.req.query('returnTo')), new Date(Date.now() + 600000).toISOString()).run()
      const cid = (c.env as any).GOOGLE_CLIENT_ID || ''
      const ru = `${new URL(c.req.url).origin}/api/auth/google/callback`
      const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}&redirect_uri=${encodeURIComponent(ru)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${state}`
      const accept = c.req.header('Accept') || ''
      if (accept.includes('text/html')) return c.redirect(redirectUrl, 302)
      return jr(c, ok({ redirectUrl }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/auth/google/callback', async (c: HC) => {
    const s = Date.now()
    try {
      const { code, state } = c.req.query()
      if (!code || !state) return jr(c, fail('VALIDATION_ERROR', 'code dan state wajib.', 400, [], s), 400)
      const stateHash = await CryptoService.sha256Token(state)
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
        const pw = crypto.randomUUID().replace(/-/g, '').slice(0, 16); const pwHash = await CryptoService.hashPassword(pw)
        const { meta } = await c.env.DB.prepare("INSERT INTO HL_users (email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, emailVerifiedAt, emailVerificationMethod, createdAt, updatedAt) VALUES (?, ?, 'google', ?, 0, 0, 1, CURRENT_TIMESTAMP, 'google', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(email, pwHash, email).run()
        const newUid = meta.last_row_id as number
        await c.env.DB.prepare('INSERT OR IGNORE INTO HL_userRoles (userId, roleCode) VALUES (?, ?)').bind(newUid, 'user').run()
        await c.env.DB.prepare('INSERT INTO HL_oauthAccounts (userId, provider, providerSubject, providerEmail, providerEmailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(newUid, 'google', sub, email).run()
        await ssc(c, newUid)
      }
      return c.redirect(safeReturnTo(row.returnTo))
    } catch (e) {
      return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500)
    }
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

  app.post('/api/auth/register/start', async (c: HC) => {
    const s = Date.now()
    try {
      const body = await c.req.json<any>()
      const email = String(body.email || '').trim()
      const password = String(body.password || '')
      const displayName = String(body.displayName || '')
      const normalizedEmail = EmailOtpService.normalizeEmail(email)

      if (!EmailOtpService.validateEmailFormat(normalizedEmail)) return jr(c, fail('EMAIL_INVALID_FORMAT', 'Format email tidak valid.', 400, [], s), 400)
      if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return jr(c, fail('VALIDATION_ERROR', 'Password minimal 8 karakter dengan huruf besar, kecil, dan angka.', 400, [], s), 400)
      if (displayName.trim().length < 2) return jr(c, fail('VALIDATION_ERROR', 'Nama tampilan minimal 2 karakter.', 400, [], s), 400)

      const existing = await c.env.DB.prepare('SELECT id, active FROM HL_users WHERE email = ?').bind(normalizedEmail).first<any>()
      if (existing && existing.active === 1) return jr(c, fail('EMAIL_ALREADY_EXISTS', 'Email sudah terdaftar.', 409, [], s), 409)
      if (existing && existing.active === 0) await c.env.DB.prepare('DELETE FROM HL_users WHERE id = ? AND active = 0').bind(existing.id).run()

      const rateLimit = await EmailOtpService.assertRateLimit(c.env.DB, normalizedEmail)
      if (!rateLimit.allowed) return jr(c, fail('OTP_RATE_LIMITED', 'Terlalu banyak permintaan. Coba lagi nanti.', 429, [], s), 429)

      const passwordHash = await CryptoService.hashPassword(password)
      const result = await c.env.DB.prepare(
        `INSERT INTO HL_users (email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, createdAt, updatedAt) VALUES (?, ?, 'local', ?, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(normalizedEmail, passwordHash, displayName).run()
      const userId = Number((result.meta as any)?.last_row_id ?? (result.meta as any)?.lastRowId)

      const { challengeId, otp, expiresAt } = await EmailOtpService.createChallenge(c.env.DB, c.env, { userId, normalizedEmail, purpose: 'register' })
      const sendResult = await EmailSenderService.sendOtp(c.env, normalizedEmail, otp)
      if (!sendResult.sent) {
        await c.env.DB.prepare('DELETE FROM HL_users WHERE id = ? AND active = 0').bind(userId).run()
        return jr(c, fail('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim kode verifikasi.', 500, [], s), 500)
      }

      return jr(c, ok({ otpRequired: true, challengeId, maskedEmail: EmailOtpService.maskEmail(normalizedEmail), expiresInSeconds: 600 }, 200, s), 200)
    } catch (e) {
      return jr(c, fail('INTERNAL_ERROR', 'Registrasi gagal diproses.', 500, [], s), 500)
    }
  })

  app.post('/api/auth/register/verify', async (c: HC) => {
    const s = Date.now()
    try {
      const body = await c.req.json<any>()
      const challengeId = Number(body.challengeId)
      const otp = String(body.otp || '').trim()

      if (!challengeId || !/^\d{6}$/.test(otp)) return jr(c, fail('VALIDATION_ERROR', 'Challenge ID dan OTP 6 digit wajib.', 400, [], s), 400)

      const result = await EmailOtpService.verifyChallenge(c.env.DB, c.env, { challengeId, otp, purpose: 'register' })

      if (!result.valid) {
        const code = result.error === 'OTP_EXPIRED' ? 'OTP_EXPIRED' : result.error === 'OTP_TOO_MANY_ATTEMPTS' ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID'
        const msg = result.error === 'OTP_EXPIRED' ? 'Kode verifikasi kadaluarsa.' : result.error === 'OTP_TOO_MANY_ATTEMPTS' ? 'Terlalu banyak percobaan. Minta kode baru.' : 'Kode verifikasi tidak valid.'
        return jr(c, fail(code as any, msg, 400, [], s), 400)
      }

      const uid = result.userId as number
      await c.env.DB.batch([
        c.env.DB.prepare("UPDATE HL_users SET active = 1, emailVerifiedAt = CURRENT_TIMESTAMP, emailVerificationMethod = 'otp', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(uid),
        c.env.DB.prepare('INSERT OR IGNORE INTO HL_userRoles (userId, roleCode) VALUES (?, ?)').bind(uid, 'user'),
      ])

      const t = crypto.randomUUID(); const h = await CryptoService.sha256Token(t)
      await c.env.DB.prepare('INSERT INTO HL_sessions (userId, sessionTokenHash, createdAt, expiresAt) VALUES (?, ?, CURRENT_TIMESTAMP, datetime("now", "+" || ? || " days"))').bind(uid, h, 30).run()
      setCookie(c, 'hlSession', t, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 30 * 86400 })

      await AuditService.write(c.env.DB, { userId: uid, action: 'userRegister.otpVerify', entityType: 'HL_users', entityId: uid })

      const user = await c.env.DB.prepare('SELECT id, email, displayName, telegramEnabled, browserPushEnabled FROM HL_users WHERE id = ?').bind(uid).first<any>()
      return jr(c, ok({ user: { id: user.id, email: user.email, displayName: user.displayName, telegramEnabled: !!user.telegramEnabled, browserPushEnabled: !!user.browserPushEnabled }, requiresOnboarding: true }, 200, s), 200)
    } catch (e) {
      return jr(c, fail('INTERNAL_ERROR', 'Verifikasi gagal diproses.', 500, [], s), 500)
    }
  })

  app.post('/api/auth/login/start', async (c: HC) => {
    const s = Date.now()
    try {
      const body = await c.req.json<any>()
      const email = String(body.email || '').trim()
      const password = String(body.password || '')
      const normalizedEmail = EmailOtpService.normalizeEmail(email)

      const user = await c.env.DB.prepare("SELECT id, email, passwordHash, displayName, active FROM HL_users WHERE email = ? AND authProvider = 'local'").bind(normalizedEmail).first<any>()
      const passwordMatches = await CryptoService.verifyPassword(password, user?.passwordHash ?? null)

      if (!user || user.active !== 1 || !passwordMatches) return jr(c, fail('UNAUTHORIZED', 'Email atau password salah.', 401, [], s), 401)

      const rateLimit = await EmailOtpService.assertRateLimit(c.env.DB, normalizedEmail)
      if (!rateLimit.allowed) return jr(c, fail('OTP_RATE_LIMITED', 'Terlalu banyak permintaan.', 429, [], s), 429)

      const { challengeId, otp, expiresAt } = await EmailOtpService.createChallenge(c.env.DB, c.env, { userId: user.id, normalizedEmail, purpose: 'login' })
      const sendResult = await EmailSenderService.sendOtp(c.env, normalizedEmail, otp)
      if (!sendResult.sent) return jr(c, fail('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim kode verifikasi.', 500, [], s), 500)

      return jr(c, ok({ otpRequired: true, challengeId, maskedEmail: EmailOtpService.maskEmail(normalizedEmail), expiresInSeconds: 600 }, 200, s), 200)
    } catch (e) {
      return jr(c, fail('INTERNAL_ERROR', 'Login gagal diproses.', 500, [], s), 500)
    }
  })

  app.post('/api/auth/login/verify', async (c: HC) => {
    const s = Date.now()
    try {
      const body = await c.req.json<any>()
      const challengeId = Number(body.challengeId)
      const otp = String(body.otp || '').trim()

      if (!challengeId || !/^\d{6}$/.test(otp)) return jr(c, fail('VALIDATION_ERROR', 'Challenge ID dan OTP 6 digit wajib.', 400, [], s), 400)

      const result = await EmailOtpService.verifyChallenge(c.env.DB, c.env, { challengeId, otp, purpose: 'login' })

      if (!result.valid) {
        const code = result.error === 'OTP_EXPIRED' ? 'OTP_EXPIRED' : result.error === 'OTP_TOO_MANY_ATTEMPTS' ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID'
        const msg = result.error === 'OTP_EXPIRED' ? 'Kode verifikasi kadaluarsa.' : result.error === 'OTP_TOO_MANY_ATTEMPTS' ? 'Terlalu banyak percobaan.' : 'Kode verifikasi tidak valid.'
        return jr(c, fail(code as any, msg, 400, [], s), 400)
      }

      const user = await c.env.DB.prepare('SELECT id, email, displayName, telegramEnabled, browserPushEnabled, active FROM HL_users WHERE id = ?').bind(result.userId).first<any>()
      if (!user || user.active !== 1) return jr(c, fail('UNAUTHORIZED', 'Akun tidak aktif.', 401, [], s), 401)

      const t = crypto.randomUUID(); const h = await CryptoService.sha256Token(t)
      await c.env.DB.batch([
        c.env.DB.prepare('INSERT INTO HL_sessions (userId, sessionTokenHash, createdAt, expiresAt) VALUES (?, ?, CURRENT_TIMESTAMP, datetime("now", "+" || ? || " days"))').bind(user.id, h, 30),
        c.env.DB.prepare('UPDATE HL_users SET lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id),
      ])
      setCookie(c, 'hlSession', t, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 30 * 86400 })

      const profile = await c.env.DB.prepare('SELECT id, sex, birthDate, heightCm, timezone, accessibilityMode, theme, emergencyConsent, aiConsent, dataShareConsent FROM HL_userProfiles WHERE userId = ?').bind(user.id).first<any>()

      await AuditService.write(c.env.DB, { userId: user.id, action: 'userLogin.otpVerify', entityType: 'HL_users', entityId: user.id })

      return jr(c, ok({ user: { id: user.id, email: user.email, displayName: user.displayName, telegramEnabled: !!user.telegramEnabled, browserPushEnabled: !!user.browserPushEnabled }, profile, requiresOnboarding: !profile }, 200, s), 200)
    } catch (e) {
      return jr(c, fail('INTERNAL_ERROR', 'Verifikasi login gagal.', 500, [], s), 500)
    }
  })

  app.post('/api/auth/otp/resend', async (c: HC) => {
    const s = Date.now()
    try {
      const body = await c.req.json<any>()
      const challengeId = Number(body.challengeId)
      if (!challengeId) return jr(c, fail('VALIDATION_ERROR', 'Challenge ID wajib.', 400, [], s), 400)

      const result = await EmailOtpService.resendChallenge(c.env.DB, c.env, { challengeId })

      if (!result.ok) {
        const code = result.error === 'OTP_RATE_LIMITED' ? 'OTP_RATE_LIMITED' : result.error === 'OTP_RESEND_COOLDOWN' ? 'OTP_RESEND_COOLDOWN' : 'OTP_INVALID'
        const msg = result.error === 'OTP_RATE_LIMITED' ? 'Batas kirim ulang tercapai.' : result.error === 'OTP_RESEND_COOLDOWN' ? 'Tunggu sebentar sebelum kirim ulang.' : 'Kode tidak valid.'
        return jr(c, fail(code as any, msg, 400, [], s), 400)
      }

      const row = await c.env.DB.prepare('SELECT normalizedEmail FROM HL_emailOtpChallenges WHERE id = ?').bind(challengeId).first<any>()
      const sendResult = await EmailSenderService.sendOtp(c.env, row?.normalizedEmail || '', result.otp!)
      if (!sendResult.sent) return jr(c, fail('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim ulang kode.', 500, [], s), 500)

      return jr(c, ok({ maskedEmail: EmailOtpService.maskEmail(row?.normalizedEmail || ''), expiresInSeconds: 600 }, 200, s), 200)
    } catch (e) {
      return jr(c, fail('INTERNAL_ERROR', 'Kirim ulang gagal.', 500, [], s), 500)
    }
  })

  app.get('/api/dev/test-email-outbox/latest', async (c: HC) => {
    if (c.env.EMAIL_OTP_TEST_MODE !== 'true') return jr(c, fail('FORBIDDEN', 'Not available.', 403, []), 403)
    const email = String(c.req.query('email') || '')
    if (!email) return jr(c, fail('VALIDATION_ERROR', 'email query required.', 400, []), 400)
    const entries = EmailSenderService.getTestOutbox(email)
    const latest = entries[entries.length - 1]
    if (!latest) return jr(c, fail('NOT_FOUND', 'No outbox entries.', 404, []), 404)
    return jr(c, ok({ otp: latest.otp, sentAt: latest.sentAt }, 200), 200)
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
        try { await sendEmergencyToContacts(c as any, uid, rf.flags[0].severity, 'symptom', 0, '', `${rf.flags[0].title}: ${rf.flags[0].message}`) } catch {}
      }
      await AuditService.write(c.env.DB, { userId: uid, action: 'symptom.create', entityType: 'HL_symptomLogs', entityId: String(logId), metadataJson: { isRedFlag: rf.detected, sourceSessionId: body.sourceSessionId || null } })
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
