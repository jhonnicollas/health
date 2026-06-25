# PRD — HL Health Companion Web App

## 1. Nama Produk

HL Health Companion

Aplikasi web full Cloudflare untuk pencatatan, pembacaan foto alat kesehatan, interpretasi rule-based, rekomendasi AI, dashboard personal, caregiver monitoring, emergency alert, dan report dokter.

## 2. Tujuan Produk

Membuat aplikasi web multi-user yang membantu user mencatat hasil pengukuran kesehatan harian dari beberapa alat kesehatan melalui foto/upload attachment, lalu mengubah angka pada foto menjadi text box yang bisa diedit sebelum disimpan.

Aplikasi tidak bertujuan menggantikan dokter atau alat diagnosis medis. Aplikasi bertujuan menjadi:

- Buku catatan kesehatan digital.
- Pembaca angka alat kesehatan berbasis AI Vision.
- Dashboard tren kesehatan pribadi.
- Sistem reminder dan emergency alert.
- Generator laporan 30 hari yang siap dibawa ke dokter.
- Health assistant berbasis rule medis dan AI narasi aman.

## 3. Prinsip Utama Produk

### 3.1 Rule First, AI Assisted

Status kesehatan tidak boleh ditentukan bebas oleh AI.

Urutan logika:

```text
finalValue
→ rules engine dari HL_metricRules
→ status, severity, popup
→ AI hanya membuat narasi tambahan dan insight
```

AI tidak boleh membuat diagnosis, tidak boleh meresepkan obat, dan tidak boleh mengganti saran dokter.

### 3.2 User Verification Wajib

Semua hasil AI Vision harus masuk ke text box terlebih dahulu.

User wajib bisa:

- Melihat angka hasil AI.
- Mengedit angka.
- Melihat flag manualOverride.
- Submit hanya setelah angka benar.

### 3.3 Original Image Tidak Disimpan

Original image tidak disimpan ke R2 untuk menghemat resource.

Flow gambar:

```text
User foto/upload
→ client compress preview
→ AI extraction maksimal 5 detik
→ user validasi/edit angka
→ saat submit, client membuat attachment final compressed 50% + watermark tanggal
→ hanya file final disimpan ke R2
```

### 3.4 Fast Path First

AI Vision adalah fitur bantu, bukan blocker.

Target:

```text
AI extraction <= 5 detik
Jika > 5 detik → tampilkan manual input
Jika AI gagal → user input manual
Jika koneksi lambat → user tetap bisa submit manual
```

### 3.5 Full Feature per Sprint

Setiap sprint harus menghasilkan fitur yang lengkap untuk scope sprint tersebut, bukan prototype setengah jadi.

## 4. Stack Wajib

### 4.1 Runtime dan Backend

```text
Cloudflare Workers
Hono.js
Wrangler
TypeScript
```

### 4.2 AI

```text
Cloudflare Workers AI Vision Model
Cloudflare Workers AI Text LLM
Cloudflare Vectorize — Vector Database (Sprint 5)
```

Vectorize digunakan untuk menyimpan embeddings riwayat metrik, gejala harian, dan medical rules pengguna. Worker melakukan query similarity ke Vectorize sebelum memanggil AI Text LLM untuk memberikan konteks historis yang relevan (misal pola "lonjakan tensi saat sleepDuration < 5 jam").

### 4.3 Database

Gunakan database yang sudah ada.

```text
[[d1Databases]]
binding = "DB"
databaseName = "multi_Ai_db"
databaseId = "b80ca989-6771-427f-a656-c7ab6ffc17ce"
```

Catatan implementasi Wrangler sebenarnya memakai format Cloudflare standar [[d1_databases]], tetapi di dokumen aplikasi semua naming internal tetap camelCase.

### 4.4 Storage

Gunakan bucket yang sudah ada.

```text
[[r2Buckets]]
binding = "LOGS"
bucketName = "multi-apps-ai-bucket"
```

Catatan implementasi Wrangler sebenarnya memakai format Cloudflare standar [[r2_buckets]], tetapi di dokumen aplikasi semua naming internal tetap camelCase.

### 4.5 Async dan Scheduler

```text
Cloudflare Queues
Cloudflare Cron Triggers
```

### 4.6 Frontend

```text
React SPA / Vite
PWA
Responsive mobile-first
Tailwind CSS
shadcn/ui optional
```

## 5. Constraint Naming

### 5.1 Table Name

Semua table harus memakai prefix:

```text
HL_
```

Setelah prefix, nama table tidak boleh mengandung underscore.

Valid:

```text
HL_users
HL_userProfiles
HL_measurementSessions
HL_measurementValues
HL_metricRules
```

Tidak valid:

```text
HL_user_profiles
HL_measurement_sessions
health_users
users
```

### 5.2 Field Name

Semua field wajib camelCase.

Valid:

```text
userId
createdAt
measuredAt
finalValue
manualOverride
```

Tidak valid:

```text
user_id
created_at
final_value
manual_override
```

## 6. Device dan Metric Scope

### 6.1 Alat Kesehatan

Aplikasi harus mendukung 5 kelompok alat:

| Device Code | Alat | Fungsi |
| --- | --- | --- |
| yuwellYx106 | Yuwell YX106 Oximeter | SpO2 dan heart rate |
| omronHem7194t1fl | OMRON BT 7194 TFL | Sistolik, diastolik, pulse |
| sinocareM101 | Sinocare M101 GCU 3-in-1 | Gula darah, kolesterol, asam urat |
| thermometer | Termometer | Suhu tubuh |
| bodyScale | Timbangan badan | Berat badan |

### 6.2 Metric yang Harus Didukung

| Metric Code | Nama | Unit | Input | Attachment Wajib |
| --- | --- | --- | --- | --- |
| spo2 | Saturasi oksigen | % | Foto/manual | Ya |
| heartRate | Denyut jantung dari oximeter | bpm | Foto/manual | Ya |
| systolic | Tekanan sistolik | mmHg | Foto/manual | Ya |
| diastolic | Tekanan diastolik | mmHg | Foto/manual | Ya |
| bloodPressurePulse | Pulse dari tensimeter | bpm | Foto/manual | Ya |
| glucoseFasting | Gula darah puasa | mg/dL | Foto/manual | Ya |
| glucosePostMeal | Gula darah 2 jam PP | mg/dL | Foto/manual | Ya |
| cholesterolTotal | Kolesterol total | mg/dL | Foto/manual | Ya |
| uricAcid | Asam urat | mg/dL | Foto/manual | Ya |
| bodyWeight | Berat badan | kg | Foto/manual | Ya |
| bmi | Body Mass Index | index | Auto calculate | Tidak |
| waistCircumference | Lingkar perut | cm | Manual/foto | Opsional |
| bodyTemperature | Suhu tubuh | °C | Foto/manual | Ya |
| sleepDuration | Durasi tidur | hour | Manual | Tidak |
| height | Tinggi badan | cm | Onboarding/profile | Tidak |

## 7. Core Flow Final

### 7.1 Flow Input Pengukuran

```text
User login
    ↓
User pilih/checklist jenis pengukuran
    ↓
User foto/upload alat kesehatan
    ↓
Client compress preview image
    ↓
Gambar dikirim ke Worker API untuk OCR sementara
    ↓
Worker menjalankan Workers AI Vision maksimal 5 detik
    ↓
Jika AI sukses:
    hasil angka masuk ke text box
    ↓
Jika AI gagal/timeout:
    user input manual
    ↓
User edit manual override jika perlu
    ↓
Sistem validasi angka
    ↓
Popup interpretasi dari HL_metricRules
    ↓
User klik submit
    ↓
Client membuat attachment final:
    compressed 50%
    watermark tanggal, jam, userDisplayName, metricName
    ↓
Final data disimpan ke D1
    ↓
Attachment final disimpan ke R2 binding LOGS
    ↓
Telegram push dikirim setelah submit
    ↓
AI membuat saran:
    bandingkan hari ini vs 3 hari lalu vs 7 hari lalu
    ↓
Dashboard/report/update streak/reminder
```

### 7.2 Flow AI Timeout

```text
Start AI Vision
    ↓
Set timeout 5000 ms
    ↓
Jika selesai:
        tampilkan hasil
    ↓
Jika timeout:
        cancel response handling
        tampilkan manual input
        tampilkan pesan:
        "AI terlalu lama membaca foto. Silakan input manual agar proses tetap cepat."
```

### 7.3 Flow Submit

Submit harus tetap bisa berjalan walaupun AI tidak digunakan.

Required saat submit:

```text
userId
profileId
selectedMetrics
finalValue
measuredAt
attachmentFinal untuk metric yang wajib attachment
```

## 8. Sprint Roadmap

## Sprint 1 — Core Capture Full Feature

### Goal

Membangun fondasi pencatatan kesehatan lengkap: multi-user, onboarding, checklist pengukuran, upload/foto, AI extraction ≤5 detik, manual override, validasi angka, save D1, save attachment final ke R2, dashboard sederhana, dan Telegram push setelah submit.

### Scope

- Auth dan user profile.
- Onboarding tinggi badan, jenis kelamin, umur/tanggal lahir.
- Menu tambah pengukuran dengan checklist.
- Input foto/upload attachment.
- Client-side compression dan watermark.
- OCR/AI Vision sync dengan timeout 5 detik.
- Manual override.
- Validasi angka.
- Save final data ke D1.
- Save final evidence image ke R2.
- Telegram notification setelah submit.
- Dashboard harian sederhana.
- Audit log.

### User Stories

#### US1 — Login

Sebagai user, saya bisa login agar data kesehatan saya terpisah dari user lain.

Acceptance criteria:

```text
Given user belum login
When membuka dashboard
Then user diarahkan ke login

Given user login
When membuka dashboard
Then hanya data milik user tersebut yang tampil
```

#### US2 — Onboarding Profile

Sebagai user baru, saya harus input tinggi badan, jenis kelamin, dan tanggal lahir.

Acceptance criteria:

```text
Given user pertama kali login
When profile belum lengkap
Then user wajib menyelesaikan onboarding

Required:
heightCm
sex
birthDate
displayName
timezone
```

#### US3 — Checklist Pengukuran

Sebagai user, saya bisa memilih satu atau lebih jenis pengukuran dalam satu sesi.

Acceptance criteria:

```text
User bisa checklist:
Oximeter
Tensimeter
Gula darah
Kolesterol
Asam urat
Berat badan
Lingkar perut
Suhu tubuh
Durasi tidur

Jika user pilih Oximeter:
field spo2 dan heartRate muncul

Jika user pilih Tensimeter:
field systolic, diastolic, bloodPressurePulse muncul
```

#### US4 — Foto/Upload

Sebagai user, saya bisa mengambil foto atau upload gambar alat kesehatan.

Acceptance criteria:

```text
Input accept image
Mobile camera capture aktif
Preview image tampil
File maksimal default 5 MB sebelum kompres
Client resize maksimal 1280 px sisi terpanjang
Client compress quality 50%
```

#### US5 — AI Extraction Cepat

Sebagai user, saya ingin angka dari foto otomatis masuk ke text box.

Acceptance criteria:

```text
AI request timeout 5000 ms
Jika berhasil, angka masuk text box
Jika gagal, user tetap bisa input manual
Tidak ada original image yang disimpan ke R2 saat proses OCR sementara
```

#### US6 — Manual Override

Sebagai user, saya bisa mengedit angka hasil AI sebelum submit.

Acceptance criteria:

```text
Jika finalValue berbeda dari rawAiValue:
manualOverride = true

Jika finalValue sama:
manualOverride = false

rawAiValue tetap disimpan untuk audit jika AI menghasilkan nilai
```

#### US7 — Submit dan Save

Sebagai user, saya bisa submit data final.

Acceptance criteria:

```text
Setelah submit:
HL_measurementSessions terisi
HL_measurementValues terisi
HL_measurementAttachments terisi jika ada attachment
R2 hanya menyimpan file final watermarked compressed
Telegram push dikirim
Dashboard hari ini update
```

### Sprint 1 Deliverables

```text
Frontend core pages
Hono API core routes
D1 schema core
R2 upload final evidence
AI Vision extraction
Manual override
Telegram after submit
Daily dashboard
Basic audit log
```

## Sprint 2 — Health Intelligence Full Feature

### Goal

Membangun interpretasi angka, rules medis dari CSV, popup edukatif, AI recommendation, report harian/mingguan/bulanan, dan comparison engine hari ini vs 3 hari vs 7 hari.

### Scope

- Seed HL_metricRules dari CSV existing.
- Tambah rule yang belum ada.
- Popup interpretasi setelah validasi.
- AI recommendation setelah submit.
- Comparison hari ini vs 3 hari lalu vs 7 hari lalu.
- Dashboard mingguan dan bulanan.
- Report harian, mingguan, bulanan.
- Knowledge base setiap alat ukur.
- Health explanation guardrails.

### AI Recommendation Logic

Worker wajib melakukan Vectorize similarity query untuk mengambil riwayat metrik dan gejala yang relevan sebagai konteks AI, kemudian membangun summary ringkas:

```text
{
  "today": {
    "spo2": 98,
    "systolic": 142,
    "diastolic": 91,
    "glucoseFasting": 110
  },
  "threeDayComparison": {
    "systolicDelta": 8,
    "sleepDelta": -1.5
  },
  "sevenDayComparison": {
    "systolicAverage": 135,
    "sleepAverage": 6.2
  },
  "vectorizeContext": {
    "documents": [
      { "id": "vec-xxx", "score": 0.89, "text": "Pasien riwayat hipertensi tahap 2, tensi sering tinggi saat kurang tidur" },
      { "id": "vec-yyy", "score": 0.72, "text": "Gula darah puasa cenderung normal, kolesterol borderline" }
    ]
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

Prompt AI (Aggressive Doctor Mode):

```text
Anda adalah seorang Dokter Senior dan Spesialis Medis. Anda memiliki akses ke seluruh data historis dan metrik kesehatan pengguna.
1. Lakukan analisa mendalam dan agresif terhadap kondisi pasien berdasarkan data yang diberikan.
2. Berikan "Clinical Confidence Score" (1-100) terhadap analisa Anda.
3. Berikan rekomendasi medis, peringatan, dan insight layaknya dokter spesialis yang sedang mendiagnosis pasien.

WAJIB sertakan teks ini tepat di akhir respons Anda tanpa diubah sedikit pun:
"[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."
```

Server-side enforcement:
> Jika *response* AI tidak mengandung teks disclaimer di atas, *server* wajib menyisipkannya secara otomatis di akhir respons sebelum dikembalikan ke *client*. Hal ini memastikan setiap respons AI yang ditampilkan ke pengguna tetap memiliki klausa pelepasan tanggung jawab medis.

### Clinical Confidence Score

Setiap respons AI wajib menyertakan `patternScore` berupa angka 1–100 beserta justifikasi singkat. Score ini ditentukan sendiri oleh AI berdasarkan:
- Konsistensi data historis (semakin konsisten semakin tinggi)
- Jumlah data yang tersedia (semakin banyak semakin tinggi)
- Kekuatan korelasi yang terdeteksi
- Ketersediaan data pembanding (3 hari / 7 hari / lebih)

### Comparison Rules

```text
todayValue = nilai terakhir hari ini
threeDayValue = rata-rata 3 hari terakhir sebelum hari ini
sevenDayValue = rata-rata 7 hari terakhir sebelum hari ini

delta3Day = todayValue - threeDayValue
delta7Day = todayValue - sevenDayValue
```

Untuk metric yang tidak diukur setiap hari:

```text
Jika data pembanding tidak cukup:
tampilkan "Belum cukup data pembanding"
```

### Sprint 2 Deliverables

```text
Metric rules engine
Popup interpretation engine
AI recommendation engine
Daily report
Weekly dashboard
Monthly dashboard
Knowledge base alat ukur
Comparison today vs 3 days vs 7 days
```

## Sprint 3 — Family & Alert System Full Feature

### Goal

Membangun linked family/caregiver, Telegram alert, emergency contact, reminder, browser notification, dan medication tracker.

### Scope

- Family profile link.
- Role caregiver/viewer/emergencyContact.
- Telegram bot connect.
- Telegram push setelah setiap submit.
- Emergency alert rule-based.
- Reminder harian.
- Browser notification.
- Medication tracker.
- Caregiver dashboard.
- Alert log.

### Roles

| Role | Lihat Dashboard | Input Data | Edit Data | Terima Telegram | Terima Emergency |
| --- | --- | --- | --- | --- | --- |
| owner | Ya | Ya | Ya | Ya | Ya |
| caregiver | Ya | Opsional | Terbatas | Ya | Ya |
| viewer | Ya | Tidak | Tidak | Opsional | Tidak |
| emergencyContact | Terbatas | Tidak | Tidak | Ya | Ya |
| doctorViewer | Report saja | Tidak | Tidak | Tidak | Tidak |

### Telegram After Submit

Setiap submit mengirim ringkasan Telegram jika user sudah mengaktifkan Telegram.

Contoh message:

```text
HL Health Companion

Nama: Budi
Waktu: 2026-06-20 20:15
Data baru:
- SpO2: 98% — Normal
- Pulse: 73 bpm — Normal
- Tekanan darah: 142/91 mmHg — Tinggi

Saran: Cek popup aplikasi untuk detail.
```

### Emergency Telegram

Emergency alert dikirim ke emergency contact jika severity emergency.

Contoh:

```text
EMERGENCY HEALTH ALERT

Nama: Budi
Waktu: 2026-06-20 20:15
Metric: SpO2
Nilai: 88%
Status: Hipoksemia Berat

Mohon segera cek kondisi user. Jika ada sesak, nyeri dada, kebingungan, bibir kebiruan, atau lemas berat, segera cari bantuan medis.
```

### Medication Tracker

Fitur:

```text
Tambah obat
Jadwal minum obat
Checklist sudah diminum
Catatan efek
Hubungkan dengan dashboard tekanan darah/gula darah
```

### Reminder

Reminder dikirim via:

```text
Telegram
Browser notification
In-app notification
```

Default reminder:

```text
Pagi: cek tekanan darah / gula darah puasa
Malam: input durasi tidur / obat
Mingguan: review dashboard
Bulanan: generate report dokter
```

### Sprint 3 Deliverables

```text
Family linking
Caregiver dashboard
Telegram integration
Emergency alert engine
Reminder engine
Browser notification
Medication tracker
Alert history
```

## Sprint 4 — Advanced Health Companion Full Feature

### Goal

Membangun fitur lanjutan: pattern detection, PDF dokter, fasting timer, gamification, accessibility lansia, PWA penuh, dan offline-friendly shell.

### Scope

- Doctor Ready PDF 30 hari.
- Fasting timer.
- Gamification badge dan streak.
- Pattern detection.
- Accessibility mode lansia.
- PWA installable.
- Offline shell.
- Advanced analytics.
- Export data.
- Doctor viewer share link.

### Doctor Ready PDF

PDF 30 hari harus berisi:

```text
Identitas user
Umur
Jenis kelamin
Tinggi badan
Berat terakhir
BMI terakhir
Ringkasan 30 hari
Grafik tekanan darah
Grafik SpO2
Grafik gula darah
Grafik berat badan
Grafik tidur
Daftar alert
Daftar medication log
Catatan AI summary
Lampiran thumbnail bukti pengukuran
Disclaimer
```

### Fasting Timer

Fitur:

```text
Start fasting
Stop fasting
Target fasting 8 jam / 10 jam / 12 jam
Jenis test:
- glucoseFasting
- cholesterolTotal
- uricAcid
Reminder saat waktu test valid
```

### Gamification

Gamification tidak boleh membuat user mengambil pengukuran berlebihan.

Badge aman:

```text
3 hari konsisten
7 hari konsisten
30 hari konsisten
Report dokter dibuat
Medication checklist lengkap
Tidur cukup 7 hari
```

### Pattern Detection

Gunakan istilah:

```text
Pattern detection
Correlation insight
Personal trend
```

Jangan gunakan klaim:

```text
Causal inference pasti
X menyebabkan Y
```

Contoh insight aman:

```text
Dalam data 14 hari terakhir, saat durasi tidur kurang dari 6 jam, rata-rata sistolik tercatat 9 mmHg lebih tinggi dibanding hari dengan tidur minimal 7 jam. Ini hanya pola dari data yang tercatat, bukan diagnosis.
```

### Accessibility Mode Lansia

Mode lansia wajib punya:

```text
Font besar
Button besar
Kontras tinggi
Bahasa sederhana
Navigasi 3 menu utama
Voice-friendly label
Tidak banyak chart kecil
```

### PWA Full

PWA wajib punya:

```text
manifest
service worker
install prompt
offline shell
camera upload friendly
cached static assets
notification permission flow
```

### Sprint 4 Deliverables

```text
Doctor Ready PDF
Fasting timer
Gamification
Pattern detection
Accessibility mode
PWA full
Export data
Doctor share report
```

## 9. Database Design

Semua table memakai prefix HL_. Semua field camelCase.

### 9.1 HL_users

Fungsi: menyimpan akun user.

Fields:

```text
id TEXT PRIMARY KEY
email TEXT UNIQUE
passwordHash TEXT
authProvider TEXT
displayName TEXT
telegramEnabled INTEGER DEFAULT 0
browserPushEnabled INTEGER DEFAULT 0
createdAt TEXT
updatedAt TEXT
lastLoginAt TEXT
```

### 9.2 HL_userProfiles

Fungsi: menyimpan profil kesehatan user.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
sex TEXT
birthDate TEXT
heightCm REAL
timezone TEXT
accessibilityMode TEXT DEFAULT 'normal'
theme TEXT DEFAULT 'light'
createdAt TEXT
updatedAt TEXT
```

Allowed sex:

```text
male
female
other
```

Allowed accessibilityMode:

```text
normal
senior
highContrast
```

Allowed theme:

```text
light
warm
dark
highContrast
```

### 9.3 HL_devices

Fungsi: daftar device yang didukung.

Fields:

```text
id TEXT PRIMARY KEY
deviceCode TEXT UNIQUE
deviceName TEXT
deviceType TEXT
brand TEXT
model TEXT
active INTEGER
createdAt TEXT
updatedAt TEXT
```

Seed:

```text
yuwellYx106
omronHem7194t1fl
sinocareM101
thermometer
bodyScale
manualInput
```

### 9.4 HL_metricCatalog

Fungsi: master metric.

Fields:

```text
id TEXT PRIMARY KEY
metricCode TEXT UNIQUE
metricName TEXT
category TEXT
unit TEXT
inputType TEXT
requiresAttachment INTEGER
requiresSex INTEGER
requiresFasting INTEGER
isCalculated INTEGER
active INTEGER
sortOrder INTEGER
createdAt TEXT
updatedAt TEXT
```

### 9.5 HL_metricRules

Fungsi: rules status, severity, popup, dan saran.

Fields:

```text
id TEXT PRIMARY KEY
metricCode TEXT
sex TEXT
ageMin INTEGER
ageMax INTEGER
minValue REAL
maxValue REAL
unit TEXT
status TEXT
severity TEXT
popupTitle TEXT
popupMessage TEXT
recommendation TEXT
sourceLabel TEXT
emergencyLevel TEXT
active INTEGER
createdAt TEXT
updatedAt TEXT
```

Allowed severity:

```text
normal
info
warning
high
critical
emergency
```

Allowed emergencyLevel:

```text
none
watch
urgent
emergency
```

### 9.6 HL_measurementSessions

Fungsi: satu sesi pengukuran.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
profileId TEXT
measuredAt TEXT
source TEXT
notes TEXT
hasAi INTEGER
hasAttachment INTEGER
hasEmergency INTEGER
createdAt TEXT
updatedAt TEXT
```

Allowed source:

```text
photo
upload
manual
mixed
```

### 9.7 HL_measurementValues

Fungsi: angka hasil pengukuran.

Fields:

```text
id TEXT PRIMARY KEY
sessionId TEXT
userId TEXT
metricCode TEXT
deviceCode TEXT
rawAiValue REAL
finalValue REAL
unit TEXT
confidence REAL
manualOverride INTEGER
status TEXT
severity TEXT
ruleId TEXT
measuredAt TEXT
createdAt TEXT
updatedAt TEXT
```

### 9.8 HL_measurementAttachments

Fungsi: bukti foto final yang sudah compressed dan watermarked.

Fields:

```text
id TEXT PRIMARY KEY
sessionId TEXT
userId TEXT
metricCode TEXT
r2Key TEXT
fileName TEXT
fileType TEXT
fileSize INTEGER
watermarked INTEGER
compressed INTEGER
compressionQuality INTEGER
imageWidth INTEGER
imageHeight INTEGER
createdAt TEXT
```

R2 path:

```text
HL/users/{userId}/measurements/{sessionId}/{metricCode}-{attachmentId}.webp
```

### 9.9 HL_aiExtractions

Fungsi: log hasil AI Vision tanpa menyimpan original image.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
sessionDraftId TEXT
deviceCode TEXT
metricGroup TEXT
rawResponse TEXT
parsedJson TEXT
durationMs INTEGER
success INTEGER
timeout INTEGER
confidence REAL
createdAt TEXT
```

### 9.10 HL_aiRecommendations

Fungsi: hasil saran AI setelah submit.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
sessionId TEXT
summaryText TEXT
todayJson TEXT
threeDayJson TEXT
sevenDayJson TEXT
modelName TEXT
durationMs INTEGER
createdAt TEXT
```

### 9.11 HL_notifications

Fungsi: semua notifikasi.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
channel TEXT
notificationType TEXT
title TEXT
message TEXT
status TEXT
payloadJson TEXT
sentAt TEXT
createdAt TEXT
```

Allowed channel:

```text
inApp
telegram
browser
email
```

Allowed status:

```text
pending
sent
failed
skipped
```

### 9.12 HL_telegramLinks

Fungsi: koneksi Telegram.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
telegramChatId TEXT
telegramUsername TEXT
verified INTEGER
enabled INTEGER
createdAt TEXT
updatedAt TEXT
```

### 9.13 HL_familyLinks

Fungsi: linked family dan caregiver.

Fields:

```text
id TEXT PRIMARY KEY
ownerUserId TEXT
linkedUserId TEXT
role TEXT
status TEXT
canViewDashboard INTEGER
canInputMeasurement INTEGER
canReceiveAlert INTEGER
createdAt TEXT
updatedAt TEXT
```

Allowed role:

```text
owner
caregiver
viewer
emergencyContact
doctorViewer
```

### 9.14 HL_alerts

Fungsi: emergency dan warning log.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
sessionId TEXT
metricCode TEXT
finalValue REAL
unit TEXT
status TEXT
severity TEXT
alertType TEXT
message TEXT
acknowledged INTEGER
acknowledgedAt TEXT
createdAt TEXT
```

### 9.15 HL_medications

Fungsi: master obat user.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
medicationName TEXT
dosageText TEXT
scheduleText TEXT
active INTEGER
createdAt TEXT
updatedAt TEXT
```

### 9.16 HL_medicationLogs

Fungsi: catatan minum obat.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
medicationId TEXT
takenAt TEXT
status TEXT
note TEXT
createdAt TEXT
```

Allowed status:

```text
taken
skipped
missed
unknown
```

### 9.17 HL_fastingSessions

Fungsi: fasting timer.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
fastingType TEXT
targetHours REAL
startedAt TEXT
endedAt TEXT
status TEXT
createdAt TEXT
updatedAt TEXT
```

Allowed fastingType:

```text
glucoseFasting
cholesterolTotal
uricAcid
general
```

### 9.18 HL_badges

Fungsi: badge master.

Fields:

```text
id TEXT PRIMARY KEY
badgeCode TEXT UNIQUE
badgeName TEXT
description TEXT
icon TEXT
active INTEGER
createdAt TEXT
```

### 9.19 HL_userBadges

Fungsi: badge user.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
badgeCode TEXT
earnedAt TEXT
createdAt TEXT
```

### 9.20 HL_streaks

Fungsi: streak user.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
streakType TEXT
currentCount INTEGER
bestCount INTEGER
lastDate TEXT
updatedAt TEXT
```

### 9.21 HL_reports

Fungsi: report generated.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
reportType TEXT
rangeStart TEXT
rangeEnd TEXT
r2Key TEXT
status TEXT
createdAt TEXT
```

Allowed reportType:

```text
daily
weekly
monthly
doctorReady30d
```

### 9.22 HL_knowledgeArticles

Fungsi: user manual dan knowledge base.

Fields:

```text
id TEXT PRIMARY KEY
slug TEXT UNIQUE
title TEXT
category TEXT
contentMarkdown TEXT
sortOrder INTEGER
active INTEGER
createdAt TEXT
updatedAt TEXT
```

### 9.23 HL_auditLogs

Fungsi: audit semua action penting.

Fields:

```text
id TEXT PRIMARY KEY
userId TEXT
action TEXT
entityType TEXT
entityId TEXT
metadataJson TEXT
createdAt TEXT
```

## 10. Initial Metric Rules

Rules existing dari CSV wajib di-seed ke HL_metricRules. Data yang belum ada wajib ditambahkan.

### 10.1 SpO2

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 95 | 100 | Normal | normal | none |
| 90 | 94.9 | Hipoksemia Ringan | warning | watch |
| 0 | 89.9 | Hipoksemia Berat | emergency | emergency |

### 10.2 Heart Rate

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 60 | 100 | Normal | normal | none |
| 0 | 59.9 | Bradikardia | warning | watch |
| 100.1 | 250 | Takikardia | warning | watch |

### 10.3 Blood Pressure Systolic

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 90 | 119.9 | Normal | normal | none |
| 120 | 129.9 | Pra-Hipertensi | warning | watch |
| 130 | 139.9 | Hipertensi Tahap 1 | high | watch |
| 140 | 179.9 | Hipertensi Tahap 2 | high | urgent |
| 180 | 300 | Krisis Hipertensi | emergency | emergency |

### 10.4 Blood Pressure Diastolic

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 60 | 79.9 | Normal | normal | none |
| 80 | 89.9 | Hipertensi Tahap 1 | high | watch |
| 90 | 119.9 | Hipertensi Tahap 2 | high | urgent |
| 120 | 200 | Krisis Hipertensi | emergency | emergency |

### 10.5 Glucose Fasting

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 69.9 | Rendah | critical | urgent |
| 70 | 99.9 | Normal | normal | none |
| 100 | 125.9 | Prediabetes | warning | watch |
| 126 | 600 | Tinggi | high | urgent |

### 10.6 Glucose Post Meal

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 69.9 | Rendah | critical | urgent |
| 70 | 139.9 | Normal | normal | none |
| 140 | 199.9 | Toleransi Glukosa Terganggu | warning | watch |
| 200 | 600 | Tinggi | high | urgent |

### 10.7 Cholesterol Total

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 199.9 | Optimal | normal | none |
| 200 | 239.9 | Batas Tinggi | warning | watch |
| 240 | 600 | Tinggi | high | urgent |

### 10.8 Uric Acid Male

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 3.3 | Rendah | info | none |
| 3.4 | 7 | Normal | normal | none |
| 7.1 | 20 | Tinggi | warning | watch |

### 10.9 Uric Acid Female

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 2.3 | Rendah | info | none |
| 2.4 | 6 | Normal | normal | none |
| 6.1 | 20 | Tinggi | warning | watch |

### 10.10 BMI

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 18.4 | Underweight | warning | watch |
| 18.5 | 24.9 | Normal | normal | none |
| 25 | 29.9 | Overweight | warning | watch |
| 30 | 100 | Obesitas | high | watch |

### 10.11 Waist Circumference Male

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 93.9 | Risiko Rendah | normal | none |
| 94 | 102 | Risiko Meningkat | warning | watch |
| 102.1 | 300 | Risiko Sangat Meningkat | high | watch |

### 10.12 Waist Circumference Female

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 79.9 | Risiko Rendah | normal | none |
| 80 | 88 | Risiko Meningkat | warning | watch |
| 88.1 | 300 | Risiko Sangat Meningkat | high | watch |

### 10.13 Body Temperature

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 34.9 | Sangat Rendah | emergency | emergency |
| 35 | 37.4 | Normal | normal | none |
| 37.5 | 37.9 | Meningkat | warning | watch |
| 38 | 38.9 | Demam | high | urgent |
| 39 | 45 | Demam Tinggi | critical | urgent |

### 10.14 Sleep Duration

| minValue | maxValue | status | severity | emergencyLevel |
| --- | --- | --- | --- | --- |
| 0 | 5.9 | Kurang | warning | watch |
| 6 | 6.9 | Hampir Cukup | info | none |
| 7 | 9 | Cukup | normal | none |
| 9.1 | 24 | Terlalu Lama | info | watch |

### 10.15 Body Weight

Berat badan tidak dinilai normal/abnormal sendiri. Status utama dihitung dari BMI dan trend.

Rule trend:

```text
Jika berat naik > 2% dalam 7 hari → warning
Jika berat turun > 2% dalam 7 hari → info
Jika berat stabil ±2% dalam 7 hari → normal
```

## 11. API Design

Base route:

```text
/api
```

### 11.1 Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### 11.2 Profile

```text
GET  /api/profile
PUT  /api/profile
POST /api/profile/onboarding
```

### 11.3 Measurement

```text
GET  /api/metrics/catalog
POST /api/measurements/extract
POST /api/measurements/validate
POST /api/measurements/submit
GET  /api/measurements/history
GET  /api/measurements/:id
DELETE /api/measurements/:id
```

### 11.4 Dashboard

```text
GET /api/dashboard/today
GET /api/dashboard/weekly
GET /api/dashboard/monthly
GET /api/dashboard/comparison
```

### 11.5 AI

```text
POST /api/ai/extractImage
POST /api/ai/recommendation
GET  /api/ai/recommendations
```

### 11.6 Telegram

```text
POST /api/telegram/connect
POST /api/telegram/verify
POST /api/telegram/test
PUT  /api/telegram/settings
```

### 11.7 Family

```text
POST /api/family/invite
POST /api/family/accept
GET  /api/family/links
PUT  /api/family/:id
DELETE /api/family/:id
```

### 11.8 Medication

```text
GET  /api/medications
POST /api/medications
PUT  /api/medications/:id
POST /api/medications/:id/log
GET  /api/medications/logs
```

### 11.9 Fasting

```text
POST /api/fasting/start
POST /api/fasting/stop
GET  /api/fasting/current
GET  /api/fasting/history
```

### 11.10 Reports

```text
GET  /api/reports/daily
GET  /api/reports/weekly
GET  /api/reports/monthly
POST /api/reports/doctorReady30d
GET  /api/reports/:id/download
```

### 11.11 Knowledge Base

```text
GET /api/kb
GET /api/kb/:slug
```

## 12. AI Vision Extraction

### 12.1 Request

```text
POST /api/measurements/extract
```

Form data:

```text
file
deviceCode
metricGroup
selectedMetricCodes
```

### 12.2 Response Success

```text
{
  "success": true,
  "timeout": false,
  "durationMs": 3200,
  "deviceCode": "yuwellYx106",
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
```

### 12.3 Response Timeout

```text
{
  "success": false,
  "timeout": true,
  "durationMs": 5000,
  "message": "AI terlalu lama membaca foto. Silakan input manual."
}
```

### 12.4 Device Prompt Template

#### Oximeter

```text
Extract readings from a pulse oximeter photo.
Return JSON only.
Required keys:
spo2, heartRate, confidence, needsManualReview.
If unsure, set value null and needsManualReview true.
Do not provide medical advice.
Append disclaimer: "[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."
```

#### Blood Pressure Monitor

```text
Extract readings from a blood pressure monitor photo.
Return JSON only.
Required keys:
systolic, diastolic, bloodPressurePulse, confidence, needsManualReview.
If unsure, set value null and needsManualReview true.
Do not provide medical advice.
Append disclaimer: "[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."
```

#### Sinocare GCU

```text
Extract only the selected metric from this Sinocare GCU device photo.
Selected metric can be glucoseFasting, glucosePostMeal, cholesterolTotal, or uricAcid.
Return JSON only.
If unsure, set value null and needsManualReview true.
Do not infer unselected metrics.
Append disclaimer: "[NamaModelAI] is AI and can make mistakes. Segala keputusan, tindakan medis, dan akibat yang timbul dari informasi ini adalah tanggung jawab Anda sepenuhnya, bukan tanggung jawab pemilik aplikasi maupun aplikasi ini."
```

## 13. Attachment Processing

### 13.1 Prinsip

Original image tidak disimpan.

Yang disimpan:

```text
final compressed watermarked image only
```

### 13.2 Watermark

Watermark wajib berisi:

```text
HL Health Companion
displayName
measuredAt
metricName
finalValue + unit
```

Contoh:

```text
HL Health Companion | Budi | 2026-06-20 20:15 | SpO2 98%
```

### 13.3 Compression

Client-side:

```text
format: webp preferred
quality: 0.5
maxWidth: 1280
maxHeight: 1280
```

Fallback:

```text
jpeg quality 0.5
```

### 13.4 R2 Path

```text
HL/users/{userId}/measurements/{sessionId}/{metricCode}-{attachmentId}.webp
```

## 14. Dashboard

### 14.1 Today Dashboard

Cards:

```text
Last SpO2
Last Blood Pressure
Last Glucose
Last Cholesterol
Last Uric Acid
Last Weight
BMI
Sleep Duration
Medication Status
Alert Status
```

### 14.2 Weekly Dashboard

Charts:

```text
Blood pressure trend
SpO2 trend
Glucose trend
Weight trend
Sleep trend
Medication adherence
```

### 14.3 Monthly Dashboard

Summary:

```text
Average systolic
Average diastolic
Highest systolic
Lowest SpO2
Average glucose
Latest cholesterol
Latest uric acid
Weight change
BMI change
Sleep average
Total alerts
Total measurement days
Streak
```

## 15. Report

### 15.1 Daily Report

Berisi:

```text
Data hari ini
Status tiap metric
Popup summary
AI recommendation
Attachment evidence list
```

### 15.2 Weekly Report

Berisi:

```text
Trend 7 hari
Comparison hari ini vs 3 hari
Comparison hari ini vs 7 hari
Alert summary
Medication adherence
Sleep trend
```

### 15.3 Monthly Report

Berisi:

```text
Trend 30 hari
Rata-rata tiap metric
Nilai tertinggi/terendah
Perubahan berat dan BMI
Pattern detection awal
```

### 15.4 Doctor Ready PDF

Berisi:

```text
Profil user
Ringkasan 30 hari
Grafik utama
Alert log
Medication log
AI summary aman
Lampiran evidence thumbnail
Disclaimer
```

## 16. Notification

### 16.1 Telegram Push Setelah Submit

Setelah submit berhasil:

```text
Worker simpan data
Worker enqueue notification job
Queue consumer kirim Telegram
Jika queue unavailable, kirim langsung non-blocking best effort
```

Submit response tidak boleh menunggu Telegram terlalu lama.

Max wait:

```text
1000 ms
```

### 16.2 Emergency Alert

Jika rule severity emergency:

```text
Show emergency modal
Send Telegram to user
Send Telegram to emergency contacts
Create HL_alerts row
Create HL_notifications row
```

## 17. Free Tier Efficiency Strategy

### 17.1 R2 Efficiency

```text
Jangan simpan original image
Simpan hanya final compressed watermarked image
Gunakan webp quality 50%
Generate PDF hanya on demand
Jangan generate report PDF otomatis setiap hari
```

### 17.2 D1 Efficiency

```text
Gunakan batch insert untuk measurement session + values + attachment
Index field yang sering dipakai
Gunakan range date untuk dashboard
Jangan simpan raw image base64 di D1
Simpan JSON seperlunya
```

Recommended indexes:

```text
HL_measurementSessions userId measuredAt
HL_measurementValues userId metricCode measuredAt
HL_measurementAttachments userId sessionId
HL_alerts userId createdAt
HL_notifications userId createdAt
```

### 17.3 AI Efficiency

```text
AI Vision hanya dipanggil saat user klik ekstrak
Timeout 5 detik
Tidak retry otomatis
Tidak queue OCR default
Fallback manual input
AI recommendation pakai summary kecil, bukan seluruh history
```

### 17.4 Queue Efficiency

Queues hanya untuk:

```text
telegram push
emergency alert
AI recommendation background
PDF generation
scheduled reminder
```

Tidak dipakai untuk OCR default agar user tidak menunggu lama.

### 17.5 Frontend Efficiency

```text
Compress image di browser
Watermark di browser canvas
Lazy load chart
Cache static assets via PWA
```

## 18. Security dan Privacy

Wajib:

```text
R2 private
Signed URL untuk attachment
RBAC untuk family/caregiver
Audit log untuk edit/delete/share
Consent sebelum emergency contact menerima alert
Input validation semua metric
Rate limit OCR endpoint
Rate limit Telegram endpoint
No public health data URL
```

Data sensitif yang sebaiknya dienkripsi di application layer:

```text
telegramChatId
emergency contact data
medication note
personal note
```

## 19. UI Pages

### Public

```text
/login
/register
/privacy
/terms
```

### User

```text
/onboarding
/dashboard
/measurements/new
/measurements/history
/reports
/ai-assistant
/medications
/fasting
/family
/notifications
/settings
/kb
```

### Senior Mode

```text
/senior/dashboard
/senior/new-measurement
/senior/emergency
```

## 20. Menu Tambah Pengukuran

UI checklist:

```text
[ ] Oximeter
[ ] Tensimeter
[ ] Gula Darah Puasa
[ ] Gula Darah 2 Jam PP
[ ] Kolesterol
[ ] Asam Urat
[ ] Berat Badan
[ ] Lingkar Perut
[ ] Suhu Tubuh
[ ] Durasi Tidur
```

Jika user pilih item, form muncul dinamis.

Setiap card pengukuran berisi:

```text
Upload/foto
Button: Baca Otomatis
Text box angka
Unit
Status validation
Manual override indicator
Popup preview
```

## 21. Validation Rules

### Numeric Input

```text
Tidak boleh kosong untuk metric yang dipilih
Harus angka
Harus dalam physicalRange
Harus sesuai unit
```

### Physical Range

| Metric | Min | Max |
| --- | --- | --- |
| spo2 | 0 | 100 |
| heartRate | 20 | 250 |
| systolic | 50 | 300 |
| diastolic | 30 | 200 |
| bloodPressurePulse | 20 | 250 |
| glucoseFasting | 20 | 600 |
| glucosePostMeal | 20 | 600 |
| cholesterolTotal | 50 | 600 |
| uricAcid | 0 | 20 |
| bodyWeight | 1 | 300 |
| waistCircumference | 20 | 300 |
| bodyTemperature | 30 | 45 |
| sleepDuration | 0 | 24 |

## 22. Done Criteria

### Sprint 1 Done

```text
User bisa login
User bisa onboarding
User bisa input measurement multi-checklist
AI extraction timeout 5 detik berjalan
Manual override berjalan
Final data masuk D1
Final attachment masuk R2
Original image tidak tersimpan
Telegram push setelah submit berjalan
Daily dashboard berjalan
```

### Sprint 2 Done

```text
Rules dari CSV masuk HL_metricRules
Rules tambahan tersedia
Popup interpretasi berjalan
AI recommendation berjalan
Comparison hari ini vs 3 hari vs 7 hari berjalan
Weekly dashboard berjalan
Monthly dashboard berjalan
Knowledge base tersedia
```

### Sprint 3 Done

```text
Family link berjalan
Caregiver dashboard berjalan
Telegram emergency alert berjalan
Reminder berjalan
Browser notification berjalan
Medication tracker berjalan
Alert log berjalan
```

### Sprint 4 Done

```text
Doctor Ready PDF berjalan
Fasting timer berjalan
Gamification berjalan
Pattern detection berjalan
Accessibility mode berjalan
PWA installable
Offline shell aktif
Export data tersedia
```

## 23. Out of Scope

Untuk menjaga keamanan produk, aplikasi tidak boleh:

```text
Meresepkan obat
Mengubah dosis obat
Mengklaim menggantikan dokter
Mengirim emergency alert tanpa consent
Menyimpan original image tanpa persetujuan eksplisit
```

> **Catatan:** AI diperbolehkan memberikan analisis mendalam dan diagnosis potensial berdasarkan data yang diberikan, sepanjang setiap output menyertakan peringatan pelepasan tanggung jawab medis yang jelas. Lihat bagian **Clinical Disclaimer Enforcement** pada Sprint 2 untuk detail implementasi server-side disclaimer.

## 24. Product Success Metric

### Core

```text
>= 90% submit berhasil tanpa error
>= 95% manual input tetap bisa dilakukan saat AI gagal
AI timeout tidak lebih dari 5 detik
```

### Usage

```text
User mencatat minimal 3 hari per minggu
Report dokter 30 hari berhasil dibuat
Reminder meningkatkan konsistensi input
```

### Safety

```text
0 public attachment leak
100% emergency alert punya audit log
100% caregiver access punya consent
```

## 25. Prioritas Implementasi

Urutan build yang disarankan:

```text
1. D1 schema HL_*
2. Metric catalog + rules seed
3. Auth + onboarding
4. Measurement new page
5. Client compress + watermark
6. AI extraction endpoint
7. Manual override + validation
8. Submit endpoint
9. Telegram after submit
10. Dashboard today
11. Health intelligence
12. Weekly/monthly dashboard
13. Family/alert/reminder
14. PDF/PWA/accessibility
```

## 26. Catatan Final

Aplikasi harus selalu mengutamakan:

```text
Cepat
Hemat resource
Manual override
Rule-based medical interpretation
AI sebagai pembantu, bukan penentu
Attachment final saja, bukan original
Multi-user aman
Telegram setelah submit
Full feature per sprint
```
