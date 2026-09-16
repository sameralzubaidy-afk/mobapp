-- Migration: Fix fee config RPC to use SECURITY DEFINER
-- Mode: Idempotent rerunnable migration
--
-- Problem: getAdminConfig() in the mobile app uses direct table access
-- which is subject to RLS. The admin_config RLS policies restrict anon/authenticated
-- reads, causing getAdminConfig() to silently fall back to hardcoded defaults.
-- Meanwhile, get_user_transaction_fee() uses SECURITY DEFINER and reads correct values.
--
-- Fix: Create a dedicated SECURITY DEFINER RPC that returns both subscriber
-- and non-subscriber fee cents, bypassing RLS. The mobile app calls this
-- instead of querying admin_config directly.

-- ============================================================================
-- BLOCK 1: Create fn_get_fee_config RPC (SECURITY DEFINER)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_get_fee_config()
RETURNS TABLE (
  subscriber_cents INTEGER,
  non_subscriber_cents INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(
      (SELECT ac_sub.value::INTEGER
       FROM public.admin_config ac_sub
       WHERE ac_sub.key = 'transaction_fee_subscriber_cents'
         AND ac_sub.is_active = TRUE
       LIMIT 1),
      99
    ) AS subscriber_cents,
    COALESCE(
      (SELECT ac_non.value::INTEGER
       FROM public.admin_config ac_non
       WHERE ac_non.key = 'transaction_fee_non_subscriber_cents'
         AND ac_non.is_active = TRUE
       LIMIT 1),
      299
    ) AS non_subscriber_cents;
END;
$$;

-- Grant execute to anon and authenticated (needed for unauthenticated item views + logged-in views)
GRANT EXECUTE ON FUNCTION public.fn_get_fee_config() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.fn_get_fee_config IS 'V2.1: Returns subscriber and non-subscriber transaction fee cents from admin_config. SECURITY DEFINER to bypass RLS.';

-- ============================================================================
-- BLOCK 2: Verification Queries
-- ============================================================================

-- Test the RPC
-- SELECT * FROM public.fn_get_fee_config();

-- Expected: subscriber_cents = configured value (or 99 default), non_subscriber_cents = configured value (or 299 default)
