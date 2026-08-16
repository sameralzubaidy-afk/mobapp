# REFERRAL SYSTEM ROOT CAUSE ANALYSIS + FIX PLAN
**Date:** January 29, 2026  
**Issue:** New user signup not generating referral codes or establishing referral relationships

---

## 🔴 PROBLEM SUMMARY

**New User:** 1984alice.test@example.com  
**User ID:** `8c1bdafe-4ea9-4ab0-8d0d-7da709f2c3c3`  
**Profile ID:** `f74b0b3d-cbb4-42ed-8bc4-15080a6ad75a`  
**Used Referral Code:** `fd02fba0` (User 2's code)

**Issues:**
1. ✗ `referral_code: null` (should have 8-char code generated)
2. ✗ `referred_by: null` (should be User 2's `user_id`)
3. ✗ No row in `referrals` table (relationship not created)
4. ✗ User 2's dashboard shows 1 referral instead of 2

---

## 🔍 ROOT CAUSE ANALYSIS

### Issue 1: Referral Code Not Generated

**Expected Flow:**
1. User signs up → `auth.users` INSERT trigger fires
2. `handle_new_user()` function creates profile + referral code
3. `create_referral_code(p_user_id)` RPC inserts into `referral_codes` table
4. `profiles.referral_code` gets synced to match

**What's Broken:**
- **Legacy trigger conflict:** `create_referral_code_trigger` on `auth.users` may still exist and is SILENTLY FAILING
- **Legacy profiles trigger:** `trigger_generate_referral_code_on_profile_creation` on `profiles` generates UPPERCASE codes, conflicting with `handle_new_user()`'s lowercase codes
- **Result:** Signup succeeds but referral code is never created OR is mismatched

**Evidence:**
- User 2 had `BC998522` in `profiles.referral_code` but `6f538e4f` in `referral_codes.code` (dual trigger issue)
- New user has `null` in both places (trigger not running at all)

### Issue 2: Referral Relationship Not Created

**Expected Flow:**
1. `SignupScreen.tsx` passes `referralCode` to `signupWithTrial()`
2. `auth.ts` calls `ReferralCodeServiceV2.applyReferralCode(userId, referralCode)`
3. `apply_referral_code()` RPC:
   - Validates code exists
   - Prevents self-referral
   - Inserts row into `referrals` table
   - Updates `profiles.referred_by`

**What's Broken:**
- **RPC has critical bug:** `apply_referral_code()` inserts `auth.users.id` into `referrer_id`/`referee_id` columns
- **FK violation:** Those columns expect `profiles.id`, causing silent INSERT failure
- **Bug location:** Lines 53-64 of RPC function:
  ```sql
  INSERT INTO public.referrals (
    referrer_id,    -- Expects profiles.id
    referee_id,     -- Expects profiles.id
    ...
  ) VALUES (
    v_referrer_id,  -- ❌ BUG: This is auth.users.id
    p_referee_id,   -- ❌ BUG: This is auth.users.id
    ...
  );
  ```
- **Error is caught and logged:** `auth.ts` line 141-147 has `try/catch` that swallows the error with only `console.warn`
- **Result:** Signup succeeds but referral relationship is never created

**Evidence:**
- No rows in `referrals` table for new user
- `profiles.referred_by` is NULL
- RPC function confirmed via diagnostic query to have the bug
- Console logs would show "Referral code application failed" but signup doesn't fail

---

## 🔧 FIX PLAN

### Phase 1: Diagnostic (✅ COMPLETED)

Ran `REFERRAL_DIAGNOSTIC_20260129.sql` and confirmed:
1. ✅ `apply_referral_code()` RPC has critical bug (uses `auth.users.id` instead of `profiles.id`)
2. ⏳ Still need to check triggers on `auth.users` and `profiles`
3. ⏳ Still need to check `handle_new_user()` function definition
4. ⏳ Still need to verify new user's current state

**Next:** Run remaining diagnostic queries (DIAGNOSTIC 2-8)

### Phase 2: Database Fixes (IMMEDIATE - IN THIS ORDER)

**STEP 1 (CRITICAL):** Fix the RPC function FIRST
Run `FIX_APPLY_REFERRAL_CODE_RPC.sql` to:
- Update `apply_referral_code()` to query `profiles.id` before inserting
- Add proper error handling with exception block
- Test the fix immediately with new user's data

**STEP 2:** Fix New User (After RPC is fixed)
Run `FIX_NEW_USER_REFERRAL_20260129.sql` to:
- Generate referral code for new user
- Create referral relationship with User 2 (will now work with fixed RPC)
- Update `profiles.referred_by`
- Verify all 5 checks pass

**STEP 3 (OPTIONAL):** Fix Entire System
Run `FIX_REFERRAL_ISSUES_20260129.sql` to:
- Drop ALL legacy triggers (both `auth.users` and `profiles`)
- Sync all code mismatches
- Repair FK constraints
- Backfill all missing `referred_by` values
- Fix User 2 + any other broken referrals

**Recommendation:** 
1. Run STEP 1 immediately (fixes root cause)
2. Run STEP 2 to fix new user
3. Run STEP 3 to clean up all historical issues

### Phase 3: Code Fixes (LONG-TERM)

**Fix 1: Update `handle_new_user()` trigger**
Location: `supabase/migrations/` (find the migration that creates `handle_new_user`)

Ensure it:
- Creates referral code via `create_referral_code(NEW.id)`
- Uses `BEGIN...EXCEPTION...END` block so it never blocks signup
- Logs warnings but never throws errors

**Fix 2: Update `apply_referral_code()` RPC**
Location: `SQL_TO_RUN_IN_SUPABASE.sql` (line 250+) or via migration

Ensure it:
- Handles both old columns (`referrer_id`, `referee_id`) + new columns (`referrer_user_id`, `referred_user_id`)
- Uses correct FK targets (`profiles.id` not `users.id`)
- Updates `profiles.referred_by` AFTER inserting into `referrals`
- Returns detailed error messages

**Fix 3: Improve error handling in `auth.ts`**
Location: `p2p-kids-marketplace/src/services/auth.ts` (line 136-148)

Current code:
```typescript
if (!result.success && result.error !== 'Referral code already applied') {
  console.warn('Referral code application failed:', result.error);
  // Don't fail signup, just log the warning
}
```

**Improved code:**
```typescript
if (!result.success) {
  if (result.error === 'Referral code already applied') {
    console.log('Referral code already applied, continuing signup');
  } else if (result.error === 'Invalid referral code') {
    // Show alert to user but continue signup
    console.error('Invalid referral code entered:', referralCode);
    // TODO: Show in-app notification about invalid code
  } else {
    // Log detailed error for debugging
    console.error('Referral code application failed:', {
      userId,
      referralCode,
      error: result.error,
      timestamp: new Date().toISOString(),
    });
    // TODO: Send to Sentry/error tracking
  }
} else {
  console.log('Referral code applied successfully:', {
    userId,
    referralCode,
    timestamp: new Date().toISOString(),
  });
}
```

### Phase 4: Verification (REQUIRED)

After fixes, verify:

**Database Checks:**
1. Run verification queries from `FIX_NEW_USER_REFERRAL_20260129.sql`
2. Confirm all 5 checks show ✓ status
3. Query User 2's referral dashboard: should show 2 total referrals

**App Checks:**
1. Login as User 2 → Referral Dashboard → Should show "2 Total Referrals"
2. Login as new user → Profile → Should see their 8-char referral code
3. Create another test user with new user's code → Verify referral relationship is created correctly

**Signup Flow Test:**
1. Create another brand new user with User 2's code `fd02fba0`
2. Check immediately after signup:
   - `referral_codes` table has new entry
   - `referrals` table has new relationship
   - `profiles.referred_by` is populated
   - User 2's dashboard increments to 3 referrals
3. If any check fails, review diagnostic output + console logs

---

## 📋 EXECUTION CHECKLIST

- [ ] **Step 1:** Run `REFERRAL_DIAGNOSTIC_20260129.sql` → Paste output
- [ ] **Step 2:** Review diagnostic output to confirm root causes
- [ ] **Step 3:** Run `FIX_REFERRAL_ISSUES_20260129.sql` (entire system fix)
- [ ] **Step 4:** Run verification queries → Confirm all ✓
- [ ] **Step 5:** Test in app: User 2 dashboard shows 2 referrals
- [ ] **Step 6:** Test new signup with referral code → Verify referral created
- [ ] **Step 7:** Update `handle_new_user()` to add explicit referral code creation
- [ ] **Step 8:** Improve error logging in `auth.ts` for referral failures
- [ ] **Step 9:** Deploy migration with trigger/RPC fixes
- [ ] **Step 10:** Monitor next 10 signups to ensure no failures

---

## 🚨 CRITICAL NOTES

1. **Don't skip diagnostics:** Running fixes blindly may not work if schema differs from assumptions
2. **FK constraints:** The `referrals` table has BOTH old and new column sets with FK constraints that may point to wrong tables
3. **Silent failures:** Current code swallows referral errors, so you won't see signup failures even when referrals break
4. **Legacy triggers:** Multiple triggers on `auth.users` and `profiles` can conflict; MUST drop old ones before adding new ones
5. **Supabase vs Local:** These fixes are for production Supabase; local dev may have different schema state

---

## 📞 NEXT STEPS

**IMMEDIATE (Do Now):**
1. Run diagnostic SQL and paste output
2. Run fix SQL (entire system)
3. Verify fixes in database + app

**SHORT-TERM (This Week):**
1. Update `handle_new_user()` trigger with explicit referral code creation
2. Update `apply_referral_code()` RPC to handle dual column sets
3. Improve error logging in `auth.ts`
4. Deploy migration with fixes
5. Test 5+ new signups with referral codes

**LONG-TERM (Next Sprint):**
1. Add E2E test for referral signup flow
2. Add monitoring/alerts for referral creation failures
3. Add admin dashboard to view/debug referral issues
4. Consider moving referral logic to Edge Function instead of RPC
5. Add referral code validation UI (check if code is valid before submitting)

---

## 🔗 RELATED FILES

**Diagnostic:** `REFERRAL_DIAGNOSTIC_20260129.sql`  
**Quick Fix:** `FIX_NEW_USER_REFERRAL_20260129.sql`  
**System Fix:** `FIX_REFERRAL_ISSUES_20260129.sql`  
**RPC Update:** `UPDATE_APPLY_REFERRAL_RPC.sql`  
**Module Spec:** `Prompts/MODULE-11-REFERRALS-V2.md`  
**Auth Service:** `p2p-kids-marketplace/src/services/auth.ts`  
**Referral Service:** `p2p-kids-marketplace/src/services/referralCodeV2.ts`  
**Signup Screen:** `p2p-kids-marketplace/src/screens/auth/SignupScreen.tsx`
