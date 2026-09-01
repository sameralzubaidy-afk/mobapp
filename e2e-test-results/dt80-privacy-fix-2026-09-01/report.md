# DEV-TASK-80 — Remove Buyer Payment Method Disclosure from Seller's Review Offer (privacy fix)

**Date:** 2026-09-01 · **Change Classification:** C (UI-only, read-path removal) · **Flow:** FLOW-08 (Review Offer — seller view)
**Device:** iPhone 17 Pro Max sim (UDID `3F3293A3-C4B7-43FE-AD67-A2C4B82B4A0E`, iOS 26.1)
**App:** Pass It Up! (`com.sameralzubaidi.p2pmarketplace`) dev build · **Backend:** Supabase staging `drntwgporzabmxdqykrp`

## What changed

- `p2p-kids-marketplace/src/screens/trade/ReviewOfferScreen.tsx` — removed the `review-buyer-payment-method` card ("Buyer pays via {BRAND} •••• {last4} (authorized)") entirely. This was a single shared render block covering both the single-offer and bundle-offer paths. Also removed the `stripe_payment_method_brand`/`stripe_payment_method_last4` columns from the screen's `trades` SELECT and from the local `OfferData` type (read-path removal — the seller's device no longer fetches the buyer's card data), removed the now-unused `CreditCard` import and the `paymentMethodCard`/`paymentMethodText` styles.
- `supabase/functions/create-trade-offer/index.ts` — updated the two capture-site comments to reflect the new intent: fields are captured for **admin/support/dispute** purposes only, NEVER surfaced to the seller. No logic changed.
- `docs/flow-registry.md` — added the DEV-TASK-80 registry entry.

## What was NOT changed (per requirements)

- `trades.stripe_payment_method_brand` / `stripe_payment_method_last4` columns — stay in the DB.
- Offer-time capture + capture-at-completion logic in `create-trade-offer` — unchanged.
- `TradeTimelineScreen.tsx` buyer-only refund "Refunded to" display — untouched (buyer sees their OWN payment method; the seller-side refund note already shows no payment details).
- No placeholder/replacement payment copy was added.

## Scope check (no other seller-facing surface)

Repo-wide grep of `stripe_payment_method_brand`/`stripe_payment_method_last4`:
- `ReviewOfferScreen.tsx` — removed (this task).
- `TradeTimelineScreen.tsx` — buyer-only refund card, gated `{showRefundSection && isBuyer && ...}` (not seller-facing).
- `src/types/trade.ts` — shared type (data layer).
- `supabase/functions/create-trade-offer/index.ts` — write path (kept).
- `supabase/migrations/20260830235900_dev_task_69_trade_payment_method.sql` — DDL (kept).
- `src/screens/trade/__tests__/TradeTimelineScreen.test.tsx` — mocks for the buyer-only refund card (kept).

No other screen surfaces a buyer's payment method to a seller.

## Guide sync

`cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` — verified the guide NEVER codified the disclosure as expected Review Offer copy: its Review Offer sections (TRD-TC-L06/L07, T08/T09/T10) describe the offer card, bundle list, per-item SP breakdown, payout card and "Includes points redemption" tag, but no payment-method row; the only `stripe_payment_method_brand`/`last4` reference (line 3334) is the BUYER's refund card "Refunded to". No guide edit required. The QA Task 12/13/14/16 "Design & Copy Compliance" mentions live in the historical `e2e-test-results/` QA reports, which are records of what was observed at the time — left untouched.

## Tier 0

- Mobile `yarn typecheck` — PASS
- Scoped `eslint src/screens/trade/ReviewOfferScreen.tsx` — 0 errors
- Prettier `--check src/screens/trade/ReviewOfferScreen.tsx` — PASS
- `deno check --no-lock create-trade-offer/index.ts` — PASS (comment-only change)

No Tier 1/2 required (classification C — no server-side logic / DB / EF-write change).

## Evidence (before / after)

Before (row present) — from `e2e-test-results/qa-task16-close-trd-2026-08-31/screenshots/`:
- `A1-reviewoffer-kids-bicycle-payout-card.png` (bundle offer — Kids Bicycle; showed "Buyer pays via MASTERCARD •••• 4444 (authorized)")

After (row gone), this run — `e2e-test-results/dt80-privacy-fix-2026-09-01/screenshots/`:
- `DT80-after-single-offer-reviewoffer.png` (single-item offer — Soccer Ball & Goal Set): Buyer Offers → Your Payout → Safety Disclaimer → buttons. **No payment row.**
- `DT80-after-bundle-offer-kids-bicycle-payout-card.png` (bundle offer — Kids Bicycle): SP info card ("61 SP releasing in 2 days") → Your Payout (Cash $15.00, Fee −$3.00, +61 SP, Net $12.00) → Safety Disclaimer → buttons. **No payment row** (same view as the before screenshot, minus the payment card).

Both AX trees confirmed no `review-buyer-payment-method` / "Buyer pays via" element on either view.
