# Fix: Missing Email and Phone in Profile Creation

## Problem Analysis

**Issue**: Profile records created during signup are missing `email` and `phone` fields

**Example Record**:
```json
{
  "user_id": "93c3b2bd-9b0d-476b-8021-97c2567b4e42",
  "name": "bob.samer.demo@example.com",
  "email": null,
  "phone": null,
  "bio": "bob.samer.demo@example.com",
  ...
}
```

**Root Cause**: The profile creation trigger `handle_new_user()` was only capturing:
- `name` from `raw_user_meta_data->>'name'`
- Not capturing `email` from `auth.users.email`
- Not capturing `phone` from `raw_user_meta_data->>'phone'`

**Flow**:
1. Signup form sends: email, phone, name, dob
2. `signupWithTrial()` calls `supabase.auth.signUp()` with this data
3. Supabase creates auth user with:
   - `email` in `auth.users.email` (NOT in metadata)
   - `phone` in `raw_user_meta_data->>'phone'`
   - `display_name`/`name` in `raw_user_meta_data->>'name'`
4. Trigger `handle_new_user()` fires on `INSERT INTO auth.users`
5. **BUG**: Trigger only extracts `name`, doesn't extract `email` or `phone`

## Solution

**File**: `supabase/migrations/20241214000001_add_profile_creation_trigger.sql`

**Before**:
```sql
INSERT INTO public.profiles (user_id, name, phone_verified, phone_verified_at)
VALUES (
  NEW.id,
  COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
  false,
  NULL
)
```

**After**:
```sql
INSERT INTO public.profiles (
  user_id,
  name,
  email,
  phone,
  phone_verified,
  phone_verified_at
)
VALUES (
  NEW.id,
  COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
  NEW.email,                                              -- ✅ ADDED
  COALESCE(NEW.raw_user_meta_data->>'phone', NULL),     -- ✅ ADDED
  false,
  NULL
)
```

**Key Changes**:
1. Add `email` column to INSERT (uses `NEW.email` from auth.users)
2. Add `phone` column to INSERT (uses `NEW.raw_user_meta_data->>'phone'`)
3. Use `COALESCE(..., NULL)` for phone to handle if metadata doesn't have it

## Files Modified

✅ `supabase/migrations/20241214000001_add_profile_creation_trigger.sql`

## Test Steps

### Step 1: Update Migration
```sql
-- In Supabase SQL Editor, run:
supabase/migrations/20241214000001_add_profile_creation_trigger.sql
```

### Step 2: Clear Existing Test Data
```sql
-- DELETE test profiles to force re-creation with new trigger
DELETE FROM profiles WHERE created_at > NOW() - INTERVAL '1 hour';
DELETE FROM auth.users WHERE email LIKE 'test-sp-%@test.com';
```

### Step 3: Test Signup Flow
1. Launch simulator
2. Tap "Sign Up"
3. Fill form:
   - Name: "Test User"
   - Email: `test-email-capture-${Date.now()}@test.com`
   - Phone: "+12025551234"
   - DOB: "2000-01-15"
   - Password: "TestPass123"
4. Complete phone verification
5. Select "Free" tier

### Step 4: Verify in Database
```sql
-- Check profile was created with email and phone
SELECT user_id, name, email, phone, phone_verified, created_at
FROM profiles
WHERE email LIKE 'test-email-capture%'
ORDER BY created_at DESC
LIMIT 1;

-- Expected Result:
-- user_id: <UUID from signup>
-- name: "Test User"
-- email: "test-email-capture-<TIMESTAMP>@test.com" ✅ POPULATED
-- phone: "+12025551234" ✅ POPULATED
-- phone_verified: false
-- created_at: <recent timestamp>
```

### Step 5: Verify Auth User Also Has Data
```sql
-- Verify email is in auth.users
SELECT id, email, raw_user_meta_data->>'phone' as phone_from_metadata
FROM auth.users
WHERE email LIKE 'test-email-capture%'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- email: "test-email-capture-<TIMESTAMP>@test.com" ✅
-- phone_from_metadata: "+12025551234" ✅
```

## Expected Results After Fix

**Before Fix** (Current Problem):
```json
{
  "email": null,
  "phone": null,
  "name": "bob.samer.demo@example.com"
}
```

**After Fix** (Expected):
```json
{
  "email": "bob.samer.demo@example.com",
  "phone": "+12025551234",
  "name": "Test User"
}
```

## Why This Matters

1. **Contact Information**: Email and phone are essential for:
   - Account recovery
   - Notifications (when implemented)
   - Support/Help flows
   - Messaging features

2. **Data Consistency**: Email should come from auth.users (source of truth) and be mirrored to profiles for quick access

3. **Phone Verification**: Phone is critical for:
   - Trust verification
   - Two-factor authentication
   - Transaction confirmations

## Verification Checklist

- [ ] Migration runs successfully in Supabase
- [ ] New user signup creates profile with email
- [ ] New user signup creates profile with phone
- [ ] Email matches what user entered in form
- [ ] Phone matches what user entered in form
- [ ] Existing profiles (created before fix) are NOT modified (idempotent)
- [ ] Phone verification flow still works
- [ ] Free/Trial tier selection works after fix

## Regression Tests

After deploying this fix, verify:

1. **Existing Users Not Affected**:
   ```sql
   SELECT COUNT(*) as existing_users
   FROM profiles
   WHERE created_at < NOW() - INTERVAL '1 hour'
   AND (email IS NULL OR phone IS NULL);
   -- These should remain unchanged (only new users get email/phone in trigger)
   ```

2. **Phone Verification Still Works**:
   - Complete phone verification flow
   - Verify `phone_verified` is set to true
   - Verify `phone_verified_at` has timestamp

3. **Session Refresh Works**:
   - After signup, session should show user profile with email/phone
   - Navigate to dashboard - no errors

## Rollback (If Needed)

```sql
-- Revert to old trigger (only captures name)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, phone_verified, phone_verified_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    false,
    NULL
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Profile creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Next Steps

1. Run this migration in Supabase SQL Editor
2. Complete full signup test (Steps 1-5)
3. Verify email and phone are populated in profiles table
4. Deploy to staging environment
5. Test on actual devices (iOS + Android)
