# SUB-005 Trial Conversion & Downgrade Manual Testing Guide

## MODULE-11 TASK SUB-005: Trial Conversion & Downgrade Rules

---

## Test Environment Setup

### Prerequisites
- iOS Simulator or Android Emulator running
- Supabase production database configured
- Run BOTH migrations before testing:

```bash
# 1. Apply trial conversion RPCs
# In Supabase SQL Editor, run:
/Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20260215000001_trial_conversion_rpcs.sql

# 2. Apply pg_cron scheduler (IMPORTANT: configure before running)
# In Supabase SQL Editor, run (after updating service role key and project ref):
/Users/sameralzubaidi/Desktop/kids_marketplace_app/supabase/migrations/20260215000002_scheduled_trial_conversion.sql
```

---

## Test Case 1: Check Trial Status (No Trial)

### Steps:
1. Open the app on iOS Simulator
2. Log in with a test user that does NOT have a trial subscription
3. Navigate to: Home → Admin Dashboard → Trial Conversion Test
4. Observe the displayed trial status

### Expected Results:
- ✅ Should show "No trial status data available"
- ✅ Should show hint: "User may not be authenticated or may not have a subscription"

---

## Test Case 2: Check Trial Status (Active Trial)

### Setup:
Create a test user with active trial (NOT expired):

```sql
-- In Supabase SQL Editor:
-- Find a test user
SELECT id, email FROM auth.users WHERE email LIKE '%test%' LIMIT 1;

-- Update their subscription to trial (replace USER_ID)
UPDATE subscriptions 
SET 
  status = 'trial',
  trial_start_date = NOW() - INTERVAL '10 days',
  trial_end_date = NOW() + INTERVAL '20 days',
  has_used_trial = FALSE,
  stripe_payment_method_id = NULL
WHERE user_id = 'USER_ID';
```

### Steps:
1. Log in with the test user
2. Navigate to: Admin Dashboard → Trial Conversion Test
3. Click "Refresh Status"
4. Observe all trial status fields

### Expected Results:
- ✅ Status: TRIAL (blue color)
- ✅ Trial Ends At: Shows a date ~20 days in the future
- ✅ Days Remaining: Shows ~20 days
- ✅ Has Payment Method: NO
- ✅ Can Convert: NO (because no payment method)
- ✅ Is Expired: NO

---

## Test Case 3: Check Expired Trial (No Payment Method)

### Setup:
Create a test user with EXPIRED trial and no payment:

```sql
-- In Supabase SQL Editor (replace USER_ID):
UPDATE subscriptions 
SET 
  status = 'trial',
  trial_start_date = NOW() - INTERVAL '35 days',
  trial_end_date = NOW() - INTERVAL '5 days',  -- Expired 5 days ago
  has_used_trial = FALSE,
  stripe_payment_method_id = NULL
WHERE user_id = 'USER_ID';
```

### Steps:
1. Log in with the test user
2. Navigate to Trial Conversion Test screen
3. Click "Refresh Status"

### Expected Results:
- ✅ Status: TRIAL  
- ✅ Days Remaining: Shows negative number (e.g., -5)
- ✅ Has Payment Method: NO
- ✅ Can Convert: NO
- ✅ Is Expired: YES (red color)

---

## Test Case 4: Check Expired Trial (With Payment Method)

### Setup:
Create a test user with EXPIRED trial BUT has payment:

```sql
-- In Supabase SQL Editor (replace USER_ID):
UPDATE subscriptions 
SET 
  status = 'trial',
  trial_start_date = NOW() - INTERVAL '35 days',
  trial_end_date = NOW() - INTERVAL '2 days',  -- Expired 2 days ago
  has_used_trial = FALSE,
  stripe_payment_method_id = 'pm_test_12345'  -- Mock payment method
WHERE user_id = 'USER_ID';
```

### Steps:
1. Log in with the test user
2. Navigate to Trial Conversion Test screen
3. Click "Refresh Status"

### Expected Results:
- ✅ Status: TRIAL
- ✅ Has Payment Method: YES (green color)
- ✅ Can Convert: YES (green color)
- ✅ Is Expired: YES (red color)

---

## Test Case 5: Manual Trigger Conversion (No Payment → Downgrade)

### Setup:
Use the expired trial user from Test Case 3 (no payment method)

### Steps:
1. Log in with the expired trial user (no payment)
2. Navigate to Trial Conversion Test screen
3. Click "Trigger Conversion"
4. Wait for alert dialog
5. Click OK in the alert
6. Click "Refresh Status"

### Expected Results:
- ✅ Alert shows: "Conversion Triggered" with result showing:
  - `processed: 1`
  - `downgraded: 1`
  - `converted: 0`
- ✅ After refresh:
  - Status: GRACE_PERIOD (amber color)
  - Has Used Trial: Should be TRUE now

### Verify in Database:
```sql
-- Check subscription status
SELECT status, has_used_trial, grace_started_at, grace_ends_at
FROM subscriptions
WHERE user_id = 'USER_ID';

-- Expected:
-- status = 'grace_period'
-- has_used_trial = TRUE
-- grace_started_at = recent timestamp
-- grace_ends_at = ~90 days from grace_started_at
```

### Verify SP Wallet Frozen:
```sql
-- Check SP wallet status
SELECT state, grace_period_ends_at, frozen_at
FROM sp_wallets
WHERE user_id = 'USER_ID';

-- Expected:
-- state = 'frozen' (CRITICAL - must be set)
-- grace_period_ends_at = ~90 days from now
-- frozen_at = timestamp when wallet was frozen (may be NULL if conversion ran before RPC fix)
```

---

## Test Case 6: Manual Trigger Conversion (With Payment → Upgrade)

### Setup:
Use the expired trial user from Test Case 4 (with payment method)

### Steps:
1. Log in with the expired trial user (with payment)
2. Navigate to Trial Conversion Test screen
3. Click "Trigger Conversion"
4. Wait for alert dialog
5. Observe result
6. Click "Refresh Status"

### Expected Results:
- ✅ Alert shows: "Conversion Triggered" with result showing:
  - `processed: 1`
  - `converted: 1`
  - `downgraded: 0`
- ✅ After refresh:
  - Status: ACTIVE (green color)
  - Has Used Trial: Should be TRUE

### Verify in Database:
```sql
-- Check subscription status
SELECT status, has_used_trial, tier_id, current_period_start, current_period_end
FROM subscriptions
WHERE user_id = 'USER_ID';

-- Expected:
-- status = 'active'
-- has_used_trial = TRUE
-- tier_id = kids_club_plus tier UUID
-- current_period_start = recent timestamp
-- current_period_end = ~30 days from current_period_start
```

### Verify Subscription Event Logged:
```sql
-- Check event log (subscription_events uses user_id + metadata JSON schema)
SELECT 
  event_type,
  metadata->>'subscription_id' AS subscription_id,
  metadata->>'status_from' AS status_from,
  metadata->>'status_to' AS status_to,
  metadata,
  created_at
FROM subscription_events
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- event_type = 'trial_converted'
-- status_from = 'trial' (from metadata JSON)
-- status_to = 'active' (from metadata JSON)
```

---

## Test Case 7: Prevent Second Trial (has_used_trial flag)

### Setup:
Use a user that already has `has_used_trial = TRUE` from previous tests

### Steps:
1. Attempt to start a new trial using the start-trial RPC:

```sql
-- In Supabase SQL Editor (replace USER_ID):
SELECT is_user_trial_eligible('USER_ID');

-- Expected result: FALSE
```

2. Try to manually reset to trial (should fail business logic check):

```sql
UPDATE subscriptions 
SET status = 'trial'
WHERE user_id = 'USER_ID' AND has_used_trial = TRUE;

-- This should succeed at DB level but business logic should prevent it
```

### Expected Results:
- ✅ `is_user_trial_eligible` returns FALSE
- ✅ User cannot start a second trial through normal flows

---

## Test Case 8: Check Expired Trials RPC

### Setup:
Create multiple test users with various trial states

### Steps:
1. Run the RPC in Supabase SQL Editor:

```sql
SELECT * FROM check_expired_trials();
```

### Expected Results:
- ✅ Returns array of subscriptions with:
  - `status = 'trial'`
  - `trial_end_date < NOW()`
- ✅ Includes columns:
  - `v_id`, `v_user_id`, `v_status`, `v_stripe_subscription_id`, 
  - `v_trial_end_date`, `v_stripe_customer_id`, `v_has_payment_method`

---

## Test Case 9: pg_cron Scheduler Installation & Verification

### Prerequisites:
- Migrations applied (both `20260215000001` and `20260215000002`)
- pg_cron extension enabled in Supabase
- Edge Function deployed (see Test Case 10)

### Steps:

#### 1. Verify Extensions Enabled
```sql
-- In Supabase SQL Editor:
SELECT extname, extversion 
FROM pg_extension 
WHERE extname IN ('pg_cron', 'http');
```

**Expected Results:**
- ✅ Returns 2 rows: `pg_cron` and `http`

#### 2. Verify Cron Job Created
```sql
-- Check cron job exists
SELECT jobid, jobname, schedule, command, active, nodename
FROM cron.job
WHERE jobname = 'trial-conversion-daily';
```

**Expected Results:**
- ✅ Returns 1 row
- ✅ `schedule` = `0 2 * * *` (2:00 AM UTC daily)
- ✅ `active` = `true`
- ✅ `command` contains `SELECT invoke_trial_conversion_edge_function()`

#### 3. (Optional) Check Extension Dependencies
If you get errors about "http_request", ensure the extension is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS http;
```

#### 4. Manually Trigger Cron Job (Test)
```sql
-- Manually invoke the Edge Function via RPC to test the logic immediately
SELECT invoke_trial_conversion_edge_function();
```

**Expected Results:**
- ✅ Returns JSON with `statusCode: 200`
- ✅ Body contains: `{"processed": N, "converted": N, "downgraded": N, "errors": []}`
- ✅ No errors in Supabase logs

#### 5. Check Cron Execution History (if available)
> **Note:** This will return "No rows" if the job has not yet reached its scheduled time (2:00 AM UTC).

```sql
-- View recent execution history
SELECT 
  runid,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'trial-conversion-daily')
ORDER BY start_time DESC 
LIMIT 10;
```

**Expected Results:**
- ✅ Shows execution history (if job has run before)
- ✅ `status` = `succeeded` for successful runs
- ✅ `return_message` contains JSON response from Edge Function


---

## Test Case 10: Edge Function (Production Only)

### Note: This test can only be run if the Edge Function is deployed

### Steps:
1. Deploy the Edge Function:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase functions deploy trial-conversion --no-verify-jwt
```

2. Trigger via Supabase dashboard or via app

3. Check logs:

```bash
supabase functions logs trial-conversion --limit 50
```

### Expected Results:
- ✅ Function processes all expired trials
- ✅ Logs show: "Found X expired trials to process"
- ✅ Logs show conversions and downgrades
- ✅ Returns JSON with counts:
  ```json
  {
    "success": true,
    "processed": 2,
    "converted": 1,
    "downgraded": 1
  }
  ```

---

## Test Case 11: 90-Day Grace Period Calculation

### Steps:
1. Create a trial user and downgrade to grace:
2. Check grace period end date

```sql
-- After downgrading (replace USER_ID):
SELECT 
  grace_started_at,
  grace_ends_at,
  EXTRACT(DAY FROM (grace_ends_at - grace_started_at)) AS days_diff
FROM subscriptions
WHERE user_id = 'USER_ID';
```

### Expected Results:
- ✅ `days_diff` should be approximately 90 days
- ✅ `grace_ends_at` should be ~90 days after `grace_started_at`

---

## Test Case 12: UI Responsiveness

### Steps:
1. Navigate to Trial Conversion Test screen
2. Click "Refresh Status" multiple times quickly
3. Click "Trigger Conversion" while loading
4. Observe loading indicators

### Expected Results:
- ✅ Loading spinner appears during data fetch
- ✅ Buttons are disabled during loading
- ✅ No duplicate requests are sent
- ✅ UI does not freeze or crash

---

## Common Issues & Troubleshooting

### Issue: "No trial status data available"
- **Fix**: Ensure user is logged in and has a subscription record

### Issue: "Trigger Conversion" returns error
- **Fix**: Check Edge Function is deployed and accessible
- **Fix**: Check Supabase service role key is configured

### Issue: SP wallet not frozen after downgrade
- **Fix**: Ensure `sp_wallets` table exists for the user
- **Fix**: Check RPC function `downgrade_trial_to_grace` executed successfully

### Issue: `check_expired_trials` returns empty
- **Fix**: Ensure there are users with `status='trial'` and `trial_end_date < NOW()`
- **Fix**: Create test data using SQL from test cases above

---

## Cleanup After Testing

```sql
-- Reset test users (replace USER_IDs):
UPDATE subscriptions 
SET 
  status = 'free',
  has_used_trial = FALSE,
  trial_start_date = NULL,
  trial_end_date = NULL,
  grace_started_at = NULL,
  grace_ends_at = NULL,
  stripe_payment_method_id = NULL
WHERE user_id IN ('USER_ID_1', 'USER_ID_2', 'USER_ID_3');

-- Unfreeze SP wallets:
UPDATE sp_wallets
SET 
  state = 'active',
  frozen_at = NULL,
  grace_period_ends_at = NULL
WHERE user_id IN ('USER_ID_1', 'USER_ID_2', 'USER_ID_3');

-- Delete test subscription events:
DELETE FROM subscription_events
WHERE user_id IN ('USER_ID_1', 'USER_ID_2', 'USER_ID_3');
```

---

## Success Criteria

All test cases pass:
- [  ] TC1: No trial status handled gracefully
- [  ] TC2: Active trial displays correctly
- [  ] TC3: Expired trial (no payment) detected
- [  ] TC4: Expired trial (with payment) detected
- [  ] TC5: Downgrade to grace_period works
- [  ] TC6: Conversion to active works
- [  ] TC7: has_used_trial prevents second trial
- [  ] TC8: check_expired_trials RPC works
- [  ] TC9: pg_cron scheduler installed and working
- [  ] TC10: Edge Function processes trials (if deployed)
- [  ] TC11: 90-day grace period correct
- [  ] TC12: UI responsive and stable

**TASK SUB-005 COMPLETE** when all checkboxes are ticked ✅
