-- =====================================================
-- FILE: supabase/migrations/214_notification_analytics.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-010)
-- TASK: Notification Analytics & Metrics
-- DESCRIPTION:
--   1. Create notification_events table for tracking delivery/open/click
--   2. Create analytics views for metrics by category
--   3. Create RPC for retrieving analytics data
--   4. Add A/B testing variant tracking
-- =====================================================

-- ==================================================
-- STEP 1: Create notification_events table
-- ==================================================

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES user_notifications(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('delivered', 'opened', 'clicked', 'failed')),
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_events_notification_idx ON notification_events(notification_id);
CREATE INDEX IF NOT EXISTS notification_events_type_idx ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS notification_events_created_idx ON notification_events(created_at DESC);

-- RLS policies
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage notification events" ON notification_events;
CREATE POLICY "Service role can manage notification events"
  ON notification_events FOR ALL
  TO service_role
  USING (true);

-- ==================================================
-- STEP 2: Add A/B testing variant tracking to user_notifications
-- ==================================================

-- Add variant column if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_notifications' AND column_name = 'variant'
  ) THEN
    ALTER TABLE user_notifications ADD COLUMN variant TEXT DEFAULT 'control';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_notifications_variant ON user_notifications(variant);

-- ==================================================
-- STEP 3: Analytics view - Notification metrics by category
-- ==================================================

CREATE OR REPLACE VIEW notification_metrics_by_category AS
SELECT
  n.category,
  n.variant,
  COUNT(*) as total_notifications,
  COUNT(CASE WHEN n.is_read = false THEN 1 END) as pending_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END) as delivered_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'failed' THEN n.id END) as failed_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) as opened_count,
  COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) as clicked_count,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END) / NULLIF(COUNT(*), 0), 2) as delivery_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2) as open_rate,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2) as click_rate
FROM user_notifications n
LEFT JOIN notification_events ne ON ne.notification_id = n.id
GROUP BY n.category, n.variant;

-- ==================================================
-- STEP 4: Analytics view - Notification metrics by type
-- ==================================================

CREATE OR REPLACE VIEW notification_metrics_by_type AS
SELECT
  n.type,
  n.variant,
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
GROUP BY n.type, n.variant;

-- ==================================================
-- STEP 5: RPC - Get notification analytics
-- ==================================================

CREATE OR REPLACE FUNCTION get_notification_analytics(
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now(),
  p_category TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_sent INT;
BEGIN
  -- Get total sent count
  SELECT COUNT(*)
  INTO v_total_sent
  FROM user_notifications
  WHERE created_at >= p_start_date
    AND created_at <= p_end_date
    AND (p_category IS NULL OR category = p_category);

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
-- STEP 6: RPC - Track notification event
-- ==================================================

CREATE OR REPLACE FUNCTION track_notification_event(
  p_notification_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_event_id UUID;
BEGIN
  -- Validate event type
  IF p_event_type NOT IN ('delivered', 'opened', 'clicked', 'failed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid event type');
  END IF;

  -- Insert event
  INSERT INTO notification_events (notification_id, event_type, event_data)
  VALUES (p_notification_id, p_event_type, p_event_data)
  RETURNING id INTO v_event_id;

  -- Mark notification as read if opened
  IF p_event_type = 'opened' THEN
    UPDATE user_notifications
    SET is_read = true, read_at = now()
    WHERE id = p_notification_id AND is_read = false;
  END IF;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- STEP 7: RPC - Get A/B test performance
-- ==================================================

CREATE OR REPLACE FUNCTION get_ab_test_performance(
  p_notification_type TEXT,
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'notification_type', p_notification_type,
      'variants', jsonb_agg(variant_stats ORDER BY variant)
    )
    FROM (
      SELECT
        n.variant,
        jsonb_build_object(
          'variant', n.variant,
          'total_sent', COUNT(*)::INT,
          'delivered', COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END)::INT,
          'opened', COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END)::INT,
          'clicked', COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END)::INT,
          'open_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'opened' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2),
          'click_rate', ROUND(100.0 * COUNT(DISTINCT CASE WHEN ne.event_type = 'clicked' THEN n.id END) / NULLIF(COUNT(DISTINCT CASE WHEN ne.event_type = 'delivered' THEN n.id END), 0), 2)
        ) as variant_stats
      FROM user_notifications n
      LEFT JOIN notification_events ne ON ne.notification_id = n.id
      WHERE n.type = p_notification_type
        AND n.created_at >= p_start_date
        AND n.created_at <= p_end_date
      GROUP BY n.variant
    ) stats
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================================================
-- Verification Queries
-- ==================================================

-- Verify notification_events table created
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'notification_events'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'notification_events';

-- Verify RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'notification_events';

-- Test analytics RPC (sample)
-- SELECT get_notification_analytics(
--   (now() - INTERVAL '7 days')::timestamptz,
--   now()::timestamptz,
--   NULL
-- );
