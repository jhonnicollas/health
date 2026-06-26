import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak } from './lib.js'

export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },
        { duration: '5m', target: 500 },
        { duration: '1m', target: 0 }
      ],
      tags: { load: 'spike' }
    }
  },
  thresholds: { http_req_failed: ['rate<0.05'] }
}

export function setup() {
  const users = []
  for (let i = 1; i <= 500; i++) {
    const email = `spike-${i}@example.test`
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

  check(http.get(`${BASE_URL}/api/dashboard/daily-health`, { headers: h }), {
    'spike daily-health no 5xx': r => r.status < 500
  })

  check(http.post(`${BASE_URL}/api/hydration/logs`, JSON.stringify({ amountMl: 200 }), { headers: h }), {
    'spike hydration-log no 5xx': r => r.status < 500
  })

  check(http.post(`${BASE_URL}/api/symptoms`, JSON.stringify({ sourceSessionId: null, severity: 3, painLevel: 2, symptoms: [{ text: 'pusing' }] }), { headers: h }), {
    'spike symptom no 5xx': r => r.status < 500
  })

  check(http.get(`${BASE_URL}/api/me/entitlements`, { headers: h }), {
    'spike entitlement no 5xx': r => r.status < 500
  })
}
