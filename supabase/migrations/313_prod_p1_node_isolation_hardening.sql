-- File: supabase/migrations/313_prod_p1_node_isolation_hardening.sql
-- Module: MODULE-15.5 PROD-004
-- Mode: idempotent rerunnable migration
--
-- Purpose:
-- 1) Enforce node-scoped item visibility using seller profile node (items has no node_id in base schema).
-- 2) Enforce node-scoped trade visibility using trades.node_id + participant ownership.

-- ============================================
-- BLOCK 1: Schema helper
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_node_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.node_id
  FROM public.profiles p
  WHERE p.user_id = p_user_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_user_node_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_node_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_node_id(uuid) TO service_role;

-- ============================================
-- BLOCK 2: Security + performance
-- ============================================

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

-- Drop likely conflicting item select policies
DROP POLICY IF EXISTS "Items visibility based on status" ON public.items;
DROP POLICY IF EXISTS "items_select_authenticated" ON public.items;
DROP POLICY IF EXISTS "Public can view available items" ON public.items;
DROP POLICY IF EXISTS "Users can view own items" ON public.items;
DROP POLICY IF EXISTS "items_select_same_node_or_own" ON public.items;

-- Users can see own items, and other available items only when seller is in same node
CREATE POLICY "items_select_same_node_or_own" ON public.items
  FOR SELECT TO authenticated
  USING (
    items.seller_id = auth.uid()
    OR (
      items.status = 'available'
      AND EXISTS (
        SELECT 1
        FROM public.profiles p_seller
        WHERE p_seller.user_id = items.seller_id
          AND p_seller.node_id = public.get_user_node_id(auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "items_service_role_all" ON public.items;
CREATE POLICY "items_service_role_all" ON public.items
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop likely conflicting trade select policies
DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
DROP POLICY IF EXISTS "trades_select_own_node" ON public.trades;
DROP POLICY IF EXISTS "trades_select_participants" ON public.trades;
DROP POLICY IF EXISTS "trades_select_participant_same_node" ON public.trades;

-- Users can only view trades where they are participant and trade node matches their node
CREATE POLICY "trades_select_participant_same_node" ON public.trades
  FOR SELECT TO authenticated
  USING (
    (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
    AND (
      trades.node_id IS NULL
      OR trades.node_id = public.get_user_node_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "trades_service_role_all" ON public.trades;
CREATE POLICY "trades_service_role_all" ON public.trades
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_trades_node_id_prod_p1 ON public.trades(node_id);

-- ============================================
-- Verification queries (run manually)
-- ============================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='items' AND column_name IN ('id','seller_id','status');
--
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='trades' AND column_name IN ('id','buyer_id','seller_id','node_id');
--
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('items','trades')
-- ORDER BY tablename, policyname;
--
-- SELECT public.get_user_node_id(auth.uid());

-- Common failure modes:
-- 1) Missing profiles.node_id for legacy users causes empty discovery results.
-- 2) Existing permissive select policies not dropped due renamed policy strings.
-- 3) trades.node_id null historical rows bypass strict node matching assumptions.
