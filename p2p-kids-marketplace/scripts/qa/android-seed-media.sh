#!/usr/bin/env bash
# =============================================================================
# android-seed-media.sh — register host images in the Android device's gallery
# =============================================================================
# WHY THIS EXISTS (FIX-Task-22 item 3, 2026-09-12)
#   The AVD's photo library is EMPTY by default, so every real-photo flow
#   (listing photo upload, AI analysis, bulk listing / O-1 C07) is blocked
#   before it starts. The recipe was documented as QA playbook R98 but had to be
#   re-derived by hand each round; this script makes it one repeatable command.
#
# FIX-Task-23 item 3 (2026-09-12) — THE MISSING STEP IS NOW AUTOMATED
#   Registering the files with MediaStore is necessary but NOT sufficient: the
#   picker only lists what it sees on a FRESH mount, so an in-place re-entry of an
#   already-open picker shows a stale (empty) list and the flow looks blocked. The
#   script therefore FORCE-STOPS the app after a successful registration, so the
#   next picker entry is a first mount. Pass --no-relaunch to skip that step.
#
# USAGE
#   bash scripts/qa/android-seed-media.sh                     # default source dir
#   bash scripts/qa/android-seed-media.sh --source ~/Pictures/qa
#   bash scripts/qa/android-seed-media.sh --serial emulator-5554 --count
#
# FLAGS
#   --source <dir|file>  Host path to push (default: assets/qa-media, else assets/)
#   --serial <serial>    adb serial (default: $ANDROID_EMULATOR_SERIAL, else the
#                        only attached device)
#   --remote-dir <dir>   Device folder (default: /sdcard/Pictures/QA)
#   --app <package>      App package to force-stop after seeding so the next
#                        picker entry is a fresh mount
#                        (default: $APP_ID, else com.sameralzubaidi.p2pmarketplace)
#   --no-relaunch        Skip the force-stop (re-enter the picker yourself from a
#                        freshly mounted screen)
#   --count              Verify only — report how many images MediaStore sees
#
# GOTCHAS THIS SCRIPT ENCODES
#   * The deprecated MEDIA_SCANNER_SCAN_FILE broadcast is IGNORED on current
#     images; `content call ... --method scan_file` is the working call.
#   * `content query --where` rejects LIKE — use a simple predicate or none.
#   * Enter the app's picker from a FRESHLY MOUNTED screen after seeding. An
#     in-place re-entry of an already-open picker does NOT surface newly
#     registered media (bounded attempts) — QA playbook R98 step 4. This script
#     now performs that step for you (see --no-relaunch).
#
# EXIT CODES
#   0 = media registered (or --count succeeded)
#   2 = blocking problem (no device, no source, or verification failed)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

REMOTE_DIR="/sdcard/Pictures/QA"
SERIAL="${ANDROID_EMULATOR_SERIAL:-}"
SOURCE=""
VERIFY_ONLY=0
# FIX-Task-23 item 3: the app is force-stopped after seeding so the next picker
# entry is a fresh mount (the step that was previously left to the operator).
APP_ID_RESOLVED="${APP_ID:-}"
RELAUNCH=1

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $*"; }
warn() { echo -e "${YELLOW}!${NC} $*"; }
fail() { echo -e "${RED}✗ $*${NC}" >&2; exit 2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --serial)     SERIAL="${2:-}"; shift 2 ;;
    --source)     SOURCE="${2:-}"; shift 2 ;;
    --remote-dir) REMOTE_DIR="${2:-}"; shift 2 ;;
    --app)        APP_ID_RESOLVED="${2:-}"; shift 2 ;;
    --no-relaunch) RELAUNCH=0; shift ;;
    --count)      VERIFY_ONLY=1; shift ;;
    -h|--help)    sed -n '2,44p' "$0"; exit 0 ;;
    *)            fail "Unknown option: $1 (try --help)" ;;
  esac
done

command -v adb >/dev/null 2>&1 || fail "adb not found on PATH — install Android platform-tools."

# ── Resolve the target device ────────────────────────────────────────────────
# NOTE: macOS ships bash 3.2 (no `mapfile`), so this deliberately avoids arrays.
if [[ -z "$SERIAL" ]]; then
  DEVICE_LIST="$(adb devices | awk 'NR>1 && $2=="device" {print $1}')"
  DEVICE_COUNT="$(printf '%s\n' "$DEVICE_LIST" | grep -c '[^[:space:]]' || true)"
  if [[ "$DEVICE_COUNT" -eq 0 ]]; then
    fail "No adb device in 'device' state. Start the emulator, then re-run (or pass --serial)."
  fi
  if [[ "$DEVICE_COUNT" -gt 1 ]]; then
    fail "Multiple devices attached ($(printf '%s ' $DEVICE_LIST)) — pass --serial <serial> to choose one."
  fi
  SERIAL="$(printf '%s\n' "$DEVICE_LIST" | head -1 | tr -d '[:space:]')"
fi
ok "Target device: $SERIAL"

count_images() {
  adb -s "$SERIAL" shell content query \
    --uri content://media/external/images/media \
    --projection _display_name 2>/dev/null | grep -c "_display_name" || true
}

if [[ "$VERIFY_ONLY" == "1" ]]; then
  TOTAL="$(count_images)"
  echo "MediaStore images: $TOTAL"
  adb -s "$SERIAL" shell content query \
    --uri content://media/external/images/media --projection _display_name 2>/dev/null \
    | sed 's/.*_display_name=\([^,]*\).*/  - \1/' | head -40
  [[ "$TOTAL" -gt 0 ]] || fail "MediaStore sees 0 images — the picker will show 'No photos yet'."
  ok "Media is registered."
  exit 0
fi

# ── Resolve the host source ──────────────────────────────────────────────────
if [[ -z "$SOURCE" ]]; then
  if [[ -d "$MOBILE_DIR/assets/qa-media" ]]; then
    SOURCE="$MOBILE_DIR/assets/qa-media"
  else
    SOURCE="$MOBILE_DIR/assets"
    warn "assets/qa-media/ not found — falling back to assets/ (app icons/splash)."
    warn "Add real photos to p2p-kids-marketplace/assets/qa-media/ for representative media."
  fi
fi
[[ -e "$SOURCE" ]] || fail "Source not found: $SOURCE"

BEFORE="$(count_images)"

# ── Push ─────────────────────────────────────────────────────────────────────
adb -s "$SERIAL" shell mkdir -p "$REMOTE_DIR"
if [[ -d "$SOURCE" ]]; then
  adb -s "$SERIAL" push "$SOURCE" "$REMOTE_DIR/" >/dev/null
else
  adb -s "$SERIAL" push "$SOURCE" "$REMOTE_DIR/" >/dev/null
fi
ok "Pushed '$SOURCE' → $REMOTE_DIR"

# ── Register with MediaStore + verify ────────────────────────────────────────
PUSHED_NAMES="$(adb -s "$SERIAL" shell ls "$REMOTE_DIR" | tr -d '\r' | grep -Ei '\.(png|jpe?g|webp|gif)$' || true)"
if [[ -z "$PUSHED_NAMES" ]]; then
  fail "No image files found in $REMOTE_DIR on the device after push."
fi

MISSING=0
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  DEVICE_PATH="$REMOTE_DIR/$name"
  # The deprecated MEDIA_SCANNER_SCAN_FILE broadcast is ignored on current images.
  adb -s "$SERIAL" shell content call \
    --uri content://media/external/file \
    --method scan_file \
    --arg "$DEVICE_PATH" >/dev/null 2>&1 || true
done <<< "$PUSHED_NAMES"

sleep 1
AFTER="$(count_images)"
LISTING="$(adb -s "$SERIAL" shell content query \
  --uri content://media/external/images/media --projection _display_name 2>/dev/null || true)"

while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  if ! grep -q "$name" <<< "$LISTING"; then
    warn "Not visible in MediaStore: $name"
    MISSING=$((MISSING + 1))
  fi
done <<< "$PUSHED_NAMES"

echo "MediaStore images: $BEFORE → $AFTER"

if [[ "$MISSING" -gt 0 || "$AFTER" -le "$BEFORE" ]]; then
  fail "Registration verification FAILED ($MISSING file(s) missing, count did not increase).
   Record the real-photo flow as BLOCKED (environment) and cite QA playbook R98."
fi

ok "All pushed images registered in MediaStore."
echo

# ── FIX-Task-23 item 3: fresh mount ───────────────────────────────────────────
# Registering the media is necessary but NOT sufficient — the system picker only
# reflects a first mount of the screen that opens it, so an in-place re-entry of
# an already-open picker still shows a stale/empty list (QA playbook R98 step 4).
if [[ "$RELAUNCH" == "1" ]]; then
  if [[ -n "$APP_ID_RESOLVED" ]]; then
    adb -s "$SERIAL" shell am force-stop "$APP_ID_RESOLVED" >/dev/null 2>&1 || true
    ok "Force-stopped $APP_ID_RESOLVED — the next picker entry will be a fresh mount."
    echo "NEXT: relaunch the app, then open the picker. It will list the seeded images."
  else
    warn "No --app/\$APP_ID given — could not force-stop the app."
    echo "NEXT: relaunch the app so the picker opens on a FRESH mount."
  fi
else
  echo "NEXT: --no-relaunch was passed — re-enter the picker from a FRESHLY MOUNTED"
  echo "      screen yourself (navigate away and back, or relaunch the app). Do NOT"
  echo "      re-enter an already-open picker — it will not refresh."
fi
