import http from 'k6/http'
import { check } from 'k6'
import { BASE_URL, register, login, authHeaders, assertNoSecretLeak, TELEGRAM_WEBHOOK_SECRET } from './lib.js'

export const options = {
  scenarios: {
    telegram_dupe: { executor: 'constant-vus', vus: 50, duration: '10m', tags: { scenario: 'E-ST-001' } }
  },
  thresholds: { 'http_req_duration{endpoint:telegram-webhook}': ['p(95)<800'], 'http_req_failed{endpoint:telegram-webhook}': ['rate<0.01'] }
}

export default function () {
  const callbackId = `stress-cb-${__VU}-${Date.now()}`
  const body = JSON.stringify({
    update_id: Math.floor(Math.random() * 1000000000),
    callback_query: {
      id: callbackId,
      from: { id: 7000000000 + __VU, first_name: 'Test', is_bot: false },
      message: { chat: { id: 7000000000 + __VU } },
      data: 'water_200'
    }
  })

  check(http.post(`${BASE_URL}/api/webhook/telegram/water`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-HL-Telegram-Water-Secret': TELEGRAM_WEBHOOK_SECRET
    },
    tags: { endpoint: 'telegram-webhook' }
  }), {
    'E-ST-001 no crash': r => r.status >= 200 && r.status < 500,
    'no secret echo': r => assertNoSecretLeak(r.body)
  })

  check(http.post(`${BASE_URL}/api/webhook/telegram/water`, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-HL-Telegram-Water-Secret': 'invalid-secret-12345'
    }
  }), {
    'E-ST-002 invalid secret rejected': r => r.status === 403,
    'no log inserted': r => { try { const b = r.json(); return b.error?.code === 'TELEGRAM_WEBHOOK_FORBIDDEN' || r.status === 403 } catch { return r.status === 403 } }
  })
}
