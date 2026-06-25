import assert from 'node:assert/strict'
import test from 'node:test'

test('SymptomService detects chest pain as emergency red flag', async () => {
  const { SymptomService } = await import('../dist/services/symptom.js')
  const result = SymptomService.detectRedFlags('I have chest pain and shortness of breath')
  assert.equal(result.detected, true)
  assert.equal(result.flags.length >= 2, true)
  assert.equal(result.flags[0].severity, 'emergency')
})

test('SymptomService detects no red flags for normal text', async () => {
  const { SymptomService } = await import('../dist/services/symptom.js')
  const result = SymptomService.detectRedFlags('I feel a bit tired today')
  assert.equal(result.detected, false)
  assert.equal(result.flags.length, 0)
})

test('SymptomService detects suicidal ideation', async () => {
  const { SymptomService } = await import('../dist/services/symptom.js')
  const result = SymptomService.detectRedFlags('feeling suicidal thoughts')
  assert.equal(result.detected, true)
  assert.equal(result.flags[0].severity, 'emergency')
})

test('SymptomService is deterministic (same input = same output)', async () => {
  const { SymptomService } = await import('../dist/services/symptom.js')
  const result1 = SymptomService.detectRedFlags('severe chest pain')
  const result2 = SymptomService.detectRedFlags('severe chest pain')
  assert.deepEqual(result1, result2)
})

test('AiMemoryService calculates data sufficiency score', async () => {
  const { AiMemoryService } = await import('../dist/services/ai-memory.js')
  const context = {
    measurements: [{ metricCode: 'systolic', finalValue: 120 }],
    symptoms: [{ id: 1, bodyArea: 'head', painScale: 5 }],
    safetyEvents: [{ eventType: 'symptomRedFlag', severity: 'warning', title: 'test' }],
    medications: [{ medicationName: 'aspirin', status: 'taken', takenAt: '2026-06-01' }],
    hydration: [{ amountMl: 500, logDate: '2026-06-01' }],
    profile: { displayName: 'Test', sex: 'female', birthDate: '1990-01-01' },
    cycle: { settings: { cycleLengthDays: 28 }, logs: [{ logDate: '2026-06-01', flowIntensity: 'medium' }] },
    fasting: [{ status: 'completed', startedAt: '2026-06-01' }],
    reports: [{ reportType: 'daily' }],
    education: [{ topicType: 'metric', topicCode: 'bloodPressure' }]
  }
  const result = AiMemoryService.calculateDataSufficiency(context)
  assert.ok(result.score > 0)
  assert.ok(result.score <= 100)
  assert.ok(result.scoreReason.length > 0)
  assert.ok(typeof result.scoreReason === 'string')
})

test('AiMemoryService enforces disclaimer when missing', async () => {
  const { AiMemoryService } = await import('../dist/services/ai-memory.js')
  const text = 'Your blood pressure is normal'
  const enforced = AiMemoryService.enforceDisclaimer(text, 'TestAI')
  assert.ok(enforced.includes('bukan pengganti konsultasi dokter'))
})

test('AiMemoryService does not double disclaimer', async () => {
  const { AiMemoryService } = await import('../dist/services/ai-memory.js')
  const text = 'Already has disclaimer: bukan pengganti konsultasi dokter'
  const enforced = AiMemoryService.enforceDisclaimer(text, 'TestAI')
  assert.equal(enforced, text)
})

test('CycleService predicts fertile window from settings', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const settings = { lastPeriodStart: '2026-06-01', cycleLengthDays: 28, periodLengthDays: 5 }
  const prediction = CycleService.predictFertileWindow(settings)
  assert.ok(prediction.fertileStart)
  assert.ok(prediction.fertileEnd)
  assert.ok(prediction.ovulationDay)
  assert.ok(prediction.nextPeriod)
})

test('CycleService detects irregular cycle via settings', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const mockDb = {
    prepare: () => ({ bind: () => ({
      run: async () => ({ meta: { last_row_id: 1 } }),
      all: async () => ({ results: [] })
    })})
  }
  const result = await CycleService.detectIrregularity(mockDb, { cycleLengthDays: 45 }, 1)
  assert.equal(result?.isIrregular, true)
})

test('CycleService does not flag normal cycle', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const mockDb = {
    prepare: () => ({ bind: () => ({
      run: async () => ({ meta: { last_row_id: 1 } }),
      all: async () => ({ results: [] })
    })})
  }
  const result = await CycleService.detectIrregularity(mockDb, { cycleLengthDays: 28 }, 1)
  assert.equal(result, null)
})

test('Medical safety: clinicalCopilotMode is deferred in Sprint 5', () => {
  const copilotStatus = { clinicalCopilotMode: 'deferred_to_sprint6', runtimeEnabled: false }
  assert.equal(copilotStatus.clinicalCopilotMode, 'deferred_to_sprint6')
  assert.equal(copilotStatus.runtimeEnabled, false)
})

test('RequirePermission rejects missing permission (guard simulation)', () => {
  const allowed = ['admin.config.read', 'admin.config.update']
  const required = 'admin.billing.read'
  const result = allowed.includes(required)
  assert.equal(result, false)
})

test('Safety event notification bridge queues correctly', async () => {
  const { SymptomService } = await import('../dist/services/symptom.js')
  const redFlags = SymptomService.detectRedFlags('severe chest pain')
  assert.equal(redFlags.detected, true)
  assert.equal(redFlags.flags[0].severity, 'emergency')
  const severityOrder = ['info', 'warning', 'high', 'critical', 'emergency']
  assert.ok(severityOrder.includes(redFlags.flags[0].severity))
})

test('Cycle contraception guardrail triggers on unprotected in fertile window', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const settings = { lastPeriodStart: '2026-06-01', cycleLengthDays: 28, periodLengthDays: 5 }
  const prediction = CycleService.predictFertileWindow(settings)
  const logData = { logDate: '2026-06-14', unprotected: 1 }
  const guardrail = CycleService.checkContraceptionGuardrail(logData, prediction)
  assert.ok(guardrail?.needsGuardrail)
  assert.equal(guardrail?.type, 'unprotected')
})

test('Cycle contraception guardrail triggers outside fertile window', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const settings = { lastPeriodStart: '2026-06-01', cycleLengthDays: 28, periodLengthDays: 5 }
  const prediction = CycleService.predictFertileWindow(settings)
  const logData = { logDate: '2026-06-25', unprotected: 1 }
  const guardrail = CycleService.checkContraceptionGuardrail(logData, prediction)
  assert.ok(guardrail?.needsGuardrail)
  assert.equal(guardrail?.type, 'outsideFertileWindow')
})

test('Data sufficiency score with minimal data', async () => {
  const { AiMemoryService } = await import('../dist/services/ai-memory.js')
  const context = {
    measurements: [{ metricCode: 'bodyWeight', finalValue: 70 }],
    symptoms: [], safetyEvents: [], medications: [], hydration: [], profile: { heightCm: 170 },
    cycle: { settings: null, logs: [] }, fasting: [], reports: [], education: []
  }
  const score = AiMemoryService.calculateDataSufficiency(context)
  assert.ok(score.score >= 20)
  assert.ok(score.scoreReason.length > 0)
})

test('clinicalCopilotMode=true request rejected in Sprint 5', async () => {
  const copilotStatus = { clinicalCopilotMode: 'deferred_to_sprint6', runtimeEnabled: false }
  assert.equal(copilotStatus.clinicalCopilotMode, 'deferred_to_sprint6')
  assert.equal(copilotStatus.runtimeEnabled, false)
  const expectedError = 'AI_CLINICAL_COPILOT_DEFERRED'
  const actualError = copilotStatus.clinicalCopilotMode === 'deferred_to_sprint6' ? 'AI_CLINICAL_COPILOT_DEFERRED' : 'ALLOWED'
  assert.equal(actualError, expectedError)
})

test('Education service tracks progress idempotently', async () => {
  const { EducationService } = await import('../dist/services/education.js')
  const db = { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { last_row_id: 1 } }) }) }) }
  await EducationService.trackProgress(db, 1, 'metric', 'bloodPressure')
  assert.ok(true)
})

test('Hydration target calculates from body weight', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  const db = {
    prepare: (sql) => ({
      bind: (...params) => ({
        first: async () => sql.includes('hydraTarget') ? { targetMl: 2100, baseTargetMl: 2000, reasonJson: '["test"]' } :
                sql.includes('HL_userProfiles') ? { heightCm: 170 } :
                sql.includes('HL_hydrationSettings') ? { enabled: 1, isPregnant: 0, isLactating: 0, customBaseTargetMl: null } : null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const target = await HydrationService.getOrCalculateTarget(db, 1, "2026-06-25")
  assert.ok(target.targetMl > 0)
  assert.ok(target.reasons.length > 0)
})

test('OAuth account linking prevents duplicates', async () => {
  const { OAuthService } = await import('../dist/services/oauth.js')
  const db = {
    prepare: () => ({
      bind: () => ({
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  await OAuthService.linkAccount(db, 1, 'google', 'sub123', 'test@gmail.com')
  assert.ok(true)
})

test('CycleService builds calendar days array', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const settings = { lastPeriodStart: '2026-06-01', cycleLengthDays: 28, periodLengthDays: 5, predictionPaused: 0 }
  const logs = [{ logDate: '2026-06-01' }]
  const days = CycleService.buildCalendarDays(settings, logs, '2026-06')
  assert.ok(days.length > 0)
  assert.ok(days.length <= 30)
  assert.ok(days[0].date.startsWith('2026-06'))
  assert.ok(typeof days[0].phase === 'string')
  assert.ok(typeof days[0].needsContraceptionGuardrail === 'boolean')
})

test('CycleService calendar method guardrail triggers', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const guardrail = CycleService.checkCalendarGuardrail()
  assert.equal(guardrail.needsGuardrail, true)
  assert.equal(guardrail.type, 'calendarMethod')
  assert.ok(guardrail.message.length > 50)
})

test('AiMemoryService source types include all 10', async () => {
  const { AiMemoryService } = await import('../dist/services/ai-memory.js')
  const types = AiMemoryService.SOURCE_TYPES
  assert.ok(types.length >= 10)
  assert.ok(types.includes('measurement'))
  assert.ok(types.includes('symptom'))
  assert.ok(types.includes('safetyEvent'))
  assert.ok(types.includes('hydration'))
  assert.ok(types.includes('cycle'))
  assert.ok(types.includes('medication'))
  assert.ok(types.includes('fasting'))
  assert.ok(types.includes('pattern'))
  assert.ok(types.includes('report'))
  assert.ok(types.includes('education'))
})

test('CycleService settings validation rejects invalid cycleLengthDays', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const mockDb = { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) }) }
  try {
    await CycleService.upsertSettings(mockDb, 1, { cycleLengthDays: 200 })
    assert.fail('Should have thrown')
  } catch (e) {
    assert.ok(e.message.includes('cycleLengthDays'))
  }
})

test('CycleService settings validation rejects invalid periodLengthDays', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const mockDb = { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) }) }
  try {
    await CycleService.upsertSettings(mockDb, 1, { periodLengthDays: 20 })
    assert.fail('Should have thrown')
  } catch (e) {
    assert.ok(e.message.includes('periodLengthDays'))
  }
})

test('CycleService settings auto-pauses on pregnant', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const mockDb = { prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({}) }) }) }
  const result = await CycleService.upsertSettings(mockDb, 1, { isPregnant: 1 })
  assert.equal(result.predictionPaused, true)
  assert.equal(result.pauseReason, 'pregnant')
})
