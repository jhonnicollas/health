import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales')

function parseLocaleFile(fileName) {
  const content = readFileSync(join(LOCALES_DIR, fileName), 'utf-8')
  const keyRegex = /([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{\s*['"]id-ID['"]\s*:\s*['"`]([^'"`]*)['"`]\s*,\s*['"]en-US['"]\s*:\s*['"`]([^'"`]*)['"`]\s*\}/g
  const keys = {}
  let match
  while ((match = keyRegex.exec(content)) !== null) {
    keys[match[2]] = { idID: match[3], enUS: match[4] }
  }
  return keys
}

test('S6I-T-10 ai.ts has both locales populated and no empty strings', () => {
  const keys = parseLocaleFile('ai.ts')
  assert.ok(Object.keys(keys).length >= 40, `ai.ts should have many keys, got ${Object.keys(keys).length}`)
  for (const [key, val] of Object.entries(keys)) {
    assert.ok(val.idID.trim().length > 0, `ai.${key} id-ID is empty`)
    assert.ok(val.enUS.trim().length > 0, `ai.${key} en-US is empty`)
  }
})

test('S6I-T-10 admin.ts has both locales populated and no empty strings', () => {
  const keys = parseLocaleFile('admin.ts')
  assert.ok(Object.keys(keys).length >= 30, `admin.ts should have many keys, got ${Object.keys(keys).length}`)
  for (const [key, val] of Object.entries(keys)) {
    assert.ok(val.idID.trim().length > 0, `admin.${key} id-ID is empty`)
    assert.ok(val.enUS.trim().length > 0, `admin.${key} en-US is empty`)
  }
})

test('S6I-T-10 ai.ts disclaimer text is present in both locales', () => {
  const keys = parseLocaleFile('ai.ts')
  const disclaimerKeys = Object.keys(keys).filter((k) => /disclaimer|safetyNote|responsibility|tanggung/i.test(k))
  assert.ok(disclaimerKeys.length > 0, 'ai.ts should contain disclaimer/safety related keys')
  let found = false
  for (const key of disclaimerKeys) {
    const val = keys[key]
    const idHas = /ai|kesalahan|mistakes|responsibility|tanggung|dokter|doctor/i.test(val.idID)
    const enHas = /ai|mistakes|responsibility|doctor/i.test(val.enUS)
    if (idHas && enHas) found = true
  }
  assert.ok(found, 'ai.ts must contain at least one disclaimer key with id-ID and en-US disclaimer keywords')
})

test('S6I-T-10 all locale .ts files have id-ID and en-US for every key', () => {
  const files = ['ai.ts', 'admin.ts', 'alerts.ts', 'auth.ts', 'billing.ts', 'caregiver.ts', 'common.ts', 'cycle.ts', 'dashboard.ts', 'doctor.ts', 'emergency.ts', 'errors.ts', 'family.ts', 'fasting.ts', 'history.ts', 'hydration.ts', 'kb.ts', 'measurement.ts', 'medications.ts', 'metrics.ts', 'nav.ts', 'onboarding.ts', 'patterns.ts', 'reminders.ts', 'reports.ts', 'settings.ts', 'symptom.ts']
  for (const file of files) {
    const keys = parseLocaleFile(file)
    for (const [key, val] of Object.entries(keys)) {
      assert.ok(val.idID.trim().length > 0, `${file}.${key} id-ID empty`)
      assert.ok(val.enUS.trim().length > 0, `${file}.${key} en-US empty`)
    }
  }
})
