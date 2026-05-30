-- TFV2-022: Cart tables for bundle/multi-item checkout
-- D-27: bundle_id groups items in a single checkout session
-- D-28: single-seller constraint enforced app-side (cartService)
-- D-29: max 4 items per cart enforced app-side (cartService)

CREATE TABLE IF NOT EXISTS public.cart_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id  UUID        NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  seller_id   UUID        NOT NULL,
  bundle_id   UUID        NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id   ON public.cart_items (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_bundle_id  ON public.cart_items (bundle_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_seller_id  ON public.cart_items (seller_id);

-- RLS
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "cart_select_own" ON public.cart_items;
CREATE POLICY "cart_select_own" ON public.cart_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cart_insert_own" ON public.cart_items;
CREATE POLICY "cart_insert_own" ON public.cart_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cart_delete_own" ON public.cart_items;
CREATE POLICY "cart_delete_own" ON public.cart_items
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "cart_service_role" ON public.cart_items;
CREATE POLICY "cart_service_role" ON public.cart_items
  FOR ALL TO service_role
  USING (true);
