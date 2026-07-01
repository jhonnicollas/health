-- Migration 006 — Sprint 6G — WhatsApp OTP + outbound queue tracking
-- Adds columns needed for S6G-T-07 OTP verification and outbound message correlation.

ALTER TABLE HL_whatsappLinks ADD COLUMN otpHash TEXT;
ALTER TABLE HL_whatsappLinks ADD COLUMN otpExpiresAt TEXT;

INSERT OR IGNORE INTO HL_schemaMigrations (migrationName, appliedAt)
  VALUES ('006_s6g_whatsapp_otp', datetime('now'));
