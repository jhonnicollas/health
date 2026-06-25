import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const workerTypesUrl = new URL('worker/src/shared-types/constants.ts', root)
const webTypesUrl = new URL('web/src/types/constants.ts', root)
const schemaUrl = new URL('docs_sprint5/03.SQL_SCHEMA_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql', root)
const seedUrl = new URL('docs_sprint5/04.SQL_SEED_SPRINT5_FINAL_REVISED_AI_SPRINT6_READY.sql', root)

const read = async (url) => readFile(url, 'utf8')

function constArray(source, name) {
  const match = source.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`))
  assert.ok(match, `${name} missing`)
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
}

function unique(values) {
  return [...new Set(values)].sort()
}

function insertBlock(source, tableName) {
  const match = source.match(new RegExp(`INSERT OR IGNORE INTO ${tableName}[\\s\\S]*?VALUES([\\s\\S]*?);`))
  assert.ok(match, `${tableName} seed block missing`)
  return match[1]
}

test('Sprint 5 type constants mirror schema and seed source of truth', async () => {
  const [workerTypes, webTypes, schema, seed] = await Promise.all([
    read(workerTypesUrl),
    read(webTypesUrl),
    read(schemaUrl),
    read(seedUrl)
  ])

  assert.equal(webTypes, workerTypes, 'web and worker Sprint 5 type files must stay mirrored')

  const schemaTables = unique([...schema.matchAll(/CREATE TABLE IF NOT EXISTS (HL_[A-Za-z0-9]+)/g)].map((item) => item[1]))
  assert.deepEqual(unique(constArray(workerTypes, 'HL_TABLES')), schemaTables)

  const roleCodes = unique([...insertBlock(seed, 'HL_roles').matchAll(/\('([^']+)',/g)].map((item) => item[1]))
  assert.deepEqual(unique(constArray(workerTypes, 'HL_ROLE_CODES')), roleCodes)

  const planCodes = unique([...insertBlock(seed, 'HL_plans').matchAll(/\('([^']+)',/g)].map((item) => item[1]))
  assert.deepEqual(unique(constArray(workerTypes, 'HL_PLAN_CODES')), planCodes)

  const permissionCodes = unique([...seed.matchAll(/\('((?:admin|feature|family)\.[^']+)',/g)].map((item) => item[1]))
  assert.deepEqual(unique(constArray(workerTypes, 'HL_PERMISSION_CODES')), permissionCodes)

  const featureCodes = unique(permissionCodes.filter((code) => code.startsWith('feature.')))
  assert.deepEqual(unique(constArray(workerTypes, 'HL_FEATURE_CODES')), featureCodes)

  const configKeys = unique([...seed.matchAll(/\('([A-Za-z][A-Za-z0-9]+)', '[^']*', '(?:boolean|number|string|json)',/g)]
    .map((item) => item[1])
    .filter((key) => !key.endsWith('Enabled') || key !== 'sprint5FoundationEnabled'))
  assert.deepEqual(unique(constArray(workerTypes, 'HL_CONFIG_KEYS')), configKeys)
})

test('Sprint 5 guards narrow only known seed values', async () => {
  const workerTypes = await read(workerTypesUrl)

  assert.ok(constArray(workerTypes, 'HL_ROLE_CODES').includes('superAdmin'))
  assert.ok(constArray(workerTypes, 'HL_PERMISSION_CODES').includes('admin.aiClinicalCopilot.manage'))
  assert.ok(constArray(workerTypes, 'HL_FEATURE_CODES').includes('feature.vectorMemory.use'))
  assert.ok(constArray(workerTypes, 'SAFETY_EVENT_SEVERITIES').includes('emergency'))
  assert.ok(constArray(workerTypes, 'TELEGRAM_CALLBACK_EVENT_TYPES').includes('hydrationQuickAdd'))
})
