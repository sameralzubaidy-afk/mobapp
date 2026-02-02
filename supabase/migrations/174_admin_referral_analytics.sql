-- Migration 174: Admin Referral Analytics
-- Created: 2026-02-01
-- Description: RPCs for K-factor, viral coefficient, conversion funnel, top referrers leaderboard

-- RPC: Get referral program metrics
CREATE OR REPLACE FUNCTION get_referral_metrics()
RETURNS JSONB AS $$
DECLARE
  v_total_users INT;
  v_users_with_referrals INT;
  v_total_referrals INT;
  v_completed_referrals INT;
  v_pending_referrals INT;
  v_k_factor NUMERIC;
  v_signup_to_trade_rate NUMERIC;
  v_total_sp_distributed INT;
BEGIN
  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM auth.users;

  -- Users who have made referrals
  SELECT COUNT(DISTINCT r.referrer_user_id) INTO v_users_with_referrals 
  FROM public.referrals r;

  -- Total referrals (all statuses)
  SELECT COUNT(*) INTO v_total_referrals FROM public.referrals;

  -- Completed referrals
  SELECT COUNT(*) INTO v_completed_referrals 
  FROM public.referrals WHERE status = 'completed';

  -- Pending referrals
  v_pending_referrals := v_total_referrals - v_completed_referrals;

  -- K-factor: Average completed referrals per user
  IF v_users_with_referrals > 0 THEN
    v_k_factor := v_completed_referrals::NUMERIC / v_users_with_referrals::NUMERIC;
  ELSE
    v_k_factor := 0;
  END IF;

  -- Signup to first trade conversion rate
  IF v_total_referrals > 0 THEN
    v_signup_to_trade_rate := (v_completed_referrals::NUMERIC / v_total_referrals::NUMERIC) * 100;
  ELSE
    v_signup_to_trade_rate := 0;
  END IF;

  -- Total SP distributed via referrals
  -- Referrer gets 25 SP, referee gets 10 SP = 35 SP per completed referral
  v_total_sp_distributed := v_completed_referrals * 35;

  RETURN jsonb_build_object(
    'total_users', v_total_users,
    'users_with_referrals', v_users_with_referrals,
    'total_referrals', v_total_referrals,
    'pending_referrals', v_pending_referrals,
    'completed_referrals', v_completed_referrals,
    'k_factor', ROUND(v_k_factor, 2),
    'signup_to_trade_rate', ROUND(v_signup_to_trade_rate, 2),
    'total_sp_distributed', v_total_sp_distributed
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get top referrers leaderboard
CREATE OR REPLACE FUNCTION get_top_referrers(p_limit INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  total_referrals BIGINT,
  completed_referrals BIGINT,
  total_sp_earned INT,
  trial_extensions_earned BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id::UUID AS user_id,
    u.email::TEXT,
    COUNT(r.id)::BIGINT AS total_referrals,
    COUNT(r.id) FILTER (WHERE r.status = 'completed')::BIGINT AS completed_referrals,
    (COUNT(r.id) FILTER (WHERE r.status = 'completed') * 25)::INT AS total_sp_earned,
    COUNT(r.id) FILTER (WHERE r.trial_extension_applied = true)::BIGINT AS trial_extensions_earned
  FROM auth.users u
  LEFT JOIN public.referrals r ON u.id = r.referrer_user_id
  GROUP BY u.id, u.email
  HAVING COUNT(r.id) > 0
  ORDER BY completed_referrals DESC, total_referrals DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get referral conversion funnel
CREATE OR REPLACE FUNCTION get_referral_funnel()
RETURNS JSONB AS $$
DECLARE
  v_invites_sent INT;
  v_signups INT;
  v_first_trades INT;
  v_rewards_granted INT;
BEGIN
  -- Invites sent (total referrals created)
  SELECT COUNT(*) INTO v_invites_sent FROM public.referrals;

  -- Signups (all referrals, since referral row created on signup)
  v_signups := v_invites_sent;

  -- First trades completed (referrals with status 'completed')
  SELECT COUNT(*) INTO v_first_trades 
  FROM public.referrals WHERE status = 'completed';

  -- Rewards granted (same as completed referrals)
  v_rewards_granted := v_first_trades;

  RETURN jsonb_build_object(
    'invites_sent', v_invites_sent,
    'signups', v_signups,
    'first_trades', v_first_trades,
    'rewards_granted', v_rewards_granted,
    'signup_rate', CASE WHEN v_invites_sent > 0 THEN ROUND((v_signups::NUMERIC / v_invites_sent::NUMERIC) * 100, 2) ELSE 0 END,
    'trade_rate', CASE WHEN v_signups > 0 THEN ROUND((v_first_trades::NUMERIC / v_signups::NUMERIC) * 100, 2) ELSE 0 END,
    'reward_rate', CASE WHEN v_first_trades > 0 THEN ROUND((v_rewards_granted::NUMERIC / v_first_trades::NUMERIC) * 100, 2) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users (admin check in app layer)
GRANT EXECUTE ON FUNCTION get_referral_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_referrers(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_referral_funnel() TO authenticated;
