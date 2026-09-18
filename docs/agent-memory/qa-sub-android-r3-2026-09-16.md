# QA round 2026-09-16 — SUB Android Round 3 (Groups K/L/N + M remaining + F02 side-effect)

Run: `e2e-test-results/qa-sub-android-r3-2026-09-16/` (report.md + ledger.md + ~25 screenshots).
Platform: Android `Medium_Phone_API_36.1` (emulator-5554), 1080x2400 (tree coords == px).
Personas used: test-buyer, test-seller, test-free(none), test-trial, test-payfail, qa-payout-seller.

## Verdicts added (Android)
- **K01 PASS** (4 rows; DB 4/4 exact incl. failed `error_message` verbatim; pull-to-refresh spinner + reload).
- **K02 PASS** (empty: receipt icon + "No billing history yet."; error: "Failed to load billing history" + Retry; disarm+Retry recovers).
- **N01 PASS · N02 PASS · N03 PASS · N04 PASS · N05 PASS(source-confirmed transient) · N06 PASS(≤7d badge "5 days left in trial")**.
- **L01 PASS (3-layer on the Aug-27 renewal invoice) · L02 PASS (user-visible retry banner) · L04 PASS · L05 PARTIAL(Android)**.
- **F02 ✅ PARTIAL→PASS on Android** — the "with method" leg Round 1 called fixture-gated. `qa-payout-seller` holds a verified primary `stripe_connect` method (`acct_1UGKzW3uefDqBl4z`) + $50.00 balance → hero 3/3 DB-exact, method card "Stripe / acct_****Bl4z / ✓ Verified & Active", "+ Add Another Method", history "No payouts yet".
- **M07 both remaining legs STILL BLOCKED** — evidenced (see below).

## Key facts / unlocked tooling
- `npm run qa:start-state -- <persona>` = the R63 checklist item-3 one-call state read (profile/sub/wallet/balance/payout methods/recent payouts/billing tail/LIVE Stripe account). Use it every round.
- `npm run qa:r41-trial -- ensure --days-remaining 5` and `npm run qa:payfail -- ensure --retry-count 1` both work and self-report the expected UI string.
- **`qa-payout-seller` fixture is LIVE** (FIX-Task-37 item 4 persists): verified primary Connect method + $50.00 controlled balance → unblocks F02 "with method", and the whole G/H withdraw family (H02/H03/H05) on a clean balance.
- **`STRIPE_QA_READONLY_KEY` is still an `sk_test_…` secret** (F3) → every `qa:stripe-inspect` run needs `--break-glass-secret-key` and must be labelled `key_scope=SECRET_KEY_BREAK_GLASS`.
- M07 true-retry-success blocker: the EF's `MISSING_STRIPE_DATA` guard (L122-127) fires before the `resolve_without_invoice` branch because **`test-payfail` has NULL `stripe_subscription_id`/`stripe_customer_id`**. Unlock = a payfail-shaped fixture WITH real Stripe ids and no open invoice (or `qa:r41-l02-failing-renewal`, which is dev-approved-only).

## Tracker reconciliation (R52/R56/R57)
- SUB §1 roll-up was stale (PASS 77 / OPEN 3 / Remaining 1) vs the section header (78 / 2 / 1) → roll-up corrected.
- Row-set audit: 101 SUB table rows = **84 Completed rows (incl. 1 DUPLICATE `I06`) → 83 distinct** + 15 RETIRED + 2 N/A = **100 ✓** (matches the canonical 100). Remaining (never-run) = **0** (the ACTIVE table's sole row is a struck-through duplicate of the Completed `G01` row).
- ⚠️ **Residual ±1 flagged, not forced:** the per-status split 78+2+2+15+2 = **99** accounts for 99 of the 100 canonical cases. Named as an open reconciliation item.
- 6 rows were malformed (7 cells, missing iOS+Android): M01, M06, M07, N05, N06 (+ the earlier malformed pattern). Round 1's Android PASS verdicts (M02–M06, F01, F03, G06, G11, H04) lived only in prose → Android column populated.

## Findings
- **F1 LOW-MED (design/affordance): JoinKidsClub header renders a GHOST bell** — an empty grey 40px disc beside the working chat button, with **NO `header-notifications-btn` node in the AX tree** (persisted across 2 frames). Contrast: Transaction History / Home headers render the bell correctly. `src/screens/subscription/JoinKidsClubScreen.tsx` layout.
- **Doc-drift:** K02's guide text says the error state shows "a receipt icon + error text + [Retry]" — the live error branch (`TransactionHistoryScreen.tsx` L118-130) has **no receipt icon**; the icon is exclusive to the empty branch.
- **Locator gap:** the K02 Retry control is a `ViewGroup label="Retry"` with **no testID and no accessibilityRole** (BP-53 ask).
- **N02 variance:** the web CTA opens `localhost:3002/join?email=…` (dev web-base), not the guide's `passitup.com`, and the page fails to load from the emulator (localhost ≠ 10.0.2.2). Config/host-awareness item, not a defect.
- **Observation (not filed):** warm `qa-login-as` while `PaymentMethods` is mounted → `📤 Fetching payment method...` never resolves; cleared by terminate+relaunch (R101 in-process wedge). Touches the FIX-Task-37 item-1 cache/auth path.
- **Friction:** after a `qa-login-as` the FIRST deep link is reliably dropped (3×) — re-fire it. Chrome stays in the task stack and steals BACK. The Dev Launcher keeps a stale `10.0.0.151:8082` "Recently opened" entry (R63a residue).
