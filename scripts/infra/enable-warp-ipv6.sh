#!/usr/bin/env bash
set -euo pipefail

# Enable Cloudflare WARP (wgcf) to provide IPv6 egress on hosts without native IPv6.
# - Keeps IPv4 routing untouched (AllowedIPs = ::/0)
# - Idempotent: safe to re-run

WGCF_VER="${WGCF_VER:-2.2.20}"
WGCF_BIN="/usr/local/bin/wgcf"
WGCF_SVC="wg-quick@wgcf"
WGCF_CONF="/etc/wireguard/wgcf.conf"

need_sudo() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 1; else echo 0; fi
}

run() {
  if [ "$(need_sudo)" -eq 1 ]; then sudo bash -c "$*"; else bash -c "$*"; fi
}

echo "[warp] Ensuring dependencies (wireguard, resolvconf, curl)"
if command -v apt-get >/dev/null 2>&1; then
  run "apt-get update -y"
  run "apt-get install -y wireguard resolvconf curl"
else
  echo "[warp] Skipping apt-get (not available). Ensure wireguard + resolvconf + curl are installed."
fi

if ! command -v wg >/dev/null 2>&1; then
  echo "❌ WireGuard tools (wg) not found. Please install wireguard-tools."
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "❌ curl not found. Please install curl."
  exit 1
fi

if ! command -v wgcf >/dev/null 2>&1; then
  echo "[warp] Installing wgcf v${WGCF_VER}"
  TMP_BIN="/tmp/wgcf_${WGCF_VER}_linux_amd64"
  run "curl -fsSL -o '${TMP_BIN}' 'https://github.com/ViRb3/wgcf/releases/download/v${WGCF_VER}/wgcf_${WGCF_VER}_linux_amd64'"
  run "chmod +x '${TMP_BIN}' && mv '${TMP_BIN}' '${WGCF_BIN}'"
fi

if [ ! -f "wgcf-account.toml" ]; then
  echo "[warp] Registering wgcf account (accepting TOS)"
  run "WGCF_ACCOUNT_FILE=wgcf-account.toml ${WGCF_BIN} register --accept-tos"
fi

if [ ! -f "wgcf-profile.conf" ] && [ ! -f "${WGCF_CONF}" ]; then
  echo "[warp] Generating wgcf profile"
  run "WGCF_ACCOUNT_FILE=wgcf-account.toml ${WGCF_BIN} generate"
fi

if [ ! -f "${WGCF_CONF}" ]; then
  echo "[warp] Installing profile to ${WGCF_CONF}"
  run "mkdir -p /etc/wireguard"
  run "mv wgcf-profile.conf '${WGCF_CONF}'"
fi

echo "[warp] Forcing IPv6-only tunnel routing (keep IPv4 out of the tunnel)"
run "sed -i 's/^AllowedIPs = .*$/AllowedIPs = ::\\/0/' '${WGCF_CONF}'"

echo "[warp] Removing DNS overrides from wgcf.conf (preserve host DNS)"
run "sed -i '/^DNS = /d' '${WGCF_CONF}'"

echo "[warp] Ensuring MTU = 1280 under [Interface]"
if ! grep -q '^MTU = ' "${WGCF_CONF}"; then
  run "awk 'BEGIN{in_iface=0} /\[Interface\]/{in_iface=1; print; next} in_iface && !done {print \"MTU = 1280\"; done=1} {print}' '${WGCF_CONF}' > '${WGCF_CONF}.tmp' && mv '${WGCF_CONF}.tmp' '${WGCF_CONF}'"
fi

echo "[warp] Enabling and starting ${WGCF_SVC}"
run "systemctl enable --now '${WGCF_SVC}'"

echo "[warp] Validating IPv6 egress (curl -6)"
if ! curl -6 -fsSL https://ifconfig.co >/dev/null 2>&1; then
  echo "❌ IPv6 egress not working yet. Check firewall (UDP/2408), service logs: journalctl -u ${WGCF_SVC} -n 100" >&2
  systemctl is-active "${WGCF_SVC}" || true
  exit 2
fi

echo "[warp] IPv6 egress OK"

if [ -n "${DATABASE_URL:-}" ]; then
  echo "[warp] Testing Supabase connectivity via psql"
  if command -v psql >/dev/null 2>&1; then
    if ! psql "${DATABASE_URL}" -c "select now();" >/dev/null 2>&1; then
      echo "❌ psql failed against DATABASE_URL" >&2
      exit 3
    fi
  else
    echo "[warp] psql not found, testing with docker-run postgres:16-alpine"
    if ! docker run --rm postgres:16-alpine sh -lc "psql '${DATABASE_URL}' -c 'select now();'" >/dev/null 2>&1; then
      echo "❌ docker-run psql failed against DATABASE_URL" >&2
      exit 3
    fi
  fi
  echo "[warp] Supabase connectivity OK"
fi

echo "✅ WARP (wgcf) enabled with IPv6 egress"
echo "Tip: make switch-to-supabase (after exporting DATABASE_URL)"
