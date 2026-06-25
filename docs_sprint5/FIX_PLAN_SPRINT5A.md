# Sprint 5A + 5B — Fix Plan

Berdasarkan audit gap S5A-001 sampai S5A-015 dan S5B-001 sampai S5B-008.

---

## 🔴 CRITICAL — S5A-002: Google OAuth Callback Fabrication

**Lokasi:** `worker/src/routes-auth.ts`

### Masalah

Callback GET `/api/auth/google/callback` tidak pernah memanggil Google token API. `sub` dan `email` difabrikasi dari `code.slice(0,8)`.

### Fix

1. **Ganti callback dengan real token exchange:**

```typescript
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: `${origin}/api/auth/google/callback`,
    grant_type: 'authorization_code'
  })
})
const tokenData = await tokenRes.json()
if (!tokenData.id_token) throw Error('Token exchange failed')

const payload = JSON.parse(atob(tokenData.id_token.split('.')[1]))
if (!payload.email_verified) throw Error('Email not verified')
// Gunakan payload.sub, payload.email
```

2. **Hapus baris:** `const sub = google_${code.slice(0, 8)}; const email = ${sub}@gmail.com`

3. **Pastikan GOOGLE_CLIENT_SECRET** di Worker env/binding.

### Acceptance

- [ ] Callback HTTP POST ke Google token endpoint
- [ ] `email_verified` required dari JWT
- [ ] `sub` dari JWT, bukan fabricasi
- [ ] Email conflict → return error `EMAIL_CONFLICT`, jangan auto-merge
- [ ] Test: state mismatch, unverified email, email conflict, link/unlink

---

## 🔴 P0 — S5A-002: Unlink Logic Error

**Lokasi:** `worker/src/routes-auth.ts`

### Masalah

```typescript
// SALAH — reject kalau no password ATAU hanya 1 account
if (!pwUser?.passwordHash || (accounts?.cnt || 0) <= 1)
```

### Fix

```typescript
// BENAR — reject hanya jika no password DAN hanya 1 account
if (!pwUser?.passwordHash && (accounts?.cnt || 0) <= 1)
```

---

## 🔴 P0 — S5A-001: OAuthService State Methods

**Lokasi:** `worker/src/services/oauth.ts`

### Masalah

`OAuthStateRow` type ada, method create/validate/consume tidak ada. Semua inline di route.

### Fix

Tambah ke `OAuthService`:

```
static async createState(db, provider, mode, returnTo?): Promise<{state: string, nonce: string}>
static async validateState(db, provider, state): Promise<{valid: boolean, row: OAuthStateRow | null}>
static async consumeState(db, stateId: number): Promise<void>
```

returnTo hanya path internal (`/`, `/dashboard`, `/settings`, `/settings/account-security`).

---

## 🔴 P0 — S5A-003: Google Button di RegisterPage

**Lokasi:** `web/src/pages/auth/RegisterPage.tsx`

Tambah Google button setelah password field.

---

## 🔴 P0 — S5A-003: Account Security Link/Unlink UI

**Lokasi:** `web/src/pages/settings/ProfileSettingsPage.tsx`

Tambah section "Akun Tertaut":
- Lihat status link Google
- Link Google dari settings
- Unlink dengan guard last login method
- Error LAST_LOGIN_METHOD tampil readable

---

## 🔴 P0 — S5A-016: 5A Test Coverage

**Lokasi:** `worker/test/sprint5a-*.test.mjs` (file baru)

| Test | File |
|------|------|
| OAuth state create → validate → consume | `sprint5a-oauth.test.mjs` |
| OAuth state reuse → reject | `sprint5a-oauth.test.mjs` |
| OAuth unverified email → reject | `sprint5a-oauth.test.mjs` |
| OAuth email conflict → no auto-merge | `sprint5a-oauth.test.mjs` |
| OAuth link/unlink (last method guard) | `sprint5a-oauth.test.mjs` |
| POST /api/symptoms → creates log + red flag | `sprint5a-symptom.test.mjs` |
| GET /api/symptoms/:id → owner only | `sprint5a-symptom.test.mjs` |
| GET /api/dashboard/daily-health | `sprint5a-daily.test.mjs` |
| POST /api/symptoms/prompt-dismissals | `sprint5a-symptom.test.mjs` |

---

## 🟡 P0 — S5A-013: Emergency Blocking UI

**Lokasi:** `web/src/pages/symptoms/SymptomPage.tsx`

### Fix

1. Ganti `alert()` dengan modal blocking:
   - Full screen overlay, tidak bisa di-dismiss
   - Judul `⚠️ [title]`, pesan `[message]`
   - Tombol "Hubungi Darurat" (tel:119) + "Saya mengerti, lanjutkan"
2. Tampilkan CTA kontak darurat jika user punya emergency contacts

---

## 🟡 P0 — S5A-013: VAS Labels

**Lokasi:** `web/src/pages/symptoms/SymptomPage.tsx`

Tambah label Ringan/Sedang/Berat/Sangat Berat di pain scale.

---

## 🟡 P0 — S5A-008: Symptom Prompt Frontend

**Lokasi:** `web/src/pages/measurement/SeniorMeasurementFlow.tsx`

### Fix

1. Setelah submit sukses, cek `postSubmitPrompt`
2. Jika `type === 'symptomCheck'`:
   - Modal: "Apakah Anda mengalami keluhan?"
   - "Ya" → redirect `/symptoms/new?sessionId=xxx`
   - "Tidak" → `POST /api/symptoms/prompt-dismissals`

---

## 🟡 P1 — S5A-014: Education Bottom Sheet UI

**Lokasi:** `web/src/pages/education/EducationBottomSheet.tsx` (baru)

### Fix

1. Komponen bottom sheet:
   - Fetch `GET /api/education/cards?topicType=...`
   - Tampilkan title, shortText, whyItMatters, actionText
   - Tombol "Saya Mengerti" → `POST /api/education/cards/.../acknowledge`
   - `firstTimeOnly=true` — jangan tampilkan jika sudah di-acknowledge
2. Integrasi di halaman relevan

---

## 🟡 P1 — S5A-015: History Timeline Frontend

**Lokasi:** `web/src/pages/history/HistoryTimelinePage.tsx` (baru)

### Fix

1. Fetch `GET /api/history/timeline?types=measurement,symptom,safetyEvent,hydration,cycle`
2. Render mixed list dengan icon per rowType
3. Red flag badge 🔴 untuk `isRedFlag: true`
4. Sensitive detail hidden di summary
5. Link symptom ke measurement via `sourceSessionId`

---

## 🟡 P0 — S5A-012: Symptom Detail Permission

**Lokasi:** `worker/src/routes-auth.ts`

Tambah family + admin permission check di `GET /api/symptoms/:symptomLogId`.

---

## 🟡 P1 — S5A-001: returnTo Validation

**Lokasi:** `worker/src/routes-auth.ts`

Validasi `returnTo` hanya path internal yang dikenal.

---

# ===== SPRINT 5B =====

---

## 🔴 S5B-001: Hydration Target Calculator

**Lokasi:** `worker/src/services/hydration.ts`

### Fix

1. **Default 2000ml:** Jika tidak ada data berat badan, hamil, menyusui, atau demam → return 2000ml
2. **Body weight real:** Baca `HL_measurementValues` untuk metricCode `bodyWeight` hari ini atau terakhir
3. **Pregnancy clamp:** Jika hamil → `max(target, 2400)`
4. **Lactation clamp:** Jika menyusui → `max(target, 2800)`
5. **Fever check:** Baca suhu tubuh dari `HL_measurementValues` metricCode `bodyTemperature`. Jika >37.5°C → +500ml
6. **Reason text update:** Tambahkan alasan untuk fever, default 2000ml

### Acceptance

- [ ] No data → 2000ml
- [ ] bodyWeight 70kg → 2100ml
- [ ] Pregnant → min 2400ml
- [ ] Lactating → min 2800ml
- [ ] Fever >37.5°C → +500ml
- [ ] Reason text mencakup semua faktor

---

## 🔴 S5B-004: Overhydration Threshold

**Lokasi:** `worker/src/services/hydration.ts`

### Fix

Ganti `totalMl > target.targetMl * 1.5` menjadi `totalMl > 5000` (sesuai PRD F5B-005).

---

## 🔴 S5B-006: Hydration Dashboard Widget UI

**Lokasi:** `web/src/pages/hydration/HydrationPage.tsx`

### Fix

1. **Progress ring:** Ganti `div` progress bar dengan SVG circular progress ring
2. **Quick add:** Tombol `+200ml` dan `+600ml` (bukan 100/250/300/500)
3. **Custom input:** Modal dengan numeric keypad
4. **Reason text:** Tampilkan `targetReasons` dari API response
5. **Warning card:** Card styling untuk overhydration (bukan `p` biasa)
6. **Large input confirmation:** Jika amount >1000ml, tampilkan konfirmasi sebelum submit

---

## 🔴 S5B-007: Hydration Settings & History UI

**Lokasi:** `web/src/pages/hydration/HydrationSettingsPage.tsx` (baru)

### Fix

1. Settings screen terpisah:
   - Toggle isPregnant, isLactating
   - Operating hours (start/end)
   - Reminder toggle (disabled until 5E)
   - Custom base target
2. History per day:
   - Calendar/date picker
   - Summary: total/target/percent/log count
   - Detail: daftar log per hari

---

## 🔴 S5B-008: 5B Test Coverage

**Lokasi:** `worker/test/sprint5b-*.test.mjs` (file baru)

| Test | Description |
|------|------------|
| Target: default 2000ml | No data → 2000 |
| Target: bodyWeight × 30 | 70kg → 2100 |
| Target: pregnant min 2400 | 1800 base → 2400 |
| Target: lactating min 2800 | 2000 base → 2800 |
| Target: fever +500 | 2000 base + fever → 2500 |
| Target: reason text | Semua faktor muncul |
| Water: create/delete/recalc | CRUD + total recalc |
| Water: large input confirmation | >1000 rejected tanpa flag |
| Overhydration: threshold 5000 | >5000 triggers HL_safetyEvents |
| Settings: get/update | Upsert settings |
| API: today/log/history/settings/delete | Endpoint integration |

---

## 🟡 S5B-003: confirmedLargeInput

**Lokasi:** `worker/src/routes-hydration.ts`

Tambah validasi: jika `amountMl > 1000` dan `confirmedLargeInput !== true` → return error 400.

---

## 🟡 S5B-005: Entitlement Guard + warningCode

**Lokasi:** `worker/src/routes-hydration.ts`

1. Tambah entitlement guard di hydration endpoints (jika feature gating aktif)
2. Ganti boolean `overhydrationWarning` dengan `warningCode: 'HYDRATION_OVER_LIMIT'`

---

## Ringkasan — Urutan Eksekusi

| Step | Task | Durasi | Ketergantungan |
|------|------|--------|----------------|
| **S5A** | | | |
| 1 | S5A-002: Fix Google callback (real token exchange) | 2-3 jam | GOOGLE_CLIENT_SECRET |
| 2 | S5A-001: OAuthService state methods | 30 menit | - |
| 3 | S5A-002: Fix unlink logic + returnTo validation | 15 menit | - |
| 4 | S5A-012: Symptom detail permission check | 30 menit | - |
| 5 | S5A-003: Google button RegisterPage + account security UI | 1 jam | - |
| 6 | S5A-013: Emergency blocking UI + VAS labels | 2 jam | - |
| 7 | S5A-008: Symptom prompt frontend | 1 jam | - |
| 8 | S5A-014: Education bottom sheet | 2 jam | S5A-004 |
| 9 | S5A-015: History timeline frontend | 1-2 jam | - |
| 10 | S5A-016: Tests | 2-3 jam | Semua S5A |
| **S5B** | | | |
| 11 | S5B-001: Fix target calculator (default, body weight, pregnant/lactating clamp, fever) | 1-2 jam | - |
| 12 | S5B-004: Fix overhydration threshold 5000ml | 5 menit | - |
| 13 | S5B-003: confirmedLargeInput validation | 15 menit | - |
| 14 | S5B-005: Entitlement guard + warningCode | 30 menit | - |
| 15 | S5B-006: Fix hydration widget (progress ring, quick add, reason text, warning card) | 2-3 jam | - |
| 16 | S5B-007: Hydration settings + history UI | 2-3 jam | - |
| 17 | S5B-008: Tests | 2-3 jam | Semua S5B |

**Total estimasi: ~20-28 jam kerja.**

