#!/usr/bin/env bash
# Helper script to build an EAS dev client, create a Sentry release, and upload sourcemaps.
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "EXPO_TOKEN is not set. Please export EXPO_TOKEN in your environment." >&2
  exit 1
fi
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "SENTRY_AUTH_TOKEN is not set. Please export SENTRY_AUTH_TOKEN in your environment." >&2
  exit 1
fi

RELEASE=${RELEASE:-$(git rev-parse --short HEAD)}
export EXPO_PUBLIC_RELEASE="$RELEASE"
export RELEASE

echo "Release set to: $RELEASE"

echo "Starting EAS build (development dev client)..."
# Run EAS build to produce dev client
npx eas build --platform all --profile development --non-interactive --build-env EXPO_PUBLIC_RELEASE=$RELEASE

echo "EAS build triggered. When available, upload sourcemaps to Sentry:"
echo "npx sentry-cli releases -o <org_slug> -p <project_slug> new $RELEASE"
echo "npx sentry-cli releases -o <org_slug> -p <project_slug> files $RELEASE upload-sourcemaps ./ --rewrite"
echo "npx sentry-cli releases -o <org_slug> -p <project_slug> finalize $RELEASE"

echo "Note: adjust the path for sourcemaps upload to match your EAS artifact build output if needed."

echo "Done."
