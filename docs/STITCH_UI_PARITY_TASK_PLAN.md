# Stitch UI Parity Task Plan

Project: HL Health Companion  
Stitch source: `web/frontend_stitch/` (local HTML export)  
Objective: rebuild the local/frontend UI so it matches the Stitch HTML screens pixel-for-pixel while preserving all existing business logic, hooks, state, API calls, medical safety rules, and production behavior.

---

## 1. Non-Negotiable Rules

1. Stitch HTML in `web/frontend_stitch/` is the visual source of truth.
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
docs/design-system.md
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

Read Stitch reference files before each screen task:

```text
web/frontend_stitch/DESIGN.md                          # Design tokens, colors, typography, spacing
web/frontend_stitch/{screen-name}.html                  # Stitch reference HTML
web/frontend_stitch/{screen-name}.png                   # Stitch reference screenshot
```

---

## 3. Stitch Screen Inventory

All Stitch reference screens are available locally in `web/frontend_stitch/`.

| # | Stitch File (HTML) | Stitch Screenshot (PNG) | Label / Inferred Screen | Local Route Target | Priority |
|---|---|---|---|---|---|
| 1 | `register.html` | `register.png` | Registrasi (Updated Sidebar) | `/auth/register`, `/register` | P0 |
| 2 | `login.html` | `login.png` | Login (Updated Sidebar) | `/auth/login`, `/login` | P0 |
| 3 | `onboarding.html` | `onboarding.png` | Onboarding (Updated Sidebar) | `/onboarding` | P0 |
| 4 | `master-layout.html` | `master-layout.png` | Master Layout Shell | App shell for authenticated pages | P0 |
| 5 | `dashboard.html` | `dashboard.png` | Dashboard - HealthSync Pro | `/dashboard`, `/dashboard/week`, `/dashboard/month` | P0 |
| 6 | `new-measurement.html` | `new-measurement.png` | New Measurement - HealthSync Pro | `/measurements/new` | P0 |
| 7 | `measurement-history.html` | `measurement-history.png` | Measurement History & Raw Data Log | `/measurements/history` | P0 |
| 8 | `medication-fasting-tracker.html` | `medication-fasting-tracker.png` | Medication & Fasting Tracker | `/tracker`, `/medications`, `/fasting` | P0 |
| 9 | `notifications-alerts.html` | `notifications-alerts.png` | Notifications & Alerts | `/alerts` | P0 |
| 10 | `ai-assistant.html` | `ai-assistant.png` | AI Assistant (Polished) | `/ai-assistant` | P0 |
| 11 | `settings-profile.html` | `settings-profile.png` | Settings & Profile Management | `/settings/profile` | P0 |
| 12 | `family-caregiver.html` | `family-caregiver.png` | Family & Caregiver Link (Polished) | `/family`, `/caregiver` | P0 |
| 13 | `senior-mode.html` | `senior-mode.png` | Senior Mode Interface | Senior shell and `/measurements/senior` | P0 |
| 14 | `reports-analytics.html` | `reports-analytics.png` | Reports & Analytics | `/reports/daily`, `/reports/weekly`, `/reports/monthly`, `/reports/doctor` | P1 |
| 15 | `knowledge-base.html` | `knowledge-base.png` | Knowledge Base - HealthSync Pro | `/kb` | P1 |
| 16 | `auth-gateway.html` | `auth-gateway.png` | Authentication & Onboarding Gateway | Auth/onboarding composite reference | P1 |

---

## 4. Key Design Tokens (from DESIGN.md)

These tokens are the EXACT values the Stitch HTML uses. Every CSS value in the implementation must match these.

### Colors

```text
Token                    HEX         Tailwind Equivalent       Use
───────────────────────  ──────────  ───────────────────────  ──────────────────────
primary                  #004bca    blue-700 / blue-800       Main action color
primary-container       #0061ff    blue-600                   Elevated/selected
on-primary               #ffffff    white                     Text on primary
on-primary-container    #f1f2ff    blue-50                    Text on primary container
surface                  #f7f9fb    slate-50                  Page background
surface-dim              #d8dadc    slate-300                 Dimmed surface
surface-bright          #f7f9fb    slate-50                  Bright surface
surface-container-low   #f2f4f6    slate-100                 Sidebar, card bg
surface-container       #eceef0    slate-200                 Containers
surface-container-high  #e6e8ea    slate-200/300             Higher elevation
surface-container-hi    #e0e3e5    slate-300                 Highest elevation
on-surface               #191c1e    gray-900                  Primary text
on-surface-variant      #424656    gray-700                  Secondary text
inverse-surface         #2d3133    gray-800                  Dark sidebar bg
inverse-on-surface      #eff1f3    slate-50                  Text on dark bg
outline                  #737687    gray-500                  Borders
outline-variant          #c2c6d9    gray-300/400              Subtle borders
error                    #ba1a1a    red-700                   Error/danger
on-error                 #ffffff    white                     Text on error
error-container          #ffdad6    red-100                   Error bg
on-error-container      #93000a    red-900                   Text on error bg
background               #f7f9fb    slate-50                  Same as surface
```

### Typography

```text
Role          Family    Size    Weight    Line H    Letter-Spacing
────────────  ───────  ──────  ────────  ────────  ───────────────
headline-xl   Inter     36px    700       44px      -0.02em
headline-lg   Inter     28px    600       36px      -0.01em
headline-md   Inter     20px    600       28px      none
body-lg       Inter     18px    400       28px      none
body-md       Inter     16px    400       24px      none
body-sm       Inter     14px    400       20px      none
label-md      Inter     14px    600       20px      0.05em
label-sm      Inter     12px    500       16px      none
```

### Spacing & Layout

```text
Token                 Value
────────────────────  ──────
Base unit             4px
Container max-width   1440px
Gutter                24px
Margin desktop        32px
Margin tablet         24px
Margin mobile         16px
Sidebar width         280px
```

### Border Radius

```text
Token    Value      Used On
───────  ────────  ─────────────────────────
sm       0.125rem  (2px) — minimal
DEFAULT  0.25rem   (4px) — buttons, inputs
md       0.375rem  (6px) — small cards
lg       0.5rem    (8px) — cards, containers
xl       0.75rem   (12px) — modals, major sections
full     9999px    — pill/chips, tags
```

### Elevation

```text
Level  Element          Box-Shadow
─────  ───────────────  ──────────────────────────────────────────────
0      Background       none
1      Cards/Surface    0px 4px 6px -1px rgba(0,0,0,0.05)
2      Dropdowns/Modal  0px 10px 15px -3px rgba(0,0,0,0.1)
```

---

## 5. Execution Protocol

For every task below:

1. Mark only that task as `[-] In Progress` in this file.
2. Append a Started entry to `WORK_LOG.md`.
3. Open the Stitch reference HTML in `web/frontend_stitch/{screen-name}.html` side-by-side with the local route (browser + code).
4. Also open the Stitch screenshot `web/frontend_stitch/{screen-name}.png` for quick visual reference.
5. Read the local route files and identify business logic to preserve.
6. Implement in-place UI parity.
7. Run route-specific visual tests from `docs/STITCH_UI_PARITY_TEST_PLAN.md`.
8. Run required functional validation.
9. Update docs if layout/API behavior changed.
10. Mark the task `[x] Done` only after parity and tests pass.
11. Append Completed entry to `WORK_LOG.md` and update `HANDOFF.md`.

---

## 6. Task Checklist

### Phase 0 - Baseline Capture And Parity Infrastructure

- [x] **STITCH-P0.1 Capture Stitch Baselines**
  - Stitch HTML + screenshots exported to `web/frontend_stitch/`.
  - Every P0 screen has a named `.html` and `.png` file.

- [x] **STITCH-P0.2 Capture Current Local Screens**
  - Local screenshots captured at `C:\temp\stitch-parity-current\`.
  - Manifest: `C:\temp\stitch-parity-current\manifest.json`.

- [-] **STITCH-P0.3 Build Shared Visual Foundation**
  - Align global shell, page canvas, sidebar, top/header region, gutters, card surfaces, buttons, chips, inputs, tables, and modal primitives to Stitch.
  - Edit `web/src/App.css` and existing shared JSX only.
  - Use DESIGN.md tokens as the single source of truth for colors, typography, spacing, and elevation.
  - Acceptance:
    - Shared foundation matches Stitch tokens and structure.
    - No route-specific business logic changed.

### Phase 1 - Core Shell And Dashboard

- [ ] **STITCH-P1.1 Rebuild App Shell To Stitch Master Layout**
  - Reference: `web/frontend_stitch/master-layout.html`, `web/frontend_stitch/master-layout.png`
  - Route/files:
    - `web/src/App.tsx`
    - `web/src/App.css`
  - Scope:
    - Sidebar dimensions (280px), section grouping, active states (blue left border), header/user block, content max width (1440px), responsive behavior.
  - Acceptance:
    - `/dashboard` shell visually matches Stitch master layout.
    - Normal navigation works.
    - Senior mode still switches to senior shell when enabled.

- [ ] **STITCH-P1.2 Rebuild Today Dashboard**
  - Reference: `web/frontend_stitch/dashboard.html`, `web/frontend_stitch/dashboard.png`
  - Route/files:
    - `/dashboard`
    - `web/src/pages/dashboard/TodayDashboard.tsx`
  - Scope:
    - KPI cards, vitals cards, status chips, empty states, recent measurement list.
  - Acceptance:
    - Stitch dashboard baseline match score passes test threshold.
    - Dashboard data still renders from production API.

- [ ] **STITCH-P1.3 Rebuild Weekly And Monthly Dashboards**
  - Reference: use `web/frontend_stitch/dashboard.html` (same base, different active tab).
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
  - Reference: `web/frontend_stitch/new-measurement.html`, `web/frontend_stitch/new-measurement.png`
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
  - Reference: `web/frontend_stitch/measurement-history.html`, `web/frontend_stitch/measurement-history.png`
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
  - Reference: `web/frontend_stitch/medication-fasting-tracker.html`, `web/frontend_stitch/medication-fasting-tracker.png`
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
  - Reference: `web/frontend_stitch/family-caregiver.html`, `web/frontend_stitch/family-caregiver.png`
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
  - Reference: `web/frontend_stitch/notifications-alerts.html`, `web/frontend_stitch/notifications-alerts.png`
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
  - Reference: `web/frontend_stitch/ai-assistant.html`, `web/frontend_stitch/ai-assistant.png`
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
  - Reference: `web/frontend_stitch/settings-profile.html`, `web/frontend_stitch/settings-profile.png`
  - Route/files:
    - `/settings/profile`
    - `web/src/pages/settings/ProfileSettingsPage.tsx`
  - Scope:
    - Profile card, settings form, theme/accessibility controls, save state.
  - Acceptance:
    - Matches `Settings & Profile Management (Polished)` Stitch screen.
    - Accessibility mode update still persists.

- [ ] **STITCH-P4.2 Rebuild Reports And Analytics**
  - Reference: `web/frontend_stitch/reports-analytics.html`, `web/frontend_stitch/reports-analytics.png`
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
  - Reference: `web/frontend_stitch/senior-mode.html`, `web/frontend_stitch/senior-mode.png`
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

## 7. Definition Of Done

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

## 8. Immediate Next Task

Start with:

```text
STITCH-P0.3 Build Shared Visual Foundation
```

Open `web/frontend_stitch/DESIGN.md` for all color, typography, spacing, and elevation token values.

Do not edit frontend business-logic code before the shared foundation is aligned.
