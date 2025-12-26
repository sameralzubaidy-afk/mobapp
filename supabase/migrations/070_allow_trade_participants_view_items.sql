-- filepath: supabase/migrations/070_allow_trade_participants_view_items.sql

-- Mode B: Idempotent rerunnable migration
-- Update RLS policy on items to allow buyers or sellers of a trade to view the related item

-- Drop existing policy (if present) and create a new one that allows:
--  - Anyone to view items with status = 'available'
--  - Sellers to view their own items
--  - Buyers or Sellers who are part of a trade referencing the item to view it

DROP POLICY IF EXISTS "Anyone can view available items" ON items;

CREATE POLICY "Anyone or trade participants can view items"
  ON items FOR SELECT
  USING (
    status = 'available'
    OR seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM trades t
      WHERE t.listing_id = items.id
        AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
    )
  );

-- Verification queries:
-- 1) Check policy exists:
-- SELECT polname, polcmd FROM pg_policies WHERE tablename = 'items';

-- 2) Check that a buyer in a trade can select the item title (run as test user in SQL editor):
-- SELECT i.id, i.title FROM items i WHERE EXISTS (SELECT 1 FROM trades t WHERE t.listing_id = i.id AND t.buyer_id = 'YOUR_TEST_BUYER_ID');

-- 3) Ensure no accidental exposure: Items with status != 'available' should only be visible to seller, buyer, or users in a trade.
-- SELECT i.id, i.title FROM items i WHERE status != 'available' LIMIT 10; -- run as different users to validate
