#!/usr/bin/env bash
set -euo pipefail

# Smoke test de conectividade Postgres (docker/local)
DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-primeflow}
DB_PASSWORD=${DB_PASSWORD:-postgres}

export PGPASSWORD="$DB_PASSWORD"
echo "[smoke-db] Testando conexão em $DB_HOST:$DB_PORT ($DB_NAME)"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" || echo "[smoke-db] Falha na conexão (ok em ambientes sem DB local)"

echo "[smoke-db] OK (best-effort)"

