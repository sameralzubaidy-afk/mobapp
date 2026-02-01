# TC-005 Quick Deploy Checklist

## STEP 1: Update Mobile App (✅ DONE - Local Changes Only)

```bash
cd p2p-kids-marketplace

# Verify changes were applied
git diff src/screens/auth/SignupScreen.tsx  # Should show validateReferralCode() added
git diff src/services/auth.ts              # Should show error handling updated

# Rebuild app
yarn typecheck   # Should pass with no errors
yarn lint        # Should pass with no errors
yarn build:ios   # or build:android for Android
```

**Changes Made:**
- ✅ Added `validateReferralCode()` to SignupScreen.tsx (lines 103-117)
- ✅ Added referral validation to `validateForm()` (lines 152-154)
- ✅ Updated error display in SignupScreen.tsx (lines 245-251)
- ✅ Updated RPC error handling in auth.ts (lines 50-83)

---

## STEP 2: Deploy Database RPC (🔴 MANUAL REQUIRED - You Must Run This)

**Copy and run in Supabase SQL Editor:**

File: `TC-005-FIX-REFERRAL-CODE-VALIDATION.sql`

```bash
# Option 1: Copy from file and paste in SQL Editor (recommended for production)
cat TC-005-FIX-REFERRAL-CODE-VALIDATION.sql | pbcopy
# Then paste in Supabase SQL Editor and click "Run"

# Option 2: Direct SQL execution (if available)
supabase db push  # If using Supabase CLI
```

**Expected Output:**
```
✅ CREATE OR REPLACE FUNCTION
✅ Function apply_referral_code(...) created successfully
```

---

## STEP 3: Verify Database Changes

Run verification queries in Supabase SQL Editor:

```sql
-- Check RPC exists
SELECT proname 
FROM pg_proc 
WHERE proname = 'apply_referral_code'
AND pg_get_functiondef(oid) LIKE '%RETURNS JSONB%';
-- Expected: 1 row

-- Check debug_logs table exists
SELECT tablename FROM pg_tables WHERE tablename = 'debug_logs';
-- Expected: 1 row (debug_logs)
```

---

## STEP 4: Test Invalid Codes (Manual in Simulator)

### Test 1: Too Short Code
```
1. Open app and navigate to Signup
2. Fill in: Name, Email, Phone, DOB, Password
3. Referral Code: "abc"
4. Tap "Create Account"

✅ Expected: Error message: "Referral code must be exactly 8 characters"
✅ Expected: User stays on signup screen (doesn't proceed)
```

### Test 2: Special Characters
```
1. Open app and navigate to Signup
2. Fill in: Name, Email, Phone, DOB, Password
3. Referral Code: "abc@123x"
4. Tap "Create Account"

✅ Expected: Error message: "Referral code must contain only letters and numbers"
✅ Expected: User stays on signup screen
```

### Test 3: Non-Existent Code
```
1. Open app and navigate to Signup
2. Fill in: Name, Email, Phone, DOB, Password
3. Referral Code: "notexist"  (8 chars, valid format, but doesn't exist)
4. Tap "Create Account"

✅ Expected: Signup proceeds but shows error after profile creation:
           "The referral code you entered is invalid..."
✅ Expected: User still completes signup and sees phone verification
✅ Expected: User account is created successfully
✅ Expected: No referral link created (referral_code and referred_by are NULL)
```

### Test 4: Valid Code
```
1. Get referral code from existing user profile
2. Open app and navigate to Signup
3. Fill in all fields correctly
4. Referral Code: [paste valid code]
5. Tap "Create Account"

✅ Expected: Signup completes successfully
✅ Expected: New user navigates to phone verification
✅ Expected: New user's referred_by field is set
```

### Test 5: Empty Code (Optional)
```
1. Open app and navigate to Signup
2. Fill in all fields correctly
3. Referral Code: [leave blank]
4. Tap "Create Account"

✅ Expected: Signup completes successfully
✅ Expected: No error shown (referral field is optional)
✅ Expected: New user has their own referral code generated
```

---

## STEP 5: Check Database Logs

After running tests, query the debug_logs table:

```sql
SELECT log_time, process_name, message, payload
FROM public.debug_logs
WHERE process_name = 'apply_referral_code'
ORDER BY log_time DESC
LIMIT 30;
```

**Expected to see:**
```
Test 1 (too short):     "Invalid code: wrong length" (length: 3)
Test 2 (special chars): "Invalid code: bad characters"
Test 3 (not exists):    "Invalid code: code not found in database"
Test 4 (valid code):    "Success"
Test 5 (empty):         No log entry (field was skipped)
```

---

## STEP 6: Regression Testing

Run existing smoke tests to ensure nothing broke:

```bash
cd p2p-kids-marketplace

# Run auth tests
yarn test -- auth.test.ts

# Run signup tests
yarn test -- SignupScreen.test.tsx

# Run referral tests
yarn test -- referral.test.ts
```

**Expected:** All tests pass

---

## Quick Troubleshooting

### Problem: Error message shows generic message instead of specific reason

**Cause:** RPC error not being returned properly

**Fix:**
1. Check `debug_logs` table to see what error the RPC returned
2. Re-run `TC-005-FIX-REFERRAL-CODE-VALIDATION.sql` to update RPC
3. Verify RPC definition: `SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'apply_referral_code'`

### Problem: User sees "Referral code must be exactly 8 characters" on frontend but can still submit

**Cause:** Frontend validation not applied

**Fix:**
1. Verify SignupScreen.tsx has `validateReferralCode()` function
2. Verify `validateForm()` calls it
3. Rebuild app: `yarn build:ios`
4. Clear app cache and reinstall

### Problem: Code passes frontend validation but signup still fails

**Cause:** Code format valid but doesn't exist in system

**This is expected behavior.** Database RPC validates code exists. User should see:
`"The referral code you entered is invalid. Please check the code and try again."`

---

## Files Changed

- ✅ `p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx` (Added validation, error display)
- ✅ `p2p-kids-marketplace/src/services/auth.ts` (Updated error handling)
- 🔴 `supabase/migrations/[NEW]_apply_referral_code_validation.sql` (Run manually)
- ✅ `TC-005-FIX-REFERRAL-CODE-VALIDATION.sql` (Generated for manual run)
- ✅ `TC-005-FIX-GUIDE.md` (This file)

---

## Rollback Plan

If something goes wrong:

```bash
# Revert mobile app
git checkout p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx
git checkout p2p-kids-marketplace/src/services/auth.ts
yarn build:ios

# Revert database (run this SQL in Supabase)
-- See TC-005-FIX-GUIDE.md "Rollback Instructions" section
```

---

## Success Criteria ✅

After deploying this fix, TC-005 is considered PASS when:

- [ ] Invalid code (too short) → shows error, user stays on signup
- [ ] Invalid code (special chars) → shows error, user stays on signup  
- [ ] Invalid code (not exists) → shows error, user stays on signup
- [ ] Valid code → signup succeeds, user navigates to phone verification
- [ ] Empty code → signup succeeds, field is optional
- [ ] All test cases from REFERRALS-V2-MANUAL-TESTING-GUIDE.md pass

---

**Deployment Date:** January 29, 2026
**Version:** 1.0
**Status:** Ready for Deployment
**Estimated Time to Deploy:** 15-20 minutes (including testing)
