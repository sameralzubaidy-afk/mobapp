-- File: supabase/migrations/20260528000012_seller_cancel_consequences.sql
-- TFV2-023: Progressive Seller Cancellation Consequences
-- Migration Mode: B — idempotent (safe to re-run)
--
-- Adds profile columns (IF NOT EXISTS — TFV2-002 may already have these)
-- + fn_handle_seller_cancellation DB function.
--
-- Execution order:
--   BLOCK 1: Schema (ALTER TABLE + function)
--   BLOCK 2: Security (REVOKE/GRANT)
-- Run BLOCK 1 first, verify, then BLOCK 2.

-- ============================================================
-- BLOCK 1: Schema
-- ============================================================

-- 1a. Ensure profiles has the counter and flag columns.
-- (Added by TFV2-002 in prior migration; IF NOT EXISTS is idempotent.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS post_acceptance_cancellation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_review_flagged_at TIMESTAMPTZ;

-- 1b. DB function for progressive cancellation consequences.
-- SECURITY DEFINER: needed to UPDATE profiles bypassing RLS for any seller.
-- Called only from service_role (cancel-trade Edge Function).
-- seller_id in trades = auth.uid() = profiles.user_id
CREATE OR REPLACE FUNCTION public.fn_handle_seller_cancellation(
  p_seller_id UUID,
  p_trade_id  UUID
) RETURNS JSONB AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  -- Increment the post-acceptance cancellation counter for this seller.
  UPDATE public.profiles
  SET post_acceptance_cancellation_count =
        COALESCE(post_acceptance_cancellation_count, 0) + 1
  WHERE user_id = p_seller_id
  RETURNING post_acceptance_cancellation_count INTO v_new_count;

  -- Level 3+: flag for admin review (idempotent — only sets once, never overwrites).
  IF COALESCE(v_new_count, 0) >= 3 THEN
    UPDATE public.profiles
    SET admin_review_flagged_at = NOW()
    WHERE user_id = p_seller_id
      AND admin_review_flagged_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'new_count',      COALESCE(v_new_count, 0),
    'level',          CASE
                        WHEN COALESCE(v_new_count, 0) = 1 THEN 1
                        WHEN COALESCE(v_new_count, 0) = 2 THEN 2
                        ELSE 3
                      END,
    'admin_flag_set', COALESCE(v_new_count, 0) >= 3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- BLOCK 2: Security
-- ============================================================

-- Revoke from PUBLIC, grant to service_role only.
-- Called exclusively from cancel-trade Edge Function (server-side, service role).
REVOKE ALL ON FUNCTION public.fn_handle_seller_cancellation(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_handle_seller_cancellation(UUID, UUID) TO service_role;

-- ============================================================
-- Verification queries (run after applying):
-- ============================================================
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'profiles'
--    AND column_name IN ('post_acceptance_cancellation_count', 'admin_review_flagged_at');
--
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'fn_handle_seller_cancellation';
--
-- SELECT grantee, privilege_type
--   FROM information_schema.routine_privileges
--  WHERE specific_name LIKE 'fn_handle_seller_cancellation%';
-- ============================================================
