#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:4000"}
TOKEN=${TOKEN:-""}

if [ -z "$TOKEN" ]; then
  echo "❌ TOKEN required (Bearer)"
  exit 1
fi

echo "🔎 GET /api/tickets"
curl -fsS -H "Authorization: Bearer $TOKEN" "$API_BASE/api/tickets" >/dev/null && echo "✓ list ok" || (echo "✗ list failed"; exit 1)

echo "✅ Tickets smoke done"

