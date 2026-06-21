# HL Health Companion — Design System

## 1. Purpose

Design system ini menjadi standar UI/UX untuk aplikasi **HL Health Companion**, yaitu aplikasi web kesehatan personal dengan input foto/upload, manual override, popup interpretasi rule-based, AI recommendation, family/caregiver, emergency alert, report dokter, dan PWA.

Design system ini dibuat untuk:

1. Mobile-first dan responsif.
2. Mudah digunakan oleh user umum dan lansia.
3. Aman untuk konteks kesehatan.
4. Cepat dan ringan untuk Cloudflare free tier.
5. Konsisten pada semua sprint dan semua fitur.

---

## 2. Design Principles

### 2.1 Clarity First

Semua layar harus langsung menjawab:

```text
Apa angka saya?
Artinya apa?
Apa yang harus saya lakukan?
Apakah ini perlu perhatian segera?
```

Tidak boleh membuat user menebak status kesehatan dari chart atau istilah teknis.

### 2.2 Manual Override Always Visible

Karena AI Vision bisa salah membaca angka, semua field hasil ekstraksi harus editable dan menampilkan status:

```text
AI terbaca
Diedit manual
Input manual
Belum terbaca
```

### 2.3 Rule-Based Status, AI-Assisted Narrative

UI harus membedakan:

```text
Status angka = rules engine
Narasi tambahan = AI assistant
Keputusan final = user verifikasi
```

### 2.4 Senior-Friendly by Default

Walaupun mode lansia adalah toggle khusus, semua UI dasar tetap harus:

```text
Font cukup besar
Button mudah ditekan
Kontras cukup tinggi
Tidak padat informasi
```

### 2.5 Emergency Must Be Unmissable

Status `emergency` tidak boleh ditampilkan hanya sebagai teks kecil. Harus muncul dalam modal khusus dengan tindakan yang jelas.

---

## 3. Supported Themes

Aplikasi memiliki 4 mode tema:

```text
light
warm
dark
highContrast
```

Field database:

```text
HL_userProfiles.theme
```

Allowed values:

```text
light
warm
dark
highContrast
```

---

## 4. Color Tokens

Gunakan CSS variables agar mudah dipakai di Tailwind, React, dan PWA.

### 4.1 Base Token Names

```css
:root {
  --colorBackground: #ffffff;
  --colorSurface: #f8fafc;
  --colorSurfaceElevated: #ffffff;
  --colorTextPrimary: #0f172a;
  --colorTextSecondary: #475569;
  --colorTextMuted: #64748b;
  --colorBorder: #e2e8f0;
  --colorPrimary: #2563eb;
  --colorPrimaryText: #ffffff;
  --colorFocus: #2563eb;

  --colorStatusNormal: #16a34a;
  --colorStatusInfo: #0284c7;
  --colorStatusWarning: #ca8a04;
  --colorStatusHigh: #ea580c;
  --colorStatusCritical: #dc2626;
  --colorStatusEmergency: #991b1b;

  --colorChartLine: #2563eb;
  --colorOverlay: rgba(15, 23, 42, 0.56);
}
```

### 4.2 Light Theme

```css
[data-theme="light"] {
  --colorBackground: #ffffff;
  --colorSurface: #f8fafc;
  --colorSurfaceElevated: #ffffff;
  --colorTextPrimary: #0f172a;
  --colorTextSecondary: #475569;
  --colorTextMuted: #64748b;
  --colorBorder: #e2e8f0;
  --colorPrimary: #2563eb;
  --colorPrimaryText: #ffffff;
}
```

### 4.3 Warm Theme

```css
[data-theme="warm"] {
  --colorBackground: #fffaf0;
  --colorSurface: #fff7ed;
  --colorSurfaceElevated: #ffffff;
  --colorTextPrimary: #1c1917;
  --colorTextSecondary: #57534e;
  --colorTextMuted: #78716c;
  --colorBorder: #fed7aa;
  --colorPrimary: #c2410c;
  --colorPrimaryText: #ffffff;
}
```

### 4.4 Dark Theme

```css
[data-theme="dark"] {
  --colorBackground: #020617;
  --colorSurface: #0f172a;
  --colorSurfaceElevated: #111827;
  --colorTextPrimary: #f8fafc;
  --colorTextSecondary: #cbd5e1;
  --colorTextMuted: #94a3b8;
  --colorBorder: #334155;
  --colorPrimary: #60a5fa;
  --colorPrimaryText: #020617;
}
```

### 4.5 High Contrast Theme

```css
[data-theme="highContrast"] {
  --colorBackground: #000000;
  --colorSurface: #000000;
  --colorSurfaceElevated: #111111;
  --colorTextPrimary: #ffffff;
  --colorTextSecondary: #ffffff;
  --colorTextMuted: #facc15;
  --colorBorder: #ffffff;
  --colorPrimary: #facc15;
  --colorPrimaryText: #000000;

  --colorStatusNormal: #00ff66;
  --colorStatusInfo: #00ccff;
  --colorStatusWarning: #ffff00;
  --colorStatusHigh: #ff9900;
  --colorStatusCritical: #ff3333;
  --colorStatusEmergency: #ff0000;
}
```

---

## 5. Status Severity System

Severity wajib mengikuti value dari database:

```text
normal
info
warning
high
critical
emergency
```

### 5.1 Visual Mapping

| Severity | Visual Style | UI Behavior |
|---|---|---|
| `normal` | Hijau, tenang | Card biasa |
| `info` | Biru, netral | Card biasa + info kecil |
| `warning` | Kuning | Card diberi alert ringan |
| `high` | Oranye | Card diberi warning jelas |
| `critical` | Merah | Modal perhatian |
| `emergency` | Merah gelap | Emergency modal wajib |

### 5.2 Status Badge

Komponen badge:

```tsx
<StatusBadge severity="normal">Normal</StatusBadge>
<StatusBadge severity="warning">Perlu Dipantau</StatusBadge>
<StatusBadge severity="emergency">Darurat</StatusBadge>
```

Rules:

```text
Badge harus punya text, bukan hanya warna.
Badge harus readable di dark mode dan high contrast.
Emergency badge harus pakai icon/text tambahan.
```

---

## 6. Typography

### 6.1 Font Family

Gunakan system font agar ringan:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Jika tidak memasang Inter, browser tetap memakai system font.

### 6.2 Font Scale Normal

```css
--fontSizeXs: 0.75rem;
--fontSizeSm: 0.875rem;
--fontSizeBase: 1rem;
--fontSizeLg: 1.125rem;
--fontSizeXl: 1.25rem;
--fontSize2xl: 1.5rem;
--fontSize3xl: 1.875rem;
```

### 6.3 Senior Mode Font Scale

Jika:

```text
HL_userProfiles.accessibilityMode = senior
```

maka gunakan:

```css
[data-accessibility="senior"] {
  --fontSizeBase: 1.25rem;
  --fontSizeLg: 1.5rem;
  --fontSizeXl: 1.75rem;
  --fontSize2xl: 2rem;
  --fontSize3xl: 2.5rem;
}
```

### 6.4 Text Rules

```text
Judul halaman: 24–32px
Metric value utama: 32–48px
Label form: minimal 16px
Input angka: minimal 20px
Senior mode input angka: minimal 28px
```

---

## 7. Spacing and Radius

### 7.1 Spacing Tokens

```css
--space1: 0.25rem;
--space2: 0.5rem;
--space3: 0.75rem;
--space4: 1rem;
--space5: 1.25rem;
--space6: 1.5rem;
--space8: 2rem;
--space10: 2.5rem;
--space12: 3rem;
```

### 7.2 Radius Tokens

```css
--radiusSm: 0.375rem;
--radiusMd: 0.75rem;
--radiusLg: 1rem;
--radiusXl: 1.25rem;
--radiusFull: 9999px;
```

### 7.3 Layout Spacing

```text
Mobile page padding: 16px
Desktop page padding: 24–32px
Card gap: 12–16px
Section gap: 24px
```

---

## 8. Layout System

### 8.1 Breakpoints

```text
xs: 360px
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

### 8.2 Main App Shell

Mobile:

```text
Top bar
Content
Bottom navigation
```

Desktop:

```text
Sidebar navigation
Top utility bar
Main content
Right insight panel optional
```

### 8.3 Page Width

```text
Measurement form: max-width 760px
Dashboard: max-width 1280px
Report preview: max-width 960px
Senior mode: max-width 720px and single-column only
```

---

## 9. Navigation

### 9.1 Primary Navigation

```text
Dashboard
Tambah Pengukuran
Riwayat
Report
AI Assistant
Medication
Fasting
Family
Settings
Knowledge Base
```

### 9.2 Senior Mode Navigation

Senior mode hanya menampilkan menu utama:

```text
Beranda
Tambah Data
Darurat
```

Menu lain masuk ke:

```text
Lainnya
```

---

## 10. Core Components

## 10.1 Button

### Variants

```text
primary
secondary
ghost
danger
emergency
success
```

### Sizes

```text
sm: height 36px
md: height 44px
lg: height 52px
senior: height 64px
```

### Rules

```text
Primary button hanya satu per section.
Emergency button harus jelas dan tidak berdampingan dengan aksi destruktif lain.
Button disabled harus tetap terbaca.
```

Example:

```tsx
<Button variant="primary" size="lg">Submit Pengukuran</Button>
<Button variant="secondary">Input Manual</Button>
<Button variant="emergency">Hubungi Kontak Darurat</Button>
```

---

## 10.2 Input Number

Digunakan untuk semua metric numeric.

Props:

```ts
type HealthNumberInputProps = {
  metricCode: string;
  label: string;
  value: number | null;
  unit: string;
  min?: number;
  max?: number;
  source: 'ai' | 'manual' | 'edited' | 'empty';
  onChange: (value: number | null) => void;
}
```

UI wajib menampilkan:

```text
Label metric
Input angka besar
Unit
Source indicator
Validation message
```

Source indicator:

```text
AI terbaca
Diedit manual
Input manual
Belum diisi
```

---

## 10.3 Measurement Card

Digunakan di halaman tambah pengukuran.

Struktur:

```text
Header: metric/device title
Attachment preview
Button Baca Otomatis
Input angka
Validation status
Interpretation preview
```

Sprint 1 dynamic cards are rendered by `DynamicMetricForm` from the selected
metric checklist rows. Hidden cards must unmount when the related checkbox is
unchecked, and calculated metrics render a disabled value field until BMI/other
calculated logic is implemented.

State:

```text
empty
imageSelected
aiReading
aiSuccess
aiTimeout
manualInput
validated
error
```

---

## 10.4 Attachment Uploader

Rules:

```text
Accept image only
Support capture="environment"
Preview wajib tampil
Client compress sebelum upload final
Original image tidak disimpan ke R2
Watermark dilakukan sebelum final upload
```

UI actions:

```text
Ambil Foto
Upload Gambar
Ganti Foto
Hapus Foto
```

Sprint 1 `AttachmentUploader` accepts only JPG/PNG/WebP, uses
`capture="environment"` for native camera support, shows a local preview, and
does not upload or persist original images.

---

## 10.5 AI Extraction State

State text:

| State | Text |
|---|---|
| idle | `Belum dibaca otomatis` |
| loading | `AI sedang membaca foto... maksimal 5 detik` |
| success | `Angka berhasil dibaca. Silakan cek ulang.` |
| timeout | `AI terlalu lama membaca foto. Silakan input manual.` |
| failed | `AI belum bisa membaca foto ini. Silakan input manual.` |

---

## 10.6 Health Status Card

Digunakan di dashboard dan popup.

Struktur:

```text
Metric name
Value + unit
Status badge
Short explanation
Last measured time
```

Example:

```text
SpO2
98 %
Normal
Saturasi oksigen berada dalam rentang umum normal.
Hari ini, 20:15
```

---

## 10.7 Interpretation Popup

Popup muncul setelah validasi angka dan sebelum submit.

Content:

```text
Title: Hasil Interpretasi
Metric sections
Status
Arti angka
Saran
Source label
Disclaimer
CTA Submit
CTA Edit Angka
```

Rules:

```text
Jika ada severity emergency, emergency section tampil paling atas.
User harus bisa kembali edit angka.
Submit hanya tersedia jika semua field valid.
```

---

## 10.8 Emergency Modal

Emergency modal wajib blocking.

Content:

```text
Judul: Peringatan Nilai Kritis
Metric dan angka
Arti umum
Anjuran cek ulang
Kapan cari bantuan medis
Checkbox konfirmasi
CTA: Saya Mengerti
CTA: Hubungi Kontak Darurat
CTA: Edit Angka
```

Rules:

```text
Tidak boleh hanya toast.
Tidak boleh auto-dismiss.
Tidak boleh dikirim ke emergency contact tanpa consent.
```

---

## 10.9 Dashboard Metric Card

Props:

```ts
type DashboardMetricCardProps = {
  metricCode: string;
  label: string;
  value: number | null;
  unit: string;
  status?: string;
  severity?: string;
  trend?: 'up' | 'down' | 'stable' | 'insufficient';
  measuredAt?: string;
}
```

Card harus menampilkan empty state jika belum ada data.

---

## 10.10 Chart

Gunakan chart ringan. Hindari chart terlalu kompleks.

Chart types:

```text
Line chart for metric trend
Bar chart for measurement adherence
Simple dot chart for daily values
```

Rules:

```text
Chart harus punya ringkasan teks.
Senior mode tidak boleh bergantung pada chart kecil.
Chart harus bisa dibaca di dark mode dan high contrast.
```

---

## 11. Page Templates

## 11.1 Login Page

Layout:

```text
Logo/app name
Email input
Password input
Login button
Register link
Privacy link
```

---

## 11.2 Onboarding Page

Step layout:

```text
Step 1: Display name
Step 2: Sex and birth date
Step 3: Height and timezone
Step 4: Theme and accessibility
```

Rules:

```text
Required fields harus jelas.
Tidak boleh lanjut jika heightCm invalid.
```

Sprint 1 implementation note:

```text
Until the shared wizard shell exists, onboarding may render the four logical
steps as one responsive form if required fields, inline validation, and large
tap targets are preserved.
```

## 11.2.1 Profile Settings Page

Profile settings can reuse the same form primitives as onboarding for Sprint 1.
It must allow editing:

```text
heightCm
timezone
theme
accessibilityMode
```

Saving theme and accessibility mode must refresh auth/profile state and apply
the current values to document attributes:

```text
data-theme
data-accessibility
```

---

## 11.3 New Measurement Page

Main flow:

```text
Checklist metric
Dynamic measurement cards
Validate button
Interpretation popup
Submit button
```

Checklist metric renders active device groups and metric rows from
`GET /api/metrics/catalog`. Each row shows unit/calculated state plus required
photo, fasting, sex-profile, and optional flags.

Mobile layout:

```text
One column
Sticky submit bar
Large input
```

Desktop layout:

```text
Main form left
Live summary right
```

---

## 11.4 Dashboard Today

Sections:

```text
Greeting summary
Critical alert if any
Today metric cards
AI recommendation
Quick actions
```

---

## 11.5 Weekly Dashboard

Sections:

```text
7-day summary
Trend cards
Charts
Alert summary
Medication adherence
```

---

## 11.6 Monthly Dashboard

Sections:

```text
30-day summary
Average/min/max/latest
Pattern insight preview
Report generation CTA
```

---

## 11.7 Doctor Ready PDF Preview

Layout:

```text
Profile summary
30-day summary
Charts
Alert log
Medication log
AI summary
Disclaimer
Generate PDF button
```

---

## 12. Health Copywriting Rules

### 12.1 Allowed Language

```text
berdasarkan data yang tercatat
cenderung
perlu dipantau
cek ulang
konsultasikan ke tenaga medis
bukan diagnosis
```

### 12.2 Forbidden Language

```text
Anda pasti terkena penyakit X
Anda harus minum obat X
Hentikan obat Anda
Ubah dosis obat
Aplikasi ini menggantikan dokter
```

### 12.3 Emergency Copy Template

```text
Nilai ini masuk kategori kritis. Segera cek ulang posisi alat dan ulangi pengukuran. Jika hasil tetap sama atau disertai gejala seperti sesak, nyeri dada, lemas berat, kebingungan, bibir kebiruan, pingsan, atau keluhan berat lain, segera cari bantuan medis.
```

---

## 13. Form Validation UX

### 13.1 Inline Validation

Setiap input harus punya pesan validasi langsung.

Example:

```text
SpO2 tidak boleh lebih dari 100%.
Sistolik harus lebih besar dari diastolik.
Suhu tubuh harus berada antara 30°C dan 45°C.
```

### 13.2 Submit Blocking

Submit diblokir jika:

```text
Metric yang dipilih belum memiliki finalValue
Attachment wajib belum tersedia
Physical range invalid
User belum mengkonfirmasi emergency modal
```

---

## 14. Accessibility

### 14.1 Minimum Requirements

```text
Keyboard navigable
Visible focus ring
ARIA label untuk icon-only button
Contrast minimal WCAG AA
Touch target minimal 44x44px
Senior mode touch target minimal 56x56px
```

### 14.2 Focus Ring

```css
:focus-visible {
  outline: 3px solid var(--colorFocus);
  outline-offset: 3px;
}
```

### 14.3 Screen Reader Labels

Example:

```tsx
<button aria-label="Ambil foto oximeter">Ambil Foto</button>
<input aria-label="Nilai SpO2 dalam persen" />
```

---

## 15. PWA Design Rules

### 15.1 Install Prompt

Tampilkan install prompt secara halus setelah user memakai aplikasi minimal satu sesi.

Text:

```text
Pasang aplikasi di HP agar lebih mudah mencatat pengukuran harian.
```

### 15.2 Offline Shell

Offline page harus menampilkan:

```text
Status offline
Draft lokal jika ada
Tombol coba sinkronkan
```

### 15.3 Draft Sync UI

State:

```text
Tersimpan lokal
Menunggu sinkron
Berhasil sinkron
Gagal sinkron
```

---

## 16. Icons

Gunakan icon outline ringan.

Suggested icon mapping:

| Feature | Icon |
|---|---|
| Dashboard | activity |
| Measurement | plusCircle |
| Oximeter | gauge |
| Blood pressure | heartPulse |
| Glucose | droplet |
| Medication | pill |
| Fasting | timer |
| Report | fileText |
| Family | users |
| Emergency | siren |
| Settings | settings |

---

## 17. Toast and Alerts

### 17.1 Toast Types

```text
success
info
warning
error
```

### 17.2 Toast Rules

```text
Toast tidak boleh dipakai untuk emergency.
Toast tidak boleh menutupi input angka.
Toast maksimal 5 detik kecuali error.
```

---

## 18. Empty States

### 18.1 Dashboard Empty

```text
Belum ada pengukuran hari ini.
Mulai catat data kesehatan Anda dari menu Tambah Pengukuran.
```

### 18.2 Report Empty

```text
Belum cukup data untuk membuat report periode ini.
Catat pengukuran beberapa hari lagi agar report lebih informatif.
```

### 18.3 AI Empty

```text
Belum ada rekomendasi AI. Rekomendasi akan muncul setelah Anda menyimpan pengukuran.
```

---

## 19. Loading States

### 19.1 AI Loading

```text
AI sedang membaca foto... maksimal 5 detik.
```

Progress indicator tidak boleh menjanjikan persentase palsu.

### 19.2 Submit Loading

```text
Menyimpan data pengukuran...
```

### 19.3 Report Loading

```text
Membuat report dokter 30 hari...
```

---

## 20. Error States

### 20.1 AI Timeout

```text
AI terlalu lama membaca foto. Silakan input manual agar proses tetap cepat.
```

### 20.2 Upload Failed

```text
Attachment gagal diupload. Coba ulangi atau gunakan foto yang lebih kecil.
```

### 20.3 Telegram Failed

```text
Data berhasil disimpan, tetapi Telegram gagal dikirim. Anda bisa cek pengaturan notifikasi.
```

---

## 21. Component Naming

Gunakan PascalCase untuk komponen React.

```text
AppShell
BottomNavigation
MeasurementChecklist
MeasurementCard
AttachmentUploader
HealthNumberInput
StatusBadge
InterpretationModal
EmergencyModal
DashboardMetricCard
TrendChart
AiRecommendationCard
ReportPreview
SeniorModeToggle
```

---

## 22. Tailwind Token Mapping

Contoh mapping di `tailwind.config.ts`:

```ts
export default {
  theme: {
    extend: {
      colors: {
        background: 'var(--colorBackground)',
        surface: 'var(--colorSurface)',
        elevated: 'var(--colorSurfaceElevated)',
        textPrimary: 'var(--colorTextPrimary)',
        textSecondary: 'var(--colorTextSecondary)',
        textMuted: 'var(--colorTextMuted)',
        border: 'var(--colorBorder)',
        primary: 'var(--colorPrimary)',
        primaryText: 'var(--colorPrimaryText)',
        normal: 'var(--colorStatusNormal)',
        info: 'var(--colorStatusInfo)',
        warning: 'var(--colorStatusWarning)',
        high: 'var(--colorStatusHigh)',
        critical: 'var(--colorStatusCritical)',
        emergency: 'var(--colorStatusEmergency)'
      },
      borderRadius: {
        md: 'var(--radiusMd)',
        lg: 'var(--radiusLg)',
        xl: 'var(--radiusXl)'
      }
    }
  }
}
```

---

## 23. QA Checklist

Sebelum merge UI, pastikan:

```text
Mobile 360px aman
Desktop 1280px aman
Dark mode aman
Warm mode aman
High contrast aman
Senior mode aman
Keyboard navigation aman
Attachment preview aman
AI timeout message jelas
Manual override terlihat
Emergency modal tidak bisa terlewat
Submit tidak menyimpan original image
```

---

## 24. Stitch Clinical Precision Alignment

Frontend Sprint 1-4 sekarang disejajarkan dengan Stitch project `HL Health Master Layout`
(`Clinical Precision`):

```text
Font: Inter
Canvas: #f7f9fb
Surface/card: #ffffff
Primary CTA: #0061ff
Primary strong: #004bca
Text primary: #191c1e
Text secondary: #424656
Outline: #c2c6d9
Sidebar width: 280px
Card radius: 8px
Modal radius: 12px
Status chip: pill only for semantic state
```

Implementation note:

```text
Routes/pages in web/src/pages keep existing React state, hooks, handlers, and API calls.
Stitch layout is applied through existing page JSX wrappers plus shared CSS tokens.
Desktop uses persistent sidebar shell; mobile uses bottom navigation.
```

---

## 25. Senior Mode Production Shell

When `accessibilityMode = senior`, the app switches to a simplified shell:

```text
Primary tabs only: Beranda, Tambah Data, Darurat
Desktop sidebar hidden
Mobile bottom nav hidden
Large tab buttons with high contrast state
Darurat tab renders pulsing TOMBOL SOS
SOS long-press state must be reachable by pointer/touch events
```

Production UAT on 2026-06-21 verified that the senior shell replaces the normal navigation and that the SOS long-press indicator renders after a sustained press.
