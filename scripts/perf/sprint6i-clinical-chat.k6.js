import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

export const options = {
  thresholds: {
    'http_req_duration{tag:clinical_chat}': ['p(95)<2000'],
  },
  stages: [
    { duration: '30s', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const jar = http.cookieJar();

  const startRes = http.post(
    `${BASE_URL}/api/ai/clinical/session/start`,
    JSON.stringify({}),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { tag: 'clinical_chat' },
      jar,
    }
  );

  check(startRes, {
    'session start status is 200': (r) => r.status === 200,
    'session start success': (r) => r.body && r.json('success') === true,
  });

  const sessionId = startRes.body && startRes.json('data.sessionId');
  if (!sessionId) return;

  const messageRes = http.post(
    `${BASE_URL}/api/ai/clinical/message`,
    JSON.stringify({ sessionId, message: 'Saya pusing', locale: 'id' }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { tag: 'clinical_chat' },
      jar,
    }
  );

  check(messageRes, {
    'message status is 200': (r) => r.status === 200,
    'message success': (r) => r.body && r.json('success') === true,
  });
}
