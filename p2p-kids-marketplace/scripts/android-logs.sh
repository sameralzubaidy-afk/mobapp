#!/bin/bash
set -euo pipefail

if ! command -v adb >/dev/null 2>&1; then
  echo "[android-logs] ERROR: adb not found. Install Android Platform Tools (adb)."
  exit 1
fi

# Ensure we have at least one device/emulator.
if ! adb get-state >/dev/null 2>&1; then
  echo "[android-logs] ERROR: No Android device/emulator detected (adb get-state failed)."
  echo "[android-logs] Start your emulator then re-run."
  exit 1
fi

# Best-effort: make Metro reachable from the emulator/device.
adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
adb reverse tcp:8080 tcp:8080 >/dev/null 2>&1 || true

echo "[android-logs] Tailing JS logs (ReactNativeJS) ..."
echo "[android-logs] Tip: Ctrl+C to stop."

# JS console.* logs appear under ReactNativeJS.
# We keep a couple of related tags to help diagnose startup/network issues.
adb logcat -v brief \
  ReactNativeJS:V \
  ReactNative:V \
  ReactNativeJNI:V \
  Expo:V \
  OkHttp:W \
  AndroidRuntime:E \
  *:S \
| awk '
  # Input examples (brief):
  # D/ReactNativeJS(19804): "DEBUG  [Analytics] ..."
  # I/ReactNativeJS(19804): "[AUTH] ..."
  # W/ReactNativeJS(19804): "..."
  # E/AndroidRuntime(19804): ...
  function ltrim(s){ sub(/^[ \t\r\n]+/,"",s); return s }
  function rtrim(s){ sub(/[ \t\r\n]+$/,"",s); return s }
  function trim(s){ return rtrim(ltrim(s)) }

  {
    line=$0
    # Parse leading "X/TAG(PID): "
    if (match(line, /^([VDIWE])\/([^\(]+)\([^\)]*\):[ \t]*/, m)) {
      lvl=m[1]
      msg=substr(line, RLENGTH+1)
    } else {
      # Fallback: print as-is
      print line
      next
    }

    # Map Android levels to requested labels
    outlvl="LOG"
    if (lvl=="V") outlvl="LOG"
    else if (lvl=="D") outlvl="DEBUG"
    else if (lvl=="I") outlvl="LOG"
    else if (lvl=="W") outlvl="WARN"
    else if (lvl=="E") outlvl="ERROR"

    msg=trim(msg)

    # Strip surrounding single-quotes sometimes produced by console logging
    if (msg ~ /^\x27.*\x27(,|$)/) {
      sub(/^\x27/, "", msg)
      sub(/\x27(,|$)/, "\\1", msg)
    }

    # Make long multi-line object dumps easier to read:
    # If the message looks like a continuation (starts with 2+ spaces), indent it.
    if (msg ~ /^  /) {
      print "      " msg
      next
    }

    print sprintf("%s  %s", outlvl, msg)
  }
'
