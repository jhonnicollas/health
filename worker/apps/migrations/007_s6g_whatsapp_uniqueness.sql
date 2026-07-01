-- Migration 007 — Sprint 6G — WhatsApp uniqueness + race-safe idempotency
-- Source: S6G audit gaps (PRD §5.5, §8.1, §9.3)
-- Adds:
--   HL_whatsappMessages.providerMessageId UNIQUE (race-safe webhook dedup)
--   HL_whatsappLinks.userId UNIQUE            (one link per user)
--   HL_whatsappLinks.whatsappNumberHash UNIQUE (one user per number)
--   HL_whatsappMessages__ignored_unlinked partial index (S6F retention cron target)
--   HL_systemConfigs.unlinkedRetentionDays    (cron reads this to GC ignored_unlinked)

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsappMessages_providerMessageId
  ON HL_whatsappMessages(providerMessageId)
  WHERE providerMessageId IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsappLinks_userId
  ON HL_whatsappLinks(userId);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_whatsappLinks_whatsappNumberHash
  ON HL_whatsappLinks(whatsappNumberHash);

-- Retention hot-path: S6F cron targets this index to delete processedStatus='ignored_unlinked'
-- rows older than HL_systemConfigs.whatsappAi.unlinkedRetentionDays (default 30).
-- Without this, unlinked users accumulate rows forever (userId=NULL defauts normal user-scoped crons).
CREATE INDEX IF NOT EXISTS idx_whatsappMessages_ignoredUnlinked
  ON HL_whatsappMessages(createdAt)
  WHERE processedStatus = 'ignored_unlinked';

INSERT OR IGNORE INTO HL_systemConfigs (configKey, configValue, dataType, description)
  VALUES (
    'whatsappAi.unlinkedRetentionDays',
    '30',
    'number',
    'Days to retain HL_whatsappMessages rows with processedStatus=ignored_unlinked'
  );

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName, appliedAt)
  VALUES ('007_s6g_whatsapp_uniqueness', datetime('now'));

-- =====================================================================
-- PRE-FLIGHT CHECK (run BEFORE applying this migration in production)
-- =====================================================================
-- 1. Duplicate providerMessageId?
-- SELECT providerMessageId, COUNT(*) FROM HL_whatsappMessages
--  WHERE providerMessageId IS NOT NULL
--  GROUP BY providerMessageId HAVING COUNT(*) > 1;
-- Remediation: keep MIN(id) per providerMessageId, delete the rest.
-- DELETE FROM HL_whatsappMessages
--  WHERE id NOT IN (
--    SELECT MIN(rowid) FROM HL_whatsappMessages
--     WHERE providerMessageId IS NOT NULL
--     GROUP BY providerMessageId
--  );
--
-- 2. Duplicate userId in HL_whatsappLinks?
-- SELECT userId, COUNT(*) FROM HL_whatsappLinks GROUP BY userId HAVING COUNT(*) > 1;
-- Remediation: keep most-recently-updated row, delete others.
-- DELETE FROM HL_whatsappLinks
--  WHERE id NOT IN (
--    SELECT id FROM HL_whatsappLinks
--     WHERE rowid IN (SELECT MAX(rowid) FROM HL_whatsappLinks GROUP BY userId)
--  );
--
-- 3. Duplicate whatsappNumberHash?
-- SELECT whatsappNumberHash, COUNT(*) FROM HL_whatsappLinks
--  GROUP BY whatsappNumberHash HAVING COUNT(*) > 1;
-- Remediation: same pattern — keep canonical row, delete secondary links and re-link via /link/start.
--
-- AFTER migration: S6F retention cron (T-04) must use this exact predicate to use idx_whatsappMessages_ignoredUnlinked:
--   DELETE FROM HL_whatsappMessages
--    WHERE processedStatus = 'ignored_unlinked' AND createdAt < datetime('now', '-30 day');
