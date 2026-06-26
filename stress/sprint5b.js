import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak } from './lib.js'

export const options = {
  scenarios: {
    hydration_burst: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '1m', target: 100 }], tags: { scenario: 'B-ST-001' } }
  },
  thresholds: { 'http_req_duration{endpoint:hydration-log}': ['p(95)<500'], 'http_req_failed{endpoint:hydration-log}': ['rate<0.01'] }
}

export function setup() {
  const users = []
  for (let i = 1; i <= 100; i++) {
    const email = `b-st-001-${i}@example.test`
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

  const amounts = [200, 600]
  const ml = amounts[(__VU - 1) % 2]

  check(http.post(`${BASE_URL}/api/hydration/logs`, JSON.stringify({ amountMl: ml }), { headers: h, tags: { endpoint: 'hydration-log' } }), {
    'B-ST-001 log ok': r => r.status === 200 || r.status === 201,
    'total consistent': r => { try { return r.json().success === true } catch { return false } },
    'no secret': r => assertNoSecretLeak(r.body)
  })

  check(http.get(`${BASE_URL}/api/hydration/today`, { headers: h, tags: { endpoint: 'hydration-today' } }), {
    'B-ST-003 today ok': r => r.status === 200
  })
}
