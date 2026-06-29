# Sprint 5 Fresh Gap Audit — v4 (June 2026)

```text
Audit Date: 2026-06-27
Scope: Full source code vs PRD User Stories + Task Plan Sprint 5
Method: Manual comparison of all worker routes, frontend pages, services, and navigation
Excludes: WORK_LOG.md / HANDOFF.md (not read per user instruction)
```

---

## Scoring Legend

| Severity | Score | Meaning |
|---|---|---|
| 🔴 CRITICAL | 25 | Feature absent or completely broken — blocks release |
| 🟠 HIGH | 15 | Feature partially implemented, user-facing defect |
| 🟡 MEDIUM | 10 | Missing polish, missing endpoint, incomplete UI |
| 🔵 LOW | 5 | Minor inconsistency, cosmetic |

---

## GAP LIST

### GAP-001 🔴 CRITICAL — Admin tidak punya layout/admin shell terpisah
**Source:** TASK S5F-015, PRD §6 UI/UX #2
**Evidence:** AdminPage.tsx render di dalam `settings-panel` class yang sama dengan halaman user biasa. PRD menyatakan "Admin area memakai layout terpisah dari dashboard user." Tidak ada admin sidebar, admin topbar, atau admin-specific shell component.
**Score:** 25

### GAP-002 🔴 CRITICAL — PremiumUpgradePage panggil endpoint admin dari user context
**Source:** TASK S5F-009 (GET /api/admin/plans requires admin.billing.read)
**Evidence:** `PremiumUpgradePage.tsx` line ~50: `fetch('/api/admin/plans', ...)` dan `fetch('/api/admin/plans/${p.planCode}/features', ...)`. User biasa tidak punya permission `admin.billing.read` → halaman upgrade selalu gagal untuk user non-admin. Butuh endpoint publik `/api/plans` atau `/api/me/plans` tanpa admin guard.
**Score:** 25

### GAP-003 🔴 CRITICAL — UpgradePrompt arahkan ke /settings/profile, bukan /premium/upgrade
**Source:** PRD §5F-FR-004, US-5F-004
**Evidence:** `UpgradePrompt.tsx` line ~14: `onClick={() => onNavigate('/settings/profile')}` — saat user kena block fitur premium, CTA "Lihat Plan & Upgrade" mengarah ke halaman Profile Settings, bukan ke halaman PremiumUpgradePage (`/premium/upgrade`).
**Score:** 25

### GAP-004 🔴 CRITICAL — Endpoint admin AI memory status/rebuild per user tidak ada
**Source:** TASK S5C-011
**Evidence:** `AdminPage.tsx` AiMemoryTab memanggil `GET /api/admin/users/:userId/ai-memory/status` dan `POST /api/admin/users/:userId/ai-memory/rebuild`. Kedua endpoint ini TIDAK terdaftar di `routes-admin.ts`. Akan selalu 404.
**Score:** 25

### GAP-005 🔴 CRITICAL — Endpoint /api/admin/ai-clinical-copilot/readiness tidak ada
**Source:** TASK S5C-011
**Evidence:** `AdminPage.tsx` AiMemoryTab memanggil `GET /api/admin/ai-clinical-copilot/readiness`. Tidak terdaftar di `routes-admin.ts`.
**Score:** 25

### GAP-006 🟠 HIGH — Halaman admin hanya tabel read-only, tidak ada form CRUD
**Source:** TASK S5F-016 (admin-pages), PRD §11 UI/UX #3
**Evidence:** `AdminPage.tsx` mayoritas tab menggunakan `GenericListTab` — hanya menampilkan data dalam tabel. Tidak ada:
- Form create/edit untuk Users (assign role, update status)
- Form create/edit untuk Roles & Permissions (assign permission ke role)
- Form create/edit untuk Plans & Features (tambah/hapus feature per plan)
- Form untuk create Subscription manual
- Form edit untuk Metric Rules, Knowledge Articles, Education Cards
**Score:** 15

### GAP-007 🟠 HIGH — Tidak ada Google OAuth di frontend login/register
**Source:** TASK S5A-003, PRD US-5A-001
**Evidence:** Tidak ada tombol "Lanjutkan dengan Google" di `LoginPage.tsx` maupun `RegisterPage.tsx`. Tidak ada referensi ke Google OAuth flow di frontend sama sekali. Backend OAuth service mungkin sudah ada (oauth.ts) tapi UI tidak tersedia.
**Score:** 15

### GAP-008 🟠 HIGH — Tidak ada endpoint /api/dashboard/daily-health
**Source:** TASK S5A-006
**Evidence:** Endpoint yang ada adalah `/api/dashboard/today` (Sprint 1-4 existing). Task Plan mensyaratkan endpoint terpisah `GET /api/dashboard/daily-health` untuk Daily Health Hub. Frontend `DailyHealthHubPage.tsx` mungkin memang menggunakan `/api/dashboard/today`, tapi kontrak API tidak match.
**Score:** 15

### GAP-009 🟠 HIGH — Tidak ada endpoint /api/history/timeline (mixed timeline)
**Source:** TASK S5X-005, PRD US-5A-011
**Evidence:** Endpoint existing hanya `/api/measurements/history` (hanya measurement). PRD mensyaratkan timeline yang menggabungkan measurement + symptom + hydration + safety event + cycle + medication + fasting. Tidak ada endpoint yang melakukan union query ini.
**Score:** 15

### GAP-010 🟠 HIGH — Billing webhook hardcode planCode = 'premiumMonthly'
**Source:** TASK S5F-012
**Evidence:** `routes-admin.ts` billing webhook line: `INSERT INTO HL_subscriptions ... VALUES (?, 'premiumMonthly', 'active', ...)`. Jika webhook dikirim dengan planCode lain (quarterly, yearly, family), tetap dibuat sebagai premiumMonthly. PlanCode harus diambil dari body webhook.
**Score:** 15

### GAP-011 🟡 MEDIUM — Tidak ada /api/cycle/access endpoint untuk eligibility check
**Source:** TASK S5D-001, API Contract
**Evidence:** `GET /api/cycle/access` tidak terdaftar di `routes-cycle.ts` atau di manapun. Frontend CyclePage mungkin langsung cek dari profile data, tapi endpoint API contract tidak tersedia.
**Score:** 10

### GAP-012 🟡 MEDIUM — Tidak ada /api/cycle/guardrails/acknowledge
**Source:** TASK S5D-005
**Evidence:** `POST /api/cycle/guardrails/acknowledge` diperlukan untuk mencatat bahwa user sudah acknowledge contraception guardrail. Tidak ada di routes.
**Score:** 10

### GAP-013 🟡 MEDIUM — Tidak ada /api/education/cards dan acknowledge (user-facing)
**Source:** TASK S5A-004, API Contract
**Evidence:** `GET /api/education/cards` dan `POST /api/education/cards/:topicType/:topicCode/acknowledge` untuk user biasa tidak ada di routes. EducationService mungkin sudah ada tapi tidak di-mount sebagai route publik.
**Score:** 10

### GAP-014 🟡 MEDIUM — Tidak ada /api/ai/context/query
**Source:** TASK S5C-005
**Evidence:** `POST /api/ai/context/query` untuk Vectorize context retrieval tidak ada di routes-ai.ts maupun routes-admin.ts.
**Score:** 10

### GAP-015 🟡 MEDIUM — Tidak ada user-facing /api/ai/memory (status/rebuild/delete)
**Source:** TASK S5C-006
**Evidence:** `GET /api/ai/memory/status`, `POST /api/ai/memory/rebuild`, `DELETE /api/ai/memory` — endpoint user-facing untuk AI memory management tidak ada. Hanya ada admin versions (yang juga tidak lengkap — lihat GAP-004).
**Score:** 10

### GAP-016 🟡 MEDIUM — Tidak ada /api/symptoms/:symptomLogId (detail)
**Source:** TASK S5A-012, API Contract
**Evidence:** `GET /api/symptoms/:symptomLogId` untuk detail symptom log tidak ada. Hanya ada `/api/symptoms/history`.
**Score:** 10

### GAP-017 🟡 MEDIUM — Tidak ada /api/symptoms/prompt-dismissals
**Source:** TASK S5A-008
**Evidence:** `POST /api/symptoms/prompt-dismissals` untuk mencatat user men-dismiss symptom prompt setelah measurement abnormal.
**Score:** 10

### GAP-018 🟡 MEDIUM — Tidak ada /api/internal/cron/hydration-reminders
**Source:** TASK S5E-005
**Evidence:** Cron endpoint untuk mengirim hydration reminder via Telegram tidak ada di routes.
**Score:** 10

### GAP-019 🟡 MEDIUM — Tidak ada /api/ai/report-analysis endpoint
**Source:** TASK S5C-007, API Contract
**Evidence:** Hanya ada `/api/ai/recommendation`. Task Plan mensyaratkan endpoint terpisah `POST /api/ai/report-analysis`.
**Score:** 10

### GAP-020 🔵 LOW — AdminPage user detail tidak menampilkan roles/plan/subscription
**Source:** PRD S5F-007, S5F-009
**Evidence:** AdminPage UsersTab hanya menampilkan kolom ID, Email, Status. Seharusnya menampilkan role, plan, dan subscription status sesuai API response dari `GET /api/admin/users` yang sudah mengembalikan data roles dan planCode.
**Score:** 5

### GAP-021 🔵 LOW — Admin plans tab tidak menampilkan features per plan
**Source:** PRD §11 UI/UX #3
**Evidence:** PlansTab hanya menampilkan Code, Name, Interval, Active. Tidak menampilkan daftar fitur yang enabled/disabled per plan.
**Score:** 5

### GAP-022 🔵 LOW — Family permissions endpoints tidak ada
**Source:** TASK S5D-008, API Contract
**Evidence:** `GET /api/family-links/:familyLinkId/permissions/cycle` dan `PUT /api/family-links/:familyLinkId/permissions/sensitive-health` tidak ditemukan.
**Score:** 5

---

## SUMMARY

| Severity | Count | Total Score |
|---|---|---|
| 🔴 CRITICAL | 5 | 125 |
| 🟠 HIGH | 5 | 75 |
| 🟡 MEDIUM | 9 | 90 |
| 🔵 LOW | 3 | 15 |
| **TOTAL** | **22 gaps** | **305** |

---

## Top Priority Fixes (User's Specific Concerns)

### 1. Admin Menu/Separate Shell (GAP-001, GAP-006, GAP-004, GAP-005)
- AdminPage sudah ada dengan 13 tab dan adminOnly flag ✅
- TAPI: layout masih sama dengan user shell (no separate admin layout)
- TAPI: tab hanya read-only, tidak ada form CRUD
- TAPI: 2 endpoint (ai-memory admin, readiness) yang dipanggil frontend tidak ada di backend

### 2. Upgrade Plan Flow (GAP-002, GAP-003)
- PremiumUpgradePage sudah dibuat ✅
- TAPI: panggil endpoint admin `/api/admin/plans` → user biasa dapat 403
- TAPI: UpgradePrompt CTA mengarah ke `/settings/profile` bukan `/premium/upgrade`
- BUTUH: endpoint publik `/api/me/plans` atau `/api/plans` tanpa admin guard, dan `/api/me/subscribe` untuk self-service upgrade

---

## What Is Already Working ✅

| Area | Status |
|---|---|
| RBAC service (rbac.ts) | ✅ |
| Entitlement/Quota service | ✅ |
| Audit service | ✅ |
| Config service (secret-safe) | ✅ |
| Auth (login, register, logout, session) | ✅ |
| Measurement (submit, validate, history) | ✅ |
| Hydration (target, logs, history, settings) | ✅ |
| Cycle (calendar, logs, settings, eligibility guard) | ✅ |
| AI Assistant (with entitlement guard + clinicalCopilotMode rejection) | ✅ |
| AI Recommendation | ✅ |
| AI Memory service | ✅ |
| Symptom service + red flag detector | ✅ |
| Telegram webhook + callback | ✅ |
| OAuth service (backend) | ✅ |
| Education service | ✅ |
| Admin backend routes (28+ endpoints) | ✅ |
| Admin frontend (read-only 13 tabs) | ✅ |
| Premium upgrade page (UI only) | ✅ |
| Navigation gating by entitlement | ✅ |
| Upgrade prompt for blocked features | ✅ |
| useEntitlements hook (fail-closed) | ✅ |
