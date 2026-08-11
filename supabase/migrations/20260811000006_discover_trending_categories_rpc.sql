-- Migration: 20260811000006_discover_trending_categories_rpc.sql
-- Mode: B (idempotent rerunnable — DROP FUNCTION IF EXISTS + CREATE OR REPLACE)
-- Description: Discover "Trending in {State}" — top categories by active listing
-- count, scoped to the user's state (state-level only, NOT ZIP-radius).
-- MVP: supply-side count metric only (see // TODO(backlog) in DiscoverScreen for
-- future velocity/analytics-based ranking).
-- Backward compatible: ✅ additive — no existing object is altered or dropped.
--
-- FIX (2026-08-11): joins `nodes` (NOT `geographic_nodes`) — profiles.node_id FKs to
-- `nodes(id)` (20241213000001 fk_profiles_node_id) and the app reads session.user.node
-- via `node:nodes(*)` (src/services/auth.ts). `nodes.state` is a 2-letter code ('CT').

-- =============================================================================
-- BLOCK 1 — Schema (run first, then run the verification queries below)
-- =============================================================================

DROP FUNCTION IF EXISTS public.get_top_categories_by_state(TEXT, INT);

CREATE OR REPLACE FUNCTION public.get_top_categories_by_state(
  p_state TEXT,
  p_limit INT DEFAULT 6
)
RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  listing_count BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS category_id,
    c.name AS category_name,
    COUNT(i.id) AS listing_count
  FROM items i
  JOIN categories c   ON c.id = i.category_id
  JOIN profiles p     ON i.seller_id = p.user_id
  JOIN nodes n        ON p.node_id = n.id
  WHERE
    i.status = 'available'
    AND c.is_active = TRUE
    AND n.is_active = TRUE
    AND n.state = p_state
  GROUP BY c.id, c.name, c.display_order
  ORDER BY listing_count DESC, c.display_order ASC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_top_categories_by_state IS
  'Discover "Trending in {State}" — top categories by active listing count within the user''s state (MVP supply-side metric).';

-- =============================================================================
-- BLOCK 2 — Verification queries (run after BLOCK 1; one statement per call)
-- =============================================================================
-- SELECT * FROM public.get_top_categories_by_state('CT', 6);
-- SELECT * FROM public.get_top_categories_by_state('NJ', 6);
-- SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS signature
-- FROM pg_proc p WHERE p.proname IN ('get_top_categories_by_state');
