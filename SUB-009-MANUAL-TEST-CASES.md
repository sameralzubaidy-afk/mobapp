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
     grace_period_ends_at = NOW() + INTERVAL '15 days'
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
SELECT status, grace_period_ends_at, 
       EXTRACT(DAY FROM grace_period_ends_at - NOW()) as days_remaining
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
     grace_period_ends_at = NOW() + INTERVAL '7 days'
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
     grace_period_ends_at = NOW() + INTERVAL '1 day'
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

**Objective:** Verify UI hides banner when grace_period_ends_at is in the past (negative days).

**Test Steps:**

1. **Create Past Grace Period Date**
   ```sql
   UPDATE subscriptions SET 
     status = 'grace_period',
     grace_period_ends_at = NOW() - INTERVAL '2 days'
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

- TC-006: Reminder Notifications at Thresholds
  - Setup: For user, set `grace_period_ends_at` to now + N days where N is one of admin-config thresholds (default 60,30,7,1).
  - Action: Run cron manually.
  - Expect: `send-push-notification` invoked (check Edge Function logs) and a reminder flag added for that threshold in DB (e.g., `grace_reminder_sent_day_30 = true`).

- TC-007: No Duplicate Reminders
  - Setup: Ensure reminder flag for day X already true for a user.
  - Action: Run cron with same days remaining.
  - Expect: No additional notification sent; cron respects deduplication flags.

- TC-008: Expiry Transition and SP Deletion
  - Setup: Set `grace_period_ends_at` = now - 1 minute and `status = 'grace_period'` for test subscriber who has SP balance.
  - Action: Run cron manually.
  - Expect: Subscription `status` becomes `expired` (or `grace->expired`) and `SP_SUBSCRIPTION_EXPIRE_URL` handler was called (verify handler logs); subscriber's SP balance removed per policy.

- TC-009: Admin-configurable thresholds honored
  - Setup: Update `admin_config` key `grace_reminder_thresholds` to `[45,14,3]`.
  - Action: Set `grace_period_ends_at` accordingly and run cron for each threshold.
  - Expect: Notifications sent only at 45, 14, 3 days; flags recorded.

- TC-010: Edge Function Error Handling
  - Setup: Temporarily set `SP_SUBSCRIPTION_EXPIRE_URL` to an invalid URL.
  - Action: Run cron for an expiry case.
  - Expect: Grace-period cron returns structured error, logs the HTTP error, and does not leave DB in inconsistent state (no half-applied expiry).

- TC-011: Backfill / Idempotency
  - Setup: Create multiple subscriptions with past `grace_period_ends_at` values.
  - Action: Run cron twice.
  - Expect: Each subscription processed once (idempotent); no repeated SP deletion or duplicate status changes.

- TC-012: UI Post-Expiry
  - Setup: Subscription processed to `expired` by cron.
  - Action: Open dashboard.
  - Expect: No grace banner; subscription card shows "Expired" and appropriate next actions (renew/prompt).

Verification Queries
- Check admin config:
```sql
SELECT key, value FROM admin_config WHERE key = 'grace_reminder_thresholds';
```
- List grace subscriptions:
```sql
SELECT id, user_id, status, grace_period_ends_at
FROM subscriptions WHERE status IN ('grace_period','grace') ORDER BY grace_period_ends_at;
```
- Check reminder flags for a user (example):
```sql
SELECT id, grace_reminder_sent_day_60, grace_reminder_sent_day_30, grace_reminder_sent_day_7, grace_reminder_sent_day_1
FROM subscriptions WHERE user_id = '<TEST_USER_ID>';
```
- Verify expiry processed:
```sql
SELECT id, status, updated_at FROM subscriptions WHERE id = '<SUB_ID>';
```

Cleanup
- Reset test users/subscriptions using provided SQL (example):
```sql
UPDATE subscriptions SET status = 'active', grace_period_ends_at = NULL,
  grace_reminder_sent_day_60 = false, grace_reminder_sent_day_30 = false,
  grace_reminder_sent_day_7 = false, grace_reminder_sent_day_1 = false
WHERE user_id = '<TEST_USER_ID>';
-- Restore SP balances if needed using MODULE-09 test helper RPC
```

Troubleshooting
- If no notification appears: check `grace-period-cron` function logs and `send-push-notification` logs; ensure Edge Function secrets and service role keys are configured.
- If banner shows wrong number of days: verify server and device times (UTC vs local) and that `grace_period_ends_at` stored in UTC.
- If cron returns 500: inspect function logs, retry after fixing env vars; avoid re-running expiry tests until cleanup is performed.

Notes & Next Steps
- After manual tests, run Tier 0: `cd p2p-kids-marketplace && npm run typecheck && npm run lint`.
- Run unit tests for `grace-period-cron` and E2E flows for SUB-009 per the verification plan.

