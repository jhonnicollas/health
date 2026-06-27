import { CryptoService } from './crypto.js'
import type { Env } from '../types.js'

const DEFAULT_TTL = 600
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_MAX_RESENDS = 3
const DEFAULT_RESEND_COOLDOWN = 60

function envNumber(env: Env | undefined, key: string, fallback: number): number {
  if (!env) return fallback
  const raw = (env as any)[key]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export const EmailOtpService = {
  normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  },

  validateEmailFormat(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  },

  generateOtp(length = 6): string {
    const digits = crypto.getRandomValues(new Uint8Array(length))
    return Array.from(digits).map(d => (d % 10).toString()).join('')
  },

  async hashOtp(otp: string, salt: string, pepper: string): Promise<string> {
    return CryptoService.hmacSha256(salt + pepper, otp)
  },

  maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!domain) return '***@***'
    const masked = local.length <= 1 ? '*' : local[0] + '*'.repeat(Math.min(local.length - 1, 5))
    return `${masked}@${domain}`
  },

  async createChallenge(db: D1Database, env: Env | undefined, params: {
    userId: number | null
    normalizedEmail: string
    purpose: 'register' | 'login'
    ipHash?: string
  }): Promise<{ challengeId: number; otp: string; expiresAt: string }> {
    const ttl = envNumber(env, 'EMAIL_OTP_TTL_SECONDS', DEFAULT_TTL)
    const otp = EmailOtpService.generateOtp()
    const salt = crypto.randomUUID()
    const pepper = (env as any)?.ENCRYPTION_KEY || 'fallback-dev-pepper'
    const otpHash = await EmailOtpService.hashOtp(otp, salt, pepper)
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()

    const result = await db.prepare(
      `INSERT INTO HL_emailOtpChallenges (userId, normalizedEmail, otpHash, salt, purpose, expiresAt, ipHash, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(params.userId, params.normalizedEmail, otpHash, salt, params.purpose, expiresAt, params.ipHash || null).run()

    const challengeId = Number((result.meta as any)?.last_row_id ?? (result.meta as any)?.lastRowId)
    return { challengeId, otp, expiresAt }
  },

  async verifyChallenge(db: D1Database, env: Env | undefined, params: {
    challengeId: number
    otp: string
    purpose: 'register' | 'login'
  }): Promise<{ valid: boolean; error?: string; userId?: number | null; normalizedEmail?: string }> {
    const maxAttempts = envNumber(env, 'EMAIL_OTP_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS)
    const row = await db.prepare(
      `SELECT id, userId, normalizedEmail, otpHash, salt, purpose, failedAttempts, expiresAt, consumedAt
       FROM HL_emailOtpChallenges WHERE id = ?`
    ).bind(params.challengeId).first<any>()

    if (!row) return { valid: false, error: 'OTP_INVALID' }
    if (row.consumedAt) return { valid: false, error: 'OTP_CONSUMED' }
    if (row.purpose !== params.purpose) return { valid: false, error: 'OTP_INVALID' }

    const now = Date.now()
    if (now > Date.parse(row.expiresAt)) return { valid: false, error: 'OTP_EXPIRED' }
    if (row.failedAttempts >= maxAttempts) return { valid: false, error: 'OTP_TOO_MANY_ATTEMPTS' }

    const pepper = (env as any)?.ENCRYPTION_KEY || 'fallback-dev-pepper'
    const computed = await EmailOtpService.hashOtp(params.otp, row.salt, pepper)

    if (computed !== row.otpHash) {
      await db.prepare('UPDATE HL_emailOtpChallenges SET failedAttempts = failedAttempts + 1 WHERE id = ?').bind(row.id).run()
      return { valid: false, error: 'OTP_INVALID' }
    }

    await db.prepare('UPDATE HL_emailOtpChallenges SET consumedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id).run()
    return { valid: true, userId: row.userId, normalizedEmail: row.normalizedEmail }
  },

  async resendChallenge(db: D1Database, env: Env | undefined, params: {
    challengeId: number
  }): Promise<{ ok: boolean; error?: string; otp?: string; expiresAt?: string }> {
    const maxResends = envNumber(env, 'EMAIL_OTP_MAX_RESENDS', DEFAULT_MAX_RESENDS)
    const cooldown = envNumber(env, 'EMAIL_OTP_RESEND_COOLDOWN_SECONDS', DEFAULT_RESEND_COOLDOWN)
    const row = await db.prepare(
      `SELECT id, userId, normalizedEmail, otpHash, salt, purpose, consumedAt, resendCount, lastResendAt, expiresAt, ipHash
       FROM HL_emailOtpChallenges WHERE id = ?`
    ).bind(params.challengeId).first<any>()

    if (!row) return { ok: false, error: 'OTP_INVALID' }
    if (row.consumedAt) return { ok: false, error: 'OTP_CONSUMED' }
    if (row.resendCount >= maxResends) return { ok: false, error: 'OTP_RATE_LIMITED' }

    if (row.lastResendAt) {
      const lastResend = Date.parse(row.lastResendAt)
      if (Date.now() - lastResend < cooldown * 1000) return { ok: false, error: 'OTP_RESEND_COOLDOWN' }
    }

    const ttl = envNumber(env, 'EMAIL_OTP_TTL_SECONDS', DEFAULT_TTL)
    const otp = EmailOtpService.generateOtp()
    const newSalt = crypto.randomUUID()
    const pepper = (env as any)?.ENCRYPTION_KEY || 'fallback-dev-pepper'
    const otpHash = await EmailOtpService.hashOtp(otp, newSalt, pepper)
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString()

    await db.prepare(
      `UPDATE HL_emailOtpChallenges SET otpHash = ?, salt = ?, expiresAt = ?, resendCount = resendCount + 1, lastResendAt = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(otpHash, newSalt, expiresAt, row.id).run()

    return { ok: true, otp, expiresAt }
  },

  async assertRateLimit(db: D1Database, normalizedEmail: string, ipHash?: string): Promise<{ allowed: boolean }> {
    const recent = await db.prepare(
      `SELECT COUNT(*) as cnt FROM HL_emailOtpChallenges WHERE normalizedEmail = ? AND createdAt > datetime('now', '-1 hour')`
    ).bind(normalizedEmail).first<any>()

    const count = Number(recent?.cnt ?? 0)
    if (count >= 10) return { allowed: false }

    if (ipHash) {
      const ipRecent = await db.prepare(
        `SELECT COUNT(*) as cnt FROM HL_emailOtpChallenges WHERE ipHash = ? AND createdAt > datetime('now', '-1 hour')`
      ).bind(ipHash).first<any>()
      if (Number(ipRecent?.cnt ?? 0) >= 20) return { allowed: false }
    }

    return { allowed: true }
  }
}
