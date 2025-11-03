#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}

run_psql() {
  local sql="$1"
  if command -v docker >/dev/null 2>&1 && docker compose -f "$COMPOSE_FILE" ps >/dev/null 2>&1; then
    docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres -d primeflow -v ON_ERROR_STOP=1 -c "$sql"
  else
    if [ -z "${DATABASE_URL:-}" ]; then echo "❌ Defina DATABASE_URL ou use docker compose"; exit 1; fi
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "$sql"
  fi
}

echo "🔎 Smoke DB"
echo "• Tabelas essenciais"
run_psql "\\dt public.integrations"
run_psql "\\dt public.whatsapp_connections"

echo "• Funções auxiliares (existe?)"
run_psql "SELECT proname FROM pg_proc WHERE proname in ('generate_pre_cadastro_numero','calcular_percentual_documentos') ORDER BY proname;"

echo "• RLS nas principais tabelas de conversas/mensagens"
run_psql "SELECT relname, relrowsecurity FROM pg_class WHERE relname in ('conversations','messages') ORDER BY relname;"

echo "• Buckets de Storage (se extensão Supabase existir)"
if run_psql "SELECT 1 FROM information_schema.schemata WHERE schema_name='storage'" >/dev/null 2>&1; then
  run_psql "SELECT name FROM storage.buckets WHERE name in ('documents','media') ORDER BY name;" || true
else
  echo "  (Sem schema storage nesta instância)"
fi

echo "✅ Smoke finalizado"

