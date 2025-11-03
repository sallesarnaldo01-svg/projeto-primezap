#!/usr/bin/env bash
set -euo pipefail

# Primeflow – Restore (Postgres + Configs)
# Uso:
#  ./scripts/infra/restore.sh /path/primeflow_backup_YYYYMMDD_HHMMSS.tar.gz [--mode docker|local]

ARCHIVE=${1:-}
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Uso: $0 /caminho/para/primeflow_backup_*.tar.gz [--mode docker|local]"
  exit 1
fi

MODE="auto"
if [[ "${2:-}" == "--mode" ]]; then
  MODE=${3:-auto}
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT
tar -xzf "$ARCHIVE" -C "$WORKDIR"
EXTRACT_DIR=$(find "$WORKDIR" -maxdepth 1 -type d -name "20*" | head -n1)

if [[ -z "$EXTRACT_DIR" ]]; then
  echo "[restore] Estrutura do backup inválida"
  exit 1
fi

echo "[restore] Restaurando configs (.env, nginx, var/*)"
cp -f "$EXTRACT_DIR/.env" .env 2>/dev/null || true
cp -f "$EXTRACT_DIR/.env.web" .env.web 2>/dev/null || true
cp -rf "$EXTRACT_DIR/nginx" ./nginx 2>/dev/null || true
mkdir -p var
cp -rf "$EXTRACT_DIR/var/uploads" var/uploads 2>/dev/null || true
cp -rf "$EXTRACT_DIR/var/whatsapp-sessions" var/whatsapp-sessions 2>/dev/null || true

DUMP_FILE=$(find "$EXTRACT_DIR" -maxdepth 1 -name "*.dump" | head -n1)
if [[ -n "$DUMP_FILE" ]]; then
  echo "[restore] Restaurando banco a partir de $DUMP_FILE"
  run_pg_restore_local() {
    : "${DB_HOST:=127.0.0.1}" "${DB_PORT:=5432}" "${DB_USER:=postgres}" "${DB_PASSWORD:=postgres}" "${DB_NAME:=primeflow}"
    export PGPASSWORD="$DB_PASSWORD"
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --clean --if-exists "$DUMP_FILE"
  }

  run_pg_restore_docker() {
    local service=${DOCKER_SERVICE_POSTGRES:-postgres}
    local compose=${DOCKER_COMPOSE_FILE:-docker-compose.yml}
    local container
    container=$(docker compose -f "$compose" ps -q "$service" 2>/dev/null || true)
    if [[ -z "$container" ]]; then
      echo "[restore] Container do Postgres não encontrado. Tentando local..."
      run_pg_restore_local
      return
    fi
    local tmp="/tmp/restore.dump"
    docker cp "$DUMP_FILE" "$container:$tmp"
    docker exec -e PGPASSWORD=postgres "$container" sh -lc '
      createdb -h localhost -U postgres primeflow 2>/dev/null || true && \
      pg_restore -h localhost -U postgres -d primeflow --clean --if-exists /tmp/restore.dump'
  }

  case "$MODE" in
    docker) run_pg_restore_docker ;;
    local) run_pg_restore_local ;;
    auto|*)
      if docker compose ps >/dev/null 2>&1; then
        run_pg_restore_docker || run_pg_restore_local
      else
        run_pg_restore_local
      fi
      ;;
  esac
else
  echo "[restore] Nenhum arquivo .dump encontrado, pulando restauração do DB"
fi

echo "[restore] Concluído"

