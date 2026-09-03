#!/usr/bin/env python3
"""v2 reconcile — latest manual verdict per canonical TC-ID (no cutoff).

Reads (temp/tc-inventory-v2/):
  master-unique-v2.tsv      current canonical index (guides as of today)
  report-evidence-v2.tsv    fresh no-cutoff evidence scan
  curated-supplements-v2.tsv  (optional) human-curated re-verify attachments

Outputs (temp/tc-inventory-v2/):
  canonical-latest-v2.tsv   per canonical TC-ID latest manual verdict + flags
  unmatched-evidence-v2.tsv non-canonical / automated-only evidence rows

Read-only w.r.t. guides/code/reports.
"""
import csv
import os
import re
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = "/Users/sameralzubaidi/Desktop/kids_marketplace_app"

_report_cache = {}


def report_text(path):
    if path not in _report_cache:
        try:
            _report_cache[path] = open(path, encoding="utf-8", errors="replace").read()
        except Exception:
            _report_cache[path] = ""
    return _report_cache[path]


def extract_finding(path, tc, verdict):
    vw = re.escape(verdict.split()[0])
    for line in report_text(path).splitlines():
        s = line.strip()
        if not s.startswith("|"):
            continue
        if tc not in s:
            continue
        cells = [c.strip() for c in s.strip("|").split("|")]
        for i, c in enumerate(cells):
            if re.search(r"\b" + vw + r"\b", c.upper()):
                rest = " | ".join(cells[i + 1:]).strip()
                rest = re.sub(r"\s+", " ", rest)
                if rest:
                    return rest[:200]
    return ""


# 1. Load the curated canonical set (guide, group, tc_id, description) and
# compute sub_steps from the raw index rows whose tc_id matches exactly.
master_rows = []
with open(os.path.join(HERE, "master-unique-v2.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    next(r)
    for row in r:
        if len(row) >= 4:
            master_rows.append((row[0], row[1], row[2], row[3]))  # guide, group, tc_id, desc

sub_counts = {}
with open(os.path.join(HERE, "master-tcs-v2.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    next(r)
    for row in r:
        if len(row) >= 5:
            k = (row[1], row[3])
            sub_counts[k] = sub_counts.get(k, 0) + 1

master = {}
for guide, group, tc, desc in master_rows:
    key = (guide, tc)
    if key not in master:
        master[key] = {"group": group, "desc": desc, "sub_steps": sub_counts.get(key, 1)}
    else:
        master[key]["sub_steps"] += 1
canonical_ids = set(master.keys())
canonical_tcids = {tc for _, tc in canonical_ids}

# 2. Load evidence
ev = []
with open(os.path.join(HERE, "report-evidence-v2.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    next(r)
    for row in r:
        if len(row) >= 7:
            # path,date,wc,source_type,src_kind,tc_id,verdict
            ev.append((row[0], row[1], int(row[2] or 0), row[3], row[4], row[5], row[6]))

# kind priority for same-(date,path) resolution: report.md preferred over logs
KIND_PRIORITY = {"report.md": 3, "decision-log": 2, "results.json": 1}

manual_ev, unmatched = [], []
for path, date, wc, stype, kind, tc, verdict in ev:
    if stype == "manual" and tc in canonical_tcids:
        manual_ev.append((path, date, wc, tc, verdict, kind))
    else:
        unmatched.append((path, date, stype, tc, verdict))

# 3. curated supplements (manual re-verify attachments)
sup_path = os.path.join(HERE, "curated-supplements-v2.tsv")
if os.path.exists(sup_path):
    for line in open(sup_path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 6:
            continue
        path, date, wc, stype, tc, verdict = parts[0], parts[1], int(parts[2]), parts[3], parts[4], parts[5]
        path = os.path.join(ROOT, path)
        if stype == "manual" and tc in canonical_tcids:
            manual_ev.append((path, date, wc, tc, verdict, "curated"))
        else:
            unmatched.append((path, date, stype, tc, verdict))

by_tc = defaultdict(list)
for row in manual_ev:
    by_tc[row[3]].append(row)

VERDICT_RANK = {"PASS": 0, "PASS (partial)": 0, "FAIL": 1, "BLOCKED": 1, "SKIPPED": 2}
OPEN_VERDICTS = {"FAIL", "BLOCKED"}


def evidence_key(row):
    """(date, wc, kind-priority, path) — latest-dated wins; same date/folder
    prefers report.md summary over decision log."""
    path, date, wc, tc, verdict, kind = row
    return (date, wc, KIND_PRIORITY.get(kind, 0), path)


def is_later(a, b):
    return evidence_key(a) > evidence_key(b)


canon_rows = []
for (guide, tc), info in sorted(master.items(), key=lambda kv: (kv[0][0], kv[0][1])):
    rows = by_tc.get(tc, [])
    if not rows:
        canon_rows.append((guide, tc, info, None, None, None, "NEVER RUN", False, False, "", ""))
        continue
    latest = max(rows, key=evidence_key)
    ldate = latest[1]
    lpath = latest[0].replace(ROOT + "/", "")
    lverdict = latest[4]
    has_pass = any("PASS" in r[4] for r in rows)
    first_pass_date = min((r[1] for r in rows if "PASS" in r[4]), default="")
    later_pass_exists = any(("PASS" in r[4]) and is_later(r, latest) for r in rows)
    still_open = latest[4] in OPEN_VERDICTS and not later_pass_exists
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

with open(os.path.join(HERE, "canonical-latest-v2.tsv"), "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter="\t")
    w.writerow(["guide", "tc_id", "group", "description", "sub_steps",
                "latest_verdict", "latest_date", "source_path", "still_open", "has_pass",
                "finding_note", "first_pass_date"])
    for guide, tc, info, lv, ld, lp, status, so, hp, note, fpd in canon_rows:
        w.writerow([guide, tc, info["group"], info["desc"], info["sub_steps"],
                    lv or "", ld or "", lp or "", "YES" if so else "", "YES" if hp else "",
                    note, fpd])

with open(os.path.join(HERE, "unmatched-evidence-v2.tsv"), "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter="\t")
    w.writerow(["path", "date", "source_type", "tc_id", "verdict"])
    for row in sorted(set(unmatched), key=lambda r: (r[1], r[0], r[3])):
        w.writerow(row)

# stats
n_total = len(canon_rows)
n_run = sum(1 for r in canon_rows if r[6] == "RUN")
n_never = n_total - n_run
n_pass = sum(1 for r in canon_rows if r[6] == "RUN" and r[3] is not None and "PASS" in r[3])
n_open = sum(1 for r in canon_rows if r[7])
g_total = Counter(r[0] for r in canon_rows)
g_run = Counter(r[0] for r in canon_rows if r[6] == "RUN")
g_pass = Counter(r[0] for r in canon_rows if r[6] == "RUN" and r[3] is not None and "PASS" in r[3])
g_open = Counter(r[0] for r in canon_rows if r[7])

print("=== v2 Summary (automated pass, pre-audit) ===")
print(f"Canonical TC-IDs (unique): {n_total}")
print(f"  with >=1 manual verdict: {n_run}")
print(f"  NEVER RUN: {n_never}")
print(f"  latest PASS/PARTIAL: {n_pass}")
print(f"  STILL OPEN: {n_open}")
print("Per guide (total / run / pass / still-open):")
for g in sorted(g_total):
    print(f"  {g:12s} {g_total[g]:3d} / {g_run[g]:3d} / {g_pass[g]:3d} / {g_open[g]:3d}")
print(f"Unmatched rows: {len(set(unmatched))}")
