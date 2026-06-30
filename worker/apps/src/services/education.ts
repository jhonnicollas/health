export type EducationCardRow = {
  id: number; topicType: string; topicCode: string; title: string; shortText: string | null
  whyItMatters: string | null; howToUse: string | null; normalMeaning: string | null
  warningMeaning: string | null; actionText: string | null; redFlagText: string | null
  sourceLabel: string | null; contentMarkdown: string | null; minimumPlanCode: string | null
  active: number; sortOrder: number
}

export class EducationService {
  static async getCard(db: D1Database, topicType: string, topicCode: string): Promise<EducationCardRow | null> {
    return db.prepare('SELECT * FROM HL_educationCards WHERE topicType = ? AND topicCode = ? AND active = 1').bind(topicType, topicCode).first<any>() as Promise<EducationCardRow | null>
  }

  static async getCardsByTopic(db: D1Database, topicType: string): Promise<EducationCardRow[]> {
    const r = await db.prepare('SELECT * FROM HL_educationCards WHERE topicType = ? AND active = 1 ORDER BY sortOrder ASC').bind(topicType).all<any>()
    return r.results || []
  }

  static async trackProgress(db: D1Database, userId: number, topicType: string, topicCode: string): Promise<void> {
    await db.prepare('INSERT INTO HL_userEducationProgress (userId, topicType, topicCode, createdAt, updatedAt) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) ON CONFLICT(userId, topicType, topicCode) DO UPDATE SET lastSeenAt = CURRENT_TIMESTAMP, seenCount = seenCount + 1, updatedAt = CURRENT_TIMESTAMP').bind(userId, topicType, topicCode).run()
  }

  static async acknowledge(db: D1Database, userId: number, topicType: string, topicCode: string): Promise<void> {
    await db.prepare('UPDATE HL_userEducationProgress SET acknowledgedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE userId = ? AND topicType = ? AND topicCode = ?').bind(userId, topicType, topicCode).run()
  }
}
