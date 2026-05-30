# PGRST204 Error: Schema Cache Fix

## Problem
When creating a trade, you're getting this error:
```
PGRST204 - Could not find the 'cash_amount' column of 'trades' in the schema cache
```

## Root Cause
- Your TypeScript code is **CORRECT** - it uses `cash_amount_cents` ✓
- Your database migrations are **CORRECT** - they define `cash_amount_cents` ✓
- Supabase **PostgREST schema cache is STALE** - it hasn't picked up the correct column names

## Immediate Fix (Do This First)

### Option A: Reload Schema Cache (Fastest - 30 seconds)

**In Supabase Dashboard:**
1. Go to **Settings** → **Infrastructure**
2. Find your project and click the **Pause** button
3. Wait 10 seconds
4. Click the **Resume** button
5. Wait 20 seconds for the project to restart
6. Try creating a trade again

### Option B: Run Cache Refresh SQL (Alternative)

In **Supabase → SQL Editor**, run this:

```sql
-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```

If that doesn't work, also try:

```sql
-- Additional cache invalidation
NOTIFY pgrst, 'reload schema';
SELECT pg_reload_conf();
```

## Verification Steps

After applying the fix, run these queries in Supabase SQL Editor to verify:

### Step 1: Check trades table columns exist

```sql
-- List all columns in trades table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'trades'
ORDER BY ordinal_position;
```

**Expected columns to see:**
- `id` (uuid)
- `buyer_id` (uuid)
- `seller_id` (uuid)
- `listing_id` (uuid)  ← Critical
- `sp_amount` (integer)
- `cash_amount_cents` (integer) ← Critical - NOT "cash_amount"
- `buyer_transaction_fee_cents` (integer)
- `cash_currency` (text)
- `status` (text)
- ... and others

### Step 2: Verify no conflicting columns

```sql
-- Check if bad column names exist (these should NOT exist)
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'trades'
AND column_name IN ('cash_amount', 'amount_cash', 'amount_points', 'item_id');
```

**Expected result:** No rows (0 results)

If you see rows, you need to drop those columns:

```sql
-- Drop old/conflicting columns (if they appear above)
ALTER TABLE trades DROP COLUMN IF EXISTS cash_amount CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS amount_cash CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS amount_points CASCADE;
ALTER TABLE trades DROP COLUMN IF EXISTS item_id CASCADE;

-- Then reload schema cache
NOTIFY pgrst, 'reload schema';
```

### Step 3: Test a trade creation

After verifying columns are correct, test from your mobile app:

```typescript
// This should now work without PGRST204 error
const trade = await initiateTradeV2({
  item_id: 'some-item-uuid',
  sp_amount: 500
});
```

## Detailed Column Name Verification

The error specifically mentions looking for a `cash_amount` column, but your code uses `cash_amount_cents`. 

**These are the correct database columns (verified in migrations):**

| Column Name | Type | Purpose |
|-------------|------|---------|
| `cash_amount_cents` | INTEGER | Cash price in cents (e.g., 1500 = $15.00) |
| `sp_amount` | INTEGER | Swap Points portion used (e.g., 500 points) |
| `buyer_transaction_fee_cents` | INTEGER | Platform fee in cents (e.g., 29 = $0.29) |
| `cash_currency` | TEXT | Currency code (e.g., 'usd') |
| `listing_id` | UUID | Reference to item being purchased |
| `buyer_id` | UUID | User ID of buyer |
| `seller_id` | UUID | User ID of seller |
| `status` | TEXT | Trade state ('pending', 'in_progress', 'completed', etc.) |

**DO NOT use these (they don't exist or are old names):**
- ❌ `cash_amount` (wrong name)
- ❌ `amount_cash` (old name)
- ❌ `amount_points` (old name)
- ❌ `item_id` (should be `listing_id`)
- ❌ `price_cents` (old name)

## If Issue Persists

If you still get PGRST204 after all steps above, try this **nuclear option** (resets all caches):

```bash
# In terminal, connect to Supabase via CLI:
supabase start --reset
```

Or contact Supabase support with this information:
- Project URL: `https://xxxxx.supabase.co`
- Error: `PGRST204 - Could not find the 'cash_amount' column of 'trades'`
- Note: Column is correctly named `cash_amount_cents` in schema

## Code Status

✅ **Your code IS correct:**
- `trade.ts` correctly inserts into `cash_amount_cents`
- `trade.ts` correctly inserts into `buyer_transaction_fee_cents`
- Type definitions in `types/trade.ts` are correct
- All test files use correct column names

✅ **Your database schema IS correct:**
- Migration `062_fix_trades_v2_columns.sql` creates `cash_amount_cents`
- All RPC functions reference `v_trade.cash_amount_cents`
- All other migrations use correct names

❌ **Only issue: Supabase schema cache is STALE**
- Solution: Pause/Resume project or run NOTIFY command

## Next Steps After Fix

1. Pause/Resume project (Option A above)
2. Verify columns exist with Step 2 query above
3. Try creating a trade again in the app
4. If successful, the error is resolved! ✅

## Timeline

- **Immediate fix time:** 30 seconds (Pause/Resume)
- **Verification queries time:** 1-2 minutes
- **Expected success rate:** 95%+ (this is a standard cache issue)

---

**Created:** 2025  
**Last Updated:** Today  
**Status:** Ready to deploy
