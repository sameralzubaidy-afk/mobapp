# PAY-006: Payout Router + Trade Completion Trigger - Manual Test Cases

**Module:** MODULE-06-TRADE-FLOW-sellerpayouts.md (TASK PAY-006)  
**Date:** January 1, 2026  
**Tester:** [Your Name]

---

## Prerequisites

Before testing, ensure:
- [ ] Migrations `077_add_auto_payout_admin_config.sql` and `078_payout_router_integration.sql` have been applied to Supabase production
- [ ] You have access to Supabase SQL Editor or Supabase Studio
- [ ] You have at least 2 test users: one seller with a verified Stripe Connect account, one buyer
- [ ] Test environment has trades in `in_progress` status ready to complete

---

## Test Case 1: Verify Admin Config Flag Exists

**Objective:** Confirm the new admin config flag `enable_automatic_seller_payout` was created

**Steps:**
1. Open Supabase SQL Editor
2. Run the following query:
   ```sql
   SELECT key, value, description, category, data_type, is_active 
   FROM admin_config 
   WHERE key = 'enable_automatic_seller_payout';
   ```

**Expected Result:**
- One row returned with:
  - `key`: `enable_automatic_seller_payout`
  - `value`: `false` (default)
  - `description`: "Enable automatic seller payout..."
  - `category`: `fees`
  - `data_type`: `boolean`
  - `is_active`: `true`

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 2: Verify RPC Functions Exist

**Objective:** Confirm all new RPC functions were created successfully

**Steps:**
1. Run the following query:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN (
     'get_admin_payout_config',
     'calculate_payout_fee_cents',
     'create_seller_payout_on_trade_completion',
     'complete_trade_v2'
   );
   ```

**Expected Result:**
- 4 rows returned, one for each function name

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 3: Test `get_admin_payout_config()` RPC

**Objective:** Verify the RPC returns correct admin configuration

**Steps:**
1. Run:
   ```sql
   SELECT * FROM get_admin_payout_config();
   ```

**Expected Result:**
- One row with columns:
  - `enable_automatic_seller_payout`: `false`
  - `minimum_withdrawal_amount_cents`: `500` (or configured value)
  - `stripe_payout_fee_fixed_cents`: `25`
  - `stripe_payout_fee_percentage`: `0.25`
  - `paypal_payout_fee_percentage`: `2.0`
  - `paypal_payout_fee_cap_cents`: `2000`

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 4: Test `calculate_payout_fee_cents()` RPC

**Objective:** Verify payout fee calculation logic

**Steps:**
1. Test Stripe fee ($100):
   ```sql
   SELECT calculate_payout_fee_cents('stripe_connect', 10000);
   ```
   Expected: `50` (0.25% + $0.25 = $0.25 + $0.25 = $0.50)

2. Test PayPal fee ($50):
   ```sql
   SELECT calculate_payout_fee_cents('paypal', 5000);
   ```
   Expected: `100` (2% = $1.00)

3. Test PayPal fee cap ($2000):
   ```sql
   SELECT calculate_payout_fee_cents('paypal', 200000);
   ```
   Expected: `2000` (capped at $20.00)

4. Test Venmo fee ($30):
   ```sql
   SELECT calculate_payout_fee_cents('venmo', 3000);
   ```
   Expected: `60` (2% = $0.60)

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 5: Scenario - Auto-Payout DISABLED (Manual Withdrawal)

**Objective:** When auto-payout is disabled, trade completion should create payout in `pending` status

**Setup:**
1. Ensure auto-payout is disabled:
   ```sql
   SELECT upsert_admin_config_setting(
     'enable_automatic_seller_payout',
     'false',
     'fees'::admin_config_category,
     'boolean',
     false,
     true
   );
   ```

2. Verify:
   ```sql
   SELECT value FROM admin_config WHERE key = 'enable_automatic_seller_payout';
   ```
   Expected: `false`

**Steps:**
1. In the mobile app, log in as the **buyer** for a test trade in `in_progress` status
2. Navigate to the Trade Timeline screen
3. Tap **"Mark Complete"** button
4. Confirm trade completes successfully

5. In Supabase SQL Editor, verify payout was created:
   ```sql
   SELECT 
     id,
     user_id,
     trade_id,
     status,
     gross_amount_cents,
     payout_fee_cents,
     net_amount_cents,
     initiated_at
   FROM seller_payouts 
   WHERE trade_id = '<YOUR_TRADE_ID>'
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

**Expected Result:**
- Payout record created with:
  - `status`: `pending`
  - `gross_amount_cents`: equals `trade.cash_amount_cents`
  - `payout_fee_cents`: `0` (fee calculated at withdrawal time)
  - `net_amount_cents`: equals `gross_amount_cents`
  - `initiated_at`: `NULL` (not yet initiated)

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 6: Scenario - Auto-Payout ENABLED with Verified Method

**Objective:** When auto-payout is enabled and seller has verified method, payout should be created in `processing` status

**Setup:**
1. Enable auto-payout:
   ```sql
   SELECT upsert_admin_config_setting(
     'enable_automatic_seller_payout',
     'true',
     'fees'::admin_config_category,
     'boolean',
     false,
     true
   );
   ```

2. Ensure test seller has a verified Stripe Connect payout method:
   ```sql
   SELECT id, user_id, method_type, is_primary, is_verified
   FROM seller_payout_methods
   WHERE user_id = '<SELLER_USER_ID>'
     AND is_primary = true
     AND is_verified = true;
   ```
   (If not, create one via mobile app: Settings > Payout Methods > Add Stripe)

**Steps:**
1. Log in as **seller** for a test trade in `in_progress` status
2. Navigate to Trade Timeline screen
3. Tap **"Mark Complete"**
4. Confirm trade completes

5. Verify payout in Supabase:
   ```sql
   SELECT 
     id,
     user_id,
     trade_id,
     payout_method_id,
     status,
     provider,
     gross_amount_cents,
     payout_fee_cents,
     net_amount_cents,
     initiated_at
   FROM seller_payouts 
   WHERE trade_id = '<YOUR_TRADE_ID>';
   ```

**Expected Result:**
- Payout record created with:
  - `status`: `processing`
  - `payout_method_id`: not NULL (linked to seller's primary method)
  - `provider`: `stripe`
  - `gross_amount_cents`: equals `trade.cash_amount_cents`
  - `payout_fee_cents`: > 0 (calculated Stripe fee)
  - `net_amount_cents`: < `gross_amount_cents` (after fee deduction)
  - `initiated_at`: not NULL (timestamp when processing started)

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 7: Scenario - Auto-Payout ENABLED but NO Verified Method

**Objective:** When auto-payout is enabled but seller has no verified method, payout should be `requires_action`

**Setup:**
1. Ensure auto-payout is enabled (see Test Case 6 setup)
2. Create a test seller user WITHOUT a payout method:
   ```sql
   -- Verify seller has no verified methods
   SELECT COUNT(*) FROM seller_payout_methods
   WHERE user_id = '<SELLER_USER_ID>'
     AND is_verified = true;
   ```
   Expected: `0`

**Steps:**
1. Complete a trade where this seller is the seller
2. Verify payout:
   ```sql
   SELECT 
     id,
     status,
     payout_method_id,
     gross_amount_cents,
     net_amount_cents
   FROM seller_payouts 
   WHERE trade_id = '<YOUR_TRADE_ID>';
   ```

**Expected Result:**
- Payout record created with:
  - `status`: `requires_action`
  - `payout_method_id`: NULL
  - `gross_amount_cents`: equals trade cash amount
  - `net_amount_cents`: equals gross (no fee yet)

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 8: Idempotency - Duplicate Trade Completion

**Objective:** Completing the same trade multiple times should NOT create duplicate payouts

**Setup:**
1. Use a trade that has already been completed in Test Case 5, 6, or 7

**Steps:**
1. Get the trade ID and seller ID from a completed trade
2. Attempt to call `complete_trade_v2` again:
   ```sql
   SELECT complete_trade_v2(
     '<TRADE_ID>'::UUID,
     '<SELLER_USER_ID>'::UUID
   );
   ```

**Expected Result:**
- RPC returns error: "Trade must be in_progress to complete. Current status: completed"
  OR
- RPC succeeds but `payout_result.is_new` = `false`

3. Verify only ONE payout exists for this trade:
   ```sql
   SELECT COUNT(*) 
   FROM seller_payouts 
   WHERE trade_id = '<TRADE_ID>';
   ```
   Expected: `1`

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 9: Mobile App - Seller Earnings Screen (Manual Withdrawal Flow)

**Objective:** Seller can view pending payouts and request withdrawal

**Prerequisites:**
- Auto-payout is **DISABLED**
- Seller has at least one completed trade with pending payout
- Seller has a verified payout method

**Steps:**
1. Log in to mobile app as **seller**
2. Navigate to **Settings > Earnings** (or Profile > Earnings)
3. Verify "Available to Withdraw" section displays correct balance
4. Tap **"Request Withdrawal"** button
5. Confirm withdrawal request

**Expected Result:**
- Pending balance displays correctly (sum of all `pending` payouts)
- After tapping "Request Withdrawal":
  - Payout status changes from `pending` to `processing`
  - Balance updates (pending amount moves to processing)
  - User sees confirmation: "Withdrawal requested. Funds will arrive in 2-5 business days."

6. Verify in Supabase:
   ```sql
   SELECT status, initiated_at 
   FROM seller_payouts 
   WHERE user_id = '<SELLER_ID>' 
     AND status = 'processing';
   ```
   Expected: At least one row with `status = 'processing'` and `initiated_at` is recent timestamp

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 10: Mobile App - Auto-Payout Notification (if implemented)

**Objective:** Seller receives notification when auto-payout is initiated

**Prerequisites:**
- Auto-payout is **ENABLED**
- Seller has verified payout method
- Seller completes a trade

**Steps:**
1. Complete a trade (see Test Case 6)
2. Check seller's notifications (in-app or push)

**Expected Result:**
- Notification received: "Your earnings of $X.XX from [Item Name] are being processed. Funds will arrive in 2-5 business days."

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Test Case 11: Admin Panel - Toggle Auto-Payout Config (if implemented)

**Objective:** Admin can toggle auto-payout setting via admin panel

**Steps:**
1. Log in to Admin Panel as admin user
2. Navigate to **Settings > Payouts** (or Config)
3. Locate **"Enable Automatic Seller Payout"** toggle
4. Toggle ON
5. Verify toggle state persists after page refresh
6. Toggle OFF
7. Verify toggle state persists

8. Confirm in Supabase:
   ```sql
   SELECT value FROM admin_config WHERE key = 'enable_automatic_seller_payout';
   ```

**Expected Result:**
- Toggle reflects correct state
- Value in database updates accordingly (`'true'` or `'false'`)

**Status:** [ ] PASS / [ ] FAIL  
**Notes:**

---

## Summary

**Total Test Cases:** 11  
**Passed:** [ ]  
**Failed:** [ ]  
**Blocked:** [ ]

**Critical Issues:**

**Notes:**

---

## Rollback Plan (if needed)

If PAY-006 implementation causes issues:

1. Disable auto-payout:
   ```sql
   UPDATE admin_config 
   SET value = 'false' 
   WHERE key = 'enable_automatic_seller_payout';
   ```

2. If payout creation breaks trade completion, temporarily remove integration:
   ```sql
   -- Restore old complete_trade_v2 without payout creation
   -- (You should keep a backup of the previous version)
   ```

3. Roll back migrations (non-production only):
   ```sql
   DROP FUNCTION IF EXISTS create_seller_payout_on_trade_completion CASCADE;
   DROP FUNCTION IF EXISTS calculate_payout_fee_cents CASCADE;
   DROP FUNCTION IF EXISTS get_admin_payout_config CASCADE;
   DELETE FROM admin_config WHERE key = 'enable_automatic_seller_payout';
   ```
