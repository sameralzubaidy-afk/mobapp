-- TFV2-018: Payout trigger — queue payout on trade completion

-- Trigger: Queue payout on trade completion (when no active dispute)
CREATE OR REPLACE FUNCTION fn_queue_payout_on_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only queue if no active dispute (D-26 guard)
  IF NEW.dispute_status IS DISTINCT FROM 'reported'
    AND NEW.dispute_status IS DISTINCT FROM 'under_review'
  THEN
    -- Set idempotency key (only if not already set)
    UPDATE trades
    SET payout_idempotency_key = 'payout_' || NEW.id::text
    WHERE id = NEW.id AND payout_idempotency_key IS NULL;

    -- Invoke payout Edge Function asynchronously
    PERFORM net.http_post(
      url     := current_setting('app.edge_function_base_url') || '/initiate-payout',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := jsonb_build_object('trade_id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let payout queueing break trade completion
  RAISE WARNING 'fn_queue_payout_on_complete error for trade %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_queue_payout_on_complete ON trades;
CREATE TRIGGER trg_queue_payout_on_complete
  AFTER UPDATE ON trades
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed')
  EXECUTE FUNCTION fn_queue_payout_on_complete();
