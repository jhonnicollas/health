import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Env, ApiErrorCode } from '../types.js'
import { CryptoService } from '../services/crypto.js'
import { AuditService } from '../services/audit.js'
import { ConfigService, isSensitiveConfigKey } from '../services/config.js'
import { RbacService } from '../services/rbac.js'
import { CheckoutSessionService } from '../services/billing/checkout-session.js'
import { SubscriptionActivationService } from '../services/billing/subscription-activation.js'


export const app = new Hono<{ Bindings: Env }>()

export type { Env }

export type ApiStatus = 200 | 201 | 202 | 400 | 401 | 403 | 404 | 409 | 410 | 429 | 500 | 502 | 503

export type RegisterInput = {
  email?: unknown
  password?: unknown
  displayName?: unknown
}

export type LoginInput = {
  email?: unknown
  password?: unknown
}

export type OnboardingInput = {
  displayName?: unknown
  sex?: unknown
  birthDate?: unknown
  heightCm?: unknown
  timezone?: unknown
  theme?: unknown
  accessibilityMode?: unknown
  aiConsent?: unknown
  whatsappNumber?: unknown
}

export type ProfileUpdateInput = {
  displayName?: unknown
  heightCm?: unknown
  timezone?: unknown
  theme?: unknown
  accessibilityMode?: unknown
  whatsappNumber?: unknown
}

export type UiSettingsInput = {
  theme?: unknown
  accessibilityMode?: unknown
}

export type UserRow = {
  id: number
  email: string
  passwordHash: string | null
  displayName: string
  telegramEnabled: number
  browserPushEnabled: number
  active: number
  lastLoginAt?: string | null
}

export type ProfileRow = {
  id: number
  userId?: number
  sex: string
  birthDate: string
  heightCm: number
  timezone: string
  accessibilityMode: string
  theme: string
  emergencyConsent: number
  aiConsent: number
  dataShareConsent: number
  whatsappNumber: string | null
}

export type MetricCatalogRow = {
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

export type MetricCatalogMetric = {
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

export type RateLimitConfig = {
  maxRequests: number
  windowMinutes: number
}

export const SESSION_DAYS = 30
export const MIN_ONBOARDING_AGE_YEARS = 13

export const textEncoder = new TextEncoder()
export const textDecoder = new TextDecoder()

export function jsonMeta(startedAt: number) {
  return {
    requestId: crypto.randomUUID(),
    durationMs: Date.now() - startedAt
  }
}

export function success(data: unknown, status: ApiStatus = 200, startedAt = Date.now()) {
  return {
    body: {
      success: true,
      data,
      meta: jsonMeta(startedAt)
    },
    status
  }
}

export function failure(
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

export function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''

  for (const byte of byteArray) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function validateRegistrationInput(input: RegisterInput) {
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

export function validateLoginInput(input: LoginInput) {
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

export function validateOnboardingInput(input: OnboardingInput) {
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
  const whatsappNumber = typeof input.whatsappNumber === 'string' ? input.whatsappNumber.replace(/\D/g, '').slice(0, 15) : null

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
      aiConsent,
      whatsappNumber
    }
  }
}

export function validateProfileUpdateInput(input: ProfileUpdateInput) {
  const details: Array<{ field: string; message: string }> = []
  const hasDisplayName = input.displayName !== undefined && input.displayName !== null && input.displayName !== ''
  const displayName = hasDisplayName ? (typeof input.displayName === 'string' ? input.displayName.trim() : '') : undefined
  const hasHeightCm = input.heightCm !== undefined && input.heightCm !== null
  const heightCm = hasHeightCm ? (typeof input.heightCm === 'number' ? input.heightCm : Number(input.heightCm)) : undefined
  const hasTimezone = input.timezone !== undefined && input.timezone !== null && input.timezone !== ''
  const timezone = hasTimezone ? (typeof input.timezone === 'string' ? input.timezone.trim() : '') : undefined
  const theme = typeof input.theme === 'string' ? input.theme : undefined
  const accessibilityMode =
    typeof input.accessibilityMode === 'string' ? input.accessibilityMode : undefined
  const hasWhatsapp = input.whatsappNumber !== undefined && input.whatsappNumber !== null
  const whatsappNumber = hasWhatsapp ? (typeof input.whatsappNumber === 'string' ? input.whatsappNumber.replace(/\D/g, '').slice(0, 15) : undefined) : undefined

  if (hasDisplayName && displayName!.trim().length < 2) {
    details.push({ field: 'displayName', message: 'Nama tampilan minimal 2 karakter.' })
  }
  if (hasDisplayName && displayName!.length > 100) {
    details.push({ field: 'displayName', message: 'Nama tampilan maksimal 100 karakter.' })
  }

  if (hasHeightCm && (!Number.isFinite(heightCm!) || heightCm! < 50 || heightCm! > 250)) {
    details.push({ field: 'heightCm', message: 'Tinggi badan harus antara 50 dan 250 cm.' })
  }

  if (hasTimezone) {
    if (timezone!.length > 80) {
      details.push({ field: 'timezone', message: 'Timezone terlalu panjang.' })
    } else {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
      } catch {
        details.push({ field: 'timezone', message: 'Timezone wajib valid.' })
      }
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

  if (hasWhatsapp && whatsappNumber && (whatsappNumber.length < 8 || whatsappNumber.length > 15)) {
    details.push({ field: 'whatsappNumber', message: 'Nomor WhatsApp 8-15 digit.' })
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
      heightCm,
      timezone,
      theme,
      accessibilityMode,
      whatsappNumber
    }
  }
}

export function validateUiSettingsInput(input: UiSettingsInput) {
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

export async function hashPassword(password: string) {
  return CryptoService.hashPassword(password)
}

export async function verifyPassword(password: string, storedHash: string | null) {
  return CryptoService.verifyPassword(password, storedHash)
}

export async function sha256Token(value: string) {
  return CryptoService.sha256Token(value)
}

export function generateToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

export function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

export async function getSensitiveDataKey(c: Context<{ Bindings: Env }>) {
  const secret = c.env.ENCRYPTION_KEY
  if (!secret || secret.trim().length < 16) {
    throw new Error('ENCRYPTION_KEY is required for sensitive data encryption')
  }
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

export function isEncryptedSensitiveValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('enc:v1:')
}

export async function encryptSensitive(c: Context<{ Bindings: Env }>, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  if (isEncryptedSensitiveValue(value)) return value
  const key = await getSensitiveDataKey(c)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(value))
  return `enc:v1:${base64Url(iv)}:${base64Url(encrypted)}`
}

export async function decryptSensitive(c: Context<{ Bindings: Env }>, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  if (!isEncryptedSensitiveValue(value)) return value
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

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function getInsertedId(result: D1Result<unknown>): number {
  const meta = result.meta as Record<string, unknown> | undefined
  const id = Number(meta?.last_row_id ?? meta?.lastRowId)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('D1 insert did not return a valid last_row_id')
  }
  return id
}

export async function insertAndGetId(statement: D1PreparedStatement): Promise<number> {
  return getInsertedId(await statement.run())
}

export function idsEqual(left: unknown, right: unknown): boolean {
  return Number(left) === Number(right)
}

export function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function isUniqueEmailError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return message.toLowerCase().includes('unique') && message.includes('HL_users.email')
}

export function jsonResponse(
  c: Context<{ Bindings: Env }>,
  result: ReturnType<typeof success> | ReturnType<typeof failure>
) {
  c.header('Cache-Control', 'no-store')
  return c.json(result.body, result.status)
}

export const SYSTEM_CONFIG_TTL_MS = 60_000
export const systemConfigCacheByDb: WeakMap<object, Map<string, { value: string; expiresAt: number }>> = new WeakMap()

export function getSystemConfigCache(db: object): Map<string, { value: string; expiresAt: number }> {
  let cache = systemConfigCacheByDb.get(db)
  if (!cache) {
    cache = new Map()
    systemConfigCacheByDb.set(db, cache)
  }
  return cache
}

export function readSystemConfigCache(db: object, configKey: string): string | null {
  const cache = getSystemConfigCache(db)
  const entry = cache.get(configKey)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(configKey)
    return null
  }
  return entry.value
}

export function writeSystemConfigCache(db: object, configKey: string, value: string) {
  getSystemConfigCache(db).set(configKey, { value, expiresAt: Date.now() + SYSTEM_CONFIG_TTL_MS })
}

export function invalidateSystemConfigCache(db: object | null, configKey?: string) {
  if (!db) return
  const cache = getSystemConfigCache(db)
  if (configKey) {
    cache.delete(configKey)
    return
  }
  cache.clear()
}

export async function getSystemConfigNumber(c: Context<{ Bindings: Env }>, configKey: string) {
  const cached = readSystemConfigCache(c.env.DB, configKey)
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
    writeSystemConfigCache(c.env.DB, configKey, row.configValue)
  }

  return value
}

export async function getSystemConfigString(c: Context<{ Bindings: Env }>, configKey: string): Promise<string | null> {
  const cached = readSystemConfigCache(c.env.DB, configKey)
  if (cached !== null) return cached.trim() || null

  const row = await c.env.DB.prepare(
    'SELECT configValue FROM HL_systemConfigs WHERE configKey = ? LIMIT 1'
  )
    .bind(configKey)
    .first<{ configValue: string }>()

  if (row?.configValue !== undefined) {
    writeSystemConfigCache(c.env.DB, configKey, row.configValue)
  }

  return row?.configValue?.trim() || null
}

export async function getSystemConfigBoolean(c: Context<{ Bindings: Env }>, configKey: string, fallback = false): Promise<boolean> {
  const value = await getSystemConfigString(c, configKey)
  if (value === null) return fallback
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value.toLowerCase())
}

export async function resolveTelegramBotToken(c: Context<{ Bindings: Env }>): Promise<{ token?: string; error?: string }> {
  const botActive = await getSystemConfigBoolean(c, 'telegramBotActive', true)
  if (!botActive) return { error: 'telegram_bot_disabled' }

  const token = await getSystemConfigString(c, 'telegramBotToken') || c.env.TELEGRAM_BOT_TOKEN
  if (!token) return { error: 'bot_token_not_configured' }

  return { token }
}

export async function validateTelegramBotToken(c: Context<{ Bindings: Env }>): Promise<{ valid: boolean; bot?: unknown; error?: string }> {
  const resolved = await resolveTelegramBotToken(c)
  if (!resolved.token) return { valid: false, error: resolved.error }

  const response = await fetch(`https://api.telegram.org/bot${resolved.token}/getMe`, {
    method: 'GET'
  })

  if (!response.ok) {
    const errorText = await response.text()
    return { valid: false, error: errorText.slice(0, 200) }
  }

  const body = await response.json().catch(() => ({}))
  return { valid: true, bot: body }
}

export async function getLoginRateLimitConfig(c: Context<{ Bindings: Env }>): Promise<RateLimitConfig> {
  const [maxRequests, windowMinutes] = await Promise.all([
    getSystemConfigNumber(c, 'loginRateLimitMaxReq'),
    getSystemConfigNumber(c, 'loginRateLimitWindowMin')
  ])

  return {
    maxRequests,
    windowMinutes
  }
}

export async function enforceLoginRateLimit(
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
    .first<{ id: number; requestCount: number }>()

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
        (rateKey, routeKey, windowStart, requestCount, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
      .bind(rateKey, routeKey, windowStart)
      .run()
  }

  return {
    limited: false as const
  }
}

export function publicUser(user: Pick<UserRow, 'id' | 'email' | 'displayName' | 'telegramEnabled' | 'browserPushEnabled'>) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    telegramEnabled: Boolean(user.telegramEnabled),
    browserPushEnabled: Boolean(user.browserPushEnabled)
  }
}

export function publicProfile(profile: ProfileRow | null) {
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
    dataShareConsent: Boolean(profile.dataShareConsent),
    whatsappNumber: profile.whatsappNumber ?? null
  }
}

export function metricCatalogResponse(rows: MetricCatalogRow[]) {
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

export async function createSession(c: Context<{ Bindings: Env }>, userId: number) {
  const sessionToken = generateToken()
  const sessionTokenHash = await sha256Token(sessionToken)
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()
  const userAgent = c.req.header('User-Agent') ?? null

  return {
    sessionToken,
    sessionTokenHash,
    expiresAt,
    userAgent,
    statement: c.env.DB.prepare(
      `INSERT INTO HL_sessions
        (userId, sessionTokenHash, userAgent, ipHash, expiresAt, createdAt)
      VALUES (?, ?, ?, NULL, ?, CURRENT_TIMESTAMP)`
    ).bind(userId, sessionTokenHash, userAgent, expiresAt)
  }
}

export async function revokeCurrentSession(c: Context<{ Bindings: Env }>) {
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

export async function getAuthenticatedUser(c: Context<{ Bindings: Env }>) {
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

export type ValidateInput = {
  metrics?: unknown
  profileId?: unknown
}

export const PHYSICAL_RANGES: Record<string, { min: number; max: number; unit: string }> = {
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

export type SubmitMetricValue = {
  metricCode: string
  deviceCode?: string | null
  rawAiValue?: number | null
  finalValue: number
  unit: string
  confidence?: number | null
  manualOverride: number
}

export type SubmitInput = {
  profileId?: string | number
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

export type RuleEvaluation = {
  status: string
  severity: string
  emergencyLevel: string
  popupTitle: string | null
  popupMessage: string | null
  recommendation: string | null
  sourceLabel: string | null
  ruleId: number | null
}

export async function getCurrentSession(c: Context<{ Bindings: Env }>) {
  const sessionToken = getCookie(c, 'hlSession')
  if (!sessionToken) return null
  const sessionTokenHash = await sha256Token(sessionToken)
  const row = await c.env.DB.prepare(
    'SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND expiresAt > datetime("now") AND revokedAt IS NULL'
  ).bind(sessionTokenHash).first<{ userId: number }>()
  return row?.userId ?? null
}

export async function evaluateRule(
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
    sourceLabel: 'Belum ada referensi spesifik',
    ruleId: null
  }
  let rule: { id: number; status: string; severity: string; emergencyLevel: string; popupTitle: string; popupMessage: string; recommendation: string; sourceLabel: string } | null = null
  try {
    const result = await c.env.DB.prepare(
    `SELECT id, status, severity, emergencyLevel, popupTitle, popupMessage, recommendation, sourceLabel
     FROM HL_metricRules
     WHERE metricCode = ?
       AND active = 1
       AND (sex = 'all' OR sex = ?)
       AND ageMin <= ? AND ageMax >= ?
       AND minValue <= ? AND maxValue >= ?
     ORDER BY rulePriority ASC, id ASC
     LIMIT 1`
  ).bind(metricCode, sex, ageYears, ageYears, value, value).first<{
    id: number
    status: string
    severity: string
    emergencyLevel: string
    popupTitle: string
    popupMessage: string
    recommendation: string
    sourceLabel: string
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
    sourceLabel: rule.sourceLabel,
    ruleId: rule.id
  }
}

export function calculateAgeYears(birthDate: string): number {
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

export async function sendTelegramNotification(
  c: Context<{ Bindings: Env }>,
  userId: number,
  notificationType: string,
  title: string,
  message: string
): Promise<{ sent: boolean; error?: string }> {
  try {
    const link = await c.env.DB.prepare(
      'SELECT telegramChatId, verified, enabled FROM HL_telegramLinks WHERE userId = ? AND verified = 1 AND enabled = 1'
    ).bind(userId).first<{ telegramChatId: string; verified: number; enabled: number }>()

    const telegramChatId = await decryptSensitive(c, link?.telegramChatId)
    if (!telegramChatId) {
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

    const resolved = await resolveTelegramBotToken(c)
    if (!resolved.token) {
      return { sent: false, error: resolved.error || 'bot_token_not_configured' }
    }

    const text = `${title}\n\n${message}`
    const response = await fetch(`https://api.telegram.org/bot${resolved.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
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

export async function logNotification(
  c: Context<{ Bindings: Env }>,
  userId: number,
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
       (userId, channel, notificationType, title, message, status, payloadJson, errorMessage, sentAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${status === 'sent' ? 'CURRENT_TIMESTAMP' : 'NULL'}, CURRENT_TIMESTAMP)`
    ).bind(
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

export const FORBIDDEN_PHRASES = [
  'resep obat', 'dosis', 'mg per hari', 'minum obat', 'berhenti minum',
  'anda harus operasi', 'anda terjangkit',
  'prescription', 'take this medication',
  'stop taking', 'increase dose', 'decrease dose'
]

export function filterUnsafeContent(text: string): { safe: boolean; filtered: string } {
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

export function extractPatternScore(text: string): number {
  const match = text.match(/Clinical Confidence Score[:\s]*(\d+)/i) ||
                text.match(/skor[:\s]*(\d+)\s*\/\s*100/i) ||
                text.match(/skor[:\s]*(\d+)\s*dari\s*100/i) ||
                text.match(/confidence[:\s]*(\d+)/i)
  if (match) {
    const score = parseInt(match[1], 10)
    if (score >= 1 && score <= 100) return score
  }
  return 0
}

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiTextResult = {
  text: string
  model: string
}

export async function getAiTextModels(c: Context<{ Bindings: Env }>): Promise<string[]> {
  const defaultModel = await getSystemConfigString(c, 'aiTextDefaultModel')
  const modelListRaw = await getSystemConfigString(c, 'aiTextModels')
  const parsedModels = (() => {
    if (!modelListRaw) return []
    try {
      const parsed = JSON.parse(modelListRaw)
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
    } catch {
      return modelListRaw.split(',').map((item) => item.trim()).filter(Boolean)
    }
  })()
  return Array.from(new Set([defaultModel, ...parsedModels].filter((item): item is string => Boolean(item))))
}

export async function callConfiguredTextAi(
  c: Context<{ Bindings: Env }>,
  messages: AiChatMessage[],
  maxTokens: number
): Promise<AiTextResult | null> {
  const endpoint = await getSystemConfigString(c, 'aiTextEndpoint')
  const models = await getAiTextModels(c)
  if (!endpoint || models.length === 0) return null

  const apiKey = await getSystemConfigString(c, 'aiTextApiKey')
  const url = `${endpoint.replace(/\/+$/, '')}/chat/completions`

  for (const model of models) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: maxTokens,
          stream: false
        })
      })

      if (!response.ok) continue
      const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string }; text?: string }>
        result?: { response?: string }
      }
      const text = payload.choices?.[0]?.message?.content?.trim()
        || payload.choices?.[0]?.text?.trim()
        || payload.result?.response?.trim()
      if (text) return { text, model }
    } catch (error) {
      console.error('configured AI text call failed:', error)
    }
  }

  return null
}

export async function getRecentValues(c: Context<{ Bindings: Env }>, userId: number, days: number) {
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

export interface TelegramQueueMessage {
  userId: number
  notificationType: 'submit_summary' | 'emergency_alert'
  title: string
  message: string
  sessionId?: number
  hasEmergency?: boolean
}

export async function enqueueTelegramSummary(
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

export type ExtractInput = {
  file?: File
  deviceCode?: unknown
  metricGroup?: unknown
  selectedMetricCodes?: unknown
  sessionDraftId?: unknown
}

export function validateExtractInput(input: ExtractInput): string[] {
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

export function isAdminUser(c: Context<{ Bindings: Env }>, user: UserRow): boolean {
  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return adminEmails.includes(user.email.toLowerCase())
}

export async function requireAdminPermission(c: Context<{ Bindings: Env }>, user: UserRow, permissionCode: string, startedAt: number) {
  const userRoles = await RbacService.getUserRoles(c.env.DB, user.id)
  if (userRoles.some(r => r.roleCode === 'superAdmin')) return null
  if (await RbacService.hasPermission(c.env.DB, user.id, permissionCode)) return null
  return jsonResponse(c, failure('FORBIDDEN', 'Permission admin diperlukan.', 403, [{ permissionCode }], startedAt))
}

export async function getAdminUserRoles(db: D1Database, userId: number): Promise<string[]> {
  return (await RbacService.getUserRoles(db, userId)).map((role) => role.roleCode)
}

export async function getAdminSubscriptionSummary(db: D1Database, userId: number) {
  const row = await db.prepare(
    `SELECT planCode, status, currentPeriodEnd
     FROM HL_subscriptions
     WHERE userId = ?
     ORDER BY COALESCE(currentPeriodEnd, '9999-12-31') DESC, id DESC
     LIMIT 1`
  ).bind(userId).first<{ planCode: string; status: string; currentPeriodEnd: string | null }>()
  return row ?? { planCode: 'free', status: 'active', currentPeriodEnd: null }
}

export async function getAdminUserSummary(db: D1Database, userId: number) {
  const [roles, subscription] = await Promise.all([
    getAdminUserRoles(db, userId),
    getAdminSubscriptionSummary(db, userId)
  ])
  return { roles, subscription }
}

export const PROTECTED_SYSTEM_CONFIG_KEYS = new Set([
  'aiExtractTimeoutMs',
  'aiVisionModel',
  'aiTextEndpoint',
  'aiTextModels',
  'aiTextDefaultModel',
  'aiTextApiKey',
  'maxUploadSizeBytes',
  'loginRateLimitMaxReq',
  'loginRateLimitWindowMin',
  'ocrRateLimitMax',
  'ocrRateLimitWindowMin',
  'telegramBotToken',
  'telegramBotActive',
  'aiVisionUseCustomEndpoint'
])

export function isValidSystemConfigKey(configKey: string) {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(configKey) && configKey.length <= 80
}

export function isSensitiveSystemConfigKey(configKey: string) {
  return isSensitiveConfigKey(configKey)
}

export function systemConfigAuditMetadata(configKey: string, extra: Record<string, unknown> = {}) {
  return {
    configKey,
    sensitive: isSensitiveSystemConfigKey(configKey),
    ...extra
  }
}

export function isValidRoleCode(roleCode: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(roleCode) && roleCode.length <= 80
}

export function isValidPlanCode(planCode: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(planCode) && planCode.length <= 80
}

export function requireInternalSecret(c: Context<{ Bindings: Env }>, startedAt: number) {
  const expected = c.env.INTERNAL_API_SECRET
  const header = c.req.header('x-internal-secret') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || header !== expected) {
    return jsonResponse(c, failure('FORBIDDEN', 'Internal secret diperlukan.', 403, [], startedAt))
  }
  return null
}

export async function caregiverDashboardHandler(c: Context<{ Bindings: Env }>) {
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

export async function handleXenditWebhook(c: Context<{ Bindings: Env }>, startedAt: number) {
  const body = await c.req.json() as { id?: string; external_id?: string; amount?: number; status?: string; paid_at?: string; currency?: string }
  const eventId = body.id || ''
  if (!eventId || !body.external_id) return jsonResponse(c, failure('VALIDATION_ERROR', 'Event id dan external_id wajib.', 400, [], startedAt))

  // Dedup
  const existing = await c.env.DB.prepare('SELECT id, processed FROM HL_paymentEvents WHERE provider = ? AND providerEventId = ?').bind('xendit', eventId).first<{ id: number; processed: number }>()
  if (existing) return jsonResponse(c, success({ provider: 'xendit', providerEventId: eventId, processed: existing.processed === 1, duplicate: true }, 200, startedAt))

  // Record event
  const payResult = await c.env.DB.prepare('INSERT INTO HL_paymentEvents (provider, eventType, providerEventId, payloadJson, processed, createdAt) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)').bind('xendit', body.status || 'unknown', eventId, JSON.stringify({ id: eventId, status: body.status, external_id: body.external_id, amount: body.amount, currency: body.currency }))
  const payId = await insertAndGetId(payResult)

  // Look up checkout session by merchantRef
  const session = await CheckoutSessionService.getByMerchantRef(c.env.DB, body.external_id || '')
  if (!session) {
    await AuditService.write(c.env.DB, { userId: null, action: 'billing.webhook.rejected', entityType: 'HL_paymentEvents', entityId: String(payId), metadataJson: JSON.stringify({ reason: 'unknown_merchantRef', external_id: body.external_id }) })
    return jsonResponse(c, success({ provider: 'xendit', providerEventId: eventId, processed: true, acknowledged: true, unknownMerchantRef: true }, 200, startedAt))
  }

  // Verify amount/currency (mandatory)
  if (body.amount === undefined || body.amount === null) {
    await AuditService.write(c.env.DB, { userId: session.userId, action: 'billing.webhook.rejected', entityType: 'HL_billingCheckoutSessions', entityId: session.id, metadataJson: JSON.stringify({ reason: 'amount_missing' }) })
    return jsonResponse(c, failure('VALIDATION_ERROR', 'Jumlah tidak ditemukan dalam webhook.', 400, [], startedAt))
  }
  if (body.amount !== session.amount) {
    await AuditService.write(c.env.DB, { userId: session.userId, action: 'billing.webhook.rejected', entityType: 'HL_billingCheckoutSessions', entityId: session.id, metadataJson: JSON.stringify({ reason: 'amount_mismatch', expected: session.amount, received: body.amount }) })
    return jsonResponse(c, failure('VALIDATION_ERROR', 'Jumlah tidak cocok.', 400, [], startedAt))
  }

  // Process paid
  const status = (body.status || '').toUpperCase()
  if (status === 'PAID' || status === 'SETTLED') {
    await CheckoutSessionService.markPaid(c.env.DB, session.id, body.paid_at)
    try {
      await SubscriptionActivationService.activatePaidSubscription(c.env.DB, session.userId, session.planCode, session.id, eventId)
    } catch (e) {
      console.error('Xendit webhook subscription activation failed:', (e as Error)?.message || e)
      await c.env.DB.prepare('UPDATE HL_paymentEvents SET processed = 0, processedAt = NULL WHERE id = ?').bind(payId).run()
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal mengaktifkan subscription.', 500, [], startedAt))
    }
  } else if (status === 'EXPIRED') {
    await CheckoutSessionService.markExpired(c.env.DB, session.id)
  } else if (status === 'FAILED') {
    await CheckoutSessionService.markFailed(c.env.DB, session.id)
  }

  await c.env.DB.prepare('UPDATE HL_paymentEvents SET processed = 1, processedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(payId).run()
  await AuditService.write(c.env.DB, { userId: session.userId, action: status === 'PAID' ? 'billing.webhook.received' : 'billing.webhook.duplicate', entityType: 'HL_billingCheckoutSessions', entityId: session.id, metadataJson: JSON.stringify({ provider: 'xendit', providerEventId: eventId, status: body.status }) })

  return jsonResponse(c, success({ provider: 'xendit', providerEventId: eventId, processed: true, subscriptionActivated: status === 'PAID' }, 200, startedAt))
}

export async function handleMockWebhook(c: Context<{ Bindings: Env }>, startedAt: number, userId: number) {
  const body = await c.req.json() as { checkoutId?: string; status?: string }
  if (!body.checkoutId) return jsonResponse(c, failure('VALIDATION_ERROR', 'checkoutId wajib.', 400, [], startedAt))
  const status = body.status || 'paid'

  const session = await CheckoutSessionService.getById(c.env.DB, body.checkoutId)
  if (!session) return jsonResponse(c, failure('NOT_FOUND', 'Checkout tidak ditemukan.', 404, [], startedAt))
  if (session.userId !== userId) return jsonResponse(c, failure('FORBIDDEN', 'Akses ditolak.', 403, [], startedAt))

  const eventId = `mock_${body.checkoutId}_${status}`
  const existing = await c.env.DB.prepare('SELECT id FROM HL_paymentEvents WHERE provider = ? AND providerEventId = ?').bind('manual', eventId).first<{ id: number }>()
  if (existing) return jsonResponse(c, success({ provider: 'mock', processed: true, duplicate: true }, 200, startedAt))

  const payResult = await c.env.DB.prepare('INSERT INTO HL_paymentEvents (provider, eventType, providerEventId, payloadJson, processed, createdAt) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)').bind('manual', status, eventId, JSON.stringify({ checkoutId: body.checkoutId, status }))
  const payId = await insertAndGetId(payResult)

  if (status === 'paid') {
    await CheckoutSessionService.markPaid(c.env.DB, session.id)
    try {
      await SubscriptionActivationService.activatePaidSubscription(c.env.DB, session.userId, session.planCode, session.id, eventId, 'manual')
    } catch (e) {
      console.error('Mock webhook subscription activation failed:', (e as Error)?.message || e)
      return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal mengaktifkan subscription.', 500, [], startedAt))
    }
  } else if (status === 'failed') {
    await CheckoutSessionService.markFailed(c.env.DB, session.id)
  }

  await AuditService.write(c.env.DB, { userId: session.userId, action: 'billing.mock.webhook', entityType: 'HL_billingCheckoutSessions', entityId: session.id, metadataJson: JSON.stringify({ status }) })

  return jsonResponse(c, success({ provider: 'mock', processed: true, subscriptionActivated: status === 'paid' }, 200, startedAt))
}
