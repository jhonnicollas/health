import type { Context } from 'hono'
import { AuditService } from './services/audit.js'
import { EntitlementService } from './services/entitlements.js'
import {
  getAuthenticatedUser,
  sha256Token,
  encryptSensitive,
  jsonResponse,
  success,
  failure,
  insertAndGetId
} from './utils/index-helpers.js'
import type { Env } from './types.js'

type HC = Context<{ Bindings: Env }>

function jr(c: HC, body: any, status: number) { return jsonResponse(c, { body: body.body ?? body, status } as any) }

function ok(data: unknown, status = 200, s = Date.now()) { return success(data, status as any, s) }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return failure(code as any, msg, status as any, errs, s) }

function validateE164(number: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(number)
}

function maskOtp(otp: string): string {
  return otp.replace(/./g, 'X')
}

// PRD §8.2 step 2: OTP expires; default 10 minutes. Number not already linked to another user.
const OTP_VALIDITY_MINUTES = 10
const MAX_LINK_START_PER_HOUR = 5
const linkStartBucket = new Map<number, { count: number; windowStart: number }>()

function checkLinkStartRateLimit(userId: number, now = Date.now()): boolean {
  const windowMs = 60 * 60 * 1000
  const bucket = Math.floor(now / windowMs)
  const entry = linkStartBucket.get(userId)
  if (!entry || entry.windowStart !== bucket) {
    linkStartBucket.set(userId, { count: 1, windowStart: bucket })
    return true
  }
  if (entry.count >= MAX_LINK_START_PER_HOUR) return false
  entry.count += 1
  return true
}

function computeOtpExpiry(): string {
  const expires = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000)
  return expires.toISOString()
}

export function mountWhatsappRoutes(app: any) {
  // S6G-T-07: Start WhatsApp linking (PRD §8.1: number not already linked + set otpExpiresAt)
  app.post('/api/whatsapp/link/start', async (c: HC) => {
    const s = Date.now()
    try {
      const user = await getAuthenticatedUser(c)
      if (!user) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      if (!checkLinkStartRateLimit(user.id)) {
        return jr(c, fail('RATE_LIMITED', 'Terlalu banyak percobaan penautan. Coba lagi nanti.', 429, [], s), 429)
      }

      const ent = await EntitlementService.requireEntitlement(c.env.DB, user.id, 'feature.aiClinicalCopilot.whatsapp')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur WhatsApp AI memerlukan paket Premium.', 403, [], s), 403)

      const body = await c.req.json().catch(() => ({})) as { whatsappNumber?: string }
      const whatsappNumber = typeof body.whatsappNumber === 'string' ? body.whatsappNumber.trim() : ''
      if (!validateE164(whatsappNumber)) {
        return jr(c, fail('VALIDATION_ERROR', 'Nomor WhatsApp harus E.164 (+ dan 7-15 digit).', 400, [], s), 400)
      }

      const numberHash = await sha256Token(whatsappNumber)

      // PRD §8.1 step 3 — "Number not already linked to another user".
      // UNIQUE(whatsappNumberHash) enforces this at DB level, but we surface a clean 409
      // instead of letting the INSERT/UPDATE throw a constraint exception.
      const numberOwner = await c.env.DB.prepare(
        'SELECT userId FROM HL_whatsappLinks WHERE whatsappNumberHash = ? AND userId != ? LIMIT 1'
      ).bind(numberHash, user.id).first<{ userId: number }>()
      if (numberOwner) {
        return jr(c, fail('NUMBER_ALREADY_LINKED', 'Nomor WhatsApp sudah tertaut ke akun lain.', 409, [], s), 409)
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000))
      const otpHash = await sha256Token(otp)
      const encryptedNumber = await encryptSensitive(c, whatsappNumber)
      const otpExpiresAt = computeOtpExpiry()

      const existing = await c.env.DB.prepare('SELECT id FROM HL_whatsappLinks WHERE userId = ? LIMIT 1').bind(user.id).first<{ id: number }>()

      let linkId: number
      if (existing?.id) {
        await c.env.DB.prepare(
          `UPDATE HL_whatsappLinks
           SET whatsappNumberEncrypted = ?, whatsappNumberHash = ?, otpHash = ?, otpExpiresAt = ?,
               verified = 0, aiEnabled = 0, consentAcceptedAt = NULL, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(encryptedNumber, numberHash, otpHash, otpExpiresAt, existing.id).run()
        linkId = existing.id
      } else {
        // UNIQUE(userId) and UNIQUE(whatsappNumberHash) enforced at DB.
        linkId = await insertAndGetId(c.env.DB.prepare(
          `INSERT INTO HL_whatsappLinks
            (userId, whatsappNumberEncrypted, whatsappNumberHash, otpHash, otpExpiresAt,
             verified, aiEnabled, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(user.id, encryptedNumber, numberHash, otpHash, otpExpiresAt))
      }

      return jr(c, ok({ linkId, otpHint: maskOtp(otp), otp, expiresAt: otpExpiresAt }, 200, s), 200)
    } catch (error) {
      console.error('whatsapp link/start error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal memulai tautan WhatsApp.', 500, [], s), 500)
    }
  })

  // S6G-T-07: Verify OTP (PRD §8.1 — rate-limited + otpHash cleared on success)
  app.post('/api/whatsapp/link/verify', async (c: HC) => {
    const s = Date.now()
    try {
      const user = await getAuthenticatedUser(c)
      if (!user) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      const body = await c.req.json().catch(() => ({})) as { linkId?: unknown; otp?: string }
      const linkId = Number(body.linkId)
      const otp = typeof body.otp === 'string' ? body.otp.trim() : ''
      if (!Number.isFinite(linkId) || linkId <= 0 || !/^\d{6}$/.test(otp)) {
        return jr(c, fail('VALIDATION_ERROR', 'linkId dan 6-digit OTP wajib.', 400, [], s), 400)
      }

      const link = await c.env.DB.prepare(
        'SELECT id, userId, whatsappNumberHash, otpHash, otpExpiresAt FROM HL_whatsappLinks WHERE id = ? LIMIT 1'
      ).bind(linkId).first<{
        id: number; userId: number; whatsappNumberHash: string; otpHash: string | null; otpExpiresAt: string | null
      }>()

      if (!link || link.userId !== user.id) {
        return jr(c, fail('NOT_FOUND', 'Tautan tidak ditemukan.', 404, [], s), 404)
      }

      // OTP must exist and not be expired.
      if (!link.otpHash) {
        return jr(c, fail('OTP_ALREADY_USED', 'Kode OTP sudah digunakan atau tidak tersedia. Mulai tautan ulang.', 400, [], s), 400)
      }
      if (link.otpExpiresAt && Date.parse(link.otpExpiresAt) < Date.now()) {
        return jr(c, fail('OTP_EXPIRED', 'Kode OTP sudah kadaluarsa. Mulai tautan ulang.', 400, [], s), 400)
      }

      const providedHash = await sha256Token(otp)
      if (providedHash !== link.otpHash) {
        return jr(c, fail('OTP_INVALID', 'Kode OTP salah.', 400, [], s), 400)
      }

      // PRD §8.1 step 3 — verified=1, aiEnabled=1, AND clear otpHash so OTP cannot be replayed.
      // Atomic compare-and-set: bind otpHash into the WHERE clause so two concurrent /link/verify
      // requests with the same OTP cannot both succeed — the second UPDATE will affect 0 rows and
      // we surface OTP_ALREADY_USED instead of double-verifying.
      const updateResult = await c.env.DB.prepare(
        `UPDATE HL_whatsappLinks
         SET verified = 1, aiEnabled = 1, consentAcceptedAt = CURRENT_TIMESTAMP,
             otpHash = NULL, otpExpiresAt = NULL, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ? AND otpHash = ?`
      ).bind(linkId, providedHash).run()

      if (!updateResult.meta || (updateResult.meta.changes ?? 0) === 0) {
        return jr(c, fail('OTP_ALREADY_USED', 'Kode OTP sudah digunakan. Mulai tautan ulang.', 400, [], s), 400)
      }

      await AuditService.write(c.env.DB, {
        userId: user.id,
        action: 'whatsappLinkVerified',
        entityType: 'HL_whatsappLinks',
        entityId: linkId,
        metadataJson: { whatsappNumberHash: link.whatsappNumberHash }
      })

      return jr(c, ok({ linked: true, whatsappNumberHash: link.whatsappNumberHash }, 200, s), 200)
    } catch (error) {
      console.error('whatsapp link/verify error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal verifikasi OTP WhatsApp.', 500, [], s), 500)
    }
  })

  // S6G-T-07: WhatsApp link status
  app.get('/api/whatsapp/status', async (c: HC) => {
    const s = Date.now()
    try {
      const user = await getAuthenticatedUser(c)
      if (!user) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      const link = await c.env.DB.prepare(
        'SELECT verified, aiEnabled FROM HL_whatsappLinks WHERE userId = ? LIMIT 1'
      ).bind(user.id).first<{ verified: number; aiEnabled: number }>()

      return jr(c, ok({
        linked: !!link,
        verified: link?.verified === 1,
        aiEnabled: link?.aiEnabled === 1
      }, 200, s), 200)
    } catch (error) {
      console.error('whatsapp status error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat status WhatsApp.', 500, [], s), 500)
    }
  })

  // S6G-T-07: Delete / disable WhatsApp link (PRD §8.3 — clear OTP/AI; row remains so
  // a future /link/start can re-link; whatsappNumberHash UNIQUE is preserved.)
  app.delete('/api/whatsapp/link', async (c: HC) => {
    const s = Date.now()
    try {
      const user = await getAuthenticatedUser(c)
      if (!user) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      const link = await c.env.DB.prepare('SELECT id, verified FROM HL_whatsappLinks WHERE userId = ? LIMIT 1').bind(user.id).first<{ id: number; verified: number }>()
      if (!link) return jr(c, fail('NOT_FOUND', 'Tautan WhatsApp tidak ditemukan.', 404, [], s), 404)

      await c.env.DB.prepare(
        `UPDATE HL_whatsappLinks
         SET aiEnabled = 0, verified = 0, otpHash = NULL, otpExpiresAt = NULL,
             lastMessageAt = NULL, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(link.id).run()

      await AuditService.write(c.env.DB, {
        userId: user.id,
        action: 'whatsappLinkDeleted',
        entityType: 'HL_whatsappLinks',
        entityId: link.id,
        metadataJson: { previousVerified: link.verified === 1 }
      })

      return jr(c, ok({ deleted: true, linkId: link.id }, 200, s), 200)
    } catch (error) {
      console.error('whatsapp link/delete error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal menghapus tautan WhatsApp.', 500, [], s), 500)
    }
  })
}
