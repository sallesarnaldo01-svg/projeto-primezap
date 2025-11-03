#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Lint root"
pnpm run lint || true

echo "🔎 Lint API"
pnpm run lint:api || true

echo "🔎 Lint Worker"
pnpm run lint:worker || true

echo "🧪 Typecheck API"
(cd apps/api && pnpm exec tsc -p tsconfig.json --noEmit)

echo "🧪 Typecheck Worker"
(cd apps/worker && pnpm exec tsc -p tsconfig.json --noEmit)

echo "🧬 Prisma validate"
(cd apps/api && pnpm exec prisma validate --schema prisma/schema.prisma)

echo "🛠️  Build API"
(cd apps/api && pnpm build)

echo "🛠️  Build Worker"
(cd apps/worker && pnpm build)

echo "✅ CI checks completed"

