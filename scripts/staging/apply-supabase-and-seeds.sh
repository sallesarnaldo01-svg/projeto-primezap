#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL não definido"; exit 1; fi

echo "📦 Aplicando migrations Supabase (SQL)"
for f in supabase/migrations/*.sql; do
  echo "→ $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done

echo "🌱 Executando seeds (admin + CRM mínimo + connections)"
pnpm exec tsx scripts/seed-admin.ts
pnpm exec tsx scripts/seed-crm-min.ts
pnpm exec tsx scripts/seed-connections.ts

echo "✅ Staging pronto"
