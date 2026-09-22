#!/usr/bin/env bash
# One-shot Docker deployment for SpaceNinjaServer.
#
# Needed because `docker pull` only fetches the image: the compose file lives in the repository, not in the
# image, so a server that only pulled the image has nothing for `docker compose up` to read.
#
# Usage, from the directory where you want the stack's data to live:
#   curl -fsSL https://raw.githubusercontent.com/Specia1z/SpaceNinjaServer/main/deploy.sh | bash
#
# Or, if you already have the repository checked out:
#   ./deploy.sh
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/Specia1z/SpaceNinjaServer/main"
COMPOSE_FILE="docker-compose.yml"

echo "==> Preparing SpaceNinjaServer in $(pwd)"

if ! command -v docker >/dev/null 2>&1; then
    echo "ERROR: docker is not installed or not on PATH." >&2
    exit 1
fi

if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
else
    echo "ERROR: neither 'docker compose' nor 'docker-compose' is available." >&2
    exit 1
fi

# Fetch the compose file when running standalone. When this script sits next to a checked-out compose file,
# that one is used as-is so a local edit is not silently overwritten.
if [ -f "$COMPOSE_FILE" ] && grep -q "spaceninjaserver" "$COMPOSE_FILE"; then
    echo "==> Using existing $COMPOSE_FILE"
elif [ -f "$(dirname "$0")/$COMPOSE_FILE" ]; then
    cp "$(dirname "$0")/$COMPOSE_FILE" "$COMPOSE_FILE"
    echo "==> Copied $COMPOSE_FILE from the checkout"
else
    echo "==> Downloading $COMPOSE_FILE"
    curl -fsSL "$REPO_RAW/$COMPOSE_FILE" -o "$COMPOSE_FILE"
fi

# The compose file bind-mounts these paths. Docker creates missing ones as root-owned directories, which then
# cannot be written by the container's non-root user, so create them up front with sane permissions.
echo "==> Creating data directories"
mkdir -p docker-data/conf docker-data/static-data docker-data/logs docker-data/database .well-known
chmod 777 .well-known

echo "==> Pulling images"
$COMPOSE pull

echo "==> Starting the stack"
$COMPOSE up -d

echo
echo "Done. Useful commands:"
echo "  $COMPOSE ps            # check container status"
echo "  $COMPOSE logs -f spaceninjaserver   # follow server logs"
echo "  $COMPOSE down          # stop the stack"
echo
echo "The first launch writes docker-data/conf/config.json from config-vanilla.json."
echo "Edit it to set myAddress to the address clients will connect to, then restart:"
echo "  $COMPOSE restart spaceninjaserver"
