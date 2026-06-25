# Sprint 5B Gap Analysis — Hydration Tracker

**Audit Date:** 2026-06-25  
**Scope:** S5B-001 through S5B-008  
**Method:** Task plan vs. source code vs. API contract vs. SQL schema cross-reference  
**Status:** INCOMPLETE — hallucinated task completion, many gaps remain  
**Revision:** v2 — re-verified against PRD, API contract, SQL schema, and source code

---

## Executive Summary

The previous AI agent marked Sprint 5B tasks as DONE but the implementation is **shallow and incomplete**. The backend has a basic hydration service with significant formula bugs and missing API contract compliance. The frontend is a single minimal page with no settings, no history, and missing UX features. No dedicated tests exist. Multiple critical gaps would cause production failures and contract violations.

**Severity Legend:**
- 🔴 **CRITICAL** — Production failure, data loss, or safety violation
- 🟠 **HIGH** — Contract violation, missing security, or broken feature
- 🟡 **MEDIUM** — Incorrect behavior, missing validation, or UX gap
- 🔵 **LOW** — Minor deviation, missing optimization, or cosmetic issue

**Evidence Sources:**
- `docs_sprint5/07.API_CONTRACT_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.md` (contract)
- `docs_sprint5/02.PRD_USER_STORIES_SPRINT5_FULL_FINAL_REVISED_AI_SPRINT6_READY.md` (PRD)
- `docs_sprint5/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql` (schema)
- `docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql` (seed)
- `worker/src/services/hydration.ts` (service)
- `worker/src/routes-hydration.ts` (routes)
- `web/src/pages/hydration/HydrationPage.tsx` (frontend)

---

## S5B-001: Hydration Target Calculator

**Files:** `worker/src/services/hydration.ts:22-34`  
**Status:** 🔴 CRITICAL GAPS

### Gap 1 — Body Weight Estimation Is Wrong (🔴 CRITICAL)

**Task says:** `bodyWeightKg × 30ml`  
**API contract says:** Reads `HL_measurementValues` for actual weight (section 8.1 reads/writes)  
**PRD says:** Target dihitung dari berat badan  
**Implementation does:** Reads `heightCm` from `HL_userProfiles` and estimates weight as `heightCm - 100`

```typescript
// hydration.ts:25-27
const profile = await db.prepare('SELECT heightCm FROM HL_userProfiles WHERE userId = ?').bind(userId).first<any>()
const bodyWeight = profile?.heightCm ? Math.round(profile.heightCm - 100) : 65
```

**Why this is wrong:**
1. `HL_userProfiles` table (schema `07-schema.sql:58-73`) has `heightCm` but NO `bodyWeightKg` column
2. Body weight is a measurement metric stored in `HL_measurementValues` with `metricCode='bodyWeight'`
3. The codebase already has a pattern for querying body weight: `worker/src/routes-extra.ts:608` queries `HL_measurementValues WHERE metricCode = 'bodyWeight'`
4. The estimation `heightCm - 100` is a rough Devine formula that gives wrong results for many body types

**Impact:** All hydration targets are calculated from estimated weight, not actual measured weight. A 170cm user who weighs 90kg gets target for 70kg (2100ml instead of 2700ml).

**Fix:** Query `HL_measurementValues` for latest `bodyWeight` metric. Fall back to profile estimation only when no measurement exists.

### Gap 2 — No Fever Adjustment (🟠 HIGH)

**Task says:** `Fever >37.5°C adds 500ml`  
**API contract says:** `targetReasons` example includes `"+500ml karena suhu tubuh hari ini di atas 37.5°C."` (section 8.1)  
**SQL schema has:** `bodyTemperatureC REAL` column in `HL_hydrationTargets` (schema line 331)  
**Implementation does:** Nothing with temperature

```typescript
// hydration.ts:22-33 — no temperature logic exists
```

**Impact:** Users with fever get no extra hydration target. This is a medical safety gap per PRD.

**Fix:** Query `HL_measurementValues` for latest `bodyTemperature` on the target date. If >37.5, add 500ml to base target and add reason text.

### Gap 3 — Pregnancy/Lactating Minimums Not Enforced (🟠 HIGH)

**Task says:**
- Pregnant minimum 2400ml
- Lactating minimum 2800ml

**Implementation does:** Adds flat amounts to base, no minimum enforcement

```typescript
// hydration.ts:30-31
if (settings?.isPregnant) { baseTarget += 300; reasons.push('+300 ml karena hamil.') }
if (settings?.isLactating) { baseTarget += 500; reasons.push('+500 ml karena menyusui.') }
```

**Impact:** A 50kg pregnant user gets `50×30+300 = 1800ml`, below the 2400ml minimum. The minimum requirement is ignored.

**Fix:** After calculating base + adjustments, enforce: `if (isPregnant) baseTarget = Math.max(baseTarget, 2400)` and `if (isLactating) baseTarget = Math.max(baseTarget, 2800)`.

### Gap 4 — No Unit Tests for Formula (🟡 MEDIUM)

**Task says:** `Unit tests all formula branches`  
**Implementation has:** One test in `sprint5-service.test.mjs:151-167` that only checks `targetMl > 0` — doesn't test pregnant, lactating, fever, or custom target branches.

**Missing test cases:**
- Default 2000ml when no weight/settings
- bodyWeightKg × 30ml with actual weight from measurements
- Pregnant minimum 2400ml
- Lactating minimum 2800ml
- Fever >37.5°C adds 500ml
- Custom base target override
- Reason text matches each factor

---

## S5B-002: Hydration Settings Service

**Files:** `worker/src/services/hydration.ts:1-20`  
**Status:** 🟡 MEDIUM GAPS

### Gap 5 — Audit Log Only Covers Pregnancy/Lactation (🟡 MEDIUM)

**API contract says:** `HL_auditLogs optional action=hydration.settings.update entityType=HL_hydrationSettings entityId=:userId when pregnancy/lactation changes` (section 8.4)  
**Implementation does:** Always logs only `isPregnant` and `isLactating` in metadata

```typescript
// routes-hydration.ts:34
await AuditService.write(c.env.DB, { userId: uid, action: 'hydration.settings.update',
  entityType: 'HL_hydrationSettings', entityId: String(uid),
  metadataJson: JSON.stringify({ isPregnant: body.isPregnant, isLactating: body.isLactating }) })
```

**Impact:** Minor — contract says "optional". But audit metadata should reflect what actually changed, not always the same two fields.

### Gap 6 — Settings Update Does Not Invalidate Cached Targets (🟡 MEDIUM)

**Implementation:** When pregnancy/lactation settings change, existing `HL_hydrationTargets` rows for today/future are NOT recalculated.

**Impact:** If a user toggles `isPregnant` at noon, their morning-calculated target remains stale until the next day.

**Fix:** After settings update, delete or recalculate `HL_hydrationTargets` for today and future dates.

---

## S5B-003: Water Intake Log Service

**Files:** `worker/src/services/hydration.ts:36-51`, `worker/src/routes-hydration.ts:52-64`  
**Status:** 🔴 CRITICAL GAPS

### Gap 7 — `confirmedLargeInput` Not Validated (🔴 CRITICAL)

**Task says:** `>1000 requires confirmedLargeInput=true`  
**API contract says:** `if amountMl > 1000, frontend must send confirmedLargeInput=true after confirmation` (section 8.2 validation)  
**Implementation does:** No validation of `confirmedLargeInput`

```typescript
// routes-hydration.ts:55-56
const body = await c.req.json() as { amountMl: number; loggedAt?: string; notes?: string }
if (!body.amountMl || body.amountMl < 1 || body.amountMl > 3000) return jr(c, fail('VALIDATION_ERROR', 'amountMl 1-3000.', 400, [], s), 400)
// No confirmedLargeInput check
```

**Impact:** Users can log 3000ml in one tap without confirmation. This is a safety gap — large single intakes can be dangerous.

### Gap 8 — POST /api/hydration/logs Response Incomplete (🟠 HIGH)

**API contract response (section 8.2):**
```json
{
  "logId": 21, "amountMl": 200, "totalMl": 1600, "targetMl": 2500,
  "percent": 64, "overhydrationWarning": false
}
```

**Implementation returns:**
```json
{ "logId": 1, "totalMl": 1400 }
```

**Missing fields:** `amountMl`, `targetMl`, `percent`, `overhydrationWarning`

**Impact:** Frontend cannot display updated progress bar or warning without making a second request.

### Gap 9 — Overhydration Threshold Mismatch (🔴 CRITICAL)

**PRD says:** `Jika total harian >5000ml, sistem harus menampilkan warning` (PRD line 991)  
**PRD says:** `5B-FR-011 | Total >5000ml menampilkan overhydration warning` (PRD line 1011)  
**API contract says:** `HL_safetyEvents eventType=overhydrationWarning if totalMl > 5000` (section 8.2 writes)  
**API contract error code:** `HYDRATION_OVER_LIMIT | 201 | Water log saved but daily total > 5000ml` (section 4)  
**Implementation does:** `totalMl > target.targetMl * 1.5` (150% of target)

```typescript
// hydration.ts:55
if (totalMl > target.targetMl * 1.5) {
```

**Additional inconsistency:** The safety event message in code says `"Total asupan air hari ini melebihi 150% target"` (line 56), but the contract warning message says `"Minum terlalu banyak air dalam waktu singkat bisa berbahaya."` — the code message references the wrong threshold.

**Impact:** For a user with 2000ml target, safety event triggers at 3000ml (too low, produces false alarms). For a user with 4000ml target, it triggers at 6000ml (correct by coincidence). The threshold should be the absolute 5000ml per PRD and contract.

**Fix:** Change to `if (totalMl > 5000)` per PRD and API contract. Update safety event message to match contract.

### Gap 10 — No Duplicate Safety Event Prevention (🟡 MEDIUM)

**Implementation:** Every time `checkOverhydration` is called and total > threshold, a new `HL_safetyEvents` row is inserted — no deduplication by date.

**Impact:** If user logs 5 waters in a day above limit, 5 separate safety events are created.

**Fix:** Check for existing `overhydrationWarning` event on the same date before inserting.

---

## S5B-004: Overhydration Safety Event

**Files:** `worker/src/services/hydration.ts:53-60`  
**Status:** 🔴 CRITICAL GAPS

### Gap 11 — Safety Event Writes Without Audit (🟡 MEDIUM)

**Implementation:** Safety event INSERT has no audit trail.

**Fix:** After creating overhydration safety event, write audit log with action `safetyEvent.create`.

### Gap 12 — No Warning Message or SafetyEventId in API Response (🟠 HIGH)

**API contract over-limit response (section 8.2):**
```json
{
  "logId": 21, "amountMl": 1000, "totalMl": 5200, "targetMl": 2400,
  "percent": 217, "overhydrationWarning": true,
  "safetyEventId": 55,
  "warningMessage": "Minum terlalu banyak air dalam waktu singkat bisa berbahaya. Periksa kembali catatan Anda."
},
"meta": { "warningCode": "HYDRATION_OVER_LIMIT" }
```

**Implementation:** `checkOverhydration` returns boolean. Route returns `{ logId, totalMl }`. No `safetyEventId`, no `warningMessage`, no `warningCode` in meta.

**Fix:** Change `checkOverhydration` to return `{ triggered: boolean; safetyEventId?: number }`. Route must include these in response. Add `warningCode: 'HYDRATION_OVER_LIMIT'` to meta when triggered.

### Gap 13 — Safety Event Message Inconsistent with Contract (🟡 MEDIUM)

**Code message:** `"Total asupan air hari ini melebihi 150% target. Pantau keluhan seperti mual, pusing, atau sesak."`  
**Contract message:** `"Minum terlalu banyak air dalam waktu singkat bisa berbahaya. Periksa kembali catatan Anda."`

**Fix:** Update safety event message to match contract.

---

## S5B-005: Hydration APIs

**Files:** `worker/src/routes-hydration.ts`  
**Status:** 🟠 HIGH GAPS

### Gap 14 — No Entitlement Guard (🟠 HIGH)

**Task says:** `Entitlement guard if feature gating enabled`  
**API contract says:** `requireEntitlement('feature.hydration.use') if gating is enabled` (section 8.1, 8.2)  
**Implementation does:** No entitlement check on any hydration route

```typescript
// routes-hydration.ts — no EntitlementService import or requireEntitlement call
```

**Impact:** The guard should exist for when plan config changes. Other routes (cycle) already use `EntitlementService.requireEntitlement`.

### Gap 15 — GET /api/hydration/history Returns Wrong Shape (🟠 HIGH)

**API contract response (section 8.3):**
```json
[{ "date": "2026-06-24", "targetMl": 2500, "totalMl": 1600, "percent": 64, "overhydrationWarning": false, "logCount": 5 }]
```

**Implementation returns:** Raw `HL_waterIntakeLogs` rows (individual log entries, not daily summaries)

```typescript
// routes-hydration.ts:66-72 — returns raw logs, not aggregated
const logs = await HydrationService.getHistory(...)
return jr(c, ok(logs, 200, s), 200)
```

**Impact:** Frontend receives individual log objects instead of daily summaries. Cannot display daily totals, percentages, or log counts.

### Gap 16 — No Cursor Pagination in History (🔵 LOW)

**API contract says:** `cursor=<cursor>` query param supported (section 8.3)  
**Implementation:** Only `limit` offset-based pagination

### Gap 17 — DELETE Response Missing `targetMl` (🟡 MEDIUM)

**API contract response (section 8.5):**
```json
{ "deleted": true, "recalculatedTotalMl": 1400, "targetMl": 2500, "overhydrationWarning": false }
```

**Implementation returns:**
```json
{ "deleted": true, "recalculatedTotalMl": 1400, "overhydrationWarning": false }
```

**Missing:** `targetMl` field

### Gap 18 — GET /api/hydration/today Settings Extra Fields (🟡 MEDIUM)

**API contract settings object (section 8.1):**
```json
{ "enabled": true, "reminderEnabled": true, "operatingStart": "09:00",
  "operatingEnd": "18:00", "telegramQuickAddEnabled": true }
```

**Implementation also returns:** `isPregnant`, `isLactating`, `customBaseTargetMl` — these are NOT in the contract response shape.

**Impact:** Extra fields leak internal state. Not a security issue but violates contract.

### Gap 19 — History Default Date Range Is Arbitrary (🔵 LOW)

```typescript
// routes-hydration.ts:70
const logs = await HydrationService.getHistory(c.env.DB, uid, from || '2026-01-01', to || '2099-12-31', ...)
```

Hardcoded `2026-01-01` to `2099-12-31` default. Should default to last 30 days.

### Gap 20 — Today Endpoint Overhydration Uses Wrong Threshold (🟠 HIGH)

```typescript
// routes-hydration.ts:47
const overhydration = totalMl > target.targetMl * 1.5
```

Same 150% threshold issue as Gap 9. Should be `totalMl > 5000` per PRD/contract.

---

## S5B-006: Hydration Dashboard Widget UI

**Files:** `web/src/pages/hydration/HydrationPage.tsx`  
**Status:** 🔴 CRITICAL GAPS

### Gap 21 — Progress Ring Not Implemented (🟡 MEDIUM)

**Task says:** `Progress ring`  
**Mockup reference:** `#hydration-tracker`  
**Implementation:** Simple CSS progress bar

```tsx
// HydrationPage.tsx:26-28
<div className="progress-bar" style={{ height: 20, background: '#eee', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
  <div style={{ width: `${Math.min(data.percent, 100)}%`, height: '100%', background: data.percent > 100 ? '#e74c3c' : '#2ecc71', transition: 'width 0.3s' }} />
</div>
```

### Gap 22 — Quick Add Buttons Wrong Values (🟡 MEDIUM)

**Task says:** `+200ml, +600ml, Custom`  
**Implementation:** `[100, 200, 250, 300, 500]`

```tsx
// HydrationPage.tsx:33
{[100, 200, 250, 300, 500].map(v => <button key={v} ...>{v}ml</button>)}
```

**Missing:** +600ml button. Wrong preset values.

### Gap 23 — No Confirmation for Large Input (🟠 HIGH)

**Task says:** `>1000 requires confirmedLargeInput=true`  
**Implementation:** No confirmation dialog. User can input 3000ml directly.

### Gap 24 — Warning Card Missing Message Text (🟡 MEDIUM)

**Task says:** `Warning card` with descriptive text  
**Implementation:** Only shows `⚠️ Kelebihan cairan!` — no explanation message

```tsx
// HydrationPage.tsx:30
{data.overhydrationWarning && <p className="form-message error">⚠️ Kelebihan cairan!</p>}
```

**Missing:** Warning message from API contract: `"Minum terlalu banyak air dalam waktu singkat bisa berbahaya. Periksa kembali catatan Anda."`

### Gap 25 — No Loading/Error States (🟡 MEDIUM)

**Implementation:** Shows `Memuat...` while loading, `Gagal memuat data.` on error. No retry button, no skeleton loading.

### Gap 26 — No Target Reason Text Displayed (🟡 MEDIUM)

**API contract returns:** `targetReasons` array with explanations (section 8.1)  
**Implementation:** Fetches but never displays reason text

### Gap 27 — No Delete Functionality in UI (🟡 MEDIUM)

**Task implies:** Users can manage their logs  
**Implementation:** No delete button on log entries

### Gap 28 — Custom Input Missing Numeric Keypad (🔵 LOW)

**Task says:** `Custom input numeric keypad`  
**Implementation:** Basic `<input type="number">`

---

## S5B-007: Hydration Settings and History UI

**Files:** None — page does not exist  
**Status:** 🔴 NOT IMPLEMENTED

### Gap 29 — Hydration Settings Page Missing (🔴 CRITICAL)

**Task says:** `Hydration settings screen`  
**Implementation:** No `/hydration/settings` page or route exists

**Missing features:**
- Reminder toggle
- Operating hours configuration
- Telegram quick add toggle
- Custom base target input
- Pregnancy/lactation toggle

### Gap 30 — Hydration History Page Missing (🔴 CRITICAL)

**Task says:** `History per day summary/detail`  
**Implementation:** No `/hydration/history` page or route exists

**Missing features:**
- Daily summary with total/target/percent/log count
- Per-day detail view
- Date range selection

### Gap 31 — No Route Registration for Settings/History (🟡 MEDIUM)

**Implementation:** `App.tsx` only has `/hydration` route. No `/hydration/settings` or `/hydration/history` routes.

---

## S5B-008: 5B Tests and Exit Gate

**Files:** `worker/test/sprint5-service.test.mjs:151-167`  
**Status:** 🔴 NOT IMPLEMENTED

### Gap 32 — No Dedicated Hydration Test File (🔴 CRITICAL)

**Task says:** `Hydration formula, APIs, UI, warning tests`  
**Implementation:** One test in a combined file that only checks `targetMl > 0`

**Missing tests:**
- Formula: default, weight-based, pregnant, lactating, fever, custom
- API: today, create log, history, settings, delete
- Overhydration: threshold (5000ml), safety event creation, duplicate prevention
- Validation: amountMl bounds, confirmedLargeInput
- Privacy: owner-only access, no cross-user data leak

### Gap 33 — No API Integration Tests (🔴 CRITICAL)

No HTTP-level tests for any hydration endpoint. The existing test mocks the entire DB.

### Gap 34 — No Manual UAT Checklist (🟡 MEDIUM)

**Task says:** `Manual UAT 5B`  
**No UAT checklist documented.**

---

## Cross-Cutting Issues

### Gap 35 — SQL Schema Column `overLimitAtInsert` Unused (🔵 LOW)

`HL_waterIntakeLogs.overLimitAtInsert` column exists in schema (line 352) but is never written or read by the service.

### Gap 36 — SQL Schema Column `bodyTemperatureC` Unused (🔵 LOW)

`HL_hydrationTargets.bodyTemperatureC` column exists (schema line 331) but is never populated.

### Gap 37 — Frontend Type Safety (🔵 LOW)

`HydrationPage.tsx` uses `any` types throughout. No TypeScript interfaces for API responses.

---

## Summary Table

| Task | Gaps Found | Critical | High | Medium | Low |
|------|-----------|----------|------|--------|-----|
| S5B-001 | 4 | 1 | 2 | 1 | 0 |
| S5B-002 | 2 | 0 | 0 | 2 | 0 |
| S5B-003 | 4 | 2 | 1 | 1 | 0 |
| S5B-004 | 3 | 0 | 1 | 2 | 0 |
| S5B-005 | 7 | 0 | 3 | 3 | 1 |
| S5B-006 | 8 | 0 | 1 | 5 | 2 |
| S5B-007 | 3 | 2 | 0 | 1 | 0 |
| S5B-008 | 3 | 2 | 0 | 1 | 0 |
| Cross | 3 | 0 | 0 | 0 | 3 |
| **Total** | **37** | **7** | **8** | **16** | **6** |

---

## Recommended Fix Priority

### Phase 1 — Critical (must fix before any release)
1. Fix hydration target formula: query `HL_measurementValues` for actual `bodyWeight`, fever adjustment from `bodyTemperature`, pregnancy/lactating minimums enforcement
2. Fix overhydration threshold to absolute 5000ml per PRD and API contract
3. Fix overhydration safety event message to match contract
4. Add `confirmedLargeInput` backend validation
5. Fix POST /api/hydration/logs response shape (add `amountMl`, `targetMl`, `percent`, `overhydrationWarning`)
6. Fix `checkOverhydration` to return `safetyEventId` and route to include `warningCode` in meta
7. Fix GET /api/hydration/history to return daily summaries
8. Implement hydration settings and history UI pages
9. Add dedicated hydration test suite

### Phase 2 — High (should fix before Sprint 5B signoff)
10. Add entitlement guard to hydration routes
11. Add large input confirmation dialog in frontend
12. Add warning message text to overhydration UI
13. Return `targetMl` in DELETE response
14. Prevent duplicate safety events per day
15. Fix today endpoint overhydration check to use 5000ml threshold
16. Fix history endpoint to return daily summaries with aggregation

### Phase 3 — Medium (fix before production)
17. Display target reason text in UI
18. Add loading/error states with retry
19. Fix quick add button values to match task (+200ml, +600ml, Custom)
20. Add delete functionality to UI
21. Audit trail for safety events
22. Settings update invalidates cached targets
23. Remove extra fields from today settings response
