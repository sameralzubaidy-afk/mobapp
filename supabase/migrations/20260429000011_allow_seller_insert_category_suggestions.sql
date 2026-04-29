-- FILE: supabase/migrations/20260429000011_allow_seller_insert_category_suggestions.sql
-- ADMIN-V3-005 HOTFIX: Allow seller-side insert/upsert into category_suggestions from mobile "Other" flow.
-- Mode: Idempotent rerunnable migration

-- 1) Ensure RLS is enabled.
ALTER TABLE public.category_suggestions ENABLE ROW LEVEL SECURITY;

-- 2) Seller insert policy (required for initial suggestion create).
DROP POLICY IF EXISTS "Seller can insert own category suggestions" ON public.category_suggestions;
CREATE POLICY "Seller can insert own category suggestions"
  ON public.category_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    seller_id = auth.uid()
    AND status = 'pending'
  );

-- 3) Seller update policy (required for upsert conflict on item_id).
-- Restrict updates to seller-owned pending suggestions only.
DROP POLICY IF EXISTS "Seller can update own pending category suggestions" ON public.category_suggestions;
CREATE POLICY "Seller can update own pending category suggestions"
  ON public.category_suggestions
  FOR UPDATE
  TO authenticated
  USING (
    seller_id = auth.uid()
    AND status = 'pending'
  )
  WITH CHECK (
    seller_id = auth.uid()
    AND status = 'pending'
  );

-- Verification queries:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'category_suggestions';
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'category_suggestions' ORDER BY policyname;
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.category_suggestions'::regclass;
