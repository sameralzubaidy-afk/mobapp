# PAY-006: SP Function Call Fix

## Issue #3: Function Not Found Error

**Error:** `FunctionsHttpError: Edge Function returned a non-2xx status code`

**Root Cause:** `complete_trade_v2` RPC was calling non-existent function `earn_sp_for_completed_trade`

**What was wrong:**
```sql
-- BROKEN: Wrong function name + wrong parameter
SELECT earn_sp_for_completed_trade(v_trade.seller_id, p_trade_id, v_trade.item_price_cents)
```

**What was fixed:**
```sql
-- FIXED: Correct function name + correct parameter
SELECT earn_sp_for_trade(v_trade.seller_id, p_trade_id, v_trade.sp_amount)
```

## Function Details

**Correct Function:** `earn_sp_for_trade(p_user_id UUID, p_trade_id UUID, p_points INTEGER)`

**Parameters:**
- `p_user_id`: Seller's user ID
- `p_trade_id`: Trade ID
- `p_points`: Number of SP to award (from `v_trade.sp_amount`, not `item_price_cents`)

**Logic:** Awards SP to seller when buyer used SP in the trade (seller earns the same amount buyer spent)

## Testing

**Test Script:** `.docs/PAY-006-TEST-SP-FUNCTION-FIX.sql`

**Validation Steps:**
1. Verify `earn_sp_for_trade` function exists
2. Verify `complete_trade_v2` function exists
3. Test SP earning with sample data
4. Test complete trade flow

## Migration Status

**File:** `supabase/migrations/078_payout_router_integration.sql`
**Status:** ✅ FIXED - Function call corrected
**Line:** ~280 (in complete_trade_v2 function)

## Next Steps

1. **Apply Migration:** Drop old function, re-run migration 078
2. **Test Function:** Run `.docs/PAY-006-TEST-SP-FUNCTION-FIX.sql`
3. **Test in App:** Complete a trade with SP usage
4. **Verify Results:** Check SP ledger and payout creation

## Confidence: 🟢 HIGH

- Function exists in migration 061 ✅
- Parameters match function signature ✅
- Logic aligns with SP earning rules ✅
- No syntax errors in updated code ✅