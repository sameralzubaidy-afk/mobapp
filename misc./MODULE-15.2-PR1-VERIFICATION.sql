-- ============================================================================
-- MODULE-15.2 CART SYSTEM — PR 1 VERIFICATION
-- Run these AFTER applying the two migrations:
--   20260528100001_cart_system_schema.sql
--   20260528100002_cart_system_rpcs.sql
-- Each block prints what we expect — verify by eye / fail fast.
-- ============================================================================

-- 1) Schema: cart_items new columns present ----------------------------------
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'cart_items'
  AND column_name IN ('cart_id','cart_status','item_title','item_price_cents',
                      'item_image_url','item_payment_preference','updated_at')
ORDER BY column_name;
-- Expect: 7 rows.

-- 2) cart_status CHECK constraint exists -------------------------------------
SELECT conname, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.cart_items'::regclass
  AND conname = 'cart_items_cart_status_check';
-- Expect: 1 row, CHECK (cart_status IN ('active','saved','deleted')).

-- 3) Partial unique indexes on cart_items ------------------------------------
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'cart_items'
  AND indexname IN ('uq_cart_items_user_listing_active',
                    'uq_cart_items_user_listing_saved',
                    'idx_cart_items_cart_id','idx_cart_items_listing_id',
                    'idx_cart_items_status','idx_cart_items_user_cart')
ORDER BY indexname;
-- Expect: 6 rows.

-- 4) Triggers on cart_items --------------------------------------------------
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'cart_items'
ORDER BY trigger_name;
-- Expect: tr_cart_items_set_updated_at (UPDATE), tr_enforce_cart_limits (INSERT/UPDATE).

-- 5) favorites table + RLS ---------------------------------------------------
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'favorites';
-- Expect: 1 row, rowsecurity = true.

SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'favorites'
ORDER BY policyname;
-- Expect: favorites_insert_own, favorites_select_own, favorites_service_role, favorites_update_own.

-- 6) admin_config cart_settings inserted -------------------------------------
SELECT config_key, config_value, enabled
FROM public.admin_config
WHERE config_key = 'cart_settings';
-- Expect: 1 row with min_cart_value_cents=2000, max_saved_carts=3, saved_cart_expiry_days=7.

-- 7) All 10 RPC functions exist & are SECURITY DEFINER -----------------------
SELECT p.proname, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'rpc_cart_add_item','rpc_cart_remove_item','rpc_cart_clear','rpc_cart_get_items',
  'rpc_cart_save_current','rpc_cart_switch_to_saved','rpc_cart_validate_for_checkout',
  'rpc_favorites_add','rpc_favorites_remove','rpc_favorites_get'
)
ORDER BY p.proname;
-- Expect: 10 rows, all security_definer = true.

-- 8) Smoke call (unauthenticated → expect UNAUTHENTICATED error) -------------
SELECT public.rpc_cart_get_items();
-- Expect: jsonb { success: false, error: { code: 'UNAUTHENTICATED', ... } }
--   when run from SQL editor (no auth.uid()).

SELECT public.rpc_cart_validate_for_checkout();
-- Expect: same UNAUTHENTICATED error shape.

-- 9) Common failure modes (sanity)
-- - If rpc_cart_add_item returns NODE_MISMATCH unexpectedly → check that both
--   buyer and seller have profiles.node_id set (items has no node_id column).
-- - If ALREADY_IN_CART after a remove → cart_status may be 'deleted' not removed;
--   note rpc_cart_remove_item physically DELETEs active rows.
-- - If saved-cart switch fails → ensure target cart_id has cart_status='saved'.

-- ============================================================================
-- END
-- ============================================================================
