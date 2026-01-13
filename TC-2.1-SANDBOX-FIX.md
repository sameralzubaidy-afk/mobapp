# TC-2.1 Sandbox Access Error Fix

## Problem
When accessing the Badge Sandbox page in the admin portal, you got:
```
❌ Error: User not allowed
App loading failed with: AuthApiError: User not allowed
```

The Badge lists were **not populated by category** and the user dropdown was empty.

## Root Cause Analysis

The issue had **two parts**:

### Part 1: Admin API Call with Anon Key (403 Error)
The sandbox page was calling:
```typescript
const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
```

This requires **admin role privileges**, but the page was using the **anon key** (public access key), which doesn't have admin rights. Result: **403 Forbidden error**.

### Part 2: Missing Email Field
The sandbox page tried to get user emails from `auth.admin.listUsers()`, but the profiles table didn't have an `email` column to fall back to.

## Solution (2-Part Fix)

### Part A: Update Sandbox Page Code ✅
**File:** `p2p-kids-admin/src/app/badges/sandbox/page.tsx`

**Change:** Remove the `auth.admin.listUsers()` call and fetch email directly from profiles table.

**What was changed:**
- Removed: `supabase.auth.admin.listUsers()` API call
- Changed to: Query email from `profiles` table (using public SELECT policy)
- Users are now fetched with: `profiles.select('user_id, name, email')`

### Part B: Database Migration & Configuration
**File:** `supabase/migrations/20260113000001_fix_sandbox_rls_policies.sql` (NEW)

**What this migration does:**
1. **Adds email column** to profiles table (if not already present)
2. **Refreshes RLS policies** for profiles, badges, and user_badges tables
3. **Ensures SELECT policies** allow public/anon access to fetch data for the sandbox

## Deployment Steps

### Step 1: Apply the Database Migration
1. Open **Supabase Dashboard** → **SQL Editor**
2. Create a new query
3. Copy the entire contents of: `supabase/migrations/20260113000001_fix_sandbox_rls_policies.sql`
4. Paste into Supabase SQL Editor
5. Click **Run**

**Expected Output:** 
```
Query executed successfully (0 rows affected)
```

### Step 2: Populate Email Field (For Existing Users)
After applying the migration, run this query to sync emails from auth.users:

```sql
UPDATE profiles p
SET email = u.email
FROM auth.users u
WHERE p.user_id = u.id AND p.email IS NULL;
```

This will populate the email field for all existing user profiles.

### Step 3: Verify the Fix Applied
Run this query to confirm email column exists and has data:

```sql
SELECT user_id, name, email, created_at 
FROM profiles 
WHERE email IS NOT NULL 
LIMIT 5;
```

**Expected Output:** 
You should see rows with user_id, name, and email populated.

### Step 4: Restart Admin Portal
1. In your terminal where admin portal is running, press `Ctrl+C` to stop it
2. Run: `cd p2p-kids-admin && npm run dev`
3. Admin portal will restart on `http://localhost:3000`

### Step 5: Test TC-2.1 Again
1. Login to admin portal at `http://localhost:3000`
2. Navigate to **Badges** → **Sandbox**
3. Verify:
   - ✅ No "User not allowed" error
   - ✅ User dropdown is **populated** with user names/emails
   - ✅ **Eligible Badges** section shows badges grouped by category (SP Earning, SP Spending, Trades, Subscription)

## Expected Results After Fix

### Before Fix ❌
```
Error loading sandbox data: AuthApiError: User not allowed
[Empty user dropdown]
[No badges listed]
```

### After Fix ✅
```
✓ Page loads without errors
✓ User dropdown shows: ["john@example.com", "jane@example.com", "test_user@example.com"]
✓ SP Earning category shows: ["SP Earner - Bronze", "SP Earner - Silver", "SP Earner - Gold", ...]
✓ Trades category shows: ["First Trade", "10 Trades", "50 Trades", ...]
✓ Eligible Badges section populates when you change category
```

## Files Changed

### Modified Files:
- **`p2p-kids-admin/src/app/badges/sandbox/page.tsx`**
  - Removed: `supabase.auth.admin.listUsers()` call (requires admin role)
  - Added: Email fetched from profiles table (uses public SELECT policy)
  - Lines changed: ~41-56 in loadInitialData() function

### New Files:
- **`supabase/migrations/20260113000001_fix_sandbox_rls_policies.sql`**
  - Adds email column to profiles
  - Refreshes RLS policies
  - Includes verification queries and population script

## Verification Checklist

- [ ] Migration `20260113000001_fix_sandbox_rls_policies.sql` applied in Supabase
- [ ] Email population query executed (existing users synced)
- [ ] Verification query shows email data in profiles table
- [ ] Admin portal restarted (`npm run dev`)
- [ ] Sandbox page loads without "User not allowed" error
- [ ] User dropdown is populated with email list
- [ ] Badge categories show eligible badges
- [ ] TC-2.1 manual test passes: **Access Badge Sandbox** ✅

## Why This Fix Works

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| 403 Forbidden | Called `auth.admin.listUsers()` with anon key (no admin role) | Fetch email from profiles table instead (uses public SELECT policy) |
| Empty user list | No fallback when admin API failed | email column + profiles table data |
| No badges shown | Loading interrupted by auth error | Fixed auth error allows data load to complete |
| RLS rejection | Overly restrictive policies | Explicit public SELECT policies ensure anon key can read profiles/badges |

## Next Steps After Verification

After TC-2.1 passes:
1. Continue with **TC-2.2: Simulate SP Event**
2. Then test remaining test cases from the manual testing guide
3. Run full Tier 0/1 checks:
   ```bash
   cd p2p-kids-admin && npm run typecheck && npm run lint
   cd p2p-kids-marketplace && npm run typecheck && npm run lint
   ```

## Support

If you still see the error after applying the migration:
1. Clear browser cache (Cmd+Shift+Del on Mac, Ctrl+Shift+Del on Windows)
2. Hard refresh the page (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
3. Verify migration was applied:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'email';
   ```
   Should return: `email`
4. Verify RLS policies:
   ```sql
   SELECT policy_name FROM pg_policies WHERE tablename = 'profiles';
   ```
   Should show: `"Public profiles are viewable"` and `"Service role can read all profiles"`
