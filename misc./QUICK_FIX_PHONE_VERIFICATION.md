# Quick Fix Guide - Phone Verification & Email Issues

## 🔴 TL;DR - Copy & Paste These SQL Queries

### 1️⃣ See All Users with Emails (Join profiles + auth.users)

```sql
SELECT 
  p.user_id,
  p.name,
  p.phone_verified,
  p.phone_verified_at,
  au.email,
  au.phone,
  p.created_at
FROM profiles p
JOIN auth.users au ON au.id = p.user_id
ORDER BY p.created_at DESC;
```

### 2️⃣ Check Phone Verification Codes Sent

```sql
SELECT 
  pvc.user_id,
  p.name,
  au.email,
  pvc.phone,
  pvc.code,
  pvc.verified AS code_verified,
  p.phone_verified AS profile_phone_verified,
  pvc.attempts,
  pvc.expires_at,
  pvc.created_at
FROM phone_verification_codes pvc
JOIN profiles p ON p.user_id = pvc.user_id
JOIN auth.users au ON au.id = pvc.user_id
ORDER BY pvc.created_at DESC
LIMIT 10;
```

### 3️⃣ Manually Mark Phone as Verified (Emergency Fix)

```sql
-- Step 1: Get the user_id from query #1 above
-- Step 2: Replace 'USER_ID_HERE' with actual user_id
UPDATE profiles
SET 
  phone_verified = true,
  phone_verified_at = NOW()
WHERE user_id = 'USER_ID_HERE';
```

Example:
```sql
UPDATE profiles
SET 
  phone_verified = true,
  phone_verified_at = NOW()
WHERE user_id = '91064993-9abf-4b07-a8bc-043541a1d62f';
```

---

## 🟢 Permanent Fix - Apply Migration

### Step 1: Apply the Migration

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
-- Copy and paste the entire content of:
-- supabase/migrations/20241214000003_fix_phone_verification_and_add_profiles_view.sql
```

This migration creates:
1. ✅ Better RLS policies for phone verification updates
2. ✅ `profiles_with_auth` view that shows emails alongside profile data
3. ✅ Helper function `check_phone_verification_status(user_id)`

### Step 2: Verify Migration Applied

```sql
-- Check if the view exists
SELECT * FROM profiles_with_auth LIMIT 5;
```

If you see results with `email` column, migration is successful! 🎉

### Step 3: Use the Helper Function

```sql
-- Check any user's phone verification status
SELECT * FROM check_phone_verification_status('USER_ID_HERE');
```

---

## 🔍 Why This Happened

### Issue 1: `phone_verified` Not Updating

**The code was correct**, but the update might have failed silently due to:
- RLS policy restrictions (user must own the profile to update it)
- The Supabase client not having the correct auth context
- Silent failure (no error thrown, but update returned 0 rows)

**The fix**: 
- Added `.select()` to the update query to return updated rows
- Added detailed logging to catch silent failures
- Created migration with better RLS policies

### Issue 2: Emails Not in `profiles` Table

**This is by design in Supabase architecture:**

- `auth.users` table → managed by Supabase Auth (email, password hash, phone)
- `profiles` table → your custom user profile data (name, bio, avatar, etc.)

**The fix**:
- Created `profiles_with_auth` VIEW that joins both tables
- Now you can query one place and see both profile + email data

---

## 📋 Testing Checklist

After applying the migration:

- [ ] Run Query #1 to see all users with emails
- [ ] Create a new test account and verify phone with code `123456`
- [ ] Check app logs for new detailed messages:
  - `🧪 [TEST MODE] Attempting to update profile for user_id: ...`
  - `✅ [TEST MODE] Profile updated successfully: ...`
  - OR `⚠️ [TEST MODE] Update succeeded but no rows returned...`
- [ ] Run Query #1 again to verify `phone_verified = true` for the new user
- [ ] Query the new view: `SELECT * FROM profiles_with_auth WHERE email = 'your-test-email@gmail.com'`

---

## 🚀 Next Steps

1. **Apply migration** (copy/paste SQL from `supabase/migrations/20241214000003_fix_phone_verification_and_add_profiles_view.sql`)
2. **Test with new signup** using code `123456`
3. **Check logs** for detailed error messages
4. **If still failing**: Run the manual fix (Query #3)
5. **Report back** with results from Query #2 (phone verification codes)

---

## 📞 Getting Help

If the issue persists after applying the migration:

1. Share results from **Query #2** (shows verification codes + profile status)
2. Share **app logs** from the verification attempt
3. Check if you see the new log messages:
   - `🧪 [TEST MODE] Attempting to update profile...`
   - `✅ [TEST MODE] Profile updated successfully...`
   - `⚠️ [TEST MODE] Update succeeded but no rows returned...`

The new logging will tell us exactly where the update is failing.
