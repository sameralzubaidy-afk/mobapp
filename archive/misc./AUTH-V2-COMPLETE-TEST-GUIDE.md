# AUTH-V2-003 Signup & Session Refresh: Complete Test Guide

## Issues Fixed

### ✅ Issue 1: "Database error saving new user"
**Status**: FIXED  
**File**: `supabase/migrations/20241214000001_add_profile_creation_trigger.sql`  
**Change**: Added exception handling to `handle_new_user()` trigger so it logs warnings instead of failing auth

### ✅ Issue 2: "Session refresh failed: Cannot read property 'status' of undefined"
**Status**: FIXED  
**File**: `p2p-kids-marketplace/src/contexts/AuthContext.tsx`  
**Change**: Added defensive array handling for RPC responses (check array length before accessing [0])

---

## Complete Test Flow

### Part 1: Registration

```
1. Launch app in simulator
2. Tap "Sign Up"
3. Fill form:
   - Name: "Test User"
   - Email: test-sp-DATE@test.com (use unique email)
   - Phone: +12025551234
   - DOB: 2000-01-15
   - Password: TestPass123
4. Tap "Sign Up"
```

**Expected**:
- ✅ No "Database error saving new user" error
- ✅ Navigates to PhoneVerification screen
- ✅ Logs show: `✅ SIGNUP_COMPLETED` or similar

**Database Verification**:
```sql
SELECT user_id, email, name FROM auth.users WHERE email = 'test-sp-DATE@test.com';
SELECT user_id, name, phone_verified FROM profiles WHERE name = 'Test User';
SELECT user_id, status FROM subscriptions WHERE user_id = '<NEW_USER_ID>';
-- Expected: user exists in auth.users, profile exists with name, subscription status='free'
```

---

### Part 2: Profile Completion

```
1. (PhoneVerification screen - skip if optional)
2. Tap "Continue" or "Skip"
3. Fill ProfileCompletionScreen:
   - City: "New York"
   - State: "NY"
   - Zip: "10001"
4. Tap "Save Profile"
```

**Expected**:
- ✅ No errors
- ✅ Navigates to SubscriptionChoiceScreen

---

### Part 3: Free Tier Selection

```
1. On SubscriptionChoiceScreen, tap "Free Tier"
2. Scroll down and tap "Get Started"
```

**Expected**:
- ✅ **NO ERROR** "Cannot read property 'status' of undefined"
- ✅ Navigates to FeatureHighlights screen
- ✅ Console logs show: `[AUTH] Session refreshed: { ... subscription_status: "free" ... }`

**Database Verification**:
```sql
SELECT user_id, profile_completed, onboarding_completed_at FROM profiles WHERE user_id = '<NEW_USER_ID>';
-- Expected: profile_completed = true, onboarding_completed_at has timestamp
```

---

### Part 4: Trial Tier Selection (Optional - Advanced Test)

```
1. Go back / restart
2. Register new user
3. Complete profile
4. On SubscriptionChoiceScreen, tap "Kids Club+"
5. Tap "Get Started" on the trial alert
```

**Expected**:
- ✅ Alert shows "Welcome to Kids Club+! Your 30-day free trial has been activated"
- ✅ Navigates to FeatureHighlights
- ✅ Console shows successful trial enrollment

**Database Verification**:
```sql
SELECT user_id, status, trial_start_date, trial_end_date 
FROM subscriptions 
WHERE user_id = '<TRIAL_USER_ID>';
-- Expected: status = 'trial', trial_end_date is 30 days from now
```

---

## Console Logs to Expect

### Successful Free Tier Flow:
```
[AUTH] AuthProvider render
[AUTH] Session refreshed: {
  user_id: "xxx-xxx-xxx",
  onboarding_completed: true,
  subscription_status: "free",
  available_points: 0
}
```

### If Subscription Not Found (Before Fix):
```
[AUTH] No subscription found for user, defaulting to free
[AUTH] Session refreshed: {
  user_id: "xxx-xxx-xxx",
  subscription_status: "free"
}
```

### Successful Trial Flow:
```
🎯 SUBSCRIPTION FLOW: User chose TRIAL tier
✅ SUBSCRIPTION FLOW: Successfully upgraded to trial
[AUTH] Session refreshed: {
  user_id: "xxx-xxx-xxx",
  subscription_status: "trial"
}
```

---

## Troubleshooting

### Issue: Still getting "Cannot read property 'status' of undefined"
**Diagnosis**:
1. Check console for exact line number
2. Verify AuthContext.tsx has the fix (lines 207-252)
3. Clear Metro cache: `npm start -- --clear`

### Issue: Subscription not created during signup
**Diagnosis**:
1. Check if `create_free_subscription` RPC was called
2. Run SQL: `SELECT COUNT(*) FROM subscriptions WHERE created_at > NOW() - INTERVAL '5 minutes'`
3. Check Supabase function logs for RPC errors

### Issue: Profile creation fails
**Diagnosis**:
1. Run diagnostic queries from DIAGNOSE-SIGNUP-TRIGGER.sql
2. Verify trigger exists: `SELECT * FROM pg_triggers WHERE tgname = 'on_auth_user_created'`
3. Check RLS policies: `SELECT * FROM pg_policies WHERE tablename = 'profiles'`

---

## Files Changed

1. ✅ `supabase/migrations/20241214000001_add_profile_creation_trigger.sql`
   - Added EXCEPTION handling to prevent cascade failures

2. ✅ `p2p-kids-marketplace/src/contexts/AuthContext.tsx`
   - Lines 207-237: Fixed subscription summary initialization
   - Lines 239-252: Fixed wallet summary initialization

3. ✅ `p2p-kids-marketplace/src/services/auth.ts`
   - Simplified signup to not wait for profile/wallet creation

4. ✅ `DIAGNOSE-SIGNUP-TRIGGER.sql` (new)
   - Created diagnostic SQL queries

5. ✅ `FIX-SIGNUP-TRIGGER-ERROR.md` (new)
   - Documented first fix (profile trigger)

6. ✅ `FIX-SESSION-REFRESH-UNDEFINED-STATUS.md` (new)
   - Documented second fix (session refresh)

---

## Regression Tests

After these fixes, verify:
- [ ] Existing users can still login
- [ ] Existing users' session refresh works
- [ ] Trial subscription upgrades still work
- [ ] Free tier users stay on free tier
- [ ] SP wallet initializes on demand

**Quick Check**:
```typescript
// In any component with auth
const { session } = useAuth();
console.log('Session status:', session?.subscription_status); // Should be 'free', 'trial', or 'active'
```

---

## Next Steps

1. Run the full test flow above (Parts 1-3)
2. Verify database shows correct subscription status
3. Check no error messages in console
4. Navigate to app dashboard - session should be established
5. If all pass, run regression tests

---

## Success Criteria

✅ All three issues fixed:
1. Signup completes without "Database error saving new user"
2. Free tier selection works without "Cannot read property 'status'" error
3. Session is properly established with correct subscription_status

✅ Logs show expected patterns
✅ Database has correct records
✅ App navigates to dashboard after onboarding
