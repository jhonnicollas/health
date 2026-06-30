/**
 * CSS split test: verifies the monolithic App.css was replaced by the
 * expected set of smaller stylesheets and that App.tsx imports them in
 * the correct order.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = join(__dirname, '..', 'src')
const STYLES_DIR = join(SRC_DIR, 'styles')

const EXPECTED_IMPORTS = [
  './styles/base.css',
  './styles/layout.css',
  './styles/components.css',
  './styles/pages/device-selector.css',
  './styles/pages/measurement.css',
  './styles/pages/ai.css',
  './styles/pages/dashboard.css',
  './styles/pages/admin.css',
  './styles/pages/hydration.css',
  './styles/pages/daily-health.css',
  './styles/pages/telegram.css',
  './styles/pages/symptom.css',
  './styles/pages/cycle.css',
  './styles/pages/welcome.css',
  './styles/utilities.css',
  './styles/theme.css',
]

const EXPECTED_FILES = EXPECTED_IMPORTS.map((imp) =>
  imp.replace(/^\.\/styles\//, '')
)

describe('App.css split refactor', () => {
  it('removes the original monolithic App.css', () => {
    assert.strictEqual(
      existsSync(join(SRC_DIR, 'App.css')),
      false,
      'src/App.css should no longer exist'
    )
  })

  it('creates all expected stylesheet files', () => {
    for (const file of EXPECTED_FILES) {
      const path = join(STYLES_DIR, file)
      assert.strictEqual(
        existsSync(path),
        true,
        `${file} should exist`
      )
      const content = readFileSync(path, 'utf8')
      assert.ok(
        content.length > 0,
        `${file} should not be empty`
      )
    }
  })

  it('imports the split stylesheets in the original cascade order', () => {
    const appTsx = readFileSync(join(SRC_DIR, 'App.tsx'), 'utf8')
    const importLines = appTsx
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith("import '") && line.includes('/styles/'))

    assert.deepStrictEqual(
      importLines,
      EXPECTED_IMPORTS.map((imp) => `import '${imp}'`),
      'App.tsx should import the split stylesheets in order'
    )
  })
})
