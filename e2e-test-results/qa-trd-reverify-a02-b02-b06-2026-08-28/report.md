# QA Run — TRD Re-Verify: A02, B02, B06 (landed-fix re-verification)

**Date:** 2026-08-28
**Agent:** QA Test Agent (execution-only; no code modified)
**Target:** iOS Simulator — iPhone 17 Pro Max (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1), app `com.sameralzubaidi.p2pmarketplace` (Expo RN dev build, Metro serving working tree with DT-17/18/19/25/29 fixes)
**Backend:** Staging Supabase `drntwgporzabmxdqykrp` (read-only DB verification; the B02 fast-clock UPDATE + `rpc_process_expired_offers` on the disposable trade are the guide-documented test mechanism)
**Canonical guide:** `cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`
**Evidence dir:** `e2e-test-results/qa-trd-reverify-a02-b02-b06-2026-08-28/screenshots/` (15 screenshots)

> Task: re-verify 3 cases from the original 20-case batch whose underlying bugs are now fixed (DT-17b/19/27 SP settlement; DT-19 expired-offer UI + cash-only counter; Task 25 `card_decline` toggle). All money/SP assertions closed with read-only DB verification. Any residual failure treated as a fresh finding, not the original bug.

---

## Verdict summary

| TC-ID | Description | Original verdict | Latest verdict | Date | Evidence source |
|---|---|---:|---:|---|---|
| TRD-TC-A02 | Accept-SP happy path (SP settlement) | 🔴 FAIL (P1) | ✅ **PASS** | 2026-08-28 | `01-05,10-15*.png`, DB trade `259238d9` |
| TRD-TC-B02 | Offer expiry + seller ignore prompt | 🔴 FAIL (partial) | 🔴 **FAIL (fresh finding)** | 2026-08-28 | `07*.png`, DB trade `4391d969`, counters |
| TRD-TC-B06 | Card declined at offer submission | 🔴 BLOCKED | ✅ **PASS** | 2026-08-28 | `08*.png`, DB (no offer/SP) |

**Roll-up: 2 PASS · 1 FAIL · 0 BLOCKED · 0 SKIPPED (of 3)**

---

## 🔴 Findings (fresh — not the original bug)

### F1 (B02, HIGH) — Expired offers still do NOT surface in "Your Offers" — string mismatch `'offer_expired'` vs `'Offer expired'`
- The DT-19 Fix 2 surfacing path compares/filters on **snake_case `'offer_expired'`**, but the live expiry RPC (`rpc_process_expired_offers`) writes **`'Offer expired'`** (capital O + space) into `trades.cancellation_reason`.
- Proof (live): expired trade `4391d969` (Roald Dahl, fast-clocked, cancelled "Offer expired") does **not** appear in the buyer's "Your Offers" (only the pending LEGO offer + the `2c1a5228` DECLINED offer surface). Source: `TradeListScreen.tsx` L358 fetch filter `.in('cancellation_reason', ['seller_declined', 'offer_expired'])` + L569/L573 memo filters `=== 'offer_expired'`; live DB value confirmed `'Offer expired'`.
- The **declined** branch works (`2c1a5228` has `'seller_declined'`, surfaces with DECLINED badge + "Declined — Item no longer available"). Only the expired branch is dead.
- **Fix (DEV):** change the client fetch/filter literals to `'Offer expired'` (matching the DB writer), OR normalize the RPC to write `'offer_expired'` — one canonical value. Recommend the RPC writer side (fewer call sites, matches other snake reasons like `seller_declined`).

### F2 (B02, MEDIUM) — Seller-ignore streak accumulation broken: `fn_reset_unanswered_counter` resets on expiry (snake/spaced mismatch)
- `fn_reset_unanswered_counter` (live trigger `trg_reset_unanswered_counter` on `trades`) guards with `cancellation_reason IS DISTINCT FROM 'offer_expired'` (snake) — but the DB writes `'Offer expired'` (spaced), so the guard is always true → on expiry the counter is **reset to 0**.
- Live proof: Roald Dahl `listing_offer_stats.unanswered_offer_count` went 0→1 (offer submitted) → 0 (offer expired) — the 2-consecutive-unanswered accumulation for the seller-ignore prompt can never build. (`fn_update_unanswered_counter` uses the spaced `'Offer expired'` correctly, but fires after `fn_reset_unanswered_counter` alphabetically, so the reset wins.)
- **Fix (DEV):** align `fn_reset_unanswered_counter`'s reason literal with the DB writer (`'Offer expired'`), so expiry preserves the streak.

### F3 (B06, minor) — Copy deviation vs guide
- Guide expects: "Payment method declined. Please update your card." Actual app copy: "**Payment Hold Failed** / Payment failed: the card was declined. Try a different card or payment method." — friendly and clear; minor doc-drift note.

---

## Per-case execution traces

### TRD-TC-A02 — Accept-SP happy path — **PASS**
LEGO Star Wars Set `b3ab73b6` ($30, Accept-SP, node NULL — deep-linked). As test-buyer: offer screen → SP input 8 → "$22.00 cash + 8 SP, fee $1.49, tax $2.10, total cash $25.59" → clamp test (typed 16 → field clamped to **15**, "15 SP applied", total $18.59) → reset to 8 → Send Offer → Liability Disclaimer (checkbox checked, Accept) → "Trade Initiated! You saved $8.00 using SP! You have 20 SP left." As test-seller: Review Offer → "9 SP releasing in 2 days after completion" → Accept → "Offer Accepted! Payment captured. Trade is now in progress." As test-buyer: I Got It → Complete Trade → "Trade Complete! You saved $8.00 using SP! You have 20 SP left."
- **DB (offer):** trade `259238d9` pending, sp_amount=8, `sp_reserved_at` set; `sp_ledger` `754de609` spend_purchase **-8** (28→20) — the DT-19 reserve-ledger fix; wallet 28→20 avail / 10→18 reserved; LEGO counter 0→1.
- **DB (accept):** trade in_progress, SP stays reserved (18), `sp_transferred_at` NULL (accept-transfer deprecated per DT-17), auto_complete_at +72h.
- **DB (complete):** trade **completed**; buyer reserved **18→10** (8 consumed — **no stuck reserved balance**), lifetime_spent **23→31**; seller `pending_balance` **92→109** (+17); `sp_earned_at_completion`=**17** (8 buyer + 9 platform @1.20× multiplier); `pending_sp_release_at` 08-31; `sp_ledger` clean pair = spend_purchase -8 (buyer) + earn_reward +17 (seller "Trade completion"). ✓ Full SP settlement works end-to-end.

### TRD-TC-B02 — Offer expiry + seller ignore prompt — **FAIL (fresh finding)**
- Expiry leg: submitted SP offer (5 SP) on Roald Dahl `d4e7f599` → fast-clocked (guide method: `UPDATE trades SET offer_expires_at = NOW() + INTERVAL '5 seconds'` + `rpc_process_expired_offers`) → trade `4391d969` cancelled "Offer expired", `sp_released_at` set, SP restored (ledger spend_purchase -5 + earn_refund +5, net zero), buyer+seller `offer_expired` notifications sent. **Expiry mechanics work.**
- Expired-offer UI: buyer's "Your Offers" shows the pending LEGO offer + the DECLINED `2c1a5228` — the expired `4391d969` is **absent** (see F1). No EXPIRED badge / "Expired — Item still available" / View Item Again.
- Cash-only counter (DT-19 Fix 3): submitted a **cash-only** offer (SP=0) on Soccer Ball `c5393d5a` → trade `5b30d229` pending, sp_amount=0 → `listing_offer_stats.unanswered_offer_count` **0→1**. ✓ Fix 3 works.
- Counter streak: Roald Dahl count 0→1→0 on expiry (see F2 — streak accumulation broken).

### TRD-TC-B06 — Card declined at offer submission — **PASS**
Armed session-local toggle `xcrun simctl openurl booted "p2pkidsmarketplace://qa-dev-toggle?key=card_decline&value=hold_decline"` → as test-buyer, opened Kids Kindle `95c3552a` ($40) → Request to Buy → Send Offer (normal MASTERCARD •••• 4444) → disclaimer accepted → **"Payment Hold Failed / Payment failed: the card was declined. Try a different card or payment method."** (GlobalAlertProvider). No offer created (no new trade for `95c3552a`), no SP reserved (wallet unchanged 20/18/23), no crash. Toggle disarmed (`value=none`) after. The "valid card retry succeeds" leg is evidenced by the same session's A02/B02 successful offers with the same card.

---

## Design-system & copy compliance
- **Design tokens:** consistent — primary green `#5DBB8E` CTAs (Send Offer, Accept, Confirm pickup, I Got It, disclaimer Accept), red `#ff6b6b`/`#E85D75` decline/cancel/danger, disabled state on disclaimer Accept until checkbox, consistent spacing. No deviations found.
- **Compliant dialogs:** Liability Disclaimer (checkbox-gated Accept, resets to unchecked each reopen — I09 ✓), Accept Trade confirm, Complete Trade confirm, Offer Accepted, Payment Hold Failed alert — all styled per design-system-passitup.md.
- **Deviations:** (1) B06 decline copy differs from guide (F3, minor); (2) the Liability Disclaimer body is **Amazon commercial-insurance boilerplate** (pre-existing A04-class content finding, re-observed; not this batch's scope).

## Perceived load-time verdict
**GOOD** — all transitions (offer submit, accept, complete, disclaimer open/close, deep-link item loads) rendered within the <3s threshold. No screen flagged.

---

## 📋 QA Session Handoff

**Test Scope:** TRD-TC-A02, TRD-TC-B02, TRD-TC-B06 — re-verification of landed fixes (DT-17b/19/27 SP settlement, DT-19 expired-offer UI + cash-only counter, Task 25 card-decline toggle), executed on the iOS Simulator against staging.

**Design-System Compliance:** PASS — no design-token violations observed across the screens/dialogs visited (offer screens, disclaimer modal, accept/complete confirmations, decline alert, timeline). All colors/spacing/typography consistent with `docx/design-system-passitup.md`. Content note (pre-existing): Liability Disclaimer body is Amazon commercial-insurance boilerplate — out of this batch's scope.

**Perceived Load-Time Verdict:** GOOD — all observed transitions (offer submit, accept, complete, disclaimer open/close, deep-link loads) rendered within the ideal UX threshold (<3s). No screen flagged; dev-build cold-start treated as an environment artifact.

**Design & Copy Compliance Confirmation:**
- CONFIRMED — Make Offer screen (SP entry, clamp at 50%, breakdown $22 + 8 SP, fee $1.49, tax, total cash): layout and copy match.
- CONFIRMED — Liability Disclaimer modal: checkbox-gated Accept, resets to unchecked on reopen; design-system styled. Body content is 3rd-party boilerplate (pre-existing finding).
- CONFIRMED — Review Offer (seller): "$22 + 8 SP — Total $30", "9 SP releasing in 2 days after completion", payout breakdown.
- CONFIRMED — Accept Trade / Complete Trade confirmation modals: clear, correctly worded, single primary CTA.
- CONFIRMED — Trade Complete screen: "You saved $8.00 using SP! You have 20 SP left." + Rate Seller CTA.
- CONFIRMED — "Payment Hold Failed" alert (B06): friendly decline copy; DEVIATION vs guide's "Payment method declined. Please update your card." (F3, minor).
- CONFIRMED — Trade Timeline: In Progress status, "Confirm pickup — auto-completes in 71h", Payment Details (Payment authorized $22, Swap Points Used 8 SP, fee, tax, Total $25.59).

**Verdict Summary:** 2 PASS / 1 FAIL / 0 BLOCKED / 0 SKIPPED (of 3)

**Critical Findings:**
1. **F1 (HIGH, fresh)** — Expired offers still don't surface in buyer "Your Offers": client compares/filters `'offer_expired'` (snake) but the DB writes `'Offer expired'` (spaced) → the DT-19 Fix 2 expired branch remains dead; only the declined branch works.
2. **F2 (MEDIUM, fresh)** — `fn_reset_unanswered_counter` uses `'offer_expired'` (snake) vs DB `'Offer expired'` → resets the seller-ignore streak to 0 on expiry, so the 2-consecutive-unanswered-offer prompt can never fire.
3. **F3 (minor)** — B06 decline copy differs from the guide (both friendly).

**App State Left Behind:** Simulator logged in as **test-buyer** (Trade Timeline for completed LEGO trade). Test data created this run — trades: `259238d9` **completed** (A02, LEGO, 8 SP settled), `4391d969` **cancelled** (B02 expired, Roald Dahl, SP restored), `5b30d229` **pending** (B02 cash-only counter fixture, Soccer Ball; counter=1 — leave for cleanup/cancel next session). test-buyer wallet 20 avail / 10 reserved / 31 lifetime_spent; test-seller pending 109 (+17). `card_decline` toggle **disarmed**. LEGO `b3ab73b6` now sold/in-progress history; Soccer Ball `c5393d5a` still available (offer pending). No `.env`/config/data files modified.

**Why It Matters:** This run proves the P1 SP-settlement trigger fix (DT-17) works end-to-end — buyer SP consumed, seller credited, clean ledger pair, no stuck reserved balance — closing the original A02 FAIL. It also unblocks B06 via the Task 25 toggle (friendly decline, no side effects). B02's expiry mechanics + cash-only counter increment work, but the **expired-offer surfacing fix is incomplete** (a string-mismatch leaves the expired branch dead) and the **seller-ignore streak accumulation is broken** — both are fresh, scoped, dev-side fixes.

**How to Verify/Reproduce:**
- Evidence: `e2e-test-results/qa-trd-reverify-a02-b02-b06-2026-08-28/screenshots/` (`01-15*.png`).
- A02 settlement: complete any Accept-SP trade, then check `sp_wallets` (buyer reserved consumed), `sp_ledger` (spend_purchase + earn_reward pair), `trades.sp_earned_at_completion` (8+9=17 for the LEGO @1.2×).
- F1: fast-clock an offer to expiry (`rpc_process_expired_offers`), then open the buyer's Trades → Active → Your Offers — the expired offer is absent (only declined/pending show). Grep `TradeListScreen.tsx` L358 for `.in('cancellation_reason', [...])` and compare to the live `trades.cancellation_reason` value (`'Offer expired'`).
- F2: submit an offer on a listing (counter 0→1), fast-clock to expiry, then read `listing_offer_stats.unanswered_offer_count` — it resets to 0 instead of staying 1.

**Known Gaps / Not Tested:** B06's "update to a valid card and retry" UI leg not re-driven end-to-end (the same card demonstrably succeeds in A02/B02 this session; toggle is fail-closed when unarmed). B02's reminder pushes (6h/1h) and the actual seller-ignore modal UI not re-driven (the counter/streak mechanics were DB-verified; push delivery is the Playwright/notification path).

**What Needs To Be Fixed Next:**
1. **F1:** Align the expired-offer `cancellation_reason` literal between the client and the DB writer — change `TradeListScreen.tsx` L358/L569/L573 from `'offer_expired'` to `'Offer expired'` (or normalize the RPC to snake) so expired offers surface with the EXPIRED badge + View Item Again.
2. **F2:** Fix `fn_reset_unanswered_counter` (and any other `'offer_expired'` literal) to match the DB's `'Offer expired'` so the seller-ignore streak accumulates across consecutive expired offers.
3. **F3 (optional):** reconcile the B06 decline copy with the guide.
4. Cleanup: cancel/expire the leftover pending Soccer Ball offer `5b30d229` (test-buyer) next session to restore the counter baseline and free the cap slot.

**UX Enhancement Ideas (optional, not defects):** On the offer screen the SP balance line showed "20 SP left" as the post-reserve available — consider labeling it "available" explicitly ("20 SP available") to avoid any ambiguity between reserved and available, since parents may misread "left" as total points.
**Suggested Next Session:** Re-verify B02 once F1/F2 land (expired offer surfacing + 2-consecutive seller-ignore prompt), then continue the TRD queue (B03 competing offers / B05c bundle-slot remain from the original batch).
**Suggested to Improve Agent Rules:** Add a playbook note that `cancellation_reason`-style DB enums are written with display strings (`'Offer expired'`) by DB RPCs while some client/trigger code compares snake literals — a cross-layer string-mismatch is a recurring bug class worth a dedicated grep during source pre-reads (grep both `'offer_expired'` and `'Offer expired'` before judging a surfaced/expired UI case).
