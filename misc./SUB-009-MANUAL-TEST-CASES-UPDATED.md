# SUB-009 Manual Test Cases — Grace Period Countdown, Reminders & Expiry

**Module:** MODULE-11-SUBSCRIPTIONS-V2  
**Task:** SUB-009 - Grace Period Countdown, Reminders & Expiry  
**Status:** ✅ Ready for Testing  
**Date:** February 24, 2026

---

## 📋 Purpose

Manual test plan to verify the SUB-009 implementation:
- Admin-configurable grace reminders at [60, 30, 7, 1] day thresholds
- Daily cron processing at 03:00 UTC
- Countdown UI banner with 3 urgency levels (warning/urgent/critical)
- Expiry transition: `grace_period` → `expired` status
- Swap Points (SP) deletion on expiry via MODULE-09 handler

---

## 🔧 Prerequisites

### Required Setup
- ✅ Supabase migrations applied:
  - `20260224000001_grace_reminder_thresholds.sql`
  - `20260224000002_schedule_grace_period_cron.sql`
- ✅ Edge Function `grace-period-cron` deployed
- ✅ Environment variables configured:
  - `SP_SUBSCRIPTION_EXPIRE_URL` = `https://YOUR_PROJECT.supabase.co/functions/v1/sp-subscription-expire`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- ✅ Mobile app running in iOS Simulator or Android Emulator
- ✅ Test accounts ready:
  - **Test User A:** Subscriber with grace_period status (15+ days remaining)
  - **Test User B:** Free user (no subscription)

### Database Verification
Run this SQL to confirm setup:

```sql
-- Check admin config exists
SELECT key, value FROM admin_config WHERE key = 'grace_reminder_thresholds';
-- Expected: [60, 30, 7, 1]

-- Check cron job scheduled
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'grace-period-daily';
-- Expected: 1 row with schedule = '0 3 * * *'

-- Verify Edge Function RPC exists
SELECT proname FROM pg_proc WHERE proname = 'invoke_grace_period_cron';
-- Expected: 1 row
```

### One-Time Schema Patch (if TC-006 throws column 42703)
If you see `column "grace_reminder_sent_day_60" does not exist`, run this once:

```sql
ALTER TABLE public.subscriptions
   ADD COLUMN IF NOT EXISTS grace_reminder_sent_day_60 BOOLEAN DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS grace_reminder_sent_day_30 BOOLEAN DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS grace_reminder_sent_day_7 BOOLEAN DEFAULT FALSE,
   ADD COLUMN IF NOT EXISTS grace_reminder_sent_day_1 BOOLEAN DEFAULT FALSE;
```

---

## 🔄 How to Trigger Cron Manually

For testing purposes, you can invoke the cron job without waiting for 03:00 UTC:

**Option 1: Call RPC Function**
```sql
-- In Supabase SQL Editor
SELECT invoke_grace_period_cron();
```

**Option 2: Call Edge Function Directly**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/grace-period-cron \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

---

## 🧪 Test Cases

---

### TC-001: Grace Period Banner — Warning Level (>7 Days)

**Objective:** Verify banner displays correctly when user has 15+ days remaining in grace period with warning-level urgency styling.

**Test Steps:**

1. **Setup Test Data**
   - Open Supabase SQL Editor
   - Run this SQL:
   ```sql
   -- Update test user to grace_period with 15 days remaining
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() + INTERVAL '15 days'
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

2. **Login to Mobile App**
   - Open iOS Simulator or Android Emulator
   - Login as Test User A
   - Navigate to Dashboard/Home screen

3. **Observe Grace Period Banner**
   - Look for banner between TrialReminderBanner and CategorySelector sections
   - Note: Icon, background color, and message text

4. **Verify Banner Content**
   - Check icon displays (⏰)
   - Check countdown shows "15 days left" or similar
   - Check CTA button text ("Re-Subscribe Now" or "Renew Subscription")

**Expected Results:**

- ✅ Banner displays with **yellow/warning background** (#FFF3CD)
- ✅ Icon shows **⏰** (clock emoji)
- ✅ Message includes "15 days" remaining text
- ✅ Banner positioned between trial reminder and categories
- ✅ "Re-Subscribe" button visible and styled correctly
- ✅ No console errors in app logs

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Database Verification:**
```sql
SELECT status, grace_ends_at, 
       EXTRACT(DAY FROM grace_ends_at - NOW()) as days_remaining
FROM subscriptions WHERE user_id = 'YOUR_TEST_USER_ID';
-- Expected: status='grace_period', days_remaining ≈ 15
```

---

### TC-002: Grace Period Banner — Urgent Level (1-7 Days)

**Objective:** Verify banner urgency styling changes when user has 7 days or fewer remaining.

**Test Steps:**

1. **Update Test Data**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() + INTERVAL '7 days'
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

2. **Force Refresh**
   - Close and reopen the mobile app (or pull-to-refresh dashboard)
   - Login as Test User A if needed

3. **Observe Banner Changes**
   - Check if icon changed
   - Check if background color changed
   - Check if message tone is more urgent

**Expected Results:**

- ✅ Banner displays with **orange/urgent background** (#FFE5CC)
- ✅ Icon shows **⚠️** (warning emoji)
- ✅ Message includes "7 days" remaining
- ✅ CTA button text emphasizes urgency
- ✅ Styling noticeably different from TC-001

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-003: Grace Period Banner — Critical Level (≤1 Day)

**Objective:** Verify banner displays critical urgency when expiry is today or tomorrow.

**Test Steps:**

1. **Update Test Data**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() + INTERVAL '1 day'
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

2. **Restart App**
   - Close and reopen mobile app
   - Navigate to Dashboard

3. **Verify Critical Styling**
   - Banner should be visually distinct (red/critical)
   - Message should indicate imminent expiry

**Expected Results:**

- ✅ Banner displays with **red/critical background** (#FDD or similar)
- ✅ Icon shows **⛔** (stop sign emoji)
- ✅ Message says "expires today" or "1 day left"
- ✅ CTA button highly prominent
- ✅ User understands action is urgent

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-004: Banner CTA Navigation

**Objective:** Verify "Re-Subscribe" button navigates to subscription management screen.

**Test Steps:**

1. **Start with Active Grace Banner**
   - Use any test case above (TC-001, TC-002, or TC-003)
   - Ensure grace period banner is visible on dashboard

2. **Tap CTA Button**
   - Tap the "Re-Subscribe Now" or "Renew Subscription" button

3. **Observe Navigation**
   - App should navigate to ManageKidsClub screen
   - Screen should show subscription options/Stripe payment

4. **Verify Navigation Stack**
   - Press back button
   - Confirm you return to Dashboard (not stuck)

**Expected Results:**

- ✅ Button tap triggers navigation (no delay >1s)
- ✅ Navigates to `ManageKidsClub` screen (or subscription management)
- ✅ Correct screen loads with Stripe payment options
- ✅ Back button returns to Dashboard
- ✅ No navigation errors in console

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-005: No Negative Countdown (Past Grace Period)

**Objective:** Verify UI hides banner when grace_ends_at is in the past (negative days).

**Test Steps:**

1. **Create Past Grace Period Date**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() - INTERVAL '2 days'
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

2. **Open Dashboard**
   - Login as Test User A
   - Navigate to Dashboard/Home screen

3. **Verify Banner Behavior**
   - Banner should NOT display (daysRemaining <= 0 check)
   - No error messages shown to user

4. **Check Console Logs**
   - Verify no JavaScript errors related to banner rendering

**Expected Results:**

- ✅ **No banner displayed** on dashboard
- ✅ No error messages visible to user
- ✅ No console errors (check React Native debugger)
- ✅ Dashboard renders normally without banner
- ✅ Backend cron should process expiry (TC-008 will verify)

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-006: Reminder Notifications at 60-Day Threshold

**Objective:** Verify cron sends push notification when exactly 60 days remain and sets reminder flag.

**Test Steps:**

1. **Setup Test Data**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() + INTERVAL '60 days',
     grace_reminder_sent_day_60 = false,
     grace_reminder_sent_day_30 = false,
     grace_reminder_sent_day_7 = false,
     grace_reminder_sent_day_1 = false
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

2. **Trigger Cron Manually**
   ```sql
   SELECT invoke_grace_period_cron();
   ```

3. **Check Edge Function Logs**
   - Open Supabase Dashboard → Edge Functions → grace-period-cron
   - Look for log entry showing reminder sent

4. **Verify Push Notification**
   - Check mobile device/simulator for push notification
   - Notification should mention "60 days" remaining
   - Title should show "⏰ Grace Period Reminder"

5. **Verify Database Flag**
   ```sql
   SELECT grace_reminder_sent_day_60 
   FROM subscriptions 
   WHERE user_id = 'YOUR_TEST_USER_ID';
   -- Expected: true
   ```

**Expected Results:**

- ✅ Cron function returns `{success: true, reminders: [{day: "60", userId: "..."}]}`
- ✅ Push notification received on device
- ✅ Notification title: "⏰ Grace Period Reminder"
- ✅ Notification body mentions "60 days" remaining
- ✅ Database flag `grace_reminder_sent_day_60` = `true`
- ✅ Edge Function log shows successful notification send

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Notes:**
- Notification received? Yes / No
- Flag updated? Yes / No
- Edge Function log entry ID: _________________

---

### TC-007: No Duplicate Reminders (Idempotency)

**Objective:** Verify cron does NOT send duplicate notifications when reminder flag is already set.

**Test Steps:**

1. **Ensure Flag is Set**
   ```sql
   SELECT grace_reminder_sent_day_30 
   FROM subscriptions 
   WHERE user_id = 'YOUR_TEST_USER_ID';
   -- Should be: true (from TC-006 or manually set)
   ```

2. **If Flag Not Set, Set It Manually**
   ```sql
   UPDATE subscriptions SET 
     grace_ends_at = NOW() + INTERVAL '30 days',
     grace_reminder_sent_day_30 = true
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

3. **Trigger Cron Again**
   ```sql
   SELECT invoke_grace_period_cron();
   ```

4. **Check Response**
   - Cron should return `reminders: []` (empty array)
   - No new notification should appear on device

5. **Verify Flag Unchanged**
   ```sql
   SELECT grace_reminder_sent_day_30 
   FROM subscriptions 
   WHERE user_id = 'YOUR_TEST_USER_ID';
   -- Expected: still true
   ```

**Expected Results:**

- ✅ Cron returns `reminders: []` (no new reminders sent)
- ✅ No new push notification received
- ✅ Flag remains `true` (no unnecessary updates)
- ✅ Edge Function logs show "already sent" or similar message
- ✅ Idempotency working correctly

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-008: Expiry Transition and SP Deletion

**Objective:** Verify cron transitions subscription to `expired` status and deletes SP when grace period ends.

**Test Steps:**

1. **Setup Expired Grace Period**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() - INTERVAL '1 minute'
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

2. **Verify User Has SP Balance** (optional, for full test)
   ```sql
   SELECT available_balance, pending_balance, frozen_balance
   FROM sp_wallets
   WHERE user_id = 'YOUR_TEST_USER_ID';
   -- Note the values
   ```

3. **Trigger Cron**
   ```sql
   SELECT invoke_grace_period_cron();
   ```

4. **Check Cron Response**
   - Look for `expired: 1` in response
   - Status should indicate processing completed

5. **Verify Status Changed**
   ```sql
   SELECT status, updated_at
   FROM subscriptions
   WHERE user_id = 'YOUR_TEST_USER_ID';
   -- Expected: status='expired'
   ```

6. **Verify SP Deletion** (if MODULE-09 handler is deployed)
   ```sql
   SELECT available_balance, pending_balance, frozen_balance
   FROM sp_wallets
   WHERE user_id = 'YOUR_TEST_USER_ID';
   -- Expected: All balances = 0 (if SP expiry handler called)
   ```

7. **Check Edge Function Logs**
   - Grace-period-cron log: Should show SP_SUBSCRIPTION_EXPIRE_URL called
   - SP handler log: Should show SP deletion processed

**Expected Results:**

- ✅ Cron returns `{success: true, expired: 1, ...}`
- ✅ Subscription status changed to `expired`
- ✅ `updated_at` timestamp is recent
- ✅ SP_SUBSCRIPTION_EXPIRE_URL handler was called (check logs)
- ✅ SP balances deleted (if handler configured)
- ✅ No errors in Edge Function logs

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Notes:**
- SP balance before: _________________
- SP balance after: _________________
- SP handler called? Yes / No
- Log entry ID: _________________

---

### TC-009: Admin-Configurable Thresholds Honored

**Objective:** Verify system respects custom reminder thresholds from admin_config table.

**Test Steps:**

1. **Update Admin Config**
   ```sql
   UPDATE admin_config 
   SET value = '[45, 14, 3]'
   WHERE key = 'grace_reminder_thresholds';
   ```

2. **Setup Test User at 45 Days**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() + INTERVAL '45 days',
     grace_reminder_sent_day_45 = false  -- Note: column may not exist, that's OK
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

3. **Trigger Cron**
   ```sql
   SELECT invoke_grace_period_cron();
   ```

4. **Verify Reminder Sent at 45 Days**
   - Check for push notification OR Edge Function log
   - Cron response should show reminder sent

5. **Test Non-Threshold Day (60 days)**
   ```sql
   UPDATE subscriptions SET 
     grace_ends_at = NOW() + INTERVAL '60 days',
     grace_reminder_sent_day_60 = false
   WHERE user_id = 'YOUR_TEST_USER_ID';
   
   SELECT invoke_grace_period_cron();
   ```

6. **Verify NO Reminder at 60 Days**
   - Cron should NOT send reminder (60 not in [45, 14, 3])
   - Response: `reminders: []`

7. **Restore Default Config**
   ```sql
   UPDATE admin_config 
   SET value = '[60, 30, 7, 1]'
   WHERE key = 'grace_reminder_thresholds';
   ```

**Expected Results:**

- ✅ Reminder sent at 45 days (custom threshold)
- ✅ NO reminder sent at 60 days (not in custom list)
- ✅ Cron reads and respects admin_config changes
- ✅ System is admin-configurable as designed
- ✅ Config restored to default successfully

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-010: Edge Function Error Handling

**Objective:** Verify graceful error handling when SP handler URL is invalid or unreachable.

**Test Steps:**

1. **Configure Invalid URL** (Staging/Test Environment Only!)
   - In Supabase Edge Function secrets or .env:
   ```bash
   SP_SUBSCRIPTION_EXPIRE_URL=https://invalid-url-for-testing.example.com
   ```

2. **Setup Expiry Scenario**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_ends_at = NOW() - INTERVAL '1 day'
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

3. **Trigger Cron**
   ```sql
   SELECT invoke_grace_period_cron();
   ```

4. **Check Response**
   - Cron should return error details OR success: false
   - Function should not crash

5. **Verify Edge Function Logs**
   - Open Supabase → Edge Functions → grace-period-cron
   - Look for error log entry with HTTP failure details

6. **Verify Database State**
   ```sql
   SELECT status FROM subscriptions WHERE user_id = 'YOUR_TEST_USER_ID';
   -- IMPORTANT: Status should NOT be stuck in inconsistent state
   ```

7. **Restore Valid URL**
   ```bash
   SP_SUBSCRIPTION_EXPIRE_URL=https://YOUR_PROJECT.supabase.co/functions/v1/sp-subscription-expire
   ```

**Expected Results:**

- ✅ Cron returns structured error (not crash): `{success: false, error: {...}}`
- ✅ Error message logged to Edge Function logs
- ✅ Error contains: URL, status code, and error reason
- ✅ Database state remains consistent (no partial update)
- ✅ Function stops processing and reports error
- ✅ After fixing URL, cron works normally

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Notes:**
- Error message received: _________________
- Database state after error: _________________

---

### TC-011: Batch Processing / Idempotency

**Objective:** Verify cron processes multiple subscriptions correctly and is idempotent when run twice.

**Test Steps:**

1. **Create Multiple Test Subscriptions**
   ```sql
   -- Create 3 test users in grace period
   INSERT INTO subscriptions (user_id, status, grace_ends_at)
   VALUES 
     ('test_user_1', 'grace_period', NOW() - INTERVAL '1 day'),
     ('test_user_2', 'grace_period', NOW() + INTERVAL '30 days'),
     ('test_user_3', 'grace_period', NOW() + INTERVAL '60 days');
   ```

2. **First Cron Execution**
   ```sql
   SELECT invoke_grace_period_cron();
   ```

3. **Check Response**
   - Should show: `processed: 3, expired: 1, reminders: [...]`
   - Note the exact counts

4. **Verify Database Changes**
   ```sql
   SELECT user_id, status FROM subscriptions 
   WHERE user_id IN ('test_user_1', 'test_user_2', 'test_user_3');
   -- Expected: test_user_1 = 'expired', others = 'grace_period'
   ```

5. **Run Cron Again (Immediately)**
   ```sql
   SELECT invoke_grace_period_cron();
   ```

6. **Verify Idempotency**
   - Response should show: `expired: 0` (already processed)
   - No duplicate status changes
   - No duplicate notifications

7. **Cleanup**
   ```sql
   DELETE FROM subscriptions 
   WHERE user_id IN ('test_user_1', 'test_user_2', 'test_user_3');
   ```

**Expected Results:**

- ✅ First run processes all 3 subscriptions
- ✅ First run expires test_user_1 (past date)
- ✅ First run sends reminders for test_user_2 and test_user_3 (if at threshold)
- ✅ Second run shows `expired: 0` (idempotent)
- ✅ No duplicate SP deletions
- ✅ No duplicate notifications sent
- ✅ Database state consistent after both runs

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

---

### TC-012: UI Post-Expiry (Banner Disappears)

**Objective:** Verify grace period banner no longer displays after subscription expires.

**Test Steps:**

1. **Transition User to Expired**
   ```sql
   UPDATE subscriptions SET 
     status = 'expired',
       grace_ends_at = NOW() - INTERVAL '5 days'
   WHERE user_id = 'YOUR_TEST_USER_ID';
   ```

2. **Open Mobile App**
   - Login as Test User A
   - Navigate to Dashboard/Home screen

3. **Verify Banner Behavior**
   - Grace period banner should NOT be visible
   - No countdown displayed

4. **Check Subscription Card/Widget**
   - If app has subscription status widget, it should show "Expired"
   - User should see message to renew subscription

5. **Verify No Errors**
   - Check React Native console for errors
   - UI should render normally without banner section

**Expected Results:**

- ✅ **No grace period banner** displayed on dashboard
- ✅ Subscription status widget shows "Expired" (if applicable)
- ✅ App suggests renewal action
- ✅ No UI rendering errors
- ✅ No console errors related to banner component
- ✅ Dashboard layout looks correct without banner

**Actual Results:**
- [ ] Pass
- [ ] Fail (Reason: _________________)

**Screenshots:**
- [ ] Attach screenshot of dashboard with no banner visible

---

## 📊 Verification Queries

Use these SQL queries to verify system state during testing:

### Check Admin Config
```sql
SELECT key, value, description 
FROM admin_config 
WHERE key = 'grace_reminder_thresholds';
```

### List All Grace Period Subscriptions
```sql
SELECT id, user_id, status, grace_ends_at,
       EXTRACT(DAY FROM grace_ends_at - NOW()) as days_remaining,
       grace_reminder_sent_day_60,
       grace_reminder_sent_day_30,
       grace_reminder_sent_day_7,
       grace_reminder_sent_day_1
FROM subscriptions 
WHERE status IN ('grace_period', 'grace') 
ORDER BY grace_ends_at;
```

### Check Specific User Reminder Flags
```sql
SELECT user_id, status, grace_ends_at,
       grace_reminder_sent_day_60,
       grace_reminder_sent_day_30,
       grace_reminder_sent_day_7,
       grace_reminder_sent_day_1,
       updated_at
FROM subscriptions 
WHERE user_id = 'YOUR_TEST_USER_ID';
```

### Verify Expiry Processed
```sql
SELECT id, user_id, status, updated_at,
   grace_ends_at
FROM subscriptions 
WHERE user_id = 'YOUR_TEST_USER_ID' 
  AND status = 'expired';
```

### Check Cron Job Schedule
```sql
SELECT jobname, schedule, command, nodename, nodeport, database, username, active
FROM cron.job 
WHERE jobname = 'grace-period-daily';
```

---

## 🧹 Cleanup

After testing, reset test data using:

```sql
-- Reset test user subscription to active
UPDATE subscriptions SET 
  status = 'active',
   grace_ends_at = NULL,
  grace_reminder_sent_day_60 = false,
  grace_reminder_sent_day_30 = false,
  grace_reminder_sent_day_7 = false,
  grace_reminder_sent_day_1 = false,
  updated_at = NOW()
WHERE user_id = 'YOUR_TEST_USER_ID';

-- Restore SP balances (if needed, using MODULE-09 helper)
-- (Add specific SP restoration commands based on your MODULE-09 implementation)

-- Restore default admin config
UPDATE admin_config 
SET value = '[60, 30, 7, 1]'
WHERE key = 'grace_reminder_thresholds';
```

---

## 🐛 Troubleshooting

### Issue: No push notification received (TC-006, TC-007)
**Solution:**
1. Check Edge Function logs for `grace-period-cron` and `send-push-notification`
2. Verify `SUPABASE_URL` and service role key are correctly set
3. Ensure user has valid push token registered in database
4. Confirm notification permissions enabled on device/simulator

### Issue: Banner shows wrong number of days (TC-001, TC-002, TC-003)
**Solution:**
1. Verify server and device times are in sync (UTC vs local timezone)
2. Confirm `grace_ends_at` is stored as UTC timestamp
3. Check `Math.ceil` calculation in `GracePeriodBanner.tsx`
4. Force refresh dashboard (pull-to-refresh or restart app)

### Issue: Cron returns 500 error (TC-008, TC-010)
**Solution:**
1. Check Edge Function logs for detailed error message
2. Verify all environment variables set: `SP_SUBSCRIPTION_EXPIRE_URL`, etc.
3. Ensure HTTP extension enabled in Supabase: `CREATE EXTENSION IF NOT EXISTS http;`
4. Confirm service role key has correct permissions

### Issue: SP not deleted after expiry (TC-008)
**Solution:**
1. Verify `SP_SUBSCRIPTION_EXPIRE_URL` is correctly configured
2. Check MODULE-09 SP handler Edge Function is deployed
3. Review SP handler logs for errors
4. Confirm SP wallet table has records for test user

### Issue: Database state inconsistent after error (TC-010)
**Solution:**
1. This indicates a bug - the expiry transition should be atomic
2. Review Edge Function code for transaction handling
3. Manually reset subscription status: `UPDATE subscriptions SET status = 'grace_period' WHERE user_id = '...'`
4. Report issue to development team

---

## 📝 Notes for Testers

- **Test Environment:** Always use staging/test environment, not production
- **Device Setup:** iOS Simulator and Android Emulator both supported
- **Duration:** Full test suite takes approximately 45-60 minutes
- **Prerequisites:** Ensure all database migrations applied before starting
- **Order:** Tests can be run independently, but TC-001 through TC-005 form a logical sequence
- **Documentation:** Record any deviations from expected results in the "Actual Results" section

---

## ✅ Test Summary Checklist

After completing all tests, verify:

- [ ] All 12 test cases executed (TC-001 through TC-012)
- [ ] Banner displays correctly at all urgency levels (warning/urgent/critical)
- [ ] Cron job processes reminders and expiries correctly
- [ ] Push notifications sent at correct thresholds ([60, 30, 7, 1] days)
- [ ] Idempotency enforced (no duplicate notifications or status changes)
- [ ] SP deletion handler called on expiry
- [ ] UI behaves correctly post-expiry (banner disappears)
- [ ] Admin config customization works (TC-009)
- [ ] Error handling graceful (TC-010)
- [ ] Batch processing works (TC-011)
- [ ] All verification queries executed successfully
- [ ] Test environment cleaned up

**Overall Test Result:**
- [ ] ✅ PASS - All critical tests passed
- [ ] ⚠️ PARTIAL - Some tests passed with minor issues
- [ ] ❌ FAIL - Critical tests failed, requires fixes

**Tested By:** _________________  
**Date:** _________________  
**Environment:** iOS/Android, Supabase Project: _________________

---

## 📞 Next Steps

After manual testing completion:

1. **Run Tier 0 Validation:**
   ```bash
   cd p2p-kids-marketplace
   npm run typecheck && npm run lint
   ```

2. **Run Unit Tests:**
   ```bash
   cd supabase/functions/grace-period-cron
   deno test --allow-env __tests__/index.test.ts
   ```

3. **Run E2E Tests:**
   ```bash
   cd p2p-kids-marketplace
   npm test -- sub-009-grace-period.e2e.ts
   ```

4. **Update Flow Registry:**
   - Add FLOW-12.1 entry to `docs/flow-registry.md`

5. **Create PR:**
   - Title: `[MODULE-11] SUB-009: Grace Period Countdown, Reminders & Expiry`
   - Include: Test results, manual test checklist, verification status

**Documentation References:**
- Implementation Summary: `SUB-009-IMPLEMENTATION-SUMMARY.md`
- SQL Verification: `SUB-009-VERIFICATION.sql`
- Quick Start: `SUB-009-QUICK-FIX.md`
- Checklist: `SUB-009-CHECKLIST.md`

---

**END OF SUB-009 MANUAL TEST CASES**
