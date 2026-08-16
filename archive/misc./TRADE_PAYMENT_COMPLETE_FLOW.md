# Trade Payment Flow - Complete Explanation

## The Trade Lifecycle (V2)

```
┌─────────────────────────────────────────────────────────────────┐
│ USER INITIATES TRADE                                            │
│ - Selects item                                                  │
│ - Chooses SP amount (0-50% cap)                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ MOBILE APP: initiateTradeV2()                                   │
│ - Validates item availability                                   │
│ - Checks SP balance & subscription                             │
│ - Calculates fees & amounts                                     │
│ - Creates trade record in DB                                    │
│ STATUS: pending ← Trade created here                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ USER ENTERS PAYMENT DETAILS                                     │
│ - CardField component                                           │
│ - Stripe.createPaymentMethod() → PaymentMethod ID (pm_...)    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ MOBILE APP: processTradePayment() ← 🔧 FIXED HERE              │
│ - Gets user JWT token                                           │
│ - Calls Edge Function: POST /functions/v1/trade-payment        │
│ - Sends: { tradeId, paymentMethodId }                          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: trade-payment/index.ts                          │
│                                                                  │
│ 1. Load trade record                                            │
│ 2. Create Stripe customer (if needed)                          │
│ 3. Attach PaymentMethod to customer                            │
│ 4. Mark trade as 'payment_processing'  ← Status change         │
│ 5. Create PaymentIntent (manual capture)                       │
│ 6. Debit SP wallet (if points used)                            │
│ 7. Capture payment (charge card)                               │
│ 8. Mark trade as 'in_progress' ← 🎯 FINAL STATUS UPDATE       │
│ 9. Update item as 'pending'                                    │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ RESPONSE TO MOBILE APP                                          │
│ {                                                                │
│   "success": true,                                              │
│   "tradeId": "...",                                             │
│   "status": "in_progress",                                      │
│   "payment_intent_id": "pi_..."                                │
│ }                                                                │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ MOBILE APP RESPONSE                                             │
│ - Navigate to TradeSuccess screen                              │
│ - Display "In Progress" status ✅                              │
│ - Show payment details                                         │
│ - Show next steps (arrange meetup, complete trade)            │
└─────────────────────────────────────────────────────────────────┘
```

## Before the Fix ❌

When user confirmed payment:

1. Mobile app called `initiateTradeV2()` ✅
   - Trade created with status: `pending` ✓
2. User entered card and clicked "Pay" 
3. Mobile app called `processTradePayment()` 
   - **BUT:** Function was just a stub returning `{ success: true }` ❌
   - **RESULT:** Edge Function was NEVER called ❌
4. Edge Function never ran
   - Trade status never updated from `pending`
   - Payment was never actually charged
5. User stuck at "Pending Payment" 😞

## After the Fix ✅

When user confirms payment:

1. Mobile app calls `initiateTradeV2()` ✅
   - Trade created with status: `pending` ✓
2. User enters card and clicks "Pay"
3. Mobile app calls `processTradePayment()` ✅
   - Gets JWT token
   - Calls Edge Function: `POST /functions/v1/trade-payment`
   - Sends tradeId + paymentMethodId
4. Edge Function processes payment ✅
   - Stripe charges card
   - SP wallet debited (if applicable)
   - Trade status updated: `pending` → `payment_processing` → `in_progress`
5. Response returns to mobile app ✅
   - Navigation to TradeSuccess screen
   - Status now shows "In Progress" 🎉

## The Key Change

### Before (Lines 311-318)
```typescript
export async function processTradePayment(
  tradeId: string,
  paymentMethodId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[trade] Processing payment for trade:', tradeId);
    // TODO: Implement Stripe payment processing ← ❌ NOT IMPLEMENTED
    return { success: true };  ← ❌ ALWAYS RETURNS SUCCESS
  } catch (error) {
    console.error('[trade] Error processing payment:', error);
    return { success: false, error: 'Payment processing failed' };
  }
}
```

### After (Lines 324-366)
```typescript
export async function processTradePayment(
  tradeId: string,
  paymentMethodId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[trade] Calling trade-payment Edge Function for:', tradeId);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL not configured');
    }

    // ✅ Get user's JWT token
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return { success: false, error: 'Not authenticated' };
    }

    // ✅ Call the Edge Function
    const response = await fetch(`${supabaseUrl}/functions/v1/trade-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ tradeId, paymentMethodId }),
    });

    // ✅ Parse and handle response
    const data = await response.json();

    if (!response.ok) {
      console.error('[trade] Edge Function error:', {
        status: response.status,
        error: data.error,
        details: data.details,
      });
      return {
        success: false,
        error: data.error || `Payment failed (HTTP ${response.status})`,
      };
    }

    console.log('[trade] Payment successful:', {
      tradeId: data.tradeId,
      status: data.status,
      paymentIntentId: data.payment_intent_id,
    });

    return { success: true };  ← ✅ NOW ONLY RETURNS SUCCESS IF EDGE FUNCTION SUCCEEDS
  } catch (error) {
    console.error('[trade] Error processing payment:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Payment processing failed',
    };
  }
}
```

## Why This Matters

### Before Fix:
- User enters card: ✓ Looks good
- User clicks "Pay": ✓ App processes
- Result: 😞 Trade stuck in "Pending Payment"
- Why: Edge Function never called, payment never charged, status never updated

### After Fix:
- User enters card: ✓ Looks good
- User clicks "Pay": ✓ App calls Edge Function
- Edge Function: Charges card, debits SP, updates status
- Result: 🎉 Trade shows "In Progress"
- User can now arrange meetup/complete trade

## Technical Flow

### 1. Mobile App → Edge Function
```
POST https://xxxxx.supabase.co/functions/v1/trade-payment
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "tradeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "paymentMethodId": "pm_1234567890"
}
```

### 2. Edge Function → Stripe
```
POST https://api.stripe.com/v1/payment_intents
X-Stripe-Key: sk_test_...

{
  "amount": 3099,  // $30.99 (item + fee)
  "currency": "usd",
  "customer": "cus_...",
  "payment_method": "pm_...",
  "confirm": true,
  "capture_method": "manual"
}
```

### 3. Stripe → Edge Function
```json
{
  "id": "pi_1234567890",
  "amount": 3099,
  "status": "requires_capture",
  "client_secret": "pi_..._secret_..."
}
```

### 4. Edge Function → Database (Atomic)
```sql
-- Debit SP wallet
INSERT INTO sp_ledger (user_id, amount, type, related_transaction_id)
VALUES ('user-id', -500, 'debit', 'trade-id');

-- Capture Stripe payment
POST /v1/payment_intents/pi_.../capture

-- Update trade status
UPDATE trades 
SET status = 'in_progress',
    stripe_payment_intent_id = 'pi_...',
    sp_debit_ledger_entry_id = 'ledger-id'
WHERE id = 'trade-id';
```

### 5. Edge Function → Mobile App
```json
{
  "success": true,
  "tradeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "status": "in_progress",
  "payment_intent_id": "pi_1234567890"
}
```

## Error Scenarios

### Scenario 1: Card Declined
```
Stripe → Edge Function: { status: 'declined', code: 'card_declined' }
Edge Function → Mobile: { success: false, error: 'Your card was declined' }
Mobile → User: Alert showing error message
Database: Trade status remains 'pending'
Outcome: User can retry with different card ✓
```

### Scenario 2: SP Debit Fails
```
SP RPC → Edge Function: { error: 'Insufficient balance' }
Edge Function → Stripe: Cancel PaymentIntent
Edge Function → Mobile: { success: false, error: 'SP debit failed' }
Mobile → User: Alert showing error
Database: Trade status marked 'payment_failed'
Outcome: Payment rolled back, no charge ✓
```

### Scenario 3: Complete Success
```
1. Payment authorized ✅
2. SP debited ✅
3. Payment captured ✅
4. Trade updated to 'in_progress' ✅
5. Item updated to 'pending' ✅
Mobile → TradeSuccess screen
Database: All updates persisted atomically
Outcome: Trade ready for meetup 🎉
```

## Module Dependencies

This fix depends on:

- **MODULE-06 Trade Flow V2**: Specifies trade lifecycle and payment integration
- **MODULE-09 Swap Points**: SP wallet validation and debit logic (handled by RPC)
- **MODULE-11 Subscriptions**: Fee calculation based on tier (handled by initiateTradeV2)
- **Stripe SDK**: For payment creation (handled by Edge Function)

## Verification

After deployment, verify:

✅ Trade status updates from "Pending Payment" to "In Progress"
✅ Console logs show: `[trade] Payment successful:`
✅ Stripe customer created in dashboard
✅ PaymentIntent shows as 'succeeded'
✅ SP wallet debited (if applicable)
✅ Item marked as 'pending'
✅ Database trade.status = 'in_progress'

---

**TL;DR:**
- **Before:** `processTradePayment()` was a stub, Edge Function never called, status stuck
- **After:** `processTradePayment()` calls Edge Function, payment processed, status updates
- **Result:** Trades now successfully advance to "In Progress" ✅
