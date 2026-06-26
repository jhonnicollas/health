import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak } from './lib.js'

export const options = {
  scenarios: {
    ai_infra: { executor: 'constant-vus', vus: 50, duration: '10m', tags: { scenario: 'C-ST-003' } }
  },
  thresholds: { 'http_req_duration{endpoint:ai-assistant}': ['p(95)<2500'], 'http_req_failed{endpoint:ai-assistant}': ['rate<0.03'] }
}

export function setup() {
  const users = []
  for (let i = 1; i <= 50; i++) {
    const email = `c-st-003-${i}@example.test`
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

  check(http.post(`${BASE_URL}/api/ai/assistant`, JSON.stringify({ question: 'saya merasa pusing' }), { headers: h, tags: { endpoint: 'ai-assistant' } }), {
    'C-ST-003 no crash': r => r.status === 200 || r.status === 403 || r.status === 400,
    'disclaimer present': r => r.body.includes('disclaimer') || r.status === 403 || r.status === 400,
    'no diagnosis final': r => !r.body.includes('diagnosis_final'),
    'no emergency authority': r => !r.body.includes('emergency_authority'),
    'no prescription': r => !r.body.includes('prescription'),
    'no med dosage': r => !r.body.includes('medication_dosage_instruction')
  })

  check(http.post(`${BASE_URL}/api/ai/assistant`, JSON.stringify({ question: 'test', clinicalCopilotMode: true }), { headers: h }), {
    'C-ST-004 copilotMode deferred': r => {
      if (r.status === 403 || r.status === 400) return true
      try { return r.json().error?.code === 'AI_CLINICAL_COPILOT_DEFERRED' } catch { return r.status < 500 }
    }
  })

  check(http.get(`${BASE_URL}/api/admin/ai-clinical-copilot/readiness`, { headers: h }), {
    'C-ST-004 readiness no crash': r => r.status === 200 || r.status === 403
  })
}
