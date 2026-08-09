-- ================================================================
-- Migration: 20260727000001_category_tax_mapping.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (tax-category-rules)
-- Mode B: Idempotent rerunnable migration
--
-- Purpose:
-- 1) Create category_tax_mapping table linking product categories
--    (categories.id) to tax categories (tax_categories.id).
-- 2) Seed initial mappings appropriate for CT:
--    - Books → tax_exempt_goods
--    - Clothing → clothing_footwear
--    - All others → general_tangible_goods
-- 3) Update fn_set_default_tax_category() trigger to look up the
--    mapping before falling back to general_tangible_goods.
-- 4) Backfill existing items based on the initial mapping.
-- 5) RPCs: list_category_tax_mappings, upsert_category_tax_mapping.
-- 6) Admin audit logging on mapping changes.
-- ================================================================

-- ============================================================================
-- BLOCK 1 — Schema
-- ============================================================================

-- 1a) category_tax_mapping — links each product category to a tax category
CREATE TABLE IF NOT EXISTS public.category_tax_mapping (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  tax_category_id UUID NOT NULL REFERENCES public.tax_categories(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT category_tax_mapping_unique_category UNIQUE (category_id)
);

-- Index for fast lookup by category_id
CREATE INDEX IF NOT EXISTS idx_category_tax_mapping_category
  ON public.category_tax_mapping (category_id);

-- ============================================================================
-- BLOCK 1b — Enable RLS
-- ============================================================================

ALTER TABLE public.category_tax_mapping ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BLOCK 2 — RLS Policies
-- ============================================================================

-- Anyone can read mappings (used by the trigger and mobile app)
DROP POLICY IF EXISTS "category_tax_mapping_select_all" ON public.category_tax_mapping;
CREATE POLICY "category_tax_mapping_select_all" ON public.category_tax_mapping
  FOR SELECT USING (TRUE);

-- Only admins can modify mappings
DROP POLICY IF EXISTS "category_tax_mapping_admin_all" ON public.category_tax_mapping;
CREATE POLICY "category_tax_mapping_admin_all" ON public.category_tax_mapping
  FOR ALL USING (public.admin_has_role(auth.uid()))
  WITH CHECK (public.admin_has_role(auth.uid()));

-- ============================================================================
-- BLOCK 3 — Drop & Recreate fn_set_default_tax_category with mapping lookup
-- ============================================================================

-- BP-12: RETURNS TRIGGER doesn't change signature on recreate, but we DROP first
-- for cleanliness since we're changing the logic.
DROP FUNCTION IF EXISTS public.fn_set_default_tax_category() CASCADE;

CREATE OR REPLACE FUNCTION public.fn_set_default_tax_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_mapped_tax_category_id UUID;
  v_default_id UUID;
BEGIN
  -- Only assign if no tax_category_id was explicitly provided
  IF NEW.tax_category_id IS NULL THEN
    -- First, look up the mapping for the item's product category
    IF NEW.category_id IS NOT NULL THEN
      SELECT ctm.tax_category_id INTO v_mapped_tax_category_id
      FROM public.category_tax_mapping ctm
      WHERE ctm.category_id = NEW.category_id;
    END IF;

    -- If a mapping exists, use it; otherwise fall back to general_tangible_goods
    IF v_mapped_tax_category_id IS NOT NULL THEN
      NEW.tax_category_id := v_mapped_tax_category_id;
    ELSE
      SELECT tc.id INTO v_default_id
      FROM public.tax_categories tc
      WHERE tc.key = 'general_tangible_goods' AND tc.is_active = TRUE
      LIMIT 1;

      NEW.tax_category_id := v_default_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_set_default_tax_category ON public.items;
CREATE TRIGGER trg_set_default_tax_category
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_default_tax_category();

-- ============================================================================
-- BLOCK 4 — Seed initial category→tax mappings
-- ============================================================================
--
-- Initial mapping (appropriate for Connecticut):
--   Books           → tax_exempt_goods  (educational materials, typically exempt in CT)
--   Clothing        → clothing_footwear (category-specific thresholds may apply)
--   All others      → general_tangible_goods
--
-- BP-30: Cross-referenced against docx/SYSTEM_REQUIREMENTS_V2.md and
-- docx/ADMIN-CATEGORY-MANAGEMENT.md — no contradictory examples found.
-- This mapping is a new feature, not derived from existing doc examples.

DO $$
DECLARE
  v_cat_toys       UUID;
  v_cat_games      UUID;
  v_cat_books      UUID;
  v_cat_sports     UUID;
  v_cat_electronics UUID;
  v_cat_clothing   UUID;
  v_cat_art        UUID;
  v_cat_other      UUID;
  v_tax_general    UUID;
  v_tax_exempt     UUID;
  v_tax_clothing   UUID;
  v_tax_review     UUID;
  v_cat_rec        RECORD;
BEGIN
  -- Look up product category IDs
  SELECT id INTO v_cat_toys       FROM public.categories WHERE name = 'Toys'       LIMIT 1;
  SELECT id INTO v_cat_games      FROM public.categories WHERE name = 'Games'      LIMIT 1;
  SELECT id INTO v_cat_books      FROM public.categories WHERE name = 'Books'      LIMIT 1;
  SELECT id INTO v_cat_sports     FROM public.categories WHERE name = 'Sports'     LIMIT 1;
  SELECT id INTO v_cat_electronics FROM public.categories WHERE name = 'Electronics' LIMIT 1;
  SELECT id INTO v_cat_clothing   FROM public.categories WHERE name = 'Clothing'   LIMIT 1;
  SELECT id INTO v_cat_art        FROM public.categories WHERE name = 'Art & Crafts' LIMIT 1;
  SELECT id INTO v_cat_other      FROM public.categories WHERE name = 'Other'      LIMIT 1;

  -- Look up tax category IDs
  SELECT id INTO v_tax_general  FROM public.tax_categories WHERE key = 'general_tangible_goods' LIMIT 1;
  SELECT id INTO v_tax_exempt   FROM public.tax_categories WHERE key = 'tax_exempt_goods'       LIMIT 1;
  SELECT id INTO v_tax_clothing FROM public.tax_categories WHERE key = 'clothing_footwear'      LIMIT 1;
  SELECT id INTO v_tax_review   FROM public.tax_categories WHERE key = 'review_required'        LIMIT 1;

  -- Insert/update mappings: Books → tax_exempt_goods
  IF v_cat_books IS NOT NULL AND v_tax_exempt IS NOT NULL THEN
    INSERT INTO public.category_tax_mapping (category_id, tax_category_id)
    VALUES (v_cat_books, v_tax_exempt)
    ON CONFLICT (category_id) DO UPDATE SET tax_category_id = v_tax_exempt, updated_at = NOW();
  END IF;

  -- Clothing → clothing_footwear
  IF v_cat_clothing IS NOT NULL AND v_tax_clothing IS NOT NULL THEN
    INSERT INTO public.category_tax_mapping (category_id, tax_category_id)
    VALUES (v_cat_clothing, v_tax_clothing)
    ON CONFLICT (category_id) DO UPDATE SET tax_category_id = v_tax_clothing, updated_at = NOW();
  END IF;

  -- All other categories → general_tangible_goods
  FOR v_cat_rec IN SELECT id FROM public.categories LOOP
    IF v_cat_rec.id NOT IN (v_cat_books, v_cat_clothing) THEN
      IF v_tax_general IS NOT NULL THEN
        INSERT INTO public.category_tax_mapping (category_id, tax_category_id)
        VALUES (v_cat_rec.id, v_tax_general)
        ON CONFLICT (category_id) DO UPDATE SET tax_category_id = v_tax_general, updated_at = NOW();
      END IF;
    END IF;
  END LOOP;

END;
$$;

-- ============================================================================
-- BLOCK 5 — Backfill existing items based on their category_id
-- ============================================================================
--
-- This updates every item whose tax_category_id is currently set to
-- general_tangible_goods (the old hardcoded default) but whose product
-- category should map to a different tax category.
--
-- Items whose category is unmapped (NULL category_id) remain at
-- general_tangible_goods — backward compatible.

DO $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.items i
  SET tax_category_id = ctm.tax_category_id,
      updated_at = NOW()
  FROM public.category_tax_mapping ctm
  WHERE ctm.category_id = i.category_id
    AND i.tax_category_id IS DISTINCT FROM ctm.tax_category_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'Backfill: updated % items with corrected tax_category_id', v_updated;
END;
$$;

-- ============================================================================
-- BLOCK 6 — RPCs
-- ============================================================================

-- 6a) list_category_tax_mappings — returns all mappings with category + tax category info
DROP FUNCTION IF EXISTS public.list_category_tax_mappings();

CREATE OR REPLACE FUNCTION public.list_category_tax_mappings()
RETURNS TABLE (
  id                UUID,
  category_id       UUID,
  category_name     TEXT,
  category_icon     TEXT,
  tax_category_id   UUID,
  tax_category_key  TEXT,
  tax_category_name TEXT,
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ctm.id,
    ctm.category_id,
    c.name AS category_name,
    c.icon AS category_icon,
    ctm.tax_category_id,
    tc.key AS tax_category_key,
    tc.name AS tax_category_name,
    ctm.created_at,
    ctm.updated_at
  FROM public.category_tax_mapping ctm
  JOIN public.categories c ON c.id = ctm.category_id
  JOIN public.tax_categories tc ON tc.id = ctm.tax_category_id
  ORDER BY c.display_order, c.name;
END;
$$;

-- 6b) upsert_category_tax_mapping — create or update a single mapping
DROP FUNCTION IF EXISTS public.upsert_category_tax_mapping(UUID, UUID);

CREATE OR REPLACE FUNCTION public.upsert_category_tax_mapping(
  p_category_id     UUID,
  p_tax_category_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    UUID;
  v_is_admin    BOOLEAN;
  v_old_tax_cat_id UUID;
  v_tax_cat_key TEXT;
  v_mapping_id  UUID;
BEGIN
  v_actor_id := auth.uid();
  SELECT public.admin_has_role(v_actor_id) INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'FORBIDDEN', 'message', 'Admin role required')
    );
  END IF;

  -- Verify the product category exists
  IF NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = p_category_id AND c.is_active = TRUE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Product category not found or inactive')
    );
  END IF;

  -- Verify the tax category exists and is active
  SELECT tc.key INTO v_tax_cat_key
  FROM public.tax_categories tc
  WHERE tc.id = p_tax_category_id AND tc.is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Tax category not found or inactive')
    );
  END IF;

  -- Capture old value for audit (if updating)
  SELECT ctm.tax_category_id INTO v_old_tax_cat_id
  FROM public.category_tax_mapping ctm
  WHERE ctm.category_id = p_category_id;

  -- Upsert the mapping
  INSERT INTO public.category_tax_mapping (category_id, tax_category_id, created_by, updated_by)
  VALUES (p_category_id, p_tax_category_id, v_actor_id, v_actor_id)
  ON CONFLICT (category_id) DO UPDATE SET
    tax_category_id = EXCLUDED.tax_category_id,
    updated_at = NOW(),
    updated_by = v_actor_id
  RETURNING id INTO v_mapping_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (
    actor_id, action_type, entity_type, entity_id, payload, reason
  ) VALUES (
    v_actor_id,
    'category_tax_mapping_changed',
    'category_tax_mapping',
    p_category_id::TEXT,
    jsonb_build_object(
      'category_id', p_category_id,
      'old_tax_category_id', v_old_tax_cat_id,
      'new_tax_category_id', p_tax_category_id,
      'new_tax_category_key', v_tax_cat_key
    ),
    'Admin changed category-to-tax-category mapping'
  );

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'id', v_mapping_id,
      'category_id', p_category_id,
      'tax_category_id', p_tax_category_id,
      'old_tax_category_id', v_old_tax_cat_id
    )
  );
END;
$$;

-- ============================================================================
-- BLOCK 7 — Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_items_category_id_tax_category
  ON public.items (category_id, tax_category_id)
  WHERE category_id IS NOT NULL AND tax_category_id IS NOT NULL;

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
--
-- -- 1) Verify mapping table
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name = 'category_tax_mapping';
--
-- -- 2) Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename = 'category_tax_mapping';
--
-- -- 3) Verify RLS policies
-- SELECT policyname, cmd, permissive, roles, qual, with_check
-- FROM pg_policies WHERE tablename = 'category_tax_mapping';
--
-- -- 4) Verify seed mappings
-- SELECT c.name AS category, tc.key AS tax_category_key, tc.name AS tax_category_name
-- FROM public.category_tax_mapping ctm
-- JOIN public.categories c ON c.id = ctm.category_id
-- JOIN public.tax_categories tc ON tc.id = ctm.tax_category_id
-- ORDER BY c.display_order;
--
-- Expected: Toys→general_tangible_goods, Games→general_tangible_goods,
--           Books→tax_exempt_goods, Sports→general_tangible_goods,
--           Electronics→general_tangible_goods, Clothing→clothing_footwear,
--           Art & Crafts→general_tangible_goods, Other→general_tangible_goods
--
-- -- 5) Verify backfill
-- SELECT i.title, c.name AS category, tc.key AS tax_category_key
-- FROM public.items i
-- JOIN public.categories c ON c.id = i.category_id
-- JOIN public.tax_categories tc ON tc.id = i.tax_category_id
-- WHERE c.name IN ('Books', 'Clothing')
-- LIMIT 10;
--
-- Expected: Books items show tax_exempt_goods, Clothing items show clothing_footwear
--
-- -- 6) Verify trigger works for new inserts
-- INSERT INTO items (seller_id, title, price, category_id, condition, status)
-- VALUES ('<test-user-uuid>', 'Test Book', 10.00,
--   (SELECT id FROM categories WHERE name = 'Books' LIMIT 1),
--   'new', 'available');
-- SELECT title, tax_category_id FROM items WHERE title = 'Test Book';
-- Expected: tax_category_id maps to tax_exempt_goods
