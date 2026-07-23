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

# ── Install & launch the Debug build ─────────────────────────────────────────
bash scripts/reinstall-ios.sh "$MODE"

# ── Start Metro on iOS port ───────────────────────────────────────────────────
echo "=== Starting Metro on port $IOS_PORT (Ctrl+C to stop) ==="
npx expo start --port $IOS_PORT --clear
