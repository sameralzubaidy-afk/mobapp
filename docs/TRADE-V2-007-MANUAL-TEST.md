# Manual Test Case: TRADE-V2-007 Mid-Trade Subscription Changes

## Overview
This test verifies that the system correctly handles cases where a buyer's subscription status changes while a trade is `in_progress`.

## Policy Requirements
1. **No Retroactive Fee Adjustments**: The fee charged at initiation must remain the same even if the subscription expires.
2. **No Forced Cancellations**: The trade should proceed to completion normally.
3. **Admin Visibility**: Admins should be able to see the subscription status at initiation vs. current status.
4. **Seller Earning**: Seller earning is determined at completion (if they are still a subscriber).

## Prerequisites
- A buyer user with an active subscription.
- A seller user with an active subscription.
- An item listed by the seller.

## Test Steps

### Step 1: Initiate and Pay for Trade
1. Log in as the **Buyer**.
2. Initiate a trade for the seller's item.
3. Verify that `buyer_subscription_status` is captured as `active` or `trial` in the `trades` table.
4. Verify that the `buyer_transaction_fee_cents` is set to the subscriber rate ($0.99).
5. Complete the payment flow. The trade status should now be `in_progress`.

### Step 2: Simulate Subscription Expiration
1. Manually update the buyer's subscription status in the database:
   ```sql
   UPDATE subscriptions SET status = 'expired' WHERE user_id = 'BUYER_USER_ID';
   ```
2. Run the monitoring edge function:
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/monitor-mid-trade-subscription-changes \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```
3. Verify the output shows an alert for the active trade.
4. Verify the `trades` table metadata for this trade now contains `mid_trade_sub_change: true`.

### Step 2.5: Admin UI Verification ✅
1. Log in to the **Admin Dashboard** as an admin user.
2. Navigate to the **Monitoring** / **Subscription Alerts** panel and refresh the list.
3. Confirm the trade appears in the alerts list showing:
   - Trade id and `status = 'in_progress'`
   - `buyer_subscription_status_at_initiation` (snapshot)
   - `buyer_subscription_status_current` (current)
   - A `mid_trade_sub_change: true` indicator and a detection timestamp
4. Click the trade to open the details panel and verify the metadata shows the before/after statuses and links to the related subscription record(s).
5. Verify admin actions are available (where implemented): **Add note**, **Acknowledge**, and **Re-run Monitoring** (which triggers the monitoring edge function).
6. Check admin logs/audit table for a record of the monitoring run referencing this trade (if your system keeps monitoring logs).

Verification queries (run in Supabase SQL editor to cross-check UI):

```sql
-- Replace TRADE_ID with the trade UUID
SELECT id, status, metadata->>'mid_trade_sub_change' AS mid_trade_sub_change, metadata->>'buyer_subscription_status_at_initiation' AS buyer_sub_init, metadata->>'buyer_subscription_status_current' AS buyer_sub_current
FROM trades
WHERE id = 'TRADE_ID';
```

```sql
-- Check monitoring audit table (if it exists)
SELECT * FROM admin_monitoring_logs WHERE payload->>'trade_id' = 'TRADE_ID' ORDER BY created_at DESC LIMIT 5;
```

Expected Admin UI results:
- The trade shows in the alerts list with a visible **Mid-Trade Subscription Change** badge. ✅
- Details panel shows both snapshot and current subscription statuses and a detection timestamp. ✅
- Admin can re-run the monitor and acknowledge the alert; an audit entry is created. ✅

> Note: If your Admin Dashboard has different labels or menu paths, adapt these steps (e.g., **Tools → Trade Monitoring**).

### Step 3: Complete the Trade
1. Log in as the **Seller** (or Buyer).
2. Complete the trade (mark as received/completed).
3. Verify that the trade transitions to `completed` successfully.
4. Verify that the buyer was NOT charged any additional fees.
5. Verify that the seller earned SP (if they are still a subscriber).

### Step 4: Verify Seller Earning (Optional)
1. Simulate the **Seller's** subscription expiring:
   ```sql
   UPDATE subscriptions SET status = 'expired' WHERE user_id = 'SELLER_USER_ID';
   ```
2. Complete another trade where this user is the seller.
3. Verify that the seller did NOT earn SP (since earning is determined at completion).

## Expected Results
- The trade completes without error despite the buyer's subscription change.
- The fee remains $0.99 (snapshot value).
- The monitoring function correctly identifies and logs the change.
- The seller's earning logic respects their *current* status at completion.
