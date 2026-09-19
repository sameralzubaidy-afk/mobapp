#!/bin/bash
# wait-for-metro.sh — block until a Metro/Expo dev server is answering on <port>.
#
# WHY THIS EXISTS
# The dev-client apps fetch their JS bundle the moment they launch, and they do
# NOT retry if that fetch fails: the app shows "Could not connect to development
# server" and then sits on the splash screen until a developer reloads it by hand
# (⌘R on iOS). So the app must be launched *after* Metro is listening — never
# before. dev-ios.sh and dev-android.sh start Metro first and call this helper
# before they install/launch the app.
#
# Usage: bash scripts/wait-for-metro.sh <port> [timeout_seconds]
# Exit:  0 = Metro is answering,  1 = timed out

set -uo pipefail

PORT="${1:?usage: wait-for-metro.sh <port> [timeout_seconds]}"
TIMEOUT="${2:-180}"
STATUS_URL="http://localhost:${PORT}/status"
DEADLINE=$((SECONDS + TIMEOUT))

printf '    Waiting for Metro on :%s ' "$PORT"
while ((SECONDS < DEADLINE)); do
  if curl -sf -m 2 "$STATUS_URL" >/dev/null 2>&1; then
    echo "— ready."
    exit 0
  fi
  printf '.'
  sleep 1
done

echo ""
echo "ERROR: Metro did not answer on :$PORT within ${TIMEOUT}s."
echo "       Check the Metro output above for a startup error."
exit 1
