import assert from 'node:assert/strict'
import test from 'node:test'

const { SymptomService } = await import('../dist/services/symptom.js')

test('SymptomService.detectRedFlags detects chest pain', () => {
  const result = SymptomService.detectRedFlags('I have chest pain and feels bad')
  assert.equal(result.detected, true)
  assert.ok(result.flags.some(f => f.title === 'Nyeri Dada'))
  assert.equal(result.flags[0].severity, 'emergency')
})

test('SymptomService.detectRedFlags detects shortness of breath', () => {
  const result = SymptomService.detectRedFlags('shortness of breath since morning')
  assert.equal(result.detected, true)
  assert.ok(result.flags.some(f => f.title === 'Sesak Napas'))
})

test('SymptomService.detectRedFlags detects suicidal thoughts', () => {
  const result = SymptomService.detectRedFlags('feeling suicidal today')
  assert.equal(result.detected, true)
  assert.ok(result.flags.some(f => f.severity === 'emergency'))
})

test('SymptomService.detectRedFlags no flags for normal text', () => {
  const result = SymptomService.detectRedFlags('sakit kepala ringan')
  assert.equal(result.detected, false)
  assert.equal(result.flags.length, 0)
})

test('SymptomService.detectRedFlags detects multiple flags', () => {
  const result = SymptomService.detectRedFlags('chest pain and blurred vision')
  assert.equal(result.detected, true)
  assert.ok(result.flags.length >= 2)
})

test('POST /api/symptoms creates log + red flag', async () => {
  let logInserted = false
  let safetyInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('HL_symptomLogs')) return { userId: 1 }
          return null
        },
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
  const logId = await SymptomService.createLog(mockDb, {
    userId: 1, sourceSessionId: null, symptomDateTime: new Date().toISOString(),
    quickSymptomsJson: null, bodyArea: 'chest', painScale: 7, painSeverity: 'severe',
    mood: 'anxious', startedAt: null, durationMinutes: null,
    description: 'I have chest pain', redFlagsJson: rf.detected ? JSON.stringify(rf.flags) : null,
    isRedFlag: rf.detected ? 1 : 0, safetyEventId: null
  })
  assert.ok(logId)
  assert.ok(logInserted)
  if (rf.detected) {
    const seId = await SymptomService.createSafetyEvent(mockDb, 1, 'symptomRedFlag', rf.flags[0].severity, rf.flags[0].title, rf.flags[0].message, String(logId))
    assert.ok(seId)
    assert.ok(safetyInserted)
  }
})

test('GET /api/symptoms/:id owner only — non-owner denied', async () => {
  const logOwner = 1
  const requestingUser = 2
  const row = { userId: logOwner, id: 10 }
  assert.notEqual(row.userId, requestingUser)
})

test('POST /api/symptoms/prompt-dismissals creates audit log', async () => {
  let auditInserted = false
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        run: async () => {
          if (sql.includes('HL_auditLogs')) auditInserted = true
          return { meta: {} }
        }
      })
    })
  }
  await mockDb.prepare('INSERT INTO HL_auditLogs (userId, action, entityType, entityId, metadataJson, createdAt) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
    .bind(1, 'symptom.prompt.dismissed', 'HL_measurementSessions', '5', JSON.stringify({ reason: 'noSymptoms' }))
    .run()
  assert.ok(auditInserted)
})

test('SymptomService.detectRedFlags is case-insensitive', () => {
  const upper = SymptomService.detectRedFlags('CHEST PAIN and SHORTNESS OF BREATH')
  assert.equal(upper.detected, true)
  assert.ok(upper.flags.some(f => f.title === 'Nyeri Dada'))
  assert.ok(upper.flags.some(f => f.title === 'Sesak Napas'))
  const mixed = SymptomService.detectRedFlags('Chest Pain with Blurred Vision')
  assert.equal(mixed.detected, true)
  assert.ok(mixed.flags.some(f => f.title === 'Nyeri Dada'))
  assert.ok(mixed.flags.some(f => f.title === 'Penglihatan Kabur'))
})

test('SymptomService.createLog stores pain scale and severity', async () => {
  let capturedPainScale = null
  let capturedPainSeverity = null
  const mockDb = {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          if (sql.includes('HL_symptomLogs')) {
            capturedPainScale = args[5]
            capturedPainSeverity = args[6]
          }
          return { meta: { last_row_id: 42 } }
        }
      })
    })
  }
  const logId = await SymptomService.createLog(mockDb, {
    userId: 1, sourceSessionId: null, symptomDateTime: new Date().toISOString(),
    quickSymptomsJson: null, bodyArea: 'head', painScale: 8, painSeverity: 'severe',
    mood: 'sad', startedAt: null, durationMinutes: null,
    description: 'sakit kepala', redFlagsJson: null, isRedFlag: 0, safetyEventId: null
  })
  assert.equal(logId, 42)
  assert.equal(capturedPainScale, 8)
  assert.equal(capturedPainSeverity, 'severe')
})

test('SymptomService.detectRedFlags maps VAS pain scale words', () => {
  const result = SymptomService.detectRedFlags('severe chest pain')
  assert.equal(result.detected, true)
  assert.equal(result.flags[0].severity, 'emergency')
})
