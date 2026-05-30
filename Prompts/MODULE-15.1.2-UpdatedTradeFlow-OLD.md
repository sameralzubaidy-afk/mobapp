# MODULE 15.1.2: UPDATED TRADE FLOW — PAYMENT AUTHORIZATION HOLD

## 1. Description


- Sellers have a default 48-hour window to respond (admin configurable up to 7 days).
- Buyers are limited to 3 active pending offers at a time to prevent fund lockup.
- If the seller declines or the timeout expires, the hold is released.
- If the seller accepts, the pre-authorized payment is captured and SP hold is consumed.

## 2. Business Rules & Decisions
- **Seller Response Timeout:** 48 hours default, configurable globally via `admin_config` (max 7 days).
- **Rollout Strategy:** Immediate (all users, no grace period).
- **Pending Offer Limit:** Max 3 active pending offers per buyer.
- **Authorization Amount:** Cash portion + Platform Fee. SP is separately placed on hold.
- **Insufficient Funds UX:** Reject immediately at the offer creation step with a clear error.
- **Card Expiration during window:** Offer auto-cancels, buyer is notified.
- **Counter-Offers:** Explicitly out of scope (not supported).
- **SP Hold UX:** Show explicit UI warning if buyer tries to use SP that is currently on hold across other pending offers ("You have X SP on hold in N pending offers. Cancel an offer to free up SP").

---

## 3. Implementation Progress

### Phase 1: Documentation ✅ COMPLETE
- [x] Business requirements documented
- [x] Task flows defined with AI prompts
- [x] Acceptance criteria established

### Phase 2: Database Schema & Cron Job ✅ COMPLETE
- [x] Migration 1: Trade table & admin_config updates (`20260510000001_trade_authorization_updates.sql`)
- [x] Migration 2: SP hold enum & wallet balance function (`20260510000002_sp_hold_enum.sql`)
- [x] Migration 3: Offer timeout RPC & cron job (`20260510000003_offer_timeout_rpc.sql`)

**Implementation Notes:**
- Created 3 idempotent migrations using `IF NOT EXISTS` patterns
- Added `authorization_id`, `authorization_amount`, `authorization_expires_at` to `trades` table
- Added `offer_timeout_hours` (default 48, max 168) to `admin_config` with CHECK constraint
- Extended `sp_transaction_type` enum with `hold`, `hold_release`, `hold_consumed`
- Created `get_sp_wallet_balance(uuid)` function returning `{available_sp, on_hold_sp}`
- Created `invoke_check_offer_timeouts()` RPC following existing `pg_cron` + `net.http_post()` pattern
- Scheduled hourly cron job: `0 * * * *`

**Next Step:** Execute migrations on staging/production via Supabase dashboard or CLI

### Phase 3: Edge Functions & API Contracts ⏳ PENDING
- [ ] Shared helpers: `_shared/stripe/authorization.ts`
- [ ] Shared helpers: `_shared/sp/holds.ts`
- [ ] Update: `transactions-create`
- [ ] Update: `transactions-update`
- [ ] New: `check-offer-timeouts` Edge Function

### Phase 4: Mobile App UI/UX ⏳ PENDING
- [ ] Update: `TradeOfferScreen.tsx`
- [ ] Update: `TradeReviewScreen.tsx`
- [ ] Update: `SpWalletScreen.tsx`

### Phase 5: Admin Portal UI ⏳ PENDING
- [ ] Update: `src/app/trades/page.tsx` (tabbed UI)
- [ ] Update: `src/app/settings/page.tsx` (timeout config)

---

## 4. Dependencies & Prerequisites

### Required Before Implementation
- ✅ Stripe account configured with manual capture enabled
- ✅ Existing `trades` table schema
- ✅ Existing `admin_config` table
- ✅ Existing `sp_transactions` table with `type` enum
- ✅ `pg_cron` extension enabled in Supabase
- ✅ `net.http_post()` available for RPC → Edge Function calls

### Cross-Module Dependencies
- **Module 09 (Swap Points)**: SP wallet balance calculation logic
- **Module 11 (Subscriptions)**: Stripe integration patterns
- **Module 14 (Notifications)**: Push notifications for timeout/expiry events
- **FLOW-08 (Trade Flow)**: Core transaction state machine

---

## 5. Testing & Validation Strategy

### Database Migration Testing
```bash
# Local validation
cd supabase
supabase db reset
supabase db push

# Verify migrations applied
psql $DATABASE_URL -c "\d trades"
psql $DATABASE_URL -c "SELECT * FROM pg_type WHERE typname = 'sp_transaction_type';"
psql $DATABASE_URL -c "SELECT * FROM cron.job WHERE jobname = 'check-offer-timeouts';"
```

### Edge Function Testing
```bash
# Test pre-authorization flow
curl -X POST $EDGE_FUNCTION_URL/transactions-create \
  -H "Authorization: Bearer $USER_JWT" \
  -d '{"listing_id":"...","cash_amount":50,"sp_amount":25}'

# Test timeout cron
curl -X POST $EDGE_FUNCTION_URL/check-offer-timeouts \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

### Mobile App Testing
- **Manual Test 1**: Buyer with 0 pending offers → Can make offer (auth hold placed)
- **Manual Test 2**: Buyer with 3 pending offers → Blocked from making 4th offer
- **Manual Test 3**: Insufficient card funds → Clear error shown
- **Manual Test 4**: Seller accepts within 48h → Payment captured, SP consumed
- **Manual Test 5**: Seller declines → Authorization released, SP released
- **Manual Test 6**: 48h timeout expires → Cron auto-cancels, releases funds/SP

---

## 6. Verification Queries

### After Migration 1 (Trade Table Updates)
```sql
-- Verify new columns exist
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'trades' 
  AND column_name IN ('authorization_id', 'authorization_amount', 'authorization_expires_at');

-- Verify admin_config has offer_timeout_hours
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'admin_config' 
  AND column_name = 'offer_timeout_hours';

-- Verify CHECK constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint 
WHERE conname = 'check_offer_timeout_hours';
```

### After Migration 2 (SP Hold Enum)
```sql
-- Verify new enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'sp_transaction_type')
ORDER BY enumsortorder;

-- Test wallet balance function
SELECT public.get_sp_wallet_balance('00000000-0000-0000-0000-000000000001'::uuid);

-- Expected output: {"available_sp": X, "on_hold_sp": Y}
```

### After Migration 3 (Cron Job)
```sql
-- Verify RPC exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'invoke_check_offer_timeouts';

-- Verify cron job scheduled
SELECT jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'check-offer-timeouts';

-- Expected: schedule='0 * * * *', command='SELECT public.invoke_check_offer_timeouts();'
```

---

## 7. Risk Mitigation & Edge Cases

### Known Risks
1. **Stripe API downtime during pre-auth**: Gracefully fail and show user "Payment service temporarily unavailable"
2. **Card expiration between hold and capture**: Cron job will auto-cancel; buyer gets notification
3. **Buyer cancels card after hold**: Stripe will reject capture; treat as declined offer
4. **Network timeout during RPC → Edge Function call**: pg_cron will retry next hour; consider idempotency
5. **User accumulates 3 "stuck" pending offers**: Admin force-cancel UI provides escape hatch

### Edge Case Handling
- **Simultaneous offer creation**: Database transaction isolation prevents > 3 offers
- **Clock skew**: Use `NOW()` from Postgres, not client timestamps
- **Partial SP available**: UI prevents submission if `available_sp < requested_sp`
- **Zero SP offers**: Skip `createSpHold()` if `sp_amount = 0`
- **Admin config not set**: Default to 48 hours if `offer_timeout_hours IS NULL`

---

## 8. Task Flows (Implementation Details)

### TASK FLOW-01: Database Schema & Cron Job

**Duration:** 3 hours  
**Priority:** P1 (High)  
**Files:** Migrations  

#### Description
Update the database schema to support Stripe payment authorizations, SP holds, and offer timeouts. Add a global config for offer timeouts and a pg_cron RPC to process expirations.

#### Scope — Files to Modify
| # | File/Migration | Change Type |
|---|----------------|-------------|
| 1 | `supabase/migrations/[timestamp]_trade_authorization_updates.sql` | Create migration |
| 2 | `supabase/migrations/[timestamp]_sp_hold_enum.sql` | Create migration |
| 3 | `supabase/migrations/[timestamp]_offer_timeout_rpc.sql` | Create migration |

#### Step 1: Trade Table & Admin Config Updates
**AI Prompt:**
```sql
/*
TASK: Update trades table and admin_config
1. Alter `trades` to add:
   - `authorization_id` (varchar, nullable)
   - `authorization_amount` (numeric, nullable)
   - `authorization_expires_at` (timestamptz, nullable)
2. Alter `admin_config` to add:
   - `offer_timeout_hours` (integer, default 48)
   - Add CHECK constraint (offer_timeout_hours BETWEEN 1 AND 168)
Include verification queries.
*/
```

#### Step 2: SP Wallet Holds Enum & View Updates
**AI Prompt:**
```sql
/*
TASK: Update SP Transaction Types and Wallet View
1. Add new enum values to `sp_transaction_type` (if PostgreSQL allows adding to enum, else alter safely):
   - 'hold'
   - 'hold_release'
   - 'hold_consumed'
2. Update `sp_wallet_balance` view (or function) to calculate:
   - available_sp = SUM(earned) - SUM(spent) - SUM(hold) + SUM(hold_release)
   - on_hold_sp = SUM(hold) - SUM(hold_release) - SUM(hold_consumed)
Include verification queries.
*/
```

#### Step 3: Timeout Expiration RPC
**AI Prompt:**
```sql
/*
TASK: Create cron job RPC for Edge Function
1. Create `invoke_check_offer_timeouts()` RPC similar to `invoke_grace_period_cron()`.
2. Use pg_cron to schedule it every hour: `SELECT cron.schedule('check-offer-timeouts', '0 * * * *', 'SELECT public.invoke_check_offer_timeouts();');`
Include verification queries.
*/
```

#### ✅ Acceptance Criteria — FLOW-01
- [ ] Tables `trades` and `admin_config` have the new columns.
- [ ] `sp_transaction_type` supports hold states.
- [ ] Wallet view correctly computes `available_sp` (subtracting holds) and `on_hold_sp`.
- [ ] `invoke_check_offer_timeouts` works and pg_cron is scheduled successfully.

---

### TASK FLOW-02: Edge Functions & API Contracts

**Duration:** 5 hours  
**Priority:** P1 (High)  
**Files:** `supabase/functions/`

#### Description
Update Edge Functions to enforce the 3-offer limit, pre-authorize funds on Stripe, compute held SP, and perform capture/release when offers are accepted/declined/timed-out.

#### Scope — Files to Modify
| # | Edge Function | Change Type |
|---|---------------|-------------|
| 1 | `_shared/stripe/authorization.ts` | New file/module |
| 2 | `_shared/sp/holds.ts` | New file/module |
| 3 | `transactions-create/index.ts` | Edit |
| 4 | `transactions-update/index.ts` | Edit |
| 5 | `check-offer-timeouts/index.ts` | New Edge Function |

---

##### File 1 of 5: Stripe Authorization Helpers
**File:** `supabase/functions/_shared/stripe/authorization.ts` | **Duration:** 1h

**AI Prompt:**
```typescript
/*
TASK: Create Stripe pre-authorization helpers
DO NOT CHANGE: Existing Stripe initialization, customer lookup logic, error codes
ONLY ADD: New authorization functions

Import required:
import Stripe from 'https://esm.sh/stripe@14.0.0';

FUNCTIONS TO CREATE:

1. preAuthorizePayment(params: { userId: string; amount: number; currency: string; metadata?: Record<string, string> })
   Returns: Promise<{ success: true; authorizationId: string; expiresAt: string } | { success: false; error: { code: string; message: string } }>
   
   Implementation:
   - Initialize Stripe with secret key from env
   - Lookup/create Stripe customer for userId
   - Create PaymentIntent with:
     * amount (in cents)
     * currency (default 'usd')
     * capture_method: 'manual'
     * customer: stripeCustomerId
     * metadata: { userId, ...metadata }
   - Return authorizationId (PaymentIntent.id) and expiresAt (7 days from now)
   - Error cases: STRIPE_API_ERROR, INSUFFICIENT_FUNDS, INVALID_CARD

2. captureAuthorization(paymentIntentId: string)
   Returns: Promise<{ success: true; chargeId: string } | { success: false; error: { code: string; message: string } }>
   
   Implementation:
   - Retrieve PaymentIntent
   - Check status is 'requires_capture'
   - Call stripe.paymentIntents.capture(paymentIntentId)
   - Return chargeId
   - Error cases: ALREADY_CAPTURED, EXPIRED, CANCELED, STRIPE_API_ERROR

3. releaseAuthorization(paymentIntentId: string)
   Returns: Promise<{ success: true } | { success: false; error: { code: string; message: string } }>
   
   Implementation:
   - Call stripe.paymentIntents.cancel(paymentIntentId)
   - Return success: true
   - Error cases: ALREADY_CAPTURED, ALREADY_CANCELED, STRIPE_API_ERROR

ERROR HANDLING:
- Catch Stripe errors and map to standardized error codes
- Log all errors with context (userId, paymentIntentId)
- Never expose raw Stripe error messages to client

TYPE DEFINITIONS:
export interface AuthorizationResult {
  success: boolean;
  authorizationId?: string;
  expiresAt?: string;
  chargeId?: string;
  error?: {
    code: 'STRIPE_API_ERROR' | 'INSUFFICIENT_FUNDS' | 'INVALID_CARD' | 'ALREADY_CAPTURED' | 'EXPIRED' | 'CANCELED';
    message: string;
    details?: unknown;
  };
}
*/
// filepath: supabase/functions/_shared/stripe/authorization.ts
```

---

##### File 2 of 5: SP Hold Helpers
**File:** `supabase/functions/_shared/sp/holds.ts` | **Duration:** 1h

**AI Prompt:**
```typescript
/*
TASK: Create SP hold ledger helpers
DO NOT CHANGE: Existing SP transaction types, wallet balance logic
ONLY ADD: New hold operation functions

Import required:
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

FUNCTIONS TO CREATE:

1. createSpHold(params: { userId: string; amount: number; tradeId: string; description: string })
   Returns: Promise<{ success: true; transactionId: string } | { success: false; error: { code: string; message: string } }>
   
   Implementation:
   - Validate amount > 0
   - Fetch available SP using get_sp_wallet_balance(userId)
   - Check available_sp >= amount
   - Insert into sp_transactions:
     * user_id: userId
     * type: 'hold'
     * amount: amount (positive number)
     * related_trade_id: tradeId
     * description: description
     * created_at: NOW()
   - Return transactionId
   - Error cases: INSUFFICIENT_SP, INVALID_AMOUNT, DATABASE_ERROR

2. releaseSpHold(params: { userId: string; amount: number; tradeId: string; reason: string })
   Returns: Promise<{ success: true; transactionId: string } | { success: false; error: { code: string; message: string } }>
   
   Implementation:
   - Insert into sp_transactions:
     * user_id: userId
     * type: 'hold_release'
     * amount: amount (positive number, offsets the hold)
     * related_trade_id: tradeId
     * description: `Hold released: ${reason}`
     * created_at: NOW()
   - Return transactionId
   - Error cases: INVALID_AMOUNT, DATABASE_ERROR

3. consumeSpHold(params: { userId: string; amount: number; tradeId: string })
   Returns: Promise<{ success: true; transactionId: string } | { success: false; error: { code: string; message: string } }>
   
   Implementation:
   - Insert into sp_transactions:
     * user_id: userId
     * type: 'hold_consumed'
     * amount: amount (positive number, finalizes the hold)
     * related_trade_id: tradeId
     * description: 'Trade completed - hold consumed'
     * created_at: NOW()
   - Return transactionId
   - Error cases: INVALID_AMOUNT, DATABASE_ERROR

ATOMIC OPERATIONS:
- All functions must use Supabase transactions (.from().insert().select().single())
- Rollback on any error
- Log all operations with userId, tradeId, amount

TYPE DEFINITIONS:
export interface SpHoldResult {
  success: boolean;
  transactionId?: string;
  error?: {
    code: 'INSUFFICIENT_SP' | 'INVALID_AMOUNT' | 'DATABASE_ERROR';
    message: string;
    details?: unknown;
  };
}
*/
// filepath: supabase/functions/_shared/sp/holds.ts
```

---

##### File 3 of 5: Update transactions-create
**File:** `supabase/functions/transactions-create/index.ts` | **Duration:** 1.5h

**AI Prompt:**
```typescript
/*
TASK: Add pre-authorization logic to transactions-create
DO NOT CHANGE: Existing trade creation flow, fee calculation, validation logic, notification triggers
ONLY ADD: Pending offer limit check, Stripe pre-auth, SP hold creation

Import additions:
import { preAuthorizePayment } from '../_shared/stripe/authorization.ts';
import { createSpHold } from '../_shared/sp/holds.ts';

MODIFICATIONS:

1. BEFORE creating trade record, add these validations:

   a) Check pending offer limit:
   ```typescript
   const { count } = await supabase
     .from('trades')
     .select('id', { count: 'exact', head: true })
     .eq('buyer_id', userId)
     .eq('status', 'pending');
   
   if (count >= 3) {
     return new Response(JSON.stringify({
       success: false,
       error: {
         code: 'MAX_PENDING_OFFERS_REACHED',
         message: 'You can have a maximum of 3 pending offers. Please cancel or complete an existing offer first.',
         details: { currentCount: count, limit: 3 }
       }
     }), { status: 400, headers: { 'Content-Type': 'application/json' } });
   }
   ```

   b) Fetch admin config for timeout:
   ```typescript
   const { data: config } = await supabase
     .from('admin_config')
     .select('offer_timeout_hours')
     .single();
   const timeoutHours = config?.offer_timeout_hours || 48;
   const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000).toISOString();
   ```

   c) Pre-authorize payment (cash portion + platform fee):
   ```typescript
   const totalCashAmount = cashAmount + platformFee;
   const authResult = await preAuthorizePayment({
     userId,
     amount: totalCashAmount,
     currency: 'usd',
     metadata: {
       listingId: payload.listing_id,
       tradeType: 'offer'
     }
   });

   if (!authResult.success) {
     return new Response(JSON.stringify({
       success: false,
       error: authResult.error
     }), { status: 400, headers: { 'Content-Type': 'application/json' } });
   }
   ```

   d) Create SP hold if SP > 0:
   ```typescript
   let spHoldTransactionId = null;
   if (spAmount > 0) {
     const spHoldResult = await createSpHold({
       userId,
       amount: spAmount,
       tradeId: '[placeholder - will update after trade insert]',
       description: `SP hold for offer on listing ${payload.listing_id}`
     });

     if (!spHoldResult.success) {
       // Release Stripe auth before returning error
       await releaseAuthorization(authResult.authorizationId);
       return new Response(JSON.stringify({
         success: false,
         error: spHoldResult.error
       }), { status: 400, headers: { 'Content-Type': 'application/json' } });
     }
     spHoldTransactionId = spHoldResult.transactionId;
   }
   ```

2. UPDATE trade insert to include authorization fields:
   ```typescript
   const { data: trade, error: insertError } = await supabase
     .from('trades')
     .insert({
       listing_id: payload.listing_id,
       buyer_id: userId,
       seller_id: listing.seller_id,
       cash_amount: cashAmount,
       sp_amount: spAmount,
       platform_fee: platformFee,
       status: 'pending',
       authorization_id: authResult.authorizationId,     // NEW
       authorization_amount: totalCashAmount,            // NEW
       authorization_expires_at: expiresAt,              // NEW
       sp_hold_transaction_id: spHoldTransactionId       // NEW (optional if tracking)
     })
     .select()
     .single();
   ```

3. ROLLBACK handling:
   - If trade insert fails, release Stripe auth and SP hold
   - Log all rollback actions

SUCCESS RESPONSE:
- Return trade with { authorization_id, authorization_expires_at } in response
- Include warning if near 3-offer limit
*/
// filepath: supabase/functions/transactions-create/index.ts
```

---

##### File 4 of 5: Update transactions-update
**File:** `supabase/functions/transactions-update/index.ts` | **Duration:** 1h

**AI Prompt:**
```typescript
/*
TASK: Add capture/release logic to transactions-update
DO NOT CHANGE: Existing trade state machine, validation, notification triggers
ONLY ADD: Authorization capture on accept, authorization release on decline

Import additions:
import { captureAuthorization, releaseAuthorization } from '../_shared/stripe/authorization.ts';
import { consumeSpHold, releaseSpHold } from '../_shared/sp/holds.ts';

MODIFICATIONS:

1. WHEN action === 'accept' (seller accepts offer):
   ```typescript
   // Fetch trade with authorization details
   const { data: trade } = await supabase
     .from('trades')
     .select('*')
     .eq('id', tradeId)
     .single();

   // Capture Stripe authorization
   if (trade.authorization_id) {
     const captureResult = await captureAuthorization(trade.authorization_id);
     if (!captureResult.success) {
       return new Response(JSON.stringify({
         success: false,
         error: {
           code: 'PAYMENT_CAPTURE_FAILED',
           message: 'Failed to capture payment. The offer may have expired or the payment method is no longer valid.',
           details: captureResult.error
         }
       }), { status: 400, headers: { 'Content-Type': 'application/json' } });
     }
   }

   // Consume SP hold if SP was used
   if (trade.sp_amount > 0) {
     const consumeResult = await consumeSpHold({
       userId: trade.buyer_id,
       amount: trade.sp_amount,
       tradeId: trade.id
     });
     // Log but don't fail if SP consume fails (payment already captured)
     if (!consumeResult.success) {
       console.error('[transactions-update] SP hold consume failed:', consumeResult.error);
     }
   }

   // Update trade status to 'in_progress'
   await supabase
     .from('trades')
     .update({ status: 'in_progress', updated_at: new Date().toISOString() })
     .eq('id', tradeId);
   ```

2. WHEN action === 'decline' (seller declines offer):
   ```typescript
   // Release Stripe authorization
   if (trade.authorization_id) {
     const releaseResult = await releaseAuthorization(trade.authorization_id);
     if (!releaseResult.success) {
       console.error('[transactions-update] Stripe release failed:', releaseResult.error);
       // Continue anyway - trade must be canceled
     }
   }

   // Release SP hold if SP was used
   if (trade.sp_amount > 0) {
     const releaseSpResult = await releaseSpHold({
       userId: trade.buyer_id,
       amount: trade.sp_amount,
       tradeId: trade.id,
       reason: 'Offer declined by seller'
     });
     if (!releaseSpResult.success) {
       console.error('[transactions-update] SP hold release failed:', releaseSpResult.error);
     }
   }

   // Update trade status to 'cancelled'
   await supabase
     .from('trades')
     .update({ status: 'cancelled', updated_at: new Date().toISOString() })
     .eq('id', tradeId);
   ```

ERROR HANDLING:
- Log all capture/release failures with full context
- If capture fails, mark trade as 'payment_failed' status
- If release fails, log error but don't block trade cancellation

NOTIFICATIONS:
- Trigger buyer notification on successful capture: "Your offer was accepted!"
- Trigger buyer notification on decline: "Your offer was declined. Funds released."
*/
// filepath: supabase/functions/transactions-update/index.ts
```

---

##### File 5 of 5: New Edge Function - check-offer-timeouts
**File:** `supabase/functions/check-offer-timeouts/index.ts` | **Duration:** 0.5h

**AI Prompt:**
```typescript
/*
TASK: Create cron Edge Function to auto-expire stale offers
This function is called hourly by pg_cron via invoke_check_offer_timeouts RPC

Import required:
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { releaseAuthorization } from '../_shared/stripe/authorization.ts';
import { releaseSpHold } from '../_shared/sp/holds.ts';

FUNCTION LOGIC:

1. Validate request (service role only):
   ```typescript
   const authHeader = req.headers.get('Authorization');
   if (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
     return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 });
   }
   ```

2. Fetch admin config timeout:
   ```typescript
   const { data: config } = await supabase
     .from('admin_config')
     .select('offer_timeout_hours')
     .single();
   const timeoutHours = config?.offer_timeout_hours || 48;
   ```

3. Query expired pending offers:
   ```typescript
   const cutoffTime = new Date(Date.now() - timeoutHours * 60 * 60 * 1000).toISOString();
   const { data: expiredTrades } = await supabase
     .from('trades')
     .select('*')
     .eq('status', 'pending')
     .lt('created_at', cutoffTime)
     .not('authorization_id', 'is', null);
   ```

4. Process each expired trade:
   ```typescript
   const results = { processed: 0, errors: 0 };
   
   for (const trade of expiredTrades || []) {
     try {
       // Release Stripe authorization
       if (trade.authorization_id) {
         await releaseAuthorization(trade.authorization_id);
       }

       // Release SP hold
       if (trade.sp_amount > 0) {
         await releaseSpHold({
           userId: trade.buyer_id,
           amount: trade.sp_amount,
           tradeId: trade.id,
           reason: 'Offer expired (timeout)'
         });
       }

       // Update trade status
       await supabase
         .from('trades')
         .update({ status: 'expired', updated_at: new Date().toISOString() })
         .eq('id', trade.id);

       // TODO: Send notifications to buyer and seller
       // await sendNotification(trade.buyer_id, 'OFFER_EXPIRED', { tradeId: trade.id });
       // await sendNotification(trade.seller_id, 'OFFER_EXPIRED', { tradeId: trade.id });

       results.processed++;
     } catch (error) {
       console.error(`[check-offer-timeouts] Error processing trade ${trade.id}:`, error);
       results.errors++;
     }
   }
   ```

5. Return summary:
   ```typescript
   return new Response(JSON.stringify({
     success: true,
     processed: results.processed,
     errors: results.errors,
     cutoffTime
   }), { headers: { 'Content-Type': 'application/json' } });
   ```

LOGGING:
- Log each processed trade
- Log any errors with full trade context
- Log summary at end (total processed, total errors)
*/
// filepath: supabase/functions/check-offer-timeouts/index.ts
```

---

#### ✅ Acceptance Criteria — FLOW-02

- [ ] `_shared/stripe/authorization.ts` exports `preAuthorizePayment`, `captureAuthorization`, `releaseAuthorization`
- [ ] `_shared/sp/holds.ts` exports `createSpHold`, `releaseSpHold`, `consumeSpHold`
- [ ] `transactions-create` blocks offer creation when buyer has >= 3 pending offers (error code: `MAX_PENDING_OFFERS_REACHED`)
- [ ] `transactions-create` successfully creates Stripe PaymentIntent with `capture_method: 'manual'`
- [ ] `transactions-create` inserts SP hold record with type `'hold'` when SP > 0
- [ ] `transactions-create` returns detailed error when Stripe pre-auth fails (insufficient funds, invalid card)
- [ ] `transactions-create` rolls back Stripe auth if SP hold creation fails
- [ ] `transactions-create` includes `authorization_id`, `authorization_amount`, `authorization_expires_at` in trade record
- [ ] `transactions-update` (accept) successfully captures Stripe PaymentIntent
- [ ] `transactions-update` (accept) inserts SP hold consumed record with type `'hold_consumed'`
- [ ] `transactions-update` (accept) returns error if payment capture fails
- [ ] `transactions-update` (decline) successfully cancels Stripe PaymentIntent
- [ ] `transactions-update` (decline) inserts SP hold release record with type `'hold_release'`
- [ ] `check-offer-timeouts` queries trades older than configured timeout hours
- [ ] `check-offer-timeouts` releases Stripe auth and SP hold for each expired trade
- [ ] `check-offer-timeouts` updates trade status to `'expired'`
- [ ] `check-offer-timeouts` returns summary (processed count, error count)
- [ ] All functions use standardized error response format with `code` and `message`
- [ ] All Stripe operations are logged with userId and tradeId context

---

### TASK FLOW-03: Mobile App UI / UX

**Duration:** 5 hours  
**Priority:** P1 (High)  
**Files:** `src/screens/trade/` & `src/screens/sp/`

---

> **🚫 CRITICAL — BEHAVIOR CHANGES (NOT JUST VISUAL)**
>
> Unlike MODULE-15.1 (UI redesign), this task DOES change business logic:
> - Add pending offer count fetch
> - Add SP hold balance display
> - Add validation to block >3 offers
> - Change button text and error handling
>
> **Maintain existing:** Trade creation API call, navigation, form validation, fee calculation

---

#### Description
Update the mobile app flows to handle explicit pre-authorization errors, indicate limits (max 3 offers, held SP), and adjust the TradeReview screen to skip the (now redundant) payment step.

#### Scope — Files to Modify
| # | Screen/File | Change Type |
|---|-------------|-------------|
| 1 | `TradeOfferScreen.tsx` | Add validation & UI warnings |
| 2 | `TradeReviewScreen.tsx` | Add seller security banner |
| 3 | `SpWalletScreen.tsx` | Add "On Hold" balance display |

---

##### Screen 1 of 3: TradeOfferScreen
**File:** `src/screens/trade/TradeOfferScreen.tsx` | **Duration:** 2.5h

**Design Changes:**
- **Pending Offers Banner**: If user has >= 3 pending offers, show warning banner at top: `#FEF3C7` bg, `WarningCircle` (20px, `#D97706`), "You've reached the maximum of 3 pending offers"
- **SP Warning Chip**: If user's SP input exceeds available SP (after subtracting on_hold_sp), show inline chip below SP slider: `#FEF3C7` bg, `#F59E0B` text, "You have X SP on hold in Y pending offers"
- **Button Text**: Change from "Make Offer" to "Authorize & Make Offer" (16px semibold)
- **Error Handling**: Map error codes to user-friendly messages (see below)

**AI Prompt:**
```typescript
/*
TASK: Add authorization hold validation to TradeOfferScreen
DO NOT CHANGE: Existing offer creation flow, fee calculation, SP slider logic, navigation
ONLY ADD: Pending offer count check, SP hold display, button text change, error mapping

Import additions:
import { WarningCircle, Coins } from 'phosphor-react-native';

STATE ADDITIONS:
const [pendingOffersCount, setPendingOffersCount] = useState(0);
const [spOnHold, setSpOnHold] = useState(0);
const [isLoading, setIsLoading] = useState(true);

FETCH LOGIC (in useEffect on mount):
```typescript
useEffect(() => {
  const fetchUserLimits = async () => {
    try {
      // Fetch pending offers count
      const { count } = await supabase
        .from('trades')
        .select('id', { count: 'exact', head: true })
        .eq('buyer_id', user.id)
        .eq('status', 'pending');
      setPendingOffersCount(count || 0);

      // Fetch SP wallet with holds
      const { data: wallet } = await supabase
        .rpc('get_sp_wallet_balance', { p_user_id: user.id });
      setSpOnHold(wallet?.on_hold_sp || 0);
      
      setIsLoading(false);
    } catch (error) {
      console.error('[TradeOfferScreen] Error fetching limits:', error);
      setIsLoading(false);
    }
  };

  fetchUserLimits();
}, [user.id]);
```

BANNER COMPONENT (render at top if pendingOffersCount >= 3):
```typescript
{pendingOffersCount >= 3 && (
  <View style={styles.warningBanner}>
    <WarningCircle size={20} color="#D97706" weight="fill" />
    <Text style={styles.warningText}>
      You've reached the maximum of 3 pending offers. Cancel or complete an existing offer to make a new one.
    </Text>
  </View>
)}
```

SP WARNING CHIP (render below SP slider if spAmount > availableSp - spOnHold):
```typescript
{spAmount > (availableSp - spOnHold) && (
  <View style={styles.spWarningChip}>
    <Coins size={16} color="#F59E0B" weight="fill" />
    <Text style={styles.spWarningText}>
      You have {spOnHold} SP on hold in {pendingOffersCount} pending offer{pendingOffersCount !== 1 ? 's' : ''}. 
      Available: {availableSp - spOnHold} SP
    </Text>
  </View>
)}
```

BUTTON CHANGES:
- Text: "Authorize & Make Offer"
- Disabled if: pendingOffersCount >= 3 OR spAmount > (availableSp - spOnHold)

ERROR HANDLING (in catch block of offer submission):
```typescript
const errorMessages = {
  MAX_PENDING_OFFERS_REACHED: 'You can only have 3 pending offers at a time. Please cancel or complete an existing offer first.',
  INSUFFICIENT_FUNDS: 'Your payment method has insufficient funds. Please update your payment method and try again.',
  INVALID_CARD: 'Your payment method is invalid or expired. Please update your payment method.',
  INSUFFICIENT_SP: `You don't have enough Swap Points available. You have ${spOnHold} SP on hold in other offers.`,
  STRIPE_API_ERROR: 'Payment authorization failed. Please check your payment method and try again.',
};

const userMessage = errorMessages[error.code] || 'An unexpected error occurred. Please try again.';
Alert.alert('Cannot Create Offer', userMessage);
```

STYLES ADDITIONS:
```typescript
warningBanner: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FEF3C7',
  borderRadius: 12,
  padding: 12,
  gap: 8,
  marginBottom: 16,
},
warningText: {
  flex: 1,
  fontSize: 14,
  color: '#D97706',
  fontWeight: '500',
},
spWarningChip: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#FEF3C7',
  borderRadius: 8,
  padding: 8,
  gap: 6,
  marginTop: 8,
},
spWarningText: {
  flex: 1,
  fontSize: 12,
  color: '#F59E0B',
  fontWeight: '500',
},
```

ACCESSIBILITY:
- Add accessibilityLabel to warning banner for screen readers
- Disable button with clear disabled state styling
*/
// filepath: src/screens/trade/TradeOfferScreen.tsx
```

---

##### Screen 2 of 3: TradeReviewScreen
**File:** `src/screens/trade/TradeReviewScreen.tsx` | **Duration:** 1.5h

**Design Changes:**
- **Security Banner**: For seller only, show at top: `#E8F5F0` bg, `ShieldCheck` (20px, `#5DBB8E`), "Payment is pre-authorized and secured. Accept within 48 hours." (use dynamic timeout from trade.authorization_expires_at)
- **Remove "Waiting for payment" state**: Accepting offer now directly transitions to 'in_progress' (payment already authorized)
- **Countdown Timer**: Show hours remaining until offer expires (optional enhancement)

**AI Prompt:**
```typescript
/*
TASK: Add pre-authorization security banner to TradeReviewScreen
DO NOT CHANGE: Existing trade acceptance/decline flow, navigation, trade data fetch
ONLY ADD: Security banner for seller, expiration countdown, remove redundant payment waiting state

Import additions:
import { ShieldCheck, Clock } from 'phosphor-react-native';

SECURITY BANNER (render at top for seller role):
```typescript
{isSeller && trade.authorization_id && (
  <View style={styles.securityBanner}>
    <ShieldCheck size={20} color="#5DBB8E" weight="fill" />
    <View style={styles.securityBannerContent}>
      <Text style={styles.securityBannerTitle}>Payment Pre-Authorized</Text>
      <Text style={styles.securityBannerText}>
        Funds are secured and will be released to you when the trade completes. 
        You have {getHoursRemaining(trade.authorization_expires_at)} hours to respond.
      </Text>
    </View>
  </View>
)}
```

HELPER FUNCTION:
```typescript
const getHoursRemaining = (expiresAt: string): number => {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const hoursRemaining = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60)));
  return hoursRemaining;
};
```

ACCEPTANCE FLOW UPDATE:
```typescript
// When seller taps "Accept", update status expectation
const handleAccept = async () => {
  try {
    setIsLoading(true);
    const { error } = await supabase
      .from('trades')
      .update({ status: 'in_progress' })  // Direct to in_progress, not payment_processing
      .eq('id', trade.id);

    if (error) throw error;

    navigation.navigate('ActiveTrade', { tradeId: trade.id });
  } catch (error) {
    if (error.code === 'PAYMENT_CAPTURE_FAILED') {
      Alert.alert(
        'Payment Capture Failed',
        'The buyer\'s payment method is no longer valid. The offer has been automatically cancelled.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } else {
      Alert.alert('Error', 'Failed to accept offer. Please try again.');
    }
  } finally {
    setIsLoading(false);
  }
};
```

STYLES ADDITIONS:
```typescript
securityBanner: {
  flexDirection: 'row',
  alignItems: 'flex-start',
  backgroundColor: '#E8F5F0',
  borderRadius: 12,
  padding: 12,
  gap: 8,
  marginBottom: 16,
},
securityBannerContent: {
  flex: 1,
},
securityBannerTitle: {
  fontSize: 14,
  fontWeight: '600',
  color: '#1A1A1A',
  marginBottom: 2,
},
securityBannerText: {
  fontSize: 13,
  color: '#6B6B6B',
  lineHeight: 18,
},
```

EXPIRATION WARNING (optional - show if < 6 hours remaining):
```typescript
{isSeller && getHoursRemaining(trade.authorization_expires_at) < 6 && (
  <View style={styles.expirationWarning}>
    <Clock size={16} color="#D97706" weight="fill" />
    <Text style={styles.expirationWarningText}>
      Offer expires in {getHoursRemaining(trade.authorization_expires_at)} hours
    </Text>
  </View>
)}
```
*/
// filepath: src/screens/trade/TradeReviewScreen.tsx
```

---

##### Screen 3 of 3: SpWalletScreen
**File:** `src/screens/sp/SpWalletScreen.tsx` | **Duration:** 1h

**Design Changes:**
- **Hero Card Update**: Add "On Hold" sub-label below available balance
- **Available Balance Label**: Change from "Total Balance" to "Available to Spend"
- **On Hold Chip**: `#F0F0F0` bg, 13px `#6B6B6B`, "X SP on hold in pending offers"

**AI Prompt:**
```typescript
/*
TASK: Add "On Hold" balance display to SpWalletScreen
DO NOT CHANGE: Existing wallet fetch logic, transaction history, redemption flow, navigation
ONLY ADD: On hold SP display in hero card

Import additions:
import { Lock } from 'phosphor-react-native';

WALLET FETCH UPDATE (use new get_sp_wallet_balance function):
```typescript
useEffect(() => {
  const fetchWallet = async () => {
    try {
      const { data: wallet, error } = await supabase
        .rpc('get_sp_wallet_balance', { p_user_id: user.id });

      if (error) throw error;

      setAvailableSp(wallet.available_sp || 0);
      setOnHoldSp(wallet.on_hold_sp || 0);  // NEW STATE
    } catch (error) {
      console.error('[SpWalletScreen] Error fetching wallet:', error);
    }
  };

  fetchWallet();
}, [user.id]);
```

HERO CARD UPDATE:
```typescript
<View style={styles.heroCard}>
  <Coins size={40} color="rgba(255,255,255,0.9)" weight="fill" />
  <Text style={styles.balanceAmount}>{availableSp}</Text>
  <Text style={styles.balanceLabel}>Available to Spend</Text>
  
  {onHoldSp > 0 && (
    <View style={styles.onHoldChip}>
      <Lock size={12} color="#6B6B6B" weight="fill" />
      <Text style={styles.onHoldText}>
        {onHoldSp} SP on hold in pending offers
      </Text>
    </View>
  )}
</View>
```

STYLES ADDITIONS:
```typescript
heroCard: {
  backgroundColor: '#5DBB8E',
  borderRadius: 16,
  padding: 24,
  alignItems: 'center',
  marginHorizontal: 16,
  marginTop: 16,
},
balanceAmount: {
  fontSize: 36,
  fontWeight: '700',
  color: '#FFFFFF',
  marginTop: 8,
},
balanceLabel: {
  fontSize: 14,
  color: 'rgba(255,255,255,0.8)',
  marginBottom: 8,
},
onHoldChip: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(255,255,255,0.2)',
  borderRadius: 12,
  paddingHorizontal: 10,
  paddingVertical: 4,
  gap: 4,
  marginTop: 8,
},
onHoldText: {
  fontSize: 12,
  color: '#FFFFFF',
  fontWeight: '500',
},
```

ACCESSIBILITY:
- Add accessibilityLabel: "Available to spend: {availableSp} Swap Points. {onHoldSp} on hold."
*/
// filepath: src/screens/sp/SpWalletScreen.tsx
```

---

#### ✅ Acceptance Criteria — FLOW-03

- [ ] TradeOfferScreen fetches and displays pending offers count on mount
- [ ] TradeOfferScreen shows warning banner when pendingOffersCount >= 3
- [ ] TradeOfferScreen disables "Authorize & Make Offer" button when at limit
- [ ] TradeOfferScreen fetches and displays `on_hold_sp` from wallet balance function
- [ ] TradeOfferScreen shows SP warning chip when selected SP > (available - on_hold)
- [ ] TradeOfferScreen button text reads "Authorize & Make Offer" (not just "Make Offer")
- [ ] TradeOfferScreen maps error codes to user-friendly messages (MAX_PENDING_OFFERS_REACHED, INSUFFICIENT_FUNDS, INVALID_CARD, INSUFFICIENT_SP)
- [ ] TradeReviewScreen shows security banner for seller with pre-authorization message
- [ ] TradeReviewScreen displays hours remaining until authorization expires
- [ ] TradeReviewScreen handles PAYMENT_CAPTURE_FAILED error gracefully
- [ ] TradeReviewScreen navigates directly to ActiveTrade on accept (skips payment_processing state)
- [ ] SpWalletScreen hero card displays "Available to Spend" label (not "Total Balance")
- [ ] SpWalletScreen shows on-hold SP chip when on_hold_sp > 0
- [ ] SpWalletScreen on-hold chip uses lock icon and white text on semi-transparent bg
- [ ] All screens use Phosphor icons (WarningCircle, ShieldCheck, Clock, Lock, Coins)
- [ ] All new text uses correct colors: warnings `#D97706`, success `#5DBB8E`, muted `#6B6B6B`

---

### TASK FLOW-04: Admin Portal Updates

**Duration:** 4 hours  
**Priority:** P2 (Medium)  
**Files:** `p2p-kids-admin/src/app/`

---

> **🚫 CRITICAL — NEXT.JS APP ROUTER CONVENTIONS**
>
> This admin portal uses Next.js 14+ App Router:
> - Server Components by default
> - Client Components require `'use client'` directive
> - API routes in `/app/api/` folders
> - Use Supabase server client for data fetching
>
> **Maintain existing:** Admin authentication, RLS bypassing patterns (service role), existing trade list logic

---

#### Description
Add a tab in the admin dashboard for managing authorization holds and update the settings page to configure the timeout hours.

#### Scope — Files to Modify
| # | File | Change Type |
|---|-------------|-------------|
| 1 | `src/app/trades/page.tsx` | Convert to tabbed UI |
| 2 | `src/app/settings/page.tsx` | Add timeout config field |
| 3 | `src/app/api/trades/force-cancel/route.ts` | New API route (optional) |

---

##### File 1 of 3: Admin Trades Page (Tabbed UI)
**File:** `p2p-kids-admin/src/app/trades/page.tsx` | **Duration:** 2h

**Design Changes:**
- **Tab Navigation**: "All Trades" | "Authorization Holds" — shadcn/ui Tabs component
- **Authorization Holds Tab**: Show only trades with `status='pending'` AND `authorization_id IS NOT NULL`
- **Columns**: Trade ID, Buyer, Listing, Authorized Amount, SP Hold, Expires At, Action
- **Action Button**: "Force Cancel" (red) — triggers API to decline trade and release holds
- **Expiration Highlighting**: Rows expiring in < 6 hours get amber background

**AI Prompt:**
```typescript
/*
TASK: Convert Trades page to tabbed UI with Authorization Holds tab
DO NOT CHANGE: Existing "All Trades" data fetch, trade detail navigation, authentication
ONLY ADD: Tabs UI, Authorization Holds query, Force Cancel action

'use client';

Import additions:
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

STATE ADDITIONS:
const [activeTab, setActiveTab] = useState('all');
const [authHolds, setAuthHolds] = useState([]);
const [isLoadingHolds, setIsLoadingHolds] = useState(false);

FETCH AUTHORIZATION HOLDS (separate from all trades fetch):
```typescript
const fetchAuthHolds = async () => {
  setIsLoadingHolds(true);
  try {
    const { data, error } = await supabase
      .from('trades')
      .select(`
        id,
        created_at,
        authorization_id,
        authorization_amount,
        authorization_expires_at,
        sp_amount,
        status,
        buyer:profiles!buyer_id (full_name, email),
        listing:listings (title, id)
      `)
      .eq('status', 'pending')
      .not('authorization_id', 'is', null)
      .order('authorization_expires_at', { ascending: true });

    if (error) throw error;
    setAuthHolds(data || []);
  } catch (error) {
    console.error('[Admin Trades] Error fetching auth holds:', error);
  } finally {
    setIsLoadingHolds(false);
  }
};

useEffect(() => {
  if (activeTab === 'holds') {
    fetchAuthHolds();
  }
}, [activeTab]);
```

TABS UI:
```tsx
<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
  <TabsList className="grid w-full max-w-md grid-cols-2">
    <TabsTrigger value="all">All Trades</TabsTrigger>
    <TabsTrigger value="holds">Authorization Holds</TabsTrigger>
  </TabsList>

  <TabsContent value="all">
    {/* Existing All Trades table */}
  </TabsContent>

  <TabsContent value="holds">
    <AuthorizationHoldsTable 
      holds={authHolds} 
      isLoading={isLoadingHolds}
      onForceCancel={handleForceCancel}
      onRefresh={fetchAuthHolds}
    />
  </TabsContent>
</Tabs>
```

AUTHORIZATION HOLDS TABLE COMPONENT:
```tsx
function AuthorizationHoldsTable({ holds, isLoading, onForceCancel, onRefresh }) {
  const getExpirationStatus = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursRemaining = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursRemaining < 0) return { variant: 'destructive', label: 'Expired' };
    if (hoursRemaining < 6) return { variant: 'warning', label: `${Math.floor(hoursRemaining)}h remaining` };
    return { variant: 'default', label: formatDistanceToNow(expiry, { addSuffix: true }) };
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Trade ID</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Listing</TableHead>
            <TableHead>Cash Authorized</TableHead>
            <TableHead>SP Hold</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">Loading...</TableCell>
            </TableRow>
          ) : holds.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No active authorization holds
              </TableCell>
            </TableRow>
          ) : (
            holds.map((hold) => {
              const expirationStatus = getExpirationStatus(hold.authorization_expires_at);
              return (
                <TableRow 
                  key={hold.id}
                  className={expirationStatus.variant === 'warning' ? 'bg-amber-50' : ''}
                >
                  <TableCell className="font-mono text-xs">{hold.id.substring(0, 8)}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{hold.buyer.full_name}</div>
                      <div className="text-xs text-muted-foreground">{hold.buyer.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>{hold.listing.title}</TableCell>
                  <TableCell>${(hold.authorization_amount / 100).toFixed(2)}</TableCell>
                  <TableCell>{hold.sp_amount} SP</TableCell>
                  <TableCell>
                    <Badge variant={expirationStatus.variant}>
                      {expirationStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onForceCancel(hold.id)}
                    >
                      Force Cancel
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

FORCE CANCEL HANDLER:
```typescript
const handleForceCancel = async (tradeId: string) => {
  if (!confirm('Are you sure you want to force cancel this offer? This will release the authorization hold and SP.')) {
    return;
  }

  try {
    const response = await fetch('/api/trades/force-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tradeId }),
    });

    if (!response.ok) {
      throw new Error('Failed to cancel trade');
    }

    toast.success('Trade canceled successfully');
    fetchAuthHolds(); // Refresh list
  } catch (error) {
    console.error('[Admin Trades] Force cancel error:', error);
    toast.error('Failed to cancel trade');
  }
};
```

STYLES (Tailwind classes already provided above)
*/
// filepath: p2p-kids-admin/src/app/trades/page.tsx
```

---

##### File 2 of 3: Admin Settings Page (Timeout Config)
**File:** `p2p-kids-admin/src/app/settings/page.tsx` | **Duration:** 1h

**Design Changes:**
- **New Section**: "Trade Offer Settings" card
- **Field**: "Offer Timeout Hours" — number input, min 1, max 168, default 48
- **Helper Text**: "Sellers have this many hours to accept or decline an offer before it auto-expires"
- **Save Button**: Update admin_config table

**AI Prompt:**
```typescript
/*
TASK: Add offer timeout configuration to Settings page
DO NOT CHANGE: Existing settings sections, authentication, save logic for other configs
ONLY ADD: Trade offer timeout field

'use client';

Import additions:
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

STATE ADDITIONS:
const [offerTimeoutHours, setOfferTimeoutHours] = useState(48);
const [isSaving, setIsSaving] = useState(false);

FETCH CONFIG (in useEffect on mount):
```typescript
useEffect(() => {
  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_config')
        .select('offer_timeout_hours')
        .single();

      if (error) throw error;
      setOfferTimeoutHours(data?.offer_timeout_hours || 48);
    } catch (error) {
      console.error('[Settings] Error fetching config:', error);
    }
  };

  fetchConfig();
}, []);
```

SETTINGS CARD:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Trade Offer Settings</CardTitle>
    <CardDescription>
      Configure how long buyers and sellers have to respond to trade offers
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="offerTimeout">Offer Timeout (hours)</Label>
      <Input
        id="offerTimeout"
        type="number"
        min={1}
        max={168}
        value={offerTimeoutHours}
        onChange={(e) => setOfferTimeoutHours(parseInt(e.target.value) || 48)}
        className="max-w-xs"
      />
      <p className="text-sm text-muted-foreground">
        Sellers have this many hours to accept or decline an offer before it auto-expires. 
        Min: 1 hour, Max: 168 hours (7 days)
      </p>
    </div>

    <Button onClick={handleSave} disabled={isSaving}>
      {isSaving ? 'Saving...' : 'Save Settings'}
    </Button>
  </CardContent>
</Card>
```

SAVE HANDLER:
```typescript
const handleSave = async () => {
  // Validate range
  if (offerTimeoutHours < 1 || offerTimeoutHours > 168) {
    toast.error('Offer timeout must be between 1 and 168 hours');
    return;
  }

  setIsSaving(true);
  try {
    const { error } = await supabase
      .from('admin_config')
      .update({ offer_timeout_hours: offerTimeoutHours })
      .eq('id', 1); // Assuming single config row

    if (error) throw error;

    toast.success('Settings saved successfully');
  } catch (error) {
    console.error('[Settings] Save error:', error);
    toast.error('Failed to save settings');
  } finally {
    setIsSaving(false);
  }
};
```

VALIDATION:
- Client-side: min={1} max={168} on input
- Server-side: CHECK constraint already exists in migration (offer_timeout_hours BETWEEN 1 AND 168)
*/
// filepath: p2p-kids-admin/src/app/settings/page.tsx
```

---

##### File 3 of 3: Force Cancel API Route (Optional)
**File:** `p2p-kids-admin/src/app/api/trades/force-cancel/route.ts` | **Duration:** 1h

**AI Prompt:**
```typescript
/*
TASK: Create API route for admin force-cancel of authorization holds
This is a server-side API route that bypasses RLS using service role

Import required:
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

HANDLER:
```typescript
export async function POST(request: Request) {
  try {
    const { tradeId } = await request.json();

    if (!tradeId) {
      return NextResponse.json({ error: 'Missing tradeId' }, { status: 400 });
    }

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Fetch trade
    const { data: trade, error: fetchError } = await supabaseAdmin
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (fetchError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // Verify it's an active hold
    if (trade.status !== 'pending' || !trade.authorization_id) {
      return NextResponse.json({ error: 'Trade is not an active authorization hold' }, { status: 400 });
    }

    // Import shared helpers (requires Deno runtime or re-implement)
    // For simplicity, call Edge Function instead:
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/transactions-update`;
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        tradeId: trade.id,
        action: 'decline',
        reason: 'Force canceled by admin',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Force Cancel API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

SECURITY:
- Require admin authentication (check session)
- Log all force-cancel actions to audit log
- Rate limit to prevent abuse
*/
// filepath: p2p-kids-admin/src/app/api/trades/force-cancel/route.ts
```

---

#### ✅ Acceptance Criteria — FLOW-04

- [ ] Admin trades page has "All Trades" and "Authorization Holds" tabs
- [ ] "Authorization Holds" tab queries trades with `status='pending'` AND `authorization_id IS NOT NULL`
- [ ] Authorization Holds table shows: Trade ID, Buyer name/email, Listing title, Cash authorized, SP hold, Expires time
- [ ] Rows expiring in < 6 hours have amber background highlight
- [ ] "Force Cancel" button triggers API route to decline trade
- [ ] Force Cancel releases Stripe authorization AND SP hold
- [ ] Force Cancel updates trade status to 'cancelled'
- [ ] Settings page has "Trade Offer Settings" card
- [ ] Settings page shows "Offer Timeout (hours)" number input (min 1, max 168, default 48)
- [ ] Settings page saves timeout value to `admin_config.offer_timeout_hours`
- [ ] Settings page validates input range client-side and server-side
- [ ] Force Cancel API route requires admin authentication
- [ ] Force Cancel API route uses service role key to bypass RLS
- [ ] Force Cancel API route logs action to audit trail (optional)
- [ ] All UI uses shadcn/ui components (Table, Tabs, Card, Input, Button, Badge)
- [ ] Error states show toast notifications (success/error)

---

## 9. Rollback Strategy
If the pre-auth flow causes critical conversion drops or Stripe issues:
1. Revert Mobile `TradeOfferScreen` to bypass pre-auth step and skip `authorization_id`.
2. Update Edge Function `transactions-create/update` to temporarily bypass expected authorization metadata.
3. Keep the `invoke_check_offer_timeouts/pg_cron` running to naturally cancel expired 'pending' trades.

---

## 10. Implementation Summary

### Total Estimated Time
- **Phase 2 (DB)**: 3 hours ✅ COMPLETE
- **Phase 3 (Edge Functions)**: 5 hours ⏳ PENDING
- **Phase 4 (Mobile UI)**: 5 hours ⏳ PENDING  
- **Phase 5 (Admin UI)**: 4 hours ⏳ PENDING
- **Total**: 17 hours

### Files Created/Modified Count
- **Database Migrations**: 3 files created
- **Edge Functions**: 5 files (2 new helpers, 2 updates, 1 new function)
- **Mobile Screens**: 3 files updated
- **Admin Pages**: 2 files updated
- **Total**: 13 files

### Key Deliverables Checklist
- [x] Phase 1: Complete technical specification documented
- [x] Phase 2: Database schema supports authorization holds & SP holds
- [x] Phase 2: Cron job scheduled for automatic timeout processing
- [ ] Phase 3: Stripe pre-authorization helpers implemented
- [ ] Phase 3: SP hold ledger operations implemented
- [ ] Phase 3: Trade creation enforces 3-offer limit
- [ ] Phase 3: Trade accept/decline captures/releases funds
- [ ] Phase 3: Timeout Edge Function auto-expires stale offers
- [ ] Phase 4: Mobile UI prevents > 3 pending offers
- [ ] Phase 4: Mobile UI shows SP hold warnings
- [ ] Phase 4: Mobile UI clarifies "Authorize & Make Offer" intent
- [ ] Phase 5: Admin can view/force-cancel authorization holds
- [ ] Phase 5: Admin can configure timeout hours (1-168)

### Success Metrics
Once fully deployed, measure:
- **Spam Reduction**: % decrease in declined offers
- **Conversion Rate**: % of authorized offers that convert to completed trades
- **Fund Lock-Up**: Average SP/cash held per user at any time
- **Timeout Rate**: % of offers that expire vs accept/decline
- **Support Tickets**: Reduction in "buyer didn't pay" complaints

---

**END OF MODULE 15.1.2 SPECIFICATION**
