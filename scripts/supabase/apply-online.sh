#!/usr/bin/env bash
set -euo pipefail

# Aplica migrations/policies no projeto Supabase online usando Supabase CLI
# Pré-requisitos:
# - supabase CLI autenticado (supabase login)
# - projeto configurado (supabase link --project-ref <PROJECT_ID>)

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

echo "📦 Aplicando migrations Supabase no projeto online"
for f in supabase/migrations/*.sql; do
  echo "→ supabase db execute --file $f"
  supabase db execute --file "$f"
done

echo "✅ Migrations/policies aplicadas"

