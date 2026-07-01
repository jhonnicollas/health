import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderBlockedTemplate } from '../../worker/ai/dist/safety/blockedTemplate.js'

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

function collectClinicalKeys() {
  const files = readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.ts'))
  const all = {}
  for (const file of files) {
    const keys = parseLocaleFile(file)
    for (const [key, val] of Object.entries(keys)) {
      if (key.startsWith('clinical')) {
        if (!all[key]) all[key] = {}
        all[key][file] = val
      }
    }
  }
  return all
}

test('S6I-T-10 at least 58 clinical.* keys exist in every locale file', () => {
  const clinicalKeys = collectClinicalKeys()
  assert.ok(Object.keys(clinicalKeys).length >= 58, `expected at least 58 clinical.* keys, got ${Object.keys(clinicalKeys).length}`)
  for (const [key, byFile] of Object.entries(clinicalKeys)) {
    for (const [file, val] of Object.entries(byFile)) {
      assert.ok(val.idID.trim().length > 0, `${file}.${key} id-ID is empty`)
      assert.ok(val.enUS.trim().length > 0, `${file}.${key} en-US is empty`)
    }
  }
})

test('S6I-T-10 ai.ts disclaimer text contains PRD §4.3 phrases in both locales', () => {
  const keys = parseLocaleFile('ai.ts')
  const disclaimerKeys = Object.keys(keys).filter((k) => /disclaimer/i.test(k))
  assert.ok(disclaimerKeys.length > 0, 'ai.ts should contain disclaimer keys')

  const idPhrases = ['ai dapat melakukan kesalahan', 'tidak boleh mengandalkan', 'tidak boleh percaya', 'tanggung jawab anda']
  const enPhrases = ['ai can make mistakes', 'do not rely on', 'do not trust', 'your own responsibility']

  let idFound = 0
  let enFound = 0
  for (const key of disclaimerKeys) {
    const val = keys[key]
    const idLower = val.idID.toLowerCase()
    const enLower = val.enUS.toLowerCase()
    if (idPhrases.every((p) => idLower.includes(p))) idFound++
    if (enPhrases.every((p) => enLower.includes(p))) enFound++
  }
  assert.ok(idFound > 0, 'id-ID disclaimer must contain all PRD §4.3 phrases')
  assert.ok(enFound > 0, 'en-US disclaimer must contain all PRD §4.3 phrases')
})

test('S6I-T-10 WhatsApp short disclaimer key exists in both locales', () => {
  const keys = parseLocaleFile('ai.ts')
  assert.ok(keys.clinicalWaDisclaimer, 'clinicalWaDisclaimer must exist in ai.ts')
  assert.ok(keys.clinicalWaDisclaimer.idID.trim().length > 0, 'clinicalWaDisclaimer id-ID empty')
  assert.ok(keys.clinicalWaDisclaimer.enUS.trim().length > 0, 'clinicalWaDisclaimer en-US empty')
})

test('S6I-T-10 blocked response template is bilingual and non-empty', () => {
  const id = renderBlockedTemplate('id')
  const en = renderBlockedTemplate('en')
  assert.ok(id && id.trim().length > 0, 'blocked template id must be non-empty')
  assert.ok(en && en.trim().length > 0, 'blocked template en must be non-empty')
  assert.ok(id.toLowerCase().includes('ai dapat melakukan kesalahan'), 'blocked template id missing disclaimer phrase')
  assert.ok(en.toLowerCase().includes('ai can make mistakes'), 'blocked template en missing disclaimer phrase')
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
