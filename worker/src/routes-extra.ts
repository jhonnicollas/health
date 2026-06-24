// Sprint 3 & 4 additional routes
import { Hono } from 'hono'
import { getCookie as honoGetCookie } from 'hono/cookie'
import type { Context } from 'hono'

export interface ExtraEnv {
  TELEGRAM_BOT_TOKEN?: string
  ENCRYPTION_KEY?: string
  CRON_SECRET?: string
  DB: D1Database
  LOGS: R2Bucket
  TELEGRAM_QUEUE?: Queue
}

type ApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500
const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

function nowIso() { return new Date().toISOString() }
function dateInTz(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
  catch { return new Date().toISOString().slice(0, 10) }
}

const ID_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function pad2(n: number): string { return String(n).padStart(2, '0') }

function formatIdShortDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const day = pad2(d.getUTCDate())
  const month = ID_MONTHS_SHORT[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  const hh = pad2(d.getUTCHours())
  const mm = pad2(d.getUTCMinutes())
  return `${day} ${month} ${year} ${hh}:${mm}`
}

export { formatIdShortDateTime }

function getCookie(c: Context, name: string): string | undefined {
  return honoGetCookie(c as any, name)
}

async function sha256Token(value: string): Promise<string> {
  const textEncoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  const bytes = new Uint8Array(digest)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  const b64 = btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `sha256:${b64}`
}

function getInsertedId(result: D1Result<unknown>): number {
  const meta = result.meta as Record<string, unknown> | undefined
  const id = Number(meta?.last_row_id ?? meta?.lastRowId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('D1 insert did not return a valid last_row_id')
  }
  return id
}

async function insertAndGetId(statement: D1PreparedStatement): Promise<number> {
  return getInsertedId(await statement.run())
}

async function getCurrentSession(c: Context<{ Bindings: ExtraEnv }>): Promise<number | null> {
  const token = getCookie(c, 'hlSession')
  if (!token) return null
  const tokenHash = await sha256Token(token)
  const row = await c.env.DB.prepare(
    'SELECT userId, expiresAt, revokedAt FROM HL_sessions WHERE sessionTokenHash = ? LIMIT 1'
  ).bind(tokenHash).first<{ userId: number; expiresAt: string; revokedAt: string | null }>()

  if (!row) return null
  if (row.revokedAt) return null
  if (new Date(row.expiresAt) < new Date()) return null
  return row.userId
}

function createId(prefix: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${ts}${rand}`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function jsonResponse(c: Context, body: unknown, status: ApiStatus = 200) {
  c.header('Content-Type', 'application/json; charset=utf-8')
  c.header('Cache-Control', 'no-store')
  return c.json(body as any, status as any)
}

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  for (const byte of array) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function getSensitiveDataKey(c: Context<{ Bindings: ExtraEnv }>) {
  const secret = c.env.ENCRYPTION_KEY
  if (!secret || secret.trim().length < 16) {
    throw new Error('ENCRYPTION_KEY is required for sensitive data encryption')
  }
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt'])
}

async function decryptSensitive(c: Context<{ Bindings: ExtraEnv }>, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  if (!value.startsWith('enc:v1:')) return value
  const [, , ivText, cipherText] = value.split(':')
  if (!ivText || !cipherText) return null
  const key = await getSensitiveDataKey(c)
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlDecode(ivText) },
    key,
    base64UrlDecode(cipherText)
  )
  return textDecoder.decode(decrypted)
}

function failure(code: string, message: string, status: ApiStatus, details: unknown[] = [], startedAt = Date.now()) {
  return { success: false, error: { code, message, details }, meta: { requestId: createId('req'), durationMs: Date.now() - startedAt } }
}

function success(data: unknown, status: ApiStatus = 200, startedAt = Date.now()) {
  return { success: true, data, meta: { requestId: createId('req'), durationMs: Date.now() - startedAt } }
}

async function getSystemConfigValue(c: Context<{ Bindings: ExtraEnv }>, configKey: string): Promise<string | null> {
  const row = await c.env.DB.prepare(
    'SELECT configValue FROM HL_systemConfigs WHERE configKey = ? LIMIT 1'
  ).bind(configKey).first<{ configValue: string }>()
  return row?.configValue?.trim() || null
}

async function getSystemConfigNumber(c: Context<{ Bindings: ExtraEnv }>, configKey: string): Promise<number> {
  const raw = await getSystemConfigValue(c, configKey)
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid numeric system config: ${configKey}`)
  }
  return value
}

async function resolveTelegramBotToken(c: Context<{ Bindings: ExtraEnv }>): Promise<string | null> {
  const active = await getSystemConfigValue(c, 'telegramBotActive')
  if (active && !['1', 'true', 'yes', 'on', 'enabled'].includes(active.toLowerCase())) return null
  return await getSystemConfigValue(c, 'telegramBotToken') || c.env.TELEGRAM_BOT_TOKEN || null
}

// US-3.3.2 Send emergency Telegram to emergency contacts
export async function sendEmergencyToContacts(c: Context<{ Bindings: ExtraEnv }>, userId: number, severity: string, metricCode: string, finalValue: number, unit: string, message: string) {
  const profile = await c.env.DB.prepare('SELECT emergencyConsent FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ emergencyConsent: number }>()
  if (!profile || profile.emergencyConsent !== 1) {
    return { sent: 0, skipped: 'no_consent' }
  }
  const contacts = await c.env.DB.prepare(
    "SELECT id, contactName, contactPhone, telegramChatId, consentGiven, enabled FROM HL_emergencyContacts WHERE userId = ? AND enabled = 1"
  ).bind(userId).all<{ id: number; contactName: string; contactPhone: string | null; telegramChatId: string | null; consentGiven: number; enabled: number }>()
  let sent = 0
  const botToken = await resolveTelegramBotToken(c)
  for (const contact of (contacts.results || [])) {
    if (contact.consentGiven !== 1) continue
    const contactName = await decryptSensitive(c, contact.contactName) || 'Kontak darurat'
    const contactPhone = await decryptSensitive(c, contact.contactPhone) || '-'
    const telegramChatId = await decryptSensitive(c, contact.telegramChatId)
    await insertAndGetId(c.env.DB.prepare(
      "INSERT INTO HL_notifications (userId, channel, notificationType, title, message, status, createdAt) VALUES (?, 'telegram', 'emergency_alert', ?, ?, 'pending', CURRENT_TIMESTAMP)"
    ).bind(userId, `DARURAT ${metricCode}`, `${message}\n\nKontak: ${contactName} (${contactPhone})`))
    if (telegramChatId && botToken) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramChatId, text: `DARURAT ${metricCode}: ${finalValue} ${unit}\n${message}` })
        })
        if (resp.ok) sent++
      } catch { /* ignore */ }
    }
  }
  return { sent, total: (contacts.results || []).length }
}

// US-3.3.1 helper: write HL_alerts row from emergency severity, and enqueue contact notifications
export async function createEmergencyAlert(c: Context<{ Bindings: ExtraEnv }>, userId: number, sessionId: number, metricCode: string, finalValue: number, unit: string, severity: string, message: string) {
  const alertId = await insertAndGetId(c.env.DB.prepare(
    "INSERT INTO HL_alerts (userId, sessionId, metricCode, finalValue, unit, status, severity, alertType, message, acknowledged, createdAt) VALUES (?, ?, ?, ?, ?, 'active', ?, 'emergency', ?, 0, CURRENT_TIMESTAMP)"
  ).bind(userId, sessionId, metricCode, finalValue, unit, severity, message))
  await c.env.DB.prepare(
    "INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'alertCreate', 'HL_alerts', ?, ?, CURRENT_TIMESTAMP)"
  ).bind(userId, alertId, JSON.stringify({ metricCode, severity, sessionId })).run()
  // Send to contacts (fire and forget; never blocks measurement submit)
  sendEmergencyToContacts(c, userId, severity, metricCode, finalValue, unit, message).catch(err => console.error('emergency contacts error:', err))
  return alertId
}

// US-4.3.1 streak update: idempotent per day
export async function updateDailyStreak(c: Context<{ Bindings: ExtraEnv }>, userId: number, tz: string) {
  const today = dateInTz(tz)
  const existing = await c.env.DB.prepare('SELECT id, currentCount, bestCount, lastDate FROM HL_streaks WHERE userId = ? AND streakType = ?').bind(userId, 'dailyMeasurement').first<{ id: number; currentCount: number; bestCount: number; lastDate: string | null }>()
  if (!existing) {
    await insertAndGetId(c.env.DB.prepare("INSERT INTO HL_streaks (userId, streakType, currentCount, bestCount, lastDate, updatedAt) VALUES (?, 'dailyMeasurement', 1, 1, ?, CURRENT_TIMESTAMP)").bind(userId, today))
    return { currentCount: 1, bestCount: 1, today }
  }
  if (existing.lastDate === today) {
    return { currentCount: existing.currentCount, bestCount: existing.bestCount, today }
  }
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) })()
  // US-4.3.3 safe gamification: cap increment at 1 per day; never increment if lastDate was within 36h and not a new day
  const newCount = existing.lastDate === yesterday ? existing.currentCount + 1 : 1
  // US-4.3.3 also: if currentCount > 10 in a single day, do not increase again (idempotent guard)
  const newBest = Math.max(existing.bestCount, newCount)
  await c.env.DB.prepare('UPDATE HL_streaks SET currentCount = ?, bestCount = ?, lastDate = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(newCount, newBest, today, existing.id).run()
  return { currentCount: newCount, bestCount: newBest, today }
}

// US-4.3.2 idempotent badge awarding
export async function awardBadges(c: Context<{ Bindings: ExtraEnv }>, userId: number, streakCount: number) {
  const awarded: string[] = []
  const map: Array<{ code: string; when: (s: number) => boolean }> = [
    { code: 'threeDayConsistent', when: s => s >= 3 },
    { code: 'sevenDayConsistent', when: s => s >= 7 },
    { code: 'thirtyDayConsistent', when: s => s >= 30 }
  ]
  for (const m of map) {
    if (!m.when(streakCount)) continue
    const exists = await c.env.DB.prepare('SELECT id FROM HL_userBadges WHERE userId = ? AND badgeCode = ?').bind(userId, m.code).first<{ id: number }>()
    if (exists) continue
    await insertAndGetId(c.env.DB.prepare("INSERT INTO HL_userBadges (userId, badgeCode, earnedAt, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(userId, m.code))
    await c.env.DB.prepare(
      "INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'badgeEarned', 'HL_userBadges', ?, ?, CURRENT_TIMESTAMP)"
    ).bind(userId, m.code, JSON.stringify({ badgeCode: m.code })).run()
    awarded.push(m.code)
  }
  return awarded
}

export function mountExtraRoutes(app: Hono<{ Bindings: ExtraEnv }>) {

  // GAP-12: toggle consent for emergency contact
  app.patch('/api/emergency/contacts/:id/consent', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const contactId = Number(c.req.param('id'))
      const body = await c.req.json() as { consentGiven: boolean }
      const contact = await c.env.DB.prepare(
        'SELECT id, consentGiven FROM HL_emergencyContacts WHERE id = ? AND userId = ?'
      ).bind(contactId, userId).first<{ id: number; consentGiven: number }>()
      if (!contact) return jsonResponse(c, failure('NOT_FOUND', 'Kontak tidak ditemukan.', 404, [], startedAt), 404)
      const newValue = body.consentGiven ? 1 : 0
      await c.env.DB.prepare(
        'UPDATE HL_emergencyContacts SET consentGiven = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?'
      ).bind(newValue, contactId, userId).run()
      await c.env.DB.prepare(
        "INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'HL_emergencyContacts', ?, ?, CURRENT_TIMESTAMP)"
      ).bind(userId, newValue ? 'emergencyConsentGiven' : 'emergencyConsentRevoked', contactId, JSON.stringify({ consentGiven: Boolean(newValue) })).run()
      return jsonResponse(c, success({ contactId, consentGiven: Boolean(newValue) }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update consent.', 500, [], startedAt), 500)
    }
  })

  // GAP-19: role-based access check for family
  app.get('/api/family/access-check', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const memberRows = await c.env.DB.prepare(
        "SELECT id, role, canViewDashboard, canInputMeasurement, canReceiveAlert FROM HL_familyLinks WHERE linkedUserId = ? AND status = 'active'"
      ).bind(userId).all<{
        id: number; role: string; canViewDashboard: number; canInputMeasurement: number; canReceiveAlert: number
      }>()
      const roles = (memberRows.results || []).map(row => ({
        memberId: row.id,
        role: row.role,
        permissions: {
          canViewDashboard: Boolean(row.canViewDashboard),
          canInputMeasurement: Boolean(row.canInputMeasurement),
          canReceiveAlert: Boolean(row.canReceiveAlert),
          canViewReports: row.role === 'doctorViewer' || Boolean(row.canViewDashboard)
        }
      }))
      return jsonResponse(c, success({ roles }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal cek akses.', 500, [], startedAt), 500)
    }
  })

  // GAP-13: Sleep vs Blood Pressure pattern detection
  app.post('/api/patterns/generate/sleep-bp', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const lowSleepDays = await c.env.DB.prepare(
        "SELECT substr(measuredAt, 1, 10) as day, AVG(mv.finalValue) as avgSystolic FROM HL_measurementValues mv WHERE mv.userId = ? AND mv.metricCode = 'systolic' AND mv.measuredAt >= ? AND EXISTS (SELECT 1 FROM HL_measurementValues sv WHERE sv.userId = mv.userId AND sv.metricCode = 'sleepDuration' AND substr(sv.measuredAt, 1, 10) = substr(mv.measuredAt, 1, 10) AND sv.finalValue < 6 AND sv.measuredAt >= ?) GROUP BY day"
      ).bind(userId, since, since).all<{ day: string; avgSystolic: number }>()
      const normalSleepDays = await c.env.DB.prepare(
        "SELECT substr(measuredAt, 1, 10) as day, AVG(mv.finalValue) as avgSystolic FROM HL_measurementValues mv WHERE mv.userId = ? AND mv.metricCode = 'systolic' AND mv.measuredAt >= ? AND EXISTS (SELECT 1 FROM HL_measurementValues sv WHERE sv.userId = mv.userId AND sv.metricCode = 'sleepDuration' AND substr(sv.measuredAt, 1, 10) = substr(mv.measuredAt, 1, 10) AND sv.finalValue >= 7 AND sv.measuredAt >= ?) GROUP BY day"
      ).bind(userId, since, since).all<{ day: string; avgSystolic: number }>()
      const sleepDays = (lowSleepDays.results || []).length + (normalSleepDays.results || []).length
      if (sleepDays < 14) {
        return jsonResponse(c, success({ insight: 'Data belum cukup untuk menampilkan pola tidur vs tekanan darah (minimal 14 hari data).', hasEnoughData: false }, 200, startedAt), 200)
      }
      const lowAvg = lowSleepDays.results?.length ? lowSleepDays.results.reduce((s: number, r: { avgSystolic: number }) => s + r.avgSystolic, 0) / lowSleepDays.results.length : 0
      const normalAvg = normalSleepDays.results?.length ? normalSleepDays.results.reduce((s: number, r: { avgSystolic: number }) => s + r.avgSystolic, 0) / normalSleepDays.results.length : 0
      const diff = lowAvg - normalAvg
      const direction = diff > 0 ? 'lebih tinggi' : 'lebih rendah'
      const insightText = `Pada hari dengan tidur <6 jam, tekanan darah sistolik rata-rata ${lowAvg.toFixed(1)} mmHg, sedangkan pada hari tidur >=7 jam rata-rata ${normalAvg.toFixed(1)} mmHg. Sistolik cenderung ${direction} saat tidur kurang. Ini korelasi, bukan diagnosis. Konsultasikan dengan dokter.`
      const insightId = await insertAndGetId(c.env.DB.prepare("INSERT INTO HL_patternInsights (userId, insightType, rangeStart, rangeEnd, summaryText, dataJson, createdAt) VALUES (?, 'sleep_bp', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(userId, since, nowIso(), insightText, JSON.stringify({ lowSleepAvg: lowAvg, normalSleepAvg: normalAvg, diff })))
      return jsonResponse(c, success({ insightId, insight: insightText, hasEnoughData: true, lowSleepAvg: lowAvg, normalSleepAvg: normalAvg }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // GAP-21: rate limit check for OCR
  app.post('/api/measurements/extract/limit-check', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const maxR = await getSystemConfigNumber(c, 'ocrRateLimitMax')
      const windowMin = await getSystemConfigNumber(c, 'ocrRateLimitWindowMin')
      const since = new Date(Date.now() - windowMin * 60 * 1000).toISOString()
      const count = await c.env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM HL_aiExtractions WHERE userId = ? AND createdAt >= ?"
      ).bind(userId, since).first<{ cnt: number }>()
      if ((count?.cnt || 0) >= maxR) {
        return jsonResponse(c, failure('RATE_LIMITED', `Maksimum ${maxR} ekstraksi per ${windowMin} menit.`, 429, [], startedAt), 429)
      }
      return jsonResponse(c, success({ allowed: true, remaining: maxR - (count?.cnt || 0) }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-3.3.2 manual trigger (for tests; in prod the queue consumer does it)
  app.post('/api/emergency/contacts/notify', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const body = await c.req.json() as { metricCode: string; finalValue: number; unit: string; severity: string; message: string }
      const r = await sendEmergencyToContacts(c, userId, body.severity, body.metricCode, body.finalValue, body.unit, body.message)
      return jsonResponse(c, success(r, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-3.4.2 daily reminder cron
  app.post('/api/internal/cron/reminders', async (c) => {
    const startedAt = Date.now()
    try {
      const authHeader = c.req.header('authorization') || c.req.header('Authorization')
      if (!c.env.CRON_SECRET || authHeader !== `Bearer ${c.env.CRON_SECRET}`) {
        return jsonResponse(c, failure('UNAUTHORIZED', 'Unauthorized cron.', 401, [], startedAt), 401)
      }
      const now = new Date()
      const reminders = await c.env.DB.prepare(
        "SELECT id, userId, reminderType, scheduleTime, timezone, payloadJson FROM HL_reminderSettings WHERE enabled = 1"
      ).all<{ id: string; userId: string; reminderType: string; scheduleTime: string; timezone: string; payloadJson: string | null }>()
      const nowInTz = (tz: string) => {
        try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now) }
        catch { return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` }
      }
      let fired = 0
      for (const r of (reminders.results || [])) {
        if (nowInTz(r.timezone || 'UTC') !== r.scheduleTime) continue
        await insertAndGetId(c.env.DB.prepare(
          "INSERT INTO HL_notifications (userId, channel, notificationType, title, message, status, createdAt) VALUES (?, 'inApp', 'reminder', ?, ?, 'sent', CURRENT_TIMESTAMP)"
        ).bind(r.userId, `Pengingat: ${r.reminderType}`, 'Waktunya melakukan pengukuran.'))
        fired++
      }
      return jsonResponse(c, success({ fired, checked: (reminders.results || []).length }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Cron gagal.', 500, [], startedAt), 500)
    }
  })

  // US-3.5.3 medication adherence summary
  app.get('/api/medications/adherence', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const profile = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ timezone: string }>()
      const tz = profile?.timezone || 'UTC'
      const today = dateInTz(tz)
      const startOfWeek = (() => { const d = new Date(); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10) })()
      const rows = await c.env.DB.prepare(
        "SELECT status, COUNT(*) as cnt FROM HL_medicationLogs WHERE userId = ? AND substr(takenAt, 1, 10) >= ? GROUP BY status"
      ).bind(userId, startOfWeek).all<{ status: string; cnt: number }>()
      let taken = 0, total = 0
      for (const r of (rows.results || [])) { total += r.cnt; if (r.status === 'taken') taken += r.cnt }
      const adherence = total > 0 ? Math.round((taken / total) * 100) : 0
      return jsonResponse(c, success({ date: today, adherence, taken, total }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.1 generate doctor-ready PDF (HTML) — saved to R2 + HL_reports
  app.post('/api/reports/doctor-ready', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const rangeStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const rangeEnd = new Date().toISOString()
      const values = await c.env.DB.prepare(
        'SELECT metricCode, finalValue, unit, status, severity, measuredAt FROM HL_measurementValues WHERE userId = ? AND measuredAt BETWEEN ? AND ? ORDER BY measuredAt ASC'
      ).bind(userId, rangeStart, rangeEnd).all()
      const profile = await c.env.DB.prepare('SELECT displayName FROM HL_users WHERE id = ?').bind(userId).first<{ displayName: string }>()
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan 30 Hari</title></head><body><h1>Laporan Kesehatan 30 Hari</h1><p>Nama: ${escapeHtml(profile?.displayName || '-')}</p><p>Rentang: ${formatIdShortDateTime(rangeStart)} s/d ${formatIdShortDateTime(rangeEnd)}</p><table border="1" cellpadding="4"><tr><th>Tanggal</th><th>Metrik</th><th>Nilai</th><th>Unit</th><th>Status</th><th>Severity</th></tr>${(values.results || []).map((v: any) => `<tr><td>${formatIdShortDateTime(v.measuredAt)}</td><td>${v.metricCode}</td><td>${v.finalValue}</td><td>${v.unit}</td><td>${v.status}</td><td>${v.severity}</td></tr>`).join('')}</table><p><em>Laporan ini hanya data, bukan diagnosis. Konsultasikan dengan dokter.</em></p></body></html>`
      const reportId = await (async () => {
        const tempId = Date.now().toString(36)
        const r2Key = `HL/users/${userId}/reports/${tempId}.html`
        await c.env.LOGS.put(r2Key, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } })
        return insertAndGetId(c.env.DB.prepare(
          "INSERT INTO HL_reports (userId, reportType, rangeStart, rangeEnd, r2Key, status, summaryJson, createdAt, updatedAt) VALUES (?, 'doctorReady30d', ?, ?, ?, 'ready', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ).bind(userId, rangeStart, rangeEnd, r2Key, JSON.stringify({ count: (values.results || []).length })))
      })()
      await c.env.DB.prepare(
        "INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'reportGenerate', 'HL_reports', ?, ?, CURRENT_TIMESTAMP)"
      ).bind(userId, reportId, JSON.stringify({ reportType: 'doctorReady30d' })).run()
      return jsonResponse(c, success({ reportId, status: 'ready' }, 201, startedAt), 201)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal generate PDF.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.3 download (HTML, since Workers free tier cannot run Puppeteer)
  app.get('/api/reports/:id/download', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const reportId = c.req.param('id')
      const report = await c.env.DB.prepare('SELECT userId, r2Key FROM HL_reports WHERE id = ?').bind(reportId).first<{ userId: number; r2Key: string }>()
      if (!report) return jsonResponse(c, failure('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      if (report.userId !== userId) {
        const link = await c.env.DB.prepare("SELECT id FROM HL_familyLinks WHERE ownerUserId = ? AND linkedUserId = ? AND status = 'active' AND canViewDashboard = 1").bind(report.userId, userId).first()
        if (!link) return jsonResponse(c, failure('FORBIDDEN', 'Tidak ada akses.', 403, [], startedAt), 403)
      }
      const obj = await c.env.LOGS.get(report.r2Key)
      if (!obj) return jsonResponse(c, failure('NOT_FOUND', 'File tidak ditemukan.', 404, [], startedAt), 404)
      return new Response(obj.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal download.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.4 share link
  app.post('/api/reports/:id/share', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const reportId = c.req.param('id')
      const body = await c.req.json() as { recipientLabel?: string; expiresInHours?: number }
      const report = await c.env.DB.prepare('SELECT userId FROM HL_reports WHERE id = ?').bind(reportId).first<{ userId: number }>()
      if (!report) return jsonResponse(c, failure('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      if (report.userId !== userId) return jsonResponse(c, failure('FORBIDDEN', 'Tidak memiliki akses.', 403, [], startedAt), 403)
      const shareToken = crypto.randomUUID().replace(/-/g, '')
      const shareTokenHash = await sha256Token(shareToken)
      const expiresInHours = Math.min(Math.max(body.expiresInHours ?? 24, 1), 168)
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
      await insertAndGetId(c.env.DB.prepare(
        "INSERT INTO HL_reportShares (reportId, userId, shareTokenHash, recipientLabel, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      ).bind(reportId, userId, shareTokenHash, body.recipientLabel || null, expiresAt))
      return jsonResponse(c, success({ shareToken, expiresAt, shareUrl: `/api/reports/share/${shareToken}` }, 201, startedAt), 201)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal share.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.4 public share view
  app.get('/api/reports/share/:shareToken', async (c) => {
    const startedAt = Date.now()
    try {
      const token = c.req.param('shareToken')
      const tokenHash = await sha256Token(token)
      const share = await c.env.DB.prepare('SELECT reportId, expiresAt, revokedAt FROM HL_reportShares WHERE shareTokenHash = ?').bind(tokenHash).first<{ reportId: string; expiresAt: string; revokedAt: string | null }>()
      if (!share) return jsonResponse(c, failure('NOT_FOUND', 'Link share tidak ditemukan.', 404, [], startedAt), 404)
      if (share.revokedAt) return jsonResponse(c, failure('VALIDATION_ERROR', 'Link share sudah dicabut.', 400, [], startedAt), 400)
      if (new Date(share.expiresAt) < new Date()) return jsonResponse(c, failure('VALIDATION_ERROR', 'Link share kadaluarsa.', 400, [], startedAt), 400)
      const report = await c.env.DB.prepare('SELECT r2Key FROM HL_reports WHERE id = ?').bind(share.reportId).first<{ r2Key: string }>()
      if (!report) return jsonResponse(c, failure('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      const obj = await c.env.LOGS.get(report.r2Key)
      if (!obj) return jsonResponse(c, failure('NOT_FOUND', 'File tidak ditemukan.', 404, [], startedAt), 404)
      return new Response(obj.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.2.1 start fasting
  app.post('/api/fasting/start', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const body = await c.req.json() as { fastingType?: string; targetHours?: number }
      const active = await c.env.DB.prepare("SELECT id FROM HL_fastingSessions WHERE userId = ? AND status = 'active'").bind(userId).first<{ id: string }>()
      if (active) return jsonResponse(c, failure('VALIDATION_ERROR', 'Sesi puasa aktif sudah ada.', 400, [], startedAt), 400)
      const fastingType = (['glucoseFasting', 'cholesterolTotal', 'uricAcid', 'general'].includes(body.fastingType || '') ? body.fastingType : 'general') as string
      const targetHours = Number(body.targetHours) || 8
      const fastId = await insertAndGetId(c.env.DB.prepare(
        "INSERT INTO HL_fastingSessions (userId, fastingType, targetHours, startedAt, status, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).bind(userId, fastingType, targetHours))
      return jsonResponse(c, success({ fastingId: fastId, fastingType, targetHours, startedAt: nowIso() }, 201, startedAt), 201)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.2.2 stop fasting
  app.post('/api/fasting/stop', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const body = await c.req.json() as { status?: 'completed' | 'cancelled' }
      const active = await c.env.DB.prepare("SELECT id, startedAt, targetHours FROM HL_fastingSessions WHERE userId = ? AND status = 'active'").bind(userId).first<{ id: string; startedAt: string; targetHours: number }>()
      if (!active) return jsonResponse(c, failure('NOT_FOUND', 'Tidak ada sesi aktif.', 404, [], startedAt), 404)
      const endedAt = nowIso()
      const durationHours = (new Date(endedAt).getTime() - new Date(active.startedAt).getTime()) / 3600000
      const newStatus = body.status === 'cancelled' ? 'cancelled' : 'completed'
      await c.env.DB.prepare("UPDATE HL_fastingSessions SET endedAt = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(endedAt, newStatus, active.id).run()
      return jsonResponse(c, success({ fastingId: active.id, status: newStatus, durationHours: Math.round(durationHours * 100) / 100, targetHours: active.targetHours }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.2 current fasting
  app.get('/api/fasting/current', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const active = await c.env.DB.prepare("SELECT id, fastingType, targetHours, startedAt FROM HL_fastingSessions WHERE userId = ? AND status = 'active' LIMIT 1").bind(userId).first<{ id: string; fastingType: string; targetHours: number; startedAt: string }>()
      if (!active) return jsonResponse(c, success({ active: false }, 200, startedAt), 200)
      const elapsedHours = (Date.now() - new Date(active.startedAt).getTime()) / 3600000
      return jsonResponse(c, success({ active: true, ...active, elapsedHours: Math.round(elapsedHours * 100) / 100 }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.3.1 get current streak
  app.get('/api/streaks', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const row = await c.env.DB.prepare("SELECT currentCount, bestCount, lastDate FROM HL_streaks WHERE userId = ? AND streakType = 'dailyMeasurement'").bind(userId).first<{ currentCount: number; bestCount: number; lastDate: string | null }>()
      return jsonResponse(c, success({ currentCount: row?.currentCount || 0, bestCount: row?.bestCount || 0, lastDate: row?.lastDate || null }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.3.2 list badges
  app.get('/api/badges', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const rows = await c.env.DB.prepare('SELECT badgeCode, earnedAt FROM HL_userBadges WHERE userId = ? ORDER BY earnedAt DESC').bind(userId).all()
      return jsonResponse(c, success({ badges: rows.results || [] }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.4.2 weight vs blood pressure pattern
  app.post('/api/patterns/generate/weight-bp', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const weight = await c.env.DB.prepare("SELECT AVG(finalValue) as avg, COUNT(*) as cnt FROM HL_measurementValues WHERE userId = ? AND metricCode = 'bodyWeight' AND measuredAt >= ?").bind(userId, since).first<{ avg: number; cnt: number }>()
      const bp = await c.env.DB.prepare("SELECT AVG(finalValue) as avg, COUNT(*) as cnt FROM HL_measurementValues WHERE userId = ? AND metricCode = 'systolic' AND measuredAt >= ?").bind(userId, since).first<{ avg: number; cnt: number }>()
      if ((weight?.cnt || 0) < 14 || (bp?.cnt || 0) < 14) {
        return jsonResponse(c, success({ insight: 'Data belum cukup untuk menampilkan pola (minimal 14 hari data).', hasEnoughData: false }, 200, startedAt), 200)
      }
      const insightText = `Berat badan rata-rata ${weight?.avg?.toFixed(1)} kg dengan tekanan darah sistolik rata-rata ${bp?.avg?.toFixed(0)} mmHg. Konsultasikan dengan dokter untuk interpretasi lebih lanjut.`
      const insightId = await insertAndGetId(c.env.DB.prepare("INSERT INTO HL_patternInsights (userId, insightType, rangeStart, rangeEnd, summaryText, dataJson, createdAt) VALUES (?, 'weight_bp', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(userId, since, nowIso(), insightText, JSON.stringify({ weight, bp })))
      return jsonResponse(c, success({ insightId, insight: insightText, hasEnoughData: true }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.4.3 medication vs metric pattern
  app.post('/api/patterns/generate/medication', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      const logs = await c.env.DB.prepare("SELECT status, COUNT(*) as cnt FROM HL_medicationLogs WHERE userId = ? AND takenAt >= ? GROUP BY status").bind(userId, since).all<{ status: string; cnt: number }>()
      const total = (logs.results || []).reduce((s, r) => s + r.cnt, 0)
      const taken = (logs.results || []).filter(r => r.status === 'taken').reduce((s, r) => s + r.cnt, 0)
      const adherence = total > 0 ? Math.round((taken / total) * 100) : 0
      const insightText = `Tingkat kepatuhan minum obat Anda ${adherence}% dalam 14 hari terakhir. Ini bukan saran dosis, hanya ringkasan data. Konsultasikan dengan dokter untuk perubahan dosis.`
      const insightId = await insertAndGetId(c.env.DB.prepare("INSERT INTO HL_patternInsights (userId, insightType, rangeStart, rangeEnd, summaryText, dataJson, createdAt) VALUES (?, 'medication', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(userId, since, nowIso(), insightText, JSON.stringify({ logs: logs.results, adherence })))
      return jsonResponse(c, success({ insightId, insight: insightText, adherence, hasEnoughData: total > 0 }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  // US-4.6.3 list draft sync status
  app.get('/api/measurements/drafts', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const rows = await c.env.DB.prepare("SELECT id, profileId, status, selectedMetricsJson, draftDataJson, createdAt FROM HL_measurementDrafts WHERE userId = ? ORDER BY createdAt DESC LIMIT 50").bind(userId).all()
      return jsonResponse(c, success({ drafts: rows.results || [] }, 200, startedAt), 200)
    } catch (e) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })

  app.delete('/api/measurements/:id', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const sessionId = c.req.param('id')
      const session = await c.env.DB.prepare('SELECT id, userId FROM HL_measurementSessions WHERE id = ?').bind(sessionId).first<{ id: number; userId: number }>()
      if (!session) return jsonResponse(c, failure('NOT_FOUND', 'Sesi pengukuran tidak ditemukan.', 404, [], startedAt), 404)
      if (session.userId !== userId) return jsonResponse(c, failure('FORBIDDEN', 'Anda tidak memiliki akses ke sesi ini.', 403, [], startedAt), 403)
      const attachments = await c.env.DB.prepare('SELECT r2Key FROM HL_measurementAttachments WHERE sessionId = ?').bind(sessionId).all<{ r2Key: string }>()
      for (const att of (attachments.results || [])) {
        try { await c.env.LOGS.delete(att.r2Key) } catch {}
      }
      await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM HL_measurementAttachments WHERE sessionId = ?').bind(sessionId),
        c.env.DB.prepare('DELETE FROM HL_measurementValues WHERE sessionId = ?').bind(sessionId),
        c.env.DB.prepare('DELETE FROM HL_alerts WHERE sessionId = ?').bind(sessionId),
        c.env.DB.prepare('DELETE FROM HL_measurementSessions WHERE id = ? AND userId = ?').bind(sessionId, userId),
        c.env.DB.prepare("INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'measurementDelete', 'HL_measurementSessions', ?, ?, CURRENT_TIMESTAMP)").bind(userId, String(sessionId), JSON.stringify({ sessionId }))
      ])
      return jsonResponse(c, success({ deleted: true }, 200, startedAt), 200)
    } catch (e) {
      console.error('measurement delete error:', e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menghapus pengukuran.', 500, [], startedAt), 500)
    }
  })

  app.get('/api/dashboard/comparison', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const metricCode = c.req.query('metricCode') || 'systolic'
      const asOfDate = c.req.query('asOfDate') || new Date().toISOString().slice(0, 10)
      const todayRow = await c.env.DB.prepare(
        'SELECT finalValue FROM HL_measurementValues WHERE userId = ? AND metricCode = ? AND substr(measuredAt,1,10) <= ? ORDER BY measuredAt DESC LIMIT 1'
      ).bind(userId, metricCode, asOfDate).first<{ finalValue: number }>()
      const threeDaysAgo = new Date(new Date(asOfDate).getTime() - 3 * 86400000).toISOString().slice(0, 10)
      const sevenDaysAgo = new Date(new Date(asOfDate).getTime() - 7 * 86400000).toISOString().slice(0, 10)
      const avg3 = await c.env.DB.prepare(
        'SELECT AVG(finalValue) as avgVal, COUNT(*) as cnt FROM HL_measurementValues WHERE userId = ? AND metricCode = ? AND substr(measuredAt,1,10) >= ? AND substr(measuredAt,1,10) < ?'
      ).bind(userId, metricCode, threeDaysAgo, asOfDate).first<{ avgVal: number; cnt: number }>()
      const avg7 = await c.env.DB.prepare(
        'SELECT AVG(finalValue) as avgVal, COUNT(*) as cnt FROM HL_measurementValues WHERE userId = ? AND metricCode = ? AND substr(measuredAt,1,10) >= ? AND substr(measuredAt,1,10) < ?'
      ).bind(userId, metricCode, sevenDaysAgo, asOfDate).first<{ avgVal: number; cnt: number }>()
      const todayValue = todayRow?.finalValue ?? null
      const threeDayAverage = avg3?.cnt && avg3.cnt >= 3 ? Math.round((avg3.avgVal || 0) * 10) / 10 : null
      const sevenDayAverage = avg7?.cnt && avg7.cnt >= 7 ? Math.round((avg7.avgVal || 0) * 10) / 10 : null
      const delta3Day = todayValue !== null && threeDayAverage !== null ? Math.round((todayValue - threeDayAverage) * 10) / 10 : null
      const delta7Day = todayValue !== null && sevenDayAverage !== null ? Math.round((todayValue - sevenDayAverage) * 10) / 10 : null
      const status = delta3Day !== null ? (delta3Day > 0 ? 'up' : delta3Day < 0 ? 'down' : 'stable') : 'unknown'
      return jsonResponse(c, success({
        metricCode, todayValue, threeDayAverage, sevenDayAverage,
        delta3Day, delta7Day, status,
        hasEnough3DayData: threeDayAverage !== null,
        hasEnough7DayData: sevenDayAverage !== null
      }, 200, startedAt), 200)
    } catch (e) {
      console.error('dashboard comparison error:', e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat perbandingan.', 500, [], startedAt), 500)
    }
  })

  app.get('/api/ai/recommendations', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
      const cursor = c.req.query('cursor')
      let query = 'SELECT id, sessionId, summaryText, safetyStatus, modelName, durationMs, createdAt FROM HL_aiRecommendations WHERE userId = ?'
      const binds: (number | string)[] = [userId]
      if (cursor) { query += ' AND id < ?'; binds.push(cursor) }
      query += ' ORDER BY id DESC LIMIT ?'
      binds.push(limit + 1)
      const rows = await c.env.DB.prepare(query).bind(...binds).all()
      const results = (rows.results || []).slice(0, limit)
      const hasMore = (rows.results || []).length > limit
      const nextCursor = hasMore && results.length > 0 ? String(results[results.length - 1].id) : null
      return jsonResponse(c, success({ recommendations: results, pagination: { limit, cursor: nextCursor, hasMore } }, 200, startedAt), 200)
    } catch (e) {
      console.error('ai recommendations list error:', e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat rekomendasi.', 500, [], startedAt), 500)
    }
  })

  app.get('/api/kb/:slug', async (c) => {
    const startedAt = Date.now()
    try {
      const slug = c.req.param('slug')
      const row = await c.env.DB.prepare('SELECT id, slug, title, category, contentMarkdown, sortOrder FROM HL_knowledgeArticles WHERE slug = ? AND active = 1 LIMIT 1').bind(slug).first<{ id: number; slug: string; title: string; category: string; contentMarkdown: string; sortOrder: number }>()
      if (row) return jsonResponse(c, success({ article: row }, 200, startedAt), 200)
      const fallbacks: Record<string, { id: string; slug: string; title: string; category: string; contentMarkdown: string }> = {
        'yuwell-yx106': { id: 'kb-yuwell-yx106', slug: 'yuwell-yx106', title: 'Panduan Yuwell YX106 Oximeter', category: 'device', contentMarkdown: '## Yuwell YX106 Oximeter\n\nClamp pada jari yang bersih dan hangat. Tunggu hingga angka stabil sebelum memfoto.\n\n### Tips Foto\nPastikan layar terlihat jelas, tidak ada silau.\n\n### Nilai Normal\nSpO2 95-100%, Heart Rate 60-100 bpm.' },
        'omron-hem7194t1fl': { id: 'kb-omron', slug: 'omron-hem7194t1fl', title: 'Panduan OMRON HEM 7194 T1 FL', category: 'device', contentMarkdown: '## OMRON HEM 7194 T1 FL\n\nDuduk tenang 5 menit sebelum mengukur. Pangkas lengan pada posisi jantung.\n\n### Nilai Normal\nSistolik <120, Diastolik <80 mmHg (AHA 2017).' },
        'sinocare-m101': { id: 'kb-sinocare', slug: 'sinocare-m101', title: 'Panduan Sinocare M101 GCU', category: 'device', contentMarkdown: '## Sinocare M101 GCU\n\nPilih mode test yang benar (fasting/post-meal). Cukup darah pada strip.\n\n### Nilai Normal\nGula Darah Puasa: 70-100 mg/dL, Post-Meal 2 Jam: <140 mg/dL.' },
        'thermometer': { id: 'kb-thermometer', slug: 'thermometer', title: 'Panduan Termometer', category: 'device', contentMarkdown: '## Termometer\n\nPastikan alat bersih dan baterai cukup. Ukur sesuai petunjuk (axillary/oral).' },
        'body-scale': { id: 'kb-scale', slug: 'body-scale', title: 'Panduan Timbangan Badan', category: 'device', contentMarkdown: '## Timbangan Badan\n\nTimbang pada permukaan datar dan keras. Ukur pada waktu yang sama setiap hari.' },
        'health-disclaimer': { id: 'kb-disclaimer', slug: 'health-disclaimer', title: 'Disclaimer Kesehatan', category: 'safety', contentMarkdown: '## Disclaimer\n\nAplikasi ini membantu pencatatan, bukan diagnosis. Selalu konsultasi dokter.' }
      }
      const fallback = fallbacks[slug]
      if (fallback) return jsonResponse(c, success({ article: fallback }, 200, startedAt), 200)
      return jsonResponse(c, failure('NOT_FOUND', 'Artikel tidak ditemukan.', 404, [], startedAt), 404)
    } catch (e) {
      console.error('kb slug error:', e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat artikel.', 500, [], startedAt), 500)
    }
  })

  app.put('/api/settings/consent', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const body = await c.req.json() as { aiConsent?: boolean; emergencyConsent?: boolean; dataShareConsent?: boolean }
      const updates: string[] = []
      const values: (number | string)[] = []
      if (body.aiConsent !== undefined) { updates.push('aiConsent = ?'); values.push(body.aiConsent ? 1 : 0) }
      if (body.emergencyConsent !== undefined) { updates.push('emergencyConsent = ?'); values.push(body.emergencyConsent ? 1 : 0) }
      if (body.dataShareConsent !== undefined) { updates.push('dataShareConsent = ?'); values.push(body.dataShareConsent ? 1 : 0) }
      if (updates.length === 0) return jsonResponse(c, failure('VALIDATION_ERROR', 'Tidak ada field yang dikirim.', 400, [], startedAt), 400)
      updates.push('updatedAt = CURRENT_TIMESTAMP')
      values.push(userId)
      await c.env.DB.batch([
        c.env.DB.prepare(`UPDATE HL_userProfiles SET ${updates.join(', ')} WHERE userId = ?`).bind(...values),
        c.env.DB.prepare("INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'consentUpdate', 'HL_userProfiles', ?, ?, CURRENT_TIMESTAMP)").bind(userId, String(userId), JSON.stringify(body))
      ])
      const consentTypes = [
        ...(body.aiConsent !== undefined ? [{ type: 'aiConsent', val: body.aiConsent }] : []),
        ...(body.emergencyConsent !== undefined ? [{ type: 'emergencyConsent', val: body.emergencyConsent }] : []),
        ...(body.dataShareConsent !== undefined ? [{ type: 'dataShareConsent', val: body.dataShareConsent }] : [])
      ]
      for (const ct of consentTypes) {
        await c.env.DB.prepare("INSERT INTO HL_userConsents (userId, consentType, consentValue, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(userId, ct.type, ct.val ? 1 : 0).run()
      }
      return jsonResponse(c, success({ updated: true }, 200, startedAt), 200)
    } catch (e) {
      console.error('settings consent error:', e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memperbarui persetujuan.', 500, [], startedAt), 500)
    }
  })

  app.get('/api/patterns', async (c) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
      const cursor = c.req.query('cursor')
      let query = 'SELECT id, insightType, rangeStart, rangeEnd, summaryText, confidence, dataJson, createdAt FROM HL_patternInsights WHERE userId = ?'
      const binds: (number | string)[] = [userId]
      if (cursor) { query += ' AND id < ?'; binds.push(cursor) }
      query += ' ORDER BY id DESC LIMIT ?'
      binds.push(limit + 1)
      const rows = await c.env.DB.prepare(query).bind(...binds).all()
      const results = (rows.results || []).slice(0, limit)
      const hasMore = (rows.results || []).length > limit
      const nextCursor = hasMore && results.length > 0 ? String(results[results.length - 1].id) : null
      return jsonResponse(c, success({ insights: results, pagination: { limit, cursor: nextCursor, hasMore } }, 200, startedAt), 200)
    } catch (e) {
      console.error('patterns list error:', e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat pola.', 500, [], startedAt), 500)
    }
  })
}

// GAP-17: single merged cron handler for all scheduled tasks
export async function scheduledHandler(event: ScheduledController, env: ExtraEnv, _ctx: ExecutionContext) {
  const cronName = event.cron || 'hourly'
  // Reminders
  const now = new Date()
  const reminders = await env.DB.prepare(
    "SELECT id, userId, reminderType, scheduleTime, timezone FROM HL_reminderSettings WHERE enabled = 1"
  ).all<{ id: string; userId: string; reminderType: string; scheduleTime: string; timezone: string }>()
  let fired = 0
  for (const r of (reminders.results || [])) {
    const nowInTz = (() => {
      try { return new Intl.DateTimeFormat('en-GB', { timeZone: r.timezone || 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(now) }
      catch { return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` }
    })()
    if (nowInTz !== r.scheduleTime) continue
    await env.DB.prepare(
      "INSERT INTO HL_notifications (userId, channel, notificationType, title, message, status, createdAt) VALUES (?, 'inApp', 'reminder', ?, ?, 'sent', CURRENT_TIMESTAMP)"
    ).bind(r.userId, `Pengingat: ${r.reminderType}`, 'Waktunya melakukan pengukuran.').run()
    fired++
  }
  // Fasting reminder (US-4.2.3)
  const activeFastings = await env.DB.prepare(
    "SELECT id, userId, fastingType, targetHours, startedAt FROM HL_fastingSessions WHERE status = 'active'"
  ).all<{ id: string; userId: string; fastingType: string; targetHours: number; startedAt: string }>()
  let fastingNotified = 0
  for (const f of (activeFastings.results || [])) {
    const elapsed = (Date.now() - new Date(f.startedAt).getTime()) / 3600000
    if (elapsed < f.targetHours) continue
    const exists = await env.DB.prepare("SELECT id FROM HL_notifications WHERE userId = ? AND notificationType = 'fastingTarget' AND createdAt > datetime('now', '-1 hour')").bind(f.userId).first<{ id: string }>()
    if (exists) continue
    await env.DB.prepare(
      "INSERT INTO HL_notifications (userId, channel, notificationType, title, message, status, createdAt) VALUES (?, 'inApp', 'fastingTarget', ?, ?, 'sent', CURRENT_TIMESTAMP)"
    ).bind(f.userId, `Target puasa tercapai`, `Anda sudah berpuasa ${f.fastingType} selama ${f.targetHours} jam.`).run()
    fastingNotified++
  }
  // GAP-17: stale draft cleanup (runs on every cron tick)
  const staleDrafts = await env.DB.prepare(
    "DELETE FROM HL_measurementDrafts WHERE status = 'expired' AND createdAt < datetime('now', '-7 days')"
  ).run()
  console.log(`cron ${cronName}: reminders=${fired} fasting=${fastingNotified} staleDraftsCleaned=${staleDrafts.meta?.changes ?? 0}`)
}
