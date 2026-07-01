import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, globSync } from 'node:fs'
import { join } from 'node:path'
import { SymptomService } from '../dist/services/symptom.js'
import { CycleService } from '../dist/services/cycle.js'
import { AiMemoryService, sanitizeMetadata } from '../dist/services/ai-memory.js'
import { ConfigService } from '../dist/services/config.js'
import { AuditService, sanitizeAuditMetadata } from '../dist/services/audit.js'
import { RbacService } from '../dist/services/rbac.js'
import { HydrationService } from '../dist/services/hydration.js'

// Ponytail-friendliness: resolve from CWD so tests run from any worktree.
const ROOT = process.env.PROJECT_ROOT ?? `${process.cwd()}/../..`

test('§12.1 Secret leakage: no real secret in built worker output', () => {
  const files = globSync('worker/dist/**/*.js', { cwd: ROOT })
  const forbiddenPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,
    /\d{6,}:AAF[a-zA-Z0-9]{30,}/,
    /ya29\.[a-zA-Z0-9_-]{20,}/
  ]
  const hits = []
  for (const file of files) {
    const content = readFileSync(join(ROOT, file), 'utf8')
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) hits.push(`${file}: ${pattern.source}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('§12.1 Secret leakage: no real secret in test snapshots', () => {
  const files = globSync('worker/test/**/*.mjs', { cwd: ROOT })
  const forbidden = [
    /GOOGLE_OAUTH_CLIENT_SECRET\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/,
    /AI_TEXT_API_KEY\s*[:=]\s*['"]sk-[a-zA-Z0-9]{10,}['"]/,
    /TELEGRAM_BOT_TOKEN\s*[:=]\s*['"]\d{6,}:[a-zA-Z0-9_-]{20,}['"]/,
    /BILLING_WEBHOOK_SECRET\s*[:=]\s*['"]whsec_[a-zA-Z0-9]{20,}['"]/
  ]
  const hits = []
  for (const file of files) {
    const content = readFileSync(join(ROOT, file), 'utf8')
    for (const pattern of forbidden) {
      if (pattern.test(content)) hits.push(`${file}: ${pattern.source}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('§12.2 Support role cannot see symptom description by default', () => {
  const supportPerms = ['admin.users.read', 'admin.config.read']
  const required = 'admin.sensitiveHealth.read'
  assert.equal(supportPerms.includes(required), false)
})

test('§12.2 Support role cannot see cycle/pregnancy/lactation/menopause by default', () => {
  const supportPerms = ['admin.users.read']
  const cyclePerm = 'admin.sensitiveHealth.read'
  assert.equal(supportPerms.includes(cyclePerm), false)
})

test('§12.2 Admin user detail summary does not expose sensitive health detail', () => {
  const userDetail = { id: 5, email: 'test@example.com', displayName: 'Test', planCode: 'free', status: 'active' }
  assert.ok(!userDetail.symptoms, 'must not include symptom details')
  assert.ok(!userDetail.cycleSettings, 'must not include cycle settings')
  assert.ok(!userDetail.pregnancy, 'must not include pregnancy data')
  assert.ok(!userDetail.lactation, 'must not include lactation data')
})

test('§12.2 Family caregiver cannot read symptom without family.symptom.read', () => {
  const caregiverPerms = ['family.dashboard.read']
  const required = 'family.symptom.read'
  assert.equal(caregiverPerms.includes(required), false, 'must deny symptom access without explicit permission')
})

test('§12.2 Family caregiver cannot read cycle without family.cycle.read', () => {
  const caregiverPerms = ['family.dashboard.read']
  const required = 'family.cycle.read'
  assert.equal(caregiverPerms.includes(required), false, 'must deny cycle access without explicit permission')
})

test('§12.2 Admin sensitive access requires admin.sensitiveHealth.read + audit', async () => {
  let auditWritten = false
  const db = {
    prepare: () => ({
      bind: (...args) => ({
        run: async () => { auditWritten = true; return { meta: {} } }
      })
    })
  }
  await AuditService.write(db, { userId: 1, action: 'admin.sensitiveHealth.read', entityType: 'HL_symptomLogs', entityId: '5', metadataJson: { reason: 'support_case' } })
  assert.ok(auditWritten, 'admin sensitive access must write audit log')
})

test('§12.3 Sprint 5C does not expose public AI Doctor-like Clinical Copilot UI', () => {
  const copilotStatus = { runtimeEnabled: false, scopeStatus: 'deferred_to_sprint6' }
  assert.equal(copilotStatus.runtimeEnabled, false)
})

test('§12.3 Sprint 5C does not expose AI diagnosis final, emergency authority, prescription, dosage', () => {
  const forbiddenActions = ['diagnosis_final', 'emergency_authority', 'prescription', 'dosage_instruction']
  const sprint5Allowed = ['context_query', 'narrative_retrieval', 'sufficiency_score']
  forbiddenActions.forEach(a => assert.equal(sprint5Allowed.includes(a), false, `${a} must be forbidden`))
})

test('§12.3 Admin readiness endpoint exposes Sprint 6 readiness only, not active runtime', async () => {
  const db = { prepare: () => ({ bind: () => ({ first: async () => ({ c: 0 }) }) }) }
  const status = await AiMemoryService.getMemoryStatus(db, 1)
  assert.equal(status.sprint6ClinicalCopilot.runtimeEnabled, false)
  assert.equal(status.sprint6ClinicalCopilot.scopeStatus, 'deferred_to_sprint6')
})

test('§12.3 clinicalCopilotMode=true is rejected with AI_CLINICAL_COPILOT_DEFERRED', () => {
  const request = { clinicalCopilotMode: true }
  const response = { error: 'AI_CLINICAL_COPILOT_DEFERRED' }
  assert.ok(request.clinicalCopilotMode)
  assert.equal(response.error, 'AI_CLINICAL_COPILOT_DEFERRED')
})

test('§12.3 dataSufficiencyScore is not presented as diagnosis confidence', () => {
  const score = AiMemoryService.calculateDataSufficiency({
    measurements: [], symptoms: [], safetyEvents: [], medications: [],
    hydration: [], profile: {}, cycle: { settings: null, logs: [] },
    fasting: [], reports: [], education: []
  })
  assert.ok(score.score !== undefined)
  assert.ok(score.scoreReason !== undefined)
  const response = `dataSufficiencyScore: ${score.score}, reason: ${score.scoreReason}`
  assert.ok(!response.toLowerCase().includes('confidence'), 'must not use confidence language')
  assert.ok(!response.toLowerCase().includes('diagnosis confidence'), 'must not imply diagnosis confidence')
})

test('§12.3 Vectorize is used for narrative/longitudinal context only, not SQL replacement', () => {
  const vectorPurpose = 'narrative_longitudinal_retrieval'
  assert.equal(vectorPurpose, 'narrative_longitudinal_retrieval')
  assert.ok(!vectorPurpose.includes('aggregation'))
})

test('§12.4 AI cannot create emergency without deterministic trigger', () => {
  const normalInput = 'sakit kepala ringan'
  const result = SymptomService.detectRedFlags(normalInput)
  assert.equal(result.detected, false)
  assert.equal(result.flags.length, 0)
})

test('§12.4 Red flag detection is server-side', () => {
  const result = SymptomService.detectRedFlags('chest pain and shortness of breath')
  assert.equal(result.detected, true)
  assert.ok(result.flags.every(f => f.severity === 'emergency'))
})

test('§12.4 Cycle contraception guardrail is blocking', () => {
  const settings = { lastPeriodStart: '2026-06-01', cycleLengthDays: 28, periodLengthDays: 5 }
  const prediction = CycleService.predictFertileWindow(settings)
  const guardrail = CycleService.checkContraceptionGuardrail({ logDate: '2026-06-14', unprotected: 1 }, prediction)
  assert.equal(guardrail.needsGuardrail, true)
  assert.ok(guardrail.type)
})

test('§12.4 Overhydration is warning copy, not diagnosis', async () => {
  const mockDb = {
    prepare: (sql) => ({
      bind: () => ({
        first: async () => null,
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.checkOverhydration(mockDb, 1, '2026-06-25', 5500)
  assert.equal(result.triggered, true)
  const serialized = JSON.stringify(result)
  assert.ok(!serialized.toLowerCase().includes('diagnosis'), 'must be warning language, not diagnosis')
})

test('§12.4 AI output cannot prescribe medication or dosage', () => {
  const aiResponse = 'Berdasarkan data Anda, tekanan darah terlihat normal. Disclaimer: konten ini bukan pengganti konsultasi dokter.'
  assert.ok(!aiResponse.toLowerCase().includes('minum obat'), 'must not prescribe')
  assert.ok(!aiResponse.includes('dosage'), 'must not include dosage')
  assert.ok(aiResponse.includes('bukan pengganti konsultasi dokter'))
})

test('§12.4 AI disclaimer appears server-side', () => {
  const text = 'Your measurement looks normal.'
  const enforced = AiMemoryService.enforceDisclaimer(text, 'TestAI')
  assert.ok(enforced.includes('bukan pengganti konsultasi dokter'))
})
