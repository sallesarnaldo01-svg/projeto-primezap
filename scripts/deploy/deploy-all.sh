#!/usr/bin/env bash
set -euo pipefail

# Simple, explicit deploy for API, Worker and Frontend using docker/docker-compose.yml
# - Builds images (no cache)
# - Starts DB/Redis (optional)
# - Starts API + Worker
# - Applies Prisma migrations
# - Starts Frontend
# - Verifies health
# - Purges CDN cache for / and /index.html if Cloudflare vars are provided

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Prefer compose at project root (conforme atualização definitiva.md)
if [ -f "$ROOT_DIR/docker-compose.yml" ]; then
  COMPOSE_FILE="$ROOT_DIR/docker-compose.yml"
else
  COMPOSE_FILE="$ROOT_DIR/docker/docker-compose.yml"
fi

API_PUBLIC_URL="${API_PUBLIC_URL:-https://api.primezapia.com}"
FRONTEND_PUBLIC_URL="${FRONTEND_PUBLIC_URL:-https://primezap.primezapia.com}"

# Flags
USE_INTERNAL_DB="${USE_INTERNAL_DB:-false}"   # true para usar postgres/redis do compose
RUN_SEED="${RUN_SEED:-false}"                # true para rodar seed mínimo

echo "[deploy-all] Project root: $ROOT_DIR"
echo "[deploy-all] Compose file: $COMPOSE_FILE"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker não encontrado"; exit 2;
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "❌ docker compose não encontrado"; exit 2;
fi

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "❌ docker/docker-compose.yml não encontrado"; exit 2
fi

# Exibe principais variáveis esperadas
echo ""
echo "[deploy-all] Checando variáveis esperadas:"
echo "  FRONTEND_ORIGIN=${FRONTEND_ORIGIN:-(não definido)}"
echo "  DATABASE_URL=${DATABASE_URL:-(possivelmente via .env/docker/.env)}"
echo "  REDIS_URL=${REDIS_URL:-(ou REDIS_HOST/REDIS_PORT)}"
echo "  SUPABASE_URL=${SUPABASE_URL:-}"
echo "  SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:+***}"
echo "  SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY:+***}"
echo ""

cd "$ROOT_DIR"

echo "[1/6] Build (no cache): api worker frontend"
docker compose -f "$COMPOSE_FILE" build --no-cache api worker frontend

if [ "$USE_INTERNAL_DB" = "true" ]; then
  echo "[2/6] Subindo dependências (postgres, redis)"
  docker compose -f "$COMPOSE_FILE" up -d postgres redis
  echo "      Aguardando Postgres (pg_isready)..."
  for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
      echo "      ✓ Postgres ready"; break; fi
    sleep 2; if [ "$i" -eq 30 ]; then echo "      ✗ Postgres não ficou ready"; exit 3; fi
  done
fi

echo "[3/6] Subindo API e Worker"
docker compose -f "$COMPOSE_FILE" up -d api worker

echo "[4/6] Aplicando migrations Prisma"
docker compose -f "$COMPOSE_FILE" run --rm api pnpm exec prisma migrate deploy --schema prisma/schema.prisma

if [ "$RUN_SEED" = "true" ]; then
  echo "      Rodando seed mínimo (opcional)"
  docker compose -f "$COMPOSE_FILE" run --rm api pnpm run seed:crm-min || true
fi

echo "[5/6] Subindo Frontend"
docker compose -f "$COMPOSE_FILE" up -d frontend

echo "[6/6] Health checks"
echo "  → API: $API_PUBLIC_URL"
for i in {1..30}; do
  if curl -skf "$API_PUBLIC_URL/healthz" >/dev/null \
    || curl -skf "$API_PUBLIC_URL/health" >/dev/null \
    || curl -skf "$API_PUBLIC_URL/api/health" >/dev/null; then
    echo "    ✓ API saudável"; break; fi
  sleep 2; if [ "$i" -eq 30 ]; then echo "    ✗ API não respondeu OK"; exit 4; fi
done

echo "  → Frontend: $FRONTEND_PUBLIC_URL"
if ! curl -skI "$FRONTEND_PUBLIC_URL" | grep -qiE "^HTTP/.* (200|301|302)"; then
  echo "    ✗ Frontend não respondeu 2xx/3xx"; exit 5
else
  echo "    ✓ Frontend acessível"
fi

# Purge CDN (Cloudflare) opcional
if [ -n "${CLOUDFLARE_ZONE_ID:-}" ] && [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "[cdn] Purge Cloudflare cache de / e /index.html"
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "{\"files\":[\"${FRONTEND_PUBLIC_URL}/\",\"${FRONTEND_PUBLIC_URL}/index.html\"]}"
  echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deploy concluído com sucesso"
echo "  API:      $API_PUBLIC_URL"
echo "  Frontend: $FRONTEND_PUBLIC_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
