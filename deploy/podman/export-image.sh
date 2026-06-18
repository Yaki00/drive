#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-bookmarks-app}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
OUTPUT="${OUTPUT:-bookmarks-app.tar}"

podman save "${IMAGE_NAME}:${IMAGE_TAG}" -o "$OUTPUT"
echo "Image exportée : $OUTPUT"
echo "Sur le serveur : podman load -i $OUTPUT && ./deploy/podman/run.sh"
