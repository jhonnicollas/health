const SENSITIVE_FIELDS = ['description', 'notes', 'physicalSymptomsJson', 'rawDetail']

function sanitizeMetadata(meta: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_FIELDS.includes(k)) { out[k] = typeof v === 'string' ? `[${v.length} chars]` : '[redacted]' }
    else { out[k] = v }
  }
  return out
}

export class AiMemoryService {
  static SOURCE_TYPES = ['measurement','symptom','safetyEvent','hydration','cycle','medication','fasting','pattern','report','education'] as const

  static async buildContextPackage(db: D1Database, userId: number, limit = 10): Promise<Record<string, any>> {
    const measurements = await db.prepare(`
      SELECT m.metricCode, m.finalValue, m.status, m.severity, s.measuredAt 
      FROM HL_measurementValues m JOIN HL_measurementSessions s ON s.id = m.sessionId 
      WHERE s.userId = ? ORDER BY s.measuredAt DESC LIMIT ?`).bind(userId, limit).all<any>()
    const symptoms = await db.prepare(
      `SELECT id, symptomDateTime, bodyArea, painScale, painSeverity, mood, isRedFlag FROM HL_symptomLogs WHERE userId = ? ORDER BY symptomDateTime DESC LIMIT ?`
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
    const cycleSettings = await db.prepare('SELECT cycleLengthDays, periodLengthDays, lastPeriodStart, isPregnant, isLactating, isMenopause, predictionPaused FROM HL_cycleSettings WHERE userId = ?').bind(userId).first<any>()
    const cycleLogs = await db.prepare('SELECT logDate, flowIntensity, mood, unprotected FROM HL_cycleLogs WHERE userId = ? ORDER BY logDate DESC LIMIT ?').bind(userId, limit).all<any>()
    const fasting = await db.prepare('SELECT id, startedAt, endedAt, status FROM HL_fastingSessions WHERE userId = ? ORDER BY startedAt DESC LIMIT ?').bind(userId, limit).all<any>().catch(() => ({ results: [] }))
    const reports = await db.prepare('SELECT id, reportType, createdAt FROM HL_Reports WHERE userId = ? ORDER BY createdAt DESC LIMIT ?').bind(userId, limit).all<any>().catch(() => ({ results: [] }))
    const educationProgress = await db.prepare('SELECT topicType, topicCode, acknowledgedAt FROM HL_userEducationProgress WHERE userId = ? ORDER BY acknowledgedAt DESC LIMIT ?').bind(userId, limit).all<any>().catch(() => ({ results: [] }))
    return {
      profile,
      measurements: measurements.results || [],
      symptoms: symptoms.results || [],
      safetyEvents: safetyEvents.results || [],
      medications: medications.results || [],
      hydration: hydration.results || [],
      cycle: { settings: cycleSettings, logs: cycleLogs.results || [] },
      fasting: fasting.results || [],
      reports: reports.results || [],
      education: educationProgress.results || []
    }
  }

  static calculateDataSufficiency(context: Record<string, any>): { score: number; scoreReason: string } {
    let score = 0; const reasons: string[] = []
    if ((context.measurements?.length || 0) > 0) { score += 20; reasons.push(`${context.measurements.length} pengukuran`) }
    if ((context.symptoms?.length || 0) > 0) { score += 15; reasons.push(`${context.symptoms.length} keluhan`) }
    if ((context.safetyEvents?.length || 0) > 0) { score += 10; reasons.push(`${context.safetyEvents.length} safety event`) }
    if ((context.medications?.length || 0) > 0) { score += 10; reasons.push(`${context.medications.length} data obat`) }
    if ((context.hydration?.length || 0) > 0) { score += 10; reasons.push(`${context.hydration.length} log hidrasi`) }
    if (context.profile) { score += 5; reasons.push('profil lengkap') }
    if ((context.cycle?.settings || context.cycle?.logs?.length) > 0) { score += 10; reasons.push('data siklus') }
    if ((context.fasting?.length || 0) > 0) { score += 5; reasons.push('data puasa') }
    if ((context.reports?.length || 0) > 0) { score += 5; reasons.push('laporan') }
    if ((context.education?.length || 0) > 0) { score += 5; reasons.push('edukasi') }
    const max = Math.max(context.measurements?.length || 0, context.symptoms?.length || 0)
    if (max >= 10) { score = Math.min(score + 5, 100); reasons.push('riwayat cukup panjang') }
    return { score: Math.min(score, 100), scoreReason: reasons.length ? reasons.join(', ') : 'Data kurang untuk analisis' }
  }

  static enforceDisclaimer(text: string, modelName = 'AI'): string {
    const disclaimer = `\n\n---\n${modelName} is AI dan dapat membuat kesalahan. Informasi ini bukan pengganti konsultasi dokter.`
    if (text.includes('bukan pengganti konsultasi dokter') || text.includes('disclaimer')) return text
    return text + disclaimer
  }

  static async logDisclaimer(db: D1Database, userId: number, recommendationId: number, modelName: string, disclaimerText: string): Promise<void> {
    const existing = await db.prepare('SELECT id FROM HL_aiRecommendationContexts WHERE recommendationId = ?').bind(recommendationId).first<any>()
    if (existing) {
      await db.prepare('UPDATE HL_aiRecommendationContexts SET disclaimer = ?, modelName = ?, usedFallback = 0, updatedAt = CURRENT_TIMESTAMP WHERE recommendationId = ?').bind(disclaimerText, modelName, recommendationId).run()
    }
  }

  static async logContextQuery(db: D1Database, userId: number, queryText: string, topK: number, usedVector: boolean, fallbackReason: string | null, durationMs: number, resultJson: string): Promise<number> {
    const { meta } = await db.prepare(
      'INSERT INTO HL_aiContextQueries (userId, queryText, topK, resultJson, usedVectorContext, fallbackReason, durationMs, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(userId, queryText, topK, resultJson, usedVector ? 1 : 0, fallbackReason, durationMs).run()
    return meta.last_row_id as number
  }

  static async getMemoryStatus(db: D1Database, userId: number): Promise<Record<string, any>> {
    const total = await db.prepare('SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ?').bind(userId).first<any>()
    const indexed = await db.prepare("SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'indexed'").bind(userId).first<any>()
    const pending = await db.prepare("SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'pending'").bind(userId).first<any>()
    const failed = await db.prepare("SELECT COUNT(*) as c FROM HL_vectorDocuments WHERE userId = ? AND status = 'failed'").bind(userId).first<any>()
    const last = await db.prepare("SELECT MAX(indexedAt) as last FROM HL_vectorDocuments WHERE userId = ? AND status = 'indexed'").bind(userId).first<any>()
    const activeJob = await db.prepare("SELECT id as jobId, jobType, status, processedDocuments, estimatedDocuments FROM HL_aiMemoryJobs WHERE userId = ? AND status IN ('queued','processing') ORDER BY createdAt DESC LIMIT 1").bind(userId).first<any>()
    return {
      enabled: true,
      namespace: `user:${userId}`,
      documentCount: total?.c || 0,
      indexedCount: indexed?.c || 0,
      pendingCount: pending?.c || 0,
      failedCount: failed?.c || 0,
      lastIndexedAt: last?.last || null,
      activeJob: activeJob || null,
      sprint6ClinicalCopilot: {
        scopeStatus: 'deferred_to_sprint6',
        runtimeEnabled: false,
        readinessPurpose: 'context_infrastructure_only',
        readyChecks: {
          vectorNamespaceReady: true,
          memoryLifecycleReady: true,
          contextTraceReady: true,
          safetyBoundaryReady: true,
          clinicalInterviewRuntimeReady: false,
          differentialReasoningRuntimeReady: false,
          doctorHandoffRuntimeReady: false
        }
      }
    }
  }

  static async rebuildMemory(db: D1Database, userId: number, context: Record<string, any>, queue?: Queue): Promise<{ jobId: number; estimatedDocuments: number }> {
    const estimated = (context.measurements?.length || 0) + (context.symptoms?.length || 0) + (context.safetyEvents?.length || 0) + (context.hydration?.length || 0) + (context.cycle?.logs?.length || 0) + (context.medications?.length || 0) + (context.fasting?.length || 0) + (context.reports?.length || 0) + (context.education?.length || 0)
    const { meta } = await db.prepare(
      "INSERT INTO HL_aiMemoryJobs (userId, jobType, status, estimatedDocuments, processedDocuments, createdAt, updatedAt) VALUES (?, 'rebuild', 'queued', ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).bind(userId, estimated).run()
    const jobId = meta.last_row_id as number
    if (queue) { try { await queue.send({ jobId, userId, jobType: 'rebuild' }) } catch {} }
    else { await this._executeRebuild(db, userId, context) }
    return { jobId, estimatedDocuments: estimated }
  }

  static async _executeRebuild(db: D1Database, userId: number, context: Record<string, any>): Promise<number> {
    await db.prepare("UPDATE HL_vectorDocuments SET status = 'deleted' WHERE userId = ?").bind(userId).run()
    let count = 0
    const sources: Array<{ type: string; items: any[]; textFn: (item: any) => string; metaFn: (item: any) => Record<string, any> }> = [
      { type: 'measurement', items: context.measurements || [], textFn: (m) => `Measurement: ${m.metricCode} = ${m.finalValue} (${m.status})`, metaFn: (m) => ({ metricCode: m.metricCode, finalValue: m.finalValue }) },
      { type: 'symptom', items: context.symptoms || [], textFn: (s) => `Symptom: ${s.bodyArea || 'unknown'}, pain=${s.painScale || '-'}`, metaFn: (s) => ({ bodyArea: s.bodyArea, painScale: s.painScale }) },
      { type: 'safetyEvent', items: context.safetyEvents || [], textFn: (e) => `Safety: ${e.eventType} (${e.severity})`, metaFn: (e) => ({ eventType: e.eventType, severity: e.severity }) },
      { type: 'hydration', items: context.hydration || [], textFn: (h) => `Hydration: ${h.amountMl}ml on ${h.logDate}`, metaFn: (h) => ({ amountMl: h.amountMl }) },
      { type: 'cycle', items: context.cycle?.logs || [], textFn: (c) => `Cycle log: flow=${c.flowIntensity || 'none'}, mood=${c.mood || '-'}`, metaFn: (c) => ({ flowIntensity: c.flowIntensity }) },
      { type: 'medication', items: context.medications || [], textFn: (m) => `Med: ${m.medicationName}, status=${m.status}`, metaFn: (m) => ({ medicationName: m.medicationName }) },
      { type: 'fasting', items: context.fasting || [], textFn: (f) => `Fasting: ${f.status}`, metaFn: (f) => ({ status: f.status }) },
      { type: 'report', items: context.reports || [], textFn: (r) => `Report: ${r.reportType}`, metaFn: (r) => ({ reportType: r.reportType }) },
      { type: 'education', items: context.education || [], textFn: (e) => `Education: ${e.topicType}/${e.topicCode}`, metaFn: (e) => ({ topicType: e.topicType, topicCode: e.topicCode }) }
    ]
    for (const src of sources) {
      for (const item of src.items) {
        const content = src.textFn(item)
        const hash = await sha256Str(content)
        const safeMeta = sanitizeMetadata(src.metaFn(item))
        await db.prepare('INSERT OR IGNORE INTO HL_vectorDocuments (userId, vectorId, namespace, sourceType, sourceId, contentHash, textPreview, metadataJson, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
          .bind(userId, `v_${userId}_${src.type}_${count}`, `user_${userId}`, src.type, `${src.type}_${count}`, hash, content, JSON.stringify(safeMeta), 'pending').run()
        count++
      }
    }
    await db.prepare("UPDATE HL_aiMemoryJobs SET status = 'completed', processedDocuments = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND jobType = 'rebuild' AND status IN ('queued','processing') ORDER BY createdAt DESC LIMIT 1").bind(count, userId).run()
    return count
  }

  static async deleteMemory(db: D1Database, userId: number, queue?: Queue): Promise<{ jobId: number }> {
    const { meta } = await db.prepare(
      "INSERT INTO HL_aiMemoryJobs (userId, jobType, status, estimatedDocuments, processedDocuments, createdAt, updatedAt) VALUES (?, 'delete', 'queued', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
    ).bind(userId).run()
    const jobId = meta.last_row_id as number
    await db.prepare("UPDATE HL_vectorDocuments SET status = 'deleted' WHERE userId = ? AND status != 'deleted'").bind(userId).run()
    await db.prepare("UPDATE HL_aiMemoryJobs SET status = 'completed', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").bind(jobId).run()
    return { jobId }
  }

  static async isClinicalInfrastructureEnabled(db: D1Database): Promise<boolean> {
    const row = await db.prepare("SELECT configValue FROM HL_featureFlags WHERE flagCode = 'aiClinicalInfrastructureEnabled'").first<any>()
    return row?.configValue === 'true' || row?.enabled === 1
  }
}

async function sha256Str(val: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
