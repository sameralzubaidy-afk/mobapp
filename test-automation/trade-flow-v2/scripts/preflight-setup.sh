#!/usr/bin/env bash
# =============================================================================
# preflight-setup.sh — Autonomous test environment bootstrap
# =============================================================================
# Responsibilities:
#   1. Verify Maestro CLI is installed
#   2. Boot an iOS Simulator if none is running  (Option B — app must be pre-installed)
#   2b. Hide the iOS Simulator software keyboard after a fresh boot (TFV2_HIDE_KEYBOARD, default on)
#   3. Verify the app binary is present on the simulator (fast-fail with a clear fix message)
#   4. Start the admin portal on :3001 if not already running
#   5. Run seed:staging to ensure test accounts exist (script is idempotent)
#   6. (opt-in, TFV2_SEED_ANDROID_MEDIA=1) Seed the Android media library so
#      real-photo flows (listing/bulk upload, AI analysis) can run at all
#
# Exit codes
#   0 = all checks passed — environment is ready
#   2 = blocking setup error — do NOT start the test suite
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ADMIN_DIR="$WORKSPACE_ROOT/p2p-kids-admin"
MOBILE_DIR="$WORKSPACE_ROOT/p2p-kids-marketplace"
APP_ID="${APP_ID:-com.sameralzubaidi.p2pmarketplace}"
ADMIN_PORT="${ADMIN_PORT:-3001}"

# ── Dedicated test device config ──────────────────────────────────────────────
# Set TFV2_IOS_DEVICE_NAME to a specific simulator model name to avoid
# conflicting with any simulator you are already using for manual testing.
# Example: TFV2_IOS_DEVICE_NAME="iPhone 16 Pro"
# Default: "iPhone 16 Pro"
TFV2_IOS_DEVICE_NAME="${TFV2_IOS_DEVICE_NAME:-iPhone 16 Pro}"

# Same for Android: TFV2_ANDROID_AVD_NAME (default: "pixel_7_e2e")
TFV2_ANDROID_AVD_NAME="${TFV2_ANDROID_AVD_NAME:-pixel_7_e2e}"

# Hide the iOS Simulator on-screen keyboard before Maestro runs (Simulator
# menu I/O > Keyboard > Toggle Software Keyboard, Cmd+K). Default ON: the
# software keyboard covers form fields, blocks scrolling, and corrupts taps
# during automation — the single biggest source of test friction. Only applied
# when preflight boots the simulator FRESH (a fresh boot shows the keyboard,
# so one toggle deterministically hides it). Set to 0 to keep it visible.
TFV2_HIDE_KEYBOARD="${TFV2_HIDE_KEYBOARD:-1}"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()   { echo -e "${CYAN}$(date -u +%H:%M:%SZ) [PREFLIGHT]${NC} $*"; }
ok()    { echo -e "${GREEN}$(date -u +%H:%M:%SZ) [✓ OK]${NC}      $*"; }
warn()  { echo -e "${YELLOW}$(date -u +%H:%M:%SZ) [WARN]${NC}      $*"; }
fail()  { echo -e "${RED}$(date -u +%H:%M:%SZ) [✗ ERROR]${NC}   $*" >&2; }

# ── 1. Maestro CLI ─────────────────────────────────────────────────────────────
log "Checking Maestro CLI..."
if ! command -v maestro &>/dev/null; then
  fail "maestro not found."
  fail "Install: curl -Ls https://get.maestro.mobile.dev | bash  (then restart your shell)"
  exit 2
fi
ok "Maestro: $(maestro --version 2>/dev/null | head -1)"

# ── 2. iOS Simulator — boot one if none is running ────────────────────────────
if command -v xcrun &>/dev/null; then
  log "Checking iOS Simulator (target: $TFV2_IOS_DEVICE_NAME)..."

  # Step 0 (FIX-Task-12 item 4): an explicitly-provided IOS_SIMULATOR_UDID WINS.
  # Before this fix the target was resolved purely from TFV2_IOS_DEVICE_NAME
  # (which run-suite.sh sources from .env with `set -o allexport`, unconditionally
  # overwriting any shell prefix) and then IOS_SIMULATOR_UDID was overwritten with
  # the resolved UDID — so the documented override silently did nothing and only
  # worked with --no-preflight. Now the override is honoured: the named device is
  # ignored, the override simulator is booted if needed, and the app check below
  # runs against IT.
  BOOTED_UDID=""
  EXPLICIT_IOS_UDID="${IOS_SIMULATOR_UDID:-}"
  if [[ -n "$EXPLICIT_IOS_UDID" ]]; then
    # NOTE (FIX-Task-12): capture the device list first, then grep — never
    # `xcrun ... | grep -q`. Under `set -o pipefail`, `grep -q` exits on the
    # first match and SIGPIPEs xcrun, so the PIPELINE returns 141 even though
    # grep matched, and every such check reports "not found" for something that
    # IS present (this is what made preflight always report the app as missing).
    ALL_IOS_DEVICES=$(xcrun simctl list devices available 2>/dev/null || true)
    if ! grep -q "$EXPLICIT_IOS_UDID" <<<"$ALL_IOS_DEVICES"; then
      fail "IOS_SIMULATOR_UDID='$EXPLICIT_IOS_UDID' is not a simulator on this machine."
      fail "Fix → either drop the override (preflight then uses TFV2_IOS_DEVICE_NAME='$TFV2_IOS_DEVICE_NAME'),"
      fail "       or pass a real UDID from: xcrun simctl list devices available"
      exit 2
    fi
    ok "Explicit IOS_SIMULATOR_UDID=$EXPLICIT_IOS_UDID overrides TFV2_IOS_DEVICE_NAME='$TFV2_IOS_DEVICE_NAME'"
    if grep -q "$EXPLICIT_IOS_UDID" <<<"$(xcrun simctl list devices booted 2>/dev/null || true)"; then
      BOOTED_UDID="$EXPLICIT_IOS_UDID"
      ok "Override simulator already booted: $BOOTED_UDID"
    else
      log "Booting override simulator $EXPLICIT_IOS_UDID..."
      xcrun simctl boot "$EXPLICIT_IOS_UDID"
      open -a Simulator &>/dev/null || true
      log "Waiting for simulator to finish booting (20s)..."
      sleep 20
      BOOTED_UDID="$EXPLICIT_IOS_UDID"
      SIM_FRESH_BOOTED=1
    fi
  fi

  # Step 1: Is our target device already booted? (name-based, only when there is
  # no explicit UDID override)
  if [[ -z "${BOOTED_UDID:-}" ]]; then
    BOOTED_UDID=$(xcrun simctl list devices booted 2>/dev/null \
      | grep -E "$TFV2_IOS_DEVICE_NAME" \
      | grep -Eo '\([0-9A-F-]{36}\)' | tr -d '()' | head -1 || true)
  fi

  if [[ -n "${BOOTED_UDID:-}" ]]; then
    ok "Target simulator already booted: $BOOTED_UDID"
  else
    log "Target '$TFV2_IOS_DEVICE_NAME' not booted — searching available devices..."
    AVAIL_UDID=$(xcrun simctl list devices available 2>/dev/null \
      | grep "$TFV2_IOS_DEVICE_NAME (" | head -1 \
      | grep -Eo '\([0-9A-F-]{36}\)' | tr -d '()' || true)

    if [[ -z "${AVAIL_UDID:-}" ]]; then
      # Fallback: pick the first available iPhone
      log "'$TFV2_IOS_DEVICE_NAME' not found. Falling back to first available iPhone..."
      AVAIL_UDID=$(xcrun simctl list devices available 2>/dev/null \
        | grep -E 'iPhone.*\(' | head -1 \
        | grep -Eo '\([0-9A-F-]{36}\)' | tr -d '()' || true)
      if [[ -z "${AVAIL_UDID:-}" ]]; then
        fail "No iOS simulator available at all."
        fail "Fix: Xcode → Window → Devices and Simulators → '+' → Add a simulator"
        exit 2
      fi
      warn "Using fallback simulator (not $TFV2_IOS_DEVICE_NAME). Create one named '$TFV2_IOS_DEVICE_NAME' for isolation."
    fi

    log "Booting simulator $AVAIL_UDID..."
    xcrun simctl boot "$AVAIL_UDID"
    open -a Simulator &>/dev/null || true
    log "Waiting for simulator to finish booting (20s)..."
    sleep 20
    BOOTED_UDID="$AVAIL_UDID"
    SIM_FRESH_BOOTED=1
  fi
  ok "iOS Simulator: $BOOTED_UDID"
  export IOS_SIMULATOR_UDID="$BOOTED_UDID"

  # ── 2b. Hide the iOS Simulator software keyboard (fresh boot only) ──────────
  # The on-screen keyboard covers form fields / blocks scrolling during Maestro
  # runs (the dominant source of test friction). Send Cmd+K ("Toggle Software
  # Keyboard") exactly once, right after a FRESH boot — a fresh simulator shows
  # the keyboard by default, so one toggle deterministically hides it. Skipped
  # when the sim was already booted (its keyboard state is unknown).
  if [[ "${TFV2_HIDE_KEYBOARD:-1}" == "1" && "${SIM_FRESH_BOOTED:-0}" == "1" ]]; then
    if osascript \
      -e 'tell application "Simulator" to activate' \
      -e 'delay 1' \
      -e 'tell application "System Events" to keystroke "k" using command down' \
      >/dev/null 2>&1; then
      ok "iOS Simulator software keyboard HIDDEN (Toggle Software Keyboard) for this run"
    else
      warn "Could not toggle the Simulator keyboard (osascript needs macOS Accessibility permission)."
      warn "To hide it manually: Simulator → I/O → Keyboard → Toggle Software Keyboard (or Cmd+K)."
    fi
  fi

  # ── 3. Verify app is installed ──────────────────────────────────────────────
  log "Verifying app installation ($APP_ID) on $BOOTED_UDID..."
  # FIX-Task-12 item 3:
  #  (a) check the TARGET device, not `booted` — with more than one simulator
  #      booted, `simctl listapps booted` inspects the wrong device;
  #  (b) capture the list, THEN grep. The old one-liner
  #      `xcrun simctl listapps booted | grep -q "$APP_ID"` can NEVER pass under
  #      `set -o pipefail`: grep -q exits on the first match and SIGPIPEs xcrun,
  #      so the pipeline status is 141 (not 0) and the check reports
  #      "app is NOT installed" for an app that IS installed. Reproduced
  #      2026-09-10 on iPhone 16 Pro E2E with the app installed.
  INSTALLED_APPS=$(xcrun simctl listapps "$BOOTED_UDID" 2>/dev/null || true)

  if ! grep -q "\"$APP_ID\"" <<<"$INSTALLED_APPS"; then
    fail "App '$APP_ID' is NOT installed on the target simulator ($BOOTED_UDID)."
    fail ""
    fail "This is a SETUP error, not a test failure. Automation cannot install the app."
    fail "Fix → build and install the app (fast path, installs onto the booted sim):"
    fail "  cd p2p-kids-marketplace && yarn ios:sim-build --install"
    fail "       (or, if ios/build/.../PassItUp.app already exists:"
    fail "        xcrun simctl install $BOOTED_UDID ios/build/Build/Products/Debug-iphonesimulator/PassItUp.app)"
    fail ""
    fail "After install, re-run:"
    fail "  bash test-automation/trade-flow-v2/scripts/run-suite.sh"
    exit 2
  fi
  ok "App $APP_ID is installed on the simulator"
else
  warn "xcrun not available — skipping iOS simulator checks (not macOS or Xcode CLI not installed)."
fi

# ── 4. Admin portal — start if not already running ────────────────────────────
log "Checking admin portal on :$ADMIN_PORT..."
PORTAL_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 \
  "http://localhost:$ADMIN_PORT" 2>/dev/null || echo "000")

if [[ "$PORTAL_CODE" =~ ^[23] ]]; then
  ok "Admin portal already running on :$ADMIN_PORT (HTTP $PORTAL_CODE)"
  # Clear any stale PID from a previous run so post-run.sh won't kill it
  rm -f /tmp/admin-portal-tfv2.pid
else
  log "Admin portal not running — starting it in background..."
  if [[ ! -d "$ADMIN_DIR/node_modules" ]]; then
    log "Installing admin portal npm dependencies (first run — this may take a minute)..."
    (cd "$ADMIN_DIR" && npm install --silent)
  fi

  # Kill any stale process holding the port (e.g., crashed prior run)
  lsof -ti :"$ADMIN_PORT" | xargs kill -9 2>/dev/null || true
  sleep 1

  (cd "$ADMIN_DIR" && npm run dev >/tmp/admin-portal.log 2>&1) &
  ADMIN_PID=$!
  echo "$ADMIN_PID" > /tmp/admin-portal-tfv2.pid

  log "Waiting for admin portal to respond (up to 45s)..."
  READY=false
  for i in $(seq 1 45); do
    sleep 1
    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 \
      "http://localhost:$ADMIN_PORT" 2>/dev/null || echo "000")
    if [[ "$CODE" =~ ^[23] ]]; then READY=true; break; fi
    # Fail fast if process died
    if ! kill -0 "$ADMIN_PID" 2>/dev/null; then
      fail "Admin portal process (PID $ADMIN_PID) died during startup."
      fail "Last output:"
      tail -25 /tmp/admin-portal.log >&2
      exit 2
    fi
  done

  if [[ "$READY" != "true" ]]; then
    fail "Admin portal did not respond within 45s."
    fail "Check /tmp/admin-portal.log for errors."
    exit 2
  fi
  ok "Admin portal started on :$ADMIN_PORT (PID $ADMIN_PID)"
fi

# ── 5. Seed data — ensure test accounts and fixtures exist ────────────────────
log "Ensuring test seed data exists (idempotent)..."
HAS_SEED=$(cd "$MOBILE_DIR" && \
  node -e "const p=require('./package.json'); process.exit(p.scripts?.['seed:staging'] ? 0 : 1)" \
  2>/dev/null && echo "yes" || echo "no")

if [[ "$HAS_SEED" == "yes" ]]; then
  (cd "$MOBILE_DIR" && npm run seed:staging) || {
    fail "seed:staging failed."
    fail "Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in p2p-kids-marketplace/.env"
    exit 2
  }
  ok "Seed data verified and applied."
else
  warn "No seed:staging script found — assuming accounts are pre-seeded."
fi

# ── 6. Android media — opt-in (the AVD gallery is empty by default) ──────────
# A real-photo flow (listing/bulk upload, AI analysis) cannot start against an
# empty gallery: the picker shows "No photos yet". Seeding is device-side state,
# so it stays opt-in: TFV2_SEED_ANDROID_MEDIA=1 bash run-suite.sh ...
if [[ "${TFV2_SEED_ANDROID_MEDIA:-0}" == "1" ]]; then
  if command -v adb >/dev/null 2>&1 && adb devices | awk 'NR>1 && $2=="device"' | grep -q .; then
    log "Seeding Android media library (TFV2_SEED_ANDROID_MEDIA=1)..."
    (cd "$MOBILE_DIR" && bash scripts/qa/android-seed-media.sh) || \
      warn "Android media seeding failed — real-photo cases will be BLOCKED (QA playbook R98)."
  else
    warn "TFV2_SEED_ANDROID_MEDIA=1 but no Android device attached — skipping."
  fi
fi

echo ""
ok "========================================="
ok " Preflight complete — environment ready  "
ok "========================================="
