# Phone Verification & Email Issues - Diagnosis & Fix

## Issues Found

### Issue 1: `phone_verified` not updating to `true`
**Root Cause**: The verification code works correctly, but there may be an RLS policy conflict or the update is failing silently.

From the logs, we can see the test code `123456` was used:
```
LOG  🧪 [TEST MODE] Using hardcoded test code 123456
```

The code at [src/services/verification.ts](src/services/verification.ts#L104-L110) should update `profiles.phone_verified`, but the RLS policy requires `auth.uid() = user_id`.

### Issue 2: Emails not visible in `profiles` table
**Root Cause**: This is **by design** in Supabase architecture.

- **Emails are stored in**: `auth.users` table (managed by Supabase Auth)
- **Profile data is stored in**: `profiles` table (your custom table)
- The `profiles` table has `user_id` that references `auth.users.id`

---

## Quick Diagnostic Steps

### Step 1: Check if phone verification update failed

Run this SQL in Supabase Dashboard → SQL Editor:

```sql
-- Check profiles for your test user
SELECT 
  p.user_id,
  p.name,
  p.phone_verified,
  p.phone_verified_at,
  p.created_at,
  au.email,  -- Get email from auth.users
  au.phone
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
ORDER BY p.created_at DESC
LIMIT 10;
```

This will show you:
- ✅ Profile data (name, phone_verified status)
- ✅ Email from auth.users
- ✅ When the profile was created

### Step 2: Check phone verification codes sent

```sql
-- Check verification codes sent
SELECT 
  pvc.user_id,
  pvc.phone,
  pvc.code,
  pvc.verified,
  pvc.attempts,
  pvc.expires_at,
  pvc.created_at,
  p.name,
  p.phone_verified AS profile_phone_verified
FROM phone_verification_codes pvc
JOIN profiles p ON p.user_id = pvc.user_id
ORDER BY pvc.created_at DESC
LIMIT 10;
```

This will show you:
- ✅ Verification codes sent
- ✅ Whether code was marked as verified in `phone_verification_codes` table
- ✅ Whether profile was updated with `phone_verified = true`

---

## Fix 1: Update RLS Policy to Allow Service Role Updates

The current RLS policy only allows users to update their **own** profile when authenticated. However, when using the test code `123456`, the Supabase client is authenticated as the user, so it should work.

If it's still failing, add a policy to allow service role to update profiles:

```sql
-- Allow service role (backend) to update any profile
DROP POLICY IF EXISTS "Service role can update profiles" ON profiles;
CREATE POLICY "Service role can update profiles"
  ON profiles FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

⚠️ **Note**: This policy is permissive because it trusts the service role key. Make sure your `SUPABASE_SERVICE_ROLE_KEY` is kept secret and never exposed in client code.

---

## Fix 2: Manual Database Update (Quick Fix)

If you need to manually mark a user's phone as verified:

```sql
-- Replace 'USER_ID_HERE' with the actual user_id from Step 1
UPDATE profiles
SET 
  phone_verified = true,
  phone_verified_at = NOW()
WHERE user_id = 'USER_ID_HERE';
```

You can get the `user_id` from the diagnostic query in Step 1.

---

## Fix 3: Add Email Column to Profiles Table (Optional)

If you want to see emails directly in the `profiles` table without joining, you can add an `email` column:

```sql
-- Add email column to profiles (denormalized for convenience)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Backfill existing profiles with emails from auth.users
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.user_id = au.id
AND p.email IS NULL;
```

Then update your signup code to also store the email in profiles:

```typescript
// In src/services/supabase/auth.ts, after creating the profile
const { error: profileError } = await supabase
  .from('profiles')
  .insert({
    user_id: authData.user.id,
    name: data.name,
    email: data.email,  // ← Add this line
    phone_verified: false,
  });
```

---

## Fix 4: Create a Convenient View (Recommended)

Instead of denormalizing, create a database view that joins profiles with auth data:

```sql
-- Create a view that combines profiles with auth.users
CREATE OR REPLACE VIEW profiles_with_auth AS
SELECT 
  p.id,
  p.user_id,
  p.name,
  p.avatar_url,
  p.bio,
  p.city,
  p.state,
  p.zip_code,
  p.node_id,
  p.profile_completed,
  p.onboarding_completed,
  p.phone_verified,
  p.phone_verified_at,
  p.referral_code,
  p.created_at,
  p.updated_at,
  -- Auth data
  au.email,
  au.phone,
  au.email_confirmed_at,
  au.last_sign_in_at
FROM profiles p
LEFT JOIN auth.users au ON au.id = p.user_id;

-- Grant access to authenticated users
GRANT SELECT ON profiles_with_auth TO authenticated;
GRANT SELECT ON profiles_with_auth TO anon;
```

Now you can query:
```sql
SELECT * FROM profiles_with_auth WHERE name = 'Samer2';
```

And you'll see both profile data AND email in one query.

---

## Testing Steps

After applying the fixes:

### 1. Test with existing user

```sql
-- Check if your test user's phone is verified
SELECT 
  p.name,
  p.phone_verified,
  au.email
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
WHERE au.email = 'your-test-email@gmail.com';
```

### 2. Test phone verification flow

1. **Sign up with a new test account**
2. **Enter test code**: `123456`
3. **Check database immediately**:

```sql
SELECT 
  p.name,
  p.phone_verified,
  p.phone_verified_at,
  au.email
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
ORDER BY p.created_at DESC
LIMIT 1;
```

Expected result:
```
name       | phone_verified | phone_verified_at           | email
-----------|----------------|-----------------------------|-----------------
Test User  | true           | 2024-12-14 10:30:00.000000  | test@gmail.com
```

### 3. Check app logs

Look for these log messages:
```
✅ Phone verified for user: [user-id]
```

or

```
❌ Update profile error: [error message]
```

If you see the error message, that's the issue - apply Fix 1 (RLS policy).

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| `phone_verified` not updating | RLS policy may be blocking update OR update is silently failing | Run diagnostic SQL, add service role policy if needed |
| Emails not in `profiles` table | By design: emails are in `auth.users` table | Create view `profiles_with_auth` or add `email` column to profiles |

---

## Next Steps

1. **Run Step 1 diagnostic SQL** to see current state
2. **Run Step 2 diagnostic SQL** to check verification codes
3. **If phone_verified is false**, apply Fix 1 (RLS policy)
4. **If you want emails in profiles**, choose either:
   - Fix 3: Add `email` column (denormalized)
   - Fix 4: Create `profiles_with_auth` view (normalized, recommended)
5. **Test with a new signup** to verify fixes work

---

## Copy-Paste Commands

### See all user data (profiles + emails):
```sql
SELECT 
  p.user_id,
  p.name,
  p.phone_verified,
  p.phone_verified_at,
  au.email,
  au.phone,
  au.created_at AS signup_date
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
ORDER BY p.created_at DESC;
```

### Manually verify a user's phone:
```sql
-- Get user_id first from the query above, then:
UPDATE profiles
SET 
  phone_verified = true,
  phone_verified_at = NOW()
WHERE user_id = 'PASTE_USER_ID_HERE';
```

### Check if phone verification update is working:
```sql
-- Check Supabase logs for errors
SELECT * FROM postgres_logs 
WHERE message LIKE '%profiles%' 
ORDER BY timestamp DESC 
LIMIT 20;
```
