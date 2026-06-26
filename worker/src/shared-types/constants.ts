export const HL_TABLES = [
  'HL_roles',
  'HL_permissions',
  'HL_rolePermissions',
  'HL_userRoles',
  'HL_plans',
  'HL_planFeatures',
  'HL_subscriptions',
  'HL_paymentEvents',
  'HL_usageCounters',
  'HL_featureFlags',
  'HL_configMetadata',
  'HL_systemConfigs',
  'HL_oauthAccounts',
  'HL_oauthStates',
  'HL_educationCards',
  'HL_userEducationProgress',
  'HL_symptomLogs',
  'HL_safetyEvents',
  'HL_hydrationSettings',
  'HL_hydrationTargets',
  'HL_waterIntakeLogs',
  'HL_vectorDocuments',
  'HL_aiContextQueries',
  'HL_aiRecommendationContexts',
  'HL_aiMemoryJobs',
  'HL_cycleSettings',
  'HL_cycleLogs',
  'HL_cycleGuardrailAcknowledgements',
  'HL_familyPermissions',
  'HL_telegramCallbackEvents'
] as const

export const HL_ROLE_CODES = [
  'user',
  'support',
  'admin',
  'superAdmin',
  'billingAdmin',
  'aiConfigAdmin',
  'medicalReviewer'
] as const

export const HL_PERMISSION_CODES = [
  'admin.access',
  'admin.users.read',
  'admin.users.update',
  'admin.config.read',
  'admin.config.update',
  'admin.aiConfig.update',
  'admin.metricCatalog.manage',
  'admin.metricRules.manage',
  'admin.education.manage',
  'admin.kb.manage',
  'admin.billing.read',
  'admin.billing.manage',
  'admin.audit.read',
  'admin.support.limitedView',
  'admin.support.impersonateLimited',
  'feature.aiAssistant.use',
  'feature.aiReport.use',
  'feature.doctorPdf.generate',
  'feature.vectorMemory.use',
  'feature.aiClinicalCopilot.use',
  'feature.telegramReminder.use',
  'feature.familyDashboard.use',
  'feature.cycleTracking.use',
  'feature.hydration.use',
  'feature.symptomLog.use',
  'feature.advancedHistory.use',
  'feature.exportFull.use',
  'feature.medicationReminder.use',
  'feature.fastingInsight.use',
  'admin.roles.read',
  'admin.roles.manage',
  'admin.aiMemory.read',
  'admin.aiMemory.manage',
  'admin.aiClinicalCopilot.manage',
  'admin.sensitiveHealth.read',
  'admin.security.read',
  'admin.featureFlags.manage',
  'family.cycle.read',
  'family.symptom.read',
  'family.hydration.read',
  'family.aiReport.read',
  'family.aiClinicalCopilot.read'
] as const

export const HL_PLAN_CODES = [
  'free',
  'premiumMonthly',
  'premiumQuarterly',
  'premiumYearly',
  'familyPremium'
] as const

export const HL_FEATURE_CODES = [
  'feature.symptomLog.use',
  'feature.hydration.use',
  'feature.aiAssistant.use',
  'feature.aiReport.use',
  'feature.doctorPdf.generate',
  'feature.vectorMemory.use',
  'feature.aiClinicalCopilot.use',
  'feature.telegramReminder.use',
  'feature.familyDashboard.use',
  'feature.cycleTracking.use',
  'feature.advancedHistory.use',
  'feature.exportFull.use',
  'feature.medicationReminder.use',
  'feature.fastingInsight.use'
] as const

export const HL_FEATURE_FLAGS = [
  'sprint5FoundationEnabled',
  'googleOAuthEnabled',
  'dailyHealthHubEnabled',
  'educationCardsEnabled',
  'symptomLogEnabled',
  'hydrationTrackerEnabled',
  'aiClinicalInfrastructureEnabled',
  'aiMemoryEnabled',
  'aiClinicalCopilotEnabled',
  'cycleTrackingEnabled',
  'telegramInlineHydrationEnabled'
] as const

export const HL_CONFIG_KEYS = [
  'aiTextApiKey',
  'subscriptionEnabled',
  'defaultPlanCode',
  'billingDefaultProvider',
  'billingGracePeriodDays',
  'googleOAuthEnabled',
  'googleOAuthClientId',
  'googleOAuthClientSecretRef',
  'googleOAuthRedirectUri',
  'googleOAuthAllowedHostedDomain',
  'educationFirstTimeEnabled',
  'educationCardDefaultSourceLabel',
  'symptomRedFlagKeywords',
  'symptomRedFlagDispatchTimeoutMs',
  'hydrationDefaultTargetMl',
  'hydrationBodyWeightMultiplierMlPerKg',
  'hydrationPregnantMinMl',
  'hydrationLactatingMinMl',
  'hydrationFeverThresholdC',
  'hydrationFeverExtraMl',
  'hydrationOverLimitMl',
  'hydrationReminderEnabled',
  'hydrationOperatingStart',
  'hydrationOperatingEnd',
  'aiMemoryEnabled',
  'aiClinicalInfrastructureEnabled',
  'aiClinicalCopilotRuntimeEnabled',
  'aiClinicalCopilotScopeStatus',
  'aiClinicalCopilotAllowedActionsJson',
  'aiClinicalCopilotForbiddenActionsJson',
  'vectorizeIndexName',
  'vectorizeTopK',
  'vectorizePurpose',
  'vectorizeMinScore',
  'embeddingModel',
  'aiDisclaimerTemplate',
  'cycleTrackingEnabled',
  'cycleDefaultLengthDays',
  'cycleDefaultPeriodLengthDays',
  'cycleEligibleAgeMin',
  'cycleEligibleAgeMax',
  'cycleIrregularMinDays',
  'cycleIrregularMaxDays',
  'cycleGuardrailMessageVersion',
  'telegramWaterWebhookSecretRef',
  'telegramBotToken',
  'telegramWaterQuickAddAmounts',
  'telegramWaterWebhookIdempotencyEnabled'
] as const

export const BILLING_INTERVALS = ['free', 'monthly', 'quarterly', 'yearly', 'manual'] as const
export const BILLING_PROVIDERS = ['manual', 'stripe', 'midtrans', 'xendit'] as const
export const SUBSCRIPTION_STATUSES = ['active', 'trialing', 'pastDue', 'canceled', 'expired', 'paused'] as const
export const USER_ACCOUNT_STATUSES = ['active', 'suspended', 'disabled'] as const
export const QUOTA_WINDOWS = ['day', 'month', 'quarter', 'year', 'lifetime'] as const
export const CONFIG_CATEGORIES = ['ai', 'auth', 'billing', 'telegram', 'system', 'security', 'feature', 'hydration', 'cycle', 'education', 'vectorize'] as const
export const CONFIG_STORAGE_MODES = ['d1', 'env', 'secret', 'reference'] as const
export const OAUTH_PROVIDERS = ['google'] as const
export const OAUTH_STATE_MODES = ['login', 'link'] as const
export const EDUCATION_TOPIC_TYPES = ['metric', 'symptom', 'hydration', 'cycle', 'ai', 'medication', 'fasting', 'report', 'system'] as const
export const SYMPTOM_PAIN_SEVERITIES = ['mild', 'moderate', 'severe'] as const
export const HEALTH_MOODS = ['normal', 'sad', 'angry', 'anxious', 'happy', 'tired', 'other'] as const
export const SAFETY_EVENT_SOURCE_TYPES = ['measurement', 'symptom', 'cycle', 'hydration', 'ai', 'system', 'telegram', 'billing'] as const
export const SAFETY_EVENT_SEVERITIES = ['info', 'warning', 'high', 'critical', 'emergency'] as const
export const SAFETY_NOTIFICATION_STATUSES = ['pending', 'sent', 'failed', 'skipped', 'queued'] as const
export const HYDRATION_LOG_SOURCES = ['web', 'telegram', 'system', 'import'] as const
export const VECTOR_SOURCE_TYPES = ['measurement', 'symptom', 'alert', 'safetyEvent', 'hydration', 'cycle', 'medication', 'fasting', 'pattern', 'report', 'education', 'sprint6ClinicalPrep'] as const
export const VECTOR_DOCUMENT_STATUSES = ['pending', 'indexed', 'failed', 'deleted', 'skipped'] as const
export const AI_MEMORY_JOB_TYPES = ['rebuild', 'delete', 'backfill', 'indexSource'] as const
export const AI_MEMORY_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed', 'canceled'] as const
export const CYCLE_FLOW_INTENSITIES = ['spotting', 'medium', 'heavy'] as const
export const CYCLE_GUARDRAIL_TYPES = ['outsideFertileWindow', 'unprotected', 'calendarMethod'] as const
export const TELEGRAM_CALLBACK_EVENT_TYPES = ['hydrationQuickAdd', 'unknown'] as const
export const TELEGRAM_CALLBACK_STATUSES = ['received', 'processed', 'rejected', 'failed', 'duplicate'] as const

type Values<T extends readonly string[]> = T[number]

export type HlTableName = Values<typeof HL_TABLES>
export type HlRoleCode = Values<typeof HL_ROLE_CODES>
export type HlPermissionCode = Values<typeof HL_PERMISSION_CODES>
export type HlPlanCode = Values<typeof HL_PLAN_CODES>
export type HlFeatureCode = Values<typeof HL_FEATURE_CODES>
export type HlFeatureFlag = Values<typeof HL_FEATURE_FLAGS>
export type HlConfigKey = Values<typeof HL_CONFIG_KEYS>
export type BillingInterval = Values<typeof BILLING_INTERVALS>
export type BillingProvider = Values<typeof BILLING_PROVIDERS>
export type SubscriptionStatus = Values<typeof SUBSCRIPTION_STATUSES>
export type UserAccountStatus = Values<typeof USER_ACCOUNT_STATUSES>
export type QuotaWindow = Values<typeof QUOTA_WINDOWS>
export type ConfigCategory = Values<typeof CONFIG_CATEGORIES>
export type ConfigStorageMode = Values<typeof CONFIG_STORAGE_MODES>
export type OAuthProvider = Values<typeof OAUTH_PROVIDERS>
export type OAuthStateMode = Values<typeof OAUTH_STATE_MODES>
export type EducationTopicType = Values<typeof EDUCATION_TOPIC_TYPES>
export type SymptomPainSeverity = Values<typeof SYMPTOM_PAIN_SEVERITIES>
export type HealthMood = Values<typeof HEALTH_MOODS>
export type SafetyEventSourceType = Values<typeof SAFETY_EVENT_SOURCE_TYPES>
export type SafetyEventSeverity = Values<typeof SAFETY_EVENT_SEVERITIES>
export type SafetyNotificationStatus = Values<typeof SAFETY_NOTIFICATION_STATUSES>
export type HydrationLogSource = Values<typeof HYDRATION_LOG_SOURCES>
export type VectorSourceType = Values<typeof VECTOR_SOURCE_TYPES>
export type VectorDocumentStatus = Values<typeof VECTOR_DOCUMENT_STATUSES>
export type AiMemoryJobType = Values<typeof AI_MEMORY_JOB_TYPES>
export type AiMemoryJobStatus = Values<typeof AI_MEMORY_JOB_STATUSES>
export type CycleFlowIntensity = Values<typeof CYCLE_FLOW_INTENSITIES>
export type CycleGuardrailType = Values<typeof CYCLE_GUARDRAIL_TYPES>
export type TelegramCallbackEventType = Values<typeof TELEGRAM_CALLBACK_EVENT_TYPES>
export type TelegramCallbackStatus = Values<typeof TELEGRAM_CALLBACK_STATUSES>

export type HlRole = {
  id: number
  roleCode: HlRoleCode | string
  roleName: string
  description: string | null
  systemRole: 0 | 1
  active: 0 | 1
}

export type HlPlan = {
  id: number
  planCode: HlPlanCode | string
  planName: string
  billingInterval: BillingInterval
  durationDays: number | null
  priceAmount: number
  currency: string
  trialDays: number
  description: string | null
  active: 0 | 1
}

export type SafetyEventDto = {
  id: number
  userId: number
  sourceType: SafetyEventSourceType
  sourceId: string | null
  eventType: string
  severity: SafetyEventSeverity
  title: string
  message: string
  ruleCode: string | null
  metadataJson: string | null
  acknowledged: 0 | 1
  notificationStatus: SafetyNotificationStatus | null
  createdAt: string
}

export const isHlRoleCode = (value: string): value is HlRoleCode =>
  (HL_ROLE_CODES as readonly string[]).includes(value)

export const isHlPermissionCode = (value: string): value is HlPermissionCode =>
  (HL_PERMISSION_CODES as readonly string[]).includes(value)

export const isHlPlanCode = (value: string): value is HlPlanCode =>
  (HL_PLAN_CODES as readonly string[]).includes(value)

export const isHlFeatureCode = (value: string): value is HlFeatureCode =>
  (HL_FEATURE_CODES as readonly string[]).includes(value)
