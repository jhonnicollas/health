-- HL Health Companion — Unified D1 Schema (Sprint 1–5 + S5X hardening)
-- Target: Cloudflare D1 / SQLite
-- R2 bucket: multi-apps-ai-bucket (binding LOGS)
-- Queue: telegram-submit-summary (binding TELEGRAM_QUEUE)
-- Naming rules:
--   Table prefix: HL_
--   No extra underscore after HL_
--   Field names: camelCase
--   JSON columns: payloadJson, summaryJson, dataJson, metadataJson, configurationJson
-- This file is a merge of:
--   - Sprint 1–4 baseline (archive/docs_legacy_2025_sprint1-5/07-schema.sql)
--   - Sprint 5 additive schema (docs/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql)
--   - S5X migrations (worker/migrations/001_s5x_auth_email_otp.sql, 002_s5x_whatsapp_profile.sql)

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------
-- Migration tracker
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_schemaMigrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migrationName TEXT NOT NULL UNIQUE,
  appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 0. System Configurations (No Hardcoding)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_systemConfigs (
    configKey TEXT PRIMARY KEY,
    configValue TEXT NOT NULL DEFAULT '',
    dataType TEXT NOT NULL DEFAULT 'string' CHECK (dataType IN ('string','number','boolean','json')),
    description TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
-- 1. Users, Sessions, Profiles, Consents
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT,
  authProvider TEXT NOT NULL DEFAULT 'local',
  displayName TEXT NOT NULL,
  telegramEnabled INTEGER NOT NULL DEFAULT 0,
  browserPushEnabled INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastLoginAt TEXT,
  emailVerifiedAt TEXT,
  emailVerificationMethod TEXT
);

CREATE TABLE IF NOT EXISTS HL_emailOtpChallenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  normalizedEmail TEXT NOT NULL,
  otpHash TEXT NOT NULL,
  salt TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('register', 'login')),
  failedAttempts INTEGER NOT NULL DEFAULT 0,
  expiresAt TEXT NOT NULL,
  consumedAt TEXT,
  resendCount INTEGER NOT NULL DEFAULT 0,
  lastResendAt TEXT,
  ipHash TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionTokenHash TEXT NOT NULL UNIQUE,
  userAgent TEXT,
  ipHash TEXT,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revokedAt TEXT,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_userProfiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  sex TEXT NOT NULL CHECK (sex IN ('male','female','other')),
  birthDate TEXT NOT NULL,
  heightCm REAL NOT NULL CHECK (heightCm > 0),
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  accessibilityMode TEXT NOT NULL DEFAULT 'normal' CHECK (accessibilityMode IN ('normal','senior','highContrast')),
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light','warm','dark','highContrast')),
  emergencyConsent INTEGER NOT NULL DEFAULT 0,
  aiConsent INTEGER NOT NULL DEFAULT 1,
  dataShareConsent INTEGER NOT NULL DEFAULT 0,
  whatsappNumber TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_userConsents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  consentType TEXT NOT NULL,
  consentValue INTEGER NOT NULL DEFAULT 0,
  consentText TEXT,
  version TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 2. RBAC (Sprint 5 Foundation)
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

-- ---------------------------------------------------------
-- 3. Plans, Subscriptions, Billing (Sprint 5 Foundation)
-- ---------------------------------------------------------
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

CREATE TABLE IF NOT EXISTS HL_billingCheckoutSessions (
  id TEXT PRIMARY KEY,
  userId INTEGER NOT NULL,
  planCode TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('manual','mock','xendit')),
  mode TEXT NOT NULL,
  merchantRef TEXT NOT NULL UNIQUE,
  providerCheckoutId TEXT,
  checkoutUrl TEXT,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','expired','cancelled')),
  successUrl TEXT,
  cancelUrl TEXT,
  paidAt TEXT,
  expiresAt TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (planCode) REFERENCES HL_plans(planCode) ON DELETE RESTRICT
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

-- ---------------------------------------------------------
-- 4. OAuth (Sprint 5A)
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

-- ---------------------------------------------------------
-- 5. Device & Metric Catalog
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceCode TEXT NOT NULL UNIQUE,
  deviceName TEXT NOT NULL,
  deviceType TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  aiPromptKey TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS HL_metricCatalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metricCode TEXT NOT NULL UNIQUE,
  metricName TEXT NOT NULL,
  category TEXT NOT NULL,
  unit TEXT NOT NULL,
  inputType TEXT NOT NULL CHECK (inputType IN ('photo','upload','manual','calculated','mixed')),
  requiresAttachment INTEGER NOT NULL DEFAULT 0,
  requiresSex INTEGER NOT NULL DEFAULT 0,
  requiresFasting INTEGER NOT NULL DEFAULT 0,
  isCalculated INTEGER NOT NULL DEFAULT 0,
  physicalMin REAL,
  physicalMax REAL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS HL_deviceMetrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deviceCode TEXT NOT NULL,
  metricCode TEXT NOT NULL,
  requiredMetric INTEGER NOT NULL DEFAULT 1,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (deviceCode, metricCode),
  FOREIGN KEY (deviceCode) REFERENCES HL_devices(deviceCode) ON DELETE CASCADE,
  FOREIGN KEY (metricCode) REFERENCES HL_metricCatalog(metricCode) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_metricRules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ruleCode TEXT NOT NULL UNIQUE,
  metricCode TEXT NOT NULL,
  sex TEXT NOT NULL DEFAULT 'all' CHECK (sex IN ('all','male','female','other')),
  ageMin INTEGER NOT NULL DEFAULT 0,
  ageMax INTEGER NOT NULL DEFAULT 200,
  minValue REAL NOT NULL,
  maxValue REAL NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('normal','info','warning','high','critical','emergency')),
  popupTitle TEXT NOT NULL,
  popupMessage TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  sourceLabel TEXT NOT NULL,
  emergencyLevel TEXT NOT NULL DEFAULT 'none' CHECK (emergencyLevel IN ('none','watch','urgent','emergency')),
  rulePriority INTEGER NOT NULL DEFAULT 100,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (metricCode, sex, ageMin, ageMax, minValue, maxValue, unit, status, severity, emergencyLevel),
  FOREIGN KEY (metricCode) REFERENCES HL_metricCatalog(metricCode) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 6. Measurements
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_measurementDrafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  profileId INTEGER,
  selectedMetricsJson TEXT NOT NULL,
  draftDataJson TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','submitted','cancelled','expired')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expiresAt TEXT,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (profileId) REFERENCES HL_userProfiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_measurementSessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  profileId INTEGER NOT NULL,
  measuredAt TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('photo','upload','manual','mixed')),
  notes TEXT,
  hasAi INTEGER NOT NULL DEFAULT 0,
  hasAttachment INTEGER NOT NULL DEFAULT 0,
  hasEmergency INTEGER NOT NULL DEFAULT 0,
  submittedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (profileId) REFERENCES HL_userProfiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_measurementValues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  metricCode TEXT NOT NULL,
  deviceCode TEXT,
  rawAiValue REAL,
  finalValue REAL NOT NULL,
  unit TEXT NOT NULL,
  confidence REAL,
  manualOverride INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('normal','info','warning','high','critical','emergency')),
  emergencyLevel TEXT NOT NULL DEFAULT 'none' CHECK (emergencyLevel IN ('none','watch','urgent','emergency')),
  ruleId INTEGER,
  measuredAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sessionId) REFERENCES HL_measurementSessions(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (metricCode) REFERENCES HL_metricCatalog(metricCode) ON DELETE RESTRICT,
  FOREIGN KEY (deviceCode) REFERENCES HL_devices(deviceCode) ON DELETE SET NULL,
  FOREIGN KEY (ruleId) REFERENCES HL_metricRules(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_measurementAttachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  metricCode TEXT NOT NULL,
  r2Key TEXT NOT NULL UNIQUE,
  fileName TEXT NOT NULL,
  fileType TEXT NOT NULL,
  fileSize INTEGER NOT NULL,
  watermarked INTEGER NOT NULL DEFAULT 1,
  compressed INTEGER NOT NULL DEFAULT 1,
  compressionQuality INTEGER NOT NULL DEFAULT 50,
  imageWidth INTEGER,
  imageHeight INTEGER,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sessionId) REFERENCES HL_measurementSessions(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (metricCode) REFERENCES HL_metricCatalog(metricCode) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS HL_lastMeasurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  deviceCode TEXT,
  metricCode TEXT NOT NULL,
  finalValue REAL NOT NULL,
  unit TEXT NOT NULL,
  measuredAt TEXT NOT NULL,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  UNIQUE(userId, deviceCode, metricCode)
);

-- ---------------------------------------------------------
-- 7. AI Extractions / Recommendations
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_aiExtractions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionDraftId INTEGER,
  deviceCode TEXT,
  metricGroup TEXT NOT NULL,
  selectedMetricsJson TEXT NOT NULL,
  rawResponse TEXT,
  parsedJson TEXT,
  durationMs INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 0,
  timeout INTEGER NOT NULL DEFAULT 0,
  confidence REAL,
  modelName TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (sessionDraftId) REFERENCES HL_measurementDrafts(id) ON DELETE SET NULL,
  FOREIGN KEY (deviceCode) REFERENCES HL_devices(deviceCode) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_aiRecommendations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionId INTEGER,
  summaryText TEXT NOT NULL,
  todayJson TEXT,
  threeDayJson TEXT,
  sevenDayJson TEXT,
  ruleStatusJson TEXT,
  modelName TEXT,
  durationMs INTEGER NOT NULL DEFAULT 0,
  safetyStatus TEXT NOT NULL DEFAULT 'safe' CHECK (safetyStatus IN ('safe','filtered','fallback')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (sessionId) REFERENCES HL_measurementSessions(id) ON DELETE CASCADE
);

-- Sprint 5C AI infrastructure
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
-- 8. Alerts & Notifications (measurement-centric)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionId INTEGER,
  metricCode TEXT NOT NULL,
  finalValue REAL NOT NULL,
  unit TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('normal','info','warning','high','critical','emergency')),
  alertType TEXT NOT NULL CHECK (alertType IN ('rule','emergency','reminder','system')),
  message TEXT NOT NULL,
  acknowledged INTEGER NOT NULL DEFAULT 0,
  acknowledgedBy INTEGER,
  acknowledgedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (sessionId) REFERENCES HL_measurementSessions(id) ON DELETE CASCADE,
  FOREIGN KEY (metricCode) REFERENCES HL_metricCatalog(metricCode) ON DELETE RESTRICT,
  FOREIGN KEY (acknowledgedBy) REFERENCES HL_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('inApp','telegram','browser','email')),
  notificationType TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  payloadJson TEXT,
  errorMessage TEXT,
  sentAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_pushSubscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  userAgent TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_notificationSettings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  telegramSubmitSummary INTEGER NOT NULL DEFAULT 1,
  telegramEmergencyAlert INTEGER NOT NULL DEFAULT 1,
  browserReminder INTEGER NOT NULL DEFAULT 0,
  quietStartTime TEXT,
  quietEndTime TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_reminderSettings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  reminderType TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  scheduleTime TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel IN ('inApp','telegram','browser','email')),
  payloadJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (userId, reminderType, channel),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 9. Family, Emergency, Caregiver
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_familyLinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ownerUserId INTEGER NOT NULL,
  linkedUserId INTEGER,
  role TEXT NOT NULL CHECK (role IN ('owner','caregiver','viewer','emergencyContact','doctorViewer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','revoked','expired')),
  canViewDashboard INTEGER NOT NULL DEFAULT 0,
  canInputMeasurement INTEGER NOT NULL DEFAULT 0,
  canReceiveAlert INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ownerUserId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (linkedUserId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_familyInvites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ownerUserId INTEGER NOT NULL,
  inviteEmail TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('caregiver','viewer','emergencyContact','doctorViewer')),
  inviteTokenHash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','revoked')),
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ownerUserId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_emergencyContacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  contactName TEXT NOT NULL,
  contactRelation TEXT,
  contactPhone TEXT,
  contactEmail TEXT,
  telegramChatId TEXT,
  consentGiven INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
-- 10. Telegram
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_telegramLinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL UNIQUE,
  telegramChatId TEXT,
  telegramUsername TEXT,
  verificationCodeHash TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

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
-- 11. Medication, Fasting, Badges, Streaks, Reports
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  medicationName TEXT NOT NULL,
  dosageText TEXT,
  scheduleText TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_medicationSchedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  medicationId INTEGER NOT NULL,
  scheduleTime TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (medicationId) REFERENCES HL_medications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_medicationLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  medicationId INTEGER NOT NULL,
  takenAt TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('taken','skipped','missed','unknown')),
  note TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (medicationId) REFERENCES HL_medications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_fastingSessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  fastingType TEXT NOT NULL CHECK (fastingType IN ('glucoseFasting','cholesterolTotal','uricAcid','general')),
  targetHours REAL NOT NULL,
  startedAt TEXT NOT NULL,
  endedAt TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','expired')),
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  badgeCode TEXT NOT NULL UNIQUE,
  badgeName TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS HL_userBadges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  badgeCode TEXT NOT NULL,
  earnedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (userId, badgeCode),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE,
  FOREIGN KEY (badgeCode) REFERENCES HL_badges(badgeCode) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_streaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  streakType TEXT NOT NULL,
  currentCount INTEGER NOT NULL DEFAULT 0,
  bestCount INTEGER NOT NULL DEFAULT 0,
  lastDate TEXT,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (userId, streakType),
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  reportType TEXT NOT NULL CHECK (reportType IN ('daily','weekly','monthly','doctorReady30d')),
  rangeStart TEXT NOT NULL,
  rangeEnd TEXT NOT NULL,
  r2Key TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','ready','failed')),
  summaryJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_reportShares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reportId INTEGER NOT NULL,
  userId INTEGER NOT NULL,
  shareTokenHash TEXT NOT NULL UNIQUE,
  recipientLabel TEXT,
  expiresAt TEXT NOT NULL,
  revokedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reportId) REFERENCES HL_reports(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- 12. Patterns & Knowledge Base
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_patternInsights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  insightType TEXT NOT NULL,
  rangeStart TEXT NOT NULL,
  rangeEnd TEXT NOT NULL,
  summaryText TEXT NOT NULL,
  dataJson TEXT,
  confidence REAL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS HL_knowledgeArticles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  contentMarkdown TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 13. Audit & Rate Limiting
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS HL_auditLogs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  metadataJson TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES HL_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS HL_apiRateLimits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rateKey TEXT NOT NULL,
  routeKey TEXT NOT NULL,
  windowStart TEXT NOT NULL,
  requestCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (rateKey, routeKey, windowStart)
);

-- ---------------------------------------------------------
-- 14. Education (Sprint 5A)
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 15. Symptoms & Safety Events (Sprint 5A)
-- ---------------------------------------------------------
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
-- 16. Hydration (Sprint 5B)
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
-- 17. Cycle Tracking (Sprint 5D)
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

-- ---------------------------------------------------------
-- 18. Indexes (Sprint 1–5)
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idxHLUsersEmail ON HL_users(email);
CREATE INDEX IF NOT EXISTS idxHLSessionsUser ON HL_sessions(userId);
CREATE INDEX IF NOT EXISTS idxHLSessionsToken ON HL_sessions(sessionTokenHash);
CREATE INDEX IF NOT EXISTS idxHLProfilesUser ON HL_userProfiles(userId);
CREATE INDEX IF NOT EXISTS idx_emailOtpChallenges_normalizedEmail ON HL_emailOtpChallenges(normalizedEmail);
CREATE INDEX IF NOT EXISTS idx_emailOtpChallenges_expiresAt ON HL_emailOtpChallenges(expiresAt);

CREATE INDEX IF NOT EXISTS idxHLMetricRulesLookup ON HL_metricRules(metricCode, sex, minValue, maxValue, active);
CREATE INDEX IF NOT EXISTS idxHLMetricCatalogCode ON HL_metricCatalog(metricCode);
CREATE INDEX IF NOT EXISTS idxHLDeviceMetricsDevice ON HL_deviceMetrics(deviceCode);

CREATE INDEX IF NOT EXISTS idxHLMeasurementSessionsUserDate ON HL_measurementSessions(userId, measuredAt);
CREATE INDEX IF NOT EXISTS idxHLMeasurementValuesUserMetricDate ON HL_measurementValues(userId, metricCode, measuredAt);
CREATE INDEX IF NOT EXISTS idxHLMeasurementValuesSession ON HL_measurementValues(sessionId);
CREATE INDEX IF NOT EXISTS idxHLMeasurementAttachmentsSession ON HL_measurementAttachments(sessionId);
CREATE INDEX IF NOT EXISTS idxHLMeasurementAttachmentsUser ON HL_measurementAttachments(userId);
CREATE INDEX IF NOT EXISTS idxLastMeterialsUserDevice ON HL_lastMeasurements(userId, deviceCode, metricCode);

CREATE INDEX IF NOT EXISTS idxHLAiExtractionsUserDate ON HL_aiExtractions(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAiRecommendationsUserDate ON HL_aiRecommendations(userId, createdAt);

CREATE INDEX IF NOT EXISTS idxHLAlertsUserDate ON HL_alerts(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAlertsSession ON HL_alerts(sessionId);
CREATE INDEX IF NOT EXISTS idxHLNotificationsUserDate ON HL_notifications(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLNotificationsStatus ON HL_notifications(status, channel);

CREATE INDEX IF NOT EXISTS idxHLFamilyOwner ON HL_familyLinks(ownerUserId);
CREATE INDEX IF NOT EXISTS idxHLFamilyLinked ON HL_familyLinks(linkedUserId);
CREATE INDEX IF NOT EXISTS idxHLFamilyInvitesToken ON HL_familyInvites(inviteTokenHash);
CREATE INDEX IF NOT EXISTS idxHLFamilyPermissionsLink ON HL_familyPermissions(familyLinkId, permissionCode, allowed);

CREATE INDEX IF NOT EXISTS idxHLMedicationsUser ON HL_medications(userId);
CREATE INDEX IF NOT EXISTS idxHLMedicationLogsUserDate ON HL_medicationLogs(userId, takenAt);
CREATE INDEX IF NOT EXISTS idxHLFastingUserStatus ON HL_fastingSessions(userId, status);

CREATE INDEX IF NOT EXISTS idxHLReportsUserDate ON HL_reports(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLReportSharesToken ON HL_reportShares(shareTokenHash);
CREATE INDEX IF NOT EXISTS idxHLPatternInsightsUserDate ON HL_patternInsights(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAuditUserDate ON HL_auditLogs(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLRateLimitsLookup ON HL_apiRateLimits(rateKey, routeKey, windowStart);

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

CREATE INDEX IF NOT EXISTS idxHLTelegramCallbackEventsStatus ON HL_telegramCallbackEvents(status, createdAt);
CREATE INDEX IF NOT EXISTS idxHLTelegramCallbackEventsUser ON HL_telegramCallbackEvents(userId, createdAt);

-- ---------------------------------------------------------
-- 19. Migration markers
-- ---------------------------------------------------------
INSERT OR IGNORE INTO HL_schemaMigrations (migrationName) VALUES
('20260620InitialHealthCompanionSchema'),
('20260624Sprint5FullReleaseProgramSchemaFinalAiSprint6Ready'),
('20250901_s5x_auth_email_otp'),
('20250902_s5x_whatsapp_profile');

-- ---------------------------------------------------------
-- Secret Safety Rule
-- ---------------------------------------------------------
-- D1 stores only metadata/secret references. Real secrets live in Cloudflare Secrets/Environment.
-- No plaintext API keys, OAuth client secrets, webhook secrets, bot tokens, VAPID keys in D1.
