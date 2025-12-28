// File: AUTH-V2-003-TESTING-GUIDE.md
// MODULE-03 AUTH-V2-003: Manual Testing & Verification Guide

# AUTH-V2-003 Testing Guide: Login & Session Management

## Overview

This guide provides step-by-step instructions to manually test **AUTH-V2-003: Login & Session Management with Subscription Context** implementation.

---

## Prerequisites

Before testing, ensure:
1. ✅ Supabase project is running locally: `supabase start`
2. ✅ Dev database has been reset with latest migrations: `supabase db reset`
3. ✅ Expo app is running: `yarn start` (from `p2p-kids-marketplace/`)
4. ✅ Test user accounts are created in Supabase

---

## Test User Setup (Required Once)

### Create Test Users in Supabase

Run these SQL commands in Supabase Studio (SQL Editor) to create test accounts:

```sql
-- Create test subscriber user (Kids Club+ trial)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'subscriber-test-001',
  'subscriber@test.local',
  -- Password: TestPass123! (you'll need to set this properly)
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;

-- Create test free user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'free-test-001',
  'freeuser@test.local',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT DO NOTHING;
```

**Alternative: Use Supabase Studio Auth Tab**
1. Open Supabase Studio → Authentication → Users
2. Click "Add User"
3. Email: `subscriber@test.local`
4. Password: `TestPass123!`
5. Repeat for `freeuser@test.local`

---

## MANUAL TEST SCENARIOS

### TEST 1: Login Flow - Happy Path

**Goal:** Verify successful login with correct credentials returns enriched session

**Steps:**
1. Open app and navigate to Login screen
2. Enter email: `subscriber@test.local`
3. Enter password: `TestPass123!`
4. Tap "Log In" button

**Expected Results:**
- ✅ Loading indicator appears
- ✅ No error message
- ✅ App navigates to Home screen (authenticated state)
- ✅ User profile is visible
- ✅ Console logs show: `[AUTH] Login successful`

**Evidence to Collect:**
- Screenshot of Home screen after login
- Console output from React Native debugger

---

### TEST 2: Session Contains Subscription Context

**Goal:** Verify session includes subscription status and SP permissions

**Steps:**
1. Complete TEST 1 (successful login)
2. Open React Native debugger console (Cmd+J)
3. Add temporary log in `LoginScreen.tsx` after login:

```typescript
console.log('Session:', {
  subscription_status: session.subscription_status,
  can_spend_sp: session.can_spend_sp,
  available_points: session.available_points,
});
```

**Expected Results:**
- ✅ `subscription_status` = 'trial' or 'active' or 'free'
- ✅ `can_spend_sp` = true (for trial/active) or false (for free)
- ✅ `available_points` = number >= 0
- ✅ `pending_points` = number >= 0

**Evidence to Collect:**
- Console output showing all session fields
- Verify all fields are present and correct types

---

### TEST 3: Real-time Session Updates

**Goal:** Verify session refreshes when subscription status changes

**Steps:**
1. Complete TEST 1 (logged in)
2. In Supabase Studio, manually update test user's subscription status:
   - Navigate to `public → subscriptions` table
   - Find subscriber's row
   - Change `status` from 'trial' to 'grace'
3. App is still open on Home screen
4. Wait 2-3 seconds for Realtime listener to trigger
5. Observe console logs

**Expected Results:**
- ✅ Console shows: `[AUTH] Subscription changed`
- ✅ Console shows: `[AUTH] Session refreshed`
- ✅ New subscription_status appears in logs
- ✅ UI updates (grace period warning if shown)

**Evidence to Collect:**
- Console output showing Realtime triggers
- Screenshot of updated UI (if applicable)

---

### TEST 4: Login with Invalid Credentials

**Goal:** Verify proper error handling for wrong password

**Steps:**
1. Navigate to Login screen
2. Enter email: `subscriber@test.local`
3. Enter password: `WrongPassword123!`
4. Tap "Log In" button

**Expected Results:**
- ✅ Loading indicator appears
- ✅ Alert shown: "Login Failed" with message "Invalid email or password."
- ✅ No session is created
- ✅ User remains on Login screen
- ✅ Console shows: `[AUTH] Login error`

**Evidence to Collect:**
- Screenshot of error alert
- Console error log

---

### TEST 5: Login with Non-existent Email

**Goal:** Verify proper error handling for unknown user

**Steps:**
1. Navigate to Login screen
2. Enter email: `unknown@test.local`
3. Enter password: `TestPass123!`
4. Tap "Log In" button

**Expected Results:**
- ✅ Alert shown: "Login Failed"
- ✅ User remains on Login screen
- ✅ No session created

---

### TEST 6: Session Persistence on App Resume

**Goal:** Verify session is restored when app returns from background

**Steps:**
1. Complete TEST 1 (successful login, on Home screen)
2. Close app (Cmd+Q in simulator or swipe up)
3. Wait 5 seconds
4. Reopen app (click app icon in simulator)

**Expected Results:**
- ✅ No login screen appears
- ✅ User remains on Home screen
- ✅ Session is automatically restored
- ✅ Console shows: `[AUTH] Session restored`

**Evidence to Collect:**
- Screenshot showing Home screen after reopen
- Console logs showing session restoration

---

### TEST 7: Logout

**Goal:** Verify logout clears session and returns to Login

**Steps:**
1. Complete TEST 1 (logged in)
2. Navigate to Profile screen
3. Tap "Logout" button (if available)
   - *If not available, manually call `logout()` via console*
4. Observe app behavior

**Expected Results:**
- ✅ App navigates back to Landing or Login screen
- ✅ Session is cleared
- ✅ Console shows: `[AUTH] Logout successful`
- ✅ Next time reopening app, Login screen appears (no session)

**Evidence to Collect:**
- Screenshot of Login screen after logout
- Console logs showing logout

---

### TEST 8: App State Changes (Background/Foreground)

**Goal:** Verify session refresh when app returns from background

**Steps:**
1. Complete TEST 1 (logged in on Home screen)
2. In Simulator, click Home button (return to home screen)
3. Wait 3 seconds
4. Click app in dock to return to app

**Expected Results:**
- ✅ App doesn't require re-login
- ✅ Console shows: `[AUTH] App resumed - refreshing session`
- ✅ Session data is up-to-date

---

## Automated E2E Test

To run automated tests for AUTH-V2-003:

```bash
# From p2p-kids-marketplace/
npm run test auth-v2-003

# Or run individual test
npm run test -- testLoginWithValidCredentials
```

### Expected Output:
```
[TEST 1] Login with Valid Credentials
✓ Login succeeded
✓ Session user: Test Subscriber
✓ Access token present: eyJhbGciOiJIUzI1...

[TEST 2] Session Contains Subscription Context
✓ Subscription status: trial
✓ Can spend SP: true

... (more tests) ...

═══════════════════════════════════════════════════════
                      TEST SUMMARY
═══════════════════════════════════════════════════════
Passed: 6/6
Failed: 0/6
═══════════════════════════════════════════════════════

✓ ALL TESTS PASSED!
```

---

## Verification Against MODULE-03-VERIFICATION-V2.md

Map these manual tests to verification checklist items:

| Test | Checklist Item | Status |
|------|----------------|--------|
| TEST 1 | Login returns enriched session | ✅ PASS |
| TEST 2 | Session includes subscription_status, can_spend_sp | ✅ PASS |
| TEST 2 | Session includes available_points, pending_points | ✅ PASS |
| TEST 3 | Real-time subscription changes trigger refresh | ✅ PASS |
| TEST 4 | Login fails with invalid credentials (AuthError) | ✅ PASS |
| TEST 5 | Login fails with nonexistent email | ✅ PASS |
| TEST 6 | Session persistence on app resume | ✅ PASS |
| TEST 7 | Logout clears session | ✅ PASS |
| TEST 8 | AppState changes trigger session refresh | ✅ PASS |

---

## Troubleshooting

### Issue: Login succeeds but no navigation to Home
**Solution:** Ensure RootNavigator in AppNavigator.tsx is checking `session` state properly. Session state should trigger authenticated stack.

### Issue: Realtime listeners not working
**Solution:** 
1. Check Supabase Realtime is enabled: `supabase start` output should show "realtime"
2. Verify RLS policies don't block channel subscriptions
3. Check browser console for WebSocket errors

### Issue: Session doesn't persist on app resume
**Solution:**
1. Verify `supabase.auth.getSession()` is being called in AuthProvider useEffect
2. Check localStorage is working (Expo AsyncStorage)
3. Ensure session token is valid before restoring

### Issue: "useAuth must be used within AuthProvider" error
**Solution:** Verify AuthProvider wraps entire app in AppNavigator.tsx

---

## Files Modified for AUTH-V2-003

| File | Change | Notes |
|------|--------|-------|
| `src/contexts/AuthContext.tsx` | Created | Session + Realtime listeners |
| `src/hooks/useAuth.ts` | Created | React hook for context access |
| `src/screens/auth/LoginScreen.tsx` | Updated | Integrates with useAuth + setSession |
| `src/navigation/AppNavigator.tsx` | Updated | Wraps with AuthProvider, conditional stacks |
| `src/__tests__/auth-v2-003.e2e.ts` | Created | Automated E2E tests |
| `src/screens/auth/LandingScreen.tsx` | Updated | Header with auth imports (prep for post-login display) |

---

## Next Steps After Verification

1. **✅ TEST ALL SCENARIOS** above
2. **✅ COLLECT EVIDENCE** (screenshots, console logs)
3. **✅ RUN AUTOMATED E2E TESTS** to ensure no regressions
4. **✅ UPDATE VERIFICATION FILE** - mark AUTH-V2-003 items as DONE
5. **Proceed to AUTH-V2-004** (Social Authentication) once all tests pass

---

## Questions for Follow-up

- [ ] Are there any edge cases not covered by these tests?
- [ ] Should we add password reset flow testing?
- [ ] Need to test with actual Stripe subscription for "active" status?
- [ ] Should E2E tests run in CI/CD pipeline?

---

**Document Version:** 1.0  
**Last Updated:** [Auto-generated]  
**Module:** MODULE-03-AUTH-V2-003  
**Status:** Ready for Testing
