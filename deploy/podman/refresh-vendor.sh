#!/usr/bin/env bash
set -euo pipefail

# Régénère les archives offline dans vendor/ (machine AVEC npm — CI ou poste perso).
# À committer dans git pour que le serveur Red Hat n'ait besoin d'aucun npm.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

PROJECT_ROOT="$(resolve_project_root "$SCRIPT_DIR")"
VENDOR_DIR="$SCRIPT_DIR/vendor"
mkdir -p "$VENDOR_DIR"

echo "→ Racine bookmarks : $PROJECT_ROOT"

echo "=== Frontend ==="
cd "$PROJECT_ROOT/frontend"
npm ci --omit=dev
npm install --no-save --no-audit \
  vite@^8.0.12 typescript@~6.0.2 "@vitejs/plugin-react@^6.0.1" \
  "@types/node@^24.12.3" "@types/react@^19.2.14" "@types/react-dom@^19.2.3"
VITE_API_URL= npm run build
tar czf "$VENDOR_DIR/frontend-dist.tgz" -C "$PROJECT_ROOT/frontend" dist

echo "=== Backend ==="
cd "$PROJECT_ROOT/backend"
npm ci --omit=dev
npm install --no-save --no-audit "@nestjs/cli@^11.0.0" typescript@^5.7.3
npm run build
tar czf "$VENDOR_DIR/backend-dist.tgz" -C "$PROJECT_ROOT/backend" dist
tar czf "$VENDOR_DIR/backend-prod-node_modules.tgz" -C "$PROJECT_ROOT/backend" node_modules

echo ""
ls -lh "$VENDOR_DIR"/*.tgz
echo ""
echo "Committez deploy/podman/vendor/*.tgz puis git push."
echo "Sur le serveur : git pull && ./deploy/podman/build.sh"
