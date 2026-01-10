# MSG-006-009 Complete Testing Guide

**Module:** MODULE-07-MESSAGING  
**Tasks:** MSG-006, MSG-007, MSG-008, MSG-009  
**Date:** 2026-01-09  
**Testing Environment:** iOS Simulator & Android Emulator (No Physical Devices)

---

## Table of Contents

1. [Prerequisites Setup](#prerequisites-setup)
2. [Environment Configuration](#environment-configuration)
3. [SendGrid Email Template Setup](#sendgrid-email-template-setup)
4. [Database Setup & Verification](#database-setup--verification)
5. [Unit Tests](#unit-tests)
6. [E2E Tests](#e2e-tests)
7. [Manual Testing with Simulators](#manual-testing-with-simulators)
8. [Troubleshooting](#troubleshooting)

---

# Prerequisites Setup

## Part 1: Verify All Migrations Applied

### Step 1: Check Database Migrations

```sql
-- Run in Supabase SQL Editor
-- Verify all required migrations exist and are applied

-- 1. Check push notification trigger (MSG-006)
SELECT tgname, tgenabled FROM pg_trigger 
WHERE tgname = 'on_message_insert_notify';
-- Expected: 1 row with tgenabled = 'O' (enabled)

-- 2. Check email columns (MSG-007)
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'messages' AND column_name = 'email_sent_at';
-- Expected: 1 row

-- 3. Check delivery status enum (MSG-008)
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'message_delivery_status'::regtype 
ORDER BY enumsortorder;
-- Expected: 3 rows (sent, delivered, read)

-- 4. Check delivery status columns (MSG-008)
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name IN ('delivery_status', 'delivered_at', 'read_at');
-- Expected: 3 rows

-- 5. Check cron job for emails (MSG-007)
SELECT jobid, jobname, schedule FROM cron.job 
WHERE jobname = 'send_message_emails_hourly';
-- Expected: 1 row with schedule = '0 * * * *'
```

**If any are missing:**
```bash
# Apply missing migrations
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app
supabase db push
```

### Step 2: Verify RPC Functions Exist

```sql
-- Verify all RPC functions created
SELECT proname FROM pg_proc 
WHERE proname LIKE 'mark_%message%' 
   OR proname LIKE 'get_unread%'
   OR proname LIKE 'update_message%';
-- Expected: At least 5 functions:
-- - mark_trade_messages_delivered
-- - mark_trade_messages_read
-- - update_message_delivery_status
-- - get_unread_messages_for_email
-- - mark_message_email_sent
```

### Step 3: Verify Admin Config Entries

```sql
-- Check MSG-007 email configuration
SELECT key, value FROM admin_config 
WHERE key IN (
  'message_email_enabled',
  'message_email_delay_hours'
);
-- Expected: 2 rows with values 'true' and '1'
```

---

## Part 2: Create Test Users & Trade

### Step 1: Create Two Test Users

```sql
-- Create test users via Supabase Auth (if not already done)
-- Use Supabase Dashboard → Authentication → Users

-- OR create via SQL:
-- Go to SQL Editor and create test users

-- For manual testing, use:
-- User A (Seller): test-seller@example.com / password123
-- User B (Buyer): test-buyer@example.com / password123

-- Get their UUIDs
SELECT id, email FROM auth.users 
WHERE email LIKE 'test-%@example.com'
ORDER BY created_at DESC LIMIT 2;
-- Copy these IDs for later steps
```

### Step 2: Create Test Trade

```sql
-- Create a test trade between the users
-- Use the UUIDs from step above

INSERT INTO trades (
  id,
  buyer_id,      -- Copy User B's UUID
  seller_id,     -- Copy User A's UUID
  item_id,       -- Use existing item or create one
  status,
  created_at,
  node_id        -- Use existing node_id
)
VALUES (
  gen_random_uuid(),
  '<USER_B_UUID>',
  '<USER_A_UUID>',
  '<ITEM_UUID>',
  'in_progress',
  NOW(),
  '<NODE_ID>'
);

-- Get the trade ID
SELECT id FROM trades 
WHERE buyer_id = '<USER_B_UUID>' 
  AND seller_id = '<USER_A_UUID>'
ORDER BY created_at DESC LIMIT 1;
-- Copy this ID for testing
```

---

# Environment Configuration

## Part 1: Set Supabase Environment Variables

### Update `.env.local` in p2p-kids-marketplace/

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Edit or create .env.local
cat > .env.local << 'EOF'
# Supabase URLs
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Push Notifications (MSG-006)
EXPO_PUBLIC_FCM_ANDROID_SENDER_ID=your-fcm-sender-id

# Optional: Sentry for error tracking
EXPO_PUBLIC_SENTRY_DSN=

# Optional: Analytics
EXPO_PUBLIC_ANALYTICS_KEY=
EOF
```

### Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to Settings → API
4. Copy:
   - Project URL → `EXPO_PUBLIC_SUPABASE_URL`
   - `anon` public key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Part 2: Configure Push Notifications

### Enable Expo Push Notifications

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Install Expo Push Token handler (if not done)
npm install expo-notifications

# For Android FCM setup
# Go to https://console.firebase.google.com
# 1. Create project or use existing
# 2. Go to Project Settings → Cloud Messaging
# 3. Copy Server Key → Keep safe for Edge Functions
# 4. Copy Sender ID → Add to .env.local as EXPO_PUBLIC_FCM_ANDROID_SENDER_ID
```

---

# SendGrid Email Template Setup

## Step 1: Create SendGrid Account & Get API Key

1. Go to [SendGrid](https://sendgrid.com)
2. Sign up or log in
3. Go to **Settings → API Keys**
4. Create New API Key
5. Copy the key (you'll need it in Supabase)

## Step 2: Create Unread Message Email Template

### Option A: Using SendGrid UI (Recommended)

1. Log in to SendGrid
2. Go to **Email API → Dynamic Templates**
3. Click **Create Template**
4. Name: `unread-message-notification`
5. Add first version by clicking **Create Version**
6. Choose **Code Editor**
7. Paste this template:

```html
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background-color: #f8f9fa; padding: 20px; text-align: center;">
    <h1 style="color: #333; margin: 0;">Kids P2P Marketplace</h1>
  </div>
  
  <div style="padding: 30px; background-color: #ffffff;">
    <h2 style="color: #333; margin-top: 0;">New Message from {{sender_name}}</h2>
    
    <p style="color: #666; font-size: 14px;">
      You have an unread message in your Kids P2P chat.
    </p>
    
    <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #007AFF; margin: 20px 0;">
      <p style="margin: 0; color: #333; font-style: italic;">
        "{{message_content}}"
      </p>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      <strong>From:</strong> {{sender_name}}<br>
      <strong>Time:</strong> {{created_at}}
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{chat_deep_link}}" style="background-color: #007AFF; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
        View Chat
      </a>
    </div>
    
    <p style="color: #999; font-size: 12px; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
      You received this email because you have an unread message in your Kids P2P Marketplace account. 
      <a href="{{unsubscribe_link}}" style="color: #007AFF;">Manage notification preferences</a>
    </p>
  </div>
</div>
```

8. Click **Save Template**
9. Copy the **Template ID** (format: `d-xxxxx`)

### Option B: Via SendGrid API

```bash
curl --request POST \
  --url https://api.sendgrid.com/v3/templates \
  --header "Authorization: Bearer $SENDGRID_API_KEY" \
  --header 'Content-Type: application/json' \
  --data '{
    "name":"unread-message-notification",
    "generation":"dynamic"
  }'

# Copy the template ID from response
```

## Step 3: Add SendGrid API Key to Supabase

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Project → Settings → Edge Functions
3. Click **Environment Variables**
4. Add new secret:
   - **Name:** `SENDGRID_API_KEY`
   - **Value:** Paste your SendGrid API Key
   - Click **Add**

## Step 4: Configure Template ID in Admin Config

```sql
-- Add SendGrid template ID to admin_config
INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active)
VALUES (
  'sendgrid_template_id_unread_message',
  'd-xxxxx',  -- Replace with your template ID
  'SendGrid dynamic template ID for unread message emails',
  'email',
  'string',
  FALSE,
  TRUE
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- Verify it was added
SELECT key, value FROM admin_config 
WHERE key = 'sendgrid_template_id_unread_message';
```

---

# Database Setup & Verification

## Full Pre-Test Verification Script

Run this in Supabase SQL Editor to verify everything:

```sql
-- ================================================================
-- COMPLETE PRE-TEST VERIFICATION
-- ================================================================

-- 1. MESSAGES TABLE STRUCTURE
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'messages' 
  AND column_name IN ('id', 'trade_id', 'sender_id', 'content', 'delivery_status', 
                       'delivered_at', 'read_at', 'email_sent_at', 'created_at')
ORDER BY ordinal_position;
-- Expected: 9 columns with correct types

-- 2. DELIVERY STATUS ENUM VALUES
SELECT enumlabel, enumsortorder 
FROM pg_enum 
WHERE enumtypid = 'message_delivery_status'::regtype 
ORDER BY enumsortorder;
-- Expected: sent (1), delivered (2), read (3)

-- 3. PUSH NOTIFICATIONS TRIGGER
SELECT tgname, tgdisabled 
FROM pg_trigger 
WHERE tgname = 'on_message_insert_notify';
-- Expected: 1 row, tgdisabled = false

-- 4. EMAIL NOTIFICATION ADMIN CONFIG
SELECT key, value, is_active 
FROM admin_config 
WHERE key IN (
  'message_email_enabled',
  'message_email_delay_hours',
  'sendgrid_template_id_unread_message',
  'sendgrid_enabled'
)
ORDER BY key;
-- Expected: 4 rows, all is_active = true

-- 5. CRON JOB FOR EMAILS
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname IN (
  'send_message_emails_hourly',
  'cleanup-expired-messages'
);
-- Expected: At least 1 row for send_message_emails_hourly

-- 6. RPC FUNCTIONS
SELECT proname, pg_get_function_identity_arguments(p.oid) as args
FROM pg_proc p
WHERE proname IN (
  'mark_trade_messages_delivered',
  'mark_trade_messages_read',
  'update_message_delivery_status',
  'get_unread_messages_for_email',
  'mark_message_email_sent'
)
  AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;
-- Expected: 5 rows

-- 7. TEST DATA SETUP
-- Create test users if needed
-- SELECT COUNT(*) as test_users 
-- FROM auth.users 
-- WHERE email LIKE 'test-%@example.com';

-- 8. AUDIT TABLES
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('message_cleanup_runs', 'message_email_runs')
ORDER BY table_name;
-- Expected: 2 rows

RAISE NOTICE '✅ All pre-test verifications complete. Ready to proceed with testing.';
```

---

# Unit Tests

## Step 1: Run Unit Tests

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Run all chat-related unit tests
npm test -- --testPathPattern="chat-notifications" --verbose

# Or run specific test file
npm test -- src/__tests__/services/chat-notifications.test.ts --verbose

# Run with coverage
npm test -- --testPathPattern="chat-notifications" --coverage
```

## Expected Output

```
PASS  src/__tests__/services/chat-notifications.test.ts

MSG-008: Message Delivery Status Tracking
  ✓ markTradeMessagesAsDelivered updates delivery_status to 'delivered' (45ms)
  ✓ markTradeMessagesAsDelivered updates delivered_at timestamp (42ms)
  ✓ markTradeMessagesAsDelivered handles errors gracefully (38ms)
  ✓ markTradeMessagesAsRead updates delivery_status to 'read' (40ms)
  ✓ markTradeMessagesAsRead updates read_at timestamp (41ms)
  ✓ markTradeMessagesAsRead handles errors gracefully (39ms)
  ✓ updateDeliveryStatus updates single message status (43ms)
  ✓ updateDeliveryStatus handles invalid status (44ms)
  ✓ updateDeliveryStatus updates all statuses (42ms)

MSG-009: Typing Indicators
  ✓ broadcastTypingStatus broadcasts to presence channel (51ms)
  ✓ broadcastTypingStatus handles true and false states (50ms)
  ✓ broadcastTypingStatus handles channel errors (52ms)
  ✓ broadcastTypingStatus throttles rapid broadcasts (100ms)
  ✓ subscribeToTypingStatus subscribes to presence updates (60ms)
  ✓ subscribeToTypingStatus unsubscribes correctly (61ms)
  ✓ subscribeToTypingStatus invokes callback on updates (59ms)
  ✓ subscribeToTypingStatus handles multiple users (62ms)

Integration Tests
  ✓ Delivery status updates trigger correctly (150ms)
  ✓ Typing + Delivery combined workflow (180ms)

Test Suites: 1 passed, 1 total
Tests: 19 passed, 19 total
Snapshots: 0 total
Time: 24.516 s
Coverage: 85% statements, 80% branches
```

## Step 2: Fix Any Failed Tests

If tests fail:

```bash
# Get detailed error output
npm test -- --testPathPattern="chat-notifications" --verbose --no-coverage

# Debug specific test
npm test -- --testPathPattern="chat-notifications" -t "markTradeMessagesAsDelivered" --verbose

# Update snapshots if needed
npm test -- --testPathPattern="chat-notifications" --updateSnapshot
```

---

# E2E Tests

## Step 1: Run E2E Tests

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Run all E2E tests for MSG-006-009
npm test -- --testPathPattern="msg-006-009" --verbose

# Or run specific E2E file
npm test -- src/__tests__/e2e/msg-006-009.e2e.ts --verbose

# Run with detailed output
npm test -- --testPathPattern="msg-006-009" --verbose --detectOpenHandles
```

## Expected Output

```
PASS  src/__tests__/e2e/msg-006-009.e2e.ts

Scenario 1: Complete Message Flow (send → delivered → read)
  ✓ User A sends message, message created with 'sent' status (120ms)
  ✓ User B opens chat, message marked as 'delivered' (150ms)
  ✓ User B views message, marked as 'read' with checkmark (140ms)

Scenario 2: Typing Indicators
  ✓ User A types, User B sees typing indicator (200ms)
  ✓ User A stops typing, indicator disappears after 3s (3200ms)
  ✓ Multiple users typing shown correctly (250ms)

Scenario 3: Push Notifications
  ✓ Message sent triggers push notification (180ms)
  ✓ Push notification has correct payload (170ms)

Scenario 4: Email Notifications
  ✓ Unread message older than 1 hour triggers email (200ms)
  ✓ Email not sent for read messages (150ms)
  ✓ Email delay configuration respected (300ms)

Scenario 5: Error Handling
  ✓ Network failure handled gracefully (500ms)
  ✓ Rapid typing doesn't cause errors (1000ms)
  ✓ Missing push token doesn't break flow (180ms)

Verification Checklist (MSG-006-009 Requirements)
  ✓ MSG-006: Push notifications sent on new message (100ms)
  ✓ MSG-006: Push notification deep link works (150ms)
  ✓ MSG-006: No push without token doesn't error (100ms)
  ✓ MSG-007: Email sent after delay (200ms)
  ✓ MSG-007: Email not sent if read (150ms)
  ✓ MSG-007: Admin can disable emails (100ms)
  ✓ MSG-008: Delivery status progresses correctly (180ms)
  ✓ MSG-008: Status icons display (120ms)
  ✓ MSG-009: Typing shows/hides correctly (2000ms)
  ✓ MSG-009: Typing is performant (300ms)

Test Suites: 1 passed, 1 total
Tests: 23 passed, 23 total
Time: 45.234 s
```

## Step 2: Fix Any Failed E2E Tests

```bash
# Run with detailed error output
npm test -- --testPathPattern="msg-006-009" --verbose --no-coverage

# Re-run failed tests
npm test -- --testPathPattern="msg-006-009" --onlyFailures --verbose

# Clear test cache if needed
npm test -- --testPathPattern="msg-006-009" --clearCache
```

---

# Manual Testing with Simulators

## Part 1: Prepare Simulators

### iOS Simulator Setup

```bash
# Start iOS Simulator
open -a Simulator

# Or with specific device
xcrun simctl boot "iPhone 15"

# Check device is running
xcrun simctl list devices
```

### Android Emulator Setup

```bash
# Start Android Emulator
$ANDROID_HOME/emulator/emulator -avd Pixel_5_API_30 &

# Or via Android Studio
# Tools → Device Manager → Select device → Play button
```

### Run App on Simulators

```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace

# Run on iOS Simulator
npm run ios

# Run on Android Emulator
npm run android

# Or use Expo Go (simpler for testing)
npm run start
# Then select simulator in the terminal menu
```

**IMPORTANT: Push Token Registration for Simulators**

For push notifications to work in simulators, the app must request and register the push token on startup:

1. **Check that notifications are being requested:**
   ```bash
   # Check the app console for:
   "Expo Push Token registered: ExponentPushToken[...]"
   
   # If you don't see this message, notifications code isn't running
   ```

2. **Manually verify push token registration:**
   ```typescript
   // In your app code (src/services/notifications.ts or similar)
   // This code should run when app starts:
   
   import * as Notifications from 'expo-notifications';
   
   export async function registerPushToken() {
     const token = await Notifications.getExpoPushTokenAsync();
     console.log('Expo Push Token:', token.data); // Should print: ExponentPushToken[...]
     
     // Save to database
     await saveTokenToDatabase(token.data);
     return token.data;
   }
   ```

3. **Test push token registration manually:**
   ```sql
   -- After app has been running for 5+ seconds:
   
   SELECT user_id, token, created_at 
   FROM push_tokens 
   ORDER BY created_at DESC LIMIT 5;
   -- You should see recent entries for your test users
   
   -- If empty, add this debug code to the app:
   -- console.log('Saving push token:', token);
   -- Then check app console logs
   ```

---



## Part 2: Test Cases

### MSG-006: Push Notifications for New Messages

#### Test Case 6-1: Send Message Triggers Push Notification

**Setup:**
- User A and User B logged in
- Both have app running in foreground (on simulators)
- Both connected to same trade
- **Important for Simulator Testing:** Push tokens must be registered from the app on startup

**Steps:**

1. **Verify Push Token Registration (on User B's Simulator):**
   
   **In App Console (simulator):**
   ```
   - User B's app should log on startup:
     "Expo Push Token registered: ExponentPushToken[...]"
   - If NOT logged, the app is not registering push tokens
   - Force close and reopen User B's app
   ```

   **Then verify in Supabase:**
   ```sql
   SELECT user_id, token, created_at 
   FROM push_tokens 
   WHERE user_id = '<USER_B_ID>'
   ORDER BY created_at DESC LIMIT 1;
   -- Expected: 1 row with token like "ExponentPushToken[...]"
   
   -- If no rows, the app code isn't calling the push token registration
   -- Check src/services/notifications.ts → requestPushPermissions()
   ```

2. **User A Sends Message:**
   ```
   - User A's device: Open Chat for trade with User B
   - Type message: "Hello, testing push notifications"
   - Send message
   ```

3. **Verify Message Inserted (Trigger Executed):**
   ```sql
   SELECT id, sender_id, content, created_at, delivery_status 
   FROM messages 
   WHERE content LIKE '%testing push%'
   ORDER BY created_at DESC LIMIT 1;
   -- Expected: 1 row with:
   --   sender_id = User A's ID
   --   delivery_status = 'sent'
   --   
   -- Message insertion automatically triggers the push notification
   -- Edge Function via the trigger on_message_insert_notify
   ```

4. **User B's Device (Simulator):**
   ```
   - Check app console for notification received
   - For iOS Simulator: Push notifications show as alerts
   - For Android Emulator: Check notification panel
   ```

5. **Verify Push Notification Trigger Executed:**
   ```sql
   -- Check if trigger is enabled
   SELECT tgname, tgenabled, tgisinternal
   FROM pg_trigger 
   WHERE tgname = 'on_message_insert_notify';
   -- Expected: tgenabled = 'O' (enabled)

   -- Confirm trigger is attached to the right table and function
   SELECT
     tgname,
     tgenabled,
     tgrelid::regclass AS table_name,
     tgfoid::regprocedure AS trigger_function
   FROM pg_trigger
   WHERE tgname = 'on_message_insert_notify';
   -- Expected: table_name = public.messages, trigger_function = public.notify_new_message()

   -- Confirm pg_net exists (required for net.http_post)
   SELECT extname, extversion
   FROM pg_extension
   WHERE extname = 'pg_net';
   -- Expected: 1 row

   -- Confirm the DB setting used to build the Edge Function URL is set
   SELECT current_setting('app.supabase_url', true) AS app_supabase_url;
   -- Expected: https://<PROJECT_REF>.supabase.co

    -- If app.supabase_url is NULL, set a fallback via admin_config (recommended)
    -- Replace <PROJECT_REF> with your real project ref.
    INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active)
    VALUES (
       'supabase_url',
       'https://<PROJECT_REF>.supabase.co',
       'Supabase project URL used by DB triggers to call Edge Functions',
       'feature_flags',
       'string',
       FALSE,
       TRUE
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
          is_active = TRUE;

    -- IMPORTANT: Edge Functions verify JWT by default.
    -- If the DB trigger calls the function without Authorization/apikey,
    -- Supabase may reject the request before the function runs (no logs).
    -- Add your project's anon key (JWT) so the trigger can authenticate.
    INSERT INTO admin_config (key, value, description, category, data_type, is_secret, is_active)
    VALUES (
       'supabase_anon_key',
       '<YOUR_SUPABASE_ANON_KEY_JWT>',
       'Supabase anon JWT used by DB triggers to call Edge Functions (Authorization/apikey)',
       'feature_flags',
       'string',
       FALSE,
       TRUE
    )
    ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value,
          is_active = TRUE;

    SELECT key, value, is_active
    FROM admin_config
    WHERE key = 'supabase_url';
   ```

6. **Check Edge Function Logs (Supabase Dashboard Method):**
   ```
   - Go to Supabase Dashboard → Project → Edge Functions
   - Click on "send-push-notification"
   - Go to "Recent Invocations" or "Logs" tab
   - You should see a recent invocation with:
     - Status: "Success" or "Error"
     - Timestamp: Recent (within last minute)
     - Request showing message_id and recipient_user_id
   ```

**Alternative for Simulator: Check Function Invocation Count**
```sql
-- Query to see if RPC function was called
-- (if you added logging to the function)

-- Or manually test the trigger:
INSERT INTO messages (
  id,
  trade_id, 
  sender_id, 
  content,
  created_at
) VALUES (
  gen_random_uuid(),
  '<TRADE_ID>',
  '<USER_A_ID>',
  'Manual trigger test',
  NOW()
);

-- This INSERT should trigger the push notification Edge Function
-- Check Supabase Dashboard → Edge Functions → send-push-notification → Logs
```

**Expected Result:** ✅ Message saved, trigger executed, no errors in Edge Function logs

---

#### Test Case 6-2: Background App Push Notification

**Setup:**
- User A and User B logged in
- User B's app will be backgrounded
- Both connected to same trade

**Steps:**

1. **User B's Device:**
   ```
   - Open the app and chat screen
   - Press Home button or use Simulator → Device → Home
   - App goes to background
   ```

2. **User A's Device:**
   ```
   - Type message: "Testing background notification"
   - Send message
   ```

3. **User B's Device:**
   ```
   - Watch for push notification alert
   - Expected: Notification banner at top
   - Notification title: "New message from [User A Name]"
   - Notification body: "Testing background notification"
   ```

4. **Tap Notification:**
   ```
   - Tap the push notification
   - App should open to Chat screen
   - Message should be visible and marked as delivered (✓✓)
   ```

5. **Verify Database:**
   ```sql
   SELECT id, delivery_status, delivered_at 
   FROM messages 
   WHERE content LIKE '%background notification%'
   ORDER BY created_at DESC LIMIT 1;
   -- Expected: delivery_status = 'delivered', delivered_at populated
   ```

**Expected Result:** ✅ Background notification delivered, deep link works

---

#### Test Case 6-3: Multiple Rapid Messages

**Setup:**
- User A and User B in chat
- Both devices in foreground

**Steps:**

1. **User A Sends 3 Messages Rapidly:**
   ```
   - Message 1: "First"
   - Message 2: "Second"  
   - Message 3: "Third"
   - Send all within 2 seconds
   ```

2. **User B's Device:**
   ```
   - Should see all 3 messages appear
   - Each message may have individual notification or batched notification
   ```

3. **Verify in Database:**
   ```sql
   SELECT id, content, created_at 
   FROM messages 
   WHERE content IN ('First', 'Second', 'Third')
   ORDER BY created_at DESC;
   -- Expected: 3 rows
   ```

**Expected Result:** ✅ All messages delivered, no message loss

---

### MSG-007: Email Notifications for Unread Messages

#### Test Case 7-1: Email Sent After 1 Hour Delay

**Setup:**
- User A sends message to User B
- User B doesn't read the message for 1+ hour

**Steps:**

1. **Send Test Message:**
   ```sql
   -- Create message older than 1 hour for testing
   INSERT INTO messages (id, trade_id, sender_id, content, created_at)
   VALUES (
     gen_random_uuid(),
     '<TRADE_ID>',
     '<USER_A_ID>',
     'Test email notification',
     NOW() - INTERVAL '2 hours'
   );
   
   SELECT id FROM messages 
   WHERE content = 'Test email notification'
   ORDER BY created_at DESC LIMIT 1;
   -- Copy message ID for later
   ```

2. **Trigger Email Cron Job Manually:**
   ```sql
   -- Run the scheduled function manually (simulating cron)
   SELECT scheduled_send_message_emails();
   ```

3. **Expected Output:**
   ```json
   {
     "run_at": "2026-01-09T12:30:00+00",
     "processed_count": 1,
     "delay_hours": 1,
     "status": "success"
   }
   ```

4. **Verify Email Was Marked Sent:**
   ```sql
   SELECT id, email_sent_at 
   FROM messages 
   WHERE content = 'Test email notification';
   -- Expected: email_sent_at populated
   ```

5. **Check User B's Email:**
   ```
   - Log into test email account (test-buyer@example.com)
   - Check inbox for email from Kids P2P Marketplace
   - Email subject: "New message from [User A Name]"
   - Email body includes message: "Test email notification"
   - Click "View Chat" link → should open app to chat screen
   ```

6. **Verify in Audit Log:**
   ```sql
   SELECT run_at, result, error 
   FROM message_email_runs 
   ORDER BY run_at DESC LIMIT 1;
   -- Expected: error = NULL, result shows processed_count = 1
   ```

**Expected Result:** ✅ Email sent after 1 hour delay

---

#### Test Case 7-2: No Email If Message Already Read

**Setup:**
- User A sends message
- User B reads the message within 1 hour

**Steps:**

1. **Send Message:**
   ```sql
   INSERT INTO messages (id, trade_id, sender_id, content, created_at)
   VALUES (
     gen_random_uuid(),
     '<TRADE_ID>',
     '<USER_A_ID>',
     'Test no-email message',
     NOW() - INTERVAL '2 hours'
   );
   ```

2. **Simulate Message Read:**
   ```sql
   -- Update status to 'read'
   UPDATE messages 
   SET delivery_status = 'read', read_at = NOW()
   WHERE content = 'Test no-email message';
   ```

3. **Trigger Email Job:**
   ```sql
   SELECT scheduled_send_message_emails();
   ```

4. **Verify No Email Sent:**
   ```sql
   SELECT email_sent_at FROM messages 
   WHERE content = 'Test no-email message';
   -- Expected: email_sent_at IS NULL
   ```

5. **Check Audit:**
   ```sql
   SELECT result FROM message_email_runs 
   ORDER BY run_at DESC LIMIT 1;
   -- Expected: processed_count = 0
   ```

**Expected Result:** ✅ No email sent for read messages

---

#### Test Case 7-3: Admin Can Disable Email Notifications

**Setup:**
- Already have unread message older than 1 hour

**Steps:**

1. **Disable Email Notifications:**
   ```sql
   UPDATE admin_config 
   SET value = 'false' 
   WHERE key = 'message_email_enabled';
   ```

2. **Trigger Email Job:**
   ```sql
   SELECT scheduled_send_message_emails();
   -- Expected output shows: "status": "disabled"
   ```

3. **Verify No Emails Processed:**
   ```sql
   SELECT result FROM message_email_runs 
   ORDER BY run_at DESC LIMIT 1;
   -- Expected: processed_count = 0, result includes "status": "disabled"
   ```

4. **Re-enable:**
   ```sql
   UPDATE admin_config 
   SET value = 'true' 
   WHERE key = 'message_email_enabled';
   ```

**Expected Result:** ✅ Email notifications can be toggled

---

### MSG-008: Message Delivery Status Tracking

#### Test Case 8-1: Status Progression (sent → delivered → read)

**Setup:**
- User A and User B in chat
- Both simulators running

**Steps:**

1. **User A Sends Message:**
   ```
   - Type: "Testing delivery status"
   - Send
   ```

2. **Check Initial Status (Should be 'sent'):**
   ```sql
   SELECT id, delivery_status, delivered_at, read_at 
   FROM messages 
   WHERE content = 'Testing delivery status'
   ORDER BY created_at DESC LIMIT 1;
   -- Expected:
   -- delivery_status: 'sent'
   -- delivered_at: NULL
   -- read_at: NULL
   ```

3. **User B Opens Chat Screen:**
   ```
   - User B's device: Open chat for this trade
   - Observe: User B is on chat screen but not looking at message
   ```

4. **Check Status Changed to 'delivered':**
   ```sql
   SELECT id, delivery_status, delivered_at, read_at 
   FROM messages 
   WHERE content = 'Testing delivery status'
   ORDER BY created_at DESC LIMIT 1;
   -- Expected:
   -- delivery_status: 'delivered'
   -- delivered_at: (timestamp populated)
   -- read_at: NULL
   ```

5. **User A's Device:**
   ```
   - Should see double checkmark (✓✓) next to message
   ```

6. **User B Views Message (3+ seconds on screen):**
   ```
   - Message visible and focused on screen for 3+ seconds
   ```

7. **Check Status Changed to 'read':**
   ```sql
   SELECT id, delivery_status, delivered_at, read_at 
   FROM messages 
   WHERE content = 'Testing delivery status'
   ORDER BY created_at DESC LIMIT 1;
   -- Expected:
   -- delivery_status: 'read'
   -- delivered_at: (timestamp from step 4)
   -- read_at: (timestamp NOW)
   ```

8. **User A's Device:**
   ```
   - Should see blue double checkmark (✓✓) or "Read" indicator
   ```

**Expected Result:** ✅ Status progresses correctly through all states

---

#### Test Case 8-2: Multiple Messages Show Individual Status

**Setup:**
- User A and User B in chat
- Both simulators running

**Steps:**

1. **User A Sends 3 Messages:**
   ```
   - Message 1: "Status test 1"
   - Message 2: "Status test 2"
   - Message 3: "Status test 3"
   ```

2. **User B Opens Chat (without reading):**
   ```
   - Chat screen visible but not scrolled to messages
   - Messages are in chat list
   ```

3. **Check Each Message Status:**
   ```sql
   SELECT content, delivery_status, delivered_at 
   FROM messages 
   WHERE content LIKE 'Status test%'
   ORDER BY created_at;
   -- Expected: All show delivery_status = 'delivered'
   ```

4. **User B Scrolls to View Message 1 (3+ seconds):**
   ```
   - Keep message 1 visible for 3+ seconds
   ```

5. **Check Message 1 Status:**
   ```sql
   SELECT content, delivery_status, read_at 
   FROM messages 
   WHERE content = 'Status test 1';
   -- Expected: delivery_status = 'read', read_at populated
   ```

6. **Verify Messages 2 & 3 Still Show 'delivered':**
   ```sql
   SELECT content, delivery_status 
   FROM messages 
   WHERE content IN ('Status test 2', 'Status test 3')
   ORDER BY content;
   -- Expected: Both show delivery_status = 'delivered'
   ```

7. **User B Scrolls to View All 3:**
   ```
   - All 3 messages visible for 3+ seconds
   ```

8. **Check All Show 'read':**
   ```sql
   SELECT content, delivery_status 
   FROM messages 
   WHERE content LIKE 'Status test%'
   ORDER BY content;
   -- Expected: All show delivery_status = 'read'
   ```

**Expected Result:** ✅ Each message tracks status independently

---

### MSG-009: Typing Indicators

#### Test Case 9-1: Typing Indicator Shows When User Types

**Setup:**
- User A and User B in same chat
- Both simulators side-by-side (split screen recommended)

**Steps:**

1. **User A's Device:**
   ```
   - Focus on text input field
   - Type first character of message
   ```

2. **User B's Device:**
   ```
   - Should see typing indicator appear within 1 second
   - Text shows: "[User A Name] is typing..."
   - Or animated dots: ● ● ●
   ```

3. **User A Continues Typing:**
   ```
   - Type full message: "Testing typing indicator"
   - Take 10+ seconds total
   ```

4. **User B's Device:**
   ```
   - Indicator should remain visible while typing
   - Should NOT flash on/off with each keystroke (throttled)
   ```

5. **User A Stops Typing:**
   ```
   - User A: Stop typing for 3+ seconds
   - Don't send the message
   ```

6. **User B's Device:**
   ```
   - Typing indicator should disappear after 3 seconds
   ```

7. **User A Resumes Typing:**
   ```
   - Type one more character
   ```

8. **User B's Device:**
   ```
   - Typing indicator should reappear within 1 second
   ```

**Expected Result:** ✅ Typing indicator shows/hides correctly

---

#### Test Case 9-2: Typing Stops When Message Sent

**Setup:**
- User A and User B in chat

**Steps:**

1. **User A Types and Sends Message:**
   ```
   - Type: "Typing then sending"
   - Send message
   ```

2. **User B's Device:**
   ```
   - Should see typing indicator while User A was typing
   - Indicator should disappear immediately when message sent
   - Message should appear instead
   ```

3. **Verify in Database:**
   ```sql
   SELECT content, delivery_status 
   FROM messages 
   WHERE content = 'Typing then sending'
   ORDER BY created_at DESC LIMIT 1;
   -- Expected: 1 row with delivery_status = 'sent' or 'delivered'
   ```

**Expected Result:** ✅ Typing indicator clears on send

---

#### Test Case 9-3: Rapid Typing Doesn't Cause Lag

**Setup:**
- User A and User B in chat

**Steps:**

1. **User A Types Rapidly:**
   ```
   - Hold down text input and type very quickly
   - Type 100+ characters within 2 seconds
   ```

2. **Monitor Performance:**
   ```
   - User A's device: Should NOT lag or freeze
   - Input should be responsive
   - Characters should appear smoothly
   ```

3. **User B's Device:**
   ```
   - Typing indicator should be stable (not flashing)
   - Should update every 3 seconds max (throttled)
   - No excessive bandwidth usage
   ```

4. **Check Realtime Connection:**
   ```javascript
   // In Supabase Dashboard → Realtime → Presence
   // Should show reasonable message frequency
   // NOT 100+ presence updates per second
   ```

**Expected Result:** ✅ No lag, updates are throttled properly

---

#### Test Case 9-4: Multiple Simultaneous Typers (Future Proofing)

**Setup:**
- 2+ simulators/devices if available
- All in same chat

**Steps:**

1. **User A Starts Typing:**
   ```
   - User A types character
   ```

2. **User B Starts Typing (While A Still Typing):**
   ```
   - User B types character
   ```

3. **All Other Users' Devices:**
   ```
   - Should see both typing indicators
   - Text: "User A and User B are typing..."
   - Or similar multi-user format
   ```

**Expected Result:** ✅ Multiple typers handled gracefully

---

## Part 3: Manual Test Summary

Create a test results file:

```bash
cat > /Users/sameralzubaidi/Desktop/kids_marketplace_app/MSG-006-009-TEST-RESULTS.md << 'EOF'
# MSG-006-009 Manual Test Results

**Test Date:** 2026-01-09  
**Tester:** [Your Name]  
**Environment:** iOS Simulator + Android Emulator

## MSG-006: Push Notifications

- [ ] Test 6-1: Send message triggers push (foreground) - PASS/FAIL
- [ ] Test 6-2: Background app receives push - PASS/FAIL
- [ ] Test 6-3: Multiple rapid messages - PASS/FAIL

**Notes:**

---

## MSG-007: Email Notifications

- [ ] Test 7-1: Email sent after 1 hour - PASS/FAIL
- [ ] Test 7-2: No email if already read - PASS/FAIL
- [ ] Test 7-3: Admin can disable emails - PASS/FAIL

**Notes:**

---

## MSG-008: Delivery Status Tracking

- [ ] Test 8-1: Status progression (sent → delivered → read) - PASS/FAIL
- [ ] Test 8-2: Multiple messages independent status - PASS/FAIL

**Notes:**

---

## MSG-009: Typing Indicators

- [ ] Test 9-1: Indicator shows when typing - PASS/FAIL
- [ ] Test 9-2: Indicator clears on send - PASS/FAIL
- [ ] Test 9-3: No lag with rapid typing - PASS/FAIL
- [ ] Test 9-4: Multiple typers (future) - PASS/FAIL

**Notes:**

---

## Overall Summary

**Total Tests:** 11  
**Passed:** ___  
**Failed:** ___  
**Deferred:** ___  

**Critical Issues Found:**
- [ ] None
- [ ] Yes (list below)

---

**Sign-off:** ________________  
**Date:** ________________
EOF

# Open the file to fill in results
open /Users/sameralzubaidi/Desktop/kids_marketplace_app/MSG-006-009-TEST-RESULTS.md
```

---

# Troubleshooting

## Push Notifications Not Working

### Issue: No push notification received

**Diagnosis Steps:**

```bash
# 1. Check push token registered
npm run expo-push-console

# 2. Check app console logs for token registration
# Look for: "Expo Push Token registered: ExponentPushToken[...]"
```

```sql
-- 3. Check token in database
SELECT user_id, token, created_at 
FROM push_tokens 
WHERE user_id = '<USER_ID>'
ORDER BY created_at DESC;
-- Should have recent entry from when app started

-- 4. Check if trigger is enabled
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_message_insert_notify';
-- Expected: tgenabled = true

-- 5. Test trigger manually
INSERT INTO messages (
  id, trade_id, sender_id, content, created_at
) VALUES (
  gen_random_uuid(),
  '<TRADE_ID>',
  '<USER_A_ID>',
  'Test push notification',
  NOW()
);

-- Check Supabase Dashboard → Edge Functions → send-push-notification → Logs
-- Should show recent invocation
```

**Solutions:**

1. **Push token not registering (empty push_tokens table):**
   
   Check your app's notification setup code:
   ```typescript
   // File: p2p-kids-marketplace/src/services/notifications.ts (or similar)
   
   // This function should be called on app startup
   export async function initializePushNotifications(userId: string) {
     try {
       const token = await Notifications.getExpoPushTokenAsync();
       console.log('Push Token:', token.data);
       
       // Save to database
       await supabase
         .from('push_tokens')
         .insert({
           user_id: userId,
           token: token.data,
           created_at: new Date()
         })
         .select();
         
       console.log('✅ Push token saved');
     } catch (error) {
       console.error('❌ Push token error:', error);
     }
   }
   
   // Then call in your auth/login component:
   // useEffect(() => {
   //   initializePushNotifications(user.id);
   // }, [user]);
   ```

2. **Re-register push token manually:**
   ```bash
   # Delete app from simulator
   npm run ios  # Fresh install
   
   # App should now register token on login
   # Verify with:
   SELECT COUNT(*) FROM push_tokens 
   WHERE created_at > NOW() - INTERVAL '1 minute';
   ```

3. **Check FCM setup (Android only):**
   - Firebase Console → Project Settings → Cloud Messaging
   - Copy Server Key
   - Add to Supabase → Settings → Edge Functions → Environment Variables
   - Key name: `FCM_SERVER_KEY`

4. **Check Expo push notifications service:**
   ```bash
   # In app console, you should see token starting with:
   # ExponentPushToken[...]
   
   # If not, check src/services/notifications.ts for errors
   # Look for console.error logs
   ```

5. **For iOS Simulator specifically:**
   ```bash
   # iOS doesn't support real push notifications in simulator
   # But you can test the full flow:
   # - Token registration: ✅ Works
   # - Trigger execution: ✅ Works
   # - Edge Function call: ✅ Works
   # - Actual notification display: ❌ Won't show (simulator limitation)
   
   # Instead, check:
   # 1. Token in database
   # 2. Edge Function logs in Supabase Dashboard
   # 3. No errors in console
   ```

### Issue: edge_logs table doesn't exist

**Solution:**

The `edge_logs` table doesn't exist in Supabase by default. Instead, use these methods:

**Method 1: Check Supabase Dashboard (Recommended)**
```
1. Go to Supabase Dashboard
2. Select your project
3. Go to Edge Functions
4. Click "send-push-notification"
5. Go to "Recent Invocations" tab
6. Should show:
   - Timestamp of last call
   - Status: Success/Error
   - Request/Response details
```

**Method 2: Query messages table instead**
```sql
-- Instead of checking edge_logs, verify the trigger was executed
-- by checking if the message was inserted

SELECT id, sender_id, content, created_at, delivery_status 
FROM messages 
WHERE content = 'Test push notification'
ORDER BY created_at DESC LIMIT 1;

-- If message exists, trigger was executed
-- The trigger calls the push notification Edge Function
```

**Method 3: Test Edge Function directly**
```bash
# If you have the Edge Function deployed, test it:

curl -X POST \
  'https://your-project.supabase.co/functions/v1/send-push-notification' \
  -H 'Authorization: Bearer your-service-role-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "message_id": "test-message-id",
    "recipient_user_id": "test-user-id",
    "sender_name": "Test Sender",
    "message_preview": "Test message"
  }'

# Expected response:
# {"success": true, "sent": 1, "failed": 0}
```

---

## Emails Not Sending

### Issue: Email notifications not arriving

**Diagnosis Steps:**

```sql
-- 1. Check email config
SELECT key, value FROM admin_config 
WHERE key IN ('message_email_enabled', 'message_email_delay_hours');

-- 2. Check cron job ran
SELECT run_at, result, error 
FROM message_email_runs 
ORDER BY run_at DESC LIMIT 5;

-- 3. Check messages marked
SELECT COUNT(*) as messages_with_email_sent
FROM messages 
WHERE email_sent_at IS NOT NULL;
```

**Solutions:**

1. **Check SendGrid API key:**
   ```bash
   # Supabase Dashboard → Settings → Edge Functions → Environment Variables
   # Verify SENDGRID_API_KEY is set
   ```

2. **Verify template ID:**
   ```sql
   SELECT value FROM admin_config 
   WHERE key = 'sendgrid_template_id_unread_message';
   -- Should return template ID like: d-xxxxx
   ```

3. **Test SendGrid directly:**
   ```bash
   curl --request POST \
     --url https://api.sendgrid.com/v3/mail/send \
     --header "Authorization: Bearer $SENDGRID_API_KEY" \
     --header 'Content-Type: application/json' \
     --data '{
       "personalizations": [{
         "to": [{"email": "test-buyer@example.com"}],
         "dynamic_template_data": {
           "sender_name": "Test Sender",
           "message_content": "Test message"
         }
       }],
       "from": {"email": "noreply@kidsp2p.com"},
       "template_id": "d-xxxxx"
     }'
   ```

4. **Check spam folder:**
   - In test email account, check spam/junk folder
   - Add noreply@kidsp2p.com to contacts

---

## Delivery Status Not Updating

### Issue: Messages stuck on 'sent' status

**Diagnosis Steps:**

```sql
-- 1. Check RPC functions exist
SELECT proname FROM pg_proc 
WHERE proname LIKE '%message%' 
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 2. Check message status
SELECT id, delivery_status, delivered_at, read_at 
FROM messages 
ORDER BY created_at DESC LIMIT 10;

-- 3. Check RLS policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'messages';
```

**Solutions:**

1. **Manually call RPC to test:**
   ```sql
   -- Test mark_trade_messages_delivered
   SELECT mark_trade_messages_delivered(
     '<TRADE_ID>',
     '<USER_ID>'
   );
   
   -- Verify status changed
   SELECT delivery_status FROM messages 
   WHERE trade_id = '<TRADE_ID>'
   ORDER BY created_at DESC LIMIT 1;
   ```

2. **Check RLS allows updates:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'messages' 
     AND cmd = 'UPDATE';
   -- Should have policy allowing authenticated users to update their own messages
   ```

3. **Restart the app:**
   ```bash
   npm run ios  # Fresh start
   ```

---

## Typing Indicators Not Showing

### Issue: Typing indicator doesn't appear

**Diagnosis Steps:**

```bash
# 1. Check Realtime enabled in Supabase
# Supabase Dashboard → Realtime → Check if enabled

# 2. Check presence subscription in logs
console.log(channel.presenceState());

# 3. Test presence directly
npm test -- --testPathPattern="typing" --verbose
```

**Solutions:**

1. **Enable Realtime in Supabase:**
   - Dashboard → Project → Database → Replication
   - Enable `broadcast`, `presence`, `postgres_changes`

2. **Verify presence subscription:**
   ```typescript
   // In app
   const channel = supabase.channel(`presence:trade:${tradeId}`);
   channel.on('presence', { event: 'sync' }, () => {
     console.log('Presence synced');
   });
   channel.subscribe();
   ```

3. **Check network connectivity:**
   - Make sure simulator has internet
   - For iOS: Settings → Simulator → Network
   - For Android: Emulator settings → Connection

---

## Cron Job Not Running

### Issue: Scheduled email job failing

**Diagnosis Steps:**

```sql
-- 1. Check cron job exists
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'send_message_emails_hourly';

-- 2. Check execution history
SELECT start_time, status, return_message 
FROM cron.job_run_details 
WHERE jobid = (
  SELECT jobid FROM cron.job 
  WHERE jobname = 'send_message_emails_hourly'
)
ORDER BY start_time DESC LIMIT 5;

-- 3. Check audit logs
SELECT run_at, error, result 
FROM message_email_runs 
ORDER BY run_at DESC LIMIT 5;
```

**Solutions:**

1. **Check for ambiguous function error:**
   ```sql
   -- Should only have 1 version
   SELECT proname, pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p
   WHERE proname = 'scheduled_message_cleanup'
     AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
   
   -- If 2 rows, run migration 085 to fix
   ```

2. **Recreate the cron job:**
   ```sql
   -- Unschedule old
   SELECT cron.unschedule('send_message_emails_hourly');
   
   -- Reschedule
   SELECT cron.schedule(
     'send_message_emails_hourly',
     '0 * * * *',
     'SELECT public.scheduled_send_message_emails();'
   );
   ```

3. **Check database permissions:**
   - Verify pg_cron extension is enabled
   - Check if user has permissions to run scheduled jobs

---

## Database Connection Issues

### Issue: "Cannot connect to Supabase"

```bash
# 1. Verify .env.local has correct credentials
cat p2p-kids-marketplace/.env.local | grep SUPABASE

# 2. Test Supabase connection
npm test -- --testNamePattern="Supabase connection" --verbose

# 3. Check RLS policies
# Supabase Dashboard → Authentication → RLS
# Verify policies allow your user
```

---

## Test Execution Failed

### Issue: "npm test fails with error"

```bash
# 1. Clear cache
npm test -- --clearCache

# 2. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 3. Check Node version
node --version
# Should be v18+ 

# 4. Run with detailed output
npm test -- --verbose --detectOpenHandles
```

---

# Summary Checklist

Before marking all tests complete, verify:

## Automated Tests
- [ ] Unit tests: 19/19 passing
- [ ] E2E tests: 23/23 passing
- [ ] Test coverage: 85%+ statements

## Manual Tests (Simulators)
- [ ] MSG-006: 3/3 test cases passed
- [ ] MSG-007: 3/3 test cases passed
- [ ] MSG-008: 2/2 test cases passed
- [ ] MSG-009: 4/4 test cases passed

## Prerequisites
- [ ] SendGrid template created with ID
- [ ] SendGrid API key in Supabase environment
- [ ] All migrations (081-085) applied
- [ ] Admin config settings correct
- [ ] Cron job running successfully
- [ ] Test users created with emails
- [ ] Test trade created

## Deployment Ready
- [ ] All code deployed to production Supabase
- [ ] Edge Function: send-message-email deployed
- [ ] All environment variables set
- [ ] No console errors or warnings
- [ ] Documentation updated

---

**Testing Status:** Ready for QA and Deployment ✅

**Document Version:** 2.0  
**Last Updated:** 2026-01-09  
**Module:** MODULE-07 MSG-006, MSG-007, MSG-008, MSG-009
