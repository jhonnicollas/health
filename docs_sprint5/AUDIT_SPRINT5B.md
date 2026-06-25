# Audit Sprint 5B — Gap & Bug Report

Berdasarkan perbandingan task plan S5B-001 sampai S5B-008, PRD, SQL schema, dan source code actual.

---

## 🔴 S5B-001 — Hydration Target Calculator

**Lokasi:** `worker/src/services/hydration.ts` (inline, bukan file terpisah)

### Acceptance Criteria vs Realita

| AC | Realita | Detail |
|----|---------|--------|
| Default 2000ml | ❌ **Tidak jalan** | Code pakai estimasi `heightCm - 100 × 30` atau fallback `65 × 30 = 1950ml`. Tidak ada `else { return 2000 }` |
| bodyWeightKg × 30ml | ❌ **Estimasi, bukan data real** | Code pakai `Math.round(profile.heightCm - 100)` — tebak berat dari tinggi. Tidak baca `HL_measurementValues` untuk bodyWeight real |
| Pregnant minimum 2400ml | ❌ **Hanya +300ml** | Code tambah 300ml ke base, bukan clamp ke 2400. Jika base 1800 → jadi 2100, masih kurang dari 2400 |
| Lactating minimum 2800ml | ❌ **Hanya +500ml** | Sama, clamp ke 2800 tidak ada |
| Fever >37.5°C adds 500ml | ❌ **Tidak ada implementasi** | Nol kode untuk baca suhu tubuh atau tambah 500ml |
| Reason text matches each factor | ⚠️ Ada, tapi tidak mencakup fever | Hanya weight, pregnant, lactating |

### Additional Issues

- **Tidak ada file terpisah** `worker/services/hydration-target.ts` — semua di 1 file besar `hydration.ts`
- Body weight dari `HL_measurementValues` tidak dibaca — pakai tebakan dari height
- Tidak ada cache invalidation — target di-cache di `HL_hydrationTargets` sekali per hari, tidak pernah di-recalc

---

## 🔴 S5B-002 — Hydration Settings Service

**Lokasi:** `worker/src/services/hydration.ts`

### Acceptance Criteria vs Realita

| AC | Realita |
|----|---------|
| Get/update settings | ✅ `getSettings`, `upsertSettings` ada |
| Owner-only update | ✅ Auth guard di route |
| Sensitive pregnancy/lactation changes audited | ⚠️ Ada audit trail (di route `hydration.settings.update`) |
| No Telegram dependency for 5B web | ✅ |
| **Pregnancy/lactation sync hook** | ❌ **Tidak ada** — task minta sync hook, tidak diimplementasi |

---

## 🟡 S5B-003 — Water Intake Log Service

**Lokasi:** `worker/src/services/hydration.ts`

### Acceptance Criteria vs Realita

| AC | Realita |
|----|---------|
| Create/delete/list water logs | ✅ `logWater`, `getTodayLogs`, `getHistory` ada |
| Daily total recalculation | ✅ Recalc after add/delete |
| amountMl 1-3000 | ✅ Validasi di route |
| **source = 'web' for web request** | ⚠️ Hardcode `'web'` — OK untuk 5B |
| **>1000 requires confirmedLargeInput=true** | ❌ **Tidak ada implementasi** — tidak ada parameter `confirmedLargeInput`, tidak ada validasi |
| Delete recalculates total | ✅ |

---

## 🟡 S5B-004 — Overhydration Safety Event

**Lokasi:** `worker/src/services/hydration.ts` — `checkOverhydration()`

### Acceptance Criteria vs Realita

| AC | Realita |
|----|---------|
| Threshold >5000ml | ❌ **Code pakai 150% target (biasanya ~3000ml)**, bukan 5000ml seperti PRD F5B-005 |
| Does not create HL_alerts | ✅ create di `HL_safetyEvents` |
| Warning copy not diagnosis | ✅ "Kelebihan Cairan" — OK |
| Event summary safe | ✅ |

### Bug: Threshold Mismatch

**PRD F5B-005 & Task Plan S5B-004:** "Jika total harian >5000ml"
**Code:** `totalMl > target.targetMl * 1.5` (untuk target 2000ml = 3000ml)

Ini inkonsistensi. User dengan target 2000ml kena warning di 3000ml, padahal PRD bilang 5000ml.

---

## 🟡 S5B-005 — Hydration APIs

**Lokasi:** `worker/src/routes-hydration.ts`

### Endpoints

| Endpoint | Status | Issue |
|----------|--------|-------|
| `GET /api/hydration/settings` | ✅ | OK |
| `PUT /api/hydration/settings` | ✅ | OK |
| `GET /api/hydration/today` | ✅ | OK — returns target, logs, total, overhydrationWarning |
| `POST /api/hydration/logs` | ✅ | OK |
| `GET /api/hydration/history` | ✅ | OK |
| `DELETE /api/hydration/logs/:logId` | ✅ | OK |
| **Entitlement guard** | ❌ | Task minta entitlement guard, tidak ada |
| **warningCode HYDRATION_OVER_LIMIT** | ❌ | Response boolean `overhydrationWarning: true`, bukan warningCode |

---

## 🔴 S5B-006 — Hydration Dashboard Widget UI

**Lokasi:** `web/src/pages/hydration/HydrationPage.tsx`

### Deliverables vs Realita

| Deliverable | Realita |
|-------------|---------|
| **Progress ring** | ❌ **Tidak ada** — pakai `div` progress bar biasa |
| **+200ml, +600ml quick add** | ❌ **Tombol: 100, 200, 250, 300, 500** — tidak sesuai PRD yang minta 200 dan 600 |
| **Custom input numeric keypad** | ❌ Input number biasa, bukan numeric keypad |
| **Reason text** | ❌ **Tidak ditampilkan** — `targetReasons` dikirim backend tapi tidak di-render |
| **Warning card** | ❌ Hanya `<p className="form-message error">`, bukan card |
| **Large input confirmation** | ❌ **Tidak ada** — langsung submit tanpa konfirmasi |
| Mobile 360px usable | ✅ CSS generic |
| One-tap quick add | ✅ Tapi pakai tombol 100/250/300/500 bukan 200/600 |

---

## 🔴 S5B-007 — Hydration Settings and History UI

**Lokasi:** `web/src/pages/hydration/HydrationPage.tsx`

### Deliverables vs Realita

| Deliverable | Realita |
|-------------|---------|
| **Hydration settings screen** | ❌ **Tidak ada** — tidak ada UI untuk isPregnant, isLactating, operating hours, reminder |
| **History per day summary/detail** | ❌ Tidak ada — hanya daftar log hari ini |
| Reminder toggle | ❌ Tidak ada |

**Tidak ada halaman setting terpisah.** Semua yang ada di `HydrationPage.tsx` hanya widget input + progress bar. Settings (pregnancy, lactation, operating hours) tidak bisa diubah dari UI.

---

## 🔴 S5B-008 — 5B Tests and Exit Gate

**Lokasi:** `worker/test/sprint5-service.test.mjs`

### Test Coverage

| Test Area | Ada? |
|-----------|------|
| Hydration target calculator: default 2000ml | ❌ **Tidak ada** |
| Hydration target calculator: body weight × 30 | ❌ Tidak ada (test yang ada pakai mock height 170cm) |
| Hydration target calculator: pregnant min 2400ml | ❌ **Tidak ada** |
| Hydration target calculator: lactating min 2800ml | ❌ **Tidak ada** |
| Hydration target calculator: fever +500ml | ❌ **Tidak ada** |
| Hydration target calculator: reason text | ❌ Tidak ada |
| Water intake: create/delete/recalc | ❌ Tidak ada |
| Water intake: large input confirmation | ❌ Tidak ada |
| Overhydration: threshold 5000ml | ❌ **Tidak ada** (test yang ada pakai 150% logic) |
| Hydration settings: get/update | ❌ Tidak ada |
| Hydration API: today/log/history/settings/delete | ❌ Tidak ada |
| Entitlement guard | ❌ Tidak ada |

### Total: 6 hydration-related tests di sprint5-service.test.mjs
- 1 test overhydration (tapi pakai AiMemoryService, bukan HydrationService langsung)
- 1 test hydration target (via mock DB)
- 4 tests lainnya tidak langsung terkait hydration

---

## Ringkasan Prioritas Fix

```
S5B-001  🔴  Target calculator: default 2000ml, real body weight, pregnant/lactating min clamp, fever +500ml
S5B-001  🔴  Body weight dari HL_measurementValues, bukan estimasi dari height
S5B-004  🔴  Overhydration threshold: ganti 150% target → 5000ml (sesuai PRD)
S5B-006  🔴  Progress ring, tombol 200/600, reason text, warning card, konfirmasi large input
S5B-007  🔴  Settings screen (pregnancy, lactation, operating hours) + history per day
S5B-008  🔴  Test coverage: semua formula branches + API endpoints
S5B-003  🟡  confirmedLargeInput validation (>1000ml wajib konfirmasi)
S5B-005  🟡  Entitlement guard + warningCode HYDRATION_OVER_LIMIT
S5B-002  🟡  Pregnancy/lactation sync hook
```

