-- ============================================================================
-- FIX-Task-20 item 4 (2026-09-12) — tax-rule precedence must be deterministic
--
-- MODE B: idempotent rerunnable migration (CREATE OR REPLACE, same signature — no
--         BP-12 DROP needed).
--
-- Problem (QA finding F7)
--   public.get_applicable_tax_rule() resolved the winning rule with:
--       ORDER BY tr.version DESC LIMIT 1
--   `jurisdiction` is NOT part of the WHERE clause — it is only read out of the
--   winning row. Two ACTIVE rules can legitimately coexist for the same category
--   across different jurisdictions (the overlap trigger is scoped per
--   category + jurisdiction + date range), so which RATE applies was decided purely
--   by whichever rule happened to carry the higher `version`.
--
--   Live staging example (2026-09-12): general_tangible_goods has an active
--   NY v1 @ 10% and an active CT v3 @ 6.99%. The CT rule wins only because 3 > 1.
--   QA reproduced the fragility: deactivating the CT v3 rule and creating a fresh
--   v1 silently promoted the NY 10% rule platform-wide.
--
-- Fix
--   Order by effective_from DESC (newest effective rule wins), then version DESC,
--   then id ASC — a TOTAL order, so the same input always resolves to the same rule
--   and the outcome no longer depends on version numbering alone. The final `id`
--   tiebreak guarantees stability even if two rows share effective_from AND version.
--
--   Deliberately NOT changed here (see FIX-Task-20 "Further Considerations"): making
--   the resolver prefer the jurisdiction in admin_config.tax_remittance_jurisdiction.
--   That is a behaviour change beyond the finding and is left for an explicit owner
--   decision.
--
-- Verification: the resolved rule must be identical across repeated calls, and the
-- BLOCK 2 conflict report must list every category with more than one active rule so
-- the admin can clean up the data-level cause.
-- ============================================================================

-- ============================================================================
-- BLOCK 1 — Function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_applicable_tax_rule(
  p_tax_category_id  UUID,
  p_check_date       TIMESTAMPTZ DEFAULT NOW(),
  p_item_price_cents INTEGER DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  tax_category_id      UUID,
  version              INTEGER,
  display_name         TEXT,
  is_taxable           BOOLEAN,
  tax_rate             DECIMAL(5,4),
  jurisdiction         TEXT,
  min_item_price_cents INTEGER,
  max_item_price_cents INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tr.id,
    tr.tax_category_id,
    tr.version,
    tr.display_name,
    tr.is_taxable,
    tr.tax_rate,
    tr.jurisdiction,
    tr.min_item_price_cents,
    tr.max_item_price_cents
  FROM public.tax_rules tr
  WHERE tr.tax_category_id = p_tax_category_id
    AND tr.is_active = TRUE
    AND tr.effective_from <= p_check_date
    AND (tr.effective_to IS NULL OR tr.effective_to > p_check_date)
    AND (
      p_item_price_cents IS NULL
      OR (
        (tr.min_item_price_cents IS NULL OR p_item_price_cents >= tr.min_item_price_cents)
        AND (tr.max_item_price_cents IS NULL OR p_item_price_cents <= tr.max_item_price_cents)
      )
    )
  -- FIX-Task-20 item 4: deterministic TOTAL order (was `ORDER BY tr.version DESC` alone,
  -- which ignored jurisdiction and had no tiebreak). Newest effective rule wins; then
  -- the highest version; then the id — so repeated calls always resolve identically.
  ORDER BY
    tr.effective_from DESC,
    tr.version        DESC,
    tr.id             ASC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_applicable_tax_rule(UUID, TIMESTAMPTZ, INTEGER)
  TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.get_applicable_tax_rule(UUID, TIMESTAMPTZ, INTEGER) IS
'REPLACED (2026-09-12 FIX-Task-20 item 4): deterministic precedence — ORDER BY effective_from DESC, version DESC, id ASC. Previously version DESC alone, with jurisdiction absent from the predicate. NOTE: with two active rules for one category across jurisdictions, the newest effective rule wins regardless of the platform remittance jurisdiction.';

-- ============================================================================
-- BLOCK 2 — Verification
-- ============================================================================
-- A) Stability probe — run 3x, the id must never change:
-- SELECT tr.id, tr.display_name, tr.jurisdiction, tr.tax_rate, tr.version
-- FROM public.get_applicable_tax_rule(
--        (SELECT tc.id FROM public.tax_categories tc WHERE tc.key = 'general_tangible_goods'),
--        now(), NULL) tr;
--
-- B) DATA-LEVEL CONFLICT REPORT (item 4) — every category with >1 active rule:
-- SELECT tc.key AS category,
--        COUNT(*)                                   AS active_rules,
--        string_agg(DISTINCT tr.jurisdiction, ', ') AS jurisdictions,
--        string_agg(tr.display_name || ' v' || tr.version || ' @' ||
--                   COALESCE((tr.tax_rate * 100)::text, 'node rate'), ' | ') AS rules
-- FROM public.tax_rules tr
-- JOIN public.tax_categories tc ON tc.id = tr.tax_category_id
-- WHERE tr.is_active = TRUE
-- GROUP BY tc.key
-- HAVING COUNT(*) > 1;
-- -- 2026-09-12 baseline: general_tangible_goods has 2 active rules (NY v1 10%, CT v3 6.99%).
-- -- Deactivating the stale NY rule is a DATA decision for the owner, not part of this fix.
--
-- ROLLBACK: re-apply the previous body from 20260729000001_tax_category_aware_preview.sql
-- (ORDER BY tr.version DESC).
-- ============================================================================
