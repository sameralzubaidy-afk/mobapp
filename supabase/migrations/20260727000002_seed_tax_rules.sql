-- File: supabase/migrations/20260727000002_seed_tax_rules.sql
-- Mode A: One-time migration — seeds initial tax rules into tax_rules table.
--
-- Purpose:
-- The tax_rules table was created in 20260723000001 but never seeded with
-- initial rules. Without active rules, get_applicable_tax_rule() returns NULL
-- for every category, and the create-trade-offer Edge Function defaults every
-- item to is_taxable=true using the node's flat rate (e.g., 6.35%). This causes
-- items with tax_category_id = 'tax_exempt_goods' or 'review_required' to be
-- incorrectly taxed.
--
-- This migration inserts one active rule per seeded tax category:
--   general_tangible_goods  → taxable, rate=NULL (uses node rate via calculate_tax)
--   clothing_footwear       → taxable, rate=NULL (uses node rate; admin can add
--                             price-threshold rules via admin portal)
--   tax_exempt_goods        → NOT taxable (tax = $0.00)
--   review_required         → NOT taxable (treated as non-taxable until admin
--                             assigns a definitive category)
--
-- BP-30 cross-ref: docx/SYSTEM_REQUIREMENTS_V2.md §Tax + docx/ADMIN-CATEGORY-MANAGEMENT.md

-- ============================================================================
-- BLOCK 1 — Seed tax rules (idempotent: only inserts if no rules exist)
-- ============================================================================

DO $$
DECLARE
  v_cat_id UUID;
  v_rule_count INTEGER;
BEGIN
  -- Only seed if the tax_rules table is empty
  SELECT COUNT(*) INTO v_rule_count FROM public.tax_rules;

  IF v_rule_count = 0 THEN
    -- === general_tangible_goods: taxable, use node rate ===
    SELECT id INTO v_cat_id FROM public.tax_categories WHERE key = 'general_tangible_goods' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      INSERT INTO public.tax_rules (
        tax_category_id, version, display_name, description,
        is_taxable, tax_rate, jurisdiction, is_active,
        effective_from, effective_to,
        created_by, updated_by
      ) VALUES (
        v_cat_id, 1,
        'Default — General Tangible Goods',
        'Standard taxable rate for physical goods. Tax rate applied from node-level configuration.',
        TRUE, NULL, 'CT', TRUE,
        NOW(), NULL,
        NULL, NULL
      );
    END IF;

    -- === clothing_footwear: taxable, use node rate (no price threshold by default) ===
    SELECT id INTO v_cat_id FROM public.tax_categories WHERE key = 'clothing_footwear' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      INSERT INTO public.tax_rules (
        tax_category_id, version, display_name, description,
        is_taxable, tax_rate, jurisdiction, is_active,
        effective_from, effective_to,
        created_by, updated_by
      ) VALUES (
        v_cat_id, 1,
        'Default — Clothing and Footwear',
        'Standard taxable rate for clothing and footwear. No price threshold applied by default; admin can add threshold rules via Tax Rules admin page.',
        TRUE, NULL, 'CT', TRUE,
        NOW(), NULL,
        NULL, NULL
      );
    END IF;

    -- === tax_exempt_goods: NOT taxable ===
    SELECT id INTO v_cat_id FROM public.tax_categories WHERE key = 'tax_exempt_goods' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      INSERT INTO public.tax_rules (
        tax_category_id, version, display_name, description,
        is_taxable, tax_rate, jurisdiction, is_active,
        effective_from, effective_to,
        created_by, updated_by
      ) VALUES (
        v_cat_id, 1,
        'Default — Tax Exempt Goods',
        'Items in this category are not subject to sales tax.',
        FALSE, NULL, 'CT', TRUE,
        NOW(), NULL,
        NULL, NULL
      );
    END IF;

    -- === review_required: NOT taxable (pending admin assignment) ===
    SELECT id INTO v_cat_id FROM public.tax_categories WHERE key = 'review_required' LIMIT 1;
    IF v_cat_id IS NOT NULL THEN
      INSERT INTO public.tax_rules (
        tax_category_id, version, display_name, description,
        is_taxable, tax_rate, jurisdiction, is_active,
        effective_from, effective_to,
        created_by, updated_by
      ) VALUES (
        v_cat_id, 1,
        'Default — Review Required (Tax Decision Pending)',
        'Operational category for items needing a tax decision. Treated as non-taxable until an admin assigns a definitive category.',
        FALSE, NULL, 'CT', TRUE,
        NOW(), NULL,
        NULL, NULL
      );
    END IF;

    RAISE NOTICE 'Seeded 4 default tax rules (tax_rules was empty)';
  ELSE
    RAISE NOTICE 'Skipped seed — tax_rules already has % rule(s)', v_rule_count;
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 2 — Verification queries
-- ============================================================================

-- Verify all 4 categories have an active rule:
-- SELECT tc.key, tc.name, tr.is_taxable, tr.tax_rate, tr.jurisdiction
-- FROM public.tax_categories tc
-- LEFT JOIN public.tax_rules tr ON tr.tax_category_id = tc.id AND tr.is_active = TRUE
-- ORDER BY tc.key;

-- Spot-check that get_applicable_tax_rule returns the correct rule:
-- SELECT * FROM public.get_applicable_tax_rule(
--   (SELECT id FROM public.tax_categories WHERE key = 'tax_exempt_goods' LIMIT 1),
--   NOW()
-- );
-- Expected: is_taxable = false, tax_rate = NULL
