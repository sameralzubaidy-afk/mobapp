# QA TRD FINAL CLOSURE round — 2026-09-13 (Android `Medium_Phone_API_36.1`)

Run folder: `e2e-test-results/qa-trd-closure-2026-09-13/` (`report.md`, `ledger.md`, 30 screenshots).

## Outcome
**16 TRD status flips.** TRD is now **285 PASS / 12 PARTIAL / 1 OPEN / 13 DOC-DRIFT / 6 SKIPPED / 16 Remaining = 333 ✓**
(was 277/28/0/9/3/16). Every non-PASS row now carries an explicit named reason.

- → PASS (8): B02, M16, M18, O1-C16, S03, S10, S12, S15
- → DOC-DRIFT (4): O3-C14, P02, P03, T11
- → SKIPPED = permanent env limitation (3): H05, O2-C10, O3-C04
- → OPEN/BLOCKED (1): S19

## Durable facts learned
- **A transient (<3 s) UI state CANNOT be caught by tap→screenshot** — the MCP round-trip is ~3 s and the `SuccessToast` window is 2.5 s (`SuccessToast.tsx` default `duration = 2500`). **Working technique = R108 extended from logs to transient UI:**
  `mobile_batch_commands = [trigger tap] + N × mobile_get_orientation + mobile_save_screenshot`
  — **N≈3 catches mid-animation, N≈6 catches the settled state.** Verified twice.
- **`view_image` DOWNSCALES frames**: a 1080×2400 capture displays at 880×1956. Deriving tap coordinates from the *displayed* image produced a real miss (Clear-Basket confirm). **Tap coordinates must come from the AX tree only.** AX px ARE 1:1 with the PNG file — the mismatch is display-only.
- A bare-coordinate `mobile_click_on_screen_at_coordinates` silently no-ops more often than a **ref** click on this emulator (re-confirmed).
- A batch's in-line screenshot/read is **pre-render** (R95 re-confirmed twice).
- An **unsolicited full JS bundle reload** can hit mid-session (blank + spinner → Home, ~15–20 s, session preserved). Not an app defect; note it, don't chase it.
- Android `logcat -d -t 800 -s ReactNativeJS` **retains the buffer**, so you can read a JS log line AFTER the fact (no live streaming needed). This closed the `test-admin` login diagnosis in one call.

## Fixture / persona facts (staging, verified this round)
- **`test-admin` persona credential is STALE** — `qa-login-as?persona=test-admin` → `INVALID_CREDENTIALS` 3/3 ×2 rounds; the handler then **clears the half-switched session and routes to Landing**. ⇒ **no admin-persona mobile session is obtainable.** Blocks A3 + any admin-persona mobile case. Fix = update the password in `src/services/qaPersonas.ts`.
- **`test-seller-2`'s 3 listings carry `node_id = NULL`** ("Board Game Set" `3bb99d59`, "Children's Dictionary" `5d6f0b4a`, "Science Kit" `0fe228ee`). Discover search returns **0 results** for their exact titles with **Show All Nodes both Off and ON**, and no listing deep-link is registered ⇒ **they are unreachable from the UI entirely** (blocks S19; also means they can't be bought/offered on). Fix = assign `node_id` in `seedSeller2`.
- **Sellers with exactly 1 available+approved listing in node `550e8400-…` do exist** (e.g. `2b1246c6…` "Hood Raincoat Hoodie" $20, `0a438eff…`, `db71e4d8…`) — **S03/S15 need no new fixture.**
- **Sellers with exactly 2** in that node: `93c3b2bd…` ("Test first pack 2/3"), `9d2596fe…`, `b219a7c9…`, `bfaa272d…` ("Pocket Button Active Shorts" $30 + "Leather Steel-toe boot Work boots").
- Searchable via Discover but **hidden unless Show All Nodes is On**? No — `bfaa272d`'s + `93c3b2bd`'s items returned under "Show All Nodes: On".

## Behavioural facts verified on-device
- **Item Detail renders "Add" (`add-to-cart-button`) ONLY when the seller has ≥1 other listing** (`sellerOtherCount >= 1`); at 0 it renders `request-to-buy-button` only, plus no `more-from-seller-cta` and no bundle microcopy. Same gate hides the basket's "more from this seller" banner (count = seller listings − listings in cart).
- **The basket's CTA is a single control** — `bundle-cta-button` (≥2 items) / `single-item-cta-button` (1 item); the old **"regular Checkout" button was REMOVED** (source comment *"CART-009: validation gate moved from removed Checkout button"*). `bundleMode` is derived as `cartItems.length >= 2`. ⇒ TRD-TC-S10's step 1 is **DOC-DRIFT**; its assertion is drivable via the single CTA.
- **Bundle vs single checkout**: "📦 Combined Offer" banner present at 6 items, absent at 1.
- A successful single-item cash-only offer produced **exactly 1** trade with `cash_amount_cents` 3000, `buyer_transaction_fee_cents` 149, `sp_amount` 0, `disclaimer_acknowledged=true`, and emptied `cart_items`.
- **Basket tab badge is STALE after checkout** (badge 1 while `cart_items` = 0, DB-verified) — clears on a Basket remount.
- `clear-basket-button` a11y label reads **"Clear basket, removes all 1 items"** (no singular form).
- The **Clear Trade Basket confirm** is an in-app branded modal (green-outline Cancel + danger-red filled confirm) — design-system compliant.
- The **Liability Disclaimer body is still the verbatim Amazon Services Business Solutions Agreement** insurance text (captured in the AX dump; already a standalone CRITICAL).

## Admin-portal facts
- **No bulk tax-node update UI exists.** The portal's only bulk affordance is `categories/components/BulkActionsDropdown` (Activate/Deactivate/Delete/Export) ⇒ TRD-TC-P02 DOC-DRIFT.
- **No per-node tax change-history UI.** The only version-history UI is `tax/rules` ("Version History by Category") = **rule**-version history ⇒ TRD-TC-P03 DOC-DRIFT.
- `tax/category-mapping/page.tsx:341` — Save is `disabled={… || !editValue}`; the empty-dropdown path is **disabled, not a silent no-op** (FIX-Task-20 F6) ⇒ TRD-TC-O1-C16 PASS.
- The mobile `AdminDashboardScreen` now has **zero literal hex** (shared `ui/Button variant="primary"`, `testID="admin-run-mid-trade-check"`, info icon `#5B8FB9`) — FIX-Task-29 A3 source-verified.
