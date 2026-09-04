# QA Task 31b — Repo Reconciliation Audit (Read-Only)

**Date:** 2026-09-04
**Mode:** Document audit only — no test execution, no fixture building, no config/SQL writes, no tracker edits.
**Object audited:** `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (the aggregate tracker) against its own six per-guide blocks and the six canonical guides under `cross-checked-and-consolidated/`.
**Method:** Full read of the 1101-line tracker + verified row counts via read-only `grep -c` on the exact file (per-guide totals, per-glyph completed-row counts, never-run row counts, per-ID multiplicity). No external tracking log used.

---

## 1 · Source-of-truth answer (task item 7)

- **`QA-TESTCASE-STATUS-2026-09-03.md` is the single aggregate tracker.** No newer aggregate file exists anywhere in the repo (`file_search **/QA-TESTCASE-STATUS*.md` → 1 hit).
- **It is being maintained in place, but is internally stale.** The header says "Generated: 2026-09-03" and the **top "1 · Per-guide roll-up" table (lines 18–30) was never refreshed** after QA Task 28/30/31 wrote newer verdicts into the per-guide blocks below. Net effect: the top table reflects 2026-09-03 for every guide, while the MSG and ADM per-guide sections carry 2026-09-04 state. AUTH/TRD/ACC/SUB top-table rows still match their sections.
- **Freshest per-case detail lives outside this file**, in the per-run folders (referenced by the tracker's `Source` column):
  - `e2e-test-results/qa-task31-adm-near-total-2026-09-04/report.md` + `ledger.md` (its "Mobile-impact coverage assessment" table is authoritative for the ADM mobile-leg-owed set)
  - `e2e-test-results/qa-task29-adm-first-live-2026-09-04/ledger-FULL-160.md` (the per-case ADM ledger for QA Task 29's ~88)
  - `e2e-test-results/qa-task30-adm-moderation-msg-y-2026-09-04/`
- **Conclusion:** the tracker file is still the current aggregate source of truth, but for scoping QA Task 32 (SUB) and the rest of QA Task 31 (ADM) it must be read **per-guide-block**, not from the top roll-up; and the ADM "Remaining (159)" table must NOT be read as the outstanding set (see §5).

---

## 2 · Per-guide honest counts — straight from the file

Counts below are glyph-row counts of the per-guide **"Completed test cases"** blocks (`grep -c '^\| <PREFIX>-TC-…\| <glyph>'` on the file) plus the per-guide never-run tables. Completed-block glyph counts reconcile exactly to each guide's full case count (completed + remaining), so the per-case detail supports the numbers — except where the header tables disagree (flagged).

| Guide | File cases | ✅ PASS | 🟡 PARTIAL | 🔴 OPEN | 📄 DRIFT | ⏭️ SKIP | Remaining (never-run) | Completed rows = case count? |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| **AUTH** | 138 | 118 | 2 | 16 | 0 | 2 | 0 | 138 = 138 ✅ |
| **MSG** | 72 | 64 | 4 | 2 | 2 | 0 | 0 | 72 = 72 ✅ |
| **TRD** | 288 | 234 | 28 | 2 | 3 | 2 | 19 | 269 + 19 = 288 ✅ |
| **ACC** | 75 | 57 | 0 | 17 | 0 | 1 | 0 | 75 = 75 ✅ |
| **ADM** | 160 | *see §2.1* | *see §2.1* | 1 | 1 | 1 | *see §2.1* | ❌ broken (see §5) |
| **SUB** | 100 | 45 | 2 | 3 | 0 | 0 | 50 | 50 + 50 = 100 ✅ |

**Counted from:** the per-guide completed-case row tables (per-case detail). AUTH/TRD/ACC/MSG/SUB glyph counts were verified with `grep -c` and match their own section-block header numbers exactly.

### 2.1 · ADM — the three in-file representations disagree (which table I counted from)

The ADM section (lines 655–986) contains **three mutually inconsistent representations**:

1. **Top roll-up row** (line ~25, 2026-09-03 snapshot): PASS 72 · PARTIAL 8 · OPEN 7 · DRIFT 0 · SKIP 1 · **Remaining 72**. ❌ stale — predates QA Task 29/30/31.
2. **ADM section header** (line ~656, QA Task 29-era, approximate): **PASS ~137 · PARTIAL ~15 · FAIL/OPEN 1 · DOC-DRIFT 1 · SKIPPED 1 · Remaining ~10**. ❌ approximate (tilde) values and does **not** sum to 160 (~137+15+1+1+1+10 ≈ 165).
3. **Actual completed-case rows** (the block below, updated through QA Task 31): **153 glyph rows = 132 PASS · 18 PARTIAL · 1 OPEN (L02 FAIL) · 1 DRIFT (B04, superseded) · 1 SKIP (S03)**. Of the 153, **4 are duplicate/superseded repeats of the same ID** (B04, C05, R01, R02 each appear twice as completed) → **~149 distinct IDs have a verdict row**.

The honest ADM count is therefore **from the completed-case rows** (153 rows / ~149 distinct IDs executed-with-verdict), **not** from either header. The remaining-table (159 rows) is fully stale (§5.6).

### 2.2 · What the executed/never-run split really is for ADM (per §6)

- Distinct IDs with a verdict row: **~149** (incl. 1 OPEN-FAIL L02, 18 PARTIAL, 1 SKIP).
- Distinct IDs in the stale 159-table with **no completed row on record**: **19** (§6 lists them) — this is the true "never run in this tracker" count, i.e. **141 of the 159 "remaining" rows are already executed** and still sitting in the remaining table.

---

## 3 · Roll-up vs per-case-detail cross-check (task item 3)

| Guide | Does per-case detail support roll-up? | Notes |
|---|---|---|
| AUTH | ✅ Yes | 118/2/16/0/2/0 matches both top table and section block; 138 rows sum to 138. |
| MSG | ⚠️ Section block only | Section block (64/4/2/2/0/0 = 72 rows) matches the rows. **Top table (63/2/…/Rem 3) is stale** — QA Task 28/30 closed the last 3 never-run (G05/G08/G09). |
| TRD | ✅ Yes | 234/28/2/3/2 + 19 never-run = 288; all three representations agree. |
| ACC | ✅ Yes | 57/0/17/0/1 + 0 = 75; agrees. |
| ADM | ❌ No (see §2.1/§5) | Completed rows (132 PASS/18 PARTIAL) contradict top table (72/8); section header approximate. |
| SUB | ✅ Yes | 45/2/3/0/0 + 50 = 100; top table and section agree. The never-run table's own header "(51)" is off by one vs its 50 actual rows. |

**Net:** only **MSG (top table)** and **ADM (all three views)** have genuine roll-up↔detail drift.

---

## 4 · Guide-vs-tracker canonical-count deltas (additional finding)

Canonical case counts in the tracker (AUTH 138, MSG 72, …) match each guide's **Test Case Index**. However, guide bodies contain `###` case headings **outside the canonical index** that the tracker never tracks:

- **AUTH guide** has **Group R (AUTH-TC-R01…R06)** — regression anchors (auth boundary integrity, session-restore-no-loop, node-assignment consistency, pending-never-leaks, discovery isolation, free-vs-subscriber gating) — plus **AUTH-TC-ACC-01…06** (accessibility-identifier checks, incl. "widget tests still pass"), all present as `###` case sections (lines 2272–2374) but absent from the index and from the tracker. Whether these are owed as executable QA cases is a scope question for the owner, not an execution finding.
- Same class likely exists in other guides (spot-check only AUTH was done here). Recommend confirming the canonical set against each guide's **Test Case Index** before treating "Remaining = 0" as "guide fully covered".

---

## 5 · Discrepancy list (task items 6 + the QA Task 29 pruning flag)

1. **Top "Per-guide roll-up" table (lines 18–30) is stale for MSG and ADM** — MSG row (PASS 63/PARTIAL 2/Rem 3) vs its own section block (PASS 64/PARTIAL 4/Rem 0); ADM row (PASS 72/…/Rem 72) vs its completed block (132 PASS/…). AUTH/TRD/ACC/SUB rows are still accurate.
2. **ADM section header is approximate and over-sums** (line ~656): "PASS ~137 · PARTIAL ~15 · FAIL/OPEN 1 · DOC-DRIFT 1 · SKIPPED 1 · Remaining ~10" — tilde values, sums to ~165 ≠ 160. The only other in-file ADM header uses exact integers (the stale top row). A future maintenance pass should make one canonical exact integer set.
3. **ADM "Remaining test cases — NEVER RUN (159)" table is stale/superseded — NOT pruned** (this is the exact pruning QA Task 29 flagged). It still lists ~141 IDs that now have completed rows (incl. A01–A06, B01/B02/B04/B05/B08, C01–C10, D01–D11, E01–E05/E08, F01–F10, G01–G04, H01–H04/H06, I01–I05, …). Reading it as the outstanding set over-reports remaining by ~141.
4. **ADM duplicate completed rows — same ID, two verdicts** (each appears 2× in the completed block):
   - `ADM-TC-B04` — a 📄 DOC-DRIFT row (QA Task 30) **and** a ✅ PASS row (QA Task 31). The DRIFT is superseded (actual surface = `/sp-wallet`, verified live) → effective current ADM DRIFT = **0**, but the header still says DRIFT 1.
   - `ADM-TC-C05` — two ✅ PASS rows (QA Task 30 + QA Task 31; same verdict).
   - `ADM-TC-R01` — two ✅ PASS rows with **conflicting case meanings**: QA Task 29's "Session persists across pages" vs QA Task 31's correct "Education sections/examples/analytics". QA Task 29 mislabeled its reliability/session rows under the guide's Education R-IDs.
   - `ADM-TC-R02` — same conflict: QA Task 29 "Confirm destructive/financial" vs QA Task 31 "FAQ management".
   - Consequence: QA Task 29's R01/R02/R05 (session-persists / confirm-destructive / auditable-actions) use a **non-canonical R taxonomy** — R05 has no counterpart in the 159-table (which lists only R01–R03). Resolve by renaming QA Task 29's rows (e.g. to an R04/R05/R06 reliability set or another letter) or annotate.
5. **ADM N2-family representation mismatch:** the completed block tracks `N2-A02/A03/A04/A05/A06/A07/A08`; the 159-table tracks only the parent `ADM-TC-N2`; **`N2-A01` has no row anywhere** (unaccounted). Same class: `F06` (PASS) + `F06b` (PASS, sub-ID) appear in completed, but the 159-table lists only F01–F11.
6. **ADM-TC-X07 appears in two buckets:** it has a completed 🟡 PARTIAL row **and** still sits in the "NEVER RUN (159)" table. It is executed-partial (retry-commit leg fixture-gated), so it belongs in PARTIAL-with-follow-up, not never-run.
7. **SUB never-run table header "(51)" is off by one** — the table holds **50** rows (50 completed + 50 remaining = 100 ✅). Roll-up/section both say 50. Cosmetic but should be corrected.
8. **SUB "never-run 50" is inflated by 15 RETIRED + 2 N/A rows** that still live in the never-run table (B01–B13, D02, D04 all "🔴 RETIRED — in-app payment removed; coverage → Web E2E"; G02/G03 "🚫 N/A"). Genuinely drivable future SUB work is **~33** cases, not 50 (see §7). QA Task 32 must scope against the active ~33 and explicitly disposition the 15 RETIRED + 2 N/A (relabel/prune), per R40.
9. **TRD "never-run 19" includes many not-genuinely-owed rows:** E05/E06 and R01–R05 self-describe as "equivalent PASS under R10/R09/B04/B01/C02/B02/B06/C06"; Q10/Q11/Q13/Q14/Q16 are time/multi-account-descoped; D05/D06 are post-MVP/not-built; B12/B13 are guide-flagged dead code. Real new TRD work in that pool ≈ **A03, A04, N2** (idempotency suite) + any re-scope of the descoped Q's.
10. **Status-taxonomy gap (cross-cutting):** the legend has no REMOVED / RETIRED / NOT-IMPLEMENTED / NOT-SUPPORTED buckets. Consequences visible in-file: AUTH removed cases (H04/H05/I01–I03) are marked 🔴 OPEN-BLOCKED; SUB retired cases are 🔴 RETIRED *inside the never-run table*; MSG D10/J05 "NOT SUPPORTED" verdicts are forced into 📄 DOC-DRIFT ("DOC-DRIFT label = tracker has no NOT-SUPPORTED status"). A dedicated bucket set would remove the AUTH OPEN inflation (5 of AUTH's 16 OPEN are removed-feature rows) and the SUB never-run inflation.
11. **AUTH/ACC "Remaining = 0" is literal but hides residual open work:** AUTH's 16 OPEN and ACC's 17 OPEN are executed-but-BLOCKED/FAIL/REMOVED rows (real residual defects/env blocks + removed features), not never-run. They should be read as an open-defect queue, not "guide done".

---

## 6 · ADM precise outstanding case list (task item 5) — baseline for rest of QA Task 31 (Batches 4–7)

Derived by diffing the 159-row remaining table against the completed block (every ID below has **no completed row on record** in this tracker; per-ID multiplicity verified = 1, i.e. remaining-table-only). QA Task 31's own header note enumerated 12 of these; this audit adds 8 it did not name.

### 6.1 · Never-run (no verdict row) — 19 IDs
| Group | IDs | QA Task 31 header named it? |
|---|---|---|
| B (User actions) | **B03** Suspend/ban/delete · **B06** Reset Password · **B07** Unsuspend | ✅ yes (prompt()-tooling, ADM-R3) |
| C (Listing mgmt) | **C11** Select-all/selection counter (flag) · **C12** Individual filter controls | ✅ yes |
| E (Nodes) | **E06** Node tagging completeness (N6) · **E07** Per-node KPIs (N6) | ✅ yes (SQL/RPC) |
| F (Config) | **F11** Reset button | ❌ **not named — NEW finding** |
| H (Trade detail) | **H05** External References (Stripe PI/refund + SP ledger IDs) | ❌ **not named — NEW finding** |
| K (Payouts) | **K03** Retry failed payout (confirmation) | ✅ yes (fixture-gated, no failed-payout fixture) |
| L (SP economy) | **L07** SP Wallet state RPC (`get_user_sp_wallet_summary` → wallet_state) · **L08** SP Wallet warning banners (mobile) | ✅ yes (mobile-leg) |
| M (Subs) | **M01** Grace period config (days + reminders) | ✅ yes |
| N (Referral) | **N02** Referral analytics tab · **N04** "Missing configuration" warning | ❌ **not named — NEW finding** |
| T (Analytics) | **T01** Revenue & Analytics dashboard | ❌ **not named — NEW finding** |
| X (Action Ctr) | **X04** Expand card drills into item list · **X08** Empty state "All caught up" · **X11** Config drift card | ❌ **not named — NEW finding** (X04's expand behavior was touched inside QA Task 30 X05 but never given its own verdict) |

> The 8 NEW IDs (F11, H05, N02, N04, T01, X04, X08, X11) may have been covered implicitly inside QA Task 29's ~88-case run or QA Task 30/31 (ledger-FULL-160 / report.md are the tie-breakers). They are flagged here because **this tracker has no verdict row for them and QA Task 31's own remaining list omits them** — confirm against `ledger-FULL-160.md` before scoping, per R40.

### 6.2 · Executed PARTIAL with an outstanding sub-leg — 18 rows (QA Task 31 Batches 4–7 targets)
`X07` (retry commit, fixture-gated), `Y05` (debounce, driver-limited), `Y08` (listings-palette result not surfaced — dev finding), `D04` (suggestions queue/count, fixture), `D08` (drag-drop, driver), `D11` (suggestion approve/merge/reject, fixture), `G04` (publish — not executed, no-safe-revert on legal surface), `M03` (extend/cancel/reactivate commits — deferred to SUB round), `M04` (reactivate + mobile reflection), `M05` (metrics window-scoping, R54), `O04` (screenshot-deleted note state), `O05` (template edit commit), `P02` (badge edit commit), `P03` (manual award), `P04` (sandbox simulation), `R03` (publish FAQ/education), `S02` (support mark-read), `N2-A08` (summary-strip window labeling).

### 6.3 · OPEN-FAIL / defect
`L02` SP Analytics — `public.category_sp_analytics` table missing on staging (dev fix; shell + CSV export render, no data).

### 6.4 · Mobile-leg OWED (R55/§5.57 — PASS/PARTIAL admin-leg only) — must be re-driven on the app before counting fully PASS
Per QA Task 31 header (authoritative per-case detail in `qa-task31-adm-near-total-2026-09-04/report.md` → "Mobile-impact coverage assessment"): **B04, L04, L05, D02, D05, D06, D07, D08, D09, D10, I03, I04, E02, E03, E04, E05, G04, M03, M04, O04, P02, P03, R01, R03** (only D03 fully + D02-show partially got a mobile leg). These feed the separate **QA Task 31-M (mobile-leg pass)**.

---

## 7 · SUB precise never-run case list (task item 4) — baseline for QA Task 32

The never-run table holds **50 rows** (header mislabeled "(51)"). Grouped by section, with disposition marker:

| Section | Case IDs | Disposition |
|---|---|---|
| **A** | `A05` (Kids Club+ Overview by subscription status) | active |
| **B** | `B01` `B02` `B03` `B04` `B05` `B06` `B07` `B08` `B09` `B10` `B11` `B12` `B13` | 🔴 **RETIRED** ×13 (in-app payment removed → Web E2E) |
| **D** | `D02` `D04` | 🔴 **RETIRED** ×2 (in-app re-subscribe/renewal removed) |
| | `D05` (Reactivate from cancelled state) | active |
| **F** (Payout Settings) | `F01` (hero Available/Pending/Lifetime) · `F03` (payout history list) · `F04` (earnings figures + net/fee) · `F05` (history empty state) · `F06` (pending earnings follows release timing) · `F07` (load error + recovery) · `F08` (history Load More +5) | active ×7 |
| **G** (Payout methods) | `G01` (Stripe Connect onboarding) · `G04` (set primary/delete confirm) · `G05` (unverified blocks payout) · `G06` (requires_action → Set Up) · `G07` (Edit Details sheet) · `G08` (Cannot Delete Primary/Only guard) · `G09` (Cannot Set Primary unverified guard) · `G10` (history Load More) · `G11` (NoMethodModal flow) | active ×9 |
| | `G02` `G03` | 🚫 **N/A** (PayPal/Venmo, Bank ACH unconfigured — UI lists, not drivable) |
| **H** (Withdraw) | `H01` (no-balance guard) · `H02` (WithdrawModal summary) · `H03` (confirm success) · `H04` (blocked w/o verified primary) · `H06` (admin min-withdrawal floor) · `H07` (min-withdrawal disabled when config = 0) | active ×6 |
| **I** (SP Wallet) | `I06` (free-user SP wallet inactive state) | active |
| **K** (Transaction History) | `K02` (empty + error/retry) | active |
| **M** (Payment Methods) | `M01` (loading state) · `M06` (Go Back) · `M07` (backend contract: attach/detach/retryFailedPayment) | active ×3 |
| **N** (JoinKidsClub routes) | `N03` (route-alias reachability) · `N04` (ContinueKidsClub active-sub variant) · `N05` (loading state) · `N06` (trial-ending urgency badge) | active ×4 |

**Totals:** 50 rows = 33 **active** + 15 **RETIRED** + 2 **N/A**. QA Task 32 should scope the 33 active IDs and separately disposition (relabel or prune) the 15 RETIRED + 2 N/A rather than treating "50 never-run" literally.

---

## 8 · Baseline implications

- **QA Task 32 (SUB)** scopes against the **33 active** IDs above (§7) — Sections A (A05), D (D05), F (7), G (9 active), H (6), I (I06), K (K02), M (3), N (4) — plus decide the 15 RETIRED / 2 N/A disposition. The "50 never-run" figure in the QA Task 31b brief and the in-file "(51)" header are both inaccurate.
- **Rest of QA Task 31 (ADM Batches 4–7)** scopes against §6: 19 never-run (of which QA Task 31's own list named 12; **8 new: F11, H05, N02, N04, T01, X04, X08, X11** — verify against `ledger-FULL-160.md`), the 18 PARTIAL sub-legs, L02 (dev), and the 24-row mobile-leg-owed set (QA Task 31-M).
- **Recommended tracker maintenance (deliberate, not done here):** (1) refresh the top roll-up table; (2) prune the ADM 159-table to the true outstanding set; (3) de-duplicate B04/C05/R01/R02 completed rows + rename QA Task 29's mislabeled R01/R02/R05; (4) reconcile the N2 family (add N2-A01 or drop the A0x scheme); (5) fix SUB never-run header (51→50) and move RETIRED/N/A out of never-run; (6) add REMOVED/RETIRED/NOT-SUPPORTED status buckets.

---

## 9 · Evidence / file references
- Tracker audited: `e2e-test-results/QA-TESTCASE-STATUS-2026-09-03.md` (1101 lines; read in full)
- Guides cross-referenced: `cross-checked-and-consolidated/*-MANUAL-TESTING.md` (6 files)
- Fresh per-case detail (not modified): `qa-task31-adm-near-total-2026-09-04/{report,ledger}.md`, `qa-task29-adm-first-live-2026-09-04/ledger-FULL-160.md`, `qa-task30-adm-moderation-msg-y-2026-09-04/`
- Row-count verification: read-only `grep -c` on the tracker (documented per §2)
