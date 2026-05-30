# MANUAL TEST GUIDE: SUB-EXT-001 - Trial Extension System

**Task:** TASK SUB-EXT-001: Trial Extension RPC + Database Column  
**Module:** MODULE-11-SUBSCRIPTIONS-REMAINING  
**Date:** January 22, 2026  
**Duration:** 20-30 minutes

---

## 📋 PRE-REQUISITES

### ✅ Before You Start

1. **Database Migration Applied**
   - Migration `114_trial_extension_system.sql` must be run in Supabase production
   - See "SQL Setup" section below

2. **Test Users Ready**
   - You need at least 2 test users:
     - **User A**: Active trial user (referrer)
     - **User B**: New user (referred user) - can be any valid UUID

3. **Environment Setup**
   - Mobile app compiled with latest changes
   - Navigation includes `TrialExtensionTest` screen
   - Supabase connection working

---

## 🗄️ SQL SETUP (Run in Supabase First)

**⚠️ IMPORTANT: Run this SQL in Supabase SQL Editor BEFORE testing**

### Step 1: Apply Migration

```sql
-- Navigate to Supabase Dashboard → SQL Editor → New Query
-- Copy and paste the entire contents of:
-- supabase/migrations/114_trial_extension_system.sql
-- Click "Run"
```

### Step 2: Verify Migration Success

```sql
-- Verify referral_extensions_used column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'referral_extensions_used';
-- ✅ Expected: 1 row with data_type = 'integer', default = 0

-- Verify admin config entries exist
SELECT key, value, description
FROM admin_config
WHERE key IN ('max_referral_extensions', 'referral_extension_days');
-- ✅ Expected: 2 rows
-- max_referral_extensions = '3'
-- referral_extension_days = '7'

-- Verify extend_trial_period RPC exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'extend_trial_period';
-- ✅ Expected: 1 row with routine_type = 'FUNCTION'

-- Verify subscription_events table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'subscription_events';
-- ✅ Expected: 1 row
```

### Step 3: Create Test User with Trial

```sql
-- Replace <USER_ID> with your test user's UUID
-- If you need to create a test trial subscription:

INSERT INTO subscriptions (
  user_id,
  status,
  trial_start_date,
  trial_end_date,
  referral_extensions_used
) VALUES (
  '<YOUR_USER_ID_HERE>',  -- Replace with actual UUID
  'trial',
  NOW(),
  NOW() + INTERVAL '30 days',
  0
) ON CONFLICT (user_id) DO UPDATE SET
  status = 'trial',
  trial_start_date = NOW(),
  trial_end_date = NOW() + INTERVAL '30 days',
  referral_extensions_used = 0;
```

---

## 📱 MANUAL TEST CASES

### Test Case 1: Successful Trial Extension (First Extension)

**Objective:** Verify trial can be extended successfully on first referral

**Steps:**
1. Open the mobile app
2. Log in as **User A** (trial user)
3. Navigate to: **Admin → Trial Extension Test**
4. Note the current extension stats displayed:
   - Extensions Used: 0
   - Extensions Remaining: 3
5. Enter a valid referral user ID (any valid UUID, can use User B's ID)
6. Tap **"Extend Trial"** button
7. Observe the result

**Expected Results:**
- ✅ Success card appears with green background
- ✅ Shows "New Trial End" date (7 days from previous end date)
- ✅ Extensions Used: 1
- ✅ Extensions Remaining: 2
- ✅ Days Added: 7
- ✅ Stats card updates immediately
- ✅ History card shows 1 entry with extension details

**Pass Criteria:**
- [ ] Success message displayed
- [ ] Trial end date extended by 7 days
- [ ] Extensions used counter incremented
- [ ] Event logged in history

---

### Test Case 2: Multiple Extensions (2nd and 3rd)

**Objective:** Verify multiple extensions work up to max limit

**Steps:**
1. Continue from Test Case 1 (Extensions Used: 1)
2. Tap **"Extend Trial"** again (using same or different referral ID)
3. Observe result (2nd extension)
4. Tap **"Extend Trial"** again (3rd extension)
5. Observe result

**Expected Results After 2nd Extension:**
- ✅ Success
- ✅ Extensions Used: 2
- ✅ Extensions Remaining: 1
- ✅ Trial extended by another 7 days (total +14 days)
- ✅ History shows 2 entries

**Expected Results After 3rd Extension:**
- ✅ Success
- ✅ Extensions Used: 3
- ✅ Extensions Remaining: 0
- ✅ Trial extended by another 7 days (total +21 days)
- ✅ History shows 3 entries

**Pass Criteria:**
- [ ] 2nd extension succeeds
- [ ] 3rd extension succeeds
- [ ] Each extension adds 7 days
- [ ] Total trial period extended by 21 days
- [ ] All 3 extensions logged in history

---

### Test Case 3: Max Extensions Limit (4th Attempt)

**Objective:** Verify 4th extension attempt is rejected

**Steps:**
1. Continue from Test Case 2 (Extensions Used: 3)
2. Tap **"Extend Trial"** again (4th attempt)
3. Observe result

**Expected Results:**
- ❌ Error card appears with red background
- ❌ Error message: "Maximum trial extensions reached"
- ❌ Extensions Used: 3 (unchanged)
- ❌ Extensions Remaining: 0 (unchanged)
- ❌ Trial end date NOT changed
- ❌ No new event in history

**Pass Criteria:**
- [ ] Error message displayed
- [ ] Extension rejected
- [ ] Stats unchanged
- [ ] No additional history entry created

---

### Test Case 4: Non-Trial User Rejection

**Objective:** Verify extension only works for trial users

**Steps:**
1. Log out from User A
2. Log in as a user with **active** subscription (not trial)
3. Navigate to: **Admin → Trial Extension Test**
4. Enter any referral user ID
5. Tap **"Extend Trial"**
6. Observe result

**Expected Results:**
- ❌ Error card with red background
- ❌ Error message: "No active trial found"
- ❌ No stats displayed (or shows N/A)

**Pass Criteria:**
- [ ] Error message displayed
- [ ] Extension rejected for non-trial user

---

### Test Case 5: Database Verification

**Objective:** Verify database state after extensions

**Steps:**
1. After completing Test Cases 1-3 (3 extensions)
2. Open Supabase SQL Editor
3. Run verification queries

**Verification Query 1: Check Subscription Record**
```sql
SELECT 
  user_id,
  status,
  trial_start_date,
  trial_end_date,
  referral_extensions_used,
  updated_at
FROM subscriptions
WHERE user_id = '<USER_A_ID>';
```

**Expected Results:**
- ✅ status = 'trial'
- ✅ referral_extensions_used = 3
- ✅ trial_end_date = trial_start_date + 30 days + 21 days (51 days total)

**Verification Query 2: Check Subscription Events**
```sql
SELECT 
  id,
  user_id,
  event_type,
  metadata,
  created_at
FROM subscription_events
WHERE user_id = '<USER_A_ID>'
  AND event_type = 'trial_extended'
ORDER BY created_at DESC;
```

**Expected Results:**
- ✅ 3 rows returned
- ✅ Each row has event_type = 'trial_extended'
- ✅ metadata contains:
  - referral_user_id
  - days_added = 7
  - new_trial_end
  - extensions_used (1, 2, 3)
  - extensions_remaining (2, 1, 0)

**Pass Criteria:**
- [ ] Subscription record updated correctly
- [ ] All 3 events logged in subscription_events
- [ ] Metadata contains correct values

---

### Test Case 6: Extension History Display

**Objective:** Verify extension history is displayed correctly in UI

**Steps:**
1. Log in as User A (who has 3 extensions)
2. Navigate to: **Admin → Trial Extension Test**
3. Scroll to "Extension History" section
4. Review displayed history

**Expected Results:**
- ✅ History shows 3 entries
- ✅ Entries sorted by date (newest first)
- ✅ Each entry shows:
  - Extension number (#1, #2, #3)
  - Date of extension
  - Days Added: 7
  - Extensions ratio (e.g., "1 / 3", "2 / 3", "3 / 3")

**Pass Criteria:**
- [ ] All 3 extensions visible
- [ ] Correct chronological order
- [ ] All metadata displayed correctly

---

### Test Case 7: Admin Config Validation

**Objective:** Verify admin config values are used correctly

**Steps:**
1. Open Supabase SQL Editor
2. Verify admin config values

**Query:**
```sql
SELECT key, value, description, is_active
FROM admin_config
WHERE key IN ('max_referral_extensions', 'referral_extension_days');
```

**Expected Results:**
- ✅ max_referral_extensions = '3'
- ✅ referral_extension_days = '7'
- ✅ Both records have is_active = TRUE

**Optional: Test with Different Config Values**
```sql
-- Change max extensions to 5
UPDATE admin_config
SET value = '5'
WHERE key = 'max_referral_extensions';

-- Change extension days to 10
UPDATE admin_config
SET value = '10'
WHERE key = 'referral_extension_days';
```

Then repeat Test Cases 1-3 and verify:
- ✅ New max (5 extensions) is respected
- ✅ Each extension adds 10 days instead of 7

**Pass Criteria:**
- [ ] Admin config values exist
- [ ] RPC respects configured values
- [ ] Changes to config take effect immediately

---

## 🔍 VERIFICATION CHECKLIST

### Database Verification ✅
- [ ] `referral_extensions_used` column exists in subscriptions table
- [ ] `subscription_events` table exists
- [ ] `extend_trial_period()` RPC exists
- [ ] Admin config entries exist (max_referral_extensions, referral_extension_days)

### Functional Verification ✅
- [ ] Test Case 1: First extension succeeds
- [ ] Test Case 2: 2nd and 3rd extensions succeed
- [ ] Test Case 3: 4th extension rejected with correct error
- [ ] Test Case 4: Non-trial user rejected
- [ ] Test Case 5: Database state correct after extensions
- [ ] Test Case 6: Extension history displays correctly
- [ ] Test Case 7: Admin config values respected

### UI Verification ✅
- [ ] Trial Extension Test screen accessible via navigation
- [ ] Stats card displays current extension counts
- [ ] Success/error cards display appropriate styling
- [ ] Extension history shows all events
- [ ] Loading indicator shown during API call

---

## 🐛 TROUBLESHOOTING

### Issue: "No active trial found" error

**Possible Causes:**
1. User subscription status is not 'trial'
2. User has no subscription record
3. RPC looking for wrong status values

**Solutions:**
```sql
-- Check user's subscription status
SELECT user_id, status, trial_end_date
FROM subscriptions
WHERE user_id = '<USER_ID>';

-- Fix: Update status to 'trial'
UPDATE subscriptions
SET status = 'trial',
    trial_end_date = NOW() + INTERVAL '30 days'
WHERE user_id = '<USER_ID>';
```

---

### Issue: "Trial extension configuration not found"

**Possible Causes:**
1. Admin config entries not created
2. Config keys have wrong names

**Solutions:**
```sql
-- Verify config exists
SELECT key, value FROM admin_config
WHERE key IN ('max_referral_extensions', 'referral_extension_days');

-- Re-insert config if missing
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active) VALUES
  ('max_referral_extensions', '3', 'Maximum number of trial extensions via referrals', 'subscription', 'number', FALSE, TRUE),
  ('referral_extension_days', '7', 'Days added per referral extension', 'subscription', 'number', FALSE, TRUE)
ON CONFLICT (key) DO NOTHING;
```

---

### Issue: RPC not found

**Possible Causes:**
1. Migration not applied
2. RPC created in wrong schema

**Solutions:**
```sql
-- Verify RPC exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'extend_trial_period';

-- If not found, re-run migration file:
-- supabase/migrations/114_trial_extension_system.sql
```

---

### Issue: Navigation screen not found

**Possible Causes:**
1. Navigation types not updated
2. AppNavigator not updated
3. TypeScript compile error

**Solutions:**
```bash
# Rebuild app
cd p2p-kids-marketplace
npm run typecheck
npm run lint
npm start
```

---

## 📊 MAPPING TO VERIFICATION FILE

This manual test satisfies the following items from `STEP-01-MODULE-11-SUBSCRIPTIONS-VERIFICATION.md`:

### ✅ TASK SUB-EXT-001: TRIAL EXTENSION RPC

**Database Verification (Lines 28-55):**
- [x] referral_extensions_used column exists ← SQL Setup Step 2
- [x] admin_config entries exist ← SQL Setup Step 2
- [x] extend_trial_period RPC exists ← SQL Setup Step 2
- [x] subscription_events table exists ← SQL Setup Step 2

**Functional Verification (Lines 59-106):**
- [x] Test 1: Successful Trial Extension ← Test Case 1
- [x] Test 2: Max Extensions Limit ← Test Case 3
- [x] Test 3: No Active Trial ← Test Case 4

**Service Verification (Lines 143-151):**
- [x] TypeScript service wrapper works ← Test Cases 1-6 (all use service)
- [x] extendTrial() returns correct result shape ← Test Cases 1-3
- [x] getTrialExtensionStats() works ← Test Cases 1-6 (stats displayed)
- [x] getTrialExtensionHistory() works ← Test Case 6

**Integration Test (Lines 159-184):**
- [x] End-to-End Referral Trial Extension Flow ← Test Cases 1-3 combined

---

## ✅ SUCCESS CRITERIA

All of the following must be TRUE to mark SUB-EXT-001 as **COMPLETE**:

1. **Database Setup**
   - [ ] Migration 114 applied successfully
   - [ ] All verification queries pass

2. **Functional Testing**
   - [ ] All 7 test cases pass
   - [ ] No unexpected errors or crashes

3. **Code Quality**
   - [ ] TypeScript compiles with no errors
   - [ ] ESLint passes with no errors
   - [ ] Unit tests pass (npm test)

4. **Documentation**
   - [ ] This manual test guide completed
   - [ ] All verification checklist items checked

---

## 🚀 NEXT STEPS

After completing SUB-EXT-001, proceed to:

1. **TASK SUB-007**: Stripe Webhook Handlers (Verify + Complete)
2. **TASK SUB-008**: Cancellation Flow + Wallet Freeze Integration
3. **TASK SUB-009**: Grace Period Management + Auto-Cleanup

---

## 📝 NOTES & OBSERVATIONS

Use this section to record any issues, unexpected behavior, or observations during testing:

```
Date: _____________
Tester: ___________

Observations:
- 
- 
- 

Issues Found:
- 
- 

Resolution:
- 
- 
```

---

**END OF MANUAL TEST GUIDE**
