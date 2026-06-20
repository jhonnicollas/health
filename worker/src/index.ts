import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'

export interface Env {
  DB: D1Database
  LOGS: R2Bucket
}

const app = new Hono<{ Bindings: Env }>()

type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

type ApiStatus = 200 | 201 | 400 | 401 | 404 | 409 | 429 | 500

type RegisterInput = {
  email?: unknown
  password?: unknown
  displayName?: unknown
}

type LoginInput = {
  email?: unknown
  password?: unknown
}

type OnboardingInput = {
  displayName?: unknown
  sex?: unknown
  birthDate?: unknown
  heightCm?: unknown
  timezone?: unknown
  theme?: unknown
  accessibilityMode?: unknown
  aiConsent?: unknown
}

type ProfileUpdateInput = {
  heightCm?: unknown
  timezone?: unknown
  theme?: unknown
  accessibilityMode?: unknown
}

type UiSettingsInput = {
  theme?: unknown
  accessibilityMode?: unknown
}

type UserRow = {
  id: string
  email: string
  passwordHash: string | null
  displayName: string
  telegramEnabled: number
  browserPushEnabled: number
  active: number
}

type ProfileRow = {
  id: string
  userId?: string
  sex: string
  birthDate: string
  heightCm: number
  timezone: string
  accessibilityMode: string
  theme: string
  emergencyConsent: number
  aiConsent: number
  dataShareConsent: number
}

type MetricCatalogRow = {
  deviceCode: string
  deviceName: string
  deviceType: string
  brand: string
  model: string
  deviceSortOrder: number
  metricCode: string
  metricName: string
  category: string
  unit: string
  inputType: string
  requiresAttachment: number
  requiresSex: number
  requiresFasting: number
  isCalculated: number
  requiredMetric: number
  physicalMin: number | null
  physicalMax: number | null
  metricSortOrder: number
}

type MetricCatalogMetric = {
  metricCode: string
  metricName: string
  category: string
  unit: string
  inputType: string
  requiresAttachment: boolean
  requiresSex: boolean
  requiresFasting: boolean
  isCalculated: boolean
  requiredMetric: boolean
  physicalMin: number | null
  physicalMax: number | null
}

type RateLimitConfig = {
  maxRequests: number
  windowMinutes: number
}

const SESSION_DAYS = 30
const PASSWORD_HASH_ITERATIONS = 310000
const MIN_ONBOARDING_AGE_YEARS = 13

const textEncoder = new TextEncoder()

function jsonMeta(startedAt: number) {
  return {
    requestId: crypto.randomUUID(),
    durationMs: Date.now() - startedAt
  }
}

function success(data: unknown, status: ApiStatus = 200, startedAt = Date.now()) {
  return {
    body: {
      success: true,
      data,
      meta: jsonMeta(startedAt)
    },
    status
  }
}

function failure(
  code: ApiErrorCode,
  message: string,
  status: ApiStatus = 400,
  details: unknown[] = [],
  startedAt = Date.now()
) {
  return {
    body: {
      success: false,
      error: {
        code,
        message,
        details
      },
      meta: jsonMeta(startedAt)
    },
    status
  }
}

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''

  for (const byte of byteArray) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function validateRegistrationInput(input: RegisterInput) {
  const details: Array<{ field: string; message: string }> = []
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const displayName =
    typeof input.displayName === 'string' ? input.displayName.trim() : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.push({
      field: 'email',
      message: 'Email wajib valid.'
    })
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    details.push({
      field: 'password',
      message: 'Password minimal 8 karakter dan berisi huruf besar, huruf kecil, dan angka.'
    })
  }

  if (displayName.length < 2) {
    details.push({
      field: 'displayName',
      message: 'Nama tampilan minimal 2 karakter.'
    })
  }

  if (details.length > 0) {
    return {
      ok: false as const,
      details
    }
  }

  return {
    ok: true as const,
    data: {
      email,
      password,
      displayName
    }
  }
}

function validateLoginInput(input: LoginInput) {
  const details: Array<{ field: string; message: string }> = []
  const email = typeof input.email === 'string' ? normalizeEmail(input.email) : ''
  const password = typeof input.password === 'string' ? input.password : ''

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    details.push({
      field: 'email',
      message: 'Email wajib valid.'
    })
  }

  if (!password) {
    details.push({
      field: 'password',
      message: 'Password wajib diisi.'
    })
  }

  if (details.length > 0) {
    return {
      ok: false as const,
      details
    }
  }

  return {
    ok: true as const,
    data: {
      email,
      password
    }
  }
}

function validateOnboardingInput(input: OnboardingInput) {
  const details: Array<{ field: string; message: string }> = []
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : ''
  const sex = typeof input.sex === 'string' ? input.sex : ''
  const birthDate = typeof input.birthDate === 'string' ? input.birthDate : ''
  const heightCm = typeof input.heightCm === 'number' ? input.heightCm : Number(input.heightCm)
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : ''
  const theme = typeof input.theme === 'string' ? input.theme : 'light'
  const accessibilityMode =
    typeof input.accessibilityMode === 'string' ? input.accessibilityMode : 'normal'
  const aiConsent = Boolean(input.aiConsent)

  if (displayName.length < 2) {
    details.push({ field: 'displayName', message: 'Nama tampilan minimal 2 karakter.' })
  }

  if (!['male', 'female', 'other'].includes(sex)) {
    details.push({ field: 'sex', message: 'Jenis kelamin wajib dipilih.' })
  }

  const birthDateMatches = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const parsedBirthDate = new Date(`${birthDate}T00:00:00Z`)
  const ageMs = Date.now() - parsedBirthDate.getTime()
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000)
  const isRoundTripDate =
    birthDateMatches !== null &&
    parsedBirthDate.toISOString().slice(0, 10) === birthDate

  if (
    !birthDate ||
    Number.isNaN(parsedBirthDate.getTime()) ||
    !isRoundTripDate ||
    parsedBirthDate.getTime() > Date.now()
  ) {
    details.push({ field: 'birthDate', message: 'Tanggal lahir wajib valid dan tidak boleh di masa depan.' })
  } else if (ageYears < MIN_ONBOARDING_AGE_YEARS) {
    details.push({ field: 'birthDate', message: `Usia minimal ${MIN_ONBOARDING_AGE_YEARS} tahun.` })
  }

  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) {
    details.push({ field: 'heightCm', message: 'Tinggi badan harus antara 50 dan 250 cm.' })
  }

  if (!timezone || timezone.length > 80) {
    details.push({ field: 'timezone', message: 'Timezone wajib diisi.' })
  } else {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    } catch {
      details.push({ field: 'timezone', message: 'Timezone wajib valid.' })
    }
  }

  if (!['light', 'warm', 'dark', 'highContrast'].includes(theme)) {
    details.push({ field: 'theme', message: 'Tema tidak valid.' })
  }

  if (!['normal', 'senior', 'highContrast'].includes(accessibilityMode)) {
    details.push({ field: 'accessibilityMode', message: 'Mode aksesibilitas tidak valid.' })
  }

  if (details.length > 0) {
    return {
      ok: false as const,
      details
    }
  }

  return {
    ok: true as const,
    data: {
      displayName,
      sex,
      birthDate,
      heightCm,
      timezone,
      theme,
      accessibilityMode,
      aiConsent
    }
  }
}

function validateProfileUpdateInput(input: ProfileUpdateInput) {
  const details: Array<{ field: string; message: string }> = []
  const heightCm = typeof input.heightCm === 'number' ? input.heightCm : Number(input.heightCm)
  const timezone = typeof input.timezone === 'string' ? input.timezone.trim() : ''
  const theme = typeof input.theme === 'string' ? input.theme : undefined
  const accessibilityMode =
    typeof input.accessibilityMode === 'string' ? input.accessibilityMode : undefined

  if (!Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) {
    details.push({ field: 'heightCm', message: 'Tinggi badan harus antara 50 dan 250 cm.' })
  }

  if (!timezone || timezone.length > 80) {
    details.push({ field: 'timezone', message: 'Timezone wajib diisi.' })
  } else {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    } catch {
      details.push({ field: 'timezone', message: 'Timezone wajib valid.' })
    }
  }

  if (theme !== undefined && !['light', 'warm', 'dark', 'highContrast'].includes(theme)) {
    details.push({ field: 'theme', message: 'Tema tidak valid.' })
  }

  if (
    accessibilityMode !== undefined &&
    !['normal', 'senior', 'highContrast'].includes(accessibilityMode)
  ) {
    details.push({ field: 'accessibilityMode', message: 'Mode aksesibilitas tidak valid.' })
  }

  if (details.length > 0) {
    return {
      ok: false as const,
      details
    }
  }

  return {
    ok: true as const,
    data: {
      heightCm,
      timezone,
      theme,
      accessibilityMode
    }
  }
}

function validateUiSettingsInput(input: UiSettingsInput) {
  const details: Array<{ field: string; message: string }> = []
  const theme = typeof input.theme === 'string' ? input.theme : ''
  const accessibilityMode =
    typeof input.accessibilityMode === 'string' ? input.accessibilityMode : ''

  if (!['light', 'warm', 'dark', 'highContrast'].includes(theme)) {
    details.push({ field: 'theme', message: 'Tema tidak valid.' })
  }

  if (!['normal', 'senior', 'highContrast'].includes(accessibilityMode)) {
    details.push({ field: 'accessibilityMode', message: 'Mode aksesibilitas tidak valid.' })
  }

  if (details.length > 0) {
    return {
      ok: false as const,
      details
    }
  }

  return {
    ok: true as const,
    data: {
      theme,
      accessibilityMode
    }
  }
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: PASSWORD_HASH_ITERATIONS
    },
    key,
    256
  )

  return `pbkdf2-sha256:${PASSWORD_HASH_ITERATIONS}:${base64Url(salt)}:${base64Url(bits)}`
}

async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false
  }

  const [algorithm, iterationsText, saltText, expectedHash] = storedHash.split(':')
  const iterations = Number(iterationsText)

  if (
    algorithm !== 'pbkdf2-sha256' ||
    !Number.isInteger(iterations) ||
    iterations <= 0 ||
    !saltText ||
    !expectedHash
  ) {
    return false
  }

  try {
    const salt = base64UrlDecode(saltText)
    const key = await crypto.subtle.importKey(
      'raw',
      textEncoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt,
        iterations
      },
      key,
      256
    )

    return timingSafeEqual(base64Url(bits), expectedHash)
  } catch {
    return false
  }
}

async function sha256Token(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(value))
  return `sha256:${base64Url(digest)}`
}

function generateToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false
  }

  let diff = 0

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return diff === 0
}

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function isUniqueEmailError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return message.toLowerCase().includes('unique') && message.includes('HL_users.email')
}

function jsonResponse(
  c: Context<{ Bindings: Env }>,
  result: ReturnType<typeof success> | ReturnType<typeof failure>
) {
  c.header('Cache-Control', 'no-store')
  return c.json(result.body, result.status)
}

async function getSystemConfigNumber(c: Context<{ Bindings: Env }>, configKey: string) {
  const row = await c.env.DB.prepare(
    'SELECT configValue FROM HL_systemConfigs WHERE configKey = ? LIMIT 1'
  )
    .bind(configKey)
    .first<{ configValue: string }>()
  const value = Number(row?.configValue)

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid numeric system config: ${configKey}`)
  }

  return value
}

async function getLoginRateLimitConfig(c: Context<{ Bindings: Env }>): Promise<RateLimitConfig> {
  const [maxRequests, windowMinutes] = await Promise.all([
    getSystemConfigNumber(c, 'loginRateLimitMaxReq'),
    getSystemConfigNumber(c, 'loginRateLimitWindowMin')
  ])

  return {
    maxRequests,
    windowMinutes
  }
}

async function enforceLoginRateLimit(
  c: Context<{ Bindings: Env }>,
  email: string,
  startedAt: number
) {
  const config = await getLoginRateLimitConfig(c)
  const windowMs = config.windowMinutes * 60 * 1000
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString()
  const rateKey = await sha256Token(`login:${email}`)
  const routeKey = 'authLogin'
  const existing = await c.env.DB.prepare(
    `SELECT id, requestCount
     FROM HL_apiRateLimits
     WHERE rateKey = ? AND routeKey = ? AND windowStart = ?
     LIMIT 1`
  )
    .bind(rateKey, routeKey, windowStart)
    .first<{ id: string; requestCount: number }>()

  if (existing && existing.requestCount >= config.maxRequests) {
    const result = failure(
      'RATE_LIMITED',
      'Terlalu banyak percobaan login. Coba lagi nanti.',
      429,
      [],
      startedAt
    )

    return {
      limited: true as const,
      response: jsonResponse(c, result)
    }
  }

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE HL_apiRateLimits
       SET requestCount = requestCount + 1, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
      .bind(existing.id)
      .run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO HL_apiRateLimits
        (id, rateKey, routeKey, windowStart, requestCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(createId('rate'), rateKey, routeKey, windowStart)
      .run()
  }

  return {
    limited: false as const
  }
}

function publicUser(user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'telegramEnabled' | 'browserPushEnabled'>) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    telegramEnabled: Boolean(user.telegramEnabled),
    browserPushEnabled: Boolean(user.browserPushEnabled)
  }
}

function publicProfile(profile: ProfileRow | null) {
  if (!profile) {
    return null
  }

  return {
    id: profile.id,
    sex: profile.sex,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm,
    timezone: profile.timezone,
    accessibilityMode: profile.accessibilityMode,
    theme: profile.theme,
    emergencyConsent: Boolean(profile.emergencyConsent),
    aiConsent: Boolean(profile.aiConsent),
    dataShareConsent: Boolean(profile.dataShareConsent)
  }
}

function metricCatalogResponse(rows: MetricCatalogRow[]) {
  const devices = new Map<
    string,
    {
      deviceCode: string
      deviceName: string
      deviceType: string
      brand: string
      model: string
      metrics: MetricCatalogMetric[]
    }
  >()
  const metrics = new Map<string, MetricCatalogMetric>()

  for (const row of rows) {
    if (!devices.has(row.deviceCode)) {
      devices.set(row.deviceCode, {
        deviceCode: row.deviceCode,
        deviceName: row.deviceName,
        deviceType: row.deviceType,
        brand: row.brand,
        model: row.model,
        metrics: []
      })
    }

    const metric = {
      metricCode: row.metricCode,
      metricName: row.metricName,
      category: row.category,
      unit: row.unit,
      inputType: row.inputType,
      requiresAttachment: Boolean(row.requiresAttachment),
      requiresSex: Boolean(row.requiresSex),
      requiresFasting: Boolean(row.requiresFasting),
      isCalculated: Boolean(row.isCalculated),
      requiredMetric: Boolean(row.requiredMetric),
      physicalMin: row.physicalMin,
      physicalMax: row.physicalMax
    }

    devices.get(row.deviceCode)?.metrics.push(metric)

    if (!metrics.has(row.metricCode)) {
      metrics.set(row.metricCode, metric)
    }
  }

  return {
    devices: Array.from(devices.values()),
    metrics: Array.from(metrics.values())
  }
}

async function createSession(c: Context<{ Bindings: Env }>, userId: string) {
  const sessionId = createId('sess')
  const sessionToken = generateToken()
  const sessionTokenHash = await sha256Token(sessionToken)
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const userAgent = c.req.header('User-Agent') ?? null

  return {
    sessionId,
    sessionToken,
    sessionTokenHash,
    expiresAt,
    userAgent,
    statement: c.env.DB.prepare(
      `INSERT INTO HL_sessions
        (id, userId, sessionTokenHash, userAgent, ipHash, expiresAt, createdAt)
      VALUES (?, ?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)`
    ).bind(sessionId, userId, sessionTokenHash, userAgent, expiresAt)
  }
}

async function revokeCurrentSession(c: Context<{ Bindings: Env }>) {
  const sessionToken = getCookie(c, 'hlSession')

  if (!sessionToken) {
    return null
  }

  const sessionTokenHash = await sha256Token(sessionToken)

  return c.env.DB.prepare(
    `UPDATE HL_sessions
     SET revokedAt = CURRENT_TIMESTAMP
     WHERE sessionTokenHash = ? AND revokedAt IS NULL`
  ).bind(sessionTokenHash)
}

async function getAuthenticatedUser(c: Context<{ Bindings: Env }>) {
  const sessionToken = getCookie(c, 'hlSession')

  if (!sessionToken) {
    return null
  }

  const sessionTokenHash = await sha256Token(sessionToken)

  return c.env.DB.prepare(
    `SELECT u.id, u.email, u.passwordHash, u.displayName, u.telegramEnabled, u.browserPushEnabled, u.active
     FROM HL_sessions s
     JOIN HL_users u ON u.id = s.userId
     WHERE s.sessionTokenHash = ?
      AND s.revokedAt IS NULL
      AND s.expiresAt > CURRENT_TIMESTAMP
      AND u.active = 1
     LIMIT 1`
  )
    .bind(sessionTokenHash)
    .first<UserRow>()
}

app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'HL Health Companion API is running'
  })
})

app.post('/api/auth/register', async (c) => {
  const startedAt = Date.now()
  let payload: RegisterInput

  try {
    payload = await c.req.json<RegisterInput>()
  } catch {
    const result = failure(
      'VALIDATION_ERROR',
      'Body JSON tidak valid.',
      400,
      [{ field: 'body', message: 'Body harus berupa JSON.' }],
      startedAt
    )

    return jsonResponse(c, result)
  }

  const validation = validateRegistrationInput(payload)

  if (!validation.ok) {
    const result = failure(
      'VALIDATION_ERROR',
      'Input registrasi tidak valid.',
      400,
      validation.details,
      startedAt
    )

    return jsonResponse(c, result)
  }

  let existing: { id: string } | null

  try {
    existing = await c.env.DB.prepare('SELECT id FROM HL_users WHERE email = ? LIMIT 1')
      .bind(validation.data.email)
      .first<{ id: string }>()
  } catch (error) {
    console.error('register duplicate check failed', error)

    const result = failure(
      'INTERNAL_ERROR',
      'Registrasi gagal diproses.',
      500,
      [],
      startedAt
    )

    return jsonResponse(c, result)
  }

  if (existing) {
    const result = failure(
      'EMAIL_ALREADY_EXISTS',
      'Email sudah terdaftar.',
      409,
      [{ field: 'email', message: 'Gunakan email lain atau login.' }],
      startedAt
    )

    return jsonResponse(c, result)
  }

  const userId = createId('usr')
  const auditId = createId('aud')
  let sessionToken = ''

  try {
    const passwordHash = await hashPassword(validation.data.password)
    const session = await createSession(c, userId)
    sessionToken = session.sessionToken

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO HL_users
          (id, email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, createdAt, updatedAt)
        VALUES (?, ?, ?, 'local', ?, 0, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, validation.data.email, passwordHash, validation.data.displayName),
      session.statement,
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (id, userId, action, entityType, entityId, metadataJson, createdAt)
        VALUES (?, ?, 'userRegister', 'HL_users', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        auditId,
        userId,
        userId,
        JSON.stringify({
          email: validation.data.email,
          authProvider: 'local'
        })
      )
    ])
  } catch (error) {
    if (isUniqueEmailError(error)) {
      const result = failure(
        'EMAIL_ALREADY_EXISTS',
        'Email sudah terdaftar.',
        409,
        [{ field: 'email', message: 'Gunakan email lain atau login.' }],
        startedAt
      )

      return jsonResponse(c, result)
    }

    console.error('register failed', error)

    const result = failure(
      'INTERNAL_ERROR',
      'Registrasi gagal diproses.',
      500,
      [],
      startedAt
    )

    return jsonResponse(c, result)
  }

  setCookie(c, 'hlSession', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60
  })

  const result = success(
    {
      user: {
        id: userId,
        email: validation.data.email,
        displayName: validation.data.displayName,
        telegramEnabled: false,
        browserPushEnabled: false
      },
      requiresOnboarding: true
    },
    201,
    startedAt
  )

  return jsonResponse(c, result)
})

app.post('/api/auth/login', async (c) => {
  const startedAt = Date.now()
  let payload: LoginInput

  try {
    payload = await c.req.json<LoginInput>()
  } catch {
    const result = failure(
      'VALIDATION_ERROR',
      'Body JSON tidak valid.',
      400,
      [{ field: 'body', message: 'Body harus berupa JSON.' }],
      startedAt
    )

    return jsonResponse(c, result)
  }

  const validation = validateLoginInput(payload)

  if (!validation.ok) {
    const result = failure(
      'VALIDATION_ERROR',
      'Input login tidak valid.',
      400,
      validation.details,
      startedAt
    )

    return jsonResponse(c, result)
  }

  try {
    const rateLimit = await enforceLoginRateLimit(c, validation.data.email, startedAt)

    if (rateLimit.limited) {
      return rateLimit.response
    }
  } catch (error) {
    console.error('login rate limit failed', error)

    const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [], startedAt)
    return jsonResponse(c, result)
  }

  let user: UserRow | null

  try {
    user = await c.env.DB.prepare(
      `SELECT id, email, passwordHash, displayName, telegramEnabled, browserPushEnabled, active
       FROM HL_users
       WHERE email = ? AND authProvider = 'local'
       LIMIT 1`
    )
      .bind(validation.data.email)
      .first<UserRow>()
  } catch (error) {
    console.error('login user lookup failed', error)

    const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [], startedAt)
    return jsonResponse(c, result)
  }

  const passwordMatches = await verifyPassword(validation.data.password, user?.passwordHash ?? null)

  if (!user || user.active !== 1 || !passwordMatches) {
    const result = failure(
      'UNAUTHORIZED',
      'Email atau password salah.',
      401,
      [],
      startedAt
    )

    return jsonResponse(c, result)
  }

  let profile: ProfileRow | null
  let sessionToken = ''
  const auditId = createId('aud')

  try {
    const session = await createSession(c, user.id)
    const revokeCurrentSessionStatement = await revokeCurrentSession(c)
    sessionToken = session.sessionToken
    profile = await c.env.DB.prepare(
      `SELECT id, sex, birthDate, heightCm, timezone, accessibilityMode, theme,
        emergencyConsent, aiConsent, dataShareConsent
       FROM HL_userProfiles
       WHERE userId = ?
       LIMIT 1`
    )
      .bind(user.id)
      .first<ProfileRow>()

    const statements = [
      ...(revokeCurrentSessionStatement ? [revokeCurrentSessionStatement] : []),
      session.statement,
      c.env.DB.prepare('UPDATE HL_users SET lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(user.id),
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (id, userId, action, entityType, entityId, metadataJson, createdAt)
        VALUES (?, ?, 'userLogin', 'HL_users', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        auditId,
        user.id,
        user.id,
        JSON.stringify({
          email: user.email,
          authProvider: 'local'
        })
      )
    ]

    await c.env.DB.batch(statements)
  } catch (error) {
    console.error('login session create failed', error)

    const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [], startedAt)
    return jsonResponse(c, result)
  }

  setCookie(c, 'hlSession', sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60
  })

  const result = success(
    {
      user: publicUser(user),
      profile: publicProfile(profile),
      requiresOnboarding: !profile
    },
    200,
    startedAt
  )

  return jsonResponse(c, result)
})

app.get('/api/auth/me', async (c) => {
  const startedAt = Date.now()
  const sessionToken = getCookie(c, 'hlSession')

  if (!sessionToken) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [], startedAt)
    return jsonResponse(c, result)
  }

  const sessionTokenHash = await sha256Token(sessionToken)

  try {
    const row = await c.env.DB.prepare(
      `SELECT
        u.id, u.email, u.displayName, u.telegramEnabled, u.browserPushEnabled,
        p.id AS profileId, p.sex, p.birthDate, p.heightCm, p.timezone,
        p.accessibilityMode, p.theme, p.emergencyConsent, p.aiConsent, p.dataShareConsent
       FROM HL_sessions s
       JOIN HL_users u ON u.id = s.userId
       LEFT JOIN HL_userProfiles p ON p.userId = u.id
       WHERE s.sessionTokenHash = ?
        AND s.revokedAt IS NULL
        AND s.expiresAt > CURRENT_TIMESTAMP
        AND u.active = 1
       LIMIT 1`
    )
      .bind(sessionTokenHash)
      .first<
        UserRow & {
          profileId: string | null
          sex: string | null
          birthDate: string | null
          heightCm: number | null
          timezone: string | null
          accessibilityMode: string | null
          theme: string | null
          emergencyConsent: number | null
          aiConsent: number | null
          dataShareConsent: number | null
        }
      >()

    if (!row) {
      const result = failure('UNAUTHORIZED', 'User belum login.', 401, [], startedAt)
      return jsonResponse(c, result)
    }

    const profile = row.profileId
      ? {
          id: row.profileId,
          sex: row.sex ?? 'other',
          birthDate: row.birthDate ?? '',
          heightCm: row.heightCm ?? 0,
          timezone: row.timezone ?? 'Asia/Jakarta',
          accessibilityMode: row.accessibilityMode ?? 'normal',
          theme: row.theme ?? 'light',
          emergencyConsent: row.emergencyConsent ?? 0,
          aiConsent: row.aiConsent ?? 0,
          dataShareConsent: row.dataShareConsent ?? 0
        }
      : null

    const result = success(
      {
        user: publicUser(row),
        profile: publicProfile(profile),
        requiresOnboarding: !profile
      },
      200,
      startedAt
    )

    return jsonResponse(c, result)
  } catch (error) {
    console.error('me lookup failed', error)

    const result = failure('INTERNAL_ERROR', 'Session gagal diproses.', 500, [], startedAt)
    return jsonResponse(c, result)
  }
})

app.post('/api/profile/onboarding', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [], startedAt)
    return jsonResponse(c, result)
  }

  let payload: OnboardingInput

  try {
    payload = await c.req.json<OnboardingInput>()
  } catch {
    const result = failure(
      'VALIDATION_ERROR',
      'Body JSON tidak valid.',
      400,
      [{ field: 'body', message: 'Body harus berupa JSON.' }],
      startedAt
    )

    return jsonResponse(c, result)
  }

  const validation = validateOnboardingInput(payload)

  if (!validation.ok) {
    const result = failure(
      'VALIDATION_ERROR',
      'Input onboarding tidak valid.',
      400,
      validation.details,
      startedAt
    )

    return jsonResponse(c, result)
  }

  try {
    const existingProfile = await c.env.DB.prepare(
      'SELECT id FROM HL_userProfiles WHERE userId = ? LIMIT 1'
    )
      .bind(user.id)
      .first<{ id: string }>()

    if (existingProfile) {
      const result = failure(
        'VALIDATION_ERROR',
        'Onboarding sudah selesai.',
        400,
        [{ field: 'profile', message: 'Profil kesehatan sudah dibuat.' }],
        startedAt
      )

      return jsonResponse(c, result)
    }

    const profileId = createId('prf')
    const aiConsentId = createId('cns')
    const auditId = createId('aud')

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO HL_userProfiles
          (id, userId, sex, birthDate, heightCm, timezone, accessibilityMode, theme,
           emergencyConsent, aiConsent, dataShareConsent, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        profileId,
        user.id,
        validation.data.sex,
        validation.data.birthDate,
        validation.data.heightCm,
        validation.data.timezone,
        validation.data.accessibilityMode,
        validation.data.theme,
        validation.data.aiConsent ? 1 : 0
      ),
      c.env.DB.prepare(
        `INSERT INTO HL_userConsents
          (id, userId, consentType, consentValue, consentText, version, createdAt, updatedAt)
         VALUES (?, ?, 'aiConsent', ?, ?, '2026-06-20', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        aiConsentId,
        user.id,
        validation.data.aiConsent ? 1 : 0,
        'User consent for AI-assisted extraction and safe summaries.'
      ),
      c.env.DB.prepare(
        'UPDATE HL_users SET displayName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(validation.data.displayName, user.id),
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (id, userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, ?, 'profileOnboardingComplete', 'HL_userProfiles', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        auditId,
        user.id,
        profileId,
        JSON.stringify({
          displayNameChanged: validation.data.displayName !== user.displayName,
          aiConsent: validation.data.aiConsent,
          timezone: validation.data.timezone
        })
      )
    ])

    const result = success(
      {
        profileId,
        completed: true
      },
      201,
      startedAt
    )

    return jsonResponse(c, result)
  } catch (error) {
    console.error('onboarding failed', error)

    const result = failure('INTERNAL_ERROR', 'Onboarding gagal diproses.', 500, [], startedAt)
    return jsonResponse(c, result)
  }
})

app.get('/api/profile', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [], startedAt)
    return jsonResponse(c, result)
  }

  try {
    const profile = await c.env.DB.prepare(
      `SELECT id, userId, sex, birthDate, heightCm, timezone, accessibilityMode, theme,
        emergencyConsent, aiConsent, dataShareConsent
       FROM HL_userProfiles
       WHERE userId = ?
       LIMIT 1`
    )
      .bind(user.id)
      .first<ProfileRow>()

    if (!profile) {
      const result = failure('NOT_FOUND', 'Profil kesehatan belum dibuat.', 404, [], startedAt)
      return jsonResponse(c, result)
    }

    const result = success(
      {
        ...publicProfile(profile),
        userId: profile.userId ?? user.id
      },
      200,
      startedAt
    )

    return jsonResponse(c, result)
  } catch (error) {
    console.error('profile lookup failed', error)

    const result = failure('INTERNAL_ERROR', 'Profil gagal diproses.', 500, [], startedAt)
    return jsonResponse(c, result)
  }
})

app.put('/api/profile', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [], startedAt)
    return jsonResponse(c, result)
  }

  let payload: ProfileUpdateInput

  try {
    payload = await c.req.json<ProfileUpdateInput>()
  } catch {
    const result = failure(
      'VALIDATION_ERROR',
      'Body JSON tidak valid.',
      400,
      [{ field: 'body', message: 'Body harus berupa JSON.' }],
      startedAt
    )

    return jsonResponse(c, result)
  }

  const validation = validateProfileUpdateInput(payload)

  if (!validation.ok) {
    const result = failure(
      'VALIDATION_ERROR',
      'Input profil tidak valid.',
      400,
      validation.details,
      startedAt
    )

    return jsonResponse(c, result)
  }

  try {
    const existingProfile = await c.env.DB.prepare(
      `SELECT id, userId, sex, birthDate, heightCm, timezone, accessibilityMode, theme,
        emergencyConsent, aiConsent, dataShareConsent
       FROM HL_userProfiles
       WHERE userId = ?
       LIMIT 1`
    )
      .bind(user.id)
      .first<ProfileRow>()

    if (!existingProfile) {
      const result = failure('NOT_FOUND', 'Profil kesehatan belum dibuat.', 404, [], startedAt)
      return jsonResponse(c, result)
    }

    const nextTheme = validation.data.theme ?? existingProfile.theme
    const nextAccessibilityMode =
      validation.data.accessibilityMode ?? existingProfile.accessibilityMode
    const auditId = createId('aud')

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE HL_userProfiles
         SET heightCm = ?, timezone = ?, theme = ?, accessibilityMode = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE userId = ?`
      ).bind(
        validation.data.heightCm,
        validation.data.timezone,
        nextTheme,
        nextAccessibilityMode,
        user.id
      ),
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (id, userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, ?, 'profileUpdate', 'HL_userProfiles', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        auditId,
        user.id,
        existingProfile.id,
        JSON.stringify({
          changedFields: ['heightCm', 'timezone', 'theme', 'accessibilityMode'].filter((field) => {
            if (field === 'heightCm') {
              return validation.data.heightCm !== existingProfile.heightCm
            }
            if (field === 'timezone') {
              return validation.data.timezone !== existingProfile.timezone
            }
            if (field === 'theme') {
              return nextTheme !== existingProfile.theme
            }
            return nextAccessibilityMode !== existingProfile.accessibilityMode
          })
        })
      )
    ])

    const result = success(
      {
        updated: true
      },
      200,
      startedAt
    )

    return jsonResponse(c, result)
  } catch (error) {
    console.error('profile update failed', error)

    const result = failure('INTERNAL_ERROR', 'Profil gagal diperbarui.', 500, [], startedAt)
    return jsonResponse(c, result)
  }
})

app.put('/api/settings/ui', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [], startedAt)
    return jsonResponse(c, result)
  }

  let payload: UiSettingsInput

  try {
    payload = await c.req.json<UiSettingsInput>()
  } catch {
    const result = failure(
      'VALIDATION_ERROR',
      'Body JSON tidak valid.',
      400,
      [{ field: 'body', message: 'Body harus berupa JSON.' }],
      startedAt
    )

    return jsonResponse(c, result)
  }

  const validation = validateUiSettingsInput(payload)

  if (!validation.ok) {
    const result = failure(
      'VALIDATION_ERROR',
      'Input tampilan tidak valid.',
      400,
      validation.details,
      startedAt
    )

    return jsonResponse(c, result)
  }

  try {
    const existingProfile = await c.env.DB.prepare(
      'SELECT id, theme, accessibilityMode FROM HL_userProfiles WHERE userId = ? LIMIT 1'
    )
      .bind(user.id)
      .first<Pick<ProfileRow, 'id' | 'theme' | 'accessibilityMode'>>()

    if (!existingProfile) {
      const result = failure('NOT_FOUND', 'Profil kesehatan belum dibuat.', 404, [], startedAt)
      return jsonResponse(c, result)
    }

    const auditId = createId('aud')

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE HL_userProfiles
         SET theme = ?, accessibilityMode = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE userId = ?`
      ).bind(validation.data.theme, validation.data.accessibilityMode, user.id),
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (id, userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, ?, 'uiSettingsUpdate', 'HL_userProfiles', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        auditId,
        user.id,
        existingProfile.id,
        JSON.stringify({
          changedFields: ['theme', 'accessibilityMode'].filter((field) =>
            field === 'theme'
              ? validation.data.theme !== existingProfile.theme
              : validation.data.accessibilityMode !== existingProfile.accessibilityMode
          )
        })
      )
    ])

    const result = success(
      {
        updated: true
      },
      200,
      startedAt
    )

    return jsonResponse(c, result)
  } catch (error) {
    console.error('ui settings update failed', error)

    const result = failure('INTERNAL_ERROR', 'Pengaturan tampilan gagal diperbarui.', 500, [], startedAt)
    return jsonResponse(c, result)
  }
})

app.get('/api/metrics/catalog', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [], startedAt)
    return jsonResponse(c, result)
  }

  const activeOnly = c.req.query('active') !== 'false'

  try {
    const rows = await c.env.DB.prepare(
      `SELECT
        d.deviceCode,
        d.deviceName,
        d.deviceType,
        d.brand,
        d.model,
        0 AS deviceSortOrder,
        m.metricCode,
        m.metricName,
        m.category,
        m.unit,
        m.inputType,
        m.requiresAttachment,
        m.requiresSex,
        m.requiresFasting,
        m.isCalculated,
        dm.requiredMetric,
        m.physicalMin,
        m.physicalMax,
        COALESCE(dm.sortOrder, m.sortOrder) AS metricSortOrder
       FROM HL_devices d
       JOIN HL_deviceMetrics dm ON dm.deviceCode = d.deviceCode
       JOIN HL_metricCatalog m ON m.metricCode = dm.metricCode
       WHERE (? = 0 OR (d.active = 1 AND dm.active = 1 AND m.active = 1))
       ORDER BY d.deviceType, d.deviceName, metricSortOrder, m.sortOrder`
    )
      .bind(activeOnly ? 1 : 0)
      .all<MetricCatalogRow>()

    const result = success(metricCatalogResponse(rows.results ?? []), 200, startedAt)

    return jsonResponse(c, result)
  } catch (error) {
    console.error('metric catalog lookup failed', error)

    const result = failure('INTERNAL_ERROR', 'Katalog metrik gagal diproses.', 500, [], startedAt)
    return jsonResponse(c, result)
  }
})

export {
  app,
  hashPassword,
  normalizeEmail,
  sha256Token,
  validateLoginInput,
  validateOnboardingInput,
  validateProfileUpdateInput,
  validateRegistrationInput,
  validateUiSettingsInput,
  verifyPassword,
  metricCatalogResponse
}

export default app
