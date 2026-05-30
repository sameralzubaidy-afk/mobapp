# MESSAGE NOTIFICATIONS - QUICK START TESTING GUIDE

**Fix Applied:** Message notifications now create BOTH push AND in-app notifications  
**Migration File:** `supabase/migrations/210_enhance_message_notifications_in_app.sql`

---

## Step 1: Apply Migration (2 minutes)

### In Supabase SQL Editor:

```bash
# 1. Open Supabase Dashboard → SQL Editor
# 2. Copy/paste the entire contents of:
#    supabase/migrations/210_enhance_message_notifications_in_app.sql
# 3. Click "Run"
```

**Expected Result:**
- ✅ "Success. No rows returned" (or similar success message)
- ✅ No errors

---

## Step 2: Verify Migration Applied (1 minute)

**Run these verification queries:**

```sql
-- 1. Check function updated
SELECT proname, length(prosrc) as function_length
FROM pg_proc
WHERE proname = 'notify_new_message';
-- Expected: One row, function_length should be ~6000-7000 characters (new version is larger)

-- 2. Check trigger is active
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname = 'on_message_insert_notify';
-- Expected: One row, tgenabled = 'O' (means enabled)
```

---

## Step 3: Manual Test - Send Test Message (3 minutes)

**Prerequisites:** You need a valid `trade_id` and two user IDs.

### Find a test trade and users:

```sql
-- Get a recent trade with buyer and seller
SELECT 
  t.id as trade_id,
  t.buyer_id,
  t.seller_id,
  bp.name as buyer_name,
  sp.name as seller_name
FROM trades t
LEFT JOIN profiles bp ON bp.user_id = t.buyer_id
LEFT JOIN profiles sp ON sp.user_id = t.seller_id
ORDER BY t.created_at DESC
LIMIT 5;
```

**Copy the `trade_id`, `buyer_id`, and `seller_id` from one row.**

---

### Send a test message:

```sql
-- Replace <trade_id> and <sender_user_id> with actual values from above
INSERT INTO messages (trade_id, sender_id, content)
VALUES (
  '<trade_id>',
  '<sender_user_id>',  -- Use either buyer_id or seller_id as sender
  'This is a test message to verify notifications work!'
);
```

**Expected Result:**
- ✅ Message inserted successfully
- ✅ No errors

---

### Verify in-app notification created:

```sql
-- Replace <recipient_user_id> with the OTHER user (not the sender)
SELECT 
  id,
  category,
  type,
  title,
  body,
  is_read,
  created_at,
  data->'tradeId' as trade_id,
  data->'messageId' as message_id,
  data->'senderName' as sender_name
FROM user_notifications
WHERE user_id = '<recipient_user_id>'
  AND type = 'new_message'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```
✅ One row returned
✅ category = 'messages'
✅ type = 'new_message'
✅ title = 'New message from <sender_name>'
✅ body = 'This is a test message to verify...'
✅ is_read = false
✅ data contains: tradeId, messageId, senderName
✅ created_at = (recent timestamp)
```

**If you see the row, the fix is working! ✅**

---

## Step 4: Mobile App Test (Physical Device Only - 10 minutes)

### Prerequisites:
- Physical iOS/Android device (push notifications don't work on emulators)
- Expo app installed and logged in as User A
- Second device or account logged in as User B
- Both users have an active trade

### Test Flow:

1. **User B** logs into mobile app
2. **User B** opens NotificationCenterScreen
   - Note the current notification count
3. **User B** puts app in background or kills it
4. **User A** opens the trade chat with User B
5. **User A** sends a message: "Testing notifications!"
6. **Check User B's device:**
   - ✅ Push notification appears within 5-10 seconds
   - ✅ Notification shows: "New message from [User A name]"
   - ✅ Notification body shows message preview
7. **User B** taps the notification
   - ✅ App opens directly to trade chat screen
   - ✅ Message is visible in the chat
8. **User B** navigates to NotificationCenterScreen
   - ✅ Message notification appears in the list
   - ✅ Shows correct sender name and message preview
   - ✅ Has unread indicator (blue dot)
9. **User B** taps the notification in the center
   - ✅ Navigates to trade chat
   - ✅ Notification marked as read (blue dot disappears)

**Test Variations:**
- ✅ App in foreground → should show in-app banner
- ✅ App in background → should show push notification
- ✅ App killed → should show push notification
- ✅ Multiple messages → each creates separate notification

---

## Step 5: Verify Push Token Registered (If Push Not Working)

If push notifications aren't arriving, check if the user has a registered push token:

```sql
-- Check if user has push token registered
SELECT 
  user_id,
  token,
  platform,
  device_id,
  created_at,
  updated_at
FROM push_tokens
WHERE user_id = '<recipient_user_id>';
```

**Expected Result:**
- ✅ At least one row returned
- ✅ `token` starts with `ExponentPushToken[...]`
- ✅ `platform` is 'ios' or 'android'
- ✅ `updated_at` is recent (within last 24 hours if app was opened)

**If no rows:**
- User needs to open the app → push token registration happens on login
- Check `NotificationSetup.tsx` component is mounted in app

---

## Step 6: Check Edge Function Logs (If Push Still Not Working)

### In Supabase Dashboard:

1. Go to **Edge Functions** → **send-push-notification**
2. Click **Logs** tab
3. Look for recent logs after sending test message

**Expected Logs:**
```
✅ "No push tokens found for user <user-id>" (if no token registered)
   OR
✅ "Push notification sent successfully" (if token registered)
```

**If you see errors:**
- Check `admin_config` table has `supabase_anon_key` configured
- Check `admin_config` table has `supabase_url` configured

```sql
-- Verify required config
SELECT key, value, is_active
FROM admin_config
WHERE key IN ('supabase_anon_key', 'supabase_url');
```

---

## Common Issues & Fixes

### Issue: "No in-app notification created"

**Cause:** Migration not applied or user_notifications table doesn't exist  
**Fix:**
- Re-run migration
- Verify table exists: `SELECT * FROM user_notifications LIMIT 1;`

---

### Issue: "Push notification not received"

**Cause 1:** No push token registered  
**Fix:** User must open app while logged in → token registers automatically

**Cause 2:** Missing Supabase URL/anon key in admin_config  
**Fix:**
```sql
-- Add Supabase URL
INSERT INTO admin_config (key, value, category, is_active)
VALUES ('supabase_url', 'https://YOUR_PROJECT.supabase.co', 'feature_flags', true)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Add anon key
INSERT INTO admin_config (key, value, category, is_active)
VALUES ('supabase_anon_key', 'YOUR_ANON_KEY', 'feature_flags', true)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

**Cause 3:** pg_net extension not enabled  
**Fix:**
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

### Issue: "Deep link doesn't work"

**Cause:** Deep link parsing expects `tradeId` in data  
**Fix:** Already included in migration — data field has `tradeId`, `messageId`, `senderId`, `senderName`

---

## Success Criteria

✅ **Database Migration Applied**
- Function `notify_new_message()` updated
- Trigger `on_message_insert_notify` active

✅ **In-App Notifications Working**
- Every message creates a `user_notifications` row
- Notifications visible in NotificationCenterScreen
- Unread count increments

✅ **Push Notifications Working**
- Push delivered to recipient's device
- Push contains sender name and message preview
- Tapping push navigates to trade chat

✅ **Deep Linking Working**
- Tapping notification opens trade chat
- Notification marked as read after tap

---

## Rollback (If Needed)

If issues occur, temporarily disable the trigger:

```sql
-- Disable trigger
ALTER TABLE messages DISABLE TRIGGER on_message_insert_notify;

-- Re-enable when ready
ALTER TABLE messages ENABLE TRIGGER on_message_insert_notify;
```

---

## Next Steps After Verification

Once you've confirmed the fix works:

1. **Deploy to Production:**
   - Run migration in production Supabase project
   - Test with real users

2. **Monitor:**
   - Check Supabase logs for any warnings from `notify_new_message`
   - Monitor `user_notifications` table size growth

3. **Optional Enhancements:**
   - Add notification preferences for messages
   - Add quiet hours enforcement
   - Add rate limiting

---

## Need Help?

**Check Logs:**
- Supabase Dashboard → Logs → check for warnings from `notify_new_message`
- Edge Functions → send-push-notification → Logs

**Verify Function Source:**
```sql
SELECT prosrc FROM pg_proc WHERE proname = 'notify_new_message';
```

**Check Recent Notifications:**
```sql
SELECT * FROM user_notifications
WHERE type = 'new_message'
ORDER BY created_at DESC
LIMIT 10;
```

---

**Estimated Total Time:** 15-20 minutes  
**Status:** Ready for Testing ✅
