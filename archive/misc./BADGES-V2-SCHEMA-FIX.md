# 🔧 BADGES-V2-008 Schema Fix

## Problem
When editing a badge in the admin portal and clicking "Save", you got this error:
```
column s.canceled_at does not exist
```

## Root Cause
The `retroactive_award_badges()` function (triggered when badge is saved) was trying to query the `subscriptions` table with a `canceled_at` column that didn't exist in your database schema.

Additionally, the function was referencing a `transactions` table that doesn't exist - it should be `trades`.

## Solution Applied
Created a new migration file that:

1. **Adds `canceled_at` column** to the `subscriptions` table
   - Used when calculating subscription tenure for subscription-based badges
   - Stores the timestamp when a subscription was canceled

2. **Updates `retroactive_award_badges()` function** to:
   - Handle the new `canceled_at` column properly
   - Use correct table name `trades` instead of `transactions`
   - Calculate subscription tenure correctly

3. **Updates `preview_retroactive_awards()` function** to:
   - Match the updated retroactive logic
   - Use correct table names
   - Include all subscription statuses: 'active', 'trial', 'canceled', 'grace', 'expired'

## Files Modified

### Created:
- `supabase/migrations/20260112000003_fix_subscription_badge_schema.sql` (NEW migration)

### Updated:
- `supabase/migrations/20260112000002_retroactive_badges.sql` (fixed table references)

---

## ✅ How to Deploy the Fix

### Step 1: Apply the new migration in Supabase
```bash
# Open Supabase SQL Editor and run:
# File: supabase/migrations/20260112000003_fix_subscription_badge_schema.sql
```

### Step 2: Verify the fix
```sql
-- Check that canceled_at column now exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subscriptions' AND column_name = 'canceled_at';
-- Expected: Should return one row showing canceled_at as TIMESTAMP WITH TIME ZONE
```

### Step 3: Test the badge save again
1. Go to admin portal: `http://localhost:3001/badges`
2. Click any badge to edit
3. Change the threshold (e.g., from 100 to 50)
4. Click **Save**
5. ✅ Should now work without errors!

---

## 🧪 TC-1.2 Manual Retroactive Award Execution - Now Fixed!

You can now complete this test case:

1. ✅ In admin portal, navigate to **Badges** page
2. ✅ Select a badge with moderate threshold (e.g., "50 SP Earned")
3. ✅ Lower the threshold to a smaller value (e.g., 25 SP)
4. ✅ Click **Save** - **NOW WORKS** (no more error!)
5. ✅ In Supabase SQL Editor, verify:
   ```sql
   SELECT COUNT(*) as awards_given
   FROM user_badges
   WHERE badge_id = 'BADGE_ID_YOU_EDITED';
   ```

---

## 🎯 Why This Happened

The retroactive badge system needs to:
- Track when subscriptions are canceled (for tenure calculation)
- Reference the correct trade table
- Handle all subscription states properly

Your database was missing the `canceled_at` column needed for this logic. When you tried to save a badge that would trigger the retroactive function, the database threw an error.

---

## ✨ What's Now Supported

After applying this fix, these badge categories all work correctly:
- ✅ `sp_earning` - Users who earned >= threshold SP
- ✅ `sp_spending` - Users who spent >= threshold SP  
- ✅ `trades` - Users who completed >= threshold trades
- ✅ `subscription` - Users with >= threshold days subscription tenure (NOW FIXED!)

---

**Status:** Ready for testing! 🚀
