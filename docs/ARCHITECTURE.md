# ARCHITECTURE — HL Health Companion

## 1. Overview

HL Health Companion is a full web health-monitoring application built on the Cloudflare stack.

The system helps users record health measurements from home health devices by taking or uploading photos, extracting values with Workers AI Vision when possible, allowing manual override, validating values with rule-based medical thresholds, saving final verified data, sending Telegram notifications, generating reports, and building dashboards for the user and caregiver.

The application is designed as:

```text
Rule-first
AI-assisted
Manual-verification-first
Cloudflare-native
Free-tier-conscious
Mobile-first
PWA-ready
```

---

## 2. Product Scope

The platform supports health tracking for:

```text
Pulse oximeter
Blood pressure monitor
Sinocare GCU glucose/cholesterol/uric acid device
Thermometer
Body scale
Manual sleep duration
Manual waist circumference
```

Supported health metrics:

```text
spo2
heartRate
systolic
diastolic
bloodPressurePulse
glucoseFasting
glucosePostMeal
cholesterolTotal
uricAcid
bodyWeight
bmi
waistCircumference
bodyTemperature
sleepDuration
height
```

---

## 2. Design Principles

### 2.6 No Hardcoded Configurations

Semua konfigurasi sistem yang bisa berubah (seperti batas memori 2MB, timeout AI 5000ms, limit API) **TIDAK BOLEH** di-hardcode di dalam kode.
Semuanya harus dibaca dari tabel `HL_systemConfigs` di D1. Untuk menghindari pengurasan kuota baca D1 (Cloudflare free tier), Worker harus melakukan *caching* (in-memory KV / Cache API) terhadap konfigurasi ini dengan masa berlaku tertentu (misalnya 5 menit).

---

## 3. Required Cloudflare Stack

```text
Frontend: React SPA / Vite / PWA
Hosting: Cloudflare Pages or Workers Static Assets
API Gateway: Hono.js on Cloudflare Workers
Runtime: Cloudflare Workers TypeScript
Database: Cloudflare D1 binding DB
Object Storage: Cloudflare R2 binding LOGS
AI Vision: Cloudflare Workers AI Vision model
AI Text: Cloudflare Workers AI LLM
Async: Cloudflare Queues
Scheduler: Cloudflare Cron Triggers
Deployment: Wrangler
Notification: Telegram Bot API + Browser Push
PDF: HTML to PDF worker flow or external-compatible rendering strategy
```

Existing bindings:

```toml
[[d1_databases]]
binding = "DB"
database_name = "multi_Ai_db"
database_id = "b80ca989-6771-427f-a656-c7ab6ffc17ce"

[[r2_buckets]]
binding = "LOGS"
bucket_name = "multi-apps-ai-bucket"
```

No new database should be created.

---

## 4. Naming Constraints

Database naming rules:

```text
Table prefix: HL_
No extra underscore after HL_
Field names: camelCase
```

Valid examples:

```text
HL_users
HL_userProfiles
HL_measurementSessions
HL_measurementValues
HL_metricRules
userId
createdAt
finalValue
manualOverride
```

Invalid examples:

```text
users
health_users
HL_user_profiles
created_at
manual_override
```

---

## 5. High-Level Architecture

```mermaid
flowchart TD
  User[User Browser / PWA] --> Frontend[React SPA]
  Frontend --> Hono[Hono.js API on Cloudflare Workers]

  Hono --> Auth[Auth Middleware]
  Auth --> Routes[API Routes]

  Routes --> D1[(D1 DB: multi_Ai_db)]
  Routes --> R2[(R2 LOGS Bucket)]
  Routes --> AI[Workers AI]
  Routes --> Queues[Cloudflare Queues]

  Queues --> NotifyWorker[Notification Worker]
  Queues --> RecWorker[Recommendation Worker]
  Queues --> PdfWorker[PDF Worker]
  Queues --> ReminderWorker[Reminder Worker]

  NotifyWorker --> Telegram[Telegram Bot API]
  NotifyWorker --> BrowserPush[Browser Push]
  RecWorker --> AIText[Workers AI Text LLM]
  PdfWorker --> R2
  ReminderWorker --> Telegram

  Cron[Cron Triggers] --> ReminderWorker
  Cron --> MaintenanceWorker[Maintenance Jobs]
  MaintenanceWorker --> D1
```

---

## 6. Core Principles

## 6.1 Rule First, AI Assisted

Medical status is always calculated from rules, not directly from AI.

```text
finalValue
→ physical validation
→ HL_metricRules lookup
→ status/severity/emergencyLevel
→ popup interpretation
→ optional AI narrative
```

AI is allowed to help explain, summarize, or compare data. AI must not diagnose, prescribe medication, or override rule-based severity.

---

## 6.2 Original Image Is Not Stored

Original photo is used only for temporary extraction.

```text
User takes photo
→ Browser preview/compress for extraction
→ Workers AI reads temporary file
→ Response fills text boxes
→ User verifies or edits value
→ User submits final values
→ Browser creates final compressed watermarked evidence image
→ Worker stores final evidence image only
```

Forbidden:

```text
Saving original photo to R2
Saving base64 image to D1
Saving unwatermarked evidence image
```

## 6.2.1 Onboarding Profile Gate

New users must complete `POST /api/profile/onboarding` before reaching the
dashboard. The Worker authenticates the existing `hlSession` cookie, validates
profile fields, writes `HL_userProfiles`, records AI consent in
`HL_userConsents`, updates `HL_users.displayName`, and appends a
`profileOnboardingComplete` audit log. The frontend refreshes
`GET /api/auth/me` after success so `requiresOnboarding` becomes `false` and the
SPA continues to `/dashboard`.

After onboarding, `GET /api/profile`, `PUT /api/profile`, and
`PUT /api/settings/ui` operate only on the authenticated user's existing
`HL_userProfiles` row. Profile updates validate height and timezone, UI updates
validate theme/accessibility enums, and both write `HL_auditLogs` entries. The
React app applies `profile.theme` to `data-theme` and
`profile.accessibilityMode` to `data-accessibility` on the document root after
auth refresh.

---

## 6.3 Fast Path First

AI must never block the user.

```text
AI extraction timeout: configurable via DB
If timeout: manual input fallback
If parse fails: manual input fallback
If AI unavailable: manual input fallback
```

OCR is synchronous for user interaction and not queued by default.

---

## 6.4 Free Tier Efficiency

The architecture is optimized to reduce D1 writes, R2 storage, AI calls, and queue overhead.

```text
Client-side image compression
Client-side watermarking
No original image storage
No automatic AI retry
Report PDF only on demand
Queues only for async non-blocking jobs
Dashboard uses indexed range queries
AI recommendations use compact summary JSON
```

---

## 7. Main User Flow

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend PWA
  participant API as Hono Worker API
  participant AI as Workers AI Vision
  participant D1 as D1 DB
  participant R2 as R2 LOGS
  participant Q as Queues
  participant TG as Telegram

  U->>FE: Login
  FE->>API: POST /api/auth/login
  API->>D1: Validate user/session
  API-->>FE: Session cookie

  U->>FE: Select measurement checklist
  U->>FE: Take/upload photo
  FE->>FE: Resize/compress preview
  FE->>API: POST /api/measurements/extract
  API->>AI: Extract numbers with 5s timeout

  alt AI success <= 5s
    AI-->>API: JSON metrics
    API->>D1: Log HL_aiExtractions
    API-->>FE: rawAiValue metrics
    FE->>U: Fill text boxes
  else AI timeout/fail
    API->>D1: Log timeout/failure
    API-->>FE: Manual fallback
    FE->>U: Manual input
  end

  U->>FE: Edit/verify final values
  FE->>API: POST /api/measurements/validate
  API->>D1: Read HL_metricRules
  API-->>FE: Popup interpretation

  U->>FE: Confirm submit
  FE->>FE: Generate compressed watermarked attachment
  FE->>API: POST /api/measurements/submit
  API->>D1: Insert session + values + alerts
  API->>R2: Store final evidence only
  API->>D1: Insert attachment metadata
  API->>Q: Queue Telegram + recommendation
  API-->>FE: Submit success
  Q->>TG: Send after-submit notification
```

---

## 8. Application Modules

## 8.1 Frontend Modules

```text
Auth UI
Onboarding UI
Measurement capture UI
Camera/upload component
Image compression service
Watermark canvas service
Manual override form
Interpretation popup
Dashboard today/weekly/monthly
Reports page
AI assistant page
Telegram settings page
Family/caregiver page
Medication tracker
Fasting timer
Gamification
Accessibility mode
PWA service worker
```

## 8.2 Backend Modules

```text
Auth service
Session service
Profile service
Metric catalog service
Measurement service
AI extraction service
Rules engine
Attachment service
Dashboard query service
AI recommendation service
Telegram service
Notification service
Family RBAC service
Emergency alert service
Medication service
Fasting service
Report service
Pattern insight service
Gamification service
Knowledge base service
Audit log service
Rate limit service
```

---

## 9. Suggested Repository Structure

```text
hl-health-companion/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── pwa/
│   │   │   └── styles/
│   │   ├── public/
│   │   └── package.json
│   └── worker/
│       ├── src/
│       │   ├── index.ts
│       │   ├── env.ts
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── services/
│       │   ├── repositories/
│       │   ├── validators/
│       │   ├── queues/
│       │   ├── cron/
│       │   ├── ai/
│       │   ├── utils/
│       │   └── types/
│       ├── migrations/
│       │   └── schema.sql
│       ├── wrangler.toml
│       └── package.json
├── docs/
│   ├── PRD.md
│   ├── UserStories.md
│   ├── api-contract.md
│   └── ARCHITECTURE.md
└── package.json
```

---

## 10. Worker Runtime Architecture

## 10.1 Hono App Layout

```text
index.ts
→ create Hono app
→ request id middleware
→ security headers middleware
→ auth middleware
→ rate limit middleware
→ route registration
→ queue handlers
→ scheduled handlers
→ error handler
```

Example route grouping:

```text
routes/auth.ts
routes/profile.ts
routes/metrics.ts
routes/measurements.ts
routes/dashboard.ts
routes/ai.ts
routes/telegram.ts
routes/notifications.ts
routes/family.ts
routes/alerts.ts
routes/medications.ts
routes/fasting.ts
routes/reports.ts
routes/patterns.ts
routes/kb.ts
routes/settings.ts
routes/export.ts
```

## 10.2 Environment Interface

```ts
export interface Env {
  DB: D1Database;
  LOGS: R2Bucket;
  AI: Ai;
  TELEGRAM_BOT_TOKEN: string;
  SESSION_SECRET: string;
  ENCRYPTION_SECRET: string;
  NOTIFICATION_QUEUE?: Queue;
  RECOMMENDATION_QUEUE?: Queue;
  PDF_QUEUE?: Queue;
  REMINDER_QUEUE?: Queue;
}
```

---

## 11. wrangler.toml Reference

```toml
name = "hl-health-companion"
main = "src/index.ts"
compatibility_date = "2026-06-20"

[ai]
binding = "AI"

[[d1_databases]]
binding = "DB"
database_name = "multi_Ai_db"
database_id = "b80ca989-6771-427f-a656-c7ab6ffc17ce"

[[r2_buckets]]
binding = "LOGS"
bucket_name = "multi-apps-ai-bucket"

# Queue bindings are optional at early sprint stage.
# Add them when queues are created.
# [[queues.producers]]
# binding = "NOTIFICATION_QUEUE"
# queue = "hl-notification-queue"
#
# [[queues.consumers]]
# queue = "hl-notification-queue"
# max_batch_size = 10
# max_batch_timeout = 5

# [triggers]
# crons = ["*/30 * * * *", "0 1 * * *"]
```

---

## 12. Database Architecture

Primary database: Cloudflare D1 database `multi_Ai_db`.

The schema is normalized around sessions and values.

```text
HL_users
  └── HL_userProfiles
  └── HL_sessions
  └── HL_measurementSessions
        └── HL_measurementValues
        └── HL_measurementAttachments
        └── HL_alerts
        └── HL_aiRecommendations
```

### 12.1 Core Tables

```text
HL_users
HL_sessions
HL_userProfiles
HL_userConsents
HL_devices
HL_metricCatalog
HL_deviceMetrics
HL_metricRules
HL_measurementDrafts
HL_measurementSessions
HL_measurementValues
HL_measurementAttachments
HL_aiExtractions
HL_aiRecommendations
HL_alerts
HL_notifications
HL_auditLogs
```

The measurement checklist is catalog-driven. `GET /api/metrics/catalog` reads
`HL_devices`, `HL_deviceMetrics`, and `HL_metricCatalog`, then the frontend
renders active device/metric rows without a hardcoded metric whitelist.

### 12.2 Notification and Sharing Tables

```text
HL_telegramLinks
HL_pushSubscriptions
HL_notificationSettings
HL_reminderSettings
HL_familyLinks
HL_familyInvites
HL_emergencyContacts
```

### 12.3 Advanced Feature Tables

```text
HL_medications
HL_medicationSchedules
HL_medicationLogs
HL_fastingSessions
HL_badges
HL_userBadges
HL_streaks
HL_reports
HL_reportShares
HL_patternInsights
HL_knowledgeArticles
HL_apiRateLimits
```

---

## 13. Data Ownership Model

Every user-owned row must contain `userId` where possible.

Owner-scoped tables:

```text
HL_userProfiles
HL_measurementSessions
HL_measurementValues
HL_measurementAttachments
HL_aiExtractions
HL_aiRecommendations
HL_alerts
HL_notifications
HL_telegramLinks
HL_pushSubscriptions
HL_notificationSettings
HL_reminderSettings
HL_emergencyContacts
HL_medications
HL_medicationLogs
HL_fastingSessions
HL_userBadges
HL_streaks
HL_reports
HL_patternInsights
HL_auditLogs
```

Access rule:

```text
Default: user can access only own userId rows.
Caregiver: access only if HL_familyLinks is active and permission allows it.
Doctor viewer: access only report share link, not full dashboard.
Emergency contact: receives alert only, no full dashboard by default.
```

---

## 14. R2 Storage Architecture

Bucket binding:

```text
LOGS = multi-apps-ai-bucket
```

### 14.1 Evidence Image Path

```text
HL/users/{userId}/measurements/{sessionId}/{metricCode}-{attachmentId}.webp
```

### 14.2 Report Path

```text
HL/users/{userId}/reports/doctorReady30d-{reportId}.pdf
```

### 14.3 Storage Rules

```text
R2 bucket is private
No public object URL
All access requires owner/caregiver permission check
Stream through Worker or generate short signed URL
Store only final compressed watermarked images
Never store raw original image
```

---

## 15. Measurement Data Model

A measurement session is one event, and it can contain many values.

Example:

```text
Session: 2026-06-20 20:15
Values:
- spo2 = 98 %
- heartRate = 73 bpm
- systolic = 142 mmHg
- diastolic = 91 mmHg
- bodyWeight = 78.4 kg
- bmi = 27.1 index
```

This avoids creating separate tables for each metric and makes dashboards easier.

---

## 16. Measurement Submit Flow Internals

```mermaid
flowchart TD
  Submit[POST /api/measurements/submit] --> Auth[Auth Check]
  Auth --> Parse[Parse Multipart Payload]
  Parse --> Validate[Physical Range Validation]
  Validate --> Rule[HL_metricRules Evaluation]
  Rule --> Emergency{Emergency?}
  Emergency -->|Yes| CreateAlert[Create HL_alerts]
  Emergency -->|No| SkipAlert[Skip Alert]
  CreateAlert --> SaveSession[Insert HL_measurementSessions]
  SkipAlert --> SaveSession
  SaveSession --> SaveValues[Batch Insert HL_measurementValues]
  SaveValues --> UploadR2[Upload Final Evidence to R2]
  UploadR2 --> SaveAttachments[Insert HL_measurementAttachments]
  SaveAttachments --> Audit[Insert HL_auditLogs]
  Audit --> QueueNotify[Queue Telegram Summary]
  QueueNotify --> QueueReco[Queue AI Recommendation]
  QueueReco --> UpdateStreak[Update HL_streaks]
  UpdateStreak --> Response[Return Success]
```

Submit should be transactional for D1 operations where possible. R2 upload and D1 insert order should be handled carefully:

```text
Option A:
1. Upload R2 objects
2. Insert D1 rows
3. If D1 fails, delete uploaded R2 objects best effort

Option B:
1. Insert D1 session/values
2. Upload R2 objects
3. Insert attachments
4. If R2 fails, mark session hasAttachment false or return retryable error
```

Recommended for Sprint 1: Option A with best-effort cleanup.

---

## 17. AI Vision Architecture

### 17.1 AI Extraction Path

```text
POST /api/measurements/extract
→ auth check
→ rate limit check
→ validate deviceCode and selectedMetricCodes
→ read image into memory
→ call Workers AI Vision with strict JSON prompt
→ timeout at configured limit
→ parse JSON
→ validate against physical range
→ write HL_aiExtractions log
→ return metrics to frontend
```

### 17.2 Prompt Strategy

Use device-specific prompts.

```text
oximeter prompt
bloodPressure prompt
sinocareGcu prompt
thermometer prompt
bodyScale prompt
```

Never use one generic prompt for all devices.

### 17.3 AI Output Contract

```json
{
  "deviceCode": "yuwellYx106",
  "metrics": [
    {
      "metricCode": "spo2",
      "rawAiValue": 98,
      "unit": "%",
      "confidence": 0.89
    }
  ],
  "needsManualReview": false
}
```

### 17.4 Failure Handling

```text
Timeout → manual fallback
No JSON → manual fallback
Invalid value → manual fallback
Low confidence → fill value but mark needsManualReview true
```

---

## 18. AI Recommendation Architecture

AI recommendation runs after submit and should not block the user.

```text
Submit success
→ queue generateRecommendation
→ worker builds compact summary
→ calls Workers AI text model
→ safety filter response
→ save to HL_aiRecommendations
```

### 18.1 Summary Input

The LLM should receive only compact, relevant data:

```json
{
  "today": {},
  "threeDayComparison": {},
  "sevenDayComparison": {},
  "ruleStatuses": [],
  "emergencyFlags": []
}
```

### 18.2 Safety Filter

Reject or fallback if AI output contains:

```text
hard diagnosis
medication prescription
dosage change instruction
claim of certainty
panic-inducing emergency statement not supported by rules
```

---

## 19. Rules Engine Architecture

Rules are stored in:

```text
HL_metricRules
```

### 19.1 Rule Lookup

Input:

```text
metricCode
finalValue
unit
sex
age
```

Lookup algorithm:

```text
1. Validate physicalMin/physicalMax from HL_metricCatalog
2. Find active HL_metricRules by metricCode
3. Prefer exact sex rule if requiresSex
4. Fallback to sex = all
5. Filter ageMin <= age <= ageMax
6. Filter minValue <= finalValue <= maxValue
7. Sort by rulePriority ASC
8. Return first rule
9. If no rule found, return fallback status info
```

### 19.2 Blood Pressure Composite Handling

Systolic and diastolic are stored separately but displayed together.

Composite status should use highest severity between:

```text
systolic severity
diastolic severity
```

Emergency if either:

```text
systolic emergencyLevel = emergency
diastolic emergencyLevel = emergency
```

---

## 20. Notification Architecture

### 20.1 Channels

```text
inApp
telegram
browser
email optional later
```

### 20.2 Telegram After Submit

Every successful submit can enqueue Telegram summary if enabled.

```text
Measurement submit
→ create HL_notifications pending
→ queue telegramSubmitSummary
→ queue consumer sends Telegram
→ update HL_notifications status sent/failed
```

Submit response must not wait more than 1000 ms for notification logic.

### 20.3 Emergency Alert

Emergency is rule-based.

```text
Metric severity emergency
→ create HL_alerts
→ show emergency modal on frontend
→ send Telegram to user
→ send Telegram to emergency contacts with consent
→ log HL_notifications
```

---

## 21. Queue Architecture

### 21.1 Queues

```text
notificationQueue
recommendationQueue
pdfQueue
reminderQueue
```

### 21.2 Queue Usage

| Queue | Purpose | Blocking? |
|---|---|---:|
| `notificationQueue` | Telegram, browser, in-app notification | No |
| `recommendationQueue` | AI recommendations after submit | No |
| `pdfQueue` | Doctor Ready PDF generation | No |
| `reminderQueue` | Scheduled reminders | No |

OCR extraction is not queued by default because user expects immediate response.

---

## 22. Cron Architecture

### 22.1 Reminder Cron

Runs periodically to process due reminders.

```text
Find enabled HL_reminderSettings
Check user timezone and scheduleTime
Create HL_notifications
Queue notification events
```

### 22.2 Maintenance Cron

Runs daily.

```text
Expire old measurement drafts
Expire family invites
Expire fasting sessions
Create missed medication logs if required
Clean old rate-limit windows
R2 orphan cleanup: delete R2 objects older than 24 hours with no matching HL_measurementAttachments row
```

---

## 23. Dashboard Query Architecture

### 23.1 Today Dashboard

Query latest values per metric for one day.

Indexes used:

```text
idxHLMeasurementSessionsUserDate
idxHLMeasurementValuesUserMetricDate
idxHLAlertsUserDate
```

### 23.2 Weekly Dashboard

Query 7-day series grouped by date and metric.

```text
rangeStart = local week start
rangeEnd = rangeStart + 7 days
```

### 23.3 Monthly Dashboard

Query 30-day or calendar month summary.

Aggregates:

```text
average
min
max
latest
measurementCount
alertCount
```

---

## 24. Reports Architecture

### 24.1 Daily/Weekly/Monthly Reports

Reports are generated dynamically from D1 and do not need to be saved by default.

### 24.2 Doctor Ready PDF

Doctor Ready PDF is generated on demand and saved to R2.

```text
POST /api/reports/doctorReady30d
→ create HL_reports pending
→ queue pdf generation
→ render HTML report
→ convert to PDF
→ upload to R2
→ update HL_reports ready
```

### 24.3 PDF Contents

```text
User profile
30-day summary
Metric tables
Charts
Alert log
Medication log
AI summary safe text
Attachment thumbnails if enabled
Disclaimer
```

---

## 25. Family and Caregiver Architecture

Family sharing is role-based and consent-based.

```text
Owner invites caregiver/viewer/emergencyContact/doctorViewer
Invite token stored as hash
Recipient accepts
HL_familyLinks becomes active
Permissions are checked on every caregiver request
```

### 25.1 Permission Matrix

| Role | View Dashboard | Input Data | Edit Data | Receive Alert | Download PDF |
|---|---:|---:|---:|---:|---:|
| owner | yes | yes | yes | yes | yes |
| caregiver | yes | optional | limited | yes | optional |
| viewer | yes | no | no | optional | no |
| emergencyContact | limited | no | no | yes | no |
| doctorViewer | report only | no | no | no | share only |

---

## 26. Medication Architecture

Medication tracking is informational only.

```text
HL_medications = master list
HL_medicationSchedules = schedule times
HL_medicationLogs = taken/skipped/missed events
```

AI may compare medication adherence with health metrics but must not suggest dosage changes.

---

## 27. Fasting Timer Architecture

Fasting sessions are user-owned.

```text
Start fasting
→ create HL_fastingSessions active
→ targetAt = startedAt + targetHours
→ reminder cron detects target reached
→ send notification
→ user stops or cancels
```

Allowed fasting types:

```text
glucoseFasting
cholesterolTotal
uricAcid
general
```

---

## 28. Gamification Architecture

Gamification must encourage consistency without encouraging excessive measurement.

Rules:

```text
One streak increment per day max
Multiple measurements in one day do not increase streak multiple times
Badge deduped by UNIQUE(userId, badgeCode)
```

Tables:

```text
HL_streaks
HL_badges
HL_userBadges
```

---

## 29. Pattern Detection Architecture

Pattern detection is not causal inference.

Allowed wording:

```text
berhubungan
cenderung
berdasarkan data tercatat
pola yang terlihat
```

Forbidden wording:

```text
menyebabkan secara pasti
terbukti menyebabkan
diagnosis final
```

Minimum data threshold:

```text
At least 14 days for sleep vs blood pressure
At least 14 days for medication vs metric
At least 14 days for weight vs blood pressure
```

Tables:

```text
HL_patternInsights
HL_measurementValues
HL_medicationLogs
```

---

## 30. PWA Architecture

PWA requirements:

```text
manifest.json
service worker
install prompt
offline shell
camera input support
cached static assets
browser notification permission flow
local draft storage
sync draft when online
```

Offline behavior:

```text
App shell works offline
Measurement draft saved to IndexedDB with locally generated draftId
Submit requires online
When online returns, user is prompted to sync
Sync uses POST /api/measurements/sync with draftId array
Backend uses draftId for idempotency to prevent duplicate submissions
Drafts with status submitted are skipped on re-sync
```

---

## 31. Accessibility Architecture

Accessibility modes:

```text
normal
senior
highContrast
```

Senior mode:

```text
large font
large buttons
one metric per screen
reduced navigation
high readability
simple language
```

High contrast mode:

```text
strong contrast
clear focus state
no low-contrast chart labels
large tap targets
```

---

## 32. Security Architecture

### 32.1 Auth Security

```text
Store passwordHash only
Store sessionTokenHash only
Use HTTP-only secure cookie
Rotate session on login
Revoke session on logout
Rate limit login
```

### 32.2 Data Security

```text
All user-owned queries filter by userId
RBAC enforced for caregiver access
R2 objects private
No public health URLs
Signed/proxied downloads only
Audit sensitive actions
```

### 32.3 Sensitive Fields

Should be encrypted or protected at application level:

```text
telegramChatId
contactPhone
contactEmail
medication notes
personal notes
push subscription keys
```

### 32.4 Audit Events

Log these actions:

```text
register
login
logout
profileUpdate
measurementSubmit
measurementDelete
manualOverride
telegramConnect
familyInvite
familyAccept
familyRevoke
emergencyAlert
reportGenerate
reportShare
accountDeleteRequest
```

---

## 33. Rate Limiting Architecture

Use lightweight D1-backed rate windows in:

```text
HL_apiRateLimits
```

Recommended route groups:

```text
authLogin
measurementExtract
aiRecommendation
reportGenerate
telegramTest
exportCsv
```

For free tier, prefer coarse windows:

```text
10 minutes
1 hour
1 day
```

---

## 34. Image Processing Architecture

### 34.1 Client-Side Processing

The browser is responsible for:

```text
resize to max 1280 px
compress quality around 50%
prefer webp
fallback jpeg
apply watermark on canvas
send final image only after submit
```

### 34.2 Server-Side Validation

The Worker validates:

```text
fileType is image/webp or image/jpeg or image/png
fileSize max configured limit (e.g. 2 MB) to prevent Worker memory overflow
attachment metadata matches payload
watermarked flag true
compressed flag true
```

The Worker cannot fully prove watermark content unless image analysis is added. For MVP, trust client plus audit. For stronger compliance later, add server-side watermark verification or generate watermark in Worker/WASM.

---

## 35. API Layer Design

### 35.1 Middleware Order

```text
requestId
securityHeaders
cors if needed
authParser
rateLimit
bodyLimit max configured limit
routeHandler
errorHandler
```

### 35.2 Repository Pattern

Use repositories to isolate D1 SQL:

```text
userRepository
profileRepository
metricRepository
measurementRepository
attachmentRepository
alertRepository
notificationRepository
familyRepository
reportRepository
```

### 35.3 Service Pattern

Use services for business logic:

```text
authService
measurementService
rulesEngine
aiExtractionService
aiRecommendationService
attachmentService
telegramService
notificationService
reportService
```

---

## 36. Error Handling

All API errors should use a consistent shape.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": []
  },
  "meta": {
    "requestId": "req_...",
    "durationMs": 123
  }
}
```

Do not expose:

```text
SQL query text
stack traces
secret values
telegram bot token
session token
hashed token
```

---

## 37. Deployment Architecture

### 37.1 Local Development

```bash
npm install
wrangler d1 execute multi_Ai_db --local --file=./migrations/schema.sql
wrangler dev
```

### 37.2 Remote D1 Migration

```bash
wrangler d1 execute multi_Ai_db --file=./migrations/schema.sql
```

### 37.3 Secrets

```bash
wrangler secret put SESSION_SECRET
wrangler secret put ENCRYPTION_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN
```

### 37.4 Deployment

```bash
wrangler deploy
```

---

## 38. Sprint Architecture Roadmap

## Sprint 1 — Core Capture Full Feature

Architecture focus:

```text
Auth
Onboarding
Metric catalog
Measurement input
AI extraction with timeout
Manual override
Validation
Submit
D1 persistence
R2 final evidence
Telegram after submit
Daily dashboard
Audit logs
```

## Sprint 2 — Health Intelligence Full Feature

Architecture focus:

```text
Rules engine
Popup interpretation
AI recommendation queue
3-day and 7-day comparison
Weekly dashboard
Monthly dashboard
Reports
Knowledge base
AI safety guardrails
```

## Sprint 3 — Family & Alert System Full Feature

Architecture focus:

```text
Telegram connection
Emergency alerts
Family/caregiver RBAC
Reminder cron
Browser push
Medication tracker
Caregiver dashboard
Alert log
```

## Sprint 4 — Advanced Health Companion Full Feature

Architecture focus:

```text
Doctor Ready PDF
Report sharing
Fasting timer
Gamification
Pattern insights
Senior mode
High contrast mode
PWA installable
Offline shell
Export and privacy tools
```

---

## 39. Performance Targets

| Area | Target |
|---|---:|
| AI extraction timeout | Configurable via DB |
| Submit response without PDF | <= 2000 ms target |
| Telegram push wait in submit | <= 1000 ms max, otherwise queue |
| Dashboard today | <= 500 ms target |
| Weekly dashboard | <= 1000 ms target |
| R2 evidence file | compressed around 50% |
| Original image storage | 0 |
| PDF generation | async only |

---

## 40. Free Tier Resource Strategy

### D1

```text
Use indexes already in schema
Avoid N+1 queries
Batch inserts on submit
Limit dashboard date ranges
Archive/export manually if needed later
```

### R2

```text
No original images
WebP preferred
Quality 50
PDF on demand only
No duplicate evidence files
```

### Workers AI

```text
AI Vision only on explicit button click
No auto-run when image selected
No retry by default
LLM recommendation queued and summary-based
Pattern insights only when data threshold met
```

### Queues

```text
Use only for non-blocking work
Batch notification processing
Avoid queue for every tiny UI action
```

---

## 41. Critical Implementation Notes

1. Measurement submit must work even if Workers AI is disabled.
2. AI extraction must never store original images.
3. Manual override is mandatory for all AI extracted values.
4. Rules engine output must be deterministic and stored with measurement value.
5. Emergency alert must be based on `severity = emergency` or `emergencyLevel = emergency` from rules.
6. Telegram failure must not roll back measurement save.
7. D1 schema must use `HL_` prefix and camelCase fields.
8. R2 evidence must be compressed and watermarked before upload.
9. Doctor Ready PDF must be generated on demand, not automatically every day.
10. Pattern detection must avoid causal claims.

---

## 42. Recommended First Build Order

```text
1. D1 schema apply
2. Hono app skeleton
3. Env binding verification
4. Auth/register/login/session
5. Onboarding profile
6. Metrics catalog endpoint
7. Measurement validate endpoint
8. AI extract endpoint with timeout
9. Measurement submit endpoint
10. R2 evidence upload
11. Telegram connect/test
12. Telegram after-submit queue
13. Dashboard today
14. Weekly/monthly dashboard
15. AI recommendation queue
16. Family/emergency system
17. PDF and PWA advanced features
```
