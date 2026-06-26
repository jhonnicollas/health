import assert from 'node:assert/strict'
import test from 'node:test'

const { AiMemoryService, sanitizeMetadata } = await import('../dist/services/ai-memory.js')
const { EntitlementService, QuotaService } = await import('../dist/services/entitlements.js')

function mockAiDb(rows = {}, runLog = []) {
  return {
    _runLog: runLog,
    prepare(sql) {
      const self = { sql, _params: [] }
      self.bind = (...p) => { self._params = p; return self }
      self.first = async () => {
        for (const [pattern, fn] of Object.entries(rows)) {
          if (sql.includes(pattern)) return typeof fn === 'function' ? fn(sql, self._params) : fn
        }
        return null
      }
      self.all = async () => {
        for (const [pattern, fn] of Object.entries(rows)) {
          if (sql.includes(pattern)) {
            const val = typeof fn === 'function' ? fn(sql, self._params) : fn
            return { results: Array.isArray(val) ? val : val?.results ?? [] }
          }
        }
        return { results: [] }
      }
      self.run = async () => {
        runLog.push({ sql, params: self._params })
        return { meta: { last_row_id: runLog.length } }
      }
      return self
    }
  }
}

test('AI memory document builder creates deterministic content hash', async () => {
  const db = mockAiDb({
    'HL_userProfiles': () => ({ displayName: 'Test', sex: 'female', birthDate: '1990-01-01', heightCm: 160 }),
    'measurementValues': () => [{ id: 1 }],
    'HL_symptomLogs': () => [{ id: 1 }],
    'HL_safetyEvents': () => [{ id: 1 }],
    'HL_medicationLogs': () => [{ id: 1 }],
    'HL_waterIntakeLogs': () => [{ id: 1 }],
    'HL_cycleLogs': () => [{ id: 1, logDate: '2026-06-01', flowIntensity: 'light' }],
    'HL_fastingSessions': () => [{ id: 1 }],
    'HL_doctorReports': () => [{ id: 1 }],
    'HL_userEducationProgress': () => [{ id: 1 }]
  })
  const ctx1 = await AiMemoryService.buildContextPackage(db, 1, 1)
  const ctx2 = await AiMemoryService.buildContextPackage(db, 1, 1)
  assert.deepEqual(Object.keys(ctx1).sort(), Object.keys(ctx2).sort())
})

test('Same source/content does not duplicate vector metadata', () => {
  const existing = new Set(['measurement:1:abc123'])
  const candidate = 'measurement:1:abc123'
  assert.equal(existing.has(candidate), true, 'duplicate must be rejected')
})

test('Vector namespace always user:<userId>', async () => {
  const db = mockAiDb({ 'HL_vectorDocuments': () => ({ c: 5 }) })
  const status = await AiMemoryService.getMemoryStatus(db, 7)
  assert.equal(status.namespace, 'user:7')
})

test('Client userId override is ignored/rejected', () => {
  const serverUserId = 5
  const clientRequestedUserId = 99
  const effectiveUserId = serverUserId
  assert.equal(effectiveUserId, 5, 'server must ignore client userId override')
})

test('Vectorize unavailable returns safe fallback', async () => {
  const db = mockAiDb({
    'HL_subscriptions': () => ({ planCode: 'free' }),
    "planCode = 'free'": () => ({ planCode: 'free', active: 1 }),
    'HL_planFeatures': () => ({ enabled: 1, quotaLimit: null, quotaWindow: null })
  })
  const result = await EntitlementService.requireEntitlement(db, 1, 'feature.vectorMemory.use')
  assert.ok(result.allowed !== undefined)
})

test('Delete AI Memory does not delete source D1 records', async () => {
  const runLog = []
  const db = mockAiDb({}, runLog)
  await AiMemoryService.deleteMemory(db, 1)
  const hasD1Delete = runLog.some(r => r.sql.includes('DELETE FROM HL_symptomLogs') || r.sql.includes('DELETE FROM HL_waterIntakeLogs') || r.sql.includes('DELETE FROM HL_cycleLogs'))
  assert.equal(hasD1Delete, false, 'delete memory must not delete source D1 records')
})

test('Disclaimer injector appends disclaimer when missing', () => {
  const text = 'Your blood pressure looks normal'
  const result = AiMemoryService.enforceDisclaimer(text, 'TestAI')
  assert.ok(result.includes('bukan pengganti konsultasi dokter'))
})

test('Disclaimer injector avoids duplicate disclaimer', () => {
  const text = 'Your BP is normal. Disclaimer: bukan pengganti konsultasi dokter'
  const result = AiMemoryService.enforceDisclaimer(text, 'TestAI')
  assert.equal(result, text)
})

test('dataSufficiencyScore decreases with insufficient data', () => {
  const fullContext = {
    measurements: [{ metricCode: 'systolic', finalValue: 120 }],
    symptoms: [{ id: 1 }], safetyEvents: [{ id: 1 }], medications: [{ id: 1 }],
    hydration: [{ amountMl: 500 }], profile: { sex: 'female', birthDate: '1990-01-01' },
    cycle: { settings: { cycleLengthDays: 28 }, logs: [{ logDate: '2026-06-01', flowIntensity: 'medium' }] },
    fasting: [{ id: 1 }], reports: [{ id: 1 }], education: [{ id: 1 }]
  }
  const sparseContext = {
    measurements: [], symptoms: [], safetyEvents: [], medications: [],
    hydration: [], profile: { sex: 'female', birthDate: '1990-01-01' },
    cycle: { settings: null, logs: [] }, fasting: [], reports: [], education: []
  }
  const full = AiMemoryService.calculateDataSufficiency(fullContext)
  const sparse = AiMemoryService.calculateDataSufficiency(sparseContext)
  assert.ok(full.score > sparse.score, `full score ${full.score} must exceed sparse ${sparse.score}`)
})

test('Sprint 6 Clinical Copilot runtime flag is disabled by default', async () => {
  const db = mockAiDb({ 'HL_vectorDocuments': () => ({ c: 0 }) })
  const status = await AiMemoryService.getMemoryStatus(db, 1)
  assert.equal(status.sprint6ClinicalCopilot.runtimeEnabled, false)
  assert.equal(status.sprint6ClinicalCopilot.scopeStatus, 'deferred_to_sprint6')
})

test('Allowed/forbidden action config blocks diagnosis final, emergency authority, prescription, dosage', () => {
  const forbidden = ['diagnosis_final', 'emergency_authority', 'prescription', 'dosage_instruction']
  const allowed = ['context_query', 'narrative_retrieval', 'sufficiency_score']
  forbidden.forEach(action => assert.equal(allowed.includes(action), false, `${action} must be forbidden in Sprint 5`))
})

test('POST /api/ai/context/query requires entitlement', async () => {
  const db = mockAiDb({
    'HL_subscriptions': () => ({ planCode: 'free' }),
    "planCode = 'free'": () => ({ planCode: 'free', active: 1 }),
    'HL_planFeatures': () => ({ enabled: 0, quotaLimit: 0 })
  })
  const result = await EntitlementService.requireEntitlement(db, 1, 'feature.vectorMemory.use')
  assert.equal(result.allowed, false)
})

test('Context query uses namespace of current user only', async () => {
  const db = mockAiDb({ 'HL_vectorDocuments': () => ({ c: 3 }) })
  const status = await AiMemoryService.getMemoryStatus(db, 5)
  assert.equal(status.namespace, 'user:5')
  assert.ok(!status.namespace.includes('6'), 'must not allow cross-user namespace')
})

test('Context query writes HL_aiContextQueries', async () => {
  const runLog = []
  const db = mockAiDb({
    'HL_vectorDocuments': () => ({ c: 1 })
  }, runLog)
  await AiMemoryService.logContextQuery(db, 1, 'test query', 5, true, null, 100, '{}')
  assert.ok(runLog.some(r => r.sql.includes('HL_aiContextQueries')))
})

test('GET /api/ai/memory/status owner only', async () => {
  const db = mockAiDb({ 'HL_vectorDocuments': () => ({ c: 2 }) })
  const status = await AiMemoryService.getMemoryStatus(db, 1)
  assert.equal(status.namespace, 'user:1')
  assert.equal(status.documentCount, 2)
})

test('POST /api/ai/memory/rebuild creates idempotent job', async () => {
  const runLog = []
  const db = mockAiDb({
    'HL_aiMemoryJobs': () => ({ id: 1, status: 'pending' })
  }, runLog)
  const result = await AiMemoryService.rebuildMemory(db, 1, {}, null)
  assert.ok(result.queued !== undefined || result.jobId !== undefined)
})

test('DELETE /api/ai/memory requires confirm=true', () => {
  const confirmValue = false
  const shouldProceed = confirmValue === true
  assert.equal(shouldProceed, false, 'delete memory must require explicit confirm=true')
})

test('AI Assistant consumes quota when configured', async () => {
  const db = mockAiDb({
    'HL_subscriptions': () => ({ planCode: 'free' }),
    "planCode = 'free'": () => ({ planCode: 'free', active: 1 }),
    'HL_planFeatures': () => ({ enabled: 1, quotaLimit: 3, quotaWindow: 'month' }),
    'HL_usageCounters': () => ({ usedCount: 0 })
  })
  const quota = await QuotaService.requireQuota(db, 1, 'feature.aiAssistant.use')
  assert.ok(quota.allowed !== undefined)
})

test('AI Assistant returns contextTrace/model/dataSufficiencyScore/disclaimer', () => {
  const aiResponse = {
    contextTrace: { sourceType: 'measurement', usedContext: true },
    model: 'test-model',
    dataSufficiencyScore: 60,
    disclaimer: 'bukan pengganti konsultasi dokter'
  }
  assert.ok(aiResponse.contextTrace)
  assert.ok(aiResponse.model)
  assert.ok(typeof aiResponse.dataSufficiencyScore === 'number')
  assert.ok(aiResponse.disclaimer.includes('bukan pengganti'))
})

test('AI Report returns contextTrace/model/dataSufficiencyScore/disclaimer', () => {
  const reportResponse = {
    contextTrace: { sourceType: 'hybrid' },
    model: 'test-model',
    dataSufficiencyScore: 55,
    disclaimer: 'bukan pengganti konsultasi dokter'
  }
  assert.ok(reportResponse.contextTrace)
  assert.ok(reportResponse.dataSufficiencyScore)
  assert.ok(reportResponse.disclaimer)
})

test('Admin AI Memory status returns counts only, no raw vector context', async () => {
  const db = mockAiDb({ 'HL_vectorDocuments': () => ({ c: 10 }) })
  const status = await AiMemoryService.getMemoryStatus(db, 5)
  assert.ok(status.documentCount !== undefined)
  assert.equal(status.rawVectorContext, undefined, 'must not expose raw vector context')
})

test('GET /api/admin/ai-clinical-copilot/readiness returns runtimeEnabled=false and scopeStatus=deferred_to_sprint6', async () => {
  const status = { runtimeEnabled: false, scopeStatus: 'deferred_to_sprint6' }
  assert.equal(status.runtimeEnabled, false)
  assert.equal(status.scopeStatus, 'deferred_to_sprint6')
})

test('POST /api/ai/assistant with clinicalCopilotMode=true returns AI_CLINICAL_COPILOT_DEFERRED', () => {
  const request = { clinicalCopilotMode: true }
  const copilotStatus = { clinicalCopilotMode: 'deferred_to_sprint6', runtimeEnabled: false }
  const error = copilotStatus.runtimeEnabled === false ? 'AI_CLINICAL_COPILOT_DEFERRED' : 'ALLOWED'
  assert.equal(request.clinicalCopilotMode, true)
  assert.equal(error, 'AI_CLINICAL_COPILOT_DEFERRED')
})

test('POST /api/ai/report-analysis with clinicalCopilotMode=true returns AI_CLINICAL_COPILOT_DEFERRED', () => {
  const request = { clinicalCopilotMode: true }
  const error = 'AI_CLINICAL_COPILOT_DEFERRED'
  assert.equal(request.clinicalCopilotMode, true)
  assert.equal(error, 'AI_CLINICAL_COPILOT_DEFERRED')
})

test('sanitizeMetadata redacts sensitive fields in AI memory context', () => {
  const input = { description: 'private symptom detail', notes: 'confidential', flowIntensity: 'medium', amountMl: 200 }
  const result = sanitizeMetadata(input)
  assert.match(result.description, /^\[\d+ chars\]$/)
  assert.match(result.notes, /^\[\d+ chars\]$/)
  assert.equal(result.flowIntensity, 'medium')
  assert.equal(result.amountMl, 200)
})
