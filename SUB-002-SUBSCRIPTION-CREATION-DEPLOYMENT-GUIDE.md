---
title: SUB-002 Subscription Startup Fix - Quick Deploy Guide
date: 2025-02-14
---

# CRITICAL: Deploy Subscription Creation Fix

## What's Fixed
**Issue:** Users signing up don't get subscription records created automatically
**Impact:** PRODUCTION BLOCKING - all new users would have NULL subscription data
**Status:** FIXED with migration

## Quick Deploy (3 Steps)

### Step 1: Apply Migration
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app

# Deploy the migration
supabase db push
```

**Expected output:**
```
Applying migration 20260214000000_add_subscription_creation_to_signup.sql...
✓ Migration applied successfully
```

### Step 2: Verify Migration Worked

Run this in **Supabase SQL Editor**:

```sql
-- VERIFICATION QUERY 1: Check all users have subscriptions
SELECT 
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT s.user_id) as users_with_subscriptions,
  CASE 
    WHEN COUNT(DISTINCT s.user_id) = COUNT(DISTINCT u.id) THEN '✓ ALL USERS COVERED'
    ELSE '✗ SOME USERS MISSING'
  END as status
FROM auth.users u
LEFT JOIN public.subscriptions s ON u.id = s.user_id;

-- EXPECTED RESULT:
-- total_users | users_with_subscriptions | status
-- ------------|--------------------------|-------------------
-- (N)         | (N)                      | ✓ ALL USERS COVERED
```

### Step 3: Test New User Signup

**Command:**
```bash
# Create a new test user via app or signup endpoint
# Note the user ID from the response
# Example: 550e8400-e29b-41d4-a716-446655440000
```

**Verification (run in Supabase SQL Editor):**
```sql
-- VERIFICATION QUERY 2: Check new user has subscription with correct defaults
SELECT 
  status,
  has_used_trial,
  tier_id,
  auto_renew_enabled
FROM public.subscriptions
WHERE user_id = 'USER_ID_FROM_SIGNUP';

-- EXPECTED RESULT:
-- status | has_used_trial | tier_id | auto_renew_enabled
-- -------|----------------|---------|-------------------
-- free   | false          | (null)  | true
```

---

## Validation Checklist

After deployment, confirm:

- [ ] Migration applied without errors
- [ ] Backfill completed (all users have subscriptions)
- [ ] New user signup creates subscription automatically
- [ ] Subscription has correct defaults (free, trial eligible=false, no tier)
- [ ] Manual test TC-SUB002-005 now passes

---

## Testing the Fix

### Test 1: Verify RPC Returns Valid Data

```sql
-- Test: get_subscription_status() for a new user
SELECT * FROM public.get_subscription_status('NEW_USER_ID');

-- SHOULD SEE (not NULL):
-- status: 'free'
-- has_used_trial: false
-- tier_id: null
-- can_earn_sp: false
-- can_spend_sp: false
-- grace_started_at: null
-- grace_ends_at: null
-- etc. (all fields populated, no NULLs)
```

### Test 2: Re-run Manual Test Case TC-SUB002-005

From `SUB-002-MANUAL-TEST-CASES.md`:

**Setup (create fresh test user):**
```sql
-- Create a new user (simulating fresh signup)
INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'test-' || NOW()::text || '@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
) RETURNING id;
-- Note the returned ID
```

**Test:**
```sql
-- Get subscription status
SELECT * FROM public.get_subscription_status('TEST_USER_ID');

-- Expected: has_used_trial = FALSE (not NULL), tier_id = NULL, status = 'free'
```

### Test 3: Run E2E Tests

```bash
cd p2p-kids-marketplace

# Run all subscription tests
yarn test src/__tests__/subscription-sub-002.e2e.ts

# EXPECTED: All 20 tests should PASS
```

---

## Troubleshooting

### Issue: Migration fails with "table subscriptions doesn't exist"
**Solution:** Ensure MODULE-02 migrations have been applied first (subscriptions table must exist)

### Issue: Backfill doesn't run
**Solution:** Migration should auto-run backfill. Check debug_logs:
```sql
SELECT * FROM public.debug_logs 
WHERE process_name = 'handle_new_user migration'
ORDER BY created_at DESC LIMIT 5;
```

### Issue: New users still don't have subscriptions
**Solution:** 
1. Verify trigger is attached: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';`
2. Check debug_logs for errors: `SELECT * FROM public.debug_logs WHERE process_name = 'handle_new_user' ORDER BY created_at DESC LIMIT 10;`

---

## Files Modified/Created

1. **New Migration:**
   - `/supabase/migrations/20260214000000_add_subscription_creation_to_signup.sql`
   - Updates `handle_new_user()` trigger
   - Adds subscription creation for new users
   - Backfills existing users without subscriptions

2. **Documentation:**
   - `/SUB-002-SUBSCRIPTION-CREATION-ON-SIGNUP-FIX.md` (comprehensive analysis)
   - `/SUB-002-SUBSCRIPTION-CREATION-DEPLOYMENT-GUIDE.md` (this file)

3. **No Changes to:**
   - TypeScript service layer (still works correctly)
   - RPC functions (logic unchanged)
   - Test files (still valid, now with proper data)

---

## Post-Deployment Actions

1. ✅ **Immediate:** Run verification queries above
2. ✅ **Same day:** Test new user signup manually  
3. ✅ **Before release:** Re-run all 20 manual test cases
4. ✅ **Before release:** Run E2E test suite
5. ✅ **Document:** Update SUB-002 completion checklist

---

## Next Steps After Fix

- [ ] Deploy migration to staging
- [ ] Run all verification queries
- [ ] Test manual signups on staging
- [ ] Re-run manual test suite TC-SUB002-001 through TC-SUB002-020
- [ ] Confirm all tests pass
- [ ] Close issue / mark SUB-002 as COMPLETE
- [ ] Deploy to production
- [ ] Monitor new user signups in production

---

## Summary

**Before Fix:**
- ❌ New users:not get subscription records
- ❌ Subscription RPCs return NULL
- ❌ Service layer defaults to "free" with error message
- ❌ Manual tests show data anomalies

**After Fix:**
- ✅ New users automatically get subscription records
- ✅ Subscription RPCs return valid data
- ✅ Service layer returns correct subscription status
- ✅ Manual tests pass with clean data
- ✅ Production-ready for release

---
