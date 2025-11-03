#!/usr/bin/env bash
set -euo pipefail

# Switch API/Worker to use Supabase DB (production) and apply Prisma migrations
# - Validates connectivity to Supabase DB
# - Runs prisma migrate deploy inside API container
# - Disables docker-compose.override.yml fallback (local Postgres)
# - Restarts api/worker and runs quick health checks

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE_ROOT="${COMPOSE_FILE:-./docker-compose.yml}"
COMPOSE_OVERRIDE="./docker-compose.override.yml"

DATABASE_URL="${DATABASE_URL:-}"
API_PUBLIC_URL="${API_PUBLIC_URL:-https://api.primezapia.com}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "❌ DATABASE_URL não definido. Ex.: export DATABASE_URL='postgres://postgres:...@db.<ref>.supabase.co:5432/postgres?sslmode=require'" >&2
  exit 2
fi

echo "[switch] Compose: $COMPOSE_FILE_ROOT"
echo "[switch] DATABASE_URL host: $(echo "$DATABASE_URL" | sed -E 's|^[a-z]+://([^@]+@)?([^/:?]+).*|\2|')"

echo "[1/5] Testando conectividade com o Supabase (psql dentro de container)"
if ! docker run --rm postgres:16-alpine sh -lc "psql '$DATABASE_URL' -c 'select now();' >/dev/null"; then
  echo "❌ Conexão ao Supabase falhou. Possíveis causas:" >&2
  echo "   - Servidor sem rota IPv6 (o host do DB pode anunciar apenas AAAA)" >&2
  echo "   - Firewall de saída 5432/tcp bloqueado" >&2
  echo "Sugestões:" >&2
  echo "   - Habilite IPv6/egress (ou use WARP/NAT64) e repita" >&2
  echo "   - Aplique migrations pelo SQL Editor do Supabase como alternativa temporária" >&2
  exit 3
fi
echo "   ✓ Conectividade OK"

echo "[2/5] Aplicando migrations Prisma no Supabase"
docker compose -f "$COMPOSE_FILE_ROOT" run --rm -e DATABASE_URL="$DATABASE_URL" api \
  pnpm exec prisma migrate deploy --schema=prisma/schema.prisma

echo "[3/5] Desativando fallback local (docker-compose.override.yml) se existir"
if [[ -f "$COMPOSE_OVERRIDE" ]]; then
  mv -f "$COMPOSE_OVERRIDE" "$COMPOSE_OVERRIDE.bak_$(date +%Y%m%d%H%M%S)"
  echo "   ✓ $COMPOSE_OVERRIDE movido para .bak" 
else
  echo "   (nenhum override encontrado)"
fi

echo "[4/5] Reiniciando api/worker apontando para Supabase"
docker compose -f "$COMPOSE_FILE_ROOT" up -d api worker
sleep 2

echo "[5/5] Health check da API pública"
for i in {1..30}; do
  if curl -skf "$API_PUBLIC_URL/api/health" >/dev/null; then
    echo "   ✓ API pública saudável"; break; fi
  sleep 2; if [[ "$i" -eq 30 ]]; then echo "   ✗ API não respondeu OK"; exit 4; fi
done

echo "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Switch para Supabase concluído"
echo "  API:      $API_PUBLIC_URL"
echo "  Compose:  $COMPOSE_FILE_ROOT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

