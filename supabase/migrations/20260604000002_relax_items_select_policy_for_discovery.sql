-- ================================================================
-- Migration: 20260604000002_relax_items_select_policy_for_discovery.sql
-- Purpose: Discovery should show all available listings.
-- Policy enforcement for cross-node restrictions stays in buy/trade flows.
-- ================================================================

-- Remove node-gated authenticated SELECT policies that hide available listings.
DROP POLICY IF EXISTS items_select_own_node ON public.items;
DROP POLICY IF EXISTS items_select_same_node_or_own ON public.items;

-- Allow authenticated users to view all available listings, plus all their own listings.
CREATE POLICY items_select_available_or_own
ON public.items
FOR SELECT
TO authenticated
USING (
  seller_id = auth.uid()
  OR status = 'available'
);
