# NOTIF-V2-010: Notification Analytics & Metrics
# Manual Testing Guide

**Module:** MODULE-14-NOTIFICATIONS-V2  
**Task:** NOTIF-V2-010  
**Test Environment:** iOS Simulator + Android Emulator + Staging Supabase  
**Duration:** ~45 minutes

---

## Prerequisites

- [ ] Staging Supabase running with migration 214 applied
- [ ] iOS Simulator or Android Emulator running
- [ ] Test user account with notifications enabled
- [ ] Admin account access for dashboard testing
- [ ] Expo app built and installed on device/simulator

---

## SQL SETUP (Run in Supabase SQL Editor BEFORE Testing)

```sql
-- Verify notification_events table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notification_events'
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notification_events';

-- Verify RPCs exist
SELECT proname
FROM pg_proc
WHERE proname IN (
  'track_notification_event',
  'get_notification_analytics',
  'get_ab_test_performance'
);

-- Expected results:
-- - notification_events table has columns: id, notification_id, event_type, event_data, created_at
-- - rowsecurity = true
-- - All 3 RPCs exist
```

---

## Test Cases

### TC-001: Verify Database Schema
**Objective:** Confirm notification_events table and views are created

1. Open Supabase SQL Editor
2. Run verification queries above
3. Expected:
   - `notification_events` table exists with correct columns
   - RLS is enabled
   - All RPCs exist
   - Indexes created on notification_id, event_type, created_at

**Pass Criteria:**
- [ ] All verification queries return expected results
- [ ] No schema errors

---

### TC-002: Track Notification Delivered Event
**Objective:** Verify delivered events are tracked correctly

1. In Supabase SQL Editor, create a test notification:
   ```sql
   INSERT INTO user_notifications (user_id, category, type, title, body, variant)
   VALUES (
     (SELECT id FROM auth.users LIMIT 1),
     'system',
     'test_analytics',
     'Test Delivered',
     'Testing analytics tracking',
     'control'
   )
   RETURNING id;
   ```
   Note the returned ID.

2. Track a delivered event:
   ```sql
   SELECT track_notification_event(
     '<notification_id_from_step_1>'::uuid,
     'delivered',
     '{"timestamp": "2026-04-17T12:00:00Z"}'::jsonb
   );
   ```

3. Verify event was created:
   ```sql
   SELECT * FROM notification_events
   WHERE notification_id = '<notification_id_from_step_1>'
   AND event_type = 'delivered';
   ```

**Pass Criteria:**
- [ ] RPC returns `{"success": true, "event_id": "<uuid>"}`
- [ ] Event row exists in notification_events table
- [ ] event_type = 'delivered'
- [ ] event_data contains timestamp

---

### TC-003: Track Notification Opened Event
**Objective:** Verify opened events mark notification as read

1. Create a test notification (use TC-002 step 1)

2. Track an opened event:
   ```sql
   SELECT track_notification_event(
     '<notification_id>'::uuid,
     'opened',
     '{"timestamp": "2026-04-17T12:05:00Z"}'::jsonb
   );
   ```

3. Verify notification marked as read:
   ```sql
   SELECT id, is_read, read_at
   FROM user_notifications
   WHERE id = '<notification_id>';
   ```

**Pass Criteria:**
- [ ] RPC returns success
- [ ] Event row created with event_type = 'opened'
- [ ] Notification `is_read` = true
- [ ] `read_at` timestamp is set

---

### TC-004: Track Notification Clicked Event with Deep Link
**Objective:** Verify clicked events capture deep link data

1. Create a test notification with deep link

2. Track a clicked event:
   ```sql
   SELECT track_notification_event(
     '<notification_id>'::uuid,
     'clicked',
     '{"deep_link": "app://trade/123", "timestamp": "2026-04-17T12:10:00Z"}'::jsonb
   );
   ```

3. Verify deep link captured:
   ```sql
   SELECT event_data->>'deep_link' as deep_link
   FROM notification_events
   WHERE notification_id = '<notification_id>'
   AND event_type = 'clicked';
   ```

**Pass Criteria:**
- [ ] Event created successfully
- [ ] event_data contains deep_link = "app://trade/123"

---

### TC-005: Track Notification Failed Event
**Objective:** Verify failed events capture error messages

1. Create a test notification

2. Track a failed event:
   ```sql
   SELECT track_notification_event(
     '<notification_id>'::uuid,
     'failed',
     '{"error": "Invalid push token", "timestamp": "2026-04-17T12:15:00Z"}'::jsonb
   );
   ```

3. Verify error captured:
   ```sql
   SELECT event_data->>'error' as error
   FROM notification_events
   WHERE notification_id = '<notification_id>'
   AND event_type = 'failed';
   ```

**Pass Criteria:**
- [ ] Event created successfully
- [ ] event_data contains error message

---

### TC-006: Reject Invalid Event Types
**Objective:** Verify RPC validates event types

1. Attempt to track an invalid event:
   ```sql
   SELECT track_notification_event(
     gen_random_uuid(),
     'invalid_type',
     '{}'::jsonb
   );
   ```

**Pass Criteria:**
- [ ] RPC returns `{"success": false, "error": "Invalid event type"}`
- [ ] No event created in notification_events table

---

### TC-007: Get Notification Analytics for Date Range
**Objective:** Verify analytics RPC returns correct metrics

1. Create 10 test notifications with various events (use TC-002-005 patterns)

2. Fetch analytics for last 7 days:
   ```sql
   SELECT get_notification_analytics(
     (now() - INTERVAL '7 days')::timestamptz,
     now()::timestamptz,
     NULL
   );
   ```

3. Verify response structure:
   ```json
   {
     "total_sent": 10,
     "date_range": { "start": "...", "end": "..." },
     "by_category": [ ... ],
     "by_type": [ ... ]
   }
   ```

**Pass Criteria:**
- [ ] total_sent matches expected count
- [ ] by_category array contains metrics grouped by category
- [ ] by_type array contains metrics grouped by type
- [ ] delivery_rate, open_rate, click_rate calculated correctly

---

### TC-008: Filter Analytics by Category
**Objective:** Verify category filtering works

1. Fetch analytics filtered by 'system' category:
   ```sql
   SELECT get_notification_analytics(
     (now() - INTERVAL '30 days')::timestamptz,
     now()::timestamptz,
     'system'
   );
   ```

2. Verify response:
   - Only 'system' category notifications included
   - Counts match expected

**Pass Criteria:**
- [ ] Only 'system' category in results
- [ ] total_sent matches system notifications count

---

### TC-009: Calculate Delivery and Open Rates
**Objective:** Verify rate calculations are accurate

1. Create 10 notifications, deliver 8, open 5:
   ```sql
   -- Create 10 notifications
   DO $$
   DECLARE
     i INT;
     notif_id UUID;
   BEGIN
     FOR i IN 1..10 LOOP
       INSERT INTO user_notifications (user_id, category, type, title, body, variant)
       VALUES (
         (SELECT id FROM auth.users LIMIT 1),
         'system',
         'rate_test',
         'Test ' || i,
         'Testing rates',
         'control'
       )
       RETURNING id INTO notif_id;

       -- Deliver first 8
       IF i <= 8 THEN
         PERFORM track_notification_event(notif_id, 'delivered', '{}'::jsonb);
       END IF;

       -- Open first 5
       IF i <= 5 THEN
         PERFORM track_notification_event(notif_id, 'opened', '{}'::jsonb);
       END IF;
     END LOOP;
   END $$;
   ```

2. Fetch analytics:
   ```sql
   SELECT * FROM notification_metrics_by_type
   WHERE type = 'rate_test';
   ```

**Pass Criteria:**
- [ ] delivery_rate = 80.0 (8/10)
- [ ] open_rate = 62.5 (5/8 delivered)
- [ ] Calculations match expected values

---

### TC-010: Admin Dashboard - Load Analytics
**Objective:** Verify admin dashboard displays metrics

1. Open admin portal: `http://localhost:3000/analytics/notifications`
2. Login with admin account
3. Wait for analytics to load

**Pass Criteria:**
- [ ] Dashboard loads without errors
- [ ] "Total Notifications Sent" displays correct count
- [ ] "Avg Delivery Rate" displays percentage
- [ ] "Avg Open Rate" displays percentage
- [ ] No loading spinner stuck

---

### TC-011: Admin Dashboard - Date Range Filters
**Objective:** Verify date range filtering works

1. On admin analytics dashboard
2. Click "Last 7 Days" button
3. Wait for metrics to update
4. Verify metrics change
5. Click "Last 30 Days"
6. Verify metrics update again
7. Click "Last 90 Days"
8. Verify metrics update

**Pass Criteria:**
- [ ] Metrics update when date range changes
- [ ] Different date ranges show different counts
- [ ] No errors in console
- [ ] Loading states display correctly

---

### TC-012: Admin Dashboard - Category Filter
**Objective:** Verify category filtering in dashboard

1. On admin analytics dashboard
2. Select "SP Events" from category dropdown
3. Wait for metrics to update
4. Verify only SP Events category shown in table

**Pass Criteria:**
- [ ] Category dropdown works
- [ ] Metrics table filters correctly
- [ ] Only selected category displayed
- [ ] Counts match expected values

---

### TC-013: Admin Dashboard - Metrics Table Display
**Objective:** Verify metrics table shows correct data

1. On admin analytics dashboard with "All Categories" selected
2. Verify "Metrics by Category" table displays:
   - Category column
   - Variant column
   - Total column
   - Delivered column
   - Delivery Rate column (with color coding)
   - Open Rate column
   - Click Rate column

3. Verify color coding:
   - Green for delivery rate >= 90%
   - Yellow for 70% <= rate < 90%
   - Red for rate < 70%

**Pass Criteria:**
- [ ] All columns display correctly
- [ ] Data matches database values
- [ ] Color coding applied correctly
- [ ] Percentages formatted with 1 decimal place

---

### TC-014: A/B Test Performance Tracking
**Objective:** Verify A/B testing framework tracks variants

1. Create notifications with different variants:
   ```sql
   INSERT INTO user_notifications (user_id, category, type, title, body, variant)
   VALUES
     ((SELECT id FROM auth.users LIMIT 1), 'system', 'ab_test', 'Variant A Title', 'Test A', 'variant_a'),
     ((SELECT id FROM auth.users LIMIT 1), 'system', 'ab_test', 'Variant B Title', 'Test B', 'variant_b'),
     ((SELECT id FROM auth.users LIMIT 1), 'system', 'ab_test', 'Control Title', 'Test Control', 'control');
   ```

2. Track events for each variant

3. Fetch A/B test performance:
   ```sql
   SELECT get_ab_test_performance(
     'ab_test',
     (now() - INTERVAL '7 days')::timestamptz,
     now()::timestamptz
   );
   ```

**Pass Criteria:**
- [ ] Response includes all variants (variant_a, variant_b, control)
- [ ] Each variant has separate metrics
- [ ] open_rate and click_rate calculated per variant

---

### TC-015: Mobile App - Initialize Analytics Tracking
**Objective:** Verify analytics service initializes in app

1. Open mobile app (iOS or Android simulator)
2. Check console logs for:
   ```
   [NotificationAnalytics] Initializing analytics tracking...
   [NotificationAnalytics] Analytics tracking initialized
   ```

**Pass Criteria:**
- [ ] Initialization logs appear
- [ ] No errors during initialization
- [ ] Listeners registered successfully

---

### TC-016: Mobile App - Track Opened Event on Tap
**Objective:** Verify tapping notification tracks opened event

1. Send a test push notification to device
2. Tap the notification
3. Check console logs for:
   ```
   [NotificationAnalytics] Notification interaction detected
   [NotificationAnalytics] Deep link detected (if applicable)
   ```
4. Verify in database:
   ```sql
   SELECT * FROM notification_events
   WHERE event_type = 'opened'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

**Pass Criteria:**
- [ ] Console logs show interaction detected
- [ ] Database has new 'opened' event
- [ ] Notification marked as read

---

### TC-017: Mobile App - Track Clicked Event with Deep Link
**Objective:** Verify deep link click tracking works

1. Send notification with deep link:
   ```json
   {
     "notification_id": "<uuid>",
     "deep_link": "app://trade/123"
   }
   ```
2. Tap notification
3. Verify app navigates to trade screen
4. Check database:
   ```sql
   SELECT event_data->>'deep_link' as deep_link
   FROM notification_events
   WHERE event_type = 'clicked'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

**Pass Criteria:**
- [ ] App navigates to correct screen
- [ ] Database has 'clicked' event
- [ ] event_data contains correct deep link

---

### TC-018: Performance - Large Dataset Analytics
**Objective:** Verify analytics performs well with large datasets

1. Create 1000 test notifications:
   ```sql
   INSERT INTO user_notifications (user_id, category, type, title, body, variant)
   SELECT
     (SELECT id FROM auth.users LIMIT 1),
     'system',
     'perf_test',
     'Performance Test ' || i,
     'Testing',
     CASE WHEN i % 2 = 0 THEN 'control' ELSE 'variant_a' END
   FROM generate_series(1, 1000) AS i;
   ```

2. Track random events for these notifications

3. Fetch analytics:
   ```sql
   EXPLAIN ANALYZE
   SELECT get_notification_analytics(
     (now() - INTERVAL '30 days')::timestamptz,
     now()::timestamptz,
     NULL
   );
   ```

**Pass Criteria:**
- [ ] Query completes in < 2 seconds
- [ ] No timeout errors
- [ ] Admin dashboard loads in < 5 seconds

---

## Cleanup After Testing

```sql
-- Remove test notifications
DELETE FROM user_notifications
WHERE type IN ('test_analytics', 'rate_test', 'ab_test', 'perf_test');

-- Verify cleanup
SELECT COUNT(*) FROM user_notifications WHERE type LIKE '%test%';
-- Expected: 0
```

---

## Success Criteria Summary

✅ **All Test Cases Pass:**
- [ ] TC-001: Database schema verified
- [ ] TC-002: Delivered events tracked
- [ ] TC-003: Opened events mark as read
- [ ] TC-004: Clicked events capture deep links
- [ ] TC-005: Failed events capture errors
- [ ] TC-006: Invalid events rejected
- [ ] TC-007: Analytics RPC returns metrics
- [ ] TC-008: Category filtering works
- [ ] TC-009: Rate calculations accurate
- [ ] TC-010: Admin dashboard loads
- [ ] TC-011: Date range filters work
- [ ] TC-012: Category filter works
- [ ] TC-013: Metrics table displays correctly
- [ ] TC-014: A/B test tracking works
- [ ] TC-015: Mobile app initializes analytics
- [ ] TC-016: Mobile app tracks opens
- [ ] TC-017: Mobile app tracks clicks
- [ ] TC-018: Performance acceptable

✅ **No Errors:**
- [ ] No console errors in mobile app
- [ ] No SQL errors in Supabase
- [ ] No TypeScript errors
- [ ] No runtime crashes

---

## Troubleshooting

### Issue: RPC not found
**Solution:** Re-run migration 214 in Supabase SQL Editor

### Issue: Events not tracked from mobile app
**Solution:** Verify `NotificationAnalyticsService.initialize()` called in App.tsx

### Issue: Admin dashboard shows 0 notifications
**Solution:** Check date range filter, verify test data exists in selected range

### Issue: Metrics calculations seem wrong
**Solution:** Verify test data setup, check for duplicate events, review calculation logic in RPC

---

## Next Steps After Testing

1. Deploy migration 214 to production
2. Initialize analytics in production app
3. Monitor analytics dashboard for first 7 days
4. Review open rates and optimize notification copy
5. Set up A/B tests for critical notifications
6. Create alerts for low delivery rates (< 80%)
