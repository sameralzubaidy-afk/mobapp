-- filepath: supabase/migrations/20260110000002_trade_badges.sql
-- TASK BADGES-V2-003: Trade Milestone Badges Trigger

-- Function to check and award trade milestone badges
CREATE OR REPLACE FUNCTION check_trade_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_total_trades INT;
  v_seller_total_trades INT;
BEGIN
  -- Only run if trade status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Count total completed trades for buyer
    SELECT COUNT(*)
    INTO v_buyer_total_trades
    FROM trades
    WHERE buyer_id = NEW.buyer_id AND status = 'completed';

    -- Award trade milestone badges to buyer
    PERFORM award_badge_if_eligible(NEW.buyer_id, 'trades', v_buyer_total_trades);
    
    RAISE NOTICE 'Buyer % has completed % trades', NEW.buyer_id, v_buyer_total_trades;

    -- Count total completed trades for seller
    SELECT COUNT(*)
    INTO v_seller_total_trades
    FROM trades
    WHERE seller_id = NEW.seller_id AND status = 'completed';

    -- Award trade milestone badges to seller
    PERFORM award_badge_if_eligible(NEW.seller_id, 'trades', v_seller_total_trades);
    
    RAISE NOTICE 'Seller % has completed % trades', NEW.seller_id, v_seller_total_trades;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_check_trade_badges ON trades;
CREATE TRIGGER trigger_check_trade_badges
AFTER UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION check_trade_badges();

-- Add comment for documentation
COMMENT ON FUNCTION check_trade_badges() IS 
'Automatically awards trade milestone badges when a trade is completed. Checks both buyer and seller.';

-- Verification query
-- To test: Update a trade status to 'completed' and verify badge awarded
-- SELECT * FROM user_badges WHERE user_id = '<test_user_id>' ORDER BY awarded_at DESC;
