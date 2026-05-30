# QUICK START: Deploy Profile Email/Phone Fix

## 🎯 What to Do Now

You have just fixed the profile trigger to capture email and phone during signup. This guide tells you exactly how to deploy and verify it.

---

## Step 1: Run Migration in Supabase SQL Editor (2 minutes)

### Option A: Copy-Paste Entire Migration

1. Open Supabase Dashboard → SQL Editor
2. Create New Query
3. Copy-paste the ENTIRE contents of:
   ```
   supabase/migrations/20241214000001_add_profile_creation_trigger.sql
   ```
4. Click **Run**
5. Expected: ✅ "Success. No rows returned"

### Option B: Just Update the Function (Faster)

If migration 20241214000001 was already run, just update the function:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
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

---

## Step 2: Clean Up Old Test Data (1 minute)

Run this in Supabase SQL Editor to remove profiles created before the fix:

```sql
-- DELETE profiles created in last hour (from testing)
DELETE FROM profiles 
WHERE created_at > NOW() - INTERVAL '1 hour'
AND email IS NULL AND phone IS NULL;

-- DELETE corresponding auth users from testing
DELETE FROM auth.users 
WHERE created_at > NOW() - INTERVAL '1 hour'
AND email LIKE 'bob.samer%';
```

---

## Step 3: Test Signup Flow (5-10 minutes)

### Launch App in Simulator

```bash
cd p2p-kids-marketplace
npx expo start -i  # or -a for Android
# Then press 'i' for iOS simulator
```

### Complete Signup
1. **Tap**: Sign Up
2. **Fill Form**:
   - Name: `TestUser${Date.now()}`
   - Email: `testuser-${Date.now()}@test.com`
   - Phone: `+12025551234`
   - DOB: `2000-01-15`
   - Password: `TestPass123!`
3. **Submit**: Continue
4. **Phone Verification** (if prompted):
   - Enter test code (check server logs or use `000000`)
5. **Tier Selection**:
   - Select "Free"
6. **Dashboard**: Should load without errors

---

## Step 4: Verify in Supabase (2 minutes)

Run this query to verify email and phone were captured:

```sql
-- Check the profile created by signup
SELECT 
  user_id,
  name,
  email,
  phone,
  phone_verified,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result**:
```
| user_id                              | name        | email                    | phone         | phone_verified | created_at              |
|--------------------------------------|-------------|--------------------------|---------------|----------------|-------------------------|
| <NEW_UUID>                           | TestUser... | testuser-...-@test.com   | +12025551234  | false          | 2025-01-15 14:30:00     |
```

✅ Both `email` and `phone` should be **populated** (not null)

---

## Step 5: Advanced Verification (Optional)

### Check Auth User Data
```sql
SELECT 
  id as user_id,
  email,
  raw_user_meta_data->>'phone' as phone_from_metadata,
  raw_user_meta_data->>'name' as name_from_metadata,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
```

### Check Session Refresh Works
In app, go to **Dashboard** → should show user profile with no errors in console.

### Check Phone Verification Still Works (if implemented)
1. Go to Profile
2. Tap "Verify Phone"
3. Enter code
4. Profile should show `phone_verified = true`

---

## Regression Checklist

After deployment, verify:

- [ ] New signup creates profile with `email` populated
- [ ] New signup creates profile with `phone` populated
- [ ] Old profiles (before fix) NOT modified
- [ ] Phone verification flow still works
- [ ] Session refresh shows user profile
- [ ] Dashboard loads without errors
- [ ] No console warnings or errors

---

## Troubleshooting

### Error: "function handle_new_user does not exist"
→ Run the full migration (Option A above)

### Error: "Relation profiles does not exist"
→ Run all migrations first:
```bash
supabase db reset  # Local only!
```

### Profile Still Has NULL email/phone
1. Check migration ran successfully (look for no red errors)
2. Delete test profiles and try signup again
3. Verify new trigger was applied:
   ```sql
   SELECT pg_get_functiondef('public.handle_new_user()'::regprocedure);
   ```

### Signup Still Failing
1. Check for JS errors in Xcode console (iOS) or logcat (Android)
2. Check Supabase function logs
3. Verify RLS policies on `profiles` table are correct

---

## What's Next?

After verification passes:

1. **Complete SP-001 Testing**: Run Test Case 1 (Wallet Creation) from MANUAL-TEST-SP-001.md
2. **Run All SP Tests**: Execute remaining test cases
3. **SP-002 Implementation**: Start earning flows (starter pack, referrals)
4. **Deployment**: Push to staging, then production

---

## Summary

This fix ensures that **email and phone captured during signup are properly stored in the profiles table**, not left as NULL. This is critical for:
- Account recovery
- Notifications
- Messaging
- Phone verification
- User trust badges

**Impact**: Medium (data integrity) - profiles now accurately reflect signup data
**Risk**: Low (only affects NEW signups, old data unchanged)
**Rollback**: Easy (revert function to previous version)
