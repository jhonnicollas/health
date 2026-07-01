import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

export const options = {
  thresholds: {
    'http_req_duration{tag:service_binding}': ['p(95)<50'],
  },
  stages: [
    { duration: '30s', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const res = http.get(`${BASE_URL}/api/ai/probe`, {
    tags: { tag: 'service_binding' },
  });

  check(res, {
    'probe status is 200': (r) => r.status === 200,
    'probe success': (r) => r.body && r.json('success') === true,
  });
}
