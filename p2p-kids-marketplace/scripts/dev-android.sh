#!/bin/bash
# dev-android.sh — All-in-one Android dev session (Metro port 8082).
# Safe to run alongside dev-ios.sh — uses port 8082 so the two Metro
# instances never collide. adb reverse maps 8082 into the emulator so the
# dev client can reach it as localhost:8082.
#
# Auto-boots the default AVD when no emulator is running.
#
# Usage:
#   bash scripts/dev-android.sh                # auto-boot + install
#   bash scripts/dev-android.sh --build        # build APK first
#   bash scripts/dev-android.sh --no-boot      # skip auto-boot, fail if no emu

set -euo pipefail
cd "$(dirname "$0")/.."

APP_PACKAGE="com.sameralzubaidi.p2pmarketplace"
# expo-dev-client registers `exp+<slug>` on Android (see
# android/app/src/main/AndroidManifest.xml), NOT `exp+<app.json scheme>`:
#   <data android:scheme="exp+p2p-kids-marketplace"/>
# Read the slug from app.json so this cannot drift again.
APP_SLUG="$(node -p "require('./app.json').expo.slug" 2>/dev/null || echo p2p-kids-marketplace)"
DEV_CLIENT_SCHEME="exp+${APP_SLUG}"
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
ANDROID_PORT=8082
DEFAULT_AVD="Medium_Phone_API_36.1"   # from: emulator -list-avds

# Parse flags (order-independent)
MODE=""
NO_BOOT=false
for arg in "$@"; do
  case "$arg" in
    --build)   MODE="--build" ;;
    --no-boot) NO_BOOT=true ;;
  esac
done

# ── Ensure adb + emulator are in PATH ─────────────────────────────────────────
ANDROID_SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_SDK/platform-tools:$ANDROID_SDK/emulator:$PATH"

if ! command -v adb &>/dev/null; then
  echo ""
  echo "ERROR: adb not found."
  echo "  SDK expected at: $ANDROID_SDK/platform-tools/adb"
  echo "  Set ANDROID_HOME if your SDK is elsewhere."
  echo ""
  exit 1
fi

# ── Check if port is already in use (Android Metro only) ──────────────────────
if lsof -i :$ANDROID_PORT -sTCP:LISTEN -t &>/dev/null; then
  echo "Port $ANDROID_PORT already in use — stopping existing Metro first."
  npx kill-port $ANDROID_PORT 2>/dev/null || true
  sleep 1
fi

# ── Start Metro FIRST, in the background ─────────────────────────────────────
# The dev client fetches its bundle the instant it launches and never retries on
# its own, so the app must only be launched once Metro is listening — otherwise
# the first fetch fails and the app hangs on splash. Metro also has to be up
# before the emulator boot / APK install below, so the deep link near the end of
# this script always lands on a live server. See scripts/wait-for-metro.sh.
echo "=== Starting Metro on port $ANDROID_PORT (Ctrl+C to stop) ==="
echo "    iOS Metro stays on 8081 — both can run simultaneously."
# Own Metro cache — lets `npm run dev:ios` (:8081) run at the same time without
# this session's `--clear` wiping the iOS instance's cache. See metro.config.js.
EXPO_METRO_CACHE_TAG=android npx expo start --port $ANDROID_PORT --clear &
METRO_PID=$!
trap 'kill "$METRO_PID" 2>/dev/null || true' EXIT INT TERM

# ── Wait until Metro is actually serving ─────────────────────────────────────
bash scripts/wait-for-metro.sh "$ANDROID_PORT"

# ── Optional: build the APK ───────────────────────────────────────────────────
if [[ "$MODE" == "--build" ]]; then
  echo "=== Building Android Debug APK ==="
  npx expo prebuild --platform android --no-install 2>&1 | tail -5
  cd android && ./gradlew assembleDebug && cd ..
fi

# ── Verify APK exists ─────────────────────────────────────────────────────────
if [[ ! -f "$APK_PATH" ]]; then
  echo ""
  echo "ERROR: Debug APK not found at: $APK_PATH"
  echo ""
  echo "Run a first-time build with:"
  echo "  npm run dev:android:build"
  echo ""
  exit 1
fi

# ── Boot emulator if none is running ─────────────────────────────────────────
# Auto-boot unless --no-boot was passed.
DEVICES=$(adb devices 2>/dev/null | grep -cE "device$" || true)

if [[ "${DEVICES:-0}" -eq 0 ]]; then
  if [[ "$NO_BOOT" == true ]]; then
    echo ""
    echo "ERROR: No Android emulator or device is running (--no-boot was set)."
    echo ""
    echo "Run without --no-boot to auto-boot, or start manually:"
    echo "  emulator -avd $DEFAULT_AVD"
    echo ""
    exit 1
  fi

  if ! command -v emulator &>/dev/null; then
    echo ""
    echo "ERROR: 'emulator' binary not found and no emulator is running."
    echo "  Expected at: $ANDROID_SDK/emulator/emulator"
    echo "  Set ANDROID_HOME if your SDK is elsewhere."
    echo ""
    exit 1
  fi

  echo "=== No emulator detected — booting $DEFAULT_AVD ==="
  # The AVD ships with hw.cpu.ncore = 1 and hw.ramSize = 2048, which is not
  # enough to load the JS bundle: System UI gets starved and ANRs ("System UI
  # isn't responding"), stealing focus from the app. Override both so every boot
  # in this session has headroom.
  nohup emulator -avd "$DEFAULT_AVD" -no-snapshot-load -wipe-data -partition-size 4096 \
    -memory 4096 -cores 4 > /tmp/android-emulator.log 2>&1 &
  EMU_PID=$!
  echo "    Emulator PID: $EMU_PID  (log: /tmp/android-emulator.log)"

  # Wait for device to appear in adb
  echo "    Waiting for device to connect..."
  adb wait-for-device

  # Wait for boot to finish
  echo "    Waiting for boot to complete..."
  until adb shell getprop sys.boot_completed 2>/dev/null | grep -q "^1$"; do
    sleep 2
  done

  # Additional settle time — the launcher is ready but the app may need a moment
  sleep 5
  echo "=== Emulator is ready ==="
fi

# ── Port forwarding: emulator localhost:8082 → host port 8082 ────────────────
echo "=== Setting up adb reverse for port $ANDROID_PORT ==="
adb reverse tcp:$ANDROID_PORT tcp:$ANDROID_PORT

# ── Install APK with retry on storage full ────────────────────────────────────
echo "=== Installing APK ==="
MAX_INSTALL_ATTEMPTS=2
INSTALL_ATTEMPT=0
INSTALL_OK=false

while [[ "$INSTALL_ATTEMPT" -lt "$MAX_INSTALL_ATTEMPTS" ]]; do
  INSTALL_ATTEMPT=$((INSTALL_ATTEMPT + 1))

  INSTALL_OUTPUT=$(adb install -r "$APK_PATH" 2>&1) && INSTALL_OK=true

  if [[ "$INSTALL_OK" == true ]]; then
    break
  fi

  if echo "$INSTALL_OUTPUT" | grep -qi "INSUFFICIENT_STORAGE"; then
    echo ""
    echo "!! Storage full on emulator — wiping data and retrying..."
    echo ""
    adb emu kill 2>/dev/null || true
    sleep 3

    echo "=== Booting $DEFAULT_AVD with -wipe-data ==="
    nohup emulator -avd "$DEFAULT_AVD" -no-snapshot-load -wipe-data -partition-size 4096 \
      -memory 4096 -cores 4 > /tmp/android-emulator.log 2>&1 &
    echo "    Waiting for device to connect..."
    adb wait-for-device
    echo "    Waiting for boot to complete..."
    until adb shell getprop sys.boot_completed 2>/dev/null | grep -q "^1$"; do
      sleep 2
    done
    sleep 5
    echo "=== Emulator re-booted with clean storage ==="

    adb reverse tcp:$ANDROID_PORT tcp:$ANDROID_PORT
  else
    echo ""
    echo "ERROR: Install failed:"
    echo "$INSTALL_OUTPUT"
    echo ""
    exit 1
  fi
done

if [[ "$INSTALL_OK" != true ]]; then
  echo ""
  echo "ERROR: Failed to install APK after $MAX_INSTALL_ATTEMPTS attempts."
  echo ""
  exit 1
fi

echo "=== Launching app ==="
adb shell am start -n "$APP_PACKAGE/.MainActivity"

# ── Schedule auto-connect deep link 6 s after Metro is ready ──────────────────
DEEPLINK_URL="${DEV_CLIENT_SCHEME}://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${ANDROID_PORT}"
(
  connect() {
    OUT=$(adb shell am start \
      -a android.intent.action.VIEW \
      -d "$DEEPLINK_URL" \
      --activity-single-top 2>&1 || true)
    case "$OUT" in
      *"unable to resolve"*|*"Error:"*) return 1 ;;
      *) return 0 ;;
    esac
  }
  sleep 6
  # One retry: right after a fresh install the dev launcher can still be starting
  # when the first attempt lands, and the intent is then dropped.
  if ! connect; then
    sleep 6
    if ! connect; then
      echo ""
      echo "!! Android auto-connect to Metro :$ANDROID_PORT failed."
      echo "   Tap the 'http://localhost:$ANDROID_PORT' row in the dev launcher."
      echo ""
    fi
  fi
) &
AUTO_CONNECT_PID=$!
trap "kill $AUTO_CONNECT_PID 2>/dev/null || true; kill $METRO_PID 2>/dev/null || true" EXIT

echo ""
echo "=== App launched on Android device ==="
echo ""

# ── Keep Metro in the foreground until Ctrl+C ─────────────────────────────────
wait "$METRO_PID"


