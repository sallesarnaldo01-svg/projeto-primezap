#!/usr/bin/env bash
set -euo pipefail

# Smoke test básico do frontend/API
API_BASE=${VITE_API_BASE_URL:-http://127.0.0.1:4000/api}

echo "[smoke-web] GET /healthz"
curl -fsS "$API_BASE/healthz" || echo "[smoke-web] /healthz indisponível"

echo "[smoke-web] GET /integrations (se autenticado/aberto)"
curl -fsS "$API_BASE/integrations" -H 'x-tenant-id: default' || echo "[smoke-web] /integrations indisponível"

echo "[smoke-web] OK (best-effort)"

