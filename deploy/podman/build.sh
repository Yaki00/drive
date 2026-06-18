#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

PROJECT_ROOT="$(resolve_project_root "$SCRIPT_DIR")"
APP_DIR="$SCRIPT_DIR/app"
IMAGE_NAME="${IMAGE_NAME:-bookmarks-app}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "→ Racine bookmarks : $PROJECT_ROOT"

echo "=== 1/5 — Build frontend (sans eslint / zod-validation-error) ==="
cd "$PROJECT_ROOT/frontend"
# Prod deps only, puis outils de build — évite eslint-plugin-react-hooks → zod-validation-error
npm ci --omit=dev
npm install --no-save --no-audit \
  vite@^8.0.12 \
  typescript@~6.0.2 \
  "@vitejs/plugin-react@^6.0.1" \
  "@types/node@^24.12.3" \
  "@types/react@^19.2.14" \
  "@types/react-dom@^19.2.3"
VITE_API_URL= npm run build

echo "=== 2/5 — Build backend (sans jest / eslint) ==="
cd "$PROJECT_ROOT/backend"
npm ci --omit=dev
npm install --no-save --no-audit \
  "@nestjs/cli@^11.0.0" \
  typescript@^5.7.3
npm run build

echo "=== 3/5 — Assemblage app/ (API + UI statique) ==="
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/dist/public"
cp -R dist/. "$APP_DIR/dist/"
cp -R "$PROJECT_ROOT/frontend/dist/." "$APP_DIR/dist/public/"
cp package.json package-lock.json "$APP_DIR/"
npm ci --omit=dev --prefix "$APP_DIR"

echo "=== 4/5 — Rootfs minimal (Node depuis l'hôte) ==="
"$SCRIPT_DIR/prepare-rootfs.sh"

echo "=== 5/5 — Construction de l'image Podman ==="
cd "$SCRIPT_DIR"
podman build -f Containerfile -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo ""
echo "Image construite : ${IMAGE_NAME}:${IMAGE_TAG}"
echo "Lancer avec : $SCRIPT_DIR/run.sh"
