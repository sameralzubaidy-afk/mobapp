-- =============================================================================
-- Migration: P0 lockdown — revoke public EXECUTE on secure_upsert_admin_config
-- Date: 2026-08-29
-- Mode: Idempotent Rerunnable (Mode B) — safe to re-run; REVOKE of an already
--       revoked grant is a no-op.
--
-- Context (Dev Task 56a, supersedes DT-56):
--   Task 55 audit (docs/dev-task-55-money-path-server-trust-audit.md, finding #1,
--   P0) found that public.secure_upsert_admin_config:
--     * is SECURITY DEFINER (runs as owner, bypasses RLS),
--     * has NO auth/admin check inside the function body,
--     * is granted EXECUTE to anon + authenticated (+ implicit PUBLIC default
--       execute — live Q1 confirmed anon/authenticated/PUBLIC all present).
--   Because Edge Functions read admin_config LIVE at transaction time, any
--   caller could rewrite every money lever (fees, caps, payout enable,
--   trial/grace days) and have the tampered value take effect on the next
--   charge/payout.
--
-- Fix: keep the function callable ONLY by service_role — the exact role the
--   admin portal's config-save API authenticates with via SUPABASE_SERVICE_ROLE_KEY
--   (p2p-kids-admin/src/app/api/admin/config/route.ts PATCH handler calls
--   /rest/v1/rpc/secure_upsert_admin_config with the service-role key). Grep
--   confirmed no Edge Function or mobile code calls this function, so revoking
--   anon/authenticated/PUBLIC breaks no legitimate path.
--
-- Rollback (one-line reverse, restores the pre-change state exactly):
--   GRANT EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID)
--     TO anon, authenticated, PUBLIC;
-- =============================================================================

-- 1. Revoke public execute. anon + authenticated are PUBLIC members, so all
--    three must be revoked to actually close the hole. service_role keeps its
--    direct grant (see step 2) and is unaffected by the PUBLIC revoke.
REVOKE EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID)
  FROM anon, authenticated, PUBLIC;

-- 2. Re-assert the service_role grant (defensive — it already has a direct
--    grant from 20260721000003; this makes the intended end-state explicit and
--    keeps the legitimate admin-portal write path working).
GRANT EXECUTE ON FUNCTION public.secure_upsert_admin_config(TEXT, TEXT, UUID)
  TO service_role;

-- =============================================================================
-- Verification (SQL-3 — run AFTER applying; expected: EXACTLY service_role,
-- plus the owner postgres; NO anon/authenticated/PUBLIC rows):
--
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_name = 'secure_upsert_admin_config'
--   ORDER BY grantee, privilege_type;
--
-- Common failure mode: if anon/authenticated/PUBLIC still appear, the REVOKE
-- did not take effect on the target DB (check it was applied to
-- drntwgporzabmxdqykrp) — do NOT proceed to the functional check.
-- =============================================================================
