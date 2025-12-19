# 🔧 Subscription Detection - Permanent Fix

## Problem Identified
The subscription detection was failing because the code was querying a non-existent column `subscriptions.subscription_tier_id`.

### Root Cause
- The `subscriptions` table schema only has columns: `id, user_id, status, trial_start_date, trial_end_date, stripe_*, current_period_*, created_at, updated_at`
- The code was trying to select `subscription_tier_id` which does NOT exist in the database schema
- This caused SQL error `42703: column subscriptions.subscription_tier_id does not exist`
- Result: `getSubscriptionSummary()` failed silently and returned `can_spend_sp: false` (free user)

## Changes Applied

### 1. **src/services/subscription.ts** - Fixed Query
```typescript
// BEFORE (BROKEN):
.select('user_id,status,subscription_tier_id,expires_at,created_at')

// AFTER (FIXED):
.select('user_id,status,created_at,updated_at,trial_end_date,current_period_end')
```

### 2. **src/services/auth.ts** - enrollInTrialSubscription
- Added comprehensive logging at every step
- Fixed to query only valid columns
- Changed `.select('*')` to explicit column list to avoid schema confusion

### 3. **src/screens/listing/CreateListingScreen.tsx** - Enhanced Logging
- Added emoji logging to track subscription checks
- Removed error Alert (was interrupting flow)
- Clear console output showing: user_id → subscription status → SP toggle visibility

### 4. **src/screens/onboarding/SubscriptionChoiceScreen.tsx** - Enhanced Logging
- Added step-by-step logging for enrollment process
- Tracks enrollment success before navigation
- Logs flow type (onboarding vs authenticated)

## How to Test

### Test Flow: Non-Subscriber → Upgrade → SP Toggle Appears

**Step 1: Verify user is free**
1. Log in with existing account
2. Check Expo console:
   ```
   [subscription] ✅ User has trial subscription  // if already upgraded
   [subscription] ℹ️ User cannot accept SP         // if free user
   ```

**Step 2: Create listing (non-subscriber)**
- Tap Dashboard → "📝 Create Listing" button
- Check console for:
  ```
  [CreateListing] 🔍 Loading subscription status for user: <uid>
  [subscription] 📊 Query result: { subscription: [], error: null }
  [subscription] ℹ️ No subscription found for user
  [subscription] 📊 Subscription summary: { can_spend_sp: false }
  [CreateListing] ℹ️ User cannot accept SP - upgrade CTA will be shown
  ```
- **Expected UI**: Upgrade CTA banner: "🌟 Subscribe to Kids Club+ to accept Swap Points..."

**Step 3: Click "Upgrade Now"**
- Button navigates to SubscriptionChoice screen
- Console shows:
  ```
  [SubscriptionChoice] 📋 Trial enabled: true
  [SubscriptionChoice] 🔍 Checking existing subscription
  [SubscriptionChoice] 📊 Existing subscription query result: { subscription: [...] }
  ```

**Step 4: Click "Start Free Trial"**
- Console shows:
  ```
  [SubscriptionChoice] 🚀 Enrolling user in trial: <uid>
  [enrollInTrialSubscription] 🚀 Starting enrollment for user: <uid>
  [enrollInTrialSubscription] 📋 Trial enabled: true
  [enrollInTrialSubscription] 🔍 Checking existing subscription
  [enrollInTrialSubscription] ✨ Creating new trial subscription
  [enrollInTrialSubscription] ✅ New subscription created: { id: ..., status: 'trial' }
  [SubscriptionChoice] ✅ Enrollment successful: { subscription: {...}, wallet: {...} }
  ```

**Step 5: Click "Get Started"**
- If authenticated flow (from CreateListingScreen):
  ```
  [SubscriptionChoice] ✅ Returning to listing creation, subscription should refresh on focus
  ```
- App returns to CreateListingScreen
- Console shows (automatically via useFocusEffect):
  ```
  [CreateListing] 🔍 Loading subscription status for user: <uid>
  [subscription] 📊 Query result: { subscription: [{ status: 'trial', ... }], error: null }
  [subscription] ✅ User has trial subscription
  [subscription] 📊 Subscription summary: { can_spend_sp: true, status: 'trial' }
  [CreateListing] ✅ User can accept SP - SP toggle will be visible
  ```

**✅ Expected Result**: SP toggle "Accept Swap Points?" now appears instead of upgrade CTA

## Verification Checklist

- [ ] **Tier 0 Compile Gate**
  ```bash
  cd p2p-kids-marketplace
  yarn typecheck  # Must pass with no "subscription_tier_id" errors
  ```

- [ ] **Console Output Sequence** (in order)
  1. "🔍 Checking subscription" 
  2. "📊 Query result" with subscription data
  3. "✅ User has trial" OR "ℹ️ User cannot accept SP"
  4. After enrollment: "✨ Creating new trial subscription"
  5. After return: "✅ User can accept SP"

- [ ] **UI State Changes**
  1. Non-subscriber: sees upgrade CTA
  2. After upgrade: sees SP toggle
  3. SP toggle toggles between "✓ SP Eligible" and off state

- [ ] **Database Verification** (optional)
  ```sql
  SELECT user_id, status, trial_end_date, current_period_end 
  FROM subscriptions 
  WHERE user_id = '<your-user-id>' 
  ORDER BY created_at DESC LIMIT 1;
  
  -- Expected output after upgrade:
  -- | <your-id> | trial | 2025-01-17 | NULL |
  ```

## Known Limitations / TODOs

- [ ] `subscription_tier_id` field not yet in schema (set to `null` for now)
- [ ] Stripe integration fields present but not used in trial flow
- [ ] Expiration logic: using `trial_end_date` for trial, `current_period_end` for active subscriptions

## If Still Not Working

1. **Check DB directly**:
   - Open Supabase SQL Editor
   - Run: `SELECT * FROM subscriptions WHERE user_id = '<your-id>'`
   - Verify `status` is `'trial'` not `'free'`

2. **Check Enrollment RPC**:
   - `create_trial_subscription` RPC must exist and return subscription record
   - `is_trial_enabled` RPC must return `true`

3. **Check Network**:
   - Supabase connection must be working (other queries succeed)
   - No auth token issues

4. **Force Reload**:
   - Press `r` in Expo terminal to reload app
   - useFocusEffect should then trigger fresh subscription check

## Files Modified

1. `src/services/subscription.ts` - Fixed column query
2. `src/services/auth.ts` - Fixed enrollment queries + logging
3. `src/screens/listing/CreateListingScreen.tsx` - Enhanced logging
4. `src/screens/onboarding/SubscriptionChoiceScreen.tsx` - Enhanced logging
