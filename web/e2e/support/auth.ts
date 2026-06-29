import { BrowserContext, Page } from '@playwright/test';
import { execSync } from 'child_process';
import { writeFileSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

export type TestUserRole =
  | 'free'
  | 'premium'
  | 'admin'
  | 'femaleEligible'
  | 'maleNonEligible'
  | 'loginOtp';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

type UserCfg = { email: string; displayName: string; sex: string; planCode: string; roleCode: string; token: string; tokenHash: string };

const TEST_USERS: Record<TestUserRole, UserCfg> = {
  free:           { email: 'e2e-free@test.hl',    displayName: 'E2E Free',    sex: 'male',   planCode: 'free',           roleCode: 'user',  token: 'e2e-free-session',    tokenHash: 'sha256:p0SUpjS5jo8O-rNlZt4UJewVN7ngkJoCwhDzxHDY9bc' },
  premium:        { email: 'e2e-premium@test.hl',  displayName: 'E2E Premium', sex: 'female', planCode: 'premiumMonthly', roleCode: 'user',  token: 'e2e-premium-session', tokenHash: 'sha256:zClXkEZP-Kt-TAL7dj2WqQ6-n-a02148fLjcdG00BGw' },
  admin:          { email: 'e2e-admin@test.hl',    displayName: 'E2E Admin',   sex: 'male',   planCode: 'free',           roleCode: 'admin', token: 'e2e-admin-session',    tokenHash: 'sha256:YPwbWV-Zo4qDszeY7VPh06PJb7Tk9VoJzUi4fr8yxq0' },
  femaleEligible: { email: 'e2e-female@test.hl',   displayName: 'E2E Female',  sex: 'female', planCode: 'premiumMonthly', roleCode: 'user',  token: 'e2e-female-session',  tokenHash: 'sha256:OMVNdZo4I-Y1eB8qfulYBoDmBjoDhtlY4dV_k0IVLjE' },
  maleNonEligible:{ email: 'e2e-male@test.hl',     displayName: 'E2E Male',    sex: 'male',   planCode: 'free',           roleCode: 'user',  token: 'e2e-male-session',    tokenHash: 'sha256:Kqp0KKxPOORdDQV0WoLTXON2SRIkaqqQ2mo0UO5RHYg' },
  loginOtp:       { email: 'e2e-login@test.example', displayName: 'E2E Login',   sex: 'male',   planCode: 'free',           roleCode: 'user',  token: 'e2e-login-session',   tokenHash: 'sha256:JH4h7BqKp9lQm2nR8vTzXwC5yFd3sA6gE1uIo0PqRsT=' },
};

// ponytail: direct D1 session injection bypasses slow PBKDF2 100k iterations (kills wrangler dev CPU limit).
// upgrade: switch to API login when PBKDF2 iterations reduced or wrangler CPU limit lifted.

let seeded = false;

export async function loginByApi(
  _request: unknown,
  context: BrowserContext,
  role: TestUserRole,
  page?: Page,
) {
  // Skip local D1 seed when running against production/staging (users pre-seeded manually)
  if (!seeded && BASE.includes('localhost')) {
    seedAllTestUsers();
    seeded = true;
  }

  const cfg = TEST_USERS[role];
  const domain = new URL(BASE).hostname;
  const isSecure = BASE.startsWith('https://');

  // Set cookie via context.addCookies (proven working on production in debug test).
  // Must happen BEFORE any warm-up navigation so the cookie is in the jar
  // when pages make API requests.
  await context.addCookies([{
    name: 'hlSession',
    value: cfg.token,
    domain, path: '/', httpOnly: true,
    sameSite: 'Lax',
    secure: isSecure,
  }]);

  // Warm up: navigate to /login to warm the static CDN and Pages Function.
  // On production, Cloudflare Pages cold-starts cause slow first-page loads.
  // Pre-navigating here absorbs the cold-start so the test-target page loads faster.
  if (page && !BASE.includes('localhost')) {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 });
  }
}

function seedAllTestUsers() {
  const workerDir = process.env.WORKER_DIR ?? '/home/ubuntu/repositoryGIT/health/worker';
  const testPasswordHash = 'pbkdf2-sha256:100000:olTn8i-TmwNuQGRU6Xu2dg:_cAAGfKi_rgopEvP3DecNqACE9wNpWlkenVhWXuBffQ';
  const tmpDir = mkdtempSync(join(tmpdir(), 'hl-e2e-'));
  const sqlPath = join(tmpDir, 'seed.sql');

  const lines: string[] = [];
  for (const cfg of Object.values(TEST_USERS)) {
    lines.push(
      `INSERT OR IGNORE INTO HL_users (email, passwordHash, authProvider, displayName, telegramEnabled, browserPushEnabled, active, createdAt, updatedAt) VALUES ('${cfg.email}', '${testPasswordHash}', 'local', '${cfg.displayName}', 0, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      `UPDATE HL_users SET passwordHash = '${testPasswordHash}' WHERE email = '${cfg.email}';`,
      `INSERT OR IGNORE INTO HL_sessions (userId, sessionTokenHash, userAgent, ipHash, expiresAt, createdAt) SELECT id, '${cfg.tokenHash}', 'e2e-test', NULL, datetime('now', '+30 days'), CURRENT_TIMESTAMP FROM HL_users WHERE email = '${cfg.email}';`,
      `INSERT OR IGNORE INTO HL_userRoles (userId, roleCode, assignedAt) SELECT id, '${cfg.roleCode}', CURRENT_TIMESTAMP FROM HL_users WHERE email = '${cfg.email}';`,
      `INSERT OR IGNORE INTO HL_userProfiles (userId, sex, birthDate, heightCm, timezone, accessibilityMode, theme, emergencyConsent, aiConsent, dataShareConsent) SELECT id, '${cfg.sex}', '2000-01-01', 170, 'Asia/Jakarta', 'normal', 'light', 0, 0, 0 FROM HL_users WHERE email = '${cfg.email}';`,
      `INSERT OR IGNORE INTO HL_subscriptions (userId, planCode, status, currentPeriodEnd) SELECT id, '${cfg.planCode}', 'active', datetime('now', '+30 days') FROM HL_users WHERE email = '${cfg.email}';`
    );
  }

  writeFileSync(sqlPath, lines.join('\n'));

  try {
    execSync(
      `npx wrangler d1 execute multi_Ai_db --local --file=${sqlPath}`,
      { cwd: workerDir, encoding: 'utf8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
  } catch (err: unknown) {
    let msg: string;
    if (err && typeof err === 'object' && 'stderr' in err) {
      msg = String((err as { stderr: string }).stderr).slice(0, 500);
    } else if (err instanceof Error) {
      msg = err.message.slice(0, 500);
    } else {
      msg = String(err);
    }
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Failed to seed E2E test users: ${msg}`);
  }
}
