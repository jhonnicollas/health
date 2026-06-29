# AUDIT GAP ANALYSIS — HL Health Companion Sprint 5
## Source Code vs PRD User Stories + Task Plan

```text
Audit Date: June 27, 2026
Scope: Full codebase audit (worker/src, web/src) vs docs_sprint5/02 + docs_sprint5/08
Method: Direct code inspection — NO log files read (WORK_LOG.md, HANDOFF.md)
Status: COMPLETED
Total Gaps Found: 28
```

---

## Scoring Legend

| Score | Definition |
|---|---|
| **CRITICAL** | Feature completely missing, blocks user flows, backend route not mounted |
| **HIGH** | Feature partially complete, major functionality gap, UI broken |
| **MEDIUM** | Minor gap, UI polish, or optimization needed |

---

## 1. CRITICAL GAPS (14)

### GAP-001 | NO Admin Backend Routes Mounted | CRITICAL
**Task Refs:** S5F-007, S5F-008, S5F-009, S5F-010, S5F-011, S5F-013, S5F-014
**Evidence:** Frontend `AdminPage.tsx` calls 13+ admin API endpoints. Backend `index.ts` mounts only: `mountExtraRoutes`, `mountAuthRoutes`, `mountHydrationRoutes`, `mountAiRoutes`, `mountCycleRoutes`, `mountTelegramRoutes`. NO admin route file is imported or mounted.
**Missing endpoints:**
```
GET/POST/PUT /api/admin/users/*          (S5F-007)
GET/POST/PUT/DELETE /api/admin/roles/*   (S5F-008)
GET/POST/PUT /api/admin/plans/*          (S5F-009)
GET/PUT /api/admin/configs/*             (S5F-010)
GET/PUT /api/admin/ai-config             (S5F-010)
GET/PUT /api/admin/feature-flags/*       (S5F-011)
POST /api/billing/webhook/:provider      (S5F-012)
GET /api/admin/audit-logs                (S5F-013)
GET /api/admin/safety-events             (S5F-013)
GET/PUT /api/admin/metric-catalog/*      (S5F-014)
GET/PUT /api/admin/metric-rules/*        (S5F-014)
GET/PUT /api/admin/knowledge-articles/*  (S5F-014)
GET /api/admin/metrics                   (AdminPage.tsx OverviewTab)
```
**Impact:** Admin panel frontend renders but ALL tabs return 404 or access denied.
**Fix:** Create `worker/src/routes-admin.ts` with all admin CRUD routes, import and mount in `index.ts`.

### GAP-002 | NO `/api/me/entitlements` Backend Endpoint | CRITICAL
**Task Ref:** S5F-009
**Evidence:** `web/src/hooks/useEntitlements.ts` calls `fetch('/api/me/entitlements')`. This endpoint does not exist in any route file. No route handler found in `index.ts`, `routes-auth.ts`, `routes-extra.ts`, or any other route file.
**Impact:** All frontend feature gating via `useEntitlements()` fails silently (catch block does `return true` — fail-open). Users without entitlement can bypass feature gates. Navigation shows premium features to Free users.
**Fix:** Add `GET /api/me/entitlements` endpoint to return plan + feature list + quota status per user.

### GAP-003 | Admin Access Check is HARDCODED (Not RBAC) | CRITICAL
**Task Ref:** S5F-015
**Evidence:** `web/src/App.tsx` line: `const isAdmin = user.email === 'admin@homesungai.com'`
**Impact:** 
- Any user with email `admin@homesungai.com` gets admin access regardless of actual role
- Real admin users with different emails cannot access admin panel
- User with role `admin` in DB but different email sees no admin link
- No server-side permission check for admin nav visibility
**Fix:** Replace hardcoded check with an API call to `/api/auth/me` that returns user roles/permissions. Use RBAC `hasPermission('admin.access')` from server response.

### GAP-004 | NO Plan Upgrade / Premium Page | CRITICAL
**Task Ref:** S5F-016, S5X-003
**Evidence:** Frontend files:
- `UpgradePrompt.tsx` — only a modal/card saying "Upgrade Diperlukan", navigates to `/settings/profile`
- `ProfileSettingsPage.tsx` — user profile settings, not a plan upgrade page
- No route for `/premium`, `/upgrade`, `/plans`, or `/subscription`
- No frontend page to compare plans (Free vs Premium Monthly vs Quarterly vs Yearly vs Family)
**Impact:** User yang ingin upgrade plan TIDAK BISA. Ketika entitlement memblokir fitur premium, prompt hanya bilang "Lihat Plan & Upgrade" tapi tidak ada halaman upgrade yang sesungguhnya.
**Fix:** Create `web/src/pages/premium/PremiumUpgradePage.tsx` with plan comparison table, CTA buttons, and subscription flow. Add route `/premium/upgrade` in App.tsx.

### GAP-005 | NO Subscription/Plan Management Frontend | CRITICAL
**Task Ref:** S5F-009, S5F-016
**Evidence:** `AdminPage.tsx` PlansTab tries to call `/api/admin/plans` — endpoint doesn't exist. No frontend page for users to view their current plan, billing status, or subscription details.
**Impact:** Tidak ada cara bagi admin untuk mengelola subscription user. Tidak ada cara bagi user untuk melihat plan aktif mereka.
**Fix:** Add admin plan/subscription management UI. Add user-facing subscription status page.

### GAP-006 | AdminPage Uses Non-Existent API Endpoints | CRITICAL
**Task Ref:** S5F-016
**Evidence:** `AdminPage.tsx` calls these non-existent endpoints:
- `GET /api/admin/metrics` → OverviewTab
- `GET /api/admin/users` → UsersTab
- `GET /api/admin/roles` → RolesTab
- `GET /api/admin/plans` → PlansTab
- `GET /api/admin/configs` → ConfigsTab
- `GET /api/admin/ai-config` + `PUT` → AiConfigTab
- `GET /api/admin/feature-flags` → FeatureFlagsTab
- `GET /api/admin/audit-logs` → AuditLogsTab
- `GET /api/admin/safety-events` → SafetyEventsTab
- `GET /api/admin/metric-catalog` → MetricCatalogTab
- `GET /api/admin/metric-rules` → MetricRulesTab
- `GET /api/admin/knowledge-articles` → KnowledgeTab
- `PUT /api/admin/configs/:configKey` → ConfigsTab save
**Impact:** Setiap tab admin akan gagal load dan menampilkan error "Access denied" atau loading forever.
**Fix:** Implement backend admin routes (see GAP-001) and update frontend API calls accordingly.

### GAP-007 | NO `POST /api/internal/usage/consume` Endpoint | CRITICAL
**Task Ref:** S5F-009
**Evidence:** QuotaService.consumeQuota exists in `worker/src/services/entitlements.ts` but no HTTP route exposes it. The task plan requires `POST /api/internal/usage/consume`.
**Impact:** Quota tracking tidak bisa dikonsumsi oleh frontend atau service lain. Fitur berbiaya tinggi tidak bisa dihitung pemakaiannya.
**Fix:** Add internal route or make it callable from other services directly.

### GAP-008 | NO Admin Middleware/Guard on Routes | CRITICAL
**Task Ref:** S5F-005, S5F-015
**Evidence:** `worker/src/index.ts` has no middleware for admin route protection. `RbacService.hasPermission()` exists but is only called in `routes-ai.ts` for a few AI admin endpoints. No global `/api/admin/*` guard.
**Impact:** Jika admin routes ditambahkan nanti, tidak ada proteksi otomatis — harus manual per-endpoint. Rentan terhadap missed permission checks.
**Fix:** Add Hono middleware that checks `RbacService.hasPermission(db, userId, 'admin.access')` for all `/api/admin/*` routes.

### GAP-009 | NO Billing Webhook Route | CRITICAL
**Task Ref:** S5F-012
**Evidence:** `POST /api/billing/webhook/:provider` required by task plan. No route exists. No subscription activation logic from payment provider callbacks.
**Impact:** Tidak bisa menerima callback dari Stripe/Midtrans/Xendit untuk aktivasi subscription otomatis.
**Fix:** Implement billing webhook handler with provider adapter, signature validation, idempotency, and subscription status update.

### GAP-010 | Admin Layout Not Separated from User Layout | CRITICAL
**Task Ref:** S5F-015, PRD Foundation UI/UX #2
**Evidence:** `AdminPage.tsx` uses `<section className="settings-panel admin-page">` — same CSS class as regular settings. No dedicated admin shell/layout component.
**Impact:** Admin area terlihat sama seperti halaman settings user biasa. PRD explicitly requires "Admin area memakai layout terpisah dari dashboard user."
**Fix:** Create dedicated `AdminShell` component with sidebar navigation, different color scheme, and desktop-optimized layout.

### GAP-011 | NO Feature Flags CRUD in Backend | CRITICAL
**Task Ref:** S5F-011
**Evidence:** `GET/PUT /api/admin/feature-flags` required by task plan. No route exists. Feature flags are defined in shared constants but no admin API for managing them.
**Impact:** Admin tidak bisa enable/disable feature flags tanpa deploy ulang atau manual D1 query.
**Fix:** Implement admin feature flags routes.

### GAP-012 | NO Admin Education Management Routes | CRITICAL
**Task Ref:** S5A-005
**Evidence:** `GET /api/admin/education/cards` + `PUT /api/admin/education/cards/:topicType/:topicCode` required. EducationService exists but only user-facing routes exist. No admin education CRUD routes.
**Impact:** Admin tidak bisa mengelola konten edukasi dari admin panel.
**Fix:** Add admin education CRUD routes.

### GAP-013 | NO Admin Metrics Dashboard Endpoint | CRITICAL
**Task Ref:** S5F-007, S5X-006
**Evidence:** `AdminPage.tsx` OverviewTab calls `GET /api/admin/metrics`. No such endpoint exists. Admin dashboard metrics (user count, plan count, subscription count, safety event count, audit log count) cannot be retrieved.
**Impact:** Admin dashboard Overview tab always shows error.
**Fix:** Implement admin dashboard metrics endpoint.

### GAP-014 | Route Registration Missing for Phase Routes | CRITICAL
**Task Ref:** S5X-001
**Evidence:** `worker/src/index.ts` imports:
```typescript
import { mountAuthRoutes } from "./routes-auth.js"
import { mountHydrationRoutes } from "./routes-hydration.js"
import { mountAiRoutes } from "./routes-ai.js"
import { mountCycleRoutes } from "./routes-cycle.js"
import { mountTelegramRoutes } from "./routes-telegram.js"
import { mountExtraRoutes, ... } from './routes-extra.js'
```
Missing imports for admin routes, me-entitlements route, billing webhook route.
**Impact:** Multiple phase routes not wired into the app router.
**Fix:** Add missing route file imports and mount calls.

---

## 2. HIGH GAPS (8)

### GAP-015 | Entitlement Gating UI is Fail-Open | HIGH
**Task Ref:** S5F-006, S5F-016
**Evidence:** `web/src/hooks/useEntitlements.ts`:
```typescript
const isEnabled = (featureCode?: string) => {
    if (!featureCode) return true
    if (loading || !entitlements) return true  // ← FAIL-OPEN
    return entitlements.features[featureCode]?.enabled === true
}
```
When `/api/me/entitlements` fails (which it always does since it doesn't exist — GAP-002), all features are treated as enabled.
**Impact:** Semua fitur premium bisa diakses oleh Free user karena entitlement check fail-open.
**Fix:** After fixing GAP-002, change fail-open to fail-closed: `if (loading || !entitlements) return false`.

### GAP-016 | Navigation Shows All Premium Items to Free Users | HIGH
**Task Ref:** S5F-006, S5X-002
**Evidence:** `web/src/App.tsx`:
```typescript
const visibleNav = NAV.filter(link => {
    if (link.adminOnly && !isAdmin) return false
    if (link.visible === false) return false
    if (!entitlementsLoading && link.featureCode && !isEnabled(link.featureCode)) return false
    return true
})
```
Because `isEnabled()` is fail-open (GAP-015) and `entitlementsLoading` is true until first API call completes (which also fails), all premium features appear in the navigation.
**Impact:** Free users see AI Assistant, Cycle Tracking, Hydration, Family Dashboard, Advanced History menu items.
**Fix:** Fix GAP-002 + GAP-015 together. Also add server-side entitlement response in `/api/auth/me`.

### GAP-017 | LoginPage Google OAuth Button Uses `<a>` Tag Without State Management | HIGH
**Task Ref:** S5A-003
**Evidence:** `LoginPage.tsx`:
```html
<a href="/api/auth/google" class="btn-secondary" ...>
```
and `RegisterPage.tsx`:
```html
<a href="/api/auth/google?mode=login" class="btn-secondary" ...>
```
No CSRF state parameter, no error handling for OAuth failures, no loading state during redirect.
**Impact:** OAuth flow works via full-page redirect but no client-side state management, no error recovery UI.
**Fix:** Use `window.location.href` with proper state/error handling, or add error callback support.

### GAP-018 | AI Assistant Endpoint Has Duplicate Entitlement Logic | HIGH
**Task Ref:** S5C-007
**Evidence:** `worker/src/index.ts` main route file has `/api/ai/assistant` that checks `EntitlementService.requireEntitlement`. But the task plan says `routes-ai.ts` should handle this. The main index.ts has a duplicate AI assistant route that may conflict with the one in routes-ai.ts.
**Impact:** Potential route conflict between index.ts and routes-ai.ts. Both mount on same app instance.
**Fix:** Remove AI routes from monolithic index.ts, delegate fully to routes-ai.ts.

### GAP-019 | History Timeline Integration Partial | HIGH
**Task Ref:** S5A-015, S5X-005
**Evidence:** Frontend has `HistoryTimelinePage.tsx` imported in App.tsx. Backend has measurement history in `index.ts` and symptom history in `routes-auth.ts`. But no unified timeline endpoint that merges measurement + symptom + safety event + hydration in a single sorted feed.
**Impact:** History page may only show measurements, not mixed timeline per PRD requirement.
**Fix:** Create unified `GET /api/history/timeline` endpoint or ensure HistoryTimelinePage merges multiple API calls.

### GAP-020 | Telegram Settings UI Hidden in Navigation | HIGH
**Task Ref:** S5E-006
**Evidence:** `App.tsx` NAV configuration:
```typescript
{ path: '/telegram', label: 'Telegram', ..., visible: false, featureCode: 'feature.telegramReminder.use' }
```
The `visible: false` flag means this is never shown in navigation even when user has entitlement.
**Impact:** User yang sudah connect Telegram tidak bisa mengakses halaman pengaturan Telegram dari navigasi.
**Fix:** Change `visible: false` to `visible: true` (or remove the flag) and rely on `featureCode` entitlement check.

### GAP-021 | No Auth State Includes Roles/Permissions | HIGH
**Task Ref:** S5F-007
**Evidence:** `GET /api/auth/me` response (`worker/src/index.ts`):
```typescript
const result = success({
    user: publicUser(row),
    profile: publicProfile(profile),
    requiresOnboarding: !profile
}, 200, startedAt)
```
No `roles`, `permissions`, `planCode`, or `entitlements` in the response.
**Impact:** Frontend cannot determine user role or plan for conditional rendering. Forces hardcoded admin check (GAP-003).
**Fix:** Extend `/api/auth/me` response to include `roles: string[]`, `permissions: string[]`, `plan: { planCode, planName }`, `entitlements: { features: Record<string, {enabled, quota} } }`.

### GAP-022 | No Frontend RBAC/Permission Hook | HIGH
**Task Ref:** S5F-015
**Evidence:** No hook like `usePermission(permissionCode)` exists. Only `useEntitlements()` for feature gating. Admin access check is hardcoded email.
**Impact:** Cannot conditionally render UI elements based on granular permissions (e.g., show/hide edit buttons based on `admin.users.update` permission).
**Fix:** Create `web/src/hooks/usePermissions.ts` that reads permissions from auth context.

---

## 3. MEDIUM GAPS (6)

### GAP-023 | AdminPage No Server-Side Confirmation Feedback | MEDIUM
**Task Ref:** S5F-016
**Evidence:** `AdminPage.tsx` has basic loading/error states but no success toasts after save actions, no undo capability after mutations.
**Fix:** Add toast notifications for successful admin mutations.

### GAP-024 | Watermark/Image Compression Utils Exist but Unused | MEDIUM
**Task Ref:** Sprint 1-4
**Evidence:** `web/src/utils/watermark.ts` and `web/src/utils/imageCompressor.ts` exist. Not audited for integration with measurement attachment upload.
**Fix:** Verify these are integrated in attachment upload flow or remove dead code.

### GAP-025 | No PWA Update/Offline Indicator | MEDIUM
**Task Ref:** GNFR-001
**Evidence:** `web/public/sw.js` exists (service worker). No offline detection UI or "new version available" prompt in App.tsx.
**Fix:** Add offline indicator banner and PWA update prompt.

### GAP-026 | EducationCard Modal Import But No Reusable Component | MEDIUM
**Task Ref:** S5A-014
**Evidence:** `web/src/components/EducationBottomSheet.tsx` exists. Frontend page files exist at `docs_sprint5/Frontend/education_card_modal.html`. But in-page integration vs separate modal component unclear.
**Fix:** Audit EducationBottomSheet integration across all metric pages.

### GAP-027 | ConfigDashboardPage Redundant with AdminPage ConfigsTab | MEDIUM
**Task Ref:** S5F-016
**Evidence:** Two separate config management UIs:
1. `AdminPage.tsx` ConfigsTab — inline table editor
2. `ConfigDashboardPage.tsx` — full page config editor
Both call same `/api/admin/configs` endpoint. ConfigDashboardPage is imported but not used in App.tsx routes.
**Fix:** Consolidate or clearly document which is canonical.

### GAP-028 | No Loading/Error State for Entitlement-Dependent Routes | MEDIUM
**Task Ref:** S5X-003
**Evidence:** `App.tsx` renders `<UpgradePrompt>` when route is blocked, but during entitlement loading (`entitlementsLoading=true`), the route renders normally (fail-open behavior). This causes a flash of premium content before blocking.
**Fix:** Show loading spinner or skeleton while entitlements are being fetched.

---

## 4. SUMMARY

### Gap Distribution by Phase

| Phase | Critical | High | Medium | Total |
|---|---|---|---|---|
| **Foundation** | 11 | 4 | 3 | **18** |
| **5A (Daily Health)** | 1 | 1 | 1 | **3** |
| **5B (Hydration)** | 0 | 0 | 0 | **0** |
| **5C (AI Infra)** | 0 | 1 | 0 | **1** |
| **5D (Cycle)** | 0 | 0 | 0 | **0** |
| **5E (Telegram)** | 0 | 1 | 0 | **1** |
| **Cross-Phase** | 2 | 1 | 2 | **5** |
| **TOTAL** | **14** | **8** | **6** | **28** |

### Gap Distribution by Area

| Area | Critical | High | Medium |
|---|---|---|---|
| **Backend Routes (Missing/Mount)** | 10 | 2 | 0 |
| **Frontend Pages/Components** | 3 | 3 | 4 |
| **Auth/RBAC Integration** | 1 | 3 | 0 |
| **UI/UX Polish** | 0 | 0 | 2 |

### Top 5 Priority Fixes

| # | Gap | Score | Effort |
|---|---|---|---|
| 1 | GAP-001: Admin backend routes not mounted | CRITICAL | Large |
| 2 | GAP-002: No `/api/me/entitlements` endpoint | CRITICAL | Medium |
| 3 | GAP-003: Hardcoded admin check | CRITICAL | Small |
| 4 | GAP-004: No plan upgrade page | CRITICAL | Large |
| 5 | GAP-014: Route registration missing | CRITICAL | Medium |

---

## 5. Fokus Khusus: Admin Menu & Upgrade Plan

### Admin Menu — Status: **BROKEN**

```text
Frontend: AdminPage.tsx EXISTS with 13 tabs
Backend:  ZERO admin routes mounted
Result:   Semua tab admin akan gagal dengan 404/403

Root Cause:
1. worker/src/index.ts tidak meng-import atau mount routes-admin
2. Tidak ada file routes-admin.ts
3. Frontend hardcode admin check: email === 'admin@homesungai.com'
4. Tidak ada GET /api/admin/me untuk admin context
5. Tidak ada permission-based middleware untuk /api/admin/*
```

### Upgrade Plan — Status: **MISSING**

```text
Frontend: UpgradePrompt.tsx — hanya banner "Fitur ini tidak tersedia"
          Link ke /settings/profile — bukan halaman upgrade
          Tidak ada halaman /premium, /upgrade, atau /plans

Backend:  Tidak ada GET /api/me/entitlements
          Tidak ada GET /api/admin/plans (route tidak mounted)
          EntitlementService + QuotaService exist tapi tidak terhubung ke UI

Result:   User TIDAK BISA upgrade plan sama sekali.
          Free user yang kena entitlement block hanya bisa kembali ke dashboard.
```

---

## 6. What IS Working Correctly

| Area | Status |
|---|---|
| Auth (register, login, logout, me) | ✅ Working |
| Profile (onboarding, update, UI settings) | ✅ Working |
| Measurement (catalog, validate, submit, history, attachments) | ✅ Working |
| Dashboard Today (measurements, alerts, streak) | ✅ Working |
| AI Recommendation / Assistant (basic) | ✅ Working |
| Google OAuth (full flow: login, register, link, unlink) | ✅ Working |
| Education cards (query, acknowledge) | ✅ Working |
| Symptom log (CRUD, red flag detection, safety events) | ✅ Working |
| Hydration (settings, today, logs, history, dynamic target, overhydration) | ✅ Working |
| AI Memory (status, rebuild, delete, context query, context package, disclaimer) | ✅ Working |
| Cycle (eligibility, settings, calendar, logs, guardrail, privacy) | ✅ Working |
| Telegram (water webhook, callback validation, idempotency, cron reminder) | ✅ Working |
| RBAC Service (getUserRoles, getUserPermissions, hasPermission) | ✅ Working |
| Entitlement Service (getActivePlan, requireEntitlement, requireQuota, consumeQuota) | ✅ Working |
| Audit Service (write with secret sanitization) | ✅ Working |
| Config Service (list, update, secret masking) | ✅ Working |
| All shared type constants (roles, permissions, plans, features) | ✅ Defined |

---

*End of Audit Report*
