-- ============================================================================
-- FIX-Task-20 item 3b/3c (2026-09-12) — CT clothing tax bands were inverted
--
-- MODE A: one-time data change. Run BLOCK 1a review first.
-- DEPENDS ON: 20260912000003 (price-band-aware overlap trigger). Band B below would
--             be rejected as an "overlap" by the previous trigger.
--
-- Live evidence (staging, read-only, 2026-09-12) — the single ACTIVE rule for
-- clothing_footwear:
--   "CT Clothing — Under $50 threshold"
--   jurisdiction CT, is_taxable = TRUE, tax_rate NULL (→ node rate), min NULL, max 5000
--
--   ⇒ clothing ≤ $50.00 was TAXED at the node rate, and clothing > $50.00 matched no
--     rule at all (zero rows → non-taxable), i.e. EXEMPT. That is exactly INVERTED vs
--     Connecticut law, where clothing/footwear under $50 per item is exempt and items
--     at $50 and over are taxable.
--
-- Target model — two disjoint active CT bands:
--   band A    $0.00 – $49.99   is_taxable = FALSE               (exempt)
--   band B    $50.00 and over  is_taxable = TRUE, rate NULL      (node rate)
--
--   The boundary split (4999 / 5000) also fixes the edge case in the old model, where
--   `max_item_price_cents = 5000` with `<=` made EXACTLY $50.00 exempt.
--
-- Blast radius: 25 items currently carry tax_category_id = clothing_footwear. (Most
-- clothing listings are unaffected: the live category_tax_mapping sends the *Clothing
-- product category* to general_tangible_goods.) Flipping band A to non-taxable reduces
-- tax on the under-$50 sub-band; band B begins collecting where the old model wrongly
-- exempted.
--
-- Band B is prospective (effective_from = migration run time), matching the platform
-- convention that tax-config changes do not rewrite historical snapshots.
-- ============================================================================

-- ============================================================================
-- BLOCK 1a — REVIEW ONLY (expect 1 row: is_taxable TRUE, max 5000)
-- ============================================================================
-- SELECT tr.id, tr.display_name, tr.is_taxable, tr.jurisdiction, tr.tax_rate,
--        tr.min_item_price_cents, tr.max_item_price_cents
-- FROM public.tax_rules tr
-- JOIN public.tax_categories tc ON tc.id = tr.tax_category_id
-- WHERE tc.key = 'clothing_footwear' AND tr.is_active = TRUE;

-- ============================================================================
-- BLOCK 1b — Data change
-- ============================================================================

-- band A — narrow the existing active row to the EXEMPT under-$50 band.
-- Matched by natural key (category + jurisdiction + active + the known 0-5000 shape),
-- never a hardcoded id. After this runs the row no longer matches `max = 5000`, so a
-- re-run is a no-op.
UPDATE public.tax_rules tr
SET is_taxable           = FALSE,
    tax_rate             = NULL,
    max_item_price_cents = 4999,
    display_name         = 'CT Clothing — Under $50 (exempt)',
    description          = 'Connecticut exempts clothing and footwear under $50 per item. Items at $50.00 and over are covered by the companion "CT Clothing — $50 and over (taxable)" rule. [FIX-Task-20 2026-09-12: corrected an inverted band — this row was previously taxable at the node rate while the >$50 band was exempt.]',
    updated_at           = now()
FROM public.tax_categories tc
WHERE tr.tax_category_id = tc.id
  AND tc.key = 'clothing_footwear'
  AND tr.jurisdiction = 'CT'
  AND tr.is_active = TRUE
  AND tr.min_item_price_cents IS NULL
  AND tr.max_item_price_cents = 5000
  AND tr.is_taxable = TRUE;

-- band B — add the taxable $50-and-over band (node rate), only if absent.
INSERT INTO public.tax_rules (
  tax_category_id,
  version,
  display_name,
  description,
  is_taxable,
  tax_rate,
  jurisdiction,
  is_active,
  min_item_price_cents,
  max_item_price_cents,
  effective_from,
  effective_to
)
SELECT
  tc.id,
  1,
  'CT Clothing — $50 and over (taxable)',
  'Connecticut taxes clothing and footwear at $50.00 and over per item, at the node rate (tax_rate NULL → get_node_tax_rate). Companion to "CT Clothing — Under $50 (exempt)". [FIX-Task-20 2026-09-12: added — previously items above $50 matched no rule and came out exempt.]',
  TRUE,
  NULL,
  'CT',
  TRUE,
  5000,
  NULL,
  now(),
  NULL
FROM public.tax_categories tc
WHERE tc.key = 'clothing_footwear'
  AND NOT EXISTS (
    SELECT 1
    FROM public.tax_rules tr
    WHERE tr.tax_category_id = tc.id
      AND tr.jurisdiction = 'CT'
      AND tr.is_active = TRUE
      AND tr.min_item_price_cents = 5000
  );

-- ============================================================================
-- BLOCK 2 — Verification
-- ============================================================================
-- A) Two active CT bands, disjoint:
-- SELECT tr.display_name, tr.is_taxable, tr.tax_rate, tr.min_item_price_cents, tr.max_item_price_cents
-- FROM public.tax_rules tr
-- JOIN public.tax_categories tc ON tc.id = tr.tax_category_id
-- WHERE tc.key = 'clothing_footwear' AND tr.is_active = TRUE
-- ORDER BY tr.min_item_price_cents NULLS FIRST;
-- -- expect: taxable=false 0-4999 ; taxable=true 5000-NULL
--
-- B) Behavioural probes (replace <node_id>; CT node rate is 0.0635 by default):
-- SELECT public.calculate_tax('<node_id>'::uuid, 2500,
--          (SELECT tc.id FROM public.tax_categories tc WHERE tc.key='clothing_footwear'), 2500);
-- -- expect tax_amount_cents = 0            (under $50 → exempt)
-- SELECT public.calculate_tax('<node_id>'::uuid, 6000,
--          (SELECT tc.id FROM public.tax_categories tc WHERE tc.key='clothing_footwear'), 6000);
-- -- expect tax_amount_cents ≈ 381 (6.35% of 6000) — non-zero, node rate
-- SELECT public.calculate_tax('<node_id>'::uuid, 5000,
--          (SELECT tc.id FROM public.tax_categories tc WHERE tc.key='clothing_footwear'), 5000);
-- -- expect non-zero (exactly $50.00 is TAXABLE — the boundary this migration fixes)
--
-- ROLLBACK: set band A back to is_taxable = TRUE, max_item_price_cents = 5000 and
-- delete band B (clothing_footwear + CT + active + min_item_price_cents = 5000).
-- ============================================================================
