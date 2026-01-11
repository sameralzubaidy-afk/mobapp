-- filepath: supabase/migrations/089_fix_trades_node_id_trigger.sql
-- Mode B: Idempotent rerunnable migration
-- Ensures node_id is always populated in the trades table using the seller's node_id as the source of truth.

-- 1. DROP DEPENDENT OBJECTS FIRST
-- Drop the trigger first because the function cannot be dropped while the trigger depends on it
DROP TRIGGER IF EXISTS trigger_populate_trade_node_id ON trades;

-- 2. DROP FUNCTIONS
-- Drop functions to allow changing return types or logic
DROP FUNCTION IF EXISTS public.get_seller_node_id(uuid);
DROP FUNCTION IF EXISTS public.populate_trade_node_id();

-- 3. Create the helper function to fetch node_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_seller_node_id(p_seller_id UUID)
RETURNS UUID AS $$
DECLARE
  v_node_id UUID;
BEGIN
  SELECT node_id INTO v_node_id
  FROM public.profiles
  WHERE user_id = p_seller_id;
  
  RETURN v_node_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create the trigger function for the trades table
CREATE OR REPLACE FUNCTION public.populate_trade_node_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If node_id is already provided, keep it
  IF NEW.node_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Otherwise, try to get it from the seller's profile
  NEW.node_id := public.get_seller_node_id(NEW.seller_id);

  -- Fallback: if seller has no node_id, try to get it from the buyer's profile
  IF NEW.node_id IS NULL THEN
    NEW.node_id := public.get_seller_node_id(NEW.buyer_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the trigger to the trades table
CREATE TRIGGER trigger_populate_trade_node_id
  BEFORE INSERT ON trades
  FOR EACH ROW
  EXECUTE FUNCTION public.populate_trade_node_id();

-- 6. Backfill existing trades with NULL node_id
UPDATE trades t
SET node_id = public.get_seller_node_id(t.seller_id)
WHERE t.node_id IS NULL;

-- If still NULL after seller backfill, try buyer
UPDATE trades t
SET node_id = public.get_seller_node_id(t.buyer_id)
WHERE t.node_id IS NULL;

-- 7. Verification queries
-- SELECT id, seller_id, buyer_id, node_id FROM trades WHERE node_id IS NULL; -- Should return 0 rows
-- SELECT count(*) FROM trades WHERE node_id IS NOT NULL;
