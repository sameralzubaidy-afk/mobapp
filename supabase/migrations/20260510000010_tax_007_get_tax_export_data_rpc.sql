-- File: supabase/migrations/20260510000007_tax_007_get_tax_export_data_rpc.sql
-- MODULE-15.3-PART3 TAX-006: get_tax_export_data
-- Idempotent (Mode B). Returns TABLE rows suitable for CSV export (CT DRS format).
-- SECURITY DEFINER — joins auth.users; admin-only via runtime check.

CREATE OR REPLACE FUNCTION public.get_tax_export_data(
  p_start_date TIMESTAMPTZ,
  p_end_date   TIMESTAMPTZ
)
RETURNS TABLE (
  transaction_date    TEXT,
  buyer_email         TEXT,
  node_name           TEXT,
  taxable_amount_usd  NUMERIC(10,2),
  tax_rate            NUMERIC(7,4),
  tax_amount_usd      NUMERIC(10,2),
  refunded_tax_usd    NUMERIC(10,2),
  net_tax_usd         NUMERIC(10,2)
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Admin-only guard
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN: Admin role required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: p_start_date and p_end_date are required';
  END IF;

  RETURN QUERY
  SELECT
    to_char(tr.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')         AS transaction_date,
    COALESCE(u.email::TEXT, 'unknown')                                                AS buyer_email,
    COALESCE(n.name::TEXT, 'unknown')                                                 AS node_name,
    ROUND(tr.taxable_amount_cents::NUMERIC / 100, 2)                                  AS taxable_amount_usd,
    tr.tax_rate                                                                       AS tax_rate,
    ROUND(tr.tax_amount_cents::NUMERIC / 100, 2)                                      AS tax_amount_usd,
    ROUND(tr.refunded_tax_cents::NUMERIC / 100, 2)                                    AS refunded_tax_usd,
    ROUND((tr.tax_amount_cents - tr.refunded_tax_cents)::NUMERIC / 100, 2)           AS net_tax_usd
  FROM public.tax_records tr
  LEFT JOIN auth.users u ON u.id = tr.buyer_id
  LEFT JOIN public.nodes n ON n.id = tr.node_id
  WHERE tr.created_at BETWEEN p_start_date AND p_end_date
  ORDER BY tr.created_at DESC;
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_tax_export_data(TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated, service_role;

-- Verification queries
-- SELECT COUNT(*) FROM public.get_tax_export_data(NOW() - INTERVAL '30 days', NOW());
-- SELECT proname FROM pg_proc WHERE proname = 'get_tax_export_data';
