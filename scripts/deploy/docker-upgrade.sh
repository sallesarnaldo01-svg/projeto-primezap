#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml}

echo "🚢 PrimeFlow – Docker upgrade/deploy"

step() { echo -e "\n▶ $1"; }

step "Pull/build images (api, web, infra)"
docker compose -f "$COMPOSE_FILE" pull || true
# Build only images required for API + Web now; worker can be built later
docker compose -f "$COMPOSE_FILE" build --no-cache api web nginx migrator redis postgres certbot || true

step "Start core services (Postgres/Redis)"
docker compose -f "$COMPOSE_FILE" up -d postgres redis

step "Wait for Postgres"
until docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres -d primeflow >/dev/null 2>&1; do
  echo "  … waiting for postgres"; sleep 2;
done

step "Apply DB migrations (Prisma + Supabase SQL)"
docker compose -f "$COMPOSE_FILE" run --rm migrator

step "Start application services (API, Web)"
docker compose -f "$COMPOSE_FILE" up -d api web

step "Ensure admin + WhatsApp seed"
# Prefer API bootstrap ensure; still run idempotent seeds for safety
docker compose -f "$COMPOSE_FILE" exec -T api /bin/sh -lc 'pnpm exec tsx scripts/seed-admin.ts && pnpm exec tsx scripts/seed-connections.ts' || true

step "Validate API/Worker environment sync"
bash scripts/validate-env-sync.sh || true

echo "\n✅ Deploy complete. Useful checks:"
echo "  - docker compose -f $COMPOSE_FILE ps"
echo "  - docker compose -f $COMPOSE_FILE logs -f api"
echo "  - curl -I https://api.primezapia.com/health  (expect 200)"
echo "  - Login: admin@primezapia.com / 123456"
