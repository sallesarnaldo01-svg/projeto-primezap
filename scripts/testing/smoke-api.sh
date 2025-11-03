#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost:4000/api}
EMAIL=${ADMIN_EMAIL:-admin@primezapia.com}
PASSWORD=${ADMIN_PASSWORD:-123456}

echo "🔎 API smoke at $BASE_URL"

TOKEN=$(curl -sS -X POST "$BASE_URL/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.data.token // .token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login failed"; exit 1; fi

auth() { curl -sS -H "Authorization: Bearer $TOKEN" "$@"; }

echo "• Health" && curl -sS "${BASE_URL%/api}/healthz" | jq . >/dev/null
echo "• Tags (200)" && auth "$BASE_URL/tags" >/dev/null
echo "• Contacts list (200)" && auth "$BASE_URL/contacts" >/dev/null
echo "• Reports CRM metrics (200)" && auth "$BASE_URL/reports/crm/metrics" >/dev/null
echo "• WhatsApp QR poll (204 or 200)" && {
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$BASE_URL/whatsapp/qr/default");
  [[ "$code" == "200" || "$code" == "204" ]] || { echo "❌ QR poll HTTP $code"; exit 2; }
}

echo "✅ API smoke ok"
