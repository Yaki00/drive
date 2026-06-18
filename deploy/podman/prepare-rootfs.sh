#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOTFS_DIR="${ROOTFS_DIR:-$SCRIPT_DIR/rootfs}"
NODE_BIN="${NODE_BIN:-$(command -v node)}"

if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Erreur : binaire node introuvable. Définissez NODE_BIN ou installez Node.js." >&2
  exit 1
fi

echo "→ Préparation du rootfs depuis $NODE_BIN"

rm -rf "$ROOTFS_DIR"
mkdir -p "$ROOTFS_DIR/usr/local/bin"
mkdir -p "$ROOTFS_DIR/lib"
mkdir -p "$ROOTFS_DIR/lib64"
mkdir -p "$ROOTFS_DIR/etc/ssl/certs"

cp -L "$NODE_BIN" "$ROOTFS_DIR/usr/local/bin/node"
chmod 755 "$ROOTFS_DIR/usr/local/bin/node"

copy_lib() {
  local lib_path="$1"
  [[ -z "$lib_path" || "$lib_path" == "not" ]] && return 0
  [[ ! -f "$lib_path" ]] && return 0

  local dest
  if [[ "$lib_path" == /lib64/* ]]; then
    dest="$ROOTFS_DIR/lib64/$(basename "$lib_path")"
  else
    dest="$ROOTFS_DIR/lib/$(basename "$lib_path")"
  fi

  if [[ ! -e "$dest" ]]; then
    cp -L "$lib_path" "$dest"
  fi
}

if command -v ldd >/dev/null 2>&1; then
  while read -r lib_path _; do
    copy_lib "$lib_path"
  done < <(ldd "$NODE_BIN" | awk '/=>/ {print $3} /^\// {print $1}')
else
  echo "Avertissement : ldd absent — copie manuelle des libs peut être nécessaire." >&2
fi

if [[ -f /etc/ssl/certs/ca-certificates.crt ]]; then
  cp /etc/ssl/certs/ca-certificates.crt "$ROOTFS_DIR/etc/ssl/certs/"
elif [[ -f /etc/pki/tls/certs/ca-bundle.crt ]]; then
  cp /etc/pki/tls/certs/ca-bundle.crt "$ROOTFS_DIR/etc/ssl/certs/ca-certificates.crt"
fi

echo "→ Rootfs prêt : $ROOTFS_DIR"
