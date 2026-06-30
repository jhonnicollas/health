export const HL_TABLES = [
  'HL_aiContextQueries',
  'HL_aiExtractions',
  'HL_aiMemoryJobs',
  'HL_aiRecommendationContexts',
  'HL_aiRecommendations',
  'HL_alerts',
  'HL_apiRateLimits',
  'HL_auditLogs',
  'HL_badges',
  'HL_billingCheckoutSessions',
  'HL_configMetadata',
  'HL_cycleGuardrailAcknowledgements',
  'HL_cycleLogs',
  'HL_cycleSettings',
  'HL_deviceMetrics',
  'HL_devices',
  'HL_educationCards',
  'HL_emailOtpChallenges',
  'HL_emergencyContacts',
  'HL_familyInvites',
  'HL_familyLinks',
  'HL_familyPermissions',
  'HL_fastingSessions',
  'HL_featureFlags',
  'HL_hydrationSettings',
  'HL_hydrationTargets',
  'HL_knowledgeArticles',
  'HL_lastMeasurements',
  'HL_measurementAttachments',
  'HL_measurementDrafts',
  'HL_measurementSessions',
  'HL_measurementValues',
  'HL_medicationLogs',
  'HL_medicationSchedules',
  'HL_medications',
  'HL_metricCatalog',
  'HL_metricRules',
  'HL_notificationSettings',
  'HL_notifications',
  'HL_oauthAccounts',
  'HL_oauthStates',
  'HL_patternInsights',
  'HL_paymentEvents',
  'HL_permissions',
  'HL_planFeatures',
  'HL_plans',
  'HL_pushSubscriptions',
  'HL_reminderSettings',
  'HL_reportShares',
  'HL_reports',
  'HL_rolePermissions',
  'HL_roles',
  'HL_safetyEvents',
  'HL_schemaMigrations',
  'HL_sessions',
  'HL_streaks',
  'HL_subscriptions',
  'HL_symptomLogs',
  'HL_systemConfigs',
  'HL_telegramCallbackEvents',
  'HL_telegramLinks',
  'HL_usageCounters',
  'HL_userBadges',
  'HL_userConsents',
  'HL_userEducationProgress',
  'HL_userProfiles',
  'HL_userRoles',
  'HL_users',
  'HL_vectorDocuments',
  'HL_waterIntakeLogs'
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
  'feature.aiClinicalCopilot.whatsapp',
  'feature.aiClinicalCopilot.streaming',
  'feature.aiClinicalCopilot.vectorMemory',
  'feature.aiClinicalCopilot.firstAid',
  'feature.aiClinicalCopilot.emergencyGuidance',
  'feature.aiClinicalCopilot.doctorHandoff',
  'feature.aiClinicalCopilot.caregiverSummary',
  'feature.aiClinicalCopilot.evalMode',
  'feature.aiClinicalCopilot.medicalReviewerQueue',
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
  'admin.aiModelRun.read',
  'admin.aiSafety.read',
  'admin.aiEvaluation.read',
  'admin.aiEvaluation.review',
  'admin.aiConfig.read',
  'admin.aiConfig.update',
  'admin.whatsapp.read',
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
  'feature.aiClinicalCopilot.whatsapp',
  'feature.aiClinicalCopilot.streaming',
  'feature.aiClinicalCopilot.vectorMemory',
  'feature.aiClinicalCopilot.firstAid',
  'feature.aiClinicalCopilot.emergencyGuidance',
  'feature.aiClinicalCopilot.doctorHandoff',
  'feature.aiClinicalCopilot.caregiverSummary',
  'feature.aiClinicalCopilot.evalMode',
  'feature.aiClinicalCopilot.medicalReviewerQueue',
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
  'feature.aiClinicalCopilot.use',
  'feature.aiClinicalCopilot.whatsapp',
  'feature.aiClinicalCopilot.streaming',
  'feature.aiClinicalCopilot.vectorMemory',
  'feature.aiClinicalCopilot.firstAid',
  'feature.aiClinicalCopilot.emergencyGuidance',
  'feature.aiClinicalCopilot.doctorHandoff',
  'feature.aiClinicalCopilot.caregiverSummary',
  'feature.aiClinicalCopilot.evalMode',
  'feature.aiClinicalCopilot.medicalReviewerQueue',
  'cycleTrackingEnabled',
  'telegramInlineHydrationEnabled'
] as const

export const HL_CONFIG_KEYS = [
  'aiExtractTimeoutMs',
  'aiTextApiKey',
  'aiTextDefaultModel',
  'aiTextEndpoint',
  'aiTextModels',
  'aiVisionModel',
  'aiVisionUseCustomEndpoint',
  'loginRateLimitMaxReq',
  'loginRateLimitWindowMin',
  'maxUploadSizeBytes',
  'ocrRateLimitMax',
  'ocrRateLimitWindowMin',
  'subscriptionEnabled',
  'telegramBotActive',
  'telegramBotToken',
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
  'aiGateway.enabled',
  'aiGateway.gatewayId',
  'aiGateway.primaryProvider',
  'aiGateway.customProvider.9router.enabled',
  'aiGateway.customProvider.9router.slug',
  'aiGateway.directFallback.enabled',
  'aiGateway.retry.maxRetries',
  'aiGateway.retry.timeoutMs',
  'aiGateway.fallback.enabled',
  'workersAi.embeddingModel',
  'workersAi.safetyClassifierModel',
  'workersAi.visionModel',
  'vectorizeIndexName',
  'vectorizeTopK',
  'vectorizePurpose',
  'vectorizeMinScore',
  'vectorize.indexName',
  'vectorize.defaultTopK',
  'vectorize.rerank.enabled',
  'vectorize.maxVectorsPerUser',
  'vectorize.alertThresholdPercent',
  'aiSearch.enabled',
  'aiSearch.instanceId',
  'kv.cache.enabled',
  'kv.promptTtlSeconds',
  'clinicalCopilot.enabled',
  'clinicalCopilot.maxTurns',
  'clinicalCopilot.maxContextItems',
  'clinicalCopilot.temperature',
  'clinicalCopilot.maxTokens',
  'clinicalCopilot.maxConcurrentSessionsPerUser',
  'clinicalCopilot.maxSessionStartsPerHour',
  'clinicalCopilot.maxMessagesPerMinute',
  'clinicalCopilot.maxFollowUpsPerHour',
  'clinicalCopilot.maxHandoffsPerHour',
  'firstAid.maxRequestsPerHour',
  'vectorize.maxRebuildsPerDay',
  'whatsappAi.maxInboundPerMinute',
  'whatsappAi.gatewaySecretRef',
  'medicalSafetyRuntime.enabled',
  'medicalSafetyRuntime.strictMode',
  'whatsappAi.enabled',
  'whatsappAi.maxReplyChars',
  'whatsappAi.healthCheckIntervalSeconds',
  'firstAid.enabled',
  'firstAid.requireApprovedProtocol',
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
export const VECTOR_SOURCE_TYPES = ['symptom_log', 'abnormal_measurement', 'safety_event', 'doctor_report', 'ai_clinical_session', 'medication_adherence', 'hydration_cycle', 'whatsapp_clinical'] as const
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
