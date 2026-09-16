-- =============================================================================
-- Migration: P0 lockdown — revoke public EXECUTE on the 4 SP ledger RPCs
-- Date: 2026-08-29
-- Mode: Idempotent Rerunnable (Mode B) — REVOKE of an already-revoked grant is
--       a no-op, so re-running is safe.
--
-- Context (Dev Task 56b, supersedes part of DT-56):
--   Task 55 audit (docs/dev-task-55-money-path-server-trust-audit.md, finding
--   #2, P0) found that these four SECURITY DEFINER RPCs:
--     * debit_sp_for_trade(UUID, UUID, INTEGER)
--     * credit_sp_for_cancelled_trade(UUID, UUID, INTEGER)
--     * earn_sp_for_trade(UUID, UUID, INTEGER)
--     * admin_adjust_sp_wallet(UUID, INTEGER, TEXT, TEXT, UUID, TEXT)
--   trust a caller-supplied p_user_id + p_points/p_amount and have NO
--   auth.uid()/role check, with NO explicit REVOKE anywhere → they default to
--   PUBLIC execute (live Q1 confirmed anon/authenticated/PUBLIC all present).
--   Impact: unlimited SP mint/drain (SP buys items at up to 50% off → real loss).
--
-- Caller analysis (verified against live code + migrations, 2026-08-29):
--   * debit_sp_for_trade  -> trade-payment EF only (service-role key) -> service_role
--   * credit_sp_for_cancelled_trade -> trade-payment EF (service key) +
--       cancel_trade_v2 / rpc_auto_cancel_trade / admin_force_cancel_trade_db
--       (ALL SECURITY DEFINER -> internal call runs as function owner)
--   * earn_sp_for_trade   -> complete_trade_v2 / rpc_apply_trade_extension
--       (ALL SECURITY DEFINER -> internal call runs as function owner)
--   * admin_adjust_sp_wallet -> admin portal /api/admin/sp-wallet/actions
--       (service-role key + x-admin-secret gate) -> service_role
--   No DB trigger calls any of these (SP reservation is done directly by
--   fn_reserve_sp_on_offer, not via these RPCs).
--   => Keeping service_role EXECUTE covers every legitimate path; SECURITY
--      DEFINER callers already run as owner (postgres) which always has EXECUTE.
--
-- Rollback (one-line reverse per function, restores the pre-change state):
--   GRANT EXECUTE ON FUNCTION public.debit_sp_for_trade(UUID, UUID, INTEGER)
--     TO anon, authenticated, PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.credit_sp_for_cancelled_trade(UUID, UUID, INTEGER)
--     TO anon, authenticated, PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.earn_sp_for_trade(UUID, UUID, INTEGER)
--     TO anon, authenticated, PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.admin_adjust_sp_wallet(UUID, INTEGER, TEXT, TEXT, UUID, TEXT)
--     TO anon, authenticated, PUBLIC;
-- =============================================================================

-- 1. debit_sp_for_trade
REVOKE EXECUTE ON FUNCTION public.debit_sp_for_trade(UUID, UUID, INTEGER)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.debit_sp_for_trade(UUID, UUID, INTEGER)
  TO service_role;

-- 2. credit_sp_for_cancelled_trade
REVOKE EXECUTE ON FUNCTION public.credit_sp_for_cancelled_trade(UUID, UUID, INTEGER)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_sp_for_cancelled_trade(UUID, UUID, INTEGER)
  TO service_role;

-- 3. earn_sp_for_trade
REVOKE EXECUTE ON FUNCTION public.earn_sp_for_trade(UUID, UUID, INTEGER)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.earn_sp_for_trade(UUID, UUID, INTEGER)
  TO service_role;

-- 4. admin_adjust_sp_wallet (6-arg signature with defaults; single existing overload)
REVOKE EXECUTE ON FUNCTION public.admin_adjust_sp_wallet(UUID, INTEGER, TEXT, TEXT, UUID, TEXT)
  FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_sp_wallet(UUID, INTEGER, TEXT, TEXT, UUID, TEXT)
  TO service_role;

-- =============================================================================
-- Verification (SQL-3 — run AFTER applying; expected per function: EXACTLY
-- service_role, plus the owner postgres; NO anon/authenticated/PUBLIC rows):
--
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_name IN (
--     'debit_sp_for_trade','credit_sp_for_cancelled_trade',
--     'earn_sp_for_trade','admin_adjust_sp_wallet')
--   ORDER BY routine_name, grantee;
--
-- Common failure mode: if anon/authenticated/PUBLIC still appear on any
-- function, the REVOKE did not take effect on the target DB — do NOT proceed
-- to the functional checks.
-- =============================================================================
