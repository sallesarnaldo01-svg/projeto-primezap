#!/usr/bin/env bash
set -euo pipefail

# Primeflow – Reboot Planejado + Validação
# 1) Pré-checks; 2) Reboot; 3) Pós-checks e validação de serviços

pre_checks() {
  echo "[pre] Kernel atual: $(uname -r)"
  echo "[pre] Uptime: $(uptime -p)"
  echo "[pre] Espaço em disco:"
  df -h /
  echo "[pre] Serviços docker:"
  docker compose ps || true
}

post_checks() {
  echo "[post] Kernel após reboot: $(uname -r)"
  echo "[post] Último boot:"
  who -b || true
  echo "[post] Validando docker compose..."
  docker compose up -d
  sleep 5
  docker compose ps
  echo "[post] Checando logs da API (últimas 100 linhas)"
  docker compose logs --tail=100 api || true
  echo "[post] Health HTTP via nginx (se exposto)"
  curl -fsS http://127.0.0.1:${HTTP_PORT:-8081}/healthz || true
  echo "[post] Aviso: verifique mensagens qxl em journalctl (-k) para drivers gráficos (se aplicável)"
}

case "${1:-}" in
  pre) pre_checks ;;
  post) post_checks ;;
  *)
    echo "Uso: $0 pre|post"
    echo "  pre  -> roda antes do reboot"
    echo "  post -> roda após o reboot"
    exit 1
    ;;
esac

