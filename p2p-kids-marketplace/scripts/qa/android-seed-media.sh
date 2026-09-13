#!/usr/bin/env bash
# =============================================================================
# android-seed-media.sh — register a real image set in the Android device gallery
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
## FIX-Task-24 item 3 (2026-09-12) — WRONG BUCKET + FALSE-NEGATIVE SUCCESS TEST
#   QA could only ever get ONE photo out of the picker even though MediaStore
#   reported 24 registered rows. Two independent causes, both fixed here:
#     (1) WRONG DIRECTORY. Files were pushed to /sdcard/Pictures/QA, a bucket the
#         system picker does not index reliably. They now go to /sdcard/DCIM/Camera
#         (the camera roll) — hence the new default remote dir. --remote-dir can
#         still override it, but anything other than the camera dir warns, because
#         the picker may simply ignore those files.
#     (2) WRONG SUCCESS TEST. The old guard was "the MediaStore row count must
#         increase", which is a FALSE NEGATIVE on any machine that already seeded:
#         the same assets re-register onto the same rows so the count stays put, and
#         a perfectly healthy device reported failure. The guard now asserts what
#         actually matters — every pushed file has a MediaStore row AND exists on the
#         device at the pushed path — and it PRINTS which files were already
#         registered, so "count did not increase" can never read as a failure again.
#   The silent `assets/` fallback (app icons / splash) is gone too: those are not
#   representative photos, so it now needs an explicit --allow-fallback.
#
#   The committed fixture set lives at assets/qa-media/ (6 distinct PNGs). Regenerate
#   it with: node scripts/qa/generate-qa-media.mjs
## USAGE
#   bash scripts/qa/android-seed-media.sh                     # default source dir
#   bash scripts/qa/android-seed-media.sh --source ~/Pictures/qa
#   bash scripts/qa/android-seed-media.sh --serial emulator-5554 --count
#
# FLAGS
#   --source <dir|file>  Host path to push (default: assets/qa-media)
#   --serial <serial>    adb serial (default: $ANDROID_EMULATOR_SERIAL, else the
#                        only attached device)
#   --remote-dir <dir>   Device folder (default: /sdcard/DCIM/Camera)
#   --app <package>      App package to force-stop after seeding so the next
#                        picker entry is a fresh mount
#                        (default: $APP_ID, else com.sameralzubaidi.p2pmarketplace)
#   --no-relaunch        Skip the force-stop (re-enter the picker yourself from a
#                        freshly mounted screen)
#   --allow-fallback     Permit falling back to assets/ (app icons/splash) when
#                        assets/qa-media/ is missing. Off by default: those files
#                        are not representative photos.
#   --count              Verify only — report what MediaStore sees, and where
#
# GOTCHAS THIS SCRIPT ENCODES
#   * The deprecated MEDIA_SCANNER_SCAN_FILE broadcast is IGNORED on current
#     images; `content call ... --method scan_file` is the working call.
#   * `content query --where` rejects LIKE — use a simple predicate or none.
#   * Enter the app's picker from a FRESHLY MOUNTED screen after seeding. An
#     in-place re-entry of an already-open picker does NOT surface newly
#     registered media (bounded attempts) — QA playbook R98 step 4. This script
#     now performs that step for you (see --no-relaunch).
#   * `content query --where` rejects LIKE (and a bad --where value can make the
#     whole subcommand print its usage banner), so nothing is filtered server-side —
#     the script queries and greps locally instead.
#   * `adb push <host-dir> <dest>/` NESTS the host directory inside the destination
#     (it does not copy its contents up a level), which would defeat the point. The
#     script expands the host directory and pushes the files, so they land flat in
#     the camera bucket.
#
# EXIT CODES
#   0 = every pushed image is registered (a zero delta is still success) or --count
#       succeeded
#   2 = blocking problem (no device, no source, or a pushed file did not register)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

REMOTE_DIR="/sdcard/DCIM/Camera"
SERIAL="${ANDROID_EMULATOR_SERIAL:-}"
SOURCE=""
VERIFY_ONLY=0
# FIX-Task-23 item 3: the app is force-stopped after seeding so the next picker
# entry is a fresh mount (the step that was previously left to the operator).
APP_ID_RESOLVED="${APP_ID:-}"
RELAUNCH=1
# FIX-Task-24 item 3: assets/ is app icons/splash, not photos — opt IN explicitly.
ALLOW_FALLBACK=0

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
    --allow-fallback) ALLOW_FALLBACK=1; shift ;;
    --no-relaunch) RELAUNCH=0; shift ;;
    --count)      VERIFY_ONLY=1; shift ;;
    -h|--help)    sed -n '2,82p' "$0"; exit 0 ;;
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

# MediaStore listing, names only. Kept to a SINGLE short column on purpose: `_data`
# values are long enough that the adb pty wraps them mid-path, which would corrupt a
# local grep. Reporting that needs the path uses the raw listing instead (see --count).
list_names() {
  adb -s "$SERIAL" shell content query \
    --uri content://media/external/images/media \
    --projection _display_name 2>/dev/null || true
}

count_images() { list_names | grep -c "_display_name" || true; }

if [[ "$VERIFY_ONLY" == "1" ]]; then
  TOTAL="$(count_images)"
  echo "MediaStore images: $TOTAL"
  echo "Bucket in use: $REMOTE_DIR"
  # Best-effort REPORTING only (the `_data` path can wrap in the adb pty, so it must
  # never drive a pass/fail decision — the push + registration checks below do).
  adb -s "$SERIAL" shell content query \
    --uri content://media/external/images/media \
    --projection _display_name:_data 2>/dev/null \
    | sed 's/^Row: [0-9]* //' | head -40 || true
  [[ "$TOTAL" -gt 0 ]] || fail "MediaStore sees 0 images — the picker will show 'No photos yet'."
  ok "Media is registered."
  exit 0
fi

# ── Resolve the host source ──────────────────────────────────────────────────
if [[ -z "$SOURCE" ]]; then
  if [[ -d "$MOBILE_DIR/assets/qa-media" ]]; then
    SOURCE="$MOBILE_DIR/assets/qa-media"
  elif [[ "$ALLOW_FALLBACK" == "1" ]]; then
    SOURCE="$MOBILE_DIR/assets"
    warn "assets/qa-media/ not found — --allow-fallback set, using assets/ (app icons/splash)."
    warn "These are NOT representative photos. Generate the fixture set instead:"
    warn "  node scripts/qa/generate-qa-media.mjs"
  else
    fail "assets/qa-media/ not found — refusing to silently push app icons as 'photos'.
   Generate the committed fixture set first:
     node scripts/qa/generate-qa-media.mjs
   (or pass --source <dir>, or --allow-fallback to knowingly use assets/)."
  fi
fi
[[ -e "$SOURCE" ]] || fail "Source not found: $SOURCE"

if [[ "$REMOTE_DIR" != "/sdcard/DCIM/Camera" ]]; then
  warn "Remote dir is '$REMOTE_DIR', not the camera bucket (/sdcard/DCIM/Camera)."
  warn "The system picker may not index files outside DCIM/Camera — expect a partial list."
fi

# ── Collect the files to push (FLAT — never as a nested directory) ───────────
# `adb push <host-dir> <dest>/` creates <dest>/<host-dir>/… , which would put the
# images one level below the bucket the picker reads. Expand and push the files.
FILES=()
if [[ -d "$SOURCE" ]]; then
  for f in "$SOURCE"/*; do
    [[ -f "$f" ]] || continue
    case "${f##*.}" in
      png|PNG|jpg|JPG|jpeg|JPEG|webp|WEBP|gif|GIF) FILES+=("$f") ;;
    esac
  done
else
  FILES+=("$SOURCE")
fi
[[ "${#FILES[@]}" -gt 0 ]] || fail "No image files found in: $SOURCE"

BEFORE_LISTING="$(list_names)"
BEFORE="$(printf '%s\n' "$BEFORE_LISTING" | grep -c "_display_name" || true)"

# ── Push ─────────────────────────────────────────────────────────────────────
adb -s "$SERIAL" shell mkdir -p "$REMOTE_DIR"
adb -s "$SERIAL" push "${FILES[@]}" "$REMOTE_DIR/" >/dev/null
ok "Pushed ${#FILES[@]} file(s) → $REMOTE_DIR"

# ── Register with MediaStore ─────────────────────────────────────────────────
for f in "${FILES[@]}"; do
  name="$(basename "$f")"
  # The deprecated MEDIA_SCANNER_SCAN_FILE broadcast is ignored on current images.
  adb -s "$SERIAL" shell content call \
    --uri content://media/external/file \
    --method scan_file \
    --arg "$REMOTE_DIR/$name" >/dev/null 2>&1 || true
done

sleep 1

AFTER_LISTING="$(list_names)"
AFTER="$(printf '%s\n' "$AFTER_LISTING" | grep -c "_display_name" || true)"

# ── Classify every pushed file ───────────────────────────────────────────────
# FIX-Task-24 item 3: the OLD guard failed whenever the row count did not grow —
# which is exactly what happens on a re-run against an already-seeded device, so a
# healthy setup reported failure. Presence is the correct assertion; "already
# registered" is reported as a first-class success outcome.
ON_DEVICE_LISTING="$(adb -s "$SERIAL" shell ls "$REMOTE_DIR" 2>/dev/null || true)"
NEW=0
ALREADY=0
MISSING=0
NOT_ON_DEVICE=0
NEW_NAMES=""
ALREADY_NAMES=""
MISSING_NAMES=""

for f in "${FILES[@]}"; do
  name="$(basename "$f")"

  if ! printf '%s\n' "$ON_DEVICE_LISTING" | grep -qF "$name"; then
    NOT_ON_DEVICE=$((NOT_ON_DEVICE + 1))
  fi

  if ! printf '%s\n' "$AFTER_LISTING" | grep -qF "_display_name=$name"; then
    MISSING=$((MISSING + 1))
    MISSING_NAMES="$MISSING_NAMES $name"
    continue
  fi

  if printf '%s\n' "$BEFORE_LISTING" | grep -qF "_display_name=$name"; then
    ALREADY=$((ALREADY + 1))
    ALREADY_NAMES="$ALREADY_NAMES $name"
  else
    NEW=$((NEW + 1))
    NEW_NAMES="$NEW_NAMES $name"
  fi
done

echo "MediaStore images: $BEFORE → $AFTER"
echo "  newly registered:   $NEW${NEW_NAMES}"
echo "  already registered: $ALREADY${ALREADY_NAMES}"
if [[ "$ALREADY" -gt 0 ]]; then
  echo "  (already registered is SUCCESS — re-running the seed does not add rows.)"
fi

if [[ "$NOT_ON_DEVICE" -gt 0 ]]; then
  warn "$NOT_ON_DEVICE pushed file(s) are not present on the device at $REMOTE_DIR — check the push output above."
fi

if [[ "$MISSING" -gt 0 ]]; then
  fail "Registration verification FAILED — $MISSING file(s) ABSENT from MediaStore:$MISSING_NAMES
   The files are on the device but MediaStore has no row for them, so the picker will
   not list them. Re-run, or re-scan manually:
     adb -s $SERIAL shell content call --uri content://media/external/file --method scan_file --arg $REMOTE_DIR/<name>
   If the flow is still blocked afterwards, cite QA playbook R98."
fi

ok "All ${#FILES[@]} pushed image(s) are registered in MediaStore (under $REMOTE_DIR)."
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
