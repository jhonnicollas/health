import { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { EducationService } from './services/education.js'
import { SymptomService } from './services/symptom.js'
import { AuditService } from './services/audit.js'
import { CryptoService } from './services/crypto.js'
import { EmailOtpService } from './services/email-otp.js'
import { EmailSenderService } from './services/email-sender.js'
import { sendEmergencyToContacts } from './routes-extra.js'
import { parseLocale } from './i18n/locale.js'
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
  function oauthErrorRedirect(path: string, code: string, message: string) {
    const params = new URLSearchParams({ error: code, message })
    return `${path}?${params.toString()}`
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
      const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${cid}&redirect_uri=${encodeURIComponent(ru)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&state=${state}&nonce=${nonce}`
      const accept = c.req.header('Accept') || ''
      if (accept.includes('text/html')) return c.redirect(redirectUrl, 302)
      return jr(c, ok({ redirectUrl }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/auth/google/callback', async (c: HC) => {
    const s = Date.now()
    try {
      const { code, state } = c.req.query()
      if (!code || !state) return c.redirect(oauthErrorRedirect('/login', 'VALIDATION_ERROR', 'code dan state wajib.'), 302)
      const stateHash = await CryptoService.sha256Token(state)
      const row = await c.env.DB.prepare("SELECT id, mode, returnTo, userId, nonceHash FROM HL_oauthStates WHERE stateHash = ? AND consumedAt IS NULL AND expiresAt > datetime('now')").bind(stateHash).first<any>()
      if (!row) return c.redirect(oauthErrorRedirect('/login', 'UNAUTHORIZED', 'State invalid.'), 302)
      const consumeResult = await c.env.DB.prepare('UPDATE HL_oauthStates SET consumedAt = CURRENT_TIMESTAMP WHERE id = ? AND consumedAt IS NULL').bind(row.id).run()
      if ((consumeResult.meta as any).changes === 0) return c.redirect(oauthErrorRedirect('/login', 'UNAUTHORIZED', 'State sudah digunakan.'), 302)
      const origin = new URL(c.req.url).origin
      const redirectUri = `${origin}/api/auth/google/callback`
      const cid = (c.env as any).GOOGLE_CLIENT_ID || ''
      const csecret = (c.env as any).GOOGLE_CLIENT_SECRET || ''
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: cid, client_secret: csecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
      })
      const tokenData = await tokenRes.json() as { id_token?: string; access_token?: string; error?: string }
      if (!tokenData.id_token) return c.redirect(oauthErrorRedirect('/login', 'OAUTH_TOKEN_FAILED', 'Token exchange gagal.'), 302)

      let payload: { sub?: string; email?: string; email_verified?: boolean | string; nonce?: string; aud?: string; iss?: string }
      try {
        const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${tokenData.id_token}`)
        const tokenInfo = await tokenInfoRes.json() as { sub?: string; email?: string; email_verified?: string; nonce?: string; aud?: string; iss?: string; error?: string }
        if (!tokenInfoRes.ok || tokenInfo.error || !tokenInfo.sub) {
          const fallback = JSON.parse(atob(tokenData.id_token.split('.')[1])) as any
          payload = { sub: fallback.sub, email: fallback.email, email_verified: fallback.email_verified, nonce: fallback.nonce, aud: fallback.aud, iss: fallback.iss }
        } else {
          payload = { sub: tokenInfo.sub, email: tokenInfo.email, email_verified: tokenInfo.email_verified, nonce: tokenInfo.nonce, aud: tokenInfo.aud, iss: tokenInfo.iss }
        }
      } catch {
        const fallback = JSON.parse(atob(tokenData.id_token.split('.')[1])) as any
        payload = { sub: fallback.sub, email: fallback.email, email_verified: fallback.email_verified, nonce: fallback.nonce, aud: fallback.aud, iss: fallback.iss }
      }

      if (payload.aud && cid && payload.aud !== cid) return c.redirect(oauthErrorRedirect('/login', 'OAUTH_TOKEN_INVALID', 'Token audience tidak cocok.'), 302)
      if (payload.iss && payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') return c.redirect(oauthErrorRedirect('/login', 'OAUTH_TOKEN_INVALID', 'Token issuer tidak valid.'), 302)

      if (!/^(true|1)$/i.test(String(payload.email_verified)))
        return c.redirect(oauthErrorRedirect('/login', 'EMAIL_NOT_VERIFIED', 'Email Google belum diverifikasi.'), 302)

      if (row.nonceHash && payload.nonce) {
        const computedNonceHash = await CryptoService.sha256Token(payload.nonce)
        if (computedNonceHash !== row.nonceHash) return c.redirect(oauthErrorRedirect('/login', 'OAUTH_TOKEN_INVALID', 'Nonce tidak cocok.'), 302)
      }

      const sub = String(payload.sub)
      const email = String(payload.email)
      if (row.mode === 'link') {
        const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
        const existingLink = await c.env.DB.prepare('SELECT id FROM HL_oauthAccounts WHERE provider = ? AND providerSubject = ? AND userId != ?').bind('google', sub, uid).first<any>()
        if (existingLink) return c.redirect(oauthErrorRedirect(safeReturnTo(row.returnTo), 'EMAIL_CONFLICT', 'Akun Google sudah tertaut ke akun lain.'), 302)
        await c.env.DB.prepare('INSERT OR IGNORE INTO HL_oauthAccounts (userId, provider, providerSubject, providerEmail, providerEmailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(uid, 'google', sub, email).run()
        await AuditService.write(c.env.DB, { userId: uid, action: 'auth.google.link', entityType: 'HL_oauthAccounts', entityId: sub, metadataJson: JSON.stringify({ provider: 'google' }) })
        return c.redirect(safeReturnTo(row.returnTo))
      }
      const existing = await c.env.DB.prepare('SELECT userId FROM HL_oauthAccounts WHERE provider = ? AND providerSubject = ?').bind('google', sub).first<any>()
      if (existing) { await ssc(c, existing.userId); await AuditService.write(c.env.DB, { userId: existing.userId, action: 'auth.google.login', entityType: 'HL_oauthAccounts', entityId: sub, metadataJson: JSON.stringify({ provider: 'google' }) }) } else {
        const existingEmail = await c.env.DB.prepare('SELECT id, active FROM HL_users WHERE email = ?').bind(email).first<any>()
        if (existingEmail) {
          if (existingEmail.active !== 1) return c.redirect(oauthErrorRedirect('/login', 'ACCOUNT_SUSPENDED', 'Akun di-suspend. Hubungi admin.'), 302)
          await c.env.DB.prepare('INSERT OR IGNORE INTO HL_oauthAccounts (userId, provider, providerSubject, providerEmail, providerEmailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(existingEmail.id, 'google', sub, email).run()
          await AuditService.write(c.env.DB, { userId: existingEmail.id, action: 'auth.google.autoLink', entityType: 'HL_oauthAccounts', entityId: sub, metadataJson: JSON.stringify({ provider: 'google', autoLinked: true }) })
          await ssc(c, existingEmail.id)
        } else {
          const pw = crypto.randomUUID().replace(/-/g, '').slice(0, 16); const pwHash = await CryptoService.hashPassword(pw)
          const { meta } = await c.env.DB.prepare("INSERT INTO HL_users (email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, emailVerifiedAt, emailVerificationMethod, createdAt, updatedAt) VALUES (?, ?, 'google', ?, 0, 0, 1, CURRENT_TIMESTAMP, 'google', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(email, pwHash, email).run()
          const newUid = meta.last_row_id as number
          await c.env.DB.prepare('INSERT OR IGNORE INTO HL_userRoles (userId, roleCode) VALUES (?, ?)').bind(newUid, 'user').run()
          await c.env.DB.prepare('INSERT INTO HL_oauthAccounts (userId, provider, providerSubject, providerEmail, providerEmailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(newUid, 'google', sub, email).run()
          await ssc(c, newUid)
        }
      }
      return c.redirect(safeReturnTo(row.returnTo))
    } catch (e) {
      return c.redirect(oauthErrorRedirect('/login', 'INTERNAL_ERROR', 'Gagal memproses login Google.'), 302)
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
      const pwUser = await c.env.DB.prepare('SELECT passwordHash, authProvider FROM HL_users WHERE id = ?').bind(uid).first<any>()
      if ((pwUser?.authProvider !== 'local' || !pwUser?.passwordHash) && (accounts?.cnt || 0) <= 1) return jr(c, fail('LAST_LOGIN_METHOD', 'Google adalah satuatunya metode login.', 400, [], s), 400)
      await c.env.DB.prepare("DELETE FROM HL_oauthAccounts WHERE userId = ? AND provider = 'google'").bind(uid).run()
      await AuditService.write(c.env.DB, { userId: uid, action: 'auth.google.unlink', entityType: 'HL_oauthAccounts', entityId: String(uid), metadataJson: JSON.stringify({ provider: 'google' }) })
      return jr(c, ok({ unlinked: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], s), 500) }
  })

  app.get('/api/auth/google/accounts', async (c: HC) => {
    const s = Date.now()
    try {
      const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const accounts = await c.env.DB.prepare(
        "SELECT oa.provider, oa.providerSubject, oa.providerEmail, oa.providerEmailVerified, oa.createdAt FROM HL_oauthAccounts oa WHERE oa.userId = ?"
      ).bind(uid).all<{ provider: string; providerSubject: string; providerEmail: string; providerEmailVerified: number; createdAt: string }>()
      const list = (accounts.results || []).map(a => ({
        provider: a.provider,
        email: a.providerEmail,
        linkedAt: a.createdAt,
        verified: a.providerEmailVerified === 1
      }))
      return jr(c, ok(list, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat akun tertaut.', 500, [], s), 500) }
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
      const otpLocale = parseLocale(c.req.raw.headers)
      const sendResult = await EmailSenderService.sendOtp(c.env, normalizedEmail, otp, otpLocale)
      if (!sendResult.sent) {
        await c.env.DB.prepare('DELETE FROM HL_users WHERE id = ? AND active = 0').bind(userId).run()
        return jr(c, fail('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim kode verifikasi.', 500, [], s), 500)
      }

      const otpTtl = Number((c.env as any).EMAIL_OTP_TTL_SECONDS) || 600
      return jr(c, ok({ otpRequired: true, challengeId, maskedEmail: EmailOtpService.maskEmail(normalizedEmail), expiresInSeconds: otpTtl }, 200, s), 200)
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

      const user = await c.env.DB.prepare("SELECT id, email, passwordHash, displayName, active, lastLoginAt FROM HL_users WHERE email = ? AND authProvider = 'local'").bind(normalizedEmail).first<any>()
      const passwordMatches = await CryptoService.verifyPassword(password, user?.passwordHash ?? null)

      if (!user || user.active !== 1 || !passwordMatches) return jr(c, fail('UNAUTHORIZED', 'Email atau password salah.', 401, [], s), 401)

      // ponytail: skip OTP if logged in within 30 days
      const lastLoginSec = user.lastLoginAt ? Date.parse(user.lastLoginAt) : 0
      const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000
      if (lastLoginSec && Date.now() - lastLoginSec < THIRTY_DAYS_MS) {
        const t = crypto.randomUUID(); const h = await CryptoService.sha256Token(t)
        await c.env.DB.batch([
          c.env.DB.prepare('INSERT INTO HL_sessions (userId, sessionTokenHash, createdAt, expiresAt) VALUES (?, ?, CURRENT_TIMESTAMP, datetime("now", "+" || ? || " days"))').bind(user.id, h, 30),
          c.env.DB.prepare('UPDATE HL_users SET lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id),
        ])
        setCookie(c, 'hlSession', t, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 30 * 86400 })
        const profile = await c.env.DB.prepare('SELECT id, sex, birthDate, heightCm, timezone, accessibilityMode, theme, emergencyConsent, aiConsent, dataShareConsent FROM HL_userProfiles WHERE userId = ?').bind(user.id).first<any>()
        await AuditService.write(c.env.DB, { userId: user.id, action: 'userLogin.passwordOnly', entityType: 'HL_users', entityId: user.id })
        return jr(c, ok({ user: { id: user.id, email: user.email, displayName: user.displayName, telegramEnabled: !!user.telegramEnabled, browserPushEnabled: !!user.browserPushEnabled }, profile, requiresOnboarding: !profile }, 200, s), 200)
      }

      const rateLimit = await EmailOtpService.assertRateLimit(c.env.DB, normalizedEmail)
      if (!rateLimit.allowed) return jr(c, fail('OTP_RATE_LIMITED', 'Terlalu banyak permintaan.', 429, [], s), 429)

      const { challengeId, otp, expiresAt } = await EmailOtpService.createChallenge(c.env.DB, c.env, { userId: user.id, normalizedEmail, purpose: 'login' })
      const otpLocale = parseLocale(c.req.raw.headers)
      const sendResult = await EmailSenderService.sendOtp(c.env, normalizedEmail, otp, otpLocale)
      if (!sendResult.sent) return jr(c, fail('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim kode verifikasi.', 500, [], s), 500)

      const otpTtl = Number((c.env as any).EMAIL_OTP_TTL_SECONDS) || 600
      return jr(c, ok({ otpRequired: true, challengeId, maskedEmail: EmailOtpService.maskEmail(normalizedEmail), expiresInSeconds: otpTtl }, 200, s), 200)
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
      const resendLocale = parseLocale(c.req.raw.headers)
      const sendResult = await EmailSenderService.sendOtp(c.env, row?.normalizedEmail || '', result.otp!, resendLocale)
      if (!sendResult.sent) return jr(c, fail('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim ulang kode.', 500, [], s), 500)

      const resendTtl = Number((c.env as any).EMAIL_OTP_TTL_SECONDS) || 600
      return jr(c, ok({ maskedEmail: EmailOtpService.maskEmail(row?.normalizedEmail || ''), expiresInSeconds: resendTtl }, 200, s), 200)
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
      const ms = await c.env.DB.prepare("SELECT v.metricCode, v.finalValue, v.status, v.severity, v.createdAt, v.measuredAt, v.unit FROM HL_measurementValues v JOIN HL_measurementSessions s ON s.id = v.sessionId WHERE s.userId = ? AND date(s.measuredAt) = date(?) ORDER BY v.measuredAt DESC").bind(uid, dateStr).all<any>()
      const seen = new Set<string>()
      const measurements = (ms.results || []).filter((r: any) => { if (seen.has(r.metricCode)) return false; seen.add(r.metricCode); return true })
      const sym = await c.env.DB.prepare("SELECT id, symptomDateTime, quickSymptomsJson, bodyArea, painScale, painSeverity, mood, isRedFlag FROM HL_symptomLogs WHERE userId = ? AND date(symptomDateTime) = date(?) ORDER BY symptomDateTime DESC").bind(uid, dateStr).all<any>()
      return jr(c, ok({ date: dateStr, hasData: (measurements.length || 0) > 0 || (sym.results?.length || 0) > 0, measurements: measurements, symptoms: sym.results || [] }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat hub kesehatan.', 500, [], s), 500) }
  })

  app.post('/api/auth/change-password', async (c: HC) => {
    const s = Date.now()
    try {
      const uid = await getSession(c); if (!uid) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)
      const body = await c.req.json<any>()
      const currentPassword = String(body.currentPassword || '')
      const newPassword = String(body.newPassword || '')
      if (!currentPassword || !newPassword) return jr(c, fail('VALIDATION_ERROR', 'Password lama dan baru wajib diisi.', 400, [], s), 400)
      if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return jr(c, fail('VALIDATION_ERROR', 'Password baru minimal 8 karakter dengan huruf besar, kecil, dan angka.', 400, [], s), 400)
      if (newPassword === currentPassword) return jr(c, fail('VALIDATION_ERROR', 'Password baru tidak boleh sama dengan password lama.', 400, [], s), 400)

      const userRow = await c.env.DB.prepare('SELECT id, passwordHash, authProvider FROM HL_users WHERE id = ? AND active = 1').bind(uid).first<any>()
      if (!userRow) return jr(c, fail('UNAUTHORIZED', 'Akun tidak ditemukan.', 401, [], s), 401)
      if (userRow.authProvider !== 'local') return jr(c, fail('AUTH_PROVIDER_MISMATCH', 'Akun Google tidak bisa ganti password di sini. Gunakan Google Account settings.', 400, [], s), 400)

      const matches = await CryptoService.verifyPassword(currentPassword, userRow.passwordHash)
      if (!matches) return jr(c, fail('INVALID_CREDENTIALS', 'Password lama salah.', 400, [], s), 400)

      const newHash = await CryptoService.hashPassword(newPassword)
      await c.env.DB.prepare('UPDATE HL_users SET passwordHash = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(newHash, uid).run()
      await AuditService.write(c.env.DB, { userId: uid, action: 'auth.passwordChange', entityType: 'HL_users', entityId: String(uid), metadataJson: {} })
      return jr(c, ok({ changed: true }, 200, s), 200)
    } catch (e) { return jr(c, fail('INTERNAL_ERROR', 'Gagal mengganti password.', 500, [], s), 500) }
  })
}
