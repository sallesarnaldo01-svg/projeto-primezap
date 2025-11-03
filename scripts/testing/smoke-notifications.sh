#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:4000"}
TOKEN=${TOKEN:-""}

if [ -z "$TOKEN" ]; then
  echo "❌ TOKEN required (Bearer)"; exit 1; fi

echo "🔎 GET /api/notifications"
curl -fsS -H "Authorization: Bearer $TOKEN" "$API_BASE/api/notifications" >/dev/null && echo "✓ notifications ok" || (echo "✗ notifications failed"; exit 1)

echo "✅ Notifications smoke done"

