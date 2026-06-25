# Master Test Plan — HL Health Companion

Dokumen ini mendefinisikan strategi pengujian dan skenario uji utama untuk seluruh fitur dari Sprint 1 hingga Sprint 4, dengan fokus utama pada **keamanan data medis** dan **kestabilan sistem** sesuai batasan Cloudflare free tier.

---

## 1. Fokus Pengujian (Safety & Compliance)

Sebelum masuk ke fitur spesifik, setiap pengujian **wajib** memverifikasi batasan sistem berikut:
- **No Diagnosis Rule**: AI sama sekali tidak boleh memberikan resep atau diagnosis medis final.
- **Rule Engine Priority**: Status/severity harus selalu dihitung oleh `HL_metricRules`, bukan disimpulkan oleh AI.
- **Configurable AI Timeout**: Proses OCR oleh Worker AI tidak boleh memblokir UI lebih dari batas waktu yang dikonfigurasi (misal 5 detik).
- **Data Privacy**: Gambar *original* tidak boleh tersimpan di R2 (hanya versi *watermarked/compressed*).
- **Idempotency**: Retry pada pengiriman data (misal akibat koneksi PWA putus-nyambung) tidak boleh menduplikasi data di database.

---

## 2. Sprint 1 — Core Capture Full Feature

### 2.1 Auth & Profile
- **[TC-1.1] Register & Login**: Verifikasi duplikasi email ditolak, token sesi di-*hash* dengan benar.
- **[TC-1.2] Onboarding**: Verifikasi validasi tinggi badan (`heightCm`) dan penentuan zona waktu pengguna.

### 2.2 Measurement Input & Image Upload
- **[TC-1.3] Client Compression**: Pastikan ukuran gambar yang di-*upload* telah di-resize (max 1280px) dan kualitas diturunkan (50%).
- **[TC-1.4] Payload Limit**: Kirim file di atas batas maksimal (misal 2 MB) secara langsung ke API; pastikan Worker me-reject dengan *HTTP 413 Payload Too Large* sebelum memori terkuras.
- **[TC-1.5] Watermarking**: Pastikan gambar yang tiba di R2 memiliki *watermark* waktu dan ID pengguna.

### 2.3 AI Vision & Manual Override
- **[TC-1.6] Extraction Timeout**: Simulasikan latensi AI Vision > batas timeout; pastikan UI langsung menampilkan form input manual tanpa *crash*.
- **[TC-1.7] Manual Override Flag**: Ekstrak nilai `120` via AI, lalu ubah secara manual di UI menjadi `125`. Pastikan flag `manualOverride = 1` tersimpan di D1.
- **[TC-1.8] Physical Range Validation**: Input detak jantung 999 bpm; pastikan API menolak dengan error validasi *impossible physical range*.

---

## 3. Sprint 2 — Health Intelligence Full Feature

### 3.1 Metric Rules Engine
- **[TC-2.1] Threshold Boundary**: Evaluasi *blood pressure* persis di ambang batas rule (misal: 120 mmHg); pastikan masuk ke kategori *severity* yang tepat (Normal vs Warning).
- **[TC-2.2] Rule Fallback**: Hapus sementara rule untuk suatu metrik di D1; pastikan sistem tetap bisa memproses *submit* menggunakan status `unknown` dan *severity* `info`.

### 3.2 AI Recommendation & Safety Guardrails
- **[TC-2.3] Guardrail Test**: Masukkan data kesehatan ekstrem, minta AI Recommendation. Verifikasi respons AI hanya berisi saran umum (seperti "Konsultasikan ke dokter"), bukan saran medis klinis.
- **[TC-2.4] Recommendation Format**: Pastikan `generateRecommendation` hanya membaca ringkasan JSON (bukan riwayat *raw* database yang membebani memori).

### 3.3 Dashboard & Reports
- **[TC-2.5] 7-Day & 30-Day Aggregation**: Verifikasi angka rata-rata dan min/max mingguan cocok dengan rekapan tabel D1.
- **[TC-2.6] Trend Indicator**: Pastikan indikator "naik/turun/stabil" hanya muncul jika data harian memenuhi *minimum threshold* (tidak muncul jika data kurang).

---

## 4. Sprint 3 — Family & Alert System Full Feature

### 4.1 Telegram Integration
- **[TC-3.1] Connect & Test**: Verifikasi token verifikasi Telegram valid dan kadaluarsa setelah batas waktu tertentu.
- **[TC-3.2] Submit Summary**: Pastikan ringkasan pengukuran terkirim ke Telegram via Queue tanpa memblokir respons HTTP `POST /api/measurements/submit`.

### 4.2 Family & Caregiver (RBAC)
- **[TC-3.3] Role Restriction**: Uji coba akun *caregiver* mengakses metrik pasien tanpa izin `read`; pastikan API mengembalikan *HTTP 403 Forbidden*.
- **[TC-3.4] Invite Expiration**: Uji coba menerima *invite link* yang umurnya sudah melewati batas (kadaluarsa oleh *Daily Maintenance Cron*); pastikan ditolak.

### 4.3 Emergency Alerts
- **[TC-3.5] Alert Creation**: Submit data dengan severity `emergency`; pastikan modal *blocking* muncul di UI dan baris baru di tabel `HL_alerts` terbentuk.
- **[TC-3.6] Emergency Consent**: Pastikan pesan Telegram darurat ke kontak darurat HANYA terkirim jika opsi `emergencyConsent` = `true`.

### 4.4 Medication Tracker
- **[TC-3.7] Adherence Logic**: Tandai obat sebagai *skipped* dan pastikan kalkulasi kepatuhan harian (*adherence*) menyesuaikan secara akurat.

---

## 5. Sprint 4 — Advanced Health Companion Full Feature

### 5.1 Doctor Ready PDF
- **[TC-4.1] Generation Queue**: Pastikan eksekusi PDF menggunakan `pdfQueue` dan pengguna mendapatkan status "Generating..." hingga selesai.
- **[TC-4.2] Link Sharing**: Verifikasi link sharing akses dokumen PDF benar-benar kadaluarsa sesuai waktu yang ditentukan.

### 5.2 Gamification & Fasting
- **[TC-4.3] Streak Idempotency**: *Submit* dua pengukuran di hari yang sama; pastikan `currentCount` streak tidak bertambah dua kali.
- **[TC-4.4] Fasting Reminder**: Verifikasi notifikasi terpicu saat *targetHours* puasa tercapai melalui cron check.

### 5.3 Offline PWA & Draft Sync
- **[TC-4.5] Offline Save**: Putuskan koneksi internet di browser. Isi data pengukuran. Pastikan form menyimpannya ke IndexedDB (Status: Draft).
- **[TC-4.6] Online Sync**: Aktifkan kembali internet. Verifikasi UI menawarkan sinkronisasi.
- **[TC-4.7] Sync Idempotency**: Simulasikan jaringan tidak stabil dengan mengirim `draftId` yang sama berulang kali ke `POST /api/measurements/sync`. Pastikan D1 hanya mencatat 1 kali (*skippedDuplicates*).

### 5.4 Senior & High-Contrast Mode
- **[TC-4.8] Senior Mode UX**: Ubah *Accessibility Mode* ke `senior`. Pastikan *font size* membesar, menu menjadi *single-column*, dan elemen yang tidak esensial tersembunyi.
- **[TC-4.9] Data Delete**: Minta penghapusan data via `/api/privacy/deleteAccount`. Pastikan job masuk ke queue dan akun secara permanen dihapus dari D1.

---

## 6. Skenario Regression Testing Berkala

Setiap kali fitur baru di-*merge* ke branch utama, tes berikut wajib dijalankan ulang:
1. **End-to-End Measurement**: Mulai dari *upload* foto → AI Extract → Override Manual → Rule Evaluated → Submit Data.
2. **Offline to Online Sync**: Tambah data secara *offline* → Sinkronisasi *online*.
3. **Emergency Alert Flow**: Submit nilai kritis (seperti detak jantung 200 bpm) → Emergency modal tampil → Notifikasi Telegram terkirim.

---

## 7. Sprint 1 UI/UX Polish + AI Report (2026-06-23)

### 7.1 Measurement Page (`/measurements/new`)

- **[TC-5.1] Medical Term Icon**: Buka halaman measurement. Pilih alat. Pastikan setiap label (Sistolik, Diastolik, SpO2, dll.) memiliki icon `?` kecil di sebelah kanan. Hover icon → tooltip definisi medis muncul.
- **[TC-5.2] No Info-Chip Text**: Verifikasi tidak ada teks "Kenapa diukur?" di halaman (hanya icon `?`).
- **[TC-5.3] Tensimeter BP Layout**: Pilih Tensimeter. Masukkan sistolik 120 + diastolik 80 + pulse 72. Pastikan layout 2-kolom tidak terpotong, slash `/` tampil di tengah, dan field lain (Pulse Tensimeter, Tambah Ukur) tampil di bawah.
- **[TC-5.4] User-Info-Banner Inline**: Pastikan banner "Anda berusia xx Tahun xx Bulan xx Hari" tampil di sebelah kanan heading "Catat Hasil Pengukuran".
- **[TC-5.5] Form Error On Top**: Submit tanpa mengisi field wajib. Pastikan error muncul di ATAS form, bukan di bawah tombol submit.
- **[TC-5.6] Toast Popup**: Submit pengukuran valid. Pastikan toast muncul di tengah layar selama 5 detik dengan semua nilai yang di-submit, dan auto-dismiss.
- **[TC-5.7] Live Suggestion Preview**: Ketik sistolik "180" → warning "Krisis Hipertensi" muncul di bawah input. Hapus → preview hilang.
- **[TC-5.8] BMI Auto-Calculate**: Pilih Timbangan Badan. Masukkan berat 70 (tinggi 170cm dari profile). Pastikan BMI terisi otomatis = 24.2.
- **[TC-5.9] Telegram Push**: Submit pengukuran kritis (sistolik 185). Cek `GET /api/notifications` → status "sent" untuk emergency_alert. Verifikasi bot @morphez_bot mengirim pesan ke chat 8727919072.

### 7.2 History Page (`/measurements/history`)

- **[TC-5.10] Medical Term in Table**: Buka history. Pastikan setiap metric code (systolic, diastolic, dll.) di tabel memiliki icon `?` next to it.
- **[TC-5.11] Date & Time 2 Lines**: Pastikan kolom Date & Time menampilkan date di baris atas dan time di baris bawah (bukan satu baris).
- **[TC-5.12] Rekomendasi Column**: Pastikan ada kolom "Rekomendasi" dengan saran sesuai status.
- **[TC-5.13] Units Glossary**: Klik icon `?` di sebelah judul. Pastikan modal popup dengan tabel satuan (% bpm mmHg mg/dL kg cm °C index hour) muncul.
- **[TC-5.14] No Override Badge**: Pastikan tidak ada badge "Manual" di cell Result Value.
- **[TC-5.15] Compact Columns**: Verifikasi kolom Metric, Result Value, Status menggunakan lebar yang kompak (tidak terlalu lebar).

### 7.3 Dashboard

- **[TC-5.16] Medical Term in Vital Cards**: Buka dashboard (harus ada data). Pastikan setiap vital-card label memiliki icon `?`.
- **[TC-5.17] 7-Day Bar Chart**: Pastikan ada section "Tren 7 Hari Terakhir" dengan bar chart berwarna per metric.
- **[TC-5.18] Dashboard Not Empty**: Login user yang punya pengukuran hari ini. Pastikan `hasData: true` dan vital cards tampil (sebelumnya timezone bug).

### 7.4 Reports

- **[TC-5.19] Daily Report Has Data**: Buka `/reports/daily`. Pastikan data hari ini tampil (sebelumnya empty karena UTC vs Jakarta).
- **[TC-5.20] Medical Term in Reports**: Buka daily/weekly/monthly report. Pastikan setiap metric label memiliki icon `?`.
- **[TC-5.21] AI Analysis Button**: Klik "Analisa dengan AI" di salah satu report. Pastikan loading spinner muncul, lalu `.ai-summary` block dengan teks analisa AI tampil.
- **[TC-5.22] AI Fallback**: Tanpa API key (saat ini default), `usedFallback: true` dan analysis = "AI tidak tersedia saat ini...".

### 7.5 Alerts Page

- **[TC-5.23] Tabs Work**: Buka `/alerts`. Klik tab "Emergency Alerts" → tampil list alert. Klik tab "Telegram Log" → tampil list notifications.
- **[TC-5.24] Tab State**: State tab harus independent — loaders terpisah. Switching tab tidak boleh reset state.

### 7.6 Emergency Contacts

- **[TC-5.25] Phone Validation**: Coba input phone "abc123" → error "Nomor telepon tidak valid. Hanya angka, +, -, spasi, tanda kurung." Submit diblokir.
- **[TC-5.26] Telegram Validation**: Input "@ab" (username terlalu pendek) → error. Input "8727919072" (numeric ID valid) → ok.
- **[TC-5.27] Test Send Button**: Klik "Test Send" pada kontak → telegram test endpoint dipanggil, status banner muncul.

### 7.7 Settings

- **[TC-5.28] Export CSV**: Klik "Export Data" button. File CSV didownload dengan nama `measurement-YYYY-MM-DD.csv`. Ukuran file > 0 bytes.
- **[TC-5.29] Display Mode Toggle**: Klik tombol Normal/Senior/High Contrast di topbar. UI berubah (font size, contrast). Settings ter-update.
- **[TC-5.30] Reset Password**: Klik "Reset Password" di user dropdown. Alert "Link reset password sudah dikirim..." muncul.

### 7.8 Sidebar

- **[TC-5.31] Medication Visible**: Pastikan menu "Medication" terlihat di sidebar (tidak tersembunyi dalam group collapsed).
- **[TC-5.32] Sidebar Collapse**: Klik icon `keyboard_double_arrow_left` di sidebar. Sidebar collapse ke 64px. Klik lagi → expand. Style harus gradient, bukan plain.

### 7.9 Doctor Report Download

- **[TC-5.33] Date Format**: GET `/api/reports/1/download` (jika ada) — pastikan timestamps dalam HTML menggunakan format `23 Jun 2026 18:30` (bukan `2026-06-23T18:30:00.000Z`).

### 7.10 End-to-End Production UAT

```
[TC-5.34] /api/reports/daily       date: 2026-06-23, sessionCount: 3, values: 9 ✅
[TC-5.35] /api/dashboard/today     hasData: True, sessionCount: 3, values: 9 ✅
[TC-5.36] /api/measurements/today  date: 2026-06-23, sessions: 3 ✅
[TC-5.37] /api/measurements/history sessions: 3, total values: 9 ✅
[TC-5.38] /api/ai/report-analysis  endpoint live; 3-model fallback OK ✅
[TC-5.39] /api/notifications       "sent" | "Peringatan Darurat" emergency push ✅
[TC-5.40] All pages return HTTP 200 ✅
```

**Test Plan Updated**: 2026-06-23
