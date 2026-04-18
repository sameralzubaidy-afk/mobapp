-- =====================================================
-- FILE: supabase/migrations/20260418000001_notif_analytics_channel_and_open_tracking_fix.sql
-- MODULE: MODULE-14-NOTIFICATIONS-V2 (NOTIF-V2-010)
-- TASK: Analytics Accuracy Fix for Channel + Open Tracking
-- MODE: B (Idempotent rerunnable migration)
-- DESCRIPTION:
--   1) Keep notification_channel in sync with channels[] for analytics compatibility
--   2) Make analytics RPCs channel-aware using channels[] with legacy fallback
--   3) Track opened events when notifications are marked read
--
-- Common failure modes addressed:
--   - channel metrics incorrect when notifications use channels[] only
--   - p_notification_type filter excluding valid rows because notification_channel is stale
--   - opened rate not updating when users read notifications in-app
-- =====================================================

-- ==================================================
-- BLOCK 1 — Schema/Functions/Backfill
-- ==================================================

CREATE OR REPLACE FUNCTION public.sync_notification_channel_from_channels()
RETURNS TRIGGER AS $$
DECLARE
  v_resolved_channel TEXT;
BEGIN
  v_resolved_channel := COALESCE(
    CASE
      WHEN NEW.channels IS NOT NULL AND 'push' = ANY(NEW.channels) THEN 'push'
      WHEN NEW.channels IS NOT NULL AND 'in_app' = ANY(NEW.channels) THEN 'in_app'
      WHEN NEW.channels IS NOT NULL AND 'email' = ANY(NEW.channels) THEN 'email'
      ELSE NULL
    END,
    NEW.notification_channel,
    'push'
  );

  NEW.notification_channel := v_resolved_channel;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

UPDATE public.user_notifications AS un
SET notification_channel = CASE
  WHEN un.channels IS NOT NULL AND 'push' = ANY(un.channels) THEN 'push'
  WHEN un.channels IS NOT NULL AND 'in_app' = ANY(un.channels) THEN 'in_app'
  WHEN un.channels IS NOT NULL AND 'email' = ANY(un.channels) THEN 'email'
  ELSE COALESCE(un.notification_channel, 'push')
END
WHERE un.notification_channel IS NULL
   OR (un.channels IS NOT NULL AND (
     (un.notification_channel = 'push' AND NOT ('push' = ANY(un.channels))) OR
     (un.notification_channel = 'in_app' AND NOT ('in_app' = ANY(un.channels))) OR
     (un.notification_channel = 'email' AND NOT ('email' = ANY(un.channels)))
   ));

DROP FUNCTION IF EXISTS public.get_notification_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);
DROP FUNCTION IF EXISTS public.get_notification_analytics(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_notification_analytics(
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now(),
  p_category TEXT DEFAULT NULL,
  p_notification_type TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_total_sent INT;
  v_effective_end_date TIMESTAMPTZ;
  v_effective_start_date TIMESTAMPTZ;
BEGIN
  IF p_notification_type IS NOT NULL AND p_notification_type NOT IN ('email', 'in_app', 'push') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid notification type. Must be email, in_app, or push');
  END IF;

  v_effective_end_date := COALESCE(p_end_date, now());
  v_effective_start_date := COALESCE(p_start_date, v_effective_end_date - INTERVAL '30 days');

  SELECT COUNT(*)
  INTO v_total_sent
  FROM public.user_notifications AS n
  WHERE n.created_at >= v_effective_start_date
    AND n.created_at <= v_effective_end_date
    AND (p_category IS NULL OR n.category = p_category)
    AND (
      p_notification_type IS NULL
      OR (n.channels IS NOT NULL AND p_notification_type = ANY(n.channels))
      OR (n.channels IS NULL AND n.notification_channel = p_notification_type)
    );

  SELECT jsonb_build_object(
    'total_sent', v_total_sent,
    'date_range', jsonb_build_object(
      'start', v_effective_start_date,
      'end', v_effective_end_date
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
         ) AS category_stats
         FROM public.user_notifications AS n
         LEFT JOIN public.notification_events AS ne ON ne.notification_id = n.id
         WHERE n.created_at >= v_effective_start_date
           AND n.created_at <= v_effective_end_date
           AND (p_category IS NULL OR n.category = p_category)
           AND (
             p_notification_type IS NULL
             OR (n.channels IS NOT NULL AND p_notification_type = ANY(n.channels))
             OR (n.channels IS NULL AND n.notification_channel = p_notification_type)
           )
         GROUP BY n.category, n.variant
       ) AS stats
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
         ) AS type_stats
         FROM public.user_notifications AS n
         LEFT JOIN public.notification_events AS ne ON ne.notification_id = n.id
         WHERE n.created_at >= v_effective_start_date
           AND n.created_at <= v_effective_end_date
           AND (p_category IS NULL OR n.category = p_category)
           AND (
             p_notification_type IS NULL
             OR (n.channels IS NOT NULL AND p_notification_type = ANY(n.channels))
             OR (n.channels IS NULL AND n.notification_channel = p_notification_type)
           )
         GROUP BY n.type, n.variant
       ) AS stats
      ),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_notification_channel_metrics(
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
  COUNT(*) FILTER (
    WHERE (
      (n.channels IS NOT NULL AND 'email' = ANY(n.channels))
      OR (n.channels IS NULL AND n.notification_channel = 'email')
    )
  ) AS email_count,
  COUNT(*) FILTER (
    WHERE (
      (n.channels IS NOT NULL AND 'in_app' = ANY(n.channels))
      OR (n.channels IS NULL AND n.notification_channel = 'in_app')
    )
  ) AS in_app_count,
  COUNT(*) FILTER (
    WHERE (
      (n.channels IS NOT NULL AND 'push' = ANY(n.channels))
      OR (n.channels IS NULL AND n.notification_channel = 'push')
    )
  ) AS push_count,
  COUNT(*) AS total_count
FROM public.user_notifications AS n
WHERE n.created_at >= COALESCE(p_start_date, now() - INTERVAL '30 days')
  AND n.created_at <= COALESCE(p_end_date, now())
  AND (p_category IS NULL OR n.category = p_category)
GROUP BY n.category
ORDER BY total_count DESC;
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.track_notification_open_event_on_read()
RETURNS TRIGGER AS $$
DECLARE
  v_open_event_exists BOOLEAN;
BEGIN
  IF NEW.is_read IS TRUE AND COALESCE(OLD.is_read, FALSE) = FALSE THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.notification_events AS ne
      WHERE ne.notification_id = NEW.id
        AND ne.event_type = 'opened'
    )
    INTO v_open_event_exists;

    IF NOT v_open_event_exists THEN
      INSERT INTO public.notification_events (notification_id, event_type, event_data)
      VALUES (
        NEW.id,
        'opened',
        jsonb_build_object(
          'source', 'read_state_trigger',
          'timestamp', COALESCE(NEW.read_at, now())
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==================================================
-- BLOCK 2 — Triggers
-- ==================================================

DROP TRIGGER IF EXISTS trg_sync_notification_channel_from_channels ON public.user_notifications;
CREATE TRIGGER trg_sync_notification_channel_from_channels
  BEFORE INSERT OR UPDATE OF channels, notification_channel
  ON public.user_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_notification_channel_from_channels();

DROP TRIGGER IF EXISTS trg_track_notification_open_event_on_read ON public.user_notifications;
CREATE TRIGGER trg_track_notification_open_event_on_read
  AFTER UPDATE OF is_read, read_at
  ON public.user_notifications
  FOR EACH ROW
  WHEN (NEW.is_read IS TRUE AND COALESCE(OLD.is_read, FALSE) = FALSE)
  EXECUTE FUNCTION public.track_notification_open_event_on_read();

-- ==================================================
-- Verification Queries
-- ==================================================

-- 1) Verify columns and functions
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_notifications'
  AND column_name IN ('channels', 'notification_channel')
ORDER BY column_name;

SELECT proname
FROM pg_proc
WHERE proname IN (
  'sync_notification_channel_from_channels',
  'get_notification_analytics',
  'get_notification_channel_metrics',
  'track_notification_open_event_on_read'
)
ORDER BY proname;

-- 2) Verify triggers
SELECT trigger_name, event_manipulation, action_timing, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'user_notifications'
  AND trigger_name IN (
    'trg_sync_notification_channel_from_channels',
    'trg_track_notification_open_event_on_read'
  )
ORDER BY trigger_name, event_manipulation;

-- 3) Verify channel metrics with channels[]
-- SELECT * FROM public.get_notification_channel_metrics(
--   (now() - INTERVAL '30 days')::timestamptz,
--   now()::timestamptz,
--   NULL
-- );

-- 4) Verify analytics filter for channel
-- SELECT public.get_notification_analytics(
--   (now() - INTERVAL '30 days')::timestamptz,
--   now()::timestamptz,
--   NULL,
--   'in_app'
-- );

-- 5) Verify opened event creation via read update
-- DO $$
-- DECLARE
--   v_notification_id UUID;
-- BEGIN
--   SELECT n.id INTO v_notification_id
--   FROM public.user_notifications AS n
--   ORDER BY n.created_at DESC
--   LIMIT 1;
--
--   UPDATE public.user_notifications AS n
--   SET is_read = TRUE,
--       read_at = now()
--   WHERE n.id = v_notification_id;
--
--   RAISE NOTICE 'Opened events: %', (
--     SELECT COUNT(*)
--     FROM public.notification_events AS ne
--     WHERE ne.notification_id = v_notification_id
--       AND ne.event_type = 'opened'
--   );
-- END $$;
