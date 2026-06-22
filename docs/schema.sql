-- HL Health Companion schema for Cloudflare D1 / SQLite
-- Existing database binding:
-- DB = multi_Ai_db
-- Existing R2 binding:
-- LOGS = multi-apps-ai-bucket
--
-- Naming rules:
-- 1. Table names use prefix HL_
-- 2. No extra underscore in table names after HL_
-- 3. Field names use camelCase
-- 4. Original image is not stored; only compressed watermarked final attachment is stored in R2

PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

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
    configValue TEXT NOT NULL,
    dataType TEXT NOT NULL, -- 'number', 'boolean', 'string', 'json'
    description TEXT,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

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
  lastLoginAt TEXT
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

-- Indexes

CREATE INDEX IF NOT EXISTS idxHLUsersEmail ON HL_users(email);
CREATE INDEX IF NOT EXISTS idxHLSessionsUser ON HL_sessions(userId);
CREATE INDEX IF NOT EXISTS idxHLSessionsToken ON HL_sessions(sessionTokenHash);
CREATE INDEX IF NOT EXISTS idxHLProfilesUser ON HL_userProfiles(userId);

CREATE INDEX IF NOT EXISTS idxHLMetricRulesLookup ON HL_metricRules(metricCode, sex, minValue, maxValue, active);
CREATE INDEX IF NOT EXISTS idxHLMetricCatalogCode ON HL_metricCatalog(metricCode);
CREATE INDEX IF NOT EXISTS idxHLDeviceMetricsDevice ON HL_deviceMetrics(deviceCode);

CREATE INDEX IF NOT EXISTS idxHLMeasurementSessionsUserDate ON HL_measurementSessions(userId, measuredAt);
CREATE INDEX IF NOT EXISTS idxHLMeasurementValuesUserMetricDate ON HL_measurementValues(userId, metricCode, measuredAt);
CREATE INDEX IF NOT EXISTS idxHLMeasurementValuesSession ON HL_measurementValues(sessionId);
CREATE INDEX IF NOT EXISTS idxHLMeasurementAttachmentsSession ON HL_measurementAttachments(sessionId);
CREATE INDEX IF NOT EXISTS idxHLMeasurementAttachmentsUser ON HL_measurementAttachments(userId);

CREATE INDEX IF NOT EXISTS idxHLAiExtractionsUserDate ON HL_aiExtractions(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAiRecommendationsUserDate ON HL_aiRecommendations(userId, createdAt);

CREATE INDEX IF NOT EXISTS idxHLAlertsUserDate ON HL_alerts(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAlertsSession ON HL_alerts(sessionId);
CREATE INDEX IF NOT EXISTS idxHLNotificationsUserDate ON HL_notifications(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLNotificationsStatus ON HL_notifications(status, channel);

CREATE INDEX IF NOT EXISTS idxHLFamilyOwner ON HL_familyLinks(ownerUserId);
CREATE INDEX IF NOT EXISTS idxHLFamilyLinked ON HL_familyLinks(linkedUserId);
CREATE INDEX IF NOT EXISTS idxHLFamilyInvitesToken ON HL_familyInvites(inviteTokenHash);

CREATE INDEX IF NOT EXISTS idxHLMedicationsUser ON HL_medications(userId);
CREATE INDEX IF NOT EXISTS idxHLMedicationLogsUserDate ON HL_medicationLogs(userId, takenAt);
CREATE INDEX IF NOT EXISTS idxHLFastingUserStatus ON HL_fastingSessions(userId, status);

CREATE INDEX IF NOT EXISTS idxHLReportsUserDate ON HL_reports(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLReportSharesToken ON HL_reportShares(shareTokenHash);
CREATE INDEX IF NOT EXISTS idxHLPatternInsightsUserDate ON HL_patternInsights(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLAuditUserDate ON HL_auditLogs(userId, createdAt);
CREATE INDEX IF NOT EXISTS idxHLRateLimitsLookup ON HL_apiRateLimits(rateKey, routeKey, windowStart);

-- Seed data is maintained separately in seed.sql and seed-rules.generated.sql
-- Run those files after applying this schema.

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName)
VALUES ('20260620InitialHealthCompanionSchema');

COMMIT;
