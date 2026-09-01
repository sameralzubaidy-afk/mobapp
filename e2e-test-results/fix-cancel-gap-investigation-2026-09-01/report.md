# FIX-CANCEL Gap Investigation — Source + On-Device Report

**Date:** 2026-09-01
**Scope:** Does a buyer have ANY way to cancel an in-progress trade (single-item or bundle) anywhere in the app? Documentation only — no code changes.
**Method:** Source trace → on-device verification (iOS Simulator, iPhone 17 Pro Max) → lifecycle scoping.
**Evidence:** `screenshots/` in this folder (8 captures).

---

## 1. Source-code trace

### 1.1 There is exactly ONE live trade-detail screen
Both route names `TradeDetail` and `TradeTimeline` are wired to the **same** component, `TradeTimelineScreen`:

- `p2p-kids-marketplace/src/navigation/AppNavigator.tsx` L668–674 — `name="TradeDetail" component={TradeTimelineScreen}` and `name="TradeTimeline" component={TradeTimelineScreen}`.
- `TradeDetailScreen.tsx` (which contains its own cancel button at L475) is **dead code** — a repo-wide import search returns nothing; it is never rendered. Any cancel logic in it is unreachable.

So the buyer/seller action set is fully determined by `TradeTimelineScreen.tsx`.

### 1.2 The cancel buttons and their gating conditions (`TradeTimelineScreen.tsx`)
| Action (testID) | Condition to render | Buyer in_progress? |
|---|---|---|
| `confirm-trade-button` (L1583) "I Got It — Complete Trade" | `isBuyer && status==='in_progress' && auto_complete_at` (L1574) | ✅ shown |
| `report-problem-button` (L1608) "Report Problem" | same buyer in_progress block, hidden if `hasUnresolvedDispute` | ✅ shown |
| `cancel-trade-button` (L1627) "Cancel Trade" | `status==='pending' && (!isSeller \|\| cash_amount_cents===0)` (L1621) | ❌ **never** (pending only) |
| `seller-cancel-inprogress-button` (L1648) "Cancel Trade" | `isSeller && status==='in_progress' && !hasUnresolvedDispute` (L1639) | ❌ seller-only |

Key consequence: **the buyer-facing cancel button (`cancel-trade-button`) is gated to `status === 'pending'` only.** For a buyer, once the trade leaves `pending` and enters `in_progress`, no cancel control renders. There is no bundle-specific branch anywhere — bundle trades use the same four gates (bundle logic only changes what happens *after* Cancel is tapped: the bundle-wide vs. just-this-one prompt in `handleCancellationConfirm`, L577–611).

- There is **no kebab/overflow menu, no swipe action, no long-press action** on the trade screen (grep for `kebab|more-button|overflow|Menu` → none).

### 1.3 Dispute state — neither party can cancel from the app
- "Report Problem" opens `IssueReportModal` → invokes the `open-dispute` Edge Function. Comment at L1893: *"TFV2-011: Issue report modal (D-26 — does NOT cancel trade)"*.
- During an unresolved dispute (`dispute_status` not in `none`/`resolved`, L714–716): the buyer's confirm button is **disabled** (L1580), the Report Problem button is **hidden** (L1602), and the seller's cancel button is **hidden** (`!hasUnresolvedDispute`, L1639). → During a dispute, **neither** role has a cancel control in the app; disputes are resolved by the team/admin (refund / seller-cancel / admin force-cancel).

### 1.4 Server-side capability vs. UI exposure (`supabase/functions/cancel-trade/index.ts`)
- Permission (L66): caller must be the **buyerId OR sellerId**.
- Allowed statuses (L71): `['pending','payment_failed','in_progress']`.
- ⚠️ So the **backend would accept** a buyer-initiated cancel on an `in_progress` trade — but **no UI path exposes that** to a buyer. This is a pure UI-surface gap, not a backend permission gap. (A `payment_failed` trade likewise has no buyer cancel button even though the server allows it.)

### 1.5 Where the buyer's cancel *does* exist (lifecycle scoping)
- **Pending offer (buyer's own, pre-acceptance):** `cancel-trade-button` renders at `status === 'pending'` for the buyer. Reached from My Trades → Your Offers → offer card → TradeDetail (→ TradeTimelineScreen). There is **no** direct Withdraw button in the offers list itself (`TradeListScreen.tsx` buyer offer cards only have "View Details").
- **Seller's pending offers:** declined via `ReviewOfferScreen` (Accept/Decline); bundles get Accept All / Decline All directly in the list (`TradeListScreen.tsx` L1390–1450).
- **CancellationReasonModal** (`src/components/molecules/CancellationReasonModal.tsx`) only offers reasons when the role/status is cancellable: `SELLER_INPROGRESS_REASONS` (seller in_progress) or `BUYER_OFFER_REASONS` (buyer pending) — otherwise `undefined` (no cancel at all).

---

## 2. On-device verification

All on iOS Simulator (iPhone 17 Pro Max). Buyer = test-buyer (Kids Club+); seller = test-seller. Screenshots in `screenshots/`.

### 2.1 Buyer, in-progress SINGLE-item trade — **NO cancel**
- Trade `c0d12340…` "Kids Bicycle - 20 inch" ($20, auto-completes in ~53h).
- Full action set: **Request More Time** (extension), **Message Seller**, **I Got It — Complete Trade** (confirm), **Report Problem**. Verified before and after scrolling; element-tree grep for `cancel` returns 0.
- Evidence: `01-buyer-single-inprogress-full-actions.png`, `01b-buyer-single-inprogress-scrolled.png`, `06-buyer-single-inprogress-same-trade-as-seller.png` (test-buyer view).

### 2.2 Buyer, in-progress BUNDLE trade — **NO cancel**
- Bundle `9f158945…` (3 items, "Test new tax 1", $100) on an active buyer session.
- Full action set: **Request More Time**, **Message the seller**, **I Got It — Complete Trade**, **Report Problem**, **View all items**. Verified before and after scrolling — no cancel.
- Evidence: `02-buyer-bundle-inprogress-full-actions.png`, `02b-buyer-bundle-inprogress-scrolled.png`.

### 2.3 Seller, in-progress SINGLE trade — **Cancel IS present** (asymmetric)
- Trade `c0d12340…` (same trade as §2.1, viewed as test-seller).
- Action set: **Cancel Trade** (`seller-cancel-inprogress-button`), **Message Buyer**, payout-on-hold notice. **No** "I Got It" confirm (buyer-only), **no** Report Problem.
- Evidence: `03-seller-single-inprogress-CANCEL-present.png`.

> **Direct same-trade comparison:** on `c0d12340…`, the buyer (test-buyer) has **no** cancel; the seller (test-seller) **does**. This is a confirmed asymmetric capability, not a side effect of different trades.

### 2.4 Seller, in-progress BUNDLE — source-verified (not on-device)
- The seller cancel button's render condition (`isSeller && status==='in_progress' && !hasUnresolvedDispute`, L1639) has **no bundle-specific branch** — it renders identically for single and bundle trades. The only bundle difference is the post-tap scope prompt (cancel whole bundle vs. just this one, `handleCancellationConfirm` L577–611).
- On-device verification was not possible because **neither test-buyer nor test-seller currently has an in-progress bundle** on staging (test-seller's bundle offers are still pending — see `04-seller-mytrades-overview.png`); creating one would require accepting pending offers (a state mutation out of scope for this documentation task).

### 2.5 Buyer, PENDING offer — **Cancel IS present** (the withdrawal path)
- Buyer (test-buyer) pending bundle offer `f7a5979d…` "Soccer Ball & Goal Set" ($12, "Awaiting Seller").
- Action set: **Cancel Trade** (`cancel-trade-button`) + Payment Details. No confirm, no Report Problem (correct — those are in-progress-only).
- Evidence: `05-buyer-pending-offer-CANCEL-present.png`.

---

## 3. Final verdict

**Confirmed — no cancel capability exists for the BUYER on in-progress trades (both single-item and bundle) once the offer has been accepted (trade status `in_progress`).**

- The buyer's **only** cancel window in the entire trade lifecycle is while their offer is **still pending** (before the seller accepts) — at that point the buyer can withdraw with "Cancel Trade" (on-device verified).
- Once the trade is **in progress**, the buyer can only: request one pickup-window extension, message the seller, report a problem (opens a dispute — which does **not** cancel), or complete the trade.
- **Asymmetric:** the **seller** *can* cancel an in-progress trade (on-device verified for single-item; identical gating per source for bundle).
- During a **dispute**, **neither** role can cancel from the app.
- The backend (`cancel-trade` EF) would accept a buyer cancel on `in_progress`, but **no UI path exposes it** — so this is a **real, UI-level product gap** (buyer has no self-service way to back out of an in-progress trade), not a backend permission issue.

**What this report is for:** a future decision on whether to add a buyer cancel control for in-progress trades (or document the current behavior as intentional) should be made against these findings — I am deliberately not making that product recommendation here (out of scope).

---

## Appendix: File/line references
- `src/navigation/AppNavigator.tsx` L668–674 — both trade routes → `TradeTimelineScreen`; `TradeDetailScreen.tsx` unused.
- `src/screens/trade/TradeTimelineScreen.tsx` — L1574 (buyer in_progress block), L1583 (`confirm-trade-button`), L1608 (`report-problem-button`), L1621/L1627 (pending `cancel-trade-button`), L1639/L1648 (seller in_progress `seller-cancel-inprogress-button`), L577–611 (bundle cancel scope), L714–716 (`hasUnresolvedDispute`), L1893 (report ≠ cancel).
- `src/screens/trade/TradeListScreen.tsx` — buyer offer cards → "View Details" only; seller Accept/Decline (+ bundle Accept All / Decline All) L1390–1450.
- `src/components/molecules/CancellationReasonModal.tsx` — reason sets gated by role/status.
- `supabase/functions/cancel-trade/index.ts` — L66 (party permission), L71 (allowed statuses).
