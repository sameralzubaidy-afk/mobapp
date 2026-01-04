# PAY-006 Bug Fix: Field Reference Error in complete_trade_v2

## Issue
When enabling the auto-payout feature and completing a trade, the app throws this error:

```
Error: record "v_trade" has no field "item_id"
[trade-service] completeTradeV2 error: FunctionsHttpError: Edge Function returned a non-2xx status code
```

## Root Cause
In `supabase/migrations/078_payout_router_integration.sql`, the `complete_trade_v2` RPC function references `v_trade.item_id` when updating the item status.

**Problem:** The trades table has a field named `listing_id`, not `item_id`.

**Location:** Line 218 of migration 078
```sql
-- WRONG ❌
UPDATE items
SET status = 'active',
    updated_at = NOW()
WHERE id = v_trade.item_id;  -- ← Field doesn't exist
```

## Fix Applied
Changed `v_trade.item_id` to `v_trade.listing_id`:

```sql
-- CORRECT ✅
UPDATE items
SET status = 'active',
    updated_at = NOW()
WHERE id = v_trade.listing_id;  -- ← Correct field name
```

## Migration File
**File:** `supabase/migrations/078_payout_router_integration.sql`

**Change:** Line 218 - Updated field reference in `complete_trade_v2` function

## How to Apply the Fix

### Option 1: Re-run Migration (Recommended)
Since migration 078 is idempotent, you can safely re-run it:

```bash
# In Supabase SQL Editor, run this to drop the old function:
DROP FUNCTION IF EXISTS complete_trade_v2(UUID, UUID) CASCADE;

# Then re-run the full migration 078 from the file:
# copy/paste the entire content of 078_payout_router_integration.sql
```

### Option 2: Manual SQL Fix (If migration can't be re-run)
```sql
-- Drop the old function
DROP FUNCTION IF EXISTS complete_trade_v2(UUID, UUID) CASCADE;

-- Re-create with correct field name (copy from fixed migration 078)
CREATE OR REPLACE FUNCTION complete_trade_v2(...)
-- ... full function definition with v_trade.listing_id instead of v_trade.item_id
```

## Verification
After applying the fix, verify the function was updated:

```sql
-- Check the function definition
SELECT prosrc FROM pg_proc WHERE proname = 'complete_trade_v2';

-- Expected: Should contain "v_trade.listing_id" (not "v_trade.item_id")

-- Test the function
SELECT complete_trade_v2('trade-uuid', 'user-uuid');

-- Expected: { "success": true, "trade_id": "...", ... }
```

## Testing the Feature
After applying the migration fix:

1. **Enable auto-payout in admin panel**
   - Navigate to `/payouts` in admin panel
   - Set "Enable Automatic Seller Payout" to "Enabled"
   - Click Save

2. **Complete a test trade**
   - As buyer, purchase an item
   - Mark trade as completed
   - App should process without error
   - Check transaction logs for payout creation

3. **Verify payout was created**
   ```sql
   -- In Supabase SQL Editor:
   SELECT * FROM seller_payouts 
   WHERE trade_id = 'your-trade-id'
   LIMIT 1;
   
   -- Expected: Should see payout record with:
   -- - status: 'pending', 'requires_action', or 'processing' (depending on config)
   -- - gross_amount_cents: trade amount
   -- - payout_fee_cents: calculated fee
   ```

## What Was Wrong
The trades table schema uses `listing_id` (a foreign key to the items table), not `item_id`. This is evident in:
- Migration 060 (trades schema definition)
- Admin trades view (migration 20251227): `SELECT t.listing_id`
- All other RPC functions that reference trades

The bug was introduced when copying trade completion logic without verifying the exact field names.

## Prevention
For future migrations:
1. Always reference the actual table schema before writing RPC functions
2. Use `pg_get_constraintdef` to verify column names
3. Run a test query first to confirm field names exist:
   ```sql
   SELECT listing_id FROM trades LIMIT 1;  -- Verify field exists
   ```

## Status
✅ **FIXED** - Migration 078 now uses correct `listing_id` field name

## Related Files
- `supabase/migrations/078_payout_router_integration.sql` - Fixed migration
- `p2p-kids-marketplace/src/services/tradeService.ts` - Calls the RPC (no changes needed)
- `p2p-kids-admin/src/app/payouts/page.tsx` - Admin UI for enabling auto-payout (already working)

## Next Steps
1. Apply the migration fix to your Supabase database
2. Test trade completion flow
3. Verify payout creation works as expected
4. Proceed with PAY-007 (Webhook integration for payout dispatch)
