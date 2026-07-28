#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/env.local}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +a
fi

IMAGE_NAME="${IMAGE_NAME:-bookmarks-app}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
CONTAINER_NAME="${CONTAINER_NAME:-bookmarks-app}"
HOST_PORT="${HOST_PORT:-3001}"
DATA_DIR="${DATA_DIR:-$SCRIPT_DIR/data}"

mkdir -p "$DATA_DIR"

podman rm -f "$CONTAINER_NAME" 2>/dev/null || true

podman run -d \
  --name "$CONTAINER_NAME" \
  -p "${HOST_PORT}:3001" \
  -v "${DATA_DIR}:/data:Z" \
  "${IMAGE_NAME}:${IMAGE_TAG}"

echo "Application disponible sur http://localhost:${HOST_PORT}"
echo "Données JSON : ${DATA_DIR}/drive.json"
