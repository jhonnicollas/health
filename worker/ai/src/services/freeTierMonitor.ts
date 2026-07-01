// Free tier monitor — checks total Vectorize index capacity.
// PRD S6C §2: Max vectors/index = 10,000,000. Alert threshold = 80% (8M vectors).
// PRD S6C AC10: Admin alert when total index reaches 80% capacity.
// Alert is written to HL_auditLogs.

import type { Bindings } from '../types.js';
import { getConfigNumber } from './config.js';

export interface FreeTierStatus {
  totalVectors: number;
  maxVectors: number;
  capacityPercent: number;
  alertThresholdPercent: number;
  alertTriggered: boolean;
  userCount: number;
  avgVectorsPerUser: number;
  usersAtLimit: number;
}

/**
 * Check the total vector count in the Vectorize index.
 * Since Vectorize doesn't expose a direct count API, we use HL_vectorDocuments
 * as the source of truth for counts.
 *
 * PRD S6C AC10: Admin alert when total index reaches 80% capacity.
 */
export async function checkFreeTierStatus(env: Bindings): Promise<FreeTierStatus> {
  const maxVectors = await getConfigNumber(env, 'vectorize.maxVectors', 10000000);
  const alertThresholdPercent = await getConfigNumber(env, 'vectorize.alertThresholdPercent', 80);
  const perUserLimit = await getConfigNumber(env, 'vectorize.maxVectorsPerUser', 500);

  try {
    // Count total indexed vectors across all users
    const totalRow = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE status = 'indexed'"
    ).first<{ c: number }>();

    // Count distinct users with vectors
    const userRow = await env.DB.prepare(
      "SELECT COUNT(DISTINCT userId) as c FROM HL_vectorDocuments WHERE status = 'indexed'"
    ).first<{ c: number }>();

    // Count users at or above their per-user limit
    const limitRow = await env.DB.prepare(
      `SELECT COUNT(*) as c FROM (
        SELECT userId, COUNT(*) as cnt
        FROM HL_vectorDocuments
        WHERE status = 'indexed'
        GROUP BY userId
        HAVING cnt >= ?
      )`
    ).bind(perUserLimit).first<{ c: number }>();

    const totalVectors = totalRow?.c ?? 0;
    const userCount = userRow?.c ?? 0;
    const usersAtLimit = limitRow?.c ?? 0;
    const capacityPercent = maxVectors > 0 ? (totalVectors / maxVectors) * 100 : 0;
    const alertTriggered = capacityPercent >= alertThresholdPercent;

    // Raise admin alert if threshold reached
    if (alertTriggered) {
      try {
        await env.DB.prepare(
          `INSERT INTO HL_auditLogs
            (userId, action, entityType, entityId, metadataJson, createdAt)
           VALUES (?, 'vectorize.capacityAlert', 'system', 'vectorize', ?, CURRENT_TIMESTAMP)`
        ).bind(
          0, // system user
          JSON.stringify({
            totalVectors,
            maxVectors,
            capacityPercent: Math.round(capacityPercent * 100) / 100,
            alertThresholdPercent,
            message: `Vectorize index at ${Math.round(capacityPercent)}% capacity (${totalVectors}/${maxVectors})`,
          })
        ).run();
      } catch {
        // Audit log failure is non-fatal
      }
    }

    return {
      totalVectors,
      maxVectors,
      capacityPercent: Math.round(capacityPercent * 100) / 100,
      alertThresholdPercent,
      alertTriggered,
      userCount,
      avgVectorsPerUser: userCount > 0 ? Math.round(totalVectors / userCount) : 0,
      usersAtLimit,
    };
  } catch (error) {
    console.error('checkFreeTierStatus failed:', error);
    return {
      totalVectors: 0,
      maxVectors,
      capacityPercent: 0,
      alertThresholdPercent,
      alertTriggered: false,
      userCount: 0,
      avgVectorsPerUser: 0,
      usersAtLimit: 0,
    };
  }
}
