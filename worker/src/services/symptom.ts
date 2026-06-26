export type SymptomLogRow = {
  id: number; userId: number; sourceSessionId: number | null; symptomDateTime: string
  quickSymptomsJson: string | null; bodyArea: string | null; painScale: number | null
  painSeverity: string | null; mood: string | null; startedAt: string | null
  durationMinutes: number | null; description: string | null; redFlagsJson: string | null
  isRedFlag: number; safetyEventId: number | null; createdAt: string
}

// Deterministic red flag detection based on symptom description keywords
const RED_FLAG_KEYWORDS: { keyword: string; title: string; message: string; severity: 'emergency' | 'critical' | 'high' }[] = [
  // Indonesian keywords (PRD F5A-007)
  { keyword: 'nyeri dada', title: 'Nyeri Dada', message: 'Nyeri dada memerlukan evaluasi medis segera.', severity: 'emergency' },
  { keyword: 'sesak napas', title: 'Sesak Napas', message: 'Sesak napas mendadak memerlukan perhatian medis.', severity: 'emergency' },
  { keyword: 'sesak nafas', title: 'Sesak Nafas', message: 'Sesak nafas mendadak memerlukan perhatian medis.', severity: 'emergency' },
  { keyword: 'kaku kuduk', title: 'Kaku Kuduk', message: 'Kaku kuduk bisa menandakan meningitis, segera cari bantuan medis.', severity: 'emergency' },
  { keyword: 'kelemahan sesisi', title: 'Kelemahan Sesisi', message: 'Kelemahan separuh tubuh bisa tanda stroke, segera cari bantuan medis.', severity: 'emergency' },
  { keyword: 'pingsan', title: 'Pingsan', message: 'Pingsan tanpa sebab jelas perlu evaluasi medis segera.', severity: 'emergency' },
  { keyword: 'pandangan gelap', title: 'Pandangan Gelap', message: 'Pandangan mendadak gelap perlu evaluasi medis segera.', severity: 'emergency' },
  { keyword: 'mati rasa', title: 'Mati Rasa', message: 'Mati rasa separuh tubuh perlu evaluasi segera, bisa tanda stroke.', severity: 'emergency' },
  { keyword: 'muntah darah', title: 'Muntah Darah', message: 'Muntah darah adalah tanda darurat medis.', severity: 'emergency' },
  { keyword: 'darah di tinja', title: 'Darah di Tinja', message: 'Darah di tinja perlu evaluasi medis.', severity: 'high' },
  { keyword: 'kejang', title: 'Kejang', message: 'Kejang memerlukan penanganan medis segera.', severity: 'emergency' },
  { keyword: 'sakit kepala berat', title: 'Sakit Kepala Berat', message: 'Sakit kepala berat mendadak perlu evaluasi medis.', severity: 'high' },
  { keyword: 'bicara pelo', title: 'Bicara Pelo', message: 'Bicara pelo mendadak bisa tanda stroke.', severity: 'emergency' },
  { keyword: 'penglihatan kabur', title: 'Penglihatan Kabur', message: 'Penglihatan kabur mendadak perlu diperiksa.', severity: 'high' },
  { keyword: 'bunuh diri', title: 'Pikiran Bunuh Diri', message: 'Segera hubungi profesional kesehatan mental.', severity: 'emergency' },
  // English fallbacks
  { keyword: 'chest pain', title: 'Nyeri Dada', message: 'Nyeri dada memerlukan evaluasi medis segera.', severity: 'emergency' },
  { keyword: 'shortness of breath', title: 'Sesak Napas', message: 'Sesak napas mendadak memerlukan perhatian medis.', severity: 'emergency' },
  { keyword: 'difficulty breathing', title: 'Kesulitan Bernapas', message: 'Kesulitan bernapas adalah tanda darurat.', severity: 'emergency' },
  { keyword: 'fainted', title: 'Pingsan', message: 'Pingsan tanpa sebab jelas perlu evaluasi.', severity: 'emergency' },
  { keyword: 'seizure', title: 'Kejang', message: 'Kejang memerlukan penanganan medis segera.', severity: 'emergency' },
  { keyword: 'numbness', title: 'Kebas atau Mati Rasa', message: 'Kebas separuh tubuh perlu evaluasi segera.', severity: 'emergency' },
  { keyword: 'suicidal', title: 'Pikiran Bunuh Diri', message: 'Segera hubungi profesional kesehatan mental.', severity: 'emergency' },
  { keyword: 'blurred vision', title: 'Penglihatan Kabur', message: 'Penglihatan kabur mendadak perlu diperiksa.', severity: 'high' },
]

export type RedFlagResult = {
  detected: boolean
  flags: { keyword: string; title: string; message: string; severity: string }[]
}

export class SymptomService {
  static detectRedFlags(text: string): RedFlagResult {
    const lower = text.toLowerCase()
    const flags = RED_FLAG_KEYWORDS.filter(rf => lower.includes(rf.keyword))
    return { detected: flags.length > 0, flags }
  }

  static async createLog(db: D1Database, data: Omit<SymptomLogRow, 'id' | 'createdAt'>): Promise<number> {
    const { meta } = await db.prepare(
      'INSERT INTO HL_symptomLogs (userId, sourceSessionId, symptomDateTime, quickSymptomsJson, bodyArea, painScale, painSeverity, mood, startedAt, durationMinutes, description, redFlagsJson, isRedFlag, safetyEventId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).bind(data.userId, data.sourceSessionId, data.symptomDateTime, data.quickSymptomsJson, data.bodyArea, data.painScale, data.painSeverity, data.mood, data.startedAt, data.durationMinutes, data.description, data.redFlagsJson, data.isRedFlag, data.safetyEventId).run()
    return meta.last_row_id as number
  }

  static async getLogsByUser(db: D1Database, userId: number, limit = 50): Promise<SymptomLogRow[]> {
    const r = await db.prepare('SELECT * FROM HL_symptomLogs WHERE userId = ? ORDER BY symptomDateTime DESC LIMIT ?').bind(userId, limit).all<any>()
    return r.results || []
  }

  static async getLogsBySession(db: D1Database, sessionId: number): Promise<SymptomLogRow[]> {
    const r = await db.prepare('SELECT * FROM HL_symptomLogs WHERE sourceSessionId = ? ORDER BY symptomDateTime ASC').bind(sessionId).all<any>()
    return r.results || []
  }

  static async createSafetyEvent(db: D1Database, userId: number, eventType: string, severity: string, title: string, message: string, sourceId: string | null): Promise<number> {
    const { meta } = await db.prepare(
      "INSERT INTO HL_safetyEvents (userId, sourceType, sourceId, eventType, severity, title, message, notificationStatus, createdAt) VALUES (?, 'symptom', ?, ?, ?, ?, ?, 'queued', CURRENT_TIMESTAMP)"
    ).bind(userId, sourceId, eventType, severity, title, message).run()
    return meta.last_row_id as number
  }
}
