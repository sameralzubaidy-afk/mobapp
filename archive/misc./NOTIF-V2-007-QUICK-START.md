# Quick Start - Deploy Complete Notification Coverage

**Task:** NOTIF-V2-007 - Add Push Notifications to All Events  
**Time Required:** 10-15 minutes

---

## What This Does

Adds **push notification** support to trade, referral, and badge events (messages already had it).

**Result:** Users get **both in-app AND push notifications** for ALL events.

---

## Step 1: Apply Migrations (Staging)

```bash
# From repo root
cd ~/Desktop/kids_marketplace_app

# Get your staging database URL
echo $SUPABASE_STAGING_URL

# Apply the 3 new migrations
psql $SUPABASE_STAGING_URL <<EOF
\i supabase/migrations/211_enhance_trade_notifications_push.sql
\i supabase/migrations/212_enhance_referral_notifications_push.sql
\i supabase/migrations/213_enhance_badge_notifications_push.sql
EOF
```

**Expected Output:**
```
CREATE OR REPLACE FUNCTION
CREATE OR REPLACE FUNCTION
CREATE OR REPLACE FUNCTION
```

---

## Step 2: Verify Functions Updated

```bash
psql $SUPABASE_STAGING_URL <<EOF
SELECT proname, 
       CASE WHEN prosrc LIKE '%net.http_post%' THEN '✓ Has push' ELSE '✗ Missing push' END as push_status
FROM pg_proc 
WHERE proname IN (
  'create_trade_notification',
  'create_notification',
  'create_badge_notification'
)
ORDER BY proname;
EOF
```

**Expected Output:**
```
      proname              |  push_status
---------------------------+--------------
 create_badge_notification | ✓ Has push
 create_notification       | ✓ Has push
 create_trade_notification | ✓ Has push
(3 rows)
```

---

## Step 3: Test Push Notifications

### 3a. Test Trade Notification

```bash
# In staging mobile app:
# 1. Login as user A (seller)
# 2. Create a listing
# 3. Login as user B (buyer) 
# 4. Request to trade for the listing
# 5. User A should receive PUSH + in-app notification

# Verify in database:
psql $SUPABASE_STAGING_URL <<EOF
SELECT 
  un.type,
  un.title,
  un.channels,
  un.created_at,
  CASE 
    WHEN pdl.id IS NOT NULL THEN '✓ Push sent'
    ELSE '✗ No push log'
  END as push_status
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.type = 'trade_request'
ORDER BY un.created_at DESC
LIMIT 1;
EOF
```

### 3b. Test Badge Notification

```bash
# In staging mobile app:
# Complete an action that awards a badge
# (e.g., complete first trade, earn 100 SP)
# User should receive PUSH + in-app notification

# Verify:
psql $SUPABASE_STAGING_URL <<EOF
SELECT 
  un.type,
  un.title,
  un.channels,
  pdl.receipt_status,
  un.created_at
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.type = 'badge_earned'
ORDER BY un.created_at DESC
LIMIT 1;
EOF
```

### 3c. Test Referral Notification

```bash
# In staging mobile app:
# 1. User A gets their referral code
# 2. User B signs up using the code
# 3. User A should receive PUSH + in-app notification

# Verify:
psql $SUPABASE_STAGING_URL <<EOF
SELECT 
  un.type,
  un.title,
  un.channels,
  pdl.receipt_status,
  un.created_at
FROM user_notifications un
LEFT JOIN push_delivery_logs pdl ON pdl.notification_id = un.id
WHERE un.type = 'referral_invite_accepted'
ORDER BY un.created_at DESC
LIMIT 1;
EOF
```

---

## Step 4: Check Edge Function Logs

```bash
# In Supabase Dashboard:
# 1. Go to Edge Functions
# 2. Click "send-push-notification"
# 3. View logs
# 4. Look for recent invocations

# Should see entries like:
# "Sending push to user: <user_id>"
# "Push sent successfully"
```

---

## Troubleshooting

### Issue: No push received on device

**Check 1: User has push token registered**
```sql
SELECT user_id, token, platform, updated_at
FROM push_tokens
WHERE user_id = '<user_id>'
ORDER BY updated_at DESC;
```

**Check 2: Admin config has Supabase URL**
```sql
SELECT key, is_active
FROM admin_config
WHERE key IN ('supabase_url', 'supabase_anon_key')
AND is_active = true;
```

**Check 3: pg_net extension installed**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_net';
```

If missing, install:
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

---

### Issue: In-app notification created but no push

**Check push_delivery_logs:**
```sql
SELECT 
  notification_id,
  receipt_status,
  receipt_message,
  created_at
FROM push_delivery_logs
WHERE notification_id = '<notification_id>';
```

**Common causes:**
- User disabled push for that category (check `notification_preferences`)
- Push token expired/invalid (check `receipt_status = 'DeviceNotRegistered'`)
- Edge Function error (check Edge Function logs in Supabase dashboard)

---

## Rollback (If Needed)

```bash
# Restore previous function versions
psql $SUPABASE_STAGING_URL <<EOF
\i supabase/migrations/145_trade_notifications.sql
\i supabase/migrations/175_referral_notifications_v2.sql
\i supabase/migrations/143_badge_notifications.sql
EOF
```

This removes push but keeps in-app notifications working.

---

## Deploy to Production

Once verified in staging:

```bash
# Apply to production
psql $SUPABASE_PRODUCTION_URL <<EOF
\i supabase/migrations/211_enhance_trade_notifications_push.sql
\i supabase/migrations/212_enhance_referral_notifications_push.sql
\i supabase/migrations/213_enhance_badge_notifications_push.sql
EOF

# Verify
psql $SUPABASE_PRODUCTION_URL <<EOF
SELECT proname, 
       CASE WHEN prosrc LIKE '%net.http_post%' THEN '✓ Has push' ELSE '✗ Missing push' END
FROM pg_proc 
WHERE proname IN ('create_trade_notification', 'create_notification', 'create_badge_notification');
EOF
```

---

## Success Criteria

- [x] All 3 migrations applied without errors
- [x] Functions show "✓ Has push" in verification query
- [x] Trade notification sends push + in-app
- [x] Badge notification sends push + in-app
- [x] Referral notification sends push + in-app
- [x] push_delivery_logs populated with delivery attempts
- [x] No duplicate notifications observed

---

## Files Changed

**New Migrations:**
- `supabase/migrations/211_enhance_trade_notifications_push.sql`
- `supabase/migrations/212_enhance_referral_notifications_push.sql`
- `supabase/migrations/213_enhance_badge_notifications_push.sql`

**Functions Updated:**
- `create_trade_notification()` - Now calls push Edge Function
- `create_notification()` - Now calls push Edge Function
- `create_badge_notification()` - Now calls push Edge Function

**No app code changes required** - all server-side!

---

**Total Time:** 10-15 minutes
**Risk Level:** Low (non-fatal push failures, in-app always works)
**Rollback Time:** < 5 minutes
