-- =====================================================
-- FILE: supabase/migrations/20260417000001_notification_channel_analytics_v2.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-010)
-- TASK: Notification Analytics - Channel & Type Filtering
-- DESCRIPTION:
--   1. Add notification_channel column to user_notifications if not exists
--   2. Update get_notification_analytics RPC to support notification_type filtering
--   3. Create RPC for getting notification counts by channel
--   4. Create view for notification metrics by channel
-- =====================================================

-- ==================================================
-- STEP 1: Add notification_channel column if not exists
-- ==================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_notifications' AND column_name = 'notification_channel'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN notification_channel TEXT DEFAULT 'push'
      CHECK (notification_channel IN ('email', 'in_app', 'push'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_notifications_channel ON user_notifications(notification_channel);

-- ==================================================
-- STEP 2: View for notification metrics by channel
-- ==================================================

CREATE OR REPLACE VIEW notification_metrics_by_channel AS
SELECT
  n.category,
  n.notification_channel,
  COUNT(*) as total_notifications,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END) as delivered_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'failed' THEN n.id END) as failed_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) as opened_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) as clicked_count,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END) / NULLIF(COUNT(*), 0), 2) as delivery_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2) as open_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2) as click_rate
FROM user_notifications n
LEFT JOIN notification_events ne ON ne.notification_id = n.id
GROUP BY n.category, n.notification_channel;

-- ==================================================
-- STEP 3: Update get_notification_analytics RPC to support notification_type filtering
-- ==================================================

DROP FUNCTION IF EXISTS get_notification_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION get_notification_analytics(
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now(),
  p_category TEXT DEFAULT NULL,
  p_notification_type TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_sent INT;
BEGIN
  -- Validate notification_type if provided
  IF p_notification_type IS NOT NULL AND p_notification_type NOT IN ('email', 'in_app', 'push') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid notification type. Must be email, in_app, or push');
  END IF;

  -- Get total sent count
  SELECT COUNT(*)
  INTO v_total_sent
  FROM user_notifications
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND (p_category IS NULL OR category = p_category)
    AND (p_notification_type IS NULL OR notification_channel = p_notification_type);

  -- Build analytics result
  SELECT jsonb_build_object(
    'total_sent', v_total_sent,
    'date_range', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    ),
    'by_category', COALESCE(
      (SELECT jsonb_agg(category_stats)
       FROM (
         SELECT jsonb_build_object(
           'category', n.category,
           'variant', n.variant,
           'total', COUNT(*)::INT,
           'delivered', COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END)::INT,
           'failed', COUNT(DISTINCT CASE WHEN ne.event_type = 'failed' THEN n.id END)::INT,
           'opened', COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END)::INT,
           'clicked', COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END)::INT,
           'delivery_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END) / NULLIF(COUNT(*), 0), 2),
           'open_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2),
           'click_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2)
         ) as category_stats
         FROM user_notifications n
         LEFT JOIN notification_events ne ON ne.notification_id = n.id
         WHERE n.created_at >= p_start_date
           AND n.created_at <= p_end_date
           AND (p_category IS NULL OR n.category = p_category)
           AND (p_notification_type IS NULL OR n.notification_channel = p_notification_type)
         GROUP BY n.category, n.variant
       ) stats
      ),
      '[]'::jsonb
    ),
    'by_type', COALESCE(
      (SELECT jsonb_agg(type_stats ORDER BY (type_stats->>'total')::INT DESC)
       FROM (
         SELECT jsonb_build_object(
           'type', n.type,
           'variant', n.variant,
           'total', COUNT(*)::INT,
           'delivered', COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END)::INT,
           'opened', COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END)::INT,
           'clicked', COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END)::INT,
           'delivery_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END) / NULLIF(COUNT(*), 0), 2),
           'open_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2),
           'click_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2)
         ) as type_stats
         FROM user_notifications n
         LEFT JOIN notification_events ne ON ne.notification_id = n.id
         WHERE n.created_at >= p_start_date
           AND n.created_at <= p_end_date
           AND (p_category IS NULL OR n.category = p_category)
           AND (p_notification_type IS NULL OR n.notification_channel = p_notification_type)
         GROUP BY n.type, n.variant
       ) stats
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 4: RPC - Get notification channel metrics
-- ==================================================

CREATE OR REPLACE FUNCTION get_notification_channel_metrics(
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now(),
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  category TEXT,
  email BIGINT,
  in_app BIGINT,
  push BIGINT,
  total BIGINT
) AS $$
SELECT
  n.category,
  COUNT(*) FILTER (WHERE n.notification_channel = 'email') as email_count,
  COUNT(*) FILTER (WHERE n.notification_channel = 'in_app') as in_app_count,
  COUNT(*) FILTER (WHERE n.notification_channel = 'push') as push_count,
  COUNT(*) as total_count
FROM user_notifications n
WHERE n.created_at >= p_start_date
  AND n.created_at <= p_end_date
  AND (p_category IS NULL OR n.category = p_category)
GROUP BY n.category
ORDER BY total_count DESC;
$$ LANGUAGE SQL SECURITY DEFINER;

-- ==================================================
-- Verification Queries
-- ==================================================

-- Verify notification_channel column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_notifications' AND column_name = 'notification_channel';

-- Verify index created
SELECT indexname FROM pg_indexes
WHERE tablename = 'user_notifications' AND indexname = 'idx_user_notifications_channel';

-- Verify view exists
SELECT table_name FROM information_schema.tables
WHERE table_name = 'notification_metrics_by_channel';

-- Verify RPC functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('get_notification_analytics', 'get_notification_channel_metrics')
ORDER BY proname;

-- Sample test query - get channel metrics for last 30 days
-- SELECT * FROM get_notification_channel_metrics(
--   (now() - INTERVAL '30 days')::timestamptz,
--   now()::timestamptz,
--   NULL
-- );

-- Sample test query - get analytics filtered by push notification type
-- SELECT get_notification_analytics(
--   (now() - INTERVAL '7 days')::timestamptz,
--   now()::timestamptz,
--   NULL,
--   'push'
-- );
