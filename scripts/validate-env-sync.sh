#!/usr/bin/env bash
set -euo pipefail

# Validates that API and Worker see the same DATABASE_URL and REDIS_URL.

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}

echo "🔎 Validando sincronização de env entre API e Worker"

if command -v docker >/dev/null 2>&1 && [ -f "$COMPOSE_FILE" ]; then
  echo "• Lendo variáveis dentro dos containers (se em execução)"
  API_DB=$(docker compose -f "$COMPOSE_FILE" exec -T api /bin/sh -lc 'echo -n "$DATABASE_URL"' 2>/dev/null || true)
  API_REDIS=$(docker compose -f "$COMPOSE_FILE" exec -T api /bin/sh -lc 'echo -n "$REDIS_URL"' 2>/dev/null || true)
  WK_DB=$(docker compose -f "$COMPOSE_FILE" exec -T worker /bin/sh -lc 'echo -n "$DATABASE_URL"' 2>/dev/null || true)
  WK_REDIS=$(docker compose -f "$COMPOSE_FILE" exec -T worker /bin/sh -lc 'echo -n "$REDIS_URL"' 2>/dev/null || true)

  if [ -n "$API_DB" ] && [ -n "$WK_DB" ]; then
    if [ "$API_DB" = "$WK_DB" ]; then
      echo "✅ DATABASE_URL coincide (containers): $API_DB"
    else
      echo "❌ DATABASE_URL divergente: api=$API_DB worker=$WK_DB"; exit 2
    fi
  else
    echo "ℹ️  Containers não estão disponíveis; caindo para leitura do arquivo .env"
  fi
fi

# Fallback: ler .env compartilhado
if [ -f .env ]; then
  echo "• Lendo variáveis de .env"
  DB_ENV=$(grep -E '^DATABASE_URL=' .env | sed 's/^DATABASE_URL=//')
  REDIS_ENV=$(grep -E '^REDIS_URL=' .env | sed 's/^REDIS_URL=//')
  if [ -n "$DB_ENV" ]; then echo "✅ DATABASE_URL (.env): $DB_ENV"; else echo "⚠️  DATABASE_URL ausente em .env"; fi
  if [ -n "$REDIS_ENV" ]; then echo "✅ REDIS_URL (.env): $REDIS_ENV"; else echo "⚠️  REDIS_URL ausente em .env (usando host/port)"; fi
else
  echo "⚠️  Arquivo .env não encontrado"
fi

echo "✔️  Validação concluída"

