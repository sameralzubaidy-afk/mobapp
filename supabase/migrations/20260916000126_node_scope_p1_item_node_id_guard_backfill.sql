-- ============================================================================
-- P1 — Restore Node-Scoped Discovery: items.node_id guard + backfill
-- Mode B: Idempotent Rerunnable Migration
--
-- WHAT THIS DOES (owner summary):
--   Guarantees every listing resolves to the seller's node (hyperlocal
--   discovery). Re-asserts the write-time trigger that sets items.node_id from
--   the seller's profiles.node_id (defensive for environments where N6
--   ../../migrations/20260809000005_n6_node_tagging.sql was never applied), and
--   backfills any pre-existing NULL node_id rows whose seller HAS a node.
--
-- LIVE-STATE FACT (verified against staging 2026-08-17, project
-- drntwgporzabmxdqykrp — one statement per call):
--   * items.node_id UUID            ✓ EXISTS, FK fk_items_node_id validated
--   * trg_set_item_node_id trigger  ✓ LIVE, SECURITY DEFINER, matches N6 body
--   * idx_items_node_id index       ✓ EXISTS
--   * 1,920 items → 321 tagged, 1,599 NULL; backfillable = 0
--     (ALL 1,599 NULL items belong to sellers with NO profiles.node_id —
--      249 of 280 sellers have no node). So this backfill is a NO-OP on this
--      staging DB today; it is committed because it guarantees correctness in
--      any environment where sellers DO have a node.
--   * LIMITATION (documented): the 83% untagged listings are NOT a
--     listing-creation bug (trigger is live + correct) — they are a
--     seller-profile node-assignment gap (node-less sellers). Per product
--     decision, those items stay NULL and surface ONLY under "Show All Nodes";
--     a node-scoped "My Node" view excludes them (strict scoping).
--
-- DESIGN:
--   * Trigger only SETs node_id when NEW.node_id IS NULL (an explicitly
--     provided value is respected) — identical logic to N6 (behavior no-op live).
--   * Backfill touches NULL rows only, from profiles.node_id.
--   * SECURITY DEFINER: profiles RLS would hide the seller row the trigger needs
--     to resolve the node. search_path pinned (BP-5).
--
-- RULES: SQL-0 (Mode B), BP-9 (function → trigger → index → backfill), BP-10
-- (verification queries), BP-5 (SECURITY DEFINER documented + search_path),
-- BP-2 (FK target type: nodes.id is UUID live; profiles.node_id is UUID),
-- p_/v_ naming, qualified columns.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BLOCK 1 — Re-assert the items.node_id write trigger (idempotent, no-op live)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_item_node_id_from_seller()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.node_id IS NULL THEN
    SELECT p.node_id INTO NEW.node_id
    FROM public.profiles p
    WHERE p.user_id = NEW.seller_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_item_node_id ON public.items;
CREATE TRIGGER trg_set_item_node_id
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_item_node_id_from_seller();

-- ---------------------------------------------------------------------------
-- BLOCK 1 (cont) — Re-assert the node_id index (idempotent)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_items_node_id ON public.items (node_id);

-- ---------------------------------------------------------------------------
-- BLOCK 1 (cont) — Guarded NULL-only backfill from the seller's profile node
--   (safe to re-run: only touches rows where node_id IS NULL AND seller HAS a node)
-- ---------------------------------------------------------------------------
UPDATE public.items i
SET node_id = p.node_id
FROM public.profiles p
WHERE p.user_id = i.seller_id
  AND i.node_id IS NULL
  AND p.node_id IS NOT NULL;

-- ===========================================================================
-- BLOCK 2 — Verification queries (run one statement per call)
-- ===========================================================================
-- 1. Trigger live + enabled:
--    SELECT tgname, tgenabled
--    FROM pg_trigger
--    WHERE tgrelid = 'public.items'::regclass AND tgname = 'trg_set_item_node_id';
--
-- 2. Index present:
--    SELECT indexname FROM pg_indexes
--    WHERE tablename = 'items' AND indexname = 'idx_items_node_id';
--
-- 3. Backfill result — expect still_backfillable = 0 (and explain any remainder):
--    SELECT
--      COUNT(*) FILTER (WHERE i.node_id IS NULL AND p.node_id IS NOT NULL) AS still_backfillable,
--      COUNT(*) FILTER (WHERE i.node_id IS NULL AND p.node_id IS NULL) AS node_less_seller_items
--    FROM public.items i
--    LEFT JOIN public.profiles p ON p.user_id = i.seller_id;
--
-- 4. Node distribution of tagged listings (what a scoped "My Node" view can show):
--    SELECT n.name, COUNT(i.id) AS items_tagged,
--           COUNT(i.id) FILTER (WHERE i.status IN ('available','pending')) AS items_visible
--    FROM public.nodes n
--    LEFT JOIN public.items i ON i.node_id = n.id
--    GROUP BY n.name ORDER BY n.name;
