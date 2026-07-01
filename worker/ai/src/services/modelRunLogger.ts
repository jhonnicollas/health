// ModelRunLogger — inserts a row into HL_modelRuns on every AI call.
// PRD §3 S6B §7: Every AI call writes to HL_modelRuns.
// PRD §12.2: HL_modelRuns schema fields.

import type { Bindings } from '../types.js';
import type { OperatingMode } from '../safety/safetyDecision.js';

export interface ModelRunLogInput {
  userId: number | null;
  requestId: string;
  sessionId?: number;
  channel: 'web' | 'whatsapp' | 'internal';
  taskCode: string;
  providerCode: string;
  modelCode: string;
  status: 'success' | 'timeout' | 'error' | 'safety_blocked' | 'fallback';
  fallbackUsed: 0 | 1;
  inputTokenCount?: number;
  outputTokenCount?: number;
  latencyMs: number;
  operatingMode?: OperatingMode;
  promptVersion?: string;
  usedVectorContext?: 0 | 1;
  usedAiSearch?: 0 | 1;
  vectorQueryId?: number;
  safetyDecision?: string;
  safetyFlagsJson?: string;
  errorCode?: string;
  actorType?: 'user' | 'admin' | 'system';
  actorId?: number;
}

/**
 * Insert a model run log row into HL_modelRuns.
 * PRD §12.2: userId NULLABLE for internal/admin/system calls.
 */
export async function logModelRun(
  env: Bindings,
  input: ModelRunLogInput
): Promise<number | undefined> {
  try {
    const result = await env.DB.prepare(
      `INSERT INTO HL_modelRuns
        (userId, actorType, actorId, requestId, sessionId, channel,
         taskCode, providerCode, modelCode, promptVersion,
         usedVectorContext, usedAiSearch, vectorQueryId,
         inputTokenCount, outputTokenCount, latencyMs,
         status, fallbackUsed, safetyDecision, safetyFlagsJson,
         operatingMode, errorCode, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      input.userId,
      input.actorType ?? 'user',
      input.actorId ?? null,
      input.requestId,
      input.sessionId ?? null,
      input.channel,
      input.taskCode,
      input.providerCode,
      input.modelCode,
      input.promptVersion ?? null,
      input.usedVectorContext ?? 0,
      input.usedAiSearch ?? 0,
      input.vectorQueryId ?? null,
      input.inputTokenCount ?? null,
      input.outputTokenCount ?? null,
      input.latencyMs,
      input.status,
      input.fallbackUsed,
      input.safetyDecision ?? null,
      input.safetyFlagsJson ?? null,
      input.operatingMode ?? null,
      input.errorCode ?? null
    ).run();

    const meta = result.meta as Record<string, unknown> | undefined;
    const id = Number(meta?.last_row_id ?? meta?.lastRowId);
    return Number.isInteger(id) && id > 0 ? id : undefined;
  } catch (error) {
    // Logging failure should not break the AI flow
    console.error('logModelRun failed:', error);
    return undefined;
  }
}

/**
 * Update a model run row with safety decision after Safety Runtime processes the output.
 */
export async function updateModelRunSafety(
  env: Bindings,
  modelRunId: number,
  safetyDecision: string,
  safetyFlagsJson: string
): Promise<void> {
  try {
    await env.DB.prepare(
      'UPDATE HL_modelRuns SET safetyDecision = ?, safetyFlagsJson = ? WHERE id = ?'
    ).bind(safetyDecision, safetyFlagsJson, modelRunId).run();
  } catch (error) {
    console.error('updateModelRunSafety failed:', error);
  }
}
