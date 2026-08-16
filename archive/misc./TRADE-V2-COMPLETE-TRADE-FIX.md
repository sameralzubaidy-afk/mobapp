# TRADE-V2: Fix Complete Trade Function Error

## Issue
When testing trade completion from the buyer side, the app throws:

```
ERROR  [trade-service] completeTradeV2 error: FunctionsHttpError: Edge Function returned a non-2xx status code
```

This is a 400/500 error returned from the `complete-trade` Edge Function, which calls the `complete_trade_v2` RPC.

---

## Root Cause

In migration `20260103000000_fix_complete_trade_v2_two_step_payout_router.sql`, the `complete_trade_v2` RPC function was trying to handle the `get_subscription_summary()` function incorrectly.

**The Problem:**
```sql
-- WRONG ❌ - Treating TABLE return as JSONB
DECLARE
  v_subscription_summary JSONB;
BEGIN
  SELECT public.get_subscription_summary(v_trade.seller_id) INTO v_subscription_summary;
  IF (v_subscription_summary->>'can_earn_sp')::BOOLEAN = TRUE THEN
    -- ...
```

**Why it fails:**
- `get_subscription_summary()` returns a `TABLE (status TEXT, can_spend_sp BOOLEAN, ...)`
- You cannot assign a TABLE result to a JSONB variable
- You cannot use the `->` JSON operator on a record variable
- This causes a PostgreSQL runtime error, which makes the RPC fail with a 400 status code

---

## Solution

Changed the code to properly handle the TABLE return type:

**Fix applied ✅:**
```sql
-- CORRECT ✅ - Properly handle TABLE return type
DECLARE
  v_subscription_summary RECORD;
  v_can_earn_sp BOOLEAN;
BEGIN
  SELECT status, can_spend_sp FROM public.get_subscription_summary(v_trade.seller_id)
  INTO v_subscription_summary.status, v_can_earn_sp;
  
  IF v_can_earn_sp = TRUE THEN
    -- ...
```

**Changes Made:**
1. Changed `v_subscription_summary` from `JSONB` to `RECORD` (line 31)
2. Added new variable `v_can_earn_sp BOOLEAN` (line 32)
3. Updated the SELECT to unpack only the columns we need (line 90-91)
4. Updated the IF condition to use the boolean variable directly (line 93)

---

## How to Apply the Fix

### Step 1: Navigate to Supabase SQL Editor
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Drop the Old Function
```sql
DROP FUNCTION IF EXISTS public.complete_trade_v2(UUID, UUID) CASCADE;
```

### Step 3: Re-run the Fixed Migration
Copy the entire content of:
```
supabase/migrations/20260103000000_fix_complete_trade_v2_two_step_payout_router.sql
```

And paste it into the SQL Editor, then execute.

---

## Verification

After applying the fix, test that the function works:

```sql
-- Test 1: Verify function exists
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'complete_trade_v2';

-- Expected: Should return 1 row with routine_type = 'FUNCTION'

-- Test 2: Test with a real trade (replace with your trade ID)
SELECT complete_trade_v2('your-trade-id'::UUID, 'your-user-id'::UUID);

-- Expected: Should return JSON with success = true (or status validation error if trade is not in_progress)
```

---

## Testing the Mobile App

After applying the fix to Supabase:

1. **Create a test trade flow:**
   - Log in as buyer
   - Find an item to purchase
   - Complete the payment
   - Trade should now be `in_progress`

2. **Mark as completed:**
   - Click "Mark Complete" (buyer button on trade screen)
   - Should succeed without the FunctionsHttpError

3. **Verify in Supabase:**
   ```sql
   -- Check that trade was marked completed
   SELECT id, status, completed_at, seller_marked_completed_at
   FROM trades
   WHERE id = 'your-trade-id'
   ORDER BY updated_at DESC
   LIMIT 1;
   ```

---

## Files Modified

- ✅ `supabase/migrations/20260103000000_fix_complete_trade_v2_two_step_payout_router.sql` - Fixed function definition

---

## Summary

| Item | Details |
|------|---------|
| **Error** | FunctionsHttpError: Edge Function returned a non-2xx status code |
| **Root Cause** | Type mismatch in `complete_trade_v2` RPC (JSONB vs TABLE) |
| **Impact** | Trade completion fails for buyers |
| **Severity** | 🔴 Critical - Blocks core trade flow |
| **Fix** | Updated `20260103000000_fix_complete_trade_v2_two_step_payout_router.sql` |
| **Time to Apply** | ~2 minutes |

---

## Next Steps

1. Apply the migration fix to Supabase
2. Test trade completion in the mobile app
3. Verify seller SP earnings are applied correctly
4. Verify payout was created (if auto-payout enabled)
5. Proceed with further testing of MSG-004 message expiration

---

**Status: READY FOR DEPLOYMENT** ✅
