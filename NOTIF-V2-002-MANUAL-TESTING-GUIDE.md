# NOTIF-V2-002: Subscription Event Notifications - Manual Testing Guide

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Task:** NOTIF-V2-002  
**Test Environment:** iOS Physical Device & Android Physical Device (Development Build)  
**Last Updated:** April 3, 2026

---

## Pre-Test Setup

###  Required Actions
1. **Install app on physical devices (development build):**
   ```bash
   cd p2p-kids-marketplace
  npx expo start --dev-client
  # Open the development build on iOS/Android device
   ```

  Notes:
  - Expo Go is not sufficient for Android push token registration.
  - Simulators/emulators are not reliable for remote push delivery tests.

2. **Create test user account:**
   - Open app → Sign Up
   - Use email: `test-notif-{timestamp}@test.com`
   - Complete onboarding
   - **Record user ID** (check console logs or profile screen)

3. **Enable notification preferences:**
   - Navigate to Profile → Notification Settings
   - Enable: Push + In-App for "Subscription" category
   - Disable: Email (for testing)
  
4. **Verify Supabase access:**
   - Open Supabase Dashboard → Table Editor
   - Confirm `user_notifications` table is accessible
   - Confirm `notification_preferences` table has entry for test user

---

## Test Cases

### **TC-N2-001: Trial Expiration Reminders (7d, 3d, 1d)**

**Objective:** Verify trial reminder notifications are sent at correct intervals

**Prerequisites:**
- Test user has active trial subscription
- Trial start date is exactly 23, 27, or 29 days ago (for 7d, 3d, 1d reminders)

**Test Steps:**
1. Open Supabase → SQL Editor
2. Run query to set trial_end_date to trigger reminder:
   ```sql
   -- For 7-day reminder (day 23)
   UPDATE user_subscriptions
   SET trial_end_date = NOW() + INTERVAL '7 days',
       trial_reminder_day_23_sent = false
   WHERE user_id = '<test-user-id>';
   
   -- Manually trigger reminder job
   SELECT * FROM public.trigger_trial_reminders();
   ```

3. Wait 5-10 seconds
4. Open app → Notifications tab
5. Verify notification appears with:
   - Title: "🎉 7 Days Left in Your Free Trial!"
   - Body mentions adding payment method
   - Deep link to subscription screen works

**Expected Results:**
- ✅ Notification created in `user_notifications` table
- ✅ Push notification received on device (if push tokens registered)
- ✅ In-app notification visible in notifications list
- ✅ Tapping notification navigates to `/profile/subscription`
- ✅ `trial_reminder_day_23_sent` flag set to `true`

**Repeat for:**

- 3-day reminder:
  ```sql
  UPDATE user_subscriptions
  SET trial_end_date = NOW() + INTERVAL '3 days',
      trial_reminder_day_28_sent = false
  WHERE user_id = '<test-user-id>';

  SELECT * FROM public.trigger_trial_reminders();
  ```
- 1-day reminder:
  ```sql
  UPDATE user_subscriptions
  SET trial_end_date = NOW() + INTERVAL '1 day',
      trial_reminder_day_29_sent = false
  WHERE user_id = '<test-user-id>';

  SELECT * FROM public.trigger_trial_reminders();
  ```

**Debug query (if push still not received):**
```sql
SELECT
  us.user_id,
  us.trial_end_date,
  us.trial_reminder_day_23_sent,
  us.trial_reminder_day_28_sent,
  us.trial_reminder_day_29_sent,
  np.push_enabled,
  np.in_app_enabled,
  (
    SELECT COUNT(*)
    FROM push_tokens pt
    WHERE pt.user_id = us.user_id
  ) AS push_token_count
FROM user_subscriptions us
LEFT JOIN notification_preferences np
  ON np.user_id = us.user_id
 AND np.category = 'subscription'
WHERE us.user_id = '<test-user-id>';
```

---

### **TC-N2-002: Subscription Renewal Success Notification**

**Objective:** Verify user receives notification when subscription renews successfully

**Prerequisites:**
- Test user has active paid subscription (not trial)
- Stripe webhook endpoint configured
- Stripe CLI installed (`stripe` command available)

#### **Setup SQL: Create/Update Paid Subscription**

Run in Supabase SQL Editor to set up test user with active paid subscription:

```sql
-- 1) Verify Kids Club+ tier exists and get tier_id
SELECT id, name, display_name
FROM public.subscription_tiers
WHERE name = 'kids_club_plus'
LIMIT 1;

-- 2) Update existing subscription row for this user (if it exists)
WITH tier AS (
  SELECT st.id
  FROM public.subscription_tiers st
  WHERE st.name = 'kids_club_plus'
  LIMIT 1
)
UPDATE public.subscriptions s
SET
  tier_id = tier.id,
  status = 'active',
  current_period_start = NOW() - INTERVAL '1 day',
  current_period_end = NOW() + INTERVAL '30 days',
  next_billing_date = NOW() + INTERVAL '30 days',
  stripe_subscription_id = COALESCE(s.stripe_subscription_id, 'sub_test_renewal_' || to_char(NOW(), 'YYYYMMDD_HH24MISS')),
  stripe_customer_id = COALESCE(s.stripe_customer_id, 'cus_test_' || to_char(NOW(), 'YYYYMMDD_HH24MISS')),
  updated_at = NOW()
FROM tier
WHERE s.user_id = '<test-user-id>';

-- 3) Insert subscription row only if missing
WITH tier AS (
  SELECT st.id
  FROM public.subscription_tiers st
  WHERE st.name = 'kids_club_plus'
  LIMIT 1
)
INSERT INTO public.subscriptions (
  user_id,
  tier_id,
  status,
  has_used_trial,
  stripe_subscription_id,
  stripe_customer_id,
  current_period_start,
  current_period_end,
  next_billing_date,
  created_at,
  updated_at
)
SELECT
  '<test-user-id>'::uuid,
  tier.id,
  'active',
  true,
  'sub_test_renewal_' || to_char(NOW(), 'YYYYMMDD_HH24MISS'),
  'cus_test_' || to_char(NOW(), 'YYYYMMDD_HH24MISS'),
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '30 days',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
FROM tier
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.user_id = '<test-user-id>'::uuid
);

-- 4) Verify final row + get IDs for Stripe CLI
SELECT
  s.id,
  s.user_id,
  s.tier_id,
  st.name AS tier_name,
  s.status,
  s.stripe_subscription_id,
  s.stripe_customer_id,
  s.current_period_start,
  s.current_period_end,
  s.next_billing_date
FROM public.user_subscriptions s
LEFT JOIN public.subscription_tiers st ON st.id = s.tier_id
WHERE s.user_id = '<test-user-id>'::uuid;
```

**Record these values for the CLI command below:**
- `stripe_subscription_id` → Note the `sub_test_...` value
- `stripe_customer_id` → Note the `cus_test_...` value

---

#### **Trigger Webhook via Stripe CLI (Recommended)**

**Option A: Using Stripe CLI (Fast & Easy)**

1. **Install Stripe CLI** (if not already installed):
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Verify installation
   stripe --version
   ```

2. **Authenticate Stripe CLI with your account:**
   ```bash
   stripe login
   # Follow the browser prompt to authorize
   ```

3. **Trigger `customer.subscription.updated` (fixture syntax required):**
   ```bash
   stripe trigger customer.subscription.updated \
    --add='subscription:customer=<stripe-customer-id>'
   ```

  **Example with your test value:**
   ```bash
   stripe trigger customer.subscription.updated \
    --add='subscription:customer=cus_UJoBTGtvYbzQrL'
   ```

  **Expected output (CLI):**
   ```
  Trigger succeeded! Check dashboard for event details.
   ```

4. **Get the generated event and IDs (needed for DB matching):**
  ```bash
  stripe events list --limit 1 --type customer.subscription.updated
  ```

  From output, copy:
  - `event.id` (example: `evt_...`)
  - `data.object.id` (subscription id, example: `sub_...`)
  - `data.object.customer` (customer id, example: `cus_...`)

5. **Update your test user to those generated Stripe IDs:**
  ```sql
  UPDATE public.subscriptions
  SET stripe_subscription_id = '<event-subscription-id>',
     stripe_customer_id = '<event-customer-id>',
     status = 'active',
     updated_at = NOW()
  WHERE user_id = '<test-user-id>'::uuid;
  ```

6. **Resend the same event to your webhook endpoint:**
  ```bash
  # Find endpoint id for stripe-webhook-subscriptions
  stripe webhook_endpoints list --limit 10

  # Resend
  stripe events resend <event-id> --webhook-endpoint <webhook-endpoint-id> --confirm
  ```

---

**Option B: Manual Webhook Trigger (Dashboard)**

If Stripe CLI is not available:
1. Open [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Find endpoint: `https://your-domain.supabase.co/functions/v1/stripe-webhook-subscriptions`
3. Click "Send test event"
4. Select event: `customer.subscription.updated`
5. Modify event JSON (click "Change JSON"):
   ```json
   {
     "type": "customer.subscription.updated",
     "data": {
       "object": {
         "id": "<stripe-subscription-id-from-sql>",
         "customer": "<stripe-customer-id-from-sql>",
         "status": "active",
         "billing_reason": "subscription_cycle",
         "current_period_start": 1743724800,
         "current_period_end": 1746316800
       }
     }
   }
   ```
6. Click "Send event"

---

**Test Steps:**

1. Run SQL setup query above
2. Run Stripe CLI flow (Option A, steps 3-6) OR manually send webhook (Option B)
3. Wait 5-10 seconds
4. Open app → Notifications tab
5. Verify notification appears

**Expected Results:**
- ✅ Notification created with title "Subscription Renewed ✅"
- ✅ Body mentions next billing date (formatted: "May 1, 2026")
- ✅ Deep link to subscription screen works
- ✅ Push notification received (if enabled)
- ✅ User preferences respected (push + in-app only if enabled)

**Verification Query:**
```sql
SELECT * FROM user_notifications
WHERE user_id = '<test-user-id>'
  AND type = 'subscription'
  AND data->>'event' = 'subscription_renewed'
ORDER BY created_at DESC
LIMIT 1;
```

---

### **TC-N2-003: Payment Failure Notification (Critical)**

**Objective:** Verify critical payment failure notifications bypass user preferences

**Prerequisites:**
- Test user has active subscription
- Notification preferences: ALL DISABLED (push, in-app, email = false)
- Stripe CLI installed

**Setup SQL:**

```sql
-- Disable all notification preferences to test "critical" bypass
UPDATE notification_preferences
SET push_enabled = false,
    in_app_enabled = false,
    email_enabled = false
WHERE user_id = '<test-user-id>'
  AND category = 'subscription';

-- Verify preferences are disabled
SELECT user_id, category, push_enabled, in_app_enabled, email_enabled
FROM notification_preferences
WHERE user_id = '<test-user-id>';
```

**Test Steps:**

1. Run setup SQL above to disable preferences
2. **Trigger payment failure webhook via Stripe CLI:**
   ```bash
   stripe trigger invoice.payment_failed \
     --add='invoice:customer=<stripe-customer-id>'
   ```

   **Alternative: Manual webhook trigger**
   1. Open Stripe Dashboard → Developers → Webhooks
   2. Send test event: `invoice.payment_failed`
   3. Modify JSON:
      ```json
      {
        "type": "invoice.payment_failed",
        "data": {
          "object": {
            "id": "in_test123",
            "subscription": "<stripe-subscription-id>",
            "attempt_count": 1
          }
        }
      }
      ```

3. Wait 5-10 seconds
4. Open app → Notifications tab

**Expected Results:**
- ✅ Notification created with title "⚠️ Payment Failed - Action Required"
- ✅ Body: "Your payment was declined. Please update your payment method..."
- ✅ **CRITICAL**: Notification received DESPITE preferences being disabled
- ✅ `data.critical` = `true` in notification record
- ✅ Push notification sent (bypasses preferences)
- ✅ In-app notification visible
- ✅ Deep link to subscription screen works

**Verification Query:**
```sql
SELECT title, message, data->>'critical' as is_critical, data->>'retry_count' as retry
FROM user_notifications
WHERE user_id = '<test-user-id>'
  AND type = 'subscription'
  AND data->>'event' = 'payment_failed'
ORDER BY created_at DESC
LIMIT 1;
```

---

### **TC-N2-004: Payment Failure Escalation (Retry 1, 2, 3)**

**Objective:** Verify payment failure messages escalate in severity

**Prerequisites:**
- Test user subscription with `payment_retry_count = 0`
- Stripe CLI installed

**Setup SQL:**

```sql
-- Reset payment retry count
UPDATE user_subscriptions
SET payment_retry_count = 0
WHERE user_id = '<test-user-id>';
```

**Test Steps:**

1. Run setup SQL to reset retry count
2. Send 3 consecutive payment failure webhooks (30 seconds apart) via Stripe CLI:

   **Retry 1:**
   ```bash
   stripe trigger invoice.payment_failed \
     --add='invoice:customer=<stripe-customer-id>'
   ```

   Wait 30 seconds, then:

   **Retry 2:**
   ```bash
   stripe trigger invoice.payment_failed \
     --add='invoice:customer=<stripe-customer-id>'
   ```

   Wait 30 seconds, then:

   **Retry 3:**
   ```bash
   stripe trigger invoice.payment_failed \
     --add='invoice:customer=<stripe-customer-id>'
   ```

3. After each webhook, check notifications tab

**Expected Results:**

**Retry 1:**
- ✅ Message: "Your payment was declined. Please update your payment method..."
- ✅ `data.retry_count` = 1

**Retry 2:**
- ✅ Message: "Your subscription payment was declined again. Please update..."
- ✅ `data.retry_count` = 2

**Retry 3:**
- ✅ Message: "Final attempt failed. Your subscription will be paused soon..."
- ✅ `data.retry_count` = 3
- ✅ User enters grace period (check `user_subscriptions` table)

---

### **TC-N2-005: Cancellation Confirmation Notification**

**Objective:** Verify user receives confirmation when subscription is cancelled

**Prerequisites:**
- Test user has active subscription
- Stripe CLI installed

**Test Steps:**

1. **Trigger cancellation webhook via Stripe CLI:**
   ```bash
   stripe trigger customer.subscription.updated \
     --add='subscription:customer=<stripe-customer-id>' \
     --add='subscription:cancel_at_period_end=true'
   ```

   **Alternative: Manual webhook trigger**
   1. Open Stripe Dashboard → Developers → Webhooks
   2. Send test event: `customer.subscription.updated`
   3. Modify JSON:
      ```json
      {
        "type": "customer.subscription.updated",
        "data": {
          "object": {
            "id": "<stripe-subscription-id>",
            "customer": "<stripe-customer-id>",
            "status": "active",
            "cancel_at_period_end": true,
            "current_period_end": 1746316800
          }
        }
      }
      ```

2. Wait 5-10 seconds
3. Open app → Notifications tab

**Expected Results:**
- ✅ Notification created with title "Subscription Cancelled"
- ✅ Body mentions: "You'll have access until May 1, 2026"
- ✅ Body mentions: "90-day grace period where your Swap Points will be frozen"
- ✅ Deep link to subscription screen works
- ✅ Push notification received (if enabled)
- ✅ User preferences respected

**Verification Query:**
```sql
SELECT * FROM user_notifications
WHERE user_id = '<test-user-id>'
  AND type = 'subscription'
  AND data->>'event' = 'subscription_cancelled'
ORDER BY created_at DESC
LIMIT 1;
```

---

### **TC-N2-006: Notification Preferences Respected (Non-Critical)**

**Objective:** Verify non-critical notifications respect user preferences

**Prerequisites:**
- Test user preferences: push = disabled, in-app = enabled

**Test Steps:**
1. Update preferences:
   ```sql
   UPDATE notification_preferences
   SET push_enabled = false,
       in_app_enabled = true
   WHERE user_id = '<test-user-id>'
     AND category = 'subscription';
   ```

2. Trigger subscription renewed webhook (TC-N2-002)
3. Wait 5-10 seconds
4. Check device for push notification
5. Open app → Notifications tab

**Expected Results:**
- ❌ NO push notification received on device
- ✅ In-app notification visible in notifications list
- ✅ Can still tap notification to navigate

---

### **TC-N2-007: Critical Notifications Bypass Preferences**

**Objective:** Verify critical notifications ignore ALL user preferences

**Prerequisites:**
- Test user preferences: ALL DISABLED (see TC-N2-003)

**Test Steps:**
1. Ensure all preferences disabled (push, in-app, email = false)
2. Trigger payment failure webhook (TC-N2-003)  
3. Check device AND app

**Expected Results:**
- ✅ Push notification received (bypasses disabled preference)
- ✅ In-app notification visible (bypasses disabled preference)
- ✅ Both channels deliver notification despite preferences

---

## Edge Cases

### **EC-N2-001: User With No Notification Preferences**

**Test:** Send notification to user who never set preferences  
**Expected:** Default to enabled (push + in-app)

### **EC-N2-002: Rapid Successive Notifications**

**Test:** Trigger 3 renewal webhooks within 10 seconds  
**Expected:** All 3 notifications created (no deduplication for different events)

### **EC-N2-003: Notification During Quiet Hours**

**Test:** Set quiet hours (10pm-8am), trigger notification at 11pm  
**Expected:** Non-critical notifications queued, critical notifications delivered immediately

---

## Cleanup After Testing

```sql
-- Delete all test notifications
DELETE FROM user_notifications
WHERE user_id = '<test-user-id>';

-- Reset notification preferences
UPDATE notification_preferences
SET push_enabled = true,
    in_app_enabled = true,
    email_enabled = false
WHERE user_id = '<test-user-id>';

-- Reset subscription state
UPDATE user_subscriptions
SET status = 'trial',
    payment_retry_count = 0,
    trial_reminder_day_23_sent = false,
    trial_reminder_day_28_sent = false,
    trial_reminder_day_29_sent = false
WHERE user_id = '<test-user-id>';
```

---

## Success Criteria

**All test cases PASS if:**
- ✅ Trial reminders sent at 7d, 3d, 1d before expiration
- ✅ Renewal success notification sent
- ✅ Payment failure notification sent (critical)
- ✅ Cancellation confirmation sent
- ✅ User preferences respected for non-critical notifications
- ✅ Critical payment notifications bypass ALL preferences
- ✅ Deep links navigate to correct screens
- ✅ Push notifications delivered when enabled

---

## Troubleshooting

### Issue: No push notifications received
**Solution:** Check push tokens table:
```sql
SELECT * FROM push_tokens WHERE user_id = '<test-user-id>';
```
If empty, register push token by opening app and logging in.

### Issue: Notifications not created in database
**Solution:** Check webhook logs:
```bash
supabase functions logs stripe-webhook-subscriptions --tail
```

### Issue: Deep links not working
**Solution:** Ensure app has deep link configuration in `app.json`:
```json
{
  "expo": {
    "scheme": "p2pkidsmarketplace"
  }
}
```
