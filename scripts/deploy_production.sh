#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Detect docker-compose.yml in preferred locations
COMPOSE_FILE="$(ls -1 {docker,unified/primeflow-hub-main/docker}/docker-compose.yml 2>/dev/null | head -n1 || true)"
if [ -z "${COMPOSE_FILE:-}" ] || [ ! -f "$COMPOSE_FILE" ]; then
  echo "docker-compose.yml não encontrado" >&2
  exit 2
fi

# Source .env if present (optional)
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env || true
  set +a
fi

echo "[deploy] usando compose: $COMPOSE_FILE"

# Determine frontend service name (prefer 'frontend', fallback to 'web')
FRONT_SVC="frontend"
if ! grep -qE "^\s{2}frontend:\s*$" "$COMPOSE_FILE"; then
  if grep -qE "^\s{2}web:\s*$" "$COMPOSE_FILE"; then
    FRONT_SVC="web"
  fi
fi

echo "[deploy] iniciando build/pull"
docker compose -f "$COMPOSE_FILE" pull || true
docker compose -f "$COMPOSE_FILE" build --pull || true

echo "[deploy] subindo serviços (api, worker, ${FRONT_SVC})"
docker compose -f "$COMPOSE_FILE" up -d api worker "$FRONT_SVC"

echo "[deploy] aguardando saúde da API"
API_HOST="${API_PUBLIC_URL:-https://api.primezapia.com}"
# Try new /healthz, fallback to /health
for i in {1..30}; do
  if curl -skf "$API_HOST/healthz" >/dev/null || curl -skf "$API_HOST/health" >/dev/null || curl -skf "$API_HOST/api/healthz" >/dev/null; then
    echo "[deploy] API saudável"; break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then echo "[deploy] API não ficou saudável"; exit 3; fi
done

echo "[deploy] validando frontend"
FRONT_HOST="${FRONTEND_PUBLIC_URL:-https://primezap.primezapia.com}"
if ! curl -skI "$FRONT_HOST" | grep -qiE "^HTTP/.* (200|301|302)"; then
  echo "[deploy] Frontend não respondeu 2xx/3xx" >&2
  exit 4
fi

echo "[deploy] concluído"

