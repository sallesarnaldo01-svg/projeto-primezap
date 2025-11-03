#!/usr/bin/env bash
set -euo pipefail

# Simple deploy lock using flock to avoid concurrent runs
# Idempotent: If lockfile exists and is locked, exit with code 16

LOCKFILE="/var/lock/primezap.deploy.lock"
mkdir -p "$(dirname "$LOCKFILE")" || true

exec 9>"$LOCKFILE"
if ! flock -n 9; then
  echo "[deploy] outro deploy em andamento" >&2
  exit 16
fi

trap 'flock -u 9' EXIT

"$@"

