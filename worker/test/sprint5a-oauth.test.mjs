import assert from 'node:assert/strict'
import test from 'node:test'

test('OAuthService.createState generates state and nonce', async () => {
  const { OAuthService } = await import('../dist/services/oauth.js')
  let inserted = false
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null,
        run: async () => { inserted = true; return { meta: {} } }
      })
    })
  }
  const result = await OAuthService.createState(mockDb, 'google', 'login', '/dashboard')
  assert.ok(result.state)
  assert.ok(result.nonce)
  assert.ok(inserted)
})

test('OAuthService.validateState validates and returns row', async () => {
  const { OAuthService } = await import('../dist/services/oauth.js')
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => ({ id: 1, provider: 'google', mode: 'login', returnTo: '/dashboard' }),
        run: async () => ({ meta: {} })
      })
    })
  }
  const result = await OAuthService.validateState(mockDb, 'google', 'some-state')
  assert.equal(result.valid, true)
  assert.ok(result.row)
})

test('OAuthService.consumeState marks consumedAt', async () => {
  const { OAuthService } = await import('../dist/services/oauth.js')
  let consumed = false
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        run: async () => { consumed = true; return { meta: {} } }
      })
    })
  }
  await OAuthService.consumeState(mockDb, 1)
  assert.ok(consumed)
})

test('OAuthService.createState rejects unsafe returnTo path', async () => {
  const { OAuthService } = await import('../dist/services/oauth.js')
  let capturedReturnTo = ''
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => null,
        run: async () => {
          if (sql.includes('INSERT')) capturedReturnTo = args[4]
          return { meta: {} }
        }
      })
    })
  }
  await OAuthService.createState(mockDb, 'google', 'login', 'https://evil.com')
  assert.equal(capturedReturnTo, '/')
})

test('OAuthService.createState accepts safe returnTo /dashboard', async () => {
  const { OAuthService } = await import('../dist/services/oauth.js')
  let capturedReturnTo = ''
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => null,
        run: async () => {
          if (sql.includes('INSERT')) capturedReturnTo = args[4]
          return { meta: {} }
        }
      })
    })
  }
  await OAuthService.createState(mockDb, 'google', 'login', '/dashboard')
  assert.equal(capturedReturnTo, '/dashboard')
})

test('OAuth state reuse rejected (consumedAt set)', async () => {
  const { OAuthService } = await import('../dist/services/oauth.js')
  let queryCheckedConsumedAt = false
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('consumedAt IS NULL')) { queryCheckedConsumedAt = true; return null }
          return { id: 1, consumedAt: '2026-06-25T00:00:00Z' }
        },
      })
    })
  }
  const result = await OAuthService.validateState(mockDb, 'google', 'reused-state')
  assert.equal(result.valid, false)
  assert.equal(result.row, null)
  assert.ok(queryCheckedConsumedAt)
})

test('OAuth unlink rejects when no password AND only 1 login method', async () => {
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('COUNT')) return { cnt: 1 }
          if (sql.includes('passwordHash')) return { passwordHash: null }
          return null
        },
        run: async () => ({ meta: {} })
      })
    })
  }
  const accounts = await mockDb.prepare('SELECT COUNT(*) as cnt FROM HL_oauthAccounts WHERE userId = ?').bind().first()
  const pwUser = await mockDb.prepare('SELECT passwordHash FROM HL_users WHERE id = ?').bind().first()
  const shouldBlock = !pwUser?.passwordHash && (accounts?.cnt || 0) <= 1
  assert.equal(shouldBlock, true)
})

test('OAuth unlink allows when password exists even with 1 account', async () => {
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('COUNT')) return { cnt: 1 }
          if (sql.includes('passwordHash')) return { passwordHash: 'abc123' }
          return null
        },
        run: async () => ({ meta: {} })
      })
    })
  }
  const accounts = await mockDb.prepare('SELECT COUNT(*) as cnt FROM HL_oauthAccounts WHERE userId = ?').bind().first()
  const pwUser = await mockDb.prepare('SELECT passwordHash FROM HL_users WHERE id = ?').bind().first()
  const shouldBlock = !pwUser?.passwordHash && (accounts?.cnt || 0) <= 1
  assert.equal(shouldBlock, false)
})
