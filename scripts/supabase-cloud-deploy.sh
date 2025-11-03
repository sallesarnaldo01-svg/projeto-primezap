#!/usr/bin/env bash
set -euo pipefail

# Deploy Supabase migrations and Edge Functions to Supabase Cloud.
# Requirements:
#  - Supabase CLI v2.x installed and in PATH
#  - Environment variable SUPABASE_ACCESS_TOKEN set with a PAT that has access to the project
#  - supabase/config.toml with project_id configured

echo "[supabase] Checking CLI..."
supabase --version

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "[supabase] ERROR: SUPABASE_ACCESS_TOKEN is not set (PAT required)." >&2
  echo "Create a PAT from an Owner of the project and export it, e.g.:" >&2
  echo "  export SUPABASE_ACCESS_TOKEN=sbp_xxx" >&2
  exit 1
fi

PROJECT_REF=${SUPABASE_PROJECT_REF:-$(awk -F'"' '/^project_id/{print $2}' supabase/config.toml)}
if [[ -z "${PROJECT_REF}" ]]; then
  echo "[supabase] ERROR: Could not determine project_ref from supabase/config.toml" >&2
  exit 1
fi

echo "[supabase] Using project: ${PROJECT_REF}"

echo "[supabase] Linking project"
supabase link --project-ref "${PROJECT_REF}" --no-open >/dev/null || true

echo "[supabase] Pushing migrations to Cloud (db push)"
supabase db push --project-ref "${PROJECT_REF}"

echo "[supabase] Deploying Edge Functions"
if [[ -d supabase/functions ]]; then
  while IFS= read -r fn; do
    echo "  - Deploying: ${fn}"
    supabase functions deploy "${fn}" --project-ref "${PROJECT_REF}" || {
      echo "[warn] Failed to deploy function ${fn}" >&2
    }
  done < <(find supabase/functions -maxdepth 1 -mindepth 1 -type d -printf '%f\n' | sort)
else
  echo "[supabase] No functions directory found. Skipping."
fi

echo "[supabase] Functions available:"
supabase functions list --project-ref "${PROJECT_REF}" || true

echo "[supabase] Done."

