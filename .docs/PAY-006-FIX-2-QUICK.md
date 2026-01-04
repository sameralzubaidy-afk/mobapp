# Quick Fix #2: Apply Item Status Correction

## The Problem
Error: `new row for relation "items" violates check constraint "items_status_check"`

**Cause:** Tried to set item status to `'active'` but valid values are only:
`'draft'`, `'available'`, `'pending'`, `'sold'`, `'deleted'`, `'paused'`

## The Solution
Changed `status = 'active'` → `status = 'available'` in migration 078

## Apply in 2 Minutes

### 1. Open Supabase SQL Editor

### 2. Drop the old function
```sql
DROP FUNCTION IF EXISTS complete_trade_v2(UUID, UUID) CASCADE;
```

### 3. Re-run migration 078
Copy/paste entire content of: `supabase/migrations/078_payout_router_integration.sql`

### 4. Quick Verify
```sql
-- Run test script from: .docs/PAY-006-COMPREHENSIVE-TEST.sql
-- This validates all functions work correctly
```

## Done! ✅

Now try completing a trade in the app again.
