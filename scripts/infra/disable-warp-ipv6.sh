#!/usr/bin/env bash
set -euo pipefail

# Disable Cloudflare WARP (wgcf) service. Use --purge to remove config as well.

WGCF_SVC="wg-quick@wgcf"
WGCF_CONF="/etc/wireguard/wgcf.conf"

need_sudo() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 1; else echo 0; fi
}

run() {
  if [ "$(need_sudo)" -eq 1 ]; then sudo bash -c "$*"; else bash -c "$*"; fi
}

echo "[warp] Disabling ${WGCF_SVC}"
run "systemctl disable --now '${WGCF_SVC}'" || true

if [ "${1:-}" = "--purge" ]; then
  echo "[warp] Purging config ${WGCF_CONF} and local wgcf files"
  run "rm -f '${WGCF_CONF}'"
  rm -f wgcf-account.toml wgcf-profile.conf 2>/dev/null || true
fi

echo "✅ WARP (wgcf) disabled"

