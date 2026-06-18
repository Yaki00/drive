#!/usr/bin/env bash

# Racine du module bookmarks (contient frontend/ et backend/).
# Surcharge possible : BOOKMARKS_ROOT ou PROJECT_ROOT.
resolve_project_root() {
  local candidate="${BOOKMARKS_ROOT:-${PROJECT_ROOT:-}}"

  if [[ -n "$candidate" ]]; then
    if [[ ! -f "$candidate/frontend/package.json" || ! -f "$candidate/backend/package.json" ]]; then
      echo "Erreur : BOOKMARKS_ROOT/PROJECT_ROOT invalide ($candidate) — frontend/ ou backend/ manquant." >&2
      exit 1
    fi
    cd "$candidate" && pwd
    return
  fi

  local dir="$1"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/frontend/package.json" && -f "$dir/backend/package.json" ]]; then
      echo "$dir"
      return
    fi
    dir="$(dirname "$dir")"
  done

  echo "Erreur : racine bookmarks introuvable (répertoire avec frontend/ et backend/)." >&2
  echo "Définissez BOOKMARKS_ROOT=/chemin/vers/bookmarks" >&2
  exit 1
}
