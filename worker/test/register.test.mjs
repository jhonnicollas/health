import assert from 'node:assert/strict'
import test from 'node:test'
import {
  app,
  hashPassword,
  normalizeEmail,
  sha256Token,
  validateLoginInput,
  validateOnboardingInput,
  validateProfileUpdateInput,
  validateRegistrationInput,
  validateUiSettingsInput,
  verifyPassword
} from '../dist/index.js'

class D1MockStatement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.params = []
  }

  bind(...params) {
    this.params = params
    return this
  }

  async first() {
    if (this.sql.includes('HL_userStreaks') || this.sql.includes('HL_recommendations')) {
      throw new Error('no such table')
    }

    if (this.sql.includes('SELECT configValue FROM HL_systemConfigs')) {
      const configKey = this.params[0]
      const configValue = this.db.systemConfigs[configKey]
      return configValue ? { configValue } : null
    }

    if (this.sql.includes('SELECT configKey FROM HL_systemConfigs')) {
      const configKey = this.params[0]
      return this.db.systemConfigs[configKey] !== undefined ? { configKey } : null
    }

    if (this.sql.includes('FROM HL_apiRateLimits')) {
      const [rateKey, routeKey, windowStart] = this.params
      return (
        this.db.rateLimits.find(
          (row) =>
            row.rateKey === rateKey &&
            row.routeKey === routeKey &&
            row.windowStart === windowStart
        ) ?? null
      )
    }

    if (this.sql.includes('SELECT id FROM HL_userProfiles')) {
      const userId = this.params[0]
      const profile = this.db.profiles.find((row) => row.userId === userId)
      return profile ? { id: profile.id } : null
    }

    if (this.sql.includes('SELECT id FROM HL_users')) {
      if (this.db.failSelect) {
        throw new Error('D1 unavailable')
      }

      const email = this.params[0]
      const user = this.db.users.find((row) => row.email === email)
      return user ? { id: user.id } : null
    }

    if (this.sql.includes('FROM HL_users') && this.sql.includes("authProvider = 'local'")) {
      const email = this.params[0]
      const user = this.db.users.find((row) => row.email === email)
      return user ?? null
    }

    if (this.sql.includes('FROM HL_userProfiles')) {
      const userId = this.params[0]
      return this.db.profiles.find((row) => row.userId === userId) ?? null
    }

    if (this.sql.includes('FROM HL_sessions')) {
      const tokenHash = this.params[0]
      const now = Date.now()
      const session = this.db.sessions.find(
        (row) =>
          row.sessionTokenHash === tokenHash &&
          !row.revokedAt &&
          Date.parse(row.expiresAt) > now
      )

      if (!session) {
        return null
      }

      const user = this.db.users.find((row) => row.id === session.userId && row.active === 1)

      if (!user) {
        return null
      }

      if (this.sql.includes('SELECT userId FROM HL_sessions')) {
        return { userId: session.userId }
      }

      const profile = this.db.profiles.find((row) => row.userId === user.id)

      return {
        ...user,
        profileId: profile?.id ?? null,
        sex: profile?.sex ?? null,
        birthDate: profile?.birthDate ?? null,
        heightCm: profile?.heightCm ?? null,
        timezone: profile?.timezone ?? null,
        accessibilityMode: profile?.accessibilityMode ?? null,
        theme: profile?.theme ?? null,
        emergencyConsent: profile?.emergencyConsent ?? null,
        aiConsent: profile?.aiConsent ?? null,
        dataShareConsent: profile?.dataShareConsent ?? null
      }
    }

    if (this.sql.includes('FROM HL_streaks')) {
      const userId = this.params[0]
      const streak = this.db.streaks.find(
        (row) => row.userId === userId && row.streakType === 'dailyMeasurement'
      )
      return streak ? { currentCount: streak.currentCount, bestCount: streak.bestCount } : null
    }

    if (this.sql.includes('FROM HL_aiRecommendations')) {
      const userId = this.params[0]
      const recommendation = this.db.aiRecommendations
        .filter((row) => row.userId === userId)
        .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]
      return recommendation ? { summaryText: recommendation.summaryText } : null
    }

    return null
  }

  async run() {
    this.db.apply(this)
    return { success: true, meta: { last_row_id: this.db.lastInsertId } }
  }

  async all() {
    if (this.sql.includes('FROM HL_systemConfigs')) {
      return {
        results: Object.entries(this.db.systemConfigs)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([configKey, configValue]) => ({
            configKey,
            configValue,
            dataType: this.db.systemConfigMeta[configKey]?.dataType ?? 'string',
            description: this.db.systemConfigMeta[configKey]?.description ?? null,
            updatedAt: 'CURRENT_TIMESTAMP'
          }))
      }
    }

    if (this.sql.includes('FROM HL_measurementSessions')) {
      const [userId, day] = this.params
      const rows = this.db.measurementSessions
        .filter((row) => row.userId === userId && row.measuredAt.slice(0, 10) === day)
        .sort((left, right) => right.measuredAt.localeCompare(left.measuredAt))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_measurementValues')) {
      const [userId, ...sessionIds] = this.params
      const rows = this.db.measurementValues
        .filter((row) => row.userId === userId && sessionIds.includes(row.sessionId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_alerts')) {
      const [userId, day] = this.params
      const rows = this.db.alerts
        .filter((row) => row.userId === userId && row.createdAt.slice(0, 10) === day)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_devices')) {
      const activeOnly = this.params[0] === 1
      const rows = []

      for (const device of this.db.devices) {
        if (activeOnly && device.active !== 1) {
          continue
        }

        const deviceMetrics = this.db.deviceMetrics
          .filter((row) => row.deviceCode === device.deviceCode)
          .sort((left, right) => left.sortOrder - right.sortOrder)

        for (const deviceMetric of deviceMetrics) {
          const metric = this.db.metrics.find(
            (row) => row.metricCode === deviceMetric.metricCode
          )

          if (!metric || (activeOnly && (deviceMetric.active !== 1 || metric.active !== 1))) {
            continue
          }

          rows.push({
            deviceCode: device.deviceCode,
            deviceName: device.deviceName,
            deviceType: device.deviceType,
            brand: device.brand,
            model: device.model,
            deviceSortOrder: 0,
            metricCode: metric.metricCode,
            metricName: metric.metricName,
            category: metric.category,
            unit: metric.unit,
            inputType: metric.inputType,
            requiresAttachment: metric.requiresAttachment,
            requiresSex: metric.requiresSex,
            requiresFasting: metric.requiresFasting,
            isCalculated: metric.isCalculated,
            requiredMetric: deviceMetric.requiredMetric ?? 1,
            physicalMin: metric.physicalMin,
            physicalMax: metric.physicalMax,
            metricSortOrder: deviceMetric.sortOrder
          })
        }
      }

      return { results: rows }
    }

    return { results: [] }
  }
}

class D1Mock {
  constructor(options = {}) {
    this.lastInsertId = 0
    this.users = []
    this.sessions = []
    this.auditLogs = []
    this.profiles = []
    this.consents = []
    this.rateLimits = []
    this.measurementSessions = []
    this.measurementValues = []
    this.alerts = []
    this.streaks = []
    this.aiRecommendations = []
    this.devices = [
      {
        deviceCode: 'yuwellYx106',
        deviceName: 'Yuwell YX106 Oximeter',
        deviceType: 'oximeter',
        brand: 'Yuwell',
        model: 'YX106',
        active: 1
      },
      {
        deviceCode: 'omronHem7194t1fl',
        deviceName: 'OMRON BT HEM 7194 T1 FL',
        deviceType: 'bloodPressure',
        brand: 'OMRON',
        model: 'HEM 7194 T1 FL',
        active: 1
      },
      {
        deviceCode: 'sinocareM101',
        deviceName: 'Sinocare M101 GCU 3 in 1',
        deviceType: 'gcu',
        brand: 'Sinocare',
        model: 'M101',
        active: 1
      },
      {
        deviceCode: 'thermometer',
        deviceName: 'Thermometer',
        deviceType: 'thermometer',
        brand: 'Generic',
        model: 'Thermometer',
        active: 1
      },
      {
        deviceCode: 'bodyScale',
        deviceName: 'Body Scale',
        deviceType: 'bodyScale',
        brand: 'Generic',
        model: 'Body Scale',
        active: 1
      },
      {
        deviceCode: 'manualInput',
        deviceName: 'Manual Input',
        deviceType: 'manual',
        brand: 'Manual',
        model: 'Manual',
        active: 1
      }
    ]
    this.metrics = [
      {
        metricCode: 'spo2',
        metricName: 'Saturasi Oksigen',
        category: 'Oksigen',
        unit: '%',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 0,
        physicalMax: 100,
        active: 1
      },
      {
        metricCode: 'heartRate',
        metricName: 'Denyut Jantung',
        category: 'Detak Jantung',
        unit: 'bpm',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 20,
        physicalMax: 250,
        active: 1
      },
      {
        metricCode: 'systolic',
        metricName: 'Tekanan Sistolik',
        category: 'Tekanan Darah',
        unit: 'mmHg',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 50,
        physicalMax: 300,
        active: 1
      },
      {
        metricCode: 'diastolic',
        metricName: 'Tekanan Diastolik',
        category: 'Tekanan Darah',
        unit: 'mmHg',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 30,
        physicalMax: 200,
        active: 1
      },
      {
        metricCode: 'glucoseFasting',
        metricName: 'Gula Darah Puasa',
        category: 'Metabolisme Glukosa',
        unit: 'mg/dL',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 1,
        isCalculated: 0,
        physicalMin: 20,
        physicalMax: 600,
        active: 1
      },
      {
        metricCode: 'glucosePostMeal',
        metricName: 'Gula Darah 2 Jam PP',
        category: 'Metabolisme Glukosa',
        unit: 'mg/dL',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 20,
        physicalMax: 600,
        active: 1
      },
      {
        metricCode: 'cholesterolTotal',
        metricName: 'Kolesterol Total',
        category: 'Profil Lipid',
        unit: 'mg/dL',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 1,
        isCalculated: 0,
        physicalMin: 50,
        physicalMax: 600,
        active: 1
      },
      {
        metricCode: 'uricAcid',
        metricName: 'Asam Urat',
        category: 'Metabolisme Purin',
        unit: 'mg/dL',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 1,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 0,
        physicalMax: 20,
        active: 1
      },
      {
        metricCode: 'bloodPressurePulse',
        metricName: 'Pulse Tensimeter',
        category: 'Tekanan Darah',
        unit: 'bpm',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 20,
        physicalMax: 250,
        active: 1
      },
      {
        metricCode: 'bodyWeight',
        metricName: 'Berat Badan',
        category: 'Komposisi Tubuh',
        unit: 'kg',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 1,
        physicalMax: 300,
        active: 1
      },
      {
        metricCode: 'bmi',
        metricName: 'Body Mass Index',
        category: 'Komposisi Tubuh',
        unit: 'index',
        inputType: 'calculated',
        requiresAttachment: 0,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 1,
        physicalMin: 0,
        physicalMax: 100,
        active: 1
      },
      {
        metricCode: 'waistCircumference',
        metricName: 'Lingkar Perut',
        category: 'Komposisi Tubuh',
        unit: 'cm',
        inputType: 'mixed',
        requiresAttachment: 0,
        requiresSex: 1,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 20,
        physicalMax: 300,
        active: 1
      },
      {
        metricCode: 'bodyTemperature',
        metricName: 'Suhu Tubuh',
        category: 'Suhu Tubuh',
        unit: 'C',
        inputType: 'mixed',
        requiresAttachment: 1,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 30,
        physicalMax: 45,
        active: 1
      },
      {
        metricCode: 'sleepDuration',
        metricName: 'Durasi Tidur',
        category: 'Tidur',
        unit: 'hour',
        inputType: 'manual',
        requiresAttachment: 0,
        requiresSex: 0,
        requiresFasting: 0,
        isCalculated: 0,
        physicalMin: 0,
        physicalMax: 24,
        active: 1
      }
    ]
    this.deviceMetrics = [
      { deviceCode: 'yuwellYx106', metricCode: 'spo2', requiredMetric: 1, sortOrder: 10, active: 1 },
      { deviceCode: 'yuwellYx106', metricCode: 'heartRate', requiredMetric: 1, sortOrder: 20, active: 1 },
      {
        deviceCode: 'omronHem7194t1fl',
        metricCode: 'systolic',
        requiredMetric: 1,
        sortOrder: 10,
        active: 1
      },
      {
        deviceCode: 'omronHem7194t1fl',
        metricCode: 'diastolic',
        requiredMetric: 1,
        sortOrder: 20,
        active: 1
      },
      {
        deviceCode: 'omronHem7194t1fl',
        metricCode: 'bloodPressurePulse',
        requiredMetric: 1,
        sortOrder: 30,
        active: 1
      },
      {
        deviceCode: 'sinocareM101',
        metricCode: 'glucoseFasting',
        requiredMetric: 0,
        sortOrder: 10,
        active: 1
      },
      {
        deviceCode: 'sinocareM101',
        metricCode: 'glucosePostMeal',
        requiredMetric: 0,
        sortOrder: 20,
        active: 1
      },
      {
        deviceCode: 'sinocareM101',
        metricCode: 'cholesterolTotal',
        requiredMetric: 0,
        sortOrder: 30,
        active: 1
      },
      {
        deviceCode: 'sinocareM101',
        metricCode: 'uricAcid',
        requiredMetric: 0,
        sortOrder: 40,
        active: 1
      },
      {
        deviceCode: 'thermometer',
        metricCode: 'bodyTemperature',
        requiredMetric: 1,
        sortOrder: 10,
        active: 1
      },
      {
        deviceCode: 'bodyScale',
        metricCode: 'bodyWeight',
        requiredMetric: 1,
        sortOrder: 10,
        active: 1
      },
      { deviceCode: 'bodyScale', metricCode: 'bmi', requiredMetric: 0, sortOrder: 20, active: 1 },
      {
        deviceCode: 'manualInput',
        metricCode: 'waistCircumference',
        requiredMetric: 0,
        sortOrder: 10,
        active: 1
      },
      {
        deviceCode: 'manualInput',
        metricCode: 'sleepDuration',
        requiredMetric: 0,
        sortOrder: 20,
        active: 1
      }
    ]
    this.systemConfigs = {
      loginRateLimitMaxReq: options.loginRateLimitMaxReq ?? '10',
      loginRateLimitWindowMin: options.loginRateLimitWindowMin ?? '10',
      aiExtractTimeoutMs: '5000',
      aiVisionModel: '@cf/meta/llama-3.2-11b-vision-instruct',
      maxUploadSizeBytes: '2097152',
      ocrRateLimitMax: '10',
      ocrRateLimitWindowMin: '5',
      telegramBotToken: ''
    }
    this.systemConfigMeta = {
      loginRateLimitMaxReq: { dataType: 'number', description: 'Max login requests' },
      loginRateLimitWindowMin: { dataType: 'number', description: 'Login window' },
      aiExtractTimeoutMs: { dataType: 'number', description: 'AI extract timeout' },
      aiVisionModel: { dataType: 'string', description: 'AI vision model' },
      maxUploadSizeBytes: { dataType: 'number', description: 'Max upload size' },
      ocrRateLimitMax: { dataType: 'number', description: 'OCR max requests' },
      ocrRateLimitWindowMin: { dataType: 'number', description: 'OCR window' },
      telegramBotToken: { dataType: 'string', description: 'Telegram token' }
    }
    this.failSelect = options.failSelect ?? false
  }

  prepare(sql) {
    return new D1MockStatement(this, sql)
  }

  async batch(statements) {
    for (const statement of statements) {
      this.apply(statement)
    }

    return statements.map(() => ({ success: true }))
  }

  apply(statement) {
    if (statement.sql.includes('INSERT INTO HL_users')) {
      const hasExplicitId = /\(id,/.test(statement.sql)
      const email = hasExplicitId ? statement.params[1] : statement.params[0]
      const passwordHash = hasExplicitId ? statement.params[2] : statement.params[1]
      const displayName = hasExplicitId ? statement.params[3] : statement.params[2]
      const id = hasExplicitId ? statement.params[0] : ++this.lastInsertId

      if (this.users.some((row) => row.email === email)) {
        throw new Error('UNIQUE constraint failed: HL_users.email')
      }

      this.users.push({
        id,
        email,
        passwordHash,
        displayName,
        telegramEnabled: 0,
        browserPushEnabled: 0,
        active: 1,
        authProvider: 'local',
        lastLoginAt: null
      })
    }

    if (statement.sql.includes('INSERT INTO HL_sessions')) {
      const hasExplicitId = /\(id,/.test(statement.sql)
      const userId = hasExplicitId ? statement.params[1] : statement.params[0]
      const sessionTokenHash = hasExplicitId ? statement.params[2] : statement.params[1]
      const userAgent = hasExplicitId ? statement.params[3] : statement.params[2]
      const expiresAt = hasExplicitId ? statement.params[4] : statement.params[3]
      const id = hasExplicitId ? statement.params[0] : ++this.lastInsertId
      this.sessions.push({ id, userId, sessionTokenHash, userAgent, expiresAt, revokedAt: null })
    }

    if (statement.sql.includes('INSERT INTO HL_auditLogs')) {
      const hasExplicitId = /\(id,/.test(statement.sql)
      const id = hasExplicitId ? statement.params[0] : ++this.lastInsertId

      // Parse column names and VALUES to map ? placeholders to columns
      const columnsMatch = statement.sql.match(/\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/)
      const columns = columnsMatch ? columnsMatch[1].split(',').map(s => s.trim()) : []
      const values = columnsMatch ? columnsMatch[2].split(',').map(s => s.trim()) : []

      let userId = null, action = 'userRegister', entityType = '', entityId = null, metadataJson = null
      let paramIdx = hasExplicitId ? 1 : 0

      for (let i = 0; i < columns.length && i < values.length; i++) {
        const isPlaceholder = values[i] === '?'
        const col = columns[i]
        if (col === 'id') continue
        if (isPlaceholder) {
          const val = statement.params[paramIdx++]
          if (col === 'userId') userId = val
          else if (col === 'action') action = val
          else if (col === 'entityType') entityType = val
          else if (col === 'entityId') entityId = val
          else if (col === 'metadataJson') metadataJson = val
          else if (col === 'createdAt') { /* skip */ }
        }
        // else: literal value in SQL, not a param — skip
      }

      // Override action from SQL text for reliability
      const actionOverrides = [
        ['userLogin', 'userLogin'], ['profileOnboardingComplete', 'profileOnboardingComplete'],
        ['profileUpdate', 'profileUpdate'], ['uiSettingsUpdate', 'uiSettingsUpdate'],
        ['configCreate', 'configCreate'], ['configUpdate', 'configUpdate'],
        ['configDelete', 'configDelete'], ['measurementSubmit', 'measurementSubmit'],
        ['alertCreate', 'alertCreate'], ['badgeEarned', 'badgeEarned'],
        ['accountDelete', 'accountDelete'], ['telegramConnect', 'telegramConnect'],
        ['alertAcknowledge', 'alertAcknowledge'], ['reportGenerate', 'reportGenerate'],
        ['missingRule', 'missingRule'], ['emergencyConsentRevoked', 'emergencyConsentRevoked'],
        ['emergencyConsentGiven', 'emergencyConsentGiven']
      ]
      for (const [pattern, act] of actionOverrides) {
        if (statement.sql.includes(pattern)) { action = act; break }
      }

      this.auditLogs.push({ id, userId, action, entityType, entityId, metadataJson })
    }

    if (statement.sql.includes('INSERT INTO HL_systemConfigs')) {
      const [configKey, configValue, dataType, description] = statement.params
      this.systemConfigs[configKey] = configValue
      this.systemConfigMeta[configKey] = { dataType, description }
    }

    if (statement.sql.includes('UPDATE HL_systemConfigs')) {
      const [configValue, configKey] = statement.params
      this.systemConfigs[configKey] = configValue
    }

    if (statement.sql.includes('DELETE FROM HL_systemConfigs')) {
      const [configKey] = statement.params
      delete this.systemConfigs[configKey]
      delete this.systemConfigMeta[configKey]
    }

    if (statement.sql.includes('UPDATE HL_users SET lastLoginAt')) {
      const [userId] = statement.params
      const user = this.users.find((row) => row.id === userId)

      if (user) {
        user.lastLoginAt = 'CURRENT_TIMESTAMP'
      }
    }

    if (statement.sql.includes('INSERT INTO HL_userProfiles')) {
      const hasExplicitId = /\(id,/.test(statement.sql)
      const userId = hasExplicitId ? statement.params[1] : statement.params[0]
      const sex = hasExplicitId ? statement.params[2] : statement.params[1]
      const birthDate = hasExplicitId ? statement.params[3] : statement.params[2]
      const heightCm = hasExplicitId ? statement.params[4] : statement.params[3]
      const timezone = hasExplicitId ? statement.params[5] : statement.params[4]
      const accessibilityMode = hasExplicitId ? statement.params[6] : statement.params[5]
      const theme = hasExplicitId ? statement.params[7] : statement.params[6]
      const aiConsent = hasExplicitId ? statement.params[8] : statement.params[7]
      const id = hasExplicitId ? statement.params[0] : ++this.lastInsertId
      this.profiles.push({
        id,
        userId,
        sex,
        birthDate,
        heightCm,
        timezone,
        accessibilityMode,
        theme,
        emergencyConsent: 0,
        aiConsent,
        dataShareConsent: 0
      })
    }

    if (statement.sql.includes('INSERT INTO HL_userConsents')) {
      const hasExplicitId = /\(id,/.test(statement.sql)
      const userId = hasExplicitId ? statement.params[1] : statement.params[0]
      const consentValue = hasExplicitId ? statement.params[2] : statement.params[1]
      const consentText = hasExplicitId ? statement.params[3] : statement.params[2]
      const id = hasExplicitId ? statement.params[0] : ++this.lastInsertId
      this.consents.push({
        id,
        userId,
        consentType: 'aiConsent',
        consentValue,
        consentText
      })
    }

    if (statement.sql.includes('UPDATE HL_users SET displayName')) {
      const [displayName, userId] = statement.params
      const user = this.users.find((row) => row.id === userId)

      if (user) {
        user.displayName = displayName
      }
    }

    if (statement.sql.includes('UPDATE HL_userProfiles')) {
      const profile = this.profiles.find((row) => row.userId === statement.params.at(-1))

      if (profile && statement.sql.includes('heightCm = ?')) {
        const [heightCm, timezone, theme, accessibilityMode] = statement.params
        profile.heightCm = heightCm
        profile.timezone = timezone
        profile.theme = theme
        profile.accessibilityMode = accessibilityMode
      } else if (profile) {
        const [theme, accessibilityMode] = statement.params
        profile.theme = theme
        profile.accessibilityMode = accessibilityMode
      }
    }

    if (statement.sql.includes('INSERT INTO HL_apiRateLimits')) {
      const hasExplicitId = /\(id,/.test(statement.sql)
      const rateKey = hasExplicitId ? statement.params[1] : statement.params[0]
      const routeKey = hasExplicitId ? statement.params[2] : statement.params[1]
      const windowStart = hasExplicitId ? statement.params[3] : statement.params[2]
      const id = hasExplicitId ? statement.params[0] : ++this.lastInsertId
      this.rateLimits.push({
        id,
        rateKey,
        routeKey,
        windowStart,
        requestCount: 1
      })
    }

    if (statement.sql.includes('UPDATE HL_apiRateLimits')) {
      const [id] = statement.params
      const rateLimit = this.rateLimits.find((row) => row.id === id)

      if (rateLimit) {
        rateLimit.requestCount += 1
      }
    }

    if (statement.sql.includes('UPDATE HL_sessions')) {
      const [sessionTokenHash] = statement.params
      const session = this.sessions.find(
        (row) => row.sessionTokenHash === sessionTokenHash && !row.revokedAt
      )

      if (session) {
        session.revokedAt = 'CURRENT_TIMESTAMP'
      }
    }
  }
}

function getCookieValue(response, name) {
  const cookie = response.headers.get('set-cookie') ?? ''
  const match = cookie.match(new RegExp(`${name}=([^;]+)`))
  return match?.[1] ?? ''
}

function assertSessionCookie(response) {
  const cookie = response.headers.get('set-cookie') ?? ''
  assert.match(cookie, /hlSession=/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Path=\//i)
  assert.match(cookie, /Max-Age=2592000/i)
}

function env(db = new D1Mock()) {
  return {
    DB: db,
    LOGS: {}
  }
}

test('normalizes email and validates register payload', () => {
  assert.equal(normalizeEmail(' USER@Example.COM '), 'user@example.com')

  const invalid = validateRegistrationInput({
    email: 'bad',
    password: 'weak',
    displayName: ''
  })

  assert.equal(invalid.ok, false)
  assert.equal(invalid.details.length, 3)
})

test('validates login payload and verifies stored password hash', async () => {
  const passwordHash = await hashPassword('StrongPass123')

  assert.equal(validateLoginInput({ email: 'user@example.com', password: 'x' }).ok, true)
  assert.equal(validateLoginInput({ email: 'user@example.com', password: '' }).ok, false)
  assert.equal(await verifyPassword('StrongPass123', passwordHash), true)
  assert.equal(await verifyPassword('WrongPass123', passwordHash), false)
  assert.equal(await verifyPassword('StrongPass123', 'bad-format'), false)
})

test('validates onboarding payload', () => {
  const valid = validateOnboardingInput({
    displayName: 'Budi',
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 170,
    timezone: 'Asia/Jakarta',
    theme: 'light',
    accessibilityMode: 'normal',
    aiConsent: true
  })
  const invalid = validateOnboardingInput({
    displayName: 'B',
    sex: 'bad',
    birthDate: '1990-02-30',
    heightCm: 20,
    timezone: 'Bad/Timezone'
  })

  assert.equal(valid.ok, true)
  assert.equal(invalid.ok, false)
  assert.ok(invalid.details.length >= 4)
})

test('validates profile and UI settings payloads', () => {
  const validProfile = validateProfileUpdateInput({
    heightCm: 171,
    timezone: 'Asia/Jakarta',
    theme: 'warm',
    accessibilityMode: 'senior'
  })
  const invalidProfile = validateProfileUpdateInput({
    heightCm: 500,
    timezone: 'Bad/Timezone',
    theme: 'purple',
    accessibilityMode: 'tiny'
  })
  const validUi = validateUiSettingsInput({
    theme: 'dark',
    accessibilityMode: 'normal'
  })
  const invalidUi = validateUiSettingsInput({
    theme: 'bad',
    accessibilityMode: 'bad'
  })

  assert.equal(validProfile.ok, true)
  assert.equal(invalidProfile.ok, false)
  assert.equal(invalidProfile.details.length, 4)
  assert.equal(validUi.ok, true)
  assert.equal(invalidUi.ok, false)
  assert.equal(invalidUi.details.length, 2)
})

test('POST /api/auth/register inserts user, session, and audit log', async () => {
  const db = new D1Mock()
  const response = await app.request(
    '/api/auth/register',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'node-test'
      },
      body: JSON.stringify({
        email: 'User@Example.COM',
        password: 'StrongPass123',
        displayName: 'Budi'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.success, true)
  assert.equal(body.data.user.email, 'user@example.com')
  assert.equal(body.data.user.displayName, 'Budi')
  assert.equal(body.data.requiresOnboarding, true)
  assertSessionCookie(response)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(db.users.length, 1)
  assert.notEqual(db.users[0].passwordHash, 'StrongPass123')
  assert.equal(db.sessions.length, 1)
  assert.equal(db.auditLogs.length, 1)
  assert.equal(db.auditLogs[0].action, 'userRegister')
})

test('POST /api/auth/register rejects duplicate email', async () => {
  const db = new D1Mock()
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: 'hash',
    displayName: 'Existing'
  })

  const response = await app.request(
    '/api/auth/register',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'USER@example.com',
        password: 'StrongPass123',
        displayName: 'Budi'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 409)
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'EMAIL_ALREADY_EXISTS')
  assert.equal(db.users.length, 1)
  assert.equal(db.sessions.length, 0)
  assert.equal(db.auditLogs.length, 0)
})

test('POST /api/auth/register returns envelope when duplicate check fails', async () => {
  const response = await app.request(
    '/api/auth/register',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'StrongPass123',
        displayName: 'Budi'
      })
    },
    env(new D1Mock({ failSelect: true }))
  )
  const body = await response.json()

  assert.equal(response.status, 500)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'INTERNAL_ERROR')
  assert.ok(body.meta.requestId)
})

test('POST /api/auth/login creates session and returns onboarding state', async () => {
  const db = new D1Mock()
  const passwordHash = await hashPassword('StrongPass123')
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash,
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 1,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })

  const response = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'USER@example.com',
        password: 'StrongPass123'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assertSessionCookie(response)
  assert.equal(body.success, true)
  assert.equal(body.data.user.email, 'user@example.com')
  assert.equal(body.data.user.browserPushEnabled, true)
  assert.equal(body.data.requiresOnboarding, true)
  assert.equal(db.sessions.length, 1)
  assert.equal(db.auditLogs[0].action, 'userLogin')
  assert.equal(db.users[0].lastLoginAt, 'CURRENT_TIMESTAMP')
  assert.equal(db.rateLimits.length, 1)
})

test('POST /api/auth/login rejects invalid credentials generically', async () => {
  const db = new D1Mock()
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })

  const response = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'WrongPass123'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 401)
  assert.equal(body.success, false)
  assert.equal(body.error.code, 'UNAUTHORIZED')
  assert.equal(db.sessions.length, 0)
  assert.equal(db.auditLogs.length, 0)
})

test('GET /api/auth/me returns session user from login cookie', async () => {
  const db = new D1Mock()
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 1,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })

  const loginResponse = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'StrongPass123'
      })
    },
    env(db)
  )
  const sessionToken = getCookieValue(loginResponse, 'hlSession')
  const response = await app.request(
    '/api/auth/me',
    {
      headers: {
        Cookie: `hlSession=${sessionToken}`
      }
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.user.email, 'user@example.com')
  assert.equal(body.data.user.telegramEnabled, true)
  assert.equal(body.data.requiresOnboarding, true)
})

test('POST /api/auth/login rate limits using HL_systemConfigs', async () => {
  const db = new D1Mock({ loginRateLimitMaxReq: '1', loginRateLimitWindowMin: '10' })
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })

  const payload = {
    email: 'user@example.com',
    password: 'WrongPass123'
  }

  await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    },
    env(db)
  )
  const response = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 429)
  assert.equal(body.error.code, 'RATE_LIMITED')
  assert.equal(db.rateLimits[0].requestCount, 1)
})

test('POST /api/auth/login revokes current cookie session before rotating', async () => {
  const db = new D1Mock()
  const oldToken = 'old-session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(oldToken),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })

  const response = await app.request(
    '/api/auth/login',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${oldToken}`
      },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'StrongPass123'
      })
    },
    env(db)
  )

  assert.equal(response.status, 200)
  assert.equal(db.sessions[0].revokedAt, 'CURRENT_TIMESTAMP')
  assert.equal(db.sessions.length, 2)
})

test('POST /api/profile/onboarding requires auth', async () => {
  const response = await app.request(
    '/api/profile/onboarding',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    },
    env(new D1Mock())
  )
  const body = await response.json()

  assert.equal(response.status, 401)
  assert.equal(body.error.code, 'UNAUTHORIZED')
})

test('POST /api/profile/onboarding validates age and height', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })

  const response = await app.request(
    '/api/profile/onboarding',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        displayName: 'B',
        sex: 'male',
        birthDate: '2999-01-01',
        heightCm: 20,
        timezone: 'Asia/Jakarta'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
  assert.equal(db.profiles.length, 0)
})

test('POST /api/profile/onboarding rejects duplicate onboarding', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 1,
    userId: 1,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 170,
    timezone: 'Asia/Jakarta',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0
  })

  const response = await app.request(
    '/api/profile/onboarding',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        displayName: 'Budi',
        sex: 'male',
        birthDate: '1990-01-01',
        heightCm: 170,
        timezone: 'Asia/Jakarta',
        theme: 'light',
        accessibilityMode: 'normal',
        aiConsent: true
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
  assert.equal(db.profiles.length, 1)
})

test('POST /api/profile/onboarding creates profile consent audit and updates display name', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi Lama',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })

  const response = await app.request(
    '/api/profile/onboarding',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        displayName: 'Budi Baru',
        sex: 'male',
        birthDate: '1990-01-01',
        heightCm: 170,
        timezone: 'Asia/Jakarta',
        theme: 'light',
        accessibilityMode: 'normal',
        aiConsent: true
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 201)
  assert.equal(body.success, true)
  assert.equal(body.data.completed, true)
  assert.equal(db.profiles.length, 1)
  assert.equal(db.profiles[0].userId, 1)
  assert.equal(db.profiles[0].aiConsent, 1)
  assert.equal(db.consents.length, 1)
  assert.equal(db.consents[0].consentType, 'aiConsent')
  assert.equal(db.users[0].displayName, 'Budi Baru')
  assert.equal(db.auditLogs.at(-1).action, 'profileOnboardingComplete')

  const sessionResponse = await app.request(
    '/api/auth/me',
    {
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    env(db)
  )
  const sessionBody = await sessionResponse.json()

  assert.equal(sessionResponse.status, 200)
  assert.equal(sessionBody.data.requiresOnboarding, false)
  assert.equal(sessionBody.data.profile.heightCm, 170)
})

test('GET /api/profile returns current authenticated profile', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 1,
    userId: 1,
    sex: 'female',
    birthDate: '1988-05-10',
    heightCm: 160,
    timezone: 'Asia/Jakarta',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0
  })

  const response = await app.request(
    '/api/profile',
    {
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.userId, 1)
  assert.equal(body.data.heightCm, 160)
  assert.equal(body.data.aiConsent, true)
})

test('PUT /api/profile updates profile settings and writes audit log', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 1,
    userId: 1,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 170,
    timezone: 'Asia/Jakarta',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0
  })

  const response = await app.request(
    '/api/profile',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        heightCm: 172,
        timezone: 'Asia/Bangkok',
        theme: 'warm',
        accessibilityMode: 'senior'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.data.updated, true)
  assert.equal(db.profiles[0].heightCm, 172)
  assert.equal(db.profiles[0].timezone, 'Asia/Bangkok')
  assert.equal(db.profiles[0].theme, 'warm')
  assert.equal(db.profiles[0].accessibilityMode, 'senior')
  assert.equal(db.auditLogs.at(-1).action, 'profileUpdate')
})

test('PUT /api/profile rejects invalid profile settings', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 1,
    userId: 1,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 170,
    timezone: 'Asia/Jakarta',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0
  })

  const response = await app.request(
    '/api/profile',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        heightCm: 30,
        timezone: 'Bad/Timezone',
        theme: 'bad',
        accessibilityMode: 'bad'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 400)
  assert.equal(body.error.code, 'VALIDATION_ERROR')
  assert.equal(db.profiles[0].heightCm, 170)
})

test('PUT /api/settings/ui updates theme and accessibility mode', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 1,
    userId: 1,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 170,
    timezone: 'Asia/Jakarta',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0
  })

  const response = await app.request(
    '/api/settings/ui',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        theme: 'dark',
        accessibilityMode: 'highContrast'
      })
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.data.updated, true)
  assert.equal(db.profiles[0].theme, 'dark')
  assert.equal(db.profiles[0].accessibilityMode, 'highContrast')
  assert.equal(db.auditLogs.at(-1).action, 'uiSettingsUpdate')
})

test('GET /api/metrics/catalog returns grouped active devices and metrics', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })

  const response = await app.request(
    '/api/metrics/catalog',
    {
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    env(db)
  )
  const body = await response.json()
  const oximeter = body.data.devices.find((device) => device.deviceCode === 'yuwellYx106')
  const bodyScale = body.data.devices.find((device) => device.deviceCode === 'bodyScale')
  const sinocare = body.data.devices.find((device) => device.deviceCode === 'sinocareM101')

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.devices.length, 6)
  assert.equal(oximeter.metrics.length, 2)
  assert.equal(oximeter.metrics[0].metricCode, 'spo2')
  assert.equal(oximeter.metrics[0].requiresAttachment, true)
  assert.equal(sinocare.metrics.length, 4)
  assert.equal(sinocare.metrics.every((metric) => metric.requiredMetric === false), true)
  assert.equal(bodyScale.metrics.some((metric) => metric.metricCode === 'bmi' && metric.isCalculated), true)
  assert.equal(body.data.metrics.some((metric) => metric.metricCode === 'bodyTemperature'), true)
  assert.equal(body.data.metrics.some((metric) => metric.metricCode === 'sleepDuration'), true)
})

test('GET /api/metrics/catalog requires auth', async () => {
  const response = await app.request('/api/metrics/catalog', {}, env(new D1Mock()))
  const body = await response.json()

  assert.equal(response.status, 401)
  assert.equal(body.error.code, 'UNAUTHORIZED')
})

test('GET /api/dashboard/today returns empty state for authenticated user', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 1,
    userId: 1,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 170,
    timezone: 'UTC',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0
  })

  const response = await app.request(
    '/api/dashboard/today',
    {
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.hasData, false)
  assert.equal(body.data.sessionCount, 0)
  assert.equal(body.data.metricCount, 0)
  assert.equal(body.data.streak, 0)
  assert.equal(body.data.aiInsight, null)
})

test('GET /api/dashboard/today reads values, streak, and AI insight from schema tables', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
  db.users.push({
    id: 1,
    email: 'user@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Budi',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 1,
    userId: 1,
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 170,
    timezone: 'UTC',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0
  })
  db.measurementSessions.push({
    id: 10,
    profileId: 1,
    userId: 1,
    measuredAt: `${today}T08:00:00.000Z`,
    source: 'manual',
    hasAi: 0,
    hasAttachment: 0,
    hasEmergency: 1
  })
  db.measurementValues.push({
    id: 11,
    sessionId: 10,
    userId: 1,
    metricCode: 'systolic',
    finalValue: 145,
    unit: 'mmHg',
    status: 'Hipertensi Tahap 2',
    severity: 'high',
    manualOverride: 1,
    createdAt: `${today}T08:00:01.000Z`
  })
  db.alerts.push({
    id: 12,
    userId: 1,
    metricCode: 'systolic',
    finalValue: 145,
    unit: 'mmHg',
    severity: 'high',
    message: 'Tekanan sistolik tinggi.',
    createdAt: `${today}T08:00:02.000Z`
  })
  db.streaks.push({
    userId: 1,
    streakType: 'dailyMeasurement',
    currentCount: 4,
    bestCount: 9
  })
  db.aiRecommendations.push({
    userId: 1,
    summaryText: 'Berdasarkan data tercatat, lanjutkan pemantauan tekanan darah.',
    createdAt: `${today}T08:00:03.000Z`
  })

  const response = await app.request(
    '/api/dashboard/today',
    {
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.hasData, true)
  assert.equal(body.data.sessionCount, 1)
  assert.equal(body.data.metricCount, 1)
  assert.equal(body.data.emergencyCount, 1)
  assert.equal(body.data.streak, 4)
  assert.equal(body.data.bestStreak, 9)
  assert.equal(body.data.aiInsight, 'Berdasarkan data tercatat, lanjutkan pemantauan tekanan darah.')
  assert.equal(body.data.values[0].metricCode, 'systolic')
  assert.equal(body.data.alerts[0].message, 'Tekanan sistolik tinggi.')
})

test('admin system config supports create update delete and masks sensitive audit values', async () => {
  const db = new D1Mock()
  const token = 'admin-session-token'
  db.users.push({
    id: 2,
    email: 'admin@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Admin',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 2,
    userId: 2,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })

  const adminEnv = { ...env(db), ADMIN_EMAILS: 'admin@example.com' }

  const createResponse = await app.request(
    '/api/admin/configs',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        configKey: 'featureDoctorExportEnabled',
        configValue: 'true',
        dataType: 'boolean',
        description: 'Enable doctor export'
      })
    },
    adminEnv
  )
  const createBody = await createResponse.json()

  assert.equal(createResponse.status, 201)
  assert.equal(createBody.data.created, true)
  assert.equal(db.systemConfigs.featureDoctorExportEnabled, 'true')
  assert.equal(db.auditLogs.at(-1).action, 'configCreate')

  const updateResponse = await app.request(
    '/api/admin/configs/telegramBotToken',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `hlSession=${token}`
      },
      body: JSON.stringify({
        configValue: 'super-secret-token'
      })
    },
    adminEnv
  )
  const updateBody = await updateResponse.json()

  assert.equal(updateResponse.status, 200)
  assert.equal(updateBody.data.updated, true)
  assert.equal(db.systemConfigs.telegramBotToken, 'super-secret-token')
  const updateAudit = db.auditLogs.length > 0 ? db.auditLogs[db.auditLogs.length - 1] : null
  assert.ok(updateAudit, 'audit log should exist after config update')
  assert.equal(updateAudit.action, 'configUpdate')
  assert.equal(updateAudit.metadataJson.includes('super-secret-token'), false)
  assert.equal(JSON.parse(updateAudit.metadataJson).sensitive, true)

  const protectedDeleteResponse = await app.request(
    '/api/admin/configs/telegramBotToken',
    {
      method: 'DELETE',
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    adminEnv
  )
  const protectedDeleteBody = await protectedDeleteResponse.json()

  assert.equal(protectedDeleteResponse.status, 400)
  assert.equal(protectedDeleteBody.error.code, 'VALIDATION_ERROR')

  const deleteResponse = await app.request(
    '/api/admin/configs/featureDoctorExportEnabled',
    {
      method: 'DELETE',
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    adminEnv
  )
  const deleteBody = await deleteResponse.json()

  assert.equal(deleteResponse.status, 200)
  assert.equal(deleteBody.data.deleted, true)
  assert.equal(db.systemConfigs.featureDoctorExportEnabled, undefined)
  assert.equal(db.auditLogs.at(-1).action, 'configDelete')
})

test('GET /api/measurements/last returns data as array (no double-wrap)', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1, email: 'u@e.com', passwordHash: 'x', displayName: 'U',
    telegramEnabled: 0, browserPushEnabled: 0, active: 1, authProvider: 'local', lastLoginAt: null
  })
  db.sessions.push({
    id: 1, userId: 1, sessionTokenHash: await sha256Token(token),
    userAgent: null, expiresAt: new Date(Date.now() + 60000).toISOString(), revokedAt: null
  })
  const res = await app.request(
    '/api/measurements/last',
    { headers: { Cookie: `hlSession=${token}` } },
    env(db)
  )
  const body = await res.json()
  assert.equal(res.status, 200)
  assert.ok(Array.isArray(body.data), 'body.data must be an array (not {data: []})')
  assert.equal(body.data.length, 0)
})

test('GET /api/measurements/today returns sessions with deviceCodes (Asia/Jakarta timezone)', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 1, email: 'u@e.com', passwordHash: 'x', displayName: 'U',
    telegramEnabled: 0, browserPushEnabled: 0, active: 1, authProvider: 'local', lastLoginAt: null
  })
  db.sessions.push({
    id: 1, userId: 1, sessionTokenHash: await sha256Token(token),
    userAgent: null, expiresAt: new Date(Date.now() + 60000).toISOString(), revokedAt: null
  })
  db.profiles.push({
    id: 1, userId: 1, sex: 'male', birthDate: '1990-01-01', heightCm: 170,
    timezone: 'Asia/Jakarta', accessibilityMode: 'normal', theme: 'light',
    emergencyConsent: 0, aiConsent: 1, dataShareConsent: 0
  })
  // No sessions yet
  const emptyRes = await app.request(
    '/api/measurements/today',
    { headers: { Cookie: `hlSession=${token}` } },
    env(db)
  )
  const emptyBody = await emptyRes.json()
  assert.equal(emptyRes.status, 200)
  assert.ok(Array.isArray(emptyBody.data.sessions))
  assert.equal(emptyBody.data.sessions.length, 0)
  assert.equal(emptyBody.data.date.length, 10, 'date is YYYY-MM-DD format')
})
