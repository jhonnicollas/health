# Stitch UI Parity Task Plan

Project: HL Health Companion  
Stitch source: `HL Health Master Layout`  
Stitch project ID: `projects/5854270015643176038`  
Objective: rebuild the local/frontend UI so it matches the Stitch project visually as closely as possible while preserving all existing business logic, hooks, state, API calls, medical safety rules, and production behavior.

---

## 1. Non-Negotiable Rules

1. Stitch is the visual source of truth.
2. Do not judge parity by tokens only. Layout, spacing, hierarchy, component structure, density, table/card design, navigation, empty states, and responsive behavior must match screen-by-screen.
3. Do not break existing React hooks, state, API calls, auth flow, rule engine flow, or medical safety behavior.
4. Edit existing files in-place unless a shared UI helper/component is explicitly needed and documented before creation.
5. Keep database/API behavior stable unless a UI parity task proves a missing endpoint is required.
6. Original medical images must not be stored. Manual override and rule-engine status remain mandatory.
7. A task is not done until visual screenshot comparison and functional validation pass for that route.

---

## 2. Required Source Files To Read Before Execution

Read these before the first implementation task:

```text
AGENTS.md
docs/TASKS.md
WORK_LOG.md
HANDOFF.md
docs/ARCHITECTURE.md
docs/api-contract.md
docs/schema.sql
docs/seed.sql
docs/design-system.md
docs/TEST_PLAN.md
docs/STITCH_UI_PARITY_TASK_PLAN.md
docs/STITCH_UI_PARITY_TEST_PLAN.md
```

Read these frontend folders before editing:

```text
web/src/App.tsx
web/src/App.css
web/src/pages/**
web/src/components/**
web/src/context/**
web/src/hooks/**
```

---

## 3. Stitch Screen Inventory

Use MCP Stitch as the source for all screen references.

| Stitch Screen Instance | Label / Inferred Screen | Local Route Target | Priority |
|---|---|---|---|
| `47a06482d6ff4a269f770a959bf29820` | Registrasi (Updated Sidebar) | `/auth/register`, `/register` | P0 |
| `5eec9b4ce4884c8aae16a904b1dac7c3` | Login (Updated Sidebar) | `/auth/login`, `/login` | P0 |
| `d2e4aaf355a24e4cb645ba6b960546f2` | Onboarding (Updated Sidebar) | `/onboarding` | P0 |
| `52b3e3e908414767976602862ea334a8` | Master Layout Shell | App shell for authenticated pages | P0 |
| `e28233a723ed48ed948e54172c3f516d` | Dashboard - HealthSync Pro | `/dashboard`, `/dashboard/week`, `/dashboard/month` | P0 |
| `531f69e8d8cc4734865fd4f825c828a4` | New Measurement - HealthSync Pro | `/measurements/new` | P0 |
| `591e9897af984758a61f1861daf0a291` | Measurement History & Raw Data Log | `/measurements/history` | P0 |
| `d3570e169aa94805a797f27ecde2d1ba` | Medication & Fasting Tracker | `/tracker`, `/medications`, `/fasting` | P0 |
| `3bba9bf8931a4d02a9e6f159811fe9ed` | Notifications & Alerts | `/alerts` | P0 |
| `c7a54284936b4292bb256cd2d35c4b56` | AI Assistant (Polished) | `/ai-assistant` | P0 |
| `2b657fcafc7645cd89b0c8d3e1e514e1` | Settings & Profile Management | `/settings/profile` | P0 |
| `b6c1a7b8ca6149b094e1b7a9343bf2b8` | Family & Caregiver Link (Polished) | `/family`, `/caregiver` | P0 |
| `6b745584fb9443a69ac42f2719e9c54b` | Senior Mode Interface | Senior shell and `/measurements/senior` | P0 |
| `d076d5ec0389499ab51b5363c26f1637` | Reports & Analytics | `/reports/daily`, `/reports/weekly`, `/reports/monthly`, `/reports/doctor` | P1 |
| `ecc21fbda8294dd5a826bede08e458ae` | Knowledge Base - HealthSync Pro | `/kb` | P1 |
| `ff3a1fdb50354aec9b3791c598b97aea` | Authentication & Onboarding Gateway | Auth/onboarding composite reference | P1 |
| `assets_af41815a79184df888dd6e8130d9013f` | Design system instance | Shared CSS/tokens | P0 |

If a visible Stitch screen has no label, inspect it before mapping. Do not guess.

---

## 4. Execution Protocol

For every task below:

1. Mark only that task as `[-] In Progress` in this file.
2. Append a Started entry to `WORK_LOG.md`.
3. Capture or inspect the exact Stitch target screen before editing.
4. Read the local route files and identify business logic to preserve.
5. Implement in-place UI parity.
6. Run route-specific visual tests from `docs/STITCH_UI_PARITY_TEST_PLAN.md`.
7. Run required functional validation.
8. Update docs if layout/API behavior changed.
9. Mark the task `[x] Done` only after parity and tests pass.
10. Append Completed entry to `WORK_LOG.md` and update `HANDOFF.md`.

---

## 5. Task Checklist

### Phase 0 - Baseline Capture And Parity Infrastructure

- [x] **STITCH-P0.1 Capture Stitch Baselines**
  - Capture baseline screenshots for all P0 Stitch screens at 1280x1024.
  - Capture responsive reference if Stitch includes mobile/tablet variants.
  - Store comparison notes in `docs/STITCH_UI_PARITY_TEST_PLAN.md` or a documented artifact path.
  - Acceptance:
    - Every P0 route has a named Stitch baseline.
    - No implementation starts before baselines exist.

- [x] **STITCH-P0.2 Capture Current Local Screens**
  - Run local frontend and capture current screenshots for all mapped P0 routes.
  - Record mismatch notes: shell, grid, typography, card structure, tables, buttons, chips, modals, empty states.
  - Acceptance:
    - Each route has a before screenshot and mismatch checklist.

- [-] **STITCH-P0.3 Build Shared Visual Foundation**
  - Align global shell, page canvas, sidebar, top/header region, gutters, card surfaces, buttons, chips, inputs, tables, and modal primitives to Stitch.
  - Edit `web/src/App.css` and existing shared JSX only.
  - Acceptance:
    - Shared foundation matches Stitch tokens and structure.
    - No route-specific business logic changed.

### Phase 1 - Core Shell And Dashboard

- [ ] **STITCH-P1.1 Rebuild App Shell To Stitch Master Layout**
  - Route/files:
    - `web/src/App.tsx`
    - `web/src/App.css`
  - Scope:
    - Sidebar dimensions, section grouping, active states, header/user block, content max width, responsive behavior.
  - Acceptance:
    - `/dashboard` shell visually matches Stitch master layout.
    - Normal navigation works.
    - Senior mode still switches to senior shell when enabled.

- [ ] **STITCH-P1.2 Rebuild Today Dashboard**
  - Route/files:
    - `/dashboard`
    - `web/src/pages/dashboard/TodayDashboard.tsx`
  - Scope:
    - KPI cards, vitals cards, status chips, empty states, recent measurement list.
  - Acceptance:
    - Stitch dashboard baseline match score passes test threshold.
    - Dashboard data still renders from production API.

- [ ] **STITCH-P1.3 Rebuild Weekly And Monthly Dashboards**
  - Route/files:
    - `/dashboard/week`
    - `/dashboard/month`
    - `web/src/pages/dashboard/WeeklyDashboard.tsx`
    - `web/src/pages/dashboard/MonthlyDashboard.tsx`
  - Scope:
    - Trend cards, chart containers, summary sections, empty states.
  - Acceptance:
    - Weekly/monthly routes match Stitch dashboard variant language.
    - Aggregated values still render.

### Phase 2 - Measurement Capture And History

- [ ] **STITCH-P2.1 Rebuild Measurement Selection And Dynamic Form**
  - Route/files:
    - `/measurements/new`
    - `web/src/pages/measurement/SelectMetricPage.tsx`
    - `web/src/components/measurement/DynamicMetricForm.tsx`
  - Scope:
    - Device groups, metric checklist, selected metric cards, AI extraction controls, manual override rows, submit block.
  - Acceptance:
    - Stitch measurement capture structure is followed.
    - Manual override remains explicit and editable.
    - Submit still writes rule-engine evaluated data.

- [ ] **STITCH-P2.2 Rebuild Measurement History And Evidence Modal**
  - Route/files:
    - `/measurements/history`
    - Current route implementation in `web/src/App.tsx` or existing page file if extracted by explicit task.
  - Scope:
    - Raw data table, filters, badges, evidence lightbox/modal, attachment actions.
  - Acceptance:
    - Matches `Measurement History & Raw Data Log` Stitch screen.
    - Evidence modal opens and closes.
    - Manual Override badge is visually identical to Stitch status language.

### Phase 3 - Tracker, Family, Alerts, Assistant

- [ ] **STITCH-P3.1 Rebuild Medication And Fasting Tracker**
  - Route/files:
    - `/tracker`
    - `/medications`
    - `/fasting`
    - `web/src/pages/medications/MedicationsPage.tsx`
    - `web/src/pages/fasting/FastingPage.tsx`
  - Scope:
    - Timer panel, schedule cards, add-medication form, Take/Skip states, adherence/status visuals.
  - Acceptance:
    - Matches `Medication & Fasting Tracker` Stitch screen.
    - Start/stop/cancel fasting works.
    - Take/Skip writes logs and updates visual state.

- [ ] **STITCH-P3.2 Rebuild Family And Caregiver Link**
  - Route/files:
    - `/family`
    - `/caregiver`
    - `web/src/pages/family/FamilyPage.tsx`
    - `web/src/pages/caregiver/CaregiverDashboardPage.tsx`
  - Scope:
    - Invitation suite, permission toggles, pending invites, revoke action, caregiver cards.
  - Acceptance:
    - Matches `Family & Caregiver Link` Stitch screen.
    - Pending invite appears immediately.
    - Revoke works.

- [ ] **STITCH-P3.3 Rebuild Notifications And Alerts**
  - Route/files:
    - `/alerts`
    - `web/src/pages/alerts/AlertsPage.tsx`
  - Scope:
    - Inbox layout, emergency filter, Telegram timeline, alert cards/table.
  - Acceptance:
    - Matches `Notifications & Alerts` Stitch screen.
    - Emergency filter does not break layout.
    - Telegram timeline renders from notification rows.

- [ ] **STITCH-P3.4 Rebuild AI Assistant**
  - Route/files:
    - `/ai-assistant`
    - Current route implementation in `web/src/App.tsx` or existing page file if extracted by explicit task.
  - Scope:
    - Health context banner, chat messages, prompt input, assistant response typography.
  - Acceptance:
    - Matches `AI Assistant - HL Health Companion` Stitch screen.
    - AI response remains safe and non-diagnostic.

### Phase 4 - Settings, Reports, Senior Mode

- [ ] **STITCH-P4.1 Rebuild Settings And Profile**
  - Route/files:
    - `/settings/profile`
    - `web/src/pages/settings/ProfileSettingsPage.tsx`
  - Scope:
    - Profile card, settings form, theme/accessibility controls, save state.
  - Acceptance:
    - Matches `Settings & Profile Management (Polished)` Stitch screen.
    - Accessibility mode update still persists.

- [ ] **STITCH-P4.2 Rebuild Reports And Analytics**
  - Route/files:
    - `/reports/daily`
    - `/reports/weekly`
    - `/reports/monthly`
    - `/reports/doctor`
    - `web/src/pages/reports/**`
  - Scope:
    - Analytics cards, report summaries, table/chart containers, export actions.
  - Acceptance:
    - Matches `Reports & Analytics` Stitch visual language.
    - Report generation and safe summary rules still pass.

- [ ] **STITCH-P4.3 Rebuild Senior Mode From Stitch-Compatible Shell**
  - Route/files:
    - `web/src/App.tsx`
    - `web/src/App.css`
    - senior measurement/emergency pages
  - Scope:
    - Senior navigation, large interaction zones, Darurat tab, SOS long-press, simplified dashboard.
  - Acceptance:
    - Senior mode is visually intentional and not a broken variant of normal shell.
    - Normal sidebar/top nav hidden.
    - Only the approved giant tabs appear.
    - SOS long-press works.

### Phase 5 - Final Integration And Production Gate

- [ ] **STITCH-P5.1 Full Visual Regression Pass**
  - Run every visual test in `docs/STITCH_UI_PARITY_TEST_PLAN.md`.
  - Acceptance:
    - Every P0 route passes screenshot comparison and manual design review.
    - Any deviation is documented and accepted by owner.

- [ ] **STITCH-P5.2 Full Functional Regression Pass**
  - Run lint, build, typecheck, worker tests, and all-sprint production-like E2E.
  - Acceptance:
    - No functional regression from the UI rebuild.

- [ ] **STITCH-P5.3 Production Deploy And UAT**
  - Deploy Worker if changed.
  - Deploy Pages from `web` directory so Functions proxy is included.
  - Run UAT on production URL.
  - Acceptance:
    - Production URL accessible.
    - No 404/500 asset or API proxy errors.
    - Full UI parity and functional report complete.

---

## 6. Definition Of Done

The Stitch UI parity project is complete only when all are true:

```text
All P0 Stitch screens mapped to local routes
All P0 local routes visually rebuilt from Stitch
No route judged only by token similarity
Screenshot comparison completed for desktop 1280x1024
Responsive checks completed for mobile/tablet
Functional E2E completed
Medical safety checks completed
Docs, WORK_LOG.md, and HANDOFF.md updated
Production deployed and UAT passed
Owner accepts visual parity
```

---

## 7. Immediate Next Task

Start with:

```text
STITCH-P0.1 Capture Stitch Baselines
```

Do not edit frontend code before this task is complete.
