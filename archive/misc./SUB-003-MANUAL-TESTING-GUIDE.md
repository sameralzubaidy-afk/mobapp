# MODULE-11 SUB-003: Manual Testing Guide
## Start 30-Day Free Trial (No Card Required)

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-003  
**Test Environment:** iOS Simulator / Android Emulator  
**Prerequisites:**  
- Supabase migration `20260215000000_sub_003_trial_reminder_flags.sql` applied
- App running with latest code
- Test user accounts available

---

## Pre-Test Setup

### 1. Apply Database Migration

```sql
-- Run in Supabase SQL Editor (Production)
-- File: supabase/migrations/20260215000000_sub_003_trial_reminder_flags.sql

-- Verify reminder flag columns exist after migration
SELECT 
  column_name, 
  data_type, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'subscriptions' 
  AND column_name IN ('trial_reminder_day_23_sent', 'trial_reminder_day_28_sent', 'trial_reminder_day_29_sent', 'trial_used_at')
ORDER BY column_name;
```

**Expected Result:**  
✅ 4 columns returned (3 BOOLEAN with DEFAULT FALSE, 1 TIMESTAMPTZ nullable)

### 2. Start Mobile App

```bash
# Terminal 1: Start Metro bundler
cd p2p-kids-marketplace
npm start

# Terminal 2: Run iOS Simulator
npm run ios

# OR Terminal 2: Run Android Emulator
npm run android
```

---

## Test Case 1: New User - First Trial Enrollment

### Test Steps

1. **Open app on simulator**
   - ✅ App loads successfully
   - ✅ Landing screen appears

2. **Sign up new user**
   - Email: `trial-test-${timestamp}@test.com`
   - Password: `TestPass123!`
   - ✅ Account created successfully
   - ✅ Navigates to ProfileCompletionScreen

3. **Complete profile**
   - Enter first name, last name, date of birth
   - ✅ Navigates to SubscriptionChoiceScreen

4. **Select "Try Kids Club+ Free"**
   - ✅ "Try Kids Club+ Free" button is visible
   - ✅ "30-Day Free Trial" text is displayed
   - ✅ "No credit card required" subtext is shown
   - Tap **"Try Kids Club+ Free"** button

5. **Verify trial activation**
   - ✅ Loading indicator appears
   - ✅ Success message: "Your 30-day free trial has been activated. Enjoy unlimited Swap Points!"
   - ✅ Navigates to Dashboard/Home screen
   - ✅ User badge shows "Kids Club+ (Trial)"

6. **Verify database state**

```sql
-- Run in Supabase SQL Editor
SELECT 
  user_id,
  status,
  trial_start_date,
  trial_end_date,
  trial_used_at,
  trial_reminder_day_23_sent,
  trial_reminder_day_28_sent,
  trial_reminder_day_29_sent,
  created_at
FROM subscriptions
WHERE user_id = '<paste-user-id-from-app>';
```

**Expected Result:**
```
status: 'trial'
trial_start_date: (current timestamp)
trial_end_date: (current timestamp + 30 days)
trial_used_at: (current timestamp)
trial_reminder_day_23_sent: false
trial_reminder_day_28_sent: false
trial_reminder_day_29_sent: false
```

---

## Test Case 2: Trial Eligibility Check (One Trial Per User)

### Test Steps

1. **Create trial user (use Test Case 1)**
   - User has active trial subscription

2. **Cancel trial in database**

```sql
-- Simulate trial cancellation
UPDATE subscriptions
SET 
  status = 'free',
  trial_start_date = NULL,
  trial_end_date = NULL
WHERE user_id = '<paste-user-id>';

-- NOTE: trial_used_at should REMAIN set (this enforces one-trial-per-user)
```

3. **Attempt to start new trial from app**
   - Navigate to Profile → Settings → Subscription
   - ✅ "Try Kids Club+ Free" button should NOT be visible OR should be disabled
   - If button is visible (bug), tap it

4. **Verify error message**
   - ✅ Error alert appears: "You have already used your free trial"
   - ✅ Status remains "Free Tier"

5. **Verify database state unchanged**

```sql
-- Verify user cannot enroll in trial again
SELECT 
  status,
  trial_used_at
FROM subscriptions
WHERE user_id = '<paste-user-id>';
```

**Expected Result:**
```
status: 'free'
trial_used_at: (original timestamp from first trial, NOT NULL)
```

---

## Test Case 3: Upgrade Free Subscription to Trial (Mid-Session)

### Test Steps

1. **Sign up new user and select "Free Tier"**
   - Complete signup → ProfileCompletion → SubscriptionChoice
   - Select **"Continue with Free Tier"**
   - ✅ User lands on Dashboard with "Free Tier" badge

2. **Navigate to upgrade screen**
   - Tap Profile tab
   - Tap "Upgrade to Kids Club+"
   - ✅ SubscriptionChoiceScreen appears again

3. **Select "Try Kids Club+ Free"**
   - Tap **"Try Kids Club+ Free"** button

4. **Verify trial activation**
   - ✅ Success message appears
   - ✅ Badge updates to "Kids Club+ (Trial)"
   - ✅ SP Wallet becomes accessible (icon enabled in nav)

5. **Verify database state**

```sql
SELECT 
  status,
  trial_start_date,
  trial_end_date,
  trial_used_at,
  trial_reminder_day_23_sent,
  trial_reminder_day_28_sent,
  trial_reminder_day_29_sent
FROM subscriptions
WHERE user_id = '<paste-user-id>';
```

**Expected Result:**
```
status: 'trial' (upgraded from 'free')
trial_start_date: (timestamp when upgrade happened)
trial_end_date: (start + 30 days)
trial_used_at: (timestamp when upgrade happened)
trial_reminder_day_23_sent: false
trial_reminder_day_28_sent: false
trial_reminder_day_29_sent: false
```

---

## Test Case 4: Idempotency Check (Duplicate Trial Enrollment Calls)

### Test Steps

1. **Create trial user**
   - Complete Test Case 1

2. **Call trial enrollment RPC directly**

```sql
-- First call (should be idempotent - returns existing trial)
SELECT create_trial_subscription('<paste-user-id>');

-- Expected: Returns existing trial subscription, no error
```

3. **Verify reminder flags unchanged**

```sql
-- Manually set day 23 reminder flag
UPDATE subscriptions
SET trial_reminder_day_23_sent = true
WHERE user_id = '<paste-user-id>';

-- Call RPC again (should be idempotent)
SELECT create_trial_subscription('<paste-user-id>');

-- Verify flag was NOT reset
SELECT trial_reminder_day_23_sent FROM subscriptions WHERE user_id = '<paste-user-id>';
```

**Expected Result:**
```
trial_reminder_day_23_sent: true (preserved, NOT reset to false)
```

---

## Test Case 5: Reminder Flag Initialization on New Trial

### Test Steps

1. **Create brand new user**
   - Sign up → Complete profile → Select trial

2. **Immediately check database before any reminders sent**

```sql
SELECT 
  trial_reminder_day_23_sent,
  trial_reminder_day_28_sent,
  trial_reminder_day_29_sent
FROM subscriptions
WHERE user_id = '<paste-user-id>';
```

**Expected Result:**
```
trial_reminder_day_23_sent: false
trial_reminder_day_28_sent: false
trial_reminder_day_29_sent: false
```

3. **Simulate reminder sent**

```sql
-- Update flag to simulate notification service
UPDATE subscriptions
SET trial_reminder_day_23_sent = true
WHERE user_id = '<paste-user-id>';

-- Verify update
SELECT trial_reminder_day_23_sent FROM subscriptions WHERE user_id = '<paste-user-id>';
```

**Expected Result:**
```
trial_reminder_day_23_sent: true
```

---

## Test Case 6: Admin Config - Trial Duration Customization

### Test Steps

1. **Check current admin config**

```sql
-- CORRECTED: Use 'subscription' not 'trial_subscription'
SELECT * FROM admin_config 
WHERE category = 'subscription' 
  AND key = 'trial_duration_days';
```

**Expected Default:**
```
value: '30'
category: 'subscription'
```

2. **Update trial duration (admin action)**

```sql
-- Change trial to 14 days (for testing)
UPDATE admin_config
SET value = '14'
WHERE category = 'subscription' 
  AND key = 'trial_duration_days';
```

3. **Create new trial user**
   - Sign up new user → Select trial

4. **Verify trial duration matches config**

```sql
SELECT 
  trial_start_date,
  trial_end_date,
  EXTRACT(DAY FROM (trial_end_date - trial_start_date)) AS duration_days
FROM subscriptions
WHERE user_id = '<paste-user-id>';
```

**Expected Result:**
```
duration_days: 14 (matches admin config)
```

5. **Restore default config**

```sql
-- Restore to 30 days
UPDATE admin_config
SET value = '30'
WHERE category = 'subscription' 
  AND key = 'trial_duration_days';
```

---

## Test Case 7: Edge Case - Expired Subscription with No Trial Used

### Test Steps

1. **Create expired subscription manually (never used trial)**

```sql
INSERT INTO subscriptions (user_id, status, trial_used_at)
VALUES ('<test-user-id>', 'expired', NULL);
```

2. **Attempt to start trial**

```sql
SELECT create_trial_subscription('<test-user-id>');
```

**Expected Result:**
✅ Should succeed - converts expired → trial  
✅ trial_used_at gets set  
✅ Reminder flags initialized to FALSE

---

## Test Case 8: Edge Case - Cancelled Subscription with Trial Already Used

### Test Steps

1. **Create cancelled subscription (trial was used)**

```sql
INSERT INTO subscriptions (user_id, status, trial_used_at)
VALUES ('<test-user-id>', 'canceled', NOW() - INTERVAL '60 days');
```

2. **Attempt to start new trial**

```sql
SELECT create_trial_subscription('<test-user-id>');
```

**Expected Result:**
❌ Should fail with error: `TRIAL_ALREADY_USED: User ... has already used their free trial on ...`

---

## Verification Checklist (MODULE-11-VERIFICATION-V2.md)

After completing all test cases, verify the following items from MODULE-11-VERIFICATION-V2.md:

### SUB-003 Specific Items

- ✅ **VER-SUB-003-001:** Trial eligibility check returns correct result (eligible/not eligible)
- ✅ **VER-SUB-003-002:** `create_trial_subscription` RPC creates trial with 30-day window (or admin-configured duration)
- ✅ **VER-SUB-003-003:** Reminder flags (`trial_reminder_day_23_sent`, `trial_reminder_day_28_sent`, `trial_reminder_day_29_sent`) initialized to FALSE
- ✅ **VER-SUB-003-004:** `trial_used_at` timestamp set on first trial enrollment
- ✅ **VER-SUB-003-005:** One-trial-per-user enforcement works (second trial attempt fails)
- ✅ **VER-SUB-003-006:** No payment method required during trial enrollment
- ✅ **VER-SUB-003-007:** `upgrade_free_subscription_to_trial` RPC works for mid-session upgrades
- ✅ **VER-SUB-003-008:** Idempotent behavior (calling RPC on existing trial returns same subscription)
- ✅ **VER-SUB-003-009:** Admin config `trial_subscription.duration_days` respected
- ✅ **VER-SUB-003-010:** SP wallet automatically accessible after trial enrollment

---

## Common Issues & Troubleshooting

### Issue 1: "TRIAL_ALREADY_USED" error on first enrollment
**Cause:** Old test data with `trial_used_at` set  
**Fix:**
```sql
-- Reset trial_used_at for test user
UPDATE subscriptions
SET trial_used_at = NULL
WHERE user_id = '<test-user-id>';
```

### Issue 2: Reminder flags not showing in query results
**Cause:** Migration not applied or columns don't exist  
**Fix:**
```sql
-- Re-run migration or manually add columns
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_reminder_day_23_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_reminder_day_28_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_reminder_day_29_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ;
```

### Issue 3: Trial duration not matching config
**Cause:** Old RPC function version still in use  
**Fix:**
```sql
-- Re-run the SUB-003 migration to update RPC functions
-- Or manually verify function definition includes get_trial_duration_days()
SELECT pg_get_functiondef('create_trial_subscription'::regproc);
```

### Issue 4: App crashes on trial enrollment
**Cause:** TypeScript type mismatch or missing fields  
**Fix:**
```bash
# Clear cache and rebuild
cd p2p-kids-marketplace
npm run clean
npm start -- --reset-cache
```

---

## Test Completion Sign-Off

| Test Case | Status | Notes | Tester | Date |
|-----------|--------|-------|--------|------|
| TC-1: New User First Trial | ⬜ Pass / ⬜ Fail | | | |
| TC-2: One Trial Per User | ⬜ Pass / ⬜ Fail | | | |
| TC-3: Upgrade Free to Trial | ⬜ Pass / ⬜ Fail | | | |
| TC-4: Idempotency Check | ⬜ Pass / ⬜ Fail | | | |
| TC-5: Reminder Flag Init | ⬜ Pass / ⬜ Fail | | | |
| TC-6: Admin Config Duration | ⬜ Pass / ⬜ Fail | | | |
| TC-7: Expired No Trial Used | ⬜ Pass / ⬜ Fail | | | |
| TC-8: Cancelled Trial Used | ⬜ Pass / ⬜ Fail | | | |

**Overall Status:** ⬜ All Pass / ⬜ Issues Found  
**Ready for Production:** ⬜ Yes / ⬜ No

---

## Next Steps After Testing

1. If all tests pass: Mark SUB-003 as complete in MODULE-11-VERIFICATION-V2.md
2. If issues found: Document in GitHub Issues with reference to this test guide
3. Update flow-registry.md with SUB-003 smoke test results
4. Proceed to SUB-004: Subscription Cancellation (if ready)
