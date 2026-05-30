# SUBSCRIPTION REGISTRATION FLOW FIX - DEPLOYMENT GUIDE

## Problem Summary

**Issue**: When users select "Free Tier" during registration onboarding, they were getting a trial subscription instead of a free subscription.

**Root Cause**: `signupWithTrial()` was calling `create_trial_subscription` RPC immediately at signup, before SubscriptionChoiceScreen showed. When user selected "Free", nothing was downgrading the already-created trial.

## Solution Implemented

### Architecture Change
- **Before**: Signup → Create Trial → User Chooses Free (but stays on trial)
- **After**: Signup → Create Free → User Chooses Free (stays free) OR Trial (upgrades to trial)

### Changes Made

#### 1. New RPC Function: `create_free_subscription`
**File**: `supabase/migrations/20251220_free_subscription_creation.sql`

Creates a free subscription (no trial dates, status='free'):
```sql
CREATE OR REPLACE FUNCTION create_free_subscription(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Creates subscription with status='free', no trial_end_date
$$;
```

#### 2. Updated Signup Flow
**File**: `p2p-kids-marketplace/src/services/auth.ts`

Changed `signupWithTrial()` function:
- Line 139: Now calls `create_free_subscription` instead of `create_trial_subscription`
- Users start with `status='free'` at signup
- If they choose trial on SubscriptionChoiceScreen, it upgrades to trial

#### 3. Updated SubscriptionChoiceScreen
**File**: `p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx`

**handleChooseFree()** (lines 85-113):
- Marks profile as complete
- No subscription changes needed (already free from signup)
- Navigates to FeatureHighlights

**handleChooseTrial()** (lines 115-245):
- Detects existing 'free' subscription
- Calls `upgrade_free_subscription_to_trial()` RPC to upgrade
- Marks profile as complete
- Shows success alert

## Deployment Steps

### CRITICAL: Deploy Migration to Supabase

The new `create_free_subscription` RPC function **must be deployed** before the app works correctly.

**Option A: Supabase Dashboard (Manual)**
1. Go to https://app.supabase.com → SQL Editor
2. Create new query
3. Copy-paste entire contents of: `supabase/migrations/20251220_free_subscription_creation.sql`
4. Click "Run"
5. Verify: Run verification queries from the migration file

**Option B: Supabase CLI (Automated)**
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase db push  # Deploy all pending migrations
```

### Verification Queries

After deploying migration, run these in Supabase SQL Editor to confirm:

```sql
-- Query 1: Verify function exists
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname = 'create_free_subscription';

-- Query 2: Test creating free subscription (replace UUID with real user)
SELECT create_free_subscription('550e8400-e29b-41d4-a716-446655440000'::UUID);

-- Query 3: Check subscriptions table for the test user
SELECT * FROM subscriptions WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'::UUID;
```

## Testing the Fix

### Test Case 1: New User Selects Free Tier
1. Open app
2. Sign up with new email/password/etc
3. On SubscriptionChoiceScreen, tap "Free Tier"
4. Verify: User has `subscriptions.status = 'free'` (no trial dates)
5. Expected: SP toggle is NOT visible on listing creation

**How to verify in app logs**:
```
✅ Profile marked complete with FREE tier
SP toggle NOT visible (correct for free users)
```

### Test Case 2: New User Selects Trial
1. Open app
2. Sign up with new email/password/etc
3. On SubscriptionChoiceScreen, tap "Start 30-Day Trial"
4. Verify: User has `subscriptions.status = 'trial'` with trial_end_date set
5. Expected: SP toggle IS visible on listing creation

**How to verify in app logs**:
```
🔄 Upgrading free subscription to trial
✅ Successfully upgraded to trial
Can accept SP - SP toggle will be visible
```

### Test Case 3: Existing Free User Upgrades Mid-Session
1. Sign up as free user (from Test Case 1)
2. Go to Create Listing screen
3. See upgrade CTA (should say trial is not available)
4. This flow was already tested and works

## Code Changes Summary

### Files Modified
1. ✅ `supabase/migrations/20251220_free_subscription_creation.sql` (NEW)
2. ✅ `p2p-kids-marketplace/src/services/auth.ts` (Line 139-145)
3. ✅ `p2p-kids-marketplace/src/screens/onboarding/SubscriptionChoiceScreen.tsx` (Lines 85-245)

### Migration Changes
Created new RPC function: `create_free_subscription(p_user_id UUID) → jsonb`
- Returns subscription object with `status='free'`
- No trial_end_date fields populated
- Uses SECURITY DEFINER to bypass RLS

### App Code Changes
- **signupWithTrial()**: Changed RPC call from `create_trial_subscription` to `create_free_subscription`
- **handleChooseFree()**: Added logging, verified subscription stays free
- **handleChooseTrial()**: Changed to upgrade free subscription instead of creating trial from scratch

## Rollback Plan

If issues occur:

**Rollback to previous behavior**:
1. Revert `src/services/auth.ts` line 139 back to calling `create_trial_subscription`
2. Users will go back to always getting trial at signup
3. Free tier selection still won't work (as before)

**However**, this fix uses the existing `upgrade_free_subscription_to_trial()` RPC (from migration 20251219), so both RPCs should already exist in production.

## Dependencies

- ✅ `upgrade_free_subscription_to_trial()` RPC (created in previous fix)
- ✅ `initialize_sp_wallet()` RPC (already exists)
- ✅ Subscriptions table with status enum (already exists)
- ⏳ `create_free_subscription()` RPC (NEW - must be deployed)

## Open Questions

None - this fix directly addresses the reported issue of free tier selection creating trial subscriptions.

## Next Steps

1. **Deploy migration** to Supabase (CRITICAL)
2. **Test registration flow** with both free and trial selection
3. **Verify logs** show correct subscription status
4. **Monitor production** for any signup issues
