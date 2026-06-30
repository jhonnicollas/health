// Measurement routes extracted from index.ts
import type { Context } from 'hono'
import { getCookie } from 'hono/cookie'
import {
  getCurrentSession,
  jsonResponse,
  success,
  failure,
  insertAndGetId,
  encryptSensitive,
  getSystemConfigNumber,
  getSystemConfigString,
  sha256Token,
  calculateAgeYears,
  evaluateRule,
  PHYSICAL_RANGES,
  ValidateInput,
  SubmitInput,
  validateExtractInput,
  enqueueTelegramSummary,
  sendTelegramNotification,
  logNotification
} from './utils/index-helpers.js'
import { createEmergencyAlert, updateDailyStreak, awardBadges } from './routes-extra.js'

interface LocalEnv {
  DB: D1Database
  LOGS: R2Bucket
  TELEGRAM_WATER_WEBHOOK_SECRET?: string
  INTERNAL_API_SECRET?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
}

type HC = Context<{ Bindings: LocalEnv }>

export function mountMeasurementRoutes(app: any) {

// Validate Measurements Endpoint


app.post('/api/measurements/validate', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const sessionToken = getCookie(c, 'hlSession')
    if (!sessionToken) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    }
    const sessionTokenHash = await sha256Token(sessionToken)
    const sessionQuery = await c.env.DB.prepare(
      'SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND expiresAt > datetime("now") AND revokedAt IS NULL'
    ).bind(sessionTokenHash).first()
    if (!sessionQuery) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid atau kadaluarsa.', 401, [], startedAt))
    }
    const userId = (sessionQuery as { userId: number }).userId

    const body = await c.req.json() as ValidateInput
    if (!body.metrics || !Array.isArray(body.metrics)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'metrics harus array.', 400, [], startedAt))
    }

    const errors: Array<{ field: string; message: string; code: string }> = []
    let systolicValue: number | null = null
    let diastolicValue: number | null = null
    const valuesWithRules: Array<Record<string, unknown>> = []

    const profile = await c.env.DB.prepare('SELECT sex, birthDate FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ sex: string; birthDate: string }>()
    const sex = profile?.sex || 'all'
    const ageYears = profile?.birthDate ? calculateAgeYears(profile.birthDate) : 30

    for (const raw of body.metrics as Array<Record<string, unknown>>) {
      const metricCode = String(raw.metricCode || '')
      const finalValue = Number(raw.finalValue)
      if (!metricCode) {
        errors.push({ field: 'metricCode', message: 'metricCode wajib.', code: 'REQUIRED' })
        continue
      }
      if (!Number.isFinite(finalValue)) {
        errors.push({ field: metricCode, message: `${metricCode} harus angka valid.`, code: 'INVALID_FORMAT' })
        continue
      }
      const range = PHYSICAL_RANGES[metricCode]
      if (range && (finalValue < range.min || finalValue > range.max)) {
        errors.push({
          field: metricCode,
          message: `${metricCode} harus antara ${range.min} - ${range.max} ${range.unit}.`,
          code: 'OUT_OF_RANGE'
        })
      }
      if (metricCode === 'systolic') systolicValue = finalValue
      if (metricCode === 'diastolic') diastolicValue = finalValue

      if (finalValue >= 0 || range) {
        const rule = await evaluateRule(c, metricCode, finalValue, sex, ageYears)
        valuesWithRules.push({
          metricCode,
          finalValue,
          unit: raw.unit || (range?.unit || ''),
          status: rule.status,
          severity: rule.severity,
          emergencyLevel: rule.emergencyLevel,
          popupTitle: rule.popupTitle,
          popupMessage: rule.popupMessage,
          recommendation: rule.recommendation,
          sourceLabel: rule.sourceLabel,
          ruleId: rule.ruleId
        })
      }
    }

    if (systolicValue !== null && diastolicValue !== null) {
      if (diastolicValue >= systolicValue) {
        errors.push({
          field: 'diastolic',
          message: 'Diastolic tidak boleh lebih besar atau sama dengan Systolic.',
          code: 'INVALID_PAIR'
        })
      } else if (systolicValue - diastolicValue < 10) {
        errors.push({
          field: 'systolic',
          message: 'Selisih Systolic dan Diastolic terlalu kecil (minimal 10 mmHg).',
          code: 'INVALID_PAIR'
        })
      }
    }

    const hasEmergency = valuesWithRules.some((v) => v.emergencyLevel === 'emergency')
    return jsonResponse(c, success({ valid: errors.length === 0, hasEmergency, errors, results: valuesWithRules }, 200, startedAt))
  } catch (error) {
    console.error('validate endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Validasi gagal diproses.', 500, [], startedAt))
  }
})


// Submit Measurement Session Endpoint









app.post('/api/measurements/submit', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    }

    const body = await c.req.json() as SubmitInput
    if (!body.values || !Array.isArray(body.values) || body.values.length === 0) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'values wajib dan tidak boleh kosong.', 400, [], startedAt))
    }

    const profileId = body.profileId
    if (!profileId) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'profileId wajib.', 400, [], startedAt))
    }

    const profile = await c.env.DB.prepare(
      'SELECT id, userId, sex, birthDate, heightCm FROM HL_userProfiles WHERE id = ? AND userId = ?'
    ).bind(profileId, userId).first<{ id: number; userId: number; sex: string; birthDate: string; heightCm: number | null }>()

    if (!profile) {
      return jsonResponse(c, failure('NOT_FOUND', 'Profil tidak ditemukan.', 404, [], startedAt))
    }

    const ageYears = calculateAgeYears(profile.birthDate)
    const sex = profile.sex || 'all'
    const tzRow = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ timezone: string }>()
    const userTz = tzRow?.timezone || 'UTC'
    const measuredAt = body.measuredAt || new Intl.DateTimeFormat('sv-SE', { timeZone: userTz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()).replace(' ', ' ')

    // US-1.4.3: Auto-calculate BMI when bodyWeight present and heightCm available and bmi not in values
    const hasBmi = body.values.some(v => v.metricCode === 'bmi')
    const hasBw = body.values.some(v => v.metricCode === 'bodyWeight')
    if (hasBw && !hasBmi && profile.heightCm && profile.heightCm > 0) {
      const bw = body.values.find(v => v.metricCode === 'bodyWeight')!.finalValue
      const heightM = profile.heightCm / 100
      const bmi = Math.round((bw / (heightM * heightM)) * 10) / 10
      body.values.push({
        metricCode: 'bmi',
        finalValue: bmi,
        unit: 'kg/m2',
        manualOverride: 0,
        rawAiValue: null
      })
    }

    const hasAi = body.values.some(v => v.rawAiValue !== null && v.rawAiValue !== undefined) ? 1 : 0
    // body.attachments is intentionally unused — attachments are uploaded via a separate
    // POST /api/measurements/attachments/upload after session creation (see DynamicMetricForm).
    // hasAttachment is set to 0 here and flipped to 1 by the upload endpoint.
    const hasAttachment = 0
    const encryptedNotes = await encryptSensitive(c, body.notes)

    const sessionId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_measurementSessions
       (userId, profileId, measuredAt, source, notes, hasAi, hasAttachment, hasEmergency, submittedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      profileId,
      measuredAt,
      body.source || 'manual',
      encryptedNotes,
      hasAi,
      hasAttachment
    ))

    const savedValues: Array<{ id: number; metricCode: string; status: string; severity: string; ruleId: number | null; finalValue: number; unit: string; popupTitle: string | null; popupMessage: string | null; recommendation: string | null; sourceLabel: string | null; emergencyLevel: string }> = []
    let hasEmergency = 0
    const missingRules: Array<{ metricCode: string; finalValue: number }> = []

    const catalogCodes = new Set<string>()
    const catalogRows = await c.env.DB.prepare('SELECT metricCode FROM HL_metricCatalog').all<{ metricCode: string }>()
    for (const row of catalogRows.results || []) catalogCodes.add(row.metricCode)

    for (const v of body.values) {
      if (!v.metricCode || !Number.isFinite(v.finalValue) || !v.unit) continue
      if (!catalogCodes.has(v.metricCode)) {
        console.error('submit unknown metric code', v.metricCode)
        continue
      }

      const rule = await evaluateRule(c, v.metricCode, v.finalValue, sex, ageYears)
      if (!rule.ruleId) {
        missingRules.push({ metricCode: v.metricCode, finalValue: v.finalValue })
      }
      const manualOverride = v.manualOverride ? 1 : 0

      const valueId = await insertAndGetId(c.env.DB.prepare(
        `INSERT INTO HL_measurementValues
         (sessionId, userId, metricCode, deviceCode, rawAiValue, finalValue, unit, confidence, manualOverride, status, severity, emergencyLevel, ruleId, measuredAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        sessionId,
        userId,
        v.metricCode,
        v.deviceCode || null,
        v.rawAiValue ?? null,
        v.finalValue,
        v.unit,
        v.confidence ?? null,
        manualOverride,
        rule.status,
        rule.severity,
        rule.emergencyLevel,
        rule.ruleId,
        measuredAt
      ))

      if (rule.emergencyLevel === 'emergency' || rule.severity === 'emergency') {
        hasEmergency = 1
      }

      savedValues.push({
        id: valueId,
        metricCode: v.metricCode,
        status: rule.status,
        severity: rule.severity,
        ruleId: rule.ruleId,
        finalValue: v.finalValue,
        unit: v.unit,
        popupTitle: rule.popupTitle,
        popupMessage: rule.popupMessage,
        recommendation: rule.recommendation,
        sourceLabel: rule.sourceLabel,
        emergencyLevel: rule.emergencyLevel
      })
    }

    // Attachments are uploaded separately via POST /api/measurements/attachments/upload
    // (handled by DynamicMetricForm.tsx after submit). The upload endpoint updates
    // HL_measurementSessions.hasAttachment = 1 directly.

    if (hasEmergency) {
      await c.env.DB.prepare(
        'UPDATE HL_measurementSessions SET hasEmergency = 1 WHERE id = ?'
      ).bind(sessionId).run()
    }

    if (missingRules.length > 0) {
      await c.env.DB.prepare(
        `INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, 'missingRule', 'HL_measurementSessions', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        userId,
        sessionId,
        JSON.stringify({ missing: missingRules })
      ).run()
    }

    await c.env.DB.prepare(
      `INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt)
       VALUES (?, 'measurementSubmit', 'HL_measurementSessions', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      sessionId,
      JSON.stringify({
        valueCount: body.values.length,
        hasAi,
        hasAttachment,
        hasEmergency,
        manualOverrideCount: body.values.filter(v => v.manualOverride).length
      })
    ).run()

    const notifType = hasEmergency === 1 ? 'emergency_alert' : 'submit_summary'
    const notifTitle = hasEmergency === 1 ? 'Peringatan Darurat' : 'Pengukuran Tersimpan'
    const lines = savedValues.map(v => `• ${v.metricCode}: ${v.finalValue} ${v.unit} (${v.status})`).join('\n')
    const notifMessage = hasEmergency === 1
      ? `Terdeteksi nilai darurat.\n${lines}\nSegera konsultasi ke dokter.`
      : `${savedValues.length} nilai tersimpan.\n${lines}`
    // US-3.3.1 + US-4.3.1 + US-4.3.2: create HL_alerts for emergency severity, update daily streak, award badges.
    let streakData: { currentCount: number; bestCount: number; today: string } | null = null
    let badgesData: string[] = []
    try {
      const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ timezone: string }>()
      const tz = profileInfo?.timezone || 'UTC'
      for (const v of savedValues) {
        if (v.severity === 'emergency' || v.severity === 'critical') {
          await createEmergencyAlert(c as any, userId, sessionId, v.metricCode, v.finalValue, v.unit, v.severity, `Nilai ${v.metricCode} ${v.finalValue} ${v.unit} masuk kategori darurat.`)
        }
      }
      streakData = await updateDailyStreak(c as any, userId, tz)
      badgesData = await awardBadges(c as any, userId, streakData!.currentCount)
    } catch (hookErr) {
      console.error('streak/alert hook error:', hookErr)
    }

    // US-3.1.3: enqueue async; if queue is not bound, fall back to in-request send.
    const queued = await enqueueTelegramSummary(c, {
      userId,
      notificationType: notifType as 'submit_summary' | 'emergency_alert',
      title: notifTitle,
      message: notifMessage,
      sessionId,
      hasEmergency: hasEmergency === 1
    })
    if (!queued.enqueued) {
      try {
        const tg = await sendTelegramNotification(c, userId, notifType, notifTitle, notifMessage)
        await logNotification(c, userId, 'telegram', notifType, notifTitle, notifMessage,
          tg.sent ? 'sent' : 'skipped',
          { sessionId, hasEmergency: hasEmergency === 1, via: 'sync_fallback' },
          tg.error)
      } catch (tgErr) {
        console.error('telegram notify failed:', tgErr)
        await logNotification(c, userId, 'telegram', notifType, notifTitle, notifMessage,
          'failed', { sessionId }, tgErr instanceof Error ? tgErr.message : 'unknown')
      }
    } else {
      await logNotification(c, userId, 'telegram', notifType, notifTitle, notifMessage,
        'pending', { sessionId, hasEmergency: hasEmergency === 1, via: 'queue' }, undefined)
    }

    // US-1.4.2 + US-2.2.1 + US-2.2.2: build interpretations array for client-side popup
    const metricNames = await c.env.DB.prepare('SELECT metricCode, metricName FROM HL_metricCatalog').all<{ metricCode: string; metricName: string }>()
    const metricNameMap = new Map<string, string>()
    for (const r of metricNames.results || []) metricNameMap.set(r.metricCode, r.metricName)
    const interpretations = savedValues.map(v => ({
      metricCode: v.metricCode,
      metricName: metricNameMap.get(v.metricCode) || v.metricCode,
      finalValue: v.finalValue,
      unit: v.unit,
      status: v.status,
      severity: v.severity,
      popupTitle: v.popupTitle || v.status,
      popupMessage: v.popupMessage || '',
      recommendation: v.recommendation || '',
      sourceLabel: v.sourceLabel || '',
      emergencyLevel: v.emergencyLevel || 'none'
    }))

    const hasWarningOrAbove = savedValues.some(v => v.severity === 'warning' || v.severity === 'critical' || v.severity === 'emergency')
    return jsonResponse(c, success({
      sessionId,
      values: savedValues,
      interpretations,
      hasEmergency: hasEmergency === 1,
      streak: streakData,
      badges: badgesData,
      postSubmitPrompt: hasWarningOrAbove ? { type: 'symptomCheck', message: 'Apakah Anda mengalami keluhan terkait hasil pengukuran ini?', sessionId } : null
    }, 201, startedAt))
  } catch (error) {
    console.error('submit endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Submit gagal diproses.', 500, [], startedAt))
  }
})


// Upload Final Attachment to R2 Endpoint
app.post('/api/measurements/attachments/upload', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    }

    const formData = await c.req.parseBody()
    const file = formData.file as File
    const sessionId = formData.sessionId as string
    const metricCode = formData.metricCode as string
    const fileName = (formData.fileName as string) || 'attachment.webp'

    if (!file) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'File wajib.', 400, [], startedAt))
    }
    if (!sessionId || !metricCode) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'sessionId dan metricCode wajib.', 400, [], startedAt))
    }

    const sessionRow = await c.env.DB.prepare(
      'SELECT userId FROM HL_measurementSessions WHERE id = ?'
    ).bind(sessionId).first<{ userId: number }>()

    if (!sessionRow || sessionRow.userId !== userId) {
      return jsonResponse(c, failure('NOT_FOUND', 'Sesi tidak ditemukan.', 404, [], startedAt))
    }

    const maxUploadSize = await getSystemConfigNumber(c, 'maxUploadSizeBytes')
    if (file.size > maxUploadSize) {
      return jsonResponse(c, failure('VALIDATION_ERROR', `File terlalu besar. Maks ${Math.round(maxUploadSize / 1024 / 1024)}MB.`, 400, [], startedAt))
    }

    const uniqueSuffix = Date.now().toString(36)
    const r2Key = `HL/users/${userId}/measurements/${sessionId}/${metricCode}-${uniqueSuffix}.webp`

    const arrayBuffer = await file.arrayBuffer()
    await c.env.LOGS.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/webp'
      }
    })

    const width = parseInt((formData.width as string) || '0', 10) || null
    const height = parseInt((formData.height as string) || '0', 10) || null

    const attachmentId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_measurementAttachments
       (sessionId, userId, metricCode, r2Key, fileName, fileType, fileSize, watermarked, compressed, compressionQuality, imageWidth, imageHeight)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, 50, ?, ?)`
    ).bind(
      sessionId,
      userId,
      metricCode,
      r2Key,
      fileName,
      file.type || 'image/webp',
      file.size,
      width,
      height
    ))

    await c.env.DB.prepare(
      'UPDATE HL_measurementSessions SET hasAttachment = 1 WHERE id = ?'
    ).bind(sessionId).run()

    return jsonResponse(c, success({
      attachmentId,
      r2Key,
      sizeBytes: file.size,
      width,
      height
    }, 201, startedAt))
  } catch (error) {
    console.error('upload endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Upload gagal.', 500, [], startedAt))
  }
})

app.get('/api/measurements/history', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    }

    const from = c.req.query('from')
    const to = c.req.query('to')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    let sql = `SELECT id, measuredAt, source, hasAttachment, hasEmergency
      FROM HL_measurementSessions
      WHERE userId = ?`
    const params: unknown[] = [userId]
    if (from) {
      sql += ' AND measuredAt >= ?'
      params.push(from)
    }
    if (to) {
      sql += ' AND measuredAt <= ?'
      params.push(to)
    }
    sql += ' ORDER BY measuredAt DESC LIMIT ?'
    params.push(limit)

    const sessions = await c.env.DB.prepare(sql).bind(...params).all<{
      id: string
      measuredAt: string
      source: string
      hasAttachment: number
      hasEmergency: number
    }>()
    const sessionRows = sessions.results || []
    if (sessionRows.length === 0) {
      return jsonResponse(c, success({ sessions: [] }, 200, startedAt))
    }

    const placeholders = sessionRows.map(() => '?').join(',')
    const sessionIds = sessionRows.map((row) => row.id)
    const values = await c.env.DB.prepare(
      `SELECT id, sessionId, metricCode, finalValue, unit, status, severity, manualOverride
       FROM HL_measurementValues
       WHERE userId = ? AND sessionId IN (${placeholders})
       ORDER BY createdAt DESC`
    ).bind(userId, ...sessionIds).all<{
      id: string
      sessionId: string
      metricCode: string
      finalValue: number
      unit: string
      status: string
      severity: string
      manualOverride: number
    }>()
    const attachments = await c.env.DB.prepare(
      `SELECT id, sessionId, metricCode, fileName, fileType, fileSize, createdAt
       FROM HL_measurementAttachments
       WHERE userId = ? AND sessionId IN (${placeholders})
       ORDER BY createdAt DESC`
    ).bind(userId, ...sessionIds).all<{
      id: string
      sessionId: string
      metricCode: string
      fileName: string
      fileType: string
      fileSize: number
      createdAt: string
    }>()

    const valuesBySession = new Map<string, Array<Record<string, unknown>>>()
    for (const value of values.results || []) {
      if (!valuesBySession.has(value.sessionId)) valuesBySession.set(value.sessionId, [])
      valuesBySession.get(value.sessionId)!.push(value as unknown as Record<string, unknown>)
    }

    const attachmentsBySession = new Map<string, Array<Record<string, unknown>>>()
    for (const attachment of attachments.results || []) {
      if (!attachmentsBySession.has(attachment.sessionId)) attachmentsBySession.set(attachment.sessionId, [])
      attachmentsBySession.get(attachment.sessionId)!.push(attachment as unknown as Record<string, unknown>)
    }

    return jsonResponse(
      c,
      success(
        {
          sessions: sessionRows.map((session) => ({
            ...session,
            values: valuesBySession.get(session.id) || [],
            attachments: attachmentsBySession.get(session.id) || []
          }))
        },
        200,
        startedAt
      )
    )
  } catch (error) {
    console.error('measurement history error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat riwayat pengukuran.', 500, [], startedAt))
  }
})

// Get last measurements for rarely-changing metrics (auto-fill)
app.get('/api/measurements/last', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const rows = await c.env.DB.prepare(
      'SELECT metricCode, deviceCode, finalValue, unit, measuredAt FROM HL_lastMeasurements WHERE userId = ? ORDER BY measuredAt DESC'
    ).bind(userId).all<{ metricCode: string; deviceCode: string | null; finalValue: number; unit: string; measuredAt: string }>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) {
    console.error('last measurements error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat data terakhir.', 500, [], startedAt))
  }
})

// Save/update last measurement for rarely-changing metrics
app.post('/api/measurements/last/save', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { metricCode?: string; deviceCode?: string; finalValue?: number; unit?: string; measuredAt?: string }
    if (!body.metricCode || body.finalValue == null || !body.unit || !body.measuredAt) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'metricCode, finalValue, unit, measuredAt wajib.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      `INSERT INTO HL_lastMeasurements (userId, deviceCode, metricCode, finalValue, unit, measuredAt)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(userId, deviceCode, metricCode) DO UPDATE SET finalValue = excluded.finalValue, unit = excluded.unit, measuredAt = excluded.measuredAt`
    ).bind(userId, body.deviceCode || null, body.metricCode, body.finalValue, body.unit, body.measuredAt).run()
    return jsonResponse(c, success({ saved: true }, 200, startedAt))
  } catch (error) {
    console.error('save last measurement error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menyimpan data terakhir.', 500, [], startedAt))
  }
})

// Get today's measurement sessions — used to mark which devices already recorded today
app.get('/api/measurements/today', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))

    const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(userId).first<{ timezone: string }>()
    const timezone = profileInfo?.timezone || 'UTC'
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const today = formatter.format(new Date())

    const sessions = await c.env.DB.prepare(
      `SELECT s.id AS sessionId, s.measuredAt, s.source, s.hasAttachment,
              (SELECT COUNT(*) FROM HL_measurementValues v WHERE v.sessionId = s.id) AS valueCount
       FROM HL_measurementSessions s
       WHERE s.userId = ?
       ORDER BY s.measuredAt DESC
       LIMIT 50`
    ).bind(userId).all<{ sessionId: number; measuredAt: string; source: string; hasAttachment: number; valueCount: number }>()

    // Filter to today's sessions in the user's timezone (measuredAt is stored in UTC)
    const todayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const todaysSessions = (sessions.results || []).filter(s => todayFormatter.format(new Date(s.measuredAt)) === today)

    const enriched = await Promise.all(todaysSessions.map(async (s) => {
      const deviceRows = await c.env.DB.prepare(
        'SELECT DISTINCT deviceCode FROM HL_measurementValues WHERE sessionId = ? AND deviceCode IS NOT NULL'
      ).bind(s.sessionId).all<{ deviceCode: string }>()
      return {
        sessionId: s.sessionId,
        measuredAt: s.measuredAt,
        source: s.source,
        hasAttachment: s.hasAttachment,
        valueCount: s.valueCount,
        deviceCodes: (deviceRows.results || []).map(r => r.deviceCode).filter(Boolean)
      }
    }))

    return jsonResponse(c, success({ sessions: enriched, date: today }, 200, startedAt))
  } catch (error) {
    console.error('today measurements error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat data hari ini.', 500, [], startedAt))
  }
})

app.get('/api/measurements/attachments/:id', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    }

    const attachment = await c.env.DB.prepare(
      'SELECT id, userId, r2Key, fileType, fileName FROM HL_measurementAttachments WHERE id = ?'
    ).bind(c.req.param('id')).first<{ id: number; userId: number; r2Key: string; fileType: string; fileName: string }>()

    if (!attachment || attachment.userId !== userId) {
      return jsonResponse(c, failure('NOT_FOUND', 'Lampiran tidak ditemukan.', 404, [], startedAt))
    }

    const object = await c.env.LOGS.get(attachment.r2Key)
    if (!object) {
      return jsonResponse(c, failure('NOT_FOUND', 'Bukti pengukuran tidak ditemukan.', 404, [], startedAt))
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': attachment.fileType || 'image/webp',
        'Content-Disposition': `inline; filename="${attachment.fileName}"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('measurement attachment read error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat bukti pengukuran.', 500, [], startedAt))
  }
})
// Offline draft sync
app.post('/api/measurements/sync', async (c: HC) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { drafts: any[] }
    if (!body.drafts || !Array.isArray(body.drafts)) return jsonResponse(c, failure('VALIDATION_ERROR', 'drafts wajib.', 400, [], startedAt))
    const synced: any[] = []
    for (const d of body.drafts) {
      const profileId = d.profileId && typeof d.profileId === 'string' ? d.profileId : null
      const draftId = await insertAndGetId(c.env.DB.prepare(
        `INSERT INTO HL_measurementDrafts (userId, profileId, selectedMetricsJson, draftDataJson, status, createdAt, updatedAt, expiresAt)
         VALUES (?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`
      ).bind(userId, profileId, JSON.stringify(d.metrics || []), JSON.stringify(d), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()))
      synced.push({ clientId: d.clientId, draftId })
    }
    return jsonResponse(c, success({ synced, count: synced.length }, 200, startedAt))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('sync error:', msg)
    return jsonResponse(c, failure('INTERNAL_ERROR', `Gagal sync: ${msg}`, 500, [], startedAt))
  }
})
// AI Extraction Endpoint


app.post('/api/measurements/extract', async (c: HC) => {
  const startedAt = Date.now()

  try {
    // Get user from session
    const sessionToken = getCookie(c, 'hlSession')
    if (!sessionToken) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, []))
    }

    const sessionTokenHash = await sha256Token(sessionToken)
    const sessionQuery = await c.env.DB.prepare(
      'SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND expiresAt > datetime("now") AND revokedAt IS NULL'
    ).bind(sessionTokenHash).first()

    if (!sessionQuery) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid atau kadaluarsa.', 401, []))
    }

    const userId = (sessionQuery as { userId: number }).userId

    // Parse multipart form data
    const formData = await c.req.parseBody()
    const file = formData.file as File
    const deviceCode = formData.deviceCode as string
    const metricGroup = formData.metricGroup as string
    const selectedMetricCodesJson = formData.selectedMetricCodes as string
    const sessionDraftId = formData.sessionDraftId as string | undefined

    const maxUploadSize = await getSystemConfigNumber(c, 'maxUploadSizeBytes')

    // Validate file size
    if (!file) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'File gambar diperlukan.', 400, []))
    }

    if (file.size > maxUploadSize) {
      return jsonResponse(c, failure('VALIDATION_ERROR', `Ukuran file terlalu besar. Maksimal ${maxUploadSize / 1024 / 1024}MB.`, 400, []))
    }

    // Validate form fields
    let selectedMetricCodes: string[] = []
    try {
      selectedMetricCodes = JSON.parse(selectedMetricCodesJson)
    } catch {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Format selectedMetricCodes tidak valid.', 400, []))
    }

    const inputErrors = validateExtractInput({
      deviceCode,
      metricGroup,
      selectedMetricCodes,
      sessionDraftId
    })

    if (inputErrors.length > 0) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Input tidak valid.', 400, inputErrors))
    }

    const aiTimeout = await getSystemConfigNumber(c, 'aiExtractTimeoutMs')
    const configuredVisionModel = await getSystemConfigString(c, 'aiVisionModel')
    if (!configuredVisionModel) {
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Model AI Vision belum dikonfigurasi.', 500, []))
    }

    // Prepare AI Vision call
    const aiStartedAt = Date.now()
    let aiSuccess = false
    let aiTimedOut = false
    let rawResponse: string | null = null
    let parsedJson: string | null = null
    let extractedMetrics: any[] = []
    let confidence = 0
    let modelName = configuredVisionModel

    // Check if using custom endpoint for vision
    const useCustomVision = await getSystemConfigString(c, 'aiVisionUseCustomEndpoint')
    const customVisionEndpoint = useCustomVision === 'true' ? await getSystemConfigString(c, 'aiTextEndpoint') : null
    const customVisionApiKey = customVisionEndpoint ? await getSystemConfigString(c, 'aiTextApiKey') : null
    const customVisionModels = customVisionEndpoint ? await getSystemConfigString(c, 'aiTextModels') : null
    let customVisionModel = ''
    if (customVisionModels) {
      try { const parsed = JSON.parse(customVisionModels); customVisionModel = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : '' } catch { /* ignore */ }
    }

    try {
      // Convert file to base64 for AI Vision
      const arrayBuffer = await file.arrayBuffer()
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      // Call AI Vision with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), aiTimeout)

      try {
        let aiResponse: Response | null = null

        if (customVisionEndpoint && customVisionModel) {
          // Use custom OpenAI-compatible endpoint (vision via chat completions)
          const endpoint = customVisionEndpoint.replace(/\/+$/, '')
          aiResponse = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(customVisionApiKey ? { 'Authorization': `Bearer ${customVisionApiKey}` } : {})
            },
            body: JSON.stringify({
              model: customVisionModel,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: `Extract health measurements from this device image. Device: ${deviceCode}, Group: ${metricGroup}. Return ONLY a JSON object with metric codes as keys and their numeric values. Example: {"spo2":98,"heartRate":72}` },
                  { type: 'image_url', image_url: { url: `data:${file.type};base64,${base64Image}` } }
                ]
              }],
              max_tokens: 500
            }),
            signal: controller.signal
          })
          modelName = customVisionModel
        } else {
          // Use Cloudflare Workers AI Vision
          aiResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/models/${modelName}/inference`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                image: `data:${file.type};base64,${base64Image}`,
                prompt: `Extract health measurements from this device image. Device: ${deviceCode}, Group: ${metricGroup}. Return JSON with metric codes and values.`
              }),
              signal: controller.signal
            }
          )
        }

        clearTimeout(timeoutId)

        if (aiResponse && aiResponse.ok) {
          const aiData = await aiResponse.json() as any
          rawResponse = JSON.stringify(aiData)

          // Parse AI response - handle both Workers AI and OpenAI/chat format
          let aiResult: any = null
          if (aiData.success && aiData.result) {
            // Cloudflare Workers AI format
            aiResult = aiData.result
          } else if (aiData.choices && aiData.choices[0] && aiData.choices[0].message) {
            // OpenAI chat completions format
            const content = aiData.choices[0].message.content
            if (content) {
              try { aiResult = JSON.parse(content) } catch { aiResult = content }
            }
          }

          if (aiResult) {
            parsedJson = JSON.stringify(aiResult)
            aiSuccess = true

            // Per US-1.3.3: AI tidak boleh menebak metric yang tidak dipilih
            const allow = (code: string) => selectedMetricCodes.includes(code)
            const isSinocare = (deviceCode || '').toLowerCase().includes('sinocare') || metricGroup === 'sinocareGcu'

            // Extract metrics based on device group
            if (metricGroup === 'oximeter') {
              // Try to extract SpO2 and heart rate
              const text = JSON.stringify(aiData.result)
              const spo2Match = text.match(/spo2["\s:=]+(\d+)/i)
              const hrMatch = text.match(/heart["\s:=]+(\d+)/i) || text.match(/hr["\s:=]+(\d+)/i) || text.match(/pulse["\s:=]+(\d+)/i)

              if (spo2Match) {
                if (allow('spo2')) extractedMetrics.push({
                  metricCode: 'spo2',
                  rawAiValue: parseInt(spo2Match[1]),
                  unit: '%',
                  confidence: 0.85
                })
              }

              if (hrMatch) {
                if (allow('heartRate')) extractedMetrics.push({
                  metricCode: 'heartRate',
                  rawAiValue: parseInt(hrMatch[1]),
                  unit: 'bpm',
                  confidence: 0.82
                })
              }

              confidence = extractedMetrics.length > 0 ? 0.85 : 0
            } else if (metricGroup === 'bloodPressure') {
              // Try to extract systolic, diastolic, pulse
              const text = JSON.stringify(aiData.result)
              const sysMatch = text.match(/sys["\s:=]+(\d+)/i) || text.match(/systolic["\s:=]+(\d+)/i)
              const diaMatch = text.match(/dia["\s:=]+(\d+)/i) || text.match(/diastolic["\s:=]+(\d+)/i)
              const pulseMatch = text.match(/pulse["\s:=]+(\d+)/i)

              if (sysMatch) {
                if (allow('systolic')) extractedMetrics.push({
                  metricCode: 'systolic',
                  rawAiValue: parseInt(sysMatch[1]),
                  unit: 'mmHg',
                  confidence: 0.87
                })
              }

              if (diaMatch) {
                if (allow('diastolic')) extractedMetrics.push({
                  metricCode: 'diastolic',
                  rawAiValue: parseInt(diaMatch[1]),
                  unit: 'mmHg',
                  confidence: 0.86
                })
              }

              if (pulseMatch) {
                if (allow('bloodPressurePulse')) extractedMetrics.push({
                  metricCode: 'bloodPressurePulse',
                  rawAiValue: parseInt(pulseMatch[1]),
                  unit: 'bpm',
                  confidence: 0.83
                })
              }

              confidence = extractedMetrics.length > 0 ? 0.86 : 0
            } else if (metricGroup === 'sinocareGcu' || isSinocare) {
              // US-1.3.3: Sinocare - only extract selected metric
              const text = JSON.stringify(aiData.result)
              if (allow('glucoseFasting') || allow('glucosePostMeal') || allow('cholesterolTotal') || allow('uricAcid')) {
                const glu = text.match(/glu["\s:=]+(\d+(\.\d+)?)/i) || text.match(/glucose["\s:=]+(\d+(\.\d+)?)/i)
                const chol = text.match(/chol["\s:=]+(\d+(\.\d+)?)/i) || text.match(/cholesterol["\s:=]+(\d+(\.\d+)?)/i)
                const ua = text.match(/ua["\s:=]+(\d+(\.\d+)?)/i) || text.match(/uric["\s:=]+(\d+(\.\d+)?)/i)
                if (glu && (allow('glucoseFasting') || allow('glucosePostMeal'))) {
                  const unit = 'mg/dL'
                  if (allow('glucoseFasting')) extractedMetrics.push({ metricCode: 'glucoseFasting', rawAiValue: parseFloat(glu[1]), unit, confidence: 0.84 })
                  else if (allow('glucosePostMeal')) extractedMetrics.push({ metricCode: 'glucosePostMeal', rawAiValue: parseFloat(glu[1]), unit, confidence: 0.84 })
                }
                if (chol && allow('cholesterolTotal')) extractedMetrics.push({ metricCode: 'cholesterolTotal', rawAiValue: parseFloat(chol[1]), unit: 'mg/dL', confidence: 0.83 })
                if (ua && allow('uricAcid')) extractedMetrics.push({ metricCode: 'uricAcid', rawAiValue: parseFloat(ua[1]), unit: 'mg/dL', confidence: 0.81 })
                confidence = extractedMetrics.length > 0 ? 0.84 : 0
              }
            } else {
              // Generic extraction for other device types
              confidence = 0.75
            }
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          aiTimedOut = true
          console.error('AI Vision timeout:', fetchError)
        } else {
          console.error('AI Vision call failed:', fetchError)
        }
      }
    } catch (error) {
      console.error('AI extraction process failed:', error)
    }

    const durationMs = Date.now() - aiStartedAt

    // Log extraction to database
    await c.env.DB.prepare(
      `INSERT INTO HL_aiExtractions 
       (userId, sessionDraftId, deviceCode, metricGroup, selectedMetricsJson, rawResponse, parsedJson, durationMs, success, timeout, confidence, modelName) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      userId,
      sessionDraftId || null,
      deviceCode,
      metricGroup,
      JSON.stringify(selectedMetricCodes),
      rawResponse || null,
      parsedJson || null,
      durationMs,
      aiSuccess ? 1 : 0,
      aiTimedOut ? 1 : 0,
      confidence || null,
      modelName
    ).run()

    // Return response
    if (aiTimedOut) {
      return c.json({
        success: false,
        error: {
          code: 'AI_TIMEOUT',
          message: 'AI terlalu lama membaca foto. Silakan input manual.'
        },
        data: {
          timeout: true,
          durationMs,
          deviceCode,
          metricGroup
        }
      }, 408)
    }

    if (!aiSuccess || extractedMetrics.length === 0) {
      return c.json({
        success: false,
        error: {
          code: 'AI_EXTRACTION_FAILED',
          message: 'AI gagal membaca foto. Silakan input manual.'
        },
        data: {
          timeout: false,
          durationMs,
          deviceCode,
          metricGroup
        }
      }, 200)
    }

    return jsonResponse(c, success({
      timeout: false,
      durationMs,
      deviceCode,
      metricGroup,
      metrics: extractedMetrics,
      needsManualReview: confidence < 0.8
    }, 200))

  } catch (error) {
    console.error('Extraction endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Terjadi kesalahan sistem.', 500, []))
  }
})

}
