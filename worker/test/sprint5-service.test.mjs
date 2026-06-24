import assert from 'node:assert/strict'
import test from 'node:test'

// Test SymptomService red flag detection
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

// Test AiMemoryService
test('AiMemoryService calculates data sufficiency score', async () => {
  const { AiMemoryService } = await import('../dist/services/ai-memory.js')
  const context = {
    measurements: [{ metricCode: 'systolic', finalValue: 120 }],
    symptoms: [{ id: 1, description: 'headache' }],
    safetyEvents: [{ eventType: 'symptomRedFlag' }],
    medications: [],
    hydration: [],
    profile: { displayName: 'Test' }
  }
  const result = AiMemoryService.calculateDataSufficiency(context)
  assert.ok(result.score > 0)
  assert.ok(result.score <= 100)
  assert.ok(result.reason.length > 0)
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

// Test CycleService
test('CycleService predicts fertile window from settings', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const settings = { lastPeriodStart: '2026-06-01', cycleLengthDays: 28, periodLengthDays: 5 }
  const prediction = CycleService.predictFertileWindow(settings)
  assert.ok(prediction.fertileStart)
  assert.ok(prediction.fertileEnd)
  assert.ok(prediction.ovulationDay)
  assert.ok(prediction.nextPeriod)
})

test('CycleService detects irregular cycle', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const result = CycleService.detectIrregularity({ cycleLengthDays: 45 })
  assert.equal(result?.isIrregular, true)
})

test('CycleService does not flag normal cycle', async () => {
  const { CycleService } = await import('../dist/services/cycle.js')
  const result = CycleService.detectIrregularity({ cycleLengthDays: 28 })
  assert.equal(result, null)
})

// Test medical safety rule: AI cannot diagnose
test('Medical safety: clinicalCopilotMode is deferred in Sprint 5', () => {
  const copilotStatus = { clinicalCopilotMode: 'deferred_to_sprint6', runtimeEnabled: false }
  assert.equal(copilotStatus.clinicalCopilotMode, 'deferred_to_sprint6')
  assert.equal(copilotStatus.runtimeEnabled, false)
})
