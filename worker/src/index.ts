import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import {
  mountExtraRoutes,
  scheduledHandler,
  updateDailyStreak,
  awardBadges,
  createEmergencyAlert,
  sendEmergencyToContacts,
  type ExtraEnv
} from './routes-extra'

export interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  TELEGRAM_BOT_TOKEN?: string
  ADMIN_EMAILS?: string
  DB: D1Database
  LOGS: R2Bucket
  TELEGRAM_QUEUE?: Queue
}

const app = new Hono<{ Bindings: Env }>()

type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

type ApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500

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
const PASSWORD_HASH_ITERATIONS = 100000
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
  const parsedTime = parsedBirthDate.getTime()
  const ageMs = Date.now() - parsedTime
  const ageYears = ageMs / (365.25 * 24 * 60 * 60 * 1000)
  const isRoundTripDate =
    birthDateMatches !== null &&
    !Number.isNaN(parsedTime) &&
    parsedBirthDate.toISOString().slice(0, 10) === birthDate

  if (
    !birthDate ||
    Number.isNaN(parsedTime) ||
    !isRoundTripDate ||
    parsedTime > Date.now()
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

const SYSTEM_CONFIG_TTL_MS = 60_000
const systemConfigCache: Map<string, { value: string; expiresAt: number }> = new Map()

function readSystemConfigCache(configKey: string): string | null {
  const entry = systemConfigCache.get(configKey)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    systemConfigCache.delete(configKey)
    return null
  }
  return entry.value
}

function writeSystemConfigCache(configKey: string, value: string) {
  systemConfigCache.set(configKey, { value, expiresAt: Date.now() + SYSTEM_CONFIG_TTL_MS })
}

function invalidateSystemConfigCache(configKey?: string) {
  if (configKey) {
    systemConfigCache.delete(configKey)
    return
  }
  systemConfigCache.clear()
}

async function getSystemConfigNumber(c: Context<{ Bindings: Env }>, configKey: string) {
  const cached = readSystemConfigCache(configKey)
  if (cached !== null) {
    const value = Number(cached)
    if (Number.isFinite(value) && value > 0) return value
  }
  const row = await c.env.DB.prepare(
    'SELECT configValue FROM HL_systemConfigs WHERE configKey = ? LIMIT 1'
  )
    .bind(configKey)
    .first<{ configValue: string }>()
  const value = Number(row?.configValue)

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid numeric system config: ${configKey}`)
  }

  if (row?.configValue !== undefined) {
    writeSystemConfigCache(configKey, row.configValue)
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

    const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [])
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

    const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [])
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

    const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [])
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
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [])
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
      const result = failure('UNAUTHORIZED', 'User belum login.', 401, [])
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

    const result = failure('INTERNAL_ERROR', 'Session gagal diproses.', 500, [])
    return jsonResponse(c, result)
  }
})

app.post('/api/profile/onboarding', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [])
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

    const result = failure('INTERNAL_ERROR', 'Onboarding gagal diproses.', 500, [])
    return jsonResponse(c, result)
  }
})

app.get('/api/profile', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [])
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
      const result = failure('NOT_FOUND', 'Profil kesehatan belum dibuat.', 404, [])
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

    const result = failure('INTERNAL_ERROR', 'Profil gagal diproses.', 500, [])
    return jsonResponse(c, result)
  }
})

app.put('/api/profile', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [])
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
      const result = failure('NOT_FOUND', 'Profil kesehatan belum dibuat.', 404, [])
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

    const result = failure('INTERNAL_ERROR', 'Profil gagal diperbarui.', 500, [])
    return jsonResponse(c, result)
  }
})

app.put('/api/settings/ui', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [])
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
      const result = failure('NOT_FOUND', 'Profil kesehatan belum dibuat.', 404, [])
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

    const result = failure('INTERNAL_ERROR', 'Pengaturan tampilan gagal diperbarui.', 500, [])
    return jsonResponse(c, result)
  }
})

app.get('/api/metrics/catalog', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)

  if (!user) {
    const result = failure('UNAUTHORIZED', 'User belum login.', 401, [])
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

    const result = success(metricCatalogResponse(rows.results ?? []), 200)

    return jsonResponse(c, result)
  } catch (error) {
    console.error('metric catalog lookup failed', error)

    const result = failure('INTERNAL_ERROR', 'Katalog metrik gagal diproses.', 500, [])
    return jsonResponse(c, result)
  }
})

app.post('/api/auth/logout', async (c) => {
  const startedAt = Date.now()
  try {
    const revokeCurrentSessionStatement = await revokeCurrentSession(c)
    if (revokeCurrentSessionStatement) {
      await revokeCurrentSessionStatement.run()
    }
  } catch (error) {
    console.error('logout failed', error)
  }

  setCookie(c, 'hlSession', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 0
  })

  return jsonResponse(c, success({ loggedOut: true }, 200))
})


// Validate Measurements Endpoint
type ValidateInput = {
  metrics?: unknown
  profileId?: unknown
}

const PHYSICAL_RANGES: Record<string, { min: number; max: number; unit: string }> = {
  spo2: { min: 50, max: 100, unit: '%' },
  heartRate: { min: 30, max: 220, unit: 'bpm' },
  systolic: { min: 50, max: 250, unit: 'mmHg' },
  diastolic: { min: 30, max: 180, unit: 'mmHg' },
  bloodPressurePulse: { min: 30, max: 220, unit: 'bpm' },
  glucoseFasting: { min: 20, max: 600, unit: 'mg/dL' },
  glucosePostMeal: { min: 20, max: 600, unit: 'mg/dL' },
  cholesterolTotal: { min: 50, max: 500, unit: 'mg/dL' },
  uricAcid: { min: 1, max: 20, unit: 'mg/dL' },
  bodyWeight: { min: 10, max: 400, unit: 'kg' },
  bmi: { min: 10, max: 80, unit: 'kg/m2' },
  waistCircumference: { min: 30, max: 250, unit: 'cm' },
  bodyTemperature: { min: 30, max: 45, unit: 'C' },
  sleepDuration: { min: 0, max: 24, unit: 'hours' },
  height: { min: 50, max: 250, unit: 'cm' }
}

app.post('/api/measurements/validate', async (c) => {
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
    const userId = (sessionQuery as { userId: string }).userId

    const body = await c.req.json() as ValidateInput
    if (!body.metrics || !Array.isArray(body.metrics)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'metrics harus array.', 400, [], startedAt))
    }

    const errors: Array<{ field: string; message: string; code: string }> = []
    let systolicValue: number | null = null
    let diastolicValue: number | null = null

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

    void userId
    return jsonResponse(c, success({ valid: errors.length === 0, errors }, 200, startedAt))
  } catch (error) {
    console.error('validate endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Validasi gagal diproses.', 500, [], startedAt))
  }
})


// Submit Measurement Session Endpoint
type SubmitMetricValue = {
  metricCode: string
  deviceCode?: string | null
  rawAiValue?: number | null
  finalValue: number
  unit: string
  confidence?: number | null
  manualOverride: number
}

type SubmitInput = {
  profileId?: string
  measuredAt?: string
  source?: 'photo' | 'upload' | 'manual' | 'mixed'
  notes?: string
  values: SubmitMetricValue[]
  attachments?: Array<{
    metricCode: string
    r2Key: string
    width: number
    height: number
    sizeBytes: number
  }>
}

type RuleEvaluation = {
  status: string
  severity: string
  emergencyLevel: string
  popupTitle: string | null
  popupMessage: string | null
  recommendation: string | null
  ruleId: string | null
}

async function getCurrentSession(c: Context<{ Bindings: Env }>) {
  const sessionToken = getCookie(c, 'hlSession')
  if (!sessionToken) return null
  const sessionTokenHash = await sha256Token(sessionToken)
  const row = await c.env.DB.prepare(
    'SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND expiresAt > datetime("now") AND revokedAt IS NULL'
  ).bind(sessionTokenHash).first<{ userId: string }>()
  return row?.userId || null
}

async function evaluateRule(
  c: Context<{ Bindings: Env }>,
  metricCode: string,
  value: number,
  sex: string,
  ageYears: number
): Promise<RuleEvaluation> {
  const fallbackResult: RuleEvaluation = {
    status: 'Belum Ada Interpretasi',
    severity: 'info',
    emergencyLevel: 'none',
    popupTitle: 'Belum Ada Interpretasi',
    popupMessage: 'Belum ada rule yang cocok untuk nilai ini. Nilai tetap tersimpan dan dapat dikonsultasikan dengan dokter.',
    recommendation: 'Pantau nilai dan konsultasikan dengan dokter untuk interpretasi lebih lanjut.',
    ruleId: null
  }
  let rule: any = null
  try {
    const result = await c.env.DB.prepare(
    `SELECT id, status, severity, emergencyLevel, popupTitle, popupMessage, recommendation
     FROM HL_metricRules
     WHERE metricCode = ?
       AND active = 1
       AND (sex = 'all' OR sex = ?)
       AND ageMin <= ? AND ageMax >= ?
       AND minValue <= ? AND maxValue >= ?
     ORDER BY rulePriority ASC, id ASC
     LIMIT 1`
  ).bind(metricCode, sex, ageYears, ageYears, value, value).first<{
    id: string
    status: string
    severity: string
    emergencyLevel: string
    popupTitle: string
    popupMessage: string
    recommendation: string
  }>()
    rule = result
  } catch (error) {
    console.error('rule evaluation failed', error)
    return fallbackResult
  }

  if (!rule) return fallbackResult
  return {
    status: rule.status,
    severity: rule.severity,
    emergencyLevel: rule.emergencyLevel,
    popupTitle: rule.popupTitle,
    popupMessage: rule.popupMessage,
    recommendation: rule.recommendation,
    ruleId: rule.id
  }
}

function calculateAgeYears(birthDate: string): number {
  const birth = new Date(birthDate)
  if (isNaN(birth.getTime())) return 30
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--
  }
  return Math.max(0, age)
}


async function sendTelegramNotification(
  c: Context<{ Bindings: Env }>,
  userId: string,
  notificationType: string,
  title: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const link = await c.env.DB.prepare(
      'SELECT telegramChatId, verified, enabled FROM HL_telegramLinks WHERE userId = ? AND verified = 1 AND enabled = 1'
    ).bind(userId).first<{ telegramChatId: string; verified: number; enabled: number }>()

    if (!link?.telegramChatId) {
      return { sent: false, error: 'telegram_not_linked' }
    }

    const settings = await c.env.DB.prepare(
      'SELECT telegramSubmitSummary, telegramEmergencyAlert FROM HL_notificationSettings WHERE userId = ?'
    ).bind(userId).first<{ telegramSubmitSummary: number; telegramEmergencyAlert: number }>()

    if (notificationType === 'submit_summary' && settings && settings.telegramSubmitSummary === 0) {
      return { sent: false, error: 'disabled_by_user' }
    }
    if (notificationType === 'emergency_alert' && settings && settings.telegramEmergencyAlert === 0) {
      return { sent: false, error: 'disabled_by_user' }
    }

    const botToken = c.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return { sent: false, error: 'bot_token_not_configured' }
    }

    const text = `${title}\n\n${message}`
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: link.telegramChatId,
        text,
        parse_mode: 'HTML'
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { sent: false, error: errorText.slice(0, 200) }
    }

    return { sent: true }
  } catch (error) {
    console.error('telegram send error:', error)
    return { sent: false, error: error instanceof Error ? error.message : 'unknown' }
  }
}

async function logNotification(
  c: Context<{ Bindings: Env }>,
  userId: string,
  channel: string,
  notificationType: string,
  title: string,
  message: string,
  status: 'pending' | 'sent' | 'failed' | 'skipped',
  payload: Record<string, unknown>,
  errorMessage?: string
): Promise<void> {
  try {
    await c.env.DB.prepare(
      `INSERT INTO HL_notifications
       (id, userId, channel, notificationType, title, message, status, payloadJson, errorMessage, sentAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${status === 'sent' ? 'CURRENT_TIMESTAMP' : 'NULL'}, CURRENT_TIMESTAMP)`
    ).bind(
      crypto.randomUUID(),
      userId,
      channel,
      notificationType,
      title,
      message,
      status,
      JSON.stringify(payload),
      errorMessage || null
    ).run()
  } catch (error) {
    console.error('logNotification failed:', error)
  }
}

app.post('/api/measurements/submit', async (c) => {
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
    ).bind(profileId, userId).first<{ id: string; userId: string; sex: string; birthDate: string; heightCm: number | null }>()

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

    const sessionId = crypto.randomUUID()
    const hasAi = body.values.some(v => v.rawAiValue !== null && v.rawAiValue !== undefined) ? 1 : 0
    const hasAttachment = body.attachments && body.attachments.length > 0 ? 1 : 0

    await c.env.DB.prepare(
      `INSERT INTO HL_measurementSessions
       (id, userId, profileId, measuredAt, source, notes, hasAi, hasAttachment, hasEmergency, submittedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      sessionId,
      userId,
      profileId,
      measuredAt,
      body.source || 'manual',
      body.notes || null,
      hasAi,
      hasAttachment
    ).run()

    const savedValues: Array<{ id: string; metricCode: string; status: string; severity: string; ruleId: string | null; finalValue: number; unit: string }> = []
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
      const valueId = crypto.randomUUID()
      const manualOverride = v.manualOverride ? 1 : 0

      await c.env.DB.prepare(
        `INSERT INTO HL_measurementValues
         (id, sessionId, userId, metricCode, deviceCode, rawAiValue, finalValue, unit, confidence, manualOverride, status, severity, emergencyLevel, ruleId, measuredAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        valueId,
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
      ).run()

      if (rule.emergencyLevel === 'emergency' || rule.severity === 'emergency') {
        hasEmergency = 1
        const alertId = crypto.randomUUID()
        await c.env.DB.prepare(
          `INSERT INTO HL_alerts
           (id, userId, sessionId, metricCode, finalValue, unit, status, severity, alertType, message, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'rule', ?, CURRENT_TIMESTAMP)`
        ).bind(
          alertId,
          userId,
          sessionId,
          v.metricCode,
          v.finalValue,
          v.unit,
          rule.status,
          rule.severity,
          rule.popupMessage || 'Nilai darurat terdeteksi.'
        ).run()
      }

      savedValues.push({
        id: valueId,
        metricCode: v.metricCode,
        status: rule.status,
        severity: rule.severity,
        ruleId: rule.ruleId,
        finalValue: v.finalValue,
        unit: v.unit
      })
    }

    if (hasAttachment && body.attachments) {
      for (const att of body.attachments) {
        const attId = crypto.randomUUID()
        await c.env.DB.prepare(
          `INSERT INTO HL_measurementAttachments
           (id, sessionId, userId, metricCode, r2Key, fileName, fileType, fileSize, watermarked, compressed, compressionQuality, imageWidth, imageHeight, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, 'image/webp', ?, 1, 1, 50, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(
          attId,
          sessionId,
          userId,
          att.metricCode,
          att.r2Key,
          `${att.metricCode}-${attId}.webp`,
          att.sizeBytes,
          att.width,
          att.height
        ).run()
      }
    }

    if (hasEmergency) {
      await c.env.DB.prepare(
        'UPDATE HL_measurementSessions SET hasEmergency = 1 WHERE id = ?'
      ).bind(sessionId).run()
    }

    if (missingRules.length > 0) {
      await c.env.DB.prepare(
        `INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, ?, 'missingRule', 'HL_measurementSessions', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        crypto.randomUUID(),
        userId,
        sessionId,
        JSON.stringify({ missing: missingRules })
      ).run()
    }

    await c.env.DB.prepare(
      `INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt)
       VALUES (?, ?, 'measurementSubmit', 'HL_measurementSessions', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      crypto.randomUUID(),
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
      : `${body.values.length} nilai tersimpan.\n${lines}`
    // US-3.3.1 + US-4.3.1 + US-4.3.2: create HL_alerts for emergency severity, update daily streak, award badges.
    try {
      const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ timezone: string }>()
      const tz = profileInfo?.timezone || 'UTC'
      for (const v of savedValues) {
        if (v.severity === 'emergency' || v.severity === 'critical') {
          await createEmergencyAlert(c as any, userId, sessionId, v.metricCode, v.finalValue, v.unit, v.severity, `Nilai ${v.metricCode} ${v.finalValue} ${v.unit} masuk kategori darurat.`)
        }
      }
      const streak = await updateDailyStreak(c as any, userId, tz)
      const badges = await awardBadges(c as any, userId, streak.currentCount)
      // attach to response later
      ;(globalThis as any).__hlStreak = streak
      ;(globalThis as any).__hlBadges = badges
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

    const streakData = (globalThis as any).__hlStreak
    const badgesData = (globalThis as any).__hlBadges
    ;(globalThis as any).__hlStreak = undefined
    ;(globalThis as any).__hlBadges = undefined
    return jsonResponse(c, success({
      sessionId,
      values: savedValues,
      hasEmergency: hasEmergency === 1,
      streak: streakData,
      badges: badgesData
    }, 201, startedAt))
  } catch (error) {
    console.error('submit endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Submit gagal diproses.', 500, [], startedAt))
  }
})


// Upload Final Attachment to R2 Endpoint
app.post('/api/measurements/attachments/upload', async (c) => {
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
    ).bind(sessionId).first<{ userId: string }>()

    if (!sessionRow || sessionRow.userId !== userId) {
      return jsonResponse(c, failure('NOT_FOUND', 'Sesi tidak ditemukan.', 404, [], startedAt))
    }

    const maxUploadSize = await getSystemConfigNumber(c, 'maxUploadSizeBytes').catch(() => 2 * 1024 * 1024)
    if (file.size > maxUploadSize) {
      return jsonResponse(c, failure('VALIDATION_ERROR', `File terlalu besar. Maks ${Math.round(maxUploadSize / 1024 / 1024)}MB.`, 400, [], startedAt))
    }

    const attachmentId = crypto.randomUUID()
    const r2Key = `HL/users/${userId}/measurements/${sessionId}/${metricCode}-${attachmentId}.webp`

    const arrayBuffer = await file.arrayBuffer()
    await c.env.LOGS.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'image/webp'
      }
    })

    const width = parseInt((formData.width as string) || '0', 10) || null
    const height = parseInt((formData.height as string) || '0', 10) || null

    await c.env.DB.prepare(
      `INSERT INTO HL_measurementAttachments
       (id, sessionId, userId, metricCode, r2Key, fileName, fileType, fileSize, watermarked, compressed, compressionQuality, imageWidth, imageHeight)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 50, ?, ?)`
    ).bind(
      attachmentId,
      sessionId,
      userId,
      metricCode,
      r2Key,
      fileName,
      file.type || 'image/webp',
      file.size,
      width,
      height
    ).run()

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


// Dashboard Today Endpoint
app.get('/api/dashboard/today', async (c) => {
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

    const sessions = await c.env.DB.prepare(
      `SELECT id, profileId, measuredAt, source, hasAi, hasAttachment, hasEmergency
       FROM HL_measurementSessions
       WHERE userId = ? AND substr(measuredAt, 1, 10) = ?
       ORDER BY measuredAt DESC`
    ).bind(userId, today).all<{
      id: string
      profileId: string
      measuredAt: string
      source: string
      hasAi: number
      hasAttachment: number
      hasEmergency: number
    }>()

    const sessionIds = (sessions.results || []).map(s => s.id)
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

    const alerts = await c.env.DB.prepare(
      `SELECT id, metricCode, finalValue, unit, severity, message, createdAt
       FROM HL_alerts
       WHERE userId = ? AND substr(createdAt, 1, 10) = ?
       ORDER BY createdAt DESC`
    ).bind(userId, today).all()

    const metricCount = new Set(values.map(v => v.metricCode)).size
    const emergencyCount = (sessions.results || []).filter(s => s.hasEmergency === 1).length

    return jsonResponse(c, success({
      date: today,
      metricCount,
      sessionCount: (sessions.results || []).length,
      emergencyCount,
      hasData: (sessions.results || []).length > 0,
      sessions: sessions.results || [],
      values,
      alerts: alerts.results || []
    }, 200, startedAt))
  } catch (error) {
    console.error('dashboard today error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Dashboard gagal dimuat.', 500, [], startedAt))
  }
})

// AI Recommendation Endpoint
const FORBIDDEN_PHRASES = [
  'diagnosa', 'diagnosis', 'anda menderita', 'anda pasti', 'pasti sakit',
  'resep obat', 'dosis', 'mg per hari', 'minum obat', 'berhenti minum',
  'anda harus operasi', 'anda terjangkit', 'penyakit anda', 'anda divonis',
  'you have', 'you are diagnosed', 'prescription', 'take this medication',
  'stop taking', 'increase dose', 'decrease dose'
]

function filterUnsafeContent(text: string): { safe: boolean; filtered: string } {
  const lower = text.toLowerCase()
  for (const phrase of FORBIDDEN_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        safe: false,
        filtered: 'Rekomendasi tidak dapat ditampilkan karena mengandung istilah yang tidak aman.'
      }
    }
  }
  return { safe: true, filtered: text }
}

async function getRecentValues(c: Context<{ Bindings: Env }>, userId: string, days: number) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await c.env.DB.prepare(
    `SELECT metricCode, finalValue, unit, status, severity, measuredAt
     FROM HL_measurementValues
     WHERE userId = ? AND measuredAt >= ?
     ORDER BY measuredAt DESC
     LIMIT 200`
  ).bind(userId, since).all<{
    metricCode: string
    finalValue: number
    unit: string
    status: string
    severity: string
    measuredAt: string
  }>()
  return rows.results || []
}

app.post('/api/ai/recommendation', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) {
      return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    }
    const body = await c.req.json() as { sessionId?: string }
    const sessionId = body?.sessionId

    const todayValues = sessionId
      ? await c.env.DB.prepare(
          'SELECT metricCode, finalValue, unit, status, severity FROM HL_measurementValues WHERE sessionId = ?'
        ).bind(sessionId).all<{ metricCode: string; finalValue: number; unit: string; status: string; severity: string }>()
      : { results: [] as any[] }

    const last3Days = await getRecentValues(c, userId, 3)
    const last7Days = await getRecentValues(c, userId, 7)

    const summary = {
      today: (todayValues.results || []).map(v => `${v.metricCode}=${v.finalValue}${v.unit} (${v.status})`),
      last3DaysCount: last3Days.length,
      last7DaysCount: last7Days.length
    }

    const prompt = `Anda adalah asisten kesehatan yang aman. Berikan rekomendasi gaya hidup umum berdasarkan data berikut. JANGAN mendiagnosa penyakit, JANGAN meresepkan obat, JANGAN mengubah dosis obat. Hanya berikan edukasi gaya hidup umum seperti pola makan, hidrasi, istirahat, dan aktivitas ringan.

Data: ${JSON.stringify(summary)}

Berikan rekomendasi singkat 2-3 kalimat dalam Bahasa Indonesia.`

    let recommendationText = 'Rekomendasi tidak tersedia saat ini. Jaga pola makan seimbang, istirahat cukup, dan hidrasi yang baik.'
    let safetyStatus: 'safe' | 'filtered' | 'fallback' = 'fallback'

    if (c.env.CLOUDFLARE_ACCOUNT_ID && c.env.CLOUDFLARE_API_TOKEN) {
      try {
        const aiRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-2-7b-chat-int8`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt, max_tokens: 300 })
          }
        )
        if (aiRes.ok) {
          const aiData = await aiRes.json() as any
          const raw = aiData?.result?.response || ''
          const filtered = filterUnsafeContent(raw)
          if (filtered.safe) {
            recommendationText = filtered.filtered
            safetyStatus = 'safe'
          } else {
            recommendationText = filtered.filtered
            safetyStatus = 'filtered'
          }
        }
      } catch (err) {
        console.error('AI recommendation error:', err)
      }
    }

    const recId = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO HL_aiRecommendations
       (id, userId, sessionId, summaryText, todayJson, threeDayJson, sevenDayJson, ruleStatusJson, modelName, durationMs, safetyStatus, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      recId,
      userId,
      sessionId || null,
      recommendationText,
      JSON.stringify(summary.today),
      JSON.stringify(last3Days),
      JSON.stringify(last7Days),
      JSON.stringify((todayValues.results || []).map(v => ({ metric: v.metricCode, status: v.status, severity: v.severity }))),
      '@cf/meta/llama-2-7b-chat-int8',
      Date.now() - startedAt,
      safetyStatus
    ).run()

    // US-2.3.2/3: Append data availability messages
    const has3Day = last3Days.length >= 3
    const has7Day = last7Days.length >= 7
    const dataMessages: string[] = []
    if (!has3Day) dataMessages.push('Belum cukup data 3 hari untuk perbandingan.')
    if (!has7Day) dataMessages.push('Belum cukup data 7 hari untuk perbandingan.')

    return jsonResponse(c, success({
      recommendationId: recId,
      recommendation: recommendationText,
      safetyStatus,
      has3DayComparison: has3Day,
      has7DayComparison: has7Day,
      dataMessages,
      summary
    }, 200, startedAt))
  } catch (error) {
    console.error('AI recommendation endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Rekomendasi AI gagal.', 500, [], startedAt))
  }
})

app.get('/api/dashboard/weekly', async (c) => {
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

    return jsonResponse(c, success({
      period: '7d',
      metrics: rows.results || [],
      daily: dailyRows.results || []
    }, 200, startedAt))
  } catch (error) {
    console.error('weekly dashboard error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat data mingguan.', 500, [], startedAt))
  }
})

app.get('/api/dashboard/monthly', async (c) => {
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

    return jsonResponse(c, success({
      period: '30d',
      metrics: rows.results || []
    }, 200, startedAt))
  } catch (error) {
    console.error('monthly dashboard error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat data bulanan.', 500, [], startedAt))
  }
})

app.get('/api/reports/daily', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(userId).first<{ timezone: string }>()
    const timezone = profileInfo?.timezone || 'UTC'
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const today = formatter.format(new Date())
    const values = await c.env.DB.prepare(
      `SELECT v.metricCode, v.finalValue, v.unit, v.status, v.severity, v.manualOverride, v.metricCode,
              r.popupTitle, r.popupMessage, r.recommendation, r.sourceLabel
       FROM HL_measurementValues v
       LEFT JOIN HL_metricRules r ON r.id = v.ruleId
       WHERE v.userId = ? AND substr(v.measuredAt, 1, 10) = ?`
    ).bind(userId, today).all()
    const sessions = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM HL_measurementSessions WHERE userId = ? AND substr(measuredAt, 1, 10) = ?`
    ).bind(userId, today).first<{ cnt: number }>()
    const sessionCount = sessions?.cnt || 0
    return jsonResponse(c, success({
      period: 'daily',
      date: today,
      sessionCount,
      hasData: (values.results || []).length > 0,
      values: values.results || [],
      emptyMessage: sessionCount === 0 ? 'Belum ada pengukuran hari ini. Yuk mulai catat pengukuran.' : null
    }, 200, startedAt))
  } catch (error) {
    console.error('daily report error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat laporan harian.', 500, [], startedAt))
  }
})

app.get('/api/reports/weekly', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const metrics = await c.env.DB.prepare(
      `SELECT metricCode, AVG(finalValue) as avg, MIN(finalValue) as min, MAX(finalValue) as max, COUNT(*) as cnt
       FROM HL_measurementValues WHERE userId = ? AND measuredAt >= ? GROUP BY metricCode`
    ).bind(userId, since).all()
    const sessions = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM HL_measurementSessions WHERE userId = ? AND measuredAt >= ?`
    ).bind(userId, since).first<{ cnt: number }>()
    const sessionsList = await c.env.DB.prepare(
      `SELECT substr(measuredAt, 1, 10) as day, COUNT(*) as cnt FROM HL_measurementSessions
       WHERE userId = ? AND measuredAt >= ? GROUP BY day`
    ).bind(userId, since).all<{ day: string; cnt: number }>()
    const bestDay = (sessionsList.results || []).reduce((a, b) => (b.cnt > (a?.cnt || 0) ? b : a), null as any)
    const worstDay = (sessionsList.results || []).reduce((a, b) => (b.cnt < (a?.cnt || 99) ? b : a), null as any)
    const alertCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM HL_alerts WHERE userId = ? AND createdAt >= ?`
    ).bind(userId, since).first<{ cnt: number }>()
    const adherence = Math.min(100, Math.round(((sessionsList.results || []).length / 7) * 100))
    return jsonResponse(c, success({
      period: 'weekly',
      metrics: metrics.results || [],
      adherence,
      alertCount: alertCount?.cnt || 0,
      bestDay: bestDay?.day || null,
      worstDay: worstDay?.day || null,
      daysWithData: (sessionsList.results || []).length
    }, 200, startedAt))
  } catch (error) {
    console.error('weekly report error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat laporan mingguan.', 500, [], startedAt))
  }
})

app.get('/api/reports/monthly', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
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
    const daysWithData = await c.env.DB.prepare(
      `SELECT COUNT(DISTINCT substr(measuredAt, 1, 10)) as cnt FROM HL_measurementSessions WHERE userId = ? AND measuredAt >= ?`
    ).bind(userId, since).first<{ cnt: number }>()

    // AI monthly summary - use LLM if available, else rule-based
    let aiSummary = 'Ringkasan 30 hari belum tersedia.'
    if (c.env.CLOUDFLARE_ACCOUNT_ID && c.env.CLOUDFLARE_API_TOKEN) {
      const summary = (values.results || []).map((m: any) =>
        `${m.metricCode}: avg ${m.avg?.toFixed(1)} (min ${m.min}, max ${m.max}, latest ${m.latest})`
      ).join('; ')
      try {
        const prompt = `Buat ringkasan naratif singkat 30 hari kesehatan user berdasarkan data berikut dalam Bahasa Indonesia. Jangan mendiagnosa. Hanya edukasi umum.\n\nData: ${summary}`
        const aiRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-2-7b-chat-int8`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${c.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, max_tokens: 400 })
          }
        )
        if (aiRes.ok) {
          const d = await aiRes.json() as any
          const txt = d?.result?.response || ''
          if (txt) aiSummary = txt
        }
      } catch (err) { console.error('AI monthly error:', err) }
    }

    return jsonResponse(c, success({
      period: 'monthly',
      metrics: values.results || [],
      sessionCount: sessionCount?.cnt || 0,
      alertCount: alertCount?.cnt || 0,
      daysWithData: daysWithData?.cnt || 0,
      aiMonthlySummary: aiSummary
    }, 200, startedAt))
  } catch (error) {
    console.error('monthly report error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat laporan bulanan.', 500, [], startedAt))
  }
})

app.get('/api/kb', async (c) => {
  const startedAt = Date.now()
  try {
    const articles = await c.env.DB.prepare(
      `SELECT id, slug, title, category, contentMarkdown as body FROM HL_knowledgeArticles WHERE active = 1 ORDER BY sortOrder ASC`
    ).all().catch(() => ({ results: [] as any[] }))
    if ((articles.results || []).length === 0) {
      const fallback = [
        {
          id: 'kb-yuwell-yx106',
          slug: 'yuwell-yx106',
          title: 'Yuwell YX106 - Pulse Oximeter',
          category: 'device',
          body: '## Yuwell YX106 - Pulse Oximeter\n\n### Cara Pakai\n1. Buka klip sensor, pasang di jari telunjuk.\n2. Kuku menghadap atas, jari masuk sempurna.\n3. Tunggu 5-10 detik sampai angka stabil.\n4. Baca SpO2 (%) dan Heart Rate (bpm).\n\n### Tips Foto\n- Foto di tempat terang.\n- Hindari cahaya lampu neon langsung.\n- Posisikan layar menghadap kamera.\n\n### Kesalahan Umum\n- Catut dingin/kuku cat dapat mengganggu sensor.\n- Bergerak saat pengukuran bikin bacaan tak akurat.\n\n### Arti Metric\n- SpO2 normal 95-100%. < 92% perlu konsultasi dokter.\n- HR normal 60-100 bpm (dewasa).\n\n### Kapan Cek Ulang\n- SpO2 < 94% atau HR > 120 bpm saat istirahat.'
        },
        {
          id: 'kb-omron-hem7194',
          slug: 'omron-hem7194-t1-fl',
          title: 'OMRON HEM 7194 T1 FL - Tensimeter Digital',
          category: 'device',
          body: '## OMRON HEM 7194 T1 FL - Tensimeter Digital\n\n### Cara Pakai\n1. Pasang manset di lengan atas 2-3 cm di atas siku.\n2. Duduk tenang 5 menit sebelum pengukuran.\n3. Tekan tombol Start, tunggu sampai manset kempes sendiri.\n4. Catat Sistolik/Diastolik (mmHg) dan Pulse.\n\n### Tips Foto\n- Layar menghadap kamera, tidak silau.\n- Ambil foto sebelum memori di-clear.\n\n### Kesalahan Umum\n- Manset terlalu longgar/ketat.\n- Bicara saat pengukuran.\n\n### Arti Metric\n- Normal: < 120/<80 mmHg.\n- Hipertensi Tahap 1: 130-139/80-89.\n- Hipertensi Tahap 2: >=140/>=90.\n\n### Kapan Cek Ulang\n- Sistolik > 180 atau Diastolik > 120 (krisis hipertensi).'
        },
        {
          id: 'kb-sinocare-m101',
          slug: 'sinocare-m101',
          title: 'Sinocare M101 - GCU (Glucose/Cholesterol/Uric Acid)',
          category: 'device',
          body: '## Sinocare M101 - GCU (Glucose/Cholesterol/Uric Acid)\n\n### Cara Pakai\n1. Pilih mode test: Glu/Chol/UA sesuai kebutuhan.\n2. Masukkan strip sesuai mode.\n3. Cuci tangan, ambil sampel darah di ujung strip.\n4. Tunggu hitungan mundur selesai.\n5. Catat hasil mg/dL.\n\n### Tips Foto\n- Hanya foto di mode yang dipilih.\n- Pilih mode dulu sebelum foto agar AI tidak bingung.\n\n### Kesalahan Umum\n- Strip salah mode = hasil salah.\n- Darah terlalu sedikit / terlalu banyak.\n\n### Arti Metric\n- Glu Fasting: 70-99 mg/dL normal.\n- Glu 2 Jam PP: <140 mg/dL normal.\n- Cholesterol Total: <200 mg/dL optimal.\n- Uric Acid: <7 mg/dL (pria), <6 mg/dL (wanita).\n\n### Kapan Cek Ulang\n- Glu fasting >= 126 atau 2 jam PP >= 200.'
        },
        {
          id: 'kb-thermometer',
          slug: 'thermometer',
          title: 'Termometer Digital',
          category: 'device',
          body: '## Termometer Digital\n\n### Cara Pakai\n1. Nyalakan, pastikan mode Celsius.\n2. Tempatkan di bawah lidah / ketiak / dahi sesuai alat.\n3. Tunggu bunyi bip.\n4. Catat suhu dalam C.\n\n### Tips Foto\n- Layar sejajar kamera.\n- Hindari uap/embun di sensor.\n\n### Kesalahan Umum\n- Makan/minum panas baru 30 menit lalu pengukuran oral.\n\n### Arti Metric\n- Normal: 36.1-37.2 C.\n- Demam: >=37.5 C.\n- Demam tinggi: >=39 C.\n\n### Kapan Cek Ulang\n- Suhu >= 40 C atau hipotermia < 35 C.'
        },
        {
          id: 'kb-scale',
          slug: 'timbangan-badan',
          title: 'Timbangan Badan Digital',
          category: 'device',
          body: '## Timbangan Badan Digital\n\n### Cara Pakai\n1. Letakkan di lantai datar.\n2. Naik tanpa alas kaki, berdiri diam di tengah.\n3. Tunggu angka stabil.\n4. Catat berat kg.\n\n### Tips Foto\n- Layar sejajar kamera.\n- Foto di pagi hari setelah ke toilet untuk konsistensi.\n\n### Kesalahan Umum\n- Timbangan di karpet = bacaan tidak akurat.\n\n### Arti Metric\n- BMI = berat (kg) / (tinggi m)^2.\n- Underweight: <18.5, Normal: 18.5-24.9, Overweight: 25-29.9, Obesitas: >=30.\n\n### Kapan Cek Ulang\n- Perubahan > 2 kg dalam seminggu tanpa sebab jelas.'
        }
      ]
      return jsonResponse(c, success({ articles: fallback }, 200, startedAt))
    }
    return jsonResponse(c, success({ articles: articles.results }, 200, startedAt))
  } catch (error) {
    console.error('kb error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat KB.', 500, [], startedAt))
  }
})

// Telegram Connect
app.post('/api/telegram/connect', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = await sha256Token(code)
    const linkId = createId('tgl')
    await c.env.DB.prepare(
      `INSERT INTO HL_telegramLinks (id, userId, verificationCodeHash, verified, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(userId) DO UPDATE SET verificationCodeHash = excluded.verificationCodeHash, updatedAt = CURRENT_TIMESTAMP`
    ).bind(linkId, userId, codeHash).run()
    return jsonResponse(c, success({ verificationCode: code, expiresInMinutes: 10 }, 200, startedAt))
  } catch (error) {
    console.error('telegram connect error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal membuat kode.', 500, [], startedAt))
  }
})

app.post('/api/telegram/test', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const tg = await sendTelegramNotification(c, userId, 'submit_summary', 'Test Telegram', 'Pesan test dari HL Health Companion.')
    await logNotification(c, userId, 'telegram', 'submit_summary', 'Test Telegram', 'Pesan test dari HL Health Companion.',
      tg.sent ? 'sent' : 'skipped', {}, tg.error)
    return jsonResponse(c, success({ sent: tg.sent, error: tg.error }, 200, startedAt))
  } catch (error) {
    console.error('telegram test error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal kirim test.', 500, [], startedAt))
  }
})

// Family/Caregiver
app.post('/api/family/invite', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json().catch(() => ({})) as { email?: string; role?: string }
    const inviteId = createId('fmi')
    const shareToken = crypto.randomUUID().replace(/-/g, '')
    const shareTokenHash = await sha256Token(shareToken)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    await c.env.DB.prepare(
      `INSERT INTO HL_familyInvites (id, ownerUserId, inviteEmail, role, inviteTokenHash, status, expiresAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(inviteId, userId, body.email || 'unknown@example.com', body.role || 'caregiver', shareTokenHash, expiresAt).run()
    return jsonResponse(c, success({ inviteId, shareToken, expiresAt, inviteUrl: `/family/accept?token=${shareToken}` }, 200, startedAt))
  } catch (error) {
    console.error('family invite error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal membuat invite.', 500, [], startedAt))
  }
})

app.post('/api/family/accept', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { shareToken: string }
    if (!body.shareToken) return jsonResponse(c, failure('VALIDATION_ERROR', 'shareToken wajib.', 400, [], startedAt))
    const shareTokenHash = await sha256Token(body.shareToken)
    const invite = await c.env.DB.prepare(
      `SELECT id, ownerUserId, role, status, expiresAt FROM HL_familyInvites WHERE inviteTokenHash = ?`
    ).bind(shareTokenHash).first<{ id: string; ownerUserId: string; role: string; status: string; expiresAt: string }>()
    if (!invite) return jsonResponse(c, failure('NOT_FOUND', 'Invite tidak ditemukan.', 404, [], startedAt))
    if (invite.status !== 'pending') return jsonResponse(c, failure('VALIDATION_ERROR', 'Invite sudah digunakan.', 400, [], startedAt))
    if (new Date(invite.expiresAt) < new Date()) return jsonResponse(c, failure('VALIDATION_ERROR', 'Invite kadaluarsa.', 400, [], startedAt))

    const linkId = createId('fml')
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO HL_familyLinks (id, ownerUserId, linkedUserId, role, status, canViewDashboard, canInputMeasurement, canReceiveAlert, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'active', 1, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(linkId, invite.ownerUserId, userId, invite.role),
      c.env.DB.prepare(`UPDATE HL_familyInvites SET status = 'accepted', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).bind(invite.id)
    ])
    return jsonResponse(c, success({ linkId, role: invite.role }, 200, startedAt))
  } catch (error) {
    console.error('family accept error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menerima invite.', 500, [], startedAt))
  }
})

app.put('/api/family/members/:id/permissions', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const memberId = c.req.param('id')
    const body = await c.req.json() as { canRead?: number; canWrite?: number; canEmergency?: number }
    await c.env.DB.prepare(
      `UPDATE HL_familyLinks SET canViewDashboard = ?, canInputMeasurement = ?, canReceiveAlert = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ? AND ownerUserId = ?`
    ).bind(body.canRead ?? 1, body.canWrite ?? 0, body.canEmergency ?? 0, memberId, userId).run()
    return jsonResponse(c, success({ updated: true }, 200, startedAt))
  } catch (error) {
    console.error('family permissions error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update.', 500, [], startedAt))
  }
})

// Caregiver monitoring
app.get('/api/caregiver/monitor/:userId', async (c) => {
  const startedAt = Date.now()
  try {
    const caregiverId = await getCurrentSession(c)
    if (!caregiverId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const targetUserId = c.req.param('userId')
    const link = await c.env.DB.prepare(
      `SELECT canViewDashboard FROM HL_familyLinks WHERE ownerUserId = ? AND linkedUserId = ? AND status = 'active'`
    ).bind(targetUserId, caregiverId).first<{ canViewDashboard: number }>()
    if (!link || link.canViewDashboard !== 1) return jsonResponse(c, failure('UNAUTHORIZED', 'Tidak ada akses.', 403, [], startedAt))

    const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(targetUserId).first<{ timezone: string }>()
    const timezone = profileInfo?.timezone || 'UTC'
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const today = formatter.format(new Date())
    const values = await c.env.DB.prepare(
      `SELECT metricCode, finalValue, unit, status, severity, measuredAt FROM HL_measurementValues
       WHERE userId = ? AND substr(measuredAt, 1, 10) = ?`
    ).bind(targetUserId, today).all()
    const alerts = await c.env.DB.prepare(
      `SELECT metricCode, finalValue, unit, severity, message, createdAt FROM HL_alerts
       WHERE userId = ? AND substr(createdAt, 1, 10) = ?`
    ).bind(targetUserId, today).all()
    return jsonResponse(c, success({ date: today, values: values.results || [], alerts: alerts.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('caregiver monitor error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal monitor.', 500, [], startedAt))
  }
})

// Emergency contacts
app.post('/api/emergency/contacts', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { name: string; phone: string; relationship?: string }
    if (!body.name || !body.phone) return jsonResponse(c, failure('VALIDATION_ERROR', 'name dan phone wajib.', 400, [], startedAt))
    const contactId = createId('emc')
    await c.env.DB.prepare(
      `INSERT INTO HL_emergencyContacts (id, userId, contactName, contactRelation, contactPhone, consentGiven, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(contactId, userId, body.name, body.relationship || null, body.phone).run()
    return jsonResponse(c, success({ contactId }, 201, startedAt))
  } catch (error) {
    console.error('emergency contact error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal tambah kontak.', 500, [], startedAt))
  }
})

app.get('/api/emergency/contacts', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const rows = await c.env.DB.prepare(
      `SELECT id, contactName as name, contactPhone as phone, contactRelation as relationship, createdAt FROM HL_emergencyContacts WHERE userId = ? ORDER BY createdAt DESC`
    ).bind(userId).all()
    return jsonResponse(c, success({ contacts: rows.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('emergency contacts list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal list.', 500, [], startedAt))
  }
})

// Reminders
app.post('/api/reminders', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { metricCode?: string; time: string; daysOfWeek?: string; label?: string }
    if (!body.time) return jsonResponse(c, failure('VALIDATION_ERROR', 'time wajib.', 400, [], startedAt))
    const remId = createId('rem')
    const reminderType = body.metricCode || 'general'
    await c.env.DB.prepare(
      `INSERT INTO HL_reminderSettings (id, userId, reminderType, scheduleTime, timezone, payloadJson, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'Asia/Jakarta', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(remId, userId, reminderType, body.time, JSON.stringify({ label: body.label || null, daysOfWeek: body.daysOfWeek || '1,2,3,4,5,6,7' })).run()
    return jsonResponse(c, success({ reminderId: remId }, 201, startedAt))
  } catch (error) {
    console.error('reminder create error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal buat reminder.', 500, [], startedAt))
  }
})

app.get('/api/reminders', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const rows = await c.env.DB.prepare(
      `SELECT id, reminderType as metricCode, scheduleTime as time, payloadJson, enabled FROM HL_reminderSettings WHERE userId = ? ORDER BY scheduleTime ASC`
    ).bind(userId).all()
    return jsonResponse(c, success({ reminders: rows.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('reminder list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal list reminder.', 500, [], startedAt))
  }
})

// Pattern insights
app.post('/api/patterns/generate', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { patternType: 'sleep_bp' | 'weight_bp' | 'medication' }
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const sleep = await c.env.DB.prepare(
      `SELECT AVG(finalValue) as avg, COUNT(*) as cnt FROM HL_measurementValues WHERE userId = ? AND metricCode = 'sleepDuration' AND measuredAt >= ?`
    ).bind(userId, since).first<{ avg: number; cnt: number }>()
    const bp = await c.env.DB.prepare(
      `SELECT AVG(finalValue) as avg, COUNT(*) as cnt FROM HL_measurementValues WHERE userId = ? AND metricCode = 'systolic' AND measuredAt >= ?`
    ).bind(userId, since).first<{ avg: number; cnt: number }>()
    if ((sleep?.cnt || 0) < 14 || (bp?.cnt || 0) < 14) {
      return jsonResponse(c, success({
        insight: 'Data belum cukup untuk menampilkan pola (minimal 14 hari data).',
        hasEnoughData: false
      }, 200, startedAt))
    }
    const insightText = `Pola tidur rata-rata ${sleep?.avg?.toFixed(1)} jam/hari dengan tekanan darah sistolik rata-rata ${bp?.avg?.toFixed(0)} mmHg. Konsultasikan dengan dokter untuk interpretasi lebih lanjut.`
    const insightId = createId('pi')
    await c.env.DB.prepare(
      `INSERT INTO HL_patternInsights (id, userId, insightType, rangeStart, rangeEnd, summaryText, dataJson, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(insightId, userId, body.patternType || 'sleep_bp', since, new Date().toISOString(), insightText, JSON.stringify({ sleep, bp })).run()
    return jsonResponse(c, success({ insightId, insight: insightText, hasEnoughData: true }, 200, startedAt))
  } catch (error) {
    console.error('pattern error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal pola.', 500, [], startedAt))
  }
})

// Offline draft sync
app.post('/api/measurements/sync', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { drafts: any[] }
    if (!body.drafts || !Array.isArray(body.drafts)) return jsonResponse(c, failure('VALIDATION_ERROR', 'drafts wajib.', 400, [], startedAt))
    const synced: any[] = []
    for (const d of body.drafts) {
      const draftId = createId('drf')
      const profileId = d.profileId && typeof d.profileId === 'string' ? d.profileId : null
      await c.env.DB.prepare(
        `INSERT INTO HL_measurementDrafts (id, userId, profileId, selectedMetricsJson, draftDataJson, status, createdAt, updatedAt, expiresAt)
         VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`
      ).bind(draftId, userId, profileId, JSON.stringify(d.metrics || []), JSON.stringify(d), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).run()
      synced.push({ clientId: d.clientId, draftId })
    }
    return jsonResponse(c, success({ synced, count: synced.length }, 200, startedAt))
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('sync error:', msg)
    return jsonResponse(c, failure('INTERNAL_ERROR', `Gagal sync: ${msg}`, 500, [], startedAt))
  }
})

// CSV Export
app.get('/api/export/csv', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const from = c.req.query('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = c.req.query('to') || new Date().toISOString()
    const rows = await c.env.DB.prepare(
      `SELECT measuredAt, metricCode, finalValue, unit, status, severity, manualOverride FROM HL_measurementValues WHERE userId = ? AND measuredAt BETWEEN ? AND ? ORDER BY measuredAt ASC`
    ).bind(userId, from, to).all<{ measuredAt: string; metricCode: string; finalValue: number; unit: string; status: string; severity: string; manualOverride: number }>()
    const header = 'measuredAt,metricCode,finalValue,unit,status,severity,manualOverride\n'
    const body = (rows.results || []).map(r => `${r.measuredAt},${r.metricCode},${r.finalValue},${r.unit},${r.status},${r.severity},${r.manualOverride}`).join('\n')
    return new Response(header + body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hl-export-${Date.now()}.csv"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error) {
    console.error('export error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal export.', 500, [], startedAt))
  }
})

// Privacy: delete account
app.post('/api/privacy/deleteAccount', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const auditId = createId('aud')
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'accountDelete', 'HL_users', ?, ?, CURRENT_TIMESTAMP)`).bind(auditId, userId, userId, JSON.stringify({ requestedAt: new Date().toISOString() })),
      c.env.DB.prepare(`UPDATE HL_users SET active = 0 WHERE id = ?`).bind(userId),
      c.env.DB.prepare(`UPDATE HL_sessions SET revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND revokedAt IS NULL`).bind(userId)
    ])
    setCookie(c, 'hlSession', '', { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 0 })
    return jsonResponse(c, success({ deleted: true, message: 'Akun dinonaktifkan. Data akan dihapus setelah periode retensi.' }, 200, startedAt))
  } catch (error) {
    console.error('delete account error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal hapus.', 500, [], startedAt))
  }
})


app.onError((error, c) => {
  console.error('Unhandled Exception:', error)
  const result = failure('INTERNAL_ERROR', 'Terjadi kesalahan sistem.', 500, [])
  return jsonResponse(c, result)
})

mountExtraRoutes(app as any)

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



// US-3.1.3: Async Telegram summary via Cloudflare Queue.
interface TelegramQueueMessage {
  userId: string
  notificationType: 'submit_summary' | 'emergency_alert'
  title: string
  message: string
  sessionId?: string
  hasEmergency?: boolean
}

async function enqueueTelegramSummary(
  c: Context<{ Bindings: Env }>,
  payload: TelegramQueueMessage
): Promise<{ enqueued: boolean; reason?: string }> {
  if (!c.env.TELEGRAM_QUEUE) {
    // Queue not bound: fall back to in-request send so user is not blocked.
    return { enqueued: false, reason: 'queue_not_configured' }
  }
  try {
    await c.env.TELEGRAM_QUEUE.send(payload)
    return { enqueued: true }
  } catch (err) {
    console.error('telegram enqueue error:', err)
    return { enqueued: false, reason: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function telegramQueueHandler(
  batch: MessageBatch<TelegramQueueMessage>,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const data = message.body
      if (!data?.userId) continue
      const c = {
        env,
        req: { header: () => undefined } as any,
        res: undefined,
      } as unknown as Context<{ Bindings: Env }>
      const tg = await sendTelegramNotification(
        c,
        data.userId,
        data.notificationType,
        data.title,
        data.message
      )
      await logNotification(
        c,
        data.userId,
        'telegram',
        data.notificationType,
        data.title,
        data.message,
        tg.sent ? 'sent' : 'skipped',
        { sessionId: data.sessionId, hasEmergency: data.hasEmergency === true, via: 'queue' },
        tg.error
      )
      message.ack()
    } catch (err) {
      console.error('telegram queue consumer error:', err)
      message.retry()
    }
  }
}

// US-3.1.3: default export moved to end of file

// AI Extraction Endpoint
type ExtractInput = {
  file?: File
  deviceCode?: unknown
  metricGroup?: unknown
  selectedMetricCodes?: unknown
  sessionDraftId?: unknown
}

function validateExtractInput(input: ExtractInput): string[] {
  const errors: string[] = []

  if (!input.deviceCode || typeof input.deviceCode !== 'string') {
    errors.push('deviceCode harus string.')
  }

  if (!input.metricGroup || typeof input.metricGroup !== 'string') {
    errors.push('metricGroup harus string.')
  }

  if (!input.selectedMetricCodes || !Array.isArray(input.selectedMetricCodes)) {
    errors.push('selectedMetricCodes harus array.')
  } else if (input.selectedMetricCodes.length === 0) {
    errors.push('selectedMetricCodes tidak boleh kosong.')
  }

  return errors
}

app.post('/api/measurements/extract', async (c) => {
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

    const userId = (sessionQuery as { userId: string }).userId

    // Parse multipart form data
    const formData = await c.req.parseBody()
    const file = formData.file as File
    const deviceCode = formData.deviceCode as string
    const metricGroup = formData.metricGroup as string
    const selectedMetricCodesJson = formData.selectedMetricCodes as string
    const sessionDraftId = formData.sessionDraftId as string | undefined

    // Get max file size from config
    const maxUploadSizeConfig = await c.env.DB.prepare(
      'SELECT configValue FROM HL_systemConfigs WHERE configKey = ?'
    ).bind('maxUploadSizeBytes').first()

    const maxUploadSize = maxUploadSizeConfig ? parseInt(maxUploadSizeConfig.configValue as string) : 2 * 1024 * 1024 // Default 2MB

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

    // Get AI timeout config
    const aiTimeoutConfig = await c.env.DB.prepare(
      'SELECT configValue FROM HL_systemConfigs WHERE configKey = ?'
    ).bind('aiVisionTimeoutMs').first()

    const aiTimeout = aiTimeoutConfig ? parseInt(aiTimeoutConfig.configValue as string) : 5000 // Default 5s

    // Prepare AI Vision call
    const aiStartedAt = Date.now()
    let aiSuccess = false
    let aiTimedOut = false
    let rawResponse: string | null = null
    let parsedJson: string | null = null
    let extractedMetrics: any[] = []
    let confidence = 0
    let modelName = '@cf/meta/llama-3.2-11b-vision-instruct' // Default multimodal model

    try {
      // Convert file to base64 for AI Vision
      const arrayBuffer = await file.arrayBuffer()
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

      // Call Workers AI Vision with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), aiTimeout)

      try {
        const aiResponse = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${c.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/models/@cf/meta/llama-3.2-11b-vision-instruct/inference`,
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

        clearTimeout(timeoutId)

        if (aiResponse.ok) {
          const aiData = await aiResponse.json() as any
          rawResponse = JSON.stringify(aiData)

          // Parse AI response for metrics
          if (aiData.success && aiData.result) {
            parsedJson = JSON.stringify(aiData.result)
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
    const extractionId = crypto.randomUUID()
    await c.env.DB.prepare(
      `INSERT INTO HL_aiExtractions 
       (id, userId, sessionDraftId, deviceCode, metricGroup, selectedMetricsJson, rawResponse, parsedJson, durationMs, success, timeout, confidence, modelName) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      extractionId,
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


// ============================================================
// Sprint 3 - Family & Alert System Endpoints
// ============================================================

function isAdminUser(c: Context<{ Bindings: Env }>, user: UserRow): boolean {
  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return adminEmails.includes(user.email.toLowerCase())
}

app.get('/api/admin/configs', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    if (!isAdminUser(c, user)) return jsonResponse(c, failure('FORBIDDEN', 'Akses admin diperlukan.', 403, [], startedAt))
    const rows = await c.env.DB.prepare(
      'SELECT configKey, configValue, dataType, description, updatedAt FROM HL_systemConfigs ORDER BY configKey'
    ).all()
    return jsonResponse(c, success({ configs: rows.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('admin configs list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat konfigurasi.', 500, [], startedAt))
  }
})

app.put('/api/admin/configs/:configKey', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    if (!isAdminUser(c, user)) return jsonResponse(c, failure('FORBIDDEN', 'Akses admin diperlukan.', 403, [], startedAt))
    const configKey = c.req.param('configKey')
    const body = await c.req.json() as { configValue?: string }
    if (!body.configValue && body.configValue !== '0' && body.configValue !== '') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configValue wajib.', 400, [], startedAt))
    }
    const existing = await c.env.DB.prepare('SELECT configKey FROM HL_systemConfigs WHERE configKey = ?').bind(configKey).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Konfigurasi tidak ditemukan.', 404, [], startedAt))
    await c.env.DB.prepare('UPDATE HL_systemConfigs SET configValue = ?, updatedAt = CURRENT_TIMESTAMP WHERE configKey = ?').bind(body.configValue, configKey).run()
    invalidateSystemConfigCache(configKey)
    await c.env.DB.prepare(
      "INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'configUpdate', 'HL_systemConfigs', ?, ?, CURRENT_TIMESTAMP)"
    ).bind(createId('aud'), user.id, configKey, JSON.stringify({ configKey, newValue: body.configValue })).run()
    return jsonResponse(c, success({ updated: true, cacheInvalidated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin config update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update konfigurasi.', 500, [], startedAt))
  }
})

app.post('/api/telegram/verify', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { verificationCode?: string; telegramChatId?: string; telegramUsername?: string }
    if (!body.verificationCode || !body.telegramChatId) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'verificationCode dan telegramChatId wajib.', 400, [], startedAt))
    }
    const codeHash = await sha256Token(body.verificationCode)
    const link = await c.env.DB.prepare('SELECT id, verificationCodeHash FROM HL_telegramLinks WHERE userId = ? AND verified = 0').bind(userId).first<{ id: string; verificationCodeHash: string }>()
    if (!link) return jsonResponse(c, failure('NOT_FOUND', 'Tidak ada kode verifikasi aktif.', 404, [], startedAt))
    if (link.verificationCodeHash !== codeHash) return jsonResponse(c, failure('VALIDATION_ERROR', 'Kode verifikasi salah.', 400, [], startedAt))
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE HL_telegramLinks SET telegramChatId = ?, telegramUsername = ?, verified = 1, enabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(body.telegramChatId, body.telegramUsername || null, link.id),
      c.env.DB.prepare('UPDATE HL_users SET telegramEnabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(userId)
    ])
    await c.env.DB.prepare(
      "INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'telegramConnect', 'HL_telegramLinks', ?, ?, CURRENT_TIMESTAMP)"
    ).bind(createId('aud'), userId, link.id, JSON.stringify({ telegramChatId: body.telegramChatId })).run()
    return jsonResponse(c, success({ verified: true, enabled: true }, 200, startedAt))
  } catch (error) {
    console.error('telegram verify error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal verifikasi Telegram.', 500, [], startedAt))
  }
})

app.put('/api/telegram/settings', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { telegramSubmitSummary?: boolean; telegramEmergencyAlert?: boolean }
    await c.env.DB.prepare(
      "INSERT INTO HL_notificationSettings (id, userId, telegramSubmitSummary, telegramEmergencyAlert, createdAt, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(userId) DO UPDATE SET telegramSubmitSummary = excluded.telegramSubmitSummary, telegramEmergencyAlert = excluded.telegramEmergencyAlert, updatedAt = CURRENT_TIMESTAMP"
    ).bind(createId('nts'), userId, body.telegramSubmitSummary ? 1 : 0, body.telegramEmergencyAlert ? 1 : 0).run()
    return jsonResponse(c, success({ updated: true }, 200, startedAt))
  } catch (error) {
    console.error('telegram settings error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update pengaturan.', 500, [], startedAt))
  }
})

app.get('/api/family/links', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const owned = await c.env.DB.prepare(
      "SELECT fl.id, fl.linkedUserId, u.displayName as linkedDisplayName, fl.role, fl.status, fl.canViewDashboard, fl.canInputMeasurement, fl.canReceiveAlert FROM HL_familyLinks fl LEFT JOIN HL_users u ON u.id = fl.linkedUserId WHERE fl.ownerUserId = ? ORDER BY fl.createdAt DESC"
    ).bind(userId).all()
    const linked = await c.env.DB.prepare(
      "SELECT fl.id, fl.ownerUserId, u.displayName as ownerDisplayName, fl.role, fl.status, fl.canViewDashboard, fl.canInputMeasurement, fl.canReceiveAlert FROM HL_familyLinks fl LEFT JOIN HL_users u ON u.id = fl.ownerUserId WHERE fl.linkedUserId = ? ORDER BY fl.createdAt DESC"
    ).bind(userId).all()
    return jsonResponse(c, success({ ownedLinks: owned.results || [], linkedToMe: linked.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('family links error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat data keluarga.', 500, [], startedAt))
  }
})

async function caregiverDashboardHandler(c: Context<{ Bindings: Env }>) {
  const startedAt = Date.now()
  try {
    const caregiverId = await getCurrentSession(c)
    if (!caregiverId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const links = await c.env.DB.prepare(
      "SELECT fl.id, fl.ownerUserId, u.displayName, fl.role, fl.canViewDashboard, fl.canInputMeasurement, fl.canReceiveAlert FROM HL_familyLinks fl JOIN HL_users u ON u.id = fl.ownerUserId WHERE fl.linkedUserId = ? AND fl.status = 'active' AND fl.canViewDashboard = 1"
    ).bind(caregiverId).all()
    const profiles: Array<Record<string, unknown>> = []
    for (const link of (links.results || []) as Array<{ ownerUserId: string; displayName: string; role: string; canViewDashboard: number; canInputMeasurement: number; canReceiveAlert: number }>) {
      const lastSession = await c.env.DB.prepare('SELECT measuredAt FROM HL_measurementSessions WHERE userId = ? ORDER BY measuredAt DESC LIMIT 1').bind(link.ownerUserId).first<{ measuredAt: string }>()
      const alerts = await c.env.DB.prepare('SELECT id, metricCode, finalValue, unit, severity, message, createdAt FROM HL_alerts WHERE userId = ? AND acknowledged = 0 ORDER BY createdAt DESC LIMIT 5').bind(link.ownerUserId).all()
      profiles.push({ ownerUserId: link.ownerUserId, displayName: link.displayName, role: link.role, permissions: { canViewDashboard: !!link.canViewDashboard, canInputMeasurement: !!link.canInputMeasurement, canReceiveAlert: !!link.canReceiveAlert }, lastMeasurementAt: lastSession?.measuredAt || null, latestAlerts: alerts.results || [] })
    }
    return jsonResponse(c, success({ profiles }, 200, startedAt))
  } catch (error) {
    console.error('caregiver dashboard error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat dashboard caregiver.', 500, [], startedAt))
  }
}

app.get('/api/family/dashboard', caregiverDashboardHandler)
app.get('/api/family/caregiver/dashboard', caregiverDashboardHandler)

app.post('/api/alerts/:id/acknowledge', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const alertId = c.req.param('id')
    const alert = await c.env.DB.prepare('SELECT id, userId, acknowledged FROM HL_alerts WHERE id = ?').bind(alertId).first<{ id: string; userId: string; acknowledged: number }>()
    if (!alert) return jsonResponse(c, failure('NOT_FOUND', 'Alert tidak ditemukan.', 404, [], startedAt))
    if (alert.acknowledged === 1) return jsonResponse(c, success({ alreadyAcknowledged: true }, 200, startedAt))
    if (alert.userId !== userId) {
      const link = await c.env.DB.prepare("SELECT id FROM HL_familyLinks WHERE ownerUserId = ? AND linkedUserId = ? AND status = 'active' AND canReceiveAlert = 1").bind(alert.userId, userId).first()
      if (!link) return jsonResponse(c, failure('FORBIDDEN', 'Tidak memiliki akses.', 403, [], startedAt))
    }
    await c.env.DB.prepare('UPDATE HL_alerts SET acknowledged = 1, acknowledgedBy = ?, acknowledgedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(userId, alertId).run()
    await c.env.DB.prepare(
      "INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'alertAcknowledge', 'HL_alerts', ?, ?, CURRENT_TIMESTAMP)"
    ).bind(createId('aud'), userId, alertId, JSON.stringify({ alertId })).run()
    return jsonResponse(c, success({ acknowledged: true, acknowledgedAt: new Date().toISOString() }, 200, startedAt))
  } catch (error) {
    console.error('alert acknowledge error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal acknowledge alert.', 500, [], startedAt))
  }
})

app.get('/api/alerts', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const severity = c.req.query('severity')
    const acked = c.req.query('acknowledged')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    let sql = 'SELECT id, metricCode, finalValue, unit, status, severity, alertType, message, acknowledged, acknowledgedAt, createdAt FROM HL_alerts WHERE userId = ?'
    const params: unknown[] = [userId]
    if (severity) { sql += ' AND severity = ?'; params.push(severity) }
    if (acked === 'false') { sql += ' AND acknowledged = 0' }
    sql += ' ORDER BY createdAt DESC LIMIT ?'
    params.push(limit)
    const rows = await c.env.DB.prepare(sql).bind(...params).all()
    return jsonResponse(c, success({ alerts: rows.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('alerts list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat alert.', 500, [], startedAt))
  }
})

app.get('/api/notifications', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const status = c.req.query('status')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    let sql = 'SELECT id, channel, notificationType, title, message, status, createdAt FROM HL_notifications WHERE userId = ?'
    const params: unknown[] = [userId]
    if (status) { sql += ' AND status = ?'; params.push(status) }
    sql += ' ORDER BY createdAt DESC LIMIT ?'
    params.push(limit)
    const rows = await c.env.DB.prepare(sql).bind(...params).all()
    return jsonResponse(c, success({ notifications: rows.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('notifications list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat notifikasi.', 500, [], startedAt))
  }
})

app.post('/api/notifications/browser/subscribe', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string }
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'endpoint, keys.p256dh, dan keys.auth wajib.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      "INSERT INTO HL_pushSubscriptions (id, userId, endpoint, p256dh, auth, userAgent, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, p256dh = excluded.p256dh, auth = excluded.auth, userAgent = excluded.userAgent, updatedAt = CURRENT_TIMESTAMP"
    ).bind(createId('psh'), userId, body.endpoint, body.keys.p256dh, body.keys.auth, body.userAgent || null).run()
    await c.env.DB.prepare('UPDATE HL_users SET browserPushEnabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(userId).run()
    return jsonResponse(c, success({ subscribed: true }, 201, startedAt))
  } catch (error) {
    console.error('push subscribe error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal subscribe push.', 500, [], startedAt))
  }
})

app.put('/api/reminders/:id', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const reminderId = c.req.param('id')
    const body = await c.req.json() as { enabled?: boolean; time?: string; label?: string }
    const existing = await c.env.DB.prepare('SELECT id FROM HL_reminderSettings WHERE id = ? AND userId = ?').bind(reminderId, userId).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Reminder tidak ditemukan.', 404, [], startedAt))
    const updates: string[] = []
    const params: unknown[] = []
    if (body.time) { updates.push('scheduleTime = ?'); params.push(body.time) }
    if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled ? 1 : 0) }
    if (body.label) { updates.push('payloadJson = ?'); params.push(JSON.stringify({ label: body.label })) }
    if (updates.length > 0) {
      updates.push('updatedAt = CURRENT_TIMESTAMP')
      params.push(reminderId, userId)
      await c.env.DB.prepare(`UPDATE HL_reminderSettings SET ${updates.join(', ')} WHERE id = ? AND userId = ?`).bind(...params).run()
    }
    return jsonResponse(c, success({ updated: true }, 200, startedAt))
  } catch (error) {
    console.error('reminder update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update reminder.', 500, [], startedAt))
  }
})

app.delete('/api/reminders/:id', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const reminderId = c.req.param('id')
    await c.env.DB.prepare('DELETE FROM HL_reminderSettings WHERE id = ? AND userId = ?').bind(reminderId, userId).run()
    return jsonResponse(c, success({ deleted: true }, 200, startedAt))
  } catch (error) {
    console.error('reminder delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal hapus reminder.', 500, [], startedAt))
  }
})

app.get('/api/medications', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const rows = await c.env.DB.prepare('SELECT id, medicationName, dosageText, scheduleText, active, createdAt FROM HL_medications WHERE userId = ? ORDER BY createdAt DESC').bind(userId).all()
    return jsonResponse(c, success({ medications: rows.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('medications list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat obat.', 500, [], startedAt))
  }
})

app.post('/api/medications', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { medicationName?: string; dosageText?: string; scheduleText?: string; active?: boolean; schedules?: Array<{ scheduleTime: string; timezone?: string }> }
    if (!body.medicationName) return jsonResponse(c, failure('VALIDATION_ERROR', 'medicationName wajib.', 400, [], startedAt))
    const medId = createId('med')
    await c.env.DB.prepare('INSERT INTO HL_medications (id, userId, medicationName, dosageText, scheduleText, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(medId, userId, body.medicationName, body.dosageText || null, body.scheduleText || null, body.active !== false ? 1 : 0).run()
    if (body.schedules && body.schedules.length > 0) {
      for (const s of body.schedules) {
        await c.env.DB.prepare('INSERT INTO HL_medicationSchedules (id, userId, medicationId, scheduleTime, timezone, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(createId('msc'), userId, medId, s.scheduleTime, s.timezone || 'Asia/Jakarta').run()
      }
    }
    return jsonResponse(c, success({ medicationId: medId }, 201, startedAt))
  } catch (error) {
    console.error('medication create error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal tambah obat.', 500, [], startedAt))
  }
})

app.put('/api/medications/:id', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const medId = c.req.param('id')
    const body = await c.req.json() as { medicationName?: string; dosageText?: string; scheduleText?: string; active?: boolean }
    const existing = await c.env.DB.prepare('SELECT id FROM HL_medications WHERE id = ? AND userId = ?').bind(medId, userId).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Obat tidak ditemukan.', 404, [], startedAt))
    await c.env.DB.prepare('UPDATE HL_medications SET medicationName = COALESCE(?, medicationName), dosageText = COALESCE(?, dosageText), scheduleText = COALESCE(?, scheduleText), active = COALESCE(?, active), updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?').bind(body.medicationName || null, body.dosageText || null, body.scheduleText || null, body.active !== undefined ? (body.active ? 1 : 0) : null, medId, userId).run()
    return jsonResponse(c, success({ updated: true }, 200, startedAt))
  } catch (error) {
    console.error('medication update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update obat.', 500, [], startedAt))
  }
})

app.post('/api/medications/:id/log', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const medId = c.req.param('id')
    const body = await c.req.json() as { takenAt?: string; status?: string; note?: string }
    const med = await c.env.DB.prepare('SELECT id FROM HL_medications WHERE id = ? AND userId = ?').bind(medId, userId).first()
    if (!med) return jsonResponse(c, failure('NOT_FOUND', 'Obat tidak ditemukan.', 404, [], startedAt))
    if (!['taken', 'skipped', 'missed', 'unknown'].includes(body.status || '')) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Status harus taken, skipped, missed, atau unknown.', 400, [], startedAt))
    }
    const logId = createId('mlog')
    await c.env.DB.prepare('INSERT INTO HL_medicationLogs (id, userId, medicationId, takenAt, status, note, createdAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(logId, userId, medId, body.takenAt || new Date().toISOString(), body.status, body.note || null).run()
    return jsonResponse(c, success({ logId }, 201, startedAt))
  } catch (error) {
    console.error('medication log error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal log obat.', 500, [], startedAt))
  }
})

app.get('/api/medications/logs', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const from = c.req.query('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = c.req.query('to') || new Date().toISOString()
    const rows = await c.env.DB.prepare(
      'SELECT ml.id, ml.medicationId, m.medicationName, ml.takenAt, ml.status, ml.note FROM HL_medicationLogs ml JOIN HL_medications m ON m.id = ml.medicationId WHERE ml.userId = ? AND ml.takenAt >= ? AND ml.takenAt <= ? ORDER BY ml.takenAt DESC LIMIT 100'
    ).bind(userId, from, to).all()
    return jsonResponse(c, success({ logs: rows.results || [] }, 200, startedAt))
  } catch (error) {
    console.error('medication logs error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat log obat.', 500, [], startedAt))
  }
})

app.post('/api/telegram/webhook', async (c) => {
  try {
    const body = await c.req.json() as { message?: { chat?: { id?: number; username?: string }; text?: string } }
    const message = body?.message
    if (!message?.text || !message?.chat?.id) return c.json({ ok: true })
    const text = message.text.trim()
    if (/^HL-\d{6}$/.test(text)) {
      const codeHash = await sha256Token(text)
      const link = await c.env.DB.prepare('SELECT id, userId FROM HL_telegramLinks WHERE verificationCodeHash = ? AND verified = 0').bind(codeHash).first<{ id: string; userId: string }>()
      if (link) {
        await c.env.DB.batch([
          c.env.DB.prepare('UPDATE HL_telegramLinks SET telegramChatId = ?, telegramUsername = ?, verified = 1, enabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(String(message.chat.id), message.chat.username || null, link.id),
          c.env.DB.prepare('UPDATE HL_users SET telegramEnabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(link.userId)
        ])
        await c.env.DB.prepare(
          "INSERT INTO HL_auditLogs (id, userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, 'telegramConnect', 'HL_telegramLinks', ?, ?, CURRENT_TIMESTAMP)"
        ).bind(createId('aud'), link.userId, link.id, JSON.stringify({ telegramChatId: String(message.chat.id) })).run()
      }
    }
    return c.json({ ok: true })
  } catch (error) {
    console.error('telegram webhook error:', error)
    return c.json({ ok: true })
  }
})

// US-3.1.3 + US-3.4.2: Worker default export includes fetch, queue, and scheduled handler.
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request as any, env as any, ctx as any)
  },
  async queue(batch: MessageBatch<TelegramQueueMessage>, env: Env, _ctx: ExecutionContext): Promise<void> {
    return telegramQueueHandler(batch, env, _ctx)
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return scheduledHandler(event, env as unknown as ExtraEnv, ctx)
  }
}
