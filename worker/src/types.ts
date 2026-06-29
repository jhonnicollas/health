import { Hono } from 'hono'
import type { Context } from 'hono'

export interface Env {
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
  TELEGRAM_BOT_TOKEN?: string
  ENCRYPTION_KEY?: string
  ADMIN_EMAILS?: string
  INTERNAL_API_SECRET?: string
  DB: D1Database
  LOGS: R2Bucket
  TELEGRAM_QUEUE?: Queue
  AI_MEMORY_QUEUE?: Queue
  VECTORIZE_INDEX?: any
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  RESEND_API_KEY?: string
  EMAIL_PROVIDER?: string
  EMAIL_FROM?: string
  EMAIL_OTP_TTL_SECONDS?: string
  EMAIL_OTP_MAX_ATTEMPTS?: string
  EMAIL_OTP_RESEND_COOLDOWN_SECONDS?: string
  EMAIL_OTP_MAX_RESENDS?: string
  EMAIL_OTP_TEST_MODE?: string
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  VAPID_SUBJECT?: string
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ENTITLEMENT_REQUIRED'
  | 'NOT_FOUND'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'OTP_REQUIRED'
  | 'OTP_INVALID'
  | 'OTP_EXPIRED'
  | 'OTP_TOO_MANY_ATTEMPTS'
  | 'OTP_RESEND_COOLDOWN'
  | 'BILLING_PROVIDER_ERROR'
  | 'DEPRECATED'
  | 'OTP_RATE_LIMITED'
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_OTP_SEND_FAILED'
  | 'EMAIL_INVALID_FORMAT'
  | 'EMAIL_ALREADY_VERIFIED'

export type ApiStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 429 | 500

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

export type ValidateInput = {
  metrics?: unknown
  profileId?: unknown
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

export type AiChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type AiTextResult = {
  text: string
  model: string
}

export type HonoApp = Hono<{ Bindings: Env }>
export type HC = Context<{ Bindings: Env }>
