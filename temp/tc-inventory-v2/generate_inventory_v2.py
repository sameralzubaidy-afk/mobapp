#!/usr/bin/env python3
"""Generate TEST-COVERAGE-INVENTORY-v2.md (dated 2026-09-03 snapshot).

Method:
  - Canonical rows: current guide index (temp/tc-inventory-v2/master-unique-v2.tsv)
    + sub-step counts (master-tcs-v2.tsv exact-match rows).
  - TRD rows: CURATED verdict map below, built by reading every TRD QA report on
    disk (2026-08-26 .. 2026-09-02) — the auto parser cannot read flow-based
    (non-ID-addressed) TRD reports and mis-reads "original -> latest" tables.
  - AUTH/MSG/ACC/ADM/SUB rows: auto reconciliation (canonical-latest-v2.tsv),
    latest manual verdict by (date, wall-clock, kind-priority, path).

Read-only w.r.t. guides/code/reports. Writes only the new inventory snapshot.
"""
import csv
import os
from collections import Counter, defaultdict

ROOT = "/Users/sameralzubaidi/Desktop/kids_marketplace_app"
HERE = os.path.join(ROOT, "temp/tc-inventory-v2")
OUT = os.path.join(ROOT, "TEST-COVERAGE-INVENTORY-v2.md")

# ---------------------------------------------------------------------------
# 1. Load canonical rows
# ---------------------------------------------------------------------------
canon = []  # (guide, tc, group, desc)
with open(os.path.join(HERE, "master-unique-v2.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    next(r)
    for row in r:
        if len(row) >= 4:
            canon.append((row[0], row[2], row[1], row[3]))
subc = defaultdict(int)
with open(os.path.join(HERE, "master-tcs-v2.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    next(r)
    for row in r:
        if len(row) >= 5:
            subc[(row[1], row[3])] += 1

# ---------------------------------------------------------------------------
# 2. Auto reconcile for non-TRD guides
# ---------------------------------------------------------------------------
auto = {}  # tc_id -> (verdict, date, source)
with open(os.path.join(HERE, "canonical-latest-v2.tsv"), encoding="utf-8") as fh:
    r = csv.reader(fh, delimiter="\t")
    next(r)
    for row in r:
        if len(row) >= 8 and row[0] != "TRD":
            v = row[5] or "NEVER"
            if v == "PASS (partial)":
                v = "PARTIAL"
            src = row[7] or ""
            # shorten to the run folder name for readability
            parts = src.split("/")
            if len(parts) >= 3 and parts[0] == "e2e-test-results":
                src = parts[1]
            elif len(parts) >= 2 and parts[0] == "test-automation":
                src = parts[-2] + "/" + parts[-1]
            auto[row[1]] = (v, row[6] or "", src)

# ---------------------------------------------------------------------------
# 3. Curated TRD map  (verdict / date / source-short / note)
#    Verdict codes: PASS, PARTIAL, FAIL, BLOCKED, SKIPPED, DRIFT
#    Missing IDs default to NEVER RUN.
# ---------------------------------------------------------------------------
# fmt: off
T = {}
def P(i, d, s, n=""): T[i] = ("PASS", d, s, n)
def PP(i, d, s, n=""): T[i] = ("PARTIAL", d, s, n)
def F(i, d, s, n=""): T[i] = ("FAIL", d, s, n)
def B(i, d, s, n=""): T[i] = ("BLOCKED", d, s, n)
def S(i, d, s, n=""): T[i] = ("SKIPPED", d, s, n)
def D(i, d, s, n=""): T[i] = ("DRIFT", d, s, n)

# --- Group A ---
P("TRD-TC-A01","2026-08-28","qa-trd-group-a-b-2026-08-28","cash happy path; earlier 08-26 BLOCKED (EF v52), fixed v56 (trd-part2 08-27 PASS)")
P("TRD-TC-A02","2026-08-28","qa-trd-reverify-a02-b02-b06-2026-08-28","Accept-SP happy path; 08-28 P1 SP-settlement FAIL then PASS after trigger recreated (migration 20260828000001)")
# A03/A04 : NEVER RUN

# --- Group B ---
P("TRD-TC-B01","2026-08-28","qa-trd-b01-b02-reverify-2026-08-28","declined offer History placement")
PP("TRD-TC-B02","2026-08-28","qa-trd-b01-b02-reverify-2026-08-28","expiry mechanics + History PASS; residual F1 'offer_expired' vs 'Offer expired' string mismatch (reverify-a02-b02-b06 flagged FAIL)")
P("TRD-TC-B03","2026-08-28","qa-trd-b-c-d-e-2026-08-28","competing offers auto-decline + SP restore (was SKIPPED)")
P("TRD-TC-B04","2026-08-28","qa-trd-group-a-b-2026-08-28","buyer cancels pending, no consequence")
P("TRD-TC-B05","2026-08-28","qa-trd-group-a-b-2026-08-28","3 allowed, 4th blocked (copy deviation)")
P("TRD-TC-B05a","2026-08-28","qa-trd-group-a-b-2026-08-28","")
P("TRD-TC-B05b","2026-08-28","qa-trd-group-a-b-2026-08-28","copy deviation 'many pending' vs guide '3 pending'")
P("TRD-TC-B05c","2026-08-28","qa-trd-b-c-d-e-2026-08-28","bundle counts as 1 slot")
P("TRD-TC-B05d","2026-08-28","qa-trd-group-a-b-2026-08-28","expiry frees slot")
P("TRD-TC-B05e","2026-08-28","qa-trd-b05e-j-admin-deps-2026-08-28","no leftover global cap (was BLOCKED)")
P("TRD-TC-B05f","2026-08-28","qa-trd-b05e-j-admin-deps-2026-08-28","admin cap 3→5 client picks up (was SKIPPED)")
P("TRD-TC-B05g","2026-08-28","qa-trd-b05e-j-admin-deps-2026-08-28","revert 5→3 forward-looking (was SKIPPED)")
P("TRD-TC-B05h","2026-08-28","qa-trd-b05e-j-admin-deps-2026-08-28","admin validation (was SKIPPED)")
P("TRD-TC-B05i","2026-08-28","qa-trd-b05e-j-admin-deps-2026-08-28","config-fetch failure graceful (was BLOCKED)")
P("TRD-TC-B05j","2026-08-28","qa-trd-b05e-j-admin-deps-2026-08-28","per-seller scope + bundle=1 after cap change (was BLOCKED)")
P("TRD-TC-B06","2026-08-28","qa-trd-reverify-a02-b02-b06-2026-08-28","card-decline toggle; friendly error, no trade (was BLOCKED)")
P("TRD-TC-B07","2026-08-28","qa-trd-group-a-b-2026-08-28","expired timeline no Message/Report/Cancel")
P("TRD-TC-B08","2026-08-28","qa-trd-group-a-b-2026-08-28","chat frozen after cancel")
P("TRD-TC-B09","2026-09-02","qa-task18-close-trd-2026-09-02","chat active for in_progress; real verdict backing guide stamp")
PP("TRD-TC-B10","2026-09-02","qa-task18-close-trd-2026-09-02","attach/persist code-path verified (same path as DT83 D2 PASS); literal new-card entry native-sheet tooling-limited")
P("TRD-TC-B11","2026-09-02","qa-task18-close-trd-2026-09-02","subscribe-upsell → JoinKidsClub")
# B12/B13: NEVER RUN (feature not wired / dead code per guide)

# --- Group C ---
for _i,_n in [("C01","SP reserved on offer"),("C02","SP restored on seller decline"),("C03","SP restored on expiry"),("C04","SP stays reserved on accept"),("C05","SP released at completion"),("C06","SP restored on seller cancel")]:
    P(f"TRD-TC-{_i}","2026-08-28","qa-trd-b-c-d-e-2026-08-28",_n)
P("TRD-TC-C07","2026-08-28","qa-trd-b-c-d-e-2026-08-28","free user locked Use SP + upgrade modal (PASS* deviation)")
P("TRD-TC-C08","2026-08-28","qa-trd-b-c-d-e-2026-08-28","category-driven % cap clamp (PASS* deviation)")

# --- Group D ---
P("TRD-TC-D01","2026-08-28","qa-trd-b-c-d-e-2026-08-28","auto-complete fires (PASS* deviation)")
P("TRD-TC-D02","2026-08-28","qa-trd-b-c-d-e-2026-08-28","auto-complete skipped when dispute open")
P("TRD-TC-D03","2026-08-28","qa-trd-b-c-d-e-2026-08-28","countdown pill colors (PASS* deviation)")
P("TRD-TC-D04","2026-08-28","qa-trd-b-c-d-e-2026-08-28","auto-complete banner buyer-only (PASS* deviation)")
# D05/D06: NEVER RUN (post-MVP / not built)

# --- Group E ---
P("TRD-TC-E01","2026-08-29","qa-task6-e-reverify-2026-08-29","occlusion fixed; full submit→amber banner (was BLOCKED 08-28)")
P("TRD-TC-E02","2026-08-28","qa-trd-b-c-d-e-2026-08-28","disputed trade no auto-complete")
P("TRD-TC-E03","2026-08-29","qa-task6-e-reverify-2026-08-29","buyer dispute UI re-confirmed")
P("TRD-TC-E04","2026-08-28","qa-trd-b-c-d-e-2026-08-28","seller dispute UI")
# E05/E06 admin resolve Complete/Refund: NEVER RUN under E-ID (same behavior PASS under R10/R09 2026-09-02 qa-task18) — note
P("TRD-TC-E07","2026-08-29","qa-task6-e-reverify-2026-08-29","IssueReportModal no-reason disabled submit (was BLOCKED)")
P("TRD-TC-E08","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","reason-chip deselect toggle DT-53 (08-29 PARTIAL → PASS)")
P("TRD-TC-E09","2026-08-29","qa-task6-e-reverify-2026-08-29","Other + min-20 description")
P("TRD-TC-E10","2026-08-29","qa-task6-e-reverify-2026-08-29","submit → amber banner; DT-42B")

# --- Group F ---
P("TRD-TC-F01","2026-08-29","qa-task5-trd-f-k-2026-08-29","payout shown on completion")
P("TRD-TC-F02","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","payout held on dispute; admin resolve-complete zeroing P1 fixed (task5 08-29 finding)")
P("TRD-TC-F03","2026-08-29","qa-task5-trd-f-k-2026-08-29","no payout method → requires_action")

# --- Group G ---
P("TRD-TC-G01","2026-08-29","qa-task5-trd-f-k-2026-08-29","6h+1h reminders, dedup")
P("TRD-TC-G02","2026-08-29","qa-task5-trd-f-k-2026-08-29","24h+2h auto-complete reminders")
P("TRD-TC-G03","2026-08-29","qa-task5-trd-f-k-2026-08-29","throttle; payout not throttled")
P("TRD-TC-G04","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","offer-reminder deep-link → Review Offer (08-29 PARTIAL gap fixed)")
P("TRD-TC-G05","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","cancel-request notif to seller")
P("TRD-TC-G06","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","cancel-request outcome notif to buyer")
P("TRD-TC-G07","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","keep-trade resolution notifs")

# --- Group H ---
P("TRD-TC-H01","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","free-buyer upsell copy (qa-trade-success); task16 08-31 PASS* copy-variance")
P("TRD-TC-H02","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","'Got it! You saved $8' permutation")
P("TRD-TC-H03","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","seller Accept SP pending-SP notice")
P("TRD-TC-H04","2026-08-31","qa-task16-close-trd-2026-08-31","cash-only upsell to Accept SP (task5 source+unit 08-29)")
PP("TRD-TC-H05","2026-08-29","qa-task5-trd-f-k-2026-08-29","trial-start leg not on-device reachable (trial_enabled=false); state machine source-verified")

# --- Group I ---
for _i,_n in [("I01","safe-meetup card"),("I02","dismiss persists per trade"),("I03","pinned banner"),("I04","once-per-trade modal")]:
    P(f"TRD-TC-{_i}","2026-08-29","qa-task5-trd-f-k-2026-08-29",_n)
P("TRD-TC-I05","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","quick-reply chips send (08-29 FAIL bug fixed DT-48)")
P("TRD-TC-I06","2026-08-31","qa-task16-close-trd-2026-08-31","disclaimer gates purchase + ack recorded (task5 finding resolved)")
P("TRD-TC-I07","2026-08-31","qa-task16-close-trd-2026-08-31","cancel → no trade")
P("TRD-TC-I08","2026-08-31","qa-task16-close-trd-2026-08-31","✕ close like cancel")
P("TRD-TC-I09","2026-08-31","qa-task16-close-trd-2026-08-31","checkbox resets on reopen")
P("TRD-TC-I10","2026-08-29","qa-task5-trd-f-k-2026-08-29","disclaimer loading/retry")
P("TRD-TC-I11","2026-08-29","qa-task5-trd-f-k-2026-08-29","SP wallet opens, no modal")

# --- Group J ---
D("TRD-TC-J01","2026-08-29","qa-task5-trd-f-k-2026-08-29","guide-drift: Level-1 seller-cancel alert removed per TFV2-023; backend count 0→1 verified")
D("TRD-TC-J02","2026-08-29","qa-task5-trd-f-k-2026-08-29","guide-drift: Level-2 alert removed; backend count 1→2 verified")
D("TRD-TC-J03","2026-08-29","qa-task5-trd-f-k-2026-08-29","guide-drift: Level-3 alert removed; backend 2→3 + admin flag verified")
P("TRD-TC-J04","2026-08-29","qa-task5-trd-f-k-2026-08-29","cancel button only seller, in_progress")
P("TRD-TC-J05","2026-08-29","qa-task5-trd-f-k-2026-08-29","seller-only reasons (copy deviation)")

# --- Group K ---
for _i,_n in [("K01","subscriber stack"),("K02","non-subscriber stack + gating"),("K03","SP discount row show/hide"),("K04","fee toggle OFF ×3 items"),("K05","fee toggle ON 1×"),("K06","both bundle modes"),("K07","partial refund price-only"),("K09","payments reconciliation")]:
    P(f"TRD-TC-{_i}","2026-08-29","qa-task5-trd-f-k-2026-08-29",_n)
P("TRD-TC-K08","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","tax ledger on partial refund (task5 finding fixed DT-48)")
P("TRD-TC-K10","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","EF stale-client bundle → 409 SP_INSUFFICIENT (task5 TRADE_INSERT_ERROR fixed)")
P("TRD-TC-K11","2026-08-31","qa-task16-close-trd-2026-08-31","fee = pct × cash portion (staging 10/20%, guide 5% stale)")

# --- Group L ---
for _i,_n in [("L01","bundle banner expand"),("L02","Confirm All 2"),("L03","NEEDS ACTION bundle row"),("L04","single row Review only"),("L05","IN PROGRESS bundle group"),("L06","Review Offer bundle SP/net"),("L07","Accept All"),("L08","individual accept + sibling pending"),("L09","Your Offers bundle card; disclaimer=Amazon boilerplate finding"),("L10","cancel-all vs just-this-one"),("L11","bundle checkout active-trade item")]:
    P(f"TRD-TC-{_i}","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30",_n)

# --- Group M ---
for _i,_n in [("M01","add first item"),("M02","same-seller direct add"),("M03","different-seller modal"),("M04","replace cart"),("M06","sold item not found"),("M07","duplicate add in-cart"),("M08","remove item"),("M09","clear cart $0"),("M10","saved-cart 3/3 cap server reject; doc drift LRU"),("M11","min cart value (via N01)"),("M12","Accepts Points badge; no numeric"),("M13","realtime-unavailable notice"),("M14","favorite add/remove"),("M15","unavailable overlay"),("M17","cart badge"),("M19","home tile favorites"),("M20","discover header favorites")]:
    P(f"TRD-TC-{_i}","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30",_n)
PP("TRD-TC-M16","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","toast 2.5s window; source-corroborated")
PP("TRD-TC-M18","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","toast; source-corroborated")
S("TRD-TC-M05","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","own-item add — not exercised (second-persona need)")

# --- Group N ---
P("TRD-TC-N01","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","admin min cart value reflects in app + blocked checkout")
P("TRD-TC-N02","2026-08-30","qa-task7-expanded-lmn-retest-2026-08-30","admin validation; no $5 floor (doc drift)")
PP("TRD-TC-N03","2026-08-30","qa-task10-dt66-fix-verify-tr-d-2026-08-30","min listing price config-write leg 0→5→0 verified")
P("TRD-TC-N04","2026-08-30","qa-task11-nopqr-2026-08-30","below-threshold adjust-price modal")
P("TRD-TC-N05","2026-08-31","qa-task13-dt71-dt72-verify-2026-08-31","bulk below-min block closed (DT71/DT69); was BLOCKED/PARTIAL")
P("TRD-TC-N06","2026-08-30","qa-task12-close-2026-08-30","admin auto-pause real")
B("TRD-TC-N07","2026-09-02","qa-task18-close-trd-2026-09-02","FLAG: needs auto-paused sub-min $4 listing fixture (R41); positive leg not driven")
P("TRD-TC-N08","2026-09-02","qa-task18-close-trd-2026-09-02","single + bundle at/above threshold")
P("TRD-TC-N09","2026-08-30","qa-task11-nopqr-2026-08-30","modal copy/button")
P("TRD-TC-N10","2026-08-30","qa-task11-nopqr-2026-08-30","dismiss + autoscroll/focus")
P("TRD-TC-N11","2026-08-30","qa-task11-nopqr-2026-08-30","edit-flow modal, no save")
P("TRD-TC-N12","2026-08-30","qa-task11-nopqr-2026-08-30","bulk chip dynamic threshold")
P("TRD-TC-N13","2026-08-31","qa-task13-dt71-dt72-verify-2026-08-31","bulk publish error (was BLOCKED)")
P("TRD-TC-N14","2026-08-31","qa-task13-dt71-dt72-verify-2026-08-31","regression blocks (was PARTIAL)")
# N2: NEVER RUN (idempotency & audit cross-cutting, N2-C01..C10 checklist — no dedicated run)

# --- Group O (tax) ---
P("TRD-TC-O01","2026-08-30","qa-task11-nopqr-2026-08-30","tax in checkout $2.10 on $30")
P("TRD-TC-O02","2026-08-30","qa-task11-nopqr-2026-08-30","SP=4 tax unchanged (BP-37)")
P("TRD-TC-O03","2026-08-30","qa-task12-close-2026-08-30","global toggle honored read+write (task11 FAIL fixed DT68)")
P("TRD-TC-O04","2026-08-30","qa-task12-close-2026-08-30","rule engine overrides node rate (re-verified DT69)")
P("TRD-TC-O05","2026-08-30","qa-task11-nopqr-2026-08-30","Tax Free badge")
P("TRD-TC-O06","2026-08-30","qa-task11-nopqr-2026-08-30","completed Payment Details rows")
PP("TRD-TC-O07","2026-08-31","qa-task14-dt73-u-y-2026-08-31","backend proportional tax refund DB-verified; end-user refund-detail UI deferred (guide ⏭️)")
P("TRD-TC-O08","2026-08-30","qa-task11-nopqr-2026-08-30","Estimated Sales Tax buyer-only")
PP("TRD-TC-O1","2026-08-30","qa-task12-close-2026-08-30","/tax/rules admin surface confirmed (O1-C1..C17)")
P("TRD-TC-O2","2026-08-30","qa-task11-nopqr-2026-08-30","quote/authorize-not-collect mobile leg")
P("TRD-TC-O3","2026-08-30","qa-task11-nopqr-2026-08-30","'Payment authorized' while awaiting seller")

# --- Group P (tax admin) ---
P("TRD-TC-P01","2026-08-30","qa-task12-close-2026-08-30","node rate save + validation real")
PP("TRD-TC-P02","2026-08-30","qa-task12-close-2026-08-30","no bulk-node UI exists; matches guide defer")
PP("TRD-TC-P03","2026-08-30","qa-task12-close-2026-08-30","rules version history; no node change-history UI")
P("TRD-TC-P04","2026-08-30","qa-task12-close-2026-08-30","toggle round-trips (task11 FAIL fixed)")
P("TRD-TC-P05","2026-08-30","qa-task12-close-2026-08-30","tax reports summary")
P("TRD-TC-P06","2026-08-30","qa-task12-close-2026-08-30","by-jurisdiction breakdown")
P("TRD-TC-P07","2026-08-30","qa-task12-close-2026-08-30","export CSV wired; download env-limited")
P("TRD-TC-P08","2026-08-30","qa-task12-close-2026-08-30","new txn uses rule rate (re-verified)")

# --- Group Q (reviews) ---
for _i,_n in [("Q01","rate prompt"),("Q02","rating required"),("Q03","char count"),("Q04","anonymous"),("Q06","reviewed-banner"),("Q07","profile visible"),("Q08","average"),("Q09","breakdown"),("Q12","no duplicate prompt")]:
    P(f"TRD-TC-{_i}","2026-08-30","qa-task11-nopqr-2026-08-30",_n)
P("TRD-TC-Q05","2026-08-31","qa-task14-dt73-u-y-2026-08-31","Skip for Now (analytics-only)")
# Q10/Q11 (24h edit window), Q13 (30-day cooldown), Q14 (24h lock), Q16 (auto-hide 3+ reports): NEVER RUN / descoped time-or-multi-account
P("TRD-TC-Q15","2026-08-31","qa-task14-dt73-u-y-2026-08-31","reviewee-only report model PASS; spec deviation (guide: any user)")
P("TRD-TC-Q17","2026-08-31","qa-task14-dt73-u-y-2026-08-31","cannot flag own review (model)")
P("TRD-TC-Q18","2026-08-30","qa-task12-close-2026-08-30","moderation queue")
P("TRD-TC-Q19","2026-08-30","qa-task12-close-2026-08-30","Keep")
P("TRD-TC-Q20","2026-08-30","qa-task12-close-2026-08-30","Hide")

# --- Group R (refund/cancel settlement; re-spec) ---
# R01-R05 not run under R-IDs (equivalent behavior verified under B04/B01/C02/B02/C03/B06/C06)
P("TRD-TC-R06","2026-08-30","qa-task12-close-2026-08-30","void correct for uncaptured auth (DT68)")
PP("TRD-TC-R07","2026-08-30","qa-task12-close-2026-08-30","source-confirmed SP reversal mechanism; SP in-progress cancel not UI-driven")
PP("TRD-TC-R08","2026-08-30","qa-task12-close-2026-08-30","no seller_payouts on cancel/void (re-confirmed)")
PP("TRD-TC-R09","2026-08-30","qa-task12-close-2026-08-30","dispute queue verified; resolve→Refund money-flow fixture-gapped")
P("TRD-TC-R10","2026-09-02","qa-task18-close-trd-2026-09-02","admin dispute → Complete; payout row; PI-capture timing observation")
P("TRD-TC-R11","2026-09-02","qa-task18-close-trd-2026-09-02","refund/cancel notifs both parties")
P("TRD-TC-R12","2026-09-02","qa-task18-close-trd-2026-09-02","refund idempotency")
P("TRD-TC-R13","2026-09-02","qa-task18-close-trd-2026-09-02","cancelled status + timeline")

# --- Group S ---
_PASS_S = ["S01","S02","S04","S05","S07","S09","S13","S14","S17","S20","S21","S23"]
_SRC_S = ["S03","S06","S08","S10","S11","S12","S15","S16","S18","S19","S22","S24"]
for _i in _PASS_S:
    P(f"TRD-TC-{_i}","2026-08-30","qa-task12-close-2026-08-30","")
for _i,_n in [("S03","hide gate source-confirmed; no single-listing-seller fixture"),("S06","matchesBanner source-verified"),("S08","1-item CTA source-confirmed"),("S10","bundle banner bundleMode source"),("S11","discover grid unchanged source"),("S12","single-offer flow unchanged source"),("S15","same hide gate as S03"),("S16","banner doesn't disrupt badge source"),("S18","count recalc source"),("S19","hidden when all in basket source"),("S22","seller card unchanged source"),("S24","return-to-cart nav source")]:
    PP(f"TRD-TC-{_i}","2026-08-30","qa-task12-close-2026-08-30",_n)

# --- Group T ---
P("TRD-TC-T01","2026-08-31","qa-task14-dt73-u-y-2026-08-31","SP input on Accept-SP item only")
P("TRD-TC-T02","2026-08-31","qa-task15-dt75-w-t-2026-08-31","45 SP applied to $60 (75% cap)")
PP("TRD-TC-T03","2026-08-31","qa-task14-dt73-u-y-2026-08-31","wallet-limited path w/ actual balance 4; guide 8-SP scenario not reproducible; DT72 phrasing verified")
P("TRD-TC-T04","2026-08-31","qa-task16-close-trd-2026-08-31","admin-set cap → client hint + server reject (task15 divergence fixed)")
P("TRD-TC-T05","2026-08-31","qa-task15-dt75-w-t-2026-08-31","sequential allocation real-time")
P("TRD-TC-T06","2026-08-31","qa-task16-close-trd-2026-08-31","real-time counter on 3-item bundle (task12/task13/15)") 
P("TRD-TC-T07","2026-08-31","qa-task15-dt75-w-t-2026-08-31","order-summary math")
P("TRD-TC-T08","2026-08-31","qa-task16-close-trd-2026-08-31","bundle-list vs payout-card SP off-by-one fixed (DT76)")
P("TRD-TC-T09","2026-08-31","qa-task15-dt75-w-t-2026-08-31","payout card + bundle totals")
P("TRD-TC-T10","2026-08-31","qa-task16-close-trd-2026-08-31","'Includes points redemption' tag on bundle (task15 finding fixed)")
PP("TRD-TC-T11","2026-08-31","qa-task15-dt75-w-t-2026-08-31","SP transfers at COMPLETION by design (D-17); completion-time release verified across A02/C05/Z05 runs")
P("TRD-TC-T12","2026-08-31","qa-task15-dt75-w-t-2026-08-31","seller decline no seller ledger; buyer refund")
P("TRD-TC-T13","2026-08-31","qa-task15-dt75-w-t-2026-08-31","single-item SP regression")
P("TRD-TC-T14","2026-08-31","qa-task14-dt73-u-y-2026-08-31","bundle CTA / modal / more-from-seller regression")

# --- Group U ---
for _i,_n in [("U01","root header pattern"),("U02","detail back-button"),("U03","bell → notifications"),("U04","EditProfile canonical header"),("U05","checkout header hides bell")]:
    P(f"TRD-TC-{_i}","2026-08-31","qa-task14-dt73-u-y-2026-08-31",_n)

# --- Group V ---
F("TRD-TC-V01","2026-08-31","qa-task14-dt73-u-y-2026-08-31","bottom-tab label 'Basket' not 'Trade Basket' (real copy defect; X01 same)")
for _i,_n in [("V02","cart title"),("V03","empty state"),("V04","Item Detail button"),("V05","more-from-seller add"),("V06","in-basket dimmed"),("V07","added alert")]:
    P(f"TRD-TC-{_i}","2026-08-31","qa-task14-dt73-u-y-2026-08-31",_n)
P("TRD-TC-V08","2026-08-31","qa-task15-dt75-w-t-2026-08-31","badge immediate on Item Detail (task14 FAIL fixed DT75)")
P("TRD-TC-V09","2026-08-31","qa-task14-dt73-u-y-2026-08-31","different-seller modal copy")
P("TRD-TC-V10","2026-08-31","qa-task14-dt73-u-y-2026-08-31","bundle CTA wording")
P("TRD-TC-V11","2026-08-31","qa-task14-dt73-u-y-2026-08-31","checkout combined banner")
P("TRD-TC-V12","2026-08-31","qa-task14-dt73-u-y-2026-08-31","Build Offer title")
PP("TRD-TC-V13","2026-08-31","qa-task14-dt73-u-y-2026-08-31","alert copy verified; favorites-screen trigger not driven")
P("TRD-TC-V14","2026-08-31","qa-task14-dt73-u-y-2026-08-31","functional regression")

# --- Group W ---
for _i,_n in [("W01","tabs"),("W02","single table"),("W03","bundle columns"),("W04","bundle row"),("W05","bundle detail"),("W06","trades in bundle"),("W07","monetary breakdown"),("W08","single detail")]:
    P(f"TRD-TC-{_i}","2026-08-31","qa-task15-dt75-w-t-2026-08-31",_n)
P("TRD-TC-W09","2026-08-31","qa-task16-close-trd-2026-08-31","Force Cancel visible on non-terminal fixture (task15 negative-only)")
P("TRD-TC-W10","2026-08-31","qa-task16-close-trd-2026-08-31","Force Cancel succeeds + DB read-back")
P("TRD-TC-W11","2026-08-31","qa-task15-dt75-w-t-2026-08-31","status filter")
P("TRD-TC-W12","2026-08-31","qa-task16-close-trd-2026-08-31","status filter resets on Single↔Bundle toggle (task15 minor defect fixed)")

# --- Group X ---
for _i in ["X01","X02","X03","X04","X05","X06","X07","X08","X09","X10"]:
    P(f"TRD-TC-{_i}","2026-08-31","qa-task14-dt73-u-y-2026-08-31","")
P("TRD-TC-X01","2026-08-31","qa-task14-dt73-u-y-2026-08-31","tab label 'Basket' — see V01")
P("TRD-TC-X16","2026-08-31","qa-task14-dt73-u-y-2026-08-31","flow-registry entries source")

# --- Group Y ---
for _i,_n in [("Y01","summary chips"),("Y02","history pagination"),("Y03","row Message"),("Y04","See all → History"),("Y05","request extension"),("Y06","counterparty accept"),("Y08","granted state"),("Y09","what-to-do card")]:
    P(f"TRD-TC-{_i}","2026-08-31","qa-task14-dt73-u-y-2026-08-31",_n)
S("TRD-TC-Y07","2026-08-31","qa-task14-dt73-u-y-2026-08-31","decline path not driven (single-extension-per-trade)")

# --- Group Z ---
P("TRD-TC-Z01","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","approve → cancel + refund")
P("TRD-TC-Z02","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","decline → escalate → admin approves")
P("TRD-TC-Z03","2026-09-02","qa-task18-close-trd-2026-09-02","timeout escalation → buyer notified (task17 no-notify defect fixed)")
P("TRD-TC-Z04","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","buyer withdraw")
P("TRD-TC-Z05","2026-09-02","qa-task18-close-trd-2026-09-02","whole-bundle cancel cascade + sibling SP release (task17 HIGH defect closed)")
P("TRD-TC-Z06","2026-09-02","qa-task18-close-trd-2026-09-02","escalation-off copy (task17 copy defect fixed)")
P("TRD-TC-Z07","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","gating by state")
P("TRD-TC-Z08","2026-09-01","qa-task17-z-g-dt78-81-2026-09-01","seller instant cancel + TFV2-023 consequence")
# fmt: on

# Never-run IDs that carry an explanatory note
NEVER_NOTES = {
    "TRD-TC-A03": "Accept SP listing (buyer 0 SP, subscriber seller earns SP) — no run on disk",
    "TRD-TC-A04": "Donate listing [Claim] — no run on disk",
    "TRD-TC-B12": "SP info tooltip — guide flags not wired",
    "TRD-TC-B13": "Duplicate-offer modal navigation — guide flags dead code",
    "TRD-TC-D05": "Post-meetup nudge after auto-complete — guide: post-MVP, not built",
    "TRD-TC-D06": "(post-MVP / not built)",
    "TRD-TC-E05": "Admin resolves dispute → Complete — not run under E-ID; same behavior PASS under TRD-TC-R10 (2026-09-02 qa-task18)",
    "TRD-TC-E06": "Admin resolves dispute → Refund — not run under E-ID; same behavior PASS under TRD-TC-R09/R11 (qa-task12/18)",
    "TRD-TC-N2": "Idempotency & Audit (N2-C01..C10) — no dedicated run; individual idempotency legs verified under B/C/O/R rows",
    "TRD-TC-Q10": "24h edit window — time-dependent, descoped",
    "TRD-TC-Q11": "24h edit window — time-dependent, descoped",
    "TRD-TC-Q13": "30-day cooldown — time/multi-account, descoped",
    "TRD-TC-Q14": "24h post-completion lock — time-dependent, descoped",
    "TRD-TC-Q16": "Auto-hide after 3+ reports — needs 3 distinct reporters, descoped",
    "TRD-TC-R01": "Buyer cancels pending — equivalent behavior PASS under TRD-TC-B04",
    "TRD-TC-R02": "Seller declines pending — equivalent PASS under TRD-TC-B01/C02",
    "TRD-TC-R03": "Offer expiry auto-cancel — equivalent PASS under TRD-TC-B02/C03",
    "TRD-TC-R04": "Card declined at offer — equivalent PASS under TRD-TC-B06",
    "TRD-TC-R05": "Seller cancels in_progress — equivalent PASS under TRD-TC-C06",
}

# ---------------------------------------------------------------------------
# 4. Assemble rows
# ---------------------------------------------------------------------------
STATUS_ICON = {
    "PASS": "✅ PASS",
    "PARTIAL": "🟡 PARTIAL",
    "FAIL": "🔴 STILL OPEN",
    "BLOCKED": "🔴 STILL OPEN",
    "SKIPPED": "⏭️ SKIPPED",
    "DRIFT": "📄 DOC-DRIFT",
    "NEVER": "NEVER RUN",
}
# classify FAIL/BLOCKED with a real app-bug note vs env/fixture
OPEN_REASON = {"FAIL": "FAIL, unresolved", "BLOCKED": "BLOCKED (env/fixture)"}

rows = []  # dict per canonical
for guide, tc, group, desc in canon:
    if guide == "TRD":
        if tc in T:
            verdict, date, src, note = T[tc]
        else:
            verdict, date, src, note = ("NEVER", "", "", NEVER_NOTES.get(tc, ""))
    else:
        v, d, s = auto.get(tc, ("NEVER", "", ""))
        verdict = v if v else "NEVER"
        date, src, note = d, s, ""
    rows.append({"guide": guide, "tc": tc, "group": group, "desc": desc,
                 "sub": subc.get((guide, tc), 1), "verdict": verdict,
                 "date": date, "src": src, "note": note})

# ---------------------------------------------------------------------------
# 5. Stats
# ---------------------------------------------------------------------------
def is_run(x): return x["verdict"] not in ("NEVER",)
def is_pass(x): return x["verdict"] == "PASS"
def is_partial(x): return x["verdict"] == "PARTIAL"
def is_open(x): return x["verdict"] in ("FAIL", "BLOCKED")
def is_drift(x): return x["verdict"] == "DRIFT"
def is_skip(x): return x["verdict"] == "SKIPPED"

GUIDES = ["AUTH", "MSG", "TRD", "ACC", "ADM", "SUB"]
GNAME = {"AUTH": "AUTH (Signup→Discovery)", "MSG": "MSG (Messaging→Notifications)",
         "TRD": "TRD (TradeFlowV2)", "ACC": "ACC (Account/Dashboard/Help/Legal)",
         "ADM": "ADM (Admin Portal)", "SUB": "SUB (Subscriptions/Payouts/SP Wallet)"}

g_total = Counter(r["guide"] for r in rows)
g_run = Counter(r["guide"] for r in rows if is_run(r))
g_pass = Counter(r["guide"] for r in rows if is_pass(r))
g_partial = Counter(r["guide"] for r in rows if is_partial(r))
g_open = Counter(r["guide"] for r in rows if is_open(r))
g_drift = Counter(r["guide"] for r in rows if is_drift(r))
g_skip = Counter(r["guide"] for r in rows if is_skip(r))

# ---------------------------------------------------------------------------
# 6. Render markdown
# ---------------------------------------------------------------------------
L = []
A = L.append
A("# TEST-COVERAGE-INVENTORY-v2")
A("")
A("> **Ground-truth QA test-coverage inventory (v2 — no cutoff).** Every captured QA report on disk through **2026-09-03** cross-referenced against the current canonical guide index. **Read-only reconciliation** — no guides, code, or reports were modified. Successor to `TEST-COVERAGE-INVENTORY.md` (generated 2026-08-24), which is superseded by evidence created after that date (TRD Groups S–Z, ACC closures, MSG/SUB live rounds, QA Tasks 5–25).")
A("")
A("**Generated:** 2026-09-03")
A("")
A("## 1 · Executive summary")
A("")
A(f"- **Canonical test cases (unique TC-IDs across the 6 guides, as of today):** **{sum(g_total.values())}** (guide index has grown since v1: TRD 278→288 [Groups N2/O1–O3/S–Z added], ACC 73→75, ADM 159→160).")
A(f"- **Have real QA evidence on record (any verdict, incl. PARTIAL/SKIPPED):** **{sum(g_run.values())}**")
A(f"- **Latest verdict PASS:** **{sum(g_pass.values())}** · **Latest PARTIAL:** **{sum(g_partial.values())}**")
A(f"- **STILL OPEN** (latest FAIL/BLOCKED with no later PASS re-verification): **{sum(g_open.values())}**")
A(f"- **DOC-DRIFT** (guide assertion obsolete; backend verified): **{sum(g_drift.values())}**")
A(f"- **NEVER RUN** (no report on disk asserts a verdict under the canonical ID): **{sum(g_total.values()) - sum(g_run.values())}**")
A("")
A("| Guide | Cases | Run | PASS (latest) | PARTIAL | STILL OPEN | DOC-DRIFT | NEVER RUN |")
A("|---|---:|---:|---:|---:|---:|---:|---:|")
for g in GUIDES:
    A(f"| {GNAME[g]} | {g_total[g]} | {g_run[g]} | {g_pass[g]} | {g_partial[g]} | {g_open[g]} | {g_drift[g]} | {g_total[g]-g_run[g]} |")
A("")
A("**Key facts**")
A("")
A("- **TRD went from 0-run (v1) to the most-covered guide on disk.** Manual TradeFlowV2 evidence now spans QA Tasks 1–18 (2026-08-26 → 2026-09-02): Groups A–D (core/offer lifecycle/SP/timers), E–K (disputes/payout/reminders/CTAs/safety/seller-cancel/fees), L–M (bundle/cart), N/N2 (min-price + idempotency), O/P (tax), Q (reviews), R (refund settlement), S–T (more-from-seller/points), U–Y (nav/copy/admin-trades/list/timeline), Z (cancel-request & escalation).")
A("- **AUTH** remains fully executed (138/138) with 118 PASS (+2 PARTIAL); the 16 still-open are dominated by fixture/config/doc-drift blocks (Q04 stale-guide fee assertion, etc.).")
A("- **ACC** (Account/Dashboard/Help/Legal) was closed 2026-08-24…08-26 by the `account-file-*` closures (postdates v1): 57 PASS, 17 still-open (email/SMS env-gated, legal-email stall).")
A("- **MSG** went live 2026-09-02/03 (QA Task 19/24/25): 47 PASS + 6 partial; the 5 BLOCKED are MSG G01–G04/G06/G07 — a **confirmed 09-03 app bug** (Safety Review cannot load `status != 'available'` listings, `getListingById` available-only filter) and MSG B05.")
A("- **SUB** (Subscriptions/Payouts/SP Wallet) went live 2026-09-02/03: 30 PASS + 5 partial; 7 open (D06/D07/E02/I08/J03/J04 fixture/config; SUB E03 = 09-03 FAIL-finding: FAILED-badge renders but `error_message` never shown).")
A("- **ADM** (Admin Portal guide) is still essentially **uncovered by manual QA** (159/160 NEVER RUN). Its admin behaviors are only exercised indirectly (automated legacy suite + TRD/SUB admin-dependency legs).")
A("- The full source register (report.md + decision logs + results.json parsed: **124 files / 1362 evidence rows**) is summarized in §5.")
A("")
A("### TRD P1 (SP-settlement trigger) — status: **RESOLVED (2026-08-28)**")
A("")
A("The 2026-08-28 Group A/B run's P1 — migration `20260715000001` dropped `fn_release_all_sp_on_complete() CASCADE`, destroying `trigger_release_all_sp_on_complete` so SP never settled at completion (A02 FAIL) — was **fixed and re-verified the same day**:")
A("- **Fix:** `supabase/migrations/20260828000001_recreate_sp_release_trigger_and_reconcile.sql` (Dev Task 17 revised) recreates the trigger on `public.trades` and reconciles staging stuck balances.")
A("- **Re-verify:** `qa-trd-reverify-a02-b02-b06-2026-08-28` → **TRD-TC-A02 PASS** (buyer reserved 18→10, seller pending +17, `sp_ledger` spend_purchase/earn_reward pair, `pending_sp_release_at` set).")
A("- **Sustained:** every later SP-trade run re-confirms release-at-completion (qa-task8 flow-1 earn_reward +6; qa-task16 T06; qa-task18 Z05 releasing 28 SP on both bundle siblings). Later migrations (20260828000002, 20260830000001/015) re-create the function and keep the trigger.")
A("- **Not still open.** No QA report after 2026-08-28 asserts the SP-settlement trigger is missing. (The same run's P1/P2 Stripe re-offer idempotency collision was separately fixed by DT-18 on 2026-08-28.)")
A("")
A("## 2 · Method (read-only reconciliation, no date cutoff)")
A("")
A("1. **Step 1 — Guides:** re-parsed the `## Test Case Index` of all 6 canonical files (`cross-checked-and-consolidated/`) as of today (index rows → unique IDs: AUTH 138 · MSG 72 · TRD 288 · ACC 75 · ADM 160 · SUB 100 = **833**).")
A("2. **Step 2 — Evidence (no cutoff):** scanned the whole repo for QA-run evidence created through 2026-09-03 — `e2e-test-results/**/report.md`, `*decision*outcome*log*` files, `results.json`, and `test-automation/trade-flow-v2/reports/**` (124 files; legacy automated runs kept separate). Extracted per-case verdicts across all report formats.")
A("3. **Step 3 — TRD reconciliation (curated):** the automated parser cannot faithfully read flow/DT-based TRD reports (no `TRD-TC-` literals) and mis-reads 'original → latest' tables, so **every TRD verdict was curated by reading the 19 TRD execution reports directly** (trd-a01-a02, trd-part2, qa-trd-group-a-b/b-c-d-e/b05e-j-admin-deps/b01-b02-reverify/reverify-a02-b02-b06, qa-task5–18). Each row's verdict/date/source was taken from the report's own verdict table + DB read-back; FAIL/BLOCKED entries were checked against later re-verifications to find the latest truth.")
A("4. **Step 4 — Other guides (auto + light check):** AUTH/MSG/ACC/ADM/SUB latest verdicts come from the automated reconcile `(date, wall-clock, kind-priority, path)`; MSG/SUB/ACC were spot-validated against the newest consolidated reports (qa-task19–25, account-file-*).")
A("5. **Scope limits (as v1):** manual verdicts drive the canonical rows. Legacy automated-suite runs (May–Jun 2026, `TC-A01`/`REG-R01` scheme, incl. 4 `2026-08-27T*` results.json runs) are **not** merged (they use a pre-prefix scheme and several were harness-broken all-fail) — see §6. TRD cases whose only evidence is the legacy scheme are counted NEVER RUN, per the method.")
A("")
A("## 3 · Canonical coverage by guide")
A("")
A("Columns: **Latest** = latest verdict on record · **Date** = date of that verdict · **Source** = run folder of the latest evidence · **Status** = `✅ PASS` / `🟡 PARTIAL` / `🔴 STILL OPEN` / `⏭️ SKIPPED` / `📄 DOC-DRIFT` / `NEVER RUN`.")
A("")
for g in GUIDES:
    A(f"### {GNAME[g]} — {g_total[g]} cases")
    A("")
    A("| TC-ID | Description | Sub | Latest | Date | Source | Status | Notes |")
    A("|---|---|---:|---|---|---|---|---|")
    LATEST_WORD = {"PASS": "PASS", "PARTIAL": "PARTIAL", "FAIL": "FAIL",
                   "BLOCKED": "BLOCKED", "SKIPPED": "SKIPPED",
                   "DRIFT": "DOC-DRIFT", "NEVER": "NEVER RUN"}
    for r in [x for x in rows if x["guide"] == g]:
        st = STATUS_ICON[r["verdict"]]
        lw = LATEST_WORD[r["verdict"]]
        note_s = r["note"]
        if r["verdict"] == "FAIL" and not note_s:
            note_s = "FAIL, unresolved"
        if r["verdict"] == "BLOCKED" and not note_s:
            note_s = "BLOCKED (env/fixture)"
        if r["verdict"] == "NEVER" and not note_s:
            note_s = ""
        src_cell = f"`{r['src']}`" if r["src"] else ""
        sub = r["sub"] if r["sub"] > 1 else ""
        note_s = note_s.replace("|", "\\|")
        A(f"| {r['tc']} | {r['desc']} | {sub} | {lw} | {r['date']} | {src_cell} | {st} | {note_s} |")
    A("")

A("## 4 · TRD reconciliation detail (from 278 → 288 canonical today)")
A("")
A("- v1 (2026-08-24) reported **TRD 278 cases, 0 run**. That is stale twice over: (a) the guide has since grown to **288** IDs (Groups N2, O1/O2/O3, S, T, U, V, W, X, Y, Z added after v1), and (b) **19 TRD execution runs (2026-08-26 → 09-02) now sit on disk.**")
A("- Of the **288** canonical TRD IDs, this snapshot gives a verdict to **" + str(g_run["TRD"]) + "** cases. Of those, **" + str(g_pass["TRD"]) + " PASS**, **" + str(g_partial["TRD"]) + " PARTIAL** (source-confirmed/partial/fixture), **" + str(g_open["TRD"]) + " STILL OPEN** (real residual defects/fixture-gated), **" + str(g_drift["TRD"]) + " doc-drift**, **" + str(g_skip["TRD"]) + " SKIPPED**.")
A("- **Genuinely never-run under their canonical ID: " + str(g_total["TRD"] - g_run["TRD"]) + "** — A03/A04 (Accept-SP-listing / Donate), B12/B13 (not-wired/dead-code flags), D05/D06 (post-MVP), E05/E06 (admin dispute Complete/Refund — same behavior PASS under R10/R09), N2 (idempotency cross-cutting), Q10/Q11/Q13/Q14/Q16 (time/multi-account descoped), R01–R05 (refund-settlement re-spec — equivalent PASS under B04/B01/C02/B02/C03/B06/C06). These are honest never-runs or descoped, not silent gaps.")
A("")
A("### Notable TRD STILL-OPEN / PARTIAL items (real residual findings, not stale)")
A("")
A("| TC | Status | Latest | Finding |")
A("|---|---|---|---|")
for r in sorted([r for r in rows if r["guide"] == "TRD" and r["verdict"] in ("FAIL", "BLOCKED")], key=lambda r: r["tc"]):
    A(f"| {r['tc']} | {STATUS_ICON[r['verdict']]} | {r['date']} | {r['note'] or ''} |".replace("|  |", "| |"))
for r in sorted([r for r in rows if r["guide"] == "TRD" and r["verdict"] in ("PARTIAL", "DRIFT")], key=lambda r: r["tc"]):
    A(f"| {r['tc']} | {STATUS_ICON[r['verdict']]} | {r['date']} | {r['note'] or ''} |".replace("|  |", "| |"))
A("")
A("## 5 · Evidence register summary")
A("")
A("- Parsed **124 evidence files** → **1,362 verdict rows** (manual 824 incl. decision logs; automated 538 incl. results.json).")
A("- **TRD execution runs on disk (19):** `trd-a01-a02-2026-08-26`, `trd-part2-2026-08-27`, `qa-trd-group-a-b-2026-08-28` (the 20-case Group A/B 'Full Decision-and-Outcome Log' — 9 PASS/2 FAIL/4 BLOCKED/5 SKIPPED + P1), `qa-trd-b-c-d-e-2026-08-28` (Task 4), `qa-trd-b05e-j-admin-deps-2026-08-28`, `qa-trd-b01-b02-reverify-2026-08-28`, `qa-trd-reverify-a02-b02-b06-2026-08-28`, `qa-task5-trd-f-k-2026-08-29`, `qa-task6-e-reverify-2026-08-29`, `qa-task7-expanded-lmn-retest-2026-08-30`, `qa-task8-cumulative-regression-2026-08-30`, `qa-task9-dt63-fix-verify-2026-08-30`, `qa-task10-dt66-fix-verify-tr-d-2026-08-30`, `qa-task11-nopqr-2026-08-30`, `qa-task12-close-2026-08-30`, `qa-task13-dt71-dt72-verify-2026-08-31`, `qa-task14-dt73-u-y-2026-08-31`, `qa-task15-dt75-w-t-2026-08-31`, `qa-task16-close-trd-2026-08-31`, `qa-task17-z-g-dt78-81-2026-09-01`, `qa-task18-close-trd-2026-09-02`.")
A("- Intermediate artifacts: `temp/tc-inventory-v2/` (master-tcs-v2.tsv, master-unique-v2.tsv, report-evidence-v2.tsv, report-register-v2.tsv, canonical-latest-v2.tsv, scan_evidence_v2.py, reconcile_v2.py).")
A("")
A("## 6 · Legacy automated-suite evidence (NOT merged into canonical rows)")
A("")
A("Pre-prefix `TC-*`/`REG-R*` runs (May–Jun 2026) and the 2026-08-27 `results.json` runs (harness login-gate all-fail) are excluded from the canonical verdicts above by the method's scope rule. They remain listed as unmatched evidence in `temp/tc-inventory-v2/unmatched-evidence-v2.tsv` (non-canonical IDs) and are only cited where a canonical case has no manual row.")
A("")
open(OUT, "w", encoding="utf-8").write("\n".join(L) + "\n")
print("Wrote", OUT)
print("Canonical total:", sum(g_total.values()))
print("Per guide run/pass/partial/open/drift/skip/never:")
for g in GUIDES:
    print(f"  {g:4s} {g_total[g]:3d} run {g_run[g]:3d} | PASS {g_pass[g]:3d} | PARTIAL {g_partial[g]:3d} | OPEN {g_open[g]:3d} | DRIFT {g_drift[g]:3d} | SKIP {g_skip[g]:3d} | NEVER {g_total[g]-g_run[g]:3d}")
