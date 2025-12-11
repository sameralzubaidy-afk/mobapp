#!/usr/bin/env bash
set -euo pipefail

# auto-release-mobile.sh
# Usage: ./scripts/auto-release-mobile.sh [profile] [release]
# Example:
# EXPO_TOKEN=... SENTRY_AUTH_TOKEN=... SENTRY_ORG=... SENTRY_PROJECT_MOBILE=... ./scripts/auto-release-mobile.sh development

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

PROFILE=${1:-development}
RELEASE=${2:-$(git rev-parse --short HEAD)}

if [ -z "${EXPO_TOKEN:-}" ]; then
  echo "EXPO_TOKEN is not set. Please export EXPO_TOKEN in your environment (or login using eas login)." >&2
  exit 1
fi
if [ -z "${SENTRY_AUTH_TOKEN:-}" ]; then
  echo "SENTRY_AUTH_TOKEN is not set. Please export SENTRY_AUTH_TOKEN in your environment." >&2
  exit 1
fi
if [ -z "${SENTRY_ORG:-}" ]; then
  echo "SENTRY_ORG is not set. Please export SENTRY_ORG in your environment." >&2
  exit 1
fi
if [ -z "${SENTRY_PROJECT_MOBILE:-}" ]; then
  echo "SENTRY_PROJECT_MOBILE is not set. Please export SENTRY_PROJECT_MOBILE in your environment." >&2
  exit 1
fi

export EXPO_PUBLIC_RELEASE="$RELEASE"
export RELEASE

echo "Release: $RELEASE, profile: $PROFILE"

# Trigger the EAS build (this will wait for completion and is interactive-free)
echo "Running EAS build (profile=$PROFILE) ..."
npx eas --version || true
npm install -g eas-cli || true
npx eas build --platform all --profile "$PROFILE" --non-interactive --build-env EXPO_PUBLIC_RELEASE="$RELEASE"

echo "EAS build finished. Creating Sentry release..."
npx sentry-cli releases -o "$SENTRY_ORG" -p "$SENTRY_PROJECT_MOBILE" new "$RELEASE"

echo "Uploading JS sourcemaps to Sentry (this uploads all maps in the repo - adjust path if needed) ..."
# Upload JS sourcemaps (JS/Expo) from repo root; adjust path for your build artifacts if necessary
npx sentry-cli releases -o "$SENTRY_ORG" -p "$SENTRY_PROJECT_MOBILE" files "$RELEASE" upload-sourcemaps ./ --rewrite --ignore node_modules

echo "Finalizing Sentry release..."
npx sentry-cli releases -o "$SENTRY_ORG" -p "$SENTRY_PROJECT_MOBILE" finalize "$RELEASE"

echo "Sentry release $RELEASE created and source maps uploaded."
echo "If you use native Sentry integration (sentry-expo), ensure dSYM/proguard uploads are also configured via EAS or CI."

echo "Build and release complete. Check Sentry project $SENTRY_PROJECT_MOBILE for release $RELEASE and new issues."
