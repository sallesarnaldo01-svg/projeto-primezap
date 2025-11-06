#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Fetches a static snapshot of the legacy CRM and AI Settings pages so they can
# be served as read-only fallbacks from the public/legacy-cache directory.
# Requires curl and network access to the production site.
# -----------------------------------------------------------------------------

TARGET_DIR="${TARGET_DIR:-public/legacy-cache}"
LEGACY_BASE_URL="${LEGACY_BASE_URL:-https://primezap.primezapia.com}"

declare -A PAGES=(
  [crm]="${LEGACY_BASE_URL%/}/crm"
  [configuracoes-ia]="${LEGACY_BASE_URL%/}/configuracoes/ia"
)

mkdir -p "${TARGET_DIR}"

echo "[legacy-cache] Saving fallback pages into ${TARGET_DIR}"
for name in "${!PAGES[@]}"; do
  url="${PAGES[$name]}"
  output="${TARGET_DIR}/${name}.html"
  echo "  → Fetching ${url}"
  if ! curl -fsSL "${url}" -o "${output}"; then
    echo "  ⚠ Failed to fetch ${url}"
    rm -f "${output}"
    exit 1
  fi
  echo "  ✓ Saved ${output}"
done

echo "[legacy-cache] Done. Deploy the updated public/legacy-cache directory."
