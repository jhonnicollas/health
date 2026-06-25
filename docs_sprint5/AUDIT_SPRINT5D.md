# Audit Sprint 5D — Gap & Bug Report (Re-Screen)

Berdasarkan perbandingan task plan S5D-001 sampai S5D-009, SQL schema, API contract, PRD, dan source code actual.

---

## 🔴 CRITICAL BUGS — Akan Crash Runtime

### CRITICAL #1: S5D-008 — Family Permissions Query Kolom Tidak Ada

**Lokasi:** `worker/src/routes-cycle.ts` baris 128-147

**SQL Schema (`HL_familyPermissions`):**
```
familyLinkId | permissionCode | allowed | grantedBy | grantedAt | revokedAt | ...
```

**Code query:**
```typescript
SELECT canViewCycle, canViewSymptoms, canViewHydration, canViewAiReport FROM HL_familyPermissions
INSERT INTO HL_familyPermissions (familyLinkId, canViewCycle, canViewSymptoms, canViewHydration, canViewAiReport, ...)
```

Kolom `canViewCycle`, `canViewSymptoms`, `canViewHydration`, `canViewAiReport` **TIDAK ADA** di schema SQL. Akan error: `SQLITE_ERROR: no such column`.

**Seed data** menggunakan `permissionCode` (family.cycle.read, family.symptom.read, dll) — cocok dengan schema, TIDAK cocok dengan code.

**API Contract** juga pakai `permissionCode` model:
```json
{ "permissions": { "family.cycle.read": false, "family.symptom.read": false } }
```

**Fix:** Query `permissionCode, allowed` WHERE `permissionCode IN ('family.cycle.read','family.symptom.read','family.hydration.read','family.aiReport.read')`

---

### CRITICAL #2: S5D-004/005 — Guardrail Acknowledge Insert Kolom Tidak Ada

**Lokasi:** `worker/src/routes-cycle.ts` baris 118

**Schema (`HL_cycleGuardrailAcknowledgements`):**
```
guardrailType | relatedDate | messageVersion | acknowledgedAt | metadataJson | createdAt
```

**Code INSERT:**
```typescript
INSERT INTO HL_cycleGuardrailAcknowledgements (userId, logDate, acknowledgementType, createdAt)
```

Kolom `logDate` dan `acknowledgementType` **TIDAK ADA** di schema. Yang benar: `relatedDate` dan `guardrailType`.

Akan error: `SQLITE_ERROR: no such column: logDate`.

---

### CRITICAL #3: Index.ts Timeline Query Kolom Salah

**Lokasi:** `worker/src/index.ts` baris 3441

**Code query:**
```typescript
SELECT id, logDate, flowLevel, symptoms FROM HL_cycleLogs
```

**Schema columns:** `flowIntensity`, `physicalSymptomsJson` — bukan `flowLevel`, `symptoms`.

Query akan return NULL untuk kedua kolom. Timeline tidak akan pernah menampilkan flow atau symptoms dari cycle logs.

---

## 🔴 S5D-001 — Cycle Eligibility Service

**Lokasi:** Inline function di `worker/src/routes-cycle.ts`, bukan `worker/services/cycle-eligibility.ts`

| AC | Realita |
|----|---------|
| sex=female age 15-48 | ✅ OK |
| File terpisah `services/cycle-eligibility.ts` | ❌ Tidak ada — inline function |
| `requireCycleEligible` middleware | ❌ Bukan middleware — dipanggil manual tiap route |
| API forbidden for non-eligible | ✅ Guard di semua 6 endpoints |
| Frontend menu hidden | ❌ Tidak ada — `App.tsx` tidak cek `/api/cycle/access` |

---

## 🔴 S5D-002 — Cycle Settings Service/API

**Lokasi:** `worker/src/services/cycle.ts` inline, bukan file terpisah

| AC / API Contract | Realita |
|-------------------|---------|
| Validasi cycleLength 1-120 | ❌ Tidak ada di code — hanya DB CHECK (error jadi 500, bukan 400) |
| Validasi periodLength 1-15 | ❌ Sama |
| isPregnant=true → predictionPaused=true | ❌ **Tidak auto-set** — API contract dan PRD 5D-FR-007 minta ini |
| isMenopause=true → predictionPaused=true | ❌ Sama |
| isLactating sync ke hydration | ❌ **Tidak ada** — PRD 5D-FR-008 minta ini |
| Sensitive settings audit | ✅ Audit trail ada |

---

## 🟡 S5D-003 — Cycle Calendar Calculator/API

**Lokasi:** `worker/src/routes-cycle.ts` endpoint `GET /api/cycle/calendar`

### API Contract Response yang Seharusnya:

```json
{
  "month": "2026-06",
  "predictionPaused": false,
  "pauseReason": null,
  "copyPolicy": { "avoidLabel": "Masa Aman", "outsideFertileLabel": "Di luar prediksi masa subur" },
  "phaseLegend": { "period": "Haid", "fertile": "Masa subur", ... },
  "days": [
    { "date": "2026-06-08", "phase": "period", "label": "Haid", "colorToken": "critical",
      "isPredicted": false, "hasLog": true, "needsContraceptionGuardrail": false }
  ]
}
```

### Response Code Sekarang:

```json
{
  "prediction": { "fertileStart": "...", "fertileEnd": "...", "ovulationDay": "...", "nextPeriod": "..." },
  "phaseLegend": { "period": "Haid", "fertile": "Subur", "ovulation": "Ovulasi", "luteal": "Luteal" }
}
```

| AC / API Contract | Realita |
|-------------------|---------|
| `month` field | ❌ Tidak ada |
| `predictionPaused` | ❌ Tidak ada |
| `pauseReason` | ❌ Tidak ada |
| `copyPolicy` | ❌ Tidak ada |
| `days[]` array per day | ❌ **Tidak ada** — ini core deliverable |
| `phaseLegend` | ✅ Ada |
| Month/year boundary | ❌ Tidak ada logic |
| File `services/cycle-calendar.ts` | ❌ Tidak ada |

**Tanpa `days[]` array, frontend tidak bisa render kalender dengan warna phase per hari.**

---

## 🔴 S5D-004 — Cycle Log Service/API

**Lokasi:** `worker/src/services/cycle.ts`, `worker/src/routes-cycle.ts`

| AC / API Contract | Realita |
|-------------------|---------|
| Upsert by userId+logDate | ✅ ON CONFLICT works |
| Validate flowIntensity/mood/unprotected | ❌ Tidak ada — hanya DB CHECK |
| unprotected tanpa acknowledgement → jangan simpan | ❌ **Code simpan dulu, baru cek** — API contract minta `saved: false` |
| `contraceptionGuardrailAcknowledged` di request body | ❌ Tidak dibaca |
| Notes treated as sensitive | ❌ Tidak ada handling |
| Response format `{saved, logId, requiresContraceptionGuardrail}` | ❌ Return `{logDate, guardrail}` — beda format |

### Flow Error:

**API Contract:**
1. Cek `body.unprotected === true` && `body.contraceptionGuardrailAcknowledged !== true`
2. If yes → return `{saved: false, requiresContraceptionGuardrail: true}` — **jangan simpan**
3. If no → simpan, return `{saved: true}`

**Code:**
1. Simpan dulu (`logDay`)
2. Cek guardrail setelah simpan
3. Return `{logDate, guardrail}` — log sudah terlanjur tersimpan

---

## 🔴 S5D-005 — Contraception Guardrail Service/UI

**Lokasi:** `worker/src/services/cycle.ts`, `worker/src/routes-cycle.ts`

| AC / PRD | Realita |
|----------|---------|
| Blocking modal frontend | ❌ **Tidak ada** — CyclePage.tsx 29 lines |
| Guardrail acknowledge endpoint | ⚠️ Ada tapi **akan crash** (CRITICAL #2) |
| Warning copy = PRD paragraf panjang | ❌ **Copy singkat** — beda dengan PRD |
| Guardrail trigger saat unprotected | ⚠️ Hanya trigger jika dalam fertile window |
| Guardrail trigger saat klik kalender | ❌ Tidak ada (frontend kalender tidak ada) |

**PRD Required Copy (tidak ada):**
> "Peringatan: Metode kalender tidak memberikan perlindungan 100% terhadap kehamilan. Sperma dapat bertahan hidup hingga 5 hari. Prediksi masa aman bisa meleset karena stres, sakit, obat, perubahan tidur, menyusui, atau siklus yang tidak teratur."

---

## 🟡 S5D-006 — Cycle Irregularity Detector + Safety Event

**Lokasi:** `worker/src/services/cycle.ts`

| AC / PRD | Realita |
|----------|---------|
| Detect <21 or >35 days | ✅ `detectIrregularity()` pure function OK |
| **Create safety event** eventType=cycleIrregularity | ❌ **Tidak ada** — function hanya return object |
| **Update predictionPaused** | ❌ **Tidak update DB** |
| **Two consecutive cycles** (PRD: "dua siklus berturut-turut") | ❌ Hanya cek `settings.cycleLengthDays` — tidak analisa historical logs |
| Does not create HL_alerts | ✅ |

### Gap:

`detectIrregularity()` dipanggil di `GET /api/cycle/settings` tapi hasilnya:
- Tidak disimpan
- Tidak create safety event
- Tidak pause prediction

PRD 5D-FR-009: "Irregular cycles membuat non-metric safety event dan pause prediction"

---

## 🔴 S5D-007 — Cycle Frontend Settings/Calendar/Log

**Lokasi:** `web/src/pages/cycle/CyclePage.tsx` — **hanya 29 lines**

### Deliverables vs Realita

| Deliverable | Realita |
|-------------|---------|
| Conditional Cycle menu | ❌ Tidak cek `GET /api/cycle/access` |
| Settings screen (form) | ❌ Tidak ada — tampilkan text doang |
| Calendar grid dengan phase | ❌ Tidak ada — fertile window sebagai text |
| Selected-day bottom sheet | ❌ Tidak ada |
| Daily log form | ❌ Tidak ada |
| Guardrail blocking modal | ❌ Tidak ada |
| Non-eligible redirect | ❌ Tidak ada |
| Mobile 360px | ⚠️ CSS generic |

### Frontend hanya tampilkan 3 baris informasi:
```
Siklus: 28 hari | Periode: 5 hari
Prediksi ovulasi: 2026-06-16
Masa subur: 2026-06-12 - 2026-06-18
Periode berikutnya: 2026-06-30
```

**Semua komponen frontend (settings, calendar, log form, bottom sheet, guardrail modal) tidak ada.**

---

## 🔴 S5D-008 — Family Sensitive Permissions

### Additional Findings

| AC | Realita |
|----|---------|
| CRITICAL schema mismatch | 🔴 Akan crash (CRITICAL #1) |
| Owner only update | ⚠️ Route check session, tapi tidak verify ownership link |
| Caregiver cannot see cycle/symptom without permission | ❌ Tidak bisa diuji karena crash |
| Audit log pada mutasi | ✅ Ada |
| Frontend `FamilyPage.tsx` | ⚠️ Ada tapi permission model beda (canViewDashboard dll — Sprint 1-4 model) |

---

## 🔴 S5D-009 — 5D Tests and Exit Gate

**Lokasi:** `worker/test/sprint5-service.test.mjs`

### Test Coverage

| Test Area | Status |
|-----------|--------|
| Cycle eligibility age 15/boundaries | ❌ 0 test |
| Cycle settings validation 1-120 / 1-15 | ❌ 0 test |
| Cycle settings prediction pause | ❌ 0 test |
| Cycle calendar phases per day | ❌ 0 test |
| Cycle calendar year boundary | ❌ 0 test |
| Cycle log upsert dengan guardrail | ❌ 0 test |
| Cycle guardrail block before save | ❌ 0 test |
| Cycle guardrail acknowledge | ❌ 0 test |
| Cycle irregularity safety event | ❌ 0 test |
| Family permissions | ❌ 0 test |

**Ada 5 cycle tests:** fertile window prediction, irregularity (2x), guardrail detection, clinical safety — semua unit test, tidak ada integration/API test.

---

## Ringkasan — 3 CRITICAL + 10 P0 Gap

```
CRITICAL #1  S5D-008  Family permissions query kolom tidak ada di schema → CRASH
CRITICAL #2  S5D-004/005  Guardrail acknowledge insert kolom tidak ada di schema → CRASH
CRITICAL #3  Index.ts  Timeline query HL_cycleLogs pakai flowLevel/symptoms — kolom tidak ada

P0 🔴  S5D-002  Tidak ada validasi server-side cycleLength/periodLength
P0 🔴  S5D-002  isPregnant/menopause tidak auto-set predictionPaused
P0 🔴  S5D-003  Calendar tidak punya days[] array — frontend tidak bisa render
P0 🔴  S5D-004  Log disimpan dulu sebelum guardrail check — harusnya ditolak
P0 🔴  S5D-005  Guardrail frontend blocking modal tidak ada
P0 🔴  S5D-005  Warning copy tidak sesuai PRD (kurang paragraf panjang)
P0 🔴  S5D-006  Irregularity tidak create safety event atau pause prediction
P0 🔴  S5D-007  Cycle frontend hanya 29 lines — semua komponen hilang
P0 🔴  S5D-009  Coverage test hampir nol untuk 9 tasks
```

