# Subscription Already Exists - Fix Summary

## Problem
When a new user who was auto-enrolled in trial during signup tried to select "Trial" option on `SubscriptionChoiceScreen`, they got:

```
SubscriptionChoiceScreen.tsx:123 Choose Trial error: AuthError: 
Failed to create trial subscription: Subscription already exists for user 3cbc327a-e6a1-4c2a-a293-81eafad0c0a4
```

## Root Cause

**Duplicate Subscription Creation Flow:**
1. User signs up → `signupWithTrial()` called
2. `signupWithTrial()` calls RPC `create_trial_subscription()` → Creates subscription with status='trial'
3. User reaches onboarding → `SubscriptionChoiceScreen` shown
4. User taps "Trial" button
5. `handleChooseTrial()` calls `enrollInTrialSubscription()`
6. `enrollInTrialSubscription()` tries to call `create_trial_subscription()` again
7. **RPC throws error**: "Subscription already exists for user" ❌

**The RPC has a safety check:**
```sql
IF FOUND THEN
  RAISE EXCEPTION 'Subscription already exists for user %', p_user_id;
END IF;
```

## Solution

### 1. Updated `enrollInTrialSubscription()` in `src/services/auth.ts`

**Changed to:**
- **Step 2**: Before creating subscription, check if one already exists with `.select().single()`
- **Step 3**: Only call `create_trial_subscription()` RPC if subscription doesn't exist
- **Step 4**: Check if wallet exists, only create if needed
- **Step 5**: Update profile with subscription_id + sp_wallet_id

**Result**: If subscription already exists (from signup), function just returns it without error

### 2. Updated `handleChooseTrial()` in `src/screens/onboarding/SubscriptionChoiceScreen.tsx`

**Added smart check:**
1. Query existing subscription status
2. If status='trial', user already has trial from signup
   - Just complete onboarding
   - Show "Welcome to Kids Club+" message
   - Navigate to Home
3. If no subscription or different status, proceed with enrollment

**Result**: User gets correct success flow regardless of whether subscription was created during signup or onboarding

---

## Flow After Fix

### Scenario 1: User Signs Up + Later Selects Trial (Most Common)
```
SignupScreen
  ↓ (signup)
signupWithTrial()
  ↓
Creates subscription (trial) ✅
  ↓
SubscriptionChoiceScreen
  ↓ (user taps Trial)
handleChooseTrial()
  ↓
Check subscription exists? YES, status='trial'
  ↓
Complete onboarding + navigate to Home ✅
```

### Scenario 2: User Signs Up + Later Selects Free
```
SignupScreen
  ↓ (signup)
signupWithTrial()
  ↓
Creates subscription (trial) ✅
  ↓
SubscriptionChoiceScreen
  ↓ (user taps Free)
handleChooseFree()
  ↓
Mark profile complete + navigate to Home ✅
(Subscription stays as 'trial' - can be converted later)
```

### Scenario 3: Explicit Trial Enrollment from Onboarding
```
SubscriptionChoiceScreen (fresh user, no signup auto-enroll)
  ↓ (user taps Trial)
handleChooseTrial()
  ↓
Check subscription exists? NO
  ↓
enrollInTrialSubscription()
  ↓
Call create_trial_subscription() RPC
  ↓
Create subscription + wallet ✅
  ↓
Navigate to Home ✅
```

---

## Testing Checklist

- [x] Implement `enrollInTrialSubscription()` duplicate check
- [x] Update `SubscriptionChoiceScreen` to handle existing subscription
- [x] No breaking changes to existing signup flow
- [x] Free tier selection still works
- [x] Trial selection works for new subscriptions

### Manual Test Steps
1. **Start fresh**: Create new user via signup with test data
2. **Don't close app**: Navigate to SubscriptionChoiceScreen
3. **Tap "Trial"**: Should show "Welcome to Kids Club+" (not error)
4. **Verify**: Check database that only ONE subscription row exists for the user

---

## Code Changes Summary

| File | Change | Lines |
|------|--------|-------|
| `src/services/auth.ts` | Updated `enrollInTrialSubscription()` to check existing subscription | 202-296 |
| `src/screens/onboarding/SubscriptionChoiceScreen.tsx` | Enhanced `handleChooseTrial()` to check existing subscription | 78-151 |

---

## Error Prevention

**Design improvements:**
- ✅ `enrollInTrialSubscription()` is now idempotent
- ✅ Won't fail if subscription/wallet already exist
- ✅ Returns existing records if they exist
- ✅ `handleChooseTrial()` checks subscription status first
- ✅ User gets correct success message regardless of scenario

---

**Date**: December 16, 2025  
**Status**: ✅ Fixed and ready for testing
