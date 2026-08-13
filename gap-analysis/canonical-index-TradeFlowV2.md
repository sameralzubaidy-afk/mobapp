# Canonical Index — TradeFlowV2

**Source:** `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Last updated:** 2026-08-01
**Total test cases extracted:** 256

## Structural Issues Found

1. **3 groups missing from top-level index** (43 cases): Groups O-1 (Tax by Catalog Category, 17 cases), O-2 (Tax Status Lifecycle, 12 cases), and O-3 (Tax Refund & Reconciliation, 14 cases) have full body sections but no index entries.

2. **Body-only cases in indexed groups** (17 cases): N09–N14 (cart admin), S14–S24 (seller group)

3. **Regression mini-checks** (8 cases): REG-R01 through REG-R08 appended at end of file. Collide numerically with Group R (Refund) but are semantically unrelated (value stack math, consequence levels, SP gating).

4. **Status markers inconsistent**: Some cases marked passed/✅/⚠️/⏭️/DEFERRED, ~30% unmarked.

## Groups & Counts

| Group | Cases | Description |
|---|---|---|
| A — Core Happy Paths | 4 | Cash only, Accept SP, Pay Cash, Donate |
| B — Offer Lifecycle | 20 | Decline, expiry, competing, cancel, per-seller cap, card declined, chat freeze |
| C — SP Behavior | 8 | Reserve, restore, release, slider cap, free user gate |
| D — Auto-Complete & Timers | 5 | Auto-complete, dispute skip, countdown pill, banner |
| E — Dispute Flow | 6 | Report, auto-complete block, buyer/seller UI, admin resolve |
| F — Payout | 3 | Completion payout, dispute hold, no method |
| G — Notifications | 4 | Expiry reminders, auto-complete, throttle, deep-link |
| H — Completion CTAs | 5 | Free buyer CTA, SP savings, seller notices, lifecycle |
| I — Safety UX | 5 | Safe meetup card, dismissible, chat banner, pre-message modal, quick-reply |
| J — Seller Cancel Consequences | 5 | Level 1-3, button visibility, seller-only reasons |
| K — Value Stack & Fees | 11 | Fee display, bundle fee modes, partial refund, reconciliation, seller fee % |
| L — Bundle Flows | 11 | Banner, Confirm All, rows, individual accept/decline, cart |
| M — Cart System | 20 | Cart add/remove, min value, max carts, expiry, empty state |
| N — Cart Admin | 14 | Price adjustment, bulk listing thresholds |
| O — Sales Tax (Checkout) | ~8 | Tax line display, calculation, rounding |
| O-1 — Tax by Catalog Category | 17 | Admin per-category tax rules |
| O-2 — Tax Status Lifecycle | 12 | Tax state transitions |
| O-3 — Tax Refund & Reconciliation | 14 | Refund tax handling, ledger integrity |
| P — Tax Admin Config | 8 | Node rate config, bulk update, audit, reporting, CSV |
| Q — Reviews & Ratings | 20 | Submit, report, moderation, admin queue |
| R — Refund & Cancellation | 13 | State machine, partial refund, SP restoration |
| S — Seller Group | 24 | Seller views, "More from seller", CTA position |
| T — Navigation Consistency | 14 | Tab nav, header patterns, back behavior |
| X — Navigation (merged) | 16 | S01–S15 + Flow Registry T01 |
| U — Admin Bundle Trade Views | 5 | Bundle trade admin detail |
| V — Payments Reconciliation | 14 | Charged vs refunded per trade |
| W — R2 Auth-and-Capture | 12 | Pickup window, 7-day guardrail, reminders |
| REG — Regression Checks | 8 | Value stack math, consequence levels, SP gating |
