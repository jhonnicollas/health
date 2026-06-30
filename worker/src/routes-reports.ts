import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import {
  insertAndGetId,
  sha256Token,
  callConfiguredTextAi,
  filterUnsafeContent
} from './utils/index-helpers.js'
import { formatIdShortDateTime } from './routes-extra.js'

interface LocalEnv { DB: D1Database; LOGS: R2Bucket }
type HC = Context<{ Bindings: LocalEnv }>
type ApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500

function jr(c: HC, body: any, status: number) { c.header('Cache-Control', 'no-store'); return c.json(body.body ?? body, status as any) }
function ok(data: unknown, status = 200, s = Date.now()) { return { body: { success: true, data, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }
function fail(code: string, msg: string, status: number, errs: unknown[] = [], s = Date.now()) { return { body: { success: false, error: { code, message: msg, details: errs }, meta: { requestId: `req_${s}`, durationMs: Date.now() - s } }, status } }

async function getSession(c: HC): Promise<number | null> {
  const token = getCookie(c, 'hlSession'); if (!token) return null
  const h = await sha256Token(token)
  const row = await c.env.DB.prepare('SELECT s.userId FROM HL_sessions s JOIN HL_users u ON u.id = s.userId WHERE s.sessionTokenHash = ? AND s.revokedAt IS NULL AND s.expiresAt > datetime("now") AND u.active = 1').bind(h).first<any>()
  return row?.userId || null
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function mountReportsRoutes(app: any) {

  app.get('/api/reports/daily', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(userId).first<{ timezone: string }>()
      const timezone = profileInfo?.timezone || 'UTC'
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      const dateParamRaw = c.req.query('date') || ''
      const dateParam = /^\d{4}-\d{2}-\d{2}$/.test(dateParamRaw) ? dateParamRaw : ''
      const today = dateParam || formatter.format(new Date())

      // Fetch from 48h window then filter in JS by user-timezone date (measuredAt stored in UTC)
      const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const allValues = await c.env.DB.prepare(
        `SELECT v.sessionId, v.metricCode, v.finalValue, v.unit, v.status, v.severity, v.manualOverride, v.measuredAt, v.deviceCode,
                r.popupTitle, r.popupMessage, r.recommendation, r.sourceLabel
         FROM HL_measurementValues v
         LEFT JOIN HL_metricRules r ON r.id = v.ruleId
         WHERE v.userId = ? AND v.measuredAt >= ?
         ORDER BY v.measuredAt ASC`
      ).bind(userId, windowStart).all()
      const allSessions = await c.env.DB.prepare(
        `SELECT id, source, hasEmergency, hasAttachment, notes, measuredAt
         FROM HL_measurementSessions WHERE userId = ? AND measuredAt >= ?`
      ).bind(userId, windowStart).all<{ id: number; source: string; hasEmergency: number; hasAttachment: number; notes: string | null; measuredAt: string }>()

      const todaysValues = (allValues.results || []).filter((v: any) => formatter.format(new Date(v.measuredAt as string)) === today)
      const todaysSessions = (allSessions.results || []).filter((s: any) => formatter.format(new Date(s.measuredAt as string)) === today)

      return jr(c, ok({
        period: 'daily',
        date: today,
        sessionCount: todaysSessions.length,
        hasData: todaysValues.length > 0,
        values: todaysValues,
        sessions: todaysSessions,
        emptyMessage: todaysSessions.length === 0
          ? 'Belum ada pengukuran hari ini. Yuk mulai catat pengukuran.'
          : (todaysValues.length === 0 ? 'Sesi tercatat tetapi belum ada nilai yang tersimpan.' : null)
      }, 200, startedAt), 200)
    } catch (error) {
      console.error('daily report error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat laporan harian.', 500, [], startedAt), 500)
    }
  })

  app.get('/api/reports/weekly', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(userId).first<{ timezone: string }>()
      const timezone = profileInfo?.timezone || 'UTC'
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const metrics = await c.env.DB.prepare(
        `SELECT metricCode, AVG(finalValue) as avg, MIN(finalValue) as min, MAX(finalValue) as max, COUNT(*) as cnt
         FROM HL_measurementValues WHERE userId = ? AND measuredAt >= ? GROUP BY metricCode`
      ).bind(userId, since).all()
      const sessions = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM HL_measurementSessions WHERE userId = ? AND measuredAt >= ?`
      ).bind(userId, since).first<{ cnt: number }>()
      const allSessions = await c.env.DB.prepare(
        `SELECT measuredAt, id FROM HL_measurementSessions WHERE userId = ? AND measuredAt >= ?`
      ).bind(userId, since).all<{ measuredAt: string; id: number }>()
      const sessionsByDay = new Map<string, number>()
      for (const s of allSessions.results || []) {
        const day = formatter.format(new Date(s.measuredAt))
        sessionsByDay.set(day, (sessionsByDay.get(day) || 0) + 1)
      }
      const sessionsList = Array.from(sessionsByDay.entries()).map(([day, cnt]) => ({ day, cnt }))
      const allDailyValues = await c.env.DB.prepare(
        `SELECT v.measuredAt, v.metricCode, v.finalValue
         FROM HL_measurementValues v WHERE v.userId = ? AND v.measuredAt >= ?`
      ).bind(userId, since).all<{ measuredAt: string; metricCode: string; finalValue: number }>()
      const dailyAgg = new Map<string, Map<string, { sum: number; min: number; max: number; cnt: number }>>()
      for (const v of allDailyValues.results || []) {
        const day = formatter.format(new Date(v.measuredAt))
        if (!dailyAgg.has(day)) dailyAgg.set(day, new Map())
        const m = dailyAgg.get(day)!
        if (!m.has(v.metricCode)) m.set(v.metricCode, { sum: 0, min: v.finalValue, max: v.finalValue, cnt: 0 })
        const e = m.get(v.metricCode)!
        e.sum += v.finalValue; e.cnt++; if (v.finalValue < e.min) e.min = v.finalValue; if (v.finalValue > e.max) e.max = v.finalValue
      }
      const dailyMetrics: { day: string; metricCode: string; avg: number; min: number; max: number; cnt: number }[] = []
      for (const [day, metricsMap] of dailyAgg) {
        for (const [metricCode, e] of metricsMap) {
          dailyMetrics.push({ day, metricCode, avg: Math.round((e.sum / e.cnt) * 10) / 10, min: e.min, max: e.max, cnt: e.cnt })
        }
      }
      dailyMetrics.sort((a, b) => a.day.localeCompare(b.day))
      const bestDay = sessionsList.reduce<{ day: string; cnt: number } | null>((a, b) => (b.cnt > (a?.cnt || 0) ? b : a), null)
      const worstDay = sessionsList.reduce<{ day: string; cnt: number } | null>((a, b) => (b.cnt < (a?.cnt || 99) ? b : a), null)
      const alertCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM HL_alerts WHERE userId = ? AND createdAt >= ?`
      ).bind(userId, since).first<{ cnt: number }>()
      const adherence = Math.min(100, Math.round((sessionsList.length / 7) * 100))
      return jr(c, ok({
        period: 'weekly',
        metrics: metrics.results || [],
        dailyMetrics,
        adherence,
        alertCount: alertCount?.cnt || 0,
        bestDay: bestDay?.day || null,
        worstDay: worstDay?.day || null,
        daysWithData: sessionsList.length
      }, 200, startedAt), 200)
    } catch (error) {
      console.error('weekly report error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat laporan mingguan.', 500, [], startedAt), 500)
    }
  })

  app.get('/api/reports/monthly', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(userId).first<{ timezone: string }>()
      const timezone = profileInfo?.timezone || 'UTC'
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      const daysParam = Math.min(Math.max(Number(c.req.query('days') || '30'), 7), 90)
      const since = new Date(Date.now() - daysParam * 24 * 60 * 60 * 1000).toISOString()
      const values = await c.env.DB.prepare(
        `SELECT metricCode, AVG(finalValue) as avg, MIN(finalValue) as min, MAX(finalValue) as max,
                (SELECT finalValue FROM HL_measurementValues v2 WHERE v2.userId = ? AND v2.metricCode = HL_measurementValues.metricCode ORDER BY measuredAt DESC LIMIT 1) as latest,
                COUNT(*) as cnt
         FROM HL_measurementValues WHERE userId = ? AND measuredAt >= ? GROUP BY metricCode`
      ).bind(userId, userId, since).all()
      const sessionCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM HL_measurementSessions WHERE userId = ? AND measuredAt >= ?`
      ).bind(userId, since).first<{ cnt: number }>()
      const alertCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM HL_alerts WHERE userId = ? AND createdAt >= ?`
      ).bind(userId, since).first<{ cnt: number }>()
      const allDailyValues = await c.env.DB.prepare(
        `SELECT v.measuredAt, v.metricCode, v.finalValue
         FROM HL_measurementValues v WHERE v.userId = ? AND v.measuredAt >= ?`
      ).bind(userId, since).all<{ measuredAt: string; metricCode: string; finalValue: number }>()
      const dailyAgg = new Map<string, Map<string, { sum: number; min: number; max: number; cnt: number }>>()
      for (const v of allDailyValues.results || []) {
        const day = formatter.format(new Date(v.measuredAt))
        if (!dailyAgg.has(day)) dailyAgg.set(day, new Map())
        const m = dailyAgg.get(day)!
        if (!m.has(v.metricCode)) m.set(v.metricCode, { sum: 0, min: v.finalValue, max: v.finalValue, cnt: 0 })
        const e = m.get(v.metricCode)!
        e.sum += v.finalValue; e.cnt++; if (v.finalValue < e.min) e.min = v.finalValue; if (v.finalValue > e.max) e.max = v.finalValue
      }
      const dailyMetrics: { day: string; metricCode: string; avg: number; min: number; max: number; cnt: number }[] = []
      for (const [day, metricsMap] of dailyAgg) {
        for (const [metricCode, e] of metricsMap) {
          dailyMetrics.push({ day, metricCode, avg: Math.round((e.sum / e.cnt) * 10) / 10, min: e.min, max: e.max, cnt: e.cnt })
        }
      }
      dailyMetrics.sort((a, b) => a.day.localeCompare(b.day))
      const daysWithData = dailyAgg.size
      return jr(c, ok({
        period: 'monthly',
        days: daysParam,
        metrics: values.results || [],
        dailyMetrics,
        sessionCount: sessionCount?.cnt || 0,
        alertCount: alertCount?.cnt || 0,
        daysWithData,
        aiMonthlySummary: null
      }, 200, startedAt), 200)
    } catch (error) {
      console.error('monthly report error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat laporan bulanan.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.1 generate doctor-ready PDF (HTML) — saved to R2 + HL_reports
  app.post('/api/reports/doctor-ready', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
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
      return jr(c, ok({ reportId, status: 'ready' }, 201, startedAt), 201)
    } catch (error) {
      console.error('doctor-ready report error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal generate PDF.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.3 download (HTML, since Workers free tier cannot run Puppeteer)
  app.get('/api/reports/:id/download', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const reportId = c.req.param('id')
      const report = await c.env.DB.prepare('SELECT userId, r2Key FROM HL_reports WHERE id = ?').bind(reportId).first<{ userId: number; r2Key: string }>()
      if (!report) return jr(c, fail('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      if (report.userId !== userId) {
        const link = await c.env.DB.prepare("SELECT id FROM HL_familyLinks WHERE ownerUserId = ? AND linkedUserId = ? AND status = 'active' AND canViewDashboard = 1").bind(report.userId, userId).first()
        if (!link) return jr(c, fail('FORBIDDEN', 'Tidak ada akses.', 403, [], startedAt), 403)
      }
      const obj = await c.env.LOGS.get(report.r2Key)
      if (!obj) return jr(c, fail('NOT_FOUND', 'File tidak ditemukan.', 404, [], startedAt), 404)
      return new Response(obj.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('download report error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal download.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.4 share link
  app.post('/api/reports/:id/share', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const reportId = c.req.param('id')
      const body = await c.req.json() as { recipientLabel?: string; expiresInHours?: number }
      const report = await c.env.DB.prepare('SELECT userId FROM HL_reports WHERE id = ?').bind(reportId).first<{ userId: number }>()
      if (!report) return jr(c, fail('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      if (report.userId !== userId) return jr(c, fail('FORBIDDEN', 'Tidak memiliki akses.', 403, [], startedAt), 403)
      const shareToken = crypto.randomUUID().replace(/-/g, '')
      const shareTokenHash = await sha256Token(shareToken)
      const expiresInHours = Math.min(Math.max(body.expiresInHours ?? 24, 1), 168)
      const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000).toISOString()
      await insertAndGetId(c.env.DB.prepare(
        "INSERT INTO HL_reportShares (reportId, userId, shareTokenHash, recipientLabel, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
      ).bind(reportId, userId, shareTokenHash, body.recipientLabel || null, expiresAt))
      return jr(c, ok({ shareToken, expiresAt, shareUrl: `/api/reports/share/${shareToken}` }, 201, startedAt), 201)
    } catch (error) {
      console.error('share report error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal share.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.5 get report measurement data for CSV export
  app.get('/api/reports/:id/data', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getSession(c)
      if (!userId) return jr(c, fail('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt), 401)
      const reportId = c.req.param('id')
      const report = await c.env.DB.prepare('SELECT userId, rangeStart, rangeEnd FROM HL_reports WHERE id = ?').bind(reportId).first<{ userId: number; rangeStart: string; rangeEnd: string }>()
      if (!report) return jr(c, fail('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      if (report.userId !== userId) {
        const link = await c.env.DB.prepare("SELECT id FROM HL_familyLinks WHERE ownerUserId = ? AND linkedUserId = ? AND status = 'active' AND canViewDashboard = 1").bind(report.userId, userId).first()
        if (!link) return jr(c, fail('FORBIDDEN', 'Tidak ada akses.', 403, [], startedAt), 403)
      }
      const values = await c.env.DB.prepare(
        `SELECT metricCode, finalValue, unit, status, severity, measuredAt
         FROM HL_measurementValues
         WHERE userId = ? AND measuredAt BETWEEN ? AND ?
         ORDER BY measuredAt DESC, metricCode ASC`
      ).bind(report.userId, report.rangeStart, report.rangeEnd).all<{
        metricCode: string; finalValue: number; unit: string; status: string; severity: string; measuredAt: string
      }>()
      const profile = await c.env.DB.prepare('SELECT displayName FROM HL_users WHERE id = ?').bind(report.userId).first<{ displayName: string }>()
      return jr(c, ok({
        reportId,
        patientName: profile?.displayName || '-',
        rangeStart: report.rangeStart,
        rangeEnd: report.rangeEnd,
        count: (values.results || []).length,
        values: values.results || []
      }, 200, startedAt), 200)
    } catch (error) {
      console.error('report data error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal memuat data laporan.', 500, [], startedAt), 500)
    }
  })

  // US-4.1.4 public share view
  app.get('/api/reports/share/:shareToken', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const token = c.req.param('shareToken') || ''
      const tokenHash = await sha256Token(token)
      const share = await c.env.DB.prepare('SELECT reportId, expiresAt, revokedAt FROM HL_reportShares WHERE shareTokenHash = ?').bind(tokenHash).first<{ reportId: string; expiresAt: string; revokedAt: string | null }>()
      if (!share) return jr(c, fail('NOT_FOUND', 'Link share tidak ditemukan.', 404, [], startedAt), 404)
      if (share.revokedAt) return jr(c, fail('VALIDATION_ERROR', 'Link share sudah dicabut.', 400, [], startedAt), 400)
      if (new Date(share.expiresAt) < new Date()) return jr(c, fail('VALIDATION_ERROR', 'Link share kadaluarsa.', 400, [], startedAt), 400)
      const report = await c.env.DB.prepare('SELECT r2Key FROM HL_reports WHERE id = ?').bind(share.reportId).first<{ r2Key: string }>()
      if (!report) return jr(c, fail('NOT_FOUND', 'Report tidak ditemukan.', 404, [], startedAt), 404)
      const obj = await c.env.LOGS.get(report.r2Key)
      if (!obj) return jr(c, fail('NOT_FOUND', 'File tidak ditemukan.', 404, [], startedAt), 404)
      return new Response(obj.body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
    } catch (error) {
      console.error('share token report error:', error)
      return jr(c, fail('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt), 500)
    }
  })
}
