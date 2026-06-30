# AI_SAFETY_RUNTIME_SPEC.md — iSehat / iSehat Sprint 6
## Medical Safety Runtime v2 — Technical Specification

```text
Document Type      : Technical Specification
Version            : 1.0
Date               : 2026-06-30
Source of Truth    : docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md §0.1, §4, §10
Worker             : #2 (isehat-ai-worker)
Phase              : Implemented in S6A, enforced in S6E–S6I
Core Principle     : Rule-first, AI-assisted, manual-verification-first, safety-runtime-enforced
```

---

# 1. Overview

Medical Safety Runtime v2 is a **post-LLM output filter** that runs on every AI-generated medical response before it reaches the user. It enforces the AI boundary defined in PRD §0.1 and §4.1.

## 1.1 Position in the Pipeline

```text
User Request
  → Auth + Consent + Entitlement + Quota + Rate Limit (#1)
  → Intent Classifier (#2)
  → Deterministic Red Flag Precheck (#2)
  → Clinical Context Package Build (#2)
  → Prompt Assembly (#2)
  → ModelRouter → LLM Call (#2)
  → [HERE] Medical Safety Runtime v2 (#2)  ← scans LLM output
  → Response Formatter (inject disclaimer) (#2)
  → Store + Log (#2)
  → Return to User (#1 or #4)
```

## 1.2 D1 Column Mapping Note

The SafetyDecision enum values differ from the D1 `safetyLevel` CHECK constraint values in `HL_aiClinicalMessages`. Implementers MUST map between them:

| SafetyDecision enum | HL_aiClinicalMessages.safetyLevel | HL_aiOutputSafetyFlags.actionTaken |
|---|---|---|
| `allow` | `safe` | `allow` |
| `allow_with_disclaimer` | `allow_with_disclaimer` | `allow_with_disclaimer` |
| `rewrite_safe` | `rewrite_safe` | `rewrite_safe` |
| `block_and_fallback` | `blocked` | `block_and_fallback` |
| `emergency_template_only` | `emergency_template_only` | `emergency_template_only` |
| `needs_human_review` | `needs_human_review` | `needs_human_review` |

This mapping exists because the D1 schema was designed with shorter column values for `safetyLevel` (`safe`, `blocked`) while the enum and `actionTaken` use the full descriptive values (`allow`, `block_and_fallback`).

## 1.3 Key Principle

```text
The Safety Runtime runs AFTER the LLM generates output, not before.
It inspects the generated text and decides whether to:
  - allow it through as-is
  - allow it with disclaimer injection
  - rewrite dangerous parts to safe alternatives
  - block entirely and return deterministic safe template
  - return emergency template only (no LLM freeform)
  - flag for human review
```

---

# 2. SafetyDecision Enum

```typescript
enum SafetyDecision {
  ALLOW                    = 'allow',                   // Output is safe, disclaimer present
  ALLOW_WITH_DISCLAIMER    = 'allow_with_disclaimer',   // Output safe but disclaimer needs insertion
  REWRITE_SAFE             = 'rewrite_safe',            // Rewrite dangerous parts to safe version
  BLOCK_AND_FALLBACK       = 'block_and_fallback',      // Full block, return deterministic safe template
  EMERGENCY_TEMPLATE_ONLY  = 'emergency_template_only', // Emergency: only deterministic template, no LLM
  NEEDS_HUMAN_REVIEW       = 'needs_human_review',      // Flag for medical reviewer queue
}
```

---

# 3. 13 Detectors — Complete Specification

Detectors 1–9 and 12 are **mode-invariant** (always active, same decision regardless of operating mode). Detectors 10, 11, 13 are **mode-dependent** — their decision changes based on `clinicalCopilot.operatingMode` (PRD §0.3).

### Mode-Dependent Decision Matrix

| Detector | `standard` | `proactive` | `super_aktif` |
|---|---|---|---|
| diagnosisFinalDetector | rewrite_safe | allow | allow |
| prescriptionDosageDetector | rewrite_safe | rewrite_safe | allow |
| specialistClaimDetector | rewrite_safe | rewrite_safe | allow |
| medicationChangeDetector | block_and_fallback | block_and_fallback | block_and_fallback |

All other detectors (1–9) always have the same decision regardless of mode.

## 3.1 missingDisclaimerDetector

| Field | Value |
|---|---|
| Detector Code | `missingDisclaimerDetector` |
| Severity on violation | critical |
| Decision | `block_and_fallback` |
| Runs on | Every medical output |

### Detection Logic

```text
INPUT: aiOutput (string), expectedLocale ('id' | 'en')

1. Extract the footer section (last 200 chars or marked disclaimer section)
2. Check for presence of disclaimer markers:
   ID markers: "AI DAPAT MELAKUKAN KESALAHAN", "TIDAK BOLEH MENGANDALKAN AI 100%"
   EN markers: "AI CAN MAKE MISTAKES", "DO NOT RELY ON AI 100%"
3. If no markers found → VIOLATION
4. Check disclaimer is not malformed:
   - Must contain at least 3 of 4 key phrases
   - Must not be HTML-commented out (<!-- disclaimer -->)
   - Must not be in metadata/hidden div
   - Must not be truncated mid-sentence
5. If malformed → VIOLATION
```

### Blocked Response Template (ID)

```text
AI DAPAT MELAKUKAN KESALAHAN.
TIDAK BOLEH MENGANDALKAN AI 100%.
TIDAK BOLEH PERCAYA AI 100%.
SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.
```

## 3.2 emergencySeverityDowngradeDetector

| Field | Value |
|---|---|
| Detector Code | `emergencySeverityDowngradeDetector` |
| Severity on violation | critical |
| Decision | `block_and_fallback` |
| Runs on | Output where deterministic rule says emergency=true |

### Detection Logic

```text
INPUT: aiOutput (string), deterministicEmergencyLevel ('emergency' | 'warning' | 'none')

1. If deterministicEmergencyLevel != 'emergency' → SKIP (no violation possible)
2. Scan aiOutput for severity-downgrade patterns:
   - "tidak urgent" / "not urgent"
   - "tidak perlu khawatir" / "no need to worry"
   - "bisa ditunda" / "can wait"
   - "keparahan: normal" / "severity: normal"
   - "ringan saja" / "mild concern"
   - "cukup dipantau" / "just monitor"
   - "tidak serius" / "not serious"
   - Any phrase that implies the situation is less severe than 'emergency'
3. If any pattern matches → VIOLATION
4. Also check: AI suggests "wait and see" or "try again tomorrow" when emergency=true
```

### Action on Violation

```text
Return emergency_template_only:
"⚠️ PERINGATAN DARURAT
Berdasarkan data yang tercatat, Anda memiliki tanda bahaya yang memerlukan
perhatian medis segera. JANGAN menunda. Segera hubungi:
- Layanan Darurat: 119 / 112
- Fasilitas Kesehatan terdekat
- Contact caregiver Anda (jika tersedia)"
```

## 3.3 crossUserLeakDetector

| Field | Value |
|---|---|
| Detector Code | `crossUserLeakDetector` |
| Severity on violation | critical |
| Decision | `block_and_fallback` |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string), currentUserId (integer), contextPackage

1. Extract all names/references from aiOutput
2. Check if output references data NOT in contextPackage:
   - Measurements with values not belonging to current user
   - Symptom descriptions not in user's symptom history
   - Medication names not in user's medication list
   - Names of other users
3. Cross-reference: any data point in output that doesn't trace back to
   contextPackage.contextTrace → potential cross-user leak
4. If untraceable health data found → VIOLATION
```

## 3.4 sensitiveDataLeakDetector

| Field | Value |
|---|---|
| Detector Code | `sensitiveDataLeakDetector` |
| Severity on violation | high |
| Decision | `block_and_fallback` |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string), consents { aiConsent, dataShareConsent, emergencyConsent }

Sensitive data categories (per PRD §3):
- symptom detail
- red flag detail
- cycle / menstruation data
- pregnancy status
- lactation status
- menopause status
- AI memory content
- doctor report detail
- caregiver access details
- family data

1. Scan aiOutput for sensitive data references
2. For each sensitive reference found:
   - Is it the current user's OWN data? → Check consent
   - Is dataShareConsent = 1? → Allowed
   - Is dataShareConsent = 0? → VIOLATION
3. Family/caregiver data: check explicit family permission
4. If any sensitive data exposed without consent → VIOLATION
```

## 3.5 unsafeReassuranceDetector

| Field | Value |
|---|---|
| Detector Code | `unsafeReassuranceDetector` |
| Severity on violation | high |
| Decision | `rewrite_safe` |
| Runs on | Output where red flag is present |

### Detection Logic

```text
INPUT: aiOutput (string), redFlagPresent (boolean)

1. If redFlagPresent = false → SKIP
2. Scan for reassurance patterns when red flag is active:
   - "Anda aman" / "you're safe" / "you're fine"
   - "tidak perlu khawatir" / "no need to worry"
   - "mungkin tidak ada apa-apa" / "probably nothing"
   - "aman untuk menunggu" / "safe to wait"
   - "pantauan cukup" / "monitoring is enough"
   - "tidak serius" / "not serious"
3. If reassurance found + red flag present → VIOLATION
```

### Rewrite Action

```text
Replace reassurance with:
"Berdasarkan data Anda, terdapat tanda yang perlu dievaluasi oleh dokter.
Jangan mengabaikan tanda bahaya. Konsultasikan dengan fasilitas kesehatan."
```

## 3.6 certaintyClaimDetector

| Field | Value |
|---|---|
| Detector Code | `certaintyClaimDetector` |
| Severity on violation | medium |
| Decision | `rewrite_safe` |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string)

Scan for certainty claims:
- "100% akurat" / "100% accurate"
- "pasti benar" / "definitely" / "absolutely certain"
- "tidak mungkin salah" / "cannot be wrong"
- "dijamin benar" / "guaranteed correct"
- "sangat yakin" / "very confident" (in medical context)

If found → VIOLATION
```

### Rewrite Action

```text
Replace certainty claim with:
"AI dapat melakukan kesalahan. Informasi ini bersifat kemungkinan, bukan kepastian."
```

## 3.7 vectorizeAsTruthDetector

| Field | Value |
|---|---|
| Detector Code | `vectorizeAsTruthDetector` |
| Severity on violation | medium |
| Decision | `rewrite_safe` |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string)

Scan for patterns that treat Vectorize/memory as clinical final source:
- "Vectorize mengonfirmasi" / "Vectorize confirms"
- "database memori menunjukkan" / "memory database shows"
- "catatan tersimpan Anda membuktikan" / "your stored records prove"
- "data terindeks definitif menunjukkan" / "indexed records definitively show"
- "berdasarkan rekam medis tersimpan" used as definitive proof

If found → VIOLATION
```

### Rewrite Action

```text
Replace with:
"Vectorize adalah memori semantik untuk membantu konteks, bukan bukti klinis final.
Selalu konsultasikan dengan dokter untuk diagnosis pasti."
```

## 3.8 ruleEngineBypassDetector

| Field | Value |
|---|---|
| Detector Code | `ruleEngineBypassDetector` |
| Severity on violation | critical |
| Decision | `block_and_fallback` |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string), deterministicRuleResult

1. Compare AI output severity assessment with deterministic rule severity
2. Scan for patterns that override or ignore rules:
   - "aturan mesin salah" / "the rule is wrong"
   - "saya menilai lebih akurat" / "I assess more accurately"
   - "abaikan sistem" / "ignore the system"
   - "user tahu lebih baik" / "user knows better"
   - AI proposes alternative severity different from rule
   - AI says rule engine is unnecessary
3. If any bypass pattern found → VIOLATION
```

## 3.9 delayMedicalCareDetector

| Field | Value |
|---|---|
| Detector Code | `delayMedicalCareDetector` |
| Severity on violation | critical |
| Decision | `block_and_fallback` |
| Runs on | Output where red flag is present |

### Detection Logic

```text
INPUT: aiOutput (string), redFlagPresent (boolean)

1. If redFlagPresent = false → SKIP
2. Scan for delay patterns:
   - "tunggu dan lihat" / "wait and see"
   - "coba lagi besok" / "try again tomorrow"
   - "tidak perlu buru-buru" / "no rush"
   - "pantau di rumah" / "monitor at home"
   - "tidak cukup serius" / "not serious enough"
   - "tidak perlu ke dokter sekarang" / "no need to see doctor now"
   - "cukup istirahat" / "just rest" (when red flag present)
3. If delay pattern found + red flag → VIOLATION
```

### Action

```text
Return emergency guidance template immediately.
Log to HL_safetyEvents + HL_aiOutputSafetyFlags.
```

## 3.10 diagnosisFinalDetector

| Field | Value |
|---|---|
| Detector Code | `diagnosisFinalDetector` |
| Severity on violation | LOW (standard mode) / N/A (proactive, super_aktif — allowed) |
| Decision | mode-dependent: standard=rewrite_safe, proactive=allow, super_aktif=allow |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string), operatingMode ('standard' | 'proactive' | 'super_aktif')

1. If operatingMode IN ('proactive', 'super_aktif') → SKIP (diagnosis final allowed per §0.3)
2. If operatingMode = 'standard':
   Scan for final diagnosis patterns:
   - "diagnosis Anda adalah" / "your diagnosis is"
   - "Anda menderita" / "you have" (as definitive statement)
   - "ini mengonfirmasi" / "this confirms"
   - "diagnosis:" / "diagnosis:"
   - "berdasarkan hasil, Anda memiliki" / "based on results, you have"
   - "Anda terkena" / "you are suffering from" (definitive)

   If found → VIOLATION (AI gave final diagnosis, forbidden in standard mode)
```

### Rewrite Action

```text
Replace diagnosis with:
"Kemungkinan yang perlu dipertimbangkan termasuk [X]. Namun, ini bukan diagnosis
final. Konsultasikan dengan dokter untuk diagnosis yang pasti."
```

## 3.11 prescriptionDosageDetector

| Field | Value |
|---|---|
| Detector Code | `prescriptionDosageDetector` |
| Severity on violation | high (standard, proactive) / N/A (super_aktif — allowed) |
| Decision | mode-dependent: standard=rewrite_safe, proactive=rewrite_safe, super_aktif=allow |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string), operatingMode ('standard' | 'proactive' | 'super_aktif')

1. If operatingMode = 'super_aktif' → SKIP (prescription/dosage allowed per §0.3)
2. If operatingMode IN ('standard', 'proactive'):
   Scan for prescription/dosage patterns:
   - "minum X mg" / "take X mg"
   - "saya merekomendasikan obat" / "I recommend medication"
   - "Anda harus minum" / "you should take"
   - "dosis yang tepat adalah" / "the dosage is"
   - "mulai dengan X mg" / "start with X mg"
   - Drug name + dosage combination (e.g., "amoxicillin 500mg")
   - "resep untuk Anda" / "prescription for you"

   If found → VIOLATION (AI gave prescription/dosage, forbidden in standard/proactive per §0.3)
```

### Rewrite Action

```text
Replace with:
"Pemberian resep dan dosis obat harus dilakukan oleh dokter. Konsultasikan
dengan dokter atau apoteker untuk resep dan dosis yang tepat."
```

## 3.12 medicationChangeDetector

| Field | Value |
|---|---|
| Detector Code | `medicationChangeDetector` |
| Severity on violation | critical |
| Decision | `block_and_fallback` |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string)

Scan for medication change patterns:
- "berhenti minum" / "stop taking"
- "ganti ke" / "switch to"
- "kurangi dosis" / "reduce your dose"
- "naikkan dosis" / "increase your dose"
- "dobel dosis" / "double your dose"
- "Anda tidak butuh obat ini lagi" / "you don't need this anymore"
- "hentikan pengobatan" / "stop the medication"

If found → VIOLATION (AI changed medication, forbidden per §0.1 point 8)
```

### Action

```text
Return blocked safe template:
"PERINGATAN: AI tidak dapat mengubah, menghentikan, atau menyesuaikan obat Anda.
Jangan mengubah obat tanpa konsultasi dokter. Perubahan obat dapat berbahaya."
```

## 3.13 specialistClaimDetector

| Field | Value |
|---|---|
| Detector Code | `specialistClaimDetector` |
| Severity on violation | medium (standard, proactive) / N/A (super_aktif — allowed) |
| Decision | mode-dependent: standard=rewrite_safe, proactive=rewrite_safe, super_aktif=allow |
| Runs on | Every AI output |

### Detection Logic

```text
INPUT: aiOutput (string), operatingMode ('standard' | 'proactive' | 'super_aktif')

1. If operatingMode = 'super_aktif' → SKIP (specialist claim allowed per §0.3)
2. If operatingMode IN ('standard', 'proactive'):
   Scan for specialist equivalence claims:
   - "saya setara dengan dokter spesialis" / "I'm equal to a specialist"
   - "analisis saya sama dengan dokter" / "my analysis matches a doctor's"
   - "saya punya akurasi dokter" / "I have doctor-level accuracy"
   - "saya sekompeten spesialis" / "I'm as capable as a specialist"
   - "percaya saja, saya setara MD" / "trust me, I'm equivalent to MD"

   If found → VIOLATION (AI claimed specialist equivalence, forbidden in standard/proactive per §0.3)
```

### Rewrite Action

```text
Replace with:
"AI adalah asisten kesehatan, bukan pengganti dokter spesialis.
Konsultasikan dengan dokter untuk evaluasi medis yang komprehensif."
```

---

# 4. Detector Execution Order

Detectors run in a fixed order — critical detectors first to prevent dangerous output from reaching rewrite-stage detectors:

```text
Phase 1 — BLOCK detectors (critical severity, run first):
  1. missingDisclaimerDetector
  2. emergencySeverityDowngradeDetector
  3. crossUserLeakDetector
  4. sensitiveDataLeakDetector
  5. ruleEngineBypassDetector
  6. delayMedicalCareDetector
  7. medicationChangeDetector

Phase 2 — REWRITE detectors (high/medium severity, run second):
  8. unsafeReassuranceDetector
  9. certaintyClaimDetector
  10. vectorizeAsTruthDetector
  11. diagnosisFinalDetector
  12. prescriptionDosageDetector
  13. specialistClaimDetector

Decision precedence:
  - If ANY Phase 1 detector triggers → block_and_fallback (skip Phase 2)
  - If Phase 1 passes → run Phase 2 detectors
  - If multiple Phase 2 detectors trigger → apply all rewrites in order
  - If no detector triggers → allow or allow_with_disclaimer
```

---

# 5. Safety Flag Logging

Every detector violation writes to `HL_aiOutputSafetyFlags`:

```sql
INSERT INTO HL_aiOutputSafetyFlags
  (userId, modelRunId, sessionId, flagCode, severity, detectedTextPreview, actionTaken, createdAt)
VALUES
  (?, ?, ?, ?, ?, ?, ?, datetime('now'));
```

| Field | Value |
|---|---|
| flagCode | Detector code (e.g., `diagnosisFinalDetector`) |
| severity | `low` / `medium` / `high` / `critical` |
| detectedTextPreview | Truncated preview of offending text (max 200 chars, no raw sensitive data) |
| actionTaken | The SafetyDecision applied |

Additionally, critical violations write to `HL_safetyEvents`:

```sql
INSERT INTO HL_safetyEvents
  (userId, sourceType, severity, summary, occurredAt, createdAt)
VALUES
  (?, 'ai_safety_violation', 'critical', ?, datetime('now'), datetime('now'));
```

---

# 6. Deterministic Emergency Precheck (Pre-LLM)

The Safety Runtime also includes a **pre-LLM check** that runs BEFORE the LLM is called:

```text
1. Check HL_metricRules → is any latest measurement severity = 'emergency'?
2. Check HL_symptomLogs → is any redFlagTriggered = 1?
3. Check HL_safetyEvents → is any open event severity = 'emergency'?
4. If ANY check = emergency:
   - SKIP LLM call entirely
   - Return emergency_template_only
   - Insert HL_safetyEvents row
   - Insert HL_auditLogs row
   - Do NOT allow AI to generate freeform output
5. If NO emergency detected:
   - Proceed to LLM call
   - Safety Runtime v2 (13 detectors) runs on LLM output
```

This precheck ensures that **emergency guidance is never delayed by LLM latency** and that **AI cannot downgrade emergency severity** because the LLM is never called in emergency situations.

---

# 7. Integration with Clinical Orchestrator

```text
Clinical Orchestrator Flow:

1. Intent classify
2. Red flag precheck (deterministic)
   → If emergency: return emergency_template_only [NO LLM]
3. Build context package
4. Load prompt
5. ModelRouter.route() → LLM generates raw output
6. [SAFETY RUNTIME v2]
   a. Run 7 BLOCK detectors (Phase 1)
   b. If any block → return blocked template [NO LLM OUTPUT]
   c. Run 6 REWRITE detectors (Phase 2)
   d. Apply rewrites to output text
   e. Check disclaimer presence → inject if missing
7. Response Formatter
   a. Inject disclaimer footer (if not present)
   b. Build context trace
   c. Set answerType
   d. Set safetyDecision field
8. Store to HL_aiClinicalMessages
9. Log to HL_modelRuns (with safetyDecision + safetyFlagsJson)
10. Return formatted response
```

---

# 8. Configuration

```text
medicalSafetyRuntime.enabled    = true   (system config)
medicalSafetyRuntime.strictMode = true   (system config)
clinicalCopilot.operatingMode   = 'standard' (system config, super admin only)

If strictMode = true:
  - All 13 detectors active
  - Mode-invariant detectors (1-9, 12): no bypass
  - Mode-dependent detectors (10, 11, 13): decision based on operatingMode
  - Critical violations always block
  - mode-dependent: operatingMode determines allow/rewrite_safe per §0.3

If strictMode = false (NOT recommended for production):
  - Critical detectors still active
  - Medium detectors log only (no rewrite)
  - Used for testing/debugging only
```

---

# 9. Test Coverage Requirements

| Test Type | Count | Coverage |
|---|---|---|
| Unit tests (1 per detector) | 13 | S6A-T-10 |
| Safety suite (13 × 5 vectors) | 65 | S6I-T-01 |
| Prompt injection cases | 100 | S6I-T-02 |
| Forbidden output cases | 5 | S6I-T-04 |
| Red flag missed cases | 100 | S6I-T-05 |
| **Total safety tests** | **283** | |
