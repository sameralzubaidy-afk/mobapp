-- File: supabase/migrations/20260113000003_fix_trade_badge_trigger.sql
-- Purpose: Ensure trade badges are awarded on INSERT as well as UPDATE
-- Issue: Trigger was only defined AFTER UPDATE, so direct inserts (like sandbox) wouldn't award badges.

-- =============================================================================
-- FIX: Update trigger on trades to include INSERT
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_check_trade_badges ON trades;
CREATE TRIGGER trigger_check_trade_badges
AFTER INSERT OR UPDATE ON trades
FOR EACH ROW
EXECUTE FUNCTION check_trade_badges();

-- Ensure the check_trade_badges function handles INSERT (OLD will be null)
CREATE OR REPLACE FUNCTION check_trade_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_total_trades INT;
  v_seller_total_trades INT;
BEGIN
  -- Handle both INSERT (OLD is NULL) and UPDATE (status changed to 'completed')
  IF (TG_OP = 'INSERT' AND NEW.status = 'completed') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) 
  THEN
    
    -- Count total completed trades for buyer
    SELECT COUNT(*)
    INTO v_buyer_total_trades
    FROM trades
    WHERE buyer_id = NEW.buyer_id AND status = 'completed';

    -- Award trade milestone badges to buyer
    PERFORM award_badge_if_eligible(NEW.buyer_id, 'trades', v_buyer_total_trades);
    
    -- Count total completed trades for seller (if different from buyer)
    IF NEW.seller_id != NEW.buyer_id THEN
      SELECT COUNT(*)
      INTO v_seller_total_trades
      FROM trades
      WHERE seller_id = NEW.seller_id AND status = 'completed';

      -- Award trade milestone badges to seller
      PERFORM award_badge_if_eligible(NEW.seller_id, 'trades', v_seller_total_trades);
    END IF;

    RAISE NOTICE 'Badge check completed for trade % (Buyer: %, Seller: %)', NEW.id, NEW.buyer_id, NEW.seller_id;
  END IF;

  RETURN NEW;
END;
$$;
