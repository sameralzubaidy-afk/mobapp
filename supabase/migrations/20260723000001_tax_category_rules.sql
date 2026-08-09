-- File: supabase/migrations/20260723000001_tax_category_rules.sql
-- Module: MODULE-15.1.2 TradeFlowV2 (tax-category-rules)
-- Mode B: Idempotent rerunnable migration
--
-- Purpose:
-- 1) Create tax_categories table — catalog-level tax categories (e.g.
--    general_tangible_goods, clothing_footwear, tax_exempt_goods, review_required).
-- 2) Create tax_rules table — versioned, effective-dated rule per tax category.
-- 3) Add tax_category_id FK to items table.
-- 4) Seed 4 initial tax categories.
-- 5) Backfill existing items → general_tangible_goods.
-- 6) Add include_fee_in_tax_base admin_config key.
-- 7) RPCs: list_tax_categories, list_tax_rules, upsert_tax_rule,
--    deactivate_tax_rule, update_item_tax_category_admin, get_applicable_tax_rule.
-- 8) RLS policies on new tables.
-- 9) Audit trigger on tax_rules via admin_audit_logs.
-- 10) Overlap validation on insert/update.

-- ============================================================================
-- BLOCK 1 — Schema (tables, columns, constraints, enums)
-- ============================================================================

-- 1a) tax_categories — stable list of catalog tax categories
CREATE TABLE IF NOT EXISTS public.tax_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1b) tax_rules — versioned, effective-dated rules per tax category
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_category_id      UUID NOT NULL REFERENCES public.tax_categories(id) ON DELETE RESTRICT,
  version              INTEGER NOT NULL DEFAULT 1,
  display_name         TEXT NOT NULL,
  description          TEXT,
  is_taxable           BOOLEAN NOT NULL DEFAULT TRUE,
  tax_rate             DECIMAL(5,4),       -- NULL = use node rate
  jurisdiction         TEXT NOT NULL DEFAULT 'CT',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  min_item_price_cents INTEGER,            -- NULL = no floor
  max_item_price_cents INTEGER,            -- NULL = no ceiling
  effective_from       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to         TIMESTAMPTZ,        -- NULL = ongoing
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT tax_rules_price_range_chk CHECK (
    (min_item_price_cents IS NULL) OR
    (max_item_price_cents IS NULL) OR
    (min_item_price_cents <= max_item_price_cents)
  ),
  CONSTRAINT tax_rules_rate_range_chk CHECK (
    tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate <= 1)
  ),
  CONSTRAINT tax_rules_effective_range_chk CHECK (
    effective_to IS NULL OR effective_from < effective_to
  )
);

-- Index for effective-dated lookups
CREATE INDEX IF NOT EXISTS idx_tax_rules_category_active
  ON public.tax_rules (tax_category_id, is_active, effective_from, effective_to);

CREATE INDEX IF NOT EXISTS idx_tax_rules_effective_lookup
  ON public.tax_rules (is_active, effective_from, effective_to)
  WHERE is_active = TRUE;

-- 1c) Add tax_category_id to items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'items' AND column_name = 'tax_category_id'
  ) THEN
    ALTER TABLE public.items
      ADD COLUMN tax_category_id UUID REFERENCES public.tax_categories(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- 1d) Ensure admin_config category enum has 'tax' value
DO $$
BEGIN
  BEGIN
    ALTER TYPE public.admin_config_category ADD VALUE IF NOT EXISTS 'tax';
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;
END;
$$;

-- 1e) Add include_fee_in_tax_base to admin_config
INSERT INTO public.admin_config (key, value, description, category, data_type, is_active)
VALUES (
  'include_fee_in_tax_base',
  'false',
  'When enabled, the mandatory buyer marketplace/transaction fee is included in the sales-tax taxable base. This is a prospective-only setting — historical trades retain their original tax snapshot.',
  'tax',
  'boolean',
  true
) ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- BLOCK 1b — Enable RLS
-- ============================================================================

ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BLOCK 2 — RLS Policies
-- ============================================================================

-- Tax categories: anyone can read active, admin has full access
DROP POLICY IF EXISTS "tax_categories_select_all" ON public.tax_categories;
CREATE POLICY "tax_categories_select_all" ON public.tax_categories
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "tax_categories_admin_all" ON public.tax_categories;
CREATE POLICY "tax_categories_admin_all" ON public.tax_categories
  FOR ALL USING (public.admin_has_role(auth.uid()))
  WITH CHECK (public.admin_has_role(auth.uid()));

-- Tax rules: anyone can read active, admin has full access
DROP POLICY IF EXISTS "tax_rules_select_all" ON public.tax_rules;
CREATE POLICY "tax_rules_select_all" ON public.tax_rules
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "tax_rules_admin_all" ON public.tax_rules;
CREATE POLICY "tax_rules_admin_all" ON public.tax_rules
  FOR ALL USING (public.admin_has_role(auth.uid()))
  WITH CHECK (public.admin_has_role(auth.uid()));

-- ============================================================================
-- BLOCK 2b — Overlap validation trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_check_tax_rule_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_overlap_count INTEGER;
BEGIN
  -- Prevent overlapping active rules for the same tax_category_id + jurisdiction + date range
  SELECT COUNT(*) INTO v_overlap_count
  FROM public.tax_rules tr
  WHERE tr.tax_category_id = NEW.tax_category_id
    AND tr.jurisdiction = NEW.jurisdiction
    AND tr.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    AND tr.is_active = TRUE
    AND (
      (tr.effective_to IS NULL AND NEW.effective_to IS NULL) OR
      (tr.effective_to IS NULL AND NEW.effective_to >= tr.effective_from) OR
      (NEW.effective_to IS NULL AND tr.effective_to >= NEW.effective_from) OR
      (tr.effective_to IS NOT NULL AND NEW.effective_to IS NOT NULL AND
       tr.effective_from < NEW.effective_to AND NEW.effective_from < tr.effective_to)
    );

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'Overlapping active tax rule exists for category % and jurisdiction % in the same date range',
      NEW.tax_category_id, NEW.jurisdiction
      USING ERRCODE = 'P0001';
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
-- BLOCK 2c — Audit trigger on tax_rules
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_audit_tax_rule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_changes JSONB;
  v_actor_id UUID;
BEGIN
  v_actor_id := COALESCE(auth.uid(), NEW.updated_by, OLD.updated_by);

  IF TG_OP = 'INSERT' THEN
    v_changes := jsonb_build_object('action', 'created', 'new', row_to_json(NEW)::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Build a before/after diff of changed columns
    v_changes := jsonb_build_object(
      'action', 'updated',
      'before', jsonb_build_object(
        'display_name', OLD.display_name,
        'is_taxable', OLD.is_taxable,
        'tax_rate', OLD.tax_rate,
        'jurisdiction', OLD.jurisdiction,
        'is_active', OLD.is_active,
        'min_item_price_cents', OLD.min_item_price_cents,
        'max_item_price_cents', OLD.max_item_price_cents,
        'effective_from', OLD.effective_from,
        'effective_to', OLD.effective_to
      ),
      'after', jsonb_build_object(
        'display_name', NEW.display_name,
        'is_taxable', NEW.is_taxable,
        'tax_rate', NEW.tax_rate,
        'jurisdiction', NEW.jurisdiction,
        'is_active', NEW.is_active,
        'min_item_price_cents', NEW.min_item_price_cents,
        'max_item_price_cents', NEW.max_item_price_cents,
        'effective_from', NEW.effective_from,
        'effective_to', NEW.effective_to
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_changes := jsonb_build_object('action', 'deleted', 'old', row_to_json(OLD)::jsonb);
  END IF;

  INSERT INTO public.admin_audit_logs (
    actor_id, action_type, entity_type, entity_id, payload, reason
  ) VALUES (
    v_actor_id,
    CASE TG_OP
      WHEN 'INSERT' THEN 'tax_rule_created'
      WHEN 'UPDATE' THEN 'tax_rule_updated'
      WHEN 'DELETE' THEN 'tax_rule_deleted'
    END,
    'tax_rule',
    COALESCE(NEW.id, OLD.id)::TEXT,
    v_changes,
    'Tax rule change audited by trigger'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_tax_rule_change ON public.tax_rules;
CREATE TRIGGER trg_audit_tax_rule_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tax_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_tax_rule_change();

-- ============================================================================
-- BLOCK 3 — Seed data (4 initial tax categories)
-- ============================================================================

INSERT INTO public.tax_categories (key, name, description, is_active)
VALUES
  ('general_tangible_goods', 'General Tangible Goods',
   'Default taxable category for most physical items. Subject to standard sales tax.', true),
  ('clothing_footwear', 'Clothing and Footwear',
   'Clothing and footwear items. Optional price thresholds may apply (e.g., items under a threshold may be exempt).', true),
  ('tax_exempt_goods', 'Tax Exempt Goods',
   'Items that are not subject to sales tax (e.g., certain educational materials, qualifying essentials).', true),
  ('review_required', 'Review Required — Tax Decision Pending',
   'Operational category for items needing a tax decision. These items are treated as non-taxable until an admin assigns a definitive category.', true)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- BLOCK 3b — Backfill existing items to general_tangible_goods
-- ============================================================================

DO $$
DECLARE
  v_default_id UUID;
BEGIN
  SELECT id INTO v_default_id FROM public.tax_categories WHERE key = 'general_tangible_goods' LIMIT 1;

  IF v_default_id IS NOT NULL THEN
    UPDATE public.items i
    SET tax_category_id = v_default_id
    WHERE i.tax_category_id IS NULL;
  END IF;
END;
$$;

-- ============================================================================
-- BLOCK 3c — Trigger: auto-assign default tax_category_id on items INSERT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_set_default_tax_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_default_id UUID;
BEGIN
  IF NEW.tax_category_id IS NULL THEN
    SELECT id INTO v_default_id FROM public.tax_categories
    WHERE key = 'general_tangible_goods' AND is_active = TRUE
    LIMIT 1;

    NEW.tax_category_id := v_default_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_tax_category ON public.items;
CREATE TRIGGER trg_set_default_tax_category
  BEFORE INSERT ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_set_default_tax_category();

-- ============================================================================
-- BLOCK 4 — RPCs
-- ============================================================================

-- 4a) list_tax_categories — returns all tax categories
CREATE OR REPLACE FUNCTION public.list_tax_categories()
RETURNS TABLE (
  id          UUID,
  key         TEXT,
  name        TEXT,
  description TEXT,
  is_active   BOOLEAN,
  created_at  TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT tc.id, tc.key, tc.name, tc.description, tc.is_active, tc.created_at, tc.updated_at
  FROM public.tax_categories tc
  ORDER BY tc.key;
END;
$$;

-- 4b) list_tax_rules — returns tax rules, optionally filtered
CREATE OR REPLACE FUNCTION public.list_tax_rules(
  p_active_only BOOLEAN DEFAULT TRUE,
  p_tax_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id                   UUID,
  tax_category_id      UUID,
  tax_category_key     TEXT,
  tax_category_name    TEXT,
  version              INTEGER,
  display_name         TEXT,
  description          TEXT,
  is_taxable           BOOLEAN,
  tax_rate             DECIMAL(5,4),
  jurisdiction         TEXT,
  is_active            BOOLEAN,
  min_item_price_cents INTEGER,
  max_item_price_cents INTEGER,
  effective_from       TIMESTAMPTZ,
  effective_to         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  created_by           UUID,
  updated_by           UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tr.id,
    tr.tax_category_id,
    tc.key,
    tc.name,
    tr.version,
    tr.display_name,
    tr.description,
    tr.is_taxable,
    tr.tax_rate,
    tr.jurisdiction,
    tr.is_active,
    tr.min_item_price_cents,
    tr.max_item_price_cents,
    tr.effective_from,
    tr.effective_to,
    tr.created_at,
    tr.updated_at,
    tr.created_by,
    tr.updated_by
  FROM public.tax_rules tr
  JOIN public.tax_categories tc ON tc.id = tr.tax_category_id
  WHERE (p_active_only IS NOT TRUE OR tr.is_active = TRUE)
    AND (p_tax_category_id IS NULL OR tr.tax_category_id = p_tax_category_id)
  ORDER BY tc.key, tr.effective_from DESC;
END;
$$;

-- 4c) upsert_tax_rule — create or update (versioned) a tax rule
CREATE OR REPLACE FUNCTION public.upsert_tax_rule(
  p_rule_id            UUID DEFAULT NULL,
  p_tax_category_id    UUID DEFAULT NULL,
  p_display_name       TEXT DEFAULT NULL,
  p_description        TEXT DEFAULT NULL,
  p_is_taxable         BOOLEAN DEFAULT NULL,
  p_tax_rate           DECIMAL(5,4) DEFAULT NULL,
  p_jurisdiction       TEXT DEFAULT NULL,
  p_min_item_price_cents INTEGER DEFAULT NULL,
  p_max_item_price_cents INTEGER DEFAULT NULL,
  p_effective_from     TIMESTAMPTZ DEFAULT NULL,
  p_effective_to       TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    UUID;
  v_is_admin    BOOLEAN;
  v_existing    public.tax_rules%ROWTYPE;
  v_new_rule_id UUID;
  v_version     INTEGER;
  v_tax_cat_id  UUID;
BEGIN
  v_actor_id := auth.uid();
  SELECT public.admin_has_role(v_actor_id) INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'FORBIDDEN', 'message', 'Admin role required')
    );
  END IF;

  -- If updating an existing rule, close the current version and create a new one
  IF p_rule_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.tax_rules tr WHERE tr.id = p_rule_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Tax rule not found')
      );
    END IF;

    -- Close the existing rule's effective period and mark it inactive
    UPDATE public.tax_rules tr
    SET is_active = FALSE,
        effective_to = GREATEST(COALESCE(p_effective_from, NOW()), effective_from + INTERVAL '1 microsecond'),
        updated_at = NOW(),
        updated_by = v_actor_id
    WHERE tr.id = p_rule_id;

    -- Create new version with the updated values
    v_version := v_existing.version + 1;
    v_tax_cat_id := COALESCE(p_tax_category_id, v_existing.tax_category_id);

    INSERT INTO public.tax_rules (
      tax_category_id, version, display_name, description,
      is_taxable, tax_rate, jurisdiction, is_active,
      min_item_price_cents, max_item_price_cents,
      effective_from, effective_to,
      created_by, updated_by
    ) VALUES (
      v_tax_cat_id,
      v_version,
      COALESCE(p_display_name, v_existing.display_name),
      COALESCE(p_description, v_existing.description),
      COALESCE(p_is_taxable, v_existing.is_taxable),
      COALESCE(p_tax_rate, v_existing.tax_rate),
      COALESCE(p_jurisdiction, v_existing.jurisdiction),
      TRUE,
      COALESCE(p_min_item_price_cents, v_existing.min_item_price_cents),
      COALESCE(p_max_item_price_cents, v_existing.max_item_price_cents),
      COALESCE(p_effective_from, v_existing.effective_to, NOW()),
      p_effective_to,
      v_actor_id,
      v_actor_id
    )
    RETURNING id INTO v_new_rule_id;

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'id', v_new_rule_id,
        'version', v_version,
        'previous_version_id', p_rule_id,
        'previous_version', v_existing.version
      )
    );
  ELSE
    -- Creating a new rule
    v_tax_cat_id := p_tax_category_id;
    IF v_tax_cat_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object('code', 'VALIDATION', 'message', 'tax_category_id is required for new rules')
      );
    END IF;

    INSERT INTO public.tax_rules (
      tax_category_id, version, display_name, description,
      is_taxable, tax_rate, jurisdiction, is_active,
      min_item_price_cents, max_item_price_cents,
      effective_from, effective_to,
      created_by, updated_by
    ) VALUES (
      v_tax_cat_id,
      1,
      COALESCE(p_display_name, ''),
      p_description,
      COALESCE(p_is_taxable, TRUE),
      p_tax_rate,
      COALESCE(p_jurisdiction, 'CT'),
      TRUE,
      p_min_item_price_cents,
      p_max_item_price_cents,
      COALESCE(p_effective_from, NOW()),
      p_effective_to,
      v_actor_id,
      v_actor_id
    )
    RETURNING id INTO v_new_rule_id;

    RETURN jsonb_build_object(
      'success', true,
      'data', jsonb_build_object('id', v_new_rule_id, 'version', 1)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', SQLSTATE, 'message', SQLERRM)
    );
END;
$$;

-- 4d) deactivate_tax_rule — soft-deactivate a rule (sets is_active = false and effective_to)
CREATE OR REPLACE FUNCTION public.deactivate_tax_rule(
  p_rule_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  v_actor_id := auth.uid();
  SELECT public.admin_has_role(v_actor_id) INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'FORBIDDEN', 'message', 'Admin role required')
    );
  END IF;

  UPDATE public.tax_rules tr
  SET is_active = FALSE,
      effective_to = LEAST(COALESCE(tr.effective_to, NOW()), NOW()),
      updated_at = NOW(),
      updated_by = v_actor_id
  WHERE tr.id = p_rule_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Tax rule not found')
    );
  END IF;

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object('id', p_rule_id, 'is_active', false));
END;
$$;

-- 4e) update_item_tax_category_admin — admin changes a listing's tax category
CREATE OR REPLACE FUNCTION public.update_item_tax_category_admin(
  p_item_id         UUID,
  p_tax_category_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id UUID;
  v_is_admin BOOLEAN;
  v_old_tax_cat_id UUID;
BEGIN
  v_actor_id := auth.uid();
  SELECT public.admin_has_role(v_actor_id) INTO v_is_admin;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'FORBIDDEN', 'message', 'Admin role required')
    );
  END IF;

  -- Verify tax category exists
  IF NOT EXISTS (SELECT 1 FROM public.tax_categories tc WHERE tc.id = p_tax_category_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Tax category not found')
    );
  END IF;

  -- Capture old value for audit
  SELECT i.tax_category_id INTO v_old_tax_cat_id FROM public.items i WHERE i.id = p_item_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', jsonb_build_object('code', 'NOT_FOUND', 'message', 'Item not found')
    );
  END IF;

  UPDATE public.items i
  SET tax_category_id = p_tax_category_id,
      updated_at = NOW()
  WHERE i.id = p_item_id;

  -- Audit log
  INSERT INTO public.admin_audit_logs (
    actor_id, action_type, entity_type, entity_id, payload, reason
  ) VALUES (
    v_actor_id,
    'item_tax_category_changed',
    'item',
    p_item_id::TEXT,
    jsonb_build_object(
      'old_tax_category_id', v_old_tax_cat_id,
      'new_tax_category_id', p_tax_category_id
    ),
    'Admin changed item tax category'
  );

  RETURN jsonb_build_object('success', true,
    'data', jsonb_build_object(
      'item_id', p_item_id,
      'old_tax_category_id', v_old_tax_cat_id,
      'new_tax_category_id', p_tax_category_id
    ));
END;
$$;

-- 4f) get_applicable_tax_rule — find the effective rule for a category at a given date
CREATE OR REPLACE FUNCTION public.get_applicable_tax_rule(
  p_tax_category_id UUID,
  p_check_date      TIMESTAMPTZ DEFAULT NOW()
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
  ORDER BY tr.version DESC
  LIMIT 1;
END;
$$;

-- 4g) get_include_fee_in_tax_base — read the current toggle value
CREATE OR REPLACE FUNCTION public.get_include_fee_in_tax_base()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT ac.value INTO v_value
  FROM public.admin_config ac
  WHERE ac.key = 'include_fee_in_tax_base' AND ac.is_active = TRUE
  LIMIT 1;

  RETURN COALESCE(v_value = 'true', FALSE);
END;
$$;

-- ============================================================================
-- BLOCK 5 — Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_items_tax_category_id
  ON public.items (tax_category_id)
  WHERE tax_category_id IS NOT NULL;

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
-- -- 1) Verify tax_categories table
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name = 'tax_categories';
--
-- -- 2) Verify tax_rules table
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
-- WHERE table_name = 'tax_rules';
--
-- -- 3) Verify tax_category_id column on items
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'items' AND column_name = 'tax_category_id';
--
-- -- 4) Verify RLS enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('tax_categories', 'tax_rules');
--
-- -- 5) Verify policies
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies WHERE tablename IN ('tax_categories', 'tax_rules');
--
-- -- 6) Verify seeded categories
-- SELECT key, name, is_active FROM public.tax_categories ORDER BY key;
--
-- -- 7) Verify backfill
-- SELECT COUNT(*) AS null_tax_categories FROM public.items WHERE tax_category_id IS NULL;
--
-- -- 8) Verify admin_config key
-- SELECT key, value, is_active FROM public.admin_config WHERE key = 'include_fee_in_tax_base';
--
-- -- 9) Test RPC: list tax rules
-- SELECT * FROM public.list_tax_rules(TRUE, NULL);
--
-- -- 10) Test RPC: get applicable rule for a category
-- SELECT * FROM public.get_applicable_tax_rule(
--   (SELECT id FROM public.tax_categories WHERE key = 'general_tangible_goods' LIMIT 1),
--   NOW()
-- );
--
-- Rollback:
-- DROP TRIGGER IF EXISTS trg_set_default_tax_category ON public.items;
-- DROP FUNCTION IF EXISTS public.fn_set_default_tax_category();
-- DROP TRIGGER IF EXISTS trg_audit_tax_rule_change ON public.tax_rules;
-- DROP FUNCTION IF EXISTS public.fn_audit_tax_rule_change();
-- DROP TRIGGER IF EXISTS trg_check_tax_rule_overlap ON public.tax_rules;
-- DROP FUNCTION IF EXISTS public.fn_check_tax_rule_overlap();
-- DROP FUNCTION IF EXISTS public.upsert_tax_rule(UUID, UUID, TEXT, TEXT, BOOLEAN, DECIMAL, TEXT, INTEGER, INTEGER, TIMESTAMPTZ, TIMESTAMPTZ);
-- DROP FUNCTION IF EXISTS public.deactivate_tax_rule(UUID);
-- DROP FUNCTION IF EXISTS public.update_item_tax_category_admin(UUID, UUID);
-- DROP FUNCTION IF EXISTS public.get_applicable_tax_rule(UUID, TIMESTAMPTZ);
-- DROP FUNCTION IF EXISTS public.list_tax_categories();
-- DROP FUNCTION IF EXISTS public.list_tax_rules(BOOLEAN, UUID);
-- DROP FUNCTION IF EXISTS public.get_include_fee_in_tax_base();
-- ALTER TABLE public.items DROP COLUMN IF EXISTS tax_category_id;
-- DROP TABLE IF EXISTS public.tax_rules;
-- DROP TABLE IF EXISTS public.tax_categories;
-- DELETE FROM public.admin_config WHERE key = 'include_fee_in_tax_base';
