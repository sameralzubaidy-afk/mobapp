#!/bin/bash
set -euo pipefail

# Make this script runnable from any working directory.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ANDROID_DIR="$PROJECT_DIR/android"

if [ ! -d "$ANDROID_DIR" ]; then
	echo "[clean-android] ERROR: Android folder not found at: $ANDROID_DIR"
	echo "[clean-android] If you haven't prebuilt yet, run: npm run android"
	exit 1
fi

cd "$ANDROID_DIR"

if [ ! -f "./gradlew" ]; then
	echo "[clean-android] ERROR: ./gradlew not found in: $ANDROID_DIR"
	exit 1
fi

./gradlew clean

echo "[clean-android] Android build cleaned. Next: npm run android"
