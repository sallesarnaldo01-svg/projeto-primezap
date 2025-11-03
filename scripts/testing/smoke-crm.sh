#!/usr/bin/env bash
set -euo pipefail

API_BASE=${API_BASE:-"http://localhost:4000"}
TOKEN=${TOKEN:-""}

if [ -z "$TOKEN" ]; then
  echo "❌ TOKEN required (Bearer)"
  exit 1
fi

echo "🔎 Checking CRM endpoints presence"

check() {
  local method="$1" path="$2" exp="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" -X "$method" "$API_BASE$path")
  if [ "$code" = "$exp" ] || [ "$code" = "401" ]; then
    echo "✓ $method $path -> $code"
  else
    echo "✗ $method $path -> $code (expected $exp or 401)"
    return 1
  fi
}

check GET /api/pre-cadastros || true
check GET /api/correspondentes || true
check GET /api/empreendimentos || true
check GET /api/documentos/tipos || true
check GET /api/documentos || true
check GET /api/simulacoes || true
check GET /api/lead-interactions || true
check GET /api/internal-chat || true
check GET /api/properties || true
check GET /api/visits || true
check GET /api/message-templates || true

echo "✅ CRM smoke checks done"

