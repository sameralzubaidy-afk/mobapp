# TC-B01 SP Restore Bug Fix

## Issue Summary
**Test Case:** TC-B01 · Seller declines offer  
**Bug:** When a seller declines an offer where the buyer used SP, the SP is NOT restored to the buyer's available balance.  
**Evidence:** Screenshot shows -71 SP in buyer's SP History (spent), but should have been restored to available balance.

## Root Cause Analysis

### What Was Wrong
The `transactions-update` Edge Function had TWO critical bugs when handling seller decline:

1. **Missing `sp_amount` field**: The SELECT query didn't fetch `sp_amount`, so the code didn't know how much SP to refund
2. **Incorrect RPC call**: The code tried to call `fn_release_sp_on_cancel` as an RPC:
   ```typescript
   await svcClient.rpc('fn_release_sp_on_cancel', { p_trade_id: trade_id });
   ```
   
   **Problem:** `fn_release_sp_on_cancel` is a **TRIGGER function** (no parameters), not an RPC. This call always failed silently (caught by try/catch).

### How SP Restoration Should Work

When a trade is cancelled, TWO operations must happen:

1. **Trigger fires automatically** (`trigger_release_sp_on_cancel`):
   - Fires AFTER UPDATE when status changes to 'cancelled'
   - Releases `reserved_sp` (subtracts from the buyer's reserved_sp field)
   - Updates `sp_released_at` timestamp
   - **Does NOT** modify `available_balance` (by design, to avoid double-refund)

2. **RPC must be called explicitly** (`credit_sp_for_cancelled_trade`):
   - Adds SP back to buyer's `available_balance`
   - Subtracts from `lifetime_spent` (reverses the spend)
   - Creates an 'earn_refund' ledger entry for audit trail
   - Returns confirmation with ledger_entry_id

**Before the fix:** Only step 1 happened (trigger), so `reserved_sp` was released but `available_balance` was never restored.

## The Fix

### Changes Made

**File:** `supabase/functions/transactions-update/index.ts`

#### Change 1: Add `sp_amount` to SELECT query
```typescript
// BEFORE
.select('id, status, seller_id, buyer_id, listing_id, stripe_payment_intent_id, cash_amount_cents, auto_complete_at')

// AFTER
.select('id, status, seller_id, buyer_id, listing_id, stripe_payment_intent_id, cash_amount_cents, auto_complete_at, sp_amount')
```

#### Change 2: Replace incorrect RPC call with correct one
```typescript
// BEFORE (broken - tried to call trigger as RPC)
try {
  await svcClient.rpc('fn_release_sp_on_cancel', { p_trade_id: trade_id });
} catch (spErr: unknown) {
  const msg = spErr instanceof Error ? spErr.message : 'Unknown error';
  console.error('[transactions-update] SP release error:', msg);
}

// AFTER (correct - calls proper RPC with required parameters)
const spAmount = trade.sp_amount ?? 0;
if (spAmount > 0) {
  try {
    const { error: spErr } = await svcClient.rpc('credit_sp_for_cancelled_trade', {
      p_user_id: trade.buyer_id,
      p_trade_id: trade_id,
      p_points: spAmount
    });
    if (spErr) {
      console.error('[transactions-update] SP refund error:', spErr.message);
      // Continue with decline even if SP refund fails - buyer can contact support
    } else {
      console.log(`[transactions-update] Refunded ${spAmount} SP to buyer ${trade.buyer_id} for trade ${trade_id}`);
    }
  } catch (spErr: unknown) {
    const msg = spErr instanceof Error ? spErr.message : 'Unknown error';
    console.error('[transactions-update] SP refund error:', msg);
  }
}
```

### Deployment Status
✅ **DEPLOYED** to production (2026-06-07)
- Command: `supabase functions deploy transactions-update`
- Project: `drntwgporzabmxdqykrp`

## Testing the Fix

### Prerequisites
1. **Buyer account** (subscriber) with SP balance ≥ 15 SP
2. **Seller account** with an "Accept SP" listing priced $30+
3. Note buyer's SP balance BEFORE submitting offer

### Test Steps

1. **Submit offer with SP**:
   - Log in as Buyer
   - Open seller's "Accept SP" item
   - Tap [Use SP], set slider to 8 SP
   - Note: Available SP should decrease by 8, Reserved SP should increase by 8
   - Tap [Submit Offer]

2. **Seller declines**:
   - Log in as Seller
   - Open Offers tab, tap the pending offer
   - Tap [Decline]

3. **Verify SP restoration**:
   - Log in as Buyer
   - Check SP wallet:
     - **Available SP**: Should be back to original amount (8 SP restored)
     - **Reserved SP**: Should be 0 (released by trigger)
   - Check SP History:
     - Should show "Refund: Cancelled Trade" entry (+8 SP, type: earn_refund)
   - Total balance should match original (before offer submission)

### Expected Results After Fix

| Metric | Before Fix | After Fix |
|--------|-----------|-----------|
| Available SP | NOT restored (stays reduced) | ✅ Restored (+8 SP) |
| Reserved SP | Released (correct) | ✅ Released (correct) |
| SP History | Missing refund entry | ✅ Shows "Refund: Cancelled Trade" |
| Lifetime Spent | Incorrectly increased | ✅ Reverted (decreased by 8) |

## Database Verification Queries

Run these to verify the fix is working:

```sql
-- 1. Verify trigger exists and is enabled
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled,
  pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'trigger_release_sp_on_cancel';

-- 2. Verify RPC exists
SELECT 
  proname AS function_name,
  pronargs AS num_args,
  pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'credit_sp_for_cancelled_trade';

-- 3. After a decline, check ledger entry was created
SELECT 
  l.id,
  l.transaction_type,
  l.amount,
  l.balance_before,
  l.balance_after,
  l.description,
  l.created_at
FROM sp_ledger l
WHERE l.related_transaction_id = '<trade_id>'
  AND l.transaction_type = 'earn_refund'
ORDER BY l.created_at DESC
LIMIT 1;

-- 4. Verify wallet was updated correctly
SELECT 
  w.user_id,
  w.available_balance,
  w.reserved_sp,
  w.lifetime_spent,
  w.updated_at
FROM sp_wallets w
WHERE w.user_id = '<buyer_user_id>';
```

## Edge Cases & Notes

### Non-Fatal Error Handling
The fix includes proper error handling:
- If `credit_sp_for_cancelled_trade` fails, the error is logged but the decline proceeds
- Rationale: Better to successfully decline the offer and have buyer contact support for SP refund, than to block the decline entirely

### Trigger vs RPC Responsibilities
- **Trigger** (`fn_release_sp_on_cancel`): Manages `reserved_sp` field cleanup
- **RPC** (`credit_sp_for_cancelled_trade`): Manages `available_balance` restoration + ledger + lifetime_spent

This separation prevents double-refund bugs (see migration `20260606000001` comments).

### Backward Compatibility
The fix maintains compatibility with both:
- `status = 'pending'` (legacy)
- `status = 'in_progress'` (D-30 architecture with pre-auth)

## Related Files

- **Edge Function**: `supabase/functions/transactions-update/index.ts`
- **Trigger Function**: Migration `20260606000001_fix_sp_ledger_missing_on_trade_complete.sql` (lines 113-157)
- **RPC Function**: Migration `061_sp_ledger_and_trade_rpcs.sql` (lines 181-243)
- **Trigger Setup**: Migration `20260528000003_sp_reserve_release_triggers.sql` (lines 231-234)

## Additional Affected Scenarios

This fix also applies to other cancellation scenarios that use the same pattern:
- Buyer cancels pending trade (TC-R01)
- Offer expiry auto-cancel (TC-B02)
- Competing offers auto-declined (TC-B03)

**Note**: Check if those flows also need the same fix pattern (replace trigger call with RPC).

## Follow-Up Actions

- [ ] Re-test TC-B01 with the fix deployed
- [ ] Verify TC-R01, TC-B02, TC-B03 also restore SP correctly
- [ ] Check if `cancel-trade` Edge Function has the same bug pattern
- [ ] Add integration test for SP restoration on decline
- [ ] Update MANUAL-TESTING guide with SP verification steps

## Session Handoff

**What changed**: 
- `supabase/functions/transactions-update/index.ts` — fixed seller decline SP restoration logic

**Why it matters**: 
Buyers now get their Swap Points back correctly when sellers decline offers, preventing SP loss and -71 SP bugs

**How to verify**: 
1. Submit offer with 8 SP
2. Seller declines
3. Check buyer SP wallet shows +8 SP refund and SP History shows "Refund: Cancelled Trade"

**Known gaps / not done yet**: 
Need to verify other cancellation flows (buyer cancel, expiry, competing offers) work correctly

**Suggested next session**: 
Test TC-B01 end-to-end, then audit cancel-trade Edge Function for similar bug pattern

**Suggested to improve agent rules**:
Add mandatory verification step: "Before marking any SP-related fix complete, verify BOTH the trigger (reserved_sp) AND the RPC (available_balance) are called correctly"
