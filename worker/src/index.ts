import { mountAuthRoutes } from "./routes-auth.js"
import { mountHydrationRoutes } from "./routes-hydration.js"
import { mountAiRoutes } from "./routes-ai.js"
import { mountCycleRoutes } from "./routes-cycle.js"
import { mountTelegramRoutes } from "./routes-telegram.js"
import { mountAdminRoutes } from "./routes-admin.js"
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Env, ApiErrorCode } from './types.js'
import {
  mountExtraRoutes,
  scheduledHandler,
  updateDailyStreak,
  awardBadges,
  createEmergencyAlert,
  sendEmergencyToContacts,
  formatIdShortDateTime,
  type ExtraEnv
} from './routes-extra.js'
import { AuditService } from './services/audit.js'
import { ConfigService, isSensitiveConfigKey } from './services/config.js'
import { EntitlementService, QuotaService } from './services/entitlements.js'
import { EducationService } from "./services/education.js"
import { SymptomService } from "./services/symptom.js"
import { OAuthService } from "./services/oauth.js"
import { RbacService } from './services/rbac.js'
import { AiMemoryService } from './services/ai-memory.js'
import { CryptoService } from './services/crypto.js'
import { EmailOtpService } from './services/email-otp.js'
import { EmailSenderService } from './services/email-sender.js'
import { parseLocale } from './i18n/locale.js'
import { getAiDisclaimer } from './i18n/disclaimer-templates.js'
import { CheckoutSessionService } from './services/billing/checkout-session.js'
import { SubscriptionActivationService } from './services/billing/subscription-activation.js'
import { readBillingConfig } from './services/billing/config.js'
import { MockBillingProvider } from './services/billing/providers/mock.js'
import { XenditBillingProvider } from './services/billing/providers/xendit.js'
import type { BillingProvider } from './services/billing/provider.js'

const app = new Hono<{ Bindings: Env }>()

export type { Env }

type ApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 410 | 429 | 500 | 502

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
  displayName?: unknown
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
  id: number
  email: string
  passwordHash: string | null
  displayName: string
  telegramEnabled: number
  browserPushEnabled: number
  active: number
  lastLoginAt?: string | null
}

type ProfileRow = {
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
const MIN_ONBOARDING_AGE_YEARS = 13

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

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
  const hasDisplayName = input.displayName !== undefined && input.displayName !== null && input.displayName !== ''
  const displayName = hasDisplayName ? (typeof input.displayName === 'string' ? input.displayName.trim() : '') : undefined
  const hasHeightCm = input.heightCm !== undefined && input.heightCm !== null
  const heightCm = hasHeightCm ? (typeof input.heightCm === 'number' ? input.heightCm : Number(input.heightCm)) : undefined
  const hasTimezone = input.timezone !== undefined && input.timezone !== null && input.timezone !== ''
  const timezone = hasTimezone ? (typeof input.timezone === 'string' ? input.timezone.trim() : '') : undefined
  const theme = typeof input.theme === 'string' ? input.theme : undefined
  const accessibilityMode =
    typeof input.accessibilityMode === 'string' ? input.accessibilityMode : undefined

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
  return CryptoService.hashPassword(password)
}

async function verifyPassword(password: string, storedHash: string | null) {
  return CryptoService.verifyPassword(password, storedHash)
}

async function sha256Token(value: string) {
  return CryptoService.sha256Token(value)
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

async function getSensitiveDataKey(c: Context<{ Bindings: Env }>) {
  const secret = c.env.ENCRYPTION_KEY
  if (!secret || secret.trim().length < 16) {
    throw new Error('ENCRYPTION_KEY is required for sensitive data encryption')
  }
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

function isEncryptedSensitiveValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('enc:v1:')
}

async function encryptSensitive(c: Context<{ Bindings: Env }>, value: string | null | undefined): Promise<string | null> {
  if (!value) return null
  if (isEncryptedSensitiveValue(value)) return value
  const key = await getSensitiveDataKey(c)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(value))
  return `enc:v1:${base64Url(iv)}:${base64Url(encrypted)}`
}

async function decryptSensitive(c: Context<{ Bindings: Env }>, value: string | null | undefined): Promise<string | null> {
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

function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
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

function idsEqual(left: unknown, right: unknown): boolean {
  return Number(left) === Number(right)
}

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
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
const systemConfigCacheByDb: WeakMap<object, Map<string, { value: string; expiresAt: number }>> = new WeakMap()

function getSystemConfigCache(db: object): Map<string, { value: string; expiresAt: number }> {
  let cache = systemConfigCacheByDb.get(db)
  if (!cache) {
    cache = new Map()
    systemConfigCacheByDb.set(db, cache)
  }
  return cache
}

function readSystemConfigCache(db: object, configKey: string): string | null {
  const cache = getSystemConfigCache(db)
  const entry = cache.get(configKey)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(configKey)
    return null
  }
  return entry.value
}

function writeSystemConfigCache(db: object, configKey: string, value: string) {
  getSystemConfigCache(db).set(configKey, { value, expiresAt: Date.now() + SYSTEM_CONFIG_TTL_MS })
}

function invalidateSystemConfigCache(db: object | null, configKey?: string) {
  if (!db) return
  const cache = getSystemConfigCache(db)
  if (configKey) {
    cache.delete(configKey)
    return
  }
  cache.clear()
}

async function getSystemConfigNumber(c: Context<{ Bindings: Env }>, configKey: string) {
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

async function getSystemConfigString(c: Context<{ Bindings: Env }>, configKey: string): Promise<string | null> {
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

async function getSystemConfigBoolean(c: Context<{ Bindings: Env }>, configKey: string, fallback = false): Promise<boolean> {
  const value = await getSystemConfigString(c, configKey)
  if (value === null) return fallback
  return ['1', 'true', 'yes', 'on', 'enabled'].includes(value.toLowerCase())
}

async function resolveTelegramBotToken(c: Context<{ Bindings: Env }>): Promise<{ token?: string; error?: string }> {
  const botActive = await getSystemConfigBoolean(c, 'telegramBotActive', true)
  if (!botActive) return { error: 'telegram_bot_disabled' }

  const token = await getSystemConfigString(c, 'telegramBotToken') || c.env.TELEGRAM_BOT_TOKEN
  if (!token) return { error: 'bot_token_not_configured' }

  return { token }
}

async function validateTelegramBotToken(c: Context<{ Bindings: Env }>): Promise<{ valid: boolean; bot?: unknown; error?: string }> {
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

async function createSession(c: Context<{ Bindings: Env }>, userId: number) {
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

  let existing: { id: number; active: number } | null

  try {
    existing = await c.env.DB.prepare('SELECT id, active FROM HL_users WHERE email = ? LIMIT 1')
      .bind(validation.data.email)
      .first<{ id: number; active: number }>()
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

  if (existing && existing.active === 1) {
    const result = failure(
      'EMAIL_ALREADY_EXISTS',
      'Email sudah terdaftar.',
      409,
      [{ field: 'email', message: 'Gunakan email lain atau login.' }],
      startedAt
    )

    return jsonResponse(c, result)
  }

  if (existing && existing.active === 0) {
    await c.env.DB.prepare('DELETE FROM HL_users WHERE id = ? AND active = 0').bind(existing.id).run()
  }

  let userId: number | null = null

  try {
    const passwordHash = await hashPassword(validation.data.password)
    userId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_users
        (email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, createdAt, updatedAt)
       VALUES (?, ?, 'local', ?, 0, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(validation.data.email, passwordHash, validation.data.displayName))

    await c.env.DB.prepare(
      `INSERT INTO HL_auditLogs
        (userId, action, entityType, entityId, metadataJson, createdAt)
      VALUES (?, 'userRegister', 'HL_users', ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      userId,
      JSON.stringify({
        email: validation.data.email,
        authProvider: 'local'
      })
    ).run()

    const normalizedEmail = EmailOtpService.normalizeEmail(validation.data.email)
    const { challengeId, otp } = await EmailOtpService.createChallenge(c.env.DB, c.env, { userId, normalizedEmail, purpose: 'register' })
    const otpLocale = parseLocale(c.req.raw.headers)
    const sendResult = await EmailSenderService.sendOtp(c.env, normalizedEmail, otp, otpLocale)
    if (!sendResult.sent) {
      if (userId) await c.env.DB.prepare('DELETE FROM HL_users WHERE id = ? AND active = 0').bind(userId).run()
      const result = failure('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim kode verifikasi.', 500, [], startedAt)
      return jsonResponse(c, result)
    }

    const result = success(
      {
        otpRequired: true,
        challengeId,
        maskedEmail: EmailOtpService.maskEmail(normalizedEmail),
        expiresInSeconds: 600
      },
      201,
      startedAt
    )

    return jsonResponse(c, result)
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
      `SELECT id, email, passwordHash, displayName, telegramEnabled, browserPushEnabled, active, lastLoginAt
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

  // ponytail: skip OTP if logged in within 30 days
  const lastLoginSec = user.lastLoginAt ? Date.parse(user.lastLoginAt) : 0
  const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1000
  if (lastLoginSec && Date.now() - lastLoginSec < THIRTY_DAYS_MS) {
    const token = crypto.randomUUID()
    const h = await sha256Token(token)

    try {
      await c.env.DB.prepare('INSERT INTO HL_sessions (userId, sessionTokenHash, createdAt, expiresAt) VALUES (?, ?, CURRENT_TIMESTAMP, datetime("now", "+30 days"))')
        .bind(user.id, h).run()
    } catch {
      const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [])
      return jsonResponse(c, result)
    }

    setCookie(c, 'hlSession', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 30 * 86400
    })

    await c.env.DB.prepare('UPDATE HL_users SET lastLoginAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(user.id).run()

    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'userLogin.passwordOnly',
      entityType: 'HL_users',
      entityId: String(user.id)
    })

    const profile = await c.env.DB.prepare(
      'SELECT id, sex, birthDate, heightCm, timezone, accessibilityMode, theme, emergencyConsent, aiConsent, dataShareConsent FROM HL_userProfiles WHERE userId = ?'
    ).bind(user.id).first<any>()

    const result = success({
      user: { id: user.id, email: user.email, displayName: user.displayName, telegramEnabled: !!user.telegramEnabled, browserPushEnabled: !!user.browserPushEnabled },
      profile,
      requiresOnboarding: !profile
    }, 200, startedAt)

    return jsonResponse(c, result)
  }

  try {
    const normalizedEmail = EmailOtpService.normalizeEmail(validation.data.email)
    const { challengeId, otp } = await EmailOtpService.createChallenge(c.env.DB, c.env, { userId: user.id, normalizedEmail, purpose: 'login' })
    const otpLocale = parseLocale(c.req.raw.headers)
    const sendResult = await EmailSenderService.sendOtp(c.env, normalizedEmail, otp, otpLocale)
    if (!sendResult.sent) {
      const result = failure('EMAIL_OTP_SEND_FAILED', 'Gagal mengirim kode verifikasi.', 500, [], startedAt)
      return jsonResponse(c, result)
    }

    const result = success(
      {
        otpRequired: true,
        challengeId,
        maskedEmail: EmailOtpService.maskEmail(normalizedEmail),
        expiresInSeconds: 600
      },
      200,
      startedAt
    )

    return jsonResponse(c, result)
  } catch (error) {
    console.error('login otp create failed', error)

    const result = failure('INTERNAL_ERROR', 'Login gagal diproses.', 500, [])
    return jsonResponse(c, result)
  }
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
          profileId: number | null
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

    const [roles, permissions] = await Promise.all([
      RbacService.getUserRoles(c.env.DB, row.id),
      RbacService.getUserPermissions(c.env.DB, row.id)
    ])

    const result = success(
      {
        user: publicUser(row),
        profile: publicProfile(profile),
        roles: roles.map(r => r.roleCode),
        permissions,
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
      .first<{ id: number }>()

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

    const profileId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_userProfiles
        (userId, sex, birthDate, heightCm, timezone, accessibilityMode, theme,
         emergencyConsent, aiConsent, dataShareConsent, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      user.id,
      validation.data.sex,
      validation.data.birthDate,
      validation.data.heightCm,
      validation.data.timezone,
      validation.data.accessibilityMode,
      validation.data.theme,
      validation.data.aiConsent ? 1 : 0
    ))

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO HL_userConsents
          (userId, consentType, consentValue, consentText, version, createdAt, updatedAt)
         VALUES (?, 'aiConsent', ?, ?, '2026-06-20', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(
        user.id,
        validation.data.aiConsent ? 1 : 0,
        'User consent for AI-assisted extraction and safe summaries.'
      ),
      c.env.DB.prepare(
        'UPDATE HL_users SET displayName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(validation.data.displayName, user.id),
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, 'profileOnboardingComplete', 'HL_userProfiles', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
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

app.get('/api/me/preferences', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)
  if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
  try {
    const row = await c.env.DB.prepare('SELECT preferredLocale FROM HL_userProfiles WHERE userId = ?').bind(user.id).first<{ preferredLocale: string | null }>()
    return jsonResponse(c, success({ preferredLocale: row?.preferredLocale || 'id-ID' }, 200, startedAt))
  } catch { return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat preferensi.', 500, [], startedAt)) }
})

app.put('/api/me/preferences', async (c) => {
  const startedAt = Date.now()
  const user = await getAuthenticatedUser(c)
  if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
  try {
    const body = await c.req.json<{ preferredLocale?: string }>()
    const locale = body.preferredLocale
    if (!locale || !['id-ID', 'en-US'].includes(locale)) return jsonResponse(c, failure('VALIDATION_ERROR', 'Locale tidak valid. Gunakan id-ID atau en-US.', 400, [], startedAt))
    await c.env.DB.prepare('UPDATE HL_userProfiles SET preferredLocale = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?').bind(locale, user.id).run()
    return jsonResponse(c, success({ updated: true, preferredLocale: locale }, 200, startedAt))
  } catch { return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menyimpan preferensi.', 500, [], startedAt)) }
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

    const nextHeightCm = validation.data.heightCm ?? existingProfile.heightCm
    const nextTimezone = validation.data.timezone ?? existingProfile.timezone
    const nextTheme = validation.data.theme ?? existingProfile.theme
    const nextAccessibilityMode =
      validation.data.accessibilityMode ?? existingProfile.accessibilityMode
    const nextDisplayName = validation.data.displayName ?? undefined

    const batchStmts = [
      c.env.DB.prepare(
        `UPDATE HL_userProfiles
         SET heightCm = ?, timezone = ?, theme = ?, accessibilityMode = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE userId = ?`
      ).bind(
        nextHeightCm,
        nextTimezone,
        nextTheme,
        nextAccessibilityMode,
        user.id
      ),
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, 'profileUpdate', 'HL_userProfiles', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
        user.id,
        existingProfile.id,
        JSON.stringify({
          changedFields: ['heightCm', 'timezone', 'theme', 'accessibilityMode'].filter((field) => {
            if (field === 'heightCm') {
              return nextHeightCm !== existingProfile.heightCm
            }
            if (field === 'timezone') {
              return nextTimezone !== existingProfile.timezone
            }
            if (field === 'theme') {
              return nextTheme !== existingProfile.theme
            }
            return nextAccessibilityMode !== existingProfile.accessibilityMode
          })
        })
      )
    ]

    if (nextDisplayName) {
      batchStmts.push(
        c.env.DB.prepare('UPDATE HL_users SET displayName = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(nextDisplayName, user.id)
      )
    }

    await c.env.DB.batch(batchStmts)

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

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE HL_userProfiles
         SET theme = ?, accessibilityMode = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE userId = ?`
      ).bind(validation.data.theme, validation.data.accessibilityMode, user.id),
      c.env.DB.prepare(
        `INSERT INTO HL_auditLogs
          (userId, action, entityType, entityId, metadataJson, createdAt)
         VALUES (?, 'uiSettingsUpdate', 'HL_userProfiles', ?, ?, CURRENT_TIMESTAMP)`
      ).bind(
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

// Forgot password — generates a token and (in production) emails it. For now, returns success.
app.post('/api/auth/forgot-password', async (c) => {
  const startedAt = Date.now()
  try {
    const body = await c.req.json() as { email?: string }
    if (!body.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Format email tidak valid.', 400, [], startedAt))
    }
    const user = await c.env.DB.prepare('SELECT id, email FROM HL_users WHERE email = ? AND active = 1').bind(body.email).first<{ id: number; email: string }>()
    // Always return success to avoid leaking which emails are registered
    return jsonResponse(c, success({
      message: 'Jika email terdaftar, link reset password akan dikirim.',
      sent: true
    }, 200, startedAt))
  } catch (error) {
    console.error('forgot-password error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memproses permintaan.', 500, [], startedAt))
  }
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

type RuleEvaluation = {
  status: string
  severity: string
  emergencyLevel: string
  popupTitle: string | null
  popupMessage: string | null
  recommendation: string | null
  sourceLabel: string | null
  ruleId: number | null
}

async function getCurrentSession(c: Context<{ Bindings: Env }>) {
  const sessionToken = getCookie(c, 'hlSession')
  if (!sessionToken) return null
  const sessionTokenHash = await sha256Token(sessionToken)
  const row = await c.env.DB.prepare(
    'SELECT userId FROM HL_sessions WHERE sessionTokenHash = ? AND expiresAt > datetime("now") AND revokedAt IS NULL'
  ).bind(sessionTokenHash).first<{ userId: number }>()
  return row?.userId ?? null
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

async function logNotification(
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
      badgesData = await awardBadges(c as any, userId, streakData.currentCount)
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

app.get('/api/measurements/history', async (c) => {
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
app.get('/api/measurements/last', async (c) => {
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
app.post('/api/measurements/last/save', async (c) => {
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
app.get('/api/measurements/today', async (c) => {
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

app.get('/api/measurements/attachments/:id', async (c) => {
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

// AI Recommendation Endpoint
const FORBIDDEN_PHRASES = [
  'resep obat', 'dosis', 'mg per hari', 'minum obat', 'berhenti minum',
  'anda harus operasi', 'anda terjangkit',
  'prescription', 'take this medication',
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

function extractPatternScore(text: string): number {
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

type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type AiTextResult = {
  text: string
  model: string
}

async function getAiTextModels(c: Context<{ Bindings: Env }>): Promise<string[]> {
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

async function callConfiguredTextAi(
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

async function getRecentValues(c: Context<{ Bindings: Env }>, userId: number, days: number) {
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

    const prompt = `Anda analis kesehatan senior. Analisis data berikut dan beri interpretasi SPESIFIK:

Data: ${JSON.stringify(summary)}

WAJIB:
- Beri skor kesehatan (1-10) berdasarkan data
- Sebut kondisi jika indikasi jelas (misal: hipertensi, underweight, dll)
- Rekomendasi konkret berdasarkan data aktual
- Jangan bermain aman, langsung pada data
- MAKSIMAL 3 kalimat dalam Bahasa Indonesia`

    let recommendationText = 'Rekomendasi tidak tersedia saat ini. Jaga pola makan seimbang, istirahat cukup, dan hidrasi yang baik.'
    let safetyStatus: 'safe' | 'filtered' | 'fallback' = 'fallback'
    let modelName = 'deterministic-fallback'

    const aiResult = await callConfiguredTextAi(c, [
      {
        role: 'system',
        content: 'Anda analis kesehatan senior. Bersikap spesifik dan berani berdasarkan data. Beri skor dan interpretasi langsung dalam Bahasa Indonesia.'
      },
      { role: 'user', content: prompt }
    ], 300)
    if (aiResult) {
      const filtered = filterUnsafeContent(aiResult.text)
      recommendationText = filtered.filtered
      safetyStatus = filtered.safe ? 'safe' : 'filtered'
      modelName = aiResult.model
    }

    const recId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_aiRecommendations
       (userId, sessionId, summaryText, todayJson, threeDayJson, sevenDayJson, ruleStatusJson, modelName, durationMs, safetyStatus, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      sessionId || null,
      recommendationText,
      JSON.stringify(summary.today),
      JSON.stringify(last3Days),
      JSON.stringify(last7Days),
      JSON.stringify((todayValues.results || []).map(v => ({ metric: v.metricCode, status: v.status, severity: v.severity }))),
      modelName,
      Date.now() - startedAt,
      safetyStatus
    ))

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

app.post('/api/ai/assistant', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))

    const body = await c.req.json().catch(() => ({})) as { question?: string; clinicalCopilotMode?: boolean }
    if (body.clinicalCopilotMode) return c.json({ success: false, error: { code: 'AI_CLINICAL_COPILOT_DEFERRED', message: 'AI Clinical Copilot runtime is deferred to Sprint 6.', details: [{ scopeStatus: 'deferred_to_sprint6' }] }, meta: { requestId: `req_${startedAt}`, durationMs: Date.now() - startedAt } }, 403)
    const ent = await EntitlementService.requireEntitlement(c.env.DB, userId, 'feature.aiAssistant.use')
    if (!ent.allowed) return jsonResponse(c, failure('ENTITLEMENT_REQUIRED', 'Fitur AI memerlukan paket Premium.', 403, [{ featureCode: ent.featureCode, planCode: ent.planCode }], startedAt))
    const question = (body.question || '').trim()
    if (!question) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'question wajib.', 400, [], startedAt))
    }

    const profile = await c.env.DB.prepare(
      `SELECT u.displayName, p.heightCm, p.sex, p.birthDate
       FROM HL_users u
       LEFT JOIN HL_userProfiles p ON p.userId = u.id
       WHERE u.id = ?`
    ).bind(userId).first<{ displayName: string; heightCm: number | null; sex: string | null; birthDate: string | null }>()

    const latestValues = await c.env.DB.prepare(
      `SELECT metricCode, finalValue, unit, status, severity, measuredAt
       FROM HL_measurementValues
       WHERE userId = ?
       ORDER BY measuredAt DESC
       LIMIT 8`
    ).bind(userId).all<{
      metricCode: string
      finalValue: number
      unit: string
      status: string
      severity: string
      measuredAt: string
    }>()

    const vitals = (latestValues.results || []).map((value) => ({
      metricCode: value.metricCode,
      finalValue: value.finalValue,
      unit: value.unit,
      status: value.status,
      severity: value.severity,
      measuredAt: value.measuredAt
    }))

    const contextSummary = vitals.length > 0
      ? vitals
          .map((value) => `${value.metricCode}: ${value.finalValue} ${value.unit} (${value.status}, ${value.severity})`)
          .join('; ')
      : 'Belum ada data vital terbaru.'

    let reply = [
      `Pertanyaan Anda: ${question}.`,
      `Konteks pengukuran saat ini: ${contextSummary}`,
      'Saran umum: pilih makanan rendah garam, cukup minum air, istirahat cukup, dan tetap konsultasikan keputusan medis ke dokter.'
    ].join(' ')
    let model = 'deterministic-fallback'
    let usedFallback = true

    const aiResult = await callConfiguredTextAi(c, [
      {
        role: 'system',
        content:
          'Anda adalah seorang Dokter Senior dan Spesialis Medis untuk aplikasi HL Health Companion. Anda memiliki akses ke seluruh data historis dan metrik kesehatan pengguna. Lakukan analisa mendalam terhadap kondisi pasien berdasarkan data yang diberikan. Berikan "Clinical Confidence Score" (1-100) terhadap analisa Anda. Berikan rekomendasi medis, peringatan, dan insight layaknya dokter spesialis. WAJIB akhiri respons Anda dengan teks berikut tanpa diubah: \n"[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."'
      },
      {
        role: 'user',
        content: `Profil: ${JSON.stringify(profile || {})}\nVitals terbaru: ${JSON.stringify(vitals)}\nPertanyaan: ${question}`
      }
    ], 220)
    if (aiResult) {
      const filtered = filterUnsafeContent(aiResult.text)
      let assistantReply = filtered.filtered
      assistantReply = AiMemoryService.enforceDisclaimer(assistantReply, aiResult.model)
      const patternScore = extractPatternScore(assistantReply)
      reply = assistantReply
      model = aiResult.model
      usedFallback = false
      const context = await AiMemoryService.buildContextPackage(c.env.DB, userId)
      const { score: dataSufficiencyScore, scoreReason } = AiMemoryService.calculateDataSufficiency(context)
      const contextTrace = vitals.map(v => ({ metricCode: v.metricCode, measuredAt: v.measuredAt, sourceType: 'measurement', source: 'HL_measurementValues' }))

      return jsonResponse(
        c,
        success(
          {
            reply,
            patternScore,
            disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)),
            model,
            usedFallback,
            vitals,
            profile: profile || null,
            dataSufficiencyScore,
            scoreReason,
            contextTrace,
            usedVectorContext: false
          },
          200,
          startedAt
        )
      )
    }

    return jsonResponse(
      c,
      success(
        {
      reply,
      patternScore: 0,
      disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)),
      model,
      usedFallback,
      vitals,
      profile: profile || null,
      dataSufficiencyScore: 0,
      scoreReason: 'Data kurang untuk analisis',
      contextTrace: vitals.map(v => ({ metricCode: v.metricCode, measuredAt: v.measuredAt, sourceType: 'measurement', source: 'HL_measurementValues' })),
          usedVectorContext: false
        },
        200,
        startedAt
      )
    )
  } catch (error) {
    console.error('ai assistant endpoint error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Asisten AI gagal merespons.', 500, [], startedAt))
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

app.get('/api/reports/daily', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const profileInfo = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ? LIMIT 1').bind(userId).first<{ timezone: string }>()
    const timezone = profileInfo?.timezone || 'UTC'
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    const today = formatter.format(new Date())

    // Fetch from 48h window then filter in JS by user-timezone date (measuredAt stored in UTC)
    const windowStart = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    const allValues = await c.env.DB.prepare(
      `SELECT v.sessionId, v.metricCode, v.finalValue, v.unit, v.status, v.severity, v.manualOverride, v.measuredAt,
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

    return jsonResponse(c, success({
      period: 'daily',
      date: today,
      sessionCount: todaysSessions.length,
      hasData: todaysValues.length > 0,
      values: todaysValues,
      sessions: todaysSessions,
      emptyMessage: todaysSessions.length === 0
        ? 'Belum ada pengukuran hari ini. Yuk mulai catat pengukuran.'
        : (todaysValues.length === 0 ? 'Sesi tercatat tetapi belum ada nilai yang tersimpan.' : null)
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

    // AI monthly summary - use configured LLM if available, else rule-based
    let aiSummary = 'Ringkasan 30 hari belum tersedia.'
    const summary = (values.results || []).map((m: any) =>
      `${m.metricCode}: avg ${m.avg?.toFixed(1)} (min ${m.min}, max ${m.max}, latest ${m.latest})`
    ).join('; ')
    const monthlyAi = await callConfiguredTextAi(c, [
      {
        role: 'system',
        content: 'Buat ringkasan kesehatan aman. Jangan mendiagnosis, jangan menyarankan dosis obat, dan jangan menentukan keparahan medis final.'
      },
      {
        role: 'user',
        content: `Buat ringkasan naratif singkat 30 hari kesehatan user berdasarkan data berikut dalam Bahasa Indonesia. Hanya edukasi umum.\n\nData: ${summary}`
      }
    ], 400)
    if (monthlyAi) {
      aiSummary = filterUnsafeContent(monthlyAi.text).filtered
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

app.get('/api/history/timeline', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const { from, to, types, limit, cursor } = c.req.query()
    const typeSet = new Set((types || 'measurement,symptom,hydration,safetyEvent,cycle').split(','))
    const limitN = Math.min(Number(limit) || 50, 100)
    const items: any[] = []
    if (typeSet.has('measurement')) {
      const rows = await c.env.DB.prepare(`SELECT v.id, v.metricCode, v.finalValue, v.unit, v.status, v.severity, s.measuredAt FROM HL_measurementValues v JOIN HL_measurementSessions s ON s.id = v.sessionId WHERE s.userId = ? AND date(s.measuredAt) >= ? AND date(s.measuredAt) <= ? ORDER BY s.measuredAt DESC LIMIT ?`).bind(userId, from || '2026-01-01', to || '2099-12-31', limitN).all<any>()
      for (const r of rows.results || []) items.push({ rowType: 'measurement', sourceId: String(r.id), occurredAt: r.measuredAt, title: `Pengukuran ${r.metricCode}`, severity: r.severity || r.status || 'normal', summary: `${r.finalValue} ${r.unit || ''}` })
    }
    if (typeSet.has('symptom')) {
      const rows = await c.env.DB.prepare(`SELECT id, symptomDateTime, quickSymptomsJson, bodyArea, painScale, isRedFlag FROM HL_symptomLogs WHERE userId = ? AND date(symptomDateTime) >= ? AND date(symptomDateTime) <= ? ORDER BY symptomDateTime DESC LIMIT ?`).bind(userId, from || '2026-01-01', to || '2099-12-31', limitN).all<any>()
      for (const r of rows.results || []) items.push({ rowType: 'symptom', sourceId: String(r.id), occurredAt: r.symptomDateTime, title: `Keluhan: ${r.bodyArea || r.quickSymptomsJson || '-'}`, severity: r.isRedFlag ? 'emergency' : 'normal', summary: r.painScale ? `Skala nyeri ${r.painScale}/10` : '', isRedFlag: !!r.isRedFlag })
    }
    if (typeSet.has('hydration')) {
      const rows = await c.env.DB.prepare(`SELECT id, logDate, amountMl, source FROM HL_waterIntakeLogs WHERE userId = ? AND date(logDate) >= ? AND date(logDate) <= ? ORDER BY logDate DESC LIMIT ?`).bind(userId, from || '2026-01-01', to || '2099-12-31', limitN).all<any>()
      for (const r of rows.results || []) items.push({ rowType: 'hydration', sourceId: String(r.id), occurredAt: r.logDate, title: 'Minum Air', severity: 'normal', summary: `${r.amountMl}ml via ${r.source || 'web'}` })
    }
    if (typeSet.has('safetyEvent')) {
      const rows = await c.env.DB.prepare(`SELECT id, sourceType, eventType, severity, title, createdAt FROM HL_safetyEvents WHERE userId = ? AND date(createdAt) >= ? AND date(createdAt) <= ? ORDER BY createdAt DESC LIMIT ?`).bind(userId, from || '2026-01-01', to || '2099-12-31', limitN).all<any>()
      for (const r of rows.results || []) items.push({ rowType: 'safetyEvent', sourceId: String(r.id), occurredAt: r.createdAt, title: r.title || r.eventType, severity: r.severity || 'normal', summary: r.eventType })
    }
    if (typeSet.has('cycle')) {
      const rows = await c.env.DB.prepare(`SELECT id, logDate, flowIntensity, physicalSymptomsJson FROM HL_cycleLogs WHERE userId = ? AND date(logDate) >= ? AND date(logDate) <= ? ORDER BY logDate DESC LIMIT ?`).bind(userId, from || '2026-01-01', to || '2099-12-31', limitN).all<any>()
      for (const r of rows.results || []) items.push({ rowType: 'cycle', sourceId: String(r.id), occurredAt: r.logDate, title: 'Log Siklus', severity: 'normal', summary: r.flowIntensity ? `Flow: ${r.flowIntensity}` : (r.physicalSymptomsJson || 'Cycle log') })
    }
    items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    const hasMore = items.length > limitN
    const sliced = hasMore ? items.slice(0, limitN) : items
    return c.json({ success: true, data: sliced, meta: { ...jsonMeta(startedAt), hasMore } }, 200)
  } catch (error) {
    console.error('history timeline error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat timeline.', 500, [], startedAt))
  }
})

// AI analysis for daily/weekly/monthly reports (US-2.3.1 + US-2.3.4)
app.post('/api/ai/report-analysis', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))

    const body = await c.req.json() as { reportType?: string; context?: string; clinicalCopilotMode?: boolean }
    if (body.clinicalCopilotMode) return c.json({ success: false, error: { code: 'AI_CLINICAL_COPILOT_DEFERRED', message: 'AI Clinical Copilot runtime is deferred to Sprint 6.', details: [{ scopeStatus: 'deferred_to_sprint6' }] }, meta: { requestId: `req_${startedAt}`, durationMs: Date.now() - startedAt } }, 403)
    const reportType = body?.reportType
    if (reportType !== 'daily' && reportType !== 'weekly' && reportType !== 'monthly') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'reportType harus daily/weekly/monthly.', 400, [], startedAt))
    }
    const context = (body?.context || '').slice(0, 2000)

    const prompt = `Anda adalah seorang Dokter Senior dan Spesialis Medis untuk aplikasi HL Health Companion. Anda memiliki akses ke seluruh data historis dan metrik kesehatan pengguna.
1. Lakukan ANALISA MENDALAM dan AGRESIF terhadap kondisi pasien berdasarkan data laporan berikut.
2. Berikan "Clinical Confidence Score" (1-100) terhadap analisa Anda beserta justifikasi singkat.
3. Berikan rekomendasi medis, peringatan, dan insight layaknya dokter spesialis yang sedang mendiagnosis pasien.

Data laporan ${reportType}:
${context}

WAJIB sertakan teks ini tepat di akhir respons Anda TANPA DIUBAH sedikit pun:
"[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."`

    const messages: AiChatMessage[] = [
      { role: 'system', content: 'Anda adalah Dokter Senior dan Spesialis Medis. Analisa pasien secara mendalam, berikan Clinical Confidence Score, dan akhiri dengan disclaimer tanggung jawab medis.' },
      { role: 'user', content: prompt }
    ]

    const aiResult = await callConfiguredTextAi(c, messages, 400)
    if (aiResult) {
      let analysis = aiResult.text
      analysis = AiMemoryService.enforceDisclaimer(analysis, aiResult.model)
      const patternScore = extractPatternScore(analysis)
      return jsonResponse(c, success({ analysis, patternScore, model: aiResult.model, disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)), usedFallback: false }, 200, startedAt))
    }
    return jsonResponse(c, success({
      analysis: 'AI tidak tersedia saat ini. Silakan konsultasi dengan dokter untuk interpretasi data Anda.',
      patternScore: 0,
      model: 'fallback',
      disclaimer: getAiDisclaimer(parseLocale(c.req.raw.headers)),
      usedFallback: true
    }, 200, startedAt))
  } catch (error) {
    console.error('report analysis error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menganalisa data.', 500, [], startedAt))
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
app.get('/api/telegram/status', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const link = await c.env.DB.prepare(
      'SELECT telegramChatId, verified, enabled FROM HL_telegramLinks WHERE userId = ? LIMIT 1'
    ).bind(userId).first<{ telegramChatId: string; verified: number; enabled: number }>()
    return jsonResponse(c, success({ linked: !!link?.verified && !!link?.enabled, telegramChatId: link?.telegramChatId ? '***' : null, enabled: !!link?.enabled }, 200, startedAt))
  } catch (error) {
    console.error('telegram status error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt))
  }
})

app.post('/api/telegram/connect', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const codeHash = await sha256Token(code)
    await c.env.DB.prepare(
      `INSERT INTO HL_telegramLinks (userId, verificationCodeHash, verified, enabled, createdAt, updatedAt)
       VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(userId) DO UPDATE SET verificationCodeHash = excluded.verificationCodeHash, updatedAt = CURRENT_TIMESTAMP`
    ).bind(userId, codeHash).run()
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
    const tokenCheck = await validateTelegramBotToken(c)
    if (!tokenCheck.valid) {
      await logNotification(c, userId, 'telegram', 'submit_summary', 'Test Telegram', 'Token Telegram tidak valid.',
        'failed', { botTokenValid: false }, tokenCheck.error)
      return jsonResponse(c, success({ sent: false, botTokenValid: false, error: tokenCheck.error }, 200, startedAt))
    }
    const tg = await sendTelegramNotification(c, userId, 'submit_summary', 'Test Telegram', 'Pesan test dari HL Health Companion.')
    await logNotification(c, userId, 'telegram', 'submit_summary', 'Test Telegram', 'Pesan test dari HL Health Companion.',
      tg.sent ? 'sent' : 'skipped', { botTokenValid: true }, tg.error)
    return jsonResponse(c, success({ sent: tg.sent, botTokenValid: true, error: tg.error }, 200, startedAt))
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
    const body = await c.req.json().catch(() => ({})) as {
      email?: string
      inviteEmail?: string
      role?: string
      permissions?: {
        canViewDashboard?: boolean
        canInputMeasurement?: boolean
        canReceiveAlert?: boolean
      }
    }
    const inviteEmail = (body.inviteEmail || body.email || '').trim().toLowerCase()
    if (!inviteEmail) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'inviteEmail wajib.', 400, [], startedAt))
    }
    const shareToken = crypto.randomUUID().replace(/-/g, '')
    const shareTokenHash = await sha256Token(shareToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const role = body.role || 'caregiver'
    const permissions = {
      canViewDashboard: body.permissions?.canViewDashboard !== false,
      canInputMeasurement: Boolean(body.permissions?.canInputMeasurement),
      canReceiveAlert: body.permissions?.canReceiveAlert !== false
    }
    const inviteId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_familyInvites (ownerUserId, inviteEmail, role, inviteTokenHash, status, expiresAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, inviteEmail, role, shareTokenHash, expiresAt))
    await c.env.DB.prepare(
      `INSERT INTO HL_familyLinks (ownerUserId, linkedUserId, role, status, canViewDashboard, canInputMeasurement, canReceiveAlert, createdAt, updatedAt)
       VALUES (?, NULL, ?, 'pending', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      userId,
      role,
      permissions.canViewDashboard ? 1 : 0,
      permissions.canInputMeasurement ? 1 : 0,
      permissions.canReceiveAlert ? 1 : 0
    ).run()
    return jsonResponse(
      c,
      success(
        {
          inviteId,
          status: 'pending',
          shareToken,
          expiresAt,
          inviteUrl: `/family/accept?token=${shareToken}`
        },
        201,
        startedAt
      )
    )
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

    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE HL_familyInvites SET status = 'accepted', updatedAt = CURRENT_TIMESTAMP WHERE id = ?`).bind(invite.id),
      c.env.DB.prepare(
        `UPDATE HL_familyLinks
         SET linkedUserId = ?, role = ?, status = 'active', updatedAt = CURRENT_TIMESTAMP
         WHERE id = ? AND ownerUserId = ?`
      ).bind(userId, invite.role, invite.id, invite.ownerUserId)
    ])
    return jsonResponse(c, success({ linkId: invite.id, role: invite.role }, 200, startedAt))
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

app.delete('/api/family/:id', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const linkId = c.req.param('id')
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE HL_familyLinks
         SET status = 'revoked', updatedAt = CURRENT_TIMESTAMP
         WHERE id = ? AND (ownerUserId = ? OR linkedUserId = ?)`
      ).bind(linkId, userId, userId),
      c.env.DB.prepare(
        `UPDATE HL_familyInvites
         SET status = 'revoked', updatedAt = CURRENT_TIMESTAMP
         WHERE id = ? AND ownerUserId = ? AND status = 'pending'`
      ).bind(linkId, userId)
    ])
    return jsonResponse(c, success({ revoked: true }, 200, startedAt))
  } catch (error) {
    console.error('family revoke error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal mencabut akses keluarga.', 500, [], startedAt))
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
    const body = await c.req.json() as {
      name?: string
      phone?: string
      relationship?: string
      contactName?: string
      contactPhone?: string
      contactRelation?: string
      telegramChatId?: string
      canReceiveAlert?: boolean
      consentGiven?: boolean
    }
    const contactName = body.contactName || body.name || ''
    const contactPhone = body.contactPhone || body.phone || ''
    const contactRelation = body.contactRelation || body.relationship || null
    if (!contactName || !contactPhone) return jsonResponse(c, failure('VALIDATION_ERROR', 'name dan phone wajib.', 400, [], startedAt))
    const contactId = await (async () => {
      let encryptedName: string = contactName
      let encryptedPhone: string = contactPhone
      let encryptedTelegramChatId: string | null = body.telegramChatId || null
      try {
        const encN = await encryptSensitive(c, contactName)
        const encP = await encryptSensitive(c, contactPhone)
        if (encN) encryptedName = encN
        if (encP) encryptedPhone = encP
        if (body.telegramChatId) { const encT = await encryptSensitive(c, body.telegramChatId); if (encT) encryptedTelegramChatId = encT }
      } catch (encErr) {
        console.warn('emergency contact encrypt fallback to plaintext:', encErr)
      }
      const consentGiven = body.canReceiveAlert || body.consentGiven ? 1 : 0
      return insertAndGetId(c.env.DB.prepare(
        `INSERT INTO HL_emergencyContacts (userId, contactName, contactRelation, contactPhone, telegramChatId, consentGiven, enabled, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(userId, encryptedName, contactRelation, encryptedPhone, encryptedTelegramChatId, consentGiven))
    })()
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
      `SELECT id, contactName, contactPhone, contactRelation, telegramChatId, consentGiven, enabled, createdAt FROM HL_emergencyContacts WHERE userId = ? ORDER BY createdAt DESC`
    ).bind(userId).all<{
      id: string
      contactName: string
      contactPhone: string | null
      contactRelation: string | null
      telegramChatId: string | null
      consentGiven: number
      enabled: number
      createdAt: string
    }>()
    const contacts = await Promise.all((rows.results || []).map(async (row) => {
      const name = await decryptSensitive(c, row.contactName)
      const phone = await decryptSensitive(c, row.contactPhone)
      const telegramChatId = await decryptSensitive(c, row.telegramChatId)
      return {
        ...row,
        contactName: name || '',
        name: name || '',
        contactPhone: phone || '',
        phone: phone || '',
        contactRelation: row.contactRelation,
        relationship: row.contactRelation,
        telegramChatId: telegramChatId || '',
        consentGiven: Boolean(row.consentGiven),
        enabled: Boolean(row.enabled)
      }
    }))
    return jsonResponse(c, success({ contacts }, 200, startedAt))
  } catch (error) {
    console.error('emergency contacts list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal list.', 500, [], startedAt))
  }
})

app.delete('/api/emergency/contacts/:id', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    await c.env.DB.prepare('DELETE FROM HL_emergencyContacts WHERE id = ? AND userId = ?').bind(c.req.param('id'), userId).run()
    return jsonResponse(c, success({ deleted: true }, 200, startedAt))
  } catch (error) {
    console.error('emergency contact delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menghapus kontak darurat.', 500, [], startedAt))
  }
})

// Reminders
app.post('/api/reminders', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { metricCode?: string; time?: string; scheduleTime?: string; daysOfWeek?: string; label?: string }
    const scheduleTime = body.scheduleTime || body.time || ''
    if (!scheduleTime) return jsonResponse(c, failure('VALIDATION_ERROR', 'scheduleTime wajib.', 400, [], startedAt))
    const reminderType = body.metricCode || 'general'
    const profile = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ timezone: string }>()
    const userTimezone = profile?.timezone || 'Asia/Jakarta'
    const remId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_reminderSettings (userId, reminderType, scheduleTime, timezone, payloadJson, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, reminderType, scheduleTime, userTimezone, JSON.stringify({ label: body.label || null, daysOfWeek: body.daysOfWeek || '1,2,3,4,5,6,7' })))
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
    const insightId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_patternInsights (userId, insightType, rangeStart, rangeEnd, summaryText, dataJson, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(userId, body.patternType || 'sleep_bp', since, new Date().toISOString(), insightText, JSON.stringify({ sleep, bp })))
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
    const body = await c.req.json() as { confirmEmail?: string }
    if (!body.confirmEmail || typeof body.confirmEmail !== 'string') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'confirmEmail wajib diisi.', 400, [{ field: 'confirmEmail', message: 'Masukkan email Anda untuk konfirmasi.' }], startedAt))
    }
    const user = await c.env.DB.prepare('SELECT email FROM HL_users WHERE id = ? AND active = 1').bind(userId).first<{ email: string }>()
    if (!user || user.email !== body.confirmEmail.trim().toLowerCase()) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Email konfirmasi tidak cocok.', 400, [{ field: 'confirmEmail', message: 'Email tidak cocok dengan akun Anda.' }], startedAt))
    }
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'accountDelete', 'HL_users', ?, ?, CURRENT_TIMESTAMP)`).bind(userId, userId, JSON.stringify({ requestedAt: new Date().toISOString() })),
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



// Alias for frontend /api/account/delete
app.post('/api/account/delete', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { confirmEmail?: string }
    if (!body.confirmEmail || typeof body.confirmEmail !== 'string') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'confirmEmail wajib diisi.', 400, [{ field: 'confirmEmail', message: 'Masukkan email Anda untuk konfirmasi.' }], startedAt))
    }
    const user = await c.env.DB.prepare('SELECT email FROM HL_users WHERE id = ? AND active = 1').bind(userId).first<{ email: string }>()
    if (!user || user.email !== body.confirmEmail.trim().toLowerCase()) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Email konfirmasi tidak cocok.', 400, [{ field: 'confirmEmail', message: 'Email tidak cocok dengan akun Anda.' }], startedAt))
    }
    await c.env.DB.batch([
      c.env.DB.prepare(`INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'accountDelete', 'HL_users', ?, ?, CURRENT_TIMESTAMP)`).bind(userId, userId, JSON.stringify({ requestedAt: new Date().toISOString() })),
      c.env.DB.prepare(`UPDATE HL_users SET active = 0 WHERE id = ?`).bind(userId),
      c.env.DB.prepare(`UPDATE HL_sessions SET revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND revokedAt IS NULL`).bind(userId)
    ])
    setCookie(c, 'hlSession', '', { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 0 })
    return jsonResponse(c, success({ deleted: true, message: 'Akun dinonaktifkan.' }, 200, startedAt))
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
mountAuthRoutes(app as any)
mountHydrationRoutes(app as any)
mountAiRoutes(app as any)
mountCycleRoutes(app as any)
mountTelegramRoutes(app as any)
mountAdminRoutes(app as any)

export {
  getCurrentSession,
  jsonResponse,
  success,
  failure,
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
  metricCatalogResponse,
  getInsertedId,
  insertAndGetId,
  idsEqual,
  nullableInteger,
  formatIdShortDateTime
}



// US-3.1.3: Async Telegram summary via Cloudflare Queue.
interface TelegramQueueMessage {
  userId: number
  notificationType: 'submit_summary' | 'emergency_alert'
  title: string
  message: string
  sessionId?: number
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


// ============================================================
// Sprint 3 - Family & Alert System Endpoints
// ============================================================

function isAdminUser(c: Context<{ Bindings: Env }>, user: UserRow): boolean {
  const adminEmails = (c.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return adminEmails.includes(user.email.toLowerCase())
}

async function requireAdminPermission(c: Context<{ Bindings: Env }>, user: UserRow, permissionCode: string, startedAt: number) {
  const userRoles = await RbacService.getUserRoles(c.env.DB, user.id)
  if (userRoles.some(r => r.roleCode === 'superAdmin')) return null
  if (await RbacService.hasPermission(c.env.DB, user.id, permissionCode)) return null
  return jsonResponse(c, failure('FORBIDDEN', 'Permission admin diperlukan.', 403, [{ permissionCode }], startedAt))
}

async function getAdminUserRoles(db: D1Database, userId: number): Promise<string[]> {
  return (await RbacService.getUserRoles(db, userId)).map((role) => role.roleCode)
}

async function getAdminSubscriptionSummary(db: D1Database, userId: number) {
  const row = await db.prepare(
    `SELECT planCode, status, currentPeriodEnd
     FROM HL_subscriptions
     WHERE userId = ?
     ORDER BY COALESCE(currentPeriodEnd, '9999-12-31') DESC, id DESC
     LIMIT 1`
  ).bind(userId).first<{ planCode: string; status: string; currentPeriodEnd: string | null }>()
  return row ?? { planCode: 'free', status: 'active', currentPeriodEnd: null }
}

async function getAdminUserSummary(db: D1Database, userId: number) {
  const [roles, subscription] = await Promise.all([
    getAdminUserRoles(db, userId),
    getAdminSubscriptionSummary(db, userId)
  ])
  return { roles, subscription }
}

const PROTECTED_SYSTEM_CONFIG_KEYS = new Set([
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

function isValidSystemConfigKey(configKey: string) {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(configKey) && configKey.length <= 80
}

function isSensitiveSystemConfigKey(configKey: string) {
  return isSensitiveConfigKey(configKey)
}

function systemConfigAuditMetadata(configKey: string, extra: Record<string, unknown> = {}) {
  return {
    configKey,
    sensitive: isSensitiveSystemConfigKey(configKey),
    ...extra
  }
}

app.get('/api/admin/me', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.access', startedAt)
    if (denied) return denied
    const [roles, permissions] = await Promise.all([
      getAdminUserRoles(c.env.DB, user.id),
      RbacService.getUserPermissions(c.env.DB, user.id)
    ])
    return jsonResponse(c, success({
      userId: user.id,
      email: user.email,
      roles,
      permissions,
      canAccessAdmin: true
    }, 200, startedAt))
  } catch (error) {
    console.error('admin me error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat konteks admin.', 500, [], startedAt))
  }
})

app.get('/api/admin/metrics', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.access', startedAt)
    if (denied) return denied
    const [users, plans, subscriptions, safetyEvents, auditLogs] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_users').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_plans').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_subscriptions').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_safetyEvents').first<{ c: number }>(),
      c.env.DB.prepare('SELECT COUNT(*) as c FROM HL_auditLogs').first<{ c: number }>()
    ])
    return jsonResponse(c, success({
      users: users?.c ?? 0,
      plans: plans?.c ?? 0,
      subscriptions: subscriptions?.c ?? 0,
      safetyEvents: safetyEvents?.c ?? 0,
      auditLogs: auditLogs?.c ?? 0
    }, 200, startedAt))
  } catch (error) {
    console.error('admin metrics error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat metrik dashboard.', 500, [], startedAt))
  }
})

app.get('/api/admin/users', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.users.read', startedAt)
    if (denied) return denied

    const q = (c.req.query('q') || '').trim().toLowerCase()
    const status = c.req.query('status')
    const roleCode = c.req.query('roleCode')
    const planCode = c.req.query('planCode')
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 100)
    const rows = await c.env.DB.prepare(
      `SELECT id, email, displayName, active, createdAt
       FROM HL_users
       ORDER BY createdAt DESC, id DESC
       LIMIT 200`
    ).all<{ id: number; email: string; displayName: string; active: number; createdAt: string }>()

    const enriched = await Promise.all((rows.results || []).map(async (row) => {
      const summary = await getAdminUserSummary(c.env.DB, row.id)
      return {
        userId: row.id,
        email: row.email,
        displayName: row.displayName,
        active: row.active === 1,
        roles: summary.roles,
        subscription: summary.subscription,
        createdAt: row.createdAt
      }
    }))

    const filtered = enriched
      .filter((row) => !q || row.email.toLowerCase().includes(q) || row.displayName.toLowerCase().includes(q))
      .filter((row) => !status || (status === 'active' ? row.active : status === 'disabled' ? !row.active : true))
      .filter((row) => !roleCode || row.roles.includes(roleCode))
      .filter((row) => !planCode || row.subscription.planCode === planCode)
      .slice(0, limit)

    return jsonResponse(c, success(filtered, 200, startedAt))
  } catch (error) {
    console.error('admin users list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat user admin.', 500, [], startedAt))
  }
})

app.get('/api/admin/users/:userId', async (c) => {
  const startedAt = Date.now()
  try {
    const admin = await getAuthenticatedUser(c)
    if (!admin) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, admin, 'admin.users.read', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId'))
    if (!Number.isInteger(userId) || userId <= 0) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'userId tidak valid.', 400, [], startedAt))
    }

    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.displayName, u.active, u.createdAt, p.sex, p.birthDate
       FROM HL_users u
       LEFT JOIN HL_userProfiles p ON p.userId = u.id
       WHERE u.id = ?
       LIMIT 1`
    ).bind(userId).first<{ id: number; email: string; displayName: string; active: number; createdAt: string; sex: string | null; birthDate: string | null }>()
    if (!row) return jsonResponse(c, failure('NOT_FOUND', 'User tidak ditemukan.', 404, [], startedAt))
    const summary = await getAdminUserSummary(c.env.DB, userId)
    return jsonResponse(c, success({
      userId: row.id,
      email: row.email,
      displayName: row.displayName,
      active: row.active === 1,
      createdAt: row.createdAt,
      profile: {
        sex: row.sex,
        birthDate: row.birthDate
      },
      roles: summary.roles,
      subscription: summary.subscription,
      supportViewNotice: 'Sensitive health detail is hidden unless admin.sensitiveHealth.read is explicitly granted and audited.'
    }, 200, startedAt))
  } catch (error) {
    console.error('admin user detail error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat detail user.', 500, [], startedAt))
  }
})

app.put('/api/admin/users/:userId/status', async (c) => {
  const startedAt = Date.now()
  try {
    const admin = await getAuthenticatedUser(c)
    if (!admin) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, admin, 'admin.users.update', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId'))
    const body = await c.req.json() as { active?: boolean; reason?: string }
    if (!Number.isInteger(userId) || userId <= 0 || typeof body.active !== 'boolean') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Input status user tidak valid.', 400, [], startedAt))
    }
    const existing = await c.env.DB.prepare('SELECT id, active FROM HL_users WHERE id = ? LIMIT 1').bind(userId).first<{ id: number; active: number }>()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'User tidak ditemukan.', 404, [], startedAt))
    await c.env.DB.prepare('UPDATE HL_users SET active = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(body.active ? 1 : 0, userId).run()
    await AuditService.write(c.env.DB, {
      userId: admin.id,
      action: 'admin.users.status.update',
      entityType: 'HL_users',
      entityId: userId,
      metadataJson: { userId, active: body.active, previousActive: existing.active === 1, reason: body.reason }
    })
    return jsonResponse(c, success({ userId, active: body.active, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin user status error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update status user.', 500, [], startedAt))
  }
})

function isValidRoleCode(roleCode: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(roleCode) && roleCode.length <= 80
}

app.get('/api/admin/roles', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare(
      `SELECT r.roleCode, r.roleName, r.description, r.systemRole, r.active, COUNT(rp.permissionCode) AS permissionCount
       FROM HL_roles r
       LEFT JOIN HL_rolePermissions rp ON rp.roleCode = r.roleCode
       GROUP BY r.roleCode, r.roleName, r.description, r.systemRole, r.active
       ORDER BY r.systemRole DESC, r.roleCode`
    ).all<{ roleCode: string; roleName: string; description: string | null; systemRole: number; active: number; permissionCount: number }>()
    return jsonResponse(c, success((rows.results || []).map((row) => ({
      roleCode: row.roleCode,
      roleName: row.roleName,
      description: row.description,
      systemRole: row.systemRole === 1,
      active: row.active === 1,
      permissionCount: row.permissionCount
    })), 200, startedAt))
  } catch (error) {
    console.error('admin roles list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat role.', 500, [], startedAt))
  }
})

app.post('/api/admin/roles', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const body = await c.req.json() as { roleCode?: string; roleName?: string; description?: string }
    const roleCode = (body.roleCode || '').trim()
    const roleName = (body.roleName || '').trim()
    if (!isValidRoleCode(roleCode) || roleName.length < 2) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Role tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      'INSERT INTO HL_roles (roleCode, roleName, description, systemRole, active, createdAt, updatedAt) VALUES (?, ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
    ).bind(roleCode, roleName, body.description || null).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.roles.create',
      entityType: 'HL_roles',
      entityId: roleCode,
      metadataJson: { roleCode, roleName }
    })
    return jsonResponse(c, success({ roleCode, created: true }, 201, startedAt))
  } catch (error) {
    console.error('admin role create error:', error)
    return jsonResponse(c, failure('VALIDATION_ERROR', 'Role gagal dibuat atau sudah ada.', 400, [], startedAt))
  }
})

app.put('/api/admin/roles/:roleCode/permissions', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const roleCode = c.req.param('roleCode')
    const body = await c.req.json() as { permissionCodes?: string[] }
    const permissionCodes = Array.isArray(body.permissionCodes) ? [...new Set(body.permissionCodes)] : []
    const role = await c.env.DB.prepare('SELECT roleCode, systemRole FROM HL_roles WHERE roleCode = ? LIMIT 1').bind(roleCode).first()
    if (!role) return jsonResponse(c, failure('NOT_FOUND', 'Role tidak ditemukan.', 404, [], startedAt))
    if (permissionCodes.length > 0) {
      const placeholders = permissionCodes.map(() => '?').join(',')
      const rows = await c.env.DB.prepare(`SELECT permissionCode FROM HL_permissions WHERE active = 1 AND permissionCode IN (${placeholders})`).bind(...permissionCodes).all<{ permissionCode: string }>()
      if ((rows.results || []).length !== permissionCodes.length) {
        return jsonResponse(c, failure('VALIDATION_ERROR', 'Permission tidak valid.', 400, [], startedAt))
      }
    }
    await c.env.DB.prepare('DELETE FROM HL_rolePermissions WHERE roleCode = ?').bind(roleCode).run()
    for (const permissionCode of permissionCodes) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO HL_rolePermissions (roleCode, permissionCode, createdAt) VALUES (?, ?, CURRENT_TIMESTAMP)').bind(roleCode, permissionCode).run()
    }
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.roles.permissions.update',
      entityType: 'HL_roles',
      entityId: roleCode,
      metadataJson: { roleCode, permissionCount: permissionCodes.length }
    })
    return jsonResponse(c, success({ roleCode, permissionCount: permissionCodes.length, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin role permissions update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update permission role.', 500, [], startedAt))
  }
})

app.put('/api/admin/roles/:roleCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const roleCode = c.req.param('roleCode')
    const body = await c.req.json() as { roleName?: string; description?: string; active?: boolean }
    const existing = await c.env.DB.prepare('SELECT roleCode, systemRole FROM HL_roles WHERE roleCode = ? LIMIT 1').bind(roleCode).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Role tidak ditemukan.', 404, [], startedAt))
    if (existing.systemRole === 1) return jsonResponse(c, failure('FORBIDDEN', 'System role tidak bisa diubah.', 403, [], startedAt))
    await c.env.DB.prepare(
      'UPDATE HL_roles SET roleName = COALESCE(?, roleName), description = COALESCE(?, description), active = COALESCE(?, active), updatedAt = CURRENT_TIMESTAMP WHERE roleCode = ?'
    ).bind(body.roleName || null, body.description ?? null, typeof body.active === 'boolean' ? (body.active ? 1 : 0) : null, roleCode).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.roles.update',
      entityType: 'HL_roles',
      entityId: roleCode,
      metadataJson: { roleCode, updated: true }
    })
    return jsonResponse(c, success({ roleCode, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin role update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update role.', 500, [], startedAt))
  }
})

app.get('/api/admin/permissions', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare(
      'SELECT permissionCode, permissionName, category, description, active FROM HL_permissions ORDER BY category, permissionCode'
    ).all<{ permissionCode: string; permissionName: string; category: string; description: string | null; active: number }>()
    return jsonResponse(c, success((rows.results || []).map((row) => ({ ...row, active: row.active === 1 })), 200, startedAt))
  } catch (error) {
    console.error('admin permissions list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat permission.', 500, [], startedAt))
  }
})

app.delete('/api/admin/roles/:roleCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.roles.manage', startedAt)
    if (denied) return denied
    const roleCode = c.req.param('roleCode')
    const existing = await c.env.DB.prepare('SELECT roleCode, systemRole FROM HL_roles WHERE roleCode = ? LIMIT 1').bind(roleCode).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Role tidak ditemukan.', 404, [], startedAt))
    if (existing.systemRole === 1) return jsonResponse(c, failure('FORBIDDEN', 'System role tidak bisa dihapus.', 403, [], startedAt))
    await c.env.DB.prepare('DELETE FROM HL_roles WHERE roleCode = ?').bind(roleCode).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.roles.delete', entityType: 'HL_roles', entityId: roleCode, metadataJson: { roleCode, deleted: true } })
    return jsonResponse(c, success({ roleCode, deleted: true }, 200, startedAt))
  } catch (error) {
    console.error('admin role delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal hapus role.', 500, [], startedAt))
  }
})

app.post('/api/admin/users/:userId/roles', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.users.update', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId'))
    const body = await c.req.json() as { roleCode?: string }
    const roleCode = (body.roleCode || '').trim()
    if (!Number.isInteger(userId) || userId <= 0 || !isValidRoleCode(roleCode)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Input role user tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      `INSERT INTO HL_userRoles (userId, roleCode, assignedBy, assignedAt, active)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
       ON CONFLICT(userId, roleCode) DO UPDATE SET active = 1, revokedAt = NULL, assignedBy = excluded.assignedBy, assignedAt = CURRENT_TIMESTAMP`
    ).bind(userId, roleCode, user.id).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.users.role.assign',
      entityType: 'HL_userRoles',
      entityId: `${userId}:${roleCode}`,
      metadataJson: { userId, roleCode }
    })
    return jsonResponse(c, success({ userId, roleCode, assigned: true }, 200, startedAt))
  } catch (error) {
    console.error('admin user role assign error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal assign role.', 500, [], startedAt))
  }
})

app.delete('/api/admin/users/:userId/roles/:roleCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.users.update', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId'))
    const roleCode = c.req.param('roleCode')
    if (!Number.isInteger(userId) || userId <= 0 || !isValidRoleCode(roleCode)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Input role user tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare('UPDATE HL_userRoles SET active = 0, revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND roleCode = ?').bind(userId, roleCode).run()
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'admin.users.role.revoke',
      entityType: 'HL_userRoles',
      entityId: `${userId}:${roleCode}`,
      metadataJson: { userId, roleCode }
    })
    return jsonResponse(c, success({ userId, roleCode, revoked: true }, 200, startedAt))
  } catch (error) {
    console.error('admin user role revoke error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal revoke role.', 500, [], startedAt))
  }
})

function isValidPlanCode(planCode: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(planCode) && planCode.length <= 80
}

function requireInternalSecret(c: Context<{ Bindings: Env }>, startedAt: number) {
  const expected = c.env.INTERNAL_API_SECRET
  const header = c.req.header('x-internal-secret') || c.req.header('authorization')?.replace(/^Bearer\s+/i, '')
  if (!expected || header !== expected) {
    return jsonResponse(c, failure('FORBIDDEN', 'Internal secret diperlukan.', 403, [], startedAt))
  }
  return null
}

app.get('/api/admin/plans', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.read', startedAt)
    if (denied) return denied
    const includeInactive = c.req.query('includeInactive') === 'true'
    const rows = await c.env.DB.prepare(
      `SELECT p.planCode, p.planName, p.billingInterval, p.durationDays, p.priceAmount, p.currency, p.trialDays, p.description, p.active, p.sortOrder, COUNT(pf.featureCode) AS featureCount
       FROM HL_plans p
       LEFT JOIN HL_planFeatures pf ON pf.planCode = p.planCode
       WHERE (? = 1 OR p.active = 1)
       GROUP BY p.planCode, p.planName, p.billingInterval, p.durationDays, p.priceAmount, p.currency, p.trialDays, p.description, p.active, p.sortOrder
       ORDER BY p.sortOrder, p.planCode`
    ).bind(includeInactive ? 1 : 0).all<any>()
    return jsonResponse(c, success((rows.results || []).map((row) => ({ ...row, active: row.active === 1 })), 200, startedAt))
  } catch (error) {
    console.error('admin plans list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat plan.', 500, [], startedAt))
  }
})

app.post('/api/admin/plans', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const body = await c.req.json() as any
    const planCode = (body.planCode || '').trim()
    if (!isValidPlanCode(planCode) || !body.planName || !['free', 'monthly', 'quarterly', 'yearly', 'manual'].includes(body.billingInterval)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Plan tidak valid.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      `INSERT INTO HL_plans (planCode, planName, billingInterval, durationDays, priceAmount, currency, trialDays, description, active, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(planCode, body.planName, body.billingInterval, body.durationDays ?? null, body.priceAmount ?? 0, body.currency || 'IDR', body.trialDays ?? 0, body.description || null, body.active === false ? 0 : 1, body.sortOrder ?? 0).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.plans.create', entityType: 'HL_plans', entityId: planCode, metadataJson: { planCode } })
    return jsonResponse(c, success({ planCode, created: true }, 201, startedAt))
  } catch (error) {
    console.error('admin plan create error:', error)
    return jsonResponse(c, failure('VALIDATION_ERROR', 'Plan gagal dibuat atau sudah ada.', 400, [], startedAt))
  }
})

app.put('/api/admin/plans/:planCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const planCode = c.req.param('planCode')
    const body = await c.req.json() as any
    await c.env.DB.prepare(
      `UPDATE HL_plans SET planName = COALESCE(?, planName), durationDays = COALESCE(?, durationDays), priceAmount = COALESCE(?, priceAmount), currency = COALESCE(?, currency), trialDays = COALESCE(?, trialDays), description = COALESCE(?, description), active = COALESCE(?, active), sortOrder = COALESCE(?, sortOrder), updatedAt = CURRENT_TIMESTAMP WHERE planCode = ?`
    ).bind(body.planName ?? null, body.durationDays ?? null, body.priceAmount ?? null, body.currency ?? null, body.trialDays ?? null, body.description ?? null, typeof body.active === 'boolean' ? (body.active ? 1 : 0) : null, body.sortOrder ?? null, planCode).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.plans.update', entityType: 'HL_plans', entityId: planCode, metadataJson: { planCode, updated: true } })
    return jsonResponse(c, success({ planCode, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin plan update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update plan.', 500, [], startedAt))
  }
})

app.get('/api/admin/plans/:planCode/features', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.read', startedAt)
    if (denied) return denied
    const planCode = c.req.param('planCode')
    const rows = await c.env.DB.prepare('SELECT featureCode, enabled, quotaLimit, quotaWindow, metadataJson FROM HL_planFeatures WHERE planCode = ? ORDER BY featureCode').bind(planCode).all<any>()
    return jsonResponse(c, success({
      planCode,
      features: (rows.results || []).map((row) => ({ featureCode: row.featureCode, enabled: row.enabled === 1, quotaLimit: row.quotaLimit, quotaWindow: row.quotaWindow, metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null }))
    }, 200, startedAt))
  } catch (error) {
    console.error('admin plan features get error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat fitur plan.', 500, [], startedAt))
  }
})

app.put('/api/admin/plans/:planCode/features', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const planCode = c.req.param('planCode')
    const body = await c.req.json() as { features?: Array<{ featureCode?: string; enabled?: boolean; quotaLimit?: number | null; quotaWindow?: string | null; metadata?: unknown }> }
    const features = Array.isArray(body.features) ? body.features : []
    await c.env.DB.prepare('DELETE FROM HL_planFeatures WHERE planCode = ?').bind(planCode).run()
    for (const feature of features) {
      if (!feature.featureCode) continue
      await c.env.DB.prepare(
        `INSERT OR IGNORE INTO HL_planFeatures (planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(planCode, feature.featureCode, feature.enabled === false ? 0 : 1, feature.quotaLimit ?? null, feature.quotaWindow ?? null, feature.metadata ? JSON.stringify(feature.metadata) : null).run()
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.plans.features.update', entityType: 'HL_plans', entityId: planCode, metadataJson: { planCode, featureCount: features.length } })
    return jsonResponse(c, success({ planCode, featureCount: features.length, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin plan features update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update fitur plan.', 500, [], startedAt))
  }
})

app.get('/api/admin/subscriptions', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare(
      `SELECT s.id, s.userId, u.email, s.planCode, s.status, s.provider, s.currentPeriodStart, s.currentPeriodEnd
       FROM HL_subscriptions s
       LEFT JOIN HL_users u ON u.id = s.userId
       ORDER BY s.id DESC LIMIT 100`
    ).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) {
    console.error('admin subscriptions list error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat subscription.', 500, [], startedAt))
  }
})

app.post('/api/admin/users/:userId/subscriptions', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const userId = Number(c.req.param('userId'))
    const body = await c.req.json() as any
    const subId = await insertAndGetId(c.env.DB.prepare(
      `INSERT INTO HL_subscriptions (userId, planCode, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, provider, metadataJson, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, body.planCode, body.status || 'active', body.currentPeriodStart || null, body.currentPeriodEnd || null, body.provider || 'manual', body.metadata ? JSON.stringify(body.metadata) : null))
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.subscriptions.create', entityType: 'HL_subscriptions', entityId: subId, metadataJson: { userId, planCode: body.planCode } })
    return jsonResponse(c, success({ subscriptionId: subId, userId, planCode: body.planCode, status: body.status || 'active' }, 201, startedAt))
  } catch (error) {
    console.error('admin subscription create error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal membuat subscription.', 500, [], startedAt))
  }
})

app.put('/api/admin/subscriptions/:subscriptionId', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.billing.manage', startedAt)
    if (denied) return denied
    const subscriptionId = Number(c.req.param('subscriptionId'))
    const body = await c.req.json() as any
    await c.env.DB.prepare(
      `UPDATE HL_subscriptions SET planCode = COALESCE(?, planCode), status = COALESCE(?, status), currentPeriodStart = COALESCE(?, currentPeriodStart), currentPeriodEnd = COALESCE(?, currentPeriodEnd), cancelAtPeriodEnd = COALESCE(?, cancelAtPeriodEnd), metadataJson = COALESCE(?, metadataJson), updatedAt = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(body.planCode ?? null, body.status ?? null, body.currentPeriodStart ?? null, body.currentPeriodEnd ?? null, typeof body.cancelAtPeriodEnd === 'boolean' ? (body.cancelAtPeriodEnd ? 1 : 0) : null, body.metadata ? JSON.stringify(body.metadata) : null, subscriptionId).run()
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.subscriptions.update', entityType: 'HL_subscriptions', entityId: subscriptionId, metadataJson: { subscriptionId, updated: true } })
    return jsonResponse(c, success({ subscriptionId, updated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin subscription update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update subscription.', 500, [], startedAt))
  }
})

app.get('/api/me/entitlements', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const plan = await EntitlementService.getActivePlan(c.env.DB, userId)
    const rows = await c.env.DB.prepare('SELECT featureCode, enabled, quotaLimit, quotaWindow, metadataJson FROM HL_planFeatures WHERE planCode = ? ORDER BY featureCode').bind(plan.planCode).all<any>()
    const features: Record<string, unknown> = {}
    for (const row of rows.results || []) {
      const quota = row.enabled === 1 ? await QuotaService.requireQuota(c.env.DB, userId, row.featureCode) : null
      features[row.featureCode] = { enabled: row.enabled === 1, quotaLimit: row.quotaLimit, quotaWindow: row.quotaWindow, usedCount: quota?.usedCount ?? 0, remaining: row.enabled === 1 ? quota?.remaining : 0, resetAt: quota?.resetAt ?? null, metadata: row.metadataJson ? JSON.parse(row.metadataJson) : null }
    }
    return jsonResponse(c, success({ planCode: plan.planCode, subscriptionStatus: 'active', features }, 200, startedAt))
  } catch (error) {
    console.error('me entitlements error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat entitlement.', 500, [], startedAt))
  }
})

app.post('/api/internal/usage/consume', async (c) => {
  const startedAt = Date.now()
  const denied = requireInternalSecret(c, startedAt)
  if (denied) return denied
  try {
    const body = await c.req.json() as { userId?: number; featureCode?: string; amount?: number }
    if (!body.userId || !body.featureCode) return jsonResponse(c, failure('VALIDATION_ERROR', 'userId dan featureCode wajib.', 400, [], startedAt))
    const result = await QuotaService.consumeQuota(c.env.DB, body.userId, body.featureCode, body.amount ?? 1)
    if (!result.allowed) return jsonResponse(c, failure('QUOTA_EXCEEDED', 'Quota fitur habis.', 429, [result], startedAt))
    return jsonResponse(c, success(result, 200, startedAt))
  } catch (error) {
    console.error('usage consume error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal consume quota.', 500, [], startedAt))
  }
})

app.get('/api/admin/configs', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.read', startedAt)
    if (denied) return denied
    const configs = await ConfigService.list(c.env.DB, c.env as unknown as Record<string, unknown>)
    return jsonResponse(c, success({ configs }, 200, startedAt))
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
    const denied = await requireAdminPermission(c, user, 'admin.config.update', startedAt)
    if (denied) return denied
    const configKey = c.req.param('configKey')
    const body = await c.req.json() as { configValue?: string; configured?: boolean; envVarName?: string; reason?: string }
    if (body.configValue === undefined && body.configured === undefined && body.envVarName === undefined) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configValue wajib.', 400, [], startedAt))
    }
    if (!isValidSystemConfigKey(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey tidak valid.', 400, [], startedAt))
    }
    const updated = await ConfigService.update(c.env.DB, c.env as unknown as Record<string, unknown>, configKey, body)
    invalidateSystemConfigCache(c.env.DB, configKey)
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'configUpdate',
      entityType: 'HL_systemConfigs',
      entityId: configKey,
      metadataJson: systemConfigAuditMetadata(configKey, { updated: true, reason: body.reason })
    })
    return jsonResponse(c, success({ configKey, updated: true, cacheInvalidated: true, secretValueReturned: false, config: updated }, 200, startedAt))
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFIG_NOT_FOUND') {
      return jsonResponse(c, failure('NOT_FOUND', 'Konfigurasi tidak ditemukan.', 404, [], startedAt))
    }
    if (error instanceof Error && error.message === 'INVALID_ENV_VAR_NAME') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'envVarName tidak valid.', 400, [], startedAt))
    }
    console.error('admin config update error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update konfigurasi.', 500, [], startedAt))
  }
})

app.post('/api/admin/configs', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.update', startedAt)
    if (denied) return denied
    const body = await c.req.json() as { configKey?: string; configValue?: string; dataType?: string; description?: string }
    const configKey = (body.configKey || '').trim()
    const dataType = (body.dataType || 'string').trim()
    if (!isValidSystemConfigKey(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey tidak valid.', 400, [], startedAt))
    }
    if (!['string', 'number', 'boolean', 'json'].includes(dataType)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'dataType tidak valid.', 400, [], startedAt))
    }
    if (!body.configValue && body.configValue !== '0' && body.configValue !== '') {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configValue wajib.', 400, [], startedAt))
    }
    const existing = await c.env.DB.prepare('SELECT configKey FROM HL_systemConfigs WHERE configKey = ?').bind(configKey).first()
    if (existing) return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey sudah ada.', 400, [], startedAt))
    const created = await ConfigService.create(c.env.DB, c.env as unknown as Record<string, unknown>, {
      configKey,
      configValue: body.configValue,
      dataType,
      description: body.description || null
    })
    invalidateSystemConfigCache(c.env.DB, configKey)
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'configCreate',
      entityType: 'HL_systemConfigs',
      entityId: configKey,
      metadataJson: systemConfigAuditMetadata(configKey, { dataType, created: true })
    })
    return jsonResponse(c, success({ created: true, configKey, cacheInvalidated: true, secretValueReturned: false, config: created }, 201, startedAt))
  } catch (error) {
    console.error('admin config create error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal membuat konfigurasi.', 500, [], startedAt))
  }
})

app.delete('/api/admin/configs/:configKey', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.update', startedAt)
    if (denied) return denied
    const configKey = c.req.param('configKey')
    if (!isValidSystemConfigKey(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'configKey tidak valid.', 400, [], startedAt))
    }
    if (PROTECTED_SYSTEM_CONFIG_KEYS.has(configKey)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Konfigurasi wajib tidak boleh dihapus.', 400, [], startedAt))
    }
    const existing = await c.env.DB.prepare('SELECT configKey FROM HL_systemConfigs WHERE configKey = ?').bind(configKey).first()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Konfigurasi tidak ditemukan.', 404, [], startedAt))
    await c.env.DB.prepare('DELETE FROM HL_systemConfigs WHERE configKey = ?').bind(configKey).run()
    invalidateSystemConfigCache(c.env.DB, configKey)
    await AuditService.write(c.env.DB, {
      userId: user.id,
      action: 'configDelete',
      entityType: 'HL_systemConfigs',
      entityId: configKey,
      metadataJson: systemConfigAuditMetadata(configKey, { deleted: true })
    })
    return jsonResponse(c, success({ deleted: true, cacheInvalidated: true }, 200, startedAt))
  } catch (error) {
    console.error('admin config delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menghapus konfigurasi.', 500, [], startedAt))
  }
})


app.get('/api/admin/ai-config', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.aiConfig.read', startedAt)
    if (denied) return denied
    const configs = await ConfigService.list(c.env.DB, c.env as unknown as Record<string, unknown>)
    const allConfigs: Record<string, unknown> = {}
    for (const cfg of configs as any[]) { allConfigs[cfg.configKey] = cfg.isSecret ? { configured: cfg.configValue === '**ENV**' || cfg.configValue === '**SECRET**', masked: true, storageMode: cfg.storageMode || 'd1', envVarName: cfg.envVarName || null } : cfg.configValue }
    const aiConfig = { aiTextEndpoint: allConfigs['aiTextEndpoint'] || 'https://9router.krpmerch.biz.id/v1', aiTextDefaultModel: allConfigs['aiTextDefaultModel'] || 'oc/deepseek-v4-flash-free', aiTextModels: allConfigs['aiTextModels'] ? (typeof allConfigs['aiTextModels'] === 'string' ? JSON.parse(allConfigs['aiTextModels'] as string) : allConfigs['aiTextModels']) : ['oc/deepseek-v4-flash-free','oc/mimo-v2.5-free','fallback/deterministic'], aiTextApiKey: allConfigs['aiTextApiKey'] || { configured: false, masked: true, storageMode: 'env', envVarName: 'AI_TEXT_API_KEY' }, timeoutMs: Number(allConfigs['aiExtractTimeoutMs'] || 10000), maxTokens: 1600, temperature: 0.2, disclaimerTemplate: '[NamaModelAI] is AI and can make mistakes. Always consult a doctor.', vectorizeTopK: 8, aiMemoryEnabled: allConfigs['aiMemoryEnabled'] === 'true' || false, aiClinicalCopilotRuntimeEnabled: false, aiClinicalCopilotScopeStatus: 'deferred_to_sprint6', aiClinicalCopilotAllowedActions: ['prepare_context','store_memory_metadata','query_user_namespace','return_context_trace','enforce_disclaimer','report_readiness_status'], aiClinicalCopilotForbiddenActions: ['final_diagnosis','emergency_decision','prescription','medication_dosage_instruction','replace_doctor_claim','cross_user_retrieval'] }
    return jsonResponse(c, success(aiConfig, 200, startedAt))
  } catch (error) { console.error('admin ai config get error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat AI config.', 500, [], startedAt)) }
})

app.put('/api/admin/ai-config', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.aiConfig.update', startedAt)
    if (denied) return denied
    const body = await c.req.json() as Record<string, unknown>
    const updatedKeys: string[] = []
    const configMap: Record<string, string> = { aiTextEndpoint: 'aiTextEndpoint', aiTextDefaultModel: 'aiTextDefaultModel', aiTextModels: 'aiTextModels', timeoutMs: 'aiExtractTimeoutMs', aiMemoryEnabled: 'aiMemoryEnabled', vectorizeTopK: 'vectorizeTopK', disclaimerTemplate: 'disclaimerTemplate', maxTokens: 'maxTokens', temperature: 'temperature' }
    for (const [key, configKey] of Object.entries(configMap)) {
      if (body[key] !== undefined) { const val = typeof body[key] === 'object' ? JSON.stringify(body[key]) : String(body[key]); await c.env.DB.prepare('UPDATE HL_systemConfigs SET configValue = ?, updatedAt = CURRENT_TIMESTAMP WHERE configKey = ?').bind(val, configKey).run(); updatedKeys.push(key) }
    }
    if (body.apiKeyConfigured === true && body.apiKeyEnvVarName) { await c.env.DB.prepare("UPDATE HL_systemConfigs SET configValue = '**ENV**', updatedAt = CURRENT_TIMESTAMP WHERE configKey = 'aiTextApiKey'").run(); updatedKeys.push('aiTextApiKey') }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.aiConfig.update', entityType: 'HL_systemConfigs', entityId: 'ai', metadataJson: JSON.stringify({ updatedKeys, reason: body.reason || 'AI config update' }) })
    return jsonResponse(c, success({ updatedKeys, secretValueReturned: false }, 200, startedAt))
  } catch (error) { console.error('admin ai config update error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update AI config.', 500, [], startedAt)) }
})

app.get('/api/admin/feature-flags', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.config.read', startedAt)
    if (denied) return denied
    const rows = await c.env.DB.prepare('SELECT flagCode, flagName, description, enabled, targetRoleCode, targetPlanCode, metadataJson FROM HL_featureFlags ORDER BY flagCode').all<any>()
    const flags = (rows.results || []).map((r: any) => ({ flagCode: r.flagCode, flagName: r.flagName, description: r.description, enabled: r.enabled === 1, targetRoleCode: r.targetRoleCode, targetPlanCode: r.targetPlanCode, metadata: r.metadataJson ? JSON.parse(r.metadataJson) : null }))
    return jsonResponse(c, success(flags, 200, startedAt))
  } catch (error) { console.error('admin feature flags list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat feature flags.', 500, [], startedAt)) }
})

app.put('/api/admin/feature-flags/:flagCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.featureFlags.manage', startedAt)
    if (denied) return denied
    const flagCode = c.req.param('flagCode'); const body = await c.req.json() as { flagName?: string; description?: string; enabled?: boolean; targetRoleCode?: string | null; targetPlanCode?: string | null; metadata?: unknown }
    const existing = await c.env.DB.prepare('SELECT id FROM HL_featureFlags WHERE flagCode = ?').bind(flagCode).first<any>()
    if (existing) { await c.env.DB.prepare('UPDATE HL_featureFlags SET flagName = COALESCE(?, flagName), description = COALESCE(?, description), enabled = COALESCE(?, enabled), targetRoleCode = ?, targetPlanCode = ?, metadataJson = COALESCE(?, metadataJson), updatedAt = CURRENT_TIMESTAMP WHERE flagCode = ?').bind(body.flagName || null, body.description || null, body.enabled !== undefined ? (body.enabled ? 1 : 0) : null, body.targetRoleCode || null, body.targetPlanCode || null, body.metadata ? JSON.stringify(body.metadata) : null, flagCode).run() }
    else { await c.env.DB.prepare('INSERT INTO HL_featureFlags (flagCode, flagName, description, enabled, targetRoleCode, targetPlanCode, metadataJson, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(flagCode, body.flagName || flagCode, body.description || null, body.enabled ? 1 : 0, body.targetRoleCode || null, body.targetPlanCode || null, body.metadata ? JSON.stringify(body.metadata) : null).run() }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.featureFlags.update', entityType: 'HL_featureFlags', entityId: flagCode, metadataJson: JSON.stringify({ flagCode, updated: true }) })
    return jsonResponse(c, success({ flagCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin feature flag upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update feature flag.', 500, [], startedAt)) }
})

app.get('/api/admin/education/cards', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.education.manage', startedAt)
    if (denied) return denied
    const { topicType, active, q, limit } = c.req.query()
    let sql = 'SELECT id, topicType, topicCode, title, active, sortOrder, updatedAt FROM HL_educationCards WHERE 1=1'; const params: unknown[] = []
    if (topicType) { sql += ' AND topicType = ?'; params.push(topicType) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (q) { sql += ' AND (title LIKE ? OR topicCode LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
    sql += ' ORDER BY sortOrder ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin education list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat kartu edukasi.', 500, [], startedAt)) }
})

app.put('/api/admin/education/cards/:topicType/:topicCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.education.manage', startedAt)
    if (denied) return denied
    const topicType = c.req.param('topicType'); const topicCode = c.req.param('topicCode')
    const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_educationCards WHERE topicType = ? AND topicCode = ?').bind(topicType, topicCode).first<any>()
    if (existing) {
      const fields = ['title','shortText','whyItMatters','howToUse','normalMeaning','warningMeaning','actionText','redFlagText','sourceLabel','contentMarkdown','minimumPlanCode','active','sortOrder']
      const sets: string[] = []; const vals: unknown[] = []
      for (const f of fields) { if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(f === 'active' ? (body[f] ? 1 : 0) : body[f]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_educationCards SET ${sets.join(', ')} WHERE topicType = ? AND topicCode = ?`).bind(...vals as any[], topicType, topicCode).run() }
    } else {
      await c.env.DB.prepare('INSERT INTO HL_educationCards (topicType, topicCode, title, shortText, whyItMatters, howToUse, normalMeaning, warningMeaning, actionText, redFlagText, sourceLabel, contentMarkdown, active, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(topicType, topicCode, body.title || '', body.shortText || '', body.whyItMatters || '', body.howToUse || '', body.normalMeaning || '', body.warningMeaning || '', body.actionText || '', body.redFlagText || '', body.sourceLabel || 'HL Education', body.contentMarkdown || null, body.active !== false ? 1 : 0, body.sortOrder ?? 0).run()
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.education.upsert', entityType: 'HL_educationCards', entityId: `${topicType}::${topicCode}`, metadataJson: JSON.stringify({ topicType, topicCode, updated: true, inserted: !existing }) })
    return jsonResponse(c, success({ topicType, topicCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin education upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update kartu edukasi.', 500, [], startedAt)) }
})

app.get('/api/admin/audit-logs', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.audit.read', startedAt)
    if (denied) return denied
    const { action, entityType, entityId, userId: qUserId, from, to, limit, cursor } = c.req.query()
    let sql = 'SELECT id, userId, action, entityType, entityId, metadataJson, createdAt FROM HL_auditLogs WHERE 1=1'; const params: unknown[] = []
    if (action) { sql += ' AND action = ?'; params.push(action) }
    if (entityType) { sql += ' AND entityType = ?'; params.push(entityType) }
    if (entityId) { sql += ' AND entityId = ?'; params.push(entityId) }
    if (qUserId) { sql += ' AND userId = ?'; params.push(Number(qUserId)) }
    if (from) { sql += ' AND createdAt >= ?'; params.push(from) }
    if (to) { sql += ' AND createdAt <= ?'; params.push(to) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY id DESC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    const hasMore = (rows.results || []).length === (Number(limit) || 50)
    const logs = (rows.results || []).map((r: any) => ({ id: r.id, userId: r.userId, action: r.action, entityType: r.entityType, entityId: r.entityId, metadata: r.metadataJson ? JSON.parse(r.metadataJson) : null, createdAt: r.createdAt })); return jsonResponse(c, success({ logs, hasMore }, 200, startedAt))
  } catch (error) { console.error('admin audit logs list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat audit logs.', 500, [], startedAt)) }
})

app.get('/api/admin/safety-events', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.security.read', startedAt)
    if (denied) return denied
    const { eventType, severity, userId: qUserId, from, to, limit, cursor } = c.req.query()
    let sql = "SELECT id, userId, sourceType, sourceId, eventType, severity, title, notificationStatus, acknowledged, createdAt FROM HL_safetyEvents WHERE 1=1"; const params: unknown[] = []
    if (eventType) { sql += ' AND eventType = ?'; params.push(eventType) }
    if (severity) { sql += ' AND severity = ?'; params.push(severity) }
    if (qUserId) { sql += ' AND userId = ?'; params.push(Number(qUserId)) }
    if (from) { sql += ' AND createdAt >= ?'; params.push(from) }
    if (to) { sql += ' AND createdAt <= ?'; params.push(to) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY id DESC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin safety events list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat safety events.', 500, [], startedAt)) }
})

app.get('/api/admin/metric-catalog', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricCatalog.manage', startedAt)
    if (denied) return denied
    const { category, active, q, limit, cursor } = c.req.query()
    let sql = 'SELECT metricCode, metricName, category, unit, inputType, physicalMin, physicalMax, active FROM HL_metricCatalog WHERE 1=1'; const params: unknown[] = []
    if (category) { sql += ' AND category = ?'; params.push(category) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (q) { sql += ' AND (metricName LIKE ? OR metricCode LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY sortOrder ASC, metricCode ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin metric catalog list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat metric catalog.', 500, [], startedAt)) }
})

app.put('/api/admin/metric-catalog/:metricCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricCatalog.manage', startedAt)
    if (denied) return denied
    const metricCode = c.req.param('metricCode'); const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_metricCatalog WHERE metricCode = ?').bind(metricCode).first<any>()
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of ['metricName','category','unit','inputType','requiresAttachment','requiresSex','requiresFasting','isCalculated','physicalMin','physicalMax','sortOrder','active']) { if (body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(body[k]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_metricCatalog SET ${sets.join(', ')} WHERE metricCode = ?`).bind(...vals as any[], metricCode).run() }
    } else {
      await c.env.DB.prepare('INSERT INTO HL_metricCatalog (metricCode, metricName, category, unit, inputType, requiresAttachment, requiresSex, requiresFasting, isCalculated, physicalMin, physicalMax, sortOrder, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(metricCode, body.metricName || metricCode, body.category || '', body.unit || '', body.inputType || 'mixed', body.requiresAttachment ? 1 : 0, body.requiresSex ? 1 : 0, body.requiresFasting ? 1 : 0, body.isCalculated ? 1 : 0, body.physicalMin ?? null, body.physicalMax ?? null, body.sortOrder ?? 0).run()
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.metricCatalog.upsert', entityType: 'HL_metricCatalog', entityId: metricCode, metadataJson: JSON.stringify({ metricCode, updated: true, inserted: !existing }) })
    return jsonResponse(c, success({ metricCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin metric catalog upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update metric catalog.', 500, [], startedAt)) }
})

app.get('/api/admin/metric-rules', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricRules.manage', startedAt)
    if (denied) return denied
    const { metricCode, severity, active, limit, cursor } = c.req.query()
    let sql = 'SELECT id, ruleCode, metricCode, sex, ageMin, ageMax, minValue, maxValue, unit, status, severity, emergencyLevel, active FROM HL_metricRules WHERE 1=1'; const params: unknown[] = []
    if (metricCode) { sql += ' AND metricCode = ?'; params.push(metricCode) }
    if (severity) { sql += ' AND severity = ?'; params.push(severity) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY rulePriority ASC, ruleCode ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin metric rules list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat metric rules.', 500, [], startedAt)) }
})

app.put('/api/admin/metric-rules/:ruleCode', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.metricRules.manage', startedAt)
    if (denied) return denied
    const ruleCode = c.req.param('ruleCode'); const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_metricRules WHERE ruleCode = ?').bind(ruleCode).first<any>()
    const fields = ['metricCode','sex','ageMin','ageMax','minValue','maxValue','unit','status','severity','popupTitle','popupMessage','recommendation','sourceLabel','emergencyLevel','rulePriority','active']
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of fields) { if (body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(body[k]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_metricRules SET ${sets.join(', ')} WHERE ruleCode = ?`).bind(...vals as any[], ruleCode).run() }
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.metricRules.upsert', entityType: 'HL_metricRules', entityId: ruleCode, metadataJson: JSON.stringify({ ruleCode, updated: true }) })
    return jsonResponse(c, success({ ruleCode, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin metric rules upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update metric rule.', 500, [], startedAt)) }
})

app.get('/api/admin/knowledge-articles', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.kb.manage', startedAt)
    if (denied) return denied
    const { category, active, q, limit, cursor } = c.req.query()
    let sql = 'SELECT slug, title, category, active, updatedAt FROM HL_knowledgeArticles WHERE 1=1'; const params: unknown[] = []
    if (category) { sql += ' AND category = ?'; params.push(category) }
    if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0) }
    if (q) { sql += ' AND (title LIKE ? OR slug LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
    if (cursor) { sql += ' AND id < ?'; params.push(Number(cursor)) }
    sql += ' ORDER BY sortOrder ASC, title ASC LIMIT ?'; params.push(Math.min(Number(limit) || 50, 100))
    const rows = await c.env.DB.prepare(sql).bind(...params as any[]).all<any>()
    return jsonResponse(c, success(rows.results || [], 200, startedAt))
  } catch (error) { console.error('admin knowledge articles list error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat knowledge articles.', 500, [], startedAt)) }
})

app.put('/api/admin/knowledge-articles/:slug', async (c) => {
  const startedAt = Date.now()
  try {
    const user = await getAuthenticatedUser(c)
    if (!user) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const denied = await requireAdminPermission(c, user, 'admin.kb.manage', startedAt)
    if (denied) return denied
    const slug = c.req.param('slug'); const body = await c.req.json() as Record<string, unknown>
    const existing = await c.env.DB.prepare('SELECT id FROM HL_knowledgeArticles WHERE slug = ?').bind(slug).first<any>()
    const fields = ['title','category','contentMarkdown','sortOrder','active']
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of fields) { if (body[k] !== undefined) { sets.push(`${k} = ?`); vals.push(body[k]) } }
      if (sets.length) { sets.push("updatedAt = CURRENT_TIMESTAMP"); await c.env.DB.prepare(`UPDATE HL_knowledgeArticles SET ${sets.join(', ')} WHERE slug = ?`).bind(...vals as any[], slug).run() }
    }
    await AuditService.write(c.env.DB, { userId: user.id, action: 'admin.kb.upsert', entityType: 'HL_knowledgeArticles', entityId: slug, metadataJson: JSON.stringify({ slug, updated: true }) })
    return jsonResponse(c, success({ slug, updated: true }, 200, startedAt))
  } catch (error) { console.error('admin knowledge article upsert error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal update knowledge article.', 500, [], startedAt)) }
})

// ============ BILLING ROUTES ============

app.post('/api/billing/checkout', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { planCode?: string }
    if (!body.planCode) return jsonResponse(c, failure('VALIDATION_ERROR', 'planCode wajib.', 400, [], startedAt))

    const config = readBillingConfig((c.env as any))
    let provider: BillingProvider
    if (config.provider === 'mock') {
      provider = new MockBillingProvider(config)
    } else {
      if (!config.xenditSecretKey) throw new Error('XENDIT_SECRET_KEY tidak dikonfigurasi.')
      provider = new XenditBillingProvider(config)
    }
    const user = await c.env.DB.prepare('SELECT email, displayName FROM HL_users WHERE id = ?').bind(userId).first<{ email: string; displayName: string }>()
    if (!user) return jsonResponse(c, failure('NOT_FOUND', 'User tidak ditemukan.', 404, [], startedAt))

    const session = await CheckoutSessionService.createPendingCheckout(
      c.env.DB, userId, body.planCode,
      'IDR', config.provider, config.xenditMode,
      config.successUrl, config.cancelUrl
    )

    const checkout = await provider.createCheckout({
      userId, email: user.email, planCode: body.planCode, planName: body.planCode,
      amount: session.amount, currency: session.currency, merchantRef: session.merchantRef,
      successUrl: `${config.successUrl}?checkoutId=${encodeURIComponent(session.id)}`,
      cancelUrl: `${config.cancelUrl}?checkoutId=${encodeURIComponent(session.id)}`
    })

    await CheckoutSessionService.attachProviderCheckout(c.env.DB, session.merchantRef, checkout.providerCheckoutId, checkout.checkoutUrl)

    await AuditService.write(c.env.DB, {
      userId, action: 'billing.checkout.created', entityType: 'HL_billingCheckoutSessions',
      entityId: session.id, metadataJson: JSON.stringify({ planCode: body.planCode, amount: session.amount, provider: checkout.provider })
    })

    return jsonResponse(c, success({
      checkoutId: session.id, provider: checkout.provider, mode: checkout.mode,
      merchantRef: session.merchantRef, checkoutUrl: checkout.checkoutUrl,
      amount: session.amount, currency: session.currency, status: 'pending'
    }, 200, startedAt))

  } catch (e: unknown) {
    const err = e as Error & { code?: string; status?: number; detail?: string; message?: string; stack?: string }
    console.error('billing checkout error:', err?.message || String(e))
    if (err.code === 'FREE_PLAN') return jsonResponse(c, failure('VALIDATION_ERROR', 'Plan gratis tidak memerlukan checkout. Upgrade di halaman /premium/upgrade.', 400, [], startedAt))
    if (err.code === 'PLAN_NOT_FOUND') return jsonResponse(c, failure('NOT_FOUND', 'Plan tidak ditemukan.', 404, [], startedAt))
    if (err.code === 'PLAN_INACTIVE') return jsonResponse(c, failure('VALIDATION_ERROR', 'Plan tidak aktif.', 400, [], startedAt))
    if (err.code === 'XENDIT_ERROR') return jsonResponse(c, failure('BILLING_PROVIDER_ERROR', `Gagal menghubungi penyedia pembayaran: ${err.message}`.slice(0, 200), 502, [], startedAt))
    return jsonResponse(c, failure('INTERNAL_ERROR', `Gagal membuat checkout: ${err?.message || ''}`.slice(0, 200), 500, [], startedAt))
  }
})

app.get('/api/billing/checkout/:checkoutId', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const checkoutId = c.req.param('checkoutId')
    const session = await CheckoutSessionService.getById(c.env.DB, checkoutId)
    if (!session || session.userId !== userId) return jsonResponse(c, failure('NOT_FOUND', 'Checkout tidak ditemukan.', 404, [], startedAt))
    return jsonResponse(c, success({
      checkoutId: session.id, planCode: session.planCode, amount: session.amount,
      currency: session.currency, status: session.status, provider: session.provider,
      checkoutUrl: session.checkoutUrl, paidAt: session.paidAt, createdAt: session.createdAt
    }, 200, startedAt))
  } catch (error) { console.error('billing checkout get error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat checkout.', 500, [], startedAt)) }
})

app.get('/api/billing/my-subscription', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const sub = await c.env.DB.prepare("SELECT planCode, status, provider, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd FROM HL_subscriptions WHERE userId = ? AND status = 'active' AND (currentPeriodEnd IS NULL OR currentPeriodEnd >= datetime('now')) ORDER BY id DESC LIMIT 1").bind(userId).first<{ planCode: string; status: string; provider: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: number }>()
    if (!sub) return jsonResponse(c, success({ planCode: 'free', status: 'active', provider: 'none', currentPeriodStart: null, currentPeriodEnd: null, cancelAtPeriodEnd: false }, 200, startedAt))
    return jsonResponse(c, success({ planCode: sub.planCode, status: sub.status, provider: sub.provider, currentPeriodStart: sub.currentPeriodStart, currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd === 1 }, 200, startedAt))
  } catch (error) { console.error('billing my-subscription error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat subscription.', 500, [], startedAt)) }
})

app.get('/api/billing/invoices', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const sessions = await CheckoutSessionService.listUserSessions(c.env.DB, userId, 50)
    const invoices = sessions.map(s => ({ checkoutId: s.id, planCode: s.planCode, amount: s.amount, currency: s.currency, status: s.status, provider: s.provider, createdAt: s.createdAt, paidAt: s.paidAt }))
    return jsonResponse(c, success(invoices, 200, startedAt))
  } catch (error) { console.error('billing invoices error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat invoice.', 500, [], startedAt)) }
})

app.post('/api/billing/webhook/:provider', async (c) => {
  const startedAt = Date.now()
  try {
    const provider = c.req.param('provider')
    if (!['manual','stripe','midtrans','xendit','mock'].includes(provider)) return jsonResponse(c, failure('VALIDATION_ERROR', 'Provider tidak valid.', 400, [], startedAt))

    // Xendit webhook: verify x-callback-token
    if (provider === 'xendit') {
      const xenditToken = (c.env as any).XENDIT_WEBHOOK_TOKEN as string || ''
      const callbackToken = c.req.header('x-callback-token') || ''
      if (!xenditToken || callbackToken !== xenditToken) {
        await AuditService.write(c.env.DB, { userId: null, action: 'billing.webhook.rejected', entityType: 'HL_paymentEvents', entityId: 'xendit_callback_token', metadataJson: '{ "reason": "invalid_x_callback_token" }' })
        return jsonResponse(c, failure('UNAUTHORIZED', 'Invalid webhook token.', 403, [], startedAt))
      }
      return await handleXenditWebhook(c, startedAt)
    }

    // Mock webhook (for testing only — requires auth)
    if (provider === 'mock') {
      const config = readBillingConfig((c.env as any))
      if (!config.isMockEnabled) return jsonResponse(c, failure('FORBIDDEN', 'Mock provider tidak diaktifkan.', 403, [], startedAt))
      const userId = await getCurrentSession(c)
      if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
      return await handleMockWebhook(c, startedAt, userId)
    }

    // Legacy: generic webhook
    const secret = (c.env as any).BILLING_WEBHOOK_SECRET as string || ''
    const signature = c.req.header('X-Webhook-Signature') || c.req.header('x-webhook-signature') || ''
    if (provider !== 'manual' && (!signature || !secret || signature !== secret)) return jsonResponse(c, failure('UNAUTHORIZED', 'Invalid webhook signature.', 401, [], startedAt))
    const body = await c.req.json() as { id?: string; type?: string; data?: { customerId?: string; subscriptionId?: string; status?: string } }
    if (!body.id || !body.type) return jsonResponse(c, failure('VALIDATION_ERROR', 'Event id dan type wajib.', 400, [], startedAt))
    const existing = await c.env.DB.prepare('SELECT id, processed FROM HL_paymentEvents WHERE provider = ? AND providerEventId = ?').bind(provider, body.id).first<any>()
    if (existing) return jsonResponse(c, success({ provider, providerEventId: body.id, processed: existing.processed === 1, subscriptionUpdated: false, duplicate: true }, 200, startedAt))
    const payId = await insertAndGetId(c.env.DB.prepare('INSERT INTO HL_paymentEvents (provider, eventType, providerEventId, payloadJson, processed, createdAt) VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)').bind(provider, body.type, body.id, JSON.stringify({ id: body.id, type: body.type, customerId: body.data?.customerId || null, subscriptionId: body.data?.subscriptionId || null, status: body.data?.status || null })))
    let subscriptionUpdated = false
    if (body.data?.subscriptionId && body.data?.status) {
      const sub = await c.env.DB.prepare('SELECT id FROM HL_subscriptions WHERE id = ?').bind(Number(body.data.subscriptionId)).first<any>()
      if (sub) { await c.env.DB.prepare('UPDATE HL_subscriptions SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(body.data.status, Number(body.data.subscriptionId)).run(); subscriptionUpdated = true }
    }
    await c.env.DB.prepare('UPDATE HL_paymentEvents SET processed = 1, processedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(payId).run()
    await AuditService.write(c.env.DB, { userId: null, action: "billing.webhook.processed", entityType: 'HL_paymentEvents', entityId: String(payId), metadataJson: JSON.stringify({ provider, providerEventId: body.id, subscriptionUpdated }) })
    return jsonResponse(c, success({ provider, providerEventId: body.id, processed: true, subscriptionUpdated }, 200, startedAt))
  } catch (error) { console.error('billing webhook error:', error); return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal proses webhook.', 500, [], startedAt)) }
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
    const encryptedChatId = await encryptSensitive(c, body.telegramChatId)
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE HL_telegramLinks SET telegramChatId = ?, telegramUsername = ?, verified = 1, enabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(encryptedChatId, body.telegramUsername || null, link.id),
      c.env.DB.prepare('UPDATE HL_users SET telegramEnabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(userId)
    ])
    await c.env.DB.prepare(
      "INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'telegramConnect', 'HL_telegramLinks', ?, ?, CURRENT_TIMESTAMP)"
    ).bind(userId, link.id, JSON.stringify({ telegramChatLinked: true })).run()
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
      "INSERT INTO HL_notificationSettings (userId, telegramSubmitSummary, telegramEmergencyAlert, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(userId) DO UPDATE SET telegramSubmitSummary = excluded.telegramSubmitSummary, telegramEmergencyAlert = excluded.telegramEmergencyAlert, updatedAt = CURRENT_TIMESTAMP"
    ).bind(userId, body.telegramSubmitSummary ? 1 : 0, body.telegramEmergencyAlert ? 1 : 0).run()
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
      "SELECT fl.id, fl.linkedUserId, COALESCE(u.displayName, fi.inviteEmail) as linkedDisplayName, fi.inviteEmail as inviteEmail, fl.role, fl.status, fl.canViewDashboard, fl.canInputMeasurement, fl.canReceiveAlert FROM HL_familyLinks fl LEFT JOIN HL_users u ON u.id = fl.linkedUserId LEFT JOIN HL_familyInvites fi ON fi.id = fl.id WHERE fl.ownerUserId = ? ORDER BY fl.createdAt DESC"
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
    const alert = await c.env.DB.prepare('SELECT id, userId, acknowledged FROM HL_alerts WHERE id = ?').bind(alertId).first<{ id: number; userId: number; acknowledged: number }>()
    if (!alert) return jsonResponse(c, failure('NOT_FOUND', 'Alert tidak ditemukan.', 404, [], startedAt))
    if (alert.acknowledged === 1) return jsonResponse(c, success({ alreadyAcknowledged: true }, 200, startedAt))
    if (alert.userId !== userId) {
      const link = await c.env.DB.prepare("SELECT id FROM HL_familyLinks WHERE ownerUserId = ? AND linkedUserId = ? AND status = 'active' AND canReceiveAlert = 1").bind(alert.userId, userId).first()
      if (!link) return jsonResponse(c, failure('FORBIDDEN', 'Tidak memiliki akses.', 403, [], startedAt))
    }
    await c.env.DB.prepare('UPDATE HL_alerts SET acknowledged = 1, acknowledgedBy = ?, acknowledgedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(userId, alertId).run()
    await c.env.DB.prepare(
      "INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'alertAcknowledge', 'HL_alerts', ?, ?, CURRENT_TIMESTAMP)"
    ).bind(userId, alertId, JSON.stringify({ alertId })).run()
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
    const channel = c.req.query('channel')
    const notificationType = c.req.query('notificationType')
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    let sql = 'SELECT id, channel, notificationType, title, message, status, payloadJson, errorMessage, sentAt, createdAt FROM HL_notifications WHERE userId = ?'
    const params: unknown[] = [userId]
    if (status) { sql += ' AND status = ?'; params.push(status) }
    if (channel) { sql += ' AND channel = ?'; params.push(channel) }
    if (notificationType) { sql += ' AND notificationType = ?'; params.push(notificationType) }
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
      "INSERT INTO HL_pushSubscriptions (userId, endpoint, p256dh, auth, userAgent, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, p256dh = excluded.p256dh, auth = excluded.auth, userAgent = excluded.userAgent, updatedAt = CURRENT_TIMESTAMP"
    ).bind(userId, body.endpoint, body.keys.p256dh, body.keys.auth, body.userAgent || null).run()
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
    const medId = await insertAndGetId(c.env.DB.prepare('INSERT INTO HL_medications (userId, medicationName, dosageText, scheduleText, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(userId, body.medicationName, body.dosageText || null, body.scheduleText || null, body.active !== false ? 1 : 0))
    if (body.schedules && body.schedules.length > 0) {
      for (const s of body.schedules) {
        await insertAndGetId(c.env.DB.prepare('INSERT INTO HL_medicationSchedules (userId, medicationId, scheduleTime, timezone, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(userId, medId, s.scheduleTime, s.timezone || 'Asia/Jakarta'))
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

app.delete('/api/medications/:id', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    await c.env.DB.prepare('DELETE FROM HL_medications WHERE id = ? AND userId = ?').bind(c.req.param('id'), userId).run()
    return jsonResponse(c, success({ deleted: true }, 200, startedAt))
  } catch (error) {
    console.error('medication delete error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal menghapus obat.', 500, [], startedAt))
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
    const encryptedNote = await encryptSensitive(c, body.note)
    const logId = await insertAndGetId(c.env.DB.prepare('INSERT INTO HL_medicationLogs (userId, medicationId, takenAt, status, note, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(userId, medId, body.takenAt || new Date().toISOString(), body.status, encryptedNote))
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
    ).bind(userId, from, to).all<{
      id: string
      medicationId: string
      medicationName: string
      takenAt: string
      status: string
      note: string | null
    }>()
    const logs = await Promise.all((rows.results || []).map(async (row) => ({
      ...row,
      note: await decryptSensitive(c, row.note)
    })))
    return jsonResponse(c, success({ logs }, 200, startedAt))
  } catch (error) {
    console.error('medication logs error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat log obat.', 500, [], startedAt))
  }
})

// Alias routes matching API contract paths
app.get('/api/medication-logs', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const from = c.req.query('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const to = c.req.query('to') || new Date().toISOString()
    const rows = await c.env.DB.prepare(
      'SELECT ml.id, ml.medicationId, m.medicationName, ml.takenAt, ml.status, ml.note FROM HL_medicationLogs ml JOIN HL_medications m ON m.id = ml.medicationId WHERE ml.userId = ? AND ml.takenAt >= ? AND ml.takenAt <= ? ORDER BY ml.takenAt DESC LIMIT 100'
    ).bind(userId, from, to).all<{
      id: number
      medicationId: number
      medicationName: string
      takenAt: string
      status: string
      note: string | null
    }>()
    const logs = await Promise.all((rows.results || []).map(async (row) => ({
      ...row,
      note: row.note ? await decryptSensitive(c, row.note).catch(() => row.note) : null
    })))
    return jsonResponse(c, success({ logs }, 200, startedAt))
  } catch (error) {
    console.error('medication-logs alias error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal memuat log obat.', 500, [], startedAt))
  }
})

app.post('/api/medication-logs', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { medicationId?: number | string; status?: string; takenAt?: string; note?: string }
    const medId = body.medicationId
    if (!medId) return jsonResponse(c, failure('VALIDATION_ERROR', 'medicationId wajib.', 400, [], startedAt))
    if (!['taken', 'skipped', 'missed', 'unknown'].includes(body.status || '')) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'Status harus taken, skipped, missed, atau unknown.', 400, [], startedAt))
    }
    const med = await c.env.DB.prepare('SELECT id FROM HL_medications WHERE id = ? AND userId = ?').bind(medId, userId).first()
    if (!med) return jsonResponse(c, failure('NOT_FOUND', 'Obat tidak ditemukan.', 404, [], startedAt))
    let encryptedNote = body.note || null
    try { if (body.note) encryptedNote = await encryptSensitive(c, body.note) } catch {}
    const logId = await insertAndGetId(c.env.DB.prepare('INSERT INTO HL_medicationLogs (userId, medicationId, takenAt, status, note, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(userId, medId, body.takenAt || new Date().toISOString(), body.status, encryptedNote))
    return jsonResponse(c, success({ logId }, 201, startedAt))
  } catch (error) {
    console.error('medication-logs POST alias error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal log obat.', 500, [], startedAt))
  }
})

app.post('/api/telegram/webhook', async (c) => {
  try {
    const body = await c.req.json() as { message?: { chat?: { id?: number; username?: string }; text?: string } }
    const message = body?.message
    if (!message?.text || !message?.chat?.id) return c.json({ ok: true })
    const text = message.text.trim()
    // Accept either plain 6-digit code (from /api/telegram/connect) or HL-prefixed format.
    const stripped = text.replace(/^HL-/, '')
    if (/^\d{6}$/.test(stripped)) {
      const codeHash = await sha256Token(stripped)
      const link = await c.env.DB.prepare('SELECT id, userId FROM HL_telegramLinks WHERE verificationCodeHash = ? AND verified = 0').bind(codeHash).first<{ id: string; userId: string }>()
      if (link) {
        const encryptedChatId = await encryptSensitive(c, String(message.chat.id))
        await c.env.DB.batch([
          c.env.DB.prepare('UPDATE HL_telegramLinks SET telegramChatId = ?, telegramUsername = ?, verified = 1, enabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(encryptedChatId, message.chat.username || null, link.id),
          c.env.DB.prepare('UPDATE HL_users SET telegramEnabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(link.userId)
        ])
        await c.env.DB.prepare(
          "INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, 'telegramConnect', 'HL_telegramLinks', ?, ?, CURRENT_TIMESTAMP)"
        ).bind(link.userId, link.id, JSON.stringify({ telegramChatLinked: true })).run()
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
  async queue(batch: MessageBatch<any>, env: Env, _ctx: ExecutionContext): Promise<void> {
    const queueName = (batch as any).queueName || ''
    if (queueName === 'ai-memory-jobs') {
      for (const msg of batch.messages) {
        try { const { userId, jobType } = msg.body as { userId: number; jobType: string }
          if (jobType === 'rebuild') { const context = await AiMemoryService.buildContextPackage(env.DB, userId); await AiMemoryService._executeRebuild(env.DB, userId, context) }
          else if (jobType === 'delete') { await AiMemoryService.deleteMemory(env.DB, userId) }
          msg.ack() } catch { msg.retry() }
      }
    } else {
      return telegramQueueHandler(batch as MessageBatch<TelegramQueueMessage>, env, _ctx)
    }
  },
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    return scheduledHandler(event, env as unknown as ExtraEnv, ctx)
  }
}

// ============ Webhook helper functions (after app definition for access to c.env) ============

async function handleXenditWebhook(c: Context<{ Bindings: Env }>, startedAt: number) {
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

async function handleMockWebhook(c: Context<{ Bindings: Env }>, startedAt: number, userId: number) {
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
