import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * k6 Stress Testing Script for PrimeZap AI
 * 
 * Tests the API under extreme load to find breaking points.
 * 
 * Run with: k6 run tests/performance/stress-test.js
 */

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 300 },  // Ramp up to 300 users
    { duration: '5m', target: 300 },  // Stay at 300 users
    { duration: '2m', target: 400 },  // Ramp up to 400 users (stress point)
    { duration: '5m', target: 400 },  // Stay at 400 users
    { duration: '5m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(99)<3000'], // 99% of requests should be below 3s
    http_req_failed: ['rate<0.1'],     // Error rate should be less than 10%
  },
};

// Base URL
const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

export function setup() {
  // Login to get auth token
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

  // Stress test: Rapid fire requests
  const endpoints = [
    '/api/contacts',
    '/api/conversations',
    '/api/campaigns',
    '/api/workflows',
    '/api/deals',
  ];

  // Random endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  const res = http.get(`${BASE_URL}${endpoint}`, { headers });
  
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429, // Allow rate limiting
    'response time < 3000ms': (r) => r.timings.duration < 3000,
  }) || errorRate.add(1);

  // Minimal sleep to create stress
  sleep(0.1);
}

export function teardown(data) {
  console.log('Stress test completed');
}
