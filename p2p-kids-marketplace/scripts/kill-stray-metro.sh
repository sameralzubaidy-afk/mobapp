#!/usr/bin/env bash
#
# FIX-Task-17 item 9 (QA F9) — guarantee a SINGLE Metro instance before a session.
#
# Why this exists
# ---------------
# `expo start` silently falls forward to the next free port. So if a stray Metro
# is still holding :8081, the new server binds :8082 and the dev client is left
# with TWO candidate servers to choose from. On Android that produces the
# ~90 s "Bundling …%" cold connect followed by a blank first frame (observed
# 2026-09-11, QA dispatch Stage 2 — F9), which is pure harness cost: the app
# itself is fine on a warm launch.
#
# What it does
# ------------
# Kills any process LISTENING on the Metro ports (default 8081 8082 8083) so the
# next `expo start` is guaranteed to bind :8081 — the one server the dev client
# remembers. SIGTERM first, then SIGKILL for a wedged Metro that ignores it.
#
# Usage
# -----
#   npm run metro:kill        # kill only (use before any manual metro start)
#   npm run start:single      # kill, then start Metro on :8081
#   npm run ios:fresh         # kill, then build/run iOS on :8081
#   npm run android:fresh     # kill, then run Android on :8081
#
# Override the port list if your machine uses different ones:
#   METRO_PORTS="8081 8082" bash scripts/kill-stray-metro.sh
#
set -u

PORTS="${METRO_PORTS:-8081 8082 8083}"
killed_any=0

if ! command -v lsof >/dev/null 2>&1; then
  echo "Metro cleanup: 'lsof' not found — skipping (start with 'expo start' and check the printed port)." >&2
  exit 0
fi

for port in $PORTS; do
  pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "Metro cleanup: killing listener(s) on :${port} -> ${pids}"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    killed_any=1
  fi
done

if [ "$killed_any" -eq 1 ]; then
  # Give SIGTERM a moment, then hard-kill whatever is still holding a port
  # (a wedged Metro ignores SIGTERM and would silently push the next start
  # onto :8082 again).
  sleep 1
  for port in $PORTS; do
    pids="$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "Metro cleanup: force-killing stuck listener(s) on :${port} -> ${pids}"
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  done
  echo "Metro cleanup: done — :8081 is free for a single Metro instance."
else
  echo "Metro cleanup: no listener on ${PORTS} — nothing to kill."
fi
