# Enterprise Production Remediation Task Plan

Owner score after GAP-12: 20/1000. Current source is not production-worthy for SaaS sale. This plan is the execution source for the next remediation cycle.

## 0. Product Decisions

### 0.1 Measurement Storage Model

Use one normalized measurement model, not one table per device and not one wide table with many metric columns.

Keep:

```text
HL_measurementSessions = one capture event / one device reading event
HL_measurementValues   = one row per metric value inside that event
```

Reason:

```text
One device can emit multiple metrics in one reading.
Different devices have different metric sets.
Adding new metrics later should not require schema changes.
Dashboards/history/report queries stay consistent.
```

UI must group metrics by device/session, so users see one card for one physical reading:

```text
Yuwell YX106 Oximeter -> SpO2 + PR bpm in one card
OMRON HEM 7194T1 FL   -> SYS + DIA + Pulse in one card
Sinocare M101 GCU     -> selected mode value in one card
```

### 0.2 AI Value Editing Model

Do not show separate "Nilai AI (raw)" and "Final Value" textboxes.

Required UI:

```text
One editable textbox per metric.
If AI fills the textbox, show small metadata: AI filled, confidence, editable.
If user changes the value after AI fill, manualOverride becomes true.
```

Required storage for now:

```text
HL_measurementValues.finalValue = submitted value
HL_measurementValues.rawAiValue = optional audit value from AI, hidden from primary UI
HL_measurementValues.manualOverride = finalValue differs from rawAiValue
```

If owner insists "only one DB value", create a later migration to make `rawAiValue` nullable audit-only or move AI audit into `HL_aiExtractions.parsedJson`. Do not remove audit safety in the same pass as UI refactor.

### 0.3 Integer ID Migration

Owner request: all UUID table IDs become integer.

This is a database-breaking migration. It must be done with a migration plan, not ad hoc string edits.

Target:

```sql
id INTEGER PRIMARY KEY AUTOINCREMENT
```

Foreign keys must also become integer:

```text
userId, profileId, sessionId, medicationId, alertId, reportId, linkedUserId, ownerUserId, etc.
```

Compatibility rule:

```text
No mixed TEXT UUID FK -> INTEGER PK.
No partial migration.
No production migration without backup/export and rollback.
```

## 1. Execution Protocol

Follow `AGENTS.md`.

For every task:

```text
1. Mark exactly one task In Progress in docs/TASKS.md.
2. Append Started entry to WORK_LOG.md.
3. Read schema.sql before coding.
4. Implement only the current task.
5. Run validation: worker typecheck/test, web typecheck/lint/build, targeted E2E.
6. Update docs if schema/API/UI changed.
7. Mark task Done or Blocked.
8. Append Completed/Blocked entry to WORK_LOG.md.
9. Update HANDOFF.md.
```

## 2. Phase P0 - Production Blockers

### EP-P0.1 Fix Production Dashboard 500

Problem:

```text
GET https://hl-health-companion.pages.dev/api/dashboard/today returns 500.
```

Scope:

```text
worker/src/index.ts
web/functions/api/[[path]].ts
wrangler config
production D1 schema
```

Tasks:

- Reproduce against production URL.
- Capture response body and Worker logs.
- Verify production D1 has required columns used by `/api/dashboard/today`.
- Fix query/schema mismatch.
- Add regression test for dashboard today with empty data and real values.
- Deploy Worker + Pages.

Acceptance:

```text
/api/dashboard/today returns 200 in production.
Dashboard renders without red error state.
Empty account shows enterprise empty state.
Account with measurements shows latest grouped values.
```

Validation:

```text
cd worker && npx tsc -p tsconfig.json
cd worker && npm test
cd web && npx tsc -b
cd web && npm run lint
cd web && npm run build
Production browser check: /dashboard
```

### EP-P0.2 Secret/Config Readiness

Problem:

```text
All mutable app config must be DB-backed and editable in frontend.
Sensitive runtime secrets must be Worker secrets, not code.
```

Tasks:

- Inventory all hardcoded constants in worker/web.
- Move mutable constants to `HL_systemConfigs`.
- Ensure Settings admin panel can CRUD all config keys.
- Add missing seed rows for config keys.
- Ensure `ENCRYPTION_KEY`, Cloudflare token, and optional AI key are not exposed to frontend.

Acceptance:

```text
No mutable timeout/model/feature flag/token value hardcoded in app code.
Admin Settings shows all `HL_systemConfigs` rows.
Admin can create/update/delete safe config rows from frontend, with audit log.
Sensitive config inputs use masked input.
```

## 3. Phase P1 - Integer ID Database Migration

### EP-P1.1 ID/FK Inventory

Tasks:

- Generate full list of all tables with `id TEXT`, FK fields, indexes, and code references.
- Classify IDs:
  - internal primary key
  - public/share token hash
  - external stable code
  - config key/code that must stay TEXT
- Do not convert natural keys like `metricCode`, `deviceCode`, `configKey`, `badgeCode`, `slug`.

Deliverable:

```text
docs/INTEGER_ID_MIGRATION_PLAN.md
```

Acceptance:

```text
Every table ID/FK is listed.
Every non-converted TEXT key has explicit reason.
```

### EP-P1.2 Migration SQL Design

Tasks:

- Build `docs/migrations/INTEGER_IDS_V2.sql`.
- Use shadow table approach:
  - create new table with integer IDs
  - copy data with integer mapping tables
  - rebuild FKs/indexes
  - preserve createdAt/updatedAt
- Add rollback notes and backup command.

Acceptance:

```text
Migration runs on local/dev D1 copy.
All FK integrity checks pass.
No orphan rows.
All HL_ naming and camelCase fields preserved.
```

### EP-P1.3 Backend ID Refactor

Tasks:

- Replace `crypto.randomUUID()`/`createId()` for table IDs with DB autoincrement.
- Update insert flows to read `last_insert_rowid()` or D1 equivalent result metadata.
- Keep token/share/audit request IDs as string where they are not table PKs.
- Update TypeScript row types from `string` to `number` for integer IDs.

Acceptance:

```text
All table PK/FK reads and writes use numbers.
Auth/session tokens remain secure strings.
No API route crashes from string/number mismatch.
```

### EP-P1.4 Frontend ID Refactor

Tasks:

- Update TS types for IDs returned by API.
- Ensure route/action handlers accept integer IDs.
- Do not show raw integer IDs to users unless needed.

Acceptance:

```text
Measurement history, evidence, medications, alerts, family, reports all work with integer IDs.
```

## 4. Phase P2 - Measurement/New Device-First UX

### EP-P2.1 Compact Device Selection

Problem:

```text
Select Metrics wastes screen and forces duplicate checkboxes per physical device.
```

Tasks:

- Replace metric checklist with compact device/mode selector.
- Desktop: compact segmented cards or two-column device rail.
- Android/mobile: match `web/frontend_stitch/new-measurement.html` mobile layout.
- One click selects a device reading group.

Required groups:

```text
Yuwell YX106 Oximeter: spo2, heartRate
OMRON HEM 7194T1 FL: systolic, diastolic, bloodPressurePulse
Sinocare M101 GCU: choose one mode: glucoseFasting / glucosePostMeal / cholesterolTotal / uricAcid
Body Scale: bodyWeight (+ BMI auto)
Thermometer: bodyTemperature
Sleep: sleepDuration
Waist: waistCircumference
```

Acceptance:

```text
User never checks SpO2 and heartRate separately for Yuwell.
User never checks SYS/DIA/Pulse separately for OMRON.
Sinocare requires mode selection because the same device displays one selected test mode.
Selection panel uses compact enterprise styling.
```

### EP-P2.2 Device Reading Cards

Tasks:

- Build one card per selected device/group.
- Add attachment/capture area once per device card.
- Add one Auto-Read with AI button per device card.
- Add textboxes for all values visible on the physical device.

Required inputs:

```text
Yuwell:
- SpO2 (%)
- PR bpm

OMRON:
- SYS mmHg
- DIA mmHg
- Pulse /min

Sinocare:
- selected mode value mg/dL

Body scale:
- Weight kg
- BMI auto display if height exists

Thermometer:
- Temperature C

Sleep:
- Sleep duration hours
```

Acceptance:

```text
Textbox labels match device display labels where useful: SYS, DIA, PULSE, SpO2, PR bpm.
AI fills the same textbox user edits.
Manual override is derived silently.
No separate visible "Nilai AI raw" field.
Submit sends one value per metric to DB.
```

### EP-P2.3 AI Extraction Mapping Per Device

Tasks:

- AI extraction request sends deviceCode and metric group.
- Yuwell extracts both SpO2 and PR in one call.
- OMRON extracts SYS, DIA, Pulse in one call.
- Sinocare extracts only selected mode.
- Result maps into existing visible textboxes.

Acceptance:

```text
One AI call per device reading card.
No duplicate AI calls for each metric inside one device.
Timeout fallback leaves all textboxes editable.
```

### EP-P2.4 Submit Payload and DB Save

Tasks:

- Submit all values from one device session as one `HL_measurementSessions` row and multiple `HL_measurementValues` rows.
- Store attachment once and link it to relevant metric/device according to current attachment design.
- Ensure BMI auto row is created only when bodyWeight + height exist.

Acceptance:

```text
Yuwell submit creates 1 session + 2 values.
OMRON submit creates 1 session + 3 values.
Sinocare submit creates 1 session + 1 selected value.
Dashboard/history/report read values correctly.
```

## 5. Phase P3 - Enterprise UI Shell

### EP-P3.1 Full-Width Page Layout

Problem:

```text
Pages feel narrow and not enterprise SaaS-ready.
```

Tasks:

- Review global shell width constraints.
- Use full available workspace with max-width only where readability requires it.
- Dashboard/report/table pages use wider responsive grids.
- Settings/profile forms use readable width, but config tables use full width.

Acceptance:

```text
Laptop layout uses available horizontal space.
Mobile layout remains single-column and touch-friendly.
No card-in-card clutter.
No horizontal overflow.
```

### EP-P3.2 Collapsible Sidebar

Tasks:

- Add sidebar collapse toggle.
- Persist preference in `HL_userProfiles` or `HL_systemConfigs`/local user config if schema supports it.
- Collapsed mode shows icons with tooltips.
- Topbar and content margin update correctly.

Acceptance:

```text
Desktop sidebar can collapse/expand.
Icons remain clickable.
Active route state remains visible.
No layout jump bug.
```

### EP-P3.3 Clickable Topbar Profile and Icons

Problems:

```text
topbar-user-avatar not clickable.
material-symbols-outlined appears non-interactive.
logout broken or hidden.
```

Tasks:

- Convert avatar into menu button.
- Add profile/settings/logout dropdown.
- Ensure notification/book/help icons are buttons or links with accessible labels.
- Wire logout to `/api/auth/logout`, clear auth context, redirect login.

Acceptance:

```text
Avatar click opens menu.
Logout works reliably.
All interactive icons have button/link semantics, hover/focus state, and aria-label.
```

### EP-P3.4 Android vs Laptop Layout

Tasks:

- Match mobile layout behavior from `web/frontend_stitch/new-measurement.html`.
- Android:
  - mobile topbar
  - bottom nav
  - floating AI button
  - single-column reading cards
  - large tap targets
- Laptop:
  - sidebar/topbar
  - wider two-column card layout
  - denser device selector

Acceptance:

```text
Playwright screenshots at 390x844 and 1440x900 are intentionally different and match Stitch intent.
```

### EP-P3.5 Enterprise Input System

Tasks:

- Replace basic browser inputs with clinical enterprise input styling.
- Numeric measurement inputs should resemble instrument readouts:
  - large blue value
  - unit label
  - stable dimensions
  - focus ring
  - optional stepper controls where useful
- Apply consistently to measurement, settings, auth, medication, emergency, fasting.

Acceptance:

```text
Inputs visually match `web/frontend_stitch/` references.
Text never overflows.
Touch target >= 44px mobile.
```

## 6. Phase P4 - History, KB, Settings, Auth Polish

### EP-P4.1 Measurement History Date Format

Tasks:

- Format Date & Time as Indonesian readable datetime:

```text
17 Juni 2026 18:23:45
```

- Use user timezone from profile.
- Apply to history, reports, alerts, medication logs where relevant.

Acceptance:

```text
No raw ISO date shown in user-facing tables.
```

### EP-P4.2 Knowledge Base Workflow Redesign

Tasks:

- KB must answer:
  - tujuan pengukuran
  - kapan mulai
  - alat yang dipakai
  - cara posisi alat
  - cara foto
  - cara baca hasil
  - kapan ulangi pengukuran
  - kapan hubungi tenaga medis
- Add device workflow cards for Yuwell, OMRON, Sinocare, thermometer, body scale.
- Link KB article from measurement card help action.

Acceptance:

```text
KB is a guided workflow, not just article text.
Each device has clear start-to-submit flow.
```

### EP-P4.3 Settings Full Configuration Center

Tasks:

- Settings must show:
  - profile
  - UI/accessibility
  - notification settings
  - Telegram settings
  - reminder settings
  - AI configs
  - upload limits
  - rate limits
  - feature flags
  - privacy/delete/export
  - admin system config CRUD
- Non-admin sees only user-safe settings.
- Admin sees full config CRUD and audit history.

Acceptance:

```text
All mutable app configs are visible/editable from frontend for admin.
No hidden hardcoded operational setting remains.
```

### EP-P4.4 Auth/Register Form Enterprise Polish

Tasks:

- Review login/register/onboarding.
- Add proper field grouping, validation messages, password visibility toggle, loading state.
- Ensure onboarding gate cannot be bypassed.

Acceptance:

```text
Register -> onboarding -> dashboard flow works and feels production SaaS-ready.
```

## 7. Phase P5 - PRD Feature Completeness Audit

### EP-P5.1 PRD Traceability Matrix

Tasks:

- Create matrix from `docs/PRD.docx.md`:

```text
PRD section -> source files -> endpoint -> DB table -> UI route -> test evidence -> status
```

Deliverable:

```text
docs/PRD_TRACEABILITY_MATRIX.md
```

Acceptance:

```text
Every PRD feature is mapped.
No "done" without source and test evidence.
```

### EP-P5.2 Feature Gap Closure

Tasks:

- Execute missing PRD features found by traceability matrix.
- Prioritize P0:
  - measurement capture
  - manual input fallback
  - dashboard
  - emergency consent
  - config management
  - SaaS auth/onboarding
  - reports/export

Acceptance:

```text
All PRD P0/P1 features usable through UI.
```

### EP-P5.3 Enterprise Visual QA

Tasks:

- Screenshot compare against `web/frontend_stitch/` for:
  - dashboard
  - new measurement
  - history
  - settings
  - kb
  - auth
  - reports
  - mobile Android viewport
  - laptop viewport
- Fix visual gaps route-by-route.

Acceptance:

```text
Owner score target >= 850/1000.
No known page remains "prototype-looking".
```

## 8. Phase P6 - Production Deployment and UAT

### EP-P6.1 Full Regression

Commands:

```bash
cd worker && npx tsc -p tsconfig.json
cd worker && npm test
cd web && npx tsc -b
cd web && npm run lint
cd web && npm run build
```

E2E:

```text
register
onboarding
new measurement per device
AI extraction fallback
manual edit
submit
dashboard today/weekly/monthly
history evidence
KB workflow
settings config CRUD
logout
emergency contact consent
medication tracker
reports/export
mobile Android viewport
laptop viewport
```

### EP-P6.2 Production Deploy

Tasks:

- Backup D1 before integer ID migration.
- Apply migration.
- Deploy Worker.
- Deploy Pages.
- Verify production URL.
- Run UAT on production.

Acceptance:

```text
No 500 on core routes.
No broken assets.
No console error on primary user flows.
Production E2E passes.
```

## 9. Immediate Next Tasks

Start in this strict order:

```text
1. EP-P0.1 Fix Production Dashboard 500
2. EP-P1.1 ID/FK Inventory
3. EP-P1.2 Migration SQL Design
4. EP-P2.1 Compact Device Selection
5. EP-P2.2 Device Reading Cards
6. EP-P2.3 AI Extraction Mapping Per Device
7. EP-P2.4 Submit Payload and DB Save
8. EP-P3.1 Full-Width Page Layout
9. EP-P3.2 Collapsible Sidebar
10. EP-P3.3 Clickable Topbar Profile and Icons
```

Do not start visual polish before dashboard 500 and measurement device flow are fixed.

