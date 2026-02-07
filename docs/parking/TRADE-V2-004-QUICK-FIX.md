# QUICK FIX: Trade Completion Error

**Error:** `Edge Function returned a non-2xx status code` when marking trade as completed

**Root Cause:** Seller's SP wallet doesn't exist

---

## 🚀 IMMEDIATE FIX (3 steps)

### Step 1: Apply Migration
Run this in **Supabase SQL Editor**:

**File:** `supabase/migrations/20260203000000_fix_complete_trade_v2_missing_sp_wallet.sql`

Copy the ENTIRE file content and paste into Supabase SQL Editor → Execute.

### Step 2: Verify Functions Created
```sql
SELECT proname FROM pg_proc WHERE proname IN ('ensure_sp_wallet_exists', 'earn_sp_for_trade', 'complete_trade_v2');
-- Should return 3 rows
```

### Step 3: Test Trade Completion
1. Open mobile app
2. Navigate to an existing trade  
3. Click "Mark as Completed"
4. ✅ Should now complete successfully

---

## 📋 What Was Fixed

| Component | Change |
|-----------|--------|
| **Database** | Added `ensure_sp_wallet_exists()` to auto-create missing wallets |
| **RPC** | Updated `earn_sp_for_trade()` to ensure wallet exists before crediting |
| **Trade RPC** | Updated `complete_trade_v2()` with graceful error handling |
| **Edge Function** | Enhanced logging for better error diagnostics |
| **Mobile App** | Improved error response handling |

---

## ✅ Verification Checklist

After applying migration:

```bash
# 1. Check functions exist
sqlite> SELECT COUNT(*) FROM pg_proc WHERE proname IN ('ensure_sp_wallet_exists', 'earn_sp_for_trade', 'complete_trade_v2');
# Expected: 3

# 2. Test on a known trade
sqlite> UPDATE trades SET status = 'in_progress' WHERE id = '<test_trade_id>';

# 3. Mobile app: Try to complete that trade
# Expected: Success with no errors
```

---

## 🔍 If Still Getting Errors

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → Functions → `complete-trade` → Logs
   - Look for error details in the most recent invocation

2. **Run Diagnostic Query:**
   ```sql
   -- Check if seller has SP wallet now
   SELECT id, user_id FROM sp_wallets WHERE user_id = '<seller_id>';
   
   -- Check debug logs for SP errors
   SELECT payload FROM debug_logs WHERE process_name = 'complete_trade_v2' ORDER BY created_at DESC LIMIT 5;
   ```

3. **If still missing wallet after trade:**
   - The migration may not have been applied
   - Verify Step 1 above was completed

---

## 📞 Support

If errors persist, check:
1. Migration file was copied **completely** (it's ~300 lines)
2. No SQL syntax errors during migration
3. Mobile app code was updated (yarn typecheck passes)
4. Supabase project has the latest migrations

---
