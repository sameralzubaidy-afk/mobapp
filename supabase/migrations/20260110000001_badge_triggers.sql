-- filepath: supabase/migrations/20260110000001_badge_triggers.sql

-- Function to award a badge if eligible and not already awarded
CREATE OR REPLACE FUNCTION award_badge_if_eligible(
  p_user_id UUID,
  p_category TEXT,
  p_current_value INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_badge RECORD;
BEGIN
  -- Find badges in category that user hasn't earned yet and meets threshold
  FOR v_badge IN
    SELECT b.*
    FROM badges b
    WHERE b.category = p_category
      AND b.threshold <= p_current_value
      AND b.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM user_badges ub
        WHERE ub.user_id = p_user_id AND ub.badge_id = b.id
      )
    ORDER BY b.threshold ASC
  LOOP
    -- Award badge
    INSERT INTO user_badges (user_id, badge_id, awarded_at)
    VALUES (p_user_id, v_badge.id, NOW())
    ON CONFLICT (user_id, badge_id) DO NOTHING;
    
    -- Raise notice for debugging if needed (will show in Supabase logs)
    RAISE NOTICE 'Awarded badge % to user %', v_badge.name, p_user_id;
  END LOOP;
END;
$$;

-- Trigger function for SP milestone badges
CREATE OR REPLACE FUNCTION check_sp_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_earned INT;
  v_total_spent INT;
BEGIN
  -- Calculate total SP earned (positive ledger entries)
  -- FIX: Use 'amount' column instead of 'points'
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_earned
  FROM sp_ledger
  WHERE user_id = NEW.user_id AND amount > 0;

  -- Calculate total SP spent (negative ledger entries, absolute value)
  -- FIX: Use 'amount' column instead of 'points'
  SELECT COALESCE(SUM(ABS(amount)), 0)
  INTO v_total_spent
  FROM sp_ledger
  WHERE user_id = NEW.user_id AND amount < 0;

  -- Award SP earning badges
  IF v_total_earned > 0 THEN
    PERFORM award_badge_if_eligible(NEW.user_id, 'sp_earning', v_total_earned);
  END IF;

  -- Award SP spending badges
  IF v_total_spent > 0 THEN
    PERFORM award_badge_if_eligible(NEW.user_id, 'sp_spending', v_total_spent);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on sp_ledger
DROP TRIGGER IF EXISTS trigger_check_sp_badges ON sp_ledger;
CREATE TRIGGER trigger_check_sp_badges
AFTER INSERT ON sp_ledger
FOR EACH ROW
EXECUTE FUNCTION check_sp_badges();
