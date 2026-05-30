# MODULE-06 TRADE-V2-010: Manual Test Guide

**Module:** Trade & Transaction Flow V2  
**Task:** TRADE-V2-010 - Comprehensive Testing & Module Finalization  
**Test Environment:** iOS Simulator / Android Emulator + Supabase Production  
**Date:** December 28, 2024

---

## Prerequisites

Before starting manual testing:

✅ **Database Migrations Applied:**
- Migration `060_trades_v2.sql` (trade schema V2)
- Migration `061_sp_ledger_and_trade_rpcs.sql` (SP RPCs)

✅ **Edge Functions Deployed:**
- `trade-payment` (payment orchestration)
- `complete-trade` (trade completion + SP earning)
- `cancel-trade` (cancellation + refunds)

✅ **Environment Variables Configured:**
- `STRIPE_SECRET_KEY` set in Supabase edge functions
- Stripe test mode enabled for safe testing

✅ **Test Users Created:**
- **Subscriber Buyer** (trial/active) with 50+ SP
- **Free User Buyer** (free tier) with 0 SP
- **Seller** (active subscriber)

✅ **Test Items Listed:**
- At least 2 items priced between $10-$50
- Items with `status='available'`

---

## Test Suite Overview

| Test Case ID | Description | Priority | Est. Time |
|-------------|-------------|----------|-----------|
| TC-TRADE-001 | Initiate trade as subscriber with SP | Critical | 3 min |
| TC-TRADE-002 | Initiate trade as non-subscriber | Critical | 2 min |
| TC-TRADE-003 | Payment with valid card | Critical | 4 min |
| TC-TRADE-004 | Payment with declined card | High | 3 min |
| TC-TRADE-005 | Complete trade manually | Critical | 3 min |
| TC-TRADE-006 | Cancel pending trade | High | 2 min |
| TC-TRADE-007 | Cancel in_progress trade | High | 4 min |
| TC-TRADE-008 | SP clamping to 50% cap | Critical | 3 min |
| TC-TRADE-009 | SP clamping to available balance | High | 3 min |
| TC-TRADE-010 | Self-purchase prevention | Medium | 2 min |
| TC-TRADE-011 | Seller SP earning on completion | Critical | 4 min |
| TC-TRADE-012 | Mid-trade subscription change | Medium | 5 min |

**Total Estimated Time:** ~38 minutes

---

## Test Cases

### **TC-TRADE-001: Initiate Trade as Subscriber with SP**

**Objective:** Verify that an active subscriber can initiate a trade using Swap Points discount.

**Preconditions:**
- Logged in as subscriber buyer
- Available SP balance >= 10
- Test item available (price = $25.00)

**Test Steps:**

1. Navigate to Browse/Discovery screen
2. Tap on a listed item (price $25.00)
3. Tap "Buy Now" button
4. On checkout screen, observe:
   - Item price displayed: $25.00
   - SP slider visible and enabled
5. Slide SP slider to 10 SP
6. Observe updated breakdown:
   - Item price: $25.00
   - SP discount: -$10.00
   - Subtotal: $15.00
   - Transaction fee: $0.99
   - **Total due: $15.99**
7. Tap "Continue to Payment"
8. Verify trade created in Supabase:
   ```sql
   SELECT * FROM trades 
   WHERE status = 'pending' 
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Results:**
- ✅ SP slider enabled and functional
- ✅ Fee is $0.99 (subscriber rate)
- ✅ Applied SP clamped to max 50% of item price (12 SP max for $25 item)
- ✅ Trade record created with status='pending'
- ✅ `buyer_subscription_status` = 'active' or 'trial'
- ✅ `buyer_transaction_fee_cents` = 99
- ✅ `sp_amount` = 10

**Pass/Fail:** ___________

---

### **TC-TRADE-002: Initiate Trade as Non-Subscriber**

**Objective:** Verify that free users cannot use SP and pay $2.99 fee.

**Preconditions:**
- Logged in as free user (non-subscriber)
- Test item available (price = $25.00)

**Test Steps:**

1. Navigate to Browse screen
2. Tap on item
3. Tap "Buy Now"
4. On checkout screen, observe:
   - SP slider **disabled** or hidden
   - Upgrade CTA displayed: "Subscribe to Kids Club+ to use Swap Points!"
   - Transaction fee: $2.99
5. Verify total amount:
   - Item: $25.00
   - Fee: $2.99
   - **Total: $27.99**
6. Tap "Continue to Payment"
7. Verify trade in DB:
   ```sql
   SELECT sp_amount, buyer_transaction_fee_cents, buyer_subscription_status
   FROM trades WHERE status='pending' ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Results:**
- ✅ SP slider disabled/hidden with upgrade message
- ✅ Fee is $2.99 (non-subscriber rate)
- ✅ `sp_amount` = 0
- ✅ `buyer_transaction_fee_cents` = 299
- ✅ `buyer_subscription_status` = 'free'

**Pass/Fail:** ___________

---

### **TC-TRADE-003: Payment with Valid Card**

**Objective:** Verify successful payment processing and SP debit.

**Preconditions:**
- Trade in 'pending' status (from TC-TRADE-001)
- Stripe test card: 4242 4242 4242 4242

**Test Steps:**

1. Continue from TC-TRADE-001 checkout
2. On payment screen, enter test card details:
   - Card: 4242 4242 4242 4242
   - Exp: 12/26
   - CVC: 123
   - ZIP: 12345
3. Tap "Pay Now"
4. Wait for processing (show loading indicator)
5. Observe success message: "Payment successful!"
6. Verify trade status updated:
   ```sql
   SELECT status, stripe_payment_intent_id, sp_debit_ledger_entry_id
   FROM trades WHERE id = '<trade_id>';
   ```
7. Verify SP wallet debited:
   ```sql
   SELECT * FROM sp_ledger 
   WHERE user_id = '<buyer_id>' 
   ORDER BY created_at DESC LIMIT 5;
   ```

**Expected Results:**
- ✅ Payment processes without errors
- ✅ Trade status changed to 'in_progress'
- ✅ `stripe_payment_intent_id` populated
- ✅ `sp_debit_ledger_entry_id` populated (if SP used)
- ✅ SP wallet shows debit entry with `source_type='trade_purchase'`
- ✅ Buyer SP balance reduced by 10

**Pass/Fail:** ___________

---

### **TC-TRADE-004: Payment with Declined Card**

**Objective:** Verify graceful handling of payment failures.

**Preconditions:**
- Trade in 'pending' status
- Stripe test card for decline: 4000 0000 0000 0002

**Test Steps:**

1. Initiate new trade (repeat TC-TRADE-001 steps 1-7)
2. On payment screen, enter declined test card:
   - Card: 4000 0000 0000 0002
   - Exp: 12/26
   - CVC: 123
3. Tap "Pay Now"
4. Wait for response
5. Observe error message displayed
6. Verify trade status:
   ```sql
   SELECT status FROM trades WHERE id = '<trade_id>';
   ```
7. Verify NO SP was debited:
   ```sql
   SELECT * FROM sp_ledger 
   WHERE user_id = '<buyer_id>' AND trade_id = '<trade_id>';
   ```

**Expected Results:**
- ✅ Error message displayed: "Payment failed: the card was declined"
- ✅ Trade status = 'payment_failed'
- ✅ NO SP debit ledger entry created
- ✅ Buyer SP balance unchanged
- ✅ User can retry payment or cancel trade

**Pass/Fail:** ___________

---

### **TC-TRADE-005: Complete Trade Manually**

**Objective:** Verify manual trade completion and seller SP earning.

**Preconditions:**
- Trade in 'in_progress' status (from TC-TRADE-003)
- Seller has active subscription

**Test Steps:**

1. Log in as **seller** account
2. Navigate to "My Sales" or "Active Trades"
3. Find the trade from TC-TRADE-003
4. Tap "Mark as Complete"
5. Confirm completion dialog
6. Observe success message: "Trade completed successfully!"
7. Check seller SP wallet:
   ```sql
   SELECT * FROM sp_ledger 
   WHERE user_id = '<seller_id>' AND source_type = 'trade_sale'
   ORDER BY created_at DESC LIMIT 1;
   ```
8. Verify trade status:
   ```sql
   SELECT status, completed_at FROM trades WHERE id = '<trade_id>';
   ```

**Expected Results:**
- ✅ Trade status changed to 'completed'
- ✅ `completed_at` timestamp set
- ✅ Seller earned SP = item price in dollars (e.g., 25 SP for $25 item)
- ✅ SP ledger entry created with `source_type='trade_sale'`
- ✅ Item status changed to 'sold'

**Pass/Fail:** ___________

---

### **TC-TRADE-006: Cancel Pending Trade**

**Objective:** Verify pre-payment cancellation without refunds.

**Preconditions:**
- Trade in 'pending' status
- Logged in as buyer

**Test Steps:**

1. Navigate to "My Purchases" or "Active Trades"
2. Find pending trade
3. Tap "Cancel Trade" button
4. Select reason: "Changed my mind"
5. Confirm cancellation
6. Observe success message: "Trade cancelled successfully"
7. Verify trade status:
   ```sql
   SELECT status, cancelled_at, cancellation_reason 
   FROM trades WHERE id = '<trade_id>';
   ```

**Expected Results:**
- ✅ Trade status = 'cancelled'
- ✅ `cancelled_at` timestamp set
- ✅ `cancellation_reason` = 'Changed my mind'
- ✅ NO Stripe refund issued (pre-payment)
- ✅ NO SP re-credit (no SP was debited yet)

**Pass/Fail:** ___________

---

### **TC-TRADE-007: Cancel In-Progress Trade with Refunds**

**Objective:** Verify post-payment cancellation with Stripe and SP refunds.

**Preconditions:**
- Trade in 'in_progress' status (paid)
- Trade used 10 SP
- Logged in as buyer

**Test Steps:**

1. Navigate to "My Purchases"
2. Find in_progress trade
3. Tap "Cancel Trade"
4. Select reason: "Item damaged"
5. Confirm cancellation
6. Observe success message with refund note
7. Verify trade status:
   ```sql
   SELECT status, cancelled_at, cancellation_reason, sp_credit_ledger_entry_id
   FROM trades WHERE id = '<trade_id>';
   ```
8. Verify Stripe refund initiated (check Stripe dashboard)
9. Verify SP re-credited:
   ```sql
   SELECT * FROM sp_ledger 
   WHERE user_id = '<buyer_id>' AND source_type = 'refund'
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Results:**
- ✅ Trade status = 'cancelled'
- ✅ Stripe refund created for cash amount + fee
- ✅ SP re-credited to buyer (10 SP)
- ✅ SP ledger entry with `source_type='refund'`
- ✅ `sp_credit_ledger_entry_id` populated

**Pass/Fail:** ___________

---

### **TC-TRADE-008: SP Clamping to 50% Cap**

**Objective:** Verify SP discount cannot exceed 50% of item price.

**Preconditions:**
- Logged in as subscriber with 100+ SP
- Item priced at $20.00

**Test Steps:**

1. Navigate to item details (price $20.00)
2. Tap "Buy Now"
3. Try to set SP slider to maximum (e.g., 50 SP)
4. Observe slider stops at 10 SP (50% of $20)
5. Verify breakdown:
   - Item: $20.00
   - SP discount: -$10.00 (max)
   - Subtotal: $10.00
   - Fee: $0.99
   - Total: $10.99
6. Initiate trade
7. Verify in DB:
   ```sql
   SELECT sp_amount FROM trades WHERE status='pending' 
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Results:**
- ✅ SP slider max value = 10 (50% of item price)
- ✅ Even with 100 SP available, only 10 applied
- ✅ `sp_amount` = 10

**Pass/Fail:** ___________

---

### **TC-TRADE-009: SP Clamping to Available Balance**

**Objective:** Verify SP usage limited by wallet balance.

**Preconditions:**
- Logged in as subscriber with exactly 3 SP
- Item priced at $20.00

**Test Steps:**

1. Navigate to item details
2. Tap "Buy Now"
3. Observe SP slider max value = 3 (available balance)
4. Slide to 3 SP
5. Verify breakdown:
   - SP discount: -$3.00
   - Total: $17.00 + $0.99 = $17.99
6. Try to manually input higher value (if possible)
7. Verify clamped to 3

**Expected Results:**
- ✅ SP slider max = 3 (wallet balance)
- ✅ Cannot use more SP than available
- ✅ `sp_amount` = 3

**Pass/Fail:** ___________

---

### **TC-TRADE-010: Self-Purchase Prevention**

**Objective:** Verify users cannot buy their own listings.

**Preconditions:**
- Logged in as seller who has active listing

**Test Steps:**

1. Navigate to "My Listings"
2. Tap on one of your own listings
3. Observe "Buy Now" button state
4. Try to tap "Buy Now" (if visible)
5. Observe error message

**Expected Results:**
- ✅ "Buy Now" button disabled/hidden for own listings
- ✅ If user somehow triggers purchase, error displayed: "Cannot buy your own item"
- ✅ No trade record created

**Pass/Fail:** ___________

---

### **TC-TRADE-011: Seller SP Earning on Completion**

**Objective:** Verify seller earns correct SP amount on trade completion.

**Preconditions:**
- Completed trade for $30 item
- Seller has active subscription

**Test Steps:**

1. Note seller SP balance before:
   ```sql
   SELECT available_points FROM sp_wallet WHERE user_id = '<seller_id>';
   ```
2. Complete trade (see TC-TRADE-005)
3. Wait 2 seconds for Edge Function processing
4. Check seller SP balance after:
   ```sql
   SELECT available_points FROM sp_wallet WHERE user_id = '<seller_id>';
   ```
5. Verify SP ledger entry:
   ```sql
   SELECT points_amount, source_type, source_id 
   FROM sp_ledger 
   WHERE user_id = '<seller_id>' AND source_type = 'trade_sale'
   ORDER BY created_at DESC LIMIT 1;
   ```

**Expected Results:**
- ✅ Seller earned 30 SP (1 SP per dollar of item price)
- ✅ SP ledger entry created with correct `source_id` (trade ID)
- ✅ Available SP balance increased by 30

**Pass/Fail:** ___________

---

### **TC-TRADE-012: Mid-Trade Subscription Change (No Retroactive Adjustment)**

**Objective:** Verify fees remain locked even if subscription expires mid-trade.

**Preconditions:**
- Subscriber initiates trade with $0.99 fee
- Subscription expires before payment (manually update subscription_expires_at in DB)

**Test Steps:**

1. Initiate trade as subscriber (fee = $0.99)
2. Note trade details:
   ```sql
   SELECT id, buyer_transaction_fee_cents, buyer_subscription_status 
   FROM trades WHERE status='pending' ORDER BY created_at DESC LIMIT 1;
   ```
3. Manually expire subscription:
   ```sql
   UPDATE subscriptions 
   SET subscription_expires_at = NOW() - INTERVAL '1 day',
       status = 'expired'
   WHERE user_id = '<buyer_id>';
   ```
4. Complete payment for the trade
5. Verify fee remains $0.99:
   ```sql
   SELECT buyer_transaction_fee_cents FROM trades WHERE id = '<trade_id>';
   ```

**Expected Results:**
- ✅ Fee remains $0.99 (locked at initiation)
- ✅ `buyer_transaction_fee_cents` = 99 (NOT retroactively changed to 299)
- ✅ Trade continues normally
- ✅ Buyer's next trade will use $2.99 fee

**Pass/Fail:** ___________

---

## Summary & Sign-Off

**Test Execution Summary:**

| Result | Count |
|--------|-------|
| ✅ Pass | _____ |
| ❌ Fail | _____ |
| ⚠️ Skip | _____ |
| **Total** | **12** |

**Critical Issues Found:**

_(List any blocking issues)_

---

**QA Sign-Off:**

- [ ] All critical test cases passed
- [ ] No blocking issues
- [ ] Ready for production deployment

**Tester Name:** _________________  
**Date:** _________________  
**Signature:** _________________

---

## Troubleshooting

### Common Issues

**Issue:** "Item not found" error
- **Solution:** Verify item ID exists and status='available'

**Issue:** "Insufficient SP balance"
- **Solution:** Grant test SP via admin:
  ```sql
  INSERT INTO sp_ledger (user_id, points_amount, source_type, description)
  VALUES ('<user_id>', 50, 'admin_adjustment', 'Test SP grant');
  ```

**Issue:** Stripe errors
- **Solution:** Verify `STRIPE_SECRET_KEY` set in Supabase Edge Function secrets

**Issue:** Edge Function timeout
- **Solution:** Check Supabase logs: Dashboard → Edge Functions → Logs

---

## Appendix: SQL Verification Queries

### Check trade status:
```sql
SELECT id, status, sp_amount, cash_amount_cents, platform_fee_cents, buyer_subscription_status
FROM trades 
WHERE buyer_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check SP wallet balance:
```sql
SELECT * FROM sp_wallet WHERE user_id = '<user_id>';
```

### Check SP ledger history:
```sql
SELECT created_at, points_amount, source_type, description, trade_id
FROM sp_ledger 
WHERE user_id = '<user_id>' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Stripe payments:
```sql
SELECT id, stripe_payment_intent_id, cash_amount_cents
FROM trades 
WHERE stripe_payment_intent_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;
```

---

**End of Manual Test Guide**
