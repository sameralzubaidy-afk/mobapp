-- MODULE 11 SUB-009 Fix
-- Update get_subscription_summary to properly handle 'grace_period' status key
-- This ensures users in grace period can see their wallet and spend points (but earning is blocked by other rules)

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
      -- Allow SP spending access for grace/grace_period statuses
      WHEN s.status IN ('trial', 'active', 'grace', 'grace_period') THEN TRUE
      ELSE FALSE
    END AS can_spend_sp,
    s.trial_end_date,
    s.current_period_end
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
  ORDER BY 
    CASE WHEN s.status IN ('active', 'trial', 'grace', 'grace_period') THEN 0 ELSE 1 END,
    s.created_at DESC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_subscription_summary(UUID) IS 'MODULE-03 AUTH-V2-003: Returns subscription summary (patched for grace_period)';
