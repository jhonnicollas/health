import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak } from './lib.js'

export const options = {
  scenarios: {
    hub_fanout: { executor: 'constant-vus', vus: 50, duration: '15m', tags: { scenario: 'A-ST-002' } }
  },
  thresholds: { 'http_req_duration{endpoint:daily-health}': ['p(95)<900'], 'http_req_failed{endpoint:daily-health}': ['rate<0.01'] }
}

export function setup() {
  const users = []
  for (let i = 1; i <= 50; i++) {
    const email = `a-st-002-${i}@example.test`
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

  check(http.get(`${BASE_URL}/api/dashboard/daily-health`, { headers: h, tags: { endpoint: 'daily-health' } }), {
    'A-ST-002 ok': r => r.status === 200,
    'no 5xx empty': r => r.status < 500,
    'no cycle leak': r => !r.body.includes('cycleDay'),
    'no secret': r => assertNoSecretLeak(r.body)
  })

  const symptoms = ['sakit kepala ringan', 'nyeri dada tajam', 'sesak napas hebat', 'batuk biasa']
  const s = symptoms[(__VU - 1) % symptoms.length]
  check(http.post(`${BASE_URL}/api/symptoms`, JSON.stringify({ description: s, painScale: 3, painSeverity: 'moderate' }), { headers: h }), {
    'A-ST-003 symptom ok': r => r.status === 200 || r.status === 201,
    'safetyEvent not alerts': r => !r.body.includes('HL_alerts')
  })
}
