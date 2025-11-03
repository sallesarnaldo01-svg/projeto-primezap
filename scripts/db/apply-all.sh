#!/usr/bin/env bash
set -euo pipefail

# Orquestra migrations (Prisma + Supabase) e aplica seeds idempotentes.

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL não definido"; exit 1; fi

echo "🗃️  Prisma: generate + migrate deploy"
pnpm prisma generate
pnpm prisma migrate deploy

echo "🧩 Supabase: aplicar migrations SQL (idempotente)"
for f in supabase/migrations/*.sql; do
  echo "→ $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done

echo "🧮 Funções auxiliares (separadas em Prisma migrations)"
for f in prisma/migrations/*generate_pre_cadastro_numero.sql prisma/migrations/*crm_modules.sql 2>/dev/null; do
  [ -f "$f" ] || continue
  echo "→ $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || true
done

echo "🌱 Seeds: admin, CRM mínimo, conexões"
pnpm exec tsx scripts/seed-admin.ts
pnpm exec tsx scripts/seed-crm-min.ts
pnpm exec tsx scripts/seed-connections.ts

echo "🔒 Verificando RLS essencial"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;" || true
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;" || true

echo "✅ Migração completa"

