-- worker/migrations/001_s5x_auth_email_otp.sql

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
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_emailOtpChallenges_normalizedEmail ON HL_emailOtpChallenges(normalizedEmail);
CREATE INDEX idx_emailOtpChallenges_expiresAt ON HL_emailOtpChallenges(expiresAt);

ALTER TABLE HL_users ADD COLUMN emailVerifiedAt TEXT;
ALTER TABLE HL_users ADD COLUMN emailVerificationMethod TEXT;
