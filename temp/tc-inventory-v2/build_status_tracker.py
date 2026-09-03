#!/usr/bin/env python3
"""Build QA-TESTCASE-STATUS-2026-09-03.md into e2e-test-results/.

Reuses the resolved per-case status rows from generate_inventory_v2.py
(curated TRD map + auto reconcile for AUTH/MSG/ACC/ADM/SUB) and renders a
future-reference status doc: every canonical test case from the 6 guides in
cross-checked-and-consolidated/, with completed status + remaining list.

Read-only w.r.t. guides/code/reports.
"""
import os
import sys
import importlib.util

ROOT = "/Users/sameralzubaidi/Desktop/kids_marketplace_app"
HERE = os.path.join(ROOT, "temp/tc-inventory-v2")
OUT = os.path.join(ROOT, "e2e-test-results", "QA-TESTCASE-STATUS-2026-09-03.md")

# import the inventory generator (re-uses exact curated/auto rows)
spec = importlib.util.spec_from_file_location(
    "generate_inventory_v2", os.path.join(HERE, "generate_inventory_v2.py"))
gi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gi)

rows = gi.rows
GUIDES = gi.GUIDES
GNAME = gi.GNAME
STATUS_ICON = gi.STATUS_ICON

from collections import Counter
g_total = Counter(r["guide"] for r in rows)
g_pass = Counter(r["guide"] for r in rows if r["verdict"] == "PASS")
g_partial = Counter(r["guide"] for r in rows if r["verdict"] == "PARTIAL")
g_open = Counter(r["guide"] for r in rows if r["verdict"] in ("FAIL", "BLOCKED"))
g_drift = Counter(r["guide"] for r in rows if r["verdict"] == "DRIFT")
g_skip = Counter(r["guide"] for r in rows if r["verdict"] == "SKIPPED")
g_never = Counter(r["guide"] for r in rows if r["verdict"] == "NEVER")

FULLNAME = {
    "AUTH": "Signup / Onboarding / Nodes / Listing / Discovery",
    "MSG": "Messaging / Badges / ID-Verification / Referrals / Safety / Notifications",
    "TRD": "TradeFlow V2 (Module 15.1.2)",
    "ACC": "Account / Dashboard / Help / Legal",
    "ADM": "Admin Portal",
    "SUB": "Subscriptions / Payouts / SP Wallet",
}
GUIDE_FILE = {
    "AUTH": "AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md",
    "MSG": "MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md",
    "TRD": "MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md",
    "ACC": "MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md",
    "ADM": "MODULE-ADMIN-PORTAL-MANUAL-TESTING.md",
    "SUB": "MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md",
}
LATEST_WORD = {"PASS": "PASS", "PARTIAL": "PARTIAL", "FAIL": "FAIL",
               "BLOCKED": "BLOCKED", "SKIPPED": "SKIPPED",
               "DRIFT": "DOC-DRIFT", "NEVER": "NEVER RUN"}


def nat_key(r):
    import re
    m = re.match(r"[A-Z]+-TC-([A-Z]?)(\d+)([a-z]?)$", r["tc"])
    if not m:
        return (2, r["tc"])
    return (0, m.group(1) or " ", int(m.group(2)), m.group(3))


L = []
A = L.append
A("# QA Test-Case Status — All Canonical Guides")
A("")
A("> Future-reference status of **every canonical test case** in the 6 consolidated guides under `cross-checked-and-consolidated/`, reconciled against all QA evidence on disk through **2026-09-03**. Read-only snapshot — no guides/code/reports modified. Full narrative + method in `TEST-COVERAGE-INVENTORY-v2.md` (repo root); raw data in `temp/tc-inventory-v2/`.")
A("")
A("**Generated:** 2026-09-03 · **Total canonical cases:** %d" % sum(g_total.values()))
A("")
A("## Status legend")
A("")
A("| Status | Meaning |")
A("|---|---|")
A("| ✅ PASS | Executed; latest verdict PASS (may carry minor copy/finding notes) |")
A("| 🟡 PARTIAL | Executed with partial/limited evidence (source-confirmed, tooling-limited, or fixture-gapped sub-leg) |")
A("| 🔴 STILL OPEN | Latest verdict FAIL or BLOCKED with no later PASS re-verification — real residual defect or env/fixture block |")
A("| 📄 DOC-DRIFT | Guide assertion is obsolete/superseded; the underlying backend behavior was verified |")
A("| ⏭️ SKIPPED | Attempted but explicitly not exercised (budget/persona/scope) |")
A("| NEVER RUN | **Remaining** — no report on disk asserts a verdict under this canonical ID |")
A("")
A("## 1 · Per-guide roll-up")
A("")
A("| Guide | Canonical file | Cases | ✅ PASS | 🟡 PARTIAL | 🔴 OPEN | 📄 DRIFT | ⏭️ SKIP | **Remaining (NEVER RUN)** |")
A("|---|---|---:|---:|---:|---:|---:|---:|---:|")
for g in GUIDES:
    A(f"| **{g}** | `{GUIDE_FILE[g]}` | {g_total[g]} | {g_pass[g]} | {g_partial[g]} | {g_open[g]} | {g_drift[g]} | {g_skip[g]} | **{g_never[g]}** |")
A("")
A("Completed = any of PASS/PARTIAL/OPEN/DRIFT/SKIP. A case that is PASS, PARTIAL or OPEN has been executed at least once; DRIFT/SKIP rows are documented; the **Remaining** column is what still needs a run.")
A("")

for g in GUIDES:
    gr = sorted([r for r in rows if r["guide"] == g], key=nat_key)
    never = [r for r in gr if r["verdict"] == "NEVER"]
    done = [r for r in gr if r["verdict"] != "NEVER"]
    A(f"## {g} · {FULLNAME[g]}")
    A("")
    A(f"**Guide file:** `cross-checked-and-consolidated/{GUIDE_FILE[g]}` · **Cases:** {g_total[g]} · "
      f"**PASS** {g_pass[g]} · **PARTIAL** {g_partial[g]} · **OPEN** {g_open[g]} · "
      f"**DOC-DRIFT** {g_drift[g]} · **SKIPPED** {g_skip[g]} · **Remaining (NEVER RUN)** {g_never[g]}")
    A("")
    if done:
        A("### Completed test cases (have a verdict on record)")
        A("")
        A("| TC-ID | Description | Status | Latest | Date | Source | Notes |")
        A("|---|---|---|---|---|---|---|")
        for r in done:
            note_s = (r["note"] or "").replace("|", "\\|")
            if not note_s and r["verdict"] == "FAIL":
                note_s = "FAIL, unresolved"
            if not note_s and r["verdict"] == "BLOCKED":
                note_s = "BLOCKED (env/fixture)"
            src_cell = f"`{r['src']}`" if r["src"] else ""
            A(f"| {r['tc']} | {r['desc']} | {STATUS_ICON[r['verdict']]} | {LATEST_WORD[r['verdict']]} | {r['date']} | {src_cell} | {note_s} |")
        A("")
    if never:
        A(f"### Remaining test cases — NEVER RUN ({len(never)})")
        A("")
        A("| TC-ID | Description | Note / why remaining |")
        A("|---|---|---|")
        for r in never:
            note_s = (r["note"] or "").replace("|", "\\|")
            A(f"| {r['tc']} | {r['desc']} | {note_s} |")
        A("")
    else:
        A("_All cases in this guide have a verdict on record — none remaining._")
        A("")

open(OUT, "w", encoding="utf-8").write("\n".join(L) + "\n")
print("Wrote", OUT)
print("Per-guide remaining (NEVER RUN):", dict(g_never))
