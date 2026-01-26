-- filepath: supabase/migrations/20260123000000_fix_scheduled_award_tenure_badges.sql
-- 
-- ISSUE FIX: The scheduled_award_tenure_badges() cron job was selecting a non-existent "tier" column
-- 
-- ROOT CAUSE:
-- - The subscriptions table has NO "tier" column
-- - Subscription status is tracked in the "status" column (free, trial, active, grace, canceled, expired)
-- - The cron job query was: SELECT user_id, created_at, status, tier FROM subscriptions WHERE status IN ('trial', 'active')
-- 
-- SOLUTION:
-- 1. Create the scheduled_award_tenure_badges() function with correct column selection
-- 2. This function runs daily via pg_cron to award subscription tenure badges
-- 3. Awards badges based on days since subscription creation (using canceled_at if available)

-- =============================================================================
-- 1. Drop the old function (if it exists) and create the fixed one
-- =============================================================================

-- Drop existing function with any signature
DROP FUNCTION IF EXISTS public.scheduled_award_tenure_badges();

-- Create the corrected function
CREATE OR REPLACE FUNCTION public.scheduled_award_tenure_badges()
RETURNS TABLE (
  p_total_checked INT,
  p_total_awarded INT,
  p_error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_checked INT := 0;
  v_total_awarded INT := 0;
  v_user_id UUID;
  v_days_subscribed NUMERIC;
  v_badge_id UUID;
  v_badge_threshold INT;
BEGIN
  -- Get all subscription badges
  FOR v_badge_id, v_badge_threshold IN
    SELECT id, threshold
    FROM badges
    WHERE category = 'subscription' AND is_active = TRUE
    ORDER BY threshold ASC
  LOOP
    -- For each badge, find users eligible (subscription tenure >= threshold days)
    FOR v_user_id, v_days_subscribed IN
      SELECT 
        s.user_id,
        EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 as days_subscribed
      FROM subscriptions s
      WHERE s.status IN ('trial', 'active', 'grace', 'canceled', 'expired')
        AND EXTRACT(EPOCH FROM (COALESCE(s.canceled_at, NOW()) - s.created_at)) / 86400 >= v_badge_threshold
    LOOP
      v_total_checked := v_total_checked + 1;
      
      -- Award the badge if user doesn't already have it
      INSERT INTO user_badges (user_id, badge_id, awarded_at)
      VALUES (v_user_id, v_badge_id, NOW())
      ON CONFLICT (user_id, badge_id) DO NOTHING;
      
      -- Check if a new row was inserted (not a conflict)
      IF FOUND THEN
        v_total_awarded := v_total_awarded + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  -- Return summary
  RETURN QUERY SELECT v_total_checked, v_total_awarded, NULL::TEXT;
  
EXCEPTION WHEN OTHERS THEN
  -- If an error occurs, return error message
  RETURN QUERY SELECT v_total_checked, v_total_awarded, SQLERRM;
END;
$$;

-- =============================================================================
-- 2. Create the cron job (if it doesn't already exist)
-- =============================================================================
-- Note: This requires pg_cron extension to be enabled in your Supabase project
-- Schedule: Run daily at midnight UTC
-- The cron job will call the function automatically

-- Remove existing job if it exists
SELECT cron.unschedule('award-tenure-badges-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'award-tenure-badges-daily'
);

-- Schedule the job
SELECT cron.schedule('award-tenure-badges-daily', '0 0 * * *', $$
  SELECT public.scheduled_award_tenure_badges();
$$);

-- =============================================================================
-- 3. VERIFICATION QUERIES
-- =============================================================================

-- Verify the function exists and works
-- Test: SELECT public.scheduled_award_tenure_badges();

-- Verify subscriptions table has the required columns
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'subscriptions'
-- ORDER BY ordinal_position;

-- Verify badges table has subscription category badges
-- SELECT name, category, threshold, is_active
-- FROM badges
-- WHERE category = 'subscription'
-- ORDER BY threshold ASC;

-- Verify cron job is scheduled
-- SELECT jobname, schedule, command
-- FROM cron.job
-- WHERE jobname = 'award-tenure-badges-daily';
