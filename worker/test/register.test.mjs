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
    if (this.sql.includes('SELECT configValue FROM HL_systemConfigs')) {
      const configKey = this.params[0]
      const configValue = this.db.systemConfigs[configKey]
      return configValue ? { configValue } : null
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

    return null
  }

  async run() {
    this.db.apply(this)
    return { success: true }
  }

  async all() {
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
    this.users = []
    this.sessions = []
    this.auditLogs = []
    this.profiles = []
    this.consents = []
    this.rateLimits = []
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
      loginRateLimitWindowMin: options.loginRateLimitWindowMin ?? '10'
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
      const [id, email, passwordHash, displayName] = statement.params

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
      const [id, userId, sessionTokenHash, userAgent, expiresAt] = statement.params
      this.sessions.push({ id, userId, sessionTokenHash, userAgent, expiresAt, revokedAt: null })
    }

    if (statement.sql.includes('INSERT INTO HL_auditLogs')) {
      const [id, userId, entityId, metadataJson] = statement.params
      let action = 'userRegister'

      if (statement.sql.includes('userLogin')) {
        action = 'userLogin'
      }

      if (statement.sql.includes('profileOnboardingComplete')) {
        action = 'profileOnboardingComplete'
      }

      if (statement.sql.includes('profileUpdate')) {
        action = 'profileUpdate'
      }

      if (statement.sql.includes('uiSettingsUpdate')) {
        action = 'uiSettingsUpdate'
      }

      this.auditLogs.push({ id, userId, action, entityId, metadataJson })
    }

    if (statement.sql.includes('UPDATE HL_users SET lastLoginAt')) {
      const [userId] = statement.params
      const user = this.users.find((row) => row.id === userId)

      if (user) {
        user.lastLoginAt = 'CURRENT_TIMESTAMP'
      }
    }

    if (statement.sql.includes('INSERT INTO HL_userProfiles')) {
      const [
        id,
        userId,
        sex,
        birthDate,
        heightCm,
        timezone,
        accessibilityMode,
        theme,
        aiConsent
      ] = statement.params
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
      const [id, userId, consentValue, consentText] = statement.params
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
      const [id, rateKey, routeKey, windowStart] = statement.params
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
    id: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'sess_old',
    userId: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 'prf_existing',
    userId: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
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
  assert.equal(db.profiles[0].userId, 'usr_existing')
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
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 'prf_existing',
    userId: 'usr_existing',
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
  assert.equal(body.data.userId, 'usr_existing')
  assert.equal(body.data.heightCm, 160)
  assert.equal(body.data.aiConsent, true)
})

test('PUT /api/profile updates profile settings and writes audit log', async () => {
  const db = new D1Mock()
  const token = 'session-token'
  db.users.push({
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 'prf_existing',
    userId: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 'prf_existing',
    userId: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 'prf_existing',
    userId: 'usr_existing',
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
    id: 'usr_existing',
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
    id: 'sess_existing',
    userId: 'usr_existing',
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
