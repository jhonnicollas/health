import assert from 'node:assert/strict'
import test from 'node:test'

// S5B-001: Hydration target calculator
test('Hydration target: default 2000ml when no data', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => null,
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.getOrCalculateTarget(mockDb, 1, '2026-06-25')
  assert.equal(result.targetMl, 2000)
  assert.ok(result.reasons.some(r => r.includes('default')))
})

test('Hydration target: bodyWeight × 30 from measurement', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  let bwQuery = false
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('bodyWeight') && !bwQuery) { bwQuery = true; return { finalValue: 70 } }
          if (sql.includes('hydrationSettings')) return null
          if (sql.includes('HL_hydrationTargets')) return null
          return null
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.getOrCalculateTarget(mockDb, 1, '2026-06-25')
  assert.equal(result.targetMl, 2100)
  assert.ok(result.reasons.some(r => r.includes('70') && r.includes('30')))
})

test('Hydration target: pregnant minimum 2400ml', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('bodyWeight') && sql.includes('measurementValues')) return { finalValue: 50 }
          if (sql.includes('hydrationSettings')) return { isPregnant: 1, isLactating: 0, customBaseTargetMl: null }
          if (sql.includes('HL_hydrationTargets')) return null
          return null
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.getOrCalculateTarget(mockDb, 1, '2026-06-25')
  assert.equal(result.targetMl, 2400)
  assert.ok(result.reasons.some(r => r.includes('2400') || r.includes('hamil')))
})

test('Hydration target: lactating minimum 2800ml', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('bodyWeight') && sql.includes('measurementValues')) return { finalValue: 60 }
          if (sql.includes('hydrationSettings')) return { isPregnant: 0, isLactating: 1, customBaseTargetMl: null }
          if (sql.includes('HL_hydrationTargets')) return null
          return null
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.getOrCalculateTarget(mockDb, 1, '2026-06-25')
  assert.equal(result.targetMl, 2800)
  assert.ok(result.reasons.some(r => r.includes('2800') || r.includes('menyusui')))
})

test('Hydration target: fever >37.5C adds 500ml', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  let tempQueried = false
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('bodyWeight')) return { finalValue: 70 }
          if (sql.includes('bodyTemperature') && !tempQueried) { tempQueried = true; return { finalValue: 38.2 } }
          if (sql.includes('hydrationSettings')) return { isPregnant: 0, isLactating: 0, customBaseTargetMl: null }
          if (sql.includes('HL_hydrationTargets')) return null
          return null
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.getOrCalculateTarget(mockDb, 1, '2026-06-25')
  assert.equal(result.targetMl, 2600)
  assert.ok(result.reasons.some(r => r.includes('500') && r.includes('37.5')))
})

test('Hydration target: custom base target override', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('hydrationSettings')) return { isPregnant: 0, isLactating: 0, customBaseTargetMl: 3000 }
          if (sql.includes('HL_hydrationTargets')) return null
          return null
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.getOrCalculateTarget(mockDb, 1, '2026-06-25')
  assert.equal(result.targetMl, 3000)
})

test('Overhydration: triggers at 5000ml absolute threshold', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  let safetyInsert = false
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => null,
        run: async () => {
          if (sql.includes('INSERT') && sql.includes('overhydrationWarning')) safetyInsert = true
          return { meta: { last_row_id: 42 } }
        }
      })
    })
  }
  const result = await HydrationService.checkOverhydration(mockDb, 1, '2026-06-25', 5100)
  assert.equal(result.triggered, true)
  assert.ok(safetyInsert)
})

test('Overhydration: does NOT trigger below 5000ml', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  const mockDb = {
    prepare: () => ({ bind: () => ({ first: async () => null, run: async () => ({ meta: {} }) }) })
  }
  const result = await HydrationService.checkOverhydration(mockDb, 1, '2026-06-25', 4999)
  assert.equal(result.triggered, false)
})

test('Overhydration: dedup safety event per day', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  let safetyInsert = false
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('HL_safetyEvents') && sql.includes('overhydrationWarning')) return { id: 5 }
          return null
        },
        run: async () => { safetyInsert = true; return { meta: { last_row_id: 5 } } }
      })
    })
  }
  const result = await HydrationService.checkOverhydration(mockDb, 1, '2026-06-25', 5500)
  assert.equal(result.triggered, true)
  assert.equal(result.safetyEventId, 5)
  assert.equal(safetyInsert, false)
})

test('HydrationService.logWater stores overLimitAtInsert flag', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  let capturedOverLimit = false
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => null,
        run: async () => {
          if (sql.includes('overLimitAtInsert')) capturedOverLimit = true
          return { meta: { last_row_id: 1 } }
        }
      })
    })
  }
  await HydrationService.logWater(mockDb, 1, 1500, 'web', undefined, undefined, true)
  assert.ok(capturedOverLimit)
})

test('Hydration target reason text covers all factors', async () => {
  const { HydrationService } = await import('../dist/services/hydration.js')
  const mockDb = {
    prepare: (sql) => ({
      bind: (..._args) => ({
        first: async () => {
          if (sql.includes('bodyWeight')) return { finalValue: 65 }
          if (sql.includes('bodyTemperature')) return { finalValue: 38.0 }
          if (sql.includes('hydrationSettings')) return { isPregnant: 1, isLactating: 0, customBaseTargetMl: null }
          if (sql.includes('HL_hydrationTargets')) return null
          return null
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { last_row_id: 1 } })
      })
    })
  }
  const result = await HydrationService.getOrCalculateTarget(mockDb, 1, '2026-06-25')
  assert.ok(result.reasons.length >= 3)
  assert.equal(result.targetMl, 2900)
})

// S5A OAuth state methods
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
