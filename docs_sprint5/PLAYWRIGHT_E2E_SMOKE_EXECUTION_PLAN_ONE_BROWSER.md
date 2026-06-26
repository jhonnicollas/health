# Playwright E2E Smoke Execution Plan — Sprint 5 One-Browser QA Gate

```text
Product: HL Health Companion
Document Type: Execution Plan for AI Agent / OpenCode CLI
Purpose: Add Playwright E2E smoke tests, browser smoke per phase, and console/network failure gate.
Browser Scope: Chromium only
Execution Mode: Fast smoke-first, not full visual regression
Sprint Scope: Sprint 5 Foundation + 5A + 5B + 5C + 5D + 5E + S5X regression
Status: Ready for agent execution
```

---

# 0. Why this file exists

Backend/API tests already pass, but frontend can still be broken in the real browser.

This plan adds a minimal but strict Playwright layer to prove:

```text
1. Real browser can open the application.
2. Key Sprint 5 routes do not render blank screens.
3. Console errors fail the test.
4. /api/* 404 and 5xx fail the test.
5. Each Sprint 5 phase has at least one browser smoke test.
6. Mobile 360px is checked for user-facing screens.
7. Tests run in one browser only: Chromium.
```

This is not a full UI rewrite task. This is a QA gate task.

---

# 1. Non-negotiable rules

```text
- Do not mark any task DONE from backend tests only.
- Do not add new product features unless a smoke test exposes a broken integration.
- Do not use real user data.
- Do not use real OAuth code, Telegram token, AI token, or production secrets in tests.
- Do not run multi-browser initially.
- Use Chromium only.
- Every smoke spec must attach the global console/network failure gate.
- Every Sprint 5 UI smoke spec must mention its mockup anchor in the test title or annotation.
- If a screen fails, document the failure as NEEDS_UI_FIX or NEEDS_INTEGRATION_FIX.
```

Sprint 5 AI boundary remains active:

```text
Sprint 5C = AI Clinical Infrastructure & Vectorize Foundation only
Sprint 6 = AI Doctor-like Clinical Copilot
clinicalCopilotMode=true must return AI_CLINICAL_COPILOT_DEFERRED
```

---

# 2. Fast testing strategy

Do not start with exhaustive tests. Start with smoke tests.

## Fast path

```text
Step 1: Install Playwright + Chromium only.
Step 2: Add global console/network gate.
Step 3: Add auth/storage-state fixture or API login helper.
Step 4: Add one Foundation smoke spec.
Step 5: Run it.
Step 6: Fix only blockers exposed by that smoke.
Step 7: Add 5A smoke.
Step 8: Run only 5A smoke.
Step 9: Continue 5B, 5C, 5D, 5E.
Step 10: Run all smoke specs only after individual phase specs pass.
```

## Do not do this initially

```text
- Do not enable Firefox/WebKit yet.
- Do not create pixel-perfect screenshot tests yet.
- Do not add 100+ E2E cases immediately.
- Do not test every button in the first pass.
- Do not load full PRD/API/SQL/mockup HTML into agent context.
```

---

# 3. Runtime data flow

```text
wrangler dev
(port 8787)
D1 local + seed
        │
        ├── Playwright E2E
        │   real browser
        │   apiRequestContext for login/setup
        │
        ├── Vitest/unit tests
        │   jsdom/headless
        │   mock DB/API where already existing
        │
        └── Manual UAT
            real browser + real backend
```

Recommended local ports:

```text
Worker API: http://localhost:8787
Vite Web:  http://localhost:5173
```

---

# 4. Files to add or modify

Create or update:

```text
web/playwright.config.ts
web/e2e/support/global-gates.ts
web/e2e/support/auth.ts
web/e2e/support/selectors.ts
web/e2e/smoke/foundation-admin.spec.ts
web/e2e/smoke/sprint5a-daily-health.spec.ts
web/e2e/smoke/sprint5b-hydration.spec.ts
web/e2e/smoke/sprint5c-ai-infra.spec.ts
web/e2e/smoke/sprint5d-cycle.spec.ts
web/e2e/smoke/sprint5e-telegram.spec.ts
web/e2e/smoke/regression-sprint1-4.spec.ts
web/package.json
```

Optional if repo has root scripts:

```text
package.json
```

---

# 5. Install Playwright for one browser only

From project root:

```bash
cd web
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

If the project uses npm:

```bash
cd web
npm install -D @playwright/test
npx playwright install chromium
```

Do not install all browsers yet.

---

# 6. package.json scripts

Update `web/package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui",
    "test:smoke": "playwright test e2e/smoke --project=chromium",
    "verify:web": "npx tsc -b && npx eslint . && npx vite build && npx playwright test e2e/smoke --project=chromium"
  }
}
```

If root package scripts exist, add:

```json
{
  "scripts": {
    "verify:worker": "cd worker && npx tsc -p tsconfig.json && npm test",
    "verify:web": "cd web && npx tsc -b && npx eslint . && npx vite build",
    "verify:e2e": "cd web && npx playwright test e2e/smoke --project=chromium",
    "verify:sprint5:browser": "npm run verify:web && npm run verify:e2e"
  }
}
```

---

# 7. Playwright config

Create `web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 7_000,
  },
  fullyParallel: false,
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: undefined,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEB_SERVER === 'true'
    ? undefined
    : {
        command: 'pnpm dev --host 127.0.0.1',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
```

If the project uses npm, replace the webServer command:

```ts
command: 'npm run dev -- --host 127.0.0.1'
```

---

# 8. Global console/network failure gate

Create `web/e2e/support/global-gates.ts`:

```ts
import { Page, expect } from '@playwright/test';

export type GlobalFailureGateOptions = {
  allowApi404?: RegExp[];
  allowConsoleError?: RegExp[];
};

export function attachGlobalFailureGates(
  page: Page,
  options: GlobalFailureGateOptions = {},
) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const badApiResponses: string[] = [];

  const allowApi404 = options.allowApi404 ?? [];
  const allowConsoleError = options.allowConsoleError ?? [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;

    const text = msg.text();
    if (allowConsoleError.some((pattern) => pattern.test(text))) return;

    consoleErrors.push(text);
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? 'unknown failure';

    if (url.includes('/api/') || url.includes('/assets/')) {
      failedRequests.push(`${request.method()} ${url} — ${failure}`);
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();

    if (!url.includes('/api/')) return;

    if (status === 404 && allowApi404.some((pattern) => pattern.test(url))) {
      return;
    }

    if (status === 404 || status >= 500) {
      badApiResponses.push(`${status} ${url}`);
    }
  });

  return async function assertNoGlobalFailures() {
    expect(pageErrors, `Uncaught page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `Console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    expect(failedRequests, `Failed requests:\n${failedRequests.join('\n')}`).toEqual([]);
    expect(badApiResponses, `Bad API responses:\n${badApiResponses.join('\n')}`).toEqual([]);
  };
}

export async function expectAppNotBlank(page: Page) {
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#root, [data-testid="app-root"').first()).toBeVisible({ timeout: 10_000 }).catch(async () => {
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length, 'Page body should not be blank').toBeGreaterThan(20);
  });
}
```

If the app root is not `#root`, adjust `expectAppNotBlank` to match the real root element.

---

# 9. Auth helper strategy

Use the fastest available method.

Preferred order:

```text
1. API login helper using existing email/password endpoint.
2. Storage state generated once per role.
3. Direct test session creation only if the project already has a safe test helper.
4. Manual login fallback for local debugging only.
```

Create `web/e2e/support/auth.ts`:

```ts
import { APIRequestContext, BrowserContext, expect } from '@playwright/test';

export type TestUserRole =
  | 'free'
  | 'premium'
  | 'admin'
  | 'femaleEligible'
  | 'maleNonEligible';

const TEST_USERS: Record<TestUserRole, { email: string; password: string }> = {
  free: {
    email: process.env.E2E_FREE_EMAIL ?? 'test.free@example.test',
    password: process.env.E2E_FREE_PASSWORD ?? 'TestPassword123!',
  },
  premium: {
    email: process.env.E2E_PREMIUM_EMAIL ?? 'test.premium@example.test',
    password: process.env.E2E_PREMIUM_PASSWORD ?? 'TestPassword123!',
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'test.admin@example.test',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'TestPassword123!',
  },
  femaleEligible: {
    email: process.env.E2E_FEMALE_ELIGIBLE_EMAIL ?? 'test.female@example.test',
    password: process.env.E2E_FEMALE_ELIGIBLE_PASSWORD ?? 'TestPassword123!',
  },
  maleNonEligible: {
    email: process.env.E2E_MALE_NON_ELIGIBLE_EMAIL ?? 'test.male@example.test',
    password: process.env.E2E_MALE_NON_ELIGIBLE_PASSWORD ?? 'TestPassword123!',
  },
};

export async function loginByApi(
  request: APIRequestContext,
  context: BrowserContext,
  role: TestUserRole,
) {
  const user = TEST_USERS[role];

  const response = await request.post('/api/auth/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  expect(response.status(), `API login failed for role ${role}`).toBeLessThan(400);

  const setCookie = response.headers()['set-cookie'];
  if (!setCookie) {
    throw new Error('Login response did not set a cookie. Adjust loginByApi to match app auth implementation.');
  }

  const cookieValue = parseCookieValue(setCookie, 'hlSession');
  if (!cookieValue) {
    throw new Error('hlSession cookie not found. Adjust cookie name in e2e/support/auth.ts.');
  }

  await context.addCookies([
    {
      name: 'hlSession',
      value: cookieValue,
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173').hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      secure: (process.env.PLAYWRIGHT_BASE_URL ?? '').startsWith('https://'),
    },
  ]);
}

function parseCookieValue(setCookieHeader: string, cookieName: string) {
  const cookiePart = setCookieHeader
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!cookiePart) return null;

  return cookiePart.split(';')[0].split('=').slice(1).join('=');
}
```

If `/api/auth/login` does not exist or uses a different payload, patch this helper only. Do not patch every spec.

---

# 10. Selectors helper

Create `web/e2e/support/selectors.ts`:

```ts
import { Page, expect } from '@playwright/test';

export async function expectAnyVisible(page: Page, patterns: Array<string | RegExp>) {
  for (const pattern of patterns) {
    const locator = typeof pattern === 'string'
      ? page.getByText(pattern, { exact: false })
      : page.getByText(pattern);

    if (await locator.first().isVisible().catch(() => false)) {
      await expect(locator.first()).toBeVisible();
      return;
    }
  }

  throw new Error(`None of these text patterns were visible: ${patterns.map(String).join(', ')}`);
}

export async function expectNoSecretLikeText(page: Page) {
  const text = await page.locator('body').innerText();

  expect(text).not.toMatch(/sk-[A-Za-z0-9_-]{20,}/);
  expect(text).not.toMatch(/cf_[A-Za-z0-9_-]{20,}/i);
  expect(text).not.toMatch(/\d{8,10}:[A-Za-z0-9_-]{30,}/);
  expect(text).not.toMatch(/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/);
}
```

---

# 11. Smoke specs per phase

## 11.1 Foundation Admin Smoke

Create `web/e2e/smoke/foundation-admin.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible, expectNoSecretLikeText } from '../support/selectors';

test.describe('Foundation Admin Smoke — Mockup: #foundation-admin #admin-users-roles #admin-plans #admin-ai-config #admin-audit', () => {
  test('admin user can open admin shell without browser/API failures', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'admin');

    await page.goto('/admin');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Admin/i, /Dashboard/i, /Users/i, /Plans/i]);
    await expectNoSecretLikeText(page);

    await assertNoGlobalFailures();
  });

  test('admin pages render required sections without blank screen', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'admin');

    for (const path of ['/admin', '/admin/users', '/admin/roles', '/admin/plans', '/admin/config', '/admin/ai-config', '/admin/audit']) {
      await page.goto(path);
      await expectAppNotBlank(page);
    }

    await expectNoSecretLikeText(page);
    await assertNoGlobalFailures();
  });

  test('free user cannot use admin area', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page, {
      allowApi404: [/\/api\/admin\//],
    });
    await loginByApi(request, context, 'free');

    await page.goto('/admin');
    await expectAnyVisible(page, [/forbidden/i, /unauthorized/i, /access denied/i, /tidak memiliki akses/i, /login/i]);

    await assertNoGlobalFailures();
  });
});
```

If admin routes are tab-based under `/admin` only, remove path checks that do not exist and replace them with tab/button clicks.

---

## 11.2 Sprint 5A Smoke

Create `web/e2e/smoke/sprint5a-daily-health.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible } from '../support/selectors';

test.describe('Sprint 5A Smoke — Mockup: #google-oauth #daily-health-hub #education-layer #symptom-logger #red-flag-flow #history-integration', () => {
  test('login page keeps email login and Google OAuth button visible', async ({ page }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);

    await page.goto('/login');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Google/i, /Email/i, /Password/i, /Masuk/i, /Login/i]);

    await assertNoGlobalFailures();
  });

  test('daily health hub opens without blank screen', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'free');

    await page.goto('/dashboard');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Today/i, /Hari ini/i, /Health/i, /Kesehatan/i, /Pengukuran/i]);

    await assertNoGlobalFailures();
  });

  test('symptom form and red-flag UI path are reachable', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'free');

    await page.goto('/symptoms/new');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Keluhan/i, /Symptom/i, /Nyeri/i, /Pain/i, /Ringan/i, /Sedang/i, /Berat/i]);

    await assertNoGlobalFailures();
  });

  test('5A user-facing pages are usable at mobile 360px', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await loginByApi(request, context, 'free');

    for (const path of ['/dashboard', '/symptoms/new', '/history']) {
      await page.goto(path);
      await expectAppNotBlank(page);
    }

    await assertNoGlobalFailures();
  });
});
```

---

## 11.3 Sprint 5B Hydration Smoke

Create `web/e2e/smoke/sprint5b-hydration.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible } from '../support/selectors';

test.describe('Sprint 5B Hydration Smoke — Mockup: #hydration-tracker #daily-health-hub', () => {
  test('hydration page opens and quick-add controls exist', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'free');

    await page.goto('/hydration');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Hydration/i, /Hidrasi/i, /200/i, /600/i, /Custom/i, /Target/i]);

    await assertNoGlobalFailures();
  });

  test('hydration settings and history are reachable', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'free');

    for (const path of ['/hydration/settings', '/hydration/history']) {
      await page.goto(path);
      await expectAppNotBlank(page);
    }

    await assertNoGlobalFailures();
  });

  test('hydration page is usable at mobile 360px', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await loginByApi(request, context, 'free');

    await page.goto('/hydration');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/200/i, /600/i, /Custom/i, /Target/i]);

    await assertNoGlobalFailures();
  });
});
```

---

## 11.4 Sprint 5C AI Infrastructure Smoke

Create `web/e2e/smoke/sprint5c-ai-infra.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible, expectNoSecretLikeText } from '../support/selectors';

test.describe('Sprint 5C AI Infrastructure Smoke — Mockup: #ai-clinical-infra #ai-memory #context-package #sprint6-ready', () => {
  test('AI memory/settings page opens and does not market active AI doctor', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'premium');

    await page.goto('/ai/memory');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/AI/i, /Memory/i, /Clinical Infrastructure/i, /Sprint 6/i, /Readiness/i, /Vector/i]);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/AI dokter aktif/i);
    expect(bodyText).not.toMatch(/diagnosis pasti/i);
    expect(bodyText).not.toMatch(/resep obat/i);

    await expectNoSecretLikeText(page);
    await assertNoGlobalFailures();
  });

  test('clinicalCopilotMode true is deferred in Sprint 5', async ({ request }) => {
    const response = await request.post('/api/ai/assistant', {
      data: {
        message: 'test clinical copilot mode',
        clinicalCopilotMode: true,
      },
    });

    const text = await response.text();
    expect(text).toMatch(/AI_CLINICAL_COPILOT_DEFERRED|deferred_to_sprint6/i);
  });
});
```

If `/api/ai/assistant` requires login, add `loginByApi` and browser context cookie setup or switch to a request context with cookies.

---

## 11.5 Sprint 5D Cycle Smoke

Create `web/e2e/smoke/sprint5d-cycle.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible } from '../support/selectors';

test.describe('Sprint 5D Cycle Smoke — Mockup: #cycle-tracking #cycle-guardrail', () => {
  test('eligible user can open cycle page', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'femaleEligible');

    await page.goto('/cycle');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Cycle/i, /Siklus/i, /Calendar/i, /Kalender/i, /Settings/i, /Pengaturan/i]);

    await assertNoGlobalFailures();
  });

  test('non-eligible user cannot access cycle details', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'maleNonEligible');

    await page.goto('/cycle');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/not eligible/i, /tidak tersedia/i, /forbidden/i, /tidak dapat/i, /dashboard/i]);

    await assertNoGlobalFailures();
  });

  test('cycle page is usable at mobile 360px for eligible user', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await loginByApi(request, context, 'femaleEligible');

    await page.goto('/cycle');
    await expectAppNotBlank(page);

    await assertNoGlobalFailures();
  });
});
```

---

## 11.6 Sprint 5E Telegram Settings Smoke

Create `web/e2e/smoke/sprint5e-telegram.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible, expectNoSecretLikeText } from '../support/selectors';

test.describe('Sprint 5E Telegram Smoke — Mockup: #telegram-hydration #hydration-tracker', () => {
  test('telegram settings state is visible and no token leaks', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'premium');

    await page.goto('/telegram/settings');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Telegram/i, /Linked/i, /Not linked/i, /Terhubung/i, /Belum/i, /Reminder/i]);
    await expectNoSecretLikeText(page);

    await assertNoGlobalFailures();
  });

  test('hydration settings include Telegram quick-add state without exposing secrets', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'premium');

    await page.goto('/hydration/settings');
    await expectAppNotBlank(page);
    await expectAnyVisible(page, [/Telegram/i, /Reminder/i, /Quick/i, /Hidrasi/i]);
    await expectNoSecretLikeText(page);

    await assertNoGlobalFailures();
  });
});
```

---

## 11.7 Sprint 1–4 Regression Smoke

Create `web/e2e/smoke/regression-sprint1-4.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { attachGlobalFailureGates, expectAppNotBlank } from '../support/global-gates';
import { loginByApi } from '../support/auth';
import { expectAnyVisible } from '../support/selectors';

test.describe('Sprint 1-4 Regression Smoke — login dashboard measurement report PWA', () => {
  test('core routes still open after Sprint 5 changes', async ({ page, request, context }) => {
    const assertNoGlobalFailures = attachGlobalFailureGates(page);
    await loginByApi(request, context, 'free');

    for (const path of ['/dashboard', '/measurement', '/history', '/reports', '/settings']) {
      await page.goto(path);
      await expectAppNotBlank(page);
    }

    await assertNoGlobalFailures();
  });
});
```

Patch route names to match the real app if needed.

---

# 12. Faster execution commands

## Run one spec only

```bash
cd web
pnpm playwright test e2e/smoke/foundation-admin.spec.ts --project=chromium
```

## Run one test title only

```bash
cd web
pnpm playwright test -g "admin user can open admin shell" --project=chromium
```

## Run headed only when debugging

```bash
cd web
pnpm playwright test e2e/smoke/sprint5b-hydration.spec.ts --project=chromium --headed
```

## Run with trace after failure

```bash
cd web
pnpm playwright show-report
```

## Run all smoke tests

```bash
cd web
pnpm test:smoke
```

## Staging smoke

```bash
cd web
PLAYWRIGHT_BASE_URL=https://app.isehat.biz.id PLAYWRIGHT_SKIP_WEB_SERVER=true pnpm test:smoke
```

---

# 13. Speed optimization rules

```text
1. Chromium only.
2. Use smoke tests first, not full E2E.
3. Use API login, not UI login, for most specs.
4. Use 2 workers locally, 1 worker in CI/staging.
5. Reuse existing Vite server when running repeatedly.
6. Do not run screenshot comparison initially.
7. Do not seed database from every test if a global seed is already applied.
8. Group checks per page visit; avoid unnecessary page reloads.
9. Keep route list short and representative per phase.
10. Use headed mode only for debugging.
```

Expected runtime after stable setup:

```text
Foundation smoke: ~20–40s
5A smoke: ~30–60s
5B smoke: ~20–40s
5C smoke: ~20–40s
5D smoke: ~20–40s
5E smoke: ~15–30s
Full Chromium smoke: ~2–5 minutes depending on server speed
```

---

# 14. OpenCode CLI execution strategy

## Recommended: one primary agent + phase subagents

Use OpenCode from a compact runtime folder, not from a giant docs root.

Primary agent job:

```text
- Set up Playwright config.
- Add global gate.
- Add shared helpers.
- Assign one phase smoke at a time.
- Review failures.
- Update WORK_LOG.md and HANDOFF.md.
```

Subagent jobs:

```text
Subagent Foundation: write/fix foundation-admin smoke only.
Subagent 5A: write/fix daily-health/symptom smoke only.
Subagent 5B: write/fix hydration smoke only.
Subagent 5C: write/fix AI infrastructure smoke only.
Subagent 5D: write/fix cycle smoke only.
Subagent 5E: write/fix Telegram settings smoke only.
```

Do not let all subagents edit shared files at the same time.

Shared files that only the primary agent should edit:

```text
web/playwright.config.ts
web/e2e/support/global-gates.ts
web/e2e/support/auth.ts
web/e2e/support/selectors.ts
package.json
web/package.json
HANDOFF.md
WORK_LOG.md
```

Subagents may edit only their spec file:

```text
web/e2e/smoke/<phase>.spec.ts
```

## Safe subagent order

```text
1. Primary agent creates config/helpers.
2. Foundation subagent creates foundation-admin.spec.ts.
3. Primary runs Foundation smoke and fixes shared helper issues.
4. 5A and 5B subagents can work in parallel because they touch different spec files.
5. 5C, 5D, 5E subagents can work in parallel after helper layer is stable.
6. Primary runs all smoke specs and records final matrix.
```

---

# 15. OpenCode prompt for primary agent

```text
You are the Sprint 5 Browser QA Primary Agent.

Goal:
Add Playwright E2E smoke tests in Chromium only, plus a global console/network failure gate.

Read only:
- HANDOFF.md
- latest WORK_LOG entries only
- this file: PLAYWRIGHT_E2E_SMOKE_EXECUTION_PLAN_ONE_BROWSER.md
- relevant package.json files
- existing web route files only as needed

Do not read full PRD/API/SQL/mockup HTML unless blocked.

Tasks:
1. Install/configure Playwright for Chromium only.
2. Add web/playwright.config.ts.
3. Add e2e/support/global-gates.ts.
4. Add e2e/support/auth.ts.
5. Add e2e/support/selectors.ts.
6. Add package scripts.
7. Create foundation-admin.spec.ts first.
8. Run foundation smoke only.
9. Fix only issues required for foundation smoke.
10. Stop and update WORK_LOG.md + HANDOFF.md.

Rules:
- Every spec must attach global failure gate.
- /api/* 404 and 5xx fail tests.
- console.error and pageerror fail tests.
- Do not mark DONE if browser smoke fails.
- Use Ponytail discipline: minimal changes, no new dependency except Playwright.
```

---

# 16. OpenCode prompt for subagents

## Foundation subagent

```text
You are the Foundation Browser Smoke subagent.

Only edit:
- web/e2e/smoke/foundation-admin.spec.ts

Do not edit shared helpers unless explicitly asked.

Goal:
Verify admin shell, admin pages, admin access denied, secret masking, and no /api/* 404/500 in Chromium.

Mockup anchors:
- #foundation-admin
- #admin-users-roles
- #admin-plans
- #admin-ai-config
- #admin-audit

Run:
cd web && pnpm playwright test e2e/smoke/foundation-admin.spec.ts --project=chromium

If failing because route names differ, patch the spec to match existing app route names.
If failing because frontend is genuinely broken, document NEEDS_UI_FIX.
```

## 5A subagent

```text
You are the Sprint 5A Browser Smoke subagent.

Only edit:
- web/e2e/smoke/sprint5a-daily-health.spec.ts

Goal:
Verify login page, Google button, dashboard daily health hub, symptom form, history, and mobile 360px.

Mockup anchors:
- #google-oauth
- #daily-health-hub
- #education-layer
- #symptom-logger
- #red-flag-flow
- #history-integration

Run:
cd web && pnpm playwright test e2e/smoke/sprint5a-daily-health.spec.ts --project=chromium
```

## 5B subagent

```text
You are the Sprint 5B Browser Smoke subagent.

Only edit:
- web/e2e/smoke/sprint5b-hydration.spec.ts

Goal:
Verify hydration page, quick add controls, settings, history, and mobile 360px.

Mockup anchors:
- #hydration-tracker
- #daily-health-hub

Run:
cd web && pnpm playwright test e2e/smoke/sprint5b-hydration.spec.ts --project=chromium
```

## 5C subagent

```text
You are the Sprint 5C Browser Smoke subagent.

Only edit:
- web/e2e/smoke/sprint5c-ai-infra.spec.ts

Goal:
Verify AI memory/settings page, Sprint 6 readiness disabled state, no AI doctor active copy, no diagnosis/prescription claims, and clinicalCopilotMode deferred.

Mockup anchors:
- #ai-clinical-infra
- #ai-memory
- #context-package
- #sprint6-ready

Run:
cd web && pnpm playwright test e2e/smoke/sprint5c-ai-infra.spec.ts --project=chromium
```

## 5D subagent

```text
You are the Sprint 5D Browser Smoke subagent.

Only edit:
- web/e2e/smoke/sprint5d-cycle.spec.ts

Goal:
Verify eligible user can open cycle page, non-eligible user is blocked, and mobile 360px works.

Mockup anchors:
- #cycle-tracking
- #cycle-guardrail

Run:
cd web && pnpm playwright test e2e/smoke/sprint5d-cycle.spec.ts --project=chromium
```

## 5E subagent

```text
You are the Sprint 5E Browser Smoke subagent.

Only edit:
- web/e2e/smoke/sprint5e-telegram.spec.ts

Goal:
Verify Telegram settings and hydration settings integration without exposing tokens/secrets.

Mockup anchors:
- #telegram-hydration
- #hydration-tracker

Run:
cd web && pnpm playwright test e2e/smoke/sprint5e-telegram.spec.ts --project=chromium
```

---

# 17. How to record failures

Create or update:

```text
TASK_COMPLETION_QA_MATRIX.md
```

Minimum columns:

```text
Task ID
Phase
Screen/Route
Mockup Anchor
Backend Evidence
Browser Smoke
Mobile 360
Console/Network Gate
Status
Notes
```

Status values:

```text
PASS
NEEDS_UI_FIX
NEEDS_INTEGRATION_FIX
NEEDS_AUTH_FIX
NEEDS_TEST_DATA
BLOCKED_MISSING_ROUTE
BLOCKED_MISSING_TEST_USER
```

Example:

```markdown
| Task ID | Phase | Screen/Route | Mockup Anchor | Browser Smoke | Console/Network Gate | Status | Notes |
|---|---|---|---|---|---|---|---|
| S5B-006 | 5B | /hydration | #hydration-tracker | FAIL | /api/hydration/today 404 | NEEDS_INTEGRATION_FIX | Route not mounted or proxy broken |
```

---

# 18. Definition of Done for this QA task

This Playwright QA task is DONE only when:

```text
[ ] Playwright is installed/configured for Chromium only.
[ ] Global console/network failure gate exists and is used by all smoke specs.
[ ] Foundation smoke spec exists.
[ ] 5A smoke spec exists.
[ ] 5B smoke spec exists.
[ ] 5C smoke spec exists.
[ ] 5D smoke spec exists.
[ ] 5E smoke spec exists.
[ ] Sprint 1–4 regression smoke spec exists.
[ ] `cd web && npx tsc -b` PASS.
[ ] `cd web && npx eslint .` PASS.
[ ] `cd web && npx vite build` PASS.
[ ] `cd web && npx playwright test e2e/smoke --project=chromium` runs.
[ ] All failures are classified in TASK_COMPLETION_QA_MATRIX.md.
[ ] WORK_LOG.md updated.
[ ] HANDOFF.md updated.
```

If smoke tests fail because the app is actually broken, the QA task can still be marked as:

```text
Completed with findings
```

but Sprint 5 release cannot be marked final DONE until those findings are fixed.

---

# 19. Final command checklist

Local:

```bash
cd worker
npx tsc -p tsconfig.json
npm test

cd ../web
npx tsc -b
npx eslint .
npx vite build
npx playwright test e2e/smoke --project=chromium
```

Staging:

```bash
cd web
PLAYWRIGHT_BASE_URL=https://app.isehat.biz.id \
PLAYWRIGHT_SKIP_WEB_SERVER=true \
npx playwright test e2e/smoke --project=chromium
```

Fast single phase:

```bash
cd web
npx playwright test e2e/smoke/sprint5b-hydration.spec.ts --project=chromium
```

---

# 20. Final note for agent

Backend PASS is not enough.

```text
A Sprint 5 task is not verified until the related screen opens in Chromium without:
- blank screen;
- console error;
- pageerror;
- /api/* 404;
- /api/* 5xx;
- secret leakage;
- broken mobile 360px layout for user-facing screens.
```
