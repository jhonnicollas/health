/**
 * Missing-keys test: scans all locale files for duplicate keys within a namespace
 * and verifies that every key has both id-ID and en-US values.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = join(__dirname, '..', 'src', 'i18n', 'locales')

function extractRegisterCalls(content) {
  const calls = []
  // Match registerTranslations('namespace', { ... }) or registerTranslations('namespace', VARIABLE)
  const regex = /registerTranslations\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:\{([\s\S]*?)\}\s*\)|([A-Za-z_$][A-Za-z0-9_$]*)\s*\))/g
  let match
  while ((match = regex.exec(content)) !== null) {
    const namespace = match[1]
    let body = match[2]
    if (!body && match[3]) {
      // Resolve variable reference: const NAME = { ... }
      const varRegex = new RegExp(`(?:export\\s+)?const\\s+${match[3]}\\s*:\\s*[^=]+\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*;?`, 'g')
      const varMatch = varRegex.exec(content)
      if (!varMatch) continue
      body = varMatch[1]
    }
    if (!body) continue
    // Extract keys: keyName: { 'id-ID': '...', 'en-US': '...' }
    const keyRegex = /([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{\s*['"]id-ID['"]\s*:\s*['"`]([^'"`]*)['"`]\s*,\s*['"]en-US['"]\s*:\s*['"`]([^'"`]*)['"`]\s*\}/g
    let keyMatch
    const keys = {}
    while ((keyMatch = keyRegex.exec(body)) !== null) {
      const key = keyMatch[2]
      if (keys[key]) {
        calls.push({ namespace, key, duplicate: true })
      }
      keys[key] = {
        idID: keyMatch[3],
        enUS: keyMatch[4],
      }
    }
    calls.push({ namespace, keys })
  }
  return calls
}

describe('i18n locale files', () => {
  const files = readdirSync(LOCALES_DIR).filter(f => f.endsWith('.ts'))

  for (const file of files) {
    describe(file, () => {
      const content = readFileSync(join(LOCALES_DIR, file), 'utf-8')
      const calls = extractRegisterCalls(content)

      it('should have at least one registerTranslations call', () => {
        assert.ok(calls.length > 0, `${file} has no registerTranslations calls`)
      })

      for (const call of calls) {
        if (call.duplicate) {
          it(`should not have duplicate key "${call.key}" in namespace "${call.namespace}"`, () => {
            assert.fail(`Duplicate key "${call.key}" found in namespace "${call.namespace}" of ${file}`)
          })
          continue
        }

        if (call.keys) {
          for (const [key, val] of Object.entries(call.keys)) {
            it(`should have non-empty id-ID for ${call.namespace}.${key}`, () => {
              assert.ok(val.idID && val.idID.trim().length > 0, `${call.namespace}.${key} has empty id-ID in ${file}`)
            })
            it(`should have non-empty en-US for ${call.namespace}.${key}`, () => {
              assert.ok(val.enUS && val.enUS.trim().length > 0, `${call.namespace}.${key} has empty en-US in ${file}`)
            })
          }
        }
      }
    })
  }
})
