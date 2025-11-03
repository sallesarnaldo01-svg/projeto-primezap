#!/usr/bin/env bash
set -euo pipefail

# Primeflow – Backup Orquestrado (VM + Postgres + Configs)
# Uso:
#  ./scripts/infra/backup.sh [--output /backup/dir] [--mode docker|local] [--db-name primeflow]
# Env suportadas: BACKUP_DIR, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DOCKER_PROJECT

BACKUP_DIR=${1:-}
if [[ "$BACKUP_DIR" == "--output" ]]; then
  BACKUP_DIR=${2:-}
  shift 2 || true
fi

MODE="auto"
if [[ "${1:-}" == "--mode" ]]; then
  MODE=${2:-auto}
  shift 2 || true
fi

DB_NAME="primeflow"
if [[ "${1:-}" == "--db-name" ]]; then
  DB_NAME=${2:-primeflow}
  shift 2 || true
fi

TS=$(date +%Y%m%d_%H%M%S)
HOST_BACKUP_DIR=${BACKUP_DIR:-"$(pwd)/backups"}
TARGET_DIR="$HOST_BACKUP_DIR/$TS"
mkdir -p "$TARGET_DIR"

echo "[backup] Iniciando backup em: $TARGET_DIR"

# 1) Salvar variáveis sensíveis e configs
echo "[backup] Copiando .env e arquivos de configuração"
cp -f .env "$TARGET_DIR/.env" 2>/dev/null || true
cp -f .env.web "$TARGET_DIR/.env.web" 2>/dev/null || true
cp -f .env.production "$TARGET_DIR/.env.production" 2>/dev/null || true
cp -f nginx-production.conf "$TARGET_DIR/nginx-production.conf" 2>/dev/null || true
cp -rf nginx "$TARGET_DIR/nginx" 2>/dev/null || true

# 2) Dump do Postgres (docker ou local)
echo "[backup] Executando dump do Postgres ($DB_NAME)"

run_pg_dump_local() {
  : "${DB_HOST:=127.0.0.1}" "${DB_PORT:=5432}" "${DB_USER:=postgres}" "${DB_PASSWORD:=postgres}"
  export PGPASSWORD="$DB_PASSWORD"
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Fc -f "$TARGET_DIR/${DB_NAME}.dump"
}

run_pg_dump_docker() {
  local service=${DOCKER_SERVICE_POSTGRES:-postgres}
  local compose=${DOCKER_COMPOSE_FILE:-docker-compose.yml}
  local container
  container=$(docker compose -f "$compose" ps -q "$service" 2>/dev/null || true)
  if [[ -z "$container" ]]; then
    echo "[backup] Container do Postgres não encontrado (service=$service). Tentando local..."
    run_pg_dump_local
    return
  fi
  docker exec -e PGPASSWORD=postgres "$container" \
    pg_dump -h localhost -U postgres -d "$DB_NAME" -Fc -f "/tmp/${DB_NAME}.dump"
  docker cp "$container:/tmp/${DB_NAME}.dump" "$TARGET_DIR/${DB_NAME}.dump"
}

case "$MODE" in
  docker) run_pg_dump_docker ;;
  local) run_pg_dump_local ;;
  auto|*)
    if docker compose ps >/dev/null 2>&1; then
      run_pg_dump_docker || run_pg_dump_local
    else
      run_pg_dump_local
    fi
    ;;
esac

# 3) Backup de uploads/sessions (se existirem)
echo "[backup] Copiando dados de uploads e sessões"
mkdir -p "$TARGET_DIR/var"
cp -rf var/uploads "$TARGET_DIR/var/uploads" 2>/dev/null || true
cp -rf var/whatsapp-sessions "$TARGET_DIR/var/whatsapp-sessions" 2>/dev/null || true

# 4) Compactar pacote
ARCHIVE="$HOST_BACKUP_DIR/primeflow_backup_${TS}.tar.gz"
echo "[backup] Compactando em $ARCHIVE"
tar -czf "$ARCHIVE" -C "$HOST_BACKUP_DIR" "$TS"
echo "[backup] Removendo diretório temporário"
rm -rf "$TARGET_DIR"

echo "[backup] Finalizado: $ARCHIVE"

