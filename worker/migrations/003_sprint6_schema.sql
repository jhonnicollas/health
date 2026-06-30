-- Migration 003 — Sprint 6 — AI Clinical Copilot
-- Source of truth: docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md §12.1 – §12.10
-- Apply order: this file MUST be executed in sequence below; tables have FK dependencies.
-- Idempotent: CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS everywhere.

-- Pre-flight: assume isehat_db (database_id d777e991-ddc9-4072-8522-06cb08a6538c) already exists
-- and contains all 69 Sprint 1–5 HL_* tables loaded by migrations prior to this one.

-- =====================================================================
-- §12.1 HL_aiClinicalSessions (no FK to other Sprint 6 tables)
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_aiClinicalSessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionUuid TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL CHECK(channel IN ('web','whatsapp')),
  sessionType TEXT NOT NULL CHECK(sessionType IN ('clinical_interview','symptom_interview','first_aid','emergency','doctor_handoff','caregiver_summary','general')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed','expired')),
  title TEXT,
  dataSufficiencyScore INTEGER,
  redFlagStatus TEXT DEFAULT 'none' CHECK(redFlagStatus IN ('none','warning','emergency')),
  contextPackageHash TEXT,
  startedAt TEXT NOT NULL,
  closedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES HL_users(id)
);

CREATE INDEX IF NOT EXISTS idx_clinicalSessions_userId        ON HL_aiClinicalSessions(userId);
CREATE INDEX IF NOT EXISTS idx_clinicalSessions_status         ON HL_aiClinicalSessions(status);
CREATE INDEX IF NOT EXISTS idx_clinicalSessions_sessionUuid    ON HL_aiClinicalSessions(sessionUuid);
CREATE INDEX IF NOT EXISTS idx_clinicalSessions_channel        ON HL_aiClinicalSessions(channel);
CREATE INDEX IF NOT EXISTS idx_clinicalSessions_createdAt      ON HL_aiClinicalSessions(createdAt);

-- =====================================================================
-- §12.2 HL_modelRuns (FK → HL_users, HL_aiClinicalSessions)
-- userId NULLABLE because internal eval jobs / admin test prompts / system health checks
-- may have userId IS NULL with actorType='system' or actorType='admin'.
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_modelRuns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  actorType TEXT NOT NULL DEFAULT 'user' CHECK(actorType IN ('user','admin','system')),
  actorId INTEGER,
  requestId TEXT NOT NULL,
  sessionId INTEGER,
  channel TEXT NOT NULL CHECK(channel IN ('web','whatsapp','internal')),
  taskCode TEXT NOT NULL,
  providerCode TEXT NOT NULL,
  modelCode TEXT NOT NULL,
  promptVersion TEXT,
  usedVectorContext INTEGER DEFAULT 0,
  usedAiSearch INTEGER DEFAULT 0,
  vectorQueryId INTEGER,
  inputTokenCount INTEGER,
  outputTokenCount INTEGER,
  latencyMs INTEGER,
  status TEXT NOT NULL CHECK(status IN ('pending','success','timeout','error','safety_blocked','fallback')),
  fallbackUsed INTEGER DEFAULT 0,
  safetyDecision TEXT,
  safetyFlagsJson TEXT,
  errorCode TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId)    REFERENCES HL_users(id),
  FOREIGN KEY (sessionId) REFERENCES HL_aiClinicalSessions(id)
);

CREATE INDEX IF NOT EXISTS idx_modelRuns_userId      ON HL_modelRuns(userId);
CREATE INDEX IF NOT EXISTS idx_modelRuns_status      ON HL_modelRuns(status);
CREATE INDEX IF NOT EXISTS idx_modelRuns_channel     ON HL_modelRuns(channel);
CREATE INDEX IF NOT EXISTS idx_modelRuns_createdAt   ON HL_modelRuns(createdAt);
CREATE INDEX IF NOT EXISTS idx_modelRuns_providerCode ON HL_modelRuns(providerCode);
CREATE INDEX IF NOT EXISTS idx_modelRuns_actorType   ON HL_modelRuns(actorType);

-- =====================================================================
-- §12.3 HL_aiClinicalMessages (FK → HL_users, HL_aiClinicalSessions)
-- contentEncrypted populated, contentPreview is safe truncated text.
-- safetyLevel mapping: SafetyDecision 'allow' -> 'safe'; 'block_and_fallback' -> 'blocked';
-- others map 1:1 (see AI_SAFETY_RUNTIME_SPEC.md §1.2 mapping table).
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_aiClinicalMessages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionId INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  channel TEXT NOT NULL CHECK(channel IN ('web','whatsapp','internal')),
  contentPreview TEXT,
  contentEncrypted TEXT,
  answerType TEXT CHECK(answerType IN ('safe_summary','possible_explanations','follow_up_questions','missing_data','first_aid_guidance','emergency_guidance','doctor_handoff','caregiver_summary','medication_adherence_summary','medication_questions_for_doctor','blocked_unsafe_request')),
  safetyLevel TEXT CHECK(safetyLevel IN ('safe','allow_with_disclaimer','rewrite_safe','blocked','emergency_template_only','needs_human_review')),
  safetyFlagsJson TEXT,
  contextTraceJson TEXT,
  modelRunId INTEGER,
  expiresAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId)    REFERENCES HL_users(id),
  FOREIGN KEY (sessionId) REFERENCES HL_aiClinicalSessions(id)
);

CREATE INDEX IF NOT EXISTS idx_clinicalMessages_userId    ON HL_aiClinicalMessages(userId);
CREATE INDEX IF NOT EXISTS idx_clinicalMessages_sessionId  ON HL_aiClinicalMessages(sessionId);
CREATE INDEX IF NOT EXISTS idx_clinicalMessages_role       ON HL_aiClinicalMessages(role);
CREATE INDEX IF NOT EXISTS idx_clinicalMessages_createdAt  ON HL_aiClinicalMessages(createdAt);
CREATE INDEX IF NOT EXISTS idx_clinicalMessages_expiresAt  ON HL_aiClinicalMessages(expiresAt);

-- =====================================================================
-- §12.4 HL_aiClinicalIntakeAnswers (FK → HL_users, HL_aiClinicalSessions)
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_aiClinicalIntakeAnswers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  sessionId INTEGER NOT NULL,
  questionCode TEXT,
  questionText TEXT NOT NULL,
  answerText TEXT,
  answerJson TEXT,
  redFlagTriggered INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId)    REFERENCES HL_users(id),
  FOREIGN KEY (sessionId) REFERENCES HL_aiClinicalSessions(id)
);

CREATE INDEX IF NOT EXISTS idx_intakeAnswers_userId    ON HL_aiClinicalIntakeAnswers(userId);
CREATE INDEX IF NOT EXISTS idx_intakeAnswers_sessionId ON HL_aiClinicalIntakeAnswers(sessionId);

-- =====================================================================
-- §12.5 HL_aiOutputSafetyFlags
-- actionTaken maps SafetyDecision enum directly (longer-form values than safetyLevel).
-- severity has its own CHECK; flagCode free-text per detector.
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_aiOutputSafetyFlags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  modelRunId INTEGER,
  sessionId INTEGER,
  flagCode TEXT NOT NULL,
  severity TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
  detectedTextPreview TEXT,
  actionTaken TEXT NOT NULL CHECK(actionTaken IN ('allow','allow_with_disclaimer','rewrite_safe','block_and_fallback','emergency_template_only','needs_human_review')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId)     REFERENCES HL_users(id),
  FOREIGN KEY (modelRunId) REFERENCES HL_modelRuns(id),
  FOREIGN KEY (sessionId)  REFERENCES HL_aiClinicalSessions(id)
);

CREATE INDEX IF NOT EXISTS idx_safetyFlags_userId    ON HL_aiOutputSafetyFlags(userId);
CREATE INDEX IF NOT EXISTS idx_safetyFlags_flagCode  ON HL_aiOutputSafetyFlags(flagCode);
CREATE INDEX IF NOT EXISTS idx_safetyFlags_severity  ON HL_aiOutputSafetyFlags(severity);
CREATE INDEX IF NOT EXISTS idx_safetyFlags_createdAt ON HL_aiOutputSafetyFlags(createdAt);

-- =====================================================================
-- §12.6 HL_promptVersions (FK → HL_users, ON DELETE SET NULL)
-- Active version per promptCode is queried at runtime; activation flips status.
-- 6 prompt codes seeded in S6A-T-11.
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_promptVersions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  promptCode TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','active','deprecated')),
  contentHash TEXT NOT NULL,
  contentText TEXT NOT NULL,
  createdByUserId INTEGER,
  activatedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(promptCode, version),
  FOREIGN KEY (createdByUserId) REFERENCES HL_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_promptVersions_promptCode ON HL_promptVersions(promptCode);
CREATE INDEX IF NOT EXISTS idx_promptVersions_status      ON HL_promptVersions(status);

-- =====================================================================
-- §12.7 HL_whatsappLinks (FK → HL_users)
-- whatsappNumberEncrypted AES-256 ciphertext; whatsappNumberHash SHA-256 for lookup.
-- Verified and aiEnabled default 0 — must be explicitly enabled.
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_whatsappLinks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  whatsappNumberEncrypted TEXT NOT NULL,
  whatsappNumberHash TEXT NOT NULL,
  verified INTEGER DEFAULT 0,
  aiEnabled INTEGER DEFAULT 0,
  consentAcceptedAt TEXT,
  lastMessageAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT,
  FOREIGN KEY (userId) REFERENCES HL_users(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsappLinks_userId              ON HL_whatsappLinks(userId);
CREATE INDEX IF NOT EXISTS idx_whatsappLinks_verified            ON HL_whatsappLinks(verified);
CREATE INDEX IF NOT EXISTS idx_whatsappLinks_whatsappNumberHash  ON HL_whatsappLinks(whatsappNumberHash);

-- =====================================================================
-- §12.8 HL_whatsappMessages (FK → HL_users, HL_whatsappLinks, HL_aiClinicalSessions)
-- userId NULLABLE: unlinked-number flow writes userId=NULL + processedStatus='ignored_unlinked'.
-- providerMessageId UNIQUE for idempotency (per S6G-T-03 webhook dedup).
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_whatsappMessages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  whatsappLinkId INTEGER,
  providerMessageId TEXT,
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  messageType TEXT NOT NULL CHECK(messageType IN ('text','image','document','audio','command')),
  contentPreview TEXT,
  contentEncrypted TEXT,
  mediaR2Key TEXT,
  processedStatus TEXT NOT NULL DEFAULT 'received' CHECK(processedStatus IN ('received','processing','completed','failed','ignored_unlinked')),
  clinicalSessionId INTEGER,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId)             REFERENCES HL_users(id),
  FOREIGN KEY (whatsappLinkId)     REFERENCES HL_whatsappLinks(id),
  FOREIGN KEY (clinicalSessionId)  REFERENCES HL_aiClinicalSessions(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsappMessages_userId            ON HL_whatsappMessages(userId);
CREATE INDEX IF NOT EXISTS idx_whatsappMessages_whatsappLinkId    ON HL_whatsappMessages(whatsappLinkId);
CREATE INDEX IF NOT EXISTS idx_whatsappMessages_processedStatus  ON HL_whatsappMessages(processedStatus);
CREATE INDEX IF NOT EXISTS idx_whatsappMessages_createdAt         ON HL_whatsappMessages(createdAt);
CREATE INDEX IF NOT EXISTS idx_whatsappMessages_providerMessageId ON HL_whatsappMessages(providerMessageId);

-- =====================================================================
-- §12.9 HL_firstAidProtocols (FK → HL_users ON DELETE SET NULL)
-- 10 protocols x 2 locales = 20 rows seeded in S6F-T-05.
-- reviewerStatus dictates runtime availability (S6F-T-07; only approved are returned).
-- UNIQUE(protocolCode, locale) allows per-locale overrides.
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_firstAidProtocols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolCode TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  title TEXT NOT NULL,
  triggerKeywordsJson TEXT,
  redFlagsJson TEXT NOT NULL,
  doStepsJson TEXT NOT NULL,
  dontStepsJson TEXT NOT NULL,
  seekHelpNowJson TEXT NOT NULL,
  reviewerStatus TEXT NOT NULL DEFAULT 'draft' CHECK(reviewerStatus IN ('draft','under_review','approved','rejected')),
  reviewedByUserId INTEGER,
  contentVersion TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT,
  UNIQUE(protocolCode, locale),
  FOREIGN KEY (reviewedByUserId) REFERENCES HL_users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_firstAidProtocols_protocolCode   ON HL_firstAidProtocols(protocolCode);
CREATE INDEX IF NOT EXISTS idx_firstAidProtocols_locale         ON HL_firstAidProtocols(locale);
CREATE INDEX IF NOT EXISTS idx_firstAidProtocols_reviewerStatus ON HL_firstAidProtocols(reviewerStatus);

-- =====================================================================
-- §12.10 HL_aiKnowledgeDocuments (no FK to other Sprint 6 tables)
-- sourceType IN ('education_article','first_aid_protocol','faq','support_doc',
--                'metric_explanation','medication_safety_general',
--                'emergency_red_flag_explanation','eval_case')
-- UNIQUE(sourceType, sourceId, locale) — supports per-locale overrides.
-- =====================================================================
CREATE TABLE IF NOT EXISTS HL_aiKnowledgeDocuments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceType TEXT NOT NULL CHECK(sourceType IN ('education_article','first_aid_protocol','faq','support_doc','metric_explanation','medication_safety_general','emergency_red_flag_explanation','eval_case')),
  sourceId TEXT NOT NULL,
  title TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  aiSearchDocumentId TEXT,
  reviewerStatus TEXT NOT NULL DEFAULT 'draft' CHECK(reviewerStatus IN ('draft','under_review','approved','rejected')),
  contentVersion TEXT NOT NULL,
  indexedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT,
  UNIQUE(sourceType, sourceId, locale)
);

CREATE INDEX IF NOT EXISTS idx_knowledgeDocs_sourceType     ON HL_aiKnowledgeDocuments(sourceType);
CREATE INDEX IF NOT EXISTS idx_knowledgeDocs_reviewerStatus ON HL_aiKnowledgeDocuments(reviewerStatus);
CREATE INDEX IF NOT EXISTS idx_knowledgeDocs_locale         ON HL_aiKnowledgeDocuments(locale);
CREATE INDEX IF NOT EXISTS idx_knowledgeDocs_aiSearchDocId  ON HL_aiKnowledgeDocuments(aiSearchDocumentId);

-- =====================================================================
-- Migration metadata record (so we can audit what shipped)
-- =====================================================================
INSERT OR IGNORE INTO HL_schemaMigrations (migrationName, appliedAt)
  VALUES ('003_sprint6_schema', datetime('now'));

-- =====================================================================
-- Post-migration validation
-- =====================================================================
-- Count check (hand-verify after apply):
-- SELECT COUNT(*) FROM sqlite_master
--   WHERE type='table' AND name LIKE 'HL_ai%'
--      OR name LIKE 'HL_whatsapp%'
--      OR name LIKE 'HL_firstAid%'
--      OR name LIKE 'HL_aiKnowledge%';
-- Expected: 10 (8 HL_ai* + 2 HL_whatsapp*; verify exact names).
--
-- FK check (run after apply):
-- PRAGMA foreign_key_check;
-- Expected: empty result.
--
-- Forbidden-name check (per AGENTS_SPRINT6.md §2):
-- The following names must NOT be referenced anywhere else in Sprint 6:
--   HL_educationViews, actorId/targetType/targetId in HL_auditLogs
--   plaintext secrets anywhere in D1 row values.
-- =====================================================================
