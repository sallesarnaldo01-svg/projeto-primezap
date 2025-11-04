import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

/**
 * k6 Load Testing Script for PrimeZap AI
 * 
 * Tests the API under normal load conditions.
 * 
 * Run with: k6 run tests/performance/load-test.js
 */

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },  // Ramp up to 50 users over 2 minutes
    { duration: '5m', target: 50 },  // Stay at 50 users for 5 minutes
    { duration: '2m', target: 100 }, // Ramp up to 100 users over 2 minutes
    { duration: '5m', target: 100 }, // Stay at 100 users for 5 minutes
    { duration: '2m', target: 0 },   // Ramp down to 0 users over 2 minutes
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],   // Error rate should be less than 1%
    errors: ['rate<0.1'],             // Custom error rate should be less than 10%
  },
};

// Base URL
const BASE_URL = __ENV.API_URL || 'http://localhost:4000';

// Test data
let authToken = '';

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

  console.error('Login failed:', loginRes.status, loginRes.body);
  return { token: '' };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Test 1: Get contacts list
  const contactsRes = http.get(`${BASE_URL}/api/contacts`, { headers });
  check(contactsRes, {
    'contacts status is 200': (r) => r.status === 200,
    'contacts response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Get conversations list
  const conversationsRes = http.get(`${BASE_URL}/api/conversations`, { headers });
  check(conversationsRes, {
    'conversations status is 200': (r) => r.status === 200,
    'conversations response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);

  // Test 3: Get messages
  if (conversationsRes.status === 200) {
    const conversations = JSON.parse(conversationsRes.body);
    if (conversations.data && conversations.data.length > 0) {
      const firstConversation = conversations.data[0];
      const messagesRes = http.get(
        `${BASE_URL}/api/conversations/${firstConversation.id}/messages`,
        { headers }
      );
      check(messagesRes, {
        'messages status is 200': (r) => r.status === 200,
        'messages response time < 500ms': (r) => r.timings.duration < 500,
      }) || errorRate.add(1);
    }
  }

  sleep(1);

  // Test 4: Create contact
  const newContact = {
    name: `Load Test Contact ${Date.now()}`,
    phone: `+5511${Math.floor(Math.random() * 1000000000)}`,
    email: `loadtest${Date.now()}@example.com`,
  };

  const createContactRes = http.post(
    `${BASE_URL}/api/contacts`,
    JSON.stringify(newContact),
    { headers }
  );
  check(createContactRes, {
    'create contact status is 201': (r) => r.status === 201,
    'create contact response time < 1000ms': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  sleep(2);

  // Test 5: Search contacts
  const searchRes = http.get(`${BASE_URL}/api/contacts?search=test`, { headers });
  check(searchRes, {
    'search status is 200': (r) => r.status === 200,
    'search response time < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  sleep(1);
}

export function teardown(data) {
  // Cleanup if needed
  console.log('Load test completed');
}
