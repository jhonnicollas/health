// Memory operations — orchestrates index-source, rebuild, and delete operations.
// PRD S6C §5: Memory index-source, rebuild, delete operations.
// PRD S6C AC5: Rebuild is idempotent (rerun = same result, no duplicate vectors).
// PRD S6C AC4: Delete memory deletes vectors + sets metadata status='deleted', not D1 source data.
// PRD S6C AC7: Vectorize failure never blocks emergency guidance.

import type { Bindings } from '../types.js';
import { VectorizeService } from './vectorizeService.js';
import { buildMemoryDocuments, type SourceData, type MemoryDocument } from './memoryDocumentBuilder.js';
import { getConfigNumber, getConfigBoolean } from './config.js';

export interface IndexSourceInput {
  userId: number;
  sourceType: string;
  sourceId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface RebuildResult {
  jobId: number;
  userId: number;
  totalProcessed: number;
  totalIndexed: number;
  totalFailed: number;
  durationMs: number;
}

export interface DeleteResult {
  jobId: number;
  userId: number;
  vectorsDeleted: number;
  durationMs: number;
}

/**
 * Index a single source into Vectorize + HL_vectorDocuments.
 * PRD S6C-T-05: single row → vector
 */
export async function indexSource(env: Bindings, input: IndexSourceInput): Promise<string> {
  const service = new VectorizeService(env);
  return service.insert({
    userId: input.userId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    content: input.content,
    metadata: input.metadata,
  });
}

/**
 * Rebuild all vectors for a user — idempotent.
 * PRD S6C-T-06: full user → reindex all sources.
 * PRD S6C AC5: Rebuild is idempotent (rerun = same result, no duplicate vectors).
 *
 * Strategy: upsert-based (not delete-then-insert).
 * 1. Fetch all source data from D1
 * 2. Build memory documents from source data
 * 3. For each document: insert with deterministic vectorId (upsert)
 *    - If vectorId already exists and status='indexed', skip (idempotent)
 *    - If vectorId exists but status='deleted', re-insert
 *    - If vectorId doesn't exist, insert new
 * 4. Mark any previously-indexed vectors whose source no longer exists as 'deleted'
 * 5. Record job in HL_aiMemoryJobs
 *
 * Idempotency: vectorId = v_{userId}_{sourceType}_{sourceId} is deterministic.
 * RecordVectorDoc uses INSERT or UPDATE — no duplicates.
 */
export async function rebuildMemory(
  env: Bindings,
  userId: number,
  sources: SourceData[]
): Promise<RebuildResult> {
  const startTime = Date.now();
  const service = new VectorizeService(env);

  const documents = buildMemoryDocuments(sources);

  let totalIndexed = 0;
  let totalFailed = 0;
  const processedVectorIds = new Set<string>();

  for (const doc of documents) {
    try {
      await service.insert({
        userId,
        sourceType: doc.sourceType,
        sourceId: doc.sourceId,
        content: doc.content,
        metadata: doc.metadata,
      });
      const vectorId = `v_${userId}_${doc.sourceType}_${doc.sourceId}`;
      processedVectorIds.add(vectorId);
      totalIndexed++;
    } catch (error) {
      console.error(`rebuildMemory: insert failed for ${doc.sourceType}:${doc.sourceId}`, error);
      totalFailed++;
    }
  }

  // Mark stale vectors (indexed but source no longer exists) as deleted
  try {
    const staleRows = await env.DB.prepare(
      `SELECT vectorId FROM HL_vectorDocuments
       WHERE userId = ? AND status = 'indexed'`
    ).bind(userId).all<{ vectorId: string }>();

    for (const row of staleRows.results || []) {
      if (!processedVectorIds.has(row.vectorId)) {
        try {
          await env.VECTORIZE_INDEX.deleteByIds([row.vectorId]);
        } catch { /* non-fatal */ }
        await env.DB.prepare(
          "UPDATE HL_vectorDocuments SET status = 'deleted' WHERE vectorId = ?"
        ).bind(row.vectorId).run();
      }
    }
  } catch (error) {
    console.error('rebuildMemory: stale cleanup failed', error);
  }

  const durationMs = Date.now() - startTime;

  let jobId = 0;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO HL_aiMemoryJobs (userId, jobType, status, estimatedDocuments, processedDocuments, createdAt, updatedAt)
       VALUES (?, 'rebuild', 'completed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, documents.length, totalIndexed).run();

    const meta = result.meta as Record<string, unknown> | undefined;
    jobId = Number(meta?.last_row_id ?? meta?.lastRowId ?? 0);
  } catch (error) {
    console.error('rebuildMemory: job record failed', error);
  }

  return {
    jobId,
    userId,
    totalProcessed: documents.length,
    totalIndexed,
    totalFailed,
    durationMs,
  };
}

/**
 * Delete all vectors for a user.
 * PRD S6C-T-07: user → delete all vectors
 * PRD S6C AC4: Delete memory deletes vectors + sets metadata status='deleted', not D1 source data.
 */
export async function deleteMemory(env: Bindings, userId: number): Promise<DeleteResult> {
  const startTime = Date.now();
  const service = new VectorizeService(env);

  // Get current count before deletion
  let vectorsDeleted = 0;
  try {
    const row = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status != 'deleted'"
    ).bind(userId).first<{ c: number }>();
    vectorsDeleted = row?.c ?? 0;
  } catch {
    // Non-fatal
  }

  // Delete all vectors
  await service.deleteAll(userId);

  const durationMs = Date.now() - startTime;

  // Record job
  let jobId = 0;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO HL_aiMemoryJobs (userId, jobType, status, estimatedDocuments, processedDocuments, createdAt, updatedAt)
       VALUES (?, 'delete', 'completed', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userId, vectorsDeleted, vectorsDeleted).run();

    const meta = result.meta as Record<string, unknown> | undefined;
    jobId = Number(meta?.last_row_id ?? meta?.lastRowId ?? 0);
  } catch (error) {
    console.error('deleteMemory: job record failed', error);
  }

  return { jobId, userId, vectorsDeleted, durationMs };
}

/**
 * Fetch all source data for a user from D1.
 * This is used by the rebuild operation to get all data that should be indexed.
 * PRD S6C §6: 8 source types indexed (summarized only).
 *
 * NOTE: Cycle/hydration data is only included if dataShareConsent=1.
 * The caller must check consent before calling this function or filter the results.
 */
export async function fetchAllSources(
  env: Bindings,
  userId: number,
  includeConsentGated: boolean
): Promise<SourceData[]> {
  const sources: SourceData[] = [];

  // 1. Symptoms
  try {
    const rows = await env.DB.prepare(
      `SELECT id, symptomDateTime, bodyArea, painScale, painSeverity, mood, isRedFlag
       FROM HL_symptomLogs WHERE userId = ? ORDER BY symptomDateTime DESC LIMIT 100`
    ).bind(userId).all<Record<string, unknown>>();
    for (const row of rows.results || []) {
      sources.push({ type: 'symptom', id: row.id as number, data: row });
    }
  } catch { /* table may not exist */ }

  // 2. Measurements (abnormal sessions only for memory efficiency)
  try {
    const rows = await env.DB.prepare(
      `SELECT m.metricCode, m.finalValue, m.status, m.severity, s.measuredAt, m.id
       FROM HL_measurementValues m
       JOIN HL_measurementSessions s ON s.id = m.sessionId
       WHERE s.userId = ? AND m.status != 'normal'
       ORDER BY s.measuredAt DESC LIMIT 100`
    ).bind(userId).all<Record<string, unknown>>();
    for (const row of rows.results || []) {
      sources.push({ type: 'measurement', id: row.id as number, data: row });
    }
  } catch { /* table may not exist */ }

  // 3. Safety events
  try {
    const rows = await env.DB.prepare(
      `SELECT id, eventType, severity, title, createdAt
       FROM HL_safetyEvents WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`
    ).bind(userId).all<Record<string, unknown>>();
    for (const row of rows.results || []) {
      sources.push({ type: 'safetyEvent', id: row.id as number, data: row });
    }
  } catch { /* table may not exist */ }

  // 4. Medication adherence
  try {
    const rows = await env.DB.prepare(
      `SELECT ml.id, ml.takenAt, ml.status, m.medicationName
       FROM HL_medicationLogs ml
       JOIN HL_medications m ON m.id = ml.medicationId
       WHERE ml.userId = ? ORDER BY ml.takenAt DESC LIMIT 100`
    ).bind(userId).all<Record<string, unknown>>();
    for (const row of rows.results || []) {
      sources.push({ type: 'medicationAdherence', id: row.id as number, data: row });
    }
  } catch { /* table may not exist */ }

  // 5. Doctor reports
  try {
    const rows = await env.DB.prepare(
      `SELECT id, reportType, createdAt FROM HL_Reports WHERE userId = ? ORDER BY createdAt DESC LIMIT 20`
    ).bind(userId).all<Record<string, unknown>>();
    for (const row of rows.results || []) {
      sources.push({ type: 'doctorReport', id: row.id as number, data: row });
    }
  } catch { /* table may not exist */ }

  // 6. AI clinical sessions (summarized, not raw content)
  try {
    const rows = await env.DB.prepare(
      `SELECT id, sessionType, status, dataSufficiencyScore, startedAt, createdAt
       FROM HL_aiClinicalSessions WHERE userId = ? ORDER BY createdAt DESC LIMIT 20`
    ).bind(userId).all<Record<string, unknown>>();
    for (const row of rows.results || []) {
      sources.push({ type: 'aiSession', id: row.id as number, data: row });
    }
  } catch { /* table may not exist */ }

  // 7. Hydration + Cycle (consent-gated)
  if (includeConsentGated) {
    try {
      const rows = await env.DB.prepare(
        `SELECT id, amountMl, logDate FROM HL_waterIntakeLogs WHERE userId = ? ORDER BY logDate DESC LIMIT 30`
      ).bind(userId).all<Record<string, unknown>>();
      for (const row of rows.results || []) {
        sources.push({ type: 'hydrationCycle', id: row.id as number, data: { ...row, subType: 'hydration' } });
      }
    } catch { /* table may not exist */ }

    try {
      const rows = await env.DB.prepare(
        `SELECT id, logDate, flowIntensity, mood FROM HL_cycleLogs WHERE userId = ? ORDER BY logDate DESC LIMIT 30`
      ).bind(userId).all<Record<string, unknown>>();
      for (const row of rows.results || []) {
        sources.push({ type: 'hydrationCycle', id: row.id as number, data: { ...row, subType: 'cycle' } });
      }
    } catch { /* table may not exist */ }
  }

  // 8. WhatsApp clinical chat (session-level, not raw messages)
  try {
    const rows = await env.DB.prepare(
      `SELECT id, messageType, direction, processedStatus, createdAt
       FROM HL_whatsappMessages WHERE userId = ? AND processedStatus = 'completed'
       ORDER BY createdAt DESC LIMIT 30`
    ).bind(userId).all<Record<string, unknown>>();
    for (const row of rows.results || []) {
      sources.push({ type: 'whatsappChat', id: row.id as number, data: row });
    }
  } catch { /* table may not exist */ }

  return sources;
}
