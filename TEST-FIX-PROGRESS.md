# Test Fix Progress

## Issues Found from Logs

### Issue 1 (CRITICAL): TradeOfferScreen uses old `initiateTradeV2` instead of `createTradeOfferWithHold` ✅ FIXED
- **File**: `p2p-kids-marketplace/src/screens/trade/TradeOfferScreen.tsx`
- **Problem**: The screen imported and called `initiateTradeV2` (client-side direct DB insert) instead of `createTradeOfferWithHold` (edge function with Stripe pre-auth). The old function tried to insert into `trades` table directly from client, which fails due to RLS restrictions.
- **Fix**: 
  - Replaced `initiateTradeV2` import with `createTradeOfferWithHold` and `mapStripeErrorToMessage`
  - Added Stripe integration imports (`CardField`, `useStripe`, `getTransactionFee`, `getPaymentMethod`, `PaymentMethodInfo`)
  - Added `supabase` import for disclaimer acknowledgment
  - Replaced the `handleInitiateTrade` function to:
    1. Calculate cash amount (item price - SP discount + fee)
    2. Collect payment method ID (new card via Stripe or saved)
    3. Call `createTradeOfferWithHold` with all required params
    4. Handle MAX_PENDING_OFFERS, STRIPE_HOLD_FAILED, STRIPE_ERROR error codes
    5. Record disclaimer acknowledgment via `acknowledge_trade_disclaimer` RPC
    6. Navigate to `TradeSuccess` on success
  - Added state variables for Stripe integration (cardComplete, stripeReady, stripeError, savedPaymentMethod, etc.)

### Issue 2 (Non-critical): adminConfig.ts fallback queries non-existent `config_key` column ✅ FIXED
- **File**: `p2p-kids-marketplace/src/services/adminConfig.ts`
- **Problem**: When the primary query with `key` column fails, the fallback tried `config_key` which doesn't exist in current schema, causing a noisy warning.
- **Fix**: Removed the legacy fallback that queried `config_key`/`config_value` columns. Now if the primary query fails, it immediately returns default config.

### Issue 3 (Non-critical): items.ts join relationship not found ⚠️ NOT FIXED (graceful fallback exists)
- **File**: `p2p-kids-marketplace/src/services/items.ts`
- **Problem**: `seller:profiles(...)` join fails because no FK relationship exists between `items` and `profiles` in schema cache.
- **Status**: The fallback already handles this gracefully by fetching profiles separately. No fix needed.

### Issue 4 (Non-critical): TradeListScreen fetch errors ✅ FIXED
- **File**: `p2p-kids-marketplace/src/screens/trade/TradeListScreen.tsx`
- **Problem**: `listing:items(...)` join in `fetchTrades` fails due to schema cache issues.
- **Fix**: Added fallback that fetches trades without relationship expansion when the join query fails.

### Issue 5 (UX): Payment alert now invites user to add payment method with navigation ✅ FIXED
- **File**: `p2p-kids-marketplace/src/screens/trade/TradeOfferScreen.tsx`
- **Problem**: When user had no saved payment method, the alert said "Payment Setup Required" with no actionable option.
- **Fix**: 
  - Updated alert message to: "To submit an offer, please add a payment method first. You can manage your payment methods in your account settings."
  - Added "Manage Payment" button that navigates to `ManageKidsClub` screen where user can add a card via `PaymentMethodSection`
  - Added `loadSavedPaymentMethod` effect on mount to fetch saved payment method from Stripe
  - Simplified the payment check: now checks `savedPaymentMethod?.id` instead of `stripeReady`/`cardComplete` (since CardField is not rendered in this screen)
