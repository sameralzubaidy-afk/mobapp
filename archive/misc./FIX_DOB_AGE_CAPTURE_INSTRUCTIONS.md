# Fix: DOB and Age Not Being Captured During Signup

## Problem
- Users register with their DOB (e.g., `2010-05-15`)
- But the `dob` and `age` fields in the `profiles` table remain **NULL**
- This prevents proper age verification and trust calculations

## Root Cause
The `handle_new_user()` trigger was not properly extracting the DOB from auth metadata in `YYYY-MM-DD` format.

## Solution

### Step 1: Apply the SQL Fix to Production

1. **Open Supabase Dashboard**
   - Go to SQL Editor → New Query

2. **Copy and paste the entire content of:**
   - [FIX_SIGNUP_PROFILE_CREATION.sql](FIX_SIGNUP_PROFILE_CREATION.sql)

3. **Run the query**
   - This will:
     - Update the `handle_new_user()` trigger with proper DOB parsing using `TO_DATE()`
     - Update the `verify_user_phone()` function with fallback profile creation
     - **Backfill existing profiles** with DOB and age from auth metadata

### Step 2: Verify the Fix

Run these queries in Supabase SQL Editor:

```sql
-- Check overall statistics
SELECT COUNT(*) as total_profiles FROM public.profiles;
SELECT COUNT(*) as profiles_with_dob FROM public.profiles WHERE dob IS NOT NULL;
SELECT COUNT(*) as profiles_with_age FROM public.profiles WHERE age IS NOT NULL;
```

Expected results:
- `profiles_with_dob` should equal or be close to `total_profiles`
- `profiles_with_age` should be the same

### Step 3: Test New Signups

Create a new test user:
- Email: `test-dob-YYYYMMDDHHMMSS@example.com`
- Password: `TestPass123`
- DOB: Any date in `YYYY-MM-DD` format (e.g., `2010-05-15`)

Then check the profile was created with DOB and age:

```sql
SELECT id, name, dob, age, created_at
FROM public.profiles
ORDER BY created_at DESC
LIMIT 1;
```

Expected result: `dob` and `age` should be populated (not NULL)

## What Changed

### Before
```sql
user_dob := (NEW.raw_user_meta_data->>'dob')::date
```
❌ This used implicit casting which could fail silently

### After
```sql
user_dob := TO_DATE(dob_raw, 'YYYY-MM-DD')
```
✅ Explicit `TO_DATE()` with proper format specification
✅ Includes TRY/CATCH for error handling
✅ Includes RAISE NOTICE for debugging
✅ Backfill function for existing users

## Trigger Improvements

The updated trigger now:

1. **Explicitly extracts DOB** using `TO_DATE()` with format `'YYYY-MM-DD'`
2. **Calculates age** from the parsed DOB: `EXTRACT(YEAR FROM AGE(CURRENT_DATE, user_dob))`
3. **Validates age** is in a reasonable range (1-150 years)
4. **Logs each step** with `RAISE NOTICE` for debugging
5. **Handles errors gracefully** - doesn't fail on parsing errors
6. **Backfills existing data** - updates all profiles where DOB is missing but exists in auth

## Testing Checklist

- [ ] SQL fix applied to production Supabase
- [ ] Backfill query completed (check row count)
- [ ] Verification queries show profiles_with_dob ≈ total_profiles
- [ ] New test user created and verified has DOB/age populated
- [ ] Sign up → Phone verification → Profile completion flow works end-to-end
- [ ] Existing users show correct DOB/age after backfill

## Expected Impact

✅ **After this fix:**
- All new signups will capture DOB and calculate age
- All existing profiles will be backfilled with DOB/age from auth metadata
- Age verification for restrictions (18+) will work correctly
- Trust scoring based on account age will be accurate
