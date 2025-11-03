#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:4000"}
TOKEN=${TOKEN:-""}

if [ -z "$TOKEN" ]; then
  echo "❌ TOKEN required (Bearer)"
  exit 1
fi

echo "🔎 GET /api/users (admin only)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API_BASE/api/users")
echo "→ /api/users -> $HTTP_CODE (expect 200 for admin)"

echo "✅ Users smoke done"

