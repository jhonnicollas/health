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

export function mountWhatsappRoutes(app: any) {
  // S6G-T-07: Start WhatsApp linking
  app.post('/api/whatsapp/link/start', async (c: HC) => {
    const s = Date.now()
    try {
      const user = await getAuthenticatedUser(c)
      if (!user) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      const ent = await EntitlementService.requireEntitlement(c.env.DB, user.id, 'feature.aiClinicalCopilot.whatsapp')
      if (!ent.allowed) return jr(c, fail('ENTITLEMENT_REQUIRED', 'Fitur WhatsApp AI memerlukan paket Premium.', 403, [], s), 403)

      const body = await c.req.json().catch(() => ({})) as { whatsappNumber?: string }
      const whatsappNumber = typeof body.whatsappNumber === 'string' ? body.whatsappNumber.trim() : ''
      if (!validateE164(whatsappNumber)) {
        return jr(c, fail('VALIDATION_ERROR', 'Nomor WhatsApp harus E.164 (+ dan 7-15 digit).', 400, [], s), 400)
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000))
      const otpHash = await sha256Token(otp)
      const numberHash = await sha256Token(whatsappNumber)
      const encryptedNumber = await encryptSensitive(c, whatsappNumber)

      const existing = await c.env.DB.prepare('SELECT id FROM HL_whatsappLinks WHERE userId = ? LIMIT 1').bind(user.id).first<{ id: number }>()

      let linkId: number
      if (existing?.id) {
        await c.env.DB.prepare(
          `UPDATE HL_whatsappLinks
           SET whatsappNumberEncrypted = ?, whatsappNumberHash = ?, otpHash = ?, verified = 0, aiEnabled = 0,
               consentAcceptedAt = NULL, updatedAt = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(encryptedNumber, numberHash, otpHash, existing.id).run()
        linkId = existing.id
      } else {
        linkId = await insertAndGetId(c.env.DB.prepare(
          `INSERT INTO HL_whatsappLinks
            (userId, whatsappNumberEncrypted, whatsappNumberHash, otpHash, verified, aiEnabled, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(user.id, encryptedNumber, numberHash, otpHash))
      }

      return jr(c, ok({ linkId, otpHint: maskOtp(otp), otp }, 200, s), 200)
    } catch (error) {
      console.error('whatsapp link/start error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal memulai tautan WhatsApp.', 500, [], s), 500)
    }
  })

  // S6G-T-07: Verify OTP
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
        'SELECT id, userId, whatsappNumberHash, otpHash FROM HL_whatsappLinks WHERE id = ? LIMIT 1'
      ).bind(linkId).first<{ id: number; userId: number; whatsappNumberHash: string; otpHash: string }>()

      if (!link || link.userId !== user.id) {
        return jr(c, fail('NOT_FOUND', 'Tautan tidak ditemukan.', 404, [], s), 404)
      }

      const providedHash = await sha256Token(otp)
      if (providedHash !== link.otpHash) {
        return jr(c, fail('OTP_INVALID', 'Kode OTP salah.', 400, [], s), 400)
      }

      await c.env.DB.prepare(
        `UPDATE HL_whatsappLinks
         SET verified = 1, aiEnabled = 1, consentAcceptedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(linkId).run()

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

  // S6G-T-07: Delete / disable WhatsApp link
  app.delete('/api/whatsapp/link', async (c: HC) => {
    const s = Date.now()
    try {
      const user = await getAuthenticatedUser(c)
      if (!user) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], s), 401)

      const link = await c.env.DB.prepare('SELECT id, verified FROM HL_whatsappLinks WHERE userId = ? LIMIT 1').bind(user.id).first<{ id: number; verified: number }>()
      if (!link) return jr(c, fail('NOT_FOUND', 'Tautan WhatsApp tidak ditemukan.', 404, [], s), 404)

      await c.env.DB.prepare(
        'UPDATE HL_whatsappLinks SET aiEnabled = 0, verified = 0, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
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
