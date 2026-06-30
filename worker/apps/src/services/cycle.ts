const GUARDRAIL_MESSAGE = 'Peringatan: Metode kalender tidak memberikan perlindungan 100% terhadap kehamilan. Sperma dapat bertahan hidup hingga 5 hari. Prediksi masa aman bisa meleset karena stres, sakit, obat, perubahan tidur, menyusui, atau siklus yang tidak teratur. Selalu gunakan kontrasepsi tambahan bila ingin mencegah kehamilan.'

export class CycleService {
  static async getSettings(db: D1Database, userId: number): Promise<any> {
    return db.prepare('SELECT * FROM HL_cycleSettings WHERE userId = ?').bind(userId).first<any>()
  }

  static async upsertSettings(db: D1Database, userId: number, data: any): Promise<{ predictionPaused: boolean; pauseReason: string | null; hydrationSync: boolean }> {
    if (data.cycleLengthDays !== undefined && (data.cycleLengthDays < 1 || data.cycleLengthDays > 120)) throw new Error('VALIDATION:cycleLengthDays')
    if (data.periodLengthDays !== undefined && (data.periodLengthDays < 1 || data.periodLengthDays > 15)) throw new Error('VALIDATION:periodLengthDays')
    let predictionPaused = false
    let pauseReason: string | null = null
    if (data.isPregnant) { predictionPaused = true; pauseReason = 'pregnant' }
    else if (data.isMenopause) { predictionPaused = true; pauseReason = 'menopause' }
    if (predictionPaused) { data.predictionPaused = 1; data.pauseReason = pauseReason }
    const existing = await this.getSettings(db, userId)
    if (existing) {
      const sets: string[] = []; const vals: unknown[] = []
      for (const k of ['cycleLengthDays','periodLengthDays','lastPeriodStart','isPregnant','isLactating','isMenopause','predictionPaused','pauseReason']) {
        if (data[k] !== undefined) { sets.push(`${k} = ?`); vals.push(data[k]) }
      }
      if (sets.length) { sets.push('updatedAt = CURRENT_TIMESTAMP'); await db.prepare(`UPDATE HL_cycleSettings SET ${sets.join(', ')} WHERE userId = ?`).bind(...vals as any[], userId).run() }
    } else {
      await db.prepare(`INSERT INTO HL_cycleSettings (userId, cycleLengthDays, periodLengthDays, lastPeriodStart, isPregnant, isLactating, isMenopause, predictionPaused, pauseReason, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
        .bind(userId, data.cycleLengthDays || 28, data.periodLengthDays || 5, data.lastPeriodStart || null, data.isPregnant || 0, data.isLactating || 0, data.isMenopause || 0, predictionPaused ? 1 : 0, pauseReason).run()
    }
    let hydrationSync = false
    if (data.isLactating !== undefined) {
      const hs = await db.prepare('SELECT userId FROM HL_hydrationSettings WHERE userId = ?').bind(userId).first<any>()
      if (hs) { await db.prepare('UPDATE HL_hydrationSettings SET isLactating = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?').bind(data.isLactating ? 1 : 0, userId).run(); hydrationSync = true }
    }
    return { predictionPaused, pauseReason, hydrationSync }
  }

  static async logDay(db: D1Database, userId: number, data: any): Promise<void> {
    await db.prepare(`INSERT INTO HL_cycleLogs (userId, logDate, hasPeriodFlow, flowIntensity, mood, physicalSymptomsJson, unprotected, contraceptionGuardrailAcknowledgedAt, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(userId, logDate) DO UPDATE SET hasPeriodFlow=COALESCE(?,hasPeriodFlow), flowIntensity=COALESCE(?,flowIntensity), mood=COALESCE(?,mood), physicalSymptomsJson=COALESCE(?,physicalSymptomsJson), unprotected=COALESCE(?,unprotected), notes=COALESCE(?,notes), updatedAt=CURRENT_TIMESTAMP`)
      .bind(userId, data.logDate, data.hasPeriodFlow||0, data.flowIntensity||null, data.mood||null, data.physicalSymptoms ? JSON.stringify(data.physicalSymptoms) : null, data.unprotected||0, data.contraceptionGuardrailAcknowledged ? new Date().toISOString() : null, data.notes||null,
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
    const nextPeriod = new Date(last); nextPeriod.setDate(nextPeriod.getDate() + cycleLen)
    const ovulation = new Date(last); ovulation.setDate(ovulation.getDate() + (cycleLen - 14))
    const fertileStart = new Date(ovulation); fertileStart.setDate(fertileStart.getDate() - 5)
    const fertileEnd = new Date(ovulation); fertileEnd.setDate(fertileEnd.getDate() + 1)
    return {
      fertileStart: fertileStart.toISOString().slice(0, 10), fertileEnd: fertileEnd.toISOString().slice(0, 10),
      ovulationDay: ovulation.toISOString().slice(0, 10), nextPeriod: nextPeriod.toISOString().slice(0, 10)
    }
  }

  static checkContraceptionGuardrail(logData: any, prediction: any): { needsGuardrail: boolean; type: string; message: string } | null {
    if (logData?.unprotected) {
      const fs = prediction?.fertileStart; const fe = prediction?.fertileEnd
      const inFertile = !!fs && !!fe && logData.logDate >= fs && logData.logDate <= fe
      return { needsGuardrail: true, type: inFertile ? 'unprotected' : 'outsideFertileWindow', message: GUARDRAIL_MESSAGE }
    }
    return null
  }

  static checkCalendarGuardrail(): { needsGuardrail: boolean; type: string; message: string } {
    return { needsGuardrail: true, type: 'calendarMethod', message: GUARDRAIL_MESSAGE }
  }

  static async detectIrregularity(db: D1Database, settings: any, userId: number): Promise<{ isIrregular: boolean; reason: string; safetyEventId?: number } | null> {
    if (!settings?.cycleLengthDays) return null
    if (settings.cycleLengthDays < 21 || settings.cycleLengthDays > 35) {
      const { meta } = await db.prepare("INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, 'cycle', ?, 'cycleIrregularity', 'warning', 'Siklus tidak teratur', ?, 'queued', CURRENT_TIMESTAMP)")
        .bind(userId, String(settings.cycleLengthDays), `Siklus ${settings.cycleLengthDays} hari di luar rentang normal 21-35 hari.`).run()
      await db.prepare('UPDATE HL_cycleSettings SET predictionPaused = 1, pauseReason = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?').bind('irregular', userId).run()
      return { isIrregular: true, reason: `Siklus ${settings.cycleLengthDays} hari di luar rentang normal 21-35 hari.`, safetyEventId: meta.last_row_id as number }
    }
    const logs = await db.prepare('SELECT logDate FROM HL_cycleLogs WHERE userId = ? AND hasPeriodFlow = 1 ORDER BY logDate DESC LIMIT 3').bind(userId).all<any>()
    if (logs.results && logs.results.length >= 2) {
      const dates = logs.results.map((r: any) => new Date(r.logDate).getTime()).sort((a: number, b: number) => a - b)
      const diffs = []
      for (let i = 1; i < dates.length; i++) diffs.push(Math.round((dates[i] - dates[i-1]) / 86400000))
      if (diffs.length >= 2 && diffs.every(d => d < 21 || d > 35)) {
        const { meta } = await db.prepare("INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, 'cycle', 'consecutive', 'cycleIrregularity', 'warning', 'Dua siklus berturut-turut tidak teratur', ?, 'queued', CURRENT_TIMESTAMP)")
          .bind(userId, `Dua siklus berturut-turut terlalu pendek/panjang: ${diffs.join(', ')} hari.`).run()
        await db.prepare('UPDATE HL_cycleSettings SET predictionPaused = 1, pauseReason = ?, updatedAt = CURRENT_TIMESTAMP WHERE userId = ?').bind('irregular', userId).run()
        return { isIrregular: true, reason: `Dua siklus berturut-turut (${diffs.join(', ')} hari) di luar rentang normal.`, safetyEventId: meta.last_row_id as number }
      }
    }
    return null
  }

  static buildCalendarDays(settings: any, logs: any[], month: string): any[] {
    if (!settings?.lastPeriodStart || settings.predictionPaused) return []
    const [y, m] = month.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const prediction = this.predictFertileWindow(settings)
    const days: any[] = []
    const logSet = new Set(logs.map((l: any) => String(l.logDate).slice(0, 10)))
    const periodLen = settings.periodLengthDays || 5
    const last = new Date(settings.lastPeriodStart)
    const periodDates = new Set<string>()
    for (let i = 0; i < periodLen; i++) { const d = new Date(last); d.setDate(d.getDate() + i); periodDates.add(d.toISOString().slice(0, 10)) }
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      let phase = 'outsideFertile'; let label = 'Di luar prediksi masa subur'; let colorToken = 'normal'
      if (periodDates.has(dateStr)) { phase = 'period'; label = 'Haid'; colorToken = 'critical' }
      else if (prediction.fertileStart && prediction.fertileEnd && dateStr >= prediction.fertileStart && dateStr <= prediction.fertileEnd) { phase = 'fertile'; label = 'Masa subur'; colorToken = 'warning' }
      if (prediction.ovulationDay && prediction.ovulationDay === dateStr) { phase = 'ovulation'; label = 'Puncak ovulasi'; colorToken = 'danger' }
      days.push({ date: dateStr, phase, label, colorToken, isPredicted: !logSet.has(dateStr), hasLog: logSet.has(dateStr), needsContraceptionGuardrail: phase === 'outsideFertile' || phase === 'fertile' || phase === 'ovulation' })
    }
    return days
  }
}
