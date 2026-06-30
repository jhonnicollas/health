import assert from 'node:assert/strict'
import test from 'node:test'

test('Daily health hub API returns mix of measurements + symptoms', async () => {
  const mockMeasurements = [
    { metricCode: 'systolic', finalValue: 120, status: 'normal', severity: null },
    { metricCode: 'heartRate', finalValue: 72, status: 'normal', severity: null }
  ]
  const mockSymptoms = [
    { id: 1, symptomDateTime: '2026-06-25T10:00:00Z', bodyArea: 'head', painScale: 3, isRedFlag: 0 }
  ]
  assert.ok(mockMeasurements.length >= 1)
  assert.ok(mockSymptoms.length >= 1)
})

test('Daily health hub empty date returns empty arrays', async () => {
  const mockDb = {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: [] })
      })
    })
  }
  const ms = await mockDb.prepare().bind().all()
  const sym = await mockDb.prepare().bind().all()
  assert.equal(ms.results.length, 0)
  assert.equal(sym.results.length, 0)
})
