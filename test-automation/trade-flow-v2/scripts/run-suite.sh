#!/usr/bin/env bash
# =============================================================================
# run-suite.sh — Master wrapper for the fully autonomous TradeFlowV2 test run
# =============================================================================
#
# This is the SINGLE ENTRY POINT for the AI agent and QA team.
# It runs the full lifecycle end-to-end:
#
#   [1] Preflight    Boot iOS sim, start admin portal, verify/seed data
#   [2] Orchestrate  Run Maestro (iOS/Android) + Playwright (Admin portal)
#   [3] Post-run     File GitHub Issues, archive results, git commit
#
# Usage:
#   bash test-automation/trade-flow-v2/scripts/run-suite.sh [options]
#
# Options (passed through to the orchestrator):
#   --group A,B,C        Run specific groups only
#   --case TC-A01,TC-N01 Run specific test cases only
#   --platform ios       Run iOS Maestro only  (ios | android | both)
#   --runner maestro     Run one engine only   (maestro | playwright)
#   --bail               Stop on first failure
#   --dry-run            Print commands without executing
#   --no-preflight       Skip preflight checks (use only if environment is known-good)
#
# Examples:
#   bash test-automation/trade-flow-v2/scripts/run-suite.sh
#   bash test-automation/trade-flow-v2/scripts/run-suite.sh --group N,P --runner playwright
#   bash test-automation/trade-flow-v2/scripts/run-suite.sh --platform ios --bail
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
ORCHESTRATOR="$SCRIPT_DIR/../run-tradeflow-suite.mjs"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
log()  { echo -e "${CYAN}$(date -u +%H:%M:%SZ) [SUITE]${NC} $*"; }
ok()   { echo -e "${GREEN}$(date -u +%H:%M:%SZ) [✓ OK]${NC}  $*"; }
warn() { echo -e "${YELLOW}$(date -u +%H:%M:%SZ) [WARN]${NC}  $*"; }
err()  { echo -e "${RED}$(date -u +%H:%M:%SZ) [ERROR]${NC} $*" >&2; }

# Load .env from the trade-flow-v2 directory (no dependency on dotenv)
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  log "Loading environment from $ENV_FILE"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
else
  warn ".env not found at $ENV_FILE — using existing environment variables."
  warn "Copy .env.example to .env and fill in credentials to ensure full coverage."
fi

# ── Timestamp for this run ────────────────────────────────────────────────────
RUN_TS=$(date -u +%Y-%m-%dT%H-%M-%S)
OUT_DIR="$WORKSPACE_ROOT/e2e-test-results/$RUN_TS"

echo ""
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  TradeFlowV2 Autonomous Test Run                     ${NC}"
echo -e "${BOLD}${CYAN}  Module: MODULE-15.1.2                               ${NC}"
echo -e "${BOLD}${CYAN}  Run ID: $RUN_TS     ${NC}"
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""

# ── Parse --no-preflight flag before forwarding args ─────────────────────────
SKIP_PREFLIGHT=false
PASSTHROUGH_ARGS=()
for arg in "$@"; do
  if [[ "$arg" == "--no-preflight" ]]; then
    SKIP_PREFLIGHT=true
  else
    PASSTHROUGH_ARGS+=("$arg")
  fi
done

# ── [1] Preflight ─────────────────────────────────────────────────────────────
if [[ "$SKIP_PREFLIGHT" == "true" ]]; then
  warn "Skipping preflight checks (--no-preflight)."
else
  log "Phase 1 of 3 — Preflight setup..."
  bash "$SCRIPT_DIR/preflight-setup.sh" || {
    err "Preflight failed (exit $?). Fix the issues above then re-run."
    exit 2
  }
fi

# ── [2] Run the orchestrator ──────────────────────────────────────────────────
log "Phase 2 of 3 — Running test suite..."
log "Results will be written to: $OUT_DIR"
echo ""

ORCHESTRATOR_EXIT=0
node "$ORCHESTRATOR" --out "$OUT_DIR" ${PASSTHROUGH_ARGS[@]+"${PASSTHROUGH_ARGS[@]}"} || ORCHESTRATOR_EXIT=$?

echo ""

# ── [3] Post-run ──────────────────────────────────────────────────────────────
log "Phase 3 of 3 — Post-run: archiving, filing issues, committing..."
bash "$SCRIPT_DIR/post-run.sh" "$OUT_DIR" || {
  warn "Post-run encountered errors (non-blocking). Test results are still saved at $OUT_DIR"
}

# ── Final summary ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════════${NC}"
if [[ $ORCHESTRATOR_EXIT -eq 0 ]]; then
  echo -e "${BOLD}${GREEN}  ALL TESTS PASSED ✓${NC}"
elif [[ $ORCHESTRATOR_EXIT -eq 1 ]]; then
  echo -e "${BOLD}${RED}  SOME TESTS FAILED ✗${NC}"
else
  echo -e "${BOLD}${RED}  RUN ABORTED (exit $ORCHESTRATOR_EXIT)${NC}"
fi
echo -e "${BOLD}  Report:    e2e-test-results/$RUN_TS/report.md${NC}"
echo -e "${BOLD}  Results:   e2e-test-results/$RUN_TS/results.json${NC}"
echo -e "${BOLD}  Issues:    e2e-test-results/$RUN_TS/issues-filed.md${NC}"
echo -e "${BOLD}═══════════════════════════════════════════${NC}"

exit $ORCHESTRATOR_EXIT
