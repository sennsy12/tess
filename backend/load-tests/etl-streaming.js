import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 5 },
    { duration: '60s', target: 20 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<3000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
const TOKEN = __ENV.ADMIN_TOKEN || '';

const payload = JSON.stringify({
  sourceType: 'api',
  table: 'ordre',
  strictMode: false,
  onConflict: 'nothing',
  api: {
    url: __ENV.MOCK_API_URL || 'https://example.com/orders',
    dataPath: 'data',
    nextPagePath: 'next',
    timeoutMs: 20000,
    maxPages: 5,
  },
});

export default function () {
  const res = http.post(`${BASE_URL}/api/etl/ingest`, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    timeout: '120s',
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has success body': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body && body.success === true;
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
