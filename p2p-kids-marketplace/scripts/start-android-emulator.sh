#!/usr/bin/env bash
set -euo pipefail

# Start an Android emulator automatically if none is connected
# Usage: ./scripts/start-android-emulator.sh [AVD_NAME]

SDK_ROOT=${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="$PATH:$SDK_ROOT/emulator:$SDK_ROOT/platform-tools:$SDK_ROOT/cmdline-tools/latest/bin"

echo "Android SDK root: $ANDROID_SDK_ROOT"

if command -v adb >/dev/null 2>&1; then
  echo "adb found: $(adb --version | head -n 1)"
else
  echo "adb not found in PATH. Please ensure Android SDK is installed and platform-tools are installed." >&2
  exit 1
fi

DEVICES=$(adb devices | sed -n '2,$p' | awk '{print $1}' | wc -l | tr -d ' ')
if [ "$DEVICES" -gt 0 ] && [ "$(adb devices | sed -n '2,$p' | wc -l | tr -d ' ')" -gt 0 ]; then
  if adb devices | sed -n '2,$p' | grep -q 'device'; then
    echo "Device found. No emulator start required."
    adb devices -l
    exit 0
  fi
fi

AVD_NAME=${1:-}
if [ -z "$AVD_NAME" ]; then
  # pick default AVD if available
  if command -v emulator >/dev/null 2>&1; then
    AVD_NAME=$(emulator -list-avds | head -n 1)
  fi
fi

if [ -z "$AVD_NAME" ]; then
  echo "No AVD found. Create one with avdmanager, or start Android Studio AVD Manager." >&2
  echo "Example: avdmanager create avd -n Pixel_6_API_33 -k \"system-images;android-33;google_apis;arm64-v8a\" --device \"pixel_6\"" >&2
  exit 1
fi

echo "Starting emulator: $AVD_NAME"
nohup emulator -avd "$AVD_NAME" -no-audio -no-window -gpu swiftshader_indirect >/tmp/emulator-${AVD_NAME}.log 2>&1 &
echo "Emulator process started. Waiting for boot..."

# Wait until device is listed
for i in {1..60}; do
  sleep 2
  adb wait-for-device
  if adb devices | sed -n '2,$p' | grep -q 'device'; then
    echo "Emulator ready"
    adb devices -l
    exit 0
  fi
  echo "Waiting for emulator to boot... ($i)"
done

echo "Emulator failed to boot in time. Check /tmp/emulator-${AVD_NAME}.log for details." >&2
exit 1
