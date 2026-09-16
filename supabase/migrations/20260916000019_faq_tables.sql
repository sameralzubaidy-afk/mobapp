-- ============================================================
-- Migration 310: FAQ Tables
-- Mode: idempotent (safe to re-run)
-- Tables: faq_categories, faq_items
-- ============================================================

-- BLOCK 1: Schema

-- 1. faq_categories
CREATE TABLE IF NOT EXISTS public.faq_categories (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT faq_categories_name_unique UNIQUE (name)
);

-- 2. faq_items
CREATE TABLE IF NOT EXISTS public.faq_items (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question    text NOT NULL CHECK (length(question) >= 5 AND length(question) <= 500),
  answer      text NOT NULL CHECK (length(answer)   >= 10 AND length(answer)   <= 3000),
  category_id uuid NOT NULL REFERENCES public.faq_categories(id) ON DELETE RESTRICT,
  sort_order  integer NOT NULL DEFAULT 0,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.faq_items_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS faq_items_updated_at ON public.faq_items;
CREATE TRIGGER faq_items_updated_at
  BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.faq_items_set_updated_at();

-- 4. Indexes
CREATE INDEX IF NOT EXISTS faq_items_category_id_idx    ON public.faq_items(category_id);
CREATE INDEX IF NOT EXISTS faq_items_status_idx          ON public.faq_items(status);
CREATE INDEX IF NOT EXISTS faq_items_sort_order_idx      ON public.faq_items(sort_order);
CREATE INDEX IF NOT EXISTS faq_categories_sort_order_idx ON public.faq_categories(sort_order);

-- 5. Enable RLS
ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BLOCK 2: Policies (drop-then-create for idempotency)
-- ============================================================

DROP POLICY IF EXISTS "faq_categories_read_all"       ON public.faq_categories;
DROP POLICY IF EXISTS "faq_categories_auth_write"     ON public.faq_categories;
DROP POLICY IF EXISTS "faq_items_anon_read_published" ON public.faq_items;
DROP POLICY IF EXISTS "faq_items_auth_read_all"       ON public.faq_items;
DROP POLICY IF EXISTS "faq_items_auth_write"          ON public.faq_items;

-- All roles can read categories (for filter chips in mobile)
CREATE POLICY "faq_categories_read_all" ON public.faq_categories
  FOR SELECT USING (true);

-- Authenticated users (admin portal) can manage categories
CREATE POLICY "faq_categories_auth_write" ON public.faq_categories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon users see only published items (mobile pre-login)
CREATE POLICY "faq_items_anon_read_published" ON public.faq_items
  FOR SELECT TO anon
  USING (status = 'published');

-- Authenticated users read all items (admin sees drafts)
CREATE POLICY "faq_items_auth_read_all" ON public.faq_items
  FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can write (admin CRUD)
CREATE POLICY "faq_items_auth_write" ON public.faq_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- BLOCK 3: Seed data (idempotent)
-- ============================================================

INSERT INTO public.faq_categories (name, sort_order) VALUES
  ('Getting Started', 1),
  ('Swap Points',     2),
  ('Trading',         3),
  ('Account',         4),
  ('Safety',          5)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;

DO $$
DECLARE
  v_gs_id uuid;
  v_sp_id uuid;
  v_tr_id uuid;
  v_ac_id uuid;
  v_sa_id uuid;
BEGIN
  IF (SELECT COUNT(*) FROM public.faq_items) > 0 THEN
    RETURN;
  END IF;

  SELECT i.id INTO v_gs_id FROM public.faq_categories i WHERE i.name = 'Getting Started';
  SELECT i.id INTO v_sp_id FROM public.faq_categories i WHERE i.name = 'Swap Points';
  SELECT i.id INTO v_tr_id FROM public.faq_categories i WHERE i.name = 'Trading';
  SELECT i.id INTO v_ac_id FROM public.faq_categories i WHERE i.name = 'Account';
  SELECT i.id INTO v_sa_id FROM public.faq_categories i WHERE i.name = 'Safety';

  INSERT INTO public.faq_items (question, answer, category_id, sort_order, status) VALUES
    ('How do I create my first listing?',
     'Tap the "Sell" button at the bottom of the screen, take photos of your item, and fill in the details.',
     v_gs_id, 1, 'published'),
    ('What is the Kids P2P Marketplace?',
     'A safe platform for kids and parents to buy, sell, and trade items locally.',
     v_gs_id, 2, 'published'),
    ('How do I earn Swap Points?',
     'You earn Swap Points when you sell items as a Kids Club+ subscriber. The amount depends on the item price and category multiplier.',
     v_sp_id, 3, 'published'),
    ('Can I use Swap Points for any purchase?',
     'Yes, but you can only use up to 50% of the item price in Swap Points. The platform fee must always be paid in cash.',
     v_sp_id, 4, 'published'),
    ('How do I complete a trade?',
     'Both buyer and seller must mark the trade as complete. The buyer confirms receipt, and the seller confirms delivery.',
     v_tr_id, 5, 'published'),
    ('What if I have an issue with a trade?',
     'You can open a dispute within 7 days of the trade. Our support team will help resolve the issue.',
     v_tr_id, 6, 'published'),
    ('How do I verify my account?',
     'Go to Settings > Profile > Verify Identity and upload a government-issued ID photo.',
     v_ac_id, 7, 'published'),
    ('Can I change my email address?',
     'Yes, go to Settings > Profile > Edit Profile to update your email. You''ll need to verify the new email.',
     v_ac_id, 8, 'published'),
    ('How do I report an unsafe listing?',
     'Tap the three dots on any listing and select "Report". Choose the reason and provide details.',
     v_sa_id, 9, 'published'),
    ('Are my personal details kept private?',
     'Yes, we never share your email, phone, or address with other users. Communication happens through our in-app chat.',
     v_sa_id, 10, 'published');
END;
$$;

-- ============================================================
-- Verification queries (run these after applying)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name IN ('faq_categories','faq_items') ORDER BY table_name, ordinal_position;
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('faq_categories','faq_items');
-- SELECT policyname, cmd FROM pg_policies WHERE tablename IN ('faq_categories','faq_items');
-- SELECT COUNT(*) FROM faq_categories; -- expect 5
-- SELECT COUNT(*) FROM faq_items;      -- expect 10
-- ============================================================
