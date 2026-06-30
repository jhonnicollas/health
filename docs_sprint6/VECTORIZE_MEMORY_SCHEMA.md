# VECTORIZE_MEMORY_SCHEMA.md — iSehat / iSehat Sprint 6
## Vectorize Runtime Memory — Schema & Index Specification

```text
Document Type      : Technical Specification
Version            : 1.0
Date               : 2026-06-30
Source of Truth    : docs_sprint6/01.PRD_S6_AI_CLINICAL_COPILOT.md §8.9, §7 (Component Matrix)
Worker             : #2 (isehat-ai-worker) — query/insert/delete; #3 (isehat-jobs-worker) — batch index
Phase              : S6C (implementation), S6D (integration into context package)
Binding            : VECTORIZE_INDEX (Cloudflare Vectorize Free Tier)
Index Name         : hl-health-memory
```

---

# 1. Vectorize Index Configuration

## 1.1 Wrangler Binding (Worker #2)

```toml
[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "hl-health-memory"
```

## 1.2 Free Tier Limits

| Limit | Value | Mitigation |
|---|---|---|
| Max vectors per index | 10,000,000 | Per-user cap: 500 vectors (configurable) |
| Max dimensions | 1,536 | Using 768-dim (bge-base-en-v1.5) |
| Max metadata per vector | 10 KiB | Only summarized content in metadata |
| Free namespaces per index | 1,000 | One namespace per user: user:{userId} |
| Free indexes per account | 100 | Single index for all users |
| Alert threshold | 80% (8M vectors) | Admin alert via HL_auditLogs |

## 1.3 Embedding Model

```text
Model         : @cf/baai/bge-base-en-v1.5
Dimensions    : 768
Provider      : Workers AI (free tier)
Version Fixed : Yes — changing model requires full reindex
```

Note: Sprint 5 seed and existing code use `@cf/baai/bge-base-en-v1.5` (768-dim). Sprint 6 continues with this model to maintain compatibility.

---

# 2. Namespace Strategy

## 2.1 Namespace Format

```text
user:{userId}
```

Example:
```text
user:42       → User ID 42's personal health memory
user:108      → User ID 108's personal health memory
```

## 2.2 Namespace Enforcement

```text
1. Namespace is ALWAYS derived from the authenticated userId.
2. Client NEVER provides namespace — server sets it from auth context.
3. Query: VectorizeService.query(userId, ...) → internally uses namespace user:{userId}
4. Insert: VectorizeService.insert(userId, ...) → internally uses namespace user:{userId}
5. Delete: VectorizeService.delete(userId, ...) → internally uses namespace user:{userId}
6. Cross-user access is architecturally impossible — userId comes from auth, not user input.
```

---

# 3. Vector Document Structure

## 3.1 Vectorize API Insert Format

```typescript
interface VectorInsert {
  id: string;              // UUID v4, also stored in HL_vectorDocuments.vectorId
  values: number[];        // 768-dim embedding from bge-base-en-v1.5
  metadata: VectorMetadata; // Max 10 KiB
  namespace: string;       // user:{userId} — set by server, never by client
}

interface VectorMetadata {
  userId: number;           // For audit/cross-reference
  sourceType: SourceType;   // What kind of health data
  sourceId: string;         // ID in source table (e.g., symptom log ID)
  contentPreview: string;   // Safe text summary (max 200 chars, no raw sensitive data)
  indexedAt: string;        // ISO timestamp
  embeddingModel: string;   // @cf/baai/bge-base-en-v1.5
  contentHash: string;      // sha256 of source content (for dedup detection)
}
```

## 3.2 Source Types (8 indexed types)

| sourceType | Source Table | What Gets Indexed | Consent Gate |
|---|---|---|---|
| `symptom_log` | HL_symptomLogs | Symptom narrative summary (not raw detail) | aiConsent |
| `abnormal_measurement` | HL_measurementValues | Abnormal measurement session summary | aiConsent |
| `safety_event` | HL_safetyEvents | Safety event summary | aiConsent |
| `doctor_report` | HL_doctorReports (R2 metadata) | Doctor report summary | aiConsent |
| `ai_clinical_session` | HL_aiClinicalSessions | AI clinical session summary | aiConsent |

Note: In proactive and super_aktif modes, AI clinical session summaries may include diagnosis final and prescription/dosage content. These are still indexed as summarized content only. The operating mode under which the session was run is recorded in the session row for audit.
| `medication_adherence` | HL_medicationLogs | Medication adherence summary (7/30 day) | aiConsent |
| `hydration_cycle` | HL_hydrationLogs / HL_cycleLogs | Hydration/cycle summary | aiConsent + dataShareConsent |
| `whatsapp_clinical` | HL_whatsappMessages | WhatsApp clinical chat summary | aiConsent |

## 3.3 NOT Indexed (5 prohibited types)

| Prohibited | Reason |
|---|---|
| Raw secret/token | Security — no credentials in Vectorize |
| Cross-user data | Privacy — only user's own data |
| Full raw prompt | Privacy — prompts may contain sensitive context |
| Full raw image | Size + privacy — images stored in R2 only |
| Sensitive family data without permission | Privacy — family data gated by explicit permission |

---

# 4. HL_vectorDocuments Mapping (D1)

Every Vectorize vector maps 1:1 to a row in `HL_vectorDocuments` (existing Sprint 5C table):

```sql
-- Existing table from Sprint 5C (upgraded in Sprint 6C)
CREATE TABLE IF NOT EXISTS HL_vectorDocuments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  vectorId TEXT NOT NULL,          -- UUID v4, matches Vectorize vector id
  sourceType TEXT NOT NULL,        -- 8 types from §3.2
  sourceId TEXT NOT NULL,          -- ID in source table
  contentPreview TEXT,             -- Safe text (max 200 chars)
  contentHash TEXT,                -- sha256 for dedup
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','indexed','failed','deleted','skipped')),
  embeddingModel TEXT,             -- @cf/baai/bge-base-en-v1.5
  indexTimestamp TEXT,             -- When vector was inserted
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT,
  FOREIGN KEY (userId) REFERENCES HL_users(id)
);

CREATE INDEX IF NOT EXISTS idx_vectorDocs_userId ON HL_vectorDocuments(userId);
CREATE INDEX IF NOT EXISTS idx_vectorDocs_sourceType ON HL_vectorDocuments(sourceType);
CREATE INDEX IF NOT EXISTS idx_vectorDocs_status ON HL_vectorDocuments(status);
CREATE INDEX IF NOT EXISTS idx_vectorDocs_contentHash ON HL_vectorDocuments(contentHash);
```

## 4.1 Status Lifecycle

```text
pending → indexed   (successful insert into Vectorize)
pending → failed     (embedding or insert failed)
pending → skipped    (content too short or duplicate contentHash)
indexed → deleted    (user deleted memory or LRU eviction)
```

---

# 5. VectorizeService API

## 5.1 Interface

```typescript
interface VectorizeService {
  // Query user's personal memory
  query(userId: number, queryText: string, topK: number, minScore: number): Promise<VectorResult[]>;

  // Insert a single vector
  insert(userId: number, sourceType: SourceType, sourceId: string, content: string, metadata: Partial<VectorMetadata>): Promise<string>;

  // Delete specific vectors
  delete(userId: number, vectorIds: string[]): Promise<void>;

  // Delete all user vectors
  deleteAll(userId: number): Promise<void>;

  // Rerank documents by relevance
  rerank(userId: number, queryText: string, documents: string[], topN: number): Promise<RerankedResult[]>;

  // Get memory status
  getStatus(userId: number): Promise<MemoryStatus>;
}

interface VectorResult {
  vectorId: string;
  score: number;
  metadata: VectorMetadata;
}

interface MemoryStatus {
  userId: number;
  indexedCount: number;
  pendingCount: number;
  deletedCount: number;
  limit: number;              // maxVectorsPerUser (default 500)
  remainingSlots: number;
  alertThreshold: number;     // 80% of 10M total
}
```

## 5.2 Query Flow

```text
1. Generate embedding for queryText using @cf/baai/bge-base-en-v1.5
2. Call VECTORIZE_INDEX.query(vectors=[embedding], topK=topK, namespace=`user:${userId}`, returnMetadata=true)
3. Filter results by minScore
4. For each result: look up HL_vectorDocuments to get full metadata
5. Return VectorResult[] with score + safe contentPreview
6. Log query to HL_modelRuns (usedVectorContext=1)
```

## 5.3 Insert Flow

```text
1. Check per-user limit: count HL_vectorDocuments WHERE userId=? AND status='indexed'
2. If count >= limit (500):
   a. Find oldest indexed vector (ORDER BY indexTimestamp ASC LIMIT 1)
   b. Delete from Vectorize: VECTORIZE_INDEX.deleteByIds([vectorId])
   c. Update HL_vectorDocuments: status='deleted'
   d. Insert HL_safetyEvents: severity='low', sourceType='vector_eviction'
3. Generate embedding for content using @cf/baai/bge-base-en-v1.5
4. Generate vectorId (UUID v4)
5. Insert into Vectorize: VECTORIZE_INDEX.insert([{ id, values, metadata, namespace }])
6. Insert into HL_vectorDocuments: (userId, vectorId, sourceType, sourceId, contentPreview, contentHash, status='indexed', embeddingModel, indexTimestamp)
7. Return vectorId
```

## 5.4 Delete Flow

```text
1. delete(userId, vectorIds):
   a. VECTORIZE_INDEX.deleteByIds(vectorIds) with namespace=user:{userId}
   b. UPDATE HL_vectorDocuments SET status='deleted', updatedAt=now WHERE vectorId IN (?) AND userId=?
   c. D1 source data is NOT touched — only vectors are deleted

2. deleteAll(userId):
   a. Query all vectorIds for user: SELECT vectorId FROM HL_vectorDocuments WHERE userId=? AND status='indexed'
   b. VECTORIZE_INDEX.deleteByIds(allVectorIds) with namespace=user:{userId}
   c. UPDATE HL_vectorDocuments SET status='deleted', updatedAt=now WHERE userId=? AND status='indexed'
   d. D1 source data is NOT touched
```

## 5.5 Rebuild Flow

```text
1. Delete all existing vectors for user (deleteAll)
2. For each source type (8 types):
   a. Fetch all source rows from D1 for this user
   b. For each row: summarize content → generate embedding → insert vector
   c. Insert HL_vectorDocuments row
3. Rebuild is IDEMPOTENT:
   a. Running rebuild twice produces same vector count
   b. contentHash dedup: if same contentHash already indexed → skip (status='skipped')
   c. No duplicate vectors created
4. Rebuild rate limit: 2 per user per day (vectorize.maxRebuildsPerDay)
```

---

# 6. AiMemoryDocumentBuilder

## 6.1 Purpose

Summarize raw source data into safe, compact vector documents. Only summarized content is indexed — never raw data.

## 6.2 Summarization Rules per Source Type

| sourceType | Summarization Method | Example |
|---|---|---|
| symptom_log | Extract: symptom code, severity, duration, date → "Sakit kepala sedang, 3 hari, 2026-06-28" | Safe narrative |
| abnormal_measurement | Extract: metric, value, status, date → "Tekanan darah 145/95 mmHg (tinggi), 2026-07-01" | Value + status |
| safety_event | Extract: sourceType, severity, summary, date → "Event overhydration warning, 2026-06-15" | Event type + date |
| doctor_report | Extract: period, chief concern → "Doctor visit 30-day, concern: hipertensi, 2026-05-01" | Visit summary |
| ai_clinical_session | Extract: sessionType, topic, date → "AI session symptom_interview, topic: pusing, 2026-06-28" | Session topic |
| medication_adherence | Extract: medication, adherence%, period → "Amlodipine 5mg adherence 86% (7-day), 2026-07-01" | Adherence stat |
| hydration_cycle | Extract: avg hydration, cycle phase, period → "Avg air 2000ml/hari, cycle: follicular, 2026-06" | Aggregate only |
| whatsapp_clinical | Extract: topic, date → "WA chat: tekanan darah tinggi, 2026-07-01" | Topic only |

## 6.3 Content Constraints

```text
1. Max content length for embedding: 500 chars (truncated if longer)
2. contentPreview in metadata: max 200 chars (safe text)
3. No raw sensitive data in content or preview
4. No full names, no full phone numbers, no raw diagnosis
5. English-optimized for embedding model (bge-base-en is English-focused)
6. For Indonesian content: translate key terms to English for better embedding quality
```

---

# 7. Context Trace Integration

When Vectorize results are used in the Clinical Context Package (S6D), they appear in:

### 7.1 contextTrace array

```json
{
  "sourceType": "vector_memory",
  "sourceTable": "HL_vectorDocuments",
  "contentPreview": "Doctor visit 30-day, concern: hipertensi, 2026-05-01",
  "measuredAt": "2026-05-01T00:00:00Z"
}
```

### 7.2 vectorMemory array in context package

```json
{
  "sourceType": "doctor_report",
  "contentPreview": "Doctor visit 30-day, concern: hipertensi",
  "score": 0.82
}
```

### 7.3 Safety Constraint

```text
Vectorize is explicitly labeled as "semantic memory, not clinical proof".
The vectorizeAsTruthDetector (Safety Runtime) prevents AI from treating
Vectorize results as definitive clinical evidence.
Context trace shows "vector_memory" as sourceType so the user knows
this is semantic recall, not a clinical finding.
```

---

# 8. Free Tier Monitoring

## 8.1 Per-User Limit Enforcement

```text
Default limit: 500 vectors per user (configurable via vectorize.maxVectorsPerUser)
On insert:
  1. Count: SELECT COUNT(*) FROM HL_vectorDocuments WHERE userId=? AND status='indexed'
  2. If count >= 500 → LRU eviction (delete oldest, insert newest)
  3. Eviction logged to HL_safetyEvents (severity='low', sourceType='vector_eviction')
```

## 8.2 Total Index Monitor

```text
1. Admin endpoint: GET /api/admin/ai/vectorize/health
2. Returns: totalVectors, capacityPercent, userCount, avgVectorsPerUser, usersAtLimit
3. Alert when totalVectors >= 8,000,000 (80% of 10M)
4. Alert written to HL_auditLogs + admin notification
5. Upgrade path: paid Vectorize tier when limit reached
```

## 8.3 Inactive User Cleanup

```text
Cron (weekly 04:30 UTC, Worker #3):
1. Find users inactive > 365 days (lastLoginAt < now - 365d)
2. Delete their vectors: VECTORIZE_INDEX.deleteByIds with namespace=user:{userId}
3. Update HL_vectorDocuments: status='deleted'
4. Log to HL_auditLogs: action='vectorCleanupInactive'
```

---

# 9. Failure Handling

```text
1. Vectorize API unavailable:
   - Query returns empty array (no crash)
   - Insert returns error, HL_vectorDocuments.status='failed'
   - Emergency guidance NOT affected (Vectorize failure never blocks emergency)
   - Context package returns partial (vectorMemory=[])

2. Embedding service unavailable:
   - Insert: status='failed', retry on next rebuild
   - Query: use cached embeddings if available, else return empty

3. D1 unavailable:
   - Vectorize operations cannot proceed (metadata tracking required)
   - Return error to caller

4. Per-user limit exceeded:
   - LRU eviction handles automatically
   - No error to user — eviction is transparent
```

---

# 10. Security Checklist

```text
[ ] Namespace always derived from auth userId, never from client input
[ ] contentPreview contains no raw sensitive data (max 200 chars)
[ ] No secrets/tokens indexed in any vector
[ ] No cross-user data in any vector
[ ] No full raw prompts indexed
[ ] No full raw images indexed
[ ] Sensitive family data gated by explicit permission
[ ] Per-user vector limit enforced (500 default)
[ ] Total index monitored with 80% alert
[ ] Vectorize failure does not block emergency guidance
[ ] Delete operation does not touch D1 source data
[ ] Rebuild is idempotent (contentHash dedup)
[ ] Embedding model version recorded in HL_vectorDocuments
```
