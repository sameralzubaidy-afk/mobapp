# PAY-006 Quick Start Guide

## What to Do Next (Copy-Paste Commands)

### Step 1: Apply Migrations to Supabase Production

**⚠️ IMPORTANT:** Run these SQL files **in order** in your Supabase SQL Editor.

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of these files **one at a time**:

#### Migration 1: Admin Config Flag
```
File: supabase/migrations/077_add_auto_payout_admin_config.sql
```

Click "Run" and verify output shows success.

#### Migration 2: Payout Router RPCs
```
File: supabase/migrations/078_payout_router_integration.sql
```

Click "Run" and verify output shows success.

---

### Step 2: Verify Migrations Applied Correctly

Run this in Supabase SQL Editor:

```sql
-- Check 1: Admin config exists
SELECT key, value, category, data_type 
FROM admin_config 
WHERE key = 'enable_automatic_seller_payout';

-- Expected: 1 row with value = 'false'

-- Check 2: RPC functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'get_admin_payout_config',
  'calculate_payout_fee_cents',
  'create_seller_payout_on_trade_completion'
);

-- Expected: 3 rows

-- Check 3: Test fee calculation
SELECT calculate_payout_fee_cents('stripe_connect', 10000);
-- Expected: 50

SELECT calculate_payout_fee_cents('paypal', 5000);
-- Expected: 100
```

**If all checks pass:** ✅ Migrations successful!

---

### Step 3: Run Unit Tests Locally

Open your terminal in the project root:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Run type-check
npm run type-check

# Run unit tests for payout router
npm test -- src/services/__tests__/payoutRouter.test.ts
```

**Expected:** All tests pass

---

### Step 4: Manual Testing in iOS Simulator

#### Test Scenario: Auto-Payout DISABLED (Manual Withdrawal Mode)

1. **Disable auto-payout** (if not already):
   ```sql
   -- In Supabase SQL Editor
   UPDATE admin_config 
   SET value = 'false' 
   WHERE key = 'enable_automatic_seller_payout';
   ```

2. **Open iOS Simulator:**
   ```bash
   cd p2p-kids-marketplace
   npm run start:android:dev  # or npm run ios
   ```

3. **Log in as BUYER** for an existing test trade in `in_progress` status

4. **Navigate to:** Trade Timeline screen

5. **Tap:** "Mark Complete" button

6. **Verify in Supabase:**
   ```sql
   -- Replace <TRADE_ID> with your test trade ID
   SELECT 
     id,
     trade_id,
     status,
     gross_amount_cents,
     payout_fee_cents,
     net_amount_cents,
     initiated_at
   FROM seller_payouts 
   WHERE trade_id = '<TRADE_ID>';
   ```

   **Expected:**
   - `status` = `pending`
   - `gross_amount_cents` = trade's cash amount
   - `payout_fee_cents` = `0` (calculated at withdrawal time)
   - `initiated_at` = `NULL`

#### Test Scenario: Auto-Payout ENABLED

1. **Enable auto-payout:**
   ```sql
   UPDATE admin_config 
   SET value = 'true' 
   WHERE key = 'enable_automatic_seller_payout';
   ```

2. **Ensure test SELLER has a verified Stripe Connect payout method:**
   ```sql
   -- Check seller's payout methods
   SELECT 
     id, user_id, method_type, is_primary, is_verified
   FROM seller_payout_methods 
   WHERE user_id = '<SELLER_USER_ID>'
     AND is_primary = true
     AND is_verified = true;
   ```
   
   If none exists, add via mobile app: Settings → Payout Methods → Add Stripe

3. **Complete another trade** (same steps as above)

4. **Verify payout status:**
   ```sql
   SELECT status, provider, payout_fee_cents, initiated_at
   FROM seller_payouts 
   WHERE trade_id = '<NEW_TRADE_ID>';
   ```

   **Expected:**
   - `status` = `processing`
   - `provider` = `stripe`
   - `payout_fee_cents` > `0` (calculated)
   - `initiated_at` = recent timestamp

---

### Step 5: Manual Testing Checklist

Follow detailed test cases in:
```
.docs/PAY-006-MANUAL-TESTS.md
```

Mark each test case as PASS/FAIL.

---

## Troubleshooting

### Issue: RPC function not found

**Solution:**
1. Check you ran both migration files
2. Verify functions exist:
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name LIKE '%payout%';
   ```

### Issue: Admin config not found

**Solution:**
1. Verify migration 077 was applied
2. Manually insert if needed:
   ```sql
   INSERT INTO admin_config (key, value, description, category, data_type, is_active)
   VALUES (
     'enable_automatic_seller_payout',
     'false',
     'Enable automatic seller payout on trade completion',
     'fees',
     'boolean',
     true
   )
   ON CONFLICT (key) DO NOTHING;
   ```

### Issue: Payout not created on trade completion

**Check:**
1. Trade status was `in_progress` before completion
2. Trade has `cash_amount_cents` > 0
3. Check Edge Function logs for errors:
   ```
   Supabase Dashboard → Edge Functions → complete-trade → Logs
   ```

### Issue: Duplicate payouts created

**This should NOT happen** (idempotency protection).

If it does:
1. Check `idempotency_key` on duplicate payouts
2. Verify unique index exists:
   ```sql
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'seller_payouts' 
   AND indexname LIKE '%idempotency%';
   ```

---

## Quick Links

- **Implementation Summary:** `.docs/PAY-006-IMPLEMENTATION-SUMMARY.md`
- **Manual Test Cases:** `.docs/PAY-006-MANUAL-TESTS.md`
- **Deliverables Checklist:** `.docs/PAY-006-DELIVERABLES-CHECKLIST.md`
- **Module Requirements:** `Prompts/MODULE-06-TRADE-FLOW-sellerpayouts.md`
- **Verification File:** `Prompts/MODULE-06-VERIFICATION-V2.md`

---

## When You're Done

✅ All migrations applied  
✅ All unit tests pass  
✅ Manual tests complete (at least Test Cases 1-8)  
✅ No errors in Edge Function logs  

**Mark PAY-006 as COMPLETE** and proceed to:
- **PAY-007:** Webhooks (Stripe/PayPal → update payout status)
- **PAY-008:** Earnings Screen UI (show pending balance, withdrawal button)

---

**Need Help?**  
Refer to the implementation summary or verification file for detailed context.
