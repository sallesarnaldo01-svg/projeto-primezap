#!/usr/bin/env bash
set -euo pipefail

echo "🔎 Kernel version"
uname -r

echo "🔎 Docker services"
docker compose ps

echo "🔎 API health"
curl -fsS http://localhost:4000/healthz && echo "✓ api /healthz" || echo "✗ api /healthz"

echo "🔎 Frontend"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080 || true

echo "✅ Post-reboot validation done"

