async function sha256(val: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(val))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

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
  static async createState(db: D1Database, provider: string, mode: string, returnTo?: string): Promise<{ state: string; nonce: string }> {
    const state = crypto.randomUUID()
    const nonce = crypto.randomUUID()
    const stateHash = await sha256(state)
    const nonceHash = await sha256(nonce)
    const safePaths = ['/', '/dashboard', '/settings', '/settings/account-security']
    const safeReturn = (returnTo && safePaths.includes(returnTo)) ? returnTo : '/'
    await db.prepare('INSERT INTO HL_oauthStates (stateHash, nonceHash, provider, mode, returnTo, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)').bind(stateHash, nonceHash, provider, mode, safeReturn, new Date(Date.now() + 600000).toISOString()).run()
    return { state, nonce }
  }

  static async validateState(db: D1Database, provider: string, state: string): Promise<{ valid: boolean; row: OAuthStateRow | null }> {
    const stateHash = await sha256(state)
    const row = await db.prepare("SELECT id, stateHash, nonceHash, provider, mode, returnTo, userId, expiresAt, consumedAt FROM HL_oauthStates WHERE stateHash = ? AND provider = ? AND consumedAt IS NULL AND expiresAt > datetime('now')").bind(stateHash, provider).first<any>()
    return { valid: !!row, row: row || null }
  }

  static async consumeState(db: D1Database, stateId: number): Promise<void> {
    await db.prepare('UPDATE HL_oauthStates SET consumedAt = CURRENT_TIMESTAMP WHERE id = ?').bind(stateId).run()
  }

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
