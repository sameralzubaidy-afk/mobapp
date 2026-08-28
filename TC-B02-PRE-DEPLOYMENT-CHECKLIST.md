# TC-B02 Pre-Deployment Checklist

## ✅ Tier 0 Gate Status

| Check | Status | Command Used | Result |
|-------|--------|--------------|--------|
| Mobile TypeScript | ✅ PASS | `npx tsc --noEmit` | TC-B02 changes compile cleanly (2 pre-existing errors in unrelated files: PaymentMethodsScreen, trade.ts) |
| Edge Function TypeScript | ✅ PASS | `deno check supabase/functions/send-trade-notifications/index.ts` | Compiles successfully |
| Mobile Lint | ⚠️ PASS (with pre-existing warnings) | `npx eslint ...` | 18 pre-existing unused import/variable warnings in TradeListScreen (not from our changes) |
| SQL Migration Syntax | ✅ PASS | Manual review | Valid PostgreSQL/Supabase syntax, uses http_post correctly |

## 📝 Files Changed Summary

### Database (1 file)
- ✅ `supabase/migrations/20260607000001_fix_offer_expiry_notifications.sql` (NEW)
  - Rewrites `rpc_process_expired_offers` to send notifications
  - Uses http_post to call send-trade-notifications Edge Function
  - Loops through expired trades individually (vs batch UPDATE)
  - Handles notification failures gracefully

### Edge Function (1 file)
- ✅ `supabase/functions/send-trade-notifications/index.ts` (MODIFIED)
  - Added `offer_expired` event for buyers
  - Added `offer_expired_seller` event for sellers
  - Both include listing title in message body

### Mobile App (2 files)
- ✅ `p2p-kids-marketplace/src/screens/trade/ReviewOfferScreen.tsx` (MODIFIED)
  - Added `cancellation_reason` to OfferData interface
  - Fetches `cancellation_reason` in database query
  - Shows expired banner for cancelled offers
  - Hides Accept/Decline buttons when status !== 'pending'
  - Shows "offer expired" message + Back button for cancelled offers
  - Fixed duplicate `backButton` style (renamed to `expiredBackButton`)

- ✅ `p2p-kids-marketplace/src/screens/trade/TradeListScreen.tsx` (MODIFIED)
  - Updated `submittedOffers` filter to exclude `status === 'cancelled'`
  - Updated `groupedReceivedOffers` filter to exclude `status === 'cancelled'`
  - Updated `fetchPendingOffers` to only include `status === 'pending'`
  - Updated expiration text to show "Expired" for cancelled offers
  - Expired offers now only show in History tab

## 🔧 Deployment Steps

### Step 1: Apply Database Migration
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
supabase db push
```

**Expected output:**
```
Applying migration 20260607000001_fix_offer_expiry_notifications.sql...
Migration applied successfully
```

**Verify:**
```sql
-- Check function was recreated
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'rpc_process_expired_offers';
-- Should return 1 row with updated source code
```

### Step 2: Deploy Edge Function
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
supabase functions deploy send-trade-notifications
```

**Expected output:**
```
Deploying function send-trade-notifications...
Function deployed successfully
```

**Verify:**
```bash
# Check function logs (should be empty if no recent activity)
supabase functions logs send-trade-notifications --tail
```

### Step 3: Restart Mobile App
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npx expo start --clear
```

**Expected:**
- Metro bundler starts with no errors
- App loads without crashes
- No new TypeScript errors in console

## 🧪 Manual Testing (TC-B02)

### Test Scenario
Create a pending offer and manually expire it to verify all 3 fixes work.

### SQL Test Setup
```sql
-- 1. Find a pending offer (or create one via the app)
SELECT id, status, offer_expires_at, listing_id, buyer_id, seller_id
FROM trades
WHERE status = 'in_progress'
  AND auto_complete_at IS NULL
  AND offer_expires_at IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;

-- 2. Pick one and expire it
UPDATE trades
SET offer_expires_at = now() - interval '1 minute'
WHERE id = '<TRADE_ID_HERE>';

-- 3. Run the expiry processor
SELECT public.rpc_process_expired_offers(100);
-- Expected: Returns {"expired_count": 1, ...}

-- 4. Verify trade was cancelled
SELECT id, status, cancellation_reason, cancelled_at
FROM trades
WHERE id = '<TRADE_ID_HERE>';
-- Expected: status = 'cancelled', cancellation_reason = 'Offer expired'
```

### Expected Mobile Behavior

#### ✅ Issue 1 Fix: Notifications Sent
**Buyer:**
- Receives push notification: "Offer Expired"
- Message body: "Your offer on [item name] expired. The item is still available."

**Seller:**
- Receives push notification: "Offer Expired"
- Message body: "An unanswered offer on [item name] has expired."

#### ✅ Issue 2 Fix: Seller Buttons Hidden
**Before (BUG):**
- Seller could still see Accept/Decline buttons on expired offer

**After (FIXED):**
- Expired banner shown at top (⏱️ Expired)
- Accept/Decline buttons HIDDEN
- Message: "This offer has expired and can no longer be accepted."
- "Back to Offers" button shown

**How to verify:**
1. Log in as seller
2. Navigate to My Trades > Needs Action (should NOT see expired offer here)
3. Navigate to History tab > find the expired offer
4. Tap on it to open ReviewOfferScreen
5. Verify expired banner shown, no action buttons

#### ✅ Issue 3 Fix: Expired Offers Removed from Active Sections
**Before (BUG):**
- Expired offers still appeared in "Your Offers" (buyer) and "Needs Action" (seller)

**After (FIXED):**
- Expired offers ONLY in History tab
- "Your Offers" and "Needs Action" only show truly pending offers
- Text shows "Expired" instead of countdown timer

**How to verify:**
1. Log in as buyer
2. Go to My Trades > Active tab
3. Verify expired offer NOT in "Your Offers" section
4. Go to History tab
5. Verify expired offer appears here with "Expired" badge

## 🔍 Debugging Commands

### Check Notifications Were Sent
```sql
-- If you have a notifications table
SELECT * FROM notifications
WHERE trade_id = '<TRADE_ID>'
  AND event_type LIKE 'offer_expired%'
ORDER BY created_at DESC;
```

### Check Edge Function Logs
```bash
# Real-time log monitoring
supabase functions logs send-trade-notifications --tail

# Or check recent logs
supabase functions logs send-trade-notifications --limit 50
```

### Re-run Expiry Processor (Idempotency Test)
```sql
-- Run again with same trade (should return 0 expired since already processed)
SELECT public.rpc_process_expired_offers(100);
-- Expected: {"expired_count": 0}
```

### Verify Listing Stats Updated
```sql
-- DEV-TASK-34: unanswered_offer_count is a consecutive-expiry streak — INCREMENTED per
-- unanswered expiry, reset to 0 on seller accept/decline (declines never count).
SELECT listing_id, unanswered_offer_count, total_offer_count
FROM listing_offer_stats
WHERE listing_id = '<LISTING_ID>';
```

## ⚠️ Known Issues & Pre-Existing Warnings

These are NOT caused by TC-B02 fix:

1. **TypeScript errors (2):**
   - `PaymentMethodsScreen.tsx(244,27)`: Type 'string' not assignable to 'number'
   - `trade.ts(649,60)`: Argument of type 'string | null' not assignable to 'string'

2. **ESLint warnings (18):**
   - Unused imports/variables in TradeListScreen.tsx
   - All existed before TC-B02 changes

## ✅ Sign-Off Criteria

Before marking TC-B02 as PASS, verify:
- [ ] Database migration applied successfully
- [ ] Edge Function deployed successfully  
- [ ] Mobile app rebuilt and running
- [ ] **Issue 1:** Both buyer and seller receive push notifications
- [ ] **Issue 2:** Seller cannot see Accept/Decline buttons on expired offers
- [ ] **Issue 3:** Expired offers removed from "Your Offers" and "Needs Action"
- [ ] Expired offers appear correctly in History tab
- [ ] No new errors in logs or console
- [ ] Trade status shows "Cancelled" with reason "Offer expired"
- [ ] Listing stats updated correctly (unanswered_offer_count incremented per unanswered expiry; reset on seller accept/decline — DEV-TASK-34 streak model)

## 📚 Related Documentation

- Main fix summary: `/TC-B02-OFFER-EXPIRY-FIX.md`
- Test case: Trade Flow V2 test suite TC-B02
- D-30 spec: `/supabase/migrations/20260605000001_d30_in_progress_initial_status.sql`
