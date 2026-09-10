# FIX-Task-10 — Seller Cancel Pin + Guard-Modal Copy + D03 Guide Reconciliation

**Date:** 2026-09-10
**Source:** QA Task TRD-Expanded, 2026-09-09
**Change classification:** C (mobile UI / copy only — no DB, EF, money, or state-machine change) + docs
**Impacted flows:** FLOW-08 (Trade Flow — timeline actions), FLOW-04/FLOW-06 (Item Detail guard modal copy)

---

## 1. Pin the seller's Cancel control above the fold — ✅ DONE (verified on iOS + Android)

**What changed** — `p2p-kids-marketplace/src/screens/trade/TradeTimelineScreen.tsx`

| # | Location | Change |
|---|---|---|
| a | L~977 | new derived flag `showPinnedSellerCancelCta = isSeller && trade.status === 'in_progress' && !hasUnresolvedDispute`, plus `hasPinnedFooter = showPinnedBuyerCompleteCta \|\| showPinnedSellerCancelCta` |
| b | L~1047 | `contentContainerStyle` now applies `contentWithPinnedCta` (paddingBottom 210) when **either** footer is present |
| c | L~2113 | the in-scroll seller `Cancel Trade` action block was **removed** (comment left in place pointing to the pinned footer) |
| d | L~2250 | new **pinned footer** containing the same `seller-cancel-inprogress-button` pressable, `bottom: insets.bottom + TAB_BAR_FOOTER_CLEARANCE` (84), reusing `styles.pinnedFooter` |

The buyer's `confirm-trade-button` pinned footer is untouched and the two footers are mutually exclusive (`isBuyer` vs `isSeller`), so exactly one can render.

**On-device verification (AX-tree + screenshots):**

| Platform | `seller-cancel-inprogress-button` AX bounds | Floating pill/tab band | Verdict |
|---|---|---|---|
| iOS 26.1 (iPhone 17 Pro Max) | y **786–834** | tabs y ≥ 848 | ✅ fully above the pill, no scroll needed |
| Android 16 (Medium_Phone_API_36.1) | y **1980–2106** | tabs y ≥ 2169 | ✅ fully above the pill, no scroll needed |

- Seller timeline, iOS, no scrolling: `ios-seller-cancel-pinned-inprogress.png`
- Seller timeline, iOS, scrolled to the bottom (button stays pinned): `ios-seller-cancel-pinned-scrolled-to-bottom.png`
- Seller timeline, Android, no scrolling: `android-seller-cancel-pinned-inprogress.png`

**Buyer pinned-CTA regression check (no regression):**

| Platform | Result | Evidence |
|---|---|---|
| iOS | `I Got It — Complete Trade` pinned and visible without scrolling; no seller `Cancel Trade` rendered | `ios-buyer-pinned-cta-regression-check.png` |
| Android | same | `android-buyer-pinned-cta-regression-check.png` |

---

## 2. Guard-modal label consistency — ✅ DONE (verified on-device)

Canonical wording chosen: **"Go to Trade History"** (the button label; it is the more explicit/actionable form).

| File:line | Before | After |
|---|---|---|
| `p2p-kids-marketplace/src/screens/home/ItemDetailScreen.tsx:1137` | "…Open Trade History to view your current trades." | "…**Go to Trade History** to view your current trades." |
| `p2p-kids-marketplace/src/services/trade.ts:466` | "…Open Trade History to continue." | "…**Go to Trade History** to continue." |

The second line is the same copy class surfaced by `TradeOfferScreen`'s error modal (swept in the same session per the copy-consistency class rule).

**On-device confirmation (Android, test-buyer tapping Request to Buy on an item with an active offer):**
`android-guard-modal-copy.png` — body reads "You already have an active offer on this item. **Go to Trade History** to view your current trades." with primary button **Go to Trade History**. Body and button now match.

---

## 3. D03 guide reconciliation (docs only) — ✅ DONE

`cross-checked-and-consolidated/MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md`

| Line | Change |
|---|---|
| ~1222 | Steps: stale thresholds ">12h, 6–12h, 2–6h, <2h" → **">6h, 2–6h, ≤2h, and after expiry"** |
| ~1225 | Expected Result: "Green >12h / amber 6–12h / orange 2–6h / red <2h / gray" → **Blue `#EFF6FF` (>6h) · Amber `#FFFBEB` (≤6h) · Red `#FEF2F2` (≤2h) · Gray `#F8FAFC` "Expired"** |
| ~1227 | Added a QA flag noting the Offers-tab list rows render plain text while the pill renders on the Review Offer header (open product decision, not a colour/threshold defect) |
| ~403 | TRD-TC-A01 Expected Result: "a green countdown pill" (same copy class, stale) → corrected to the plain-text row + pill-on-Review-Offer-header wording |

Verified against the shipped component: `src/components/trade/OfferCountdownPill.tsx` (fill colours `#EFF6FF` / `#FFFBEB` / `#FEF2F2` / `#F8FAFC`) and `src/components/trade/countdown.ts` (`minutesLeft <= 120` → critical, `<= 360` → warning, else normal; expired → "Expired").

Index/summary rows for D03 (L54, L6942) are title-only and carry no colours/thresholds, so no index edit was required.
Archive/backup copies (`archive/misc./…`, `scripts/backups/…`, root `DEPRECATED - …`) were deliberately NOT touched — `cross-checked-and-consolidated/` is the single canonical copy.

---

## Regression

- **Tier 0 — PASS**
  - `npm run typecheck` → exit 0
  - `npx eslint src/screens/trade/TradeTimelineScreen.tsx src/screens/home/ItemDetailScreen.tsx src/services/trade.ts` → **0 errors** (13 pre-existing warnings)
  - `npx jest src/screens/trade/__tests__/TradeTimelineScreen.test.tsx` → **29/29 pass**
  - `npx jest src/services/__tests__/trade.test.ts src/services/__tests__/tradeServiceV2.test.ts src/utils/__tests__/tradeCancellationCopy.test.ts` → **49/49 pass**
- **Tier 1 — PASS** (UI-only change, but the deliverable required on-device evidence): seller pin + buyer regression + guard-modal copy driven live on iOS 26.1 and Android 16 (see §1/§2 evidence).
- **Tier 2 — not required** (no DB/EF/webhook change).

## Staging state left behind (for the next session / QA)

To verify item 1 a real seller `in_progress` trade had to exist — **none did** for any seller persona, so one was created through the real UI:

- **Trade** `5abee860-17e2-4d8c-9db0-f95420053fde` — listing **Building Blocks Bucket** (`0aa627e5-00a2-483e-ae84-271f373fe673`, $20, cash-only), buyer **test-buyer**, seller **test-seller-3**, status **in_progress**, 0 SP used, Stripe test-mode authorization hold.
- This is a **useful standing fixture** for any future re-verification of this fix (a seller-side in_progress timeline). To clear it, log in as `test-seller-3` → My Trades → the trade → the now-pinned **Cancel Trade** control.
