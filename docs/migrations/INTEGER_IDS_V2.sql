-- HL Health Companion - INTEGER_IDS_V2 migration design
-- Status: design-only for EP-P1.2. Do NOT run on production yet.
-- Required sequence:
-- 1. Backup/export production D1.
-- 2. Run this against a local/dev copy.
-- 3. Complete EP-P1.3 backend ID refactor and EP-P1.4 frontend ID refactor.
-- 4. Only then adapt/finalize/apply the production migration.

PRAGMA foreign_keys = OFF;

-- D1 CLI rejects explicit BEGIN/COMMIT in d1 execute mode.
-- Keep this file idempotent with DROP TABLE IF EXISTS for local/dev design runs.
-- Production apply must be handled as an approved coordinated migration after
-- EP-P1.3/EP-P1.4.

-- ---------------------------------------------------------------------------
-- 0. Preflight notes
-- ---------------------------------------------------------------------------
-- Export command before production migration:
-- npx wrangler d1 export multi_Ai_db --remote --output backups/multi_Ai_db-before-integer-ids.sql
--
-- This migration uses shadow-table and mapping-table strategy:
-- - _idMap tables store old TEXT IDs and new INTEGER IDs.
-- - _v2 tables use INTEGER PRIMARY KEY AUTOINCREMENT.
-- - Copy parents first, children second.
-- - Validate row counts and PRAGMA foreign_key_check before table swap.

-- ---------------------------------------------------------------------------
-- 1. Mapping tables
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _idMap_HL_users;
CREATE TABLE _idMap_HL_users (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_sessions;
CREATE TABLE _idMap_HL_sessions (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_userProfiles;
CREATE TABLE _idMap_HL_userProfiles (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_userConsents;
CREATE TABLE _idMap_HL_userConsents (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_devices;
CREATE TABLE _idMap_HL_devices (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_metricCatalog;
CREATE TABLE _idMap_HL_metricCatalog (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_deviceMetrics;
CREATE TABLE _idMap_HL_deviceMetrics (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_metricRules;
CREATE TABLE _idMap_HL_metricRules (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_measurementDrafts;
CREATE TABLE _idMap_HL_measurementDrafts (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_measurementSessions;
CREATE TABLE _idMap_HL_measurementSessions (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_measurementValues;
CREATE TABLE _idMap_HL_measurementValues (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_measurementAttachments;
CREATE TABLE _idMap_HL_measurementAttachments (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_aiExtractions;
CREATE TABLE _idMap_HL_aiExtractions (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_aiRecommendations;
CREATE TABLE _idMap_HL_aiRecommendations (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_alerts;
CREATE TABLE _idMap_HL_alerts (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_notifications;
CREATE TABLE _idMap_HL_notifications (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_telegramLinks;
CREATE TABLE _idMap_HL_telegramLinks (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_pushSubscriptions;
CREATE TABLE _idMap_HL_pushSubscriptions (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_notificationSettings;
CREATE TABLE _idMap_HL_notificationSettings (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_reminderSettings;
CREATE TABLE _idMap_HL_reminderSettings (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_familyLinks;
CREATE TABLE _idMap_HL_familyLinks (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_familyInvites;
CREATE TABLE _idMap_HL_familyInvites (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_emergencyContacts;
CREATE TABLE _idMap_HL_emergencyContacts (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_medications;
CREATE TABLE _idMap_HL_medications (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_medicationSchedules;
CREATE TABLE _idMap_HL_medicationSchedules (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_medicationLogs;
CREATE TABLE _idMap_HL_medicationLogs (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_fastingSessions;
CREATE TABLE _idMap_HL_fastingSessions (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_badges;
CREATE TABLE _idMap_HL_badges (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_userBadges;
CREATE TABLE _idMap_HL_userBadges (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_streaks;
CREATE TABLE _idMap_HL_streaks (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_reports;
CREATE TABLE _idMap_HL_reports (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_reportShares;
CREATE TABLE _idMap_HL_reportShares (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_patternInsights;
CREATE TABLE _idMap_HL_patternInsights (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_knowledgeArticles;
CREATE TABLE _idMap_HL_knowledgeArticles (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_auditLogs;
CREATE TABLE _idMap_HL_auditLogs (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

DROP TABLE IF EXISTS _idMap_HL_apiRateLimits;
CREATE TABLE _idMap_HL_apiRateLimits (oldId TEXT PRIMARY KEY, newId INTEGER NOT NULL UNIQUE);

-- ---------------------------------------------------------------------------
-- 2. Example shadow table DDL pattern
-- ---------------------------------------------------------------------------
-- EP-P1.2 intentionally stops at design. EP-P1.3/EP-P1.4 must land before the
-- final destructive table swap. The final migration must expand this pattern
-- for every table listed in docs/INTEGER_ID_MIGRATION_PLAN.md.

DROP TABLE IF EXISTS HL_users_v2;
CREATE TABLE HL_users_v2 (
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

INSERT INTO HL_users_v2
  (email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, createdAt, updatedAt, lastLoginAt)
SELECT
  email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, createdAt, updatedAt, lastLoginAt
FROM HL_users
ORDER BY createdAt, id;

INSERT INTO _idMap_HL_users (oldId, newId)
SELECT old.id, newer.id
FROM HL_users old
JOIN HL_users_v2 newer ON newer.email = old.email;

DROP TABLE IF EXISTS HL_sessions_v2;
CREATE TABLE HL_sessions_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionTokenHash TEXT NOT NULL UNIQUE,
  userAgent TEXT,
  ipHash TEXT,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revokedAt TEXT,
  FOREIGN KEY (userId) REFERENCES HL_users_v2(id) ON DELETE CASCADE
);

INSERT INTO HL_sessions_v2
  (userId, sessionTokenHash, userAgent, ipHash, expiresAt, createdAt, revokedAt)
SELECT
  u.newId, s.sessionTokenHash, s.userAgent, s.ipHash, s.expiresAt, s.createdAt, s.revokedAt
FROM HL_sessions s
JOIN _idMap_HL_users u ON u.oldId = s.userId
ORDER BY s.createdAt, s.id;

INSERT INTO _idMap_HL_sessions (oldId, newId)
SELECT old.id, newer.id
FROM HL_sessions old
JOIN HL_sessions_v2 newer ON newer.sessionTokenHash = old.sessionTokenHash;

-- ---------------------------------------------------------------------------
-- 3. Required child-copy mapping examples
-- ---------------------------------------------------------------------------
-- These examples define how final EP-P1.2 SQL must copy child FKs.
--
-- userId:
--   JOIN _idMap_HL_users ON old.userId = _idMap_HL_users.oldId
--
-- profileId:
--   JOIN _idMap_HL_userProfiles ON old.profileId = _idMap_HL_userProfiles.oldId
--
-- sessionId:
--   JOIN _idMap_HL_measurementSessions ON old.sessionId = _idMap_HL_measurementSessions.oldId
--
-- ruleId nullable:
--   LEFT JOIN _idMap_HL_metricRules ON old.ruleId = _idMap_HL_metricRules.oldId
--
-- medicationId:
--   JOIN _idMap_HL_medications ON old.medicationId = _idMap_HL_medications.oldId
--
-- reportId:
--   JOIN _idMap_HL_reports ON old.reportId = _idMap_HL_reports.oldId

-- ---------------------------------------------------------------------------
-- 4. Final swap template
-- ---------------------------------------------------------------------------
-- Do not uncomment until every _v2 table is created and copied.
--
-- ALTER TABLE HL_users RENAME TO HL_users_textBackup;
-- ALTER TABLE HL_users_v2 RENAME TO HL_users;
-- ALTER TABLE HL_sessions RENAME TO HL_sessions_textBackup;
-- ALTER TABLE HL_sessions_v2 RENAME TO HL_sessions;
-- Repeat for every converted table.

-- ---------------------------------------------------------------------------
-- 5. Validation queries
-- ---------------------------------------------------------------------------
-- Run after every table copy and before swap.

SELECT 'HL_users row count old', COUNT(*) FROM HL_users;
SELECT 'HL_users row count v2', COUNT(*) FROM HL_users_v2;
SELECT 'HL_sessions row count old', COUNT(*) FROM HL_sessions;
SELECT 'HL_sessions row count v2', COUNT(*) FROM HL_sessions_v2;

SELECT 'HL_sessions orphan userId after copy', COUNT(*)
FROM HL_sessions s
LEFT JOIN _idMap_HL_users u ON u.oldId = s.userId
WHERE u.newId IS NULL;

PRAGMA foreign_key_check;

-- No table swap or COMMIT is performed by this design version.
-- The production version must only swap tables after:
-- - every table has a v2 shadow table,
-- - every row count matches,
-- - every FK check passes,
-- - backend and frontend numeric ID refactors are deployed in coordination.
