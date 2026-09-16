-- File: supabase/migrations/306_fix_items_rls_for_trade_participants.sql
-- Mode B: Idempotent rerunnable migration
-- Fix RLS on items table so trade participants (buyer/seller) can view items
-- after trade completion, when item status changes from 'available' to 'sold'.
--
-- Problem: Migration 301 created policy "Items visibility based on status" that
-- only allows sellers to view non-available items. Buyers who completed a trade
-- cannot see the item because:
--   - status = 'available' → FALSE (it's now 'sold')
--   - status IN ('flagged', 'rejected') → FALSE
--   - ELSE auth.uid() = seller_id → FALSE for buyer
--
-- Seller could always see it because seller_id == auth.uid().
--
-- Fix: Add EXISTS subquery checking trades table so trade participants
-- (including buyers) can view items they've transacted.

-- =============================================================================
-- 1. Drop the old policy
-- =============================================================================
DROP POLICY IF EXISTS "Items visibility based on status" ON items;

-- =============================================================================
-- 2. Create updated policy with trade participant support
-- =============================================================================
CREATE POLICY "Items visibility based on status" ON items
  FOR SELECT USING (
    CASE
      WHEN status = 'available' THEN TRUE
      WHEN status IN ('flagged', 'rejected') THEN (
        auth.uid() = seller_id
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE user_id = auth.uid()
          AND role = 'admin'
        )
      )
      ELSE (
        auth.uid() = seller_id
        OR EXISTS (
          SELECT 1 FROM trades t
          WHERE t.listing_id = items.id
            AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())
        )
      )
    END
  );

-- =============================================================================
-- Verification queries
-- =============================================================================
-- 1) Check policy exists:
-- SELECT polname, polcmd, pg_get_expr(polqual, polrelid) FROM pg_policies
-- WHERE tablename = 'items' AND polname = 'Items visibility based on status';

-- 2) Test as buyer: Should return the item row
-- SELECT i.id, i.title, i.status FROM items i
-- WHERE EXISTS (
--   SELECT 1 FROM trades t
--   WHERE t.listing_id = i.id AND t.buyer_id = '<BUYER_UID>'
-- );
-- (Run this in Supabase SQL editor as the buyer's JWT or use the anon key with appropriate headers)

-- 3) Verify seller still sees sold items:
-- SELECT i.id, i.title, i.status FROM items i WHERE i.seller_id = '<SELLER_UID>';
-- (Should return items regardless of status)
