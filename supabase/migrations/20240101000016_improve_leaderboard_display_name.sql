-- filepath: supabase/migrations/085_improve_leaderboard_display_name.sql
-- BADGES-V2-004: Surface real display names on leaderboard when profiles exist

CREATE OR REPLACE FUNCTION get_badge_leaderboard(p_limit INT DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  badge_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ub.user_id,
    COALESCE(
      NULLIF(TRIM(p.name), ''),
      NULLIF(u.email, ''),
      'Anonymous User'
    ) AS display_name,
    COUNT(*) AS badge_count
  FROM user_badges ub
  LEFT JOIN profiles p ON p.user_id = ub.user_id
  LEFT JOIN auth.users u ON u.id = ub.user_id
  GROUP BY ub.user_id, p.name, u.email
  ORDER BY badge_count DESC, display_name ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_badge_leaderboard IS 'Leaderboard RPC returns display_name from profile, auth metadata, or email with a fallback';
GRANT EXECUTE ON FUNCTION get_badge_leaderboard(INT) TO authenticated;
