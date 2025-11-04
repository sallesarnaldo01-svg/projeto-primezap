import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 Spike Testing Script for PrimeZap AI
 * 
 * Tests the API's ability to handle sudden traffic spikes.
 * 
 * Run with: k6 run tests/performance/spike-test.js
 */

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Normal load
    { duration: '30s', target: 500 }, // Sudden spike!
    { duration: '1m', target: 500 },  // Stay at spike
    { duration: '30s', target: 50 },  // Back to normal
    { duration: '1m', target: 50 },   // Stay at normal
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.2'],     // Allow 20% error rate during spike
  },
};

// Base URL
const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: __ENV.TEST_EMAIL || 'test@example.com',
    password: __ENV.TEST_PASSWORD || 'password123',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.token };
  }

  return { token: '' };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Test most common endpoint
  const res = http.get(`${BASE_URL}/api/contacts`, { headers });
  
  check(res, {
    'status is 200 or 429 or 503': (r) => 
      r.status === 200 || r.status === 429 || r.status === 503,
  });

  sleep(0.5);
}
