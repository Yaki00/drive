#!/usr/bin/env bash
set -euo pipefail

# Build 100 % hors-ligne : aucun npm requis sur le serveur.
# Utilise deploy/podman/vendor/*.tgz (versionnés dans git).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

PROJECT_ROOT="$(resolve_project_root "$SCRIPT_DIR")"
APP_DIR="$SCRIPT_DIR/app"
VENDOR_DIR="$SCRIPT_DIR/vendor"
IMAGE_NAME="${IMAGE_NAME:-bookmarks-app}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

FRONTEND_DIST="$VENDOR_DIR/frontend-dist.tgz"
BACKEND_SERVER="$VENDOR_DIR/backend-server.tgz"

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Erreur : fichier manquant : $1" >&2
    echo "Faites git pull — les archives sont dans deploy/podman/vendor/." >&2
    echo "Ou régénérez avec : ./deploy/podman/refresh-vendor.sh" >&2
    exit 1
  fi
}

require_file "$FRONTEND_DIST"
require_file "$BACKEND_SERVER"

echo "→ Racine bookmarks : $PROJECT_ROOT"
echo "→ Mode hors-ligne (aucun npm)"

echo "=== 1/3 — Assemblage app/ ==="
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/public"

tar xzf "$BACKEND_SERVER" -C "$APP_DIR"
tar xzf "$FRONTEND_DIST" -C "$APP_DIR/public" --strip-components=1

if [[ ! -f "$APP_DIR/server/server.js" ]]; then
  echo "Erreur : app/server/server.js introuvable après extraction." >&2
  exit 1
fi

echo "=== 2/3 — Rootfs (Node depuis l'hôte) ==="
"$SCRIPT_DIR/prepare-rootfs.sh"

echo "=== 3/3 — Image Podman ==="
cd "$SCRIPT_DIR"
podman build -f Containerfile -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo ""
echo "Image construite : ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Lancer avec : $SCRIPT_DIR/run.sh"
