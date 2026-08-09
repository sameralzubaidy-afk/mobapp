# MODULE-15.1.2 TradeFlowV2 — DEFERRED Manual Testing

**Purpose:** Test cases for features **not yet implemented** in the Kids P2P Marketplace  
**Source:** Extracted from `misc./MODULE-15.1.2-TradeFlowV2-MANUAL-TESTING.md` on 2026-06-07  
**Status:** Deferred pending feature implementation  
**Do not run these tests** — they will fail because the features are not built

---

## Deferred Test Cases Index

| TC# | Feature | Reason Deferred |
|---|---|---|
| TC-A03 | Platform SP reward for cash-only trades | Current implementation: NO platform SP rewards for cash-only transactions (regardless of listing payment preference) |
| TC-A04 | Donate listings | Donate payment preference not implemented |

---

## TC-A03 · Accept SP listing: buyer pays cash (0 SP) — subscriber seller earns platform SP

**Ref:** TRADING-FLOW-V2 §7 Scenario S4  
**Actors:** test-buyer (subscriber) + test-seller (subscriber)  
**Status:** ❌ **DEFERRED** — Current implementation does not award platform SP for cash-only transactions

**Objective:** Verify that an Accept SP listing paid fully in cash still grants the seller platform SP, with no buyer SP used.

**Implementation Gap:**  
The spec expects sellers to receive platform SP rewards when a buyer pays cash on an "Accept SP" listing. The current implementation does **not** award platform SP for any cash-only transaction, regardless of the seller's payment preference.

**Steps:**
1. Log in as **Buyer** and open an **Accept SP** listing.
2. Tap **[Request to Buy]** (do not use the SP slider) and submit the offer.
3. Log in as **Seller** and accept the offer.
4. Log in as **Buyer**, open the trade, and tap **[I Got It]** → **[Confirm]**.

**Expected Result (per spec):**
- The offer preview shows "$[price] cash, 0 SP" and no SP is reserved from the buyer.
- The seller is charged the full cash amount.
- After completion, the seller's completion screen shows the platform SP reward added to their pending wallet ("[platform_sp] SP releasing in [N] days (platform reward)") with a [View Wallet] button; no buyer SP is involved.

**Actual Current Behavior:**
- No platform SP is awarded when buyer pays cash-only (0 SP used), even on "Accept SP" listings.

---

## TC-A04 · Donate listing: [Claim] button, no charge

**Ref:** TRADING-FLOW-V2 §4.2  
**Actors:** Any buyer + test-seller  
**Status:** ❌ **DEFERRED** — Donate payment preference not implemented

**Objective:** Verify a donate listing can be claimed with no payment and no SP.

**Implementation Gap:**  
The "Donate" payment preference feature is not implemented. Sellers cannot set listings as "Donate" and buyers cannot claim items for free.

**Steps:**
1. Log in as **Buyer** and open a **Donate** listing.
2. Tap **[Claim]**.
3. Open the trade and complete it through the normal timeline flow.

**Expected Result (per spec):**
- Only a **[Claim]** button is shown (no "Request to Buy", no "Use SP").
- No payment is taken and no card is charged.
- The trade follows the same timeline; no SP is earned because there is no cash transaction.

**Actual Current Behavior:**
- Donate listings cannot be created; the feature does not exist in the current implementation.

---

## When to Re-activate These Tests

**TC-A03** can be moved back to the active test suite when:
- Platform SP reward logic is implemented for cash-only transactions on "Accept SP" listings
- Backend RPC `complete_trade` awards platform SP based on listing `payment_preference`, not just `sp_amount > 0`
- Completion screen shows platform SP pending notice for cash-only transactions

**TC-A04** can be moved back to the active test suite when:
- Donate payment preference is added to the `items.payment_preference` enum
- Listing creation screen includes "Donate" option
- Trade flow supports zero-price transactions with a `[Claim]` button
- Backend does not require payment authorization for donate listings

---

## Related Implementation Notes

- Current SP reward logic: SP is only awarded when `sp_amount > 0` (buyer used SP)
- To implement TC-A03: Add platform SP calculation based on `listing.payment_preference = 'accept_sp'` AND `total_price > 0`, independent of buyer SP usage
- To implement TC-A04: Add `donate` enum value, update trade creation to skip payment, update UI to show `[Claim]` instead of `[Request to Buy]`
