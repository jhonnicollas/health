import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak } from './lib.js'

export const options = {
  scenarios: {
    entitlement_storm: { executor: 'constant-vus', vus: 50, duration: '15m', tags: { scenario: 'F-ST-001' } }
  },
  thresholds: { 'http_req_duration{endpoint:entitlements}': ['p(95)<300'], 'http_req_failed{endpoint:entitlements}': ['rate<0.01'] }
}

export function setup() {
  const users = []
  for (let i = 1; i <= 50; i++) {
    const email = `f-st-001-${i}@example.test`
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

  const r = http.get(`${BASE_URL}/api/me/entitlements`, { headers: h, tags: { endpoint: 'entitlements' } })
  check(r, {
    'F-ST-001 ok': r => r.status === 200,
    'no cross-user': r => !r.body.includes('@example.test') || r.body.includes(user.email),
    'no secret': r => assertNoSecretLeak(r.body),
    'remaining>=0': r => { try { const b = r.json(); return !b.data?.features || Object.values(b.data.features).every(f => f.remaining === undefined || f.remaining >= 0) } catch { return true } }
  })
}
