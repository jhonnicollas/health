# HL Health Companion — Design System

```text
Document Type: Design System
Version: 2.1 FINAL REVISED — Sprint 5 Production UI + Sprint 6 AI Clinical Copilot Readiness
Scope: Sprint 1–4 production UI baseline + Sprint 5 Foundation/5A/5B/5C/5D/5E UI standards
Related Revised Documents:
- 01.PRD_SPRINT5_FULL_FINAL_REVISED_AI_SPRINT6_READY.md
- 02.PRD_USER_STORIES_SPRINT5_FULL_FINAL_REVISED_AI_SPRINT6_READY.md
- SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html
- SPRINT5_MOCKUP_TASKPLAN_ANCHOR_REGISTRY.md
Status: Ready for implementation and Task Plan linkage after AI Sprint 6 scope realignment
Important Boundary: Sprint 5C is AI Clinical Infrastructure & Vectorize Foundation. AI Doctor-like Clinical Copilot is Sprint 6 readiness/disabled state only, not an active Sprint 5 user-facing feature.
```


## 1. Purpose

Design system ini menjadi standar UI/UX untuk aplikasi **HL Health Companion**, yaitu aplikasi web kesehatan personal dengan input foto/upload, manual override, popup interpretasi rule-based, Daily Health Hub, symptom log, hydration tracker, cycle tracking, family/caregiver, emergency alert, report dokter, PWA, dan AI Clinical Infrastructure yang disiapkan untuk Sprint 6.

Design system ini dibuat untuk:

1. Mobile-first dan responsif.
2. Mudah digunakan oleh user umum dan lansia.
3. Aman untuk konteks kesehatan.
4. Cepat dan ringan untuk Cloudflare free tier.
5. Konsisten pada semua sprint dan semua fitur.
6. Menjaga batas UI bahwa Sprint 5 tidak menampilkan AI sebagai dokter, diagnosis final, emergency authority, prescription engine, atau medication dosage engine.
7. Menyediakan pola visual production-style untuk Sprint 5 sekaligus readiness/disabled state untuk Sprint 6 AI Doctor-like Clinical Copilot.

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


### 2.6 Sprint 5C Is Infrastructure, Not AI Doctor UI

UI Sprint 5C harus memakai bahasa **AI Clinical Infrastructure**, **AI Memory**, **Context Trace**, **Data Sufficiency**, **Fallback**, dan **Sprint 6 Readiness**.

UI Sprint 5C tidak boleh memakai label berikut sebagai fitur aktif:

```text
AI Dokter
AI Diagnosis
AI Emergency Detector Final
AI Medical Oracle
AI Prescription Engine
AI Medication Dosage Engine
```

Jika ada kebutuhan menampilkan fitur AI Doctor-like Clinical Copilot, state wajib berupa:

```text
Coming in Sprint 6
Disabled by default
Readiness only
Requires future clinical safety validation
```

### 2.7 Context Transparency Before AI Confidence

AI output yang memakai konteks kesehatan user wajib menampilkan:

```text
model/fallback state
context-used badge
safe context trace preview
dataSufficiencyScore atau context quality score
disclaimer
```

Dilarang menampilkan skor sebagai diagnosis probability, emergency probability, atau medication recommendation score.

---

## 3. Supported Themes

Aplikasi memiliki 3 mode tema via `data-theme`:

```text
light (default — all values in :root)
warm (html[data-theme="warm"])
dark (html[data-theme="dark"])
```

Dan 2 mode aksesibilitas via `data-accessibility`:

```text
senior (html[data-accessibility="senior"])
highContrast (html[data-accessibility="highContrast"] — also triggered by data-theme="highContrast")
```

Field database:

```text
HL_userProfiles.theme
HL_userProfiles.accessibilityMode
```

Theme values:

```text
light
warm
dark
```

Accessibility values:

```text
normal
senior
highContrast
```

---

## 4. Color Tokens

Source of truth: `web/src/index.css` — `:root` (shared), `html[data-theme]`, and `html[data-accessibility]`.

### 4.1 Base Token Names (`:root`)

Shared tokens across all themes. Most color/surface/primary values are defined here as defaults:

```css
:root {
  /* Surface / Background */
  --colorBackground: #f7f9fb;
  --colorSurface: #f2f4f6;
  --colorSurfaceElevated: #ffffff;
  --colorSurfaceContainer: #eceef0;
  --colorSurfaceHigh: #e6e8ea;
  --colorSurfaceDim: #d8dadc;
  --colorSurfaceHighest: #e0e3e5;
  --colorTextPrimary: #191c1e;
  --colorTextSecondary: #424656;
  --colorTextMuted: #737687;
  --colorBorder: #c2c6d9;
  --colorBorderSoft: #e0e3e5;
  --colorPrimary: #0061ff;
  --colorPrimaryStrong: #004bca;
  --colorPrimaryContainer: #0061ff;
  --colorOnPrimaryContainer: #f1f2ff;
  --colorPrimaryText: #ffffff;
  --colorFocus: #0061ff;
  --colorSecondaryContainer: #d0e1fb;
  --colorOnSecondaryContainer: #54647a;
  --colorTertiary: #005c85;
  --colorTertiaryContainer: #0076a9;
  --colorOnTertiaryContainer: #eaf4ff;
  --colorErrorContainer: #ffdad6;
  --colorOnErrorContainer: #93000a;
  --colorInverseSurface: #2d3133;
  --colorInverseOnSurface: #eff1f3;

  /* Status (semantic) */
  --colorStatusNormal: #168244;
  --colorStatusInfo: #005c85;
  --colorStatusWarning: #9a6700;
  --colorStatusHigh: #b45309;
  --colorStatusCritical: #ba1a1a;
  --colorStatusEmergency: #7f1d1d;

  /* Overlay */
  --colorOverlay: rgba(15, 23, 42, 0.56);

  /* Shadows */
  --shadowCard: 0px 4px 6px -1px rgba(0, 0, 0, 0.05);
  --shadowSoft: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
  --shadowModal: 0px 10px 15px -3px rgba(0, 0, 0, 0.1);

  /* Spacing */
  --space1: 0.25rem;
  --space2: 0.5rem;
  --space3: 0.75rem;
  --space4: 1rem;
  --space5: 1.25rem;
  --space6: 1.5rem;
  --space8: 2rem;
  --space10: 2.5rem;

  /* Radius */
  --radiusSm: 2px;
  --radiusMd: 4px;
  --radiusLg: 8px;
  --radiusXl: 12px;
  --radiusFull: 999px;

  /* Layout */
  --sidebarWidth: 280px;
  --containerMaxWidth: 1440px;
  --marginDesktop: 32px;
  --marginTablet: 24px;
  --marginMobile: 16px;
  --gutter: 24px;

  /* Typography — shorthand: font-weight font-size/line-height font-family */
  --typHeadlineXl: 700 36px/44px Inter, sans-serif;
  --typHeadlineLg: 600 28px/36px Inter, sans-serif;
  --typHeadlineLgMobile: 600 24px/32px Inter, sans-serif;
  --typHeadlineMd: 600 20px/28px Inter, sans-serif;
  --typBodyLg: 400 18px/28px Inter, sans-serif;
  --typBodyMd: 400 16px/24px Inter, sans-serif;
  --typBodySm: 400 14px/20px Inter, sans-serif;
  --typLabelMd: 600 14px/20px Inter, sans-serif;
  --typLabelSm: 500 12px/16px Inter, sans-serif;

  /* Font stacks */
  --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --heading: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
```

### 4.2 Warm Theme

```css
html[data-theme="warm"] {
  --colorBackground: #f9faf7;
  --colorSurface: #f1f4ed;
  --colorSurfaceElevated: #ffffff;
  --colorSurfaceContainer: #e9eee2;
  --colorSurfaceHigh: #e3e8d9;
  --colorSurfaceDim: #d5d9cc;
  --colorSurfaceHighest: #dce0d2;
  --colorTextPrimary: #1b1d17;
  --colorTextSecondary: #42483c;
  --colorTextMuted: #707767;
  --colorBorder: #c8cebf;
  --colorBorderSoft: #ddd9cc;
  --colorPrimary: #2d6a4f;
  --colorPrimaryStrong: #1b4332;
  --colorPrimaryContainer: #2d6a4f;
  --colorOnPrimaryContainer: #d8e8d0;
  --colorSecondaryContainer: #d4e0c8;
  --colorOnSecondaryContainer: #3d4a30;
  --colorTertiary: #4a6741;
  --colorTertiaryContainer: #6e8b60;
  --colorOnTertiaryContainer: #e2eed8;
  --colorErrorContainer: #ffdad6;
  --colorOnErrorContainer: #93000a;
  --colorInverseSurface: #2a2c22;
  --colorInverseOnSurface: #eff1e6;
}
```

### 4.3 Dark Theme

```css
html[data-theme="dark"] {
  --colorBackground: #101418;
  --colorSurface: #171c22;
  --colorSurfaceElevated: #1d232b;
  --colorSurfaceContainer: #252c35;
  --colorSurfaceHigh: #2c343f;
  --colorSurfaceDim: #12161c;
  --colorSurfaceHighest: #303a45;
  --colorTextPrimary: #f4f7fa;
  --colorTextSecondary: #c8d0dc;
  --colorTextMuted: #9aa7b8;
  --colorBorder: #3d4654;
  --colorBorderSoft: #2f3743;
  --colorPrimary: #7fb1ff;
  --colorPrimaryStrong: #a8c8ff;
  --colorPrimaryText: #07111f;
  --colorPrimaryContainer: #7fb1ff;
  --colorOnPrimaryContainer: #00174b;
  --colorSecondaryContainer: #3d4654;
  --colorOnSecondaryContainer: #c8d0dc;
  --colorTertiary: #89ceff;
  --colorTertiaryContainer: #005c85;
  --colorOnTertiaryContainer: #eaf4ff;
  --colorErrorContainer: #93000a;
  --colorOnErrorContainer: #ffdad6;
  --colorInverseSurface: #e6e8ea;
  --colorInverseOnSurface: #191c1e;
  --shadowCard: 0 18px 36px rgba(0, 0, 0, 0.3);
}
```

### 4.4 High Contrast (data-theme OR data-accessibility)

Applied via both `html[data-theme="highContrast"]` and `html[data-accessibility="highContrast"]`:

```css
html[data-theme="highContrast"],
html[data-accessibility="highContrast"] {
  --colorBackground: #000000;
  --colorSurface: #000000;
  --colorSurfaceElevated: #111111;
  --colorSurfaceContainer: #1a1a1a;
  --colorSurfaceHigh: #222222;
  --colorSurfaceDim: #000000;
  --colorSurfaceHighest: #2a2a2a;
  --colorTextPrimary: #ffffff;
  --colorTextSecondary: #ffffff;
  --colorTextMuted: #facc15;
  --colorBorder: #ffffff;
  --colorBorderSoft: #ffffff;
  --colorPrimary: #facc15;
  --colorPrimaryStrong: #facc15;
  --colorPrimaryText: #000000;
  --colorPrimaryContainer: #facc15;
  --colorOnPrimaryContainer: #000000;
  --colorSecondaryContainer: #333333;
  --colorOnSecondaryContainer: #ffffff;
  --colorTertiary: #00ccff;
  --colorTertiaryContainer: #006688;
  --colorOnTertiaryContainer: #ccffff;
  --colorErrorContainer: #333333;
  --colorOnErrorContainer: #ff3333;
  --colorInverseSurface: #f0f0f0;
  --colorInverseOnSurface: #000000;
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

### 6.2 Font Tokens

Actual implementation uses `--typ*` shorthand tokens (font-weight font-size/line-height font-family):

```css
--typHeadlineXl: 700 36px/44px Inter, sans-serif;
--typHeadlineLg: 600 28px/36px Inter, sans-serif;
--typHeadlineLgMobile: 600 24px/32px Inter, sans-serif;
--typHeadlineMd: 600 20px/28px Inter, sans-serif;
--typBodyLg: 400 18px/28px Inter, sans-serif;
--typBodyMd: 400 16px/24px Inter, sans-serif;
--typBodySm: 400 14px/20px Inter, sans-serif;
--typLabelMd: 600 14px/20px Inter, sans-serif;
--typLabelSm: 500 12px/16px Inter, sans-serif;
```

Usage:

```css
font: var(--typBodyMd);
font: var(--typHeadlineLg);
```

### 6.3 Senior Mode Font Scale

Jika:

```text
HL_userProfiles.accessibilityMode = senior
```

maka `senior-mode.css` mengatur:

```css
html[data-accessibility="senior"] {
  font-size: 19px;
}
```

Semua nilai `rem` otomatis lebih besar karena root font-size berubah.

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
```

### 7.2 Radius Tokens

```css
--radiusSm: 2px;
--radiusMd: 4px;
--radiusLg: 8px;
--radiusXl: 12px;
--radiusFull: 999px;
```

### 7.3 Layout Spacing

```css
--marginMobile: 16px;
--marginTablet: 24px;
--marginDesktop: 32px;
--gutter: 24px;
--sidebarWidth: 280px;
--containerMaxWidth: 1440px;
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
Dashboard / Daily Health Hub
Tambah Pengukuran
Catat Keluhan
Hidrasi
Riwayat
Report
AI Assistant Safe Mode
AI Clinical Infrastructure / AI Memory Settings
Cycle Tracking jika eligible
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
Belum ada insight AI aman. Insight akan muncul setelah Anda menyimpan data dan jika entitlement tersedia. Fitur AI Clinical Copilot akan hadir di Sprint 6.
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

Actual components in `web/src/`:

```text
AppShell
SeniorAppShell
BottomNavigation
AdminShell
AdminDashboardCard
RolePermissionTable
PlanFeatureMatrix
ConfigSecretField
AuditLogTable
MeasurementChecklist
DynamicMetricForm
AttachmentUploader
ManualOverrideInput
TrendBadge
InterpretationPopup
EmergencyModal
DailyHealthHub
EducationBottomSheet
SymptomPromptModal
SymptomLoggerForm
VasPainScale
RedFlagBlockingModal
HydrationProgressRing
HydrationQuickAdd
HydrationWarningCard
AiRecommendationCard
AiClinicalInfrastructureCard
AiMemoryStatusCard
AiContextTraceDrawer
DataSufficiencyBadge
Sprint6ReadinessCard
CycleCalendar
CycleGuardrailModal
TelegramHydrationSettings
TelegramInlinePreview
UpgradePromptCard
ReportPreview
SeniorModeToggle
KnowledgeBaseLayout
MedicationFastingTracker
SettingsProfileForm
NotificationList
FamilyMemberCard
```

Icon system: Google Material Symbols Outlined, imported via CSS `@import` in index.css. Not outline SVGs.

---

## 22. Styling Approach

This project does **not** use Tailwind CSS. All styling is done with:

- CSS custom properties defined in `web/src/index.css`
- Component-specific CSS files (e.g., `ManualOverrideInput.css`, `InterpretationPopup.css`)
- Layout styles in `web/src/App.css`
- Accessibility overrides in `web/src/styles/senior-mode.css` and `web/src/styles/high-contrast.css`

To use a design token in CSS:

```css
.my-component {
  color: var(--colorTextPrimary);
  background: var(--colorSurface);
  border: 1px solid var(--colorBorder);
  border-radius: var(--radiusMd);
  padding: var(--space16);
  font: var(--typBodyMd);
}
```

To use a design token in React inline styles:

```tsx
<div style={{ color: 'var(--colorTextPrimary)', font: 'var(--typBodyMd)' }}>
  Content
</div>
```

---

## 23. QA Checklist

Sebelum merge UI, pastikan:

```text
Mobile 360px aman
Desktop 1280px aman
Light theme aman (only theme implemented via data-theme)
Warm theme aman (data-theme="warm")
Dark theme aman (data-theme="dark")
High contrast aman (data-accessibility="highContrast")
Senior mode aman (data-accessibility="senior")
Keyboard navigation aman
Attachment preview aman
AI timeout message jelas
Manual override terlihat
Emergency modal tidak bisa terlewat
Submit tidak menyimpan original image
Daily Health Hub sesuai mockup anchor
Symptom logger dan Red Flag Blocking UI sesuai mockup anchor
Hydration tracker dan overhydration warning sesuai mockup anchor
AI Clinical Infrastructure UI tidak menyebut AI dokter sebagai fitur Sprint 5
Sprint 6 readiness card disabled/default off
Cycle guardrail blocking dan tidak auto-dismiss
Telegram inline hydration preview tidak mengekspos secret/token
TypeScript: cd web && npx tsc -b
Lint: cd web && npm run lint
Build: cd web && npm run build
```

---

## 24. Stitch Clinical Precision Alignment

### 24.1 Design Tokens Source of Truth

The Stitch design tokens are defined in `web/frontend_stitch/DESIGN.md` and applied via `web/src/index.css`.

Production token values:

```text
Font: Inter (Google Fonts, loaded in index.html)
Canvas: #f7f9fb
Surface: #f2f4f6
Surface/container: #eceef0
Surface/container-high: #e6e8ea
Surface/dim: #d8dadc
Surface/elevated: #ffffff
Primary: #0061ff
Primary strong: #004bca
On-primary-container: #f1f2ff
Text primary: #191c1e
Text secondary: #424656
Text muted: #737687
Outline: #c2c6d9
Outline variant: #e0e3e5
Border soft: #e0e3e5
Status emergency: #7f1d1d
Status critical: #ba1a1a
Status high: #b45309
Status warning: #9a6700
Status info: #005c85
Status normal: #168244
Sidebar width: 280px
Card shadow: 0px 4px 6px -1px rgba(0,0,0,0.05)
Card radius: 4px (--radiusMd)
Modal radius: 8px (--radiusLg)
Status chip: pill only for semantic state (--radiusFull = 999px)
```

---

## 25. Senior Mode Production Shell

When `data-accessibility="senior"`, the app uses `SeniorAppShell` component:

Source: `web/src/components/SeniorAppShell.tsx` and `web/src/styles/senior-mode.css`.

```text
Primary tabs only: Home, Add Data, Emergency
Desktop sidebar hidden
Mobile bottom nav hidden
Large tab buttons with high contrast state
Emergency tab renders SOS long-press button
Font size: 19px base (not rem)
Card padding: 20px
Input min-height: 56px
Button min-height: 56px
SOS long-press threshold: 900ms
```

Senior mode applies `data-accessibility="senior"` to `<html>`, which activates `senior-mode.css`:
- Increases base font size to 19px
- Increases card padding to 20px
- Increases input/button min-height to 56px
- Adds `.senior-shell`, `.senior-tabs`, `.senior-content` layout classes

---

## 26. Sprint 5 Production Layout Alignment

Sprint 5 UI harus mengikuti pola production layout yang sudah ada dan mockup production-layout Sprint 5.

File mockup utama untuk acuan visual dan Task Plan linkage:

```text
SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html
```

Pattern anchor:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#<anchor>
```

Important implementation note:

```text
Mockup HTML boleh memakai Tailwind/CDN untuk demonstrasi statis.
Implementasi production React tetap mengikuti design-system source of truth:
- CSS custom properties di web/src/index.css
- component-specific CSS files
- App.css layout rules
- senior-mode.css
- high-contrast.css
```

Jangan copy Tailwind CDN dari mockup ke production app jika project production tidak menggunakan Tailwind. Terjemahkan visual mockup ke token dan komponen production.

### 26.1 Production Shell Pattern

Desktop:

```text
fixed sidebar 280px
top utility bar sticky
main content area with max width and responsive grid
admin area separated from user shell
card/bento layout for overview metrics
right insight panel optional
```

Mobile:

```text
top bar
content first
bottom navigation
large tap target
one-column cards
sticky primary action only when needed
```

### 26.2 Anchor Mapping for Design QA

| Area | Required Mockup Anchor |
|---|---|
| Overview | `#s5-overview` |
| Coverage Matrix | `#coverage-matrix` |
| Foundation/Admin Core | `#foundation-admin` |
| Admin Dashboard | `#admin-dashboard` |
| Users/Roles/Permissions | `#admin-users-roles` |
| Plans/Entitlement/Quota | `#admin-plans` |
| AI Config Admin | `#admin-ai-config` |
| System Config | `#admin-system-config` |
| Audit Logs | `#admin-audit` |
| Google OAuth | `#google-oauth` |
| Daily Health Hub | `#daily-health-hub` |
| Education Layer | `#education-layer` |
| Symptom Logger | `#symptom-logger` |
| Red Flag Flow | `#red-flag-flow` |
| History Integration | `#history-integration` |
| Hydration Tracker | `#hydration-tracker` |
| AI Clinical Infrastructure | `#ai-clinical-infra` |
| AI Memory | `#ai-memory` |
| Context Package | `#context-package` |
| Sprint 6 Readiness | `#sprint6-ready` |
| Cycle Tracking | `#cycle-tracking` |
| Cycle Guardrail | `#cycle-guardrail` |
| Telegram Hydration | `#telegram-hydration` |
| Premium Upgrade | `#premium-upgrade` |

---

## 27. Sprint 5 Foundation UI Standards

Foundation UI covers commercial/admin core.

### 27.1 Admin Shell

Required areas:

```text
Admin Dashboard
Users
Roles & Permissions
Plans & Features
Subscriptions
Master Metrics
Metric Rules
Education Cards
Knowledge Base
AI Configuration
System Configuration
Feature Flags
Vectorize / AI Clinical Infrastructure
Telegram Configuration
Audit Logs
Security Logs
Rate Limits
```

Design rules:

```text
1. Admin shell must be visually separate from user app shell.
2. Admin link must not appear for normal users.
3. Permission-gated menu must hide unavailable pages but backend remains authority.
4. Sensitive admin views show summary by default.
5. Mutations need confirmation and clear success/error state.
6. Secret fields show configured/masked/envVarName only.
```

Mockup references:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#foundation-admin
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#admin-dashboard
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#admin-users-roles
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#admin-plans
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#admin-ai-config
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#admin-audit
```

### 27.2 Plan / Feature / Quota Matrix

Plan table must support:

```text
feature name
plan columns
quota display
reset window
enabled/disabled status
upgrade behavior
admin edit state
```

Do not use color only. Show `Enabled`, `Disabled`, `Quota exceeded`, or `Upgrade required` as text.

### 27.3 Secret-Safe Config Field

Component behavior:

```text
value hidden
configured badge
write-only update field
show envVarName/reference if allowed
never show actual token/key/secret
```

---

## 28. Sprint 5A UI Standards — Daily Health & Education

### 28.1 Google OAuth Button

Google OAuth button must be available without removing email/password login.

Rules:

```text
1. Existing login remains visible.
2. OAuth error state is clear.
3. No secret or provider token appears in UI.
4. Account conflict copy tells user to login with original method and link Google from settings.
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#google-oauth
```

### 28.2 Daily Health Hub

Dashboard Today becomes Daily Health Hub.

Required cards:

```text
today status
latest measurement
active symptoms
quick action catat keluhan
hydration widget placeholder or real widget
education card hari ini
safe AI insight if entitlement available
safety warning if any
```

Design rules:

```text
1. Do not overload with raw tables.
2. Show concise summary first, details later.
3. Safety warning has visual and text prominence.
4. Empty state is educational and has CTA.
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#daily-health-hub
```

### 28.3 Education Bottom Sheet

Education content must answer:

```text
Apa artinya?
Kenapa diukur?
Manfaat mencatat?
Cara ukur yang benar?
Angka normal/warning/bahaya secara umum
Kapan perlu cek ulang?
Kapan perlu cari bantuan medis?
```

UI rules:

```text
first-time guidance appears once per topic
manual reopen is always available
bottom sheet/modal is not noisy
medical copy avoids hard diagnosis
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#education-layer
```

### 28.4 Symptom Logger

Symptom form must include:

```text
quick symptom chips
body area optional
VAS pain scale 1–10
mood
startedAt
duration
free text description
linked measurement optional
```

VAS labels:

```text
1–3 Ringan
4–6 Sedang
7–10 Berat
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#symptom-logger
```

### 28.5 Red Flag Blocking UI

Red flag UI must be blocking, serious, and never auto-dismiss.

Design rules:

```text
1. Show red flag detected message.
2. Explain this is deterministic safety detection, not AI judgment.
3. Offer emergency contact CTA when consent exists.
4. Do not redirect to dashboard automatically.
5. Keep symptom saved but clearly mark safety event.
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#red-flag-flow
```

---

## 29. Sprint 5B UI Standards — Hydration Tracker

Hydration tracker must be quick, visual, and not medical-overclaiming.

Required elements:

```text
progress ring
total ml / target ml
percentage
reason text
+200ml
+600ml
custom input
large input confirmation
warning badge/card if total >5000ml
history summary
```

Rules:

```text
1. Target is an estimate, not absolute medical advice.
2. Overhydration is a warning, not diagnosis.
3. Warning must have text, not only color.
4. Quick add is one tap.
5. Custom input uses numeric keypad.
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#hydration-tracker
```

---

## 30. Sprint 5C UI Standards — AI Clinical Infrastructure

Sprint 5C UI must make the boundary obvious:

```text
This is AI infrastructure/readiness.
This is not AI doctor.
Sprint 6 will handle AI Doctor-like Clinical Copilot.
```

### 30.1 AI Clinical Infrastructure Card

Card content:

```text
AI Memory status
Vectorize status
last indexed time
document counts
failed/pending counts
rebuild action
delete memory action
fallback status
Sprint 6 readiness status
```

Allowed labels:

```text
AI Clinical Infrastructure
AI Memory
Context Retrieval
Context Trace
Data Sufficiency
Sprint 6 Readiness
Safe AI Assistant
```

Forbidden active feature labels in Sprint 5:

```text
AI Dokter
Diagnosis AI
Emergency AI
AI Medical Oracle
AI Prescribes Medication
AI Recommends Dosage
```

Mockup references:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#ai-clinical-infra
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#ai-memory
```

### 30.2 Context Trace Drawer

Context trace is collapsed by default.

Trace row fields:

```text
source type
source date
safe preview
relevance score
privacy flag
source link if allowed
```

Sensitive source rules:

```text
symptom preview must be short and safe
cycle preview hidden unless owner or explicit permission
report preview summary only
admin sees counts unless sensitive permission exists
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#context-package
```

### 30.3 Data Sufficiency Badge

Use `dataSufficiencyScore`, not `clinicalConfidenceScore` or diagnosis probability.

Allowed copy:

```text
Data cukup untuk ringkasan terbatas.
Data belum cukup untuk melihat pola yang kuat.
Beberapa data penting belum tercatat.
```

Forbidden copy:

```text
Kemungkinan diagnosis 80%.
Risiko emergency 90% menurut AI.
Obat X paling cocok.
Dosis perlu dinaikkan.
```

### 30.4 Sprint 6 Readiness Card

Sprint 6 AI Clinical Copilot must be shown as disabled/readiness state only.

Required visual state:

```text
Disabled
Coming in Sprint 6
Requires safety validation
Feature flag off
No user-facing AI doctor in Sprint 5
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#sprint6-ready
```

---

## 31. Sprint 5D UI Standards — Cycle Tracking

Cycle tracking is private, eligibility-gated, and not a contraception tool.

Required UI:

```text
eligibility hidden state
cycle settings
calendar phase legend
daily cycle log bottom sheet
pregnancy/menopause prediction paused state
contraception guardrail blocking modal
family sensitive permission controls
```

Rules:

```text
1. Do not use “Masa Aman” as a primary claim.
2. Use “Di luar prediksi masa subur” or “Risiko lebih rendah menurut kalender”.
3. Calendar must use labels/icons, not only color.
4. Guardrail modal must be blocking, not toast.
5. Cycle data private by default.
```

Mockup references:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#cycle-tracking
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#cycle-guardrail
```

---

## 32. Sprint 5E UI Standards — Telegram Inline Hydration

Telegram UI is not full Telegram app replacement. It supports hydration quick add only.

Telegram message layout:

```text
Total minum hari ini
Target hari ini
+200ml button
+600ml button
Buka Aplikasi button
```

Security UI rules:

```text
1. Do not expose bot token, webhook secret, or callback secret.
2. Settings shows Telegram linked/not linked status.
3. Duplicate callback should show safe non-duplicating result.
4. Invalid callback creates no user-facing health log.
5. Telegram failure should not imply data loss if water log was saved.
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#telegram-hydration
```

---

## 33. Premium, Entitlement, and Quota UX

Premium gating must be clear and non-breaking.

States:

```text
feature available
feature unavailable on current plan
quota remaining
quota exhausted
upgrade required
coming in Sprint 6
```

Rules:

```text
1. Frontend may hide gated features, but server remains authority.
2. Upgrade prompt must explain what is unlocked.
3. Quota exhausted must show reset timing if available.
4. Disabled Sprint 6 AI Copilot must not look purchasable in Sprint 5.
```

Mockup reference:

```text
Mockup: SPRINT5_FULL_MOCKUP_PRODUCTION_LAYOUT_AI_SPRINT6_READY.html#premium-upgrade
```

---

## 34. Sprint 5 AI Copywriting Rules

### 34.1 Allowed Sprint 5 AI Copy

```text
AI membantu merangkum data yang Anda catat.
AI menggunakan konteks yang tersedia jika diizinkan.
Data sufficiency menunjukkan kelengkapan data, bukan diagnosis.
Context trace menampilkan sumber data yang dipakai secara aman.
Fitur AI Clinical Copilot direncanakan untuk Sprint 6.
```

### 34.2 Forbidden Sprint 5 AI Copy

```text
AI dokter pribadi Anda sudah aktif.
AI mendiagnosis kondisi Anda.
AI menentukan keadaan darurat.
AI menyarankan obat atau dosis.
AI menggantikan dokter.
AI medical oracle.
```

### 34.3 Sprint 6 Placeholder Copy

Use this copy for disabled/readiness state:

```text
AI Clinical Copilot sedang disiapkan untuk Sprint 6. Sprint 5 hanya menyiapkan infrastruktur, memory, context trace, safety runtime, dan feature flag. Fitur ini belum aktif dan belum digunakan untuk diagnosis, emergency decision, resep, atau instruksi dosis obat.
```

---

## 35. Final Design QA Gate for Sprint 5

Sprint 5 UI cannot pass design QA unless:

```text
[ ] Mobile 360px usable for all Sprint 5 features.
[ ] Desktop admin shell follows separated admin layout.
[ ] Production token system is used, not hardcoded random colors.
[ ] Mockup anchors are referenced in task/test plans.
[ ] Daily Health Hub matches production-style card hierarchy.
[ ] Symptom logger shows VAS text labels.
[ ] Red Flag Blocking UI is blocking and not toast.
[ ] Hydration tracker shows target reason and warning text.
[ ] AI Clinical Infrastructure UI does not say AI doctor is active.
[ ] Sprint 6 readiness card is disabled/default off.
[ ] Context trace is collapsed and privacy-safe.
[ ] Cycle calendar uses labels/icons and no “Masa Aman” primary claim.
[ ] Cycle guardrail is blocking and not auto-dismiss.
[ ] Telegram hydration preview does not expose secrets.
[ ] Premium prompts do not imply disabled Sprint 6 AI is already purchasable.
[ ] Senior mode still meets 56px touch target minimum.
[ ] High contrast mode remains readable.
[ ] No secret/token/API key appears in UI, source, snapshot, console, or fixture.
```

