#!/usr/bin/env bash
set -euo pipefail

# Atualiza prometheus.yml para usar alvos internos do Docker em vez de host.docker.internal
FILE="prometheus.yml"
if [[ ! -f "$FILE" ]]; then
  echo "prometheus.yml não encontrado"
  exit 1
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

awk '
  BEGIN{injob=0}
  /job_name:..primeflow-backend/{injob=1}
  injob && /targets:..\[/ { sub(/host.docker.internal:4000/, "api:4000"); injob=0 }
  { print }
' "$FILE" > "$tmp.1"

awk '
  BEGIN{injob=0}
  /job_name:..primeflow-frontend/{injob=1}
  injob && /targets:..\[/ { sub(/host.docker.internal:8080/, "web:8080"); injob=0 }
  { print }
' "$tmp.1" > "$tmp.2"

mv "$tmp.2" "$FILE"
echo "[prometheus] Alvos atualizados para api:4000 e web:8080"

