# CLINICAL_RESPONSE_SCHEMA.md — iSehat / iSehat Sprint 6
## AI Clinical Copilot — Response Schema Specification

```text
Document Type      : Technical Specification
Version            : 1.0
Date               : 2026-06-30
Source of Truth    : docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md §8.1 (Output Types), §9 (Context Package), §16 (UI)
Workers            : #2 (isehat-ai-worker) generates; #1 (isehat-api-worker) proxies; #4 (webhooks-worker) for WhatsApp
```

---

# 1. Response Envelope (Top-Level)

Every AI Clinical Copilot API response follows the standard envelope used across the iSehat platform:

```json
{
  "success": true,
  "data": {
    "messageId": 456,
    "reply": "Berdasarkan data Anda, tekanan darah 145/95 termasuk tinggi...",
    "answerType": "safe_summary",
    "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN. TIDAK BOLEH MENGANDALKAN AI 100%...",
    "contextTrace": [
      {
        "sourceType": "measurement",
        "sourceTable": "HL_measurementValues",
        "metricCode": "blood_pressure_systolic",
        "measuredAt": "2026-07-01T07:30:00Z",
        "contentPreview": "Sistolik 145 mmHg (status: high)"
      }
    ],
    "dataSufficiencyScore": 72,
    "dataSufficiencyLabel": "data cukup",
    "redFlagStatus": "warning",
    "followUpQuestions": [
      "Apakah Anda mengalami sakit kepala?",
      "Apakah Anda sudah minum obat tekanan darah hari ini?"
    ],
    "safetyDecision": "allow_with_disclaimer",
    "safetyFlags": [],
    "operatingMode": "standard",
    "modelName": "deepseek-v4-flash-free",
    "modelProvider": "9router",
    "usedFallback": false,
    "usedVectorContext": true,
    "usedAiSearch": false,
    "sessionId": 123,
    "sessionUuid": "uuid-abc-123",
    "inputTokenCount": 450,
    "outputTokenCount": 320,
    "latencyMs": 1850
  },
  "meta": {
    "requestId": "req_abc123",
    "durationMs": 2100
  }
}
```

## 1.1 Error Response Envelope

```json
{
  "success": false,
  "error": {
    "code": "SAFETY_BLOCKED",
    "message": "Output ini melampaui batas keamanan dan telah diblokir.",
    "details": {
      "safetyDecision": "block_and_fallback",
      "flagCode": "medicationChangeDetector"
    }
  },
  "meta": {
    "requestId": "req_def456",
    "durationMs": 150
  }
}
```

---

# 2. answerType — 11 Allowed Output Types

| answerType | Description | Safety Decision Range | When Used |
|---|---|---|---|
| `safe_summary` | Ringkasan data kesehatan user | allow, allow_with_disclaimer | General health data summary |
| `possible_explanations` | Daftar kemungkinan penyebab (non-final) | allow_with_disclaimer | Symptom analysis, trend interpretation |
| `follow_up_questions` | Pertanyaan lanjutan yang relevan | allow | Symptom interview, data gathering |
| `missing_data` | Data apa yang kurang untuk analisis | allow | Insufficient data scenario |
| `first_aid_guidance` | Panduan P3K dari protokol terkurasi | allow_with_disclaimer | First aid request |
| `emergency_guidance` | Arahan darurat dari deterministic rule | emergency_template_only | Red flag detected |
| `doctor_handoff` | Ringkasan untuk dokter | allow_with_disclaimer | Doctor handoff generation |
| `caregiver_summary` | Ringkasan untuk caregiver (dengan permission) | allow_with_disclaimer | Caregiver summary request |
| `medication_adherence_summary` | Ringkasan kepatuhan minum obat | allow_with_disclaimer | Medication adherence query |
| `medication_questions_for_doctor` | Pertanyaan untuk dokter/apoteker | allow | Medication safety query |
| `blocked_unsafe_request` | Permintaan diblokir oleh Safety Runtime | block_and_fallback | Forbidden output detected |

## 2.1 Mode-Dependent answerTypes (allowed in proactive / super_aktif mode)

```text
diagnosis_final          — AI boleh memberi diagnosis final (proactive, super_aktif)
prescription_guidance    — AI boleh memberi resep (super_aktif only)
dosage_instruction       — AI boleh memberi instruksi dosis (super_aktif only)
specialist_claim         — AI boleh klaim setara spesialis (super_aktif only)
```

In `standard` mode, if the LLM generates any of these, the Safety Runtime rewrites the output and changes `answerType` to the appropriate safe alternative or `blocked_unsafe_request`.

In `proactive` mode: `diagnosis_final` is allowed. Others still rewritten/blocked.

In `super_aktif` mode: all 5 above are allowed. `medication_change` remains forbidden.

---

# 3. Detailed Schema per answerType

## 3.1 safe_summary

```json
{
  "answerType": "safe_summary",
  "reply": "Berdasarkan data 7 hari terakhir, rata-rata tekanan darah sistolik Anda adalah 138 mmHg (tertinggi 145, terendah 128). Tekanan darah Anda cenderung stabil tetapi berada di kategori tinggi. Disarankan untuk konsultasi dengan dokter untuk evaluasi lebih lanjut.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "measurement", "sourceTable": "HL_measurementValues", "metricCode": "blood_pressure_systolic", "measuredAt": "2026-07-01T07:30:00Z", "contentPreview": "Sistolik 145 mmHg (high)" },
    { "sourceType": "measurement", "sourceTable": "HL_measurementValues", "metricCode": "blood_pressure_systolic", "measuredAt": "2026-06-30T07:30:00Z", "contentPreview": "Sistolik 132 mmHg (normal)" }
  ],
  "dataSufficiencyScore": 72,
  "redFlagStatus": "warning"
}
```

## 3.2 possible_explanations

```json
{
  "answerType": "possible_explanations",
  "reply": "Kemungkinan yang perlu dipertimbangkan berdasarkan data Anda:\n1. Hipertensi stadium 1 — tekanan darah tinggi yang memerlukan evaluasi dokter\n2. Stres atau kecemasan — dapat meningkatkan tekanan darah sementara\n3. Kurang aktivitas fisik — gaya hidup dapat memengaruhi tekanan darah\n\nIni bukan diagnosis final. Konsultasikan dengan dokter untuk diagnosis pasti.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "measurement", "sourceTable": "HL_measurementValues", "metricCode": "blood_pressure_systolic", "measuredAt": "2026-07-01T07:30:00Z", "contentPreview": "Sistolik 145 mmHg (high)" },
    { "sourceType": "vector_memory", "sourceTable": "HL_vectorDocuments", "contentPreview": "Kunjungan dokter 2 bulan lalu: tekanan darah tinggi" }
  ],
  "followUpQuestions": [
    "Apakah ada riwayat hipertensi dalam keluarga?",
    "Apakah Anda mengonsumsi obat tekanan darah saat ini?"
  ],
  "dataSufficiencyScore": 65,
  "redFlagStatus": "none"
}
```

## 3.3 follow_up_questions

```json
{
  "answerType": "follow_up_questions",
  "reply": "Untuk membantu memahami kondisi Anda lebih baik, saya perlu bertanya:\n1. Seberapa sering Anda mengalami pusing?\n2. Apakah pusing terjadi di waktu tertentu (pagi/sore/malam)?\n3. Apakah ada gejala lain yang menyertai (mual, penglihatan kabur)?",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "symptom", "sourceTable": "HL_symptomLogs", "contentPreview": "Gejala: pusing, sedang, 3 hari" }
  ],
  "followUpQuestions": [
    "Seberapa sering Anda mengalami pusing?",
    "Apakah pusing terjadi di waktu tertentu?",
    "Apakah ada gejala lain yang menyertai?"
  ],
  "dataSufficiencyScore": 35,
  "redFlagStatus": "none"
}
```

## 3.4 missing_data

```json
{
  "answerType": "missing_data",
  "reply": "Saat ini data Anda masih terbatas untuk memberikan analisis yang komprehensif. Data yang akan membantu:\n- Pengukuran tekanan darah dalam 7 hari terakhir (saat ini: 2 pengukuran)\n- Catatan gejala (saat ini: belum ada)\n- Riwayat obat (saat ini: belum ada)\n\nMulai catat pengukuran dan gejala secara teratur untuk mendapatkan wawasan yang lebih baik.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "measurement", "sourceTable": "HL_measurementValues", "metricCode": "blood_pressure_systolic", "measuredAt": "2026-06-28T07:30:00Z", "contentPreview": "Sistolik 130 mmHg (normal)" }
  ],
  "dataSufficiencyScore": 20,
  "dataSufficiencyLabel": "data sangat terbatas",
  "redFlagStatus": "none"
}
```

## 3.5 first_aid_guidance

```json
{
  "answerType": "first_aid_guidance",
  "reply": "Panduan P3K — Luka Ringan & Perdarahan Ringan\n\n⚠️ RED FLAGS (cari bantuan segera jika):\n- Perdarahan tidak berhenti > 10 menit\n- Luka sangat dalam atau lebar\n- Tanda infeksi (nanah, kemerahan meluas)\n\n✅ LAKUKAN:\n1. Cuci tangan dengan sabun\n2. Bersihkan luka dengan air mengalir\n3. Tutup dengan perban steril\n\n❌ JANGAN:\n1. Jangan gunakan kapas langsung pada luka\n2. Jangan tiup luka\n\n🏥 CARI BANTUAN SEGERA jika red flags terjadi.\n\nProtocol reviewed: approved | v1.0",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "knowledge_base", "sourceTable": "HL_firstAidProtocols", "contentPreview": "Protocol: wound_minor, approved, v1.0" }
  ],
  "dataSufficiencyScore": 0,
  "redFlagStatus": "none",
  "firstAidProtocol": {
    "protocolCode": "wound_minor",
    "title": "Luka Ringan & Perdarahan Ringan",
    "redFlags": ["perdarahan tidak berhenti > 10 menit", "luka dalam/lebar", "tanda infeksi"],
    "doSteps": ["Cuci tangan", "Bersihkan luka dengan air mengalir", "Tutup dengan perban steril"],
    "dontSteps": ["Jangan gunakan kapas langsung pada luka", "Jangan tiup luka"],
    "seekHelpNow": ["Perdarahan tidak berhenti > 10 menit", "Luka sangat dalam", "Tanda infeksi"],
    "reviewerStatus": "approved",
    "contentVersion": "1.0"
  }
}
```

## 3.6 emergency_guidance

```json
{
  "answerType": "emergency_guidance",
  "reply": "⚠️ PERINGATAN DARURAT\n\nBerdasarkan data yang tercatat, Anda memiliki tanda bahaya yang memerlukan perhatian medis segera.\n\nJANGAN menunda. Segera hubungi:\n- Layanan Darurat: 119 / 112\n- Fasilitas Kesehatan terdekat\n- Contact caregiver Anda (jika tersedia)\n\nJangan mengemudi sendiri. Minta bantuan orang lain untuk mengantar Anda.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "measurement", "sourceTable": "HL_measurementValues", "metricCode": "blood_pressure_systolic", "measuredAt": "2026-07-01T07:30:00Z", "contentPreview": "Sistolik 185 mmHg (emergency)" },
    { "sourceType": "symptom", "sourceTable": "HL_symptomLogs", "contentPreview": "Gejala: nyeri dada, berat" }
  ],
  "dataSufficiencyScore": 85,
  "redFlagStatus": "emergency",
  "safetyDecision": "emergency_template_only",
  "emergencyContacts": [
    { "type": "emergency_service", "label": "Layanan Darurat", "number": "119" },
    { "type": "caregiver", "label": "Caregiver", "number": "+62812xxx" }
  ]
}
```

## 3.7 doctor_handoff

```json
{
  "answerType": "doctor_handoff",
  "reply": "Ringkasan untuk Dokter — Periode: 30 hari terakhir\n\nCHIEF CONCERN:\nTekanan darah tinggi yang menetap (sistolik 130-145 mmHg)\n\nVITAL TRENDS (30 hari):\n- Sistolik: rata-rata 138, range 128-145, tren: stabil tinggi\n- Diastolik: rata-rata 88, range 82-95, tren: stabil\n\nMEDICATION ADHERENCE:\n- Amlodipine 5mg: 85% kepatuhan (25 dari 30 hari)\n\nRED FLAGS REPORTED:\n- Sakit kepala saat tekanan darah tinggi (3 kali)\n\nDATA GAPS:\n- Tidak ada pengukuran tekanan darah malam hari\n- Tidak ada catatan asupan garam\n\nQUESTIONS FOR DOCTOR:\n1. Apakah perlu penyesuaian dosis amlodipine?\n2. Apakah perlu pemeriksaan tambahan?\n\nCONTEXT TRACE: 8 sumber data digunakan.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "measurement", "sourceTable": "HL_measurementValues", "metricCode": "blood_pressure_systolic", "measuredAt": "2026-07-01T07:30:00Z", "contentPreview": "Sistolik 145 mmHg (high)" },
    { "sourceType": "medication", "sourceTable": "HL_medicationLogs", "contentPreview": "Amlodipine 5mg: 25/30 hari tepat" },
    { "sourceType": "symptom", "sourceTable": "HL_symptomLogs", "contentPreview": "Sakit kepala, 3 kali, sedang" }
  ],
  "dataSufficiencyScore": 78,
  "redFlagStatus": "warning",
  "doctorHandoff": {
    "period": "30day",
    "chiefConcern": "Tekanan darah tinggi yang menetap",
    "vitalTrends": [
      { "metricCode": "blood_pressure_systolic", "avg": 138, "min": 128, "max": 145, "direction": "stable" },
      { "metricCode": "blood_pressure_diastolic", "avg": 88, "min": 82, "max": 95, "direction": "stable" }
    ],
    "medicationAdherence": [
      { "medication": "Amlodipine 5mg", "adherencePercent": 85, "daysTaken": 25, "daysTotal": 30 }
    ],
    "redFlagsReported": ["Sakit kepala saat tekanan darah tinggi (3 kali)"],
    "dataGaps": ["Tidak ada pengukuran tekanan darah malam hari", "Tidak ada catatan asupan garam"],
    "questionsForDoctor": ["Apakah perlu penyesuaian dosis amlodipine?", "Apakah perlu pemeriksaan tambahan?"],
    "reportR2Key": "reports/doctor-handoff/user-42/2026-07-01.html"
  }
}
```

## 3.8 caregiver_summary

```json
{
  "answerType": "caregiver_summary",
  "reply": "Ringkasan Kesehatan untuk Caregiver\n\nUser: [Nama Keluarga]\nPeriode: 7 hari terakhir\n\nVITAL:\n- Tekanan darah: rata-rata 138/88 mmHg (tinggi)\n- Denyut jantung: rata-rata 75 bpm (normal)\n\nKEPATUHAN OBAT:\n- Amlodipine 5mg: 6 dari 7 hari tepat waktu\n\nGEJALA:\n- Sakit kepala: 2 kali (sedang)\n\nPERHATIAN:\n- Tekanan darah tinggi yang menetap, disarankan kontrol dokter\n\nCatatan: Ringkasan ini dibuat dengan izin pengguna. Data sensitif (siklus, gejala detail) hanya ditampilkan jika pengguna memberikan izin.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "measurement", "sourceTable": "HL_measurementValues", "contentPreview": "BP avg 138/88 (7-day)" },
    { "sourceType": "medication", "sourceTable": "HL_medicationLogs", "contentPreview": "Amlodipine: 6/7 days" }
  ],
  "dataSufficiencyScore": 70,
  "redFlagStatus": "warning",
  "caregiverSummary": {
    "period": "7day",
    "permissionScope": "family_permission_granted",
    "sensitiveDataIncluded": false,
    "vitalSummary": [
      { "metricCode": "blood_pressure_systolic", "avg": 138, "status": "high" },
      { "metricCode": "heart_rate", "avg": 75, "status": "normal" }
    ],
    "medicationAdherence": [
      { "medication": "Amlodipine 5mg", "daysTaken": 6, "daysTotal": 7 }
    ],
    "symptoms": [{ "code": "headache", "count": 2, "severity": "moderate" }]
  }
}
```

## 3.9 medication_adherence_summary

```json
{
  "answerType": "medication_adherence_summary",
  "reply": "Ringkasan Kepatuhan Obat — 7 hari terakhir\n\nAmlodipine 5mg (2x sehari):\n- Tepat waktu: 12 dari 14 dosis (86%)\n- Terlambat: 1 dosis\n- Terlewat: 1 dosis\n\nMetformin 500mg (2x sehari):\n- Tepat waktu: 13 dari 14 dosis (93%)\n- Terlambat: 1 dosis\n- Terlewat: 0 dosis\n\nPertanyaan untuk dokter/apoteker:\n1. Apakah kepatuhan 86% untuk amlodipine cukup, atau perlu perbaikan?\n2. Apakah ada interaksi yang perlu diperhatikan antara amlodipine dan metformin?\n\n⚠️ Jangan mengubah dosis sendiri tanpa konsultasi dokter.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "medication", "sourceTable": "HL_medicationLogs", "contentPreview": "Amlodipine: 12/14 on time" },
    { "sourceType": "medication", "sourceTable": "HL_medicationLogs", "contentPreview": "Metformin: 13/14 on time" }
  ],
  "dataSufficiencyScore": 65,
  "redFlagStatus": "none"
}
```

## 3.10 medication_questions_for_doctor

```json
{
  "answerType": "medication_questions_for_doctor",
  "reply": "Pertanyaan untuk Ditanyakan ke Dokter/Apoteker:\n\n1. Apakah kepatuhan 86% untuk amlodipine masih dalam batas aman?\n2. Apakah ada efek samping yang perlu dipantau dari kombinasi amlodipine + metformin?\n3. Apakah waktu minum obat saat ini optimal (pagi dan malam)?\n4. Apakah perlu pemeriksaan fungsi ginjal atau hati secara berkala?\n\n⚠️ AI tidak dapat memberikan resep, mengubah dosis, atau menentukan interaksi obat secara final. Konsultasikan semua pertanyaan ini dengan dokter atau apoteker Anda.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN...",
  "contextTrace": [
    { "sourceType": "medication", "sourceTable": "HL_medicationLogs", "contentPreview": "Amlodipine 5mg, Metformin 500mg" }
  ],
  "dataSufficiencyScore": 60,
  "redFlagStatus": "none"
}
```

## 3.11 blocked_unsafe_request

```json
{
  "answerType": "blocked_unsafe_request",
  "reply": "Permintaan Diblokir\n\nOutput ini melampaui batas keamanan yang ditetapkan. AI tidak dapat:\n- Memberikan diagnosis final\n- Memberikan resep obat\n- Memberikan instruksi dosis\n- Mengubah atau menghentikan obat Anda\n- Mengklaim setara dengan dokter spesialis\n\nKonsultasikan dengan dokter untuk kebutuhan medis yang spesifik.",
  "disclaimer": "AI DAPAT MELAKUKAN KESALAHAN. TIDAK BOLEH MENGANDALKAN AI 100%. TIDAK BOLEH PERCAYA AI 100%. SEGALA KEPUTUSAN ANDA DARI HASIL AI INI, ADALAH 1000% TANGGUNG JAWAB ANDA.",
  "contextTrace": [],
  "dataSufficiencyScore": 0,
  "redFlagStatus": "none",
  "safetyDecision": "block_and_fallback",
  "safetyFlags": [
    { "flagCode": "medicationChangeDetector", "severity": "critical", "actionTaken": "block_and_fallback" }
  ]
}
```

---

# 4. WhatsApp Response Format (Short)

WhatsApp responses use a **truncated format** — max `whatsappAi.maxReplyChars` (default 400 chars):

## 4.1 Normal WA Response

```json
{
  "answerType": "safe_summary",
  "reply": "Berdasarkan data, tekanan darah 145/95 termasuk tinggi. Kemungkinan: stres, kurang olahraga. Tanya: ada sakit kepala? Buka app untuk detail.\n\n⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.",
  "disclaimer": "⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.",
  "contextTrace": [],
  "dataSufficiencyScore": 72,
  "redFlagStatus": "warning",
  "safetyDecision": "allow_with_disclaimer"
}
```

## 4.2 Emergency WA Response

```json
{
  "answerType": "emergency_guidance",
  "reply": "⚠️ PERINGATAN DARURAT\nNyeri dada + tekanan darah tinggi = tanda bahaya.\nJANGAN menunda. Segera hubungi:\n- Layanan Darurat: 119 / 112\n- Faskes terdekat\n\n⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.",
  "disclaimer": "⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.",
  "contextTrace": [],
  "dataSufficiencyScore": 85,
  "redFlagStatus": "emergency",
  "safetyDecision": "emergency_template_only"
}
```

## 4.3 WhatsApp Disclaimer (Abbreviated)

```text
ID: ⚕️ AI bisa salah. Keputusan = tanggung jawab Anda.
EN: ⚕️ AI can be wrong. Decisions = your responsibility.
```

The full §4.3 disclaimer is available in the web app. WhatsApp uses this abbreviated version due to character constraints.

---

# 5. Context Trace Schema

Each item in the `contextTrace` array:

```json
{
  "sourceType": "measurement | symptom | medication | safety_event | vector_memory | knowledge_base | hydration | cycle",
  "sourceTable": "HL_measurementValues | HL_symptomLogs | HL_medicationLogs | HL_safetyEvents | HL_vectorDocuments | HL_firstAidProtocols | HL_hydrationLogs | HL_cycleLogs",
  "metricCode": "optional — only for measurement type",
  "measuredAt": "ISO 8601 timestamp — only for time-based sources",
  "contentPreview": "safe text max 200 chars — no raw sensitive data"
}
```

### Constraints

```text
1. contentPreview MUST NOT contain raw sensitive data (full symptom detail, cycle detail, etc.)
2. contentPreview MUST be a safe summary (e.g., "Sistolik 145 mmHg (high)" not full measurement JSON)
3. sourceTable MUST be a real HL_* table name from D1 schema
4. Every data source used in the AI response MUST appear in contextTrace
5. If contextTrace is empty but answerType is medical → needs_human_review
```

---

# 6. Data Sufficiency Score Labels

| Score Range | Label (ID) | Label (EN) | UI Color |
|---|---|---|---|
| 0-30 | data sangat terbatas | very limited data | red |
| 31-60 | data terbatas | limited data | orange |
| 61-100 | data cukup | sufficient data | green |

---

# 7. Safety Decision Values in Response

| safetyDecision | Meaning | UI Treatment |
|---|---|---|
| `allow` | Output safe, no modification needed | Normal display |
| `allow_with_disclaimer` | Output safe, disclaimer injected | Normal display + disclaimer footer |
| `rewrite_safe` | Dangerous parts rewritten to safe | Normal display + "AI response modified for safety" badge |
| `block_and_fallback` | Full block, deterministic template returned | Blocked notice UI + disclaimer |
| `emergency_template_only` | Emergency, no LLM output | Emergency card (red/orange, dominant) |
| `needs_human_review` | Flagged for reviewer | Normal display + flagged in admin queue |

---

# 8. Storage Schema (D1)

## 8.1 HL_aiClinicalMessages Row

```sql
INSERT INTO HL_aiClinicalMessages
  (userId, sessionId, role, channel, contentPreview, contentEncrypted,
   answerType, safetyLevel, safetyFlagsJson, contextTraceJson, modelRunId, expiresAt, createdAt)
VALUES
  (?, ?, 'assistant', 'web', ?, ?,
   'safe_summary', 'allow_with_disclaimer', '[]', '[...]', 789,
   datetime('now', '+180 days'), datetime('now'));
```

| Field | Source |
|---|---|
| contentPreview | Safe truncated reply text (max 500 chars, no sensitive data) |
| contentEncrypted | Full reply text encrypted (AES-256 via CryptoService) |
| answerType | From response schema (mode-dependent: standard never returns diagnosis_final/prescription_guidance/dosage_instruction/specialist_claim) |
| safetyLevel | From safetyDecision (mapped: allow→safe, block_and_fallback→blocked; others match directly) |
| safetyFlagsJson | JSON array of triggered detector codes |
| contextTraceJson | JSON array of context trace items |
| modelRunId | FK to HL_modelRuns |
| expiresAt | createdAt + 180 days (retention policy) |

## 8.2 HL_modelRuns Row

```sql
INSERT INTO HL_modelRuns
  (userId, requestId, sessionId, channel, taskCode, providerCode, modelCode,
   promptVersion, usedVectorContext, usedAiSearch,
   inputTokenCount, outputTokenCount, latencyMs,
   status, fallbackUsed, safetyDecision, safetyFlagsJson, operatingMode, createdAt)
VALUES
  (?, ?, ?, 'web', 'clinical_copilot', '9router', 'deepseek-v4-flash-free',
   'v1.0.0', 1, 0,
   450, 320, 1850,
   'success', 0, 'allow_with_disclaimer', '[]', 'standard', datetime('now'));
```

## 8.3 Operating Mode in Model Runs

Every model run records the `clinicalCopilot.operatingMode` at the time of the call. This is stored in the dedicated `operatingMode` column on `HL_modelRuns` AND mirrored in `safetyFlagsJson` for audit convenience:

```json
{"operatingMode": "standard"}
```

This allows auditing which mode was active when a particular AI output was generated.

## 8.4 Mode-Specific Disclaimer

In `super_aktif` mode, an additional disclaimer is appended after the standard disclaimer:

```text
ID: "Mode Super Aktif: AI boleh memberi resep dan dosis. Tanggung jawab 1000% di Anda."
EN: "Super Active Mode: AI may provide prescriptions and dosages. 1000% your responsibility."
```

In `proactive` mode, additional disclaimer:

```text
ID: "Mode Proaktif: AI boleh memberi diagnosis final. Tanggung jawab 1000% di Anda."
EN: "Proactive Mode: AI may provide final diagnosis. 1000% your responsibility."
```
