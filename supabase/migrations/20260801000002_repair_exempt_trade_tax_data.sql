-- File: supabase/migrations/20260801000002_repair_exempt_trade_tax_data.sql
-- One-time data repair (2026-08-01) for trades that were incorrectly taxed by the
-- old non-category-aware apply_tax_to_trade RPC (fixed in
-- 20260801000001_fix_apply_tax_to_trade_category_aware.sql).
--
-- Affected pattern: a trade whose item's CURRENT tax category is non-taxable
-- (tax_exempt_goods / review_required) but trade.tax_amount_cents > 0. Those
-- trades had their correct offer-time $0 OVERWRITTEN with a node-rate tax amount
-- (e.g. $6.29) that Stripe never charged — creating the phantom "Sales Tax" shown
-- on the mobile timeline and the admin Trade Details / refund card.
--
-- Repair behavior per affected trade:
--   * Zero the trade's tax columns (tax_amount_cents / taxable_amount_cents = 0,
--     tax_rate_applied / tax_jurisdiction = NULL).
--   * VOID the bogus tax_records row (preserves the audit trail; voided records
--     are excluded from collected-tax reports).
--
-- ⚠️ REVIEW GATE: Run the SELECT in BLOCK 1 first. The UPDATE in BLOCK 2 only
-- touches rows matching that SELECT. If any listed trade was legitimately taxed at
-- sale time (e.g. its item was re-categorized to exempt AFTER the trade), review
-- those rows manually before proceeding.
--
-- Mode A: one-time migration. Safe to re-run (idempotent — second run matches
-- zero rows because tax_amount_cents is already 0).

BEGIN;

-- ============================================================================
-- BLOCK 1 — Review: list every trade affected by the bug
-- ============================================================================
-- SELECT t.id AS trade_id, t.tax_amount_cents, t.taxable_amount_cents,
--        t.tax_rate_applied, t.tax_jurisdiction, tc.key AS tax_category_key
--   FROM public.trades t
--   JOIN public.items i ON i.id = t.listing_id
--   LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
--  WHERE t.tax_amount_cents > 0
--    AND tc.key IN ('tax_exempt_goods', 'review_required')
--  ORDER BY t.created_at DESC;

-- ============================================================================
-- BLOCK 2 — Repair (guarded to the exact pattern above)
-- ============================================================================
DO $$
DECLARE
  v_trade RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_trade IN
    SELECT t.id AS trade_id
      FROM public.trades t
      JOIN public.items i ON i.id = t.listing_id
      LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
     WHERE t.tax_amount_cents > 0
       AND tc.key IN ('tax_exempt_goods', 'review_required')
  LOOP
    UPDATE public.trades
       SET tax_amount_cents     = 0,
           taxable_amount_cents = 0,
           tax_rate_applied     = NULL,
           tax_jurisdiction     = NULL,
           updated_at           = NOW()
     WHERE id = v_trade.trade_id;

    UPDATE public.tax_records
       SET tax_status = 'voided'::public.tax_status,
           voided_at  = COALESCE(voided_at, now()),
           updated_at = now()
     WHERE trade_id = v_trade.trade_id;

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Repaired % trade(s) with incorrectly applied tax on exempt items', v_count;
END;
$$;

COMMIT;

-- ============================================================================
-- Verification (run after applying)
-- ============================================================================
-- 1) Expect ZERO rows:
--    SELECT COUNT(*) FROM public.trades t
--      JOIN public.items i ON i.id = t.listing_id
--      LEFT JOIN public.tax_categories tc ON tc.id = i.tax_category_id
--     WHERE t.tax_amount_cents > 0
--       AND tc.key IN ('tax_exempt_goods', 'review_required');
--
-- 2) Spot-check the specific trade from the bug report (tax should now be $0.00):
--    SELECT id, tax_amount_cents, taxable_amount_cents, tax_rate_applied
--      FROM public.trades WHERE id = '9eae3544-9c00-40dc-b4b2-e80386ce877e';
--    Expected: tax_amount_cents = 0, tax_rate_applied = NULL.
