import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../../', import.meta.url)
const workerTypesUrl = new URL('worker/apps/src/shared-types/constants.ts', root)
const webTypesUrl = new URL('web/src/types/constants.ts', root)
const schemaUrl = new URL('docs/07-schema.sql', root)
const seedUrl = new URL('docs/08-seed.sql', root)
const sprint6SeedUrl = new URL('worker/apps/migrations/005_sprint6_seed.sql', root)

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
  const match = source.match(new RegExp(`INSERT(?: OR IGNORE)? INTO ${tableName}[\\s\\S]*?VALUES([\\s\\S]*?);`))
  assert.ok(match, `${tableName} seed block missing`)
  return match[1]
}

test('Sprint 5 type constants mirror schema and seed source of truth', async () => {
  const [workerTypes, webTypes, schema, seed, sprint6Seed] = await Promise.all([
    read(workerTypesUrl),
    read(webTypesUrl),
    read(schemaUrl),
    read(seedUrl),
    read(sprint6SeedUrl)
  ])

  assert.equal(webTypes, workerTypes, 'web and worker Sprint 5 type files must stay mirrored')

  const schemaTables = unique([...schema.matchAll(/CREATE TABLE IF NOT EXISTS (HL_[A-Za-z0-9]+)/g)].map((item) => item[1]))
  assert.deepEqual(unique(constArray(workerTypes, 'HL_TABLES')), schemaTables)

  const combinedSeed = seed + '\n' + sprint6Seed

  // Seeded values must be present in constants; constants may also contain legacy values.
  const roleCodes = unique([...insertBlock(combinedSeed, 'HL_roles').matchAll(/\('([^']+)',/g)].map((item) => item[1]))
  const constRoleCodes = unique(constArray(workerTypes, 'HL_ROLE_CODES'))
  for (const code of roleCodes) assert.ok(constRoleCodes.includes(code), `seeded role ${code} missing from HL_ROLE_CODES`)

  const planCodes = unique([...insertBlock(combinedSeed, 'HL_plans').matchAll(/\('([^']+)',/g)].map((item) => item[1]))
  const constPlanCodes = unique(constArray(workerTypes, 'HL_PLAN_CODES'))
  for (const code of planCodes) assert.ok(constPlanCodes.includes(code), `seeded plan ${code} missing from HL_PLAN_CODES`)

  const permissionCodes = unique([...combinedSeed.matchAll(/\('((?:admin|feature|family)\.[^']+)',/g)].map((item) => item[1]))
  const constPermissionCodes = unique(constArray(workerTypes, 'HL_PERMISSION_CODES'))
  for (const code of permissionCodes) assert.ok(constPermissionCodes.includes(code), `seeded permission ${code} missing from HL_PERMISSION_CODES`)

  const featureCodes = unique(permissionCodes.filter((code) => code.startsWith('feature.')))
  const constFeatureCodes = unique(constArray(workerTypes, 'HL_FEATURE_CODES'))
  for (const code of featureCodes) assert.ok(constFeatureCodes.includes(code), `seeded feature ${code} missing from HL_FEATURE_CODES`)

  const configKeys = unique([...combinedSeed.matchAll(/\('([A-Za-z][A-Za-z0-9]+)', '[^']*', '(?:boolean|number|string|json)',/g)]
    .map((item) => item[1])
    .filter((key) => !key.endsWith('Enabled') || key !== 'sprint5FoundationEnabled'))
  const constConfigKeys = unique(constArray(workerTypes, 'HL_CONFIG_KEYS'))
  for (const key of configKeys) assert.ok(constConfigKeys.includes(key), `seeded config ${key} missing from HL_CONFIG_KEYS`)
})

test('Sprint 5 guards narrow only known seed values', async () => {
  const workerTypes = await read(workerTypesUrl)

  assert.ok(constArray(workerTypes, 'HL_ROLE_CODES').includes('superAdmin'))
  assert.ok(constArray(workerTypes, 'HL_PERMISSION_CODES').includes('admin.aiClinicalCopilot.manage'))
  assert.ok(constArray(workerTypes, 'HL_FEATURE_CODES').includes('feature.vectorMemory.use'))
  assert.ok(constArray(workerTypes, 'SAFETY_EVENT_SEVERITIES').includes('emergency'))
  assert.ok(constArray(workerTypes, 'TELEGRAM_CALLBACK_EVENT_TYPES').includes('hydrationQuickAdd'))
})
