# NOTIF-V2-007: Trade Event Notifications — Manual Testing Guide

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Task:** NOTIF-V2-007  
**Date:** 2026-04-15  
**Platform:** iOS Simulator + Android Emulator (no physical device required for in-app notifications)

> ⚠️ **Push notifications do not work on iOS Simulator or Android Emulator.**  
> These test cases verify **in-app notifications** only (visible in the Notification Center screen).  
> Push delivery testing requires a physical device or a staging build with valid FCM/APNs tokens.

---

## Prerequisites

### SQL to Apply in Supabase (Production)

Run the migration in Supabase SQL Editor:

```sql
-- Apply migration 145_trade_notifications.sql
-- (copy-paste the full file contents from supabase/migrations/145_trade_notifications.sql)
```

### Verification Query (run after migration)

```sql
-- Verify triggers exist
SELECT trigger_name, event_manipulation, event_object_table
  FROM information_schema.triggers
 WHERE trigger_schema = 'public'
   AND trigger_name IN ('trade_request_notification', 'trade_status_notification');

-- Expected: 2 rows
```

### If TC-MANUAL-001 Fails (No "New Trade Request! 💬")

Run these diagnostics immediately after creating a trade request:

```sql
-- 1) Verify trades schema used by trigger (V2 should have listing_id)
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'trades'
   AND column_name IN ('listing_id', 'item_id', 'buyer_id', 'seller_id', 'status');

-- 2) Check whether trigger execution logged an error
SELECT created_at, process_name, message, payload
  FROM public.debug_logs
 WHERE process_name IN ('send_trade_request_notification', 'send_trade_status_notification')
 ORDER BY created_at DESC
 LIMIT 20;

-- 3) Check latest trade notifications directly
SELECT id, user_id, category, type, title, body, data, created_at
  FROM public.user_notifications
 WHERE category = 'trades'
 ORDER BY created_at DESC
 LIMIT 20;
```

### Test Users Required

| Role   | Email                       | Node       |
|--------|-----------------------------|------------|
| Buyer  | test-buyer@p2pkids.dev      | Any active |
| Seller | test-seller@p2pkids.dev     | Same node  |

Seller must have at least 1 active item listed.

---

## Test Cases

### TC-MANUAL-001: Trade Request Notification (Seller)

**Given:** Seller has an active listing. Buyer is logged in.  
**When:** Buyer initiates a trade request on an item.  
**Then:** Seller receives a trade_request notification in their Notification Center.

**Steps:**
1. In Simulator A (iOS): Log in as `test-buyer@p2pkids.dev`.
2. Navigate to Browse → find a listing by `test-seller@p2pkids.dev`.
3. Tap the item → tap **Trade**.
4. Complete the trade initiation flow.
5. In Simulator B (Android Emulator): Log in as `test-seller@p2pkids.dev`.
6. Navigate to the notification bell / tab.

**Expected:**
- Notification item appears with title **"New Trade Request! 💬"**
- Body contains buyer name and item name
- `data.deep_link` = `/trades/<trade_id>`

**Verify in DB:**
```sql
SELECT id, title, body, data, channels, is_read
  FROM user_notifications
 WHERE category = 'trades' AND type = 'trade_request'
 ORDER BY created_at DESC
 LIMIT 1;
```

---

### TC-MANUAL-002: Seller Marks Complete → Buyer Confirmation Notification

**Given:** Trade is in `in_progress` state (payment already processed).  
**When:** Seller taps **Mark as Completed**.  
**Then:** Buyer receives a confirmation-request notification.

**Steps:**
1. In Simulator B: Log in as Seller.
2. Navigate to **Trades** → open an `in_progress` trade.
3. Tap **Mark as Completed**.
4. In Simulator A: Log in as Buyer → open Notification Center.

**Expected:**
- Notification title: **"Trade Ready for Your Confirmation"**
- Body indicates seller marked the trade complete and buyer should confirm receipt
- Tapping navigates to `TradeDetail` (or `TradeTimeline`) for that trade
- DB row has `type = 'trade_completion_requested'` and `data.deep_link = '/trades/<trade_id>'`

---

### TC-MANUAL-003: Buyer Confirms Completion — Both Parties Notified

**Steps:**
1. Complete TC-MANUAL-002 so seller has already marked completion.
2. In Simulator A (Buyer): open the same trade and tap **Mark as Completed**.
3. Check Notification Center for **both** buyer and seller.

**Expected:**
- Buyer sees: **"Trade Complete! 🎉"** — "Your trade for \<item\> is complete! Don't forget to leave a review."
- Seller sees: **"Trade Complete! 🎉"** — "Your trade with \<buyer name\> for \<item\> is complete!"
- Both notifications deep-link to `/trades/<trade_id>`

---

### TC-MANUAL-004: Trade Cancelled — Both Parties Notified

**Steps:**
1. Create a new trade.
2. Cancel the trade (via trade screen cancel action).
3. Check Notification Center for both buyer and seller.

**Expected:**
- Both buyer and seller see: **"Trade Cancelled"**
- Body: "The trade for \<item\> has been cancelled."
- Deep link: `/trades` (trade list)

---

### TC-MANUAL-005: Notification Tap Deep Links

**Steps:**
1. Open notification center.
2. Tap a trade_request notification.

**Expected:** App navigates to `TradeDetail` screen for the correct trade.

**Steps:**
1. Tap a trade_cancelled notification.

**Expected:** App navigates to `TradeList` screen.

---

### TC-MANUAL-006: Notification Preferences Respected

**Steps:**
1. Log in as Seller.
2. Go to Settings → Notification Preferences.
3. Under **Trades** category, disable **Push** and **In-App**.
4. As Buyer: initiate a new trade.
5. Check Seller's Notification Center.

**Expected:**
- No new trade_request notification appears for Seller.
- DB query confirms no row inserted (verify with query in TC-001).

**Restore preferences after test:**
```sql
UPDATE notification_preferences
   SET push_enabled = true, in_app_enabled = true
 WHERE user_id = '<seller-user-id>'
   AND category = 'trades';
```

---

### TC-MANUAL-007: Notification Includes Item Details

**Steps:**
1. Create a trade on an item named **"Red Bicycle"**.
2. Check seller's trade_request notification.

**Expected:**
- Body mentions "Red Bicycle"
- `data.item_title` = "Red Bicycle"
- `data.item_id` matches the item UUID

---

### TC-MANUAL-008: iOS Simulator — Notification Bell Badge Count

**Steps:**
1. Ensure seller has 2 unread trade notifications.
2. Log in as seller on iOS Simulator.
3. Observe notification tab / bell.

**Expected:**
- Badge count ≥ 2 on notification tab icon.
- Tapping the icon opens Notification Center.
- All trade notifications (trade_request, trade_completion_requested, trade_completed, trade_cancelled) visible.

---

### TC-MANUAL-009: Android Emulator — Notification Center Scroll

**Steps:**
1. Seed seller with 10+ trade notifications (via SQL below).
2. Log in as seller on Android Emulator.
3. Open Notification Center → scroll down.

**Expected:**
- All notifications load correctly.
- No crash on scroll.

**SQL Seed (10 test notifications):**
```sql
INSERT INTO user_notifications (user_id, category, type, title, body, data, channels)
SELECT
  '<seller-user-id>'::uuid,
  'trades',
  'trade_request',
  'New Trade Request! 💬',
  'Test trade request #' || gs,
  jsonb_build_object('trade_id', gen_random_uuid()::text, 'item_id', gen_random_uuid()::text,
                     'item_title', 'Test Item', 'deep_link', '/trades/test', 'type', 'trade_request'),
  ARRAY['push', 'in_app']
FROM generate_series(1, 10) gs;
```

---

## DB Object Checklist

- [x] Migration `145_trade_notifications.sql` applied
- [x] Function `create_trade_notification` created in `pg_proc`
- [x] Trigger `trade_request_notification` on `trades` (AFTER INSERT)
- [x] Trigger `trade_status_notification` on `trades` (AFTER UPDATE)
- [x] `user_notifications` rows created with correct `type`, `data`, `channels`
- [x] Preferences respected (channel selection)
- [x] Deep links correct (`/trades/<id>`, `/trades`)

---

## Regression Tier

| Change Type     | Tier Required |
|-----------------|--------------|
| DB trigger only | Tier 1 (trade flow smoke) |
| Service changes | Tier 0 (typecheck + lint) + Tier 1 |

**Commands:**
```bash
# Tier 0
cd p2p-kids-marketplace && npx tsc -p tsconfig.json --noEmit
cd p2p-kids-marketplace && npx eslint src/services/tradeNotifications.ts src/navigation/AppNavigator.tsx

# Unit tests
cd p2p-kids-marketplace && npm run test:unit -- --testPathPattern=tradeNotifications

# E2E (integration) — requires staging credentials
cd p2p-kids-marketplace && RUN_SUPABASE_E2E=true npm run test:e2e -- --testPathPattern=trade-notifications

# Maestro (simulators must be running)
cd p2p-kids-marketplace && npm run test:maestro:ios
cd p2p-kids-marketplace && npm run test:maestro:android
```
