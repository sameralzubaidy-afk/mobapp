# SUB-004 Trial Reminder Notifications - Manual Testing Guide

**Module:** MODULE-11-SUBSCRIPTIONS-V2.md  
**Task:** SUB-004 - Trial Reminder Notifications (Day 23, 28, 29)  
**Date:** February 15, 2026

---

## Prerequisites

### Database Setup
Run these SQL commands in Supabase SQL Editor to verify the schema:

```sql
-- Verify user_subscriptions table has reminder columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_subscriptions'
  AND column_name IN ('trial_reminder_day_23_sent', 'trial_reminder_day_28_sent', 'trial_reminder_day_29_sent');
```

**Expected result:** 3 rows showing boolean columns.

### ⚠️ CRITICAL: Scheduler Setup (Required for Production)
**The Edge Function will NOT run automatically without a scheduler.** 

You need to set up a daily cron job. Apply the migration:

```bash
# Apply migration to create scheduled_trial_reminders() function and cron job
psql <your-supabase-connection-string> -f supabase/migrations/20260215_scheduled_trial_reminders.sql
```

**Or manually via Supabase Dashboard:**
1. Go to Database → Cron Jobs
2. Create new job:
   - Name: `trial-reminders-daily`
   - Schedule: `0 10 * * *` (10:00 AM UTC daily)
   - Command: `SELECT public.scheduled_trial_reminders();`

**Verify cron job is active:**
```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'trial-reminders-daily';
```

### Edge Function Deployment
Deploy the trial-reminders function to Supabase:

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
npx supabase functions deploy trial-reminders
```

---

## Test Case 1: Day 23 Reminder (7 Days Remaining)

### Setup
1. Create a test trial subscription with 7 days remaining:

```sql
-- Insert test subscription with trial ending in 7 days
INSERT INTO public.subscriptions (
  user_id,
  status,
  trial_start_date,
  trial_end_date,
  trial_reminder_day_23_sent,
  trial_reminder_day_28_sent,
  trial_reminder_day_29_sent
) VALUES (
  '<your-test-user-id>',
  'trial',
  NOW() - INTERVAL '23 days',
  NOW() + INTERVAL '7 days',
  false,
  false,
  false
);
```

### Manual Trigger
Call the Edge Function manually:

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/trial-reminders \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verification Steps

**Step 1: Check API Response**
- Expected HTTP Status: `200`
- Expected Response:
```json
{
  "success": true,
  "processed": 1,
  "reminders": [
    {
      "day": "23",
      "userId": "<your-test-user-id>"
    }
  ]
}
```

**Step 2: Verify Database Flag Updated**
```sql
SELECT 
  trial_reminder_day_23_sent,
  trial_reminder_day_28_sent,
  trial_reminder_day_29_sent
FROM user_subscriptions
WHERE user_id = '<your-test-user-id>';
```

**Expected:**
- `trial_reminder_day_23_sent`: `true` ✅
- `trial_reminder_day_28_sent`: `false`
- `trial_reminder_day_29_sent`: `false`

**Step 3: Check Push Notification Logs**
```sql
-- Check Supabase logs or function logs
-- Look for: "Trial reminder sent to user <user-id> (Day 23)"
```

**Step 4: Mobile App - Dashboard Banner**
1. Open the iOS/Android Simulator
2. Login with the test user account
3. Navigate to Dashboard
4. **Expected:** See blue banner with:
   - Title: "🎉 7 Days Left in Your Free Trial!"
   - Message: "Continue enjoying Kids Club+ benefits! Add a payment method to keep your Swap Points active."
   - Buttons: "Add Payment Method" and "Dismiss"

**Step 5: Test Idempotency (No Duplicate Reminders)**
Call the Edge Function again:

```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/trial-reminders \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 0,
  "reminders": []
}
```

**Database check should show NO changes** (flag still `true`, no duplicate send).

---

## Test Case 2: Day 28 Reminder (2 Days Remaining)

### Setup
Update the test subscription to have 2 days remaining:

```sql
UPDATE public.subscriptions
SET 
  trial_start_date = NOW() - INTERVAL '28 days',
  trial_end_date = NOW() + INTERVAL '2 days',
  trial_reminder_day_23_sent = true,
  trial_reminder_day_28_sent = false,
  trial_reminder_day_29_sent = false
WHERE user_id = '<your-test-user-id>';
```

### Manual Trigger
```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/trial-reminders \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verification Steps

**Step 1: Check API Response**
```json
{
  "success": true,
  "processed": 1,
  "reminders": [
    {
      "day": "28",
      "userId": "<your-test-user-id>"
    }
  ]
}
```

**Step 2: Verify Database Flag**
```sql
SELECT 
  trial_reminder_day_23_sent,
  trial_reminder_day_28_sent,
  trial_reminder_day_29_sent
FROM user_subscriptions
WHERE user_id = '<your-test-user-id>';
```

**Expected:**
- `trial_reminder_day_23_sent`: `true`
- `trial_reminder_day_28_sent`: `true` ✅
- `trial_reminder_day_29_sent`: `false`

**Step 3: Mobile App - Dashboard Banner**
- **Expected:** See orange banner with:
  - Title: "⏰ 2 Days Left in Your Free Trial"
  - Message: "Add a payment method now to keep earning and spending Swap Points. Don't lose your rewards!"

---

## Test Case 3: Day 29 Reminder (1 Day Remaining)

### Setup
Update to 1 day remaining:

```sql
UPDATE public.subscriptions
SET 
  trial_start_date = NOW() - INTERVAL '29 days',
  trial_end_date = NOW() + INTERVAL '1 day',
  trial_reminder_day_23_sent = true,
  trial_reminder_day_28_sent = true,
  trial_reminder_day_29_sent = false
WHERE user_id = '<your-test-user-id>';
```

### Manual Trigger
```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/trial-reminders \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verification Steps

**Step 1: Check API Response**
```json
{
  "success": true,
  "processed": 1,
  "reminders": [
    {
      "day": "29",
      "userId": "<your-test-user-id>"
    }
  ]
}
```

**Step 2: Verify Database Flag**
```sql
SELECT 
  trial_reminder_day_23_sent,
  trial_reminder_day_28_sent,
  trial_reminder_day_29_sent
FROM user_subscriptions
WHERE user_id = '<your-test-user-id>';
```

**Expected:**
- `trial_reminder_day_23_sent`: `true`
- `trial_reminder_day_28_sent`: `true`
- `trial_reminder_day_29_sent`: `true` ✅

**Step 3: Mobile App - Dashboard Banner**
- **Expected:** See red banner with:
  - Title: "🚨 Last Day of Your Free Trial!"
  - Message: "Your trial ends tomorrow! Subscribe now to keep your Swap Points active."

---

## Test Case 4: No Trial Subscriptions

### Setup
Delete or set all subscriptions to non-trial status:

```sql
UPDATE user_subscriptions
SET status = 'free'
WHERE status = 'trial';
```

### Manual Trigger
```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/trial-reminders \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verification

**Expected Response:**
```json
{
  "success": true,
  "message": "No trial subscriptions to process",
  "processed": 0
}
```

---

## Test Case 5: Wrong Day (No Reminder Sent)

### Setup
Create subscription with 10 days remaining (not a trigger day):

```sql
UPDATE public.subscriptions
SET 
  trial_end_date = NOW() + INTERVAL '10 days',
  trial_reminder_day_23_sent = false,
  trial_reminder_day_28_sent = false,
  trial_reminder_day_29_sent = false
WHERE user_id = '<your-test-user-id>';
```

### Manual Trigger
```bash
curl -X POST https://<your-project-ref>.supabase.co/functions/v1/trial-reminders \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Verification

**Expected Response:**
```json
{
  "success": true,
  "processed": 0,
  "reminders": []
}
```

**Database flags should remain unchanged** (all `false`).

---

## Test Case 6: Mobile UI - Banner Interaction

### Dismiss Button Test
1. Open Dashboard with trial reminder banner visible
2. Tap "Dismiss" button
3. **Expected:** Banner disappears immediately
4. Close app and reopen
5. **Expected:** Banner reappears (dismissal is session-only, not persisted)

### Add Payment Method Button Test
1. Open Dashboard with trial reminder banner visible
2. Tap "Add Payment Method" button
3. **Expected:** Navigate to SubscriptionPayment screen
4. **Expected:** Banner is dismissed

---

## Test Case 7: Banner Colors

Verify banner background color matches days remaining:

| Days Remaining | Color | Expected Background |
|----------------|-------|---------------------|
| 7 days         | Blue  | `#3B82F6`           |
| 2 days         | Orange| `#F59E0B`           |
| 1 day          | Red   | `#EF4444`           |

---

## Cleanup

After testing, clean up test data:

```sql
-- Delete test subscription
DELETE FROM user_subscriptions
WHERE user_id = '<your-test-user-id>'
  AND status = 'trial';
```

---

## Automated Testing

Run unit tests:

```bash
cd p2p-kids-marketplace
npm test -- trialReminders.test.ts
```

Run E2E tests (requires SUPABASE_SERVICE_ROLE_KEY):

```bash
cd p2p-kids-marketplace
SUPABASE_SERVICE_ROLE_KEY=<your-key> npm test -- trial-reminders.e2e.ts
```

---

## Success Criteria

✅ **All test cases pass**  
✅ **Day 23, 28, 29 reminders sent correctly**  
✅ **No duplicate reminders sent**  
✅ **Banner displays correctly on Dashboard**  
✅ **Banner colors match urgency level**  
✅ **Idempotency verified (no double-sends)**  
✅ **Database flags update correctly**  
✅ **Unit tests pass**  
✅ **E2E tests pass**

---

## Troubleshooting

### Issue: Reminder not sent
1. Check Edge Function logs in Supabase Dashboard
2. Verify `trial_ends_at` is exactly 7, 2, or 1 days in the future
3. Verify reminder flag is `false` before trigger
4. Check `send-push-notification` function is deployed

### Issue: Banner not showing
1. Verify user is logged in
2. Check user has `status = 'trial'` in `user_subscriptions`
3. Check `trial_ends_at` is within 7 days
4. Verify `TrialReminderBanner` component is imported in UserDashboardScreen
5. Check console for errors

### Issue: Push notification not received
1. Verify `push_tokens` table has entry for user
2. Check Expo push notification service status
3. Verify `send-push-notification` Edge Function deployed
4. Note: Simulators don't support push notifications (test on physical device)

---

## Next Steps

1. Set up a daily cron job in Supabase to call `trial-reminders` automatically
2. Monitor logs for first 7 days of production
3. Track conversion rate from reminded users
4. A/B test reminder messaging if needed
