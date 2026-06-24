export class AiMemoryService {
  /** Build clinical context from recent user data for AI consumption */
  static async buildContextPackage(db: D1Database, userId: number, limit = 10): Promise<Record<string, any>> {
    const measurements = await db.prepare(`
      SELECT m.metricCode, m.finalValue, m.status, m.severity, s.measuredAt 
      FROM HL_measurementValues m JOIN HL_measurementSessions s ON s.id = m.sessionId 
      WHERE s.userId = ? ORDER BY s.measuredAt DESC LIMIT ?`).bind(userId, limit).all<any>()
    const symptoms = await db.prepare(
      `SELECT id, symptomDateTime, bodyArea, painScale, painSeverity, mood, description, isRedFlag FROM HL_symptomLogs WHERE userId = ? ORDER BY symptomDateTime DESC LIMIT ?`
    ).bind(userId, limit).all<any>()
    const safetyEvents = await db.prepare(
      `SELECT eventType, severity, title, createdAt FROM HL_safetyEvents WHERE userId = ? ORDER BY createdAt DESC LIMIT ?`
    ).bind(userId, limit).all<any>()
    const medications = await db.prepare(
      `SELECT ml.takenAt, ml.status, m.medicationName FROM HL_medicationLogs ml JOIN HL_medications m ON m.id = ml.medicationId WHERE ml.userId = ? ORDER BY ml.takenAt DESC LIMIT ?`
    ).bind(userId, limit).all<any>()
    const hydration = await db.prepare(
      `SELECT amountMl, loggedAt, logDate FROM HL_waterIntakeLogs WHERE userId = ? ORDER BY loggedAt DESC LIMIT ?`
    ).bind(userId, limit).all<any>()
    const profile = await db.prepare('SELECT displayName, sex, birthDate, heightCm FROM HL_userProfiles WHERE userId = ?').bind(userId).first<any>()
    return { profile, measurements: measurements.results || [], symptoms: symptoms.results || [], safetyEvents: safetyEvents.results || [], medications: medications.results || [], hydration: hydration.results || [] }
  }

  /** Calculate data sufficiency score (1-100) and reasoning */
  static calculateDataSufficiency(context: Record<string, any>): { score: number; reason: string } {
    let score = 0; const reasons: string[] = []
    if ((context.measurements?.length || 0) > 0) { score += 30; reasons.push(`Ada ${context.measurements.length} data pengukuran.`) }
    if ((context.symptoms?.length || 0) > 0) { score += 20; reasons.push(`Ada ${context.symptoms.length} data keluhan.`) }
    if ((context.safetyEvents?.length || 0) > 0) { score += 15; reasons.push(`Ada ${context.safetyEvents.length} event keselamatan.`) }
    if ((context.medications?.length || 0) > 0) { score += 15; reasons.push(`Ada ${context.medications.length} data obat.`) }
    if ((context.hydration?.length || 0) > 0) { score += 10; reasons.push(`Ada ${context.hydration.length} data hidrasi.`) }
    if (context.profile) { score += 10; reasons.push('Profil pengguna tersedia.') }
    const max = Math.max(context.measurements?.length || 0, context.symptoms?.length || 0)
    if (max >= 10) { score = Math.min(score + 10, 100); reasons.push('Riwayat cukup panjang untuk analisis.') }
    return { score: Math.min(score, 100), reason: reasons.join(' ') }
  }

  /** Enforce disclaimer — inject if not present */
  static enforceDisclaimer(text: string, modelName = 'AI'): string {
    const disclaimer = `\n\n---\n${modelName} is AI dan dapat membuat kesalahan. Informasi ini bukan pengganti konsultasi dokter.`
    if (text.includes('bukan pengganti konsultasi dokter') || text.includes('disclaimer')) return text
    return text + disclaimer
  }

  /** Log disclaimer enforcement event */
  static async logDisclaimer(db: D1Database, userId: number, recommendationId: number, modelName: string, disclaimerText: string): Promise<void> {
    // ponytail: store in HL_aiRecommendationContexts
    const existing = await db.prepare('SELECT id FROM HL_aiRecommendationContexts WHERE recommendationId = ?').bind(recommendationId).first<any>()
    if (existing) {
      await db.prepare('UPDATE HL_aiRecommendationContexts SET disclaimer = ?, modelName = ?, usedFallback = 0, updatedAt = CURRENT_TIMESTAMP WHERE recommendationId = ?').bind(disclaimerText, modelName, recommendationId).run()
    }
  }

  /** Log context query */
  static async logContextQuery(db: D1Database, userId: number, queryText: string, topK: number, usedVector: boolean, fallbackReason: string | null, durationMs: number, resultJson: string): Promise<number> {
    const { meta } = await db.prepare(
      'INSERT INTO HL_aiContextQueries (userId, queryText, topK, resultJson, usedVectorContext, fallbackReason, durationMs, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(userId, queryText, topK, resultJson, usedVector ? 1 : 0, fallbackReason, durationMs).run()
    return meta.last_row_id as number
  }

  /** Get memory status for user */
  static async getMemoryStatus(db: D1Database, userId: number): Promise<{ totalDocuments: number; indexedCount: number; pendingCount: number; lastIndexedAt: string | null }> {
    const total = await db.prepare('SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ?').bind(userId).first<any>()
    const indexed = await db.prepare("SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'indexed'").bind(userId).first<any>()
    const pending = await db.prepare("SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'pending'").bind(userId).first<any>()
    const last = await db.prepare("SELECT MAX(indexedAt) as last FROM HL_vectorDocuments WHERE userId = ? AND status = 'indexed'").bind(userId).first<any>()
    return { totalDocuments: total?.c || 0, indexedCount: indexed?.c || 0, pendingCount: pending?.c || 0, lastIndexedAt: last?.last || null }
  }

  /** Rebuild user's vector documents (re-insert with pending status) */
  static async rebuildMemory(db: D1Database, userId: number, context: Record<string, any>): Promise<number> {
    await db.prepare("UPDATE HL_vectorDocuments SET status = 'deleted' WHERE userId = ?").bind(userId).run()
    let count = 0
    for (const m of (context.measurements || [])) {
      const content = `Measurement: ${m.metricCode} = ${m.finalValue} (${m.status})`
      const hash = await sha256Str(content)
      await db.prepare('INSERT OR IGNORE INTO HL_vectorDocuments (userId, vectorId, namespace, sourceType, sourceId, contentHash, textPreview, metadataJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
        .bind(userId, `v_${userId}_${count}_${Date.now()}`, `user_${userId}`, 'measurement', `m_${count}`, hash, content, JSON.stringify({ metricCode: m.metricCode, finalValue: m.finalValue }), 'pending').run()
      count++
    }
    return count
  }

  /** Delete all user vector memory */
  static async deleteMemory(db: D1Database, userId: number): Promise<void> {
    await db.prepare("UPDATE HL_vectorDocuments SET status = 'deleted' WHERE userId = ? AND status != 'deleted'").bind(userId).run()
  }
}

async function sha256Str(val: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
