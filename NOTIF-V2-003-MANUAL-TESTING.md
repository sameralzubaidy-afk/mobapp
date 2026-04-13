# NOTIF-V2-003: SP Event Notifications - Manual Testing Guide

**Task:** NOTIF-V2-003 - SP Event Notifications  
**Module:** MODULE-14-NOTIFICATIONS-V2  
**Test Environment:** iOS Simulator / Android Emulator  
**Database:** Supabase Production (no local Supabase)

> IMPORTANT: Remote push notifications from Expo/APNs/FCM do not reliably deliver on iOS/Android simulators. Use a physical device to validate push banners. Simulators can still validate in-app notification rows in `user_notifications`.

---

## Prerequisites

### 1. Run Migration
**⚠️ MUST RUN BEFORE TESTING**

```sql
-- In Supabase SQL Editor, run:
-- File: supabase/migrations/142_sp_notifications.sql
```

Copy the entire contents of `142_sp_notifications.sql` and execute in Supabase SQL Editor.

**Verification:**
```sql
-- Verify functions created
SELECT proname FROM pg_proc WHERE proname LIKE '%sp%notification%';

-- Expected results:
-- create_sp_notification
-- send_sp_transaction_notification
-- send_sp_wallet_frozen_notification
-- send_sp_low_balance_notification

-- Verify triggers created
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE '%sp%notification%';

-- Expected results:
-- trigger_sp_transaction_notification | sp_ledger
-- trigger_sp_wallet_frozen_notification | sp_wallets
-- trigger_sp_low_balance_notification | sp_wallets
```

### 2. Prepare Test Users

You'll need 2 test users:
- **Subscriber:** Active Kids Club+ subscription
- **Free User:** No subscription

**Create via Supabase:**
```sql
-- Test Subscriber (user-sub-001)
INSERT INTO subscriptions (user_id, status, tier, current_period_start, current_period_end)
VALUES (
  '<your-test-user-id-1>',
  'active',
  'kids_club_plus',
  NOW(),
  NOW() + INTERVAL '30 days'
);

-- SP Wallet for subscriber
INSERT INTO sp_wallets (user_id, available_balance, state)
VALUES ('<your-test-user-id-1>', 100, 'active');
```

### 3. Push Delivery Diagnostics

Run these checks before TC-001 if push banner does not arrive:

```sql
-- Confirm this user has at least one registered push token
SELECT user_id, token, platform, updated_at
FROM push_tokens
WHERE user_id = '<your-test-user-id-1>'
ORDER BY updated_at DESC;

-- Confirm SP push dispatch trigger exists
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trigger_sp_notification_push_dispatch';

-- Confirm push dispatch was queued (if debug_logs table exists)
SELECT process_name, message, payload, created_at
FROM debug_logs
WHERE process_name = 'dispatch_sp_notification_push'
ORDER BY created_at DESC
LIMIT 10;

-- Optional: verify DB settings and pg_net health
SELECT
   current_setting('app.supabase_url', true) AS app_supabase_url,
   current_setting('app.service_role_key', true) AS app_service_role_key,
   current_setting('app.supabase_service_role_key', true) AS app_supabase_service_role_key,
   current_setting('app.supabase_anon_key', true) AS app_supabase_anon_key;

SELECT to_regproc('net.http_post') AS net_http_post_available;
```

---

## Test Cases

### TC-001: SP Earned Notification (Subscriber)

**Objective:** Verify SP earned notification is sent when ledger insert occurs

**Preconditions:**
- Logged in as subscriber
- Active subscription exists
- SP wallet exists

**Steps:**
1. In Supabase SQL Editor, insert SP earned transaction:
   ```sql
   INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
   VALUES (
     '<wallet_id>',
     '<user_id>',
     'earn_starter_pack',
     50,
     100,
     150,
     'Welcome bonus'
   );
   ```

2. Wait 2-3 seconds

3. In app, navigate to Notifications screen
4. Pull to refresh notifications list

**Expected Results:**
✅ Notification appears with:
- Title: "🎉 +50 SP Earned!"
- Body: "You earned 50 SP as a welcome bonus!"
- Category badge: "SP Events"
- Timestamp: Just now

Note: On simulator, you may not see OS push banner even when push dispatch succeeds. Validate by checking `user_notifications` row and push token presence.

5. Tap notification

**Expected Results:**
✅ Notification detail shows:
- Full description
- Deep link button visible

6. Tap deep link button

**Expected Results:**
✅ Navigates to Swap Points Wallet screen
✅ Available balance shows 150 SP

---

### TC-002: SP Spent Notification (Subscriber)

**Objective:** Verify SP spent notification is sent when points are debited

**Preconditions:**
- Logged in as subscriber
- SP wallet has balance >= 20

**Steps:**
1. In Supabase SQL Editor, insert SP spent transaction:
   ```sql
   INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
   VALUES (
     '<wallet_id>',
     '<user_id>',
     'spend_purchase',
     -20,
     150,
     130,
     'Used SP on purchase'
   );
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ Notification appears with:
- Title: "✨ 20 SP Spent"
- Body: "You spent 20 SP on a purchase!"
- Category: SP Events

4. Tap notification → Tap deep link

**Expected Results:**
✅ Navigates to Wallet screen
✅ Balance shows 130 SP

---

### TC-003: Wallet Frozen Notification (All Users)

**Objective:** Verify wallet frozen notification sent when state changes

**Preconditions:**
- User has SP wallet with state = 'active'
- User can be subscriber or free user (notification sent to all)

**Steps:**
1. In Supabase SQL Editor, freeze wallet:
   ```sql
   UPDATE sp_wallets
   SET state = 'frozen',
       available_balance = 0
   WHERE user_id = '<user_id>';
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ Notification appears with:
- Title: "SP Wallet Frozen ❄️"
- Body: "Your Swap Points wallet has been frozen. Renew your subscription to reactivate it and continue earning SP!"
- Category: SP Events

4. Tap notification → Tap deep link

**Expected Results:**
✅ Navigates to Subscription screen
✅ Shows subscription renewal options

---

### TC-004: Low Balance Warning (Subscriber Only)

**Objective:** Verify low balance notification sent when balance < 10 SP

**Preconditions:**
- Logged in as subscriber
- Wallet balance >= 10 SP

**Steps:**
1. In Supabase SQL Editor, reduce balance below 10:
   ```sql
   UPDATE sp_wallets
   SET available_balance = 8
   WHERE user_id = '<user_id>';
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ Notification appears with:
- Title: "Low SP Balance ⚠️"
- Body: "You have only 8 SP remaining. Complete trades or challenges to earn more!"
- Category: SP Events

4. Tap notification → Tap deep link

**Expected Results:**
✅ Navigates to Discovery screen
✅ Shows items available for trade

---

### TC-005: Low Balance Deduplication (24-Hour Rule)

**Objective:** Verify low balance warning not sent twice within 24 hours

**Preconditions:**
- Just completed TC-004 (low balance notification sent)

**Steps:**
1. In Supabase SQL Editor, reduce balance further:
   ```sql
   UPDATE sp_wallets
   SET available_balance = 5
   WHERE user_id = '<user_id>';
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ NO new low balance notification appears
✅ Only the original notification exists (balance: 8 SP)

---

### TC-006: Subscription Gating - SP Earned (Free User)

**Objective:** Verify free users do NOT receive SP earned notifications

**Preconditions:**
- Logged in as free user (no subscription)
- SP wallet exists

**Steps:**
1. In Supabase SQL Editor, insert SP earned:
   ```sql
   INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
   VALUES (
     '<free_user_wallet_id>',
     '<free_user_id>',
     'earn_reward',
     10,
     0,
     10,
     'Test reward'
   );
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ NO SP earned notification appears
✅ Notification count does NOT increase

**Verification in Database:**
```sql
SELECT * FROM user_notifications
WHERE user_id = '<free_user_id>'
  AND type = 'sp_earned';

-- Expected: 0 rows
```

---

### TC-007: Subscription Gating - SP Spent (Free User)

**Objective:** Verify free users do NOT receive SP spent notifications

**Preconditions:**
- Logged in as free user

**Steps:**
1. Insert SP spent transaction for free user:
   ```sql
   INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
   VALUES (
     '<free_user_wallet_id>',
     '<free_user_id>',
     'spend_purchase',
     -5,
     10,
     5,
     'Test spend'
   );
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ NO SP spent notification appears

---

### TC-008: Subscription Gating - Low Balance (Free User)

**Objective:** Verify free users do NOT receive low balance warnings

**Preconditions:**
- Logged in as free user
- Wallet balance > 10 SP

**Steps:**
1. Reduce free user balance below 10:
   ```sql
   UPDATE sp_wallets
   SET available_balance = 3
   WHERE user_id = '<free_user_id>';
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ NO low balance notification appears

---

### TC-009: Wallet Frozen - Non-Subscriber Receives

**Objective:** Verify wallet frozen notification IS sent to non-subscribers

**Preconditions:**
- Logged in as free user

**Steps:**
1. Freeze free user's wallet:
   ```sql
   UPDATE sp_wallets
   SET state = 'frozen',
       available_balance = 0
   WHERE user_id = '<free_user_id>';
   ```

2. Wait 2-3 seconds
3. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ Wallet frozen notification DOES appear
✅ Title: "SP Wallet Frozen ❄️"
✅ Deep link works → Subscription screen

---

### TC-010: Notification Preferences - Push Disabled

**Objective:** Verify notifications respect user preferences

**Preconditions:**
- Logged in as subscriber

**Steps:**
1. Navigate to Profile → Settings → Notifications
2. Disable "SP Events" push notifications
3. Keep in-app notifications enabled
4. Save settings

5. In Supabase, insert SP earned:
   ```sql
   INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
   VALUES (
     '<wallet_id>',
     '<user_id>',
     'earn_challenge',
     15,
     130,
     145,
     'Test challenge'
   );
   ```

6. Wait 2-3 seconds

**Expected Results:**
✅ NO push notification received on device
✅ In-app notification DOES appear in Notifications screen

---

### TC-011: Notification Preferences - All Channels Disabled

**Objective:** Verify no notification created when all channels disabled

**Preconditions:**
- Logged in as subscriber

**Steps:**
1. Navigate to Profile → Settings → Notifications
2. Disable ALL channels for "SP Events":
   - Push: OFF
   - In-App: OFF
   - Email: OFF
3. Save settings

4. Insert SP earned:
   ```sql
   INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
   VALUES (
     '<wallet_id>',
     '<user_id>',
     'earn_promotion',
     20,
     145,
     165,
     'Promotion bonus'
   );
   ```

5. Wait 2-3 seconds
6. Navigate to Notifications → Pull to refresh

**Expected Results:**
✅ NO notification appears
✅ Notification count does NOT increase

---

### TC-012: Multiple Transaction Types

**Objective:** Verify correct notification body for different transaction types

**Preconditions:**
- Logged in as subscriber

**Test Matrix:**

| Transaction Type | Expected Body Contains |
|-----------------|------------------------|
| `earn_starter_pack` | "welcome bonus" |
| `earn_referral` | "referral" |
| `earn_challenge` | "challenge" |
| `earn_refund` | "refund" |
| `spend_purchase` | "purchase" |
| `spend_boost` | "boost" |

**Steps:**
1. For each transaction type, insert into sp_ledger
2. Verify notification body matches expected text

**Example:**
```sql
INSERT INTO sp_ledger (wallet_id, user_id, transaction_type, amount, balance_before, balance_after, description)
VALUES (
  '<wallet_id>',
  '<user_id>',
  'earn_referral',
  25,
  165,
  190,
  'Referral bonus'
);
```

**Expected:**
✅ Body: "You earned 25 SP from a referral!"

---

## Verification Summary

After completing all test cases, verify in Supabase:

```sql
-- Count SP notifications by type
SELECT type, COUNT(*) AS count
FROM user_notifications
WHERE category = 'sp_events'
GROUP BY type
ORDER BY type;

-- Expected results:
-- sp_earned: multiple
-- sp_spent: multiple
-- sp_wallet_frozen: 2+ (subscriber + free user)
-- sp_balance_low: 1 (subscriber only)

-- Verify gating works (no SP earned/spent for free users)
SELECT * FROM user_notifications
WHERE user_id IN (SELECT user_id FROM profiles WHERE subscription_tier = 'free')
  AND type IN ('sp_earned', 'sp_spent', 'sp_balance_low');

-- Expected: 0 rows (only sp_wallet_frozen allowed)

-- Verify all notifications have correct data structure
SELECT
  id,
  type,
  title,
  body,
  data->>'amount' AS sp_amount,
  data->>'deep_link' AS deep_link,
  channels
FROM user_notifications
WHERE category = 'sp_events'
ORDER BY created_at DESC
LIMIT 10;

-- Verify each has:
-- - title (not null)
-- - body (not null)
-- - data with keys: amount, deep_link
-- - channels array not empty
```

---

## Rollback Plan

If issues occur, rollback migration:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS trigger_sp_transaction_notification ON sp_ledger;
DROP TRIGGER IF EXISTS trigger_sp_wallet_frozen_notification ON sp_wallets;
DROP TRIGGER IF EXISTS trigger_sp_low_balance_notification ON sp_wallets;

-- Drop functions
DROP FUNCTION IF EXISTS create_sp_notification(UUID, TEXT, TEXT, TEXT, JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS send_sp_transaction_notification();
DROP FUNCTION IF EXISTS send_sp_wallet_frozen_notification();
DROP FUNCTION IF EXISTS send_sp_low_balance_notification();

-- Clean up test notifications
DELETE FROM user_notifications WHERE category = 'sp_events';
```

---

## Test Evidence Checklist

- [ ] TC-001: Screenshot of SP earned notification
- [ ] TC-002: Screenshot of SP spent notification
- [ ] TC-003: Screenshot of wallet frozen notification
- [ ] TC-004: Screenshot of low balance warning
- [ ] TC-005: Verified no duplicate low balance notification
- [ ] TC-006: Verified free user receives no SP earned notification
- [ ] TC-007: Verified free user receives no SP spent notification
- [ ] TC-008: Verified free user receives no low balance warning
- [ ] TC-009: Verified free user DOES receive wallet frozen notification
- [ ] TC-010: Verified push disabled but in-app works
- [ ] TC-011: Verified all channels disabled = no notification
- [ ] TC-012: Verified correct body text for all transaction types

---

## Notes

- All notifications should appear within 2-3 seconds of database change
- Deep links must navigate correctly
- Notification badges should update in real-time
- Pull-to-refresh should fetch latest notifications
- Timestamp format: "Just now", "5 min ago", "1 hour ago", etc.
