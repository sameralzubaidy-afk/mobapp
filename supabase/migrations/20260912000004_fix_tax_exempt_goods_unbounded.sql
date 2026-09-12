-- ============================================================================
-- FIX-Task-20 item 3a (2026-09-12) — tax_exempt_goods must be unbounded
--
-- MODE A: one-time data change. Run the BLOCK 1a review query first.
--
-- Live evidence (staging, read-only, 2026-09-12) — the single ACTIVE rule for
-- tax_exempt_goods:
--   8431c69a-780e-4faa-9205-d69a971d3eaf  "Tax Exempt Goods V4"
--   jurisdiction CT, is_taxable = FALSE, tax_rate NULL, min NULL, MAX = 5000
--
-- Why this matters
--   An "exempt" category must not become taxable above a price point, and its
--   behaviour must not depend on a fail-safe. Traced 2026-09-12:
--     * get_applicable_tax_rule() filters on the price band in its WHERE, so a
--       >$50 item returns ZERO rows (there is no fallback row).
--     * calculate_tax() (20260830230000, L66-79) treats "no rule found" as
--       non-taxable → $0 tax.
--     * create-trade-offer (L851-873) also sets vIsTaxable = false on zero rows
--       ("fail-safe: exempt rather than overtax").
--   So the cap is behaviourally inert today — but it silently makes "exempt" depend
--   on the no-rule fallback rather than on the rule itself, and it is the same
--   shape that produced the inverted clothing rule (see 20260912000005).
--   Removing it makes the intent explicit and future-proof.
--
-- NOTE — this is NOT an over-collection fix. QA report F3 claimed a >$50 exempt item
-- "silently falls back to the node rate and becomes taxable"; that claim is
-- incorrect for both call paths above (verified in code and against live data). The
-- report correction is tracked separately in FIX-Task-20 item 12.
-- ============================================================================

-- ============================================================================
-- BLOCK 1a — REVIEW ONLY (expect exactly 1 row, max_item_price_cents = 5000)
-- ============================================================================
-- SELECT tr.id, tr.display_name, tr.version, tr.is_taxable, tr.jurisdiction,
--        tr.min_item_price_cents, tr.max_item_price_cents
-- FROM public.tax_rules tr
-- JOIN public.tax_categories tc ON tc.id = tr.tax_category_id
-- WHERE tc.key = 'tax_exempt_goods' AND tr.is_active = TRUE;

-- ============================================================================
-- BLOCK 1b — Data change (matched by natural key, never a hardcoded id)
-- ============================================================================
UPDATE public.tax_rules tr
SET min_item_price_cents = NULL,
    max_item_price_cents = NULL,
    description = COALESCE(tr.description, '') ||
      ' [FIX-Task-20 2026-09-12: price band removed — an exempt category is exempt at every price point.]',
    updated_at = now()
FROM public.tax_categories tc
WHERE tr.tax_category_id = tc.id
  AND tc.key = 'tax_exempt_goods'
  AND tr.is_active = TRUE
  AND (tr.min_item_price_cents IS NOT NULL OR tr.max_item_price_cents IS NOT NULL);

-- ============================================================================
-- BLOCK 2 — Verification (expect: unbounded MIN NULL / MAX NULL, single active row)
-- ============================================================================
-- SELECT tr.display_name, tr.is_taxable, tr.min_item_price_cents, tr.max_item_price_cents
-- FROM public.tax_rules tr
-- JOIN public.tax_categories tc ON tc.id = tr.tax_category_id
-- WHERE tc.key = 'tax_exempt_goods' AND tr.is_active = TRUE;
--
-- Behavioural probe — an exempt item ABOVE the old $50 cap must stay $0 tax and
-- must now resolve to the rule itself (not to the no-rule fallback). Replace
-- <node_id> with any node uuid:
-- SELECT public.calculate_tax('<node_id>'::uuid, 6000,
--          (SELECT tc.id FROM public.tax_categories tc WHERE tc.key = 'tax_exempt_goods'),
--          6000);
-- -- expect tax_amount_cents = 0
--
-- ROLLBACK: restore max_item_price_cents = 5000 on the same natural key
-- (tax_exempt_goods + is_active).
-- ============================================================================
