# Manual Test Cases: TRADE-V2-002 Initiate Trade

**Module:** MODULE-06-TRADE-FLOW-V2  
**Feature:** Initiate Trade with Subscription & SP Context  
**Status:** Ready for Verification  

---

## Test Environment Setup
1. **App:** `p2p-kids-marketplace`
2. **User A (Subscriber):** A user with `subscription_status = 'active'` or `'trial'`.
3. **User B (Free):** A user with `subscription_status = 'free'`.
4. **Test Item:** An active listing with a price (e.g., $10.00 / 1000 cents).

---

## TC-01: Subscriber Fee Verification ($0.99)
**Goal:** Verify that Kids Club+ members are charged the discounted platform fee.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 1 | Log in as **User A** (Subscriber). | User is logged in. |
| 2 | Navigate to an item detail screen (not owned by User A). | Item details are displayed. |
| 3 | Tap **"Buy Now"**. | Navigates to **Trade Initiation** screen. |
| 4 | Inspect the **"Platform Fee"** line item. | Fee is displayed as **$0.99**. |
| 5 | Verify the total cash amount. | Total = Item Price + $0.99. |

---

## TC-02: Free User Fee Verification ($2.99)
**Goal:** Verify that free users are charged the standard platform fee.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 1 | Log in as **User B** (Free User). | User is logged in. |
| 2 | Navigate to an item detail screen (not owned by User B). | Item details are displayed. |
| 3 | Tap **"Buy Now"**. | Navigates to **Trade Initiation** screen. |
| 4 | Inspect the **"Platform Fee"** line item. | Fee is displayed as **$2.99**. |
| 5 | Verify the total cash amount. | Total = Item Price + $2.99. |

---

## TC-03: Swap Points (SP) Clamping (50% Cap)
**Goal:** Verify that users cannot apply more than 50% of the item price in SP.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 1 | Log in as **User A** (Subscriber) with at least 1000 SP. | User is logged in. |
| 2 | Navigate to an item priced at **$10.00** (1000 cents). | Item details are displayed. |
| 3 | Tap **"Buy Now"**. | Navigates to **Trade Initiation** screen. |
| 4 | Attempt to increase SP amount using the "+" button. | SP amount stops increasing at **500 SP** ($5.00). |
| 5 | Verify the price breakdown. | Cash amount decreases as SP increases, but never below $5.00 + $0.99 fee. |

---

## TC-04: SP Balance & Eligibility
**Goal:** Verify SP controls are only available when applicable.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 1 | Log in as **User B** (Free User). | User is logged in. |
| 2 | Navigate to **Trade Initiation** screen for any item. | SP controls are disabled or hidden (Free users cannot use SP). |
| 3 | Log in as **User A** (Subscriber) with **0 SP**. | User is logged in. |
| 4 | Navigate to **Trade Initiation** screen. | SP controls show "0 SP available" and "+" button is disabled. |

---

## TC-05: Successful Trade Initiation
**Goal:** Verify the end-to-end flow and database record creation.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 1 | Log in as **User A** (Subscriber). | User is logged in. |
| 2 | Navigate to **Trade Initiation** screen for an item. | Screen loads correctly. |
| 3 | Apply some SP (e.g., 200 SP). | Breakdown updates correctly. |
| 4 | Tap **"Confirm & Initiate Trade"**. | Button shows loading state, then navigates to **Trade Success** screen. |
| 5 | Tap **"View My Trades"** (if implemented) or check DB. | A new trade record exists with `status = 'pending'`, correct `cash_amount_cents`, and `sp_amount`. |

---

## TC-06: Navigation Integrity
**Goal:** Verify back buttons and stack management.

| Step | Action | Expected Result |
| :--- | :--- | :--- |
| 1 | On **Trade Initiation** screen, tap the back arrow. | Returns to **Item Detail** screen. |
| 2 | On **Trade Success** screen, tap the hardware back button (Android) or swipe back (iOS). | Should NOT return to Trade Initiation (stack should be cleaned). |
| 3 | Tap **"Back to Home"** on Success screen. | Returns to the main **Home/Feed** screen. |
