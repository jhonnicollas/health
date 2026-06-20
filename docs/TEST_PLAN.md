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
