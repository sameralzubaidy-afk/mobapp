# QA Task 31-T v2 — Ledger (per-case verdicts)

**Run:** 2026-09-04 · Folder: `qa-task31t-dt111-adm-2026-09-04/` · Rules ADM-R1–R6, R55, R53, R52, R56/R57, R54.

## Batch 0 — Dev Task 111 live verification

| Dev Task 111 item | Verdict | Evidence anchor |
|---|---|---|
| Item 1+7 — Admin Resume + gentle unavailable copy | ✅ PASS | Pause→Resume on `185546da` (DB + audit); paused drawer shows Resume/Pause hidden; mobile buyer: paused→"This item is no longer available", resumed→loads+Request to Buy, invalid id→"Listing not found"; no duplicate Listing-Approved notification (count unchanged) |
| Item 2 — FG-1 in-progress-trade fixture | 🟡 PARTIAL | create/dispute-open/reset clean + node_id auto-pop (item+trade) = E06 step-3 evidence; **`--with-auto-complete`/`--dry-run` dead (hasFlag double-dash bug)** → Finding #3 |
| Item 3 — r41-moderation reset bug fix | ✅ PASS | apply(flagged+cpsc_recall)→reset: no `.catch` error, item_safety_flags actually deleted, item restored available/cleared |
| Item 4 — FG-2 reported-review fixture + first real Q-group commit | ✅ PASS | Q02 Hide + Q03 Keep first real executions (confirm copy matches guide; DB hidden/reviewed; mobile profile 6→5→6 reviews). Reset residue finding (#4, orphan `0253b2cb`) |
| Item 6 — WalletWarningBanner token remap | ✅ PASS | frozen `#5B8FB9`/`#EBF4F9`, suspended `#E85D75`/`#FFF0F2`, grace `#FFA726`/`#FFF3E0`, active no banner (pixel-scanned) |

## Batch 1 — ADM never-run closure

| TC-ID | Verdict | Status in tracker |
|---|---|---|
| ADM-TC-B03 | BLOCKED (ADM-R3 prompt()) | Remains NEVER RUN (3) |
| ADM-TC-B06 | BLOCKED (ADM-R3 prompt()) | Remains NEVER RUN (3) |
| ADM-TC-B07 | BLOCKED (ADM-R3 prompt()) | Remains NEVER RUN (3) |
| ADM-TC-C11 | ✅ PASS | Completed |
| ADM-TC-C12 | 🟡 PARTIAL | Completed (category/seller filters degraded — Finding #1) |
| ADM-TC-E06 | ✅ PASS | Completed (N6 residual finding #7) |
| ADM-TC-E07 | ✅ PASS | Completed |
| ADM-TC-F11 | ✅ PASS | Completed |
| ADM-TC-K03 | ✅ PASS | Completed |
| ADM-TC-L07 | 🟡 PARTIAL | Completed (mobile SP-disabled gap — Finding #2) |
| ADM-TC-M01 | ✅ PASS | Completed |
| ADM-TC-L08 | ✅ PASS | Completed (QA31-M mobile leg + QA31-T token/color re-verify) — moved this round |

## Roll-up
Batch 0: 4 PASS · 1 PARTIAL. Batch 1: 6 PASS · 2 PARTIAL · 3 BLOCKED (recorded). Overall 10 PASS · 3 PARTIAL · 3 BLOCKED.
Tracker ADM: Remaining 12 → 3; PASS 123 → 130; PARTIAL 23 → 25 (R52/R56/R57 reconciled: 160 = 130+25+1+1 completed + 3 remaining).

## Findings
1. P1/P2 — `admin_search_listings_v2` 5-arg regression (DT97) → category/seller filters client-side-only (Toys 9 vs 1078 DB; seller 20 vs 274 DB).
2. P2 — TradeOfferScreen SP input not disabled when wallet frozen (only banner).
3. P2 — hasFlag double-dash bug (all 9 fixture scripts; `--dry-run`/`--with-auto-complete`/`--force`/`--keep`/`--remove` dead).
4. P3 — qa:r41-review reset strands the disposable item → orphan `0253b2cb` (dev cleanup).
5. LOW — Paused missing from /listings status dropdown (439 paused exist).
6. LOW — "QA T31 Disc Node" status/is_active mismatch.
7. LOW — N6 NULL-node residual where actor has a node (358 items etc.) — reconcile.
8. LOW — /subscriptions/manage grace Save writes updated_by=null.
