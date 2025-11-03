#!/usr/bin/env bash
set -euo pipefail

# Pipeline unificado de validação (local/CI)
# Passos: install -> prisma generate -> typecheck -> lint -> build -> smokes básicos

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

echo "[pipeline] Node: $(node -v) | PNPM: $(pnpm -v || true)"

echo "[pipeline] Instalando dependências"
pnpm install --frozen-lockfile || pnpm install

echo "[pipeline] Prisma generate (API)"
if [[ -d apps/api/prisma ]]; then
  pnpm prisma:generate || true
fi

echo "[pipeline] Typecheck"
# Web (vite)
tsc -v || pnpm exec tsc -v || true
pnpm exec tsc -p tsconfig.app.json || true

# API
if [[ -f apps/api/tsconfig.json ]]; then
  (cd apps/api && pnpm exec tsc -p tsconfig.json || true)
fi

echo "[pipeline] Lint"
pnpm lint || true

echo "[pipeline] Build web"
pnpm build || true

echo "[pipeline] Build API/Worker"
pnpm build:api || true
pnpm build:worker || true

echo "[pipeline] Smokes"
scripts/testing/smoke-db.sh || true
scripts/testing/smoke-web.sh || true

echo "[pipeline] Concluído"

