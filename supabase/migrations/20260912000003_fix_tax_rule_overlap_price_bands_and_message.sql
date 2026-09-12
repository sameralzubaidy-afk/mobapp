-- ============================================================================
-- FIX-Task-20 items 3 + F5 (2026-09-12) — overlap trigger: price bands + copy
--
-- MODE B: idempotent rerunnable migration (CREATE OR REPLACE, DROP+CREATE trigger).
--
-- Two changes to public.fn_check_tax_rule_overlap():
--
-- 1. PRICE-BAND AWARENESS (prerequisite for FIX-Task-20 item 3)
--    The original trigger (20260723000001, L141-175) treated ANY two active rules
--    for the same (tax_category_id, jurisdiction) with overlapping DATE ranges as a
--    conflict — price bands were ignored. That made a legitimate two-band model
--    impossible: Connecticut exempts clothing/footwear under $50 per item but taxes
--    items at $50 and over, which needs two disjoint-price-band rules for the same
--    category. Bands are now compared too:
--        NULL min = unbounded below,  NULL max = unbounded above
--        bands that do not intersect are NOT a conflict
--    Date-range strictness is UNCHANGED — a genuine date overlap still conflicts.
--
-- 2. ADMIN-READABLE MESSAGE (F5)
--    The old RAISE interpolated the raw tax_category_id UUID:
--      "Overlapping active tax rule exists for category e14198fb-… and jurisdiction CT…"
--    The message now names the category (name + key), the conflicting rule and its
--    effective window; the ids move to a HINT so support can still trace them.
--
-- Verification: probe the trigger by attempting a knowingly-overlapping insert
-- inside a transaction that is rolled back, and a disjoint-band insert that must
-- SUCCEED. See BLOCK 2.
-- ============================================================================

-- ============================================================================
-- BLOCK 1 — Function + trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_check_tax_rule_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_category_name TEXT;
  v_category_key  TEXT;
  v_conflict_id   UUID;
  v_conflict_rule TEXT;
  v_conflict_from TEXT;
  v_conflict_to   TEXT;
BEGIN
  -- Name the category so the admin-facing message never leaks a bare UUID (F5).
  SELECT tc.name, tc.key
    INTO v_category_name, v_category_key
  FROM public.tax_categories tc
  WHERE tc.id = NEW.tax_category_id;

  SELECT tr.id,
         tr.display_name,
         to_char(tr.effective_from, 'YYYY-MM-DD'),
         COALESCE(to_char(tr.effective_to, 'YYYY-MM-DD'), 'open-ended')
    INTO v_conflict_id, v_conflict_rule, v_conflict_from, v_conflict_to
  FROM public.tax_rules tr
  WHERE tr.tax_category_id = NEW.tax_category_id
    AND tr.jurisdiction = NEW.jurisdiction
    AND tr.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND tr.is_active = TRUE
    -- Overlapping DATE range (unchanged from the original trigger).
    AND (
      (tr.effective_to IS NULL AND NEW.effective_to IS NULL) OR
      (tr.effective_to IS NULL AND NEW.effective_to >= tr.effective_from) OR
      (NEW.effective_to IS NULL AND tr.effective_to >= NEW.effective_from) OR
      (tr.effective_to IS NOT NULL AND NEW.effective_to IS NOT NULL AND
       tr.effective_from < NEW.effective_to AND NEW.effective_from < tr.effective_to)
    )
    -- Overlapping PRICE band (NEW — FIX-Task-20 item 3). NULL = unbounded.
    AND (
      tr.max_item_price_cents IS NULL
      OR NEW.min_item_price_cents IS NULL
      OR tr.max_item_price_cents >= NEW.min_item_price_cents
    )
    AND (
      tr.min_item_price_cents IS NULL
      OR NEW.max_item_price_cents IS NULL
      OR tr.min_item_price_cents <= NEW.max_item_price_cents
    )
  ORDER BY tr.effective_from DESC
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION
      'A tax rule for "%" (%) in % already covers the same price band and date range: "%" (% to %). Deactivate that rule first, or give this rule a price band that does not overlap it.',
      COALESCE(v_category_name, 'this category'),
      COALESCE(v_category_key, 'unknown key'),
      NEW.jurisdiction,
      v_conflict_rule,
      v_conflict_from,
      v_conflict_to
      USING ERRCODE = 'P0001',
            HINT = format('tax_category_id=%s conflicting_rule_id=%s',
                          NEW.tax_category_id, v_conflict_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_tax_rule_overlap ON public.tax_rules;
CREATE TRIGGER trg_check_tax_rule_overlap
  BEFORE INSERT OR UPDATE ON public.tax_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_check_tax_rule_overlap();

-- ============================================================================
-- BLOCK 2 — Verification
-- ============================================================================
-- A) Trigger still present and pointing at this function:
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'public.tax_rules'::regclass;
--
-- B) Disjoint price bands must now be ACCEPTED (this is what item 3 depends on).
--    Run inside a rolled-back transaction:
-- BEGIN;
--   INSERT INTO public.tax_rules (tax_category_id, version, display_name, is_taxable,
--                                 jurisdiction, is_active, min_item_price_cents, max_item_price_cents)
--   SELECT tc.id, 99, 'overlap-probe disjoint band', TRUE, 'CT', TRUE, 999900, NULL
--   FROM public.tax_categories tc WHERE tc.key = 'clothing_footwear';
-- ROLLBACK;   -- expect: INSERT 0 1 (no exception)
--
-- C) A genuinely overlapping band must still be REJECTED, with a named message:
-- BEGIN;
--   INSERT INTO public.tax_rules (tax_category_id, version, display_name, is_taxable,
--                                 jurisdiction, is_active, min_item_price_cents, max_item_price_cents)
--   SELECT tc.id, 99, 'overlap-probe conflict', TRUE, 'CT', TRUE, NULL, 100
--   FROM public.tax_categories tc WHERE tc.key = 'clothing_footwear';
-- ROLLBACK;   -- expect: P0001 with the category NAME in the message, ids only in HINT
--
-- ROLLBACK: re-apply 20260723000001's version of fn_check_tax_rule_overlap (the
-- trigger definition itself is unchanged in shape).
-- ============================================================================
