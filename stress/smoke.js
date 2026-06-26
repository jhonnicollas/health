import http from 'k6/http'
import { check, sleep } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak } from './lib.js'

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      tags: { load: 'smoke' }
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05']
  }
}

export function setup() {
  const users = []
  for (let i = 1; i <= 10; i++) {
    const email = `smoke-${i}@example.test`
    const reg = register(email)
    if (reg.status === 200 || reg.status === 201 || reg.status === 409) {
      const { session } = login(email)
      if (session) users.push({ email, session })
    }
  }
  return { users }
}

export default function (data) {
  const user = data.users[(__VU - 1) % data.users.length] || data.users[0]
  if (!user) { sleep(1); return }

  const h = authHeaders(user.session)

  check(http.get(`${BASE_URL}/api/me/entitlements`, { headers: h }), {
    'smoke entitlements 200': r => r.status === 200,
    'no secret': r => assertNoSecretLeak(r.body)
  })

  check(http.get(`${BASE_URL}/api/dashboard/daily-health`, { headers: h }), {
    'smoke daily-health 200': r => r.status === 200
  })

  check(http.get(`${BASE_URL}/api/hydration/today`, { headers: h }), {
    'smoke hydration-today 200': r => r.status === 200
  })

  check(http.post(`${BASE_URL}/api/hydration/logs`, JSON.stringify({ amountMl: 200 }), { headers: h }), {
    'smoke hydration-add ok': r => r.status === 200 || r.status === 201
  })

  check(http.post(`${BASE_URL}/api/ai/assistant`, JSON.stringify({ question: 'test' }), { headers: h }), {
    'smoke ai no crash': r => r.status === 200 || r.status === 403 || r.status === 400,
    'contains disclaimer': r => r.body.includes('disclaimer') || r.status === 403 || r.status === 400,
    'no diagnosis final': r => !r.body.includes('diagnosis_final'),
    'no prescription': r => !r.body.includes('prescription')
  })

  check(http.post(`${BASE_URL}/api/ai/assistant`, JSON.stringify({ question: 'test', clinicalCopilotMode: true }), { headers: h }), {
    'smoke copilotMode deferred': r => {
      if (r.status === 403 || r.status === 400) return true
      try { return r.json().error?.code === 'AI_CLINICAL_COPILOT_DEFERRED' } catch { return r.status < 500 }
    }
  })

  check(http.get(`${BASE_URL}/api/cycle/calendar?year=2026&month=6`, { headers: h }), {
    'smoke cycle-calendar no crash': r => r.status === 200 || r.status === 403
  })

  sleep(1)
}
