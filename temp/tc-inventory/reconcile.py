#!/usr/bin/env python3
"""Stage 2 — Reconcile master TC list against report evidence.

Inputs (temp/tc-inventory/):
  master-tcs.tsv           (guide, group, tc_id, description) — one row per
                           index row (sub-steps may share a TC-ID)
  report-evidence.tsv      (path, date, wc, source_type, tc_id, verdict)
  report-register.tsv      (path, date, wc, source_type, rollup, ...)

Outputs (temp/tc-inventory/):
  master-unique.tsv        (guide, group, tc_id, description, sub_steps)
  canonical-latest.tsv     per canonical TC-ID: latest manual verdict + flags
  unmatched-evidence.tsv   evidence IDs with no canonical master match

Read-only w.r.t. guides/code/reports.
"""
import csv
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = "/Users/sameralzubaidi/Desktop/kids_marketplace_app"

# cache of report texts for finding extraction
_report_cache = {}


def report_text(path):
    if path not in _report_cache:
        try:
            _report_cache[path] = open(path, encoding="utf-8", errors="replace").read()
        except Exception:
            _report_cache[path] = ""
    return _report_cache[path]


def extract_finding(path, tc, verdict):
    """Best-effort short finding for a (tc, verdict): look for a verdict-table
    row containing the TC and return the cell after the verdict cell."""
    text = report_text(path)
    vw = re.escape(verdict.split()[0])
    for line in text.splitlines():
        s = line.strip()
        if not s.startswith("|"):
            continue
        if tc not in s:
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        # find verdict cell index
        for i, c in enumerate(cells):
            if re.search(r"\b" + vw + r"\b", c.upper()):
                rest = " | ".join(cells[i + 1:]).strip()
                rest = re.sub(r"\s+", " ", rest)
                if rest:
                    return rest[:220]
    return ""

# --------------------------------------------------------------------------
# 1. Load master list, collapse sub-steps into unique TC-IDs
# --------------------------------------------------------------------------
master_rows = []  # (guide, group, tc_id, description)
with open(os.path.join(HERE, "master-tcs.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    header = next(r)
    for row in r:
        if len(row) >= 4:
            master_rows.append((row[0], row[1], row[2], row[3]))

master = {}  # (guide, tc_id) -> dict(group, desc, sub_steps)
for guide, group, tc, desc in master_rows:
    key = (guide, tc)
    if key not in master:
        master[key] = {"group": group, "desc": desc, "sub_steps": 0}
    master[key]["sub_steps"] += 1

# --------------------------------------------------------------------------
# 2. Load evidence
# --------------------------------------------------------------------------
ev_rows = []
with open(os.path.join(HERE, "report-evidence.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    header = next(r)
    for row in r:
        if len(row) >= 6:
            ev_rows.append(tuple(row))  # path, date, wc, stype, tc, verdict

# --------------------------------------------------------------------------
# 3. Canonical unique list (write master-unique.tsv)
# --------------------------------------------------------------------------
with open(os.path.join(HERE, "master-unique.tsv"), "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter="\t")
    w.writerow(["guide", "group", "tc_id", "description", "sub_steps"])
    for (guide, tc), info in sorted(master.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        w.writerow([guide, info["group"], tc, info["desc"], info["sub_steps"]])

# --------------------------------------------------------------------------
# 4. Split evidence: manual (canonical verdict source) vs automated (separate)
#    Filter evidence to canonical IDs; keep unmatched for a note.
# --------------------------------------------------------------------------
canonical_ids = set()
for (guide, tc) in master:
    canonical_ids.add(tc)

manual_ev = []   # canonical, manual source
unmatched = []   # any source, non-canonical id
for path, date, wc, stype, tc, verdict in ev_rows:
    if tc in canonical_ids and stype == "manual":
        manual_ev.append((path, date, int(wc), tc, verdict))
    elif tc not in canonical_ids:
        unmatched.append((path, date, stype, tc, verdict))

# merge curated supplements (explicit re-verification attachments)
with open(os.path.join(HERE, "curated-supplements.tsv"), encoding="utf-8") as fh:
    for line in fh:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 6:
            continue
        path, date, wc, stype, tc, verdict = parts[0], parts[1], int(parts[2]), parts[3], parts[4], parts[5]
        path = os.path.join(ROOT, path)
        if tc in canonical_ids and stype == "manual":
            manual_ev.append((path, date, int(wc), tc, verdict))
        else:
            unmatched.append((path, date, stype, tc, verdict))

# --------------------------------------------------------------------------
# 5. Latest manual verdict per canonical TC-ID
# --------------------------------------------------------------------------
by_tc = defaultdict(list)
for row in manual_ev:
    by_tc[row[3]].append(row)  # tc -> rows

VERDICT_RANK = {"PASS": 0, "PASS (partial)": 0, "FAIL": 1, "BLOCKED": 1, "SKIPPED": 2}
OPEN_VERDICTS = {"FAIL", "BLOCKED"}


def is_later(a, b):
    """True if evidence row a is strictly later than b (date, wc, path)."""
    return (a[1], a[2], a[0]) > (b[1], b[2], b[0])


canon_rows = []
for (guide, tc), info in sorted(master.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    rows = by_tc.get(tc, [])
    if not rows:
        canon_rows.append((guide, tc, info, None, None, None, "NEVER RUN", False, False, "", ""))
        continue
    # latest = max by (date, wc, path)
    latest = max(rows, key=lambda r: (r[1], r[2], r[0]))
    ldate = latest[1]
    lpath = latest[0].replace(ROOT + "/", "")
    lverdict = latest[4]
    # has a PASS at any point?
    has_pass = any("PASS" in r[4] for r in rows)
    first_pass_date = min((r[1] for r in rows if "PASS" in r[4]), default="")
    # STILL OPEN: latest is FAIL/BLOCKED and no later PASS exists
    later_pass_exists = any(
        ("PASS" in r[4]) and is_later(r, latest) for r in rows
    )
    still_open = latest[4] in OPEN_VERDICTS and not later_pass_exists
    # classification note
    note = ""
    if still_open:
        finding = extract_finding(latest[0], tc, lverdict)
        if lverdict == "BLOCKED" and has_pass:
            note = f"re-opened (env/fixture) — PASS on record {first_pass_date}"
        elif lverdict == "BLOCKED":
            note = "BLOCKED, never passed (fixture/config/environment)"
        elif lverdict == "FAIL" and has_pass:
            note = f"FAIL after earlier PASS {first_pass_date} (regression/re-open)"
        else:
            note = "FAIL, unresolved"
        if finding:
            note += f" — {finding}"
    canon_rows.append((guide, tc, info, lverdict, ldate, lpath, "RUN" if rows else "NEVER RUN",
                       still_open, has_pass, note, first_pass_date))

# write canonical-latest.tsv
with open(os.path.join(HERE, "canonical-latest.tsv"), "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter="\t")
    w.writerow(["guide", "tc_id", "group", "description", "sub_steps",
                "latest_verdict", "latest_date", "source_path", "still_open", "has_pass",
                "finding_note", "first_pass_date"])
    for guide, tc, info, lv, ld, lp, status, so, hp, note, fpd in canon_rows:
        w.writerow([guide, tc, info["group"], info["desc"], info["sub_steps"],
                    lv or "", ld or "", lp or "", "YES" if so else "", "YES" if hp else "",
                    note, fpd])

# write unmatched-evidence.tsv
with open(os.path.join(HERE, "unmatched-evidence.tsv"), "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter="\t")
    w.writerow(["path", "date", "source_type", "tc_id", "verdict"])
    for row in sorted(unmatched, key=lambda r: (r[1], r[0])):
        w.writerow(row)

# --------------------------------------------------------------------------
# 6. Summary stats
# --------------------------------------------------------------------------
n_total = len(canon_rows)
n_run = sum(1 for r in canon_rows if r[6] == "RUN")
n_never = n_total - n_run
n_pass = sum(1 for r in canon_rows if r[6] == "RUN" and r[3] is not None and "PASS" in r[3])
n_open = sum(1 for r in canon_rows if r[7])
# per-guide stats
from collections import Counter
g_total = Counter(r[0] for r in canon_rows)
g_run = Counter(r[0] for r in canon_rows if r[6] == "RUN")
g_pass = Counter(r[0] for r in canon_rows if r[6] == "RUN" and r[3] is not None and "PASS" in r[3])
g_open = Counter(r[0] for r in canon_rows if r[7])

print("=== Summary ===")
print(f"Canonical TC-IDs (unique): {n_total}")
print(f"  with >=1 manual verdict on record: {n_run}")
print(f"  NEVER RUN: {n_never}")
print(f"  latest verdict PASS (or PASS partial): {n_pass}")
print(f"  STILL OPEN (latest FAIL/BLOCKED, no later PASS): {n_open}")
print("\nPer guide (total / run / pass / still-open):")
for g in sorted(g_total):
    print(f"  {g:12s} {g_total[g]:3d} / {g_run[g]:3d} / {g_pass[g]:3d} / {g_open[g]:3d}")
print(f"\nUnmatched (non-canonical) evidence rows: {len(unmatched)}")
