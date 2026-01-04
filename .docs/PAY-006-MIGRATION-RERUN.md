# PAY-006: Step-by-Step Migration Re-run (Fixes "function does not exist")

## Problem
Error: `function earn_sp_for_trade(uuid, uuid, integer) does not exist`

**Reason:** Migration 061 was NOT re-run, so the defensive check I added is not in your database.

---

## Solution: Re-run migrations 061 → 078 in Supabase SQL Editor

### Step 1: Drop both old functions
Copy and run in **Supabase SQL Editor**:
```sql
DROP FUNCTION IF EXISTS earn_sp_for_trade(UUID, UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS complete_trade_v2(UUID, UUID) CASCADE;
```

Expected: `Success. No rows returned` for both.

---

### Step 2: Re-run Migration 061
1. Copy **entire file**: `supabase/migrations/061_sp_ledger_and_trade_rpcs.sql`
2. Paste into Supabase SQL Editor
3. Click "Run"

Expected: Success messages. This recreates `earn_sp_for_trade` with the **defensive check for invalid SP amounts**.

---

### Step 3: Re-run Migration 078
1. Copy **entire file**: `supabase/migrations/078_payout_router_integration.sql`
2. Paste into Supabase SQL Editor
3. Click "Run"

Expected: Success messages. This recreates `complete_trade_v2` and payout functions.

---

### Step 4: Verify Both Functions Exist
Run this verification query:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('earn_sp_for_trade', 'complete_trade_v2')
ORDER BY routine_name;
```

**Expected result:**
```
routine_name           | routine_type
-----------------------+--------------
complete_trade_v2      | FUNCTION
earn_sp_for_trade      | FUNCTION
```

If you see 2 rows, proceed to Step 5. If you see 0-1 rows, the migrations did not apply successfully — check for SQL errors.

---

### Step 5: Test in Mobile App
1. **As seller:** Complete a trade (item is "cash only", no SP involved)
2. **Expected:**
   - ✅ No error dialog
   - ✅ Trade status → `completed`
   - ✅ Item status → `available`
   - ✅ Payout record created (if auto-payout enabled)

---

## Troubleshooting

**Still seeing "function does not exist"?**
- ❌ Migration 061 did not apply
  - Check Supabase SQL Editor for errors (red text)
  - If syntax error, copy the ENTIRE file again and try once more
  
**Still seeing "check constraint" error?**
- ❌ Migration 061 applied but defensive check not working
  - Run: `.docs/PAY-006-SP-ZERO-POINTS-TEST.sql` to test
  - If that works but trade completion fails, check the trade's `sp_amount` in DB

**Need detailed logs from Edge Function?**
- Check Supabase → Edge Functions → `complete-trade` → Logs tab
- Look for RPC error messages (will show which RPC call failed and why)

---

## Critical: Order Matters

✅ **CORRECT ORDER:**
1. Drop both functions
2. Re-run migration 061 (contains `earn_sp_for_trade`)
3. Re-run migration 078 (contains `complete_trade_v2` which calls `earn_sp_for_trade`)

❌ **WRONG ORDER:**
- Running 078 before 061 → `complete_trade_v2` tries to call a non-existent function → error

---

## After successful migrations, test the Edge Function logs

Go to **Supabase Dashboard** → **Edge Functions** → `complete-trade` → **Logs**:
- You should see successful calls with `{"success": true, "trade_id": "...", ...}`
- If you see errors, paste them here and I'll diagnose

---

Let me know once you've completed the steps above — then we can test in the app! 🚀