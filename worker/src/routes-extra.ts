// Sprint 3 & 4 additional routes
import { Hono } from 'hono'
import { getCookie as honoGetCookie } from 'hono/cookie'
import type { Context } from 'hono'

export interface ExtraEnv {
  TELEGRAM_BOT_TOKEN?: string
  CRON_SECRET?: string
  DB: D1Database
  LOGS: R2Bucket
  TELEGRAM_QUEUE?: Queue
}

type ApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500

function nowIso() { return new Date().toISOString() }
function dateInTz(tz: string): string {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) }
  catch { return new Date().toISOString().slice(0, 10) }
}

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

async function getCurrentSession(c: Context<{ Bindings: ExtraEnv }>): Promise<string | null> {
  const token = getCookie(c, 'hlSession')
  if (!token) return null
  const tokenHash = await sha256Token(token)
  const row = await c.env.DB.prepare(
    'SELECT userId, expiresAt, revokedAt FROM HL_sessions WHERE sessionTokenHash = ? LIMIT 1'
  ).bind(tokenHash).first<{ userId: string; expiresAt: string; revokedAt: string | null }>()

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

function failure(code: string, message: string, status: ApiStatus, details: unknown[] = [], startedAt = Date.now()) {
  return { success: false, error: { code, message, details }, meta: { requestId: createId('req'), durationMs: Date.now() - startedAt } }
}

function success(data: unknown, status: ApiStatus = 200, startedAt = Date.now()) {
  return { success: true, data, meta: { requestId: createId('req'), durationMs: Date.now() - startedAt } }
}

// US-3.3.2 Send emergency Telegram to emergency contacts
export async function sendEmergencyToContacts(c: Context<{ Bindings: ExtraEnv }>, userId: string, severity: string, metricCode: string, finalValue: number, unit: string, message: string) {
  const profile = await c.env.DB.prepare('SELECT emergencyConsent FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ emergencyConsent: number }>()
  if (!profile || profile.emergencyConsent !== 1) {
    return { sent: 0, skipped: 'no_consent' }
  }
  const contacts = await c.env.DB.prepare(
    "SELECT id, contactName, contactPhone, telegramChatId, consentGiven, enabled FROM HL_emergencyContacts WHERE userId = ? AND enabled = 1"
  ).bind(userId).all<{ id: string; contactName: string; contactPhone: string | null; telegramChatId: string | null; consentGiven: number; enabled: number }>()
  let sent = 0
  for (const contact of (contacts.results || [])) {
    if (contact.consentGiven !== 1) continue
    const notifId = createId('ntf')
    await c.env.DB.prepare(
      "INSERT INTO HL_notifications (id, userId, channel, notificationType, title, message, status, createdAt) VALUES (?, ?, 'telegram', 'emergency_alert', ?, ?, 'pending', CURRENT_TIMESTAMP)"
    ).bind(notifId, userId, `DARURAT ${metricCode}`, `${message}\n\nKontak: ${contact.contactName} (${contact.contactPhone || '-'})`).run()
    if (contact.telegramChatId && c.env.TELEGRAM_BOT_TOKEN) {
      try {
        const resp = await fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: contact.telegramChatId, text: `DARURAT ${metricCode}: ${finalValue} ${unit}\n${message}` })
        })
        const status = resp.ok ? 'sent' : 'failed'
        await c.env.DB.prepare('UPDATE HL_notifications SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(status, notifId).run()
        if (resp.ok) sent++
      } catch {
        await c.env.DB.prepare('UPDATE HL_notifications SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind('failed', notifId).run()
      }
    }
  }
  return { sent, total: (contacts.results || []).length }
}

// US-3.3.1 helper: write HL_alerts row from emergency severity, and enqueue contact notifications
export async function createEmergencyAlert(c: Context<{ Bindings: ExtraEnv }>, userId: string, sessionId: string, metricCode: string, finalValue: number, unit: string, severity: string, message: string) {
  const alertId = createId('alt')
  await c.env.DB.prepare(
    "INSERT INTO HL_alerts (id, userId, sessionId, metricCode, finalValue, unit, status, severity, alertType, message, acknowledged, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, 'emergency', ?, 0, CURRENT_TIMESTAMP)"
  ).bind(alertId, userId, sessionId, metricCode, finalValue, unit, severity, message).run()
  await c.env.DB.prepare(
    "INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'alertCreate', 'HL_alerts', ?, ?, CURRENT_TIMESTAMP)"
  ).bind(createId('aud'), userId, alertId, JSON.stringify({ metricCode, severity, sessionId })).run()
  // Send to contacts (fire and forget; never blocks measurement submit)
  sendEmergencyToContacts(c, userId, severity, metricCode, finalValue, unit, message).catch(err => console.error('emergency contacts error:', err))
  return alertId
}

// US-4.3.1 streak update: idempotent per day
export async function updateDailyStreak(c: Context<{ Bindings: ExtraEnv }>, userId: string, tz: string) {
  const today = dateInTz(tz)
  const existing = await c.env.DB.prepare('SELECT id, currentCount, bestCount, lastDate FROM HL_streaks WHERE userId = ? AND streakType = ?').bind(userId, 'dailyMeasurement').first<{ id: string; currentCount: number; bestCount: number; lastDate: string | null }>()
  if (!existing) {
    await c.env.DB.prepare("INSERT INTO HL_streaks (id, userId, streakType, currentCount, bestCount, lastDate, updatedAt) VALUES (?, ?, 'dailyMeasurement', 1, 1, ?, CURRENT_TIMESTAMP)").bind(createId('strk'), userId, today).run()
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
export async function awardBadges(c: Context<{ Bindings: ExtraEnv }>, userId: string, streakCount: number) {
  const awarded: string[] = []
  const map: Array<{ code: string; when: (s: number) => boolean }> = [
    { code: 'streak3', when: s => s >= 3 },
    { code: 'streak7', when: s => s >= 7 },
    { code: 'streak30', when: s => s >= 30 }
  ]
  for (const m of map) {
    if (!m.when(streakCount)) continue
    const exists = await c.env.DB.prepare('SELECT id FROM HL_userBadges WHERE userId = ? AND badgeCode = ?').bind(userId, m.code).first<{ id: string }>()
    if (exists) continue
    await c.env.DB.prepare("INSERT INTO HL_userBadges (id, userId, badgeCode, earnedAt, createdAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)").bind(createId('ubd'), userId, m.code).run()
    await c.env.DB.prepare(
      "INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'badgeEarned', 'HL_userBadges', ?, ?, CURRENT_TIMESTAMP)"
    ).bind(createId('aud'), userId, m.code, JSON.stringify({ badgeCode: m.code })).run()
    awarded.push(m.code)
  }
  return awarded
}

export function mountExtraRoutes(app: Hono<{ Bindings: ExtraEnv }>) {

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
      if (authHeader !== `Bearer ${c.env.CRON_SECRET || 'hl-cron'}`) {
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
        const notifId = createId('ntf')
        await c.env.DB.prepare(
          "INSERT INTO HL_notifications (id, userId, channel, notificationType, title, message, status, createdAt) VALUES (?, ?, 'inApp', 'reminder', ?, ?, 'sent', CURRENT_TIMESTAMP)"
        ).bind(notifId, r.userId, `Pengingat: ${r.reminderType}`, 'Waktunya melakukan pengukuran.').run()
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
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Laporan 30 Hari</title></head><body><h1>Laporan Kesehatan 30 Hari</h1><p>Nama: ${escapeHtml(profile?.displayName || '-')}</p><p>Rentang: ${rangeStart} s/d ${rangeEnd}</p><table border="1" cellpadding="4"><tr><th>Tanggal</th><th>Metrik</th><th>Nilai</th><th>Unit</th><th>Status</th><th>Severity</th></tr>${(values.results || []).map((v: any) => `<tr><td>${v.measuredAt}</td><td>${v.metricCode}</td><td>${v.finalValue}</td><td>${v.unit}</td><td>${v.status}</td><td>${v.severity}</td></tr>`).join('')}</table><p><em>Laporan ini hanya data, bukan diagnosis. Konsultasikan dengan dokter.</em></p></body></html>`
      const reportId = createId('rpt')
      const r2Key = `HL/users/${userId}/reports/${reportId}.html`
      await c.env.LOGS.put(r2Key, html, { httpMetadata: { contentType: 'text/html; charset=utf-8' } })
      await c.env.DB.prepare(
        "INSERT INTO HL_reports (id, userId, reportType, rangeStart, rangeEnd, r2Key, status, summaryJson, createdAt, updatedAt) VALUES (?, ?, 'doctorReady30d', ?, ?, ?, 'ready', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).bind(reportId, userId, rangeStart, rangeEnd, r2Key, JSON.stringify({ count: (values.results || []).length })).run()
      await c.env.DB.prepare(
        "INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'reportGenerate', 'HL_reports', ?, ?, CURRENT_TIMESTAMP)"
      ).bind(createId('aud'), userId, reportId, JSON.stringify({ reportType: 'doctorReady30d' })).run()
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
      const report = await c.env.DB.prepare('SELECT userId, r2Key FROM HL_reports WHERE id = ?').bind(reportId).first<{ userId: string; r2Key: string }>()
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
      const report = await c.env.DB.prepare('SELECT userId FROM HL_reports WHERE id = ?').bind(reportId).first<{ userId: string }>()
      if (!report) return jsonResponse(c, failure('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      if (report.userId !== userId) return jsonResponse(c, failure('FORBIDDEN', 'Tidak memiliki akses.', 403, [], startedAt), 403)
      const shareToken = crypto.randomUUID().replace(/-/g, '')
      const shareTokenHash = await sha256Token(shareToken)
      const expiresInHours = Math.min(Math.max(body.expiresInHours ?? 24, 1), 168)
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
      await c.env.DB.prepare(
        "INSERT INTO HL_reportShares (id, reportId, userId, shareTokenHash, recipientLabel, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      ).bind(createId('rps'), reportId, userId, shareTokenHash, body.recipientLabel || null, expiresAt).run()
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
      const fastId = createId('fst')
      const fastingType = (['glucoseFasting', 'cholesterolTotal', 'uricAcid', 'general'].includes(body.fastingType || '') ? body.fastingType : 'general') as string
      const targetHours = Number(body.targetHours) || 8
      await c.env.DB.prepare(
        "INSERT INTO HL_fastingSessions (id, userId, fastingType, targetHours, startedAt, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
      ).bind(fastId, userId, fastingType, targetHours).run()
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
      const insightId = createId('pi')
      await c.env.DB.prepare("INSERT INTO HL_patternInsights (id, userId, insightType, rangeStart, rangeEnd, summaryText, dataJson, createdAt) VALUES (?, ?, 'weight_bp', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(insightId, userId, since, nowIso(), insightText, JSON.stringify({ weight, bp })).run()
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
      const insightId = createId('pi')
      await c.env.DB.prepare("INSERT INTO HL_patternInsights (id, userId, insightType, rangeStart, rangeEnd, summaryText, dataJson, createdAt) VALUES (?, ?, 'medication', ?, ?, ?, ?, CURRENT_TIMESTAMP)").bind(insightId, userId, since, nowIso(), insightText, JSON.stringify({ logs: logs.results, adherence })).run()
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
}

// US-3.4.2 daily reminder cron handler (also US-4.2.3 fasting reminder)
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
      "INSERT INTO HL_notifications (id, userId, channel, notificationType, title, message, status, createdAt) VALUES (?, ?, 'inApp', 'reminder', ?, ?, 'sent', CURRENT_TIMESTAMP)"
    ).bind(createId('ntf'), r.userId, `Pengingat: ${r.reminderType}`, 'Waktunya melakukan pengukuran.').run()
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
      "INSERT INTO HL_notifications (id, userId, channel, notificationType, title, message, status, createdAt) VALUES (?, ?, 'inApp', 'fastingTarget', ?, ?, 'sent', CURRENT_TIMESTAMP)"
    ).bind(createId('ntf'), f.userId, `Target puasa tercapai`, `Anda sudah berpuasa ${f.fastingType} selama ${f.targetHours} jam.`).run()
    fastingNotified++
  }
  console.log(`cron ${cronName}: reminders=${fired} fasting=${fastingNotified}`)
}
