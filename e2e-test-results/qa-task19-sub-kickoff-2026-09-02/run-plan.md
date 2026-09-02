# QA Task 19 run plan — TRD Remainder Closure + SUB Guide Kickoff

**Run dir:** `e2e-test-results/qa-task19-sub-kickoff-2026-09-02/`
**Date:** 2026-09-02 (session start)
**Device:** iPhone 17 Pro Max sim UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E` (iOS 26.1)
**Backend:** Supabase staging `drntwgporzabmxdqykrp`
**Admin portal:** `http://localhost:3001` (real admin session shared)
**Metro:** port 8081 (user confirmed app running on simulator)

## Scope
### Section A — close TRD's 2 remaining flags (2 cases)
- **C-N07** — fixture-building session (R41): create $4 QA-owned listing while min_listing_price=0 → raise min to $5/$6 via admin → auto-pause confirmed (DB) → edit price to meet threshold → repurchasable → revert min to 0 (DB-verified)
- **C-B10** — literal new-card-number entry via native PaymentSheet on TradeOfferScreen "Replace Card"; if not drivable keep honest tooling-limited classification

### Section B — SUB guide full scope, target ~58 cases across 4 areas
1. Subscription lifecycle (~15)
2. Payout flow (~15) — incl. re-verify DT85 resolve-dispute/cancel-trade (capture-before-payout)
3. SP Wallet (~15)
4. Payment method management (~13)
Prioritize self-contained, no-new-infra cases; flag fixture-gap cases honestly (R41).

## Personas (staging registry)
test-buyer (KCP active subscriber), test-free, test-seller (KCP subscriber + Connect-enabled), test-buyer-2/-3, test-seller-2/-3.

## Standing techniques (this session)
- R29 busy check done: sim booted, no in-flight orchestrator (last run-suite exit 1/127 earlier).
- R-16-1: `qa:reset-offer-fixtures` FIRST action of any offer/bundle session.
- R-NEW-1: relaunch-first on blind AX tree (2 empty/status lists).
- Cmd+A select-all default for field clears; keyboard-done-button where present.
- Modal meta-rule: AX-tree-first, list + re-list once, pixel-scan only if still empty.
- Screenshots are 3x (1320x2868 = 440x956pt); AX coords are POINTS.
- DB read-back mandatory for every money/SP/payout assertion (R11/R24/R33).
- Admin-leg executed for real in same session (standing rule), R-NEW-5 batching.
- Persona batching to minimize auth cycles (§5.26).

## Execution order (planned)
1. Env confirm: app running, launch state.
2. Section A: C-N07 (fixture) + C-B10 (PaymentSheet attempt).
3. Section B batches (persona-batched): SUB subscription lifecycle → payment methods → SP wallet → payout.
