#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:4000"}
TOKEN=${TOKEN:-""}
CONNECTION_ID=${CONNECTION_ID:-""}
SESSION_NAME=${SESSION_NAME:-"default"}

if [ -z "$TOKEN" ]; then
  echo "❌ TOKEN required (Bearer)"
  exit 1
fi

echo "🔎 Polling QR by sessionName"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API_BASE/api/whatsapp/qr/$SESSION_NAME")
echo "→ /api/whatsapp/qr/$SESSION_NAME -> $HTTP_CODE (expected 204 or 200)"

if [ -n "$CONNECTION_ID" ]; then
  echo "🔎 Polling QR by connectionId"
  HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API_BASE/api/whatsapp/$CONNECTION_ID/qr")
  echo "→ /api/whatsapp/$CONNECTION_ID/qr -> $HTTP_CODE2 (expected 204 or 200)"
fi

echo "✅ WhatsApp QR smoke done"

