import { mountAuthRoutes } from "./routes-auth.js"
import { mountHydrationRoutes } from "./routes-hydration.js"
import { mountAiRoutes } from "./routes-ai.js"
import { mountReportsRoutes } from "./routes-reports.js"
import { mountCycleRoutes } from "./routes-cycle.js"
import { mountTelegramRoutes } from "./routes-telegram.js"
import { mountAdminRoutes } from "./routes-admin.js"
import { mountMeasurementRoutes } from './routes-measurements.js'
import { mountDashboardRoutes } from "./routes-dashboard.js"
import { mountWhatsappRoutes } from "./routes-whatsapp.js"
import { getCookie, setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Env, ApiErrorCode } from './types.js'
import { mountExtraRoutes, scheduledHandler, updateDailyStreak, awardBadges, createEmergencyAlert, sendEmergencyToContacts, formatIdShortDateTime, type ExtraEnv } from './routes-extra.js'
import { AuditService } from './services/audit.js'
import { ConfigService, isSensitiveConfigKey } from './services/config.js'
import { EntitlementService, QuotaService } from './services/entitlements.js'
import { EducationService } from "./services/education.js"
import { SymptomService } from "./services/symptom.js"
import { OAuthService } from "./services/oauth.js"
import { RbacService } from './services/rbac.js'
import { AiMemoryService } from './services/ai-memory.js'
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

import {
  ApiStatus,
  RegisterInput,
  LoginInput,
  OnboardingInput,
  ProfileUpdateInput,
  UiSettingsInput,
  UserRow,
  ProfileRow,
  MetricCatalogRow,
  MetricCatalogMetric,
  RateLimitConfig,
  app,
  textEncoder,
  textDecoder,
  SESSION_DAYS,
  MIN_ONBOARDING_AGE_YEARS,
  SYSTEM_CONFIG_TTL_MS,
  systemConfigCacheByDb,
  jsonMeta,
  success,
  failure,
  base64Url,
  normalizeEmail,
  validateRegistrationInput,
  validateLoginInput,
  validateOnboardingInput,
  validateProfileUpdateInput,
  validateUiSettingsInput,
  hashPassword,
  verifyPassword,
  sha256Token,
  generateToken,
  base64UrlDecode,
  getSensitiveDataKey,
  isEncryptedSensitiveValue,
  encryptSensitive,
  decryptSensitive,
  createId,
  getInsertedId,
  insertAndGetId,
  idsEqual,
  nullableInteger,
  isUniqueEmailError,
  jsonResponse,
  getSystemConfigCache,
  readSystemConfigCache,
  writeSystemConfigCache,
  invalidateSystemConfigCache,
  getSystemConfigNumber,
  getSystemConfigString,
  getSystemConfigBoolean,
  resolveTelegramBotToken,
  validateTelegramBotToken,
  getLoginRateLimitConfig,
  enforceLoginRateLimit,
  publicUser,
  publicProfile,
  metricCatalogResponse,
  createSession,
  revokeCurrentSession,
  getAuthenticatedUser,
  ValidateInput,
  PHYSICAL_RANGES,
  SubmitMetricValue,
  SubmitInput,
  RuleEvaluation,
  getCurrentSession,
  evaluateRule,
  calculateAgeYears,
  sendTelegramNotification,
  logNotification,
  FORBIDDEN_PHRASES,
  filterUnsafeContent,
  extractPatternScore,
  AiChatMessage,
  AiTextResult,
  getAiTextModels,
  callConfiguredTextAi,
  getRecentValues,
  TelegramQueueMessage,
  enqueueTelegramSummary,
  telegramQueueHandler,
  ExtractInput,
  validateExtractInput,
  isAdminUser,
  requireAdminPermission,
  getAdminUserRoles,
  getAdminSubscriptionSummary,
  getAdminUserSummary,
  PROTECTED_SYSTEM_CONFIG_KEYS,
  isValidSystemConfigKey,
  isSensitiveSystemConfigKey,
  systemConfigAuditMetadata,
  isValidRoleCode,
  isValidPlanCode,
  requireInternalSecret,
  caregiverDashboardHandler,
  handleXenditWebhook,
  handleMockWebhook,
} from './utils/index-helpers.js'

app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'iSehat API is running'
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
        p.accessibilityMode, p.theme, p.emergencyConsent, p.aiConsent, p.dataShareConsent, p.whatsappNumber
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
          whatsappNumber: string | null
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
          dataShareConsent: row.dataShareConsent ?? 0,
          whatsappNumber: row.whatsappNumber ?? null
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
         emergencyConsent, aiConsent, dataShareConsent, whatsappNumber, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      user.id,
      validation.data.sex,
      validation.data.birthDate,
      validation.data.heightCm,
      validation.data.timezone,
      validation.data.accessibilityMode,
      validation.data.theme,
      validation.data.aiConsent ? 1 : 0,
      validation.data.whatsappNumber || null
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
        emergencyConsent, aiConsent, dataShareConsent, whatsappNumber
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
        emergencyConsent, aiConsent, dataShareConsent, whatsappNumber
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
    const nextWhatsappNumber = validation.data.whatsappNumber !== undefined ? validation.data.whatsappNumber : existingProfile.whatsappNumber

    const batchStmts = [
      c.env.DB.prepare(
        `UPDATE HL_userProfiles
         SET heightCm = ?, timezone = ?, theme = ?, accessibilityMode = ?, whatsappNumber = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE userId = ?`
      ).bind(
        nextHeightCm,
        nextTimezone,
        nextTheme,
        nextAccessibilityMode,
        nextWhatsappNumber ?? null,
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





// AI Recommendation Endpoint








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
    const tg = await sendTelegramNotification(c, userId, 'submit_summary', 'Test Telegram', 'Pesan test dari iSehat.')
    await logNotification(c, userId, 'telegram', 'submit_summary', 'Test Telegram', 'Pesan test dari iSehat.',
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
    const body = await c.req.json() as { reminderType?: string; metricCode?: string; time?: string; scheduleTime?: string; timezone?: string; channel?: string; payload?: { message?: string; label?: string; daysOfWeek?: string }; enabled?: boolean }
    const scheduleTime = body.scheduleTime || body.time || ''
    if (!scheduleTime) return jsonResponse(c, failure('VALIDATION_ERROR', 'scheduleTime wajib.', 400, [], startedAt))
    const reminderType = body.reminderType || body.metricCode || 'general'
    if (!['morningMeasurement', 'eveningMeasurement', 'medication', 'general'].includes(reminderType)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'reminderType tidak valid.', 400, [{ field: 'reminderType', message: 'Gunakan morningMeasurement, eveningMeasurement, medication, atau general.' }], startedAt))
    }
    const channel = body.channel || 'telegram'
    if (!['inApp', 'telegram', 'browser', 'email'].includes(channel)) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'channel tidak valid.', 400, [{ field: 'channel', message: 'Gunakan inApp, telegram, browser, atau email.' }], startedAt))
    }
    const profile = await c.env.DB.prepare('SELECT timezone FROM HL_userProfiles WHERE userId = ?').bind(userId).first<{ timezone: string }>()
    const userTimezone = body.timezone || profile?.timezone || 'Asia/Jakarta'
    const payloadData = body.payload || {}
    const payloadJson = JSON.stringify({
      label: payloadData.label || payloadData.message || null,
      message: payloadData.message || payloadData.label || null,
      daysOfWeek: payloadData.daysOfWeek || '1,2,3,4,5,6,7'
    })
    const enabledVal = body.enabled === false ? 0 : 1
    const insertResult = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO HL_reminderSettings (userId, reminderType, scheduleTime, timezone, channel, payloadJson, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, reminderType, scheduleTime, userTimezone, channel, payloadJson, enabledVal).run()
    const remId = Number(insertResult.meta?.last_row_id ?? 0)
    if (remId > 0) {
      return jsonResponse(c, success({ reminderId: remId }, 201, startedAt))
    }
    // INSERT OR IGNORE skipped (UNIQUE constraint) — update existing row instead
    await c.env.DB.prepare(
      `UPDATE HL_reminderSettings SET scheduleTime = ?, timezone = ?, channel = ?, payloadJson = ?, enabled = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND reminderType = ? AND channel = ?`
    ).bind(scheduleTime, userTimezone, channel, payloadJson, enabledVal, userId, reminderType, channel).run()
    const existing = await c.env.DB.prepare(
      'SELECT id FROM HL_reminderSettings WHERE userId = ? AND reminderType = ? AND channel = ?'
    ).bind(userId, reminderType, channel).first<{ id: number }>()
    return jsonResponse(c, success({ reminderId: existing?.id || 0 }, 200, startedAt))
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
      `SELECT id, reminderType, scheduleTime, timezone, channel, payloadJson, enabled FROM HL_reminderSettings WHERE userId = ? ORDER BY scheduleTime ASC`
    ).bind(userId).all<{ id: number; reminderType: string; scheduleTime: string; timezone: string; channel: string; payloadJson: string | null; enabled: number }>()
    const reminders = (rows.results || []).map(r => {
      let payload: { message?: string; label?: string; daysOfWeek?: string } = {}
      try { payload = r.payloadJson ? JSON.parse(r.payloadJson) : {} } catch { /* ignore */ }
      return {
        id: r.id,
        reminderType: r.reminderType,
        enabled: r.enabled === 1,
        scheduleTime: r.scheduleTime,
        timezone: r.timezone,
        channel: r.channel,
        message: payload.message || payload.label || ''
      }
    })
    return jsonResponse(c, success({ reminders }, 200, startedAt))
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
mountReportsRoutes(app as any)
mountCycleRoutes(app as any)
mountTelegramRoutes(app as any)
mountWhatsappRoutes(app as any)
mountAdminRoutes(app as any)
mountMeasurementRoutes(app as any)
mountDashboardRoutes(app as any)




// US-3.1.3: Async Telegram summary via Cloudflare Queue.



// US-3.1.3: default export moved to end of file



// ============================================================
// Sprint 3 - Family & Alert System Endpoints
// ============================================================










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

app.post('/api/push/subscribe', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    // Accept both { subscription: { endpoint, keys: { p256dh, auth } } } and { endpoint, keys: { p256dh, auth } }
    const raw = await c.req.json() as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string }
    const sub = raw.subscription || raw
    const endpoint = sub.endpoint
    const p256dh = sub.keys?.p256dh
    const auth = sub.keys?.auth
    if (!endpoint || !p256dh || !auth) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'endpoint, keys.p256dh, dan keys.auth wajib.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      "INSERT INTO HL_pushSubscriptions (userId, endpoint, p256dh, auth, userAgent, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, p256dh = excluded.p256dh, auth = excluded.auth, userAgent = excluded.userAgent, enabled = 1, updatedAt = CURRENT_TIMESTAMP"
    ).bind(userId, endpoint, p256dh, auth, raw.userAgent || c.req.header('User-Agent') || null).run()
    await c.env.DB.prepare('UPDATE HL_users SET browserPushEnabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(userId).run()
    return jsonResponse(c, success({ subscribed: true }, 201, startedAt))
  } catch (error) {
    console.error('push subscribe error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal subscribe push.', 500, [], startedAt))
  }
})

// Alias for backward compatibility
app.post('/api/notifications/browser/subscribe', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const raw = await c.req.json() as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; endpoint?: string; keys?: { p256dh?: string; auth?: string }; userAgent?: string }
    const sub = raw.subscription || raw
    const endpoint = sub.endpoint
    const p256dh = sub.keys?.p256dh
    const auth = sub.keys?.auth
    if (!endpoint || !p256dh || !auth) {
      return jsonResponse(c, failure('VALIDATION_ERROR', 'endpoint, keys.p256dh, dan keys.auth wajib.', 400, [], startedAt))
    }
    await c.env.DB.prepare(
      "INSERT INTO HL_pushSubscriptions (userId, endpoint, p256dh, auth, userAgent, enabled, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(endpoint) DO UPDATE SET userId = excluded.userId, p256dh = excluded.p256dh, auth = excluded.auth, userAgent = excluded.userAgent, enabled = 1, updatedAt = CURRENT_TIMESTAMP"
    ).bind(userId, endpoint, p256dh, auth, raw.userAgent || c.req.header('User-Agent') || null).run()
    await c.env.DB.prepare('UPDATE HL_users SET browserPushEnabled = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(userId).run()
    return jsonResponse(c, success({ subscribed: true }, 201, startedAt))
  } catch (error) {
    console.error('push subscribe alias error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal subscribe push.', 500, [], startedAt))
  }
})

app.delete('/api/push/unsubscribe', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const body = await c.req.json() as { endpoint?: string }
    if (!body.endpoint) return jsonResponse(c, failure('VALIDATION_ERROR', 'endpoint wajib.', 400, [], startedAt))
    await c.env.DB.prepare('UPDATE HL_pushSubscriptions SET enabled = 0, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND endpoint = ?').bind(userId, body.endpoint).run()
    return jsonResponse(c, success({ unsubscribed: true }, 200, startedAt))
  } catch (error) {
    console.error('push unsubscribe error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal unsubscribe push.', 500, [], startedAt))
  }
})

app.post('/api/push/test', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const vapidPrivateKey = c.env.VAPID_PRIVATE_KEY
    if (!vapidPrivateKey) return jsonResponse(c, failure('INTERNAL_ERROR', 'VAPID private key tidak dikonfigurasi.', 500, [], startedAt))
    const body = await c.req.json().catch(() => ({})) as { title?: string; body?: string }
    const { WebPushService } = await import('./services/web-push.js')
    const result = await WebPushService.sendToUser(c.env.DB, userId, {
      title: body.title || 'iSehat Test',
      body: body.body || 'Push notification test berhasil!',
      url: '/'
    }, vapidPrivateKey)
    return jsonResponse(c, success({ sent: result.sent, failed: result.failed }, 200, startedAt))
  } catch (error) {
    console.error('push test error:', error)
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal kirim test push.', 500, [], startedAt))
  }
})

app.get('/api/push/vapid-key', async (c) => {
  const startedAt = Date.now()
  try {
    const vapidPublicKey = c.env.VAPID_PUBLIC_KEY
    if (!vapidPublicKey) return jsonResponse(c, failure('INTERNAL_ERROR', 'VAPID public key tidak dikonfigurasi.', 500, [], startedAt))
    return jsonResponse(c, success({ vapidPublicKey }, 200, startedAt))
  } catch (error) {
    return jsonResponse(c, failure('INTERNAL_ERROR', 'Gagal.', 500, [], startedAt))
  }
})

app.put('/api/reminders/:id', async (c) => {
  const startedAt = Date.now()
  try {
    const userId = await getCurrentSession(c)
    if (!userId) return jsonResponse(c, failure('UNAUTHORIZED', 'Sesi tidak valid.', 401, [], startedAt))
    const reminderId = c.req.param('id')
    const body = await c.req.json() as { enabled?: boolean; scheduleTime?: string; time?: string; label?: string; message?: string; channel?: string }
    const existing = await c.env.DB.prepare('SELECT id, payloadJson FROM HL_reminderSettings WHERE id = ? AND userId = ?').bind(reminderId, userId).first<{ id: number; payloadJson: string | null }>()
    if (!existing) return jsonResponse(c, failure('NOT_FOUND', 'Reminder tidak ditemukan.', 404, [], startedAt))
    const updates: string[] = []
    const params: unknown[] = []
    const scheduleTime = body.scheduleTime || body.time
    if (scheduleTime) { updates.push('scheduleTime = ?'); params.push(scheduleTime) }
    if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled ? 1 : 0) }
    if (body.channel) { updates.push('channel = ?'); params.push(body.channel) }
    if (body.label || body.message) {
      let existingPayload: { message?: string; label?: string; daysOfWeek?: string } = {}
      try { existingPayload = existing.payloadJson ? JSON.parse(existing.payloadJson) : {} } catch { /* ignore */ }
      updates.push('payloadJson = ?'); params.push(JSON.stringify({ ...existingPayload, message: body.message || body.label || existingPayload.message, label: body.label || body.message || existingPayload.label }))
    }
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
app.get('/api/medical-terms', async (c) => {
  const locale = c.req.query('locale') || 'id-ID'
  const rows = await c.env.DB.prepare('SELECT termCode, label, shortDef, normalRange, deviceName, deviceTypeCode, sourceName, sourceUrl FROM HL_medicalTermPopups WHERE locale = ?').bind(locale).all<any>()
  const map: Record<string, any> = {}
  for (const r of rows.results || []) map[r.termCode] = r
  return jsonResponse(c, success(map, 200, Date.now()))
})

app.get('/api/medical-terms/:code', async (c) => {
  const code = c.req.param('code')
  const locale = c.req.query('locale') || 'id-ID'
  const row = await c.env.DB.prepare('SELECT * FROM HL_medicalTermPopups WHERE termCode = ? AND locale = ?').bind(code, locale).first<any>()
  if (!row) return jsonResponse(c, failure('NOT_FOUND', 'Istilah tidak ditemukan.', 404, []))
  return jsonResponse(c, success(row, 200, Date.now()))
})

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

export type { Env }

export {
  app,
  getCurrentSession,
  jsonResponse,
  success,
  failure,
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
