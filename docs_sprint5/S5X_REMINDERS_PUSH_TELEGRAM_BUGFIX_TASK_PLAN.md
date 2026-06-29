# S5X-RPT — Reminders + Push + Telegram Bugfix Task Plan

```text
Product: iSehat / HL Health Companion
Document Type: Task Plan + Test Plan
Task Group: S5X-RPT — Reminders POST 500, Browser Push, Telegram Sync
Version: 1.0 EXECUTION READY
Date: 2026-06-29
Scope: 3 production bugs reported by superadmin user
Prerequisite: SuperAdmin login works (jhon.nicollas@gmail.com)
```

---

## 0. Bug Inventory (from user report)

| # | Bug | Symptom | Severity |
|---|---|---|---|
| 1 | Reminders POST 500 | `POST https://app.isehat.biz.id/api/reminders 500 (Internal Server Error)` when creating reminder from RemindersPage | HIGH — core feature broken |
| 2 | Browser push notification | `Could not enable browser push. Check browser settings.` when clicking Enable Browser Push button | HIGH — notifications don't work |
| 3 | Telegram sync with reminders | TelegramSettingsPage should sync with RemindersPage so reminders can fire via Telegram | MEDIUM — integration incomplete |

---

## 1. Bug Analysis (from source code audit)

### 1.1 POST /api/reminders 500 Internal Server Error

**Location:** `worker/src/index.ts` lines 3877-3894

**Root cause analysis:**

**Schema** (verified via `wrangler d1 execute` PRAGMA on remote D1):
```sql
HL_reminderSettings columns:
  id, userId, reminderType, enabled(1), scheduleTime, timezone('Asia/Jakarta'),
  channel('telegram'), payloadJson, createdAt, updatedAt
```

**Current INSERT** (worker/src/index.ts:3888):
```typescript
INSERT INTO HL_reminderSettings
  (userId, reminderType, scheduleTime, timezone, payloadJson, enabled, createdAt, updatedAt)
VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
```

**5 placeholders + literal `1` for enabled** — all NOT NULL columns covered.

**Frontend sends** (RemindersPage.tsx:77-84):
```typescript
const res = await fetch('/api/reminders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scheduleTime: e.time,
    reminderType: e.reminderType,
    label: e.label,
    daysOfWeek: e.days
  })
})
```

**Likely root causes** (need runtime check):
1. `insertAndGetId()` utility failure — check if function returns null/undefined
2. `payloadJson` serialization failure — check if `JSON.stringify({ label, daysOfWeek })` produces invalid JSON
3. `daysOfWeek` validation — if string format is wrong (e.g., trailing comma, wrong separator)
4. `reminderType` constraint — if there's a CHECK constraint on values
5. `scheduleTime` format — if backend expects different format than `'HH:MM'`

**Recommended debug step:** Add `console.error(error)` with full error stack to see exact SQL error.

### 1.2 Browser Push Notification — "Could not enable browser push"

**Location:** `web/src/pages/reminders/RemindersPage.tsx` lines 132-167

**Root cause analysis:**

**Frontend flow:**
1. `navigator.serviceWorker.register('/sw.js')` (line 142-144)
2. `navigator.serviceWorker.ready` (line 148)
3. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: 'BEl62iUYgUivxIkv69yViEiBIa-3N3Mf9iLq2qN0g8Kj5QK9F5E2qD5W4V7Y9P3Q' })` (line 149-152)
4. POST to `/api/push/subscribe` (line 153-158)

**Issues identified:**
1. **`/api/push/subscribe` endpoint DOES NOT EXIST** in `worker/src/` — verified by grep, no route handler found
2. **Hardcoded VAPID public key** `'BEl62iUYgUivxIkv69yViEiBIa-3N3Mf9iLq2qN0g8Kj5QK9F5E2qD5W4V7Y9P3Q'` is a placeholder/fake key — real VAPID keys needed from Cloudflare dashboard or generated
3. **Service worker file `/sw.js` may not exist** in production build
4. **No `/sw.js` registration** — the code calls `register('/sw.js')` but if file doesn't exist, subscription fails silently

**Recommended fix path:**
1. Generate real VAPID keys (web-push library or Cloudflare Workers dashboard)
2. Store VAPID private key in Cloudflare Secrets
3. Add VAPID public key to wrangler.toml `[vars]` or use Secrets
4. Create `/api/push/subscribe` endpoint in `worker/src/index.ts` or `routes-extra.ts`
5. Create `/sw.js` service worker file in `web/public/sw.js`
6. Store push subscriptions in new `HL_pushSubscriptions` table

### 1.3 Telegram Integration Sync with Reminders

**Location:** `worker/src/routes-telegram.ts` lines 144-192

**Current state:**
- Cron route exists at `/api/internal/cron/hydration-reminders`
- It uses `HL_hydrationSettings` table (NOT `HL_reminderSettings`)
- It checks `telegramQuickAddEnabled` flag
- It sends Telegram messages to linked users

**Gap:** `HL_reminderSettings` (from RemindersPage) is NOT connected to Telegram delivery. The cron only handles hydration reminders, not general reminders created from RemindersPage.

**Recommended fix:** Extend the cron route to also process `HL_reminderSettings` and send via Telegram when user has Telegram linked and reminder `channel = 'telegram'`.

---

## 2. File Structure

**NEW FILES:**
- `worker/src/routes-push.ts` — push subscription endpoints
- `web/public/sw.js` — service worker for push notifications
- `web/src/utils/push.ts` — push subscription helper

**NEW DB TABLES:**
```sql
CREATE TABLE IF NOT EXISTS HL_pushSubscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  userAgent TEXT,
  createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastUsedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (userId) REFERENCES HL_users(id)
);

CREATE INDEX IF NOT EXISTS idx_HL_pushSubscriptions_user
ON HL_pushSubscriptions(userId, active);
```

---

## 3. Task List

### RPT-001 — Diagnose POST /api/reminders 500 Root Cause

**Priority:** P0  
**Area:** `worker/src/index.ts` lines 3877-3894

**Deliverables:**
- Add detailed error logging to catch block (line 3893):
  ```typescript
  } catch (error: any) {
    console.error('reminder create error:', error?.message, error?.cause, error?.stack)
    return jsonResponse(c, failure('INTERNAL_ERROR', `Gagal buat reminder: ${error?.message || 'unknown'}`, 500, [], startedAt))
  }
  ```
- Deploy, reproduce bug from frontend, capture server log
- Identify exact error: SQL constraint? insertAndGetId failure? payloadJson issue?

**Acceptance Criteria:**
- [ ] Exact error message captured in Worker logs
- [ ] Root cause identified (constraint, function, or data shape)

**Verification:**
```bash
cd worker && npx tsc -p tsconfig.json && npm test
wrangler tail --format=pretty
```

---

### RPT-002 — Fix POST /api/reminders 500

**Priority:** P0  
**Area:** `worker/src/index.ts` lines 3877-3894

**Deliverables (after RPT-001 identifies root cause):**
- If `reminderType` constraint: accept any string or add CHECK constraint update
- If `payloadJson` issue: validate JSON before binding
- If `insertAndGetId` failure: add fallback to manual last_row_id query
- If `scheduleTime` format: add validation

**Acceptance Criteria:**
- [ ] POST /api/reminders returns 201 with reminderId
- [ ] RemindersPage creates reminder successfully
- [ ] No 500 errors in Worker logs

**Verification:**
```bash
cd worker && npm test
# Manual: create reminder from RemindersPage, verify 201 response
```

---

### RPT-003 — Create /api/push/subscribe and /api/push/unsubscribe Endpoints

**Priority:** P0  
**Area:** `worker/src/routes-push.ts` (new file)

**Deliverables:**
```typescript
// POST /api/push/subscribe
// body: { endpoint, keys: { p256dh, auth } }
// store in HL_pushSubscriptions

// DELETE /api/push/unsubscribe
// body: { endpoint }
// mark active = 0

// POST /api/push/test
// body: { title, body }
// send test push to all active subscriptions for user
```

**Generate VAPID keys:**
```bash
npx web-push generate-vapid-keys
# Add to wrangler.toml [vars] or as secrets:
# VAPID_PUBLIC_KEY = "..."
# VAPID_PRIVATE_KEY = "..."
# VAPID_SUBJECT = "mailto:admin@isehat.biz.id"
```

**Acceptance Criteria:**
- [ ] POST /api/push/subscribe stores subscription
- [ ] DELETE /api/push/unsubscribe marks inactive
- [ ] Test push delivers to browser
- [ ] Worker can send push to subscribed users

**Verification:**
```bash
cd worker && npm test
# Manual: enable push in browser DevTools, check HL_pushSubscriptions in D1
```

---

### RPT-004 — Create Service Worker `/sw.js`

**Priority:** P0  
**Area:** `web/public/sw.js` (new file)

**Deliverables:**
```javascript
// sw.js
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'iSehat', {
      body: data.body || 'Pengingat baru',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: data.url
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data))
  }
})
```

**Acceptance Criteria:**
- [ ] sw.js accessible at /sw.js in production
- [ ] Push events trigger showNotification
- [ ] Click events open URL

---

### RPT-005 — Fix Browser Push Frontend (RemindersPage.tsx)

**Priority:** P0  
**Area:** `web/src/pages/reminders/RemindersPage.tsx` lines 132-167

**Deliverables:**
- Replace hardcoded VAPID key with env variable `import.meta.env.VITE_VAPID_PUBLIC_KEY`
- Add proper error messages
- Handle push subscription errors gracefully

**Acceptance Criteria:**
- [ ] No hardcoded VAPID key in source
- [ ] Clear error messages for each failure mode
- [ ] Subscribe persists across page reloads

---

### RPT-006 — Connect Telegram to HL_reminderSettings

**Priority:** P1  
**Area:** `worker/src/routes-telegram.ts` lines 144-192

**Deliverables:**
- Extend hydration-reminders cron to also query HL_reminderSettings
- Check `channel = 'telegram'` and user has linked Telegram
- Send Telegram message to user when reminder fires
- Honor `daysOfWeek` and `scheduleTime` from HL_reminderSettings

**Acceptance Criteria:**
- [ ] Reminder created in RemindersPage fires via Telegram at scheduled time
- [ ] Cron processes both HL_hydrationSettings and HL_reminderSettings
- [ ] daysOfWeek filter applied correctly

---

### RPT-007 — Add Test Coverage for All 3 Bugs

**Priority:** P0  
**Area:** `worker/test/sprint5-rpt.test.mjs` (new file)

**Deliverables:**
```javascript
// Test: POST /api/reminders with valid payload returns 201
// Test: POST /api/reminders with missing scheduleTime returns 400
// Test: POST /api/push/subscribe stores subscription
// Test: Telegram cron processes HL_reminderSettings
```

**Acceptance Criteria:**
- [ ] All new endpoints have unit tests
- [ ] All tests pass

---

## 4. Execution Order

```text
RPT-001 (diagnose) → RPT-002 (fix reminders) → RPT-003 (push endpoints) →
RPT-004 (service worker) → RPT-005 (frontend push) → RPT-006 (Telegram sync) →
RPT-007 (tests)
```

## 5. Test Plan

### 5.1 Unit Tests (worker)

**File:** `worker/test/sprint5-rpt.test.mjs`

| Test | Description |
|---|---|
| POST /api/reminders valid payload returns 201 with reminderId | Happy path |
| POST /api/reminders missing scheduleTime returns 400 | Validation |
| POST /api/reminders with invalid scheduleTime format returns 400 | Format check |
| POST /api/reminders with invalid reminderType returns 400 | Type check |
| GET /api/reminders returns user's reminders only | Auth + scope |
| DELETE /api/reminders/:id removes the reminder | CRUD |
| POST /api/push/subscribe stores subscription | Push enroll |
| POST /api/push/subscribe duplicate endpoint updates existing | Idempotent |
| DELETE /api/push/unsubscribe marks active=0 | Unenroll |
| Telegram cron processes HL_reminderSettings with channel=telegram | Integration |
| Telegram cron skips users without Telegram link | Safety |

### 5.2 E2E Tests (Playwright)

**File:** `web/e2e/smoke/rpt-fixes.spec.ts`

| Test | Description |
|---|---|
| Reminders page creates a reminder without 500 | Bug 1 regression |
| Browser push enable persists subscription | Bug 2 regression |
| Telegram link shows in reminders page channel options | Bug 3 regression |

### 5.3 Security Tests

| Test | Description |
|---|---|
| Push subscription endpoint is scoped to userId | Auth scope |
| Reminder POST cannot create for another user | Auth scope |
| VAPID private key never exposed to frontend | Secret hygiene |

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| VAPID key leak | Private key in Cloudflare Secrets only, never in frontend bundle |
| Push permission denied by browser | Fallback to in-app toast, never crash |
| Telegram cron overload | Batch by hour, rate-limit per user |
| Reminder duplicate fires | Check enabled=1 + last-sent timestamp |
| Existing reminders break after schema change | Use additive ALTER TABLE only |

---

## 7. Definition of Done

```text
[ ] RemindersPage creates reminder without 500 error
[ ] Browser push notification enables successfully
[ ] Telegram channel delivers reminders
[ ] All new endpoints have unit tests (worker)
[ ] E2E regression tests pass
[ ] No security regression (push secrets, auth scope)
[ ] Worker tsc + tests pass
[ ] Web tsc + eslint + build pass
[ ] Worker + Pages deployed
[ ] HANDOFF.md + WORK_LOG.md updated
```
