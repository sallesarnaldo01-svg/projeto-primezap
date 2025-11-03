#!/usr/bin/env bash
set -euo pipefail

SQL_FILE="supabase/documents_policies.sql"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI não encontrado. Instale com: https://supabase.com/docs/reference/cli/install" >&2
  exit 1
fi

if [ ! -f "$SQL_FILE" ]; then
  echo "Arquivo $SQL_FILE não encontrado." >&2
  exit 1
fi

echo "Aplicando policies do Supabase a partir de $SQL_FILE..."
supabase db execute --file "$SQL_FILE"
echo "Concluído. Revise suas policies no painel do Supabase."
