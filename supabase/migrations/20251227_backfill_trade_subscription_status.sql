-- File: supabase/migrations/20251227_backfill_trade_subscription_status.sql
-- Mode B: Idempotent rerunnable migration
-- Backfill buyer_subscription_status for existing trades by joining with the subscriptions table.

-- 1. Update trades where buyer_subscription_status is NULL
UPDATE trades t
SET buyer_subscription_status = COALESCE(s.status, 'free')
FROM subscriptions s
WHERE t.buyer_id = s.user_id
  AND t.buyer_subscription_status IS NULL;

-- 2. For any remaining trades where buyer_subscription_status is still NULL (no subscription record found)
-- we default to 'free'
UPDATE trades
SET buyer_subscription_status = 'free'
WHERE buyer_subscription_status IS NULL;

-- 3. Backfill profiles.subscription_id from subscriptions table
UPDATE profiles p
SET subscription_id = s.id
FROM subscriptions s
WHERE p.user_id = s.user_id
  AND p.subscription_id IS NULL;

-- 4. Create trigger to keep profiles.subscription_id in sync
CREATE OR REPLACE FUNCTION sync_profile_subscription_id()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles
  SET subscription_id = NEW.id
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_upsert ON subscriptions;
CREATE TRIGGER on_subscription_upsert
  AFTER INSERT OR UPDATE OF id ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_profile_subscription_id();

-- 5. Verification query
-- SELECT id, buyer_id, buyer_subscription_status FROM trades LIMIT 10;
-- SELECT user_id, subscription_id FROM profiles WHERE subscription_id IS NOT NULL LIMIT 10;
