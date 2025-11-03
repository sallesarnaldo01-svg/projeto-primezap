#!/usr/bin/env bash
set -euo pipefail

BASE_URL=${BASE_URL:-http://localhost}

echo "[SMOKE] GET $BASE_URL/api/healthz"
curl -fsS "$BASE_URL/api/healthz" | jq . >/dev/null || (echo 'API health failed' >&2; exit 1)

echo "[SMOKE] GET $BASE_URL/api/reports/crm/metrics (may require auth)"
curl -fsS -o /dev/null -w "%{http_code}\n" "$BASE_URL/api/reports/crm/metrics" || true

echo "[SMOKE] OK"
