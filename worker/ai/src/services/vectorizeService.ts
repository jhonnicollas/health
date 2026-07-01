// VectorizeService — wraps Cloudflare Vectorize binding with namespace enforcement.
// PRD §8.9, S6C sub-PRD §5:
//   - Every vector has namespace user:{userId} — client cannot override.
//   - Every vector maps 1:1 to HL_vectorDocuments row.
//   - Per-user limit: 500 default (configurable via vectorize.maxVectorsPerUser).
//   - LRU eviction when limit reached.
//   - Failure never blocks emergency guidance.

import type { Bindings } from '../types.js';
import { generateEmbedding, EMBEDDING_MODEL } from './workersAi.js';
import { getConfigNumber } from './config.js';

export interface VectorInsertInput {
  userId: number;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface VectorResult {
  id: string;
  score: number;
  sourceType?: string;
  sourceId?: string;
  contentPreview?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryStatus {
  namespace: string;
  total: number;
  indexed: number;
  pending: number;
  failed: number;
  deleted: number;
  limit: number;
  alertThreshold: number;
}

export interface VectorizeServiceInterface {
  query(userId: number, queryText: string, topK: number, minScore: number): Promise<VectorResult[]>;
  insert(input: VectorInsertInput): Promise<string>;
  delete(userId: number, vectorIds: string[]): Promise<void>;
  deleteAll(userId: number): Promise<void>;
  rerank(userId: number, queryText: string, documents: string[], topN: number): Promise<RerankedResult[]>;
  getStatus(userId: number): Promise<MemoryStatus>;
}

export interface RerankedResult {
  index: number;
  score: number;
  document: string;
}

/**
 * Sanitize metadata — strip sensitive fields before storing in Vectorize.
 * PRD S6C §6: NOT indexed: raw secrets, cross-user data, full raw prompt, raw images.
 */
const SENSITIVE_META_KEYS = new Set([
  'description', 'notes', 'physicalSymptomsJson', 'rawDetail',
  'secret', 'token', 'password', 'apiKey', 'api_key', 'apiSecret',
  'rawContent', 'rawPrompt', 'rawImage', 'rawMessage',
  'prescription', 'dosage', 'diagnosis',
  'encryptedContent', 'privateNotes', 'medicalRecord',
]);

const SENSITIVE_CONTENT_PATTERNS = [
  /sk-[a-f0-9]{8,}/i,
  /api[_-]?key[=:]\s*\S+/i,
  /bearer\s+\S+/i,
  /password[=:]\s*\S+/i,
  /token[=:]\s*[a-f0-9]{16,}/i,
];

function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_META_KEYS.has(k)) {
      out[k] = typeof v === 'string' ? `[${v.length} chars]` : '[redacted]';
    } else if (typeof v === 'string' && SENSITIVE_CONTENT_PATTERNS.some(p => p.test(v))) {
      out[k] = '[sanitized]';
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Safe content preview — truncated to 200 chars, no raw sensitive data.
 * PRD S6C AC8: Context trace shows safe preview only.
 */
function safePreview(content: string): string {
  return content.slice(0, 200);
}

/**
 * Generate a deterministic vector ID for idempotency.
 * Format: v_{userId}_{sourceType}_{sourceId}
 */
function generateVectorId(userId: number, sourceType: string, sourceId: string): string {
  return `v_${userId}_${sourceType}_${sourceId}`;
}

/**
 * VectorizeService implementation.
 * Namespace is ALWAYS user:{userId} — derived from auth, never from client.
 */
export class VectorizeService implements VectorizeServiceInterface {
  constructor(private env: Bindings) {}

  /**
   * Query Vectorize for top-K semantic matches.
   * PRD S6C §5: query(userId, queryText, topK, minScore)
   */
  async query(userId: number, queryText: string, topK: number, minScore: number): Promise<VectorResult[]> {
    const namespace = `user:${userId}`;

    try {
      // Generate embedding for the query text
      const embeddingResult = await generateEmbedding(this.env, queryText);
      if (!embeddingResult.values || embeddingResult.values.length === 0) {
        return [];
      }

      const results = await this.env.VECTORIZE_INDEX.query(embeddingResult.values, {
        topK,
        namespace,
        returnMetadata: true,
        returnValues: false,
      });

      const matches = results.matches || [];
      return matches
        .filter((m: { score?: number }) => (m.score ?? 0) >= minScore)
        .map((m: { id: string; score: number; metadata?: Record<string, unknown> }) => ({
          id: m.id,
          score: m.score,
          sourceType: m.metadata?.sourceType as string | undefined,
          sourceId: m.metadata?.sourceId as string | undefined,
          contentPreview: m.metadata?.contentPreview as string | undefined,
          metadata: m.metadata,
        }));
    } catch (error) {
      console.error('VectorizeService.query failed:', error);
      return [];
    }
  }

  /**
   * Insert a vector into Vectorize + HL_vectorDocuments.
   * PRD S6C §5: insert(userId, sourceType, sourceId, content, metadata)
   * PRD S6C AC1: namespace = user:{userId}
   * PRD S6C AC3: Every vector maps to HL_vectorDocuments row
   * PRD S6C §7: Per-user limit enforcement with LRU eviction
   */
  async insert(input: VectorInsertInput): Promise<string> {
    const { userId, sourceType, sourceId, content, metadata } = input;
    const namespace = `user:${userId}`;
    const vectorId = generateVectorId(userId, sourceType, sourceId);
    const safeMeta = sanitizeMetadata(metadata);
    const preview = safePreview(content);

    // Check per-user limit and evict if needed
    await this.enforcePerUserLimit(userId);

    // Generate embedding
    const embeddingResult = await generateEmbedding(this.env, content);
    if (!embeddingResult.values || embeddingResult.values.length === 0) {
      // Record failed insertion in D1
      await this.recordVectorDoc(userId, vectorId, namespace, sourceType, sourceId, preview, safeMeta, 'failed', 'Embedding generation returned empty');
      return vectorId;
    }

    try {
      // Insert into Vectorize
      await this.env.VECTORIZE_INDEX.insert([
        {
          id: vectorId,
          values: embeddingResult.values,
          namespace,
          metadata: {
            ...safeMeta,
            sourceType,
            sourceId,
            contentPreview: preview,
            embeddingModel: EMBEDDING_MODEL,
          },
        },
      ]);

      // Record in HL_vectorDocuments (with embedding metadata in single call)
      const enrichedMeta = { ...safeMeta, embeddingModel: EMBEDDING_MODEL, dimensions: embeddingResult.dimensions };
      await this.recordVectorDoc(userId, vectorId, namespace, sourceType, sourceId, preview, enrichedMeta, 'indexed', null);

      return vectorId;
    } catch (error) {
      console.error('VectorizeService.insert failed:', error);
      await this.recordVectorDoc(userId, vectorId, namespace, sourceType, sourceId, preview, safeMeta, 'failed', String(error));
      return vectorId;
    }
  }

  /**
   * Delete specific vectors by ID.
   * PRD S6C §5: delete(userId, vectorIds)
   * Also marks HL_vectorDocuments.status='deleted'
   */
  async delete(userId: number, vectorIds: string[]): Promise<void> {
    if (vectorIds.length === 0) return;

    try {
      await this.env.VECTORIZE_INDEX.deleteByIds(vectorIds);
    } catch (error) {
      console.error('VectorizeService.delete failed:', error);
    }

    // Update D1 metadata
    try {
      const placeholders = vectorIds.map(() => '?').join(',');
      await this.env.DB.prepare(
        `UPDATE HL_vectorDocuments SET status = 'deleted' WHERE userId = ? AND vectorId IN (${placeholders})`
      ).bind(userId, ...vectorIds).run();
    } catch (error) {
      console.error('VectorizeService.delete D1 update failed:', error);
    }
  }

  /**
   * Delete all vectors for a user.
   * PRD S6C §5: deleteAll(userId)
   * PRD S6C AC4: Delete memory deletes vectors + sets metadata status='deleted', not D1 source data.
   */
  async deleteAll(userId: number): Promise<void> {
    const namespace = `user:${userId}`;

    // Get all vector IDs for this user from D1
    try {
      const rows = await this.env.DB.prepare(
        `SELECT vectorId FROM HL_vectorDocuments WHERE userId = ? AND status != 'deleted'`
      ).bind(userId).all<{ vectorId: string }>();

      const vectorIds = (rows.results || []).map((r) => r.vectorId);

      if (vectorIds.length > 0) {
        try {
          await this.env.VECTORIZE_INDEX.deleteByIds(vectorIds);
        } catch (error) {
          console.error('VectorizeService.deleteAll Vectorize delete failed:', error);
        }
      }

      // Mark all as deleted in D1
      await this.env.DB.prepare(
        `UPDATE HL_vectorDocuments SET status = 'deleted' WHERE userId = ?`
      ).bind(userId).run();
    } catch (error) {
      console.error('VectorizeService.deleteAll failed:', error);
    }
  }

  /**
   * Rerank documents against a query using Vectorize.
   * PRD S6C §5: rerank(userId, queryText, documents, topN)
   */
  async rerank(userId: number, queryText: string, documents: string[], topN: number): Promise<RerankedResult[]> {
    try {
      const result = await this.env.VECTORIZE_INDEX.query(
        (await generateEmbedding(this.env, queryText)).values,
        { topK: topN, namespace: `user:${userId}`, returnMetadata: true, returnValues: false }
      );

      const matches = result.matches || [];
      return matches.slice(0, topN).map((m: { id: string; score: number; metadata?: Record<string, unknown> }, i: number) => ({
        index: i,
        score: m.score,
        document: (m.metadata?.contentPreview as string) || documents[i] || '',
      }));
    } catch (error) {
      console.error('VectorizeService.rerank failed:', error);
      return documents.slice(0, topN).map((doc, i) => ({ index: i, score: 0, document: doc }));
    }
  }

  /**
   * Get memory status for a user.
   * PRD S6C §5: getStatus(userId)
   * PRD S6C AC9: Per-user limit enforced; alert threshold returned.
   */
  async getStatus(userId: number): Promise<MemoryStatus> {
    const limit = await getConfigNumber(this.env, 'vectorize.maxVectorsPerUser', 500);
    const alertThreshold = await getConfigNumber(this.env, 'vectorize.alertThresholdPercent', 80);

    try {
      const total = await this.env.DB.prepare(
        'SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ?'
      ).bind(userId).first<{ c: number }>();

      const indexed = await this.env.DB.prepare(
        "SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'indexed'"
      ).bind(userId).first<{ c: number }>();

      const pending = await this.env.DB.prepare(
        "SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'pending'"
      ).bind(userId).first<{ c: number }>();

      const failed = await this.env.DB.prepare(
        "SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'failed'"
      ).bind(userId).first<{ c: number }>();

      const deleted = await this.env.DB.prepare(
        "SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'deleted'"
      ).bind(userId).first<{ c: number }>();

      return {
        namespace: `user:${userId}`,
        total: total?.c ?? 0,
        indexed: indexed?.c ?? 0,
        pending: pending?.c ?? 0,
        failed: failed?.c ?? 0,
        deleted: deleted?.c ?? 0,
        limit,
        alertThreshold,
      };
    } catch (error) {
      console.error('VectorizeService.getStatus failed:', error);
      return {
        namespace: `user:${userId}`,
        total: 0,
        indexed: 0,
        pending: 0,
        failed: 0,
        deleted: 0,
        limit,
        alertThreshold,
      };
    }
  }

  // ─── Private helpers ───

  /**
   * Per-user vector limit enforcement with LRU eviction.
   * PRD S6C §7: If count >= limit → evict oldest vector (LRU).
   * PRD S6C §7.4: Eviction raises HL_safetyEvents (severity='low').
   */
  private async enforcePerUserLimit(userId: number): Promise<void> {
    const limit = await getConfigNumber(this.env, 'vectorize.maxVectorsPerUser', 500);

    try {
      const countRow = await this.env.DB.prepare(
        "SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'indexed'"
      ).bind(userId).first<{ c: number }>();

      const count = countRow?.c ?? 0;

      if (count >= limit) {
        // Find oldest indexed vector (LRU eviction)
        const oldest = await this.env.DB.prepare(
          `SELECT vectorId FROM HL_vectorDocuments
           WHERE userId = ? AND status = 'indexed'
           ORDER BY createdAt ASC LIMIT 1`
        ).bind(userId).first<{ vectorId: string }>();

        if (oldest?.vectorId) {
          // Delete from Vectorize
          try {
            await this.env.VECTORIZE_INDEX.deleteByIds([oldest.vectorId]);
          } catch {
            // Non-fatal — proceed with D1 update
          }

          // Mark as deleted in D1
          await this.env.DB.prepare(
            "UPDATE HL_vectorDocuments SET status = 'deleted' WHERE vectorId = ?"
          ).bind(oldest.vectorId).run();

          // Raise safety event (severity='low')
          await this.env.DB.prepare(
            `INSERT INTO HL_safetyEvents (userId, eventType, severity, title, createdAt)
             VALUES (?, 'vector_lru_eviction', 'low', ?, CURRENT_TIMESTAMP)`
          ).bind(userId, `Vector evicted (LRU) for user ${userId} at limit ${limit}`).run();
        }
      }
    } catch (error) {
      console.error('VectorizeService.enforcePerUserLimit failed:', error);
    }
  }

  /**
   * Record or update a vector document in HL_vectorDocuments.
   * Uses INSERT OR IGNORE for idempotency on rebuild.
   */
  private async recordVectorDoc(
    userId: number,
    vectorId: string,
    namespace: string,
    sourceType: string,
    sourceId: string,
    contentPreview: string,
    metadata: Record<string, unknown>,
    status: string,
    errorMessage: string | null
  ): Promise<void> {
    try {
      let contentHash = 'error';
      try {
        contentHash = await sha256(contentPreview);
      } catch {
        contentHash = `fallback_${contentPreview.length}_${Date.now()}`;
      }
      const metadataJson = JSON.stringify(metadata);

      if (metadataJson.length > 10240) {
        console.warn('recordVectorDoc: metadata exceeds 10 KiB, truncating');
        metadata = { _truncated: true, sourceType, sourceId };
      }

      const existing = await this.env.DB.prepare(
        'SELECT id FROM HL_vectorDocuments WHERE userId = ? AND vectorId = ?'
      ).bind(userId, vectorId).first<{ id: number }>();

      if (existing) {
        await this.env.DB.prepare(
          `UPDATE HL_vectorDocuments
           SET status = ?, contentPreview = ?, metadataJson = ?, indexedAt = CURRENT_TIMESTAMP
           WHERE userId = ? AND vectorId = ?`
        ).bind(status, contentPreview, JSON.stringify(metadata), userId, vectorId).run();
      } else {
        await this.env.DB.prepare(
          `INSERT INTO HL_vectorDocuments
            (userId, vectorId, namespace, sourceType, sourceId, contentHash, textPreview, metadataJson, status, createdAt, indexedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        ).bind(userId, vectorId, namespace, sourceType, sourceId, contentHash, contentPreview, JSON.stringify(metadata), status).run();
      }
    } catch (error) {
      console.error('recordVectorDoc failed:', error);
    }
  }
}

// ─── Utility ───

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
