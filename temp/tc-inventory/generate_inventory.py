#!/usr/bin/env python3
"""Stage 3 — Generate TEST-COVERAGE-INVENTORY.md from the reconciliation data.

Reads temp/tc-inventory/canonical-latest.tsv + report-register.tsv +
unmatched-evidence.tsv and writes TEST-COVERAGE-INVENTORY.md at the repo root.
"""
import csv
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = "/Users/sameralzubaidi/Desktop/kids_marketplace_app"
OUT = os.path.join(ROOT, "TEST-COVERAGE-INVENTORY.md")

# ---- load canonical latest ----
canon = []
with open(os.path.join(HERE, "canonical-latest.tsv"), encoding="utf-8") as fh:
    r = csv.DictReader(fh, delimiter="\t")
    for row in r:
        canon.append(row)

# ---- load report register ----
register = []
with open(os.path.join(HERE, "report-register.tsv"), encoding="utf-8") as fh:
    r = csv.DictReader(fh, delimiter="\t")
    for row in r:
        register.append(row)

# ---- load unmatched (for appendix) ----
unmatched = []
with open(os.path.join(HERE, "unmatched-evidence.tsv"), encoding="utf-8") as fh:
    r = csv.DictReader(fh, delimiter="\t")
    for row in r:
        unmatched.append(row)

GUIDE_LABEL = {
    "AUTH-ONBOARDING-NODES-LISTING-DISCOVERY": "AUTH (Signup→Discovery)",
    "MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS": "MSG (Messaging→Notifications)",
    "TRADE-FLOW-V2": "TRD (TradeFlowV2)",
    "ACCOUNT-DASHBOARD-HELP-LEGAL": "ACC (Account/Dashboard/Help/Legal)",
    "ADMIN-PORTAL": "ADM (Admin Portal)",
    "SUBSCRIPTIONS-PAYOUTS-SPWALLET": "SUB (Subscriptions/Payouts/SP Wallet)",
}
GUIDE_ORDER = [
    "AUTH-ONBOARDING-NODES-LISTING-DISCOVERY",
    "MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS",
    "TRADE-FLOW-V2",
    "ACCOUNT-DASHBOARD-HELP-LEGAL",
    "ADMIN-PORTAL",
    "SUBSCRIPTIONS-PAYOUTS-SPWALLET",
]

# ---- aggregate stats ----
def status_of(row):
    if not row["latest_verdict"]:
        return "never"
    v = row["latest_verdict"]
    if "PASS" in v:
        return "pass"
    if row["still_open"] == "YES":
        return "open"
    return "other"

agg = Counter()
for row in canon:
    agg[status_of(row)] += 1
agg["total"] = len(canon)

per_guide = defaultdict(Counter)
for row in canon:
    per_guide[row["guide"]][status_of(row)] += 1
    per_guide[row["guide"]]["total"] += 1

n_pass = agg["pass"]
n_never = agg["never"]
n_open = agg["open"]

L = []
def w(s=""):
    L.append(s)

w("# TEST-COVERAGE-INVENTORY")
w()
w("> **Ground-truth QA test-coverage inventory** — every captured QA report cross-referenced against the full canonical guide index. Generated from evidence on disk. **Read-only reconciliation** — no guides, code, or reports were modified.")
w()
w("**Generated:** 2026-08-24")
w()
w("## 1 · Executive summary")
w()
w(f"- **Canonical test cases (unique TC-IDs across the 6 guides):** **{agg['total']}**")
w(f"- **Have at least one PASS on record (latest verdict PASS / PASS partial):** **{n_pass}** ({round(100*n_pass/agg['total'],1)}%)")
w(f"- **NEVER RUN** (no report on disk covers them): **{n_never}** ({round(100*n_never/agg['total'],1)}%)")
w(f"- **STILL OPEN** (latest FAIL/BLOCKED with no later PASS re-verification): **{n_open}**")
w()
w("| Guide | Cases | Run | PASS (latest) | STILL OPEN | NEVER RUN |")
w("|---|---:|---:|---:|---:|---:|")
for g in GUIDE_ORDER:
    c = per_guide[g]
    w(f"| {GUIDE_LABEL[g]} | {c['total']} | {c['total']-c['never']} | {c['pass']} | {c['open']} | {c['never']} |")
w()
w("**Key facts**")
w()
w("- All manual QA evidence on disk is **AUTH-guide** (groups A–S). The other five guides (**MSG, TRD, ACC, ADM, SUB**) have **no manual verdict rows** on record — their only coverage is the legacy automated-suite runs (appendix §6), which use a pre-prefix ID scheme and are not merged into the canonical rows below.")
w("- 122 of 137 AUTH cases that have ever been run currently hold a PASS (many after fix→re-verify cycles). 13 remain STILL OPEN — 12 are fixture/config/environment or doc-drift blocks, 1 (Q04) is a stale-guide assertion with the underlying fee behavior verified.")
w("- The `e2e-test-results/` corpus contains **58 report.md files** plus decision logs, results.json, and screenshot-only evidence; the full source register is in §5.")
w()
w("## 2 · Method (read-only reconciliation)")
w()
w("1. **Step 1 — Guides:** parsed the `## Test Case Index` table at the top of each of the 6 canonical files in `cross-checked-and-consolidated/`, extracting every TC-ID with its group and description (876 index rows → **820 unique TC-IDs**; some TC-IDs enumerate multiple sub-step assertions, e.g. `TRD-TC-O1` has 17 rows).")
w("2. **Step 2 — Evidence:** scanned the whole repo for QA-run reports (`e2e-test-results/**/report.md`, `test-automation/trade-flow-v2/reports/**/report.md`, standalone reports, decision logs, results.json). Extracted per-case verdicts across the known report formats (verdict tables, section headers, inline `TC → VERDICT` prose, suffix-only tables, and `results.json` unit reconstruction for automated runs).")
w("3. **Step 3 — Reconciliation:** for each canonical TC-ID, latest verdict = most recent evidence by (date, wall-clock start, path). **STILL OPEN** = latest verdict FAIL/BLOCKED with no later-dated PASS re-verification. **NEVER RUN** = no report on disk references it with a verdict. Curated attachments (fix-verify/re-verify reports asserting per-TC outcomes via Item/Check tables) are merged and documented in the source column.")
w()
w("**Scope limits (be explicit):**")
w()
w("- **Manual verdicts drive the canonical rows.** Automated-suite runs (May–Jun 2026) used a **legacy, pre-prefix ID scheme** (`TC-A01`, `REG-R01`, …) that does not map 1:1 to the current canonical IDs, and several of those runs were harness-broken (all-fail). They are reported separately in §6 rather than merged, to avoid falsely marking canonical cases as FAIL. 126/134 legacy IDs do map cleanly to a `TRD-TC-*` candidate (see §6.2).")
w("- **Targeted spot-check / fix-verification reports** that don't assert per-TC verdicts (e.g. `group-p-reverify`, `spotcheck-*`, `tabbar-*`, `phase26`, `group-qs-fix-verify`) are listed in §7; where they re-verify a canonical case (L01–L04, P18, P19, Q06), the verdict was attached manually and is marked in the source column.")
w()

# ---- main reconciliation tables ----
w("## 3 · Canonical coverage by guide")
w()
w("Columns: **Latest** = latest verdict on record · **Date** = date of that verdict · **Source** = run folder of the latest evidence · **Status** = `✅ PASS` / `🔴 STILL OPEN` / `⏭️ SKIPPED` / `NEVER RUN`.")
w()
for g in GUIDE_ORDER:
    rows = [r for r in canon if r["guide"] == g]
    w(f"### {GUIDE_LABEL[g]} — {len(rows)} cases")
    w()
    w("| TC-ID | Description | Sub | Latest | Date | Source | Status |")
    w("|---|---|---:|---|---|---|---|")
    current_group = None
    for r in rows:
        tc = r["tc_id"]
        grp = r["group"]
        # group header row
        group_header = ""
        if grp and grp != current_group:
            current_group = grp
        desc = r["description"]
        if not r["latest_verdict"]:
            latest = "—"
            date = "—"
            src = "—"
            status = "NEVER RUN"
        else:
            latest = r["latest_verdict"]
            date = r["latest_date"]
            src = r["source_path"].split("/")[-2] if r["source_path"] else ""
            if r["still_open"] == "YES":
                status = "🔴 STILL OPEN"
            elif "PASS" in latest:
                status = "✅ PASS"
            elif latest == "SKIPPED":
                status = "⏭️ SKIPPED"
            else:
                status = latest
        src_short = src.replace("e2e-test-results/", "")
        w(f"| {tc} | {desc} | {r['sub_steps']} | {latest} | {date} | `{src_short}` | {status} |")
    w()
    w()

# ---- STILL OPEN ----
w("## 4 · STILL OPEN — unresolved / blocked findings (13)")
w()
w("Latest verdict FAIL or BLOCKED with **no later PASS re-verification** on disk. The finding note is taken from the latest report's verdict row.")
w()
w("| TC-ID | Group | Latest | Date | Finding (from latest report) |")
w("|---|---|---|---|---|")
for r in canon:
    if r["still_open"] == "YES":
        grp = r["group"].split("—")[0].strip()
        w(f"| **{r['tc_id']}** | {grp} | {r['latest_verdict']} | {r['latest_date']} | {r['finding_note']} |")
w()
w("**Notes on the open set:**")
w()
w("- `C03/C05/C07`, `E04`, `H03`, `P03` — **fixture/config/environment blocks** (Apple provider not enabled, no simulation toggles armed, no conversation fixture, rate-limit not inducible in dev). Code paths are often source-verified but not executable on-device.")
w("- `H04/H05`, `I01/I02/I03` — the guide itself marks these **REMOVED / superseded** (Welcome & Feature-Highlights screens deleted; in-app trial-choice step removed in favor of the web-first `JoinKidsClubScreen`). `H04` additionally has a confirmed literal accessibility-prop-text defect (BP-61 class).")
w("- `Q04` — **doc drift**: the guide's fee example (`2.5 = 10%`) is stale vs the flat-fee model; the actual buyer fee behavior was re-verified in `group-qs-fix-verify` (Fix 4). Guide text needs updating.")
w("- `S01` — **re-opened by environment** (staging SMTP cannot send reset emails on 2026-08-23); the case passed on 2026-08-16. Staging mail delivery needs fixing to re-verify.")
w()

# ---- NEVER RUN ----
w("## 5 · NEVER RUN — no evidence on disk")
w()
w(f"**{n_never}** canonical TC-IDs have no verdict row in any report on disk. This is the **full remaining coverage gap** — concentrated in the five guides that have never had a manual QA pass:")
w()
w("| Guide | Total | NEVER RUN | Of which never run % |")
w("|---|---:|---:|---:|")
for g in GUIDE_ORDER:
    c = per_guide[g]
    w(f"| {GUIDE_LABEL[g]} | {c['total']} | {c['never']} | {round(100*c['never']/c['total'],1)}% |")
w()
w("Within the AUTH guide the only NEVER-RUN case is `AUTH-TC-J10` (explicitly excluded from the Group J run per the test brief as already closed).")
w()

# ---- report register ----
w("## 6 · Evidence source register (58 reports on disk)")
w()
w("All report.md files found and parsed for this inventory, with the per-case evidence rows each produced (deduplicated).")
w()
w("| Date | Source type | Report (run folder) | Roll-up P/F/B/S | Evidence rows |")
w("|---|---|---|---|---:|")
for rr in sorted(register, key=lambda r: (r["date"], r["path"])):
    folder = rr["path"].replace(ROOT + "/e2e-test-results/", "").replace(ROOT + "/", "")
    folder = folder.replace("/report.md", "")
    n = int(rr["n_explicit"]) + int(rr["n_suffix"]) + int(rr["n_inline"])
    rollup = rr["rollup_p_f_b_s"] or "—"
    w(f"| {rr['date']} | {rr['source_type']} | `{folder}` | {rollup} | {n} |")
w()
w("Additional evidence not captured as report.md rows:")
w()
w("- **Decision / outcome logs** (8): `group-a-b-d-auth`, `group-h-profile-setup`, `group-l-playwright-l01-l04`, `group-p-full-run-19-cases`, `phase22-auth-group-b-d-e`, `phase23-wrapup-f06-reverify-f07-h03`, `phase25-auth-group-k-bulk`, `phase26-bulk-four-fixes-verify` (each `decision*-log.md` in the run folder).")
w("- **results.json** (12 automated runs) — used as the authoritative per-case source for the automated runs in §7.")
w("- **Screenshot-only run folder** `group-o-locator-fixes-2026-08-23/` (no report.md; fix-evidence captured as screenshots only).")
w("- **Stage harness reports** `stage2/report.md`, `stage3/report.md` + `report-*.md`, `stage4/report-write-based-provisioning.md`, `stage5/report-auth-teardown.md`, `Stage1-iOS-Signup-HappyPath-report.md` (A01–A03/B01/B02 PASS merged above), `itemcreate-scroll-investigation-2026-08-17/report.md`.")
w()

# ---- automated suite runs ----
w("## 7 · Automated suite runs (legacy ID scheme — kept separate)")
w()
w("The `run-suite.sh` automated runs (May–Jun 2026) exercised the TradeFlowV2 suite using a **legacy, pre-prefix ID scheme** (`TC-A01`…`TC-R13`, `REG-R01`…`R08`). Per-case verdicts were reconstructed from `results.json` (unit case lists + pass flags + `skipped` array) and reconcile exactly with each run's reported totals. They are **not** merged into the canonical rows because the legacy IDs don't map 1:1 to the current canonical IDs and several runs were harness-broken (all-fail).")
w()
# ---- automated run totals from results.json ----
def automated_totals(run_folder):
    import json
    rj = os.path.join(ROOT, run_folder, "results.json")
    if not os.path.exists(rj):
        return None
    try:
        d = json.load(open(rj, encoding="utf-8"))
    except Exception:
        return None
    t = d.get("totals", {})
    return (t.get("casesPassed", 0), t.get("casesFailed", 0), t.get("casesSkipped", 0))

w("| Run | Date | Passed | Failed | Skipped | Notes |")
w("|---|---|---:|---:|---:|---|")
auto_runs = []
for rr in register:
    if rr["source_type"] == "automated":
        auto_runs.append((rr["date"], rr["path"]))
auto_runs.sort()
for date, path in auto_runs:
    folder = path.replace(ROOT + "/", "").replace("/report.md", "")
    tot = automated_totals(folder)
    if tot is None:
        p = f = s = "?"
    else:
        p, f, s = tot
    note = "legacy IDs"
    if isinstance(f, int) and f and p == 0:
        note += " · harness-broken (all-fail)"
    w(f"| `{folder}` | {date} | {p} | {f} | {s} | {note} |")
w()
w("### 7.1 Legacy → canonical candidate mapping")
w()
w(f"Of the **134 distinct legacy IDs** referenced by the automated runs, **126** map cleanly by suffix to a canonical `TRD-TC-*` ID that exists in the current guide (e.g. `TC-A01 → TRD-TC-A01`, `REG-R01 → TRD-TC-REG-R01`). The remaining 8 (`TC-O01`–`TC-O07`, `TC-R13`-style zero-padding variants) have no exact canonical suffix match because the guide renumbered those groups (e.g. `TRD-TC-O1`, not `O01`). These runs predate the module-prefix manifest change and are treated as historical harness evidence, not current coverage.")
w()

# ---- unmatched phantoms ----
w("## 8 · Evidence IDs with no canonical match (phantom / legacy)")
w()
w("Five **manual-source phantom IDs** were produced by parser heuristics (suffix matching) or appear as dangling cross-references. None exist in any canonical guide index, so they are excluded from the coverage table. The legacy automated IDs are excluded by design (see §7).")
w()
w("| ID | Verdicts on record | Explanation |")
w("|---|---|---|")
# aggregate phantom occurrences
phantom_rows = [u for u in unmatched if u["source_type"] == "manual"]
phantom_agg = defaultdict(list)
for u in phantom_rows:
    phantom_agg[u["tc_id"]].append(u["verdict"])
phantom_explain = {
    "AUTH-TC-F07": "Dangling cross-reference — the F06 Assert cites “see AUTH-TC-F07”; the wrap-up report notes F07 is NOT a registered case (Group F = F01–F06). Intent covered by F02/F03/F04.",
    "AUTH-TC-R7": "Suffix-parse artifact from “JoinKidsClubScreen (R7 web-first)” route reference; the AUTH guide has no R group.",
    "AUTH-TC-P0": "Suffix-parse artifact from severity labels (P0) in report prose; the AUTH P-group is zero-padded (P01–P19), so no P0 exists.",
    "AUTH-TC-P1": "Suffix-parse artifact from commit/severity labels (P1) in report prose; the AUTH P-group is zero-padded (P01–P19), so no P1 exists.",
    "AUTH-TC-P3": "Suffix-parse artifact from commit/severity labels (P3) in report prose; the AUTH P-group is zero-padded (P01–P19), so no P3 exists.",
}
for tc in sorted(phantom_agg):
    verdicts = ", ".join(sorted(set(phantom_agg[tc])))
    w(f"| `{tc}` | {verdicts} | {phantom_explain.get(tc, 'Dangling cross-ref / parse artifact')} |")
w()
w("- The **legacy automated IDs** (1538 rows / 134 distinct) are excluded from the canonical table by design — see §7.")
w()

# ---- footer ----
w("## 9 · How to re-run / regenerate")
w()
w("Scratch tooling lives in `temp/tc-inventory/` (read-only over guides/code/reports):")
w()
w("```bash")
w("python3 temp/tc-inventory/parse_indexes.py   # Step 1: guides → master-tcs.tsv")
w("python3 temp/tc-inventory/parse_reports.py   # Step 2: reports → report-evidence.tsv")
w("python3 temp/tc-inventory/reconcile.py       # Step 3a: reconcile → canonical-latest.tsv")
w("python3 temp/tc-inventory/generate_inventory.py  # Step 3b: this file")
w("```")
w()
w("To add a curated attachment (a targeted report that asserts canonical verdicts without parseable rows), append rows to `temp/tc-inventory/curated-supplements.tsv` and re-run steps 3a/3b.")

open(OUT, "w", encoding="utf-8").write("\n".join(L) + "\n")
print(f"Wrote {OUT}")
print(f"  rows: total={agg['total']} pass={n_pass} never={n_never} open={n_open}")
