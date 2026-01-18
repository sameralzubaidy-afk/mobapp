# ✅ TRADE PAYMENT FIX - VERIFICATION CHECKLIST

## What Was Fixed
**Problem:** Trade stays in "Pending Payment" status even after payment is processed  
**Cause:** `processTradePayment()` function was a stub, not calling Edge Function  
**Solution:** Implemented function to call the trade-payment Edge Function  

## File Changed
- **Path:** `p2p-kids-marketplace/src/services/trade.ts`
- **Function:** `processTradePayment()`
- **Lines:** ~324-366

## Pre-Deployment Checklist

### Code Review
- ✅ Function now calls Edge Function at `${supabaseUrl}/functions/v1/trade-payment`
- ✅ Passes JWT token in Authorization header
- ✅ Sends `tradeId` and `paymentMethodId` as JSON body
- ✅ Handles errors and returns meaningful messages
- ✅ Logs progress for debugging

### Type Safety
- ✅ Returns `Promise<{ success: boolean; error?: string }>`
- ✅ Matches existing function signature
- ✅ No TypeScript errors

### Error Handling
- ✅ Checks for SUPABASE_URL env var
- ✅ Checks for user authentication
- ✅ Handles HTTP errors gracefully
- ✅ Passes Stripe error messages to user
- ✅ Logs all errors to console

## Testing Steps (Run After Deployment)

### Step 1: Build & Run App
```bash
cd p2p-kids-marketplace
yarn typecheck  # Verify no TS errors
expo start      # Start app
```

### Step 2: Create a Trade
1. Browse to an item you don't own
2. Tap "Buy" or initiate trade
3. Enter SP amount (optional)
4. See "Pending Payment" status ✓

### Step 3: Process Payment
1. Enter card details in CardField:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
2. Tap "Confirm & Pay $X.XX"
3. Wait 2-3 seconds for processing

### Step 4: Verify Status Update
**Expected:** Should see one of these outcomes:

✅ **SUCCESS - Best Case:**
- Redirected to "TradeSuccess" screen
- Trade Timeline shows: "In Progress" (blue circle, not gray)
- Console shows: `[trade] Payment successful:`
- Database shows: trade.status = `in_progress`

⚠️ **FAILURE - Card Declined:**
- Alert: "Your card was declined"
- Trade stays in "Pending Payment"
- Can retry with different card
- Console shows: `[trade] Edge Function error: 402`

⚠️ **FAILURE - Other Error:**
- Alert with specific error message
- Trade stays in "Pending Payment"
- Check console and Supabase logs

### Step 5: Check Console Logs
Open console and look for these logs (in this order):

```
[trade] Calling trade-payment Edge Function for: <trade-id>
[trade] Payment successful: { tradeId: '...', status: 'in_progress', ... }
```

If you see errors instead:
```
[trade] Edge Function error: { status: 400, error: '...', details: '...' }
```

## Console Log Reference

### Success Log Pattern
```
[trade] Calling trade-payment Edge Function for: 3fa85f64-5717-4562-b3fc-2c963f66afa6
[trade] Payment successful: {
  tradeId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  status: "in_progress",
  paymentIntentId: "pi_1234567890"
}
```

### Failure Log Pattern
```
[trade] Calling trade-payment Edge Function for: 3fa85f64-5717-4562-b3fc-2c963f66afa6
[trade] Edge Function error: {
  status: 400,
  error: "Failed to attach payment method",
  details: { message: "Your card was declined", ... }
}
```

## Database Verification (Optional)

After successful trade payment, verify in Supabase SQL Editor:

```sql
-- Check trade status
SELECT id, status, stripe_payment_intent_id, sp_debit_ledger_entry_id
FROM trades
WHERE id = '<YOUR-TRADE-ID>'
LIMIT 1;
```

**Expected result:**
| id | status | stripe_payment_intent_id | sp_debit_ledger_entry_id |
|---|---|---|---|
| 3fa85f64... | in_progress | pi_1234... | <uuid> or null |

## Rollback Plan (If Needed)

If issues occur, revert the function:

```typescript
export async function processTradePayment(
  tradeId: string,
  paymentMethodId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[trade] Processing payment for trade:', tradeId);
    // TODO: Implement Stripe payment processing
    return { success: true };
  } catch (error) {
    console.error('[trade] Error processing payment:', error);
    return { success: false, error: 'Payment processing failed' };
  }
}
```

## Environment Variables Check

Make sure these are set in `.env.local`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

The function reads `SUPABASE_URL` from environment at runtime.

## Known Limitations

- ⚠️ Payment processing requires Edge Function to be deployed
- ⚠️ Stripe secret key must be configured in Supabase environment
- ⚠️ User must have valid JWT token (i.e., must be logged in)
- ⚠️ Test card `4242 4242 4242 4242` only works in Stripe test mode

## Support

If trade payment still doesn't work after deployment:

1. **Check Supabase Edge Function Logs:**
   - Supabase Dashboard → Edge Functions → trade-payment
   - Filter by your user_id or trade_id
   - Look for error messages

2. **Check Stripe Logs:**
   - Stripe Dashboard → Developers → Events
   - Search for PaymentIntent with your trade ID
   - Look for declined or failed events

3. **Check Mobile Console:**
   - Look for `[trade]` prefixed logs
   - Look for full error messages
   - Screenshot and share with dev team

4. **Common Fixes:**
   - Clear app cache: `expo start -c`
   - Restart app completely
   - Check internet connection
   - Try a different card

---

**Deployment Status:** Ready  
**Testing Duration:** ~10 minutes  
**Risk Level:** Low (restoring implemented Edge Function)
