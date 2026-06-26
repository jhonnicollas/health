import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak } from './lib.js'

export const options = {
  scenarios: {
    cycle_read: { executor: 'constant-vus', vus: 50, duration: '15m', tags: { scenario: 'D-ST-001' } }
  },
  thresholds: { 'http_req_duration{endpoint:cycle-calendar}': ['p(95)<700'], 'http_req_failed{endpoint:cycle-calendar}': ['rate<0.01'] }
}

export function setup() {
  const users = []
  for (let i = 1; i <= 50; i++) {
    const email = `d-st-001-${i}@example.test`
    register(email)
    const { session } = login(email)
    if (session) users.push({ email, session })
  }
  return { users }
}

export default function (data) {
  const user = data.users[(__VU - 1) % data.users.length] || data.users[0]
  if (!user) return
  const h = authHeaders(user.session)

  const months = [
    { year: 2025, month: 12 },
    { year: 2026, month: 1 },
    { year: 2026, month: 6 }
  ]
  const m = months[(__VU - 1) % 3]

  check(http.get(`${BASE_URL}/api/cycle/calendar?year=${m.year}&month=${m.month}`, { headers: h, tags: { endpoint: 'cycle-calendar' } }), {
    'D-ST-001 ok': r => r.status === 200 || r.status === 403,
    'no secret': r => assertNoSecretLeak(r.body)
  })

  check(http.post(`${BASE_URL}/api/cycle/guardrails/acknowledge`, JSON.stringify({ guardrailType: 'calendarMethod', relatedDate: '2026-06-26' }), { headers: h }), {
    'D-ST-002 guardrail ok': r => r.status === 200 || r.status === 403
  })
}
