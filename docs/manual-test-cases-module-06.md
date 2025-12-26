# Manual Test Cases - Module 06: Trade Lifecycle V2

## Overview
This document outlines the manual test cases for verifying the Trade Lifecycle V2 implementation, covering trade initiation, state transitions, completion, cancellation, and Swap Points (SP) integration.

## Prerequisites
- Two test accounts:
  - **Buyer**: `buyer@example.com` (Kids Club+ Subscriber for SP tests)
  - **Seller**: `seller@example.com`
- Both users must be in the same Node (e.g., `90210`).
- Seller must have an active listing.
- Buyer must have sufficient Swap Points (for SP tests).

## Test Cases

### TC-TRADE-001: Trade Initiation (Cash Only)
**Objective:** Verify a buyer can initiate a cash-only trade.
**Steps:**
1. Log in as **Buyer**.
2. Navigate to **Browse Items** and select an item from **Seller**.
3. Tap **"Buy Now"** or **"Request Trade"**.
4. On the Trade Initiation screen, ensure "Cash" is selected as the payment method.
5. Confirm the transaction details (Price, Platform Fee).
6. Tap **"Confirm Trade"**.
**Expected Result:**
- Trade is created with status `payment_processing` (if Stripe) or `pending` (if cash/manual).
- Buyer is redirected to the Trade Success or Trade Detail screen.
- Seller receives a notification (if notifications are enabled).

### TC-TRADE-002: Trade Initiation (with Swap Points)
**Objective:** Verify a subscriber can use Swap Points (up to 50% cap).
**Steps:**
1. Log in as **Buyer** (must be Subscriber).
2. Select an item from **Seller** (Seller must accept SP).
3. On the Trade Initiation screen, toggle **"Use Swap Points"**.
4. Adjust the SP slider. Verify it caps at 50% of the item price.
5. Verify the "Cash to Pay" amount decreases accordingly.
6. Tap **"Confirm Trade"**.
**Expected Result:**
- Trade is created with `sp_amount` > 0.
- Buyer's SP wallet shows the amount as "frozen" or deducted.
- Trade status updates correctly.

### TC-TRADE-003: Seller Completes Trade (Requires Confirmation)
**Objective:** Verify the two-step completion flow (Seller marks complete -> Buyer confirms).
**Steps:**
1. Log in as **Seller**.
2. Navigate to **My Trades** -> **Active**.
3. Select the trade created in TC-TRADE-001.
4. Tap **"Mark as Completed"**.
**Expected Result:**
- Trade status remains `in_progress` (or updates to a specific "waiting for confirmation" sub-status if applicable, otherwise UI shows "Awaiting Buyer Confirmation").
- `seller_marked_completed_at` timestamp is set in the DB.

### TC-TRADE-004: Buyer Confirms Completion
**Objective:** Verify the trade finalizes only after Buyer confirmation.
**Steps:**
1. Log in as **Buyer**.
2. Navigate to the same trade.
3. Verify UI shows "Seller marked as complete. Please confirm."
4. Tap **"Confirm Receipt"** (or similar).
**Expected Result:**
- Trade status changes to `completed`.
- Seller receives the funds (if Stripe) or SP (if applicable).
- Buyer receives the item (conceptually).

### TC-TRADE-005: Cancellation by Buyer (Pre-Completion)
**Objective:** Verify a buyer can cancel a trade before it is completed.
**Steps:**
1. Initiate a new trade.
2. Log in as **Buyer**.
3. Navigate to the trade details.
4. Tap **"Cancel Trade"**.
5. Select a reason (e.g., "Changed mind").
6. Confirm cancellation.
**Expected Result:**
- Trade status changes to `cancelled`.
- Any frozen SP are returned to the Buyer's wallet.
- Stripe payment (if authorized) is voided/refunded.

### TC-TRADE-006: Cancellation by Seller
**Objective:** Verify a seller can cancel a trade.
**Steps:**
1. Initiate a new trade.
2. Log in as **Seller**.
3. Navigate to the trade details.
4. Tap **"Cancel Trade"**.
5. Select a reason (e.g., "Item no longer available").
6. Confirm cancellation.
**Expected Result:**
- Trade status changes to `cancelled`.
- Buyer is refunded (Cash + SP).

### TC-TRADE-007: Auto-Completion (7 Days)
**Objective:** Verify trades auto-complete after 7 days if not disputed.
**Steps:**
1. (Requires DB manipulation or waiting) Set a trade's `created_at` or `seller_marked_completed_at` to 8 days ago.
2. Run the `auto-complete-trades` Edge Function (or wait for cron).
**Expected Result:**
- Trade status changes to `completed`.
- Funds/SP are released.

### TC-TRADE-008: SP Earning on Completion
**Objective:** Verify Seller earns SP when a trade completes (if eligible).
**Steps:**
1. Complete a trade where Seller is a Subscriber.
2. Check Seller's SP Wallet.
**Expected Result:**
- Seller's "Pending SP" increases by the calculated amount (e.g., 1 SP per $1 value).
- Ledger entry created with type `earned_pending`.

## Edge Cases
- **Insufficient Funds:** Try to buy with an expired card.
- **Network Error:** Turn off data while confirming a trade.
- **Concurrent Status Change:** Buyer cancels while Seller is marking as complete.
