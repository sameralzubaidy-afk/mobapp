-- TFV2-015: Reset consecutive_unanswered_offers_count when seller explicitly responds
-- (accepts → payment_processing, or declines → cancelled with non-expired reason)

CREATE OR REPLACE FUNCTION fn_reset_unanswered_counter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('payment_processing', 'cancelled')
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired')
    AND (NEW.cancellation_reason IS DISTINCT FROM 'offer_expired_competing')
  THEN
    UPDATE listing_offer_stats
    SET
      consecutive_unanswered_offers_count = 0,
      updated_at = NOW()
    WHERE seller_id = NEW.seller_id
      AND listing_id = NEW.listing_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_reset_unanswered_counter ON trades;
CREATE TRIGGER trg_reset_unanswered_counter
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_reset_unanswered_counter();
