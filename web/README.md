# HL Health Companion — Frontend

React 19 + Vite 8 + TypeScript 6 SPA, deployed to Cloudflare Pages.

## Stack

- **React 19.2** — hooks, lazy loading, no React Router (custom `navigate()` via `history.pushState`)
- **Vite 8** — dev server (proxies `/api` to `localhost:8787`), production build
- **TypeScript 6** — strict mode
- **Vanilla CSS** — custom properties, mobile-first responsive, senior-friendly defaults
- **PWA** — service worker (`sw.js`), manifest, offline-ready icons

## Pages / Routes

19 page groups in `src/pages/`:

| Route | Page | File |
|---|---|---|
| `/dashboard` | Today Dashboard | `pages/dashboard/TodayDashboard.tsx` |
| `/dashboard/week` | Weekly Dashboard | `pages/dashboard/WeeklyDashboard.tsx` |
| `/dashboard/month` | Monthly Dashboard | `pages/dashboard/MonthlyDashboard.tsx` |
| `/login`, `/register` | Auth | `pages/auth/LoginPage.tsx`, `RegisterPage.tsx` |
| `/onboarding` | Onboarding wizard | `pages/onboarding/OnboardingPage.tsx` |
| `/measurements/new` | New Measurement (select metric) | `pages/measurement/SelectMetricPage.tsx` |
| `/measurements/history` | Measurement History | `pages/measurement/HistoryPage.tsx` |
| `/measurements/senior` | Senior Measurement Flow | `pages/measurement/SeniorMeasurementFlow.tsx` |
| `/reports/daily` | Daily Report | `pages/reports/DailyReportPage.tsx` |
| `/reports/weekly` | Weekly Report | `pages/reports/WeeklyReportPage.tsx` |
| `/reports/monthly` | Monthly Report | `pages/reports/MonthlyReportPage.tsx` |
| `/reports/doctor` | Doctor Ready Report | `pages/reports/DoctorReportPage.tsx` |
| `/ai-assistant` | AI Assistant | `pages/ai/AiAssistantPage.tsx` |
| `/alerts` | Notifications & Alerts | `pages/alerts/AlertsPage.tsx` |
| `/tracker` | Fasting & Medication Tracker | `pages/tracker/TrackerPage.tsx` |
| `/fasting` | Fasting Timer | `pages/fasting/FastingPage.tsx` |
| `/medications` | Medication Log | `pages/medications/MedicationsPage.tsx` |
| `/patterns` | Pattern Detection | `pages/patterns/PatternsPage.tsx` |
| `/family` | Family / Caregiver | `pages/family/FamilyPage.tsx` |
| `/caregiver` | Caregiver Dashboard | `pages/caregiver/CaregiverDashboardPage.tsx` |
| `/emergency` | Emergency Contacts | `pages/emergency/EmergencyContactsPage.tsx` |
| `/reminders` | Reminders | `pages/reminders/RemindersPage.tsx` |
| `/telegram` | Telegram Settings | `pages/telegram/TelegramSettingsPage.tsx` |
| `/settings/profile` | Profile & Settings | `pages/settings/ProfileSettingsPage.tsx` |
| `/settings/delete` | Delete Account | `pages/settings/ProfileDeletePage.tsx` |
| `/kb` | Knowledge Base | `pages/kb/KnowledgeBasePage.tsx` |
| `/admin/configs` | Admin Config Panel | `pages/admin/ConfigDashboardPage.tsx` |

## Components

| Component | Path |
|---|---|
| `DynamicMetricForm` | `components/measurement/DynamicMetricForm.tsx` |
| `InterpretationPopup` | `components/measurement/InterpretationPopup.tsx` |
| `ManualOverrideInput` | `components/measurement/ManualOverrideInput.tsx` |
| `AttachmentUploader` | `components/measurement/AttachmentUploader.tsx` |
| `AttachmentViewer` | `components/AttachmentViewer.tsx` |
| `MedicalTerm` | `components/MedicalTerm.tsx` |
| `SeniorAppShell` | `components/SeniorAppShell.tsx` |
| `UnitInfoModal` | `components/UnitInfoModal.tsx` |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` |
| `TrendBadge` | `components/dashboard/TrendBadge.tsx` |
| `EmergencyModal` | `components/shared/EmergencyModal.tsx` |

## Context

| Context | Path |
|---|---|
| `AuthProvider` | `context/AuthContext.tsx` |
| `useAuth` hook | `context/auth.ts` |

`AuthProvider` wraps the app, fetches `/api/auth/me` on mount, applies `profile.theme` and `profile.accessibilityMode` to `<html>` dataset attributes.

## Hooks

- `useAiExtract` — calls `POST /api/measurements/extract` with FormData, returns extracted metrics or manual fallback
- `useWebPush` — browser push subscription management

## Utils

- `imageCompressor` — client-side image resize (max 1280px) + 50% JPEG compression
- `watermark` — canvas watermark overlay before upload
- `dateFormat` — date/time formatting
- `validation` — form validation helpers
- `bmiCalculator` — BMI computation

## Styling

- Base: CSS custom properties (`--primary`, `--bg`, `--text`, etc.)
- Senior mode: `styles/senior-mode.css` — larger tap targets, bigger fonts
- High contrast: `styles/high-contrast.css` — WCAG AAA focus indicators
- Layout: sidebar (collapsible) + topbar (clock, theme switch, display mode, notifications, user menu) + bottom nav (mobile)
- Theme switcher: light / warm / dark (persisted to API)
- Display mode: normal / senior / highContrast (persisted to API)

## PWA

- Service worker: `public/sw.js`
- Manifest: `public/manifest.json` (`short_name: "HL Health"`, `theme_color: "#0f172a"`, `display: "standalone"`)
- Icons: `public/icon-192.svg`, `public/icon-512.svg`

## API Proxy

Production: `functions/api/[[path]].ts` rewrites `/api/*` from Pages to:

```
https://hl-health-companion-api.indiehomesungairaya.workers.dev/api/*
```

Development: `vite.config.ts` proxies `/api` to `http://127.0.0.1:8787`.

## Dev

```bash
npm run dev      # vite dev server → localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run lint     # eslint
```

## Admin Route

`/admin/configs` is visible only when `user.email === 'admin@homesungai.com'`.
