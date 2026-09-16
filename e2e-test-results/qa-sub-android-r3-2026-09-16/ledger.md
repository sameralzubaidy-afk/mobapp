# Ledger — SUB Android Round 3 (2026-09-16)

Decision/outcome ledger. Mined figures would normally come from `qa:mine-call-ledger`; per **R71-fallback** this session's transcript is not mineable, so the tallies below are a **labelled manual tally**, split into desk (recon/audit/report) vs device execution so the device ratio is comparable to the 43c baseline (~9.6 calls/verdict).

## Phase tallies (manual, ±3)

| Phase | Calls | Notes |
|---|---:|---|
| Recon / tracker audit / memory | ~18 | guide grep, tracker row enumeration, row-set arithmetic, source reads (retry EF, TransactionHistoryScreen, linking config) |
| Session setup (R29/R63) | ~8 | device list, Metro/port/busy checks, tool activation |
| **Device execution** | **~62** | 13 Android verdicts + F02 → **≈4.4 calls/verdict** (below the 43c 9.6 baseline) |
| Report + tracker + handoff | ~8 | |

## Decision log (high-signal rows)

| # | Trigger | Reasoning | Outcome |
|---|---|---|---|
| 1 | `qa-login-as` while `PaymentMethods` mounted → spinner stuck, no error line | Empty/absent resolution + the R101 discriminator. Ran the **fresh-process control** instead of filing | Terminate+relaunch → resolved instantly ⇒ **in-process wedge, not filed** (F5 observation) |
| 2 | `sp-wallet` deep link did not navigate | Could be a dead link (a claim worth a finding) or a settlement artifact. Bounded test: fire the sibling `sp-history` | `sp-history` navigated ⇒ linking layer alive. Clean `sp-wallet` re-fire then **worked** ⇒ **artifact, no finding** (friction #1/#4) |
| 3 | JoinKidsClub header bell looked like an empty disc | Visual shape alone is not enough (R62e). Checked the **AX tree** for the same frame | No `header-notifications-btn` node at all + persisted across 2 frames + contrast vs 2 other headers ⇒ **filed F1** |
| 4 | K02 error state — where is the receipt icon? | Guide says icon + text + Retry. Read `TransactionHistoryScreen` render branches before concluding | Icon is **empty-branch-only** ⇒ **DOC-DRIFT F2**, not an app bug |
| 5 | `available_balance` (2263) vs `lifetime_earned` (2741) vs pending (503) would not reconcile | R100 — name the writer before filing. Pulled the full `sp_wallets` row | **`lifetime_expired` 25** was an undocumented column; the delta is explained ⇒ **not filed**; cheat-sheet corrected |
| 6 | M07's brief says "check whether FIX-Task-37 unblocks it" | Do not assume either way. Read the EF's guard order, then read the live row | `test-payfail` lacks Stripe ids → `MISSING_STRIPE_DATA` fires **before** the target branch ⇒ **still blocked, precisely evidenced** |
| 7 | Same question for G/H cases | Checked the fixture rather than the prose | `qa-payout-seller` **still holds** the verified method + $50 ⇒ F02 driven → **PARTIAL→PASS**; G/H unblocked (named as next-round work) |
| 8 | L05 needs a provider layer | Looked for a real provider object instead of declaring N/A | 2 payouts carry `provider_reference_id`; read `tr_1UChi7…` → amount + `metadata.payout_id` **match the DB row** ⇒ genuine 3-layer AGREE |
| 9 | Tracker arithmetic would not settle (row count vs status split) | R57 says *report* the reconciliation, don't force it | Row-set reconciled to 100 ✓; the residual ±1 **named as an open item** rather than renumbered |

## Evidence index (screenshots/)

`00-session-start` · `K-login-testbuyer` · `K01-identity-spwallet` · `M01-loading-state-android` · `01-postfetch` · `02-cold-relaunch` (M03 saved-card) · `03-after-billing-deeplink` · `04-app-reloaded` · `05-bundle-loaded` · `06-poll` (**K01 list**) · `K01-pull-to-refresh-mid` · `K02-error-state-initial-batchframe` · `K02-error-state` · `K02-error-state-settled` · `K02-retry-recovered` · `K02-after-persona-switch` (**K02 empty**) · `I09-spwallet-repoint` · `deeplink-control-sp-history` · `I09-spwallet-retry` · `I09-releasing-soon-note` (**I09**) · `N03-alias-subscription-plans` (**N01+N03+F1**) · `N01-joinkidsclub-header-recheck` (**F1 persistence**) · `N02-web-redirect` · `N02-chrome-target-url` (**N02**) · `N04-continue-kids-club-active` · `N06-trial-5days-badge` · `N06-trial-badge-retry` (**N06**) · `L02-payment-failure-banner` · `L02-home-settled` · `L02-home-dashboard` · `L02-app-foreground` · `L02-home-settled2` (**L02 banner**) · `F02-payout-settings-with-method`

## Read-only DB queries used (all named, R54)

1. `subscriptions` row for test-payfail + test-buyer (retry counters, Stripe ids).
2. `billing_history` full rows for test-buyer (K01 4/4 reconciliation).
3. `billing_history` duplicate `stripe_invoice_id` groups (L04) → `[]`.
4. `billing_history` totals: 53 rows / 52 distinct invoices / 53 distinct charges (L04 scope).
5. `sp_wallets` full row for test-seller + release-queue sum (I09).
6. `sp_wallets` reserved-SP scan (I07 gate) → 0 wallets; `seller_payouts` dup `provider_reference_id` → 0 groups (L05).
7. `seller_payouts` status inventory: 85/26/11/3/2 (L05) + the completed/failed rows.
8. `subscriptions` by status + `sp_wallets` by state (F6 observation).

**No writes. No mutations. No config changes.**
