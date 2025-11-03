#!/usr/bin/env bash
set -euo pipefail

# Primeflow – Endurecimento de portas (UFW + Docker)
# Objetivo: garantir 5432/6379/4000 restritas à rede interna e/ou localhost

echo "[harden] Verificando Docker Compose portas expostas"
compose="${DOCKER_COMPOSE_FILE:-docker-compose.yml}"
if grep -R "\bports:\b" -n "$compose" >/dev/null 2>&1; then
  echo "[harden] Atenção: compose expõe portas. Recomenda-se remover 'ports' de api/redis/postgres e usar nginx como único ingress."
else
  echo "[harden] OK: compose não expõe portas diretas (api/redis/postgres)."
fi

echo "[harden] Configurando UFW"
sudo ufw default deny incoming || true
sudo ufw default allow outgoing || true
sudo ufw allow 22/tcp || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow ${HTTP_PORT:-8081}/tcp || true
sudo ufw allow ${HTTPS_PORT:-8444}/tcp || true

# Bloquear acessos externos a 5432/6379/4000; permitir somente da bridge docker local
DOCKER_SUBNET=$(ip -o -4 addr show docker0 2>/dev/null | awk '{print $4}' || true)
if [[ -n "$DOCKER_SUBNET" ]]; then
  echo "[harden] Permitindo sub-rede docker $DOCKER_SUBNET para portas internas"
  sudo ufw allow from "$DOCKER_SUBNET" to any port 5432 proto tcp || true
  sudo ufw allow from "$DOCKER_SUBNET" to any port 6379 proto tcp || true
  sudo ufw allow from "$DOCKER_SUBNET" to any port 4000 proto tcp || true
fi

echo "[harden] Negando acesso externo a 5432/6379/4000"
sudo ufw deny 5432/tcp || true
sudo ufw deny 6379/tcp || true
sudo ufw deny 4000/tcp || true

echo "[harden] UFW status resumido:"
sudo ufw --force enable || true
sudo ufw status numbered || true

echo "[harden] Concluído"

