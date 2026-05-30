-- ============================================================================
-- MODULE-15.2 CART SYSTEM — PR 1 / Schema
-- Tasks: CART-001 (cart_items extensions), CART-002 (favorites), CART-017 (admin_config)
--
-- Strategy (Decision 1 = Additive, approved by user):
--   - Existing cart_items table (TFV2-022) has: id, user_id, listing_id, seller_id,
--     bundle_id, added_at, UNIQUE(user_id, listing_id).
--   - We ADD columns required by MODULE-15.2: cart_id, cart_status, snapshot fields,
--     updated_at. We keep bundle_id for trade-flow backward compatibility.
--   - We replace UNIQUE(user_id, listing_id) with a partial unique that allows the
--     same item to exist in active + saved carts (spec rule R-07 only forbids
--     duplicates within the SAME cart_status).
--
-- Schema reality (verified):
--   items.seller_id (not user_id), items.price DECIMAL (not price_cents),
--   items.accepts_swap_points BOOLEAN, items.status uses 'available',
--   profiles.node_id TEXT, profiles.name, admin_config.config_value JSONB.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- CART-001: Extend cart_items table (additive, backward compatible)
-- ---------------------------------------------------------------------------

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS cart_id uuid,
  ADD COLUMN IF NOT EXISTS cart_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS item_title text,
  ADD COLUMN IF NOT EXISTS item_price_cents integer,
  ADD COLUMN IF NOT EXISTS item_image_url text,
  ADD COLUMN IF NOT EXISTS item_payment_preference text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

-- Backfill cart_id from bundle_id for existing rows (TFV2-022 compatibility)
UPDATE public.cart_items
SET cart_id = bundle_id
WHERE cart_id IS NULL;

-- Now make cart_id NOT NULL
ALTER TABLE public.cart_items
  ALTER COLUMN cart_id SET NOT NULL,
  ALTER COLUMN cart_id SET DEFAULT gen_random_uuid();

-- CHECK constraint on cart_status (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cart_items_cart_status_check' AND conrelid = 'public.cart_items'::regclass
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_cart_status_check
      CHECK (cart_status IN ('active', 'saved', 'deleted'));
  END IF;
END$$;

-- Replace UNIQUE(user_id, listing_id) with partial uniques per cart_status.
-- This allows the same item to coexist in active AND saved carts (spec R-07).
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_listing_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_listing_active
  ON public.cart_items (user_id, listing_id) WHERE cart_status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_user_listing_saved
  ON public.cart_items (user_id, listing_id, cart_id) WHERE cart_status = 'saved';

-- Indexes required by spec
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id   ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_listing_id ON public.cart_items (listing_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_status     ON public.cart_items (cart_status);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_cart  ON public.cart_items (user_id, cart_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_cart_items_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_cart_items_set_updated_at ON public.cart_items;
CREATE TRIGGER tr_cart_items_set_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_cart_items_set_updated_at();

-- Additional RLS: UPDATE policy (existing migration only created SELECT/INSERT/DELETE)
DROP POLICY IF EXISTS "cart_update_own" ON public.cart_items;
CREATE POLICY "cart_update_own" ON public.cart_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- CART-001: Enforce cart limits trigger (R-02, R-03)
-- Returns error to caller; does NOT silently evict.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_enforce_cart_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_active_cart_count integer;
  v_saved_cart_count integer;
BEGIN
  -- Enforce max 1 active cart (per distinct cart_id) per user on INSERT to 'active'.
  IF (TG_OP = 'INSERT' AND NEW.cart_status = 'active') THEN
    SELECT COUNT(DISTINCT cart_id) INTO v_active_cart_count
    FROM public.cart_items
    WHERE user_id = NEW.user_id
      AND cart_status = 'active'
      AND cart_id <> NEW.cart_id;
    IF v_active_cart_count >= 1 THEN
      RAISE EXCEPTION 'CART_ACTIVE_LIMIT: user already has an active cart'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- Enforce max 3 saved carts per user on transition to 'saved'.
  IF (TG_OP = 'UPDATE' AND NEW.cart_status = 'saved' AND OLD.cart_status <> 'saved') THEN
    SELECT COUNT(DISTINCT cart_id) INTO v_saved_cart_count
    FROM public.cart_items
    WHERE user_id = NEW.user_id
      AND cart_status = 'saved'
      AND cart_id <> NEW.cart_id;
    IF v_saved_cart_count >= 3 THEN
      RAISE EXCEPTION 'SAVED_CART_LIMIT_REACHED: user already has 3 saved carts'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_enforce_cart_limits ON public.cart_items;
CREATE TRIGGER tr_enforce_cart_limits
  BEFORE INSERT OR UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_enforce_cart_limits();

-- ---------------------------------------------------------------------------
-- CART-002: favorites table (ALREADY EXISTS — extend additively)
-- Existing schema: id, user_id, item_id, created_at (RLS on; policies present).
-- We only need to add deleted_at for soft-delete support.
-- ---------------------------------------------------------------------------

ALTER TABLE public.favorites
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Ensure uniqueness (existing table likely already has a UNIQUE; idempotent attempt)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.favorites'::regclass
      AND contype = 'u'
      AND conkey @> (SELECT array_agg(attnum)
                       FROM pg_attribute
                       WHERE attrelid = 'public.favorites'::regclass
                         AND attname IN ('user_id','item_id'))
  ) THEN
    BEGIN
      ALTER TABLE public.favorites
        ADD CONSTRAINT favorites_user_item_unique UNIQUE (user_id, item_id);
    EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN duplicate_object THEN NULL;
    END;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_favorites_user_id    ON public.favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_item_id    ON public.favorites (item_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON public.favorites (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_active
  ON public.favorites (user_id, item_id) WHERE deleted_at IS NULL;

-- RLS is already enabled with policies favorites_manage_own (ALL) and
-- favorites_select_own (SELECT). Do NOT recreate; just ensure service_role bypass.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'favorites'
      AND policyname = 'favorites_service_role'
  ) THEN
    CREATE POLICY "favorites_service_role" ON public.favorites
      FOR ALL TO service_role USING (true);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- CART-017: Admin config — cart_settings
-- Uses existing admin_config table (config_value JSONB).
-- ---------------------------------------------------------------------------

INSERT INTO public.admin_config (config_key, config_value, description, enabled)
VALUES (
  'cart_settings',
  jsonb_build_object(
    'min_cart_value_cents', 2000,
    'max_saved_carts', 3,
    'saved_cart_expiry_days', 7
  ),
  'MODULE-15.2 Cart system settings: minimum cart value, saved-cart limits, expiry',
  true
)
ON CONFLICT (config_key) DO NOTHING;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
