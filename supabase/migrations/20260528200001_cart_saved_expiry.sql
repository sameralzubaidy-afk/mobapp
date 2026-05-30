-- Migration: 20260528200001_cart_saved_expiry.sql
-- R-08: 7-day auto-expiry for saved carts
--
-- Mode: IDEMPOTENT (safe to re-run)
--
-- BLOCK 1 — Schema + Function
-- Creates fn_expire_saved_carts() which can be called:
--   a) manually: SELECT fn_expire_saved_carts();
--   b) via pg_cron if the extension is enabled (see note at bottom)
--   c) via a Supabase Edge Function scheduled trigger
--
-- The expiry window is read from admin_config.cart_saved_expiry_days
-- (falls back to 7 days if not found).
--
-- ⚠️  ASK USER TO RUN THIS SQL in Supabase SQL Editor (prod) before testing R-08.
--
-- BLOCK 1 — Function

CREATE OR REPLACE FUNCTION public.fn_expire_saved_carts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
-- SECURITY DEFINER needed because: function must read admin_config (service-owned)
-- and update cart_items rows belonging to multiple users.
SET search_path = public
AS $$
DECLARE
  v_expiry_days  integer;
  v_cutoff_ts    timestamptz;
  v_deleted_rows integer;
BEGIN
  -- Read configured expiry days from admin_config (default 7)
  SELECT COALESCE(NULLIF(TRIM(value), ''), '7')::integer
    INTO v_expiry_days
    FROM admin_config
   WHERE key = 'cart_saved_expiry_days'
     AND is_active = true
   LIMIT 1;

  IF v_expiry_days IS NULL THEN
    v_expiry_days := 7;
  END IF;

  v_cutoff_ts := NOW() - (v_expiry_days || ' days')::interval;

  -- Soft-delete saved cart items older than the cutoff
  -- We set deleted_at rather than hard-deleting for audit trail.
  UPDATE public.cart_items
     SET deleted_at = NOW()
   WHERE cart_status = 'saved'
     AND deleted_at IS NULL
     AND updated_at < v_cutoff_ts;

  GET DIAGNOSTICS v_deleted_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'success',       true,
    'expiry_days',   v_expiry_days,
    'cutoff',        v_cutoff_ts,
    'rows_expired',  v_deleted_rows
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM,
    'state',   SQLSTATE
  );
END;
$$;

-- Grant execute to the service role only (this function is admin/batch only)
REVOKE ALL ON FUNCTION public.fn_expire_saved_carts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_expire_saved_carts() TO service_role;

-- ─── BLOCK 2 — pg_cron setup (OPTIONAL — only if extension is enabled) ────────
-- If pg_cron is available in your Supabase project, uncomment the following
-- to schedule automatic expiry every day at 02:00 UTC:
--
-- SELECT cron.schedule(
--   'expire-saved-carts',
--   '0 2 * * *',
--   $cron$ SELECT fn_expire_saved_carts(); $cron$
-- );
--
-- To check if pg_cron is available:
--   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
--
-- Without pg_cron, call this from the Edge Function:
--   supabase/functions/cart-expire-saved/index.ts
--   Triggered via Supabase scheduled function or a cron job in CI.

-- ─── Verification queries ──────────────────────────────────────────────────────
-- Run these after applying to confirm the function was created:
--
-- SELECT proname, prosecdef, proconfig
-- FROM pg_proc
-- WHERE proname = 'fn_expire_saved_carts';
-- Expected: 1 row, prosecdef=true, proconfig includes 'search_path=public'
--
-- SELECT public.fn_expire_saved_carts();
-- Expected: { "success": true, "expiry_days": 7, "cutoff": "...", "rows_expired": <N> }

-- ─── Rollback ─────────────────────────────────────────────────────────────────
-- To rollback: DROP FUNCTION IF EXISTS public.fn_expire_saved_carts();
-- Note: rows already soft-deleted cannot be automatically un-deleted.
