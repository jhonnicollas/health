import http from 'k6/http'
import { check } from 'k6'

export const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8787'
export const TELEGRAM_WEBHOOK_SECRET = __ENV.TELEGRAM_WEBHOOK_SECRET || 'TEST_TELEGRAM_WEBHOOK_SECRET_PLACEHOLDER'
export const INTERNAL_CRON_SECRET = __ENV.INTERNAL_CRON_SECRET || 'TEST_INTERNAL_CRON_SECRET_PLACEHOLDER'

const SECRET_PATTERNS = ['sk-', 'xai-', 'ghp_', 'AKIA', '-----BEGIN', 'PRIVATE KEY']

export function register(email, password = 'Str0ngPass123!') {
  return http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    email, password, displayName: email.split('@')[0]
  }), { headers: { 'Content-Type': 'application/json' } })
}

export function login(email, password = 'Str0ngPass123!') {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
    redirects: 0
  })
  const cookie = res.headers['Set-Cookie'] || ''
  const match = cookie.match(/hlSession=([^;]+)/)
  return { res, session: match ? match[1] : null }
}

export function authHeaders(session) {
  return { Cookie: `hlSession=${session}`, 'Content-Type': 'application/json' }
}

export function assertNoSecretLeak(body) {
  const s = typeof body === 'string' ? body : (body || '').toString()
  for (const p of SECRET_PATTERNS) {
    if (s.includes(p)) return false
  }
  return true
}
