#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

# Start logcat in the background so JS logs show in this terminal.
bash "$SCRIPT_DIR/android-logs.sh" &
LOGCAT_PID=$!

cleanup() {
  if kill -0 "$LOGCAT_PID" >/dev/null 2>&1; then
    kill "$LOGCAT_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Start Metro and open Android.
# --localhost avoids LAN IP routing issues with some emulators.
exec npx expo start --clear --localhost --android
