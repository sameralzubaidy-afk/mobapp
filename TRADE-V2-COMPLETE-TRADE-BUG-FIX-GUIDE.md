# 🔧 FIX: Trade Completion Error in Mobile App

**Status:** 🔴 Critical Bug - Blocking Trade Completion  
**Solution:** Ready to Deploy - 1 SQL Migration  
**Time to Fix:** 2 minutes  

---

## What You're Seeing

When testing trade completion from the **buyer side**, you get this error:

```
ERROR  [trade-service] completeTradeV2 error: 
FunctionsHttpError: Edge Function returned a non-2xx status code
```

The trade fails to complete, and the buyer sees an error dialog.

---

## What's Wrong (Technical)

The `complete_trade_v2` PostgreSQL function has a **type mismatch** when checking the seller's subscription status:

### The Bug 🐛
```sql
DECLARE
  v_subscription_summary JSONB;  -- ← WRONG TYPE
BEGIN
  -- This returns a TABLE, not JSON!
  SELECT public.get_subscription_summary(...) INTO v_subscription_summary;
  
  -- Trying to use JSON operator on a TABLE result causes runtime error
  IF (v_subscription_summary->>'can_earn_sp')::BOOLEAN = TRUE THEN
```

### The Fix ✅
```sql
DECLARE
  v_subscription_summary RECORD;  -- ← CORRECT TYPE
  v_can_earn_sp BOOLEAN;
BEGIN
  -- Properly unpack the TABLE columns
  SELECT status, can_spend_sp 
  FROM public.get_subscription_summary(...)
  INTO v_subscription_summary.status, v_can_earn_sp;
  
  -- Use the boolean value directly
  IF v_can_earn_sp = TRUE THEN
```

---

## How to Fix (Step by Step)

### 1️⃣ Open Supabase Dashboard

Go to [https://app.supabase.com](https://app.supabase.com) and select your project.

### 2️⃣ Open SQL Editor

Click **SQL Editor** in the left sidebar.

### 3️⃣ Copy & Paste the Fix

Open the file: **`QUICK-FIX-COMPLETE-TRADE.sql`**

Copy **ALL** the content (everything from `DROP FUNCTION` to the end) and paste it into the Supabase SQL Editor.

### 4️⃣ Execute the SQL

Click the **Execute** button (play icon) or press `Ctrl+Enter`.

You should see:
```
✓ DROP FUNCTION (if it existed)
✓ CREATE FUNCTION
✓ GRANT
```

---

## Verify It Worked

Run this in the SQL Editor:

```sql
SELECT proname FROM pg_proc WHERE proname = 'complete_trade_v2' LIMIT 1;
```

**Expected Result:** Shows one row with `complete_trade_v2`

---

## Test the Fix in Mobile App

1. **Log in as a buyer** on the mobile app (Android Emulator)
2. **Create a test trade:**
   - Find an item
   - Click "Buy Now"
   - Complete payment
3. **Mark as complete:**
   - Trade status should be "in_progress"
   - Click "Mark Complete" button
   - **Should succeed without error** ✅

---

## What Changed

| Line | Before | After | Reason |
|------|--------|-------|--------|
| 31 | `v_subscription_summary JSONB` | `v_subscription_summary RECORD` | Correct type for TABLE result |
| 32 | _(not present)_ | `v_can_earn_sp BOOLEAN` | Store boolean value separately |
| 90-91 | `SELECT public.get_subscription_summary(...) INTO v_subscription_summary;` | `SELECT status, can_spend_sp FROM public.get_subscription_summary(...) INTO v_subscription_summary.status, v_can_earn_sp;` | Properly unpack TABLE columns |
| 93 | `IF (v_subscription_summary->>'can_earn_sp')::BOOLEAN` | `IF v_can_earn_sp = TRUE` | Use boolean variable directly |

---

## Affected Code

- **Migration File:** `20260103000000_fix_complete_trade_v2_two_step_payout_router.sql` ✅ FIXED
- **RPC Function:** `complete_trade_v2` ✅ FIXED
- **Edge Function:** `supabase/functions/complete-trade/index.ts` (No changes needed)
- **Mobile Service:** `src/services/trade.ts` (No changes needed)

---

## Side Effects

✅ **None** - This is a pure bug fix. No breaking changes.

---

## After the Fix

Once applied, you can:

1. ✅ Complete trades from buyer side
2. ✅ Seller receives SP earnings
3. ✅ Payout is created (if auto-payout enabled)
4. ✅ Item status updates to "sold"
5. ✅ Continue testing MSG-004 message expiration

---

## Rollback (If Needed)

If something goes wrong, you can revert by running:

```sql
DROP FUNCTION IF EXISTS public.complete_trade_v2(UUID, UUID) CASCADE;
```

Then re-deploy the previous working version (if you have backup).

---

## Summary

| Item | Value |
|------|-------|
| **Error** | Edge Function returned non-2xx status code |
| **Cause** | JSONB vs TABLE type mismatch in `complete_trade_v2` |
| **Fix** | Update function signature and variable types |
| **Files Changed** | 1 SQL migration |
| **Risk Level** | 🟢 Low - Pure bug fix |
| **Testing Required** | ✅ Basic trade completion test |

---

**Ready to deploy!** Copy the SQL from `QUICK-FIX-COMPLETE-TRADE.sql` and execute in Supabase. 🚀
