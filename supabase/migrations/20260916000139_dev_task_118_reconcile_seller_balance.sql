-- ============================================================================
-- DEV-TASK-118 (2026-09-05) — Item 2: guard recompute_seller_balance grants
--
-- Migration mode: idempotent-rerunnable (Mode B). REVOKE/GRANT EXECUTE are
-- no-ops when the privilege is already absent/present, so this file is safe to
-- re-run.
--
-- Problem (live-verified 2026-09-05):
--   public.recompute_seller_balance(UUID) is SECURITY DEFINER and WRITES the
--   money table seller_balance (recomputes available/pending/lifetime/trades
--   from trades + seller_payouts), yet it carries a PUBLIC-executable grant
--   (=X/postgres from aclexplode: anon + authenticated + PUBLIC). That leaves a
--   money-writing surface open to any client. It also predates the DT-61
--   event trigger, so it was never auto-revoked.
--
--   seller_balance is the ledger the app's Payout Settings hero trusts; it can
--   drift from reality when trade rows are cleaned/backfilled without the
--   ledger being recomputed (real case: test-seller showed $15,603 available /
--   790 trades vs a real $140.40 available / 25 completed trades). Reconciles
--   must therefore be a PRIVILEGED, auditable action (service_role only) — the
--   qa:payout-fixture `reconcile` subcommand uses this path (BP-78 grant
--   discipline, mirroring DT-59).
--
-- Rollback (restore the pre-DT-118 PUBLIC exposure — NOT recommended):
--   GRANT EXECUTE ON FUNCTION public.recompute_seller_balance(UUID) TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION public.recompute_seller_balance(UUID) TO PUBLIC;
-- ============================================================================

-- BLOCK 1 — grant lockdown (idempotent; safe to re-run)
REVOKE EXECUTE ON FUNCTION public.recompute_seller_balance(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_seller_balance(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recompute_seller_balance(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_seller_balance(UUID) TO service_role;

-- BLOCK 2 — verification (run as separate read-only queries after applying)
--
-- 1) Grant audit — expect ONLY postgres (owner) + service_role:
--    SELECT p.proname, g.grantee, g.privilege_type
--    FROM pg_proc p
--    JOIN pg_namespace n ON n.oid = p.pronamespace
--    LEFT JOIN LATERAL aclexplode(p.proacl) AS a ON true
--    LEFT JOIN LATERAL (SELECT a.grantee::regrole::text AS grantee, a.privilege_type) g ON true
--    WHERE n.nspname = 'public' AND p.proname = 'recompute_seller_balance';
--
-- 2) Reconcile the inflated test-seller row (service_role only) — this is a
--    data fix run separately, NOT part of the migration:
--    SELECT public.recompute_seller_balance('14be337c-aad6-403f-bab2-ba1a7d80b666');
--    Expect available = 14040 ($140.40), pending = 44260 ($442.60),
--    lifetime = 58300 ($583), total_trades_completed = 25.
