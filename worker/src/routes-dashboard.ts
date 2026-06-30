import type { Context } from 'hono'
import {
  getCurrentSession,
  jsonResponse,
  success,
  failure
} from './utils/index-helpers.js'

interface LocalEnv { DB: D1Database; TELEGRAM_WATER_WEBHOOK_SECRET?: string; INTERNAL_API_SECRET?: string; LOGS: R2Bucket }
type HC = Context<{ Bindings: LocalEnv }>

export function mountDashboardRoutes(app: any) {

  app.get('/api/dashboard/today', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) {
        return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
      }

      const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(userId).first<{ timezone: string }>()
      const timezone = profileInfo?.timezone || 'UTC'
      const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      const today = formatter.format(new Date())

      // Fetch sessions from a 48h window so user-timezone "today" never misses a measurement
      // even when UTC date differs from the user-timezone date. measuredAt is stored as UTC ISO,
      // so SQL `substr(measuredAt, 1, 10) = user_tz_today` would skip late-UTC / early-local rows.
      const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const allSessions = await c.env.DB.prepare(
        `SELECT id, profileId, measuredAt, source, hasAi, hasAttachment, hasEmergency
         FROM HL_measurementSessions
         WHERE userId = ? AND measuredAt >= ?
         ORDER BY measuredAt DESC`
      ).bind(userId, windowStart).all<{
        id: string
        profileId: string
        measuredAt: string
        source: string
        hasAi: number
        hasAttachment: number
        hasEmergency: number
      }>()

      const sessions = {
        results: (allSessions.results || []).filter(s => formatter.format(new Date(s.measuredAt)) === today)
      }

      const sessionIds = sessions.results.map(s => s.id)
      let values: any[] = []
      if (sessionIds.length > 0) {
        const placeholders = sessionIds.map(() => '?').join(',')
        const valueResult = await c.env.DB.prepare(
          `SELECT id, sessionId, metricCode, finalValue, unit, status, severity, manualOverride, createdAt
           FROM HL_measurementValues
           WHERE userId = ? AND sessionId IN (${placeholders})
           ORDER BY createdAt DESC`
        ).bind(userId, ...sessionIds).all()
        values = valueResult.results || []
      }

      // Same JS-side filter for alerts because `createdAt` is also stored as UTC ISO.
      const allAlerts = await c.env.DB.prepare(
        `SELECT id, metricCode, finalValue, unit, severity, message, createdAt
         FROM HL_alerts
         WHERE userId = ? AND createdAt >= ?
         ORDER BY createdAt DESC`
      ).bind(userId, windowStart).all<{
        id: string
        metricCode: string
        finalValue: number
        unit: string
        severity: string
        message: string
        createdAt: string
      }>()
      const alerts = {
        results: (allAlerts.results || []).filter(a => formatter.format(new Date(a.createdAt)) === today)
      }

      const metricCount = new Set(values.map(v => v.metricCode)).size
      const emergencyCount = sessions.results.filter(s => s.hasEmergency === 1).length

      const streakRow = await c.env.DB.prepare(
        `SELECT currentCount, bestCount FROM HL_streaks WHERE userId = ? AND streakType = 'dailyMeasurement' LIMIT 1`
      ).bind(userId).first<{ currentCount: number; bestCount: number }>()
      const streak = streakRow?.currentCount ?? 0
      const bestStreak = streakRow?.bestCount ?? 0

      const aiInsightRow = await c.env.DB.prepare(
        `SELECT summaryText FROM HL_aiRecommendations WHERE userId = ? ORDER BY createdAt DESC LIMIT 1`
      ).bind(userId).first<{ summaryText: string }>()

      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      const threeDaysStr = formatter.format(threeDaysAgo)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysStr = formatter.format(sevenDaysAgo)

      const comparisons: Record<string, { avg3day: number | null; avg7day: number | null }> = {}
      for (const v of values) {
        const code = v.metricCode
        if (comparisons[code]) continue
        const avg3 = await c.env.DB.prepare(
          `SELECT AVG(finalValue) as avgVal FROM HL_measurementValues WHERE userId = ? AND metricCode = ? AND substr(createdAt,1,10) >= ? AND substr(createdAt,1,10) < ?`
        ).bind(userId, code, threeDaysStr, today).first<{ avgVal: number | null }>()
        const avg7 = await c.env.DB.prepare(
          `SELECT AVG(finalValue) as avgVal FROM HL_measurementValues WHERE userId = ? AND metricCode = ? AND substr(createdAt,1,10) >= ? AND substr(createdAt,1,10) < ?`
        ).bind(userId, code, sevenDaysStr, today).first<{ avgVal: number | null }>()
        comparisons[code] = { avg3day: avg3?.avgVal ?? null, avg7day: avg7?.avgVal ?? null }
      }

      return jsonResponse(c, success({
        date: today,
        metricCount,
        sessionCount: sessions.results.length,
        emergencyCount,
        hasData: sessions.results.length > 0,
        streak,
        bestStreak,
        aiInsight: aiInsightRow?.summaryText ?? null,
        sessions: sessions.results || [],
        values: values.map((v: any) => ({
          ...v,
          comparisons: comparisons[v.metricCode] ?? { avg3day: null, avg7day: null }
        })),
        alerts: alerts.results || []
      }, 200, startedAt))
    } catch (error) {
      console.error('dashboard today error:', error)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Dashboard gagal dimuat.', 500, [], startedAt))
    }
  })

  app.get('/api/dashboard/weekly', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))

      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const rows = await c.env.DB.prepare(
        `SELECT metricCode, AVG(finalValue) as avgValue, MIN(finalValue) as minValue, MAX(finalValue) as maxValue, COUNT(*) as cnt
         FROM HL_measurementValues
         WHERE userId = ? AND measuredAt >= ?
         GROUP BY metricCode`
      ).bind(userId, since).all<{ metricCode: string; avgValue: number; minValue: number; maxValue: number; cnt: number }>()

      const dailyRows = await c.env.DB.prepare(
        `SELECT substr(measuredAt, 1, 10) as day, metricCode, AVG(finalValue) as avgValue
         FROM HL_measurementValues
         WHERE userId = ? AND measuredAt >= ?
         GROUP BY day, metricCode
         ORDER BY day ASC`
      ).bind(userId, since).all<{ day: string; metricCode: string; avgValue: number }>()

      const dayRows = await c.env.DB.prepare(
        `SELECT substr(measuredAt, 1, 10) as day, COUNT(DISTINCT sessionId) as sessionCount
         FROM HL_measurementValues
         WHERE userId = ? AND measuredAt >= ?
         GROUP BY day
         ORDER BY day ASC`
      ).bind(userId, since).all<{ day: string; sessionCount: number }>()

      const days = dayRows.results || []
      const bestDay = days.length > 0
        ? days.reduce((best, day) => day.sessionCount > best.sessionCount ? day : best, days[0])
        : null
      const worstDay = days.length > 0
        ? days.reduce((worst, day) => day.sessionCount < worst.sessionCount ? day : worst, days[0])
        : null

      const alertRow = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM HL_alerts WHERE userId = ? AND createdAt >= ?`
      ).bind(userId, since).first<{ cnt: number }>()

      const adherenceRow = await c.env.DB.prepare(
        `SELECT
           SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as takenCount,
           COUNT(*) as totalCount
         FROM HL_medicationLogs
         WHERE userId = ? AND takenAt >= ?`
      ).bind(userId, since).first<{ takenCount: number | null; totalCount: number }>()

      const adherence = adherenceRow && adherenceRow.totalCount > 0
        ? Math.round(((adherenceRow.takenCount || 0) / adherenceRow.totalCount) * 100)
        : null

      return jsonResponse(c, success({
        period: '7d',
        metrics: rows.results || [],
        daily: dailyRows.results || [],
        measurementDays: days.length,
        bestDay,
        worstDay,
        alertCount: alertRow?.cnt || 0,
        adherence
      }, 200, startedAt))
    } catch (error) {
      console.error('weekly dashboard error:', error)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat data mingguan.', 500, [], startedAt))
    }
  })

  app.get('/api/dashboard/monthly', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const rows = await c.env.DB.prepare(
        `SELECT metricCode, AVG(finalValue) as avgValue, MIN(finalValue) as minValue, MAX(finalValue) as maxValue, COUNT(*) as cnt
         FROM HL_measurementValues
         WHERE userId = ? AND measuredAt >= ?
         GROUP BY metricCode`
      ).bind(userId, since).all<{ metricCode: string; avgValue: number; minValue: number; maxValue: number; cnt: number }>()

      const dailyRows = await c.env.DB.prepare(
        `SELECT substr(measuredAt, 1, 10) as day, COUNT(DISTINCT sessionId) as sessionCount
         FROM HL_measurementValues
         WHERE userId = ? AND measuredAt >= ?
         GROUP BY day
         ORDER BY day ASC`
      ).bind(userId, since).all<{ day: string; sessionCount: number }>()

      const alertRow = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM HL_alerts WHERE userId = ? AND createdAt >= ?`
      ).bind(userId, since).first<{ cnt: number }>()

      const latestRows = await c.env.DB.prepare(
        `SELECT metricCode, finalValue, unit, status, severity, measuredAt
         FROM HL_measurementValues
         WHERE userId = ? AND measuredAt >= ?
         ORDER BY measuredAt DESC
         LIMIT 8`
      ).bind(userId, since).all<{ metricCode: string; finalValue: number; unit: string; status: string; severity: string; measuredAt: string }>()

      return jsonResponse(c, success({
        period: '30d',
        metrics: rows.results || [],
        measurementDays: (dailyRows.results || []).length,
        alertCount: alertRow?.cnt || 0,
        daily: dailyRows.results || [],
        latest: latestRows.results || []
      }, 200, startedAt))
    } catch (error) {
      console.error('monthly dashboard error:', error)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat data bulanan.', 500, [], startedAt))
    }
  })

  app.get('/api/dashboard/comparison', async (c: HC) => {
    const startedAt = Date.now()
    try {
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
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
      }, 200, startedAt))
    } catch (e) {
      console.error('dashboard comparison error:', e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat perbandingan.', 500, [], startedAt))
    }
  })

}
