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

- [ ] **US-ADMIN.1 Config Management API**
  - **Deskripsi**: CRUD API for HL_systemConfigs with role validation and cache invalidation.
  - **API Route**: `GET /api/admin/configs`, `PUT /api/admin/configs/:key`
  - **DB Table**: `HL_systemConfigs`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Hanya bisa diakses role admin.
    - Worker melakukan caching hasil query D1 untuk menghemat kuota.

- [ ] **US-ADMIN.2 Admin Config Dashboard**
  - **Deskripsi**: UI for managing global system configs dynamically.
  - **API Route**: `GET /api/admin/configs`, `PUT /api/admin/configs/:key`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/admin/ConfigDashboardPage.tsx`
  - **Acceptance Criteria**:
    - Menampilkan tabel list konfigurasi.
    - Bisa edit value konfigurasi (misal mengganti 5000ms AI timeout ke 7000ms tanpa deploy ulang).

### Epic 1.1 — Auth and User Profile

- [ ] **US-1.1.1 Register User**
  - **Deskripsi**: Create registration API, validation, password hashing, audit log.
  - **API Route**: `POST /api/auth/register`
  - **DB Table**: `HL_users`, `HL_auditLogs` (insert)
  - **Frontend**: `web/src/pages/auth/RegisterPage.tsx`
  - **Acceptance Criteria**:
    - Reject duplikat email.
    - Password di-hash (bcrypt/argon2 equivalen).
    - Mencetak log `userRegister` ke audit log.

- [ ] **US-1.1.2 Login User**
  - **Deskripsi**: Create login API, session/JWT handling, protected route behavior.
  - **API Route**: `POST /api/auth/login`
  - **DB Table**: `HL_users` (read)
  - **Frontend**: `web/src/pages/auth/LoginPage.tsx`, `web/src/context/AuthContext.tsx`
  - **Acceptance Criteria**:
    - Menolak password salah.
    - Mengembalikan `sessionToken` / JWT.
    - Autentikasi persisten di frontend.

- [ ] **US-1.1.3 Onboarding Profil Kesehatan**
  - **Deskripsi**: Create onboarding form/API for displayName, sex, birthDate, heightCm, timezone.
  - **API Route**: `POST /api/profile/onboarding`
  - **DB Table**: `HL_userProfiles` (insert)
  - **Frontend**: `web/src/pages/onboarding/OnboardingPage.tsx`
  - **Acceptance Criteria**:
    - Validasi umur minimum.
    - Validasi `heightCm` logis.

- [ ] **US-1.1.4 Edit Profil Dasar**
  - **Deskripsi**: Settings page/API for heightCm, timezone, theme, accessibilityMode.
  - **API Route**: `PUT /api/settings/ui`, `PUT /api/profile`
  - **DB Table**: `HL_userProfiles` (update)
  - **Frontend**: `web/src/pages/settings/ProfileSettingsPage.tsx`
  - **Acceptance Criteria**:
    - Tema bisa diganti (`dark`, `light`, dll).
    - Mode lansia bisa di-toggle.

### Epic 1.2 — Measurement Input

- [ ] **US-1.2.1 Checklist Jenis Pengukuran**
  - **Deskripsi**: Dynamic checklist for all supported measurement types.
  - **API Route**: `GET /api/metrics/catalog`
  - **DB Table**: `HL_metricCatalog`, `HL_devices` (read)
  - **Frontend**: `web/src/pages/measurement/SelectMetricPage.tsx`
  - **Acceptance Criteria**:
    - Checklist merender metrik dari database.

- [ ] **US-1.2.2 Dynamic Form per Metric**
  - **Deskripsi**: Show/hide metric cards based on checklist.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/DynamicMetricForm.tsx`
  - **Acceptance Criteria**:
    - Form dinamis muncul hanya untuk metrik yang dicentang.

- [ ] **US-1.2.3 Foto atau Upload Attachment**
  - **Deskripsi**: Camera/upload input, preview, file validation.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/AttachmentUploader.tsx`
  - **Acceptance Criteria**:
    - Hanya menerima format gambar.
    - Bisa membuka kamera native (`capture="environment"`).

- [ ] **US-1.2.4 Client-Side Compression**
  - **Deskripsi**: Browser resize max 1280px and quality 50%.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/utils/imageCompressor.ts`
  - **Acceptance Criteria**:
    - Gambar di-*resize* secara lokal sebelum upload.

- [ ] **US-1.2.5 Watermark Attachment Final**
  - **Deskripsi**: Browser canvas watermark before submit.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/utils/watermark.ts`
  - **Acceptance Criteria**:
    - Terdapat timestamp dan user info tergambar (draw) di gambar akhir.

### Epic 1.3 — AI Vision Extraction

- [ ] **US-1.3.1 AI Extract Oximeter**
  - **Deskripsi**: Extract spo2 and heartRate with 5s timeout.
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions` (insert)
  - **Frontend**: `web/src/hooks/useAiExtract.ts`
  - **Acceptance Criteria**:
    - Mengirim file max sesuai batas konfigurasi (e.g. 2MB).
    - Max limit 2MB harus dibaca dari HL_systemConfigs (maxUploadSizeBytes).
    - AI Vision mengambil nilai Spo2 & HR.

- [ ] **US-1.3.2 AI Extract Tensimeter**
  - **Deskripsi**: Extract systolic, diastolic, bloodPressurePulse.
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions` (insert)
  - **Frontend**: - (Shared component)
  - **Acceptance Criteria**:
    - AI Vision mengambil nilai tekanan darah dengan akurat.

- [ ] **US-1.3.3 AI Extract Sinocare GCU**
  - **Deskripsi**: Extract only selected Sinocare metric (Glucose/Cholesterol/Uric Acid).
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions` (insert)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Bisa membedakan mode metrik sesuai form terpilih.

- [ ] **US-1.3.4 AI Timeout 5 Detik**
  - **Deskripsi**: Implement timeout fallback and HL_aiExtractions log.
  - **API Route**: `POST /api/measurements/extract`
  - **DB Table**: `HL_aiExtractions`
  - **Frontend**: Fallback UI
  - **Acceptance Criteria**:
    - Batal/reject jika > batas timeout yang dikonfigurasi.
    - Timeout value harus dibaca dari HL_systemConfigs (aiExtractTimeoutMs) bukan di-hardcode 5000ms.
    - Status "timeout" tercatat di D1.

### Epic 1.4 — Manual Override and Validation

- [ ] **US-1.4.1 Manual Override Angka AI**
  - **Deskripsi**: Compare rawAiValue vs finalValue.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/ManualOverrideInput.tsx`
  - **Acceptance Criteria**:
    - Field AI hasil ekstraksi bisa diedit.
    - Flag `manualOverride` di-set true jika diedit.

- [ ] **US-1.4.2 Validasi Physical Range**
  - **Deskripsi**: Reject impossible values and invalid BP pairs.
  - **API Route**: `POST /api/measurements/validate`
  - **DB Table**: -
  - **Frontend**: `web/src/utils/validation.ts`
  - **Acceptance Criteria**:
    - Diastolic tidak boleh lebih besar dari Systolic.

- [ ] **US-1.4.3 BMI Auto Calculate**
  - **Deskripsi**: Calculate BMI from bodyWeight and heightCm.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: Form state logic
  - **Acceptance Criteria**:
    - BMI otomatis terkalkulasi saat berat badan diinput.

### Epic 1.5 — Submit and Storage

- [ ] **US-1.5.1 Submit Measurement Session**
  - **Deskripsi**: Batch insert session and values into D1.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_measurementSessions`, `HL_measurementValues`
  - **Frontend**: `web/src/api/measurements.ts`
  - **Acceptance Criteria**:
    - Disimpan dalam transaksi D1 yang atomik.

- [ ] **US-1.5.2 Save Final Attachment ke R2**
  - **Deskripsi**: Upload only final compressed watermarked file.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_measurementAttachments`, R2 (`LOGS`)
  - **Frontend**: Upload middleware
  - **Acceptance Criteria**:
    - Gambar masuk ke R2 bucket dengan key UUID yang aman.

- [ ] **US-1.5.3 Audit Log Submit**
  - **Deskripsi**: Log measurementSubmit and manualOverride metadata.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_auditLogs`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Tercatat log jika user men-submit data.

### Epic 1.6 — Telegram Push and Daily Dashboard

- [ ] **US-1.6.1 Telegram Push Setelah Submit**
  - **Deskripsi**: Enqueue/send non-blocking Telegram summary.
  - **API Route**: Queue Event `telegramSubmitSummary`
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - API tidak menunggu balasan Telegram untuk merespons 200 OK.

- [ ] **US-1.6.2 Dashboard Hari Ini**
  - **Deskripsi**: Show latest daily values and empty states.
  - **API Route**: `GET /api/dashboard/today`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/dashboard/TodayDashboard.tsx`
  - **Acceptance Criteria**:
    - Menampilkan nilai metrik terkini di hari yang sama.

---

## Sprint 2 — Health Intelligence Full Feature

### Epic 2.1 — Metric Rules Engine

- [ ] **US-2.1.1 Seed Metric Rules dari CSV**
  - **Deskripsi**: Seed HL_metricRules idempotently.
  - **API Route**: - (Seeder script)
  - **DB Table**: `HL_metricRules` (insert)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Data rule dari CSV/SQL seed berhasil dimasukkan ke D1.

- [ ] **US-2.1.2 Evaluate Metric Status**
  - **Deskripsi**: Resolve rule by metric, sex, age, finalValue.
  - **API Route**: `POST /api/measurements/validate`
  - **DB Table**: `HL_metricRules` (read)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Menghasilkan status dan severity yang akurat sesuai range.

- [ ] **US-2.1.3 Rule Fallback**
  - **Deskripsi**: Safe fallback when rule is missing.
  - **API Route**: `POST /api/measurements/validate`
  - **DB Table**: `HL_metricRules`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Mengembalikan severity `info` jika rule gagal dievaluasi.

### Epic 2.2 — Popup Interpretasi

- [ ] **US-2.2.1 Popup Setelah Validasi**
  - **Deskripsi**: Show metricName, finalValue, status, severity, sourceLabel.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/measurement/InterpretationPopup.tsx`
  - **Acceptance Criteria**:
    - Menampilkan penjelasan dari rules engine secara pop-up.

- [ ] **US-2.2.2 Popup Multi Metric**
  - **Deskripsi**: Show grouped interpretation for all metrics in session.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: -
  - **Acceptance Criteria**:
    - UI menangani kasus tensimeter di mana 3 metrik divalidasi sekaligus.

- [ ] **US-2.2.3 Emergency Warning Modal**
  - **Deskripsi**: Require acknowledgment for emergency severity.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/components/shared/EmergencyModal.tsx`
  - **Acceptance Criteria**:
    - Harus diklik "Saya Mengerti" (blocking UI).

### Epic 2.3 — AI Recommendation

- [ ] **US-2.3.1 Generate AI Recommendation Setelah Submit**
  - **Deskripsi**: Generate safe recommendation after submit.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: `HL_recommendations`
  - **Frontend**: `web/src/components/ai/RecommendationCard.tsx`
  - **Acceptance Criteria**:
    - Menggunakan Worker AI text model.

- [ ] **US-2.3.2 Compare Hari Ini vs 3 Hari**
  - **Deskripsi**: Compute today vs previous 3-day average.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Input ke LLM mencakup data 3 hari terakhir.

- [ ] **US-2.3.3 Compare Hari Ini vs 7 Hari**
  - **Deskripsi**: Compute today vs previous 7-day average.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Input ke LLM mencakup data 7 hari terakhir.

- [ ] **US-2.3.4 AI Safety Guardrail**
  - **Deskripsi**: Reject diagnosis/prescription-like AI output.
  - **API Route**: `POST /api/ai/recommendation`
  - **DB Table**: -
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Prompt system AI melarang instruksi dosis obat atau vonis penyakit.

### Epic 2.4 — Dashboard Mingguan dan Bulanan

- [ ] **US-2.4.1 Weekly Dashboard**
  - **Deskripsi**: 7-day trend charts.
  - **API Route**: `GET /api/dashboard/weekly`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/dashboard/WeeklyDashboard.tsx`
  - **Acceptance Criteria**:
    - Menampilkan Line/Bar chart 7 hari.

- [ ] **US-2.4.2 Monthly Dashboard**
  - **Deskripsi**: 30-day summary cards.
  - **API Route**: `GET /api/dashboard/monthly`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/dashboard/MonthlyDashboard.tsx`
  - **Acceptance Criteria**:
    - Rekapan nilai max/min rata-rata 30 hari.

- [ ] **US-2.4.3 Trend Indicator**
  - **Deskripsi**: Naik/turun/stabil/belum cukup data indicator.
  - **API Route**: `GET /api/dashboard/*`
  - **DB Table**: -
  - **Frontend**: `web/src/components/dashboard/TrendBadge.tsx`
  - **Acceptance Criteria**:
    - Panah naik turun sesuai komparasi periode.

### Epic 2.5 — Reports and Knowledge Base

- [ ] **US-2.5.1 Daily Report**
  - **Deskripsi**: Daily metric report with status and recommendation.
  - **API Route**: `GET /api/reports/daily`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/reports/DailyReportPage.tsx`
  - **Acceptance Criteria**:
    - Tampilan laporan satu hari.

- [ ] **US-2.5.2 Weekly Report**
  - **Deskripsi**: 7-day report with trend and adherence.
  - **API Route**: `GET /api/reports/weekly`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/reports/WeeklyReportPage.tsx`
  - **Acceptance Criteria**:
    - Tampilan komparasi mingguan.

- [ ] **US-2.5.3 Monthly Report**
  - **Deskripsi**: 30-day metric summary and AI monthly summary.
  - **API Route**: `GET /api/reports/monthly`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/reports/MonthlyReportPage.tsx`
  - **Acceptance Criteria**:
    - Tampilan naratif ringkasan 30 hari.

- [ ] **US-2.5.4 Knowledge Base Alat Ukur**
  - **Deskripsi**: Articles for all supported devices.
  - **API Route**: `GET /api/kb`
  - **DB Table**: `HL_knowledgeArticles`
  - **Frontend**: `web/src/pages/kb/KnowledgeBasePage.tsx`
  - **Acceptance Criteria**:
    - Bisa menampilkan markdown instruksi tensimeter/gula darah.

---

## Sprint 3 — Family & Alert System Full Feature

### Epic 3.1 — Telegram Integration

- [ ] **US-3.1.1 Connect Telegram**
  - **Deskripsi**: Verification token and chat linking.
  - **API Route**: `POST /api/telegram/connect`
  - **DB Table**: `HL_userProfiles` (update telegramChatId)
  - **Frontend**: `web/src/pages/settings/TelegramSetupPage.tsx`
  - **Acceptance Criteria**:
    - Generate token 6 digit, user kirim ke bot.

- [ ] **US-3.1.2 Test Telegram Notification**
  - **Deskripsi**: Send test message and log notification status.
  - **API Route**: `POST /api/telegram/test`
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Terkirim chat test dari bot.

- [ ] **US-3.1.3 Telegram Summary After Submit**
  - **Deskripsi**: Background summary after measurement submit.
  - **API Route**: Queue (telegramSubmitSummary)
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Pesan Telegram dikirim via Cloudflare Queue (asynchronous).

### Epic 3.2 — Family and Caregiver

- [ ] **US-3.2.1 Invite Family / Caregiver**
  - **Deskripsi**: Create pending family invitation.
  - **API Route**: `POST /api/family/invite`
  - **DB Table**: `HL_familyInvites`
  - **Frontend**: `web/src/pages/family/InvitePage.tsx`
  - **Acceptance Criteria**:
    - Generate link shareToken (aktif 24 jam).

- [ ] **US-3.2.2 Accept Family Invitation**
  - **Deskripsi**: Accept or reject expired invitation.
  - **API Route**: `POST /api/family/accept`
  - **DB Table**: `HL_familyMembers`
  - **Frontend**: `web/src/pages/family/AcceptInvitePage.tsx`
  - **Acceptance Criteria**:
    - Membentuk relasi antara Owner dan Caregiver.

- [ ] **US-3.2.3 Role Permission**
  - **Deskripsi**: Owner configures role and permissions.
  - **API Route**: `PUT /api/family/members/:id/permissions`
  - **DB Table**: `HL_familyMembers`
  - **Frontend**: `web/src/pages/family/PermissionsPage.tsx`
  - **Acceptance Criteria**:
    - Bisa toggle akses baca/tulis/darurat.

- [ ] **US-3.2.4 Caregiver Dashboard**
  - **Deskripsi**: Caregiver sees linked user dashboards by permission.
  - **API Route**: `GET /api/family/dashboard`
  - **DB Table**: -
  - **Frontend**: `web/src/pages/family/CaregiverDashboard.tsx`
  - **Acceptance Criteria**:
    - Caregiver bisa pindah antar-profil (context switch).

### Epic 3.3 — Emergency Alert System

- [ ] **US-3.3.1 Create Emergency Alert**
  - **Deskripsi**: Create HL_alerts row from emergency severity.
  - **API Route**: Queue (emergencyAlert)
  - **DB Table**: `HL_alerts`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - D1 menyimpan record alert saat nilai darurat di-submit.

- [ ] **US-3.3.2 Send Emergency Telegram**
  - **Deskripsi**: Send to emergency contacts with consent.
  - **API Route**: Worker Queue
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Dicek field `emergencyConsent`. Jika false, jangan kirim.

- [ ] **US-3.3.3 Acknowledge Alert**
  - **Deskripsi**: User/caregiver acknowledges alert and audit log.
  - **API Route**: `PUT /api/alerts/:id/acknowledge`
  - **DB Table**: `HL_alerts` (update status)
  - **Frontend**: `web/src/components/alerts/AlertBanner.tsx`
  - **Acceptance Criteria**:
    - Status berubah dari `active` ke `acknowledged`.

### Epic 3.4 — Reminder and Browser Notification

- [ ] **US-3.4.1 Reminder Settings**
  - **Deskripsi**: Set reminder type and schedule.
  - **API Route**: `POST /api/reminders`
  - **DB Table**: `HL_reminderSettings`
  - **Frontend**: `web/src/pages/settings/ReminderSettingsPage.tsx`
  - **Acceptance Criteria**:
    - Menyimpan jam dan preferensi tipe notifikasi (Telegram/Web Push).

- [ ] **US-3.4.2 Daily Reminder Cron**
  - **Deskripsi**: Cron creates due notification jobs.
  - **API Route**: Scheduled Worker
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Cron mengecek jadwal dan melempar event ke Queue.

- [ ] **US-3.4.3 Browser Notification Opt-In**
  - **Deskripsi**: Push subscription and permission flow.
  - **API Route**: `POST /api/push/subscribe`
  - **DB Table**: `HL_pushSubscriptions`
  - **Frontend**: `web/src/hooks/useWebPush.ts`
  - **Acceptance Criteria**:
    - Meminta izin Web Push dan menyimpan langganan VAPID ke D1.

### Epic 3.5 — Medication Tracker

- [ ] **US-3.5.1 Add Medication**
  - **Deskripsi**: Medication CRUD basic create/update active.
  - **API Route**: `POST /api/medications`
  - **DB Table**: `HL_medications`
  - **Frontend**: `web/src/pages/medications/MedicationForm.tsx`
  - **Acceptance Criteria**:
    - Bisa menyimpan nama obat, dosis, dan frekuensi.

- [ ] **US-3.5.2 Checklist Medication Taken**
  - **Deskripsi**: Log taken/skipped/missed medication.
  - **API Route**: `POST /api/medication-logs`
  - **DB Table**: `HL_medicationLogs`
  - **Frontend**: `web/src/components/medications/DailyChecklist.tsx`
  - **Acceptance Criteria**:
    - Log harian status minum obat.

- [ ] **US-3.5.3 Medication Insight on Dashboard**
  - **Deskripsi**: Adherence summary without dosage advice.
  - **API Route**: `GET /api/dashboard/today`
  - **DB Table**: -
  - **Frontend**: `web/src/components/dashboard/MedicationAdherenceCard.tsx`
  - **Acceptance Criteria**:
    - Menampilkan persentase kepatuhan (misal: 80% diminum).

---

## Sprint 4 — Advanced Health Companion Full Feature

### Epic 4.1 — Doctor Ready PDF

- [ ] **US-4.1.1 Generate Doctor Ready PDF 30 Hari**
  - **Deskripsi**: Build 30-day PDF from health data.
  - **API Route**: Queue (generateDoctorReadyPdf)
  - **DB Table**: `HL_reports`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Server menyusun HTML ke PDF (Puppeteer/sejenisnya) di background.

- [ ] **US-4.1.2 Save PDF to R2**
  - **Deskripsi**: Store generated PDF and HL_reports metadata.
  - **API Route**: Queue (generateDoctorReadyPdf)
  - **DB Table**: `HL_reports`, R2 (`LOGS`)
  - **Frontend**: -
  - **Acceptance Criteria**:
    - PDF disimpan ke R2 secara aman.

- [ ] **US-4.1.3 Download PDF**
  - **Deskripsi**: Authorized download/stream/signed URL.
  - **API Route**: `GET /api/reports/:id/download`
  - **DB Table**: -
  - **Frontend**: `web/src/components/reports/PdfDownloadBtn.tsx`
  - **Acceptance Criteria**:
    - Hanya pemilik/caregiver yang bisa mendownload.

- [ ] **US-4.1.4 Doctor Viewer Share Link**
  - **Deskripsi**: Expiring limited report link.
  - **API Route**: `POST /api/reports/:id/share`
  - **DB Table**: `HL_reports` (update shareToken)
  - **Frontend**: `web/src/components/reports/ShareLinkModal.tsx`
  - **Acceptance Criteria**:
    - Dokter dapat membuka file PDF tanpa perlu login.

### Epic 4.2 — Fasting Timer

- [ ] **US-4.2.1 Start Fasting Timer**
  - **Deskripsi**: Create active fasting session.
  - **API Route**: `POST /api/fasting/start`
  - **DB Table**: `HL_fastingSessions`
  - **Frontend**: `web/src/pages/fasting/FastingTimerPage.tsx`
  - **Acceptance Criteria**:
    - Status puasa menjadi aktif.

- [ ] **US-4.2.2 Stop Fasting Timer**
  - **Deskripsi**: Complete or cancel fasting session.
  - **API Route**: `POST /api/fasting/stop`
  - **DB Table**: `HL_fastingSessions`
  - **Frontend**: `web/src/pages/fasting/FastingTimerPage.tsx`
  - **Acceptance Criteria**:
    - Status puasa diselesaikan dan tercatat durasinya.

- [ ] **US-4.2.3 Fasting Reminder**
  - **Deskripsi**: Notify when targetHours is reached.
  - **API Route**: Scheduled Cron
  - **DB Table**: `HL_notifications`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Notifikasi jika jam puasa yang ditargetkan sudah tercapai.

### Epic 4.3 — Gamification

- [ ] **US-4.3.1 Measurement Streak**
  - **Deskripsi**: Update daily streak on submit.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_userStreaks`
  - **Frontend**: `web/src/components/dashboard/StreakCounter.tsx`
  - **Acceptance Criteria**:
    - Streak bertambah jika submit berturut-turut beda hari.

- [ ] **US-4.3.2 Earn Badge**
  - **Deskripsi**: Award idempotent consistency badges.
  - **API Route**: `POST /api/measurements/submit`
  - **DB Table**: `HL_userBadges`
  - **Frontend**: `web/src/pages/profile/BadgesPage.tsx`
  - **Acceptance Criteria**:
    - Mendapat lencana "3 Hari Konsisten" jika syarat terpenuhi.

- [ ] **US-4.3.3 Safe Gamification**
  - **Deskripsi**: Prevent excessive measurement incentives.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Submit > 10x per hari tidak terus-menerus menambah skor secara abuser.

### Epic 4.4 — Pattern Detection

- [ ] **US-4.4.1 Sleep vs Blood Pressure Pattern**
  - **Deskripsi**: Safe correlation wording with minimum 14 days.
  - **API Route**: `POST /api/patterns/generate`
  - **DB Table**: `HL_patternInsights`
  - **Frontend**: `web/src/pages/patterns/InsightsPage.tsx`
  - **Acceptance Criteria**:
    - AI menganalisis tren tidur dan tekanan darah. Menolak analisis jika data < 14 hari.

- [ ] **US-4.4.2 Weight vs Blood Pressure Pattern**
  - **Deskripsi**: Trend insight if enough data.
  - **API Route**: `POST /api/patterns/generate`
  - **DB Table**: `HL_patternInsights`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Insight korelasional aman.

- [ ] **US-4.4.3 Medication vs Metric Pattern**
  - **Deskripsi**: Adherence insight without dosage advice.
  - **API Route**: `POST /api/patterns/generate`
  - **DB Table**: `HL_patternInsights`
  - **Frontend**: -
  - **Acceptance Criteria**:
    - Insight tingkat kepatuhan minum obat.

### Epic 4.5 — Accessibility Mode Lansia

- [ ] **US-4.5.1 Enable Senior Mode**
  - **Deskripsi**: Larger typography, buttons, simplified nav.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/styles/senior-mode.css`
  - **Acceptance Criteria**:
    - CSS root variable berubah drastis menjadi besar jika `accessibilityMode === 'senior'`.

- [ ] **US-4.5.2 High Contrast Mode**
  - **Deskripsi**: High-contrast theme with readable components.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/styles/high-contrast.css`
  - **Acceptance Criteria**:
    - Tampilan hitam-putih-kuning mencolok untuk visibilitas maksimal.

- [ ] **US-4.5.3 Senior Measurement Flow**
  - **Deskripsi**: One metric per screen flow.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/pages/measurement/SeniorMeasurementFlow.tsx`
  - **Acceptance Criteria**:
    - Flow wizard vertikal tanpa form kompleks (1 field/halaman).

### Epic 4.6 — PWA Full

- [ ] **US-4.6.1 Installable PWA**
  - **Deskripsi**: Manifest, icons, standalone mode.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/public/manifest.json`, Service Worker
  - **Acceptance Criteria**:
    - Muncul prompt instalasi di browser.

- [ ] **US-4.6.2 Offline Shell**
  - **Deskripsi**: App shell works offline and draft is local.
  - **API Route**: -
  - **DB Table**: -
  - **Frontend**: `web/src/sw.ts`, `IndexedDB`
  - **Acceptance Criteria**:
    - Aplikasi tetap bisa dirender saat internet mati.

- [ ] **US-4.6.3 Sync Draft When Online**
  - **Deskripsi**: User-approved draft sync.
  - **API Route**: `POST /api/measurements/sync`
  - **DB Table**: `HL_measurementDrafts`
  - **Frontend**: `web/src/components/sync/OfflineSyncBanner.tsx`
  - **Acceptance Criteria**:
    - Klik tombol "Sync" untuk mengirim draft ke server tanpa duplikasi.

### Epic 4.7 — Data Export

- [ ] **US-4.7.1 Export CSV**
  - **Deskripsi**: Export measurements by date range.
  - **API Route**: `GET /api/export/csv`
  - **DB Table**: `HL_measurementValues`
  - **Frontend**: `web/src/pages/settings/DataExportPage.tsx`
  - **Acceptance Criteria**:
    - Unduhan otomatis file CSV dengan MIME type `text/csv`.

- [ ] **US-4.7.2 Delete Account Data**
  - **Deskripsi**: Privacy flow with confirmation and audit log.
  - **API Route**: `POST /api/privacy/deleteAccount`
  - **DB Table**: (Soft delete / hapus dari seluruh tabel yang relasi ke userId)
  - **Frontend**: `web/src/pages/settings/PrivacyPage.tsx`
  - **Acceptance Criteria**:
    - Proses asynchronous untuk membersihkan seluruh data PII.

---

## Global Documentation Tasks

- [ ] DOC-1 Keep `api-contract.md` updated for every API change
- [ ] DOC-2 Keep `ARCHITECTURE.md` updated for every architecture/flow change
- [ ] DOC-3 Keep `design-system.md` updated for every UI component/theme change
- [ ] DOC-4 Keep `schema.sql` updated for every database change
- [ ] DOC-5 Keep `seed.sql` updated for every seed data change
- [ ] DOC-6 Keep `WORK_LOG.md` append-only and current
- [ ] DOC-7 Keep `HANDOFF.md` accurate after every task
