export type HydrationSettings = { enabled: number; reminderEnabled: number; operatingStart: string; operatingEnd: string; telegramQuickAddEnabled: number; customBaseTargetMl: number | null; isPregnant: number; isLactating: number }
export type WaterIntakeLog = { id: number; userId: number; amountMl: number; loggedAt: string; logDate: string; source: string; notes: string | null }

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
    const profile = await db.prepare('SELECT heightCm FROM HL_userProfiles WHERE userId = ?').bind(userId).first<any>()
    const settings = await this.getSettings(db, userId)
    const bodyWeight = profile?.heightCm ? Math.round(profile.heightCm - 100) : 65 // rough estimate if no weight
    let baseTarget = settings?.customBaseTargetMl || Math.round(bodyWeight * 30)
    const reasons = [`Target dihitung dari berat badan: ${bodyWeight} kg × 30 ml = ${baseTarget} ml.`]
    if (settings?.isPregnant) { baseTarget += 300; reasons.push('+300 ml karena hamil.') }
    if (settings?.isLactating) { baseTarget += 500; reasons.push('+500 ml karena menyusui.') }
    await db.prepare('INSERT OR IGNORE INTO HL_hydrationTargets (userId, targetDate, targetMl, baseTargetMl, bodyWeightKg, isPregnant, isLactating, reasonJson, calculatedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(userId, dateStr, baseTarget, baseTarget, bodyWeight, settings?.isPregnant ?? 0, settings?.isLactating ?? 0, JSON.stringify(reasons)).run()
    return { targetMl: baseTarget, baseTargetMl: baseTarget, reasons }
  }

  static async logWater(db: D1Database, userId: number, amountMl: number, source: string, loggedAt?: string, notes?: string): Promise<number> {
    const dt = loggedAt || new Date().toISOString()
    const date = dt.slice(0, 10)
    const { meta } = await db.prepare('INSERT INTO HL_waterIntakeLogs (userId, amountMl, loggedAt, logDate, source, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(userId, amountMl, dt, date, source, notes || null).run()
    return meta.last_row_id as number
  }

  static async getTodayLogs(db: D1Database, userId: number, dateStr: string): Promise<WaterIntakeLog[]> {
    const r = await db.prepare('SELECT id, userId, amountMl, loggedAt, logDate, source, notes FROM HL_waterIntakeLogs WHERE userId = ? AND logDate = ? ORDER BY loggedAt ASC').bind(userId, dateStr).all<any>()
    return r.results || []
  }

  static async getHistory(db: D1Database, userId: number, from: string, to: string, limit = 50): Promise<WaterIntakeLog[]> {
    const r = await db.prepare('SELECT id, userId, amountMl, loggedAt, logDate, source, notes FROM HL_waterIntakeLogs WHERE userId = ? AND logDate >= ? AND logDate <= ? ORDER BY loggedAt DESC LIMIT ?').bind(userId, from, to, limit).all<any>()
    return r.results || []
  }

  static async checkOverhydration(db: D1Database, userId: number, dateStr: string, totalMl: number): Promise<boolean> {
    const target = await this.getOrCalculateTarget(db, userId, dateStr)
    if (totalMl > target.targetMl * 1.5) {
      await db.prepare("INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, 'hydration', ?, 'overhydrationWarning', 'warning', 'Kelebihan Cairan', 'Total asupan air hari ini melebihi 150% target. Pantau keluhan seperti mual, pusing, atau sesak.', 'queued', CURRENT_TIMESTAMP)").bind(userId, dateStr).run()
      return true
    }
    return false
  }
}
