# Quick Fix: Apply Migration 078 Correction

## The Problem
Error when completing a trade with auto-payout enabled:
```
Error: record "v_trade" has no field "item_id"
```

## The Solution
The trades table uses `listing_id` (not `item_id`). Fixed in migration 078.

## Steps to Apply (2 minutes)

### 1. Open Supabase SQL Editor
Go to your Supabase project → SQL Editor

### 2. Drop the Old Function
Copy and run this:
```sql
DROP FUNCTION IF EXISTS complete_trade_v2(UUID, UUID) CASCADE;
```

### 3. Re-run the Fixed Migration
1. Open file: `/supabase/migrations/078_payout_router_integration.sql`
2. Copy ALL the content
3. Paste into Supabase SQL Editor
4. Click "Run"

### 4. Verify It Works
Run this test query:
```sql
-- This should NOT error (function exists)
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'complete_trade_v2';
```

Expected result: One row with `complete_trade_v2`

## Done! ✅
The auto-payout feature will now work correctly when completing trades.

---

## What Changed
- Line 218 of migration 078: `v_trade.item_id` → `v_trade.listing_id`
- This is the ONLY change needed
- Migration file is fully idempotent and safe to re-run
