# TRADE-V2-004: Fix Edge Function Error - Complete Trade

**Date:** February 3, 2026  
**Issue:** `FunctionsHttpError: Edge Function returned a non-2xx status code`  
**Scope:** Trade completion flow (Buyer marks trade as completed)  

---

## Problem Analysis

When a buyer clicks "Mark as Completed" on a trade, the mobile app receives:
```
Error: Edge Function returned a non-2xx status code
```

### Root Cause
The `complete-trade` Edge Function calls `complete_trade_v2` RPC, which tries to award SP to the seller via `earn_sp_for_trade()`. If the **seller's SP wallet doesn't exist**, the RPC function throws an exception:

```sql
IF v_wallet_id IS NULL THEN
  RAISE EXCEPTION 'SP wallet not found';
END IF;
```

This exception crashes the entire `complete_trade_v2` RPC, causing the Edge Function to return a 400 status code.

### Why Wallet Might Be Missing
- Seller account created before SP wallet initialization logic was in place
- SP wallet table was truncated or data was deleted
- New user hasn't earned any SP yet (wallet not auto-created)

---

## Solution Implemented

### 1. **New Migration: `20260203000000_fix_complete_trade_v2_missing_sp_wallet.sql`**

Three components:

#### A. `ensure_sp_wallet_exists()` Function
```sql
CREATE OR REPLACE FUNCTION public.ensure_sp_wallet_exists(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SELECT id INTO v_wallet_id FROM sp_wallets WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO sp_wallets (user_id, available_balance, pending_balance, frozen_balance, ...)
    VALUES (p_user_id, 0, 0, 0, ...);
  END IF;
  
  RETURN v_wallet_id;
END;
$$;
```

**Purpose:** Ensures SP wallet exists before any operation, creates if missing.

#### B. Updated `earn_sp_for_trade()`
Now calls `ensure_sp_wallet_exists()` before attempting to credit SP:
```sql
-- 1. Ensure wallet exists
v_wallet_id := public.ensure_sp_wallet_exists(p_user_id);

-- 2. Get current balance
SELECT available_balance INTO v_balance_before FROM sp_wallets WHERE id = v_wallet_id;

-- 3. Rest of function proceeds
```

#### C. Enhanced Error Handling in `complete_trade_v2()`
Added nested `BEGIN...EXCEPTION` blocks to catch SP awarding failures without crashing trade completion:

```sql
BEGIN
  SELECT public.earn_sp_for_trade(v_trade.seller_id, p_trade_id, v_trade.sp_amount)
  INTO v_sp_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail trade completion
    v_sp_result := jsonb_build_object(
      'success', false,
      'error', 'Failed to award SP: ' || SQLERRM
    );
    INSERT INTO debug_logs (...) VALUES (...);
END;
```

**Effect:** Trade completes successfully even if SP awarding fails. The error is logged for investigation.

---

### 2. **Enhanced Edge Function Logging**

Updated `supabase/functions/complete-trade/index.ts`:

```typescript
if (rpcError) {
  console.error('[complete-trade] RPC error details:', {
    message: rpcError.message,
    code: rpcError.code,
    details: rpcError.details
  });
  return new Response(JSON.stringify({ 
    success: false,
    error: rpcError.message,
    details: rpcError.details 
  }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**Improvement:** Returns detailed error information so mobile app can display actionable messages.

---

### 3. **Improved Mobile App Error Handling**

Updated `p2p-kids-marketplace/src/services/trade.ts`:

```typescript
if (!data.success) {
  console.error('[trade] RPC returned failure:', data);
  return {
    success: false,
    error: data.error || 'Failed to complete trade',
    message: data.message,
  };
}
```

**Improvement:** Now properly checks the RPC response and logs detailed error information.

---

## Deployment Steps

### Step 1: Run Migration
```bash
# In Supabase SQL Editor, run:
# File: supabase/migrations/20260203000000_fix_complete_trade_v2_missing_sp_wallet.sql

-- Copy the entire migration file contents and execute in Supabase SQL Editor
```

### Step 2: Verify Functions Created
```sql
-- Verify the new function exists
SELECT proname FROM pg_proc WHERE proname = 'ensure_sp_wallet_exists';

-- Verify earn_sp_for_trade was updated
SELECT prosrc FROM pg_proc WHERE proname = 'earn_sp_for_trade';

-- Verify complete_trade_v2 was updated
SELECT prosrc FROM pg_proc WHERE proname = 'complete_trade_v2';
```

### Step 3: Test Trade Completion

**Test Case 1: Normal Completion (Wallet Exists)**
1. Sign up and complete first trade
2. Click "Mark as Completed"
3. ✅ Trade should complete successfully
4. ✅ Check console: logs should show `Trade completion response: { success: true, ... }`

**Test Case 2: Seller with No Wallet (Wallet Created)**
1. Manually delete the seller's SP wallet:
   ```sql
   DELETE FROM sp_wallets WHERE user_id = '<seller_user_id>';
   ```
2. Have a buyer complete a trade with this seller
3. Buyer clicks "Mark as Completed"
4. ✅ Trade should complete successfully
5. ✅ New SP wallet should be created automatically
6. ✅ SP should be credited to the newly created wallet

**Test Case 3: Edge Function Error Handling**
1. In Supabase, manually update `complete_trade_v2` to have an intentional error
2. Buyer tries to complete trade
3. ✅ Should see error message with details
4. ✅ Console should log full error stack

---

## Verification Queries

Run these after deployment to verify the fix:

```sql
-- 1. Verify all three functions exist
SELECT proname, prosrc FROM pg_proc
WHERE proname IN ('ensure_sp_wallet_exists', 'earn_sp_for_trade', 'complete_trade_v2')
ORDER BY proname;

-- 2. Check if any trades have NULL sp_credit_ledger_entry_id (historical data)
SELECT id, seller_id, sp_amount, sp_credit_ledger_entry_id
FROM trades
WHERE status = 'completed' AND sp_amount > 0 AND sp_credit_ledger_entry_id IS NULL
LIMIT 10;

-- 3. Verify debug_logs captures any SP awarding failures
SELECT process_name, message, payload
FROM debug_logs
WHERE process_name = 'complete_trade_v2'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Rollback Plan

If the migration causes issues:

```sql
-- Rollback: Restore previous complete_trade_v2 from 20260103000000 migration
CREATE OR REPLACE FUNCTION public.complete_trade_v2(...)
-- [Previous definition from 20260103000000_fix_complete_trade_v2_two_step_payout_router.sql]

-- Drop new function
DROP FUNCTION IF EXISTS public.ensure_sp_wallet_exists(UUID);
```

---

## Related Files Changed

1. ✅ `supabase/migrations/20260203000000_fix_complete_trade_v2_missing_sp_wallet.sql` — New migration
2. ✅ `supabase/functions/complete-trade/index.ts` — Enhanced error logging
3. ✅ `p2p-kids-marketplace/src/services/trade.ts` — Improved error handling

---

## Testing Status

- [ ] Migration applied to local dev database
- [ ] Typecheck passes: `cd p2p-kids-marketplace && yarn typecheck`
- [ ] Lint passes: `cd p2p-kids-marketplace && yarn lint`
- [ ] Manual test: Trade completion with buyer
- [ ] Manual test: Trade completion with missing seller wallet
- [ ] Error logs verified in Supabase dashboard

---

## Performance Impact

- **Minimal**: `ensure_sp_wallet_exists()` performs one SELECT + one INSERT (if needed)
- **No new indexes required**: Uses existing `sp_wallets(user_id)` index
- **SP awarding failure doesn't block trade completion**: Trade completes even if SP fails

---

## Future Improvements

1. **Automatic wallet creation on signup** (MODULE-09)
   - Create SP wallet when user registers
   - Prevents this issue from ever occurring

2. **Batch wallet creation script**
   ```sql
   INSERT INTO sp_wallets (user_id, available_balance, ...) 
   SELECT u.id, 0, ... FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM sp_wallets w WHERE w.user_id = u.id);
   ```

3. **Monitor debug_logs for SP failures**
   - Add alert if SP awarding fails >5 times per hour
   - Investigate and fix root cause

---
