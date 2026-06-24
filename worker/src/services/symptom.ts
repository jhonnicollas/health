export type SymptomLogRow = {
  id: number; userId: number; sourceSessionId: number | null; symptomDateTime: string
  quickSymptomsJson: string | null; bodyArea: string | null; painScale: number | null
  painSeverity: string | null; mood: string | null; startedAt: string | null
  durationMinutes: number | null; description: string | null; redFlagsJson: string | null
  isRedFlag: number; safetyEventId: number | null; createdAt: string
}

// Deterministic red flag detection based on symptom description keywords
const RED_FLAG_KEYWORDS: { keyword: string; title: string; message: string; severity: 'emergency' | 'critical' | 'high' }[] = [
  { keyword: 'chest pain', title: 'Nyeri Dada', message: 'Nyeri dada memerlukan evaluasi medis segera.', severity: 'emergency' },
  { keyword: 'chest pressure', title: 'Tekanan Dada', message: 'Tekanan dada bisa menandakan masalah jantung.', severity: 'emergency' },
  { keyword: 'shortness of breath', title: 'Sesak Napas', message: 'Sesak napas mendadak memerlukan perhatian medis.', severity: 'emergency' },
  { keyword: 'difficulty breathing', title: 'Kesulitan Bernapas', message: 'Kesulitan bernapas adalah tanda darurat.', severity: 'emergency' },
  { keyword: 'unconscious', title: 'Kehilangan Kesadaran', message: 'Segera cari bantuan medis darurat.', severity: 'emergency' },
  { keyword: 'fainted', title: 'Pingsan', message: 'Pingsan tanpa sebab jelas perlu evaluasi.', severity: 'emergency' },
  { keyword: 'seizure', title: 'Kejang', message: 'Kejang memerlukan penanganan medis segera.', severity: 'emergency' },
  { keyword: 'severe headache', title: 'Sakit Kepala Berat', message: 'Sakit kepala berat mendadak perlu evaluasi.', severity: 'high' },
  { keyword: 'blurred vision', title: 'Penglihatan Kabur', message: 'Penglihatan kabur mendadak perlu diperiksa.', severity: 'high' },
  { keyword: 'slurred speech', title: 'Bicara Pelo', message: 'Bicara pelo mendadak bisa tanda stroke.', severity: 'emergency' },
  { keyword: 'numbness', title: 'Kebas atau Mati Rasa', message: 'Kebas separuh tubuh perlu evaluasi segera.', severity: 'emergency' },
  { keyword: 'vomiting blood', title: 'Muntah Darah', message: 'Muntah darah adalah tanda darurat medis.', severity: 'emergency' },
  { keyword: 'blood in stool', title: 'Darah di Tinja', message: 'Darah di tinja perlu evaluasi medis.', severity: 'high' },
  { keyword: 'suicidal', title: 'Pikiran Bunuh Diri', message: 'Segera hubungi profesional kesehatan mental.', severity: 'emergency' },
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
