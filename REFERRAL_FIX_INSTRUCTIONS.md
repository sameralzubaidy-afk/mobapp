# Referral System Fix - January 29, 2026

## Issues Found

### Issue 1: referred_by is NULL despite using valid referral code
**Symptoms:**
- User 2 (fd81b7c0-8419-4698-b341-31790afbb554) signed up using User 1's code "fd02fba0"
- But `profiles.referred_by` is NULL
- Referral dashboard shows 0 referrals for User 1

**Root Cause:** 
The `apply_referral_code()` function wasn't called successfully during signup, so no row was created in the `referrals` table.

### Issue 2: Referral code mismatch (screen vs database)
**Symptoms:**
- Screen shows: `6f538e4f` (lowercase)
- Database (`profiles.referral_code`): `BC998522` (uppercase)
- The code shown on screen doesn't exist in your database

**Root Cause:**
Two triggers are fighting:
1. **Legacy trigger** on `profiles` table (BEFORE INSERT) generates **UPPERCASE** codes and writes to `profiles.referral_code`
2. **New trigger** `handle_new_user()` on `auth.users` creates **lowercase** codes in `referral_codes` table

The app reads from `referral_codes` table (showing 6f538e4f) but the database also has BC998522 in `profiles.referral_code`.

---

## The Fix

### What Was Changed (in repo)

1. **Updated migration**: [supabase/migrations/20260129000000_referrals_v2_fix_code_sync_and_referred_by.sql](supabase/migrations/20260129000000_referrals_v2_fix_code_sync_and_referred_by.sql)
   - Now drops the legacy profiles trigger `trigger_generate_referral_code_on_profile_creation`
   
2. **Updated production SQL**: [SQL_TO_RUN_IN_SUPABASE.sql](SQL_TO_RUN_IN_SUPABASE.sql)
   - Added cleanup for the profiles trigger

3. **Created immediate fix**: [FIX_REFERRAL_ISSUES_20260129.sql](FIX_REFERRAL_ISSUES_20260129.sql)
   - Drops both conflicting triggers
   - Syncs all code mismatches
   - Manually creates the missing referral for User 2
   - Backfills all `referred_by` values

---

## What To Run Now (Supabase SQL Editor)

### IMPORTANT: Your Database Has Dual Column Names

Your error shows that the `referrals` table has **BOTH**:
- Old columns: `referrer_id`, `referee_id` (with NOT NULL constraints)
- New columns: `referrer_user_id`, `referred_user_id`

This means some migration added the old columns but they weren't removed when the new ones were added.

### Step 1: Update the RPC Function (REQUIRED FIRST)

Run [UPDATE_APPLY_REFERRAL_RPC.sql](UPDATE_APPLY_REFERRAL_RPC.sql) first to update the `apply_referral_code()` function to populate both old and new columns.

This ensures future signups won't fail with the same error.

### Step 2: Run the Fix

Then run [FIX_REFERRAL_ISSUES_20260129.sql](FIX_REFERRAL_ISSUES_20260129.sql) - it's already been updated to handle both column sets.

### Option A: Quick Fix (recommended)
Run the entire [FIX_REFERRAL_ISSUES_20260129.sql](FIX_REFERRAL_ISSUES_20260129.sql) file.

This will:
- ✅ Drop both legacy triggers
- ✅ Sync User 2's code (BC998522 → 6f538e4f) 
- ✅ Create missing referral row (User 1 → User 2)
- ✅ Set User 2's `referred_by` = User 1's ID
- ✅ Fix all other users with the same issue

### Option B: Step by step
If you prefer to run section by section:

1. **Drop legacy triggers:**
```sql
DROP TRIGGER IF EXISTS trigger_generate_referral_code_on_profile_creation ON public.profiles;
DROP FUNCTION IF EXISTS public.generate_referral_code_on_profile_creation();
DROP FUNCTION IF EXISTS generate_referral_code_on_profile_creation();
```

2. **Sync all code mismatches:**
```sql
UPDATE public.profiles p
SET referral_code = rc.code
FROM public.referral_codes rc
WHERE rc.user_id = p.user_id
  AND (p.referral_code IS NULL OR LOWER(p.referral_code) <> LOWER(rc.code));
```

3. **Create missing referral for User 2:**
```sql
-- NOTE: Your referrals table has BOTH old (referrer_id/referee_id) 
-- AND new (referrer_user_id/referred_user_id) columns.
-- We must populate both to satisfy NOT NULL constraints.
INSERT INTO public.referrals (
  referrer_id, 
  referee_id, 
  referrer_user_id, 
  referred_user_id, 
  referral_code, 
  status
)
VALUES (
  '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid,
  'fd81b7c0-8419-4698-b341-31790afbb554'::uuid,
  '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid,
  'fd81b7c0-8419-4698-b341-31790afbb554'::uuid,
  'fd02fba0',
  'pending'
)
ON CONFLICT DO NOTHING;

UPDATE public.profiles
SET referred_by = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid
WHERE user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid;
```

4. **Backfill all other users:**
```sql
UPDATE public.profiles p
SET referred_by = r.referrer_user_id
FROM public.referrals r
WHERE r.referred_user_id = p.user_id
  AND p.referred_by IS NULL;
```

---

## Verification (after running the fix)

Run these queries to confirm everything is working:

### 1. Check code mismatches (should return 0)
```sql
SELECT COUNT(*) AS code_mismatches
FROM public.profiles p
JOIN public.referral_codes rc ON rc.user_id = p.user_id
WHERE LOWER(p.referral_code) <> LOWER(rc.code);
```

### 2. Check User 2's referral exists
```sql
SELECT 
  r.id,
  r.referral_code,
  r.status,
  p1.name AS referrer_name,
  p2.name AS referred_name,
  p2.referred_by
FROM public.referrals r
JOIN public.profiles p1 ON p1.user_id = r.referrer_user_id
JOIN public.profiles p2 ON p2.user_id = r.referred_user_id
WHERE r.referred_user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid;
```
**Expected:** 1 row showing User 1 referred User 2 with code "fd02fba0"

### 3. Check User 1's referral stats
```sql
SELECT 
  p.name,
  p.referral_code,
  COUNT(r.id) AS total_referrals
FROM public.profiles p
LEFT JOIN public.referrals r ON r.referrer_user_id = p.user_id
WHERE p.user_id = '7e3307dd-01b4-4479-ad97-65eae9090c89'::uuid
GROUP BY p.user_id, p.name, p.referral_code;
```
**Expected:** `total_referrals = 1`

### 4. Check User 2's profile
```sql
SELECT 
  p.name,
  p.referral_code AS profile_code,
  rc.code AS table_code,
  p.referred_by,
  pr.name AS referrer_name
FROM public.profiles p
LEFT JOIN public.referral_codes rc ON rc.user_id = p.user_id
LEFT JOIN public.profiles pr ON pr.user_id = p.referred_by
WHERE p.user_id = 'fd81b7c0-8419-4698-b341-31790afbb554'::uuid;
```
**Expected:**
- `profile_code = table_code = '6f538e4f'` (both lowercase, matching)
- `referred_by` = User 1's UUID
- `referrer_name` = "Tes Case To Singup Woth Code"

---

## Testing in the App

After running the SQL:

1. **Restart the app** to clear any cached data
2. **Login as User 1** (testcasssscharlie.smith@example.com)
3. **Navigate to Referral Dashboard**
4. **Expected results:**
   - Referral code shows: `fd02fba0`
   - Total Referrals: `1`
   - Pending Referrals: `1`
   - Completed: `0`
   - SP Earned: `0` (will become 25 when User 2 completes first trade)
   
5. **Login as User 2** (969bob.demo@example.com)
6. **Check Referral Dashboard**
7. **Expected:**
   - Referral code shows: `6f538e4f` (matching database now)
   - Total Referrals: `0` (User 2 hasn't referred anyone)

---

## Prevention (for future signups)

The fix ensures:
- ✅ Only ONE trigger creates referral codes (`handle_new_user` on `auth.users`)
- ✅ Codes are ALWAYS lowercase
- ✅ `profiles.referral_code` always matches `referral_codes.code`
- ✅ Referrals are applied during signup (via auth metadata)
- ✅ `referred_by` is populated automatically

---

## Files Modified

1. [FIX_REFERRAL_ISSUES_20260129.sql](FIX_REFERRAL_ISSUES_20260129.sql) - **← RUN THIS NOW**
2. [supabase/migrations/20260129000000_referrals_v2_fix_code_sync_and_referred_by.sql](supabase/migrations/20260129000000_referrals_v2_fix_code_sync_and_referred_by.sql) - Updated (now drops profiles trigger)
3. [SQL_TO_RUN_IN_SUPABASE.sql](SQL_TO_RUN_IN_SUPABASE.sql) - Updated (now drops profiles trigger)

---

## Need Help?

If after running the fix:
- User 1's dashboard still shows 0 referrals → Check that the app is reading from the correct user ID
- User 2's code still mismatches → Restart the app to clear cache
- New signups still have issues → Check Supabase logs for trigger errors
