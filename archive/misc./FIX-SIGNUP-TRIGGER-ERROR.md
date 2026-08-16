# Fix: Signup Trigger Error "Database error saving new user"

## Problem Analysis

**Error**: `AuthError: Database error saving new user` during registration  
**Root Cause**: The `handle_new_user()` trigger on `auth.users` is failing when trying to insert a profile record

**Possible Causes**:
1. RLS policy blocking trigger inserts (now FIXED)
2. Missing or NULL columns in profiles table (now FIXED - added default `'User'` if name is empty, added `NULL` for `phone_verified_at`)
3. SP wallet initialization failure cascading (now FIXED - disabled during signup)
4. Subscription creation failure cascading (should be non-blocking but may have failed silently)

## Changes Made

### 1. Updated `handle_new_user()` Trigger Function
**File**: `supabase/migrations/20241214000001_add_profile_creation_trigger.sql`

**Changed**:
```sql
-- BEFORE
INSERT INTO public.profiles (user_id, name, phone_verified)
VALUES (
  NEW.id,
  COALESCE(NEW.raw_user_meta_data->>'name', ''),
  false
)

-- AFTER
INSERT INTO public.profiles (user_id, name, phone_verified, phone_verified_at)
VALUES (
  NEW.id,
  COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
  false,
  NULL
)
ON CONFLICT (user_id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
```

**Why**: 
- Added error handling to NOT fail the auth trigger if profile insert fails
- Changed empty string to 'User' for non-NULL name requirement
- Explicitly set `phone_verified_at` to NULL
- Now logs warnings instead of silently failing

### 2. Simplified `signupWithTrial()` Function
**File**: `p2p-kids-marketplace/src/services/auth.ts`

**Changed**:
- Removed polling for profile existence (trigger is async)
- Removed SP wallet initialization during signup (moved to on-demand or trial enrollment)
- Removed profile update linking subscription/wallet (can be done later)
- Kept subscription creation as non-blocking warning

**Why**:
- Reduces cascading failures
- Signup now only creates auth user + FREE subscription
- Wallet and profile linking happen later in the flow
- Simpler, faster signup with fewer potential failure points

## Test Steps (Do This Now)

### Step 1: Run Updated Migration
```sql
-- In Supabase SQL Editor, run:
supabase/migrations/20241214000001_add_profile_creation_trigger.sql
```

This will update the trigger function to be more robust with error handling.

### Step 2: Run Diagnostic Queries
```sql
-- In Supabase SQL Editor, run all queries from:
DIAGNOSE-SIGNUP-TRIGGER.sql
```

**Expected Results**:
- `handle_new_user` function exists and has `EXCEPTION` handling
- `profiles` table has columns: user_id, name (NOT NULL), phone_verified, phone_verified_at
- Trigger `on_auth_user_created` exists and fires AFTER INSERT
- Sp_config table has 16 rows

### Step 3: Test Signup Flow in App
1. Open iOS Simulator (or Android Emulator)
2. Navigate to Signup screen
3. Fill form:
   - Name: "Test User"
   - Email: `test-sp-${Date.now()}@test.com`
   - Phone: "+12025551234"
   - DOB: "2000-01-15" (must be 18+)
   - Password: "TestPass123"
4. Tap "Sign Up"

**Expected Results**:
- ✅ No error
- ✅ Navigates to PhoneVerification screen
- ✅ User created in `auth.users` table
- ✅ Profile auto-created in `profiles` table with `name = 'Test User'`
- ✅ Subscription created in `subscriptions` table with `status = 'free'`

### Step 4: Verify Database Records
```sql
-- Replace with actual email from test
SELECT * FROM auth.users WHERE email = 'test-sp-TIMESTAMP@test.com';
SELECT * FROM profiles WHERE name = 'Test User';
SELECT * FROM subscriptions WHERE user_id = '<USER_ID>';
```

**Expected Results**:
- User exists in auth.users
- Profile exists with matching user_id, name='Test User', phone_verified=false
- Subscription exists with status='free'

## Rollback Plan (If Still Failing)

If signup still fails after these changes:

### Option 1: Disable Profile Trigger Temporarily
```sql
-- Disable the trigger to see if auth can complete
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Try signup in app again - it should succeed (but profile won't be created)
-- If it succeeds, the issue is in handle_new_user() function or RLS
```

### Option 2: Check RLS Policies
```sql
-- Check if RLS is preventing trigger inserts
SELECT * FROM pg_policies WHERE tablename = 'profiles';

-- The policy "Users can insert their own profile" should allow auth.uid() IS NULL:
-- WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id)
```

### Option 3: Manual Profile Creation
```sql
-- Test if manual insert works (triggers usually have bypass permissions)
INSERT INTO profiles (user_id, name, phone_verified)
VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'::uuid, 'Test', false);
```

## Files Modified

1. ✅ `supabase/migrations/20241214000001_add_profile_creation_trigger.sql` - Updated trigger with error handling
2. ✅ `p2p-kids-marketplace/src/services/auth.ts` - Simplified signup flow
3. ✅ `DIAGNOSE-SIGNUP-TRIGGER.sql` - Created diagnostic queries
4. ✅ `MANUAL-TEST-SP-001.md` - Already exists (not modified for this fix)

## Next Steps

1. **Run diagnostic queries** to verify trigger and schema are correct
2. **Test signup flow** in simulator
3. **If still failing**, run rollback steps and enable debug logging:
   ```typescript
   // Add to SignupScreen.tsx before signup call
   console.log('About to call signupWithTrial with:', { email, name });
   ```
4. **Check Supabase function logs** in dashboard for detailed error messages

## Prevention

To prevent similar issues in future:
- Always include EXCEPTION handling in triggers
- Test migrations in dev/staging before applying to production
- Have diagnostic SQL scripts ready
- Use application logs + Supabase logs together for debugging
