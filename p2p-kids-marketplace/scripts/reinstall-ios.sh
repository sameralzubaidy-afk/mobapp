#!/bin/bash
# reinstall-ios.sh — Install & launch the existing Debug build in ~10 seconds.
# No rebuild. Use this to recover after Detox/Maestro wipes the simulator app.
#
# Usage:
#   bash scripts/reinstall-ios.sh              # install + launch only
#   bash scripts/reinstall-ios.sh --build      # fast xcodebuild first, then install

set -euo pipefail
cd "$(dirname "$0")/.."

APP_BUNDLE_ID="com.sameralzubaidi.p2pmarketplace"
APP_PATH="ios/build/Build/Products/Debug-iphonesimulator/PassItUp.app"
SIMULATOR_NAME="${IOS_SIMULATOR_NAME:-iPhone 17 Pro Max}"

MODE="${1:-}"

# ── Optional: fast incremental build ──────────────────────────────────────────
if [[ "$MODE" == "--build" ]]; then
  echo "=== Fast xcodebuild (incremental, ~2 min) ==="
  SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_ALLOW_FAILURE=true \
    xcodebuild \
      -workspace ios/PassItUp.xcworkspace \
      -scheme PassItUp \
      -configuration Debug \
      -sdk iphonesimulator \
      -destination "platform=iOS Simulator,name=$SIMULATOR_NAME" \
      -derivedDataPath ios/build \
      CODE_SIGN_IDENTITY="" \
      CODE_SIGNING_REQUIRED=NO \
    | grep -E "error:|warning:BUILD|PassItUp|Compiling|Linking" 2>/dev/null || true
fi

# ── Verify binary exists ───────────────────────────────────────────────────────
if [[ ! -d "$APP_PATH" ]]; then
  echo ""
  echo "ERROR: Debug build not found at: $APP_PATH"
  echo ""
  echo "Run a full first-time build with:"
  echo "  npm run ios"
  echo ""
  exit 1
fi

BUILD_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$APP_PATH" 2>/dev/null || echo "unknown")
echo "=== Installing PassItUp.app (built $BUILD_DATE) ==="

# ── Ensure a simulator is booted ─────────────────────────────────────────────
BOOTED=$(xcrun simctl list devices booted 2>/dev/null | grep -c "Booted" || true)
if [[ "$BOOTED" -eq 0 ]]; then
  echo "=== No booted simulator — booting $SIMULATOR_NAME ==="
  UDID=$(xcrun simctl list devices available 2>/dev/null \
    | grep "$SIMULATOR_NAME" | head -1 | awk -F'[()]' '{print $2}' | xargs)
  if [[ -z "$UDID" ]]; then
    echo "ERROR: Simulator '$SIMULATOR_NAME' not found."
    echo "Available simulators:"
    xcrun simctl list devices available 2>/dev/null | grep -E "iPhone|iPad" | head -10
    exit 1
  fi
  xcrun simctl boot "$UDID"
  echo "Waiting for simulator to boot..."
  sleep 10
  open -a Simulator
  sleep 3
else
  BOOTED_NAME=$(xcrun simctl list devices booted 2>/dev/null | grep "Booted" | head -1 | sed 's/ (.*//')  
  echo "Using booted simulator: $BOOTED_NAME"
fi

# ── Terminate any running instance first ──────────────────────────────────────
xcrun simctl terminate booted "$APP_BUNDLE_ID" 2>/dev/null || true

# ── Install ───────────────────────────────────────────────────────────────────
xcrun simctl install booted "$APP_PATH"
echo "Installed."

# ── Launch ────────────────────────────────────────────────────────────────────
xcrun simctl launch booted "$APP_BUNDLE_ID"
echo ""
echo "=== PassItUp is running on the simulator ==="
echo "    Start Metro with:  npm run start"
echo "    Or use:            npm run dev:ios  (reinstall + metro in one shot)"
echo ""
