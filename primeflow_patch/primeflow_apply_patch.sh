#!/bin/bash
set -euo pipefail

: "${DATABASE_URL:?Defina DATABASE_URL (ex: postgresql://postgres:Noemiamaesz1@127.0.0.1:15432/postgres?sslmode=require)}"

# Descobrir APP_ROOT automaticamente (procura por apps/api/package.json)
discover_root() {
  for base in /home/administrator /opt /srv; do
    hit=$(find "$base" -maxdepth 6 -type f -name package.json -path "*/apps/api/*" 2>/dev/null | head -n1 || true)
    if [ -n "${hit:-}" ]; then
      dirname "$(dirname "$(dirname "$hit")")"
      return 0
    fi
  done
  return 1
}

APP_ROOT="${APP_ROOT:-}"
if [ -z "${APP_ROOT}" ]; then
  if APP_ROOT=$(discover_root); then
    echo "🔎 APP_ROOT detectado: $APP_ROOT"
  else
    echo "⚠️  Não achei apps/api. Se souber o caminho, exporte APP_ROOT e rode de novo."
    APP_ROOT="/home/administrator/PrimeZapAI"  # fallback
  fi
else
  echo "📁 APP_ROOT definido: $APP_ROOT"
fi

echo "➡️  Aplicando migrations SQL (idempotentes)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 00_fix_connections.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 01_crm_core.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 02_segmentation.sql

if [ -d "$APP_ROOT/apps/api" ]; then
  echo "🧩 Prisma generate + migrate deploy (API)..."
  pushd "$APP_ROOT/apps/api" >/dev/null
  npm ci --no-audit --no-fund || npm install
  npx prisma generate
  npx prisma migrate deploy
  npm run build || true
  popd >/dev/null
else
  echo "⚠️  $APP_ROOT/apps/api não existe. Pulando etapa da API."
fi

if [ -d "$APP_ROOT/apps/worker" ]; then
  echo "⚙️  Build do Worker..."
  pushd "$APP_ROOT/apps/worker" >/dev/null
  npm ci --no-audit --no-fund || npm install
  npm run build || true
  popd >/dev/null
else
  echo "ℹ️  Worker não encontrado. Pulando."
fi

echo "♻️  PM2 (se existir)..."
if command -v pm2 >/dev/null 2>&1; then
  # tenta nomes comuns; ajuste depois se seus nomes forem outros
  pm2 list | grep -q api    && pm2 reload api    || true
  pm2 list | grep -q worker && pm2 reload worker || true
  pm2 save || true
  pm2 status || true
else
  echo "ℹ️  PM2 não instalado; se usar Docker, rode docker compose up -d --build no diretório do projeto."
fi

echo "🩺 Health checks locais (porta 3000)..."
curl -fsS http://localhost:3000/healthz || echo 'healthz indisponível — verifique se a API está rodando e a porta correta.'
curl -fsS http://localhost:3000/api/integrations || echo '/api/integrations indisponível — verifique logs/porta.'
echo "✅ Patch aplicado."
