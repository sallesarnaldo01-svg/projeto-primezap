#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:4000"}

echo "🔎 Checking health endpoints"
curl -fsS "$API_BASE/healthz" >/dev/null && echo "✓ /healthz ok" || (echo "✗ /healthz failed" && exit 1)
curl -fsS "$API_BASE/api/healthz" >/dev/null && echo "✓ /api/healthz ok" || (echo "✗ /api/healthz failed" && exit 1)

echo "🔎 Checking tags list (requires auth)"
TOKEN=${TOKEN:-""}
if [ -n "$TOKEN" ]; then
  curl -fsS -H "Authorization: Bearer $TOKEN" "$API_BASE/api/tags" >/dev/null && echo "✓ /api/tags ok" || { echo "✗ /api/tags failed"; exit 1; }
else
  echo "⚠️  TOKEN not provided; skipping /api/tags"
fi

echo "✅ Smoke basic checks done"
