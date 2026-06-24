-- HL Health Companion Sprint 5 FINAL FULL D1 additive migration
-- Revision: AI Doctor-like Clinical Copilot / AI dokter pribadi is moved to Sprint 6.
-- Sprint 5C scope is AI Clinical Infrastructure & Vectorize Foundation only.
-- File: SQL_SCHEMA_SPRINT5_FINAL.sql
-- Target: Cloudflare D1 / SQLite
-- Baseline: run after existing Sprint 1-4 schema (07-schema.sql)
-- Scope source: PRD/User Stories Sprint 5 revised for Sprint 6 AI Clinical Copilot handoff.
-- Safety: additive only. No DROP TABLE. No destructive ALTER.
-- Notes:
-- 1) Existing HL_alerts is measurement-centric (metricCode/finalValue required + fixed alertType CHECK).
--    Sprint 5 non-metric guardrails (symptom red flag, cycle irregularity, overhydration)
--    are stored in HL_safetyEvents, then can trigger existing HL_notifications/caregiver flow.
-- 2) Existing HL_aiRecommendations is preserved. Sprint 5 AI context fields are stored in
--    HL_aiRecommendationContexts to avoid fragile ALTER TABLE migrations.
-- 3) Sprint 5 does not create an AI doctor, AI diagnosis, AI prescription, or AI emergency authority.
--    Sprint 5 only prepares isolated Vectorize/context/audit infrastructure for Sprint 6 Clinical Copilot.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- Sprint 5 Foundation: RBAC, Subscription & Admin Core
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS HL_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roleCode TEXT NOT NULL UNIQUE,
  roleName TEXT NOT NULL,
  description TEXT,
  systemRole INTEGER NOT NULL DEFAULT 0 CHECK (systemRole IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS HL_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  permissionCode TEXT NOT NULL UNIQUE,
  permissionName TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS HL_rolePermissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  roleCode TEXT NOT NULL,
  permissionCode TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(roleCode, permissionCode),
  FOREIGN KEY (roleCode) REFERENCES HL_roles(roleCode) ON DELETE CASCADE,
  FOREIGN KEY (permissionCode) REFERENCES HL_permissions(permissionCode) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_userRoles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  roleCode TEXT NOT NULL,
  assignedBy INTEGER,
  assignedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revokedAt TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  UNIQUE(userId, roleCode),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (assignedBy) REFERENCES HL_users(id) ON DELETE SET NULL,
  FOREIGN KEY (roleCode) REFERENCES HL_roles(roleCode) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS HL_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  planCode TEXT NOT NULL UNIQUE,
  planName TEXT NOT NULL,
  billingInterval TEXT NOT NULL CHECK (billingInterval IN ('free','monthly','quarterly','yearly','manual')),
  durationDays INTEGER,
  priceAmount INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  trialDays INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS HL_planFeatures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  planCode TEXT NOT NULL,
  featureCode TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  quotaLimit INTEGER,
  quotaWindow TEXT CHECK (quotaWindow IS NULL OR quotaWindow IN ('day','month','quarter','year','lifetime')),
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(planCode, featureCode),
  FOREIGN KEY (planCode) REFERENCES HL_plans(planCode) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  planCode TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','trialing','pastDue','canceled','expired','paused')),
  currentPeriodStart TEXT,
  currentPeriodEnd TEXT,
  cancelAtPeriodEnd INTEGER NOT NULL DEFAULT 0 CHECK (cancelAtPeriodEnd IN (0,1)),
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual','stripe','midtrans','xendit')),
  providerCustomerId TEXT,
  providerSubscriptionId TEXT,
  providerPlanId TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (planCode) REFERENCES HL_plans(planCode) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS HL_paymentEvents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL CHECK (provider IN ('manual','stripe','midtrans','xendit')),
  eventType TEXT NOT NULL,
  providerEventId TEXT NOT NULL,
  userId INTEGER,
  subscriptionId INTEGER,
  payloadJson TEXT,
  processed INTEGER NOT NULL DEFAULT 0 CHECK (processed IN (0,1)),
  processedAt TEXT,
  errorMessage TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, providerEventId),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE SET NULL,
  FOREIGN KEY (subscriptionId) REFERENCES HL_subscriptions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_usageCounters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  featureCode TEXT NOT NULL,
  usageWindow TEXT NOT NULL,
  usedCount INTEGER NOT NULL DEFAULT 0 CHECK (usedCount >= 0),
  quotaLimitSnapshot INTEGER,
  resetAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, featureCode, usageWindow),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_featureFlags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flagCode TEXT NOT NULL UNIQUE,
  flagName TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  targetRoleCode TEXT,
  targetPlanCode TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (targetRoleCode) REFERENCES HL_roles(roleCode) ON DELETE SET NULL,
  FOREIGN KEY (targetPlanCode) REFERENCES HL_plans(planCode) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_configMetadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  configKey TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('ai','auth','billing','telegram','system','security','feature','hydration','cycle','education','vectorize')),
  isSecret INTEGER NOT NULL DEFAULT 0 CHECK (isSecret IN (0,1)),
  storageMode TEXT NOT NULL DEFAULT 'd1' CHECK (storageMode IN ('d1','env','secret','reference')),
  envVarName TEXT,
  masked INTEGER NOT NULL DEFAULT 0 CHECK (masked IN (0,1)),
  readPolicy TEXT NOT NULL DEFAULT 'admin.config.read',
  writePolicy TEXT NOT NULL DEFAULT 'admin.config.update',
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (configKey) REFERENCES HL_systemConfigs(configKey) ON DELETE CASCADE
);


-- ---------------------------------------------------------
-- Secret Safety Rule
-- ---------------------------------------------------------
-- Sprint 5 schema stores only metadata/secret references for sensitive config.
-- Do not store real API keys, OAuth client secrets, webhook secrets, or bot tokens in D1.
-- Store real secrets in Cloudflare Secrets/Environment variables and keep D1 values as refs/empty placeholders only.

-- ---------------------------------------------------------
-- Sprint 5A: Google OAuth, Education Layer, Daily Symptom Log
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS HL_oauthAccounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  providerSubject TEXT NOT NULL,
  providerEmail TEXT NOT NULL,
  providerEmailVerified INTEGER NOT NULL DEFAULT 0 CHECK (providerEmailVerified IN (0,1)),
  linkedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastLoginAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, providerSubject),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_oauthStates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stateHash TEXT NOT NULL UNIQUE,
  nonceHash TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('google')),
  mode TEXT NOT NULL DEFAULT 'login' CHECK (mode IN ('login','link')),
  returnTo TEXT,
  userId INTEGER,
  expiresAt TEXT NOT NULL,
  consumedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_educationCards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topicType TEXT NOT NULL CHECK (topicType IN ('metric','symptom','hydration','cycle','ai','medication','fasting','report','system')),
  topicCode TEXT NOT NULL,
  title TEXT NOT NULL,
  shortText TEXT,
  whyItMatters TEXT,
  howToUse TEXT,
  normalMeaning TEXT,
  warningMeaning TEXT,
  actionText TEXT,
  redFlagText TEXT,
  sourceLabel TEXT,
  contentMarkdown TEXT,
  minimumPlanCode TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(topicType, topicCode),
  FOREIGN KEY (minimumPlanCode) REFERENCES HL_plans(planCode) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_userEducationProgress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  topicType TEXT NOT NULL,
  topicCode TEXT NOT NULL,
  firstSeenAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastSeenAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledgedAt TEXT,
  seenCount INTEGER NOT NULL DEFAULT 1 CHECK (seenCount >= 0),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, topicType, topicCode),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_symptomLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sourceSessionId INTEGER,
  symptomDateTime TEXT NOT NULL,
  quickSymptomsJson TEXT,
  bodyArea TEXT,
  painScale INTEGER CHECK (painScale IS NULL OR (painScale >= 1 AND painScale <= 10)),
  painSeverity TEXT CHECK (painSeverity IS NULL OR painSeverity IN ('mild','moderate','severe')),
  mood TEXT CHECK (mood IS NULL OR mood IN ('normal','sad','angry','anxious','happy','tired','other')),
  startedAt TEXT,
  durationMinutes INTEGER CHECK (durationMinutes IS NULL OR durationMinutes >= 0),
  description TEXT,
  redFlagsJson TEXT,
  isRedFlag INTEGER NOT NULL DEFAULT 0 CHECK (isRedFlag IN (0,1)),
  safetyEventId INTEGER,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (sourceSessionId) REFERENCES HL_measurementSessions(id) ON DELETE SET NULL
);

-- Flexible non-metric safety/guardrail events for Sprint 5.
CREATE TABLE IF NOT EXISTS HL_safetyEvents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sourceType TEXT NOT NULL CHECK (sourceType IN ('measurement','symptom','cycle','hydration','ai','system','telegram','billing')),
  sourceId TEXT,
  eventType TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','high','critical','emergency')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  ruleCode TEXT,
  metadataJson TEXT,
  acknowledged INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged IN (0,1)),
  acknowledgedBy INTEGER,
  acknowledgedAt TEXT,
  notificationStatus TEXT CHECK (notificationStatus IS NULL OR notificationStatus IN ('pending','sent','failed','skipped','queued')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (acknowledgedBy) REFERENCES HL_users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- Sprint 5B: Hydration Tracker
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS HL_hydrationSettings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  reminderEnabled INTEGER NOT NULL DEFAULT 1 CHECK (reminderEnabled IN (0,1)),
  operatingStart TEXT NOT NULL DEFAULT '09:00',
  operatingEnd TEXT NOT NULL DEFAULT '18:00',
  telegramQuickAddEnabled INTEGER NOT NULL DEFAULT 1 CHECK (telegramQuickAddEnabled IN (0,1)),
  customBaseTargetMl INTEGER,
  isPregnant INTEGER NOT NULL DEFAULT 0 CHECK (isPregnant IN (0,1)),
  isLactating INTEGER NOT NULL DEFAULT 0 CHECK (isLactating IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_hydrationTargets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  targetDate TEXT NOT NULL,
  targetMl INTEGER NOT NULL CHECK (targetMl > 0),
  baseTargetMl INTEGER NOT NULL CHECK (baseTargetMl > 0),
  bodyWeightKg REAL,
  bodyTemperatureC REAL,
  isPregnant INTEGER NOT NULL DEFAULT 0 CHECK (isPregnant IN (0,1)),
  isLactating INTEGER NOT NULL DEFAULT 0 CHECK (isLactating IN (0,1)),
  reasonJson TEXT,
  calculatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, targetDate),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_waterIntakeLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  amountMl INTEGER NOT NULL CHECK (amountMl > 0 AND amountMl <= 3000),
  loggedAt TEXT NOT NULL,
  logDate TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('web','telegram','system','import')),
  telegramMessageId TEXT,
  telegramCallbackId TEXT,
  notes TEXT,
  overLimitAtInsert INTEGER NOT NULL DEFAULT 0 CHECK (overLimitAtInsert IN (0,1)),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Sprint 5C: AI Clinical Infrastructure & Vectorize Foundation Metadata
-- Sprint 6 readiness: these tables support future AI Clinical Copilot context retrieval,
-- but they do not authorize diagnosis, prescription, medication dosage changes, or emergency decisions.
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS HL_vectorDocuments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  vectorId TEXT NOT NULL UNIQUE,
  namespace TEXT NOT NULL,
  sourceType TEXT NOT NULL CHECK (sourceType IN ('measurement','symptom','alert','safetyEvent','hydration','cycle','medication','fasting','pattern','report','education','sprint6ClinicalPrep')),
  sourceId TEXT NOT NULL,
  contentHash TEXT NOT NULL,
  textPreview TEXT,
  metadataJson TEXT,
  embeddingModel TEXT,
  indexedAt TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','indexed','failed','deleted','skipped')),
  errorMessage TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, sourceType, sourceId, contentHash),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_aiContextQueries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  queryText TEXT NOT NULL,
  sourceTypesJson TEXT,
  topK INTEGER NOT NULL DEFAULT 8 CHECK (topK > 0),
  minScore REAL,
  resultJson TEXT,
  usedVectorContext INTEGER NOT NULL DEFAULT 0 CHECK (usedVectorContext IN (0,1)),
  fallbackReason TEXT,
  durationMs INTEGER,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_aiRecommendationContexts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recommendationId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  aiContextQueryId INTEGER,
  vectorContextJson TEXT,
  patternScore INTEGER CHECK (patternScore IS NULL OR (patternScore >= 1 AND patternScore <= 100)),
  scoreReason TEXT,
  usedVectorContext INTEGER NOT NULL DEFAULT 0 CHECK (usedVectorContext IN (0,1)),
  disclaimer TEXT,
  usedFallback INTEGER NOT NULL DEFAULT 0 CHECK (usedFallback IN (0,1)),
  modelName TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recommendationId) REFERENCES HL_aiRecommendations(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (aiContextQueryId) REFERENCES HL_aiContextQueries(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_aiMemoryJobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  jobType TEXT NOT NULL CHECK (jobType IN ('rebuild','delete','backfill','indexSource')),
  sourceTypesJson TEXT,
  rangeStart TEXT,
  rangeEnd TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','completed','failed','canceled')),
  estimatedDocuments INTEGER,
  processedDocuments INTEGER NOT NULL DEFAULT 0,
  failedDocuments INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT,
  requestedBy INTEGER,
  startedAt TEXT,
  completedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (requestedBy) REFERENCES HL_users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- Sprint 5D: Cycle Tracking
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS HL_cycleSettings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  cycleLengthDays INTEGER NOT NULL DEFAULT 28 CHECK (cycleLengthDays > 0 AND cycleLengthDays <= 120),
  periodLengthDays INTEGER NOT NULL DEFAULT 5 CHECK (periodLengthDays > 0 AND periodLengthDays <= 15),
  lastPeriodStart TEXT,
  isPregnant INTEGER NOT NULL DEFAULT 0 CHECK (isPregnant IN (0,1)),
  isLactating INTEGER NOT NULL DEFAULT 0 CHECK (isLactating IN (0,1)),
  isMenopause INTEGER NOT NULL DEFAULT 0 CHECK (isMenopause IN (0,1)),
  predictionPaused INTEGER NOT NULL DEFAULT 0 CHECK (predictionPaused IN (0,1)),
  pauseReason TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_cycleLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  logDate TEXT NOT NULL,
  hasPeriodFlow INTEGER NOT NULL DEFAULT 0 CHECK (hasPeriodFlow IN (0,1)),
  flowIntensity TEXT CHECK (flowIntensity IS NULL OR flowIntensity IN ('spotting','medium','heavy')),
  mood TEXT CHECK (mood IS NULL OR mood IN ('normal','sad','angry','anxious','happy','tired','other')),
  physicalSymptomsJson TEXT,
  unprotected INTEGER NOT NULL DEFAULT 0 CHECK (unprotected IN (0,1)),
  contraceptionGuardrailAcknowledgedAt TEXT,
  notes TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(userId, logDate),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_cycleGuardrailAcknowledgements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  guardrailType TEXT NOT NULL CHECK (guardrailType IN ('outsideFertileWindow','unprotected','calendarMethod')),
  relatedDate TEXT,
  messageVersion TEXT NOT NULL DEFAULT 'sprint5.v1',
  acknowledgedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_familyPermissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  familyLinkId INTEGER NOT NULL,
  permissionCode TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 0 CHECK (allowed IN (0,1)),
  grantedBy INTEGER,
  grantedAt TEXT,
  revokedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(familyLinkId, permissionCode),
  FOREIGN KEY (familyLinkId) REFERENCES HL_familyLinks(id) ON DELETE CASCADE,
  FOREIGN KEY (grantedBy) REFERENCES HL_users(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- Sprint 5E: Telegram Inline Hydration UX
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS HL_telegramCallbackEvents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  callbackQueryId TEXT NOT NULL UNIQUE,
  userId INTEGER,
  telegramChatId TEXT,
  telegramMessageId TEXT,
  callbackData TEXT NOT NULL,
  eventType TEXT NOT NULL CHECK (eventType IN ('hydrationQuickAdd','unknown')),
  amountMl INTEGER,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processed','rejected','failed','duplicate')),
  waterIntakeLogId INTEGER,
  rejectionReason TEXT,
  payloadJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processedAt TEXT,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE SET NULL,
  FOREIGN KEY (waterIntakeLogId) REFERENCES HL_waterIntakeLogs(id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idxHLRolesCode ON HL_roles(roleCode);
CREATE INDEX IF NOT EXISTS idxHLPermissionsCode ON HL_permissions(permissionCode);
CREATE INDEX IF NOT EXISTS idxHLRolePermissionsRole ON HL_rolePermissions(roleCode);
CREATE INDEX IF NOT EXISTS idxHLRolePermissionsPermission ON HL_rolePermissions(permissionCode);
CREATE INDEX IF NOT EXISTS idxHLUserRolesUserActive ON HL_userRoles(userId, active);
CREATE INDEX IF NOT EXISTS idxHLUserRolesRoleActive ON HL_userRoles(roleCode, active);

CREATE INDEX IF NOT EXISTS idxHLPlansCode ON HL_plans(planCode);
CREATE INDEX IF NOT EXISTS idxHLPlanFeaturesPlan ON HL_planFeatures(planCode, enabled);
CREATE INDEX IF NOT EXISTS idxHLPlanFeaturesFeature ON HL_planFeatures(featureCode, enabled);
CREATE INDEX IF NOT EXISTS idxHLSubscriptionsUserStatus ON HL_subscriptions(userId, status, currentPeriodEnd);
CREATE INDEX IF NOT EXISTS idxHLSubscriptionsProvider ON HL_subscriptions(provider, providerSubscriptionId);
CREATE INDEX IF NOT EXISTS idxHLPaymentEventsProvider ON HL_paymentEvents(provider, providerEventId);
CREATE INDEX IF NOT EXISTS idxHLUsageCountersUserFeature ON HL_usageCounters(userId, featureCode, usageWindow);
CREATE INDEX IF NOT EXISTS idxHLFeatureFlagsEnabled ON HL_featureFlags(flagCode, enabled);
CREATE INDEX IF NOT EXISTS idxHLConfigMetadataCategory ON HL_configMetadata(category, isSecret, active);
CREATE INDEX IF NOT EXISTS idxHLConfigMetadataPolicy ON HL_configMetadata(readPolicy, writePolicy);

CREATE INDEX IF NOT EXISTS idxHLOauthAccountsUser ON HL_oauthAccounts(userId);
CREATE INDEX IF NOT EXISTS idxHLOauthAccountsProviderSubject ON HL_oauthAccounts(provider, providerSubject);
CREATE INDEX IF NOT EXISTS idxHLOauthStatesExpires ON HL_oauthStates(expiresAt, consumedAt);
CREATE INDEX IF NOT EXISTS idxHLEducationCardsTopic ON HL_educationCards(topicType, topicCode, active);
CREATE INDEX IF NOT EXISTS idxHLUserEducationProgressUser ON HL_userEducationProgress(userId, topicType, topicCode);
CREATE INDEX IF NOT EXISTS idxHLSymptomLogsUserDate ON HL_symptomLogs(userId, symptomDateTime);
CREATE INDEX IF NOT EXISTS idxHLSymptomLogsSourceSession ON HL_symptomLogs(sourceSessionId);
CREATE INDEX IF NOT EXISTS idxHLSymptomLogsRedFlag ON HL_symptomLogs(userId, isRedFlag, symptomDateTime);
CREATE INDEX IF NOT EXISTS idxHLSafetyEventsUserDate ON HL_safetyEvents(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLSafetyEventsTypeSeverity ON HL_safetyEvents(eventType, severity, createdAt);

CREATE INDEX IF NOT EXISTS idxHLHydrationSettingsUser ON HL_hydrationSettings(userId);
CREATE INDEX IF NOT EXISTS idxHLHydrationTargetsUserDate ON HL_hydrationTargets(userId, targetDate);
CREATE INDEX IF NOT EXISTS idxHLWaterIntakeLogsUserDate ON HL_waterIntakeLogs(userId, logDate, loggedAt);
CREATE INDEX IF NOT EXISTS idxHLWaterIntakeLogsTelegramCallback ON HL_waterIntakeLogs(telegramCallbackId);

CREATE INDEX IF NOT EXISTS idxHLVectorDocumentsUserSource ON HL_vectorDocuments(userId, sourceType, sourceId);
CREATE INDEX IF NOT EXISTS idxHLVectorDocumentsNamespace ON HL_vectorDocuments(namespace, status, indexedAt);
CREATE INDEX IF NOT EXISTS idxHLVectorDocumentsStatus ON HL_vectorDocuments(status, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAiContextQueriesUserDate ON HL_aiContextQueries(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAiRecommendationContextsRecommendation ON HL_aiRecommendationContexts(recommendationId);
CREATE INDEX IF NOT EXISTS idxHLAiMemoryJobsUserStatus ON HL_aiMemoryJobs(userId, status, createdAt);

CREATE INDEX IF NOT EXISTS idxHLCycleSettingsUser ON HL_cycleSettings(userId);
CREATE INDEX IF NOT EXISTS idxHLCycleLogsUserDate ON HL_cycleLogs(userId, logDate);
CREATE INDEX IF NOT EXISTS idxHLCycleGuardrailUserDate ON HL_cycleGuardrailAcknowledgements(userId, relatedDate, guardrailType);
CREATE INDEX IF NOT EXISTS idxHLFamilyPermissionsLink ON HL_familyPermissions(familyLinkId, permissionCode, allowed);

CREATE INDEX IF NOT EXISTS idxHLTelegramCallbackEventsStatus ON HL_telegramCallbackEvents(status, createdAt);
CREATE INDEX IF NOT EXISTS idxHLTelegramCallbackEventsUser ON HL_telegramCallbackEvents(userId, createdAt);

-- Sprint 6 handoff marker: this migration prepares Vectorize/context metadata only.
-- Future Sprint 6 clinical-copilot tables must be added via a separate additive migration.

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName)
VALUES ('20260624Sprint5FullReleaseProgramSchemaFinalAiSprint6Ready');
