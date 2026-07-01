-- Migration 008 — Sprint 6H — Admin AI Governance tables
-- Source: docs_sprint6/09.PRD_S6H_GOVERNANCE.md §6

CREATE TABLE IF NOT EXISTS HL_aiEvaluationCases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caseId TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id' CHECK(locale IN ('id','en')),
  inputJson TEXT NOT NULL,
  expectedJson TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','deprecated')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS HL_aiEvaluationRuns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caseId TEXT NOT NULL,
  actualOutputJson TEXT,
  matchScore REAL,
  mismatchDetailsJson TEXT,
  reviewerUserId INTEGER,
  reviewerStatus TEXT CHECK(reviewerStatus IN ('pending','pass','fail','needs_investigation')),
  reviewerNotes TEXT,
  reviewedAt TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (reviewerUserId) REFERENCES HL_users(id)
);

CREATE INDEX IF NOT EXISTS idx_evalCases_caseId ON HL_aiEvaluationCases(caseId);
CREATE INDEX IF NOT EXISTS idx_evalCases_category ON HL_aiEvaluationCases(category);
CREATE INDEX IF NOT EXISTS idx_evalRuns_caseId ON HL_aiEvaluationRuns(caseId);
CREATE INDEX IF NOT EXISTS idx_evalRuns_reviewerStatus ON HL_aiEvaluationRuns(reviewerStatus);

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName, appliedAt)
  VALUES ('008_s6h_governance', datetime('now'));
