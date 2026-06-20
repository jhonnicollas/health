import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const DATABASE_ID = process.env.DATABASE_ID || 'b80ca989-6771-427f-a656-c7ab6ffc17ce'

if (!CLOUDFLARE_ACCOUNT_ID || !CLOUDFLARE_API_TOKEN) {
  console.error('Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN')
  process.exit(1)
}

const fileArg = process.argv[2] || '../docs/seed-rules.generated.sql'
const file = resolve(__dirname, fileArg)
const remote = process.argv.includes('--remote')

const sql = await readFile(file, 'utf8')
const stripped = sql
  .split('\n')
  .filter(l => !['BEGIN TRANSACTION;', 'COMMIT;', 'BEGIN TRANSACTION', 'COMMIT'].includes(l.trim()))
  .join('\n')

console.log(`Applying ${file} (${remote ? 'remote' : 'local'}) ...`)
const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${DATABASE_ID}/raw`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ sql: stripped })
})
const result = await res.json()
if (!result.success) {
  console.error('Seed failed:', JSON.stringify(result.errors || result, null, 2))
  process.exit(1)
}
const meta = result.result?.[0]?.meta
console.log(`Seed applied. rows_written=${meta?.rows_written} changes=${meta?.changes}`)
