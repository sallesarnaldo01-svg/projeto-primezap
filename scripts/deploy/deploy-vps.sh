#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Non-interactive deploy script for production VPS environments.
# Designed to be triggered remotely (e.g. via GitHub Actions) to keep the
# repository in sync with the specified branch and restart the production stack.
# -----------------------------------------------------------------------------

REPO_URL="${REPO_URL:-git@github.com:${GITHUB_REPOSITORY}.git}"
APP_DIR="${APP_DIR:-/home/administrator/primezap}"
BRANCH="${BRANCH:-main}"
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_SOURCE_FILE="${ENV_SOURCE_FILE:-.env.production}"
ENV_TARGET_FILE="${ENV_TARGET_FILE:-.env}"

echo "[deploy-vps] Repository: ${REPO_URL}"
echo "[deploy-vps] Target directory: ${APP_DIR}"
echo "[deploy-vps] Branch: ${BRANCH}"
echo "[deploy-vps] Compose file: ${DOCKER_COMPOSE_FILE}"

mkdir -p "${APP_DIR}"
cd "${APP_DIR}"

if [ ! -d .git ]; then
  echo "[deploy-vps] Cloning repository..."
  git clone "${REPO_URL}" .
fi

printf "[deploy-vps] Fetching latest changes...\n"
git fetch origin "${BRANCH}"
CURRENT_BRANCH="$(git branch --show-current || true)"
if [ "${CURRENT_BRANCH}" != "${BRANCH}" ]; then
  git checkout "${BRANCH}"
fi

git pull --ff-only origin "${BRANCH}"

if [ -f "${ENV_SOURCE_FILE}" ]; then
  echo "[deploy-vps] Syncing environment file (${ENV_SOURCE_FILE} -> ${ENV_TARGET_FILE})"
  cp "${ENV_SOURCE_FILE}" "${ENV_TARGET_FILE}"
else
  echo "[deploy-vps] Warning: ${ENV_SOURCE_FILE} not found. Ensure environment variables are present."
fi

echo "[deploy-vps] Building and starting docker-compose stack..."
docker compose -f "${DOCKER_COMPOSE_FILE}" pull || true
docker compose -f "${DOCKER_COMPOSE_FILE}" up -d --build --remove-orphans

echo "[deploy-vps] Cleaning up dangling Docker resources..."
docker image prune -f >/dev/null || true
docker builder prune -f >/dev/null || true

echo "[deploy-vps] Deploy finished successfully."
