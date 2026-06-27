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
  verifyPassword,
  formatIdShortDateTime
} from '../dist/index.js'

export class D1MockStatement {
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

    if (this.sql.includes('FROM HL_configMetadata')) {
      const configKey = this.params[0]
      return this.db.configMetadata[configKey] ?? null
    }

    if (this.sql.includes('FROM HL_systemConfigs') && this.sql.includes('configValue')) {
      const configKey = this.params[0]
      const configValue = this.db.systemConfigs[configKey]
      if (configValue === undefined) return null
      return {
        configKey,
        configValue,
        dataType: this.db.systemConfigMeta[configKey]?.dataType ?? 'string',
        description: this.db.systemConfigMeta[configKey]?.description ?? null,
        updatedAt: 'CURRENT_TIMESTAMP'
      }
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

    if (this.sql.includes('FROM HL_users') && (this.sql.includes('SELECT id FROM HL_users') || this.sql.includes('SELECT id, active FROM HL_users')) && this.sql.includes('WHERE email = ?')) {
      if (this.db.failSelect) {
        throw new Error('D1 unavailable')
      }

      const email = this.params[0]
      const user = this.db.users.find((row) => row.email === email)
      return user ? { id: user.id, active: user.active } : null
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

      if (this.sql.includes('SELECT userId FROM HL_sessions') || this.sql.includes('SELECT s.userId FROM HL_sessions')) {
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

    if (this.sql.includes('FROM HL_subscriptions')) {
      const userId = this.params[0]
      if (this.sql.includes('JOIN HL_plans')) {
        const subscription = this.db.subscriptions.find((row) => row.userId === userId && ['active', 'trialing'].includes(row.status))
        return subscription ? this.db.plans.find((plan) => plan.planCode === subscription.planCode && plan.active === 1) ?? null : null
      }
      return this.db.subscriptions
        .filter((row) => row.userId === userId)
        .sort((left, right) => (right.currentPeriodEnd ?? '').localeCompare(left.currentPeriodEnd ?? ''))[0] ?? null
    }

    if (this.sql.includes("WHERE planCode = 'free'")) {
      return this.db.plans.find((plan) => plan.planCode === 'free' && plan.active === 1) ?? null
    }

    if (this.sql.includes('FROM HL_planFeatures') && this.sql.includes('featureCode = ?')) {
      const [planCode, featureCode] = this.params
      return this.db.planFeatures.find((row) => row.planCode === planCode && row.featureCode === featureCode) ?? null
    }

    if (this.sql.includes('FROM HL_usageCounters')) {
      const [userId, featureCode, usageWindow] = this.params
      const row = this.db.usageCounters.find((item) => item.userId === userId && item.featureCode === featureCode && item.usageWindow === usageWindow)
      return row ? { usedCount: row.usedCount } : null
    }

    if (this.sql.includes('FROM HL_users u') && this.sql.includes('LEFT JOIN HL_userProfiles')) {
      const userId = this.params[0]
      const user = this.db.users.find((row) => row.id === userId)
      if (!user) return null
      const profile = this.db.profiles.find((row) => row.userId === userId)
      return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        active: user.active,
        createdAt: user.createdAt ?? 'CURRENT_TIMESTAMP',
        sex: profile?.sex ?? null,
        birthDate: profile?.birthDate ?? null
      }
    }

    if (this.sql.includes('SELECT id, active FROM HL_users')) {
      const userId = this.params[0]
      const user = this.db.users.find((row) => row.id === userId)
      return user ? { id: user.id, active: user.active } : null
    }

    if (this.sql.includes('SELECT roleCode') && this.sql.includes('FROM HL_roles') && this.sql.includes('WHERE roleCode = ?') && !this.sql.includes('LEFT JOIN')) {
      const roleCode = this.params[0]
      const role = this.db.roles.find((row) => row.roleCode === roleCode)
      return role ? { roleCode: role.roleCode, systemRole: role.systemRole ?? 0 } : null
    }

    if (this.sql.includes('FROM HL_userRoles') && this.sql.includes('HL_permissions')) {
      const [userId, permissionCode] = this.params
      const activeRoleCodes = new Set(
        this.db.userRoles
          .filter((row) => row.userId === userId && row.active === 1 && row.revokedAt === null)
          .filter((row) => this.db.roles.some((role) => role.roleCode === row.roleCode && role.active === 1))
          .map((row) => row.roleCode)
      )
      const allowed = this.db.rolePermissions
        .filter((row) => activeRoleCodes.has(row.roleCode))
        .some((row) =>
          row.permissionCode === permissionCode &&
          this.db.permissions.some((permission) => permission.permissionCode === row.permissionCode && permission.active === 1)
        )
      return allowed ? { permissionCode } : null
    }

    if (this.sql.includes('FROM HL_emailOtpChallenges') && this.sql.includes('WHERE id = ?')) {
      const id = this.params[0]
      return this.db.emailOtpChallenges.find((row) => row.id === id) ?? null
    }

    if (this.sql.includes('FROM HL_emailOtpChallenges') && this.sql.includes('COUNT(*)')) {
      const normalizedEmail = this.params[0]
      const cnt = this.db.emailOtpChallenges.filter((row) => row.normalizedEmail === normalizedEmail).length
      return { cnt }
    }

    if (this.sql.includes('FROM HL_users') && this.sql.includes('WHERE id = ?') && !this.sql.includes('HL_sessions')) {
      const userId = this.params[0]
      const user = this.db.users.find((row) => row.id === userId)
      return user ?? null
    }

    return null
  }

  async run() {
    this.db.apply(this)
    return { success: true, meta: { last_row_id: this.db.lastInsertId } }
  }

  async all() {
    if (this.sql.includes('FROM HL_userRoles') && this.sql.includes('SELECT r.roleCode')) {
      const userId = this.params[0]
      const rows = this.db.userRoles
        .filter((row) => row.userId === userId && row.active === 1 && row.revokedAt === null)
        .map((row) => this.db.roles.find((role) => role.roleCode === row.roleCode && role.active === 1))
        .filter(Boolean)
        .map((role) => ({ roleCode: role.roleCode, roleName: role.roleName, systemRole: role.systemRole }))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_userRoles') && this.sql.includes('SELECT DISTINCT p.permissionCode')) {
      const userId = this.params[0]
      const activeRoleCodes = new Set(
        this.db.userRoles
          .filter((row) => row.userId === userId && row.active === 1 && row.revokedAt === null)
          .filter((row) => this.db.roles.some((role) => role.roleCode === row.roleCode && role.active === 1))
          .map((row) => row.roleCode)
      )
      const rows = this.db.rolePermissions
        .filter((row) => activeRoleCodes.has(row.roleCode))
        .map((row) => this.db.permissions.find((permission) => permission.permissionCode === row.permissionCode && permission.active === 1))
        .filter(Boolean)
        .map((permission) => ({ permissionCode: permission.permissionCode, category: permission.category }))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_users') && this.sql.includes('ORDER BY createdAt')) {
      return {
        results: this.db.users
          .slice()
          .sort((left, right) => (right.createdAt ?? '').localeCompare(left.createdAt ?? '') || right.id - left.id)
          .map((user) => ({
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            active: user.active,
            createdAt: user.createdAt ?? 'CURRENT_TIMESTAMP'
          }))
      }
    }

    if (this.sql.includes('FROM HL_plans p')) {
      const includeInactive = this.params[0] === 1
      return {
        results: this.db.plans
          .filter((plan) => includeInactive || plan.active === 1)
          .map((plan) => ({
            ...plan,
            featureCount: this.db.planFeatures.filter((feature) => feature.planCode === plan.planCode).length
          }))
      }
    }

    if (this.sql.includes('FROM HL_planFeatures') && this.sql.includes('WHERE planCode = ?')) {
      const planCode = this.params[0]
      return { results: this.db.planFeatures.filter((row) => row.planCode === planCode) }
    }

    if (this.sql.includes('FROM HL_subscriptions s')) {
      return {
        results: this.db.subscriptions.map((sub) => ({
          ...sub,
          email: this.db.users.find((user) => user.id === sub.userId)?.email ?? null
        }))
      }
    }

    if (this.sql.includes('FROM HL_roles r') && this.sql.includes('LEFT JOIN HL_rolePermissions')) {
      return {
        results: this.db.roles.map((role) => ({
          roleCode: role.roleCode,
          roleName: role.roleName,
          description: role.description ?? null,
          systemRole: role.systemRole,
          active: role.active,
          permissionCount: this.db.rolePermissions.filter((row) => row.roleCode === role.roleCode).length
        }))
      }
    }

    if (this.sql.includes('FROM HL_permissions') && this.sql.includes('ORDER BY category')) {
      return {
        results: this.db.permissions.map((permission) => ({
          permissionCode: permission.permissionCode,
          permissionName: permission.permissionName ?? permission.permissionCode,
          category: permission.category,
          description: permission.description ?? null,
          active: permission.active
        }))
      }
    }

    if (this.sql.includes('FROM HL_permissions') && this.sql.includes('permissionCode IN')) {
      const codes = this.params
      return {
        results: this.db.permissions
          .filter((permission) => permission.active === 1 && codes.includes(permission.permissionCode))
          .map((permission) => ({ permissionCode: permission.permissionCode }))
      }
    }

    if (this.sql.includes('FROM HL_configMetadata')) {
      return { results: Object.values(this.db.configMetadata) }
    }

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

    if (this.sql.includes('FROM HL_measurementSessions') && this.sql.includes('measuredAt >=')) {
      const [userId, sinceIso] = this.params
      const rows = this.db.measurementSessions
        .filter((row) => row.userId === userId && row.measuredAt >= sinceIso)
        .sort((left, right) => right.measuredAt.localeCompare(left.measuredAt))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_measurementSessions')) {
      const [userId, day] = this.params
      const rows = this.db.measurementSessions
        .filter((row) => row.userId === userId && row.measuredAt.slice(0, 10) === day)
        .sort((left, right) => right.measuredAt.localeCompare(left.measuredAt))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_measurementValues v JOIN HL_measurementSessions s')) {
      const [userId] = this.params
      const sessions = this.db.measurementSessions.filter((row) => row.userId === userId)
      const rows = []
      for (const s of sessions) {
        for (const v of this.db.measurementValues.filter((row) => row.sessionId === s.id)) {
          rows.push({ id: v.id, metricCode: v.metricCode, finalValue: v.finalValue, unit: v.unit, status: v.status, severity: v.severity, measuredAt: s.measuredAt })
        }
      }
      return { results: rows.sort((left, right) => right.measuredAt.localeCompare(left.measuredAt)) }
    }

    if (this.sql.includes('FROM HL_measurementValues')) {
      const [userId, ...sessionIds] = this.params
      const rows = this.db.measurementValues
        .filter((row) => row.userId === userId && sessionIds.includes(row.sessionId))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      return { results: rows }
    }

    if (this.sql.includes('FROM HL_alerts') && this.sql.includes('createdAt >=')) {
      const [userId, sinceIso] = this.params
      const rows = this.db.alerts
        .filter((row) => row.userId === userId && row.createdAt >= sinceIso)
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

    if (this.sql.includes('FROM HL_symptomLogs')) {
      const [userId] = this.params
      return { results: this.db.symptomLogs?.filter((row) => row.userId === userId) ?? [] }
    }

    if (this.sql.includes('FROM HL_waterIntakeLogs')) {
      const [userId] = this.params
      return { results: this.db.waterIntakeLogs?.filter((row) => row.userId === userId) ?? [] }
    }

    if (this.sql.includes('FROM HL_safetyEvents')) {
      const [userId] = this.params
      return { results: this.db.safetyEvents?.filter((row) => row.userId === userId) ?? [] }
    }

    if (this.sql.includes('FROM HL_cycleLogs')) {
      const [userId] = this.params
      return { results: this.db.cycleLogs?.filter((row) => row.userId === userId) ?? [] }
    }

    return { results: [] }
  }
}

export class D1Mock {
  constructor(options = {}) {
    this.lastInsertId = 0
    this.users = []
    this.sessions = []
    this.auditLogs = []
    this.roles = []
    this.permissions = []
    this.rolePermissions = []
    this.userRoles = []
    this.plans = [
      { planCode: 'free', planName: 'Free', billingInterval: 'free', durationDays: null, priceAmount: 0, currency: 'IDR', trialDays: 0, description: 'Free', active: 1, sortOrder: 10 },
      { planCode: 'premiumMonthly', planName: 'Premium Monthly', billingInterval: 'monthly', durationDays: 30, priceAmount: 49000, currency: 'IDR', trialDays: 0, description: 'Premium', active: 1, sortOrder: 20 }
    ]
    this.planFeatures = [
      { planCode: 'free', featureCode: 'feature.aiAssistant.use', enabled: 1, quotaLimit: 3, quotaWindow: 'month', metadataJson: null },
      { planCode: 'premiumMonthly', featureCode: 'feature.aiAssistant.use', enabled: 1, quotaLimit: 100, quotaWindow: 'month', metadataJson: null },
      { planCode: 'premiumMonthly', featureCode: 'feature.vectorMemory.use', enabled: 1, quotaLimit: null, quotaWindow: null, metadataJson: null }
    ]
    this.subscriptions = []
    this.usageCounters = []
    this.profiles = []
    this.consents = []
    this.rateLimits = []
    this.measurementSessions = []
    this.measurementValues = []
    this.alerts = []
    this.streaks = []
    this.aiRecommendations = []
    this.symptomLogs = []
    this.waterIntakeLogs = []
    this.safetyEvents = []
    this.cycleLogs = []
    this.emailOtpChallenges = []
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
    this.configMetadata = {
      telegramBotToken: {
        configKey: 'telegramBotToken',
        category: 'telegram',
        isSecret: 1,
        storageMode: 'env',
        envVarName: 'TELEGRAM_BOT_TOKEN',
        masked: 1,
        readPolicy: 'admin.config.read',
        writePolicy: 'admin.config.update',
        description: 'Telegram token',
        active: 1
      }
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

      const activeFromSql = /\bactive[,\s]+/.test(statement.sql) ? (statement.sql.includes('0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP') ? 0 : 1) : 1

      this.users.push({
        id,
        email,
        passwordHash,
        displayName,
        telegramEnabled: 0,
        browserPushEnabled: 0,
        active: activeFromSql,
        authProvider: 'local',
        lastLoginAt: null
      })
    }

    if (statement.sql.includes('INSERT INTO HL_emailOtpChallenges')) {
      const hasExplicitId = /\(id,/.test(statement.sql)
      const id = hasExplicitId ? statement.params[0] : ++this.lastInsertId
      const pIdx = hasExplicitId ? 1 : 0
      const row = {
        id,
        userId: statement.params[pIdx],
        normalizedEmail: statement.params[pIdx + 1],
        otpHash: statement.params[pIdx + 2],
        salt: statement.params[pIdx + 3],
        purpose: statement.params[pIdx + 4],
        expiresAt: statement.params[pIdx + 5],
        ipHash: statement.params[pIdx + 6] ?? null,
        failedAttempts: 0,
        consumedAt: null,
        resendCount: 0,
        lastResendAt: null,
        createdAt: new Date().toISOString()
      }
      this.emailOtpChallenges.push(row)
    }

    if (statement.sql.includes('UPDATE HL_emailOtpChallenges SET consumedAt')) {
      const id = statement.params[0]
      const challenge = this.emailOtpChallenges.find((row) => row.id === id)
      if (challenge) challenge.consumedAt = 'CURRENT_TIMESTAMP'
    }

    if (statement.sql.includes('UPDATE HL_emailOtpChallenges SET failedAttempts')) {
      const id = statement.params[0]
      const challenge = this.emailOtpChallenges.find((row) => row.id === id)
      if (challenge) challenge.failedAttempts++
    }

    if (statement.sql.includes('UPDATE HL_emailOtpChallenges SET otpHash')) {
      const [otpHash, salt, expiresAt, id] = statement.params
      const challenge = this.emailOtpChallenges.find((row) => row.id === id)
      if (challenge) {
        challenge.otpHash = otpHash
        challenge.salt = salt
        challenge.expiresAt = expiresAt
        challenge.resendCount++
        challenge.lastResendAt = 'CURRENT_TIMESTAMP'
      }
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

    if (statement.sql.includes('UPDATE HL_users SET active')) {
      if (statement.params.length >= 2) {
        const [active, userId] = statement.params
        const user = this.users.find((row) => row.id === userId)
        if (user) user.active = active
      } else {
        const userId = statement.params[0]
        const user = this.users.find((row) => row.id === userId)
        if (user) {
          user.active = statement.sql.includes('= 0') ? 0 : 1
          if (statement.sql.includes('emailVerifiedAt')) user.emailVerifiedAt = 'CURRENT_TIMESTAMP'
          if (statement.sql.includes('emailVerificationMethod')) user.emailVerificationMethod = 'otp'
        }
      }
    }

    if (statement.sql.includes('INSERT INTO HL_roles')) {
      const [roleCode, roleName, description] = statement.params
      if (this.roles.some((role) => role.roleCode === roleCode)) {
        throw new Error('UNIQUE constraint failed: HL_roles.roleCode')
      }
      this.roles.push({ roleCode, roleName, description, systemRole: 0, active: 1 })
    }

    if (statement.sql.includes('UPDATE HL_roles SET')) {
      const [roleName, description, active, roleCode] = statement.params
      const role = this.roles.find((row) => row.roleCode === roleCode)
      if (role) {
        if (roleName !== null) role.roleName = roleName
        if (description !== null) role.description = description
        if (active !== null) role.active = active
      }
    }

    if (statement.sql.includes('DELETE FROM HL_rolePermissions')) {
      const [roleCode] = statement.params
      this.rolePermissions = this.rolePermissions.filter((row) => row.roleCode !== roleCode)
    }

    if (statement.sql.includes('INSERT OR IGNORE INTO HL_rolePermissions')) {
      const [roleCode, permissionCode] = statement.params
      if (!this.rolePermissions.some((row) => row.roleCode === roleCode && row.permissionCode === permissionCode)) {
        this.rolePermissions.push({ roleCode, permissionCode })
      }
    }

    if (statement.sql.includes('INSERT INTO HL_userRoles')) {
      const [userId, roleCode, assignedBy] = statement.params
      const effectiveAssignedBy = assignedBy ?? null
      const existing = this.userRoles.find((row) => row.userId === userId && row.roleCode === roleCode)
      if (existing) {
        existing.active = 1
        existing.revokedAt = null
        existing.assignedBy = effectiveAssignedBy
      } else {
        this.userRoles.push({ userId, roleCode, assignedBy: effectiveAssignedBy, active: 1, revokedAt: null })
      }
    }

    if (statement.sql.includes('UPDATE HL_userRoles SET active = 0')) {
      const [userId, roleCode] = statement.params
      const row = this.userRoles.find((item) => item.userId === userId && item.roleCode === roleCode)
      if (row) {
        row.active = 0
        row.revokedAt = 'CURRENT_TIMESTAMP'
      }
    }

    if (statement.sql.includes('INSERT INTO HL_plans')) {
      const [planCode, planName, billingInterval, durationDays, priceAmount, currency, trialDays, description, active, sortOrder] = statement.params
      if (this.plans.some((plan) => plan.planCode === planCode)) throw new Error('UNIQUE constraint failed: HL_plans.planCode')
      this.plans.push({ planCode, planName, billingInterval, durationDays, priceAmount, currency, trialDays, description, active, sortOrder })
    }

    if (statement.sql.includes('UPDATE HL_plans SET')) {
      const [planName, durationDays, priceAmount, currency, trialDays, description, active, sortOrder, planCode] = statement.params
      const plan = this.plans.find((row) => row.planCode === planCode)
      if (plan) {
        if (planName !== null) plan.planName = planName
        if (durationDays !== null) plan.durationDays = durationDays
        if (priceAmount !== null) plan.priceAmount = priceAmount
        if (currency !== null) plan.currency = currency
        if (trialDays !== null) plan.trialDays = trialDays
        if (description !== null) plan.description = description
        if (active !== null) plan.active = active
        if (sortOrder !== null) plan.sortOrder = sortOrder
      }
    }

    if (statement.sql.includes('DELETE FROM HL_planFeatures')) {
      const [planCode] = statement.params
      this.planFeatures = this.planFeatures.filter((row) => row.planCode !== planCode)
    }

    if (statement.sql.includes('INSERT OR IGNORE INTO HL_planFeatures')) {
      const [planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson] = statement.params
      if (!this.planFeatures.some((row) => row.planCode === planCode && row.featureCode === featureCode)) {
        this.planFeatures.push({ planCode, featureCode, enabled, quotaLimit, quotaWindow, metadataJson })
      }
    }

    if (statement.sql.includes('INSERT INTO HL_subscriptions')) {
      const [userId, planCode, status, currentPeriodStart, currentPeriodEnd, provider, metadataJson] = statement.params
      const id = ++this.lastInsertId
      this.subscriptions.push({ id, userId, planCode, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd: 0, provider, metadataJson })
    }

    if (statement.sql.includes('UPDATE HL_subscriptions SET')) {
      const [planCode, status, currentPeriodStart, currentPeriodEnd, cancelAtPeriodEnd, metadataJson, id] = statement.params
      const sub = this.subscriptions.find((row) => row.id === id)
      if (sub) {
        if (planCode !== null) sub.planCode = planCode
        if (status !== null) sub.status = status
        if (currentPeriodStart !== null) sub.currentPeriodStart = currentPeriodStart
        if (currentPeriodEnd !== null) sub.currentPeriodEnd = currentPeriodEnd
        if (cancelAtPeriodEnd !== null) sub.cancelAtPeriodEnd = cancelAtPeriodEnd
        if (metadataJson !== null) sub.metadataJson = metadataJson
      }
    }

    if (statement.sql.includes('INSERT INTO HL_usageCounters')) {
      const [userId, featureCode, usageWindow, amount, quotaLimitSnapshot, resetAt] = statement.params
      const row = this.usageCounters.find((item) => item.userId === userId && item.featureCode === featureCode && item.usageWindow === usageWindow)
      if (row) row.usedCount += amount
      else this.usageCounters.push({ userId, featureCode, usageWindow, usedCount: amount, quotaLimitSnapshot, resetAt })
    }

    if (statement.sql.includes('INSERT INTO HL_configMetadata')) {
      const [configKey, envVarName] = statement.params
      this.configMetadata[configKey] = {
        configKey,
        category: 'security',
        isSecret: 1,
        storageMode: 'env',
        envVarName,
        masked: 1,
        readPolicy: 'admin.config.read',
        writePolicy: 'admin.config.update',
        description: 'Secret config reference',
        active: 1
      }
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

export function getCookieValue(response, name) {
  const cookie = response.headers.get('set-cookie') ?? ''
  const match = cookie.match(new RegExp(`${name}=([^;]+)`))
  return match?.[1] ?? ''
}

export function assertSessionCookie(response) {
  const cookie = response.headers.get('set-cookie') ?? ''
  assert.match(cookie, /hlSession=/)
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /Secure/i)
  assert.match(cookie, /SameSite=Lax/i)
  assert.match(cookie, /Path=\//i)
  assert.match(cookie, /Max-Age=2592000/i)
}

export function env(db = new D1Mock()) {
  return {
    DB: db,
    LOGS: {},
    EMAIL_OTP_TEST_MODE: 'true'
  }
}

function grantAdminPermission(db, userId, permissionCode) {
  if (!db.roles.some((role) => role.roleCode === 'admin')) {
    db.roles.push({ roleCode: 'admin', roleName: 'Admin', systemRole: 1, active: 1 })
  }
  if (!db.permissions.some((permission) => permission.permissionCode === permissionCode)) {
    db.permissions.push({ permissionCode, category: permissionCode.split('.').slice(0, 2).join('.'), active: 1 })
  }
  if (!db.rolePermissions.some((row) => row.roleCode === 'admin' && row.permissionCode === permissionCode)) {
    db.rolePermissions.push({ roleCode: 'admin', permissionCode })
  }
  if (!db.userRoles.some((row) => row.userId === userId && row.roleCode === 'admin')) {
    db.userRoles.push({ userId, roleCode: 'admin', active: 1, revokedAt: null })
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

test('POST /api/auth/register creates user with active=0 and returns OTP challenge', async () => {
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
  assert.equal(body.data.otpRequired, true)
  assert.ok(body.data.challengeId > 0)
  assert.equal(body.data.maskedEmail, 'u***@example.com')
  assert.equal(body.data.expiresInSeconds, 600)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(db.users.length, 1)
  assert.equal(db.users[0].active, 0)
  assert.notEqual(db.users[0].passwordHash, 'StrongPass123')
  assert.equal(db.sessions.length, 0)
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

test('POST /api/auth/login returns OTP challenge instead of session', async () => {
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
  assert.equal(body.success, true)
  assert.equal(body.data.otpRequired, true)
  assert.ok(body.data.challengeId > 0)
  assert.equal(body.data.maskedEmail, 'u***@example.com')
  assert.equal(body.data.expiresInSeconds, 600)
  assert.equal(response.headers.get('set-cookie'), null)
  assert.equal(db.sessions.length, 0)
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
  const token = 'test-session-token'
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
  db.sessions.push({
    id: 1,
    userId: 1,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })

  const response = await app.request(
    '/api/auth/me',
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

test('POST /api/auth/login returns OTP challenge without creating session', async () => {
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
        password: 'StrongPass123'
      })
    },
    env(db)
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.success, true)
  assert.equal(body.data.otpRequired, true)
  assert.ok(body.data.challengeId > 0)
  assert.equal(db.sessions.length, 0)
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
  grantAdminPermission(db, 2, 'admin.config.update')

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
  assert.equal(updateBody.data.secretValueReturned, false)
  assert.equal(updateBody.data.config.configValue, '')
  assert.equal(db.systemConfigs.telegramBotToken, 'configured')
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

test('GET /api/admin/configs requires RBAC admin permission', async () => {
  const db = new D1Mock()
  const token = 'plain-user-session'
  db.users.push({
    id: 3,
    email: 'plain@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Plain User',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 3,
    userId: 3,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })

  const response = await app.request(
    '/api/admin/configs',
    {
      headers: {
        Cookie: `hlSession=${token}`
      }
    },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 403)
  assert.equal(body.error.code, 'FORBIDDEN')
  assert.equal(body.error.details[0].permissionCode, 'admin.config.read')
})

test('admin user APIs return context, safe detail, and audit status update', async () => {
  const db = new D1Mock()
  const token = 'admin-user-session'
  db.users.push({
    id: 10,
    email: 'admin@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Admin',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    createdAt: '2026-06-01T00:00:00.000Z',
    lastLoginAt: null
  })
  db.users.push({
    id: 11,
    email: 'patient@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Patient',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    createdAt: '2026-06-02T00:00:00.000Z',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 10,
    userId: 10,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  db.profiles.push({
    id: 11,
    userId: 11,
    sex: 'female',
    birthDate: '1992-01-01',
    heightCm: 160,
    timezone: 'Asia/Jakarta',
    accessibilityMode: 'normal',
    theme: 'light',
    emergencyConsent: 0,
    aiConsent: 1,
    dataShareConsent: 0,
    isPregnant: 1,
    isLactating: 1
  })
  db.subscriptions.push({
    userId: 11,
    planCode: 'premiumMonthly',
    status: 'active',
    currentPeriodEnd: '2026-07-01T00:00:00.000Z'
  })
  grantAdminPermission(db, 10, 'admin.access')
  grantAdminPermission(db, 10, 'admin.users.read')
  grantAdminPermission(db, 10, 'admin.users.update')

  const apiEnv = env(db)
  const headers = { Cookie: `hlSession=${token}` }
  const meResponse = await app.request('/api/admin/me', { headers }, apiEnv)
  const meBody = await meResponse.json()
  assert.equal(meResponse.status, 200)
  assert.equal(meBody.data.canAccessAdmin, true)
  assert.ok(meBody.data.permissions.includes('admin.users.read'))

  const listResponse = await app.request('/api/admin/users?q=patient', { headers }, apiEnv)
  const listBody = await listResponse.json()
  assert.equal(listResponse.status, 200)
  assert.equal(listBody.data.length, 1)
  assert.equal(listBody.data[0].userId, 11)
  assert.equal(listBody.data[0].subscription.planCode, 'premiumMonthly')

  const detailResponse = await app.request('/api/admin/users/11', { headers }, apiEnv)
  const detailBody = await detailResponse.json()
  assert.equal(detailResponse.status, 200)
  assert.equal(detailBody.data.profile.sex, 'female')
  assert.equal(detailBody.data.profile.birthDate, '1992-01-01')
  assert.equal(JSON.stringify(detailBody.data).includes('isPregnant'), false)
  assert.equal(JSON.stringify(detailBody.data).includes('symptom'), false)
  assert.match(detailBody.data.supportViewNotice, /Sensitive health detail is hidden/)

  const updateResponse = await app.request(
    '/api/admin/users/11/status',
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: false, reason: 'Manual review' })
    },
    apiEnv
  )
  const updateBody = await updateResponse.json()
  assert.equal(updateResponse.status, 200)
  assert.equal(updateBody.data.updated, true)
  assert.equal(db.users.find((user) => user.id === 11).active, 0)
  assert.equal(db.auditLogs.at(-1).action, 'admin.users.status.update')
})

test('admin role APIs create update set permissions assign and revoke', async () => {
  const db = new D1Mock()
  const token = 'roles-admin-session'
  db.users.push({
    id: 20,
    email: 'roles-admin@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Roles Admin',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    createdAt: '2026-06-01T00:00:00.000Z',
    lastLoginAt: null
  })
  db.users.push({
    id: 21,
    email: 'operator@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Operator',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    createdAt: '2026-06-02T00:00:00.000Z',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 20,
    userId: 20,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  grantAdminPermission(db, 20, 'admin.roles.read')
  grantAdminPermission(db, 20, 'admin.roles.manage')
  grantAdminPermission(db, 20, 'admin.users.update')
  grantAdminPermission(db, 20, 'admin.config.read')

  const apiEnv = env(db)
  const headers = { Cookie: `hlSession=${token}` }

  const createResponse = await app.request(
    '/api/admin/roles',
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleCode: 'clinicOperator', roleName: 'Clinic Operator', description: 'Ops role' })
    },
    apiEnv
  )
  const createBody = await createResponse.json()
  assert.equal(createResponse.status, 201)
  assert.equal(createBody.data.created, true)
  assert.ok(db.roles.some((role) => role.roleCode === 'clinicOperator' && role.systemRole === 0))

  const permissionsResponse = await app.request('/api/admin/permissions', { headers }, apiEnv)
  const permissionsBody = await permissionsResponse.json()
  assert.equal(permissionsResponse.status, 200)
  assert.ok(permissionsBody.data.some((permission) => permission.permissionCode === 'admin.config.read'))

  const setResponse = await app.request(
    '/api/admin/roles/clinicOperator/permissions',
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissionCodes: ['admin.config.read'] })
    },
    apiEnv
  )
  const setBody = await setResponse.json()
  assert.equal(setResponse.status, 200)
  assert.equal(setBody.data.permissionCount, 1)
  assert.deepEqual(db.rolePermissions.filter((row) => row.roleCode === 'clinicOperator').map((row) => row.permissionCode), ['admin.config.read'])

  const updateResponse = await app.request(
    '/api/admin/roles/clinicOperator',
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleName: 'Clinic Operator Updated', active: true })
    },
    apiEnv
  )
  assert.equal(updateResponse.status, 200)
  assert.equal(db.roles.find((role) => role.roleCode === 'clinicOperator').roleName, 'Clinic Operator Updated')

  const assignResponse = await app.request(
    '/api/admin/users/21/roles',
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleCode: 'clinicOperator' })
    },
    apiEnv
  )
  assert.equal(assignResponse.status, 200)
  assert.ok(db.userRoles.some((row) => row.userId === 21 && row.roleCode === 'clinicOperator' && row.active === 1))

  const revokeResponse = await app.request(
    '/api/admin/users/21/roles/clinicOperator',
    {
      method: 'DELETE',
      headers
    },
    apiEnv
  )
  assert.equal(revokeResponse.status, 200)
  assert.equal(db.userRoles.find((row) => row.userId === 21 && row.roleCode === 'clinicOperator').active, 0)
  assert.equal(db.auditLogs.at(-1).action, 'admin.users.role.revoke')
})

test('admin billing APIs and entitlement quota flow work', async () => {
  const db = new D1Mock()
  const token = 'billing-admin-session'
  db.users.push({
    id: 30,
    email: 'billing-admin@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Billing Admin',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    createdAt: '2026-06-01T00:00:00.000Z',
    lastLoginAt: null
  })
  db.users.push({
    id: 31,
    email: 'paid@example.com',
    passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Paid User',
    telegramEnabled: 0,
    browserPushEnabled: 0,
    active: 1,
    authProvider: 'local',
    createdAt: '2026-06-02T00:00:00.000Z',
    lastLoginAt: null
  })
  db.sessions.push({
    id: 30,
    userId: 30,
    sessionTokenHash: await sha256Token(token),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  grantAdminPermission(db, 30, 'admin.billing.read')
  grantAdminPermission(db, 30, 'admin.billing.manage')

  const apiEnv = { ...env(db), INTERNAL_API_SECRET: 'internal-secret' }
  const headers = { Cookie: `hlSession=${token}` }

  const createPlanResponse = await app.request(
    '/api/admin/plans',
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planCode: 'premiumYearly',
        planName: 'Premium Yearly',
        billingInterval: 'yearly',
        durationDays: 365,
        priceAmount: 399000,
        currency: 'IDR',
        active: true,
        sortOrder: 40
      })
    },
    apiEnv
  )
  assert.equal(createPlanResponse.status, 201)
  assert.ok(db.plans.some((plan) => plan.planCode === 'premiumYearly'))

  const featuresResponse = await app.request(
    '/api/admin/plans/premiumYearly/features',
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        features: [
          { featureCode: 'feature.aiAssistant.use', enabled: true, quotaLimit: 10, quotaWindow: 'month' },
          { featureCode: 'feature.vectorMemory.use', enabled: true, quotaLimit: null, quotaWindow: null }
        ]
      })
    },
    apiEnv
  )
  const featuresBody = await featuresResponse.json()
  assert.equal(featuresResponse.status, 200)
  assert.equal(featuresBody.data.featureCount, 2)

  const createSubResponse = await app.request(
    '/api/admin/users/31/subscriptions',
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planCode: 'premiumYearly',
        status: 'active',
        currentPeriodStart: '2026-06-24T00:00:00.000Z',
        currentPeriodEnd: '2027-06-24T00:00:00.000Z',
        provider: 'manual'
      })
    },
    apiEnv
  )
  const createSubBody = await createSubResponse.json()
  assert.equal(createSubResponse.status, 201)
  assert.equal(createSubBody.data.planCode, 'premiumYearly')

  const listPlansResponse = await app.request('/api/admin/plans', { headers }, apiEnv)
  const listPlansBody = await listPlansResponse.json()
  assert.equal(listPlansResponse.status, 200)
  assert.ok(listPlansBody.data.some((plan) => plan.planCode === 'premiumYearly' && plan.active === true))

  const userToken = 'paid-user-session'
  db.sessions.push({
    id: 31,
    userId: 31,
    sessionTokenHash: await sha256Token(userToken),
    userAgent: null,
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    revokedAt: null
  })
  const entitlementsResponse = await app.request('/api/me/entitlements', { headers: { Cookie: `hlSession=${userToken}` } }, apiEnv)
  const entitlementsBody = await entitlementsResponse.json()
  assert.equal(entitlementsResponse.status, 200)
  assert.equal(entitlementsBody.data.planCode, 'premiumYearly')
  assert.equal(entitlementsBody.data.features['feature.aiAssistant.use'].quotaLimit, 10)

  const consumeResponse = await app.request(
    '/api/internal/usage/consume',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': 'internal-secret' },
      body: JSON.stringify({ userId: 31, featureCode: 'feature.aiAssistant.use', amount: 1 })
    },
    apiEnv
  )
  const consumeBody = await consumeResponse.json()
  assert.equal(consumeResponse.status, 200)
  assert.equal(consumeBody.data.allowed, true)
  assert.equal(db.usageCounters[0].usedCount, 1)
  assert.equal(db.auditLogs.at(-1).action, 'admin.subscriptions.create')
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

test('formatIdShortDateTime renders Indonesian short-month dd MMM yyyy HH:mm', () => {
  assert.equal(formatIdShortDateTime('2026-06-23T18:30:00.000Z'), '23 Jun 2026 18:30')
  assert.equal(formatIdShortDateTime('2026-01-01T00:05:00.000Z'), '01 Jan 2026 00:05')
  assert.equal(formatIdShortDateTime('2026-05-15T23:59:00.000Z'), '15 Mei 2026 23:59')
  assert.equal(formatIdShortDateTime('2026-07-10T09:00:00.000Z'), '10 Jul 2026 09:00')
  assert.equal(formatIdShortDateTime('2026-08-20T12:00:00.000Z'), '20 Agu 2026 12:00')
  assert.equal(formatIdShortDateTime('2026-10-25T16:45:00.000Z'), '25 Okt 2026 16:45')
  assert.equal(formatIdShortDateTime('2026-12-31T23:00:00.000Z'), '31 Des 2026 23:00')
  assert.equal(formatIdShortDateTime(null), '-')
  assert.equal(formatIdShortDateTime(''), '-')
  assert.equal(formatIdShortDateTime('not-a-date'), 'not-a-date')
})

test('GET /api/history/timeline returns mixed measurement/symptom/hydration/safetyEvent/cycle items', async () => {
  const db = new D1Mock()
  const token = 'timeline-session'
  db.users.push({
    id: 50, email: 'timeline@example.com', passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Timeline User', telegramEnabled: 0, browserPushEnabled: 0, active: 1,
    authProvider: 'local', createdAt: '2026-06-01T00:00:00.000Z', lastLoginAt: null
  })
  db.profiles.push({
    id: 50, userId: 50, sex: 'female', birthDate: '1990-01-01', heightCm: 160,
    timezone: 'Asia/Jakarta', accessibilityMode: 'normal', theme: 'light',
    emergencyConsent: 1, aiConsent: 1, dataShareConsent: 0
  })
  db.sessions.push({
    id: 50, userId: 50, sessionTokenHash: await sha256Token(token),
    userAgent: null, expiresAt: new Date(Date.now() + 60000).toISOString(), revokedAt: null
  })
  db.measurementSessions.push({
    id: 100, profileId: 50, userId: 50, measuredAt: '2026-06-25T08:00:00.000Z',
    source: 'manual', hasAi: 0, hasAttachment: 0, hasEmergency: 0
  })
  db.measurementValues.push({
    id: 100, sessionId: 100, userId: 50, metricCode: 'systolic', finalValue: 120,
    unit: 'mmHg', status: 'normal', severity: 'normal'
  })
  db.symptomLogs.push({
    id: 100, userId: 50, sourceSessionId: null, symptomDateTime: '2026-06-25T09:00:00.000Z',
    quickSymptomsJson: null, bodyArea: 'head', painScale: 5, painSeverity: 'moderate',
    mood: 'tired', startedAt: null, durationMinutes: null, description: 'headache',
    redFlagsJson: null, isRedFlag: 0, safetyEventId: null, createdAt: '2026-06-25T09:00:00.000Z'
  })

  const response = await app.request(
    '/api/history/timeline?from=2026-06-01&to=2026-06-30',
    { headers: { Cookie: `hlSession=${token}` } },
    env(db)
  )
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.ok(Array.isArray(body.data))
  assert.ok(body.data.some((item) => item.rowType === 'measurement' && item.sourceId === '100'))
  assert.ok(body.data.some((item) => item.rowType === 'symptom' && item.sourceId === '100'))
  assert.equal(body.data[0].occurredAt >= body.data[1]?.occurredAt, true, 'timeline sorted descending')
})

test('GET /api/admin/metrics returns dashboard counts', async () => {
  const db = new D1Mock()
  const token = 'metrics-admin-session'
  db.users.push({
    id: 60, email: 'metrics-admin@example.com', passwordHash: await hashPassword('StrongPass123'),
    displayName: 'Metrics Admin', telegramEnabled: 0, browserPushEnabled: 0, active: 1,
    authProvider: 'local', createdAt: '2026-06-01T00:00:00.000Z', lastLoginAt: null
  })
  db.sessions.push({
    id: 60, userId: 60, sessionTokenHash: await sha256Token(token),
    userAgent: null, expiresAt: new Date(Date.now() + 60000).toISOString(), revokedAt: null
  })
  grantAdminPermission(db, 60, 'admin.access')

  const response = await app.request('/api/admin/metrics', { headers: { Cookie: `hlSession=${token}` } }, env(db))
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.ok(typeof body.data.users === 'number')
  assert.ok(typeof body.data.plans === 'number')
  assert.ok(typeof body.data.subscriptions === 'number')
  assert.ok(typeof body.data.safetyEvents === 'number')
  assert.ok(typeof body.data.auditLogs === 'number')
})

test('GET /api/dashboard/today uses user-timezone date filter (Asia/Jakarta late-UTC measurement)', async () => {
  // Simulates the production bug: user submits a measurement at UTC time 2026-06-22T19:17:00.000Z,
  // which is already 2026-06-23 in Asia/Jakarta (UTC+7). The old SQL filter
  // `substr(measuredAt, 1, 10) = '2026-06-23'` would miss the row because measuredAt's UTC prefix
  // is '2026-06-22'. The JS-side Intl.DateTimeFormat filter must include it.
  const db = new D1Mock()
  const token = 'session-token'
  const jakartaToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date())

  db.users.push({
    id: 1, email: 'tz@example.com', passwordHash: await hashPassword('StrongPass123'),
    displayName: 'TZ User',
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

  // Construct a measurement that is "today" in Jakarta but "yesterday" in UTC.
  // Jakarta midnight = UTC 17:00 of the previous calendar day. A reading at e.g.
  // 2026-06-22T22:00:00Z is 2026-06-23 05:00 Jakarta (today) but 2026-06-22 UTC (yesterday).
  const [yy, mm, dd] = jakartaToday.split('-').map(Number)
  const lateUtc = new Date(Date.UTC(yy, mm - 1, dd - 1, 22, 0, 0)).toISOString()

  // Sanity: confirm the chosen UTC time falls on the previous calendar day in UTC.
  const utcPrefix = lateUtc.slice(0, 10)
  assert.notEqual(utcPrefix, jakartaToday, 'test setup: UTC prefix must differ from Jakarta today')

  db.measurementSessions.push({
    id: 20, profileId: 1, userId: 1,
    measuredAt: lateUtc,
    source: 'manual',
    hasAi: 0, hasAttachment: 0, hasEmergency: 0
  })
  db.measurementValues.push({
    id: 21, sessionId: 20, userId: 1,
    metricCode: 'systolic', finalValue: 120, unit: 'mmHg',
    status: 'Normal', severity: 'normal', manualOverride: 0,
    createdAt: lateUtc
  })

  const response = await app.request(
    '/api/dashboard/today',
    { headers: { Cookie: `hlSession=${token}` } },
    env(db)
  )
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.success, true)
  assert.equal(body.data.date, jakartaToday, 'response date is user-timezone today')
  assert.equal(body.data.hasData, true, 'late-UTC measurement must still appear as today in Jakarta')
  assert.equal(body.data.sessionCount, 1)
  assert.equal(body.data.metricCount, 1)
  assert.equal(body.data.values[0].metricCode, 'systolic')
})
