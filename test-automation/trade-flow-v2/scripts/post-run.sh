#!/usr/bin/env bash
# =============================================================================
# post-run.sh — Archive results, file GitHub Issues, git commit
# =============================================================================
# Usage: bash test-automation/trade-flow-v2/scripts/post-run.sh <out-dir>
#
# What it does:
#   1. Stops the admin portal if THIS run started it (leaves it alone otherwise)
#   2. Files GitHub Issues for failed units (deduplicated — via file-issues.mjs)
#   3. Prunes e2e-test-results/ subfolders older than 30 days
#   4. git add + git commit  (no push — QA reviews before pushing)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}$(date -u +%H:%M:%SZ) [POST-RUN]${NC} $*"; }
ok()   { echo -e "${GREEN}$(date -u +%H:%M:%SZ) [✓ OK]${NC}     $*"; }
warn() { echo -e "${YELLOW}$(date -u +%H:%M:%SZ) [WARN]${NC}     $*"; }
err()  { echo -e "${RED}$(date -u +%H:%M:%SZ) [ERROR]${NC}    $*" >&2; }

OUT_DIR="${1:-}"
if [[ -z "$OUT_DIR" ]]; then
  err "Usage: bash post-run.sh <out-dir>"
  exit 1
fi
if [[ ! -f "$OUT_DIR/results.json" ]]; then
  err "results.json not found in $OUT_DIR"
  exit 1
fi

# ── 1. Stop admin portal only if this run started it ─────────────────────────
if [[ -f /tmp/admin-portal-tfv2.pid ]]; then
  ADMIN_PID=$(cat /tmp/admin-portal-tfv2.pid)
  if kill -0 "$ADMIN_PID" 2>/dev/null; then
    log "Stopping admin portal that was started by this run (PID $ADMIN_PID)..."
    kill "$ADMIN_PID" 2>/dev/null || true
    sleep 1
    ok "Admin portal stopped."
  fi
  rm -f /tmp/admin-portal-tfv2.pid
else
  log "Admin portal was pre-existing — leaving it running."
fi

# ── 2. File GitHub Issues for failures ───────────────────────────────────────
log "Filing GitHub Issues for failures..."
node "$SCRIPT_DIR/file-issues.mjs" "$OUT_DIR" || {
  warn "GitHub Issue filing encountered errors (non-blocking — results are still saved)."
  warn "To file manually: node test-automation/trade-flow-v2/scripts/file-issues.mjs $OUT_DIR"
}

# ── 3. Prune result folders older than 30 days ───────────────────────────────
E2E_DIR="$WORKSPACE_ROOT/e2e-test-results"
log "Pruning result folders older than 30 days from $E2E_DIR..."
find "$E2E_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +30 2>/dev/null | while read -r dir; do
  log "  Removing: $(basename "$dir")"
  rm -rf "$dir"
done

# ── 4. Git commit ─────────────────────────────────────────────────────────────
log "Preparing git commit..."
cd "$WORKSPACE_ROOT"

# Stage the new results folder only
git add "$E2E_DIR" 2>/dev/null || { warn "git add failed — not a git repo or E2E dir not found."; }

# Only commit if there is something staged
if git diff --cached --quiet 2>/dev/null; then
  warn "Nothing new to commit in e2e-test-results/ — possibly a dry-run or unchanged results."
else
  SUMMARY=$(node -e "
    const r = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'));
    const t = r.totals;
    process.stdout.write('pass:' + t.casesPassed + ' fail:' + t.casesFailed + ' skip:' + t.casesSkipped);
  " "$OUT_DIR/results.json" 2>/dev/null || echo "see report")

  RUN_ID=$(basename "$OUT_DIR")
  git commit -m "e2e: TradeFlowV2 run $RUN_ID — $SUMMARY

Module: MODULE-15.1.2 TradeFlowV2
Report: e2e-test-results/$RUN_ID/report.md
Issues: e2e-test-results/$RUN_ID/issues-filed.md
[skip ci]"

  ok "Committed: $(git log -1 --oneline)"
  echo ""
  log "====================================================="
  log " Review the commit, then push when ready:           "
  log "   git push                                         "
  log "====================================================="
fi

echo ""
ok "======================================="
ok " Post-run complete                     "
ok " Results: $OUT_DIR                     "
ok "======================================="
