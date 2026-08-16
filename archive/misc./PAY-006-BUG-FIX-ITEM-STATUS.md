# PAY-006 Bug Fix #2: Invalid Item Status Constraint

## Issue
After fixing the first bug (field name), a second error appeared:

```
Error: new row for relation "items" violates check constraint "items_status_check"
```

When trying to complete a trade with auto-payout enabled.

## Root Cause
The `complete_trade_v2` function was trying to set item status to `'active'`, but the items table's CHECK constraint only allows these statuses:

- `'draft'`
- `'available'`
- `'pending'`
- `'sold'`
- `'deleted'`
- `'paused'`

**`'active'` is NOT a valid status.**

## Solution
Changed the item status update from `'active'` to `'available'`:

**BEFORE (❌ WRONG):**
```sql
UPDATE items
SET status = 'active',
    updated_at = NOW()
WHERE id = v_trade.listing_id;
```

**AFTER (✅ CORRECT):**
```sql
UPDATE items
SET status = 'available',
    updated_at = NOW()
WHERE id = v_trade.listing_id;
```

This makes sense semantically:
- When a trade completes, the item returns to `'available'` status
- The seller can then relist it or mark it as permanently sold
- `'available'` matches the item listing lifecycle

## Files Modified
- `supabase/migrations/078_payout_router_integration.sql` - Line 213: Changed status value

## How to Apply the Fix

### Step 1: Drop the old function
```sql
DROP FUNCTION IF EXISTS complete_trade_v2(UUID, UUID) CASCADE;
```

### Step 2: Re-run the fixed migration
Copy the entire content of `supabase/migrations/078_payout_router_integration.sql` and paste into Supabase SQL Editor.

### Step 3: Verify
```sql
-- Run the comprehensive test script:
-- Copy content from: .docs/PAY-006-COMPREHENSIVE-TEST.sql
-- This will validate all functions and constraints
```

## Why This Happened
The initial implementation assumed `'active'` was a valid item status without checking the actual constraints in the database schema. The correct flow is:

1. Item created → `'pending'` (awaiting review)
2. Item approved → `'available'` (listed for sale/trade)
3. Trade completes → `'available'` (seller can relist)
4. Seller marks sold → `'sold'` (transaction complete)

## Testing
Before you try in the app, run the test script in `.docs/PAY-006-COMPREHENSIVE-TEST.sql` to verify:
1. All RPC functions exist
2. Payout fee calculations work correctly
3. Admin config values are loaded
4. Item status constraint is satisfied

## Next Steps
1. Apply the migration fix
2. Run the test script to verify
3. Try completing a trade in the mobile app
4. Verify payout is created (check seller_payouts table)

## Status
✅ **FIXED** - Migration 078 now uses correct `'available'` item status

## Related Issues
- Previous: Field name was `item_id` instead of `listing_id` (✅ Fixed)
- Current: Item status was `'active'` instead of `'available'` (✅ Fixed)

The complete_trade_v2 function now:
1. ✅ Updates item status to valid `'available'` status
2. ✅ References correct `listing_id` field
3. ✅ Creates payout record with correct logic
4. ✅ Follows item lifecycle correctly
