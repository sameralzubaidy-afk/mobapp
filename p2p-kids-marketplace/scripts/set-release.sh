#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

RELEASE=${1:-$(git rev-parse --short HEAD)}
echo "Setting EXPO_PUBLIC_RELEASE=$RELEASE in .env.local"
if [ ! -f .env.local ]; then
  touch .env.local
fi

# Remove existing key if present
grep -v '^EXPO_PUBLIC_RELEASE=' .env.local > .env.local.tmp || true
mv .env.local.tmp .env.local
echo "EXPO_PUBLIC_RELEASE=$RELEASE" >> .env.local
export EXPO_PUBLIC_RELEASE=$RELEASE
echo "EXPO_PUBLIC_RELEASE set to $RELEASE"
