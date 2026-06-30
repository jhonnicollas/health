export type HydrationSettings = { enabled: number; reminderEnabled: number; operatingStart: string; operatingEnd: string; telegramQuickAddEnabled: number; customBaseTargetMl: number | null; isPregnant: number; isLactating: number }
export type WaterIntakeLog = { id: number; userId: number; amountMl: number; loggedAt: string; logDate: string; source: string; notes: string | null }

const OVERHYDRATION_THRESHOLD_ML = 5000
const CONTRACT_WARNING_MSG = 'Minum terlalu banyak air dalam waktu singkat bisa berbahaya. Periksa kembali catatan Anda.'

export class HydrationService {
  static async getSettings(db: D1Database, userId: number): Promise<HydrationSettings | null> {
    return db.prepare('SELECT enabled, reminderEnabled, operatingStart, operatingEnd, telegramQuickAddEnabled, customBaseTargetMl, isPregnant, isLactating FROM HL_hydrationSettings WHERE userId = ?').bind(userId).first<any>()
  }

  static async upsertSettings(db: D1Database, userId: number, data: Partial<HydrationSettings>): Promise<void> {
    const existing = await this.getSettings(db, userId)
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of ['enabled','reminderEnabled','operatingStart','operatingEnd','telegramQuickAddEnabled','customBaseTargetMl','isPregnant','isLactating'] as const) {
        if ((data as any)[k] !== undefined) { sets.push(`${k} = ?`); vals.push((data as any)[k]) }
      }
      if (sets.length) { sets.push('updatedAt = CURRENT_TIMESTAMP'); await db.prepare(`UPDATE HL_hydrationSettings SET ${sets.join(', ')} WHERE userId = ?`).bind(...vals as any[], userId).run() }
    } else {
      await db.prepare('INSERT INTO HL_hydrationSettings (userId, enabled, reminderEnabled, operatingStart, operatingEnd, telegramQuickAddEnabled, customBaseTargetMl, isPregnant, isLactating, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(userId, data.enabled ?? 1, data.reminderEnabled ?? 1, data.operatingStart || '09:00', data.operatingEnd || '18:00', data.telegramQuickAddEnabled ?? 1, data.customBaseTargetMl ?? null, data.isPregnant ?? 0, data.isLactating ?? 0).run()
    }
  }

  static async getOrCalculateTarget(db: D1Database, userId: number, dateStr: string): Promise<{ targetMl: number; baseTargetMl: number; reasons: string[] }> {
    const existing = await db.prepare('SELECT targetMl, baseTargetMl, reasonJson FROM HL_hydrationTargets WHERE userId = ? AND targetDate = ?').bind(userId, dateStr).first<any>()
    if (existing) return { targetMl: existing.targetMl, baseTargetMl: existing.baseTargetMl, reasons: existing.reasonJson ? JSON.parse(existing.reasonJson) : ['Cached target'] }

    const settings = await this.getSettings(db, userId)
    const reasons: string[] = []
    let bodyWeight: number | null = null
    let bodyTemp: number | null = null

    const bwRow = await db.prepare("SELECT finalValue FROM HL_measurementValues WHERE metricCode = 'bodyWeight' AND sessionId IN (SELECT id FROM HL_measurementSessions WHERE userId = ?) ORDER BY createdAt DESC LIMIT 1").bind(userId).first<any>()
    if (bwRow?.finalValue) bodyWeight = Number(bwRow.finalValue)

    const tempRow = await db.prepare("SELECT finalValue FROM HL_measurementValues WHERE metricCode = 'bodyTemperature' AND sessionId IN (SELECT id FROM HL_measurementSessions WHERE userId = ? AND date(measuredAt) = date(?)) ORDER BY createdAt DESC LIMIT 1").bind(userId, dateStr).first<any>()
    if (tempRow?.finalValue) bodyTemp = Number(tempRow.finalValue)

    let baseTarget: number
    if (settings?.customBaseTargetMl && settings.customBaseTargetMl > 0) {
      baseTarget = settings.customBaseTargetMl
      reasons.push(`Target kustom: ${baseTarget} ml.`)
    } else if (bodyWeight && bodyWeight > 0) {
      baseTarget = Math.round(bodyWeight * 30)
      reasons.push(`Target dihitung dari berat badan: ${bodyWeight} kg × 30 ml = ${baseTarget} ml.`)
    } else {
      baseTarget = 2000
      reasons.push(`Target default: 2000 ml (belum ada data berat badan).`)
    }

    if (settings?.isPregnant) {
      if (baseTarget < 2400) { reasons.push(`Dinaikkan ke 2400 ml karena hamil.`); baseTarget = 2400 }
      else { reasons.push('+300 ml karena hamil.'); baseTarget += 300 }
    }
    if (settings?.isLactating) {
      if (baseTarget < 2800) { reasons.push(`Dinaikkan ke 2800 ml karena menyusui.`); baseTarget = 2800 }
      else { reasons.push('+500 ml karena menyusui.'); baseTarget += 500 }
    }
    if (bodyTemp !== null && bodyTemp > 37.5) {
      baseTarget += 500
      reasons.push(`+500 ml karena suhu tubuh hari ini di atas 37.5°C.`)
    }

    await db.prepare('INSERT OR IGNORE INTO HL_hydrationTargets (userId, targetDate, targetMl, baseTargetMl, bodyWeightKg, isPregnant, isLactating, bodyTemperatureC, reasonJson, calculatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(userId, dateStr, baseTarget, baseTarget, bodyWeight ?? 0, settings?.isPregnant ?? 0, settings?.isLactating ?? 0, bodyTemp ?? null, JSON.stringify(reasons)).run()
    return { targetMl: baseTarget, baseTargetMl: baseTarget, reasons }
  }

  static async logWater(db: D1Database, userId: number, amountMl: number, source: string, loggedAt?: string, notes?: string, overLimitAtInsert = false): Promise<number> {
    const dt = loggedAt || new Date().toISOString()
    const date = dt.slice(0, 10)
    const { meta } = await db.prepare('INSERT INTO HL_waterIntakeLogs (userId, amountMl, loggedAt, logDate, source, notes, overLimitAtInsert, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(userId, amountMl, dt, date, source, notes || null, overLimitAtInsert ? 1 : 0).run()
    return meta.last_row_id as number
  }

  static async deleteLog(db: D1Database, logId: number, userId: number): Promise<{ deleted: boolean; logDate: string }> {
    const existing = await db.prepare('SELECT id, logDate FROM HL_waterIntakeLogs WHERE id = ? AND userId = ?').bind(logId, userId).first<any>()
    if (!existing) return { deleted: false, logDate: '' }
    await db.prepare('DELETE FROM HL_waterIntakeLogs WHERE id = ? AND userId = ?').bind(logId, userId).run()
    return { deleted: true, logDate: existing.logDate || '' }
  }

  static async getTodayLogs(db: D1Database, userId: number, dateStr: string): Promise<WaterIntakeLog[]> {
    const r = await db.prepare('SELECT id, userId, amountMl, loggedAt, logDate, source, notes FROM HL_waterIntakeLogs WHERE userId = ? AND logDate = ? ORDER BY loggedAt ASC').bind(userId, dateStr).all<any>()
    return r.results || []
  }

  static async getHistoryDaily(db: D1Database, userId: number, from: string, to: string, limit = 50): Promise<any[]> {
    const r = await db.prepare(
      "SELECT logDate as date, SUM(amountMl) as totalMl, COUNT(*) as logCount FROM HL_waterIntakeLogs WHERE userId = ? AND logDate >= ? AND logDate <= ? GROUP BY logDate ORDER BY logDate DESC LIMIT ?"
    ).bind(userId, from, to, limit).all<any>()
    return r.results || []
  }

  static async getFilteredLogs(db: D1Database, userId: number, from: string, to: string, source?: string, minAmount?: number, maxAmount?: number, limit = 200): Promise<WaterIntakeLog[]> {
    let sql = 'SELECT id, userId, amountMl, loggedAt, logDate, source, notes FROM HL_waterIntakeLogs WHERE userId = ? AND logDate >= ? AND logDate <= ?'
    const params: (string | number)[] = [userId, from, to]
    if (source) { sql += ' AND source = ?'; params.push(source) }
    if (minAmount !== undefined && !Number.isNaN(minAmount)) { sql += ' AND amountMl >= ?'; params.push(minAmount) }
    if (maxAmount !== undefined && !Number.isNaN(maxAmount)) { sql += ' AND amountMl <= ?'; params.push(maxAmount) }
    sql += ' ORDER BY loggedAt DESC LIMIT ?'
    params.push(Math.min(limit, 200))
    const r = await db.prepare(sql).bind(...params).all<any>()
    return r.results || []
  }

  static async checkOverhydration(db: D1Database, userId: number, dateStr: string, totalMl: number): Promise<{ triggered: boolean; safetyEventId?: number }> {
    if (totalMl <= OVERHYDRATION_THRESHOLD_ML) return { triggered: false }
    const existing = await db.prepare("SELECT id FROM HL_safetyEvents WHERE userId = ? AND eventType = 'overhydrationWarning' AND date(createdAt) = date(?) LIMIT 1").bind(userId, dateStr).first<any>()
    if (existing) return { triggered: true, safetyEventId: existing.id }
    const { meta } = await db.prepare("INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, 'hydration', ?, 'overhydrationWarning', 'warning', 'Kelebihan Cairan', ?, 'queued', CURRENT_TIMESTAMP)").bind(userId, dateStr, CONTRACT_WARNING_MSG).run()
    const safetyEventId = meta.last_row_id as number
    return { triggered: true, safetyEventId }
  }
}
