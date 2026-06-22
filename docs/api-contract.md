# API Contract — HL Health Companion

## 1. Document Status

```text
Product: HL Health Companion
Runtime: Cloudflare Workers
API Gateway: Hono.js
Database Binding: DB
R2 Binding: LOGS
Primary Database: multi_Ai_db
Primary R2 Bucket: multi-apps-ai-bucket
Contract Version: v1
```

This document defines the HTTP API contract for the HL Health Companion web application.

The API is designed for a Cloudflare Workers + Hono.js backend, Cloudflare D1 storage, Cloudflare R2 attachment storage, Workers AI Vision extraction, Workers AI text recommendations, Queues, Cron Triggers, Telegram notification, browser notification, PWA, report generation, family/caregiver sharing, and emergency alerts.

---

## 2. Core Rules

### 2.1 Product Safety Rule

The API must never treat AI output as final medical truth.

```text
finalValue
→ HL_metricRules lookup
→ status, severity, emergencyLevel
→ popup and rule-based recommendation
→ optional AI narrative
```

AI is only allowed to help with:

```text
image extraction
plain-language explanation
trend summary
comparison with previous data
safe lifestyle education
```

AI is not allowed to:

```text
diagnose disease
prescribe medication
change medication dosage
replace doctor consultation
send emergency decisions without rule-based severity
```

### 2.2 Original Image Rule

Original images must not be persisted.

```text
Temporary image for AI extraction: allowed in request memory only
Original image in R2: not allowed
Base64 image in D1: not allowed
Final R2 object: compressed + watermarked evidence image only
```

### 2.3 AI Timeout Rule

AI Vision extraction is optional and must not block user input.

```text
Target: <= 5 seconds
Timeout: Read from `HL_systemConfigs` (e.g. 5000 ms)
On timeout: return manual input fallback
No automatic retry by default
No OCR queue by default
```

### 2.4 Attachment Save Rule

Attachment is saved only after submit.

```text
User fills or verifies finalValue
User confirms popup interpretation
Client generates compressed watermarked image
Submit sends final values + final evidence image
Worker stores final evidence to R2 LOGS
Worker stores metadata to HL_measurementAttachments
```

---

## 3. Base URL and Versioning

```text
Base path: /api
Versioning: pathless v1 for first release
Future version example: /api/v2
```

All endpoints return JSON unless the endpoint explicitly streams a file.

---

## 4. Authentication

### 4.1 Auth Method

Use secure HTTP-only cookie session for browser requests.

```http
Cookie: hlSession=<opaqueSessionToken>
```

Optional bearer token may be supported later for mobile/native clients.

```http
Authorization: Bearer <token>
```

### 4.2 Required Auth

Default: all `/api/*` routes require auth except:

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/kb
GET  /api/kb/:slug
GET  /api/reports/share/:shareToken
POST /api/telegram/webhook
```

### 4.3 Session Storage

Sessions are stored in:

```text
HL_sessions
```

Store only hashed session token.

---

## 5. Common Headers

### 5.1 Request Headers

```http
Content-Type: application/json
Accept: application/json
```

For file upload:

```http
Content-Type: multipart/form-data
```

### 5.2 Response Headers

```http
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

For public knowledge base pages, short caching is allowed.

```http
Cache-Control: public, max-age=300
```

---

## 6. Standard Response Shapes

### 6.1 Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_01h...",
    "durationMs": 123
  }
}
```

### 6.2 Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input tidak valid.",
    "details": [
      {
        "field": "values[0].finalValue",
        "message": "finalValue wajib berupa angka."
      }
    ]
  },
  "meta": {
    "requestId": "req_01h...",
    "durationMs": 85
  }
}
```

### 6.3 Pagination Response

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "limit": 20,
    "cursor": "next_cursor",
    "hasMore": true
  },
  "meta": {
    "requestId": "req_01h...",
    "durationMs": 90
  }
}
```

---

## 7. Common Error Codes

| Code | HTTP | Meaning |
|---|---:|---|
| `UNAUTHORIZED` | 401 | User belum login atau session invalid |
| `FORBIDDEN` | 403 | User tidak punya permission |
| `NOT_FOUND` | 404 | Resource tidak ditemukan |
| `VALIDATION_ERROR` | 400 | Input tidak valid |
| `EMAIL_ALREADY_EXISTS` | 409 | Email register sudah terdaftar |
| `RATE_LIMITED` | 429 | Terlalu banyak request |
| `AI_TIMEOUT` | 408 | AI Vision melewati batas 5 detik |
| `AI_PARSE_FAILED` | 422 | AI response tidak bisa diparse |
| `RULE_NOT_FOUND` | 200/422 | Rule tidak ditemukan, fallback info digunakan |
| `R2_UPLOAD_FAILED` | 500 | Upload evidence/report gagal |
| `D1_ERROR` | 500 | Database gagal |
| `TELEGRAM_FAILED` | 202/500 | Telegram gagal dikirim, measurement tetap sukses |
| `INTERNAL_ERROR` | 500 | Error tidak terduga |

---

## 8. Enums

### 8.1 sex

```text
male
female
other
```

### 8.2 theme

```text
light
warm
dark
highContrast
```

### 8.3 accessibilityMode

```text
normal
senior
highContrast
```

### 8.4 deviceCode

```text
yuwellYx106
omronHem7194t1fl
sinocareM101
thermometer
bodyScale
manualInput
```

### 8.5 metricCode

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

### 8.6 severity

```text
normal
info
warning
high
critical
emergency
```

### 8.7 emergencyLevel

```text
none
watch
urgent
emergency
```

### 8.8 measurement source

```text
photo
upload
manual
mixed
```

### 8.9 notification channel

```text
inApp
telegram
browser
email
```

### 8.10 notification status

```text
pending
sent
failed
skipped
```

### 8.11 family role

```text
owner
caregiver
viewer
emergencyContact
doctorViewer
```

### 8.12 family status

```text
pending
active
rejected
revoked
expired
```

### 8.13 medication log status

```text
taken
skipped
missed
unknown
```

### 8.14 fasting type

```text
glucoseFasting
cholesterolTotal
uricAcid
general
```

### 8.15 report type

```text
daily
weekly
monthly
doctorReady30d
```

---

## 9. Auth API

## 9.1 Register

```http
POST /api/auth/register
```

### Request

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "displayName": "Budi"
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_01h...",
      "email": "user@example.com",
      "displayName": "Budi",
      "telegramEnabled": false,
      "browserPushEnabled": false
    },
    "requiresOnboarding": true
  }
}
```

### Duplicate Email Response 409

```json
{
  "success": false,
  "error": {
    "code": "EMAIL_ALREADY_EXISTS",
    "message": "Email sudah terdaftar.",
    "details": [
      {
        "field": "email",
        "message": "Gunakan email lain atau login."
      }
    ]
  }
}
```

### Writes

```text
HL_users
HL_sessions
HL_auditLogs
```

---

## 9.2 Login

```http
POST /api/auth/login
```

### Request

```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_01h...",
      "email": "user@example.com",
      "displayName": "Budi",
      "telegramEnabled": false,
      "browserPushEnabled": false
    },
    "profile": null,
    "requiresOnboarding": true
  }
}
```

### Side Effects

```text
Set-Cookie: hlSession=...
Update HL_users.lastLoginAt
Create HL_sessions
Create HL_auditLogs
```

---

## 9.3 Logout

```http
POST /api/auth/logout
```

### Response 200

```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

### Side Effects

```text
HL_sessions.revokedAt set
Clear cookie
```

---

## 9.4 Me

```http
GET /api/auth/me
```

### Response 200

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_01h...",
      "email": "user@example.com",
      "displayName": "Budi",
      "telegramEnabled": true,
      "browserPushEnabled": false
    },
    "profile": {
      "id": "prf_01h...",
      "sex": "male",
      "birthDate": "1980-01-01",
      "heightCm": 170,
      "timezone": "Asia/Jakarta",
      "accessibilityMode": "normal",
      "theme": "light"
    },
    "requiresOnboarding": false
  }
}
```

---

## 10. Profile API

## 10.1 Get Profile

```http
GET /api/profile
```

### Auth

```text
Requires authenticated `hlSession` cookie.
Returns 404 NOT_FOUND if onboarding/profile is not complete.
```

### Response 200

```json
{
  "success": true,
  "data": {
    "id": "prf_01h...",
    "userId": "usr_01h...",
    "sex": "male",
    "birthDate": "1980-01-01",
    "heightCm": 170,
    "timezone": "Asia/Jakarta",
    "accessibilityMode": "normal",
    "theme": "light",
    "emergencyConsent": false,
    "aiConsent": true,
    "dataShareConsent": false
  }
}
```

---

## 10.2 Onboarding

```http
POST /api/profile/onboarding
```

### Request

```json
{
  "displayName": "Budi",
  "sex": "male",
  "birthDate": "1980-01-01",
  "heightCm": 170,
  "timezone": "Asia/Jakarta",
  "theme": "light",
  "accessibilityMode": "normal",
  "aiConsent": true
}
```

### Validation

```text
Requires authenticated `hlSession` cookie.
displayName: minimum 2 characters.
sex: one of male, female, other.
birthDate: valid YYYY-MM-DD date, not future, minimum age 13 years.
heightCm: numeric, 50 to 250 cm.
timezone: valid IANA timezone string, e.g. Asia/Jakarta.
theme: one of light, warm, dark, highContrast.
accessibilityMode: one of normal, senior, highContrast.
```

### Response 201

```json
{
  "success": true,
  "data": {
    "profileId": "prf_01h...",
    "completed": true
  }
}
```

### Already Completed Response 400

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Onboarding sudah selesai.",
    "details": [
      {
        "field": "profile",
        "message": "Profil kesehatan sudah dibuat."
      }
    ]
  }
}
```

### Writes

```text
HL_userProfiles
HL_userConsents
HL_users.displayName update
HL_auditLogs
```

---

## 10.3 Update Profile

```http
PUT /api/profile
```

### Request

```json
{
  "heightCm": 171,
  "timezone": "Asia/Jakarta",
  "theme": "warm",
  "accessibilityMode": "senior"
}
```

### Validation

```text
Requires authenticated `hlSession` cookie.
heightCm: numeric, 50 to 250 cm.
timezone: valid IANA timezone string, e.g. Asia/Jakarta.
theme: optional; one of light, warm, dark, highContrast.
accessibilityMode: optional; one of normal, senior, highContrast.
Returns 404 NOT_FOUND if onboarding/profile is not complete.
Writes `profileUpdate` to HL_auditLogs.
```

### Response 200

```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

## 11. Metrics API

## 11.1 Get Metric Catalog

```http
GET /api/metrics/catalog
```

### Query

```text
active=true
```

### Response 200

```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "deviceCode": "yuwellYx106",
        "deviceName": "Yuwell YX106 Oximeter",
        "deviceType": "oximeter",
        "metrics": [
          {
            "metricCode": "spo2",
            "metricName": "Saturasi Oksigen",
            "unit": "%",
            "inputType": "mixed",
            "requiresAttachment": true,
            "requiresSex": false,
            "requiresFasting": false,
            "isCalculated": false,
            "requiredMetric": true,
            "physicalMin": 0,
            "physicalMax": 100
          }
        ]
      }
    ],
    "metrics": []
  }
}
```

### Reads

```text
HL_devices
HL_metricCatalog
HL_deviceMetrics
```

### Notes

```text
Frontend checklist must render from the active database rows returned by this endpoint.
requiredMetric comes from HL_deviceMetrics and identifies required vs optional device metrics.
```

---

## 11.2 Validate Metric Values

```http
POST /api/measurements/validate
```

### Request

```json
{
  "profileId": "prf_01h...",
  "measuredAt": "2026-06-20T20:15:00+07:00",
  "values": [
    {
      "metricCode": "spo2",
      "deviceCode": "yuwellYx106",
      "rawAiValue": 98,
      "finalValue": 98,
      "unit": "%",
      "confidence": 0.89
    },
    {
      "metricCode": "heartRate",
      "deviceCode": "yuwellYx106",
      "rawAiValue": 73,
      "finalValue": 73,
      "unit": "bpm",
      "confidence": 0.86
    }
  ]
}
```

> **Note:** `profileId` is required so the rules engine evaluates thresholds
> against the correct sex and age. When a caregiver validates metrics for
> another user, omitting `profileId` would cause incorrect rule evaluation.

### Response 200

```json
{
  "success": true,
  "data": {
    "valid": true,
    "hasEmergency": false,
    "results": [
      {
        "metricCode": "spo2",
        "metricName": "Saturasi Oksigen",
        "finalValue": 98,
        "unit": "%",
        "status": "Normal",
        "severity": "normal",
        "emergencyLevel": "none",
        "ruleId": "rule-spo2-normal",
        "popupTitle": "SpO2 Normal",
        "popupMessage": "Saturasi oksigen berada dalam rentang umum normal.",
        "recommendation": "Pertahankan aktivitas ringan, pola napas baik, dan cek ulang sesuai kebutuhan.",
        "sourceLabel": "CSV internal + clinical common threshold"
      }
    ],
    "warnings": []
  }
}
```

### Reads

```text
HL_userProfiles
HL_metricCatalog
HL_metricRules
```

---

## 12. AI Vision Extraction API

## 12.1 Extract Image

```http
POST /api/measurements/extract
```

### Content Type

```http
multipart/form-data
```

### Form Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `file` | File | Yes | Temporary image file for AI extraction (max size from config) |
| `deviceCode` | string | Yes | Device code |
| `metricGroup` | string | Yes | Logical group, example `oximeter`, `bloodPressure`, `sinocareGcu` |
| `selectedMetricCodes` | JSON string | Yes | Array of selected metric codes |
| `sessionDraftId` | string | No | Draft id if available |
| `maxFileSize` | — | — | Enforced by Worker: Read from `HL_systemConfigs`. Not a form field; documented here for client awareness. |

### Important Behavior

```text
Reject file larger than config limit before reading body
Do not write file to R2
Do not store base64 in D1
Call Workers AI Vision with configured timeout
Write extraction log to HL_aiExtractions
Return parsed metrics or manual fallback
```

### Success Response 200

```json
{
  "success": true,
  "data": {
    "timeout": false,
    "durationMs": 3200,
    "deviceCode": "yuwellYx106",
    "metricGroup": "oximeter",
    "metrics": [
      {
        "metricCode": "spo2",
        "rawAiValue": 98,
        "unit": "%",
        "confidence": 0.89
      },
      {
        "metricCode": "heartRate",
        "rawAiValue": 73,
        "unit": "bpm",
        "confidence": 0.86
      }
    ],
    "needsManualReview": false
  }
}
```

### Timeout Response 408

```json
{
  "success": false,
  "error": {
    "code": "AI_TIMEOUT",
    "message": "AI terlalu lama membaca foto. Silakan input manual."
  },
  "data": {
    "timeout": true,
    "durationMs": 5000,
    "manualInputAllowed": true
  }
}
```

### Failed Parse Response 422

```json
{
  "success": false,
  "error": {
    "code": "AI_PARSE_FAILED",
    "message": "AI tidak berhasil membaca angka dengan yakin. Silakan input manual."
  },
  "data": {
    "manualInputAllowed": true
  }
}
```

### Writes

```text
HL_aiExtractions
HL_auditLogs on suspicious/fail cases
```

---

## 13. Measurement API

## 13.1 Create Draft

```http
POST /api/measurements/drafts
```

### Request

```json
{
  "selectedMetrics": ["spo2", "heartRate", "systolic", "diastolic"],
  "draftData": {
    "deviceCodes": ["yuwellYx106", "omronHem7194t1fl"]
  },
  "expiresInMinutes": 120
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "draftId": "drf_01h...",
    "expiresAt": "2026-06-20T22:15:00+07:00"
  }
}
```

### Writes

```text
HL_measurementDrafts
```

---

## 13.2 Submit Measurement

```http
POST /api/measurements/submit
```

### Content Type

```http
multipart/form-data
```

### Form Fields

| Field | Type | Required | Description |
|---|---|---:|---|
| `payload` | JSON string | Yes | Measurement payload |
| `attachment:<metricCode>` | File | Conditional | Final compressed watermarked image for attachment-required metric |

### Payload JSON

```json
{
  "draftId": "drf_01h...",
  "profileId": "prf_01h...",
  "measuredAt": "2026-06-20T20:15:00+07:00",
  "source": "mixed",
  "notes": "Pengukuran malam",
  "values": [
    {
      "metricCode": "spo2",
      "deviceCode": "yuwellYx106",
      "rawAiValue": 98,
      "finalValue": 98,
      "unit": "%",
      "confidence": 0.89,
      "manualOverride": false
    },
    {
      "metricCode": "heartRate",
      "deviceCode": "yuwellYx106",
      "rawAiValue": 73,
      "finalValue": 73,
      "unit": "bpm",
      "confidence": 0.86,
      "manualOverride": false
    },
    {
      "metricCode": "bodyWeight",
      "deviceCode": "bodyScale",
      "rawAiValue": null,
      "finalValue": 78.4,
      "unit": "kg",
      "confidence": null,
      "manualOverride": false
    }
  ],
  "attachmentMap": [
    {
      "metricCode": "spo2",
      "formField": "attachment:spo2",
      "fileName": "spo2.webp",
      "fileType": "image/webp",
      "imageWidth": 1280,
      "imageHeight": 720,
      "compressionQuality": 50,
      "watermarked": true,
      "compressed": true
    }
  ]
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "sessionId": "ses_01h...",
    "hasEmergency": false,
    "values": [
      {
        "id": "val_01h...",
        "metricCode": "spo2",
        "finalValue": 98,
        "unit": "%",
        "status": "Normal",
        "severity": "normal",
        "emergencyLevel": "none",
        "manualOverride": false
      }
    ],
    "attachments": [
      {
        "id": "att_01h...",
        "metricCode": "spo2",
        "r2Key": "HL/users/usr_01h/measurements/ses_01h/spo2-att_01h.webp"
      }
    ],
    "notifications": {
      "telegramQueued": true,
      "emergencyQueued": false
    },
    "recommendationQueued": true
  }
}
```

### Transaction Requirements

```text
1. Validate physical range
2. Evaluate HL_metricRules
3. Create HL_measurementSessions
4. Insert HL_measurementValues batch
5. Upload final evidence images to R2 LOGS
6. Insert HL_measurementAttachments batch
7. If emergency: insert HL_alerts
8. Insert HL_auditLogs
9. Enqueue telegram summary
10. Enqueue emergency alerts if applicable
11. Enqueue AI recommendation
12. Update streaks best effort
```

### Writes

```text
HL_measurementSessions
HL_measurementValues
HL_measurementAttachments
HL_alerts
HL_notifications
HL_auditLogs
HL_streaks
HL_measurementDrafts
R2 LOGS
Queue: notificationQueue
Queue: recommendationQueue
```

---

## 13.3 Get Measurement History

```http
GET /api/measurements/history
```

### Query

| Param | Type | Required | Description |
|---|---|---:|---|
| `from` | ISO date | No | Range start |
| `to` | ISO date | No | Range end |
| `metricCode` | string | No | Filter metric |
| `limit` | number | No | Default 20, max 100 |
| `cursor` | string | No | Pagination cursor |

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "sessionId": "ses_01h...",
      "measuredAt": "2026-06-20T20:15:00+07:00",
      "source": "mixed",
      "hasAttachment": true,
      "hasEmergency": false,
      "values": [
        {
          "metricCode": "spo2",
          "finalValue": 98,
          "unit": "%",
          "status": "Normal",
          "severity": "normal"
        }
      ]
    }
  ],
  "pagination": {
    "limit": 20,
    "cursor": null,
    "hasMore": false
  }
}
```

---

## 13.4 Get Measurement Detail

```http
GET /api/measurements/:id
```

### Response 200

```json
{
  "success": true,
  "data": {
    "session": {
      "id": "ses_01h...",
      "measuredAt": "2026-06-20T20:15:00+07:00",
      "source": "mixed",
      "notes": "Pengukuran malam"
    },
    "values": [],
    "attachments": [],
    "alerts": [],
    "aiRecommendation": null
  }
}
```

---

## 13.5 Delete Measurement

```http
DELETE /api/measurements/:id
```

### Behavior

Soft delete is preferred if implemented later. For first release, hard delete is allowed only for owner and must remove R2 evidence objects.

### Response 200

```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

### Writes

```text
HL_auditLogs
Delete related R2 objects
Delete HL_measurementSessions cascade
```

---

## 13.6 Get Attachment Download URL

```http
GET /api/measurements/:id/attachments/:attachmentId/url
```

### Response 200

```json
{
  "success": true,
  "data": {
    "url": "https://signed-or-proxied-url",
    "expiresInSeconds": 300
  }
}
```

### Security

```text
Must check session owner or family permission
Do not expose public R2 object URL
Prefer Worker-proxied stream or signed URL
```

---

## 13.7 Sync Offline Draft

```http
POST /api/measurements/sync
```

### Purpose

Sync locally saved measurement drafts when device comes back online. Uses draftId for idempotency to prevent duplicate submissions.

### Request

```json
{
  "drafts": [
    {
      "draftId": "drf_local_01h...",
      "profileId": "prf_01h...",
      "measuredAt": "2026-06-20T20:15:00+07:00",
      "source": "manual",
      "notes": "Draft offline",
      "values": [
        {
          "metricCode": "systolic",
          "deviceCode": "omronHem7194t1fl",
          "rawAiValue": null,
          "finalValue": 130,
          "unit": "mmHg",
          "confidence": null,
          "manualOverride": false
        }
      ]
    }
  ]
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "synced": 1,
    "skippedDuplicates": 0,
    "results": [
      {
        "draftId": "drf_local_01h...",
        "sessionId": "ses_01h...",
        "status": "created"
      }
    ]
  }
}
```

### Idempotency

```text
If draftId already exists in HL_measurementDrafts with status submitted,
skip and return status = alreadySynced.
This prevents duplicate submissions from network retries.
```

### Writes

```text
HL_measurementDrafts
HL_measurementSessions
HL_measurementValues
HL_auditLogs
```

---

## 14. Dashboard API

## 14.1 Today Dashboard

```http
GET /api/dashboard/today
```

### Query

```text
date=2026-06-20
profileUserId=optionalForCaregiverView
```

### Response 200

```json
{
  "success": true,
  "data": {
    "date": "2026-06-20",
    "cards": [
      {
        "metricCode": "spo2",
        "metricName": "Saturasi Oksigen",
        "latestValue": 98,
        "unit": "%",
        "status": "Normal",
        "severity": "normal",
        "measuredAt": "2026-06-20T20:15:00+07:00"
      }
    ],
    "bloodPressure": {
      "systolic": 142,
      "diastolic": 91,
      "pulse": 75,
      "status": "Hipertensi Tahap 2",
      "severity": "high"
    },
    "alerts": [],
    "streak": {
      "currentCount": 3,
      "bestCount": 7
    }
  }
}
```

---

## 14.2 Weekly Dashboard

```http
GET /api/dashboard/weekly
```

### Query

```text
weekStart=2026-06-15
```

### Response 200

```json
{
  "success": true,
  "data": {
    "period": "7d",
    "metrics": [
      { "metricCode": "systolic", "avgValue": 134.5, "minValue": 120, "maxValue": 152, "cnt": 4 }
    ],
    "daily": [
      { "day": "2026-06-21", "metricCode": "systolic", "avgValue": 132 }
    ],
    "measurementDays": 5,
    "bestDay": { "day": "2026-06-21", "sessionCount": 2 },
    "worstDay": { "day": "2026-06-17", "sessionCount": 1 },
    "alertCount": 1,
    "adherence": 86
  }
}
```

---

## 14.3 Monthly Dashboard

```http
GET /api/dashboard/monthly
```

### Query

```text
month=2026-06
```

### Response 200

```json
{
  "success": true,
  "data": {
    "period": "30d",
    "metrics": [
      { "metricCode": "systolic", "avgValue": 134.5, "minValue": 120, "maxValue": 152, "cnt": 18 }
    ],
    "alertCount": 2,
    "measurementDays": 12,
    "daily": [
      { "day": "2026-06-21", "sessionCount": 2 }
    ],
    "latest": [
      { "metricCode": "systolic", "finalValue": 142, "unit": "mmHg", "status": "Tinggi", "severity": "warning", "measuredAt": "2026-06-21T07:00:00.000Z" }
    ]
  }
}
```

---

## 14.4 Comparison

```http
GET /api/dashboard/comparison
```

### Query

```text
metricCode=systolic
asOfDate=2026-06-20
```

### Response 200

```json
{
  "success": true,
  "data": {
    "metricCode": "systolic",
    "todayValue": 142,
    "threeDayAverage": 134,
    "sevenDayAverage": 136,
    "delta3Day": 8,
    "delta7Day": 6,
    "status": "up",
    "hasEnough3DayData": true,
    "hasEnough7DayData": true
  }
}
```

---

## 15. AI Recommendation API

## 15.1 Generate Recommendation

```http
POST /api/ai/recommendation
```

### Request

```json
{
  "sessionId": "ses_01h...",
  "forceRegenerate": false
}
```

### Response 202

```json
{
  "success": true,
  "data": {
    "queued": true,
    "sessionId": "ses_01h..."
  }
}
```

### Background Job Input Summary

```json
{
  "today": {
    "spo2": 98,
    "systolic": 142,
    "diastolic": 91,
    "sleepDuration": 5.5
  },
  "threeDayComparison": {
    "systolicDelta": 8,
    "sleepDelta": -1.5
  },
  "sevenDayComparison": {
    "systolicAverage": 136,
    "sleepAverage": 6.2
  },
  "ruleStatuses": [
    {
      "metricCode": "systolic",
      "status": "Hipertensi Tahap 2",
      "severity": "high"
    }
  ]
}
```

---

## 15.2 List AI Recommendations

```http
GET /api/ai/recommendations
```

### Query

```text
limit=20
cursor=optional
```

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "rec_01h...",
      "sessionId": "ses_01h...",
      "summaryText": "Hari ini tekanan darah Anda lebih tinggi dibanding rata-rata 3 hari terakhir...",
      "safetyStatus": "safe",
      "createdAt": "2026-06-20T20:16:00+07:00"
    }
  ]
}
```

---

## 16. Reports API

## 16.1 Daily Report

```http
GET /api/reports/daily
```

### Query

```text
date=2026-06-20
```

### Response 200

```json
{
  "success": true,
  "data": {
    "date": "2026-06-20",
    "values": [],
    "alerts": [],
    "recommendation": null,
    "attachments": []
  }
}
```

---

## 16.2 Weekly Report

```http
GET /api/reports/weekly
```

### Query

```text
weekStart=2026-06-15
```

### Response 200

```json
{
  "success": true,
  "data": {
    "rangeStart": "2026-06-15",
    "rangeEnd": "2026-06-21",
    "summary": {},
    "trends": {},
    "alerts": [],
    "medicationAdherence": {}
  }
}
```

---

## 16.3 Monthly Report

```http
GET /api/reports/monthly
```

### Query

```text
month=2026-06
```

### Response 200

```json
{
  "success": true,
  "data": {
    "month": "2026-06",
    "summary": {},
    "trends": {},
    "patternInsights": []
  }
}
```

---

## 16.4 Generate Doctor Ready PDF

```http
POST /api/reports/doctorReady30d
```

### Request

```json
{
  "rangeEnd": "2026-06-20",
  "includeAttachments": true,
  "includeMedicationLogs": true,
  "includeAiSummary": true
}
```

### Response 202

```json
{
  "success": true,
  "data": {
    "reportId": "rpt_01h...",
    "status": "processing",
    "queued": true
  }
}
```

### Writes

```text
HL_reports
Queue: pdfQueue
```

---

## 16.5 Download Report

```http
GET /api/reports/:id/download
```

### Response

```http
Content-Type: text/html; charset=utf-8
Content-Disposition: inline
```

### Body Format

The body is HTML containing the 30-day doctor report. All timestamps
inside the HTML use the Indonesian short-month format
`dd MMM yyyy HH:mm` (e.g., `23 Jun 2026 18:30`). Indonesian short month
names: `Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des`.

### Access Rules

```text
Owner can download
Caregiver cannot download unless permission enabled
Doctor share uses /api/reports/share/:shareToken
```

---

## 16.6 Create Doctor Share Link

```http
POST /api/reports/:id/share
```

### Request

```json
{
  "recipientLabel": "Dokter keluarga",
  "expiresInDays": 7
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "shareUrl": "https://app.example.com/reports/share/shr_xxx",
    "expiresAt": "2026-06-27T20:15:00+07:00"
  }
}
```

### Writes

```text
HL_reportShares
HL_auditLogs
```

---

## 16.7 Public Report Share

```http
GET /api/reports/share/:shareToken
```

### Response

PDF stream if token is valid and not expired.

---

## 17. Telegram API

## 17.1 Connect Telegram

```http
POST /api/telegram/connect
```

### Response 200

```json
{
  "success": true,
  "data": {
    "verificationCode": "HL-123456",
    "botUsername": "YourBotName",
    "expiresInMinutes": 10,
    "instructions": "Kirim kode ini ke bot Telegram untuk verifikasi."
  }
}
```

### Writes

```text
HL_telegramLinks
```

---

## 17.2 Verify Telegram

```http
POST /api/telegram/verify
```

### Request

```json
{
  "verificationCode": "HL-123456",
  "telegramChatId": "123456789",
  "telegramUsername": "budi"
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "verified": true,
    "enabled": true
  }
}
```

---

## 17.3 Test Telegram

```http
POST /api/telegram/test
```

### Response 200

```json
{
  "success": true,
  "data": {
    "sent": true,
    "botTokenValid": true,
    "error": null
  }
}
```

Notes:
- Telegram bot token is resolved from `HL_systemConfigs.telegramBotToken`; legacy `TELEGRAM_BOT_TOKEN` env is used only as fallback when the DB value is empty.
- `POST /api/telegram/test` validates the token with Telegram `getMe` before trying to send a message.
- If the token is missing or invalid, response stays `200` with `sent: false`, `botTokenValid: false`, and `error` explaining the Telegram/config failure.

---

## 17.4 Update Telegram Settings

```http
PUT /api/telegram/settings
```

### Request

```json
{
  "telegramSubmitSummary": true,
  "telegramEmergencyAlert": true
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

## 17.5 Telegram Webhook

```http
POST /api/telegram/webhook
```

### Purpose

Receives Telegram bot updates for verification code messages.

### Security

```text
Validate secret path or secret header
Do not expose bot token
Rate limit webhook requests
```

---

## 18. Notifications API

## 18.1 List Notifications

```http
GET /api/notifications
```

### Query

```text
status=pending
limit=20
cursor=optional
```

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "ntf_01h...",
      "channel": "inApp",
      "notificationType": "measurementSubmit",
      "title": "Pengukuran tersimpan",
      "message": "Data SpO2 98% berhasil tersimpan.",
      "status": "sent",
      "createdAt": "2026-06-20T20:15:00+07:00"
    }
  ]
}
```

---

## 18.2 Register Browser Push

```http
POST /api/notifications/browser/subscribe
```

### Request

```json
{
  "endpoint": "https://push.example/...",
  "keys": {
    "p256dh": "base64",
    "auth": "base64"
  },
  "userAgent": "Chrome Android"
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "subscribed": true
  }
}
```

### Writes

```text
HL_pushSubscriptions
HL_users.browserPushEnabled
```

---

## 18.3 Reminder Settings

```http
GET /api/reminders
POST /api/reminders
PUT /api/reminders/:id
DELETE /api/reminders/:id
```

### Create Request

```json
{
  "reminderType": "morningMeasurement",
  "enabled": true,
  "scheduleTime": "07:00",
  "timezone": "Asia/Jakarta",
  "channel": "telegram",
  "payload": {
    "message": "Waktunya cek tekanan darah pagi."
  }
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "reminderId": "rem_01h..."
  }
}
```

---

## 19. Family and Caregiver API

## 19.1 Invite Family

```http
POST /api/family/invite
```

### Request

```json
{
  "inviteEmail": "caregiver@example.com",
  "role": "caregiver",
  "permissions": {
    "canViewDashboard": true,
    "canInputMeasurement": false,
    "canReceiveAlert": true
  },
  "expiresInDays": 7
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "inviteId": "inv_01h...",
    "status": "pending",
    "expiresAt": "2026-06-27T20:15:00+07:00"
  }
}
```

### Writes

```text
HL_familyInvites
HL_familyLinks optional pending
HL_notifications
HL_auditLogs
```

---

## 19.2 Accept Family Invite

```http
POST /api/family/accept
```

### Request

```json
{
  "inviteToken": "invite_plain_token"
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "familyLinkId": "fam_01h...",
    "status": "active",
    "role": "caregiver"
  }
}
```

---

## 19.3 List Family Links

```http
GET /api/family/links
```

### Response 200

```json
{
  "success": true,
  "data": {
    "ownedLinks": [],
    "linkedToMe": []
  }
}
```

---

## 19.4 Update Family Link

```http
PUT /api/family/:id
```

### Request

```json
{
  "role": "caregiver",
  "canViewDashboard": true,
  "canInputMeasurement": false,
  "canReceiveAlert": true,
  "status": "active"
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

## 19.5 Delete Family Link

```http
DELETE /api/family/:id
```

### Response 200

```json
{
  "success": true,
  "data": {
    "revoked": true
  }
}
```

---

## 19.6 Caregiver Dashboard

```http
GET /api/family/caregiver/dashboard
```

### Response 200

```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "ownerUserId": "usr_01h...",
        "displayName": "Orang Tua",
        "role": "caregiver",
        "lastMeasurementAt": "2026-06-20T20:15:00+07:00",
        "latestAlerts": []
      }
    ]
  }
}
```

---

## 20. Emergency Contacts and Alerts API

## 20.1 Add Emergency Contact

```http
POST /api/emergency/contacts
```

### Request

```json
{
  "contactName": "Ani",
  "contactRelation": "Pasangan",
  "contactPhone": "+628123456789",
  "contactEmail": "ani@example.com",
  "telegramChatId": "123456789",
  "consentGiven": true,
  "enabled": true
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "contactId": "emg_01h..."
  }
}
```

---

## 20.2 List Alerts

```http
GET /api/alerts
```

### Query

```text
severity=emergency
acknowledged=false
limit=20
```

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "alt_01h...",
      "metricCode": "spo2",
      "finalValue": 88,
      "unit": "%",
      "status": "Hipoksemia Berat",
      "severity": "emergency",
      "alertType": "emergency",
      "message": "SpO2 sangat rendah.",
      "acknowledged": false,
      "createdAt": "2026-06-20T20:15:00+07:00"
    }
  ]
}
```

---

## 20.3 Acknowledge Alert

```http
POST /api/alerts/:id/acknowledge
```

### Request

```json
{
  "note": "Sudah dicek ulang."
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "acknowledged": true,
    "acknowledgedAt": "2026-06-20T20:20:00+07:00"
  }
}
```

---

## 21. Medication API

## 21.1 List Medications

```http
GET /api/medications
```

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "med_01h...",
      "medicationName": "Amlodipine",
      "dosageText": "5 mg",
      "scheduleText": "Pagi setelah makan",
      "active": true
    }
  ]
}
```

---

## 21.2 Create Medication

```http
POST /api/medications
```

### Request

```json
{
  "medicationName": "Amlodipine",
  "dosageText": "5 mg",
  "scheduleText": "Pagi setelah makan",
  "active": true,
  "schedules": [
    {
      "scheduleTime": "07:00",
      "timezone": "Asia/Jakarta"
    }
  ]
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "medicationId": "med_01h..."
  }
}
```

---

## 21.3 Update Medication

```http
PUT /api/medications/:id
```

### Request

```json
{
  "medicationName": "Amlodipine",
  "dosageText": "5 mg",
  "scheduleText": "Pagi",
  "active": true
}
```

---

## 21.4 Log Medication

```http
POST /api/medications/:id/log
```

### Request

```json
{
  "takenAt": "2026-06-20T07:00:00+07:00",
  "status": "taken",
  "note": "Setelah sarapan"
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "logId": "mlog_01h..."
  }
}
```

---

## 21.5 Medication Logs

```http
GET /api/medications/logs
```

### Query

```text
from=2026-06-01
to=2026-06-30
```

---

## 22. Fasting API

## 22.1 Start Fasting

```http
POST /api/fasting/start
```

### Request

```json
{
  "fastingType": "glucoseFasting",
  "targetHours": 8,
  "startedAt": "2026-06-20T22:00:00+07:00"
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "fastingSessionId": "fst_01h...",
    "targetAt": "2026-06-21T06:00:00+07:00",
    "status": "active"
  }
}
```

---

## 22.2 Stop Fasting

```http
POST /api/fasting/stop
```

### Request

```json
{
  "fastingSessionId": "fst_01h...",
  "endedAt": "2026-06-21T06:10:00+07:00",
  "status": "completed"
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "status": "completed"
  }
}
```

---

## 22.3 Current Fasting

```http
GET /api/fasting/current
```

### Response 200

```json
{
  "success": true,
  "data": {
    "active": true,
    "session": {
      "id": "fst_01h...",
      "fastingType": "glucoseFasting",
      "targetHours": 8,
      "startedAt": "2026-06-20T22:00:00+07:00",
      "targetAt": "2026-06-21T06:00:00+07:00"
    }
  }
}
```

---

## 23. Gamification API

## 23.1 Get Streaks

```http
GET /api/gamification/streaks
```

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "streakType": "measurementDaily",
      "currentCount": 7,
      "bestCount": 12,
      "lastDate": "2026-06-20"
    }
  ]
}
```

---

## 23.2 Get Badges

```http
GET /api/gamification/badges
```

### Response 200

```json
{
  "success": true,
  "data": {
    "earned": [],
    "available": []
  }
}
```

---

## 24. Pattern Insights API

## 24.1 Generate Pattern Insights

```http
POST /api/patterns/generate
```

### Request

```json
{
  "rangeDays": 14,
  "insightTypes": ["sleepBloodPressure", "weightBloodPressure", "medicationMetric"]
}
```

### Response 202

```json
{
  "success": true,
  "data": {
    "queued": true
  }
}
```

---

## 24.2 List Pattern Insights

```http
GET /api/patterns
```

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "id": "ins_01h...",
      "insightType": "sleepBloodPressure",
      "summaryText": "Berdasarkan data tercatat, tekanan sistolik cenderung lebih tinggi pada hari tidur kurang dari 6 jam.",
      "confidence": 0.62,
      "rangeStart": "2026-06-06",
      "rangeEnd": "2026-06-20"
    }
  ]
}
```

---

## 25. Knowledge Base API

## 25.1 List Articles

```http
GET /api/kb
```

### Query

```text
category=device
```

### Response 200

```json
{
  "success": true,
  "data": [
    {
      "slug": "yuwell-yx106",
      "title": "Panduan Yuwell YX106 Oximeter",
      "category": "device",
      "sortOrder": 10
    }
  ]
}
```

---

## 25.2 Get Article

```http
GET /api/kb/:slug
```

### Response 200

```json
{
  "success": true,
  "data": {
    "slug": "yuwell-yx106",
    "title": "Panduan Yuwell YX106 Oximeter",
    "category": "device",
    "contentMarkdown": "## Yuwell YX106 Oximeter..."
  }
}
```

---

## 26. Settings API

## 26.1 Update UI Settings

```http
PUT /api/settings/ui
```

### Request

```json
{
  "theme": "dark",
  "accessibilityMode": "senior"
}
```

### Validation

```text
Requires authenticated `hlSession` cookie.
theme: one of light, warm, dark, highContrast.
accessibilityMode: one of normal, senior, highContrast.
Returns 404 NOT_FOUND if onboarding/profile is not complete.
Writes `uiSettingsUpdate` to HL_auditLogs.
```

### Response 200

```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

## 26.2 Update Consent

```http
PUT /api/settings/consent
```

### Request

```json
{
  "aiConsent": true,
  "emergencyConsent": true,
  "dataShareConsent": false
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "updated": true
  }
}
```

---

## 27. Data Export API

## 27.1 Export CSV

```http
GET /api/export/csv
```

### Query

```text
from=2026-06-01
to=2026-06-30
```

### Response

```http
Content-Type: text/csv
Content-Disposition: attachment; filename="hl-health-export.csv"
```

### CSV Columns

```text
measuredAt,metricCode,finalValue,unit,status,severity,manualOverride
```

---

## 27.2 Delete Account Data Request

```http
POST /api/privacy/deleteAccount
```

### Request

```json
{
  "confirmText": "DELETE MY DATA"
}
```

### Response 202

```json
{
  "success": true,
  "data": {
    "queued": true,
    "message": "Permintaan penghapusan data diterima."
  }
}
```

---

## 28. Queue Event Contracts

## 28.1 notificationQueue

### Submit Summary Event

```json
{
  "eventType": "telegramSubmitSummary",
  "userId": "usr_01h...",
  "sessionId": "ses_01h...",
  "createdAt": "2026-06-20T20:15:00+07:00"
}
```

### Emergency Alert Event

```json
{
  "eventType": "emergencyAlert",
  "userId": "usr_01h...",
  "sessionId": "ses_01h...",
  "alertId": "alt_01h...",
  "createdAt": "2026-06-20T20:15:00+07:00"
}
```

---

## 28.2 recommendationQueue

```json
{
  "eventType": "generateRecommendation",
  "userId": "usr_01h...",
  "sessionId": "ses_01h...",
  "createdAt": "2026-06-20T20:15:00+07:00"
}
```

---

## 28.3 pdfQueue

```json
{
  "eventType": "generateDoctorReadyPdf",
  "userId": "usr_01h...",
  "reportId": "rpt_01h...",
  "rangeStart": "2026-05-22",
  "rangeEnd": "2026-06-20",
  "createdAt": "2026-06-20T20:15:00+07:00"
}
```

---

## 28.4 reminderQueue

```json
{
  "eventType": "scheduledReminder",
  "userId": "usr_01h...",
  "reminderType": "morningMeasurement",
  "channel": "telegram",
  "createdAt": "2026-06-20T07:00:00+07:00"
}
```

---

## 29. Cron Contracts

## 29.1 Reminder Cron

```text
Runs: every 15 or 30 minutes depending free-tier budget
Purpose: find due HL_reminderSettings and enqueue notification events
```

### Scheduled Handler Output

```json
{
  "processed": 10,
  "queued": 8,
  "skipped": 2
}
```

---

## 29.2 Daily Maintenance Cron

```text
Runs: once daily
Purpose: expire drafts, expire invites, expire fasting sessions, update missed medication logs
```

---

## 30. Rate Limit Policy

Store lightweight counters in:

```text
HL_apiRateLimits
```

Recommended limits for free tier:

| Route Group | Limit |
|---|---:|
| `/api/auth/login` | 10 per 10 minutes per ipHash/email |
| `/api/measurements/extract` | 30 per day per user |
| `/api/ai/recommendation` | 30 per day per user |
| `/api/reports/doctorReady30d` | 5 per day per user |
| `/api/telegram/test` | 5 per hour per user |
| `/api/export/csv` | 10 per day per user |

---

## 31. Free Tier Efficiency Rules

### 31.1 AI

```text
No background OCR by default
No automatic AI retry
5-second extraction timeout
AI recommendation uses summary JSON only
Pattern insights require minimum data threshold
```

### 31.2 D1

```text
Use indexed range queries
Use batch insert on submit
Avoid storing large JSON blobs
Do not store image base64
Cache metric catalog in Worker memory where possible
```

### 31.3 R2

```text
Store only final compressed watermarked evidence
Use webp quality 50 where possible
Generate PDF only on demand
Use signed/proxied download, no public objects
```

### 31.4 Queues

```text
Use queues for Telegram, emergency, AI recommendations, PDF, reminders
Do not use queue for default OCR path
Submit response should not wait for non-critical queue jobs
```

---

## 32. Security Requirements

```text
All owner resources must filter by userId
Family/caregiver access must pass RBAC check
R2 key access must be validated before stream/download
Telegram chat id should be encrypted or protected at application layer
Emergency contact consent must be recorded before alerting
All major write operations must create HL_auditLogs
Never expose passwordHash, sessionTokenHash, verificationCodeHash, inviteTokenHash, shareTokenHash
```

Sensitive values are encrypted at rest with AES-GCM when `ENCRYPTION_KEY` is configured as a Worker secret:

- `HL_telegramLinks.telegramChatId`
- `HL_emergencyContacts.contactName`
- `HL_emergencyContacts.contactPhone`
- `HL_emergencyContacts.telegramChatId`
- `HL_medicationLogs.note`
- `HL_measurementSessions.notes`

Ciphertext uses the `enc:v1:` prefix. Read paths decrypt automatically and legacy plaintext remains readable until migrated.

---

## 34. System Config API (Admin Only)

```text
Requires role: admin or owner
```

## 34.1 List Configs

```http
GET /api/admin/configs
```

### Response 200

```json
{
  "success": true,
  "data": {
    "configs": [
      {
        "configKey": "aiExtractTimeoutMs",
        "configValue": "5000",
        "dataType": "number",
        "description": "Timeout in milliseconds for AI Vision extraction",
        "updatedAt": "2026-06-20T10:00:00Z"
      },
      {
        "configKey": "aiVisionModel",
        "configValue": "@cf/meta/llama-3.2-11b-vision-instruct",
        "dataType": "string",
        "description": "Cloudflare Workers AI vision model used for device display extraction",
        "updatedAt": "2026-06-20T10:00:00Z"
      },
      {
        "configKey": "aiTextEndpoint",
        "configValue": "https://9router.krpmerch.biz.id/v1",
        "dataType": "string",
        "description": "OpenAI-compatible text AI base URL",
        "updatedAt": "2026-06-20T10:00:00Z"
      },
      {
        "configKey": "aiTextModels",
        "configValue": "[\"cmc/deepseek/deepseek-v4-pro\",\"nvidia/z-ai/glm-5.1\",\"ollama/glm-4.7\"]",
        "dataType": "json",
        "description": "Ordered text AI model fallback list",
        "updatedAt": "2026-06-20T10:00:00Z"
      },
      {
        "configKey": "telegramBotToken",
        "configValue": "",
        "dataType": "string",
        "description": "Telegram bot token managed from system config",
        "updatedAt": "2026-06-20T10:00:00Z"
      }
    ]
  }
}
```

---

## 34.2 Update Config

```http
PUT /api/admin/configs/:configKey
```

### Request

```json
{
  "configValue": "7000"
}
```

### Response 200

```json
{
  "success": true,
  "data": {
    "updated": true,
    "cacheInvalidated": true
  }
}
```

## 34.3 Create Config

```http
POST /api/admin/configs
```

Admin only. Creates a new non-protected system config row.

### Request

```json
{
  "configKey": "featureDoctorExportEnabled",
  "configValue": "true",
  "dataType": "boolean",
  "description": "Enable doctor export feature"
}
```

### Response 201

```json
{
  "success": true,
  "data": {
    "created": true,
    "configKey": "featureDoctorExportEnabled",
    "cacheInvalidated": true
  }
}
```

## 34.4 Delete Config

```http
DELETE /api/admin/configs/:configKey
```

Admin only. Protected required keys such as `aiExtractTimeoutMs`, `aiVisionModel`, upload limit, rate-limit, Telegram, and AI core keys cannot be deleted.

### Response 200

```json
{
  "success": true,
  "data": {
    "deleted": true,
    "cacheInvalidated": true
  }
}
```

---

## 35. Minimum Endpoint Implementation Order

```text
1. POST /api/auth/register
2. POST /api/auth/login
3. GET /api/auth/me
4. POST /api/profile/onboarding
5. GET /api/metrics/catalog
6. POST /api/measurements/extract
7. POST /api/measurements/validate
8. POST /api/measurements/submit
9. GET /api/dashboard/today
10. POST /api/telegram/connect
11. POST /api/telegram/test
12. GET /api/dashboard/weekly
13. GET /api/dashboard/monthly
14. POST /api/reports/doctorReady30d
```

---

## 36. Production UAT Endpoint Delta - 2026-06-21

These endpoints are required by the refactored Sprint 1-4 frontend UAT flow.

### Measurement History

```text
GET /api/measurements/history
```

Returns authenticated measurement sessions with values and attachment references.

```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "ses_x",
        "measuredAt": "2026-06-21T00:00:00.000Z",
        "source": "manual",
        "hasAttachment": 1,
        "hasEmergency": 0,
        "values": [
          {
            "id": "val_x",
            "metricCode": "blood_pressure_systolic",
            "finalValue": 145,
            "unit": "mmHg",
            "status": "warning",
            "severity": "medium",
            "manualOverride": 1,
            "attachments": []
          }
        ]
      }
    ]
  },
  "meta": {}
}
```

### Measurement Evidence Stream

```text
GET /api/measurements/attachments/:id
```

Streams a compressed, watermarked evidence object after authenticated ownership verification.

### AI Assistant

```text
POST /api/ai/assistant
```

Request:

```json
{
  "question": "Saran makan malam untuk hipertensi"
}
```

Response includes a safe text reply plus current user vitals context. AI text must not diagnose, prescribe dose changes, or decide medical severity.

Example response:

```json
{
  "success": true,
  "data": {
    "reply": "Pilih makan malam rendah garam...",
    "model": "cmc/deepseek/deepseek-v4-pro",
    "usedFallback": false,
    "vitals": [
      {
        "metricCode": "systolic",
        "finalValue": 145,
        "unit": "mmHg",
        "status": "Tinggi",
        "severity": "warning",
        "measuredAt": "2026-06-22T07:00:00.000Z"
      }
    ],
    "profile": {
      "displayName": "Budi",
      "heightCm": 170,
      "sex": "male",
      "birthDate": "1970-01-01"
    }
  }
}
```

Text model provider is configured through `HL_systemConfigs.aiTextEndpoint`, `aiTextModels`, `aiTextDefaultModel`, and optional `aiTextApiKey`. The Worker tries configured models in order and falls back to deterministic safe text if the provider is unavailable.

### Family Invite

```text
POST /api/family/invite
DELETE /api/family/:id
GET /api/family/links
```

`POST /api/family/invite` accepts `inviteEmail`, `role`, and granular `permissions`. It creates both a pending invite and a pending family link so the UI can render and revoke pending invitations immediately.

### Medication And Emergency Deletes

```text
DELETE /api/medications/:id
DELETE /api/emergency/contacts/:id
```

Deletes are scoped to the authenticated user.

### Notifications Filter

```text
GET /api/notifications?notificationType=emergency_alert&channel=telegram
```

Filters are optional. Response rows include `payloadJson`, `errorMessage`, and `sentAt` for the Telegram delivery timeline.
