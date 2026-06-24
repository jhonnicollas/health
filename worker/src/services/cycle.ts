export class CycleService {
  static async getSettings(db: D1Database, userId: number): Promise<any> {
    return db.prepare('SELECT * FROM HL_cycleSettings WHERE userId = ?').bind(userId).first<any>()
  }
  static async upsertSettings(db: D1Database, userId: number, data: any): Promise<void> {
    const existing = await this.getSettings(db, userId)
    const fields = ['cycleLengthDays','periodLengthDays','lastPeriodStart','isPregnant','isLactating','isMenopause','predictionPaused','pauseReason']
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of fields) { if (data[k] !== undefined) { sets.push(`${k} = ?`); vals.push(data[k]) } }
      if (sets.length) { sets.push('updatedAt = CURRENT_TIMESTAMP'); await db.prepare(`UPDATE HL_cycleSettings SET ${sets.join(', ')} WHERE userId = ?`).bind(...vals as any[], userId).run() }
    } else {
      await db.prepare(`INSERT INTO HL_cycleSettings (userId, ${fields.join(', ')}, createdAt, updatedAt) VALUES (?, ${fields.map(() => '?').join(', ')}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
        .bind(userId, ...fields.map(k => data[k] !== undefined ? data[k] : (k === 'cycleLengthDays' ? 28 : k === 'periodLengthDays' ? 5 : null))).run()
    }
  }
  static async logDay(db: D1Database, userId: number, data: any): Promise<void> {
    await db.prepare(`INSERT INTO HL_cycleLogs (userId, logDate, hasPeriodFlow, flowIntensity, mood, physicalSymptomsJson, unprotected, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(userId, logDate) DO UPDATE SET hasPeriodFlow=COALESCE(?,hasPeriodFlow), flowIntensity=COALESCE(?,flowIntensity), mood=COALESCE(?,mood), physicalSymptomsJson=COALESCE(?,physicalSymptomsJson), unprotected=COALESCE(?,unprotected), notes=COALESCE(?,notes), updatedAt=CURRENT_TIMESTAMP`)
      .bind(userId, data.logDate, data.hasPeriodFlow||0, data.flowIntensity||null, data.mood||null, data.physicalSymptoms ? JSON.stringify(data.physicalSymptoms) : null, data.unprotected||0, data.notes||null,
        data.hasPeriodFlow||0, data.flowIntensity||null, data.mood||null, data.physicalSymptoms ? JSON.stringify(data.physicalSymptoms) : null, data.unprotected||0, data.notes||null).run()
  }
  static async getLogs(db: D1Database, userId: number, from: string, to: string): Promise<any[]> {
    const r = await db.prepare('SELECT * FROM HL_cycleLogs WHERE userId = ? AND logDate >= ? AND logDate <= ? ORDER BY logDate ASC').bind(userId, from, to).all<any>()
    return r.results || []
  }
  static predictFertileWindow(settings: any): { fertileStart: string | null; fertileEnd: string | null; ovulationDay: string | null; nextPeriod: string | null } {
    if (!settings?.lastPeriodStart) return { fertileStart: null, fertileEnd: null, ovulationDay: null, nextPeriod: null }
    const last = new Date(settings.lastPeriodStart)
    const cycleLen = settings.cycleLengthDays || 28
    const periodLen = settings.periodLengthDays || 5
    const nextPeriod = new Date(last); nextPeriod.setDate(nextPeriod.getDate() + cycleLen)
    const ovulation = new Date(last); ovulation.setDate(ovulation.getDate() + (cycleLen - 14))
    const fertileStart = new Date(ovulation); fertileStart.setDate(fertileStart.getDate() - 5)
    const fertileEnd = new Date(ovulation); fertileEnd.setDate(fertileEnd.getDate() + 1)
    return {
      fertileStart: fertileStart.toISOString().slice(0, 10), fertileEnd: fertileEnd.toISOString().slice(0, 10),
      ovulationDay: ovulation.toISOString().slice(0, 10), nextPeriod: nextPeriod.toISOString().slice(0, 10)
    }
  }
  static checkContraceptionGuardrail(logs: any[], prediction: any): { needsGuardrail: boolean; type: string; message: string } | null {
    const recent = logs?.[logs.length - 1]
    if (recent?.unprotected && prediction?.fertileStart && recent.logDate >= prediction.fertileStart && recent.logDate <= prediction.fertileEnd) {
      return { needsGuardrail: true, type: 'outsideFertileWindow', message: 'Anda mencatat hubungan tanpa proteksi dalam masa subur. Pertimbangkan konsultasi dokter.' }
    }
    return null
  }
  static detectIrregularity(settings: any): { isIrregular: boolean; reason: string } | null {
    if (!settings?.cycleLengthDays) return null
    if (settings.cycleLengthDays < 21 || settings.cycleLengthDays > 35) return { isIrregular: true, reason: `Siklus ${settings.cycleLengthDays} hari di luar rentang normal 21-35 hari.` }
    return null
  }
}
