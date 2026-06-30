-- Migration 004 — Medical Term Popups (bilingual educational content)
-- Stores per-locale medical term definitions, measurement guidance, and source citations.
-- This enables bilingual (id-ID / en-US) popup content served from D1,
-- editable by admin without redeploy.

CREATE TABLE IF NOT EXISTS HL_medicalTermPopups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  termCode TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'id-ID',
  label TEXT NOT NULL,
  shortDef TEXT NOT NULL,
  fullDef TEXT NOT NULL,
  whyMeasure TEXT NOT NULL,
  howToMeasure TEXT NOT NULL,
  normalRange TEXT NOT NULL,
  unitExplanation TEXT NOT NULL,
  deviceName TEXT NOT NULL,
  deviceTypeCode TEXT NOT NULL DEFAULT 'manual',
  risksIfAbnormal TEXT NOT NULL,
  whenToSeeDoctor TEXT NOT NULL,
  preventionTip TEXT NOT NULL,
  sourceName TEXT NOT NULL,
  sourceUrl TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  updatedAt TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  UNIQUE(termCode, locale)
);

CREATE INDEX IF NOT EXISTS idx_medicalTermPopups_termCode ON HL_medicalTermPopups(termCode);
CREATE INDEX IF NOT EXISTS idx_medicalTermPopups_locale ON HL_medicalTermPopups(locale);
