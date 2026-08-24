#!/usr/bin/env python3
"""Parse the extracted Test Case Index tables from the 6 canonical guides
into a single master TC list (temp/tc-inventory/master-tcs.tsv).

Read-only: reads cross-checked-and-consolidated/ guides, writes only to
temp/tc-inventory/ scratch.
"""
import csv
import glob
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX_DIR = HERE
OUT = os.path.join(HERE, "master-tcs.tsv")

# Map index file -> guide display name
GUIDE_NAMES = {
    "AUTH-ONBOARDING-NODES-LISTING-DISCOVERY-MANUAL-TESTING": "AUTH-ONBOARDING-NODES-LISTING-DISCOVERY",
    "MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS-MANUAL-TESTING": "MESSAGING-BADGES-IDVERIFICATION-REFERRALS-SAFETY-NOTIFICATIONS",
    "MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING": "TRADE-FLOW-V2",
    "MODULE-ACCOUNT-DASHBOARD-HELP-LEGAL-MANUAL-TESTING": "ACCOUNT-DASHBOARD-HELP-LEGAL",
    "MODULE-ADMIN-PORTAL-MANUAL-TESTING": "ADMIN-PORTAL",
    "MODULE-SUBSCRIPTIONS-PAYOUTS-SPWALLET-MANUAL-TESTING": "SUBSCRIPTIONS-PAYOUTS-SPWALLET",
}

TC_RE = re.compile(r"[A-Z]+-TC-[A-Za-z0-9]+")

rows = []
for idx_file in sorted(glob.glob(os.path.join(INDEX_DIR, "*.index.txt"))):
    base = os.path.basename(idx_file)[: -len(".index.txt")]
    guide = GUIDE_NAMES[base]
    current_group = ""
    with open(idx_file, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line.startswith("|"):
                continue
            # split table row on unescaped pipes
            cells = [c.strip() for c in line.strip("|").split("|")]
            # table header rows
            if len(cells) < 3:
                continue
            group_cell, tc_cell, desc_cell = cells[0], cells[1], cells[2]
            if tc_cell in ("TC#", "---") or group_cell == "Group":
                continue
            if re.match(r"^-+$", tc_cell):
                continue
            m = TC_RE.search(tc_cell)
            if not m:
                # maybe group header row only (no TC in col 2)
                if group_cell and group_cell not in ("", "Group"):
                    current_group = re.sub(r"\*\*", "", group_cell)
                continue
            tc_id = m.group(0)
            if group_cell and group_cell != "":
                current_group = re.sub(r"\*\*", "", group_cell)
            desc = desc_cell.strip()
            rows.append((guide, current_group, tc_id, desc))

with open(OUT, "w", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh, delimiter="\t")
    w.writerow(["guide", "group", "tc_id", "description"])
    for r in rows:
        w.writerow(r)

print(f"Total TC rows parsed: {len(rows)}")
from collections import Counter
c = Counter(r[0] for r in rows)
for g, n in c.items():
    print(f"  {g}: {n}")
# report any TC-ID appearing more than once within a guide
dup = Counter((r[0], r[2]) for r in rows)
dups = {k: v for k, v in dup.items() if v > 1}
print(f"Duplicate (guide, TC-ID) rows: {len(dups)}")
for k, v in sorted(dups.items()):
    print(f"  {k}: {v}")
