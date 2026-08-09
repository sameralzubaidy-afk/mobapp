-- File: supabase/migrations/20260801000005_fix_tax_export_admin_role_check.sql
-- MODULE-15.3-PART3 TAX-008 / TC-P07 (CSV export) bug fix
--
-- MODE B: idempotent rerunnable migration (DROP + CREATE OR REPLACE).
--
-- Problem:
--   The live `get_tax_export_data` (3-param, 31-column) guarded the export with
--   `public.profiles.role = 'admin'`, but the admin portal assigns admin access
--   via the `role_based_access_control` table (see login page
--   src/app/auth/login/page.tsx and SETUP-ADMIN-ROLE.md). A logged-in admin who
--   has an rbac 'admin' row but no `profiles.role = 'admin'` got
--   "FORBIDDEN: Admin role required" when exporting CSV (TC-P07).
--
-- Fix:
--   Re-create the function with the SAME body and signature, changing ONLY the
--   admin guard to match the canonical admin-role source used by every other
--   admin RPC in this repo:
--     public.role_based_access_control rbac WHERE rbac.user_id = auth.uid()
--       AND rbac.role = 'admin'
--
-- No other logic changes. No schema/table changes.

DROP FUNCTION IF EXISTS public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION public.get_tax_export_data(
  p_start_date TIMESTAMPTZ,
  p_end_date   TIMESTAMPTZ,
  p_status_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  trade_id                TEXT,
  buyer_id                TEXT,
  seller_id               TEXT,
  listing_ids             TEXT,
  tax_categories          TEXT,
  jurisdiction            TEXT,
  tax_rule_version        TEXT,
  item_subtotal_cents     INTEGER,
  taxable_item_subtotal   INTEGER,
  platform_fee_cents      INTEGER,
  fee_in_tax_base         TEXT,
  sp_tender_cents         INTEGER,
  card_authorization_cents INTEGER,
  captured_amount_cents   INTEGER,
  refunded_amount_cents   INTEGER,
  tax_amount_cents        INTEGER,
  tax_refunded_cents      INTEGER,
  net_tax_cents           INTEGER,
  tax_status              TEXT,
  trade_status            TEXT,
  stripe_payment_intent   TEXT,
  stripe_capture_id       TEXT,
  stripe_refund_ids       TEXT,
  offer_created_at        TEXT,
  capture_timestamp       TEXT,
  refund_timestamp        TEXT,
  reconciliation_status   TEXT,
  reconciliation_reason   TEXT,
  buyer_email             TEXT,
  node_name               TEXT,
  tax_rate                NUMERIC(7,4)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Admin-only guard (FIX 2026-08-01): canonical admin-role source is
  -- role_based_access_control, matching the admin portal login + all other
  -- admin RPCs. Previously this checked profiles.role, which is not populated
  -- for portal admins and caused TC-P07 "FORBIDDEN: Admin role required".
  IF NOT EXISTS (
    SELECT 1 FROM public.role_based_access_control rbac
    WHERE rbac.user_id = auth.uid() AND rbac.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Admin role required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: p_start_date and p_end_date are required';
  END IF;

  RETURN QUERY
  SELECT
    tr.trade_id::TEXT,
    tr.buyer_id::TEXT,
    COALESCE(t.seller_id::TEXT, '') AS seller_id,
    '' AS listing_ids,
    COALESCE(tr.tax_snapshot->>'categories', '') AS tax_categories,
    COALESCE(tr.tax_jurisdiction, '') AS jurisdiction,
    COALESCE(tr.tax_snapshot->>'rule_version', '') AS tax_rule_version,
    COALESCE((tr.tax_snapshot#>>'{items,0,item_price_cents}'), '0')::INTEGER AS item_subtotal_cents,
    tr.taxable_amount_cents AS taxable_item_subtotal,
    COALESCE(t.buyer_transaction_fee_cents, 0) AS platform_fee_cents,
    COALESCE(tr.tax_snapshot->>'include_fee_in_tax_base', 'false') AS fee_in_tax_base,
    COALESCE(t.sp_amount, 0) * 100 AS sp_tender_cents,
    COALESCE(t.cash_amount_cents + t.buyer_transaction_fee_cents + tr.tax_amount_cents, 0) AS card_authorization_cents,
    CASE WHEN tr.tax_status = 'collected'
      THEN COALESCE(t.cash_amount_cents + t.buyer_transaction_fee_cents + tr.tax_amount_cents, 0)
      ELSE 0
    END AS captured_amount_cents,
    COALESCE(tr.refunded_tax_cents, 0) AS refunded_amount_cents,
    tr.tax_amount_cents,
    COALESCE(tr.refunded_tax_cents, 0) AS tax_refunded_cents,
    tr.tax_amount_cents - COALESCE(tr.refunded_tax_cents, 0) AS net_tax_cents,
    tr.tax_status::TEXT,
    COALESCE(t.status::TEXT, '') AS trade_status,
    COALESCE(t.stripe_payment_intent_id, '') AS stripe_payment_intent,
    COALESCE(tr.stripe_capture_id, '') AS stripe_capture_id,
    COALESCE(tr.stripe_refund_id, '') AS stripe_refund_ids,
    to_char(tr.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS offer_created_at,
    to_char(tr.captured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS capture_timestamp,
    to_char(tr.refunded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS refund_timestamp,
    COALESCE(tr.reconciliation_status, '') AS reconciliation_status,
    COALESCE(tr.reconciliation_reason, '') AS reconciliation_reason,
    COALESCE(u.email::TEXT, '') AS buyer_email,
    COALESCE(n.name::TEXT, '') AS node_name,
    tr.tax_rate
  FROM public.tax_records tr
  LEFT JOIN public.trades t ON t.id = tr.trade_id
  LEFT JOIN auth.users u ON u.id = tr.buyer_id
  LEFT JOIN public.nodes n ON n.id = tr.node_id
  WHERE
    CASE tr.tax_status
      WHEN 'collected' THEN tr.captured_at BETWEEN p_start_date AND p_end_date
      WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at) BETWEEN p_start_date AND p_end_date
      WHEN 'partially_refunded' THEN COALESCE(tr.refunded_at, tr.updated_at, tr.created_at) BETWEEN p_start_date AND p_end_date
      ELSE tr.created_at BETWEEN p_start_date AND p_end_date
    END
    AND (p_status_filter IS NULL OR tr.tax_status::TEXT = p_status_filter)
  ORDER BY
    CASE tr.tax_status
      WHEN 'collected' THEN tr.captured_at
      WHEN 'refunded' THEN COALESCE(tr.refunded_at, tr.updated_at)
      ELSE tr.created_at
    END DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ, TEXT)
  TO authenticated, service_role;

-- ============================================================================
-- Verification queries (BP-10 / SQL-3)
-- ============================================================================
-- 1) Function exists and the admin guard now reads role_based_access_control:
--    SELECT proname, prosrc LIKE '%role_based_access_control rbac%' AS uses_rbac
--    FROM pg_proc WHERE proname = 'get_tax_export_data';
--    -- Expected: 1 row, uses_rbac = true

-- 2) Confirm the caller's signature is intact (3 params):
--    SELECT pg_get_function_identity_arguments(oid)
--    FROM pg_proc WHERE proname = 'get_tax_export_data';
--    -- Expected: 'TIMESTAMPTZ, TIMESTAMPTZ, TEXT'

-- 3) Grants are applied:
--    SELECT proacl FROM pg_proc WHERE proname = 'get_tax_export_data';
--    -- Expected: contains authenticated + service_role EXECUTE

-- 4) Sample call (replace with the real dates):
--    SELECT COUNT(*) FROM public.get_tax_export_data(
--      NOW() - INTERVAL '30 days', NOW(), NULL);
--    -- Expected: returns a row count without 'FORBIDDEN: Admin role required'
--      when invoked by a user whose user_id has role='admin' in
--      role_based_access_control.
--
-- Common failure modes:
--   * If the caller still sees FORBIDDEN, verify the calling Supabase session
--     resolves (auth.uid() not NULL) and that the user_id has an
--     'admin' row in public.role_based_access_control.
--   * Do not edit older historical migrations (20260510000007 /
--     20260724000001) — their overloads are dropped by later migrations; the
--     live definition is this 3-param version only.
