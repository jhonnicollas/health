import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, assertNoSecretLeak, TELEGRAM_WEBHOOK_SECRET } from './lib.js'

export const options = {
  scenarios: {
    abuse: {
      executor: 'constant-vus',
      vus: 200,
      duration: '15m',
      tags: { load: 'abuse' }
    }
  },
  thresholds: { http_req_failed: ['rate<0.05'] }
}

export default function () {
  const fakeSession = 'fake-session-token-' + __VU
  const h = { Cookie: `hlSession=${fakeSession}`, 'Content-Type': 'application/json' }

  const abuseExpected4xx = { expectedStatuses: [401, 403, 429] }

  check(http.get(`${BASE_URL}/api/me/entitlements`, { headers: h, ...abuseExpected4xx }), {
    'abuse entitlements rejected': r => r.status === 401
  })

  check(http.post(`${BASE_URL}/api/hydration/logs`, JSON.stringify({ amountMl: 200 }), { headers: h, ...abuseExpected4xx }), {
    'abuse hydration rejected': r => r.status === 401,
    'no water log for invalid': r => r.status === 401
  })

  check(http.get(`${BASE_URL}/api/dashboard/daily-health`, { headers: h, ...abuseExpected4xx }), {
    'abuse daily-health rejected': r => r.status === 401
  })

  check(http.post(`${BASE_URL}/api/webhook/telegram/water`, JSON.stringify({ callback_query: { id: 'abuse-1', from: { id: 1 }, data: 'water_200' } }), {
    headers: { 'Content-Type': 'application/json', 'X-HL-Telegram-Water-Secret': 'wrong-secret' },
    expectedStatuses: [403]
  }), {
    'abuse telegram invalid secret 403': r => r.status === 403,
    'no secret echo': r => assertNoSecretLeak(r.body)
  })

  check(http.post(`${BASE_URL}/api/auth/login/start`, JSON.stringify({ email: 'nonexistent@example.test', password: 'wrong' }), {
    headers: { 'Content-Type': 'application/json' },
    expectedStatuses: [401, 429]
  }), {
    'abuse login invalid rejected': r => r.status === 401 || r.status === 429,
    'no secret in error': r => assertNoSecretLeak(r.body)
  })
}
