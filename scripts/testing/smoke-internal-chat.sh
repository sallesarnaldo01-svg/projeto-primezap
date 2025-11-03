#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:4000"}
TOKEN=${TOKEN:-""}
PEER=${PEER:-""}

if [ -z "$TOKEN" ]; then echo "❌ TOKEN required (Bearer)"; exit 1; fi

if [ -n "$PEER" ]; then
  echo "📨 POST /api/internal-chat/messages"
  curl -fsS -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"toUserId\":\"$PEER\",\"text\":\"Ping\"}" \
    "$API_BASE/api/internal-chat/messages" >/dev/null && echo "✓ message sent" || echo "⚠️ send failed"
fi

echo "🔎 GET /api/internal-chat/messages?userId=$PEER"
curl -fsS -H "Authorization: Bearer $TOKEN" "$API_BASE/api/internal-chat/messages?userId=$PEER" >/dev/null && echo "✓ list ok" || echo "⚠️ list failed"

echo "✅ Internal chat smoke done"

