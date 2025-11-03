#!/usr/bin/env bash
set -euo pipefail

# Publica Edge Functions no projeto Supabase online
# Pré-requisitos: supabase CLI autenticado e projeto linkado

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

echo "🚀 Publicando Edge Functions"
if [[ -d supabase/functions ]]; then
  while IFS= read -r fn; do
    echo "  - Deploying: ${fn}"
    supabase functions deploy "${fn}" || {
      echo "[warn] Failed to deploy function ${fn}" >&2
    }
  done < <(find supabase/functions -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort)
else
  echo "[supabase] No functions directory found. Skipping."
fi

echo "✅ Edge Functions publicadas"
