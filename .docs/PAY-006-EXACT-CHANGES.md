# Summary of Changes to Migration 078

## Two Issues Fixed

### Issue #1: Wrong Field Name
**Location:** Line 213 (in complete_trade_v2 function)
**Change:** `item_id` → `listing_id`

```diff
  -- Update item status back to active (seller can relist or mark as sold)
  UPDATE items
  SET status = 'active',
      updated_at = NOW()
- WHERE id = v_trade.item_id;
+ WHERE id = v_trade.listing_id;
```

**Why:** Trades table has column `listing_id` (not `item_id`)

---

### Issue #2: Invalid Status Value  
**Location:** Line 212 (in complete_trade_v2 function)
**Change:** `'active'` → `'available'`

```diff
  -- Update item status back to active (seller can relist or mark as sold)
  UPDATE items
- SET status = 'active',
+ SET status = 'available',
      updated_at = NOW()
  WHERE id = v_trade.listing_id;
```

**Why:** Items table CHECK constraint only allows these statuses:
- `'draft'`
- `'available'` ✅ (what we use now)
- `'pending'`
- `'sold'`
- `'deleted'`
- `'paused'`

Invalid values: `'active'` ❌, `'item_id'` ❌

---

## Complete Fixed Code Section

Here's the entire fixed `complete_trade_v2` function with both corrections:

```sql
CREATE OR REPLACE FUNCTION complete_trade_v2(
  p_trade_id UUID,
  p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_trade RECORD;
  v_sp_result JSON;
  v_payout_result JSON;
BEGIN
  -- Lock trade row for update
  SELECT * INTO v_trade
  FROM trades
  WHERE id = p_trade_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Trade not found');
  END IF;

  -- Verify user is buyer or seller
  IF v_trade.buyer_id != p_user_id AND v_trade.seller_id != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Verify trade is in_progress
  IF v_trade.status != 'in_progress' THEN
    RETURN json_build_object('success', false, 'error', 'Trade must be in_progress to complete. Current status: ' || v_trade.status);
  END IF;

  -- If seller is marking complete, record timestamp
  IF v_trade.seller_id = p_user_id AND v_trade.seller_marked_completed_at IS NULL THEN
    UPDATE trades
    SET seller_marked_completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_trade_id;
  END IF;

  -- Update trade status to completed
  UPDATE trades
  SET status = 'completed',
      completed_at = NOW(),
      last_status_change_at = NOW(),
      updated_at = NOW()
  WHERE id = p_trade_id;

  -- ✅ FIX #1 + #2: Update item status to 'available' using 'listing_id'
  UPDATE items
  SET status = 'available',
      updated_at = NOW()
  WHERE id = v_trade.listing_id;

  -- Award SP to seller (if eligible)
  IF v_trade.seller_id IS NOT NULL THEN
    SELECT earn_sp_for_completed_trade(v_trade.seller_id, p_trade_id, v_trade.item_price_cents)
    INTO v_sp_result;
  END IF;

  -- Create seller payout (PAY-006 integration)
  IF v_trade.seller_id IS NOT NULL AND v_trade.cash_amount_cents > 0 THEN
    SELECT create_seller_payout_on_trade_completion(
      p_trade_id,
      v_trade.seller_id,
      v_trade.cash_amount_cents
    ) INTO v_payout_result;
  END IF;

  RETURN json_build_object(
    'success', true,
    'trade_id', p_trade_id,
    'message', 'Trade completed successfully',
    'sp_result', v_sp_result,
    'payout_result', v_payout_result
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION complete_trade_v2(UUID, UUID) TO anon, authenticated;
```

---

## Verification Checklist

Before testing in the app, verify in Supabase SQL Editor:

```sql
-- 1. Function exists
SELECT count(*) FROM information_schema.routines 
WHERE routine_name = 'complete_trade_v2';
-- Expected: 1

-- 2. Valid item statuses
SELECT check_clause FROM information_schema.check_constraints 
WHERE constraint_name = 'items_status_check';
-- Expected: Should include 'available'

-- 3. Trades table has listing_id
SELECT column_name FROM information_schema.columns
WHERE table_name = 'trades' AND column_name = 'listing_id';
-- Expected: listing_id (1 row)

-- 4. Items table has status
SELECT column_name FROM information_schema.columns
WHERE table_name = 'items' AND column_name = 'status';
-- Expected: status (1 row)
```

All checks passing = ✅ Safe to test in mobile app

---

## What This Means for Users

When a buyer completes a trade:

1. ✅ Trade marked as `completed`
2. ✅ Item returns to `available` status (can be relisted)
3. ✅ Seller gets Swap Points (if eligible)
4. ✅ Seller payout created automatically (if auto-payout enabled + method verified)
5. ❌ No more database constraint violations!

---

## File Modified

**Only one file changed:**
- `supabase/migrations/078_payout_router_integration.sql`

**Lines changed:** 212-213 (2 values, same UPDATE statement)
**Type:** Bug fix (correcting field names and status values)
**Impact:** Makes the complete_trade_v2 function work correctly
