# QA Task 10 — Decision-and-Outcome Log (2026-08-30)

Trace of key actions, reasoning, and outcomes for `e2e-test-results/qa-task10-dt66-fix-verify-tr-d-2026-08-30/`.

## Execution flow
1. **Fix-verify 1 (grace logic):** read-only SQL confirmed the new predicates (`is_active_subscriber` grace-aware, `is_earning_subscriber` strict) against the LIVE personas — test-buyer (lapsed period + future grace, the exact QA Task 9 stale-fixture state) now returns member=true. Functiondefs confirmed `rpc_cart_get_items` uses grace-aware and all 3 earn functions use strict predicate. On-device: added items as test-buyer + test-grace, confirmed the "Accepts Points · Up to N SP" subscriber badge (was hidden pre-DT-66) + SP Eligible banner + $1.49 member fee. → PASS.
2. **Fix-verify 2 (modal AX):** built a real in-progress trade (buyer offer → seller accept) to reach IssueReportModal; separately reached cancel-reason-modal via ManageKidsClub (test-seller trial). Both times the AX tree showed all children exposed but the CONTAINER absent (2 listings each) — DT-66's `accessible`+`alert`+`label` on the sheet wrapper is flattened on iOS. → PARTIAL for both.
3. **Fix-verify 3 (money guard):** `qa:admin-config-set set -5` → NEGATIVE_MONEY_VALUE (rejected, value stayed 0); set 5 → OK; revert 0. → PASS.
4. **Fix-verify 4 (owner gating):** as test-seller opened own listing → no Add to Cart / Request to Buy. → PASS.
5. **Fix-verify 5 (saved-cart copy):** built 3 saved carts + active via UI; save path + switch path both returned the friendly copy (no raw string). → PASS.
6. **Fix-verify 6 (M20 guide):** guide L2905 confirmed neutral-gray heart wording; on-device element present. → PASS.
7. **Coverage attempt (Group N):** set min_listing_price=5; drove ItemCreate via dev fixtures (photo, category, fill, price 20→3 via long-press→Select All→type). Hit a hard wall: the price-field keyboard is not dismissible this session (Cmd+K/osascript unreliable even with Simulator focus; keyboard-done accessory not rendered for the field) and the ScrollView binary-snaps — could not tap "Submit for Review". Recorded as friction; reverted min_listing_price to 0.
8. **Coverage investigation (N06 auto-pause):** grep of migrations proved the auto-pause lives ONLY in `secure_upsert_admin_config` (admin-web/API path), not the `qa:admin-config-set` helper RPC → N06 not drivable via this agent's sanctioned path (admin-web out of scope per §2).
9. **Group O partial:** confirmed tax display in the Make Offer breakdown ($1.40 @ 6.99% CT on $20) and source-verified the buyer-only timeline tax row. Did not execute O03 global-disable (needs a new trade fixture + toggle).
10. **Cleanup:** cancelled disposable trade via cancel-trade EF (refund, item restored); cleared carts; reverted cart_min_value_cents + min_listing_price (original category `fees`); disarmed payment_card toggle; logged out. All residue checks = 0 via read-only SQL.

## Decision: graceful degradation (per task instruction)
Stopped coverage at the first group boundary after the fix-verifications: the ItemCreate form friction + admin-web-only auto-pause made Group N not cleanly executable, and the task explicitly permits a smaller fully-verified zero-residue batch over a degraded full one. All 60 new cases remain NEVER RUN (honest, no partial verdicts recorded).

## Cost/efficiency vs $0.054/case baseline
- Fix-verifications: 6 items executed with strong evidence. Heavier than baseline (trade setup for the modal AX; 4-cart build for the saved-cart copy) — but these are the mandated priority and several close prior-run findings.
- Coverage: ~0 new cases closed this session (Group N friction consumed the post-fix budget). The dominant cost driver was the ItemCreate form (keyboard/scroll) + the 3-persona trade setup.
- Biggest lever for next session: a `dev-set-price` fixture (removes the ItemCreate keyboard wall) + reusing the mapped tax/checkout flows.
