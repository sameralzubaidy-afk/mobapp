-- ============================================================================
-- Migration: SUB-018 - Fix Subscription Summary Consistency
-- Mode: B (idempotent rerunnable migration)
-- Purpose:
--   1) Ensure get_subscription_summary always reads the latest subscription row
--   2) Keep grace/grace_period users frozen for SP spending in session-enriched data
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_subscription_summary(p_user_id UUID)
RETURNS TABLE (
  status TEXT,
  can_spend_sp BOOLEAN,
  trial_end_date TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.status,
    CASE
      WHEN s.status IN ('trial', 'active', 'paused', 'cancelled', 'canceled') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    s.trial_end_date,
    s.current_period_end
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_subscription_summary(UUID)
  IS 'SUB-018 fix: latest-row subscription summary with grace_period-aware can_spend_sp';

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- 1) Function exists and body updated
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_subscription_summary';

-- 2) Sample call (replace UUID)
-- SELECT * FROM public.get_subscription_summary('00000000-0000-0000-0000-000000000000');

-- 3) Inspect latest subscription row used by function (replace UUID)
-- SELECT s.status, s.updated_at, s.created_at
-- FROM public.subscriptions s
-- WHERE s.user_id = '00000000-0000-0000-0000-000000000000'
-- ORDER BY COALESCE(s.updated_at, s.created_at) DESC, s.created_at DESC
-- LIMIT 1;
