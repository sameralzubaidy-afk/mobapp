#!/bin/bash
# dev-ios.sh — All-in-one iOS dev session (Metro port 8081).
# Safe to run alongside dev-android.sh — uses a dedicated port and never
# touches the Android Metro port (8082).
#
# Usage:
#   bash scripts/dev-ios.sh              # use existing Debug build
#   bash scripts/dev-ios.sh --build      # run fast xcodebuild first

set -euo pipefail
cd "$(dirname "$0")/.."

IOS_PORT=8081
MODE="${1:-}"

# ── Check if port is already in use ──────────────────────────────────────────
if lsof -i :$IOS_PORT -sTCP:LISTEN -t &>/dev/null; then
  echo "Port $IOS_PORT already in use — stopping existing Metro first."
  npx kill-port $IOS_PORT 2>/dev/null || true
  sleep 1
fi

# ── 1. Start Metro FIRST, in the background ──────────────────────────────────
# The dev client fetches its bundle the instant it launches and never retries
# on its own, so launching the app before Metro is listening guarantees a
# "Could not connect to development server" red box + an app stuck on splash.
# Order matters: Metro up  ->  then install + launch. See scripts/wait-for-metro.sh.
echo "=== Starting Metro on port $IOS_PORT (Ctrl+C to stop) ==="
# Own Metro cache — lets `npm run dev:android` (:8082) run at the same time
# without this session's `--clear` wiping the Android instance's cache.
# See metro.config.js.
EXPO_METRO_CACHE_TAG=ios npx expo start --port $IOS_PORT --clear &
METRO_PID=$!
trap 'kill "$METRO_PID" 2>/dev/null || true' EXIT INT TERM

# ── 2. Wait until Metro is actually serving ──────────────────────────────────
bash scripts/wait-for-metro.sh "$IOS_PORT"

# ── 3. Install & launch the Debug build (Metro is up, so it connects) ────────
bash scripts/reinstall-ios.sh "$MODE"

# ── 4. Point the dev client at this Metro explicitly ─────────────────────────
# A freshly installed dev client has no remembered server, so it would open its
# launcher menu instead of the app. The scheme is derived from app.json so it
# cannot drift from the value expo-dev-client registers (see Info.plist).
APP_SLUG="$(node -p "require('./app.json').expo.slug" 2>/dev/null || echo p2p-kids-marketplace)"
xcrun simctl openurl booted \
  "exp+${APP_SLUG}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${IOS_PORT}" \
  || echo "    (could not send the connect URL — pick the server in the dev launcher)"

# ── 5. Keep Metro in the foreground until Ctrl+C ─────────────────────────────
wait "$METRO_PID"
