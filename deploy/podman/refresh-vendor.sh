#!/usr/bin/env bash
set -euo pipefail

# Régénère les archives offline dans vendor/ (machine AVEC npm pour le frontend).
# Backend Node pur : pas de compilation, pas de node_modules runtime.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

PROJECT_ROOT="$(resolve_project_root "$SCRIPT_DIR")"
VENDOR_DIR="$SCRIPT_DIR/vendor"
mkdir -p "$VENDOR_DIR"

echo "→ Racine bookmarks : $PROJECT_ROOT"

echo "=== Frontend ==="
cd "$PROJECT_ROOT/frontend"
npm ci
npm run build
tar czf "$VENDOR_DIR/frontend-dist.tgz" -C "$PROJECT_ROOT/frontend" dist

echo "=== Backend (Node pur, zéro dépendance) ==="
tar czf "$VENDOR_DIR/backend-server.tgz" -C "$PROJECT_ROOT/backend" server package.json

# Anciennes archives Nest — plus nécessaires
rm -f "$VENDOR_DIR/backend-dist.tgz" "$VENDOR_DIR/backend-prod-node_modules.tgz"

echo ""
ls -lh "$VENDOR_DIR"/*.tgz
echo ""
echo "Committez deploy/podman/vendor/*.tgz puis git push."
echo "Sur le serveur : git pull && ./deploy/podman/build.sh"
