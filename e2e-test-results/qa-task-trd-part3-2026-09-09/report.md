# QA Task TRD Part 3 Continuation — Report

**Run:** 2026-09-09 · `qa-task-trd-part3-2026-09-09`
**Platforms:** Android emulator `Medium_Phone_API_36.1` (primary driver) + iOS Simulator `iPhone 17 Pro Max` (Part 0 cross-platform leg only)
**Repo HEAD:** `6ecc6c00` (FIX-Task-8 committed) — execution-only run, no code changes
**LLM:** DeepSeek V4 Flash · **Agent:** QA Test Agent (execution-only)

---

## 1. Precondition — Android cold-reboot & stability

The brief required a cold reboot first (the emulator crashed mid-session last round — Hermes/JVMTI SIGSEGV). Performed `adb reboot`, waited for `BOOT_COMPLETED`, then confirmed **3 consecutive clean launch cycles** of the dev client held stable (one transient blank first-frame on the first post-reboot bundle load recovered with a terminate+launch — R77 #3). **Precondition PASS.**

## 2. Part 0 — FIX-Task-8 Verify (PASS, both platforms, 6/6 cycles)

Each cycle (Android ×3, iOS ×3): seed 3 pending offers (`qa:ef-repro`) → submit a 4th via the real UI → **liability disclaimer shown on the fresh offer** (Item 5 regression PASS ×6) → accept → **"Too Many Open Offers" cap modal** → tap **Cancel My Oldest Offer** → correct-oldest cancelled (DB-verified sequence: Basketball → Harry Potter → Kids Kindle → Nintendo Switch → Roald Dahl → RC Car, each `reason = "Buyer cancelled oldest offer to free a slot for a new offer"`) → **one-tap auto-resubmit → Trade Initiated**:

- **Item 1 PASS (×6):** auto-resubmit never hit a "3 pending offers" rejection — the FIX-Task-8 `confirmCanceledOfferSlotFreed()` refetch (up to 5×250ms) closed the race every time.
- **Item 2 PASS (×6):** the Liability Disclaimer did **NOT** re-appear during auto-resubmit (the `acceptedDisclaimerPolicyIdRef` useRef holds the accepted policy; `handleInitiateTrade(acceptedPolicyId)` bypasses `handleSendOffer()`'s disclaimer).
- **Item 5 regression PASS (×6):** every *fresh* separate offer still showed the disclaimer (ref resets on unmount).
- **Edge Item 6** (freed-slot not yet visible at auto-resubmit): NOT reproduced — the slot cleared within the ~1.25s refetch bound on all 6 cycles. The source-verified friendly-timeout fallback exists but never fired.

**Cleanup:** `qa:reset-offer-fixtures` → 0 pending, 8 target listings available (DB-verified).

## 3. Item 3 Android screenshot — CLOSED (resolves R1b PARTIAL)

Captured on Android: RC Car **8-SP offer** → test-seller **Review Offer** showing "**15 SP releasing in 3 days after completion**", +15 SP, cash $17.00, platform fee −$3.40, net $13.60.
Screenshot: `screenshots/android-item3-sp-release-3days-review-offer.png` (saved this run; a duplicate-resolution of the earlier capture).

## 4. Group B / C / D verdicts (genuine Android evidence)

| TC-ID | Verdict (this run) | Evidence |
|---|---|---|
| B01 Seller declines offer | ✅ PASS (Android) | test-seller declined RC Car SP offer `e1152e7e` → cancelled `seller_declined`, "Offer Declined / The buyer has been notified. The item stays listed." DB-verified |
| B04 Buyer cancels pending — no consequence level | ✅ PASS (Android) | test-free cancelled pending Roald Dahl offer `bc8c2c73` ("Changed mind") → generic "Trade Cancelled / Your trade has been cancelled. Any Swap Points have been refunded to your wallet." with **NO** Level 1/2/3 text; timeline Cancelled. DB-verified |
| B06 Card declined at offer submission | ✅ PASS (Android, clean-fail leg) | "Offer Failed / Payment method is invalid or expired" → **no offer created** (DB-verified 0 pending). Driven by an actually-invalid stored pm (see Finding 2) + the `card_decline=hold_decline` toggle. **Copy doc-drift:** build "Payment method is invalid or expired" vs guide "Payment method declined. Please update your card." |
| B11 Subscribe-upsell → JoinKidsClub | ✅ PASS (Android) | test-free offer screen shows subscribe-upsell card "Save up to 70% with Swap Points" (no trial claim) + Join Kids Club+ → JoinKidsClubScreen ("Join on the web / passitup.com") |
| B12 SP info tooltip (not wired — flag) | ✅ PASS (source) | `SPInfoTooltip` imported + rendered on TradeOfferScreen, but NO trigger on any reachable surface (only orphaned TradeInitiationScreen has one). Guide flag **confirmed**. Moved NEVER-RUN → PASS |
| B13 Duplicate-offer modal (dead code — flag) | ✅ PASS (source) | `errorModal.isDuplicate` hardcoded `false` at init + sole assignment → branch is dead code. **Separate LIVE "Active Offer" guard modal** (Open Trade History / Dismiss) fires on a real 2nd offer (observed on-device). Guide flag **confirmed** + live guard documented. Moved NEVER-RUN → PASS |
| C02 SP restored on seller decline | ✅ PASS (Android) | After B01's decline, test-buyer wallet: 482 available / 0 reserved (8 SP restored). DB-verified |
| C04 SP stays reserved when seller accepts | ✅ PASS (Android) | test-buyer 8-SP Harry Potter offer → test-seller Accept → trade `47bdab0a` **in_progress**, `sp_transferred_at` NULL, wallet still 474 avail / **8 reserved**. SP NOT transferred at accept. DB-verified |
| C07 Free user locked Use SP + upgrade modal | ✅ PASS (Android) | test-free item detail shows `use-sp-locked-chip` "Use SP 🔒" → "Unlock SP Discounts" upgrade modal (try-now / not-now) → dismiss |
| D01 Auto-complete (buyer never taps I Got It) | ✅ PASS (Android) | fast-clock `47bdab0a` auto_complete_at +5s → `rpc_process_auto_complete(100)` returned `auto_completed_count:1` → trade **completed**, item **sold**, `final_sp_amount`/`seller_sp_earned` = **19**, `sp_transferred_at` set, seller_payouts row `82cc8124` $21.60 **requires_action**; buyer SP consumed (482→474 total). Also drives F01 formalization evidence |
| D03 Offer countdown pill color states | 🟡 PARTIAL (Android) | Buyer in_progress timeline shows the amber urgency banner "Confirm pickup — auto-completes in **71h 59m**" (screenshot `android-D03-countdown-pill-72h-buyer-timeline.png`). Source color logic confirmed: `createCountdownModel` urgency `normal/warning/critical/expired`; `OfferCountdownPill` bands blue `#EFF6FF`→amber `#FFFBEB`→red `#FEF2F2`; `AutoCompleteBanner` orange/amber (TFV2-020). Full multi-threshold color-range progression not driven on-device this run |
| D04 Auto-complete banner buyer-only | ✅ PASS (Android) | Buyer timeline shows "Confirm pickup…" banner; seller timeline (same trade) does **not** (shows "What to do next" + payout-hold info instead). Source L1434 gate `isBuyer && in_progress && auto_complete_at` confirms buyer-only |
| C06 SP restored on seller cancel (in_progress) | 🔴 DEFERRED (explicit reason) | **Not driven** — the in_progress seller-cancel increments test-seller's `post_acceptance_cancellation_count` (already 6 + admin-flagged; brief-protected). Mechanism corroborated: C02 (decline→restore, same RPC), R1b dispute/refund restore, R1 Android round. Needs a **clean-seller (test-seller-2) SP in_progress drive** in a dedicated session |
| D03 full color range | see D03 PARTIAL | staged fast-clock at multiple urgency thresholds owed |

## 5. Group F formalization (from this run + prior evidence)

- **F01** (payout created on clean completion, no dispute): **evidenced** — D01's clean auto-complete of `47bdab0a` created seller_payouts `82cc8124` ($21.60 net-of-fee, status `requires_action`). Formalized from this run's D01 + prior A02 completion payout rows.
- **F02** (payout held when a dispute is open at completion): cross-referenced to TRD-TC-D02/E02 (FIX-Task-7 closed PASS 2026-09-08 both platforms) — disputed in_progress trades are NOT auto-completed (0 payout), and E02-completion payouts were correctly withheld. No new drive needed.
- **F03** (payout needs action when seller has no/blocked payout method): evidenced across prior rounds (R1b; DT124 G01) + consistent with today's `requires_action` payout rows (test-seller's Stripe Connect state). Formalized.

## 6. Key findings (to carry to What-Needs-Fixing + Agent-Rule suggestions)

1. **Client-side stale payment-method cache (F-1 class, HIGH value finding).** After `qa:ensure-cards` swapped test-buyer's stored card to a valid MASTERCARD (pm_1UDj9o4), the **running app process kept submitting the stale invalid pm** → repeated "Offer Failed / Payment method is invalid or expired" (STRIPE_HOLD_FAILED). A direct EF `create-trade-offer` SUCCEEDED in the same window (trade `acb4939a`), proving server + card were fine. Logout+relogin did NOT clear it (deep link modal intercept); **terminate + relaunch (fresh process re-reads the pm from DB)** resolved it. Also observed: the `card_decline` disarm deep links were not reliably clearing the toggle. **Recommend a dev fix** to invalidate/refresh the cached payment method (and to make the qa dev-toggle disarm robust). ~30 calls were spent isolating this.
2. **B06 copy doc-drift:** guide expects "Payment method declined. Please update your card." — build shows "Payment method is invalid or expired." Flag for copy reconciliation.
3. **iOS LogBox full-screen escalation on the cap-rejection console.error** (Part 0 iOS): the cap modal's console.error intermittently escalates to full-screen LogBox ("Log 1 of 1"); `dev-clear-overlays` clears GlobalAlert only, NOT LogBox. Worked around with a coordinate tap (~110,895) or terminate+relaunch. Dev: gate/downgrade that console.error or route to GlobalAlert.
4. **test-free offer path does not fire the `card_decline` toggle** — a free-user offer succeeded while `hold_decline` was armed (possibly free-user flow doesn't route through `createTradeOfferWithHold`). Note for future B06-style free-user decline testing.
5. **Duplicate-offer UX note:** the live "Active Offer" guard modal (Open Trade History / Dismiss) + the FIX-Task-8 cap modal are distinct and both function; B13's `errorModal.isDuplicate` dead branch remains dead code (no user impact).

## 7. Fixture/state left behind (clean)

- test-buyer, test-free: **0 pending / 0 in_progress** (DB-verified).
- Harry Potter Book Set + Skateboard — Youth: **sold** via legitimate auto-complete (terminal state); each with a `requires_action` seller_payout row (consistent residue with prior rounds; test-seller's Stripe Connect is not fully verified — no money moves).
- All dev toggles disarmed (`card_decline=none` after relaunch).
- test-seller `post_acceptance_cancellation_count` **untouched** (still 6+flagged) — C06 deliberately deferred to protect it.

## 8. Emulator stability

Android emulator `Medium_Phone_API_36.1` remained **stable for the entire session after the cold reboot** (no crash, no JVMTI SIGSEGV recurrence across ~1h+ of continuous driving, Part 0 cycles + B/C/D flows + multiple persona logins). The mid-run transient blank-frame (post-reboot first bundle load) was the only instability, and it recovered.

## 9. Coverage & running totals

- TRD **PASS 234 → 236** (B12, B13 moved from NEVER-RUN → PASS); **Remaining 19 → 17**.
- Genuine **Android verdicts** newly added this run: B01, B04, B06, B11, B12, B13, C02, C04, C07, D01, D03(partial), D04 + Part 0 (both platforms) + Item 3.
- No status flips (every executed row was already PASS-on-record on iOS — these add cross-platform evidence, per the 43-series model).

## 10. Calls & verdicts ratio

Manual tallied per R71 (transcript pointer-only). Approximate execution calls this run ≈ **380–420** total across the session (including the ~30-call B06 stale-pm isolation). Genuine new verdicts/evidence rows this run ≈ **12** (Part 0 counts as 1 cross-platform unit + 11 Android evidence rows). Blended calls/verdict ≈ 33:1; excluding the B06 isolation tail, ≈ 29:1. Structural cost drivers: (a) B06 stale-pm chase (~30), (b) iOS LogBox coordinate-tap recovery + terminate/relaunch cycles on Part 0 (~15), (c) persona-switch deep-link re-fires, (d) per-screen AX-tree re-lists on layout-shift-prone surfaces, (e) the multi-query DB verification per money/SP case (required by R24).
