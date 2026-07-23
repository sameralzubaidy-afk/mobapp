#!/bin/bash
# build-ios-simulator.sh
# Build and launch PassItUp on the iOS simulator.
# 
# Usage:
#   bash scripts/build-ios-simulator.sh          # Full clean build
#   bash scripts/build-ios-simulator.sh --fast    # Skip prebuild (incremental)
#   bash scripts/build-ios-simulator.sh --install # Install+launch existing build only
#
# Environment variables (optional):
#   IOS_SIMULATOR_NAME   e.g. "iPhone 17 Pro Max" (default)
#   SENTRY_DISABLE_AUTO_UPLOAD   default: true
#   SENTRY_ALLOW_FAILURE          default: true

set -euo pipefail

cd "$(dirname "$0")/.."

SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
SENTRY_ALLOW_FAILURE="${SENTRY_ALLOW_FAILURE:-true}"
SIMULATOR_NAME="${IOS_SIMULATOR_NAME:-iPhone 17 Pro Max}"
APP_BUNDLE_ID="com.sameralzubaidi.p2pmarketplace"
SCHEME="PassItUp"
WORKSPACE="ios/PassItUp.xcworkspace"
BUILD_DIR="ios/build"
APP_PATH="${BUILD_DIR}/Build/Products/Debug-iphonesimulator/PassItUp.app"

export SENTRY_DISABLE_AUTO_UPLOAD
export SENTRY_ALLOW_FAILURE

MODE="${1:-full}"

case "$MODE" in
  --install)
    echo "=== Installing & launching existing build ==="
    ;;

  --fast)
    echo "=== iOS Simulator Fast Build (skip prebuild) ==="
    SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_ALLOW_FAILURE=true xcodebuild \
      -workspace "$WORKSPACE" \
      -scheme "$SCHEME" \
      -configuration Debug \
      -sdk iphonesimulator \
      -destination "platform=iOS Simulator,name=$SIMULATOR_NAME" \
      -derivedDataPath "$BUILD_DIR" \
      CODE_SIGN_IDENTITY="" \
      CODE_SIGNING_REQUIRED=NO
    ;;

  full|--full|"")
    echo "=== iOS Simulator Clean Build ==="

    # Clean
    echo "--- Cleaning ---"
    rm -rf ios/Pods ios/build node_modules/.cache 2>/dev/null

    # Prebuild (plugin adds use_modular_headers! automatically)
    echo "--- Prebuild ---"
    npx expo prebuild --clean --platform ios 2>&1

    # Build for simulator
    echo "--- Build ---"
    SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_ALLOW_FAILURE=true xcodebuild \
      -workspace "$WORKSPACE" \
      -scheme "$SCHEME" \
      -configuration Debug \
      -sdk iphonesimulator \
      -destination "platform=iOS Simulator,name=$SIMULATOR_NAME" \
      -derivedDataPath "$BUILD_DIR" \
      CODE_SIGN_IDENTITY="" \
      CODE_SIGNING_REQUIRED=NO
    ;;

  *)
    echo "Usage: bash scripts/build-ios-simulator.sh [--fast|--install|--help]"
    exit 1
    ;;
esac

# Boot simulator if none is booted
BOOTED=$(xcrun simctl list devices booted 2>/dev/null | grep -c "Booted" || true)
if [ "$BOOTED" -eq 0 ]; then
  echo "=== No booted simulator found. Booting $SIMULATOR_NAME ==="
  # Find UDID of the named simulator
  UDID=$(xcrun simctl list devices available 2>/dev/null | grep "$SIMULATOR_NAME" | head -1 | awk -F'[()]' '{print $2}' | xargs)
  if [ -z "$UDID" ]; then
    echo "ERROR: Simulator '$SIMULATOR_NAME' not found. Available:" >&2
    xcrun simctl list devices available 2>/dev/null | grep -E "iPhone|iPad" | head -10 >&2
    exit 2
  fi
  xcrun simctl boot "$UDID"
  echo "=== Waiting for simulator to finish booting ==="
  sleep 15
  # Open Simulator.app for visibility
  open -a Simulator
  sleep 5
fi

# Install & Launch on booted simulator
echo "=== Installing on simulator ==="
xcrun simctl install booted "$APP_PATH"
echo "=== Launching ==="
xcrun simctl launch booted "$APP_BUNDLE_ID"

echo "=== Done! ==="
