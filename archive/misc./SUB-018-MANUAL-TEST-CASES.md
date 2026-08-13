# MODULE-11 TASK SUB-018: Payment Failure Handling - Manual Test Cases

**Test Environment:** iOS Simulator / Android Emulator  
**Prerequisites:** 
- Supabase staging environment configured
- Test user with active subscription
- Ability to run SQL queries in Supabase SQL Editor

---

## Test Setup

### Create Test Users

Run in Supabase SQL Editor:

```sql
-- Test User A: Active subscription, no payment issues
-- Email: test-payment-a@example.com / Password: TestPassword123!

-- Test User B: Active subscription with 1 failed payment
-- Email: test-payment-b@example.com / Password: TestPassword123!

-- Test User C: Active subscription with 2 failed payments
-- Email: test-payment-c@example.com / Password: TestPassword123!

-- Test User D: Grace period (3 failed payments)
-- Email: test-payment-d@example.com / Password: TestPassword123!

-- Simulate payment failures for Test Users B, C, D
-- (Run after users are created and have subscriptions)

-- User B: 1 failure
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = 'test-payment-b@example.com'),
  p_success := false
);

-- User C: 2 failures
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = 'test-payment-c@example.com'),
  p_success := false
);
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = 'test-payment-c@example.com'),
  p_success := false
);

-- User D: 3 failures (should auto-transition to grace_period)
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = 'test-payment-d@example.com'),
  p_success := false
);
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = 'test-payment-d@example.com'),
  p_success := false
);
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = 'test-payment-d@example.com'),
  p_success := false
);
```

---

## TC-SUB-018-01: No Payment Failure (Baseline)

**Objective:** Verify that users with no payment issues do not see the payment failure banner.

**Preconditions:**
- Test User A logged in
- User has active subscription with `payment_retry_count = 0`

**Steps:**
1. Open the app in simulator
2. Login as Test User A (`test-payment-a@example.com`)
3. Navigate to Dashboard screen

**Expected Results:**
- ✅ No payment failure banner displayed
- ✅ Dashboard displays normally
- ✅ No payment warnings or alerts

**Pass/Fail:** _____

---

## TC-SUB-018-02: First Payment Failure (Retry Count = 1)

**Objective:** Verify that first payment failure displays medium urgency banner.

**Preconditions:**
- Test User B logged in
- User has `payment_retry_count = 1`, `payment_failed_at` within last 24 hours

**Steps:**
1. Login as Test User B (`test-payment-b@example.com`)
2. Navigate to Dashboard (or any screen that renders banners)
3. Observe payment failure banner

**Expected Results:**
- ✅ Payment failure banner visible with `testID="paymentFailureBanner"`
- ✅ Title: "Payment Failed"
- ✅ Message: "Your payment was declined. Please update your payment method to keep your subscription active."
- ✅ Retry count indicator: "Retry 1 of 3 • Next retry in 3 days"
- ✅ "Update Payment Method" button visible
- ✅ "Dismiss" button visible
- ✅ Banner styling: medium urgency (orange/yellow background)

**Pass/Fail:** _____

---

## TC-SUB-018-03: Second Payment Failure (Retry Count = 2)

**Objective:** Verify that second payment failure displays high urgency banner.

**Preconditions:**
- Test User C logged in
- User has `payment_retry_count = 2`

**Preparation:**
- Reset the retry state for consistency:
  ```sql
  SELECT public.record_payment_attempt(
    p_user_id := (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com'),
    p_success := true
  );
  ```
- Confirm the subscription is back to baseline before injecting failures:
  ```sql
  SELECT payment_retry_count, payment_failed_at, status
  FROM public.subscriptions
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com');
  ```
  Expected: `payment_retry_count = 0`, `payment_failed_at = NULL`, `status = 'active'`.
  Repeat the verification after each simulated failure to ensure you land on retry count 2 before observing the banner.

**Steps:**
1. Login as Test User C (`test-payment-c@example.com`)
2. Navigate to Dashboard
3. Observe payment failure banner

**Expected Results:**
- ✅ Payment failure banner visible
- ✅ Title: "Payment Failed"
- ✅ Message: "Payment declined again. Your subscription is at risk. Please update your payment method."
- ✅ Retry count indicator: "Retry 2 of 3 • Next retry in 7 days"
- ✅ Banner styling: high urgency (red background)

**Pass/Fail:** _____

---

## TC-SUB-018-04: Max Retries Reached (Grace Period Entry)

**Objective:** Verify grace period banner for max retries (3 failures).

**Preconditions:**
- Test User D logged in
- User has `payment_retry_count = 3`, `status = 'grace_period'`

**Steps:**
1. Login as Test User D (`test-payment-d@example.com`)
2. Navigate to Dashboard
3. Observe payment failure banner

**Expected Results:**
- ✅ Payment failure banner visible
- ✅ Title: "Payment Failed"
- ✅ Message: "Your Kids Club+ access has been paused. Re-subscribe to restore Swap Points."
- ✅ NO retry count indicator displayed (max reached)
- ✅ "Update Payment Method" button visible
- ✅ Banner styling: high urgency (red background)

**Verify in Supabase:**
```sql
SELECT status, payment_retry_count, grace_started_at, grace_ends_at
FROM public.subscriptions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-payment-d@example.com');
```

Expected:
- `status = 'grace_period'`
- `payment_retry_count = 3`
- `grace_started_at` is set
- `grace_ends_at` is ~90 days from `grace_started_at`

**Pass/Fail:** _____

---

## TC-SUB-018-05: Update Payment Method Navigation

**Objective:** Verify "Update Payment Method" button navigates to ManageKidsClub screen.

**Preconditions:**
- Test User B logged in (any user with payment failure)

**Steps:**
1. Login as Test User B
2. Wait for payment failure banner to appear
3. Tap "Update Payment Method" button

**Expected Results:**
- ✅ Navigates to "Manage Kids Club+" screen
- ✅ "Update Payment Method" section is visible
- ✅ Can tap to open payment method update flow (Stripe Payment Sheet)

**Pass/Fail:** _____

---

## TC-SUB-018-06: Dismiss Payment Failure Banner

**Objective:** Verify dismissing the banner hides it temporarily.

**Preconditions:**
- Test User B logged in

**Steps:**
1. Login as Test User B
2. Wait for payment failure banner to appear
3. Tap "Dismiss" button
4. Navigate away and back to Dashboard

**Expected Results:**
- ✅ Banner disappears after tapping "Dismiss"
- ✅ Banner does NOT reappear on same session (dismissed state persists)
- ✅ If app is restarted, banner may reappear (session-level dismissal)

**Pass/Fail:** _____

---

## TC-SUB-018-07: Old Payment Failure (>24 Hours Ago)

**Objective:** Verify banner does NOT show for payment failures older than 24 hours.

**Preconditions:**
- Manually set `payment_failed_at` to 26 hours ago:

```sql
UPDATE public.subscriptions
SET payment_failed_at = NOW() - INTERVAL '26 hours'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-payment-b@example.com');
```

**Steps:**
1. Login as Test User B
2. Navigate to Dashboard

**Expected Results:**
- ✅ No payment failure banner displayed (failure is not recent)
- ✅ `usePaymentFailure.isRecentFailure` returns `false`

**Pass/Fail:** _____

---

## TC-SUB-018-08: Successful Payment Retry (Reset State)

**Objective:** Verify that successful payment resets retry count and removes banner.

**Preconditions:**
- Test User B has payment failure

**Steps:**
1. Run SQL to simulate successful payment:
```sql
SELECT public.record_payment_attempt(
  p_user_id := (SELECT id FROM auth.users WHERE email = 'test-payment-b@example.com'),
  p_success := true
);
```

2. Login as Test User B (or force refresh if already logged in)
3. Navigate to Dashboard

**Expected Results:**
- ✅ No payment failure banner displayed
- ✅ Verify in database:
```sql
SELECT payment_retry_count, payment_failed_at, status
FROM public.subscriptions
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test-payment-b@example.com');
```
- Expected: `payment_retry_count = 0`, `payment_failed_at = NULL`, `status = 'active'`

**Pass/Fail:** _____

---

## TC-SUB-018-09: Payment Retry Edge Function (No Open Invoice)

**Objective:** Verify retry-failed-payment Edge Function handles missing invoice gracefully.

**Preconditions:**
- Test User B has payment failure but NO active Stripe subscription

**Steps:**
1. Call Edge Function via Postman or curl:
```bash
curl -X POST https://[your-supabase-url]/functions/v1/retry-failed-payment \
  -H "Authorization: Bearer [user-jwt-token]" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "[user-b-id]"}'
```

**Expected Results:**
- ✅ Response: `{ "success": false, "error": { "code": "NO_OPEN_INVOICE", "message": "No open invoice found to retry" } }`
- ✅ HTTP status: 400

**Pass/Fail:** _____

---

## TC-SUB-018-10: Retry Failed Payment (Authorization Check)

**Objective:** Verify user cannot retry another user's payment.

**Steps:**
1. Login as Test User A
2. Get JWT token from session
3. Call Edge Function with Test User B's ID:
```bash
curl -X POST https://[your-supabase-url]/functions/v1/retry-failed-payment \
  -H "Authorization: Bearer [user-a-jwt-token]" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "[user-b-id]"}'
```

**Expected Results:**
- ✅ Response: `{ "success": false, "error": { "code": "FORBIDDEN", "message": "You can only retry your own payment" } }`
- ✅ HTTP status: 403

**Pass/Fail:** _____

---

## TC-SUB-018-11: Push Notification Delivery (SQL Verification + Edge Function Testing)

> **Prerequisite:** the `pg_net` extension must be enabled in your Supabase database. If you get an error about `net.http_post` not existing, run:
> ```sql
> CREATE EXTENSION IF NOT EXISTS pg_net;
> ```
> You may need admin privileges or run it via a migration. After enabling, retry the SQL query.

**Objective:** Verify push notification is sent and stored after payment failure.

**Note:** This test verifies notification delivery via SQL queries and direct edge function calls (no physical device required).

**Quick Setup - Get Your JWT Token:**

You'll need a valid JWT token for all edge function calls. Get one from your logged-in app:

1. **Via Browser Console (if testing in web):**
   ```javascript
   // In browser console:
   const token = localStorage.getItem('sb-drntwgporzabmxdqykrp-auth-token');
   const parsed = JSON.parse(token);
   console.log(parsed.session.access_token);
   ```

2. **Via Mobile App:**
   - Login with test user
   - Open React Native Debugger or Xcode console
   - Check session: `const session = await supabase.auth.getSession();`
   - Get token: `console.log(session.data.session.access_token)`

3. **Via Supabase CLI:**
   ```bash
   npx supabase gen access-token --jwt-secret your_jwt_secret
   ```

4. **Quick SQL shortcut (test token only):**
   ```sql
   -- This creates a test token for your user (use with caution)
   SELECT
     encode(
       convert_to(
         '{"sub":"' || (SELECT id FROM auth.users WHERE email='charlie.smith333@example.com') || '","aud":"authenticated","role":"authenticated","iat":' || extract(epoch from now())::bigint || ',"exp":' || (extract(epoch from now()) + 3600)::bigint || '}',
         'UTF8'
       ),
       'base64'
     ) as test_token;
   ```
   **Note:** This is a basic example. Real JWT tokens need proper signing with your signing key.

---

### Part A: Verify Push Token Registration

**Schema Reference:**
The `push_tokens` table has these columns:
- `id` (uuid, primary key)
- `user_id` (uuid)
- `token` (text, FCM token)
- `device_id` (text, device identifier)
- `platform` (text, 'ios' or 'android')
- `created_at` (timestamp)
- `updated_at` (timestamp)

Note: There is no `is_active` column. Tokens are active by default once inserted.

**Preconditions:**
- Test user (charlie.smith333@example.com) is set up with a push token

**SQL Verification Steps:**

1. Check if push token exists for your test user:
```sql
SELECT id, user_id, token, device_id, platform, created_at, updated_at
FROM public.push_tokens
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com');
```

**Expected Results:**
- ✅ One or more rows returned
- ✅ `platform` is either 'ios' or 'android'
- ✅ `token` is not null or empty
- ✅ `device_id` is set (e.g., simulator device identifier)

**If no tokens found:**
Register a test token via SQL:
```sql
INSERT INTO public.push_tokens (user_id, token, device_id, platform)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com'),
  'test-fcm-token-' || uuid_generate_v4()::text,
  'simulator-device-' || floor(random() * 1000000)::text,
  'android'
);
```

---

### Part B: Test Edge Function (Direct Call)

**Step 1: Get User ID and Prepare Request**

```sql
-- Get user ID for your test user
SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com';
-- Store this UUID as {USER_ID}
```

**Step 2: Call send-push-notification Edge Function**

**Option A: Using curl (Terminal)**

Using curl (replace `{PROJECT_REF}` with `drntwgporzabmxdqykrp`):

```bash
USER_ID="drntwgporzabmxdqykrp"
JWT_TOKEN="{YOUR_USER_JWT_TOKEN}"  # From app session or login response

curl -X POST \
  https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "title": "Payment Failed",
    "body": "Your payment was declined. Please update your payment method to keep your subscription active.",
    "data": {
      "type": "payment_failure",
      "retry_count": 1,
      "action": "update_payment"
    }
  }'
```

**Option B: Using SQL (Supabase SQL Editor) - Direct Edge Function Call**

```sql
-- Replace YOUR_USER_ID_HERE and YOUR_JWT_TOKEN_HERE with actual values
SELECT net.http_post(
  'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification',
  jsonb_build_object(
    'user_id', 'fa0db18d-2544-42cc-8e19-0055e4521076',
    'title', 'Payment Failed',
    'body', 'Your payment was declined. Please update your payment method to keep your subscription active.',
    'data', jsonb_build_object(
      'type', 'payment_failure',
      'retry_count', 1,
      'action', 'update_payment'
    )
  ),
  jsonb_build_object(
    'Authorization', 'Bearer YOUR_JWT_TOKEN_HERE',
    'Content-Type', 'application/json'
  ),
  timeout_ms := 5000
) AS response;
```

**Expected Response (curl option):**
```json
{
  "success": true,
  "message": "Notification sent to 1 device(s)",
  "notification_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "devices_sent": 1
}
```

**Notes on SQL output:**
The `net.http_post` function returns a single integer value (e.g. `83`) which represents the number of bytes received from the remote service. It is not the edge function JSON body. To verify the push actually occurred, query the `push_notifications` table (see Part C) rather than relying on the numeric return value.

---

### Part C: Verify Notification Stored in Database

**SQL Verification Steps:**

1. Check for notification record after calling edge function.

First verify the table exists:
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('push_notifications','notifications');
```

If `push_notifications` exists run the earlier query, otherwise use the more generic `notifications` table:

```sql
SELECT id, user_id, category, type, title, body, data, is_read, created_at
FROM public.notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com')
ORDER BY created_at DESC
LIMIT 5;
```

Example output from `notifications` (your schema):
```json
[
  {
    "id": "49c6d445-e1a9-473a-81eb-e3d0994dadb2",
    "user_id": "477040c4-b829-4d4e-976c-6a71c904fe77",
    "category": "system",
    "type": "referral_welcome_bonus",
    "title": "Welcome Bonus: 50 SP! 🎁",
    "body": "You completed your first trade and earned a welcome bonus of 50 SP!",
    "channels": ["push","in_app"],
    "data": "{\"deep_link\": \"SpWallet\", \"sp_earned\": 50, ...}",
    "is_read": false,
    "created_at": "2026-02-04 02:43:04.253712+00",
    "read_at": null
  }
]
```

If neither table exists, skip this step and instead verify delivery by examining
`push_notification_delivery` (if available) or by checking the edge function logs in the Supabase dashboard.
**Expected Results:**
- ✅ New row with `title = 'Payment Failed'`
- ✅ `body` matches the message sent
- ✅ `data` contains JSON: `{"type": "payment_failure", "retry_count": 1, ...}`
- ✅ `created_at` is recent (within last minute)
- ✅ `sent_at` is not null (notification delivered)

2. Check if `push_notification_delivery` table exists:
```sql
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'push_notification_delivery' 
  AND table_schema = 'public'
);
```

**If the table exists**, verify delivery status:
```sql
SELECT id, user_id, delivery_status, delivery_error, delivery_attempts
FROM public.push_notification_delivery
WHERE notification_id = '{NOTIFICATION_ID_FROM_ABOVE}';
```

**Expected Results (if table exists):**
- ✅ One row per registered push token
- ✅ `delivery_status = 'sent'`
- ✅ `delivery_attempts = 1`
- ✅ `delivery_error IS NULL`

**Note:** If the table doesn't exist, the `push_notifications` table alone is sufficient to verify delivery.

**Expected Results:**
- ✅ One row per registered push token
- ✅ `delivery_status = 'sent'`
- ✅ `delivery_attempts = 1`
- ✅ `delivery_error IS NULL`

---

### Part D: Test Multiple Retry Counts

Repeat Part B with different retry counts. Update the `body` and `retry_count` in data:

**Retry Count 2 Request (SQL):**
```sql
SELECT net.http_post(
  'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification',
  jsonb_build_object(
    'user_id', 'YOUR_USER_ID_HERE',
    'title', 'Payment Failed',
    'body', 'Your subscription payment was declined again. Please update your card or it will be paused.',
    'data', jsonb_build_object(
      'type', 'payment_failure',
      'retry_count', 2,
      'action', 'update_payment'
    )
  ),
  jsonb_build_object(
    'Authorization', 'Bearer YOUR_JWT_TOKEN_HERE',
    'Content-Type', 'application/json'
  ),
  timeout_ms := 5000
) AS response;
```

**Retry Count 3 Request (Grace Period) (SQL):**
```sql
SELECT net.http_post(
  'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification',
  jsonb_build_object(
    'user_id', 'YOUR_USER_ID_HERE',
    'title', 'Payment Failed',
    'body', 'Your Kids Club+ access has been paused. Re-subscribe to restore your Swap Points.',
    'data', jsonb_build_object(
      'type', 'payment_failure',
      'retry_count', 3,
      'action', 'resubscribe'
    )
  ),
  jsonb_build_object(
    'Authorization', 'Bearer YOUR_JWT_TOKEN_HERE',
    'Content-Type', 'application/json'
  ),
  timeout_ms := 5000
) AS response;
```

**Or use curl (Alternative):**

Retry Count 2 Request (curl):
```bash
curl -X POST \
  https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "title": "Payment Failed",
    "body": "Your subscription payment was declined again. Please update your card or it will be paused.",
    "data": {
      "type": "payment_failure",
      "retry_count": 2,
      "action": "update_payment"
    }
  }'
```

Retry Count 3 Request (curl):
```bash
curl -X POST \
  https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "title": "Payment Failed",
    "body": "Your Kids Club+ access has been paused. Re-subscribe to restore your Swap Points.",
    "data": {
      "type": "payment_failure",
      "retry_count": 3,
      "action": "resubscribe"
    }
  }'
```

**Verify each notification was created:**
```sql
SELECT title, body, data->>'retry_count' as retry_count, created_at, sent_at
FROM public.push_notifications
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com')
  AND data->>'type' = 'payment_failure'
ORDER BY created_at DESC;
```

Expected: 3 rows with retry_count 1, 2, and 3

---

### Part E: Test Authorization (Boundary Check)

**Objective:** Verify user cannot send notifications to another user.

**SQL Version:**
```sql
-- Get User A's ID (this is the logged-in user making the request)
SELECT id FROM auth.users WHERE email = 'test-payment-a@example.com';

-- Get User B's ID (the user we're trying to send to)
SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com';

-- Attempt to send notification from User A to User B (should fail)
SELECT net.http_post(
  'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification',
  jsonb_build_object(
    'user_id', 'USER_B_ID_HERE',  -- Different user ID
    'title', 'Unauthorized',
    'body', 'This should fail'
  ),
  jsonb_build_object(
    'Authorization', 'Bearer USER_A_JWT_TOKEN_HERE',  -- User A's JWT
    'Content-Type', 'application/json'
  ),
  timeout_ms := 5000
) AS response;
```

**Curl Version (Alternative):**
```bash
USER_A_ID="{USER_A_ID}"
USER_A_JWT_TOKEN="{USER_A_JWT}"  # JWT for Test User A
USER_B_ID="{USER_B_ID}"  # Attempting to send to a different user

curl -X POST \
  https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer $USER_A_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_B_ID'",
    "title": "Unauthorized",
    "body": "This should fail"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You can only send notifications to yourself"
  }
}
```

HTTP Status: 403

---

### Part F: Test with Deleted/Invalid Token

**Objective:** Verify edge function handles missing tokens gracefully.

1. Delete all push tokens for the test user:
```sql
DELETE FROM public.push_tokens
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com')
  AND platform = 'android';
```

2. Call send-push-notification edge function again:

**SQL Version:**
```sql
SELECT net.http_post(
  'https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification',
  jsonb_build_object(
    'user_id', 'YOUR_USER_ID_HERE',
    'title', 'Test with No Token',
    'body', 'Should not deliver'
  ),
  jsonb_build_object(
    'Authorization', 'Bearer YOUR_JWT_TOKEN_HERE',
    'Content-Type', 'application/json'
  ),
  timeout_ms := 5000
) AS response;
```

**Or using curl (Alternative):**
```bash
curl -X POST \
  https://drntwgporzabmxdqykrp.supabase.co/functions/v1/send-push-notification \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$USER_ID'",
    "title": "Test with No Token",
    "body": "Should not deliver"
  }'
```

**Expected Response:**
```json
{
  "success": false,
  "message": "No push tokens found for user",
  "notification_id": null
}
```

HTTP Status: 400

3. Re-register a token for next tests:
```sql
INSERT INTO public.push_tokens (user_id, token, device_id, platform)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'charlie.smith333@example.com'),
  'test-fcm-token-' || uuid_generate_v4()::text,
  'simulator-device-restored',
  'android'
);
```

---

**Pass/Fail:** _____

**Notes:**
- Requires JWT token from authenticated user session
- Can copy JWT from app localStorage, or login via API to get a fresh one
- All SQL queries can be run in Supabase SQL Editor
- FCM logs available in Supabase Edge Function logs for delivery status

---

## Test Summary

| Test Case | Pass/Fail | Notes |
|-----------|-----------|-------|
| TC-SUB-018-01 | | |
| TC-SUB-018-02 | | |
| TC-SUB-018-03 | | |
| TC-SUB-018-04 | | |
| TC-SUB-018-05 | | |
| TC-SUB-018-06 | | |
| TC-SUB-018-07 | | |
| TC-SUB-018-08 | | |
| TC-SUB-018-09 | | |
| TC-SUB-018-10 | | |
| TC-SUB-018-11 | | |

**Overall Result:** PASS / FAIL

**Tested By:** ___________  
**Date:** ___________  
**Environment:** iOS Simulator / Android Emulator  
**Build Version:** ___________
