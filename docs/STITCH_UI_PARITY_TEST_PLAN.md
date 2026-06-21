# Stitch UI Parity Test Plan

Project: HL Health Companion  
Stitch source: `HL Health Master Layout`  
Stitch project ID: `projects/5854270015643176038`  
Goal: verify that the implemented frontend UI matches the Stitch project screen-by-screen, without breaking Sprint 1-4 product functionality.

---

## 1. Test Principle

This test plan exists because functional E2E passing is not enough.

```text
Functional pass != Stitch parity
Token match != Stitch parity
Similar color != Stitch parity
Actual screenshot comparison + manual design review = required parity evidence
```

Every P0 route must pass both:

1. Visual parity test against Stitch.
2. Functional regression test against the real app behavior.

---

## 2. Required Test Environment

### Local

```bash
npm --prefix worker run build
npm --prefix worker test
npm --prefix web run lint
npm --prefix web run build
```

Run local preview or dev server:

```bash
npm --prefix web run dev
```

### Production

Pages must be deployed from the `web` directory so `web/functions` is included:

```bash
npx wrangler pages deploy dist --cwd web --project-name hl-health-companion --commit-dirty=true
```

If Worker changed:

```bash
npx wrangler deploy
```

---

## 3. Baseline Capture Requirements

Before implementation, capture a baseline for every P0 Stitch screen.

| Baseline ID | Stitch Screen Instance | Local Route | Required |
|---|---|---|---|
| `baseline-register` | `47a06482d6ff4a269f770a959bf29820` | `/auth/register`, `/register` | Yes |
| `baseline-login` | `5eec9b4ce4884c8aae16a904b1dac7c3` | `/auth/login`, `/login` | Yes |
| `baseline-onboarding` | `d2e4aaf355a24e4cb645ba6b960546f2` | `/onboarding` | Yes |
| `baseline-shell` | `52b3e3e908414767976602862ea334a8` | App shell for authenticated pages | Yes |
| `baseline-dashboard` | `e28233a723ed48ed948e54172c3f516d` | `/dashboard`, `/dashboard/week`, `/dashboard/month` | Yes |
| `baseline-measurement` | `531f69e8d8cc4734865fd4f825c828a4` | `/measurements/new` | Yes |
| `baseline-history` | `591e9897af984758a61f1861daf0a291` | `/measurements/history` | Yes |
| `baseline-tracker` | `d3570e169aa94805a797f27ecde2d1ba` | `/tracker` | Yes |
| `baseline-alerts` | `3bba9bf8931a4d02a9e6f159811fe9ed` | `/alerts` | Yes |
| `baseline-ai-assistant` | `c7a54284936b4292bb256cd2d35c4b56` | `/ai-assistant` | Yes |
| `baseline-settings` | `2b657fcafc7645cd89b0c8d3e1e514e1` | `/settings/profile` | Yes |
| `baseline-family` | `b6c1a7b8ca6149b094e1b7a9343bf2b8` | `/family`, `/caregiver` | Yes |
| `baseline-senior` | `6b745584fb9443a69ac42f2719e9c54b` | senior mode shell | Yes |
| `baseline-reports` | `d076d5ec0389499ab51b5363c26f1637` | `/reports/*` | P1 |

Each baseline capture must record:

```text
Stitch screen instance ID
Route target
Viewport size
Capture timestamp
Screenshot path or artifact link
Key layout notes
Known hidden/alternate state notes
```

### Captured Baseline Log - 2026-06-21 16:51 UTC

Stitch MCP returned screenshots at 2x source scale. A `2560x2048` screenshot corresponds to the `1280x1024` desktop design board viewport.

| Baseline ID | Stitch Title | Screen Instance | Source Size | Route Target | Screenshot Artifact | HTML Artifact | Notes |
|---|---|---|---|---|---|---|---|
| `baseline-register` | Registrasi (Updated Sidebar) - HL Health Companion | `47a06482d6ff4a269f770a959bf29820` | `2560x2048` | `/auth/register`, `/register` | `projects/5854270015643176038/files/81614f2164d74a85a3aed607517023ae` | `projects/5854270015643176038/files/865ae0adbd804c1b87cb15fc67907eef` | Updated auth sidebar reference. |
| `baseline-login` | Login (Updated Sidebar) - HL Health Companion | `5eec9b4ce4884c8aae16a904b1dac7c3` | `2560x2048` | `/auth/login`, `/login` | `projects/5854270015643176038/files/23b6e4e1e5e54446a2d34eabfbd7c1ae` | `projects/5854270015643176038/files/44a2af11ffe3445591c3579e28ecd0fa` | Updated auth sidebar reference. |
| `baseline-onboarding` | Onboarding (Updated Sidebar) - HL Health Companion | `d2e4aaf355a24e4cb645ba6b960546f2` | `2560x2048` | `/onboarding` | `projects/5854270015643176038/files/9966768441894a0298cac59e41420e54` | `projects/5854270015643176038/files/fb22caa88a514da99bdcf503ee9f46af` | Use for forced onboarding gateway. |
| `baseline-shell` | Master Layout Shell | `52b3e3e908414767976602862ea334a8` | `2560x2048` | Authenticated app shell | `projects/5854270015643176038/files/15918716474395741404` | `projects/5854270015643176038/files/17172836468553858985` | Shared shell reference for sidebar/header/content frame. |
| `baseline-dashboard` | Dashboard - HealthSync Pro | `e28233a723ed48ed948e54172c3f516d` | `2560x2048` | `/dashboard`, `/dashboard/week`, `/dashboard/month` | `projects/5854270015643176038/files/1859121653976559902` | `projects/5854270015643176038/files/10743242630171483590` | True dashboard baseline. |
| `baseline-measurement` | New Measurement - HealthSync Pro | `531f69e8d8cc4734865fd4f825c828a4` | `2560x3146` | `/measurements/new` | `projects/5854270015643176038/files/7087945639121735332` | `projects/5854270015643176038/files/6249077463238489025` | Long-form measurement capture baseline. |
| `baseline-history` | Measurement History & Raw Data Log - HL Health Companion | `591e9897af984758a61f1861daf0a291` | `2560x2048` | `/measurements/history` | `projects/5854270015643176038/files/4706698166574770488` | `projects/5854270015643176038/files/4636297191508710036` | Raw data table and evidence reference. |
| `baseline-tracker` | Medication & Fasting Tracker - HL Health Companion | `d3570e169aa94805a797f27ecde2d1ba` | `2560x2812` | `/tracker`, `/medications`, `/fasting` | `projects/5854270015643176038/files/14420450855771226219` | `projects/5854270015643176038/files/8170367058085117057` | Long tracker baseline. |
| `baseline-alerts` | Notifications & Alerts - HL Health Companion | `3bba9bf8931a4d02a9e6f159811fe9ed` | `2560x2048` | `/alerts` | `projects/5854270015643176038/files/4486607896322116636` | `projects/5854270015643176038/files/2715543370339877255` | Alerts inbox/timeline baseline. |
| `baseline-ai-assistant` | AI Assistant (Polished) - HealthSync Pro | `c7a54284936b4292bb256cd2d35c4b56` | `2560x2048` | `/ai-assistant` | `projects/5854270015643176038/files/cc7fa792804f492a87a73c1c2de6f3e6` | `projects/5854270015643176038/files/2300b0ab5861422aaae2e094b6f80121` | Polished AI baseline. Older hidden AI screen `22a886...` was unavailable from MCP. |
| `baseline-settings` | Settings & Profile Management (Polished) - HealthSync Pro | `2b657fcafc7645cd89b0c8d3e1e514e1` | `2560x2048` | `/settings/profile` | `projects/5854270015643176038/files/6feed2b0033748b6a5cab5ec47de8468` | `projects/5854270015643176038/files/2d21b8dbaca145e1a56519a7d2732360` | Polished settings baseline. |
| `baseline-family` | Family & Caregiver Link (Polished) - HealthSync Pro | `b6c1a7b8ca6149b094e1b7a9343bf2b8` | `2560x3028` | `/family`, `/caregiver` | `projects/5854270015643176038/files/09ee679dffd14c27a627f98aa3d7bc46` | `projects/5854270015643176038/files/7a093032a2cb4df68a1eb36b043c1797` | Polished family/caregiver baseline. |
| `baseline-senior` | Senior Mode Interface - HL Health Companion | `6b745584fb9443a69ac42f2719e9c54b` | `2560x6760` | Senior shell and `/measurements/senior` | `projects/5854270015643176038/files/4c5162e1d7a4405ca1645633f66030ca` | `projects/5854270015643176038/files/d8e7748488ea4569afd00db396ff671f` | Full senior mode baseline. |
| `baseline-reports` | Reports & Analytics - HealthSync Pro | `d076d5ec0389499ab51b5363c26f1637` | `2560x2048` | `/reports/*` | `projects/5854270015643176038/files/bf473f5fd5e94c489ced2f4ad5cd4d21` | `projects/5854270015643176038/files/2944491976850260794` | P1 report baseline captured early. |

Additional inspected reference:

| Stitch Title | Screen Instance | Source Size | Screenshot Artifact | Notes |
|---|---|---:|---|---|
| Authentication & Onboarding Gateway - HL Health Companion | `ff3a1fdb50354aec9b3791c598b97aea` | `2560x5936` | `projects/5854270015643176038/files/798dbc0167fc4c87988d0fa0a353b78e` | Composite auth/onboarding reference. |
| Knowledge Base - HealthSync Pro | `ecc21fbda8294dd5a826bede08e458ae` | `2560x2048` | `projects/5854270015643176038/files/17089408459099981028` | P1 knowledge base reference. |

---

## 4. Visual Parity Scoring

Target score is 100/100. A route cannot be accepted below 95/100 unless the owner explicitly accepts the deviation.

| Category | Points | Failure Examples |
|---|---:|---|
| Shell layout | 15 | Sidebar width wrong, header block wrong, content margin wrong |
| Grid and spacing | 15 | Cards not aligned, gutters wrong, excessive whitespace, density mismatch |
| Typography | 10 | Wrong sizes, weights, line heights, label treatment |
| Component structure | 15 | Cards/tables/forms not shaped like Stitch |
| Color and elevation | 10 | Wrong surface, border, shadow, active state |
| Data hierarchy | 10 | Wrong KPI prominence, wrong table/card order |
| Interaction states | 10 | Hover/focus/selected/disabled/chip states differ |
| Responsive behavior | 10 | Mobile/tablet layout breaks or differs from intended Stitch behavior |
| Medical UX constraints | 5 | Manual override hidden, status unclear, AI wording unsafe |

Acceptance:

```text
95-100 = acceptable, owner can approve
85-94 = needs polish, not complete
0-84 = fail, must rebuild
```

---

## 5. Screenshot Comparison Method

For each route:

1. Open the Stitch baseline at the exact screen state.
2. Open the local route with matching viewport.
3. Seed or create app data so the local state resembles the Stitch screen state.
4. Capture screenshots at:
   - Desktop: `1280x1024`
   - Tablet: `768x1024`
   - Mobile: `390x844`
5. Compare:
   - Full screenshot diff.
   - Top shell crop.
   - Main content crop.
   - Primary card/table crop.
   - Modal/dialog crop if route has modal behavior.
6. Record mismatch notes before editing again.

Suggested artifact naming:

```text
artifacts/stitch-parity/{route-name}/stitch-desktop.png
artifacts/stitch-parity/{route-name}/local-desktop.png
artifacts/stitch-parity/{route-name}/diff-desktop.png
artifacts/stitch-parity/{route-name}/notes.md
```

Do not commit generated screenshot artifacts unless the owner explicitly requests it.

### Current Local Capture Log - 2026-06-21 17:00 UTC

Local capture source:

```text
Frontend: http://127.0.0.1:5173
Capture method: Playwright, mocked /api/* responses
Viewport: 1280x1024
Artifact directory: C:\temp\stitch-parity-current
Manifest: C:\temp\stitch-parity-current\manifest.json
```

These are before-state screenshots for parity remediation. They are not accepted as Stitch-matching UI.

| Local Screen | Route / Mode | Screenshot Path | Current Mismatch Notes |
|---|---|---|---|
| Register | `/auth/register` logged out | `C:\temp\stitch-parity-current\register-desktop.png` | Auth UI functional but simple; must be rebuilt against updated Stitch registration screen and auth gateway composition. |
| Login | `/auth/login` logged out | `C:\temp\stitch-parity-current\login-desktop.png` | Functional login card; must match updated Stitch login sidebar, spacing, trust indicators, and panel hierarchy. |
| Onboarding | `/onboarding` onboarding-gated | `C:\temp\stitch-parity-current\onboarding-desktop.png` | Form fields exist, but layout lacks Stitch onboarding gateway structure and polished section rhythm. |
| Dashboard | `/dashboard` | `C:\temp\stitch-parity-current\dashboard-desktop.png` | Sparse dashboard; shell, KPI hierarchy, card density, and data visualization do not match Stitch dashboard. |
| Weekly Dashboard | `/dashboard/week` | `C:\temp\stitch-parity-current\dashboard-week-desktop.png` | Minimal metric summaries; lacks Stitch analytics composition and chart/table treatment. |
| Monthly Dashboard | `/dashboard/month` | `C:\temp\stitch-parity-current\dashboard-month-desktop.png` | Generic summary cards; lacks Stitch report/dashboard visual hierarchy. |
| Measurement Capture | `/measurements/new` with BP metrics selected | `C:\temp\stitch-parity-current\measurement-new-desktop.png` | Functional checklist/form only; native file inputs and plain metric cards do not match Stitch new measurement screen. |
| Measurement History | `/measurements/history` | `C:\temp\stitch-parity-current\measurement-history-desktop.png` | Plain table; missing Stitch raw data log density, filters, toolbar, evidence treatment, and table styling. |
| Tracker | `/tracker` | `C:\temp\stitch-parity-current\tracker-desktop.png` | Basic two-column cards; does not match long Stitch medication/fasting tracker hierarchy. |
| Alerts | `/alerts` | `C:\temp\stitch-parity-current\alerts-desktop.png` | Functional alert list/timeline; lacks polished Stitch inbox grid and alert center density. |
| AI Assistant | `/ai-assistant` | `C:\temp\stitch-parity-current\ai-assistant-desktop.png` | Empty/simple chat shell; does not match polished Stitch assistant layout, message rail, and context cards. |
| Settings | `/settings/profile` | `C:\temp\stitch-parity-current\settings-profile-desktop.png` | Plain profile form; lacks polished Stitch profile management layout and control grouping. |
| Family | `/family` | `C:\temp\stitch-parity-current\family-desktop.png` | Stacked form/list; does not match polished Stitch caregiver invitation suite and permission layout. |
| Senior Dashboard | senior mode `/dashboard` | `C:\temp\stitch-parity-current\senior-dashboard-desktop.png` | Three-tab concept exists, but dashboard content is not rebuilt from Stitch senior mode baseline. |
| Senior Emergency | senior mode Darurat tab | `C:\temp\stitch-parity-current\senior-emergency-desktop.png` | SOS appears, but emergency/contact layout does not match full Stitch senior mode screen. |

---

## 6. Route Visual Test Cases

### VST-01 Dashboard

Route:

```text
/dashboard
```

Required checks:

- Sidebar and active state match Stitch.
- Header/user context area matches Stitch.
- KPI/vitals card grid matches Stitch.
- Empty state and populated state both look intentional.
- Status chips use Stitch semantic style.

Pass criteria:

```text
Visual score >= 95
No overlapping text
No card-in-card layout if Stitch does not use it
Dashboard data still loads from API
```

### VST-02 Weekly And Monthly Dashboard

Routes:

```text
/dashboard/week
/dashboard/month
```

Required checks:

- Trend sections match Stitch dashboard variant.
- Chart/table containers match dimensions and hierarchy.
- Empty states match visual language.

Pass criteria:

```text
Visual score >= 95
Aggregated values still render
No layout shift after data loads
```

### VST-03 Measurement Capture

Route:

```text
/measurements/new
```

Required checks:

- Device group layout matches Stitch.
- Metric checklist density and active state match Stitch.
- Selected metric form cards match Stitch.
- AI extraction button, evidence input, raw AI value, final value, and manual override are visible.
- Submit area matches Stitch.

Functional checks:

```text
Select systolic and diastolic metrics
Upload compressed/watermarked evidence
Enter 145/95
Set manual override
Submit
Confirm rule-engine status renders
```

Pass criteria:

```text
Visual score >= 95
manualOverride persists as 1 when finalValue differs from rawAiValue
AI does not decide severity
Original image is not stored
```

### VST-04 Measurement History

Route:

```text
/measurements/history
```

Required checks:

- Raw data table matches Stitch.
- Manual Override badge matches Stitch.
- Status/severity badges match Stitch.
- Evidence modal/lightbox matches Stitch.

Functional checks:

```text
Open row with evidence
Open evidence modal
Close modal by Escape or close button
Verify no unauthorized R2 key is exposed
```

Pass criteria:

```text
Visual score >= 95
Evidence endpoint verifies ownership
No table overflow on desktop/mobile
```

### VST-05 Medication And Fasting Tracker

Routes:

```text
/tracker
/medications
/fasting
```

Required checks:

- Timer panel matches Stitch.
- Medication schedule cards/table match Stitch.
- Take/Skip completed states match Stitch.
- Add medication form matches Stitch.

Functional checks:

```text
Start 8-hour fast
Observe countdown
Stop or cancel fast
Create medication
Take one medication
Skip another medication
Verify UI state and DB mutation
```

Pass criteria:

```text
Visual score >= 95
Countdown does not resize layout
Take/Skip states persist
No dosage advice is generated
```

### VST-06 Family And Caregiver Link

Routes:

```text
/family
/caregiver
```

Required checks:

- Invitation suite matches Stitch.
- Permission toggles match Stitch.
- Pending invitations list matches Stitch.
- Revoke action state matches Stitch.

Functional checks:

```text
Invite test caregiver email
Allow dashboard viewing
Deny measurement input
Send invite
Verify pending item appears
Revoke invite
Verify status/list updates
```

Pass criteria:

```text
Visual score >= 95
Permission semantics preserved
Caregiver cannot access forbidden data
```

### VST-07 Notifications And Alerts

Route:

```text
/alerts
```

Required checks:

- Inbox grid matches Stitch.
- Emergency filter segment/tab matches Stitch.
- Telegram delivery timeline matches Stitch.
- Empty/loading/error states match Stitch.

Functional checks:

```text
Load inbox
Filter Emergency Alerts
Filter or inspect Telegram timeline
Verify notification payload rows do not break UI
```

Pass criteria:

```text
Visual score >= 95
No grid break on long notification text
Emergency severity remains rule-based
```

### VST-08 AI Assistant

Route:

```text
/ai-assistant
```

Required checks:

- Health context banner matches Stitch.
- Chat panel/messages match Stitch.
- Prompt input and send button match Stitch.
- Senior-friendly typography is preserved.

Functional checks:

```text
Send: Saran makan malam untuk hipertensi
Verify current vitals context is included
Verify response renders
Verify no diagnosis or medication dosage instruction
```

Pass criteria:

```text
Visual score >= 95
AI response is safe and non-diagnostic
Context banner includes current user vitals when available
```

### VST-09 Settings And Profile

Route:

```text
/settings/profile
```

Required checks:

- Profile management layout matches Stitch polished screen.
- Theme/accessibility controls match Stitch.
- Save state and validation messages match Stitch.

Functional checks:

```text
Update height/timezone/theme/accessibilityMode
Save
Reload
Verify persisted value
```

Pass criteria:

```text
Visual score >= 95
Senior mode switch still works
No broken auth/profile state
```

### VST-10 Reports And Analytics

Routes:

```text
/reports/daily
/reports/weekly
/reports/monthly
/reports/doctor
```

Required checks:

- Analytics cards match Stitch report screen.
- Tables/charts/export actions match Stitch.
- PDF/report generation state matches Stitch.

Functional checks:

```text
Open each report route
Generate doctor-ready report if available
Verify report summary safe language
Verify no raw private R2 key exposure
```

Pass criteria:

```text
Visual score >= 95 for P1 route acceptance
Report data still loads
Safe medical language only
```

### VST-11 Senior Mode

Mode:

```text
accessibilityMode = senior
```

Required checks:

- Normal sidebar hidden.
- Normal mobile bottom nav hidden.
- Only giant tabs appear: Beranda, Tambah Data, Darurat.
- SOS button visually prominent and pulsing.
- Large tap targets and senior typography are consistent.

Functional checks:

```text
Set profile accessibility mode to senior
Visit dashboard
Open each giant tab
Long-press TOMBOL SOS
Verify SOS long-press state
```

Pass criteria:

```text
Visual score >= 95
No hidden normal nav visible
SOS long-press works with mouse and touch event simulation
```

---

## 7. Functional Regression Test Matrix

Run after each P0 route or after a small batch of related routes.

| Area | Command / Flow | Required Result |
|---|---|---|
| Frontend lint | `npm --prefix web run lint` | Pass |
| Frontend build | `npm --prefix web run build` | Pass |
| Worker test | `npm --prefix worker test` | Pass |
| Worker build | `npm --prefix worker run build` | Pass |
| Auth | Register new user | Forced onboarding |
| Onboarding | Fill profile | Redirect dashboard |
| Measurement | Submit 145/95 manual override | Warning/status from rule engine |
| Evidence | Open evidence modal | Authenticated stream works |
| Tracker | Start/stop fast, Take/Skip meds | State persists |
| Family | Invite/revoke | Pending then revoked |
| Alerts | Emergency filter | No layout break |
| AI | Ask hypertension dinner question | Safe response |
| Senior | Toggle senior, long-press SOS | 3-tab shell and SOS state |

---

## 8. Medical Safety Regression

Every UI parity change must preserve:

```text
AI never gives final diagnosis
AI never assigns medical severity
AI never changes medication dosage
Rule engine decides status/severity
Manual override remains visible and editable
Emergency alerts use rule-based severity/emergencyLevel
Caregiver permissions are enforced
Original images are never stored
Compressed/watermarked evidence only
```

---

## 9. Production UAT Gate

Production UAT can start only after local visual and functional tests pass.

Production checks:

```text
GET https://hl-health-companion.pages.dev returns 200
Main JS/CSS assets return 200
GET /api/auth/me returns JSON 401 when logged out, not HTML
No 500/404 asset errors in browser console
All P0 route screenshots match Stitch baseline
All functional E2E flows pass
```

Required production report format:

| Flow | Visual | Functional | Status | Notes |
|---|---|---|---|---|
| Dashboard | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| Measurement Capture | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| Measurement History | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| Tracker | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| Family/Caregiver | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| Alerts | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| AI Assistant | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| Settings | PASS/FAIL | PASS/FAIL | PASS/FAIL | |
| Senior Mode | PASS/FAIL | PASS/FAIL | PASS/FAIL | |

---

## 10. Failure Handling

If visual parity fails:

```text
Do not mark the task done
Do not deploy as complete
Record mismatch notes
Patch in-place
Rerun screenshot comparison
Rerun functional test for the affected route
```

If functional regression fails:

```text
Do not trade function for visual parity
Fix behavior while preserving Stitch layout
Rerun route E2E
Rerun safety checks if medical/AI/emergency affected
```

If owner says the UI still does not match:

```text
Treat owner review as failed visual parity
Lower any self-score to FAIL
Capture exact mismatch notes
Patch again
```

---

## 11. Final Acceptance

The UI parity work is accepted only when:

```text
All P0 routes score >= 95/100 or owner explicitly accepts the deviation
All functional regression tests pass
All medical safety checks pass
Production UAT passes
WORK_LOG.md and HANDOFF.md are updated
Owner confirms the UI matches Stitch
```
