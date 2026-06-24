export type OAuthAccountRow = {
  id: number
  userId: number
  provider: string
  providerSubject: string
  providerEmail: string
  providerEmailVerified: number
}

export type OAuthStateRow = {
  id: number
  stateHash: string
  nonceHash: string | null
  provider: string
  mode: string
  returnTo: string | null
  userId: number | null
  expiresAt: string
  consumedAt: string | null
}

export class OAuthService {
  static async findAccount(db: D1Database, provider: string, providerSubject: string): Promise<OAuthAccountRow | null> {
    return db.prepare('SELECT id, userId, provider, providerSubject, providerEmail, providerEmailVerified FROM HL_oauthAccounts WHERE provider = ? AND providerSubject = ?').bind(provider, providerSubject).first<any>() as Promise<OAuthAccountRow | null>
  }

  static async linkAccount(db: D1Database, userId: number, provider: string, providerSubject: string, providerEmail: string): Promise<number> {
    const { meta } = await db.prepare('INSERT INTO HL_oauthAccounts (userId, provider, providerSubject, providerEmail, createdAt, updatedAt) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)').bind(userId, provider, providerSubject, providerEmail).run()
    return meta.last_row_id as number
  }

  static async unlinkAccount(db: D1Database, userId: number, provider: string): Promise<void> {
    await db.prepare('DELETE FROM HL_oauthAccounts WHERE userId = ? AND provider = ?').bind(userId, provider).run()
  }

  static async getAccountsByUser(db: D1Database, userId: number): Promise<OAuthAccountRow[]> {
    const r = await db.prepare('SELECT id, userId, provider, providerSubject, providerEmail, providerEmailVerified FROM HL_oauthAccounts WHERE userId = ? ORDER BY provider').bind(userId).all<any>()
    return r.results || []
  }
}
