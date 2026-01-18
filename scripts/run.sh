#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-docker}"
PORT="${PORT:-5173}"
IMAGE_NAME="tg-miniapp-dev"

ensure_traefik_network() {
  if ! docker network inspect traefik-public >/dev/null 2>&1; then
    docker network create traefik-public >/dev/null
  fi
}

run_docker_traefik() {
  cd "$ROOT_DIR"
  DOMAIN="${DOMAIN:-localhost}"
  ensure_traefik_network
  DOMAIN="$DOMAIN" docker compose up --build
}

run_docker_local() {
  cd "$ROOT_DIR"
  docker build --target dev -t "$IMAGE_NAME" .
  docker run --rm -it -p "$PORT:5173" "$IMAGE_NAME"
}

run_local() {
  cd "$ROOT_DIR"
  npm ci
  npm run dev -- --host 0.0.0.0 --port "$PORT"
}

case "$MODE" in
  docker) run_docker_traefik ;;
  docker-local) run_docker_local ;;
  local) run_local ;;
  *)
    echo "Usage: $0 [docker|docker-local|local]" >&2
    exit 1
    ;;
esac



