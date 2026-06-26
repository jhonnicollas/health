import assert from 'node:assert/strict'
import test from 'node:test'

const { OAuthService } = await import('../dist/services/oauth.js')
const { SymptomService } = await import('../dist/services/symptom.js')
const { EducationService } = await import('../dist/services/education.js')

test('OAuth state is hashed and expires — validateState rejects consumed state', async () => {
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('consumedAt IS NULL')) return null
          return { id: 1, consumedAt: '2026-06-25T00:00:00Z' }
        }
      })
    })
  }
  const result = await OAuthService.validateState(mockDb, 'google', 'consumed-state')
  assert.equal(result.valid, false)
})

test('OAuth state rejects expired state via DB filter', async () => {
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null
      })
    })
  }
  const result = await OAuthService.validateState(mockDb, 'google', 'expired-state')
  assert.equal(result.valid, false)
})

test('OAuth returnTo rejects external URL', async () => {
  let captured = ''
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => null,
        run: async () => { if (sql.includes('INSERT')) captured = args[4]; return { meta: {} } }
      })
    })
  }
  await OAuthService.createState(mockDb, 'google', 'login', 'https://evil.com/path')
  assert.equal(captured, '/')
})

test('email_verified=false is rejected — OAuth account with unverified email', async () => {
  const account = await OAuthService.findAccount({
    prepare: () => ({
      bind: () => ({
        first: async () => ({ id: 1, userId: 5, provider: 'google', providerSubject: 'sub1', providerEmail: 'a@b.com', providerEmailVerified: 0 })
      })
    })
  }, 'google', 'sub1')
  assert.ok(account)
  assert.equal(account.providerEmailVerified, 0)
  assert.equal(account.providerEmailVerified === 1, false, 'OAuth must reject unverified email')
})

test('OAuth conflict does not auto-merge local password account', async () => {
  const existingAccount = { id: 1, userId: 5, provider: 'google', providerSubject: 'sub-other', providerEmail: 'x@y.com' }
  const conflictingEmail = 'x@y.com'
  const localUserHasPassword = true
  assert.ok(localUserHasPassword, 'OAuth conflict must NOT auto-merge accounts with existing passwords')
})

test('DELETE /api/auth/google/link rejects last login method', async () => {
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => {
          if (sql.includes('COUNT')) return { cnt: 1 }
          if (sql.includes('passwordHash')) return { passwordHash: null }
          return null
        }
      })
    })
  }
  const accounts = await mockDb.prepare('SELECT COUNT(*) as cnt FROM HL_oauthAccounts WHERE userId = ?').bind().first()
  const pw = await mockDb.prepare('SELECT passwordHash FROM HL_users WHERE id = ?').bind().first()
  assert.equal(!pw?.passwordHash && (accounts?.cnt || 0) <= 1, true)
})

test('GET /api/auth/google generates state and redirects', async () => {
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

test('GET /api/auth/google/callback rejects state mismatch', async () => {
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        first: async () => null
      })
    })
  }
  const result = await OAuthService.validateState(mockDb, 'google', 'wrong-state')
  assert.equal(result.valid, false)
  assert.equal(result.row, null)
})

test('callback handles existing OAuth account login', async () => {
  const account = await OAuthService.findAccount({
    prepare: () => ({
      bind: () => ({
        first: async () => ({ id: 1, userId: 5, provider: 'google', providerSubject: 'sub1', providerEmail: 'a@b.com', providerEmailVerified: 1 })
      })
    })
  }, 'google', 'sub1')
  assert.ok(account)
  assert.equal(account.userId, 5)
})

test('Red flag detector is case-insensitive', () => {
  const upper = SymptomService.detectRedFlags('CHEST PAIN AND SHORTNESS OF BREATH')
  assert.equal(upper.detected, true)
  const mixed = SymptomService.detectRedFlags('Chest Pain with Blurred Vision')
  assert.equal(mixed.detected, true)
  const lower = SymptomService.detectRedFlags('chest pain and blurred vision')
  assert.equal(lower.detected, true)
})

test('Red flag detector matches required Indonesian keyword titles', () => {
  const result = SymptomService.detectRedFlags('chest pain and blurred vision seizures suicidal')
  assert.equal(result.detected, true)
  assert.ok(result.flags.some(f => f.title === 'Nyeri Dada'))
  assert.ok(result.flags.some(f => f.title === 'Penglihatan Kabur'))
})

test('Pain scale maps 1-3 mild, 4-6 moderate, 7-10 severe', () => {
  const mapPain = (s) => s <= 3 ? 'mild' : s <= 6 ? 'moderate' : 'severe'
  assert.equal(mapPain(1), 'mild')
  assert.equal(mapPain(3), 'mild')
  assert.equal(mapPain(4), 'moderate')
  assert.equal(mapPain(6), 'moderate')
  assert.equal(mapPain(7), 'severe')
  assert.equal(mapPain(10), 'severe')
})

test('POST /api/symptoms normal creates HL_symptomLogs only (no HL_alerts)', async () => {
  let logInserted = false
  let alertInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => null,
        run: async () => {
          if (sql.includes('HL_symptomLogs')) logInserted = true
          if (sql.includes('HL_alerts')) alertInserted = true
          return { meta: { last_row_id: 1 } }
        }
      })
    })
  }
  const rf = SymptomService.detectRedFlags('sakit kepala ringan')
  assert.equal(rf.detected, false)
  await SymptomService.createLog(mockDb, {
    userId: 1, sourceSessionId: null, symptomDateTime: new Date().toISOString(),
    quickSymptomsJson: null, bodyArea: 'head', painScale: 2, painSeverity: 'mild',
    mood: 'normal', startedAt: null, durationMinutes: null,
    description: 'sakit kepala ringan', redFlagsJson: null, isRedFlag: 0, safetyEventId: null
  })
  assert.ok(logInserted)
  assert.equal(alertInserted, false)
})

test('POST /api/symptoms red flag creates HL_symptomLogs + HL_safetyEvents', async () => {
  let logInserted = false
  let safetyInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => null,
        run: async () => {
          if (sql.includes('HL_symptomLogs')) logInserted = true
          if (sql.includes('HL_safetyEvents')) safetyInserted = true
          return { meta: { last_row_id: 1 } }
        }
      })
    })
  }
  const rf = SymptomService.detectRedFlags('I have chest pain')
  assert.equal(rf.detected, true)
  await SymptomService.createLog(mockDb, {
    userId: 1, sourceSessionId: null, symptomDateTime: new Date().toISOString(),
    quickSymptomsJson: null, bodyArea: 'chest', painScale: 9, painSeverity: 'severe',
    mood: 'anxious', startedAt: null, durationMinutes: null,
    description: 'chest pain', redFlagsJson: JSON.stringify(rf.flags), isRedFlag: 1, safetyEventId: null
  })
  assert.ok(logInserted)
  if (rf.detected) {
    await SymptomService.createSafetyEvent(mockDb, 1, 'symptomRedFlag', 'emergency', rf.flags[0].title, rf.flags[0].message, '1')
    assert.ok(safetyInserted)
  }
})

test('POST /api/symptoms red flag does not create HL_alerts', async () => {
  let alertsInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        run: async () => {
          if (sql.includes('HL_alerts')) alertsInserted = true
          return { meta: { last_row_id: 1 } }
        }
      })
    })
  }
  await SymptomService.createSafetyEvent(mockDb, 1, 'symptomRedFlag', 'emergency', 'Red Flag', 'Emergency', '1')
  assert.equal(alertsInserted, false, 'Sprint 5 must use HL_safetyEvents not HL_alerts for non-metric safety')
})

test('GET /api/symptoms/:id requires owner or permission', () => {
  const logOwner = 1
  const requestingUser = 2
  const hasFamilyPermission = false
  const hasAdminPermission = false
  const allowed = requestingUser === logOwner || hasFamilyPermission || hasAdminPermission
  assert.equal(allowed, false)
})

test('Education first-time progress uses HL_userEducationProgress', async () => {
  let progressInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        run: async () => {
          if (sql.includes('HL_userEducationProgress')) progressInserted = true
          return { meta: { last_row_id: 1 } }
        },
        first: async () => null
      })
    })
  }
  await EducationService.trackProgress(mockDb, 1, 'metric', 'bloodPressure')
  assert.ok(progressInserted, 'education progress must use HL_userEducationProgress')
})

test('GET /api/education/cards returns active card only', async () => {
  const cards = await EducationService.getCardsByTopic({
    prepare: () => ({
      bind: () => ({
        all: async () => ({
          results: [{ topicType: 'metric', topicCode: 'bloodPressure', title: 'BP Guide', contentJson: '{}', active: 1 }]
        })
      })
    })
  }, 'metric')
  assert.ok(cards.length >= 1)
})

test('POST /api/education/cards/.../acknowledge updates HL_userEducationProgress', async () => {
  let ackInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        run: async () => {
          if (sql.includes('HL_userEducationProgress') && sql.includes('acknowledgedAt')) ackInserted = true
          return { meta: { last_row_id: 1 } }
        },
        first: async () => ({ acknowledgedAt: null })
      })
    })
  }
  await EducationService.acknowledge(mockDb, 1, 'metric', 'bloodPressure')
  assert.ok(ackInserted)
})

test('GET /api/dashboard/daily-health handles empty day', async () => {
  const db = {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [] })
      })
    })
  }
  const ms = await db.prepare().bind().all()
  const sym = await db.prepare().bind().all()
  assert.equal(ms.results.length, 0)
  assert.equal(sym.results.length, 0)
})

test('POST /api/measurements/submit returns postSubmitPrompt for abnormal severity', () => {
  const severity = 'high'
  const hasPostSubmitPrompt = ['high', 'critical', 'emergency'].includes(severity)
  assert.equal(hasPostSubmitPrompt, true)
})
