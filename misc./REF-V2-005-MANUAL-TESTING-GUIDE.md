# REF-V2-005: Referral Notifications - Manual Testing Guide

**Module:** MODULE-17-REFERRALS-V2  
**Task:** REF-V2-005 - Referral Notifications  
**Date:** 2026-02-01  
**Status:** Ready for Testing  
**Environment:** iOS & Android Simulators

---

## ⚠️ Important: Simulator Limitations & Workarounds

### What Works on Simulators ✅
- Database table creation and triggers
- In-app notifications (if implemented in UI)
- Deep link navigation (manual testing)
- Notification read status updates
- RLS policy verification via SQL

### What Doesn't Work on Simulators ❌
- **Push notifications** - Simulators cannot receive FCM/APNs messages
- **Real push tokens** - Simulators have placeholder tokens only

### Testing Strategy for Simulators
1. **Database Layer:** Verify notifications created via SQL ✅
2. **Service Layer:** Verify service functions return correct data ✅
3. **UI Layer:** Manually navigate instead of tap-to-deep-link ✅
4. **Push Notifications:** Defer to physical device testing (Phase 2)

---

## Prerequisites

Before testing, ensure:
1. ✅ Supabase production database is accessible
2. ✅ Migration 175_referral_notifications_v2.sql has been applied
3. ✅ Mobile app is built with latest changes (npm run build)
4. ✅ Test users have valid subscriptions (trial or active)
5. ✅ Referral codes exist for test users
6. ✅ iOS or Android simulator running (Xcode or Android Studio)

---

## Test Environment Setup

### Step 1: Apply SQL Migration

Run this in Supabase SQL Editor (Production):

```sql
-- Paste the entire content of:
-- supabase/migrations/175_referral_notifications_v2.sql

-- Then verify tables created:
SELECT tablename FROM pg_tables WHERE tablename = 'user_notifications';

-- Verify triggers created:
SELECT trigger_name FROM information_schema.triggers 
WHERE event_object_table = 'referrals';
```

Expected Results:
- ✅ `user_notifications` table exists
- ✅ 2 triggers on `referrals` table:
  - `referral_invite_accepted_trigger`
  - `referral_rewards_notification_trigger`

### Step 2: Verify Test Users

You need 2 test users:
- **User A (Referrer)**: Has referral code, active/trial subscription
- **User B (Referee)**: Will sign up with User A's code

```sql
-- Get test user IDs and referral codes:
SELECT 
  u.id as user_id,
  u.email,
  rc.code as referral_code,
  s.status as subscription_status
FROM auth.users u
LEFT JOIN referral_codes rc ON rc.user_id = u.id
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email LIKE '%test%'
ORDER BY u.created_at DESC
LIMIT 5;
```

Note down:
- User A ID: `__________________`
- User A Referral Code: `__________________`
- User B ID: `__________________`

---

## Test Case 1: Invite Accepted Notification

**Objective:** Verify referrer receives notification when referee signs up.

### Steps:

1. **Get User A's Referral Code:**
   - Open mobile app
   - Login as User A
   - Navigate to **ReferralDashboard** screen
   - Note the 8-character referral code (e.g., `abc123xy`)

2. **User B Signs Up with Referral Code:**
   - Logout or use a different device
   - Navigate to **Signup** screen
   - Enter User B's email and password
   - **Enter User A's referral code in the referral code field**
   - Complete signup

3. **Verify Referral Relationship Created:**
   ```sql
   SELECT * FROM referrals 
   WHERE referrer_id = 'USER_A_ID' 
     AND referee_id = 'USER_B_ID' 
   ORDER BY created_at DESC LIMIT 1;
   ```

   Expected:
   - ✅ Row exists with status = 'pending'
   - ✅ `referral_code` matches User A's code

4. **Verify Notification Created for User A:**
   ```sql
   SELECT * FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type = 'referral_invite_accepted'
   ORDER BY created_at DESC LIMIT 1;
   ```

   Expected:
   - ✅ Notification exists
   - ✅ Title: "Your Invite Was Accepted! 🎉"
   - ✅ Body mentions "signed up using your referral code"
   - ✅ `is_read` = false
   - ✅ `data.deep_link` = 'ReferralDashboard'
   - ✅ `data.referee_id` = User B's ID

5. **Verify Notification Created (Database Check):**
   ```sql
   -- Verify notification in database:
   SELECT type, title, body, is_read, data->>'deep_link' as deep_link
   FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type = 'referral_invite_accepted'
   ORDER BY created_at DESC LIMIT 1;
   ```

   Expected:
   - ✅ Row exists
   - ✅ Title: "Your Invite Was Accepted! 🎉"
   - ✅ Body contains "signed up"
   - ✅ `data.deep_link` = 'ReferralDashboard'
   - ✅ `is_read` = false

6. **Verify In-App Notification (if UI implemented):**
   - Open mobile app
   - Navigate to Notifications screen (if exists)
   - Should show "Your Invite Was Accepted" notification

7. **Verify Notification Not in Push Tokens (Simulator Limitation):**
   ```sql
   -- Push tokens on simulator are placeholders, so push won't be delivered
   -- This is expected - defer push testing to physical device
   SELECT * FROM push_tokens WHERE user_id = 'USER_A_ID';
   ```

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Referral row created | status = 'pending' | ☐ |
| Notification in DB | Row exists in user_notifications | ☐ |
| Title correct | "Your Invite Was Accepted! 🎉" | ☐ |
| Body mentions signup | Contains "signed up" | ☐ |
| Deep link correct | data.deep_link = 'ReferralDashboard' | ☐ |
| is_read status | false | ☐ |
| In-app notification visible | Shows in Notifications screen | ☐ |
| Push notification | N/A (simulator limitation) | ☐ |

---

## Test Case 2: Rewards Granted Notification (Referrer)

**Objective:** Verify referrer receives notification when referee completes first trade.

### Steps:

1. **User B Completes First Trade:**
   - Login as User B
   - Browse listings
   - Initiate a trade (buy an item)
   - Complete the trade flow until status = 'completed'

2. **Trigger Referral Rewards (simulate via SQL if needed):**
   ```sql
   -- If trade completion doesn't automatically trigger rewards,
   -- manually update referral status to test notification:
   UPDATE referrals
   SET status = 'completed',
       reward_granted_at = now()
   WHERE referee_id = 'USER_B_ID'
     AND status = 'pending';
   ```

3. **Verify Notification Created for User A:**
   ```sql
   SELECT * FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type = 'referral_rewards_granted'
   ORDER BY created_at DESC LIMIT 1;
   ```

   Expected:
   - ✅ Notification exists
   - ✅ Title: "You Earned 25 SP! 💰" (or configured amount)
   - ✅ Body mentions "completed their first trade"
   - ✅ Body mentions SP amount earned
   - ✅ If trial extended: "7 extra trial days"
   - ✅ `is_read` = false
   - ✅ `data.deep_link` = 'ReferralDashboard'
   - ✅ `data.sp_earned` = 25

4. **Verify Push Notification (Simulator):**
   - On simulator, push notifications won't be delivered
   - Instead, verify in-app notification or manually navigate:
   ```sql
   -- Verify notification in database:
   SELECT type, title, body, data->>'deep_link' as deep_link, 
          data->>'sp_earned' as sp_earned
   FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type = 'referral_rewards_granted'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expected: Title = "You Earned 25 SP! 💰", deep_link = 'ReferralDashboard'

5. **Verify Manual Deep Link Navigation (Simulator Workaround):**
   - Open mobile app as User A
   - Navigate manually to **ReferralDashboard** screen
   - Verify notification appears in the notifications list (if UI implemented)
   - Verify referral stats show User B as accepted referee

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Referral status updated | status = 'completed' | ☐ |
| Notification created | type = 'referral_rewards_granted' | ☐ |
| Title shows SP amount | "You Earned 25 SP!" | ☐ |
| Body mentions trade | "completed their first trade" | ☐ |
| SP amount in data | data.sp_earned = 25 | ☐ |
| Trial extension mentioned (if applicable) | "7 extra trial days" | ☐ |
| Deep link correct | 'ReferralDashboard' | ☐ |
| Push notification received | N/A (simulator limitation) | ☐ |
| Manual navigation works | ReferralDashboard shows rewards | ☐ |

---

## Test Case 3: Welcome Bonus Notification (Referee)

**Objective:** Verify referee receives welcome bonus notification.

### Steps:

1. **After User B Completes First Trade:**
   - Use same referral completion from Test Case 2

2. **Verify Notification Created for User B:**
   ```sql
   SELECT * FROM user_notifications
   WHERE user_id = 'USER_B_ID'
     AND type = 'referral_welcome_bonus'
   ORDER BY created_at DESC LIMIT 1;
   ```

   Expected:
   - ✅ Notification exists
   - ✅ Title: "Welcome Bonus: 10 SP! 🎁" (or configured amount)
   - ✅ Body mentions "completed your first trade"
   - ✅ `is_read` = false
   - ✅ `data.deep_link` = 'SpWallet'
   - ✅ `data.sp_earned` = 10

3. **Verify Notification Created (Simulator):**
   - On simulator, push won't be delivered, but database record will be created
   ```sql
   SELECT type, title, body, data->>'sp_earned' as sp_earned
   FROM user_notifications
   WHERE user_id = 'USER_B_ID'
     AND type = 'referral_welcome_bonus'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expected: Title = "Welcome Bonus: 10 SP! 🎁", sp_earned = 10

4. **Verify Manual Deep Link Navigation (Simulator):**
   - Open app as User B
   - Navigate manually to **SpWallet** screen
   - Verify SP balance increased by 10 points
   - Verify notification shows in notifications list (if UI implemented)

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Notification created | type = 'referral_welcome_bonus' | ☐ |
| Title shows SP amount | "Welcome Bonus: X SP!" | ☐ |
| Body mentions first trade | "completed your first trade" | ☐ |
| SP amount in data | data.sp_earned = 10 | ☐ |
| Deep link correct | 'SpWallet' | ☐ |
| Push notification received | N/A (simulator limitation) | ☐ |
| Manual navigation works | SpWallet shows updated balance | ☐ |

---

## Test Case 4: Subscription Gating

**Objective:** Verify rewards NOT granted if either user's subscription expired.

### Steps:

1. **Create Referral with Expired Subscription:**
   ```sql
   -- Expire User A's subscription:
   UPDATE subscriptions
   SET status = 'expired',
       subscription_end_date = now() - INTERVAL '1 day'
   WHERE user_id = 'USER_A_ID';
   ```

2. **Create New Referral and Complete Trade:**
   - Create new test User C
   - User C signs up with User A's code
   - User C completes first trade

3. **Verify NO Rewards Granted:**
   ```sql
   -- Check referral status remains 'pending':
   SELECT status FROM referrals
   WHERE referrer_id = 'USER_A_ID' AND referee_id = 'USER_C_ID';
   
   -- Should be 'pending', NOT 'completed'
   ```

4. **Verify NO Notifications Sent:**
   ```sql
   SELECT COUNT(*) FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type IN ('referral_rewards_granted', 'referral_welcome_bonus')
     AND created_at > now() - INTERVAL '5 minutes';
   ```

   Expected: Count = 0

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Referral status | Remains 'pending' | ☐ |
| No rewards notification | Count = 0 | ☐ |
| No welcome bonus notification | Count = 0 | ☐ |

---

## Test Case 5: Mark Notification as Read

**Objective:** Verify notification read status updates correctly.

### Steps:

1. **Get Unread Count:**
   - Login as User A
   - Navigate to Notifications screen (if implemented)
   - Note unread count

   Or via SQL:
   ```sql
   SELECT COUNT(*) FROM user_notifications
   WHERE user_id = 'USER_A_ID' AND is_read = false;
   ```

2. **Mark Notification as Read:**
   - Tap on a notification
   - Verify it navigates to correct screen
   - Return to notifications list
   - Verify notification shows as read

   Or via SQL:
   ```sql
   -- Get notification ID:
   SELECT id FROM user_notifications
   WHERE user_id = 'USER_A_ID' AND is_read = false LIMIT 1;
   
   -- Mark as read:
   SELECT mark_notification_read('NOTIFICATION_ID', 'USER_A_ID');
   ```

3. **Verify Read Status Updated:**
   ```sql
   SELECT is_read, read_at FROM user_notifications
   WHERE id = 'NOTIFICATION_ID';
   ```

   Expected:
   - ✅ `is_read` = true
   - ✅ `read_at` = timestamp

4. **Verify Unread Count Decreased:**
   ```sql
   SELECT get_unread_notification_count('USER_A_ID');
   ```

   Expected: Count decreased by 1

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Notification marked as read | is_read = true | ☐ |
| Read timestamp set | read_at IS NOT NULL | ☐ |
| Unread count decreased | count - 1 | ☐ |

---

## Test Case 6: Notification Deep Links (Simulator)

**Objective:** Verify deep links are configured correctly for navigation.

### Steps:

1. **Verify ReferralDashboard Deep Link Data:**
   ```sql
   SELECT data->>'deep_link' as deep_link, 
          data->>'referee_id' as referee_id
   FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type IN ('referral_invite_accepted', 'referral_rewards_granted')
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expected: deep_link = 'ReferralDashboard'

2. **Verify SpWallet Deep Link Data:**
   ```sql
   SELECT data->>'deep_link' as deep_link
   FROM user_notifications
   WHERE user_id = 'USER_B_ID'
     AND type = 'referral_welcome_bonus'
   ORDER BY created_at DESC LIMIT 1;
   ```
   Expected: deep_link = 'SpWallet'

3. **Manual Navigation Test (Simulator Workaround):**
   - On simulator, manually navigate to each target screen
   - **ReferralDashboard:** User A → Dashboard → Referrals → ReferralDashboard
   - Verify screen displays: referral stats, referee list, reward history
   - **SpWallet:** User B → Dashboard → Wallet → SpWallet
   - Verify screen shows: balance, SP ledger with welcome bonus transaction

### Expected Results:

| Notification Type | Deep Link | Data Correct | Manual Nav Works | Pass/Fail |
|-------------------|-----------|--------------|------------------|-----------|
| Invite Accepted | ReferralDashboard | ☐ | ☐ | ☐ |
| Rewards Granted | ReferralDashboard | ☐ | ☐ | ☐ |
| Welcome Bonus | SpWallet | ☐ | ☐ | ☐ |

---

## Test Case 7: Realtime Notification Subscription

**Objective:** Verify realtime notifications work when app is open (Simulator).

### Steps:

1. **Verify Realtime Subscription Code:**
   - Check if `referralNotifications.ts` has `subscribeToNotifications()` function
   - Verify it's used in Notifications screen (if implemented)
   - Confirm subscription uses Supabase Realtime: `supabase.from('user_notifications').on('INSERT', ...)`

2. **Test Realtime Without Push (Simulator):**
   - Open app as User A on simulator
   - Keep app in foreground
   - In separate terminal, run:
   ```sql
   -- Trigger notification from database:
   INSERT INTO user_notifications (
     user_id, type, title, body, data, channels
   ) VALUES (
     'USER_A_ID',
     'referral_test',
     'Realtime Test',
     'Testing realtime subscription',
     '{"deep_link": "ReferralDashboard"}'::jsonb,
     ARRAY['database']
   );
   ```

3. **Verify Notification Appears:**
   - If Notifications screen implemented: New notification appears without refresh
   - If not implemented: Verify in database that notification was created
   ```sql
   SELECT * FROM user_notifications
   WHERE user_id = 'USER_A_ID' AND type = 'referral_test'
   ORDER BY created_at DESC LIMIT 1;
   ```

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Realtime code exists | subscribeToNotifications() | ☐ |
| Subscription uses Realtime | .on('INSERT') event | ☐ |
| Notification created in DB | Row appears after INSERT | ☐ |
| In-app notification updates (if UI implemented) | Appears without refresh | ☐ |

---

## Test Case 8: Admin Config Integration (Simulator)

**Objective:** Verify SP amounts are configurable from admin side.

### Steps:

1. **Check Current SP Config:**
   ```sql
   SELECT config->>'referral_bonus_referrer' as referrer_sp,
          config->>'referral_bonus_referee' as referee_sp
   FROM admin_config WHERE id = 1;
   ```
   Note the current values (e.g., 25 and 10)

2. **Update SP Amounts:**
   ```sql
   UPDATE admin_config
   SET config = jsonb_set(
     jsonb_set(
       config,
       '{referral_bonus_referrer}',
       '50'::jsonb
     ),
     '{referral_bonus_referee}',
     '20'::jsonb
   )
   WHERE id = 1;
   
   -- Verify update:
   SELECT config->>'referral_bonus_referrer' as referrer_sp,
          config->>'referral_bonus_referee' as referee_sp
   FROM admin_config WHERE id = 1;
   ```

3. **Create New Referral and Complete Trade:**
   - Create test User D (or reuse a test account)
   - User D signs up with User A's code
   - User D completes first trade

4. **Verify Updated SP Amounts in Notifications:**
   ```sql
   -- Check referrer notification:
   SELECT title, body, data->>'sp_earned' as sp_earned
   FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type = 'referral_rewards_granted'
   ORDER BY created_at DESC LIMIT 1;
   
   -- Check referee notification:
   SELECT title, body, data->>'sp_earned' as sp_earned
   FROM user_notifications
   WHERE user_id = 'USER_D_ID'
     AND type = 'referral_welcome_bonus'
   ORDER BY created_at DESC LIMIT 1;
   ```

   Expected:
   - ✅ Referrer title: "You Earned 50 SP!" (updated amount)
   - ✅ Referee title: "Welcome Bonus: 20 SP!" (updated amount)

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| Admin config read correctly | Shows updated values | ☐ |
| Referrer notification uses config | Title: "50 SP!" | ☐ |
| Referee notification uses config | Title: "20 SP!" | ☐ |
| SP amounts persist across restarts | Values stay updated | ☐ |

---

## Test Case 9: Notification Preferences (Simulator)

**Objective:** Verify notifications respect user preferences (if implemented).

### Steps:

1. **Check If Notification Preferences Table Exists:**
   ```sql
   SELECT EXISTS (
     SELECT 1 FROM information_schema.tables 
     WHERE table_name = 'notification_preferences'
   );
   ```

2. **If Table Exists - Disable Push Notifications for User A:**
   ```sql
   UPDATE notification_preferences
   SET push_enabled = false,
       email_enabled = true,
       in_app_enabled = true
   WHERE user_id = 'USER_A_ID';
   
   -- Verify update:
   SELECT * FROM notification_preferences WHERE user_id = 'USER_A_ID';
   ```

3. **If Table Doesn't Exist - Skip to Step 4**
   - Notification preferences system not yet implemented
   - This is optional for MVP

4. **Trigger Referral Notification:**
   - Create test User E
   - User E signs up with User A's code
   - User E completes first trade

5. **Verify Notification Behavior:**
   ```sql
   -- In-app notification always created:
   SELECT * FROM user_notifications
   WHERE user_id = 'USER_A_ID'
     AND type = 'referral_rewards_granted'
   ORDER BY created_at DESC LIMIT 1;
   
   -- Check notification preferences:
   SELECT push_enabled, email_enabled, in_app_enabled
   FROM notification_preferences
   WHERE user_id = 'USER_A_ID';
   ```

### Expected Results:

| Check | Expected | Pass/Fail |
|-------|----------|-----------|
| In-app notification created | Row in user_notifications | ☐ |
| Preferences table exists | Exists (optional) | ☐ |
| Preferences respected | push_enabled=false, others true | ☐ |
| NO push to device (simulator) | N/A (simulator limitation) | ☐ |
| In-app notification visible | Shows in app list | ☐ |

---

## Regression Tests

### Regression Test 1: Existing Referrals Not Affected

**Objective:** Verify migration doesn't break existing referrals.

```sql
-- Check existing referrals still valid:
SELECT COUNT(*) FROM referrals WHERE status = 'completed';
SELECT COUNT(*) FROM referrals WHERE status = 'pending';

-- Should return existing counts, no data loss
```

### Regression Test 2: No Duplicate Notifications

**Objective:** Verify triggers don't create duplicate notifications.

```sql
-- Update same referral multiple times:
UPDATE referrals
SET status = 'completed'
WHERE id = 'TEST_REFERRAL_ID';

-- Verify only ONE notification per event:
SELECT COUNT(*) FROM user_notifications
WHERE type = 'referral_rewards_granted'
  AND data->>'referral_id' = 'TEST_REFERRAL_ID';

-- Expected: Count = 1 (no duplicates)
```

---

## Cleanup After Testing

```sql
-- Remove test notifications:
DELETE FROM user_notifications
WHERE user_id IN ('USER_A_ID', 'USER_B_ID', 'USER_C_ID')
  AND created_at > 'YYYY-MM-DD HH:MM:SS'; -- Your test start time

-- Remove test referrals (optional):
DELETE FROM referrals
WHERE referrer_id = 'USER_A_ID'
  AND referee_id IN ('USER_B_ID', 'USER_C_ID');
```

---

## Summary Checklist

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Invite Accepted Notification | ☐ Pass / ☐ Fail | |
| 2. Rewards Granted (Referrer) | ☐ Pass / ☐ Fail | |
| 3. Welcome Bonus (Referee) | ☐ Pass / ☐ Fail | |
| 4. Subscription Gating | ☐ Pass / ☐ Fail | |
| 5. Mark as Read | ☐ Pass / ☐ Fail | |
| 6. Deep Links | ☐ Pass / ☐ Fail | |
| 7. Realtime Subscription | ☐ Pass / ☐ Fail | |
| 8. Admin Config Integration | ☐ Pass / ☐ Fail | |
| 9. Notification Preferences | ☐ Pass / ☐ Fail | |
| Regression Test 1 | ☐ Pass / ☐ Fail | |
| Regression Test 2 | ☐ Pass / ☐ Fail | |

---

## Troubleshooting

### Issue: Notifications Not Created

**Check:**
1. Triggers enabled:
   ```sql
   SELECT tgenabled FROM pg_trigger WHERE tgname LIKE 'referral%';
   ```
2. Trigger functions exist:
   ```sql
   SELECT proname FROM pg_proc WHERE proname LIKE 'notify_referral%';
   ```

**Fix:** Re-run migration 175_referral_notifications_v2.sql

### Issue: Push Notifications Not Received

**Check:**
1. Push tokens saved:
   ```sql
   SELECT * FROM push_tokens WHERE user_id = 'USER_A_ID';
   ```
2. Expo push notification service running
3. Device has notifications enabled

### Issue: Deep Links Not Working

**Check:**
1. Navigation types updated with Notifications routes
2. Deep link handler implemented in AppNavigator
3. Routes match exactly: 'ReferralDashboard', 'SpWallet'

---

## Success Criteria

✅ **All test cases pass**  
✅ **Notifications created automatically via triggers**  
✅ **Push notifications delivered**  
✅ **Deep links navigate correctly**  
✅ **Read status updates work**  
✅ **Subscription gating enforced**  
✅ **No duplicate notifications**  
✅ **Admin config integration works**

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Tester | | | |
| Product Owner | | | |

---

**End of Manual Testing Guide**
