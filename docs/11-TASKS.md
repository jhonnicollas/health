# TASKS.md — HL Health Companion Sprint Checklist

Task state legend:

```text
[ ] Not Started
[-] In Progress
[x] Done
[!] Blocked
[~] Needs Review
```

Rules:

1. Only one agent should own one task at a time.
2. Change `[ ]` to `[-]` before editing code.
3. Change `[-]` to `[x]` only after validation and documentation update.
4. If blocked, change to `[!]` and explain in `WORK_LOG.md` and `HANDOFF.md`.
5. Every completed task must update docs or explicitly log that docs were reviewed and no update was needed.

---

## Sprint 1 — Core Capture Full Feature

### Epic 1.0 — Bootstrapping

- [x] **BOOT-1 Create Cloudflare Workers + Hono + React project skeleton**
  - **Deskripsi**: Inisialisasi monorepo dengan `web` (React+Vite) dan `worker` (Hono).
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Folder `web` dan `worker` terbuat.
    - `npm install` di root berjalan sukses.

### Epic 1.0.5 — Admin Configuration Management

- [x] **US-ADMIN.1 Config Management API**
  - **Deskripsi**: CRUD API for HL_systemConfigs with role validation and cache invalidation.
  - **API Route**: `GET /api/admin/configs`, `PUT /api/admin/configs/:key`
  - **DB Table**: `HL_systemConfigs`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Hanya bisa diakses role admin.
    - Worker melakukan caching hasil query D1 untuk menghemat kuota.

- [x] **US-ADMIN.2 Admin Config Dashboard**
  - **Deskripsi**: UI for managing global system configs dynamically.
  - **API Route**: `GET /api/admin/configs`, `PUT /api/admin/configs/:key`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/admin/ConfigDashboardPage.tsx`
  - **Acceptance Criteria**:
    - Menampilkan tabel list konfigurasi.
    - Bisa edit value konfigurasi (misal mengganti 5000ms AI timeout ke 7000ms tanpa deploy ulang).

### Epic 1.1 — Auth and User Profile

- [x] **US-1.1.1 Register User**
  - **Deskripsi**: Create registration API, validation, password hashing, audit log.
  - **API Route**: `POST /api/auth/register`
  - **DB Table**: `HL_users`, `HL_auditLogs` (insert)
  - **Frontend**: `web/src/pages/auth/RegisterPage.tsx`
  - **Acceptance Criteria**:
    - Reject duplikat email.
    - Password di-hash (bcrypt/argon2 equivalen).
    - Mencetak log `userRegister` ke audit log.

- [x] **US-1.1.2 Login User**
  - **Deskripsi**: Create login API, session/JWT handling, protected route behavior.
  - **API Route**: `POST /api/auth/login`
  - **DB Table**: `HL_users` (read)
  - **Frontend**: `web/src/pages/auth/LoginPage.tsx`, `web/src/context/AuthContext.tsx`
  - **Acceptance Criteria**:
    - Menolak password salah.
    - Mengembalikan session melalui cookie HTTP-only `hlSession`.
    - Autentikasi persisten di frontend.

- [x] **US-1.1.3 Onboarding Profil Kesehatan**
  - **Deskripsi**: Create onboarding form/API for displayName, sex, birthDate, heightCm, timezone.
  - **API Route**: `POST /api/profile/onboarding`
  - **DB Table**: `HL_userProfiles` (insert)
  - **Frontend**: `web/src/pages/onboarding/OnboardingPage.tsx`
  - **Acceptance Criteria**:
    - Validasi umur minimum.
    - Validasi `heightCm` logis.

- [x] **US-1.1.4 Edit Profil Dasar**
  - **Deskripsi**: Settings page/API for heightCm, timezone, theme, accessibilityMode.
  - **API Route**: `PUT /api/settings/ui`, `PUT /api/profile`
  - **DB Table**: `HL_userProfiles` (update)
  - **Frontend**: `web/src/pages/settings/ProfileSettingsPage.tsx`
  - **Acceptance Criteria**:
    - Tema bisa diganti (`dark`, `light`, dll).
    - Mode lansia bisa di-toggle.

### Epic 1.2 — Measurement Input

- [x] **US-1.2.1 Checklist Jenis Pengukuran**
  - **Deskripsi**: Dynamic checklist for all supported measurement types.
  - **API Route**: `GET /api/metrics/catalog`
  - **DB Table**: `HL_metricCatalog`, `HL_devices` (read)
  - **Frontend**: `web/src/pages/measurement/SelectMetricPage.tsx`
  - **Acceptance Criteria**:
    - Checklist merender metrik dari database.

- [x] **US-1.2.2 Dynamic Form per Metric**
  - **Deskripsi**: Show/hide metric cards based on checklist.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/DynamicMetricForm.tsx`
  - **Acceptance Criteria**:
    - Form dinamis muncul hanya untuk metrik yang dicentang.

- [x] **US-1.2.3 Foto atau Upload Attachment**
  - **Deskripsi**: Camera/upload input, preview, file validation.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/AttachmentUploader.tsx`
  - **Acceptance Criteria**:
    - Hanya menerima format gambar.
    - Bisa membuka kamera native (`capture="environment"`).

- [x] **US-1.2.4 Client-Side Compression**
  - **Deskripsi**: Browser resize max 1280px and quality 50%.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/utils/imageCompressor.ts`
  - **Acceptance Criteria**:
    - Gambar di-*resize* secara lokal sebelum upload.

- [x] **US-1.2.5 Watermark Attachment Final**
  - **Deskripsi**: Browser canvas watermark before submit.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/utils/watermark.ts`
  - **Acceptance Criteria**:
    - Terdapat timestamp dan user info tergambar (draw) di gambar akhir.

### Epic 1.3 — AI Vision Extraction

- [x] **US-1.3.1 AI Extract Oximeter**
  - **Deskripsi**: Extract spo2 and heartRate with 5s timeout.
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions` (insert)
  - **Frontend**: `web/src/hooks/useAiExtract.ts`
  - **Acceptance Criteria**:
    - Mengirim file max sesuai batas konfigurasi (e.g. 2MB).
    - Max limit 2MB harus dibaca dari HL_systemConfigs (maxUploadSizeBytes).
    - AI Vision mengambil nilai Spo2 & HR.

- [x] **US-1.3.2 AI Extract Tensimeter**
  - **Deskripsi**: Extract systolic, diastolic, bloodPressurePulse.
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions` (insert)
  - **Frontend**: - (Shared component)
  - **Acceptance Criteria**:
    - AI Vision mengambil nilai tekanan darah dengan akurat.

- [x] **US-1.3.3 AI Extract Sinocare GCU**
  - **Deskripsi**: Extract only selected Sinocare metric (Glucose/Cholesterol/Uric Acid).
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions` (insert)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Bisa membedakan mode metrik sesuai form terpilih.

- [x] **US-1.3.4 AI Timeout 5 Detik**
  - **Deskripsi**: Implement timeout fallback and HL_aiExtractions log.
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions`
  - **Frontend**: Fallback UI
  - **Acceptance Criteria**:
    - Batal/reject jika > batas timeout yang dikonfigurasi.
    - Timeout value harus dibaca dari HL_systemConfigs (aiExtractTimeoutMs) bukan di-hardcode 5000ms.
    - Status "timeout" tercatat di D1.

### Epic 1.4 — Manual Override and Validation

- [x] **US-1.4.1 Manual Override Angka AI**
  - **Deskripsi**: Compare rawAiValue vs finalValue.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/ManualOverrideInput.tsx`
  - **Acceptance Criteria**:
    - Field AI hasil ekstraksi bisa diedit.
    - Flag `manualOverride` di-set true jika diedit.

- [x] **US-1.4.2 Validasi Physical Range**
  - **Deskripsi**: Reject impossible values and invalid BP pairs.
  - **API Route**: `POST /api/measurements/validate`
  - **DB Table**: -
  - **Frontend**: `web/src/utils/validation.ts`
  - **Acceptance Criteria**:
    - Diastolic tidak boleh lebih besar dari Systolic.

- [x] **US-1.4.3 BMI Auto Calculate**
  - **Deskripsi**: Calculate BMI from bodyWeight and heightCm.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: Form state logic
  - **Acceptance Criteria**:
    - BMI otomatis terkalkulasi saat berat badan diinput.

### Epic 1.5 — Submit and Storage

- [x] **US-1.5.1 Submit Measurement Session**
  - **Deskripsi**: Batch insert session and values into D1.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_measurementSessions`, `HL_measurementValues`
  - **Frontend**: `web/src/api/measurements.ts`
  - **Acceptance Criteria**:
    - Disimpan dalam transaksi D1 yang atomik.

- [x] **US-1.5.2 Save Final Attachment ke R2**
  - **Deskripsi**: Upload only final compressed watermarked file.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_measurementAttachments`, R2 (`LOGS`)
  - **Frontend**: Upload middleware
  - **Acceptance Criteria**:
    - Gambar masuk ke R2 bucket dengan key UUID yang aman.

- [x] **US-1.5.3 Audit Log Submit**
  - **Deskripsi**: Log measurementSubmit and manualOverride metadata.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_auditLogs`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Tercatat log jika user men-submit data.

### Epic 1.6 — Telegram Push and Daily Dashboard

- [x] **US-1.6.1 Telegram Push Setelah Submit**
  - **Deskripsi**: Enqueue/send non-blocking Telegram summary.
  - **API Route**: Queue Event `telegramSubmitSummary`
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - API tidak menunggu balasan Telegram untuk merespons 200 OK.

- [x] **US-1.6.2 Dashboard Hari Ini**
  - **Deskripsi**: Show latest daily values and empty states.
  - **API Route**: `GET /api/dashboard/today`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/dashboard/TodayDashboard.tsx`
  - **Acceptance Criteria**:
    - Menampilkan nilai metrik terkini di hari yang sama.

---

## Sprint 2 — Health Intelligence Full Feature

### Epic 2.1 — Metric Rules Engine

- [x] **US-2.1.1 Seed Metric Rules dari CSV**
  - **Deskripsi**: Seed HL_metricRules idempotently.
  - **API Route**: - (Seeder script)
  - **DB Table**: `HL_metricRules` (insert)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Data rule dari CSV/SQL seed berhasil dimasukkan ke D1.

- [x] **US-2.1.2 Evaluate Metric Status**
  - **Deskripsi**: Resolve rule by metric, sex, age, finalValue.
  - **API Route**: `POST /api/measurements/validate`
  - **DB Table**: `HL_metricRules` (read)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Menghasilkan status dan severity yang akurat sesuai range.

- [x] **US-2.1.3 Rule Fallback**
  - **Deskripsi**: Safe fallback when rule is missing.
  - **API Route**: `POST /api/measurements/validate`
  - **DB Table**: `HL_metricRules`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Mengembalikan severity `info` jika rule gagal dievaluasi.

### Epic 2.2 — Popup Interpretasi

- [x] **US-2.2.1 Popup Setelah Validasi**
  - **Deskripsi**: Show metricName, finalValue, status, severity, sourceLabel.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/InterpretationPopup.tsx`
  - **Acceptance Criteria**:
    - Menampilkan penjelasan dari rules engine secara pop-up.

- [x] **US-2.2.2 Popup Multi Metric**
  - **Deskripsi**: Show grouped interpretation for all metrics in session.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: -
  - **Acceptance Criteria**:
    - UI menangani kasus tensimeter di mana 3 metrik divalidasi sekaligus.

- [x] **US-2.2.3 Emergency Warning Modal**
  - **Deskripsi**: Require acknowledgment for emergency severity.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/shared/EmergencyModal.tsx`
  - **Acceptance Criteria**:
    - Harus diklik "Saya Mengerti" (blocking UI).

### Epic 2.3 — AI Recommendation

- [x] **US-2.3.1 Generate AI Recommendation Setelah Submit**
  - **Deskripsi**: Generate safe recommendation after submit.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: `HL_recommendations`
  - **Frontend**: `web/src/components/ai/RecommendationCard.tsx`
  - **Acceptance Criteria**:
    - Menggunakan Worker AI text model.

- [x] **US-2.3.2 Compare Hari Ini vs 3 Hari**
  - **Deskripsi**: Compute today vs previous 3-day average.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Input ke LLM mencakup data 3 hari terakhir.

- [x] **US-2.3.3 Compare Hari Ini vs 7 Hari**
  - **Deskripsi**: Compute today vs previous 7-day average.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Input ke LLM mencakup data 7 hari terakhir.

- [x] **US-2.3.4 AI Safety Guardrail**
  - **Deskripsi**: Reject diagnosis/prescription-like AI output.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: -
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Prompt system AI melarang instruksi dosis obat atau vonis penyakit.

### Epic 2.4 — Dashboard Mingguan dan Bulanan

- [x] **US-2.4.1 Weekly Dashboard**
  - **Deskripsi**: 7-day trend charts.
  - **API Route**: `GET /api/dashboard/weekly`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/dashboard/WeeklyDashboard.tsx`
  - **Acceptance Criteria**:
    - Menampilkan Line/Bar chart 7 hari.

- [x] **US-2.4.2 Monthly Dashboard**
  - **Deskripsi**: 30-day summary cards.
  - **API Route**: `GET /api/dashboard/monthly`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/dashboard/MonthlyDashboard.tsx`
  - **Acceptance Criteria**:
    - Rekapan nilai max/min rata-rata 30 hari.

- [x] **US-2.4.3 Trend Indicator**
  - **Deskripsi**: Naik/turun/stabil/belum cukup data indicator.
  - **API Route**: `GET /api/dashboard/*`
  - **DB Table**: -
  - **Frontend**: `web/src/components/dashboard/TrendBadge.tsx`
  - **Acceptance Criteria**:
    - Panah naik turun sesuai komparasi periode.

### Epic 2.5 — Reports and Knowledge Base

- [x] **US-2.5.1 Daily Report**
  - **Deskripsi**: Daily metric report with status and recommendation.
  - **API Route**: `GET /api/reports/daily`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/reports/DailyReportPage.tsx`
  - **Acceptance Criteria**:
    - Tampilan laporan satu hari.

- [x] **US-2.5.2 Weekly Report**
  - **Deskripsi**: 7-day report with trend and adherence.
  - **API Route**: `GET /api/reports/weekly`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/reports/WeeklyReportPage.tsx`
  - **Acceptance Criteria**:
    - Tampilan komparasi mingguan.

- [x] **US-2.5.3 Monthly Report**
  - **Deskripsi**: 30-day metric summary and AI monthly summary.
  - **API Route**: `GET /api/reports/monthly`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/reports/MonthlyReportPage.tsx`
  - **Acceptance Criteria**:
    - Tampilan naratif ringkasan 30 hari.

- [x] **US-2.5.4 Knowledge Base Alat Ukur**
  - **Deskripsi**: Articles for all supported devices.
  - **API Route**: `GET /api/kb`
  - **DB Table**: `HL_knowledgeArticles`
  - **Frontend**: `web/src/pages/kb/KnowledgeBasePage.tsx`
  - **Acceptance Criteria**:
    - Bisa menampilkan markdown instruksi tensimeter/gula darah.

---

## Sprint 3 — Family & Alert System Full Feature

### Epic 3.1 — Telegram Integration

- [x] **US-3.1.1 Connect Telegram**
  - **Deskripsi**: Verification token and chat linking.
  - **API Route**: `POST /api/telegram/connect`
  - **DB Table**: `HL_userProfiles` (update telegramChatId)
  - **Frontend**: `web/src/pages/settings/TelegramSetupPage.tsx`
  - **Acceptance Criteria**:
    - Generate token 6 digit, user kirim ke bot.

- [x] **US-3.1.2 Test Telegram Notification**
  - **Deskripsi**: Send test message and log notification status.
  - **API Route**: `POST /api/telegram/test`
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Terkirim chat test dari bot.

- [x] **US-3.1.3 Telegram Summary After Submit**
  - **Deskripsi**: Background summary after measurement submit.
  - **API Route**: Queue (telegramSubmitSummary)
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Pesan Telegram dikirim via Cloudflare Queue (asynchronous).

### Epic 3.2 — Family and Caregiver

- [x] **US-3.2.1 Invite Family / Caregiver**
  - **Deskripsi**: Create pending family invitation.
  - **API Route**: `POST /api/family/invite`
  - **DB Table**: `HL_familyInvites`
  - **Frontend**: `web/src/pages/family/InvitePage.tsx`
  - **Acceptance Criteria**:
    - Generate link shareToken (aktif 24 jam).

- [x] **US-3.2.2 Accept Family Invitation**
  - **Deskripsi**: Accept or reject expired invitation.
  - **API Route**: `POST /api/family/accept`
  - **DB Table**: `HL_familyMembers`
  - **Frontend**: `web/src/pages/family/AcceptInvitePage.tsx`
  - **Acceptance Criteria**:
    - Membentuk relasi antara Owner dan Caregiver.

- [x] **US-3.2.3 Role Permission**
  - **Deskripsi**: Owner configures role and permissions.
  - **API Route**: `PUT /api/family/members/:id/permissions`
  - **DB Table**: `HL_familyMembers`
  - **Frontend**: `web/src/pages/family/PermissionsPage.tsx`
  - **Acceptance Criteria**:
    - Bisa toggle akses baca/tulis/darurat.

- [x] **US-3.2.4 Caregiver Dashboard**
  - **Deskripsi**: Caregiver sees linked user dashboards by permission.
  - **API Route**: `GET /api/family/dashboard`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/family/CaregiverDashboard.tsx`
  - **Acceptance Criteria**:
    - Caregiver bisa pindah antar-profil (context switch).

### Epic 3.3 — Emergency Alert System

- [x] **US-3.3.1 Create Emergency Alert**
  - **Deskripsi**: Create HL_alerts row from emergency severity.
  - **API Route**: Queue (emergencyAlert)
  - **DB Table**: `HL_alerts`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - D1 menyimpan record alert saat nilai darurat di-submit.

- [x] **US-3.3.2 Send Emergency Telegram**
  - **Deskripsi**: Send to emergency contacts with consent.
  - **API Route**: Worker Queue
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Dicek field `emergencyConsent`. Jika false, jangan kirim.

- [x] **US-3.3.3 Acknowledge Alert**
  - **Deskripsi**: User/caregiver acknowledges alert and audit log.
  - **API Route**: `PUT /api/alerts/:id/acknowledge`
  - **DB Table**: `HL_alerts` (update status)
  - **Frontend**: `web/src/components/alerts/AlertBanner.tsx`
  - **Acceptance Criteria**:
    - Status berubah dari `active` ke `acknowledged`.

### Epic 3.4 — Reminder and Browser Notification

- [x] **US-3.4.1 Reminder Settings**
  - **Deskripsi**: Set reminder type and schedule.
  - **API Route**: `POST /api/reminders`
  - **DB Table**: `HL_reminderSettings`
  - **Frontend**: `web/src/pages/settings/ReminderSettingsPage.tsx`
  - **Acceptance Criteria**:
    - Menyimpan jam dan preferensi tipe notifikasi (Telegram/Web Push).

- [x] **US-3.4.2 Daily Reminder Cron**
  - **Deskripsi**: Cron creates due notification jobs.
  - **API Route**: Scheduled Worker
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Cron mengecek jadwal dan melempar event ke Queue.

- [x] **US-3.4.3 Browser Notification Opt-In**
  - **Deskripsi**: Push subscription and permission flow.
  - **API Route**: `POST /api/push/subscribe`
  - **DB Table**: `HL_pushSubscriptions`
  - **Frontend**: `web/src/hooks/useWebPush.ts`
  - **Acceptance Criteria**:
    - Meminta izin Web Push dan menyimpan langganan VAPID ke D1.

### Epic 3.5 — Medication Tracker

- [x] **US-3.5.1 Add Medication**
  - **Deskripsi**: Medication CRUD basic create/update active.
  - **API Route**: `POST /api/medications`
  - **DB Table**: `HL_medications`
  - **Frontend**: `web/src/pages/medications/MedicationForm.tsx`
  - **Acceptance Criteria**:
    - Bisa menyimpan nama obat, dosis, dan frekuensi.

- [x] **US-3.5.2 Checklist Medication Taken**
  - **Deskripsi**: Log taken/skipped/missed medication.
  - **API Route**: `POST /api/medication-logs`
  - **DB Table**: `HL_medicationLogs`
  - **Frontend**: `web/src/components/medications/DailyChecklist.tsx`
  - **Acceptance Criteria**:
    - Log harian status minum obat.

- [x] **US-3.5.3 Medication Insight on Dashboard**
  - **Deskripsi**: Adherence summary without dosage advice.
  - **API Route**: `GET /api/dashboard/today`
  - **DB Table**: -
  - **Frontend**: `web/src/components/dashboard/MedicationAdherenceCard.tsx`
  - **Acceptance Criteria**:
    - Menampilkan persentase kepatuhan (misal: 80% diminum).

---

## Sprint 4 — Advanced Health Companion Full Feature

### Epic 4.1 — Doctor Ready PDF

- [x] **US-4.1.1 Generate Doctor Ready PDF 30 Hari**
  - **Deskripsi**: Build 30-day PDF from health data.
  - **API Route**: Queue (generateDoctorReadyPdf)
  - **DB Table**: `HL_reports`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Server menyusun HTML ke PDF (Puppeteer/sejenisnya) di background.

- [x] **US-4.1.2 Save PDF to R2**
  - **Deskripsi**: Store generated PDF and HL_reports metadata.
  - **API Route**: Queue (generateDoctorReadyPdf)
  - **DB Table**: `HL_reports`, R2 (`LOGS`)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - PDF disimpan ke R2 secara aman.

- [x] **US-4.1.3 Download PDF**
  - **Deskripsi**: Authorized download/stream/signed URL.
  - **API Route**: `GET /api/reports/:id/download`
  - **DB Table**: -
  - **Frontend**: `web/src/components/reports/PdfDownloadBtn.tsx`
  - **Acceptance Criteria**:
    - Hanya pemilik/caregiver yang bisa mendownload.

- [x] **US-4.1.4 Doctor Viewer Share Link**
  - **Deskripsi**: Expiring limited report link.
  - **API Route**: `POST /api/reports/:id/share`
  - **DB Table**: `HL_reports` (update shareToken)
  - **Frontend**: `web/src/components/reports/ShareLinkModal.tsx`
  - **Acceptance Criteria**:
    - Dokter dapat membuka file PDF tanpa perlu login.

### Epic 4.2 — Fasting Timer

- [x] **US-4.2.1 Start Fasting Timer**
  - **Deskripsi**: Create active fasting session.
  - **API Route**: `POST /api/fasting/start`
  - **DB Table**: `HL_fastingSessions`
  - **Frontend**: `web/src/pages/fasting/FastingTimerPage.tsx`
  - **Acceptance Criteria**:
    - Status puasa menjadi aktif.

- [x] **US-4.2.2 Stop Fasting Timer**
  - **Deskripsi**: Complete or cancel fasting session.
  - **API Route**: `POST /api/fasting/stop`
  - **DB Table**: `HL_fastingSessions`
  - **Frontend**: `web/src/pages/fasting/FastingTimerPage.tsx`
  - **Acceptance Criteria**:
    - Status puasa diselesaikan dan tercatat durasinya.

- [x] **US-4.2.3 Fasting Reminder**
  - **Deskripsi**: Notify when targetHours is reached.
  - **API Route**: Scheduled Cron
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Notifikasi jika jam puasa yang ditargetkan sudah tercapai.

### Epic 4.3 — Gamification

- [x] **US-4.3.1 Measurement Streak**
  - **Deskripsi**: Update daily streak on submit.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_userStreaks`
  - **Frontend**: `web/src/components/dashboard/StreakCounter.tsx`
  - **Acceptance Criteria**:
    - Streak bertambah jika submit berturut-turut beda hari.

- [x] **US-4.3.2 Earn Badge**
  - **Deskripsi**: Award idempotent consistency badges.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_userBadges`
  - **Frontend**: `web/src/pages/profile/BadgesPage.tsx`
  - **Acceptance Criteria**:
    - Mendapat lencana "3 Hari Konsisten" jika syarat terpenuhi.

- [x] **US-4.3.3 Safe Gamification**
  - **Deskripsi**: Prevent excessive measurement incentives.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Submit > 10x per hari tidak terus-menerus menambah skor secara abuser.

### Epic 4.4 — Pattern Detection

- [x] **US-4.4.1 Sleep vs Blood Pressure Pattern**
  - **Deskripsi**: Safe correlation wording with minimum 14 days.
  - **API Route**: `POST /api/patterns/generate`
  - **DB Table**: `HL_patternInsights`
  - **Frontend**: `web/src/pages/patterns/InsightsPage.tsx`
  - **Acceptance Criteria**:
    - AI menganalisis tren tidur dan tekanan darah. Menolak analisis jika data < 14 hari.

- [x] **US-4.4.2 Weight vs Blood Pressure Pattern**
  - **Deskripsi**: Trend insight if enough data.
  - **API Route**: `POST /api/patterns/generate`
  - **DB Table**: `HL_patternInsights`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Insight korelasional aman.

- [x] **US-4.4.3 Medication vs Metric Pattern**
  - **Deskripsi**: Adherence insight without dosage advice.
  - **API Route**: `POST /api/patterns/generate`
  - **DB Table**: `HL_patternInsights`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Insight tingkat kepatuhan minum obat.

### Epic 4.5 — Accessibility Mode Lansia

- [x] **US-4.5.1 Enable Senior Mode**
  - **Deskripsi**: Larger typography, buttons, simplified nav.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/styles/senior-mode.css`
  - **Acceptance Criteria**:
    - CSS root variable berubah drastis menjadi besar jika `accessibilityMode === 'senior'`.

- [x] **US-4.5.2 High Contrast Mode**
  - **Deskripsi**: High-contrast theme with readable components.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/styles/high-contrast.css`
  - **Acceptance Criteria**:
    - Tampilan hitam-putih-kuning mencolok untuk visibilitas maksimal.

- [x] **US-4.5.3 Senior Measurement Flow**
  - **Deskripsi**: One metric per screen flow.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/pages/measurement/SeniorMeasurementFlow.tsx`
  - **Acceptance Criteria**:
    - Flow wizard vertikal tanpa form kompleks (1 field/halaman).

### Epic 4.6 — PWA Full

- [x] **US-4.6.1 Installable PWA**
  - **Deskripsi**: Manifest, icons, standalone mode.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/public/manifest.json`, Service Worker
  - **Acceptance Criteria**:
    - Muncul prompt instalasi di browser.

- [x] **US-4.6.2 Offline Shell**
  - **Deskripsi**: App shell works offline and draft is local.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/sw.ts`, `IndexedDB`
  - **Acceptance Criteria**:
    - Aplikasi tetap bisa dirender saat internet mati.

- [x] **US-4.6.3 Sync Draft When Online**
  - **Deskripsi**: User-approved draft sync.
  - **API Route**: `POST /api/measurements/sync`
  - **DB Table**: `HL_measurementDrafts`
  - **Frontend**: `web/src/components/sync/OfflineSyncBanner.tsx`
  - **Acceptance Criteria**:
    - Klik tombol "Sync" untuk mengirim draft ke server tanpa duplikasi.

### Epic 4.7 — Data Export

- [x] **US-4.7.1 Export CSV**
  - **Deskripsi**: Export measurements by date range.
  - **API Route**: `GET /api/export/csv`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/settings/DataExportPage.tsx`
  - **Acceptance Criteria**:
    - Unduhan otomatis file CSV dengan MIME type `text/csv`.

- [x] **US-4.7.2 Delete Account Data**
  - **Deskripsi**: Privacy flow with confirmation and audit log.
  - **API Route**: `POST /api/privacy/deleteAccount`
  - **DB Table**: (Soft delete / hapus dari seluruh tabel yang relasi ke userId)
  - **Frontend**: `web/src/pages/settings/PrivacyPage.tsx`
  - **Acceptance Criteria**:
    - Proses asynchronous untuk membersihkan seluruh data PII.

---

## Global Documentation Tasks

- [x] DOC-1 Keep `api-contract.md` updated for every API change
- [x] DOC-2 Keep `ARCHITECTURE.md` updated for every architecture/flow change
- [x] DOC-3 Keep `design-system.md` updated for every UI component/theme change
- [x] DOC-4 Keep `schema.sql` updated for every database change
- [x] DOC-5 Keep `seed.sql` updated for every seed data change
- [x] DOC-6 Keep `WORK_LOG.md` append-only and current
- [x] DOC-7 Keep `HANDOFF.md` accurate after every task

---

## Gap Remediation — PRD vs Source Code Quality & Feature Gaps

Gap-gap kritis antara PRD (Product Requirements Document) dan source code saat ini. Semua item adalah [ ] Not Started, prioritas descending.

### [x] GAP-1 UI/UX Visual Quality — Owner Score 5/1000
- **Deskripsi**: Owner menilai aplikasi 5/1000. UI tidak sesuai ekspektasi enterprise SaaS. Stitch UI Parity sudah dikerjakan tapi ditolak owner.
- **Akar Masalah**: Stitch CSS tokens sudah di-applied tapi routing, layout, card, badge, dan responsivitas masih kaku. Sidebar, topbar, mobile bottom nav tidak presisi. Warna, spacing, typography tidak konsisten dengan DESIGN.md.
- **Frontend**: `web/src/App.tsx`, `web/src/App.css`, `web/src/index.css`, semua page files
- **Acceptance Criteria**:
  - Sidebar, topbar, content area cocok pixel-for-pixel dengan `web/frontend_stitch/master-layout.html`
  - Setiap route (dashboard, measurement, history, dsb) cocok dengan referensi Stitch PNG
  - Warna, font, spacing, shadow, border-radius sesuai DESIGN.md
  - Owner menyetujui dengan score >= 800/1000

### [x] GAP-2 Mobile Responsive Layout Rusak
- **Deskripsi**: Layout mobile breakpoints tidak proper. Bottom nav, mobile topbar, card grid tidak responsif.
- **Frontend**: `web/src/App.css` (media queries), `web/src/App.tsx` (mobile nav), `web/src/index.css`
- **Acceptance Criteria**:
  - Mobile (320-767px): sidebar hidden, mobile topbar visible, bottom nav 5 item, card 1 kolom, font size readable
  - Tablet (768-1023px): sidebar collapsed atau hamburger, grid 2 kolom
  - Desktop (1024px+): sidebar fixed 280px, grid 3+ kolom
  - Form input dan tombol touch-friendly (min 44px)
  - Kamera mobile active untuk capture photo

### [x] GAP-3 AI Vision "Baca Otomatis" Tidak Terhubung
- **Deskripsi**: `useAiExtract` hook sudah ada dan di-import di `DynamicMetricForm.tsx` tapi tombol "Baca Otomatis" tidak muncul/tidak terhubung ke flow input. User tidak bisa menggunakan AI Vision extraction.
- **Frontend**: `web/src/components/measurement/DynamicMetricForm.tsx`, `web/src/hooks/useAiExtract.ts`
- **Worker**: `POST /api/measurements/extract` endpoint
- **Acceptance Criteria**:
  - Tiap card metric dengan `requiresAttachment=true` menampilkan tombol "Baca Otomatis"
  - Klik tombol → kirim attachment ke `/api/measurements/extract`
  - Loading state selama AI Vision running
  - Success → value terisi di text box
  - Timeout > 5000ms → tampilkan manual input + pesan "AI terlalu lama membaca foto"
  - Failed → manual input
  - `rawAiValue` dan `confidence` tersimpan
  - `manualOverride` flag berubah jika user edit hasil AI

### [x] GAP-4 Theme Selector Tidak Berfungsi
- **Deskripsi**: Theme (light/warm/dark/highContrast) tersimpan di DB tapi tidak langsung diterapkan ke UI setelah user ganti di Settings. Tidak ada visual feedback.
- **Frontend**: `web/src/pages/settings/ProfileSettingsPage.tsx`, `web/src/context/AuthContext.tsx`
- **Acceptance Criteria**:
  - Setelah ganti theme dan save, theme langsung berubah tanpa reload
  - `document.documentElement.dataset.theme` terupdate
  - CSS variables berubah sesuai theme
  - Settings mencerminkan theme saat ini

### [x] GAP-5 Knowledge Base Hanya Teks Polos
- **Deskripsi**: Halaman Knowledge Base menampilkan artikel sebagai `<pre>` text biasa. PRD requires images, videos, use-case cards, structured device guides.
- **Frontend**: `web/src/pages/kb/KnowledgeBasePage.tsx`
- **Worker**: `GET /api/kb` endpoint
- **Acceptance Criteria**:
  - Tiap artikel memiliki: title, image/icon, structured sections, use-case card
  - Device guides: cara pakai, tips foto, kesalahan umum, arti metric, kapan harus cek ulang
  - Support multimedia (images, embedded videos jika memungkinkan)
  - Responsive card layout

### [x] GAP-6 Dashboard Kosong / Tidak Menampilkan Data Real
- **Deskripsi**: Dashboard hari ini, mingguan, bulanan tidak menampilkan data real. Bento grid streak, AI insight, charts kosong/null.
- **Frontend**: `web/src/pages/dashboard/TodayDashboard.tsx`, `web/src/pages/dashboard/WeeklyDashboard.tsx`, `web/src/pages/dashboard/MonthlyDashboard.tsx`
- **Worker**: `GET /api/dashboard/today`, `GET /api/dashboard/weekly`, `GET /api/dashboard/monthly`
- **Acceptance Criteria**:
  - Today dashboard: latest value per metric, streak counter, AI insight banner, alert status
  - Weekly dashboard: 7-day trends (text-based minimal), adherence, best/worst day
  - Monthly dashboard: rata-rata, min, max, alert count, measurement days
  - Empty state jika tidak ada data
  - Charts/lazy-load jika memungkinkan

### [x] GAP-7 Reports Minimal — Missing Popup & Recommendation
- **Deskripsi**: Daily/Weekly/Monthly report hanya menampilkan tabel metric value. Tidak menampilkan popupMessage, recommendation, bestDay/worstDay dari rules engine.
- **Frontend**: `web/src/pages/reports/DailyReportPage.tsx`, `web/src/pages/reports/WeeklyReportPage.tsx`, `web/src/pages/reports/MonthlyReportPage.tsx`
- **Acceptance Criteria**:
  - Daily: tampilkan popupMessage, recommendation, sourceLabel per metric
  - Weekly: bestDay, worstDay, alertCount, adherence
  - Monthly: aiMonthlySummary, alertCount, daysWithData, latest metrics
  - Jika tidak ada data: prompt "Belum ada data pengukuran"

### [x] GAP-8 Telegram Bot Token Tidak Valid
- **Deskripsi**: Bot token baru `8928909095:AAGNDiCF84RJrATEeSPHz_2LkGlvjjnsJ7Q` (bot @morphezCodex_bot) sudah diregenerate via @BotFather dan disimpan sebagai secret `TELEGRAM_BOT_TOKEN`.
- **Worker**: Environment secret `TELEGRAM_BOT_TOKEN`
- **Acceptance Criteria**:
  - Token valid dan `getMe` return 200 ✅
  - `POST /api/telegram/test` return `botTokenValid: true` ✅
  - Submit measurement mengirim notifikasi Telegram (menunggu user link chat)

### [x] GAP-9 System Config Editor Tidak Ada di Settings (Hanya di Admin)
- **Deskripsi**: Halaman Admin Config terpisah di `/admin/configs`. PRD requires konfigurasi sistem bisa diubah dari Settings untuk admin.
- **Frontend**: `web/src/pages/settings/ProfileSettingsPage.tsx`, `web/src/pages/admin/ConfigDashboardPage.tsx`
- **Acceptance Criteria**:
  - Admin user melihat tab/panel "System Config" di Settings
  - Bisa edit: aiExtractTimeoutMs, maxUploadSizeBytes, telegramBotToken display, dsb
  - Non-admin tidak melihat panel ini

### [x] GAP-10 AI Assistant Chatbot Minimal
- **Deskripsi**: Halaman AI Assistant hanya textarea + submit button. Tidak ada conversational UI, tidak ada context history, tidak ada streaming.
- **Frontend**: `web/src/App.tsx` (`AiAssistantPage` component inline)
- **Acceptance Criteria**:
  - Chat bubble UI (user question + AI answer)
  - Tampilkan vitals context sebagai card
  - Loading/typing indicator
  - Safety disclaimer prominent
  - No diagnosis/prescription language

### [x] GAP-11 Encrypted Sensitive Data
- **Deskripsi**: PRD requires encryption untuk: telegramChatId, emergency contact data, medication notes, personal notes. Tidak diimplementasikan.
- **Worker**: `worker/src/index.ts`, `worker/src/routes-extra.ts`
- **Acceptance Criteria**:
  - `telegramChatId` di-encrypt sebelum disimpan ke `HL_telegramLinks`
  - Emergency contact data di-encrypt
  - Encryption key dari environment secret (bukan hardcoded)
  - Decrypt hanya saat digunakan (read)

### [x] GAP-12 Emergency Consent Flow Tidak Lengkap
- **Deskripsi**: PRD requires consent sebelum emergency contact menerima alert. Flow consent belum diverifikasi end-to-end.
- **Worker**: `POST /api/emergency/contacts`, alert flow
- **Acceptance Criteria**:
  - Emergency contact hanya menerima alert jika `canReceiveAlert=true`
  - Consent checkbox di UI emergency contacts
  - Audit log saat consent diberikan/dicabut

### [x] GAP-13 Pattern Detection Missing Sleep vs Blood Pressure
- **Deskripsi**: PRD US-4.4.1 requires sleep vs blood pressure pattern detection. Hanya weight-bp dan medication yang diimplementasi.
- **Worker**: `POST /api/patterns/generate` endpoint
- **Acceptance Criteria**:
  - Sleep vs BP pattern: rata-rata systolic pada hari <6h sleep vs >=7h sleep
  - Minimum 14 days data guard
  - Safe language: "berhubungan", "cenderung", bukan "menyebabkan"

### [x] GAP-14 PDF Doctor Report Not True PDF
- **Deskripsi**: Laporan dokter adalah HTML (Cloudflare Workers tidak bisa run Puppeteer). PRD requires PDF. Browser print workaround tidak cukup.
- **Worker**: `POST /api/reports/doctor-ready`, `GET /api/reports/:id/download`
- **Acceptance Criteria**:
  - Alternatif: generate PDF via browser-side print atau library jsPDF/PDF-lib
  - HTML report tetap disimpan di R2 sebagai fallback
  - Share link dengan expiry berfungsi

### [x] GAP-15 Browser Push Notification Not Fully Wired
- **Deskripsi**: Endpoint `/api/notifications/browser/subscribe` ada, tapi flow end-to-end (permission → subscribe → send → receive) belum diverifikasi.
- **Frontend**: `web/src/pages/reminders/RemindersPage.tsx`
- **Worker**: `POST /api/notifications/browser/subscribe`
- **Acceptance Criteria**:
  - User bisa enable/disable browser push di settings
  - Permission request muncul
  - Subscribe ke push service berhasil
  - Notifikasi dikirim saat reminder due

### [x] GAP-16 Measurement Flow Tidak Ada Inline Explanations
- **Deskripsi**: PRD requires measurement cards memiliki inline explanations: cara pengukuran, tips, apa arti angka. Tidak ada di form saat ini.
- **Frontend**: `web/src/pages/measurement/SelectMetricPage.tsx`, `web/src/components/measurement/DynamicMetricForm.tsx`
- **Acceptance Criteria**:
  - Tiap metric card menampilkan penjelasan singkat inline
  - Tooltip atau accordion untuk detail
  - Penjelasan: apa yang diukur, satuan, range normal

### [x] GAP-17 Cron Triggers at 5/5 Limit
- **Deskripsi**: Cloudflare account mencapai 5/5 cron trigger limit. Cron handler sudah di-export tapi tidak bisa dijadwalkan. Workaround: manual POST `/api/internal/cron/reminders`.
- **Worker**: Cron handler di `worker/src/routes-extra.ts`
- **Acceptance Criteria**:
  - Cron trigger bisa aktif (mungkin perlu upgrade Cloudflare plan)
  - Atau merge beberapa cron menjadi 1 handler
  - Reminder notification jalan otomatis

### [x] GAP-18 PWA Offline & Installability Not Verified
- **Deskripsi**: Manifest dan SW ada tapi install prompt, offline shell, dan sync draft belum diverifikasi end-to-end.
- **Frontend**: `web/public/manifest.json`, `web/public/sw.js`
- **Acceptance Criteria**:
  - Install prompt muncul di browser mobile
  - App bisa diakses offline (cached shell)
  - Draft sync via IndexedDB + POST /api/measurements/sync

### [x] GAP-19 Family Role-Based Access Control Belum Lengkap
- **Deskripsi**: 5 roles (owner, caregiver, viewer, emergencyContact, doctorViewer) dengan permissions berbeda. Implementasi perlu diverifikasi tiap role.
- **Worker**: Family endpoints, caregiver dashboard
- **Acceptance Criteria**:
  - Tiap role memiliki akses sesuai tabel permissions PRD
  - caregiver: lihat dashboard, input data optional, edit terbatas
  - viewer: hanya lihat dashboard
  - emergencyContact: limited dashboard + terima emergency alert
  - doctorViewer: report only

### [x] GAP-20 Senior Mode One-Metric-Per-Screen Not Verified
- **Deskripsi**: SeniorMeasurementFlow ada dengan hardcoded 5 metrics. Perlu diverifikasi one-metric-per-screen flow dan dibandingkan dengan PRD spec.
- **Frontend**: `web/src/pages/measurement/SeniorMeasurementFlow.tsx`
- **Acceptance Criteria**:
  - Large font (min 18px), large buttons (min 48px)
  - One metric per screen (wizard)
  - Simplified navigation (3 menus: Home, Add Data, Emergency)
  - SOS long-press emergency button
  - High contrast mode toggle

### [x] GAP-21 Rate Limiting OCR & Telegram Not Verified
- **Deskripsi**: PRD requires rate limiting untuk OCR dan Telegram endpoints. Login rate limiting sudah ada, yang lain belum diverifikasi.
- **Worker**: `worker/src/index.ts`
- **Acceptance Criteria**:
  - `POST /api/measurements/extract` memiliki rate limit
  - `POST /api/telegram/*` endpoints memiliki rate limit
  - Rate limit configurable dari `HL_systemConfigs`

### [x] GAP-22 Charts & Visualizations Missing
- **Deskripsi**: Dashboards should have charts/visualizations (trend lines, bar charts) untuk weekly/monthly views. Saat ini hanya text.
- **Frontend**: `web/src/pages/dashboard/WeeklyDashboard.tsx`, `web/src/pages/dashboard/MonthlyDashboard.tsx`
- **Acceptance Criteria**:
  - Weekly dashboard: simple text-based trend (naik/turun/stabil)
  - Monthly: mini bar chart atau sparkline
  - Lazy load chart library
  - Accessible fallback text

---

## Enterprise Production Remediation - Owner Rejection 20/1000

Source plan: `docs/ENTERPRISE_PRODUCTION_REMEDIATION_TASK_PLAN.md`.

### [x] EP-P0.1 Fix Production Dashboard 500
- **Deskripsi**: Production `GET https://hl-health-companion.pages.dev/api/dashboard/today` returns 500 and blocks dashboard confidence.
- **Files**: `worker/src/index.ts`, `web/functions/api/[[path]].ts`, production D1 schema, Wrangler deployment config.
- **Acceptance Criteria**:
  - Reproduce production 500 and identify root cause.
  - Verify D1 schema columns used by dashboard queries.
  - Fix query/schema mismatch or proxy/runtime issue.
  - Add regression coverage for dashboard today empty-data and value-data cases.
  - Production `/api/dashboard/today` returns 200 and dashboard renders without red error state.

### [x] EP-P0.2 Secret/Config Readiness
- **Deskripsi**: Inventory mutable app config and ensure DB-backed frontend-editable settings through `HL_systemConfigs`.
- **Acceptance Criteria**:
  - No mutable timeout/model/feature flag/token value hardcoded in app code.
  - Admin Settings shows all `HL_systemConfigs` rows.
  - Sensitive runtime secrets are Worker secrets or masked config inputs.

### [x] EP-P1.1 ID/FK Inventory
- **Deskripsi**: Inventory every `id TEXT`, FK, index, and source-code reference before integer ID migration.
- **Deliverable**: `docs/INTEGER_ID_MIGRATION_PLAN.md`.
- **Acceptance Criteria**:
  - Every table ID/FK is listed.
  - Natural text keys such as `metricCode`, `deviceCode`, `configKey`, `slug` have explicit non-conversion reason.

### [x] EP-P1.2 Migration SQL Design
- **Deskripsi**: Design shadow-table migration for integer autoincrement table IDs.
- **Deliverable**: `docs/migrations/INTEGER_IDS_V2.sql`.
- **Acceptance Criteria**:
  - Migration runs on local/dev D1 copy.
  - FK integrity checks pass with no orphan rows.

### [x] EP-P1.2A Schema/Seed Integer Alignment
- **Deskripsi**: Align `docs/07-schema.sql`, `docs/08-seed.sql`, and `docs/09-seed-rules.generated.sql` with owner request that UUID/TEXT table IDs become integer autoincrement IDs before backend refactor.
- **Files**: `docs/07-schema.sql`, `docs/08-seed.sql`, `docs/09-seed-rules.generated.sql`, `docs/10-rules-seeder.js.txt`.
- **Acceptance Criteria**:
  - Surrogate table `id` columns use `INTEGER PRIMARY KEY AUTOINCREMENT`.
  - Internal FK ID columns such as `userId`, `profileId`, `sessionId`, `ruleId`, `medicationId`, and `reportId` use `INTEGER`.
  - Natural keys stay TEXT: `configKey`, `deviceCode`, `metricCode`, `badgeCode`, `slug`, token hashes, `r2Key`, push endpoint, and polymorphic audit `entityId`.
  - Seed files no longer insert UUID/string values into integer `id` columns.
  - Metric rules remain idempotent through a natural `ruleCode` key while `HL_metricRules.id` is integer.

### [x] EP-P1.3 Backend ID Refactor
- **Deskripsi**: Refactor backend table PK/FK writes and reads from UUID/TEXT IDs to integer IDs after migration design.
- **Acceptance Criteria**:
  - Internal table PK/FK values use numbers.
  - Auth/session/share tokens remain secure strings where appropriate.

### [x] EP-P1.4 Frontend ID Refactor
- **Deskripsi**: Update frontend API types and route/action handlers for integer IDs.
- **Acceptance Criteria**:
  - History, evidence, medications, alerts, family, reports all work with integer IDs.

### [x] EP-P2.1 Compact Device Selection
- **Deskripsi**: Replace metric checklist with compact device/mode selector so one physical device reading is one selection.
- **Acceptance Criteria**:
  - Yuwell selection includes SpO2 + PR bpm together.
  - OMRON selection includes SYS + DIA + Pulse together.
  - Sinocare requires one selected mode value.

### [x] EP-P2.2 Device Reading Cards
- **Deskripsi**: Render one enterprise measurement card per selected device/group with one attachment area and textboxes matching device display values.
- **Acceptance Criteria**:
  - AI fills the same textbox user edits.
  - No visible separate "Nilai AI raw" field.
  - Submit sends one final value per metric.

### [x] EP-P2.3 AI Extraction Mapping Per Device
- **Deskripsi**: Make AI extraction one call per selected device reading card and map multi-value device output to visible inputs.
- **Acceptance Criteria**:
  - Yuwell extracts SpO2 and PR in one call.
  - OMRON extracts SYS, DIA, Pulse in one call.
  - Timeout fallback leaves all inputs editable.

### [x] EP-P2.4 Submit Payload and DB Save
- **Deskripsi**: Save each selected device reading as one `HL_measurementSessions` row with multiple `HL_measurementValues` rows.
- **Acceptance Criteria**:
  - Yuwell creates 1 session + 2 values.
  - OMRON creates 1 session + 3 values.
  - Dashboard/history/report read grouped values correctly.

### [x] EP-P3.1 Full-Width Page Layout
- **Deskripsi**: Use full SaaS workspace width on desktop while preserving readable form width.
- **Acceptance Criteria**:
  - Laptop layout uses available horizontal space.
  - No horizontal overflow.

### [x] EP-P3.2 Collapsible Sidebar
- **Deskripsi**: Add desktop sidebar collapse/expand with persisted preference or local user setting.
- **Acceptance Criteria**:
  - Collapsed icons remain clickable and accessible.
  - Content margin updates correctly.

### [x] EP-P3.3 Clickable Topbar Profile and Icons
- **Deskripsi**: Make avatar/profile, notification, help/book icons real buttons/links and ensure logout works.
- **Acceptance Criteria**:
  - Avatar opens menu with profile/settings/logout.
  - Logout calls API, clears auth context, and redirects.

### [x] EP-P3.4 Android vs Laptop Layout
- **Deskripsi**: Match distinct mobile and desktop layout intent from `web/frontend_stitch/new-measurement.html`.
- **Acceptance Criteria**:
  - Playwright screenshots at 390x844 and 1440x900 are intentionally different and Stitch-aligned.

### [x] EP-P3.5 Enterprise Input System
- **Deskripsi**: Replace basic inputs with clinical enterprise instrument-style inputs across app surfaces.
- **Acceptance Criteria**:
  - Inputs match `web/frontend_stitch/` references and remain accessible.

### [x] EP-P4.1 Measurement History Date Format
- **Deskripsi**: Format user-facing date/time as Indonesian readable datetime, e.g. `17 Juni 2026 18:23:45`.
- **Acceptance Criteria**:
  - No raw ISO datetime in user-facing history/report/alert tables.

### [x] EP-P4.2 Knowledge Base Workflow Redesign
- **Deskripsi**: Turn KB into guided measurement workflows for each device.
- **Acceptance Criteria**:
  - KB covers purpose, start, device setup, photo, reading result, retry, and medical-contact guidance.

### [x] EP-P4.3 Settings Full Configuration Center
- **Deskripsi**: Settings exposes profile, UI/accessibility, notifications, Telegram, reminders, AI, upload/rate limits, feature flags, privacy/export/delete, admin config CRUD.
- **Acceptance Criteria**:
  - All mutable app configs are visible/editable from frontend for admin.

### [x] EP-P4.4 Auth/Register Form Enterprise Polish
- **Deskripsi**: Polish register/login/onboarding forms with validation, loading states, password visibility, and strict onboarding gate.
- **Acceptance Criteria**:
  - Register -> onboarding -> dashboard is production SaaS-ready.

### [x] EP-P5.1 PRD Traceability Matrix
- **Deskripsi**: Map PRD section to source files, endpoint, DB table, UI route, test evidence, and status.
- **Deliverable**: `docs/PRD_TRACEABILITY_MATRIX.md`.
- **Acceptance Criteria**:
  - Every PRD feature is mapped with source and evidence.

### [x] EP-P5.2 Feature Gap Closure
- **Deskripsi**: Implement missing PRD features found by the traceability matrix.
- **Acceptance Criteria**:
  - All PRD P0/P1 features are usable through UI.

### [x] EP-P5.3 Enterprise Visual QA
- **Deskripsi**: Screenshot compare primary routes against `web/frontend_stitch/` and fix route-by-route visual gaps.
- **Acceptance Criteria**:
  - Owner score target >= 850/1000.

### [x] EP-P6.1 Full Regression
- **Deskripsi**: Run full worker/web validation and E2E across auth, onboarding, measurement, dashboard, history, KB, settings, logout, emergency, medication, reports, mobile and laptop.
- **Acceptance Criteria**:
  - No core route 500, no broken assets, no primary console error.

### [x] EP-P6.2 Production Deploy and UAT
- **Deskripsi**: Backup D1, apply approved migrations, deploy Worker + Pages, and run production UAT.
- **Acceptance Criteria**:
  - Production E2E passes and all critical routes are live.
- **Deployed**: Worker `ad0b3db4`, Pages `0711d2f9`
- **Tests**: Register ✅, Onboarding ✅, Submit OMRON ✅, Last Measurements ✅, waistCircumference→bodyScale ✅, Dashboard ✅, Frontend bundles ✅

### Additional Fixes Applied
- [x] Full-width layout (removed max-width constraint, proper padding)
- [x] Weekly View + Monthly Summary visible in sidebar nav
- [x] Measurement page: image preview after upload
- [x] Measurement page: auto-AI trigger after photo upload (no button needed)
- [x] Measurement page: age display (Tahun/Bulan/Hari)
- [x] Measurement page: min/max/step validation on all inputs
- [x] Measurement page: clear selection button
- [x] BMI auto-calculate when bodyWeight entered
- [x] waistCircumference moved to bodyScale device
- [x] HL_lastMeasurements table + auto-fill API for rarely-changing metrics
- [x] Image compression (max 1280px, quality 50%, webp)
- [x] Watermark on final attachment

### [x] BUG-FMT-1 Doctor Report Date Format
- **Deskripsi**: `/api/reports/doctor-ready` and `/api/reports/:id/download` currently embed raw ISO UTC strings (`2026-06-23T18:30:00.000Z`). Reformat every timestamp in the doctor report HTML to Indonesian short format `dd MMM yyyy HH:mm` (e.g., `23 Jun 2026 18:30`).
- **Acceptance Criteria**:
  - `rangeStart`, `rangeEnd`, and every `measuredAt` cell render as `dd MMM yyyy HH:mm` in Indonesian short month (Jan, Feb, Mar, Apr, Mei, Jun, Jul, Agu, Sep, Okt, Nov, Des).
  - Worker typecheck + tests still pass.
  - Production deploy + manual curl `/api/reports/:id/download` shows new format.

### [x] BUG-DASH-1 Dashboard Today Empty Across Timezone
- **Deskripsi**: `/api/dashboard/today` filters `HL_measurementSessions` with `substr(measuredAt, 1, 10) = today_jakarta`. Because `measuredAt` is stored as UTC ISO, the SQL filter fails whenever the measurement was submitted late UTC / early Jakarta local. Fetch sessions without a date filter and filter by user-timezone date in JS using `Intl.DateTimeFormat` (same pattern as `/api/measurements/today` at `worker/src/index.ts:2553-2564`).
- **Acceptance Criteria**:
  - `hasData=true` and `sessionCount>=1` when measurement submitted in the user-timezone "today" even if UTC date differs.
  - Add regression test for late-UTC measurement with Jakarta timezone.
  - Worker typecheck + tests still pass.

### [x] SPRINT-1-UI-POLISH (2026-06-23)
- **Deskripsi**: User-reported UI/UX polish across measurement, history, dashboard, reports, alerts, emergency, settings, and sidebar. Plus AI analysis for daily/weekly/monthly reports via 9router.
- **Acceptance Criteria**:
  - **A. Measurement page (`/measurements/new`)**:
    - A1. Remove "Kenapa diukur?" expandable text; replace with small `?` `MedicalTerm` icon next to each label.
    - A2. Tensimeter BP layout not cut off; clickable inputs not break layout.
    - A3. Telegram push verified after every submit (US-1.6.1).
    - A4. user-info-banner "Anda berusia xx Tahun xx Bulan xx Hari" visible next to "Catat Hasil Pengukuran" heading.
    - A5. `form-message.error` rendered ABOVE form (not below); submit success shown as center-screen toast.
    - A6. Live suggestion preview per input — shows normal/warning/critical hint as user types (US-2.2.1).
  - **B. History page (`/measurements/history`)**:
    - B1. Remove `badge-override`.
    - B2. `MedicalTerm` `?` icon next to each metric code in table.
    - B3. Date & Time displayed as 2 lines (date ENTER time).
    - B4. Compact column widths for Metric, Result Value, Status.
    - B5. Rekomendasi column with severity-based recommendation.
    - B6. `?` help icon next to title opens units glossary modal.
  - **C. Dashboard**:
    - C1. `MedicalTerm` icon next to each vital label.
    - C2. 7-day colored bar chart with severity-based gradient.
  - **D. Reports**:
    - D1. `/api/reports/daily` returns data (was empty due to UTC vs Jakarta timezone mismatch); rewrite with 48h window + JS filter.
    - D2. `MedicalTerm` icons in all report pages.
    - D3. "Analisa dengan AI" button on daily/weekly/monthly; new `/api/ai/report-analysis` endpoint with 3-model fallback to 9router.
  - **E. Other pages**:
    - E1. Emergency contact validation (phone regex `^[\d+\-\s()]{6,20}$`, telegram `^@?[A-Za-z0-9_]{4,32}$` or `^-?\d{5,15}$`).
    - E2. Telegram bot @morphez_bot (token 7924...Ev5A, chat 8727919072) connected; live verified.
    - E3. Dashboard data displays correctly (timezone fix).
    - E4. Doctor report date format `dd MMM yyyy HH:mm` via `formatIdShortDateTime`.
    - E5. Alerts page tabs work (Emergency Alerts / Telegram Log) with independent loaders.
    - E6. Display mode toggle in topbar (Normal/Senior/High Contrast).
    - E7. Sidebar collapse button redesigned (40x40 gradient + `keyboard_double_arrow`).
    - E8. Medication menu visible (was inside collapsed "Health" group).
    - E9. Reset Password in user dropdown + new `/api/auth/forgot-password` endpoint.
    - E10. Export Data button actually downloads CSV via `/api/export/csv`.
- **Implementation Notes**:
  - `web/src/components/MedicalTerm.tsx` is the shared `?` icon component.
  - `web/src/utils/dateFormat.ts` now exports `formatDateID`, `formatDateTimeID`, `formatDateTimeIDFull`, `formatDateTimeShort`.
  - D1 telegramBotToken updated in D1 to `7924032453:AAEStQgN1Djc5bWsIsah8qC47wXTrH2Ev5A`.
  - User 24/25 (test users) linked to HL_telegramLinks chat 8727919072.
  - Production UAT cycle (8 endpoints + 5 pages) all green.
- **Status**: Completed + Deployed (commit 98f6699, worker a351e5a3, pages ffc997b6)
- **Validation**:
  - worker `npx tsc --noEmit`: clean
  - worker `npm test`: 29/29 pass
  - web `npx tsc -b`: clean
  - web `npm run build`: 366 kB JS, 98 kB CSS
  - Production smoke: all 8 endpoints return expected data, all 5 pages HTTP 200

### [x] CRUD-REGRESSION-D1-RESET-UAT (2026-06-23)
- **Deskripsi**: Full source audit after integer ID conversion, validate CRUD paths, reset production D1 from clean schema/seed, deploy current code, and run production UAT.
- **Scope**:
  - Check schema/seed validity before destructive reset.
  - Audit backend/frontend CRUD routes for integer ID compatibility.
  - Run worker/web validation.
  - Drop and recreate HL_* production D1 tables using approved schema + seed.
  - Run production UAT across auth, onboarding, measurement submit, dashboard, history, medication, fasting, family, notifications, AI, settings, reports, and logout.
- **Acceptance Criteria**:
  - `docs/07-schema.sql`, `docs/08-seed.sql`, and `docs/09-seed-rules.generated.sql` apply cleanly to a fresh D1/SQLite database.
  - No CRUD regression caused by integer `id`/FK columns.
  - Production D1 is rebuilt from schema + seed.
  - Worker and Pages are deployed.
  - Full UAT report records PASS/FAIL per critical flow.
- **Result**:
  - Local schema/seed fresh D1 validation: PASS (`39` HL tables, `6` devices, `15` catalog metrics, `80` rules, `13` configs).
  - Production D1 reset: PASS (drop all `HL_*`, apply schema, seed, generated rules).
  - Worker deploy: PASS (`4761730f-285e-4a67-8105-1ae0ffc2f171`).
  - Pages deploy: PASS (`https://2d0ceb3d.hl-health-companion.pages.dev`).
  - Local validation: worker tests `29/29` PASS; web lint PASS; web build PASS.
  - Production UAT: PASS for auth, onboarding, catalog, Telegram verify/test, measurement validate/submit/history/dashboard, reports, notifications, medication CRUD, fasting CRUD, family invite/revoke, emergency contact CRUD/consent, export CSV, logout, page shell, assets.
  - Known external config issue: 9router endpoint returns `401 API key required for remote API access` while `HL_systemConfigs.aiTextApiKey` is empty, so AI endpoints return deterministic safe fallback until admin enters a valid 9router API key.

### [x] CONFIG-DATE-FOLLOWUP-AUDIT (2026-06-23)
- **Deskripsi**: Follow-up audit after production UAT to align seeded AI model config with the requested 9router model list and remove remaining user-facing raw locale datetime renders.
- **Scope**:
  - Update seed/API docs for `aiTextModels` and `aiTextDefaultModel`.
  - Update production D1 `HL_systemConfigs` model values.
  - Replace remaining page-level `toLocaleString()` date displays with shared `dd MMM yyyy` helpers.
- **Acceptance Criteria**:
  - Fresh seed inserts requested 9router model order.
  - Production D1 contains the same model order/default.
  - Fasting and caregiver pages no longer render browser-default datetime strings.
  - Web lint/build and worker tests still pass.
- **Result**:
  - Seed/API docs now use `oc/deepseek-v4-flash-free`, `oc/mimo-v2.5-free`, `openrouter/poolside/laguna-m.1:free` in that order.
  - Production D1 `HL_systemConfigs.aiTextModels` updated and verified as valid JSON; `aiTextDefaultModel=oc/deepseek-v4-flash-free`.
  - Removed remaining source `toLocaleString/toLocaleDateString/toLocaleTimeString` renders from page code.
  - Validation PASS: fresh local D1 schema+seed+rules, worker tests `29/29`, web lint, web build, Pages deploy, production page/asset smoke.
  - New Pages deployment: `https://935759af.hl-health-companion.pages.dev`.
