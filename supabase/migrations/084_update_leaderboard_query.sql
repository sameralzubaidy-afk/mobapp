-- filepath: supabase/migrations/084_update_leaderboard_query.sql
-- BADGES-V2-004: Ensure leaderboard query starts from user_badges (fixes empty result when profiles are missing)

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
    COALESCE(p.name, p.email) AS display_name,
    COUNT(*) AS badge_count
  FROM user_badges ub
  LEFT JOIN profiles p ON p.id = ub.user_id
  GROUP BY ub.user_id, p.name, p.email
  ORDER BY badge_count DESC, COALESCE(p.name, p.email) ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_badge_leaderboard IS 'Leaderboard RPC now aggregates directly from user_badges to avoid missing rows when profile records are absent';
GRANT EXECUTE ON FUNCTION get_badge_leaderboard(INT) TO authenticated;
