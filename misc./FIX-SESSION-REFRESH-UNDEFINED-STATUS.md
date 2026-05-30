# Fix: "Session refresh failed: Cannot read property 'status' of undefined"

## Problem Analysis

**Error**: `TypeError: Cannot read property 'status' of undefined` in `AuthContext.tsx:269`

**Root Cause**: When a user selects "Free" tier and clicks "Get Started", the auth context tries to refresh the session by calling `get_subscription_summary()` RPC which returns **an empty array** (not null, not undefined). The code was trying to access `.status` on the first element of an empty array, resulting in `undefined.status`.

**Flow**:
1. User registered → signup created a FREE subscription via `create_free_subscription()` RPC
2. User selected "Free" tier → profile marked as `profile_completed: true`
3. Navigation to FeatureHighlights → triggers session refresh
4. `refreshSession()` calls `get_subscription_summary(user_id)`
5. RPC returns empty array `[]` (because RETURN QUERY returns 0 rows when searching for subscription)
6. Code did `Array.isArray(subData) ? subData[0] : subData` → got `undefined`
7. Code tried to access `undefined.status` → error!

## Root Cause in RPC

The `get_subscription_summary()` RPC in migration `20251215100001_auth_v2_rpc_functions.sql`:

```sql
CREATE OR REPLACE FUNCTION get_subscription_summary(p_user_id UUID)
RETURNS TABLE (
  status TEXT,
  can_spend_sp BOOLEAN,
  trial_end_date TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ... FROM subscriptions s WHERE s.user_id = p_user_id;
  -- Returns EMPTY ARRAY if no matching row!
END;
$$;
```

**Issue**: RETURN QUERY returns 0 rows if no subscription found, not NULL or error.

## Solution: Defensive Array Handling

**File**: `p2p-kids-marketplace/src/contexts/AuthContext.tsx`

**Before** (line 207):
```typescript
let subscriptionSummary = Array.isArray(subData) ? subData[0] : subData || {
  status: 'free',
  can_spend_sp: false,
};
```

**After** (lines 207-237):
```typescript
let subscriptionSummary = null;

if (subError) {
  console.warn('[AUTH] get_subscription_summary warning:', subError);
} else if (Array.isArray(subData) && subData.length > 0) {
  // Array with at least one row
  subscriptionSummary = subData[0];
} else if (subData && !Array.isArray(subData)) {
  // Single object response
  subscriptionSummary = subData;
} else if (Array.isArray(subData) && subData.length === 0) {
  // Empty array - no subscription found, default to free
  console.warn('[AUTH] No subscription found for user, defaulting to free');
  subscriptionSummary = { status: 'free', can_spend_sp: false };
} else {
  // Fallback
  subscriptionSummary = { status: 'free', can_spend_sp: false };
}

// Normalize booleans and default status value for UI consistency
if (subscriptionSummary && typeof subscriptionSummary.can_spend_sp === 'string') {
  subscriptionSummary.can_spend_sp = subscriptionSummary.can_spend_sp === 'true' || subscriptionSummary.can_spend_sp === 't';
}
if (subscriptionSummary) {
  subscriptionSummary.status = subscriptionSummary.status || 'free';
}
```

Same fix applied to wallet summary handling.

## Files Modified

✅ `p2p-kids-marketplace/src/contexts/AuthContext.tsx`:
- Lines 207-237: Fixed `subscriptionSummary` initialization
- Lines 239-252: Fixed `walletSummary` initialization

## Test Steps

### Step 1: Clear App Cache & Restart
```bash
# Clear Expo cache
rm -rf node_modules/.cache
npm start -- --clear
```

### Step 2: Test Free Tier Flow
1. Tap "Sign Up"
2. Fill signup form with valid data
3. Complete phone verification (or skip if optional)
4. Complete profile screen
5. **Select "Free Tier" on Subscription Choice screen**
6. Tap "Get Started"

**Expected Results**:
- ✅ No error
- ✅ Navigates to FeatureHighlights screen
- ✅ Session refresh completes successfully
- ✅ App loads with FREE subscription status

### Step 3: Verify in Supabase
```sql
-- Verify subscription was created
SELECT id, user_id, status, created_at 
FROM subscriptions 
WHERE user_id = '<NEW_USER_ID>' 
ORDER BY created_at DESC;

-- Expected: 1 row with status = 'free'
```

### Step 4: Check Logs
```
# Look for this in console:
[AUTH] Session refreshed: {
  user_id: "...",
  onboarding_completed: true,
  subscription_status: "free",
  available_points: 0
}
```

## Prevention

To prevent similar issues:
1. **Always check array length** before accessing array[0]
2. **Add fallback defaults** for every RPC call that might return empty
3. **Log warnings** for unexpected empty results (helps debugging)
4. **Test all code paths** (free, trial, expired subscriptions)

## Rollback (If Needed)

If this fix causes issues, revert the AuthContext.tsx file:
```bash
git checkout p2p-kids-marketplace/src/contexts/AuthContext.tsx
```

Then implement alternative: ensure `get_subscription_summary()` RPC always returns at least one row (with 'free' as default status).

## Next Issue Check

If still seeing errors after this fix:
1. Verify `get_subscription_summary` RPC returns expected format
2. Check if `get_user_sp_wallet_summary` returns empty array (same issue)
3. Look for other places where array results aren't checked for length
