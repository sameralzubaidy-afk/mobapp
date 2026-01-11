-- filepath: supabase/migrations/083_badge_leaderboard.sql
-- BADGES-V2-004: Leaderboard RPC Function

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
    p.id AS user_id,
    COALESCE(p.name, p.email) AS display_name,
    COUNT(ub.id) AS badge_count
  FROM profiles p
  LEFT JOIN user_badges ub ON p.id = ub.user_id
  GROUP BY p.id, p.name, p.email
  HAVING COUNT(ub.id) > 0
  ORDER BY badge_count DESC, p.name ASC
  LIMIT p_limit;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_badge_leaderboard(INT) TO authenticated;

COMMENT ON FUNCTION get_badge_leaderboard IS 'Returns top users by badge count for leaderboard display';
