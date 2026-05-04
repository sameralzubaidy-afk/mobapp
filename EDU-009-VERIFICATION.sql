-- FILE: EDU-009-VERIFICATION.sql
-- MODULE-18 V1 TASK EDU-009: Verification queries for education analytics

-- ============================================================================
-- PRE-DEPLOYMENT VERIFICATION
-- ============================================================================

-- 1. Verify education_analytics table exists and has correct structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'education_analytics'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid, NO)
-- user_id (uuid, YES)
-- event_type (text, NO)
-- event_data (jsonb, YES)
-- created_at (timestamp with time zone, NO)

-- 2. Verify RLS is enabled
SELECT 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE tablename = 'education_analytics' 
  AND schemaname = 'public';
-- Expected: rowsecurity = t

-- 3. Check for sample data (should have at least some events)
SELECT 
  event_type,
  COUNT(*) as event_count,
  MIN(created_at) as earliest,
  MAX(created_at) as latest
FROM education_analytics
GROUP BY event_type
ORDER BY event_type;

-- Expected event types:
-- onboarding_start, onboarding_complete, onboarding_skip
-- help_view, section_expand
-- calculator_use

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================

-- 4. Test analytics query for last 30 days (simulates dashboard fetch)
WITH date_range AS (
  SELECT 
    NOW() - INTERVAL '30 days' AS start_date,
    NOW() AS end_date
)
SELECT 
  -- Onboarding metrics
  COUNT(CASE WHEN event_type = 'onboarding_start' THEN 1 END) AS onboarding_started,
  COUNT(CASE WHEN event_type = 'onboarding_complete' THEN 1 END) AS onboarding_completed,
  COUNT(CASE WHEN event_type = 'onboarding_skip' THEN 1 END) AS onboarding_skipped,
  
  -- Help metrics
  COUNT(CASE WHEN event_type = 'help_view' THEN 1 END) AS help_views,
  COUNT(CASE WHEN event_type = 'section_expand' THEN 1 END) AS section_expansions,
  
  -- Calculator metrics
  COUNT(CASE WHEN event_type = 'calculator_use' THEN 1 END) AS calculator_uses,
  COUNT(DISTINCT CASE WHEN event_type = 'calculator_use' THEN user_id END) AS calculator_unique_users
FROM education_analytics
CROSS JOIN date_range
WHERE created_at >= date_range.start_date 
  AND created_at <= date_range.end_date;

-- 5. Verify section expansion data structure
SELECT 
  event_data->>'section_type' AS section_type,
  COUNT(*) AS expansion_count
FROM education_analytics
WHERE event_type = 'section_expand'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY section_type
ORDER BY expansion_count DESC
LIMIT 5;

-- Expected section types: sp_earning, sp_spending, sp_definition, safety, general, example

-- 6. Verify price bucket histogram data
SELECT 
  event_data->>'item_price_bucket' AS price_bucket,
  COUNT(*) AS usage_count
FROM education_analytics
WHERE event_type = 'calculator_use'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY price_bucket
ORDER BY 
  CASE price_bucket
    WHEN '<10' THEN 1
    WHEN '10-50' THEN 2
    WHEN '50-100' THEN 3
    WHEN '>100' THEN 4
    ELSE 5
  END;

-- Expected buckets: <10, 10-50, 50-100, >100

-- 7. Calculate onboarding completion rate
WITH onboarding_events AS (
  SELECT 
    COUNT(CASE WHEN event_type = 'onboarding_complete' THEN 1 END) AS completed,
    COUNT(CASE WHEN event_type = 'onboarding_skip' THEN 1 END) AS skipped
  FROM education_analytics
  WHERE event_type IN ('onboarding_complete', 'onboarding_skip')
    AND created_at >= NOW() - INTERVAL '30 days'
)
SELECT 
  completed,
  skipped,
  CASE 
    WHEN (completed + skipped) > 0 
    THEN ROUND((completed::NUMERIC / (completed + skipped)), 2)
    ELSE 0
  END AS completion_rate,
  CASE 
    WHEN (completed::NUMERIC / NULLIF(completed + skipped, 0)) < 0.5 
    THEN '⚠️ Low completion rate'
    ELSE '✅ Good completion rate'
  END AS status
FROM onboarding_events;

-- 8. Verify data freshness (should have recent events)
SELECT 
  event_type,
  COUNT(*) AS recent_count,
  MAX(created_at) AS most_recent
FROM education_analytics
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY event_type
ORDER BY most_recent DESC;

-- 9. Check for null user_ids (analytics should work with or without user tracking)
SELECT 
  event_type,
  COUNT(*) AS total_events,
  COUNT(user_id) AS events_with_user,
  COUNT(*) - COUNT(user_id) AS events_without_user
FROM education_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_type;

-- 10. Performance check: Query execution time should be < 500ms
EXPLAIN ANALYZE
SELECT 
  COUNT(CASE WHEN event_type = 'onboarding_start' THEN 1 END) AS starts,
  COUNT(CASE WHEN event_type = 'onboarding_complete' THEN 1 END) AS completes,
  COUNT(CASE WHEN event_type = 'help_view' THEN 1 END) AS help_views,
  COUNT(CASE WHEN event_type = 'calculator_use' THEN 1 END) AS calc_uses
FROM education_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND created_at <= NOW();

-- Expected: Execution Time < 500ms (check at bottom of output)

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================

-- 11. Verify no orphaned events (all events should have valid created_at)
SELECT COUNT(*) AS invalid_events
FROM education_analytics
WHERE created_at IS NULL
   OR created_at > NOW()
   OR created_at < '2024-01-01';

-- Expected: 0 invalid events

-- 12. Check event_data integrity for calculator events
SELECT 
  event_type,
  COUNT(*) AS total,
  COUNT(event_data->>'item_price_bucket') AS with_bucket,
  COUNT(event_data->>'category_id') AS with_category
FROM education_analytics
WHERE event_type = 'calculator_use'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_type;

-- Expected: all calculator events should have item_price_bucket

-- 13. Verify section_expand events have section_type
SELECT 
  COUNT(*) AS total_expansions,
  COUNT(event_data->>'section_type') AS with_section_type,
  COUNT(*) - COUNT(event_data->>'section_type') AS missing_section_type
FROM education_analytics
WHERE event_type = 'section_expand'
  AND created_at >= NOW() - INTERVAL '30 days';

-- Expected: missing_section_type = 0

-- ============================================================================
-- ACCEPTANCE CRITERIA VERIFICATION (EDU-009)
-- ============================================================================

-- AC-1: Date range defaults to last 30 days
-- ✅ Verified by dashboard component (manual test)

-- AC-2: Onboarding funnel shows completion rate with warning if < 50%
-- ✅ Verified by query #7 above

-- AC-3: Help metrics shows top 5 expanded sections sorted DESC
-- ✅ Verified by query #5 above (LIMIT 5)

-- AC-4: Calculator usage shows price bucket histogram
-- ✅ Verified by query #6 above

-- AC-5: Empty state per card when no data
-- ✅ Verified by manual testing (TC-007, TC-009)

-- AC-6: Initial load < 2s on staging data
-- ✅ Verified by query #10 performance check + manual testing (TC-012)

-- ============================================================================
-- TROUBLESHOOTING QUERIES
-- ============================================================================

-- If no data appears in dashboard, check:

-- Missing events for date range
SELECT 
  DATE(created_at) AS event_date,
  event_type,
  COUNT(*) AS event_count
FROM education_analytics
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), event_type
ORDER BY event_date DESC, event_type;

-- Check RLS policies (admin should bypass)
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'education_analytics';

-- Verify service account can read (if using service role)
SET ROLE service_role;
SELECT COUNT(*) FROM education_analytics;
RESET ROLE;

-- ============================================================================
-- SEED DATA FOR TESTING (if needed)
-- ============================================================================

-- Insert sample onboarding events
INSERT INTO education_analytics (event_type, user_id, event_data, created_at) VALUES
  ('onboarding_start', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '25 days'),
  ('onboarding_complete', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '25 days'),
  ('onboarding_start', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '20 days'),
  ('onboarding_skip', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '20 days'),
  ('onboarding_start', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '15 days'),
  ('onboarding_complete', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '15 days');

-- Insert sample help events
INSERT INTO education_analytics (event_type, user_id, event_data, created_at) VALUES
  ('help_view', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '10 days'),
  ('section_expand', gen_random_uuid(), '{"section_type": "sp_earning"}'::jsonb, NOW() - INTERVAL '10 days'),
  ('section_expand', gen_random_uuid(), '{"section_type": "sp_spending"}'::jsonb, NOW() - INTERVAL '9 days'),
  ('section_expand', gen_random_uuid(), '{"section_type": "sp_earning"}'::jsonb, NOW() - INTERVAL '8 days'),
  ('help_view', gen_random_uuid(), '{}'::jsonb, NOW() - INTERVAL '5 days');

-- Insert sample calculator events
INSERT INTO education_analytics (event_type, user_id, event_data, created_at) VALUES
  ('calculator_use', gen_random_uuid(), '{"item_price_bucket": "<10"}'::jsonb, NOW() - INTERVAL '7 days'),
  ('calculator_use', gen_random_uuid(), '{"item_price_bucket": "10-50"}'::jsonb, NOW() - INTERVAL '6 days'),
  ('calculator_use', gen_random_uuid(), '{"item_price_bucket": "50-100"}'::jsonb, NOW() - INTERVAL '5 days'),
  ('calculator_use', gen_random_uuid(), '{"item_price_bucket": ">100"}'::jsonb, NOW() - INTERVAL '4 days'),
  ('calculator_use', gen_random_uuid(), '{"item_price_bucket": "10-50"}'::jsonb, NOW() - INTERVAL '3 days');

-- Verify seed data was inserted
SELECT event_type, COUNT(*) 
FROM education_analytics 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_type;

-- ============================================================================
-- DONE
-- ============================================================================
