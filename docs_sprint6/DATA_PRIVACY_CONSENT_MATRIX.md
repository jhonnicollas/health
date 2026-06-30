# DATA_PRIVACY_CONSENT_MATRIX.md — iSehat / iSehat Sprint 6
## AI Clinical Copilot — Data Privacy & Consent Matrix

```text
Document Type      : Technical Specification
Version            : 1.0
Date               : 2026-06-30
Source of Truth    : docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md §0.2, §4, §7, §8.9, §15
Scope              : All Sprint 6 data flows (D1, Vectorize, AI Search, R2, KV, Durable Objects)
Core Principle     : Sensitive data access requires owner OR explicit family permission OR restricted admin permission + audit
```

---

# 1. Consent Types

| Consent Field | D1 Column | Purpose | Default | Gating |
|---|---|---|---|---|
| `aiConsent` | HL_userProfiles.aiConsent | User allows AI to process their health data | 0 (false) | ALL AI Clinical Copilot features |
| `dataShareConsent` | HL_userProfiles.dataShareConsent | User allows sharing sensitive data (cycle, symptoms, hydration) in AI context | 0 (false) | Cycle/hydration/symptom detail in context package + Vectorize |
| `emergencyConsent` | HL_userProfiles.emergencyConsent | User allows emergency contact notification | 0 (false) | Emergency contact notification during red flag |

## 1.1 Consent Check Enforcement Point

```text
All consent checks are SERVER-SIDE, never client-side.
Consent is checked at Worker #1 (isehat-api-worker) before proxying to Worker #2.
Consent is re-checked at Worker #2 before building context package.
No AI processing occurs without aiConsent=1.
```

---

# 2. Sensitive Data Categories

Per PRD §3, sensitive data includes:

| # | Category | Examples | Consent Required | Vectorize Indexed? | AI Search? |
|---|---|---|---|---|---|
| 1 | Symptom detail | "Nyeri dada hekat, menjalar ke lengan kiri" | aiConsent | Yes (summarized) | No |
| 2 | Red flag detail | "Stroke symptoms: one-sided weakness" | aiConsent | Yes (summarized) | No |
| 3 | Cycle / menstruation | "Last period: 2026-06-15, cycle day 14" | aiConsent + dataShareConsent | Yes (if consent) | No |
| 4 | Pregnancy status | "Pregnant, 12 weeks" | aiConsent + dataShareConsent | Yes (if consent) | No |
| 5 | Lactation status | "Currently breastfeeding" | aiConsent + dataShareConsent | Yes (if consent) | No |
| 6 | Menopause status | "Post-menopausal" | aiConsent + dataShareConsent | Yes (if consent) | No |
| 7 | AI memory content | Vectorize vector previews | aiConsent | N/A (is Vectorize) | No |
| 8 | Doctor report detail | "Doctor visit summary for hypertension" | aiConsent | Yes (summarized) | No |
| 9 | Caregiver access details | "Caregiver: Jane, relationship: daughter" | aiConsent + family permission | No | No |
| 10 | Support/admin sensitive access | Admin viewing user's clinical sessions | restricted admin permission + audit | No | No |

---

# 3. Consent × Feature Matrix

| Feature | aiConsent | dataShareConsent | emergencyConsent | Family Permission | Entitlement |
|---|---|---|---|---|---|
| AI Clinical Copilot Chat | ✅ Required | — | — | — | feature.aiClinicalCopilot.use |
| Symptom Interview | ✅ Required | — | — | — | feature.aiClinicalCopilot.use |
| Possible Explanations | ✅ Required | — | — | — | feature.aiClinicalCopilot.use |
| First Aid Guidance | ✅ Required | — | — | — | feature.aiClinicalCopilot.firstAid |
| Emergency Guidance | ✅ Required | — | — (for notification) | — | feature.aiClinicalCopilot.emergencyGuidance (unlimited) |
| Doctor Handoff | ✅ Required | — | — | — | feature.aiClinicalCopilot.doctorHandoff |
| Caregiver Summary | ✅ Required | — | — | ✅ Required | feature.aiClinicalCopilot.caregiverSummary |
| WhatsApp AI | ✅ Required | — | — | — | feature.aiClinicalCopilot.whatsapp |
| Vectorize Memory | ✅ Required | ✅ For cycle/hydration | — | — | feature.aiClinicalCopilot.vectorMemory |
| Context Package (full) | ✅ Required | ✅ For cycle/hydration/symptom detail | — | — | — |
| Admin AI Governance | — | — | — | — | admin.* permissions |
| Medical Reviewer Queue | — | — | — | — | admin.aiEvaluation.review |

Legend: ✅ Required = must be true; — = not required for this feature

---

# 4. Data Flow Privacy Map

## 4.1 D1 (Source of Truth — Sensitive)

| Table | Contains Sensitive Data? | Access Control |
|---|---|---|
| HL_aiClinicalSessions | Yes (session type, red flag status) | Owner only (userId check) |
| HL_aiClinicalMessages | Yes (encrypted chat content) | Owner only; contentEncrypted at rest |
| HL_aiClinicalIntakeAnswers | Yes (symptom interview answers) | Owner only |
| HL_modelRuns | Metadata only (no medical content) | Owner + admin (admin.aiModelRun.read) |
| HL_aiOutputSafetyFlags | Yes (detected text preview) | Owner + admin (admin.aiSafety.read) |
| HL_promptVersions | No (prompt templates) | Admin (admin.aiConfig.read) |
| HL_whatsappLinks | Yes (encrypted WA number) | Owner only |
| HL_whatsappMessages | Yes (encrypted message content) | Owner only; contentEncrypted at rest |
| HL_firstAidProtocols | No (curated P3K content) | Public (all users) |
| HL_aiKnowledgeDocuments | No (KB content) | Public (all users); admin manage |

## 4.2 Vectorize (Semantic Memory — Metadata Only)

| Data | Stored? | Sensitive? |
|---|---|---|
| Vector embeddings (768-dim) | Yes | No (mathematical representation) |
| Metadata: sourceType, sourceId | Yes | No (references, not content) |
| Metadata: contentPreview | Yes | Low (safe text max 200 chars, no raw sensitive data) |
| Raw health data | NO | N/A — only summarized content indexed |
| Secrets/tokens | NO | N/A — never indexed |
| Cross-user data | NO | N/A — namespace isolation |

## 4.3 AI Search (Knowledge Base — No Personal Data)

| Data | Stored? | Sensitive? |
|---|---|---|
| Education articles | Yes | No (public content) |
| First-aid protocols | Yes | No (curated content) |
| FAQ/support docs | Yes | No |
| Personal health data | NO | N/A — personal data never enters AI Search |

## 4.4 KV Cache (Non-Sensitive)

| Cache Key | Content | Sensitive? |
|---|---|---|
| prompt:{taskCode}:active | Prompt contentHash | No |
| routing:policy | Model routing JSON | No |
| config:{key} | System config value | No (masked secrets) |
| education:{locale}:{slug} | Education article | No |
| search:{hash} | AI Search result | No (public KB content) |
| disclaimer:{locale} | Disclaimer template | No |

**NOT allowed in KV:** measurement source of truth, emergency status, consent state, subscription/quota final state, medical chat records, sensitive health details.

## 4.5 R2 (Private Files — Permission-Gated)

| Data | Sensitive? | Access |
|---|---|---|
| Evidence images (watermarked) | Yes | Owner only via Worker permission check |
| Doctor handoff reports | Yes | Owner only; share token expirable |
| Export CSV/ZIP | Yes | Owner only |
| WhatsApp media | Yes | Owner only; validated before storage |
| Evaluation dataset | Yes (test cases) | Admin only (admin.aiEvaluation.read) |
| Archived model runs | Metadata only | Admin (admin.aiModelRun.read) |
| Archived safety flags | Metadata only | Admin (admin.aiSafety.read) |

**No public raw R2 URL.** All access through Worker permission check.

## 4.6 Durable Objects (Temporary Session State)

| DO Class | Sensitive Data? | TTL | Persistence |
|---|---|---|---|
| AiChatSessionDO | Yes (chat buffer) | 30 min idle alarm | Final state persisted to D1; DO state deleted |
| WhatsAppSessionDO | Yes (message ordering) | 30 min idle alarm | Messages persisted to D1; DO state deleted |
| UserAiLockDO | No (lock state only) | 5 min | No persistence needed |
| ModelStreamingDO | Yes (stream buffer) | Stream completion | Buffer not persisted |
| JobProgressDO | No (progress tracking) | Job completion | Not persisted |

**DO cannot become only source of medical truth.** All final state persisted to D1.

---

# 5. Consent-Aware Context Package Filter

## 5.1 Filter Logic (Worker #2 — ClinicalContextPackageBuilder)

```text
INPUT: contextPackage (raw), consents { aiConsent, dataShareConsent, emergencyConsent }

1. If aiConsent = 0:
   → REJECT entire request (should never reach here — blocked at #1)
   
2. If dataShareConsent = 0:
   → Set hydrationSummary = null
   → Set cycleSummary = null
   → Remove pregnancy/lactation/menopause from userProfile
   → Remove detailed symptom descriptions (keep only symptom codes + severity)
   → Remove sensitive family data from context

3. If dataShareConsent = 1:
   → Include hydrationSummary (avg, target, over-limit days)
   → Include cycleSummary (phase, last period, irregularity)
   → Include pregnancy/lactation/menopause if in profile
   → Include symptom detail

4. emergencyConsent:
   → Only used for emergency contact notification, not for AI context
   → If emergencyConsent = 0: emergency contacts not notified (but guidance still shown)
```

## 5.2 Context Package Fields by Consent

| Field | aiConsent Only | + dataShareConsent |
|---|---|---|
| userProfile (age, sex, height, weight) | ✅ | ✅ |
| userProfile (pregnancy, lactation, menopause) | ❌ | ✅ |
| latestMeasurements | ✅ | ✅ |
| trendSummary | ✅ | ✅ |
| symptomSummary (codes + severity) | ✅ | ✅ |
| symptomSummary (detailed descriptions) | ❌ | ✅ |
| safetyEvents | ✅ | ✅ |
| medicationSummary | ✅ | ✅ |
| hydrationSummary | ❌ | ✅ |
| cycleSummary | ❌ | ✅ |
| vectorMemory | ✅ (non-sensitive sources) | ✅ (all sources) |
| knowledgeBase | ✅ | ✅ |
| consents | ✅ | ✅ |
| forbiddenActions | ✅ | ✅ |
| contextTrace | ✅ (non-sensitive sources) | ✅ (all sources) |

---

# 6. Family Permission Matrix

## 6.1 Caregiver Access Levels

| Permission | Caregiver Can See | Requires |
|---|---|---|
| `family.measurements.read` | Latest measurements, trends | Family link + permission granted |
| `family.medication.read` | Medication list, adherence | Family link + permission granted |
| `family.symptoms.read` | Symptom codes + severity (not detail) | Family link + permission granted |
| `family.safety.read` | Safety events (high level) | Family link + permission granted |
| `family.alerts.notify` | Receive alert notifications | Family link + emergencyConsent |
| `family.cycle.read` | Cycle data | Family link + dataShareConsent + explicit permission |
| `family.sensitive.read` | Detailed symptoms, cycle, pregnancy | Family link + dataShareConsent + EXPLICIT per-category permission |

## 6.2 Caregiver Summary Generation

```text
Before generating caregiver summary:
1. Verify family link exists and is active
2. Verify family permission for each data category
3. For each data category in summary:
   - If permission granted → include
   - If permission NOT granted → exclude (set to null/empty)
4. Sensitive data (cycle, pregnancy, detailed symptoms):
   - Requires dataShareConsent = 1 AND explicit family.sensitive.read permission
   - If either is missing → exclude
5. Summary includes: "Ringkasan ini dibuat dengan izin pengguna."
6. Log to HL_auditLogs: action='caregiverSummaryGenerated'
```

---

# 7. Data Retention & Deletion

## 7.1 Retention Policy (per PRD §15)

| Data | Retention | Cleanup | Consent Withdrawal |
|---|---|---|---|
| HL_aiClinicalSessions | 365 days | Cron: status='expired' | User can close session anytime |
| HL_aiClinicalMessages | 180 days (contentEncrypted: 90 days) | Cron: hard delete > 180d; nullify encrypted > 90d | User can delete session → cascade |
| HL_aiClinicalIntakeAnswers | 180 days | Cron: delete > 180d | User can delete session → cascade |
| HL_modelRuns | 365 days | Cron: archive to R2, delete from D1 | Retained for audit |
| HL_aiOutputSafetyFlags | 730 days (2 years) | Cron: archive to R2, delete from D1 | Retained for audit/compliance |
| HL_whatsappMessages | 180 days (contentEncrypted: 90 days) | Cron: hard delete > 180d; nullify encrypted > 90d | User can unlink WA |
| Vectorize vectors | Until user deletes or 365 days inactive | Cron: delete for inactive > 365d | User: DELETE /api/ai/memory |

## 7.2 User-Triggered Deletion

| Action | Effect |
|---|---|
| `DELETE /api/ai/memory` | Delete all Vectorize vectors + HL_vectorDocuments.status='deleted'; D1 source untouched |
| `POST /api/account/delete` | Cascade delete ALL Sprint 6 clinical data (messages, sessions, intake, model runs, WA messages, WA links, vectors) |
| `DELETE /api/whatsapp/link` | Remove WA link; subsequent WA messages → unlinked flow |
| `POST /api/ai/clinical/sessions/:id/close` | Close session; no new messages accepted |

## 7.3 Consent Withdrawal

```text
If user sets aiConsent = 0:
1. No new AI Clinical Copilot requests accepted (403 CONSENT_REQUIRED)
2. Existing sessions remain accessible (read-only) until natural expiration
3. Existing Vectorize vectors remain (user must explicitly DELETE /api/ai/memory)
4. Existing model run logs remain (audit trail)
5. Retention cron still runs on existing data

If user sets dataShareConsent = 0:
1. New AI requests: context package excludes hydration/cycle/sensitive data
2. Existing vectors with sensitive sources remain until rebuild or explicit delete
3. User should be prompted to rebuild memory after consent change
```

---

# 8. Admin Access Privacy

## 8.1 Admin Permission Hierarchy

| Permission | Access | Audit Required? |
|---|---|---|
| admin.aiModelRun.read | Model run metadata (no medical content) | Yes |
| admin.aiSafety.read | Safety flags (detectedTextPreview — truncated, no raw sensitive) | Yes |
| admin.aiConfig.read | System configs (masked secrets) | Yes |
| admin.aiConfig.update | Update configs, activate prompts | Yes |
| admin.aiEvaluation.read | Evaluation results | Yes |
| admin.aiEvaluation.review | Review and approve/reject AI outputs | Yes |
| admin.whatsapp.read | WA session metadata (no message content) | Yes |
| admin.education.manage | KB content management | Yes |

## 8.2 Admin Cannot Access

```text
1. Raw clinical message content (contentEncrypted) — admin has no decryption key
2. Raw WhatsApp message content (contentEncrypted) — admin has no decryption key
3. User's Vectorize vectors — admin can see counts, not content
4. User's consent state — admin can see boolean, not change without audit
5. User's personal health measurements via AI governance — use existing admin measurement routes
6. Actual secrets/API keys — ConfigService returns 'configured' or envVarName, never value
```

## 8.3 Audit Logging

All admin access to AI governance data writes to HL_auditLogs:

```sql
INSERT INTO HL_auditLogs
  (userId, action, entityType, entityId, metadataJson, createdAt)
VALUES
  (?, 'adminAiModelRunRead', 'ai_model_run', ?, ?, datetime('now'));
```

---

# 9. Encryption Specification

## 9.1 At-Rest Encryption

| Data | Encryption | Key Management |
|---|---|---|
| HL_aiClinicalMessages.contentEncrypted | AES-256-GCM | CryptoService (PBKDF2-derived key from env) |
| HL_whatsappMessages.contentEncrypted | AES-256-GCM | CryptoService (PBKDF2-derived key from env) |
| HL_whatsappLinks.whatsappNumberEncrypted | AES-256-GCM | CryptoService |

## 9.2 Hashing (for lookup, not encryption)

| Data | Hash | Purpose |
|---|---|---|
| HL_whatsappLinks.whatsappNumberHash | SHA-256 | Match inbound WA number to linked user without decrypting |

## 9.3 In-Transit

```text
All Worker-to-Worker communication via Service Bindings is encrypted (Cloudflare internal).
All VPS-to-Worker communication via Cloudflare Tunnel is encrypted (HTTPS).
All Worker-to-LLM communication via AI Gateway is encrypted (HTTPS).
No plaintext sensitive data in any log, D1 metadata, KV, or API response.
```

---

# 10. Privacy Checklist

```text
[ ] aiConsent checked server-side before ALL AI processing
[ ] dataShareConsent gates hydration/cycle/sensitive data in context package
[ ] Sensitive data categories (10 types) all have consent enforcement
[ ] Vectorize stores only summarized content, never raw sensitive data
[ ] AI Search contains no personal health data
[ ] KV contains no sensitive health details
[ ] R2 objects private, access via Worker permission only
[ ] Durable Objects persist final state to D1, delete transient state
[ ] contentEncrypted uses AES-256-GCM for chat and WA messages
[ ] whatsappNumber stored encrypted + hashed (never plaintext in D1)
[ ] No secret/API key in D1 (only 'configured' marker or envVarName)
[ ] Admin access audited to HL_auditLogs
[ ] Admin cannot decrypt contentEncrypted (no key access)
[ ] User can delete AI memory (DELETE /api/ai/memory)
[ ] User can delete account (cascade delete all Sprint 6 data)
[ ] Data retention crons run on schedule (6 jobs)
[ ] Consent withdrawal blocks new AI processing
[ ] Family/caregiver access requires explicit per-category permission
[ ] All consent checks at Worker #1 AND Worker #2 (defense in depth)
[ ] No plaintext sensitive data in any log
```
