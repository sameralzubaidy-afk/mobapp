-- ================================================================
-- Migration: 20260911000002_fix_task_19_cart_items_replica_identity.sql
-- Module: FIX-Task-19 item 1 — stale Basket tab badge after checkout
-- Mode: B (idempotent rerunnable migration)
--
-- Problem (QA Task TRD Phase 2b/2c wrap-up, 2026-09-11):
--   After a successful cart checkout the cart is genuinely emptied
--   (rpc_cart_clear deletes the buyer's active cart_items), yet the
--   Basket tab badge kept showing the old count on the Trade-Initiated
--   success screen, My Trades and Home. It only cleared once the Basket
--   screen mounted (CartScreen calls refreshCartCount() on focus) or the
--   app was foregrounded.
--
-- Root cause (BP-36 class — RLS/filtered Realtime events):
--   CartContext.subscribeToCart() subscribes to postgres_changes on
--   public.cart_items with a server-side filter `user_id=eq.<uid>`.
--   cart_items was added to the supabase_realtime publication by
--   20260720000001_enable_cart_realtime.sql, but it kept Postgres's
--   DEFAULT replica identity (primary key only). For DELETE events the
--   WAL record carries only the primary key, so PostgREST/Realtime cannot
--   evaluate the `user_id` filter and the event is never delivered to the
--   filtered subscription. INSERT/UPDATE worked; only the checkout-side
--   DELETE was silently dropped.
--
-- Fix:
--   REPLICA IDENTITY FULL makes the DELETE WAL record carry the full old
--   row, so the `user_id=eq.<uid>` filter matches and the badge refreshes
--   via the existing subscription.
--
-- Note: this is the DATA-LAYER half of the fix. The rearm half is the
--   explicit `await refreshCartCount()` now called from
--   CartCheckoutScreen.handleConfirm on the success path — so the badge is
--   correct even if a client's Realtime socket is momentarily offline.
--
-- Rerun safety: ALTER TABLE ... REPLICA IDENTITY FULL is idempotent —
--   re-running sets the same value, no error, no data change.
--
-- Rollback: ALTER TABLE public.cart_items REPLICA IDENTITY DEFAULT;
--   (safe; only reverts DELETE payload detail, no data/rows affected)
-- ================================================================

-- ================================================================
-- BLOCK 1 — Schema
-- ================================================================

ALTER TABLE public.cart_items REPLICA IDENTITY FULL;

-- ================================================================
-- BLOCK 2 — Verification
-- ================================================================

-- Expect relreplident = 'f' (f = FULL, d = default, n = nothing, i = index).
SELECT
  c.relname,
  c.relreplident
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'cart_items';

-- Confirms the table is still published for Realtime (unchanged by this migration).
SELECT
  ppt.tablename
FROM pg_publication_tables ppt
WHERE ppt.pubname = 'supabase_realtime'
  AND ppt.schemaname = 'public'
  AND ppt.tablename = 'cart_items';

-- ================================================================
-- DB Object Checklist (SQL-6)
-- ================================================================
-- [x] No tables created (existing table altered only)
-- [x] No columns added/changed
-- [x] No constraints created
-- [x] RLS untouched (cart_items already has RLS + own-row policies)
-- [x] No policies created
-- [x] No indexes created
-- [x] No view/function drop-create behavior
-- [x] Rollback instructions provided above
