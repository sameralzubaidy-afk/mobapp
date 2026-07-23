-- Migration: 20260705000000_grant_payout_config_to_authenticated.sql
-- Mode B: Idempotent rerunnable migration
-- Fixes: "permission denied for function get_admin_payout_config" (error 42501)
--        when authenticated users visit the PayoutSettings screen.
--
-- Root cause: The function was created and initially granted to anon + authenticated,
-- but after security lockdown (migration 312) revoked FROM anon only.
-- On some databases the GRANT to authenticated was never applied (migration gaps).
-- This ensures authenticated users can always call it.

-- Safe to re-run: GRANT is idempotent
GRANT EXECUTE ON FUNCTION public.get_admin_payout_config() TO authenticated;

-- =============================================================================
-- Verification
-- =============================================================================

-- Should return TRUE:
-- SELECT has_function_privilege('authenticated', 'public.get_admin_payout_config()', 'EXECUTE');

-- Should return 1 row with config defaults:
-- SELECT * FROM public.get_admin_payout_config();
