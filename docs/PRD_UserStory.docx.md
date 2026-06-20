# User Stories — HL Health Companion Web App

## Sprint 1 — Core Capture Full Feature

### Tujuan Sprint

Membangun fitur inti aplikasi: multi-user, onboarding profil kesehatan, input pengukuran via checklist, foto/upload, AI Vision extraction maksimal 5 detik, manual override, validasi angka, simpan final data ke D1, simpan attachment final ke R2, Telegram push setelah submit, dan dashboard harian sederhana.

## Epic 1.1 — Auth dan User Profile

### US-1.1.1 — Register User

Sebagai user baru, saya ingin membuat akun agar data kesehatan saya tersimpan secara pribadi.

**Acceptance Criteria**

    Given user membuka halaman register
    When user mengisi email, password, dan displayName
    Then sistem membuat data di HL_users

    Given email sudah terdaftar
    When user submit register
    Then sistem menolak register dan menampilkan pesan error

    Given register berhasil
    When user diarahkan setelah register
    Then user masuk ke halaman onboarding

**Data terkait**

    HL_users
    HL_auditLogs

### US-1.1.2 — Login User

Sebagai user, saya ingin login agar saya bisa mengakses dashboard dan data kesehatan saya.

**Acceptance Criteria**

    Given user memiliki akun valid
    When user login dengan email dan password benar
    Then sistem membuat session login

    Given password salah
    When user submit login
    Then sistem menampilkan pesan gagal login

    Given user belum login
    When user mengakses /dashboard
    Then user diarahkan ke /login

**Data terkait**

    HL_users
    HL_auditLogs

### US-1.1.3 — Onboarding Profil Kesehatan

Sebagai user baru, saya wajib mengisi tinggi badan, jenis kelamin, tanggal lahir, dan timezone agar sistem bisa menghitung BMI dan rule berbasis profil.

**Acceptance Criteria**

    Given user baru login pertama kali
    When profile belum lengkap
    Then user wajib diarahkan ke onboarding

    Required fields:
    displayName
    sex
    birthDate
    heightCm
    timezone

    Given user submit data onboarding valid
    When data tersimpan
    Then sistem membuat data di HL_userProfiles

    Given onboarding selesai
    When user membuka aplikasi
    Then user diarahkan ke dashboard

**Data terkait**

    HL_userProfiles
    HL_auditLogs

### US-1.1.4 — Edit Profil Dasar

Sebagai user, saya ingin bisa mengubah tinggi badan, tema, timezone, dan mode tampilan.

**Acceptance Criteria**

    Given user membuka halaman settings
    When user mengubah heightCm atau timezone
    Then data di HL_userProfiles diperbarui

    Given user mengubah theme
    When perubahan disimpan
    Then tampilan aplikasi mengikuti theme baru

    Given user mengubah accessibilityMode
    When perubahan disimpan
    Then UI mengikuti mode baru

**Data terkait**

    HL_userProfiles

## Epic 1.2 — Measurement Input

### US-1.2.1 — Checklist Jenis Pengukuran

Sebagai user, saya ingin memilih satu atau lebih jenis pengukuran dalam satu sesi.

**Acceptance Criteria**

    Given user membuka halaman tambah pengukuran
    When user melihat daftar checklist
    Then user bisa memilih:
    Oximeter
    Tensimeter
    Gula Darah Puasa
    Gula Darah 2 Jam PP
    Kolesterol
    Asam Urat
    Berat Badan
    Lingkar Perut
    Suhu Tubuh
    Durasi Tidur

    Given user memilih Oximeter
    Then field spo2 dan heartRate muncul

    Given user memilih Tensimeter
    Then field systolic, diastolic, dan bloodPressurePulse muncul

    Given user memilih Berat Badan
    Then field bodyWeight muncul dan BMI dihitung otomatis jika heightCm tersedia

**Data terkait**

    HL_metricCatalog
    HL_measurementSessions
    HL_measurementValues

### US-1.2.2 — Dynamic Form per Metric

Sebagai user, saya ingin form berubah sesuai checklist yang saya pilih agar input tidak membingungkan.

**Acceptance Criteria**

    Given user memilih beberapa metric
    When checklist berubah
    Then form metric muncul/hilang secara dinamis

    Given user menghapus checklist metric
    When metric sudah memiliki value sementara
    Then sistem menampilkan konfirmasi hapus input metric tersebut

    Given metric membutuhkan attachment
    Then card metric menampilkan area upload/foto

**Data terkait**

    HL_metricCatalog

### US-1.2.3 — Foto atau Upload Attachment

Sebagai user, saya ingin mengambil foto atau upload gambar alat kesehatan.

**Acceptance Criteria**

    Given user membuka card metric yang butuh attachment
    When user klik upload/foto
    Then user bisa memilih file gambar atau membuka kamera mobile

    Given file dipilih
    When file berhasil dibaca
    Then preview gambar tampil

    Given file bukan gambar
    When user upload
    Then sistem menolak file

    Given ukuran file terlalu besar
    When file dipilih
    Then client melakukan resize dan compress sebelum proses berikutnya

**Data terkait**

    HL_measurementAttachments

### US-1.2.4 — Client-Side Compression

Sebagai user, saya ingin gambar otomatis dikompres agar upload cepat dan hemat storage.

**Acceptance Criteria**

    Given user memilih gambar
    When gambar diproses di browser
    Then gambar di-resize maksimal 1280 px sisi terpanjang

    Given gambar selesai diproses
    Then kualitas dikompres sekitar 50%

    Given browser mendukung webp
    Then output attachment final menggunakan webp

    Given browser tidak mendukung webp
    Then fallback menggunakan jpeg

**Catatan**

Original image tidak boleh disimpan ke R2.

### US-1.2.5 — Watermark Attachment Final

Sebagai user, saya ingin bukti foto memiliki watermark tanggal dan hasil agar bukti pengukuran jelas.

**Acceptance Criteria**

    Given user sudah mengisi finalValue
    When user submit measurement
    Then client membuat attachment final dengan watermark

    Watermark wajib berisi:
    HL Health Companion
    displayName
    measuredAt
    metricName
    finalValue + unit

    Given watermark berhasil dibuat
    Then hanya attachment final yang dikirim ke R2

**Data terkait**

    HL_measurementAttachments

## Epic 1.3 — AI Vision Extraction

### US-1.3.1 — AI Extract Oximeter

Sebagai user, saya ingin foto oximeter otomatis terbaca menjadi SpO2 dan heart rate.

**Acceptance Criteria**

    Given user upload foto oximeter
    When user klik Baca Otomatis
    Then sistem memanggil Workers AI Vision

    Given AI berhasil membaca dalam <= 5 detik
    Then field spo2 dan heartRate terisi otomatis

    Given AI gagal membaca
    Then field tetap bisa diisi manual

    Given AI timeout > 5 detik
    Then sistem menghentikan flow AI dan menampilkan manual input

**Data terkait**

    HL_aiExtractions
    HL_measurementValues

### US-1.3.2 — AI Extract Tensimeter

Sebagai user, saya ingin foto tensimeter otomatis terbaca menjadi sistolik, diastolik, dan pulse.

**Acceptance Criteria**

    Given user upload foto tensimeter
    When user klik Baca Otomatis
    Then sistem mencoba membaca systolic, diastolic, dan bloodPressurePulse

    Given AI mengembalikan angka valid
    Then semua angka masuk ke text box masing-masing

    Given salah satu angka tidak terbaca
    Then hanya field yang terbaca yang diisi
    And field lain tetap bisa diisi manual

**Data terkait**

    HL_aiExtractions
    HL_measurementValues

### US-1.3.3 — AI Extract Sinocare GCU

Sebagai user, saya ingin foto Sinocare M101 terbaca sesuai mode test yang saya pilih.

**Acceptance Criteria**

    Given user memilih glucoseFasting
    When user upload foto Sinocare
    Then AI hanya membaca nilai glucoseFasting

    Given user memilih cholesterolTotal
    When user upload foto Sinocare
    Then AI hanya membaca nilai cholesterolTotal

    Given user memilih uricAcid
    When user upload foto Sinocare
    Then AI hanya membaca nilai uricAcid

    AI tidak boleh menebak metric yang tidak dipilih

**Data terkait**

    HL_aiExtractions
    HL_measurementValues

### US-1.3.4 — AI Timeout 5 Detik

Sebagai user, saya tidak ingin menunggu AI terlalu lama.

**Acceptance Criteria**

    Given user klik Baca Otomatis
    When AI belum selesai dalam 5000 ms
    Then sistem menampilkan pesan:
    "AI terlalu lama membaca foto. Silakan input manual."

    Given AI timeout
    Then user tetap bisa submit manual

    Given AI timeout
    Then sistem menyimpan log timeout di HL_aiExtractions

**Data terkait**

    HL_aiExtractions

## Epic 1.4 — Manual Override dan Validation

### US-1.4.1 — Manual Override Angka AI

Sebagai user, saya ingin bisa mengedit angka hasil AI sebelum disimpan.

**Acceptance Criteria**

    Given AI mengisi rawAiValue
    When user mengubah angka di text box
    Then manualOverride = true

    Given user tidak mengubah angka dari AI
    When submit
    Then manualOverride = false

    Given user input manual tanpa AI
    When submit
    Then rawAiValue = null dan manualOverride = false

**Data terkait**

    HL_measurementValues

### US-1.4.2 — Validasi Physical Range

Sebagai user, saya ingin sistem menolak angka yang tidak masuk akal.

**Acceptance Criteria**

    Given user input spo2 > 100
    When validasi berjalan
    Then sistem menolak input

    Given user input bodyTemperature di luar 30-45
    When validasi berjalan
    Then sistem menolak input

    Given user input systolic lebih kecil dari diastolic
    When validasi berjalan
    Then sistem menampilkan warning validasi

**Data terkait**

    HL_metricCatalog
    HL_metricRules

### US-1.4.3 — BMI Auto Calculate

Sebagai user, saya ingin BMI dihitung otomatis dari tinggi dan berat badan.

**Acceptance Criteria**

    Given user memiliki heightCm di profile
    When user input bodyWeight
    Then sistem menghitung bmi

    Formula:
    bmi = bodyWeight / ((heightCm / 100) ^ 2)

    Given heightCm belum tersedia
    When user input bodyWeight
    Then sistem meminta user melengkapi tinggi badan

**Data terkait**

    HL_userProfiles
    HL_measurementValues

## Epic 1.5 — Submit dan Storage

### US-1.5.1 — Submit Measurement Session

Sebagai user, saya ingin menyimpan semua hasil pengukuran dalam satu sesi.

**Acceptance Criteria**

    Given semua field valid
    When user klik submit
    Then sistem membuat row di HL_measurementSessions

    Given sesi memiliki beberapa metric
    When submit
    Then sistem membuat beberapa row di HL_measurementValues

    Given metric butuh attachment
    When attachment tersedia
    Then sistem menyimpan metadata di HL_measurementAttachments

**Data terkait**

    HL_measurementSessions
    HL_measurementValues
    HL_measurementAttachments

### US-1.5.2 — Save Final Attachment ke R2

Sebagai user, saya ingin attachment final tersimpan sebagai bukti.

**Acceptance Criteria**

    Given user submit measurement dengan attachment
    When submit berhasil
    Then file final disimpan ke R2 binding LOGS

    Given file berhasil disimpan
    Then r2Key disimpan di HL_measurementAttachments

    Given original image belum di-watermark
    Then original image tidak boleh disimpan

**R2 Path**

    HL/users/{userId}/measurements/{sessionId}/{metricCode}-{attachmentId}.webp

### US-1.5.3 — Audit Log Submit

Sebagai sistem, saya ingin mencatat action penting untuk keamanan dan audit.

**Acceptance Criteria**

    Given user submit measurement
    When submit berhasil
    Then sistem membuat audit log action measurementSubmit

    Given user mengedit angka AI
    When submit
    Then metadataJson mencatat manualOverride true

**Data terkait**

    HL_auditLogs

## Epic 1.6 — Telegram Push dan Dashboard Harian

### US-1.6.1 — Telegram Push Setelah Submit

Sebagai user, saya ingin menerima ringkasan Telegram setelah submit.

**Acceptance Criteria**

    Given user sudah connect Telegram
    When submit berhasil
    Then sistem mengirim Telegram summary

    Given Telegram belum aktif
    When submit berhasil
    Then sistem skip Telegram tanpa error

    Given Telegram gagal dikirim
    When error terjadi
    Then data measurement tetap tersimpan
    And status failed dicatat di HL_notifications

**Data terkait**

    HL_telegramLinks
    HL_notifications

### US-1.6.2 — Dashboard Hari Ini

Sebagai user, saya ingin melihat hasil pengukuran hari ini.

**Acceptance Criteria**

    Given user membuka dashboard
    When ada data hari ini
    Then sistem menampilkan latest value per metric

    Given belum ada data hari ini
    Then sistem menampilkan empty state

    Dashboard minimal menampilkan:
    SpO2
    Tekanan darah
    Gula darah
    Kolesterol
    Asam urat
    Berat badan
    BMI
    Suhu tubuh
    Durasi tidur

**Data terkait**

    HL_measurementSessions
    HL_measurementValues

# Sprint 2 — Health Intelligence Full Feature

## Tujuan Sprint

Membangun rules engine, popup interpretasi, AI recommendation, comparison hari ini vs 3 hari vs 7 hari, dashboard mingguan, dashboard bulanan, report harian/mingguan/bulanan, dan knowledge base alat ukur.

## Epic 2.1 — Metric Rules Engine

### US-2.1.1 — Seed Metric Rules dari CSV

Sebagai admin/developer, saya ingin mengisi master rule kesehatan dari CSV agar interpretasi angka konsisten.

**Acceptance Criteria**

    Given CSV rule tersedia
    When seed dijalankan
    Then data masuk ke HL_metricRules

    Given rule sudah ada
    When seed dijalankan ulang
    Then sistem tidak membuat duplikat

    Given rule belum lengkap
    When seed dijalankan
    Then sistem menambahkan rule tambahan default

**Data terkait**

    HL_metricRules
    HL_metricCatalog

### US-2.1.2 — Evaluate Metric Status

Sebagai sistem, saya ingin menentukan status metric berdasarkan finalValue.

**Acceptance Criteria**

    Given finalValue dan metricCode tersedia
    When validation selesai
    Then sistem mencari rule di HL_metricRules

    Given user memiliki sex male/female
    When metric membutuhkan sex
    Then sistem memilih rule sesuai sex

    Given rule ditemukan
    Then sistem mengisi status, severity, ruleId, dan emergencyLevel

**Data terkait**

    HL_metricRules
    HL_measurementValues

### US-2.1.3 — Rule Fallback

Sebagai sistem, saya ingin tetap aman jika rule tidak ditemukan.

**Acceptance Criteria**

    Given metric tidak memiliki rule
    When submit dilakukan
    Then status = "Belum Ada Interpretasi"
    And severity = "info"

    Given rule tidak ditemukan
    Then sistem tidak memblokir submit
    And membuat audit log missingRule

**Data terkait**

    HL_metricRules
    HL_auditLogs

## Epic 2.2 — Popup Interpretasi

### US-2.2.1 — Popup Setelah Validasi

Sebagai user, saya ingin melihat arti angka sebelum submit final.

**Acceptance Criteria**

    Given user mengisi angka valid
    When sistem menjalankan validasi
    Then popup interpretasi tampil

    Popup berisi:
    metricName
    finalValue
    unit
    status
    severity
    popupTitle
    popupMessage
    recommendation
    sourceLabel

**Data terkait**

    HL_metricRules

### US-2.2.2 — Popup Multi Metric

Sebagai user, saya ingin melihat interpretasi semua metric dalam satu sesi.

**Acceptance Criteria**

    Given user menginput lebih dari satu metric
    When popup tampil
    Then semua metric ditampilkan dalam section terpisah

    Given ada severity emergency
    Then popup menampilkan warning emergency paling atas

    Given semua normal
    Then popup menampilkan ringkasan normal

### US-2.2.3 — Emergency Warning Modal

Sebagai user, saya ingin melihat peringatan khusus jika angka masuk kategori emergency.

**Acceptance Criteria**

    Given finalValue memiliki severity emergency
    When validasi selesai
    Then sistem menampilkan emergency modal

    Emergency modal harus berisi:
    angka kritis
    arti umum
    anjuran cek ulang
    anjuran cari bantuan medis jika ada gejala bahaya

    User harus mencentang konfirmasi:
    "Saya mengerti bahwa ini bukan diagnosis dan perlu verifikasi ulang."

**Data terkait**

    HL_alerts

## Epic 2.3 — AI Recommendation

### US-2.3.1 — Generate AI Recommendation Setelah Submit

Sebagai user, saya ingin mendapat saran singkat setelah submit.

**Acceptance Criteria**

    Given submit berhasil
    When data hari ini tersimpan
    Then sistem membuat summary data untuk AI

    Given AI berhasil memberi rekomendasi
    Then rekomendasi disimpan di HL_aiRecommendations

    Given AI gagal
    Then aplikasi tetap menampilkan rule-based recommendation

**Data terkait**

    HL_aiRecommendations

### US-2.3.2 — Compare Hari Ini vs 3 Hari

Sebagai user, saya ingin tahu apakah angka hari ini naik atau turun dibanding 3 hari terakhir.

**Acceptance Criteria**

    Given user memiliki data 3 hari terakhir
    When recommendation dibuat
    Then sistem menghitung delta hari ini vs average 3 hari

    Given data tidak cukup
    Then sistem menampilkan:
    "Belum cukup data 3 hari untuk perbandingan."

**Data terkait**

    HL_measurementValues

### US-2.3.3 — Compare Hari Ini vs 7 Hari

Sebagai user, saya ingin tahu tren angka hari ini dibanding 7 hari terakhir.

**Acceptance Criteria**

    Given user memiliki data 7 hari terakhir
    When recommendation dibuat
    Then sistem menghitung delta hari ini vs average 7 hari

    Given data tidak cukup
    Then sistem menampilkan:
    "Belum cukup data 7 hari untuk perbandingan."

**Data terkait**

    HL_measurementValues

### US-2.3.4 — AI Safety Guardrail

Sebagai product owner, saya ingin AI tidak memberi diagnosis atau resep obat.

**Acceptance Criteria**

    Given AI recommendation dibuat
    When prompt dikirim
    Then prompt harus mengandung instruksi:
    bukan dokter
    jangan diagnosis
    jangan resep obat
    gunakan data yang diberikan saja

    Given response AI mengandung diagnosis keras atau resep obat
    Then sistem menolak response dan memakai fallback rule-based text

**Data terkait**

    HL_aiRecommendations
    HL_auditLogs

## Epic 2.4 — Dashboard Mingguan dan Bulanan

### US-2.4.1 — Weekly Dashboard

Sebagai user, saya ingin melihat tren 7 hari terakhir.

**Acceptance Criteria**

    Given user membuka weekly dashboard
    When data tersedia
    Then sistem menampilkan chart 7 hari untuk:
    blood pressure
    spo2
    glucose
    bodyWeight
    sleepDuration

    Given data kosong
    Then sistem menampilkan empty state

**Data terkait**

    HL_measurementValues

### US-2.4.2 — Monthly Dashboard

Sebagai user, saya ingin melihat ringkasan 30 hari terakhir.

**Acceptance Criteria**

    Given user membuka monthly dashboard
    When data tersedia
    Then sistem menampilkan:
    average
    min
    max
    latest
    measurementCount
    alertCount

    Given metric jarang diukur
    Then sistem tetap menampilkan latest value

**Data terkait**

    HL_measurementValues
    HL_alerts

### US-2.4.3 — Trend Indicator

Sebagai user, saya ingin melihat indikator naik/turun/stabil pada metric utama.

**Acceptance Criteria**

    Given ada data pembanding
    When dashboard tampil
    Then setiap card metric menampilkan:
    naik
    turun
    stabil
    belum cukup data

    Trend dihitung dari average periode sekarang vs periode sebelumnya

## Epic 2.5 — Reports dan Knowledge Base

### US-2.5.1 — Daily Report

Sebagai user, saya ingin melihat report harian dari semua pengukuran hari ini.

**Acceptance Criteria**

    Given user membuka daily report
    When data hari ini tersedia
    Then report menampilkan semua metric, status, popup message, dan recommendation

    Given tidak ada data hari ini
    Then report menampilkan ajakan input pengukuran

### US-2.5.2 — Weekly Report

Sebagai user, saya ingin melihat rangkuman 7 hari.

**Acceptance Criteria**

    Given user membuka weekly report
    When data tersedia
    Then report menampilkan:
    trend 7 hari
    alert summary
    best day
    worst day
    measurement adherence

### US-2.5.3 — Monthly Report

Sebagai user, saya ingin melihat rangkuman bulanan.

**Acceptance Criteria**

    Given user membuka monthly report
    When data tersedia
    Then report menampilkan:
    rata-rata metric
    nilai tertinggi/terendah
    jumlah hari mencatat
    jumlah alert
    AI monthly summary

### US-2.5.4 — Knowledge Base Alat Ukur

Sebagai user, saya ingin membaca panduan alat ukur agar cara pengukuran lebih benar.

**Acceptance Criteria**

    Given user membuka halaman knowledge base
    Then user bisa melihat artikel untuk:
    Yuwell YX106
    OMRON HEM 7194 T1 FL
    Sinocare M101
    Termometer
    Timbangan badan

    Artikel minimal berisi:
    cara pakai
    tips foto
    kesalahan umum
    arti metric
    kapan harus cek ulang

**Data terkait**

    HL_knowledgeArticles

# Sprint 3 — Family & Alert System Full Feature

## Tujuan Sprint

Membangun linked family/caregiver, permission sharing, Telegram alert, emergency contact, reminder harian, browser notification, medication tracker, caregiver dashboard, dan alert log.

## Epic 3.1 — Telegram Integration

### US-3.1.1 — Connect Telegram

Sebagai user, saya ingin menghubungkan Telegram agar bisa menerima notifikasi.

**Acceptance Criteria**

    Given user membuka notification settings
    When user klik connect Telegram
    Then sistem membuat token verifikasi

    Given user mengirim token ke bot Telegram
    When token valid
    Then telegramChatId tersimpan di HL_telegramLinks

    Given verifikasi berhasil
    Then telegramEnabled = true di HL_users

**Data terkait**

    HL_telegramLinks
    HL_users

### US-3.1.2 — Test Telegram Notification

Sebagai user, saya ingin mengetes Telegram agar yakin notifikasi berjalan.

**Acceptance Criteria**

    Given Telegram sudah connected
    When user klik test notification
    Then sistem mengirim pesan test

    Given pesan berhasil
    Then HL_notifications status = sent

    Given gagal
    Then status = failed dan error dicatat

**Data terkait**

    HL_notifications

### US-3.1.3 — Telegram Summary After Submit

Sebagai user, saya ingin menerima ringkasan otomatis setelah submit.

**Acceptance Criteria**

    Given user sudah connect Telegram
    When measurement submit berhasil
    Then Telegram dikirim maksimal sebagai background job

    Pesan berisi:
    displayName
    measuredAt
    metric list
    status
    link dashboard

## Epic 3.2 — Family dan Caregiver

### US-3.2.1 — Invite Family / Caregiver

Sebagai user, saya ingin mengundang keluarga atau caregiver untuk melihat data saya.

**Acceptance Criteria**

    Given user membuka family settings
    When user memasukkan email caregiver
    Then sistem membuat invitation

    Given invitation dikirim
    Then status = pending di HL_familyLinks

**Data terkait**

    HL_familyLinks
    HL_notifications

### US-3.2.2 — Accept Family Invitation

Sebagai caregiver, saya ingin menerima undangan agar bisa memantau user.

**Acceptance Criteria**

    Given caregiver menerima invitation
    When caregiver klik accept
    Then status HL_familyLinks menjadi active

    Given invitation expired
    When caregiver klik accept
    Then sistem menolak invitation

### US-3.2.3 — Role Permission

Sebagai owner, saya ingin mengatur hak akses caregiver.

**Acceptance Criteria**

    Given owner membuka family settings
    When owner memilih role caregiver
    Then sistem menyimpan permission:
    canViewDashboard
    canInputMeasurement
    canReceiveAlert

    Given role emergencyContact
    Then akses dashboard default terbatas
    And canReceiveAlert = true

### US-3.2.4 — Caregiver Dashboard

Sebagai caregiver, saya ingin melihat dashboard keluarga yang ditautkan.

**Acceptance Criteria**

    Given caregiver memiliki family link active
    When caregiver membuka caregiver dashboard
    Then daftar user yang dipantau tampil

    Given caregiver memilih salah satu user
    Then dashboard user tersebut tampil sesuai permission

    Given caregiver tidak punya permission
    Then akses ditolak

## Epic 3.3 — Emergency Alert System

### US-3.3.1 — Create Emergency Alert

Sebagai sistem, saya ingin membuat alert jika angka masuk kategori emergency.

**Acceptance Criteria**

    Given measurement memiliki severity emergency
    When submit berhasil
    Then sistem membuat row di HL_alerts

    Given emergency alert dibuat
    Then acknowledged = false

**Data terkait**

    HL_alerts

### US-3.3.2 — Send Emergency Telegram

Sebagai user, saya ingin emergency contact menerima Telegram jika angka saya kritis.

**Acceptance Criteria**

    Given user punya emergencyContact active
    When alert emergency dibuat
    Then sistem mengirim Telegram ke emergency contact

    Pesan berisi:
    nama user
    metric
    finalValue
    unit
    status
    measuredAt
    anjuran cek ulang dan cari bantuan medis jika ada gejala bahaya

**Data terkait**

    HL_alerts
    HL_notifications
    HL_familyLinks
    HL_telegramLinks

### US-3.3.3 — Acknowledge Alert

Sebagai user/caregiver, saya ingin menandai alert sudah dilihat.

**Acceptance Criteria**

    Given alert belum acknowledged
    When user klik acknowledge
    Then acknowledged = true
    And acknowledgedAt terisi

    Given caregiver punya permission
    When caregiver acknowledge alert
    Then sistem menyimpan audit log

**Data terkait**

    HL_alerts
    HL_auditLogs

## Epic 3.4 — Reminder dan Browser Notification

### US-3.4.1 — Reminder Settings

Sebagai user, saya ingin mengatur jadwal reminder.

**Acceptance Criteria**

    Given user membuka reminder settings
    When user memilih waktu reminder
    Then sistem menyimpan preferensi reminder

    Reminder types:
    morningMeasurement
    eveningMedication
    sleepInput
    weeklyReview
    monthlyReport

**Data terkait**

    HL_notifications

### US-3.4.2 — Daily Reminder Cron

Sebagai sistem, saya ingin mengirim reminder harian sesuai jadwal.

**Acceptance Criteria**

    Given Cron Trigger berjalan
    When ada reminder due
    Then sistem membuat notification job

    Given Telegram aktif
    Then reminder dikirim via Telegram

    Given browser push aktif
    Then reminder dikirim via browser notification

### US-3.4.3 — Browser Notification Opt-In

Sebagai user, saya ingin mengaktifkan browser notification.

**Acceptance Criteria**

    Given browser mendukung push notification
    When user klik enable notification
    Then browser meminta permission

    Given permission granted
    Then subscription tersimpan

    Given permission denied
    Then sistem menampilkan instruksi mengaktifkan manual

## Epic 3.5 — Medication Tracker

### US-3.5.1 — Add Medication

Sebagai user, saya ingin mencatat obat rutin.

**Acceptance Criteria**

    Given user membuka medication page
    When user menambah obat
    Then data tersimpan di HL_medications

    Required:
    medicationName
    dosageText
    scheduleText
    active

**Data terkait**

    HL_medications

### US-3.5.2 — Checklist Medication Taken

Sebagai user, saya ingin mencentang obat yang sudah diminum.

**Acceptance Criteria**

    Given user memiliki medication active
    When user klik taken
    Then sistem membuat row di HL_medicationLogs

    Given user skip obat
    When user klik skipped
    Then status skipped tersimpan

**Data terkait**

    HL_medicationLogs

### US-3.5.3 — Medication Insight on Dashboard

Sebagai user, saya ingin melihat hubungan sederhana antara obat dan metric.

**Acceptance Criteria**

    Given user mencatat medication dan tekanan darah
    When dashboard mingguan dibuka
    Then sistem menampilkan medication adherence

    Given data cukup
    Then AI boleh memberi insight ringan
    Tanpa diagnosis dan tanpa saran perubahan dosis

# Sprint 4 — Advanced Health Companion Full Feature

## Tujuan Sprint

Membangun Doctor Ready PDF, fasting timer, gamification, pattern detection, accessibility mode lansia, PWA penuh, offline shell, data export, dan doctor share report.

## Epic 4.1 — Doctor Ready PDF

### US-4.1.1 — Generate Doctor Ready PDF 30 Hari

Sebagai user, saya ingin membuat laporan PDF 30 hari untuk ditunjukkan ke dokter.

**Acceptance Criteria**

    Given user klik Generate Doctor Ready PDF
    When data 30 hari tersedia
    Then sistem membuat report PDF

    PDF berisi:
    profil user
    umur
    jenis kelamin
    tinggi badan
    berat terakhir
    BMI terakhir
    ringkasan metric
    grafik tekanan darah
    grafik SpO2
    grafik gula darah
    grafik berat badan
    grafik tidur
    alert log
    medication log
    AI summary aman
    disclaimer

**Data terkait**

    HL_reports
    HL_measurementValues
    HL_alerts
    HL_medicationLogs

### US-4.1.2 — Save PDF to R2

Sebagai user, saya ingin PDF tersimpan agar bisa diunduh ulang.

**Acceptance Criteria**

    Given PDF berhasil dibuat
    When upload ke R2 berhasil
    Then r2Key tersimpan di HL_reports

    Given upload gagal
    Then status report = failed
    And user melihat pesan error

**R2 Path**

    HL/users/{userId}/reports/doctorReady30d-{reportId}.pdf

### US-4.1.3 — Download PDF

Sebagai user, saya ingin mengunduh PDF kapan saja.

**Acceptance Criteria**

    Given user memiliki report
    When user klik download
    Then sistem membuat signed URL atau stream file dari R2

    Given report milik user lain
    When user mencoba akses
    Then sistem menolak akses

### US-4.1.4 — Doctor Viewer Share Link

Sebagai user, saya ingin membagikan report ke dokter dengan akses terbatas.

**Acceptance Criteria**

    Given user membuat share link
    When link dibuat
    Then link memiliki expiredAt

    Given dokter membuka link valid
    Then hanya report PDF yang tampil

    Given link expired
    Then akses ditolak

## Epic 4.2 — Fasting Timer

### US-4.2.1 — Start Fasting Timer

Sebagai user, saya ingin memulai timer puasa sebelum cek gula darah atau kolesterol.

**Acceptance Criteria**

    Given user membuka fasting page
    When user memilih fastingType dan targetHours
    Then sistem membuat HL_fastingSessions

    Allowed fastingType:
    glucoseFasting
    cholesterolTotal
    uricAcid
    general

**Data terkait**

    HL_fastingSessions

### US-4.2.2 — Stop Fasting Timer

Sebagai user, saya ingin menghentikan fasting timer setelah selesai.

**Acceptance Criteria**

    Given fasting session active
    When user klik stop
    Then endedAt terisi
    And status = completed

    Given user membatalkan
    Then status = cancelled

### US-4.2.3 — Fasting Reminder

Sebagai user, saya ingin diingatkan saat waktu cek sudah valid.

**Acceptance Criteria**

    Given fasting timer mencapai targetHours
    When Cron/Queue memproses reminder
    Then user menerima Telegram/browser notification

    Given user belum connect notification
    Then in-app notification dibuat

## Epic 4.3 — Gamification

### US-4.3.1 — Measurement Streak

Sebagai user, saya ingin melihat streak agar termotivasi mencatat rutin.

**Acceptance Criteria**

    Given user submit measurement hari ini
    When submit berhasil
    Then HL_streaks diperbarui

    Given user melewati satu hari tanpa measurement
    Then currentCount reset sesuai rule streak

**Data terkait**

    HL_streaks

### US-4.3.2 — Earn Badge

Sebagai user, saya ingin mendapat badge saat konsisten.

**Acceptance Criteria**

    Given user mencapai 3 hari konsisten
    Then badge threeDayConsistent diberikan

    Given user mencapai 7 hari konsisten
    Then badge sevenDayConsistent diberikan

    Given badge sudah dimiliki
    Then badge tidak dibuat duplikat

**Data terkait**

    HL_badges
    HL_userBadges

### US-4.3.3 — Safe Gamification

Sebagai product owner, saya tidak ingin gamification mendorong pengukuran berlebihan.

**Acceptance Criteria**

    Given user sudah mencatat hari ini
    When user mencatat lagi berkali-kali
    Then streak hanya dihitung satu kali per hari

    Badge tidak boleh mendorong user mengukur secara berlebihan

## Epic 4.4 — Pattern Detection

### US-4.4.1 — Sleep vs Blood Pressure Pattern

Sebagai user, saya ingin tahu apakah kurang tidur berhubungan dengan tekanan darah saya.

**Acceptance Criteria**

    Given user memiliki minimal 14 hari data sleepDuration dan bloodPressure
    When pattern detection berjalan
    Then sistem menghitung rata-rata sistolik pada hari tidur < 6 jam
    And membandingkan dengan hari tidur >= 7 jam

    Output harus memakai kata:
    "berhubungan"
    "cenderung"
    "berdasarkan data tercatat"

    Output tidak boleh memakai kata:
    "menyebabkan secara pasti"

### US-4.4.2 — Weight vs Blood Pressure Pattern

Sebagai user, saya ingin tahu apakah perubahan berat badan berkaitan dengan tekanan darah.

**Acceptance Criteria**

    Given user memiliki data berat dan tekanan darah
    When data cukup
    Then sistem menampilkan correlation insight ringan

    Given data tidak cukup
    Then sistem menampilkan:
    "Belum cukup data untuk mendeteksi pola."

### US-4.4.3 — Medication vs Metric Pattern

Sebagai user, saya ingin melihat pola antara kepatuhan obat dan hasil pengukuran.

**Acceptance Criteria**

    Given user mencatat medication log dan measurement
    When data minimal 14 hari tersedia
    Then sistem menampilkan insight adherence sederhana

    Insight tidak boleh menyarankan perubahan dosis obat

## Epic 4.5 — Accessibility Mode Lansia

### US-4.5.1 — Enable Senior Mode

Sebagai user lansia, saya ingin tampilan lebih besar dan mudah dibaca.

**Acceptance Criteria**

    Given user membuka settings
    When user memilih senior mode
    Then accessibilityMode = senior

    Senior mode wajib:
    font besar
    button besar
    kontras tinggi
    menu disederhanakan

**Data terkait**

    HL_userProfiles

### US-4.5.2 — High Contrast Mode

Sebagai user, saya ingin mode kontras tinggi agar mudah membaca layar.

**Acceptance Criteria**

    Given user memilih highContrast
    When setting disimpan
    Then UI berubah ke warna kontras tinggi

    Semua tombol dan text harus tetap terbaca

### US-4.5.3 — Senior Measurement Flow

Sebagai user lansia, saya ingin flow input yang lebih sederhana.

**Acceptance Criteria**

    Given senior mode aktif
    When user membuka tambah pengukuran
    Then hanya tombol besar dan pilihan utama yang tampil

    Given user memilih metric
    Then sistem menampilkan satu metric per layar

## Epic 4.6 — PWA Full

### US-4.6.1 — Installable PWA

Sebagai user, saya ingin aplikasi bisa dipasang di HP seperti aplikasi native.

**Acceptance Criteria**

    Given user membuka aplikasi di browser mobile
    When browser mendukung PWA
    Then install prompt tersedia

    PWA harus memiliki:
    manifest
    icon
    name
    themeColor
    startUrl
    display standalone

### US-4.6.2 — Offline Shell

Sebagai user, saya ingin aplikasi tetap terbuka walaupun koneksi hilang.

**Acceptance Criteria**

    Given user sudah pernah membuka aplikasi
    When koneksi offline
    Then shell aplikasi tetap bisa dibuka

    Given user mencoba submit offline
    Then sistem menyimpan draft lokal
    And menampilkan status belum tersinkron

### US-4.6.3 — Sync Draft When Online

Sebagai user, saya ingin draft offline otomatis dikirim saat online.

**Acceptance Criteria**

    Given ada draft lokal
    When koneksi kembali online
    Then aplikasi menawarkan sync

    Given user setuju sync
    Then draft dikirim ke submit endpoint

## Epic 4.7 — Data Export

### US-4.7.1 — Export CSV

Sebagai user, saya ingin mengekspor data kesehatan ke CSV.

**Acceptance Criteria**

    Given user membuka export page
    When user memilih range tanggal
    Then sistem menghasilkan CSV

    CSV berisi:
    measuredAt
    metricCode
    finalValue
    unit
    status
    severity
    manualOverride

### US-4.7.2 — Delete Account Data

Sebagai user, saya ingin bisa menghapus data saya.

**Acceptance Criteria**

    Given user membuka privacy settings
    When user meminta delete account
    Then sistem meminta konfirmasi berlapis

    Given user konfirmasi
    Then data user diproses untuk penghapusan sesuai policy
    And audit log dibuat

# Summary Jumlah User Stories

    Sprint 1:
    24 user stories

    Sprint 2:
    14 user stories

    Sprint 3:
    15 user stories

    Sprint 4:
    17 user stories

    Total:
    70 user stories

# Prioritas Implementasi

    P0:
    Auth
    Onboarding
    Measurement checklist
    Photo/upload
    AI extraction timeout
    Manual override
    Submit D1
    Attachment R2
    Telegram after submit
    Rules engine
    Popup interpretation

    P1:
    Dashboard weekly/monthly
    AI recommendation
    Family/caregiver
    Emergency alert
    Medication tracker
    Doctor Ready PDF

    P2:
    Pattern detection
    Gamification
    Fasting timer
    PWA offline
    Accessibility senior mode
    Doctor share link
