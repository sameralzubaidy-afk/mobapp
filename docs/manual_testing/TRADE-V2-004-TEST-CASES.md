# Manual Test Cases: TRADE-V2-004 Trade State Transitions

This document outlines the manual verification steps for Trade State Transitions, including manual completion, cancellation, and auto-completion logic.

## Prerequisites
- Two test users (Buyer and Seller) in the same Node.
- Seller must have an active listing.
- Buyer must have sufficient funds/SP.
- Supabase Edge Functions deployed.
- Stripe CLI running (for webhook testing).

---

## Test Case 1: Manual Trade Completion (Buyer)
**Goal:** Verify that a buyer can mark a trade as completed and the seller receives Swap Points.

1. **Setup:**
   - Log in as Buyer.
   - Initiate a trade for a Seller's item.
   - Complete the payment flow (Trade status becomes `in_progress`).
2. **Action:**
   - Navigate to `TradeDetailScreen` for the active trade.
   - Tap **"Mark as Completed"**.
   - Confirm the alert.
3. **Expected Result:**
   - Trade status updates to `completed` in real-time.
   - Seller's `sp_wallet` balance increases by the item price (if subscriber).
   - A `swap_points_ledger` entry is created for the seller with `type = 'earn'`.
   - The "Mark as Completed" button disappears.

---

## Test Case 2: Manual Trade Cancellation (Seller)
**Goal:** Verify that a seller can cancel a trade and the buyer receives a refund.

1. **Setup:**
   - Log in as Seller.
   - Have an active trade in `in_progress` status.
2. **Action:**
   - Navigate to `TradeDetailScreen`.
   - Tap **"Cancel Trade"**.
   - Confirm the alert.
3. **Expected Result:**
   - Trade status updates to `cancelled`.
   - `cancellation_reason` is set.
   - Stripe refund is initiated (verify in Stripe Dashboard).
   - If Buyer used SP, their `sp_wallet` balance is restored.
   - Listing status returns to `active`.

---

## Test Case 3: Auto-Completion (7-Day Window)
**Goal:** Verify that trades are automatically completed after 7 days of inactivity.

1. **Setup:**
   - Manually update a trade in the database to have `created_at` 8 days ago and status `in_progress`.
   ```sql
   UPDATE trades SET created_at = NOW() - INTERVAL '8 days' WHERE id = 'YOUR_TRADE_ID';
   ```
2. **Action:**
   - Invoke the `auto-complete-trades` Edge Function manually.
   ```bash
   curl -i --request POST 'https://<project>.supabase.co/functions/v1/auto-complete-trades' \
     --header 'Authorization: Bearer <SERVICE_ROLE_KEY>'
   ```
3. **Expected Result:**
   - The trade status updates to `completed`.
   - Seller receives SP.
   - System log indicates auto-completion.

---

## Test Case 4: Stripe Webhook Handling (Refund)
**Goal:** Verify that an external refund in Stripe triggers a trade cancellation in the app.

1. **Setup:**
   - Have an active trade with a Stripe `payment_intent_id`.
2. **Action:**
   - Go to Stripe Dashboard and issue a refund for the specific PaymentIntent.
   - OR use Stripe CLI to trigger a `charge.refunded` event.
3. **Expected Result:**
   - `stripe-webhook` Edge Function receives the event.
   - Trade status in Supabase updates to `cancelled`.
   - Buyer's SP (if any) are restored.

---

## Test Case 5: SP Earning Logic (V2 Rules)
**Goal:** Verify seller earns 1 SP per $1 of item price.

1. **Setup:**
   - Item price = $25.00.
   - Seller is a 'kids_club_plus' subscriber.
2. **Action:**
   - Complete the trade.
3. **Expected Result:**
   - Seller's wallet increases by exactly 25 SP.
   - Verify via SQL:
   ```sql
   SELECT * FROM swap_points_ledger WHERE user_id = 'SELLER_ID' ORDER BY created_at DESC LIMIT 1;
   ```
