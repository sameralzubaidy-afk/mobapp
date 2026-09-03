#!/usr/bin/env python3
"""parse_indexes_v2.py — Re-parse the CURRENT Test Case Index tables from all
6 canonical guides into a master TC list (no date cutoff; reflects guides as
of today).

Read-only w.r.t. guides/code/reports; writes only to temp/tc-inventory-v2/.
"""
import csv
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
GUIDES = [
    ("AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING.md", "AUTH-ONBOARDING-NODES-LISTING-DISCOVERY", "AUTH"),
    ("MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING.md", "MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS", "MSG"),
    ("MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md", "TRADE-FLOW-V2", "TRD"),
    ("MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING.md", "ACCOUNT-DASHBOARD-HELP-LEGAL", "ACC"),
    ("MODULE-ADMIN-PORTAL-MANUAL-TESTING.md", "ADMIN-PORTAL", "ADM"),
    ("MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING.md", "SUBSCRIPTIONS-PAYOUTS-SPWALLET", "SUB"),
]
CC = "/Users/sameralzubaidi/Desktop/kids_marketplace_app/cross-checked-and-consolidated"
TC_RE = re.compile(r"([A-Z]{2,5}-TC-(?:REG-)?[A-Z]?\d+(?:[a-z])?(?:-\w+)?)")

rows = []
for fname, guide_name, short in GUIDES:
    text = open(os.path.join(CC, fname), encoding="utf-8", errors="replace").read()
    lines = text.splitlines()
    # locate Test Case Index table start
    start = None
    for i, l in enumerate(lines):
        if l.strip().startswith("## Test Case Index"):
            start = i
            break
    if start is None:
        print("!! no index found in", fname)
        continue
    end = None
    for i in range(start + 1, len(lines)):
        if lines[i].startswith("## ") and "Test Case Index" not in lines[i]:
            end = i
            break
    if end is None:
        end = len(lines)
    idx = lines[start:end]
    current_group = ""
    n_ids = 0
    for l in idx:
        s = l.strip()
        if not s.startswith("|"):
            continue
        cells = [c.strip().strip('`') for c in s.strip('|').split('|')]
        if len(cells) < 2:
            continue
        gm = re.match(r"\*\*?([A-Z])(?:-\d+)?\s*—", cells[0])
        # group header cells like '**A — Core Happy Paths**' or 'O-1 — ...'
        gfull = re.sub(r"\*\*", "", cells[0])
        m2 = re.match(r"([A-Z])(?:-\d+)?\s*—", gfull)
        tc_cell = cells[1]
        if m2 and not TC_RE.search(tc_cell):
            # a pure group header row
            current_group = gfull
            continue
        mm = TC_RE.search(tc_cell) or TC_RE.search(gfull)
        if not mm:
            continue
        if "TC#" in tc_cell or re.match(r"^-+$", tc_cell):
            continue
        # track group from header if this row re-declares it
        if m2:
            current_group = gfull
        if not current_group:
            current_group = m2.group(1) if m2 else "?"
        tc_id = mm.group(1)
        desc = cells[2] if len(cells) > 2 else ""
        # skip header separator rows
        if re.match(r"^-+$", desc):
            continue
        rows.append((guide_name, short, current_group, tc_id, desc))
        n_ids += 1
    print(f"{short:4s} {guide_name[:40]:42s} index rows: {n_ids}")

with open(os.path.join(HERE, "master-tcs-v2.tsv"), "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter="\t")
    w.writerow(["guide_full", "guide", "group", "tc_id", "description"])
    for r in rows:
        w.writerow(r)

# unique per guide
from collections import Counter
uniq = {}
for gfull, short, group, tc, desc in rows:
    uniq.setdefault(short, set()).add(tc)
print("\nUnique canonical TC-IDs per guide:")
for short in [x[2] for x in GUIDES]:
    print(f"  {short}: {len(uniq.get(short, []))}")
total = sum(len(v) for v in uniq.values())
print("  TOTAL:", total)
