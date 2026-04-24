-- ================================================================
-- Migration: Create item_drafts Table
-- Date: 2026-04-20
-- Task: LISTING-V3-001
-- Description: Stores auto-saved item creation drafts.
--              7-day TTL, max 5 per seller, auto-touch updated_at.
-- ================================================================

-- Create table
CREATE TABLE IF NOT EXISTS public.item_drafts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bulk_upload_id  UUID REFERENCES public.item_bulk_uploads(id) ON DELETE CASCADE,
  draft_data      JSONB NOT NULL DEFAULT '{}',
  photo_urls      TEXT[] NOT NULL DEFAULT '{}',
  ai_suggestions  JSONB,
  step            TEXT NOT NULL DEFAULT 'photos'
    CHECK (step IN ('photos', 'grouping', 'details', 'price', 'review')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

-- Enable RLS
ALTER TABLE public.item_drafts ENABLE ROW LEVEL SECURITY;

-- Policy: Seller can manage own drafts
DROP POLICY IF EXISTS "Seller can manage own drafts" ON public.item_drafts;
CREATE POLICY "Seller can manage own drafts"
  ON public.item_drafts
  FOR ALL
  USING (seller_id = auth.uid());

-- Function: Auto-update updated_at on every update
CREATE OR REPLACE FUNCTION public.update_item_drafts_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger: updated_at auto-touch
DROP TRIGGER IF EXISTS update_item_drafts_updated_at ON public.item_drafts;
CREATE TRIGGER update_item_drafts_updated_at
  BEFORE UPDATE ON public.item_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_drafts_updated_at();

-- Function: Enforce max 5 drafts per seller (keeps 5 most-recently-updated)
CREATE OR REPLACE FUNCTION public.enforce_max_drafts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete oldest drafts beyond limit of 5
  -- After INSERT, we keep the 5 most-recently-updated rows for this seller
  DELETE FROM public.item_drafts
  WHERE seller_id = NEW.seller_id
    AND id NOT IN (
      SELECT id FROM public.item_drafts
      WHERE seller_id = NEW.seller_id
      ORDER BY updated_at DESC
      LIMIT 5
    );
  RETURN NEW;
END;
$$;

-- Trigger: enforce max 5 drafts
DROP TRIGGER IF EXISTS enforce_max_drafts ON public.item_drafts;
CREATE TRIGGER enforce_max_drafts
  AFTER INSERT ON public.item_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_max_drafts();

-- Index for seller lookup + recency
CREATE INDEX IF NOT EXISTS idx_item_drafts_seller_id
  ON public.item_drafts(seller_id, updated_at DESC);

-- Index for expiry cleanup (cron job)
CREATE INDEX IF NOT EXISTS idx_item_drafts_expires_at
  ON public.item_drafts(expires_at);

-- Index for bulk upload association
CREATE INDEX IF NOT EXISTS idx_item_drafts_bulk_upload_id
  ON public.item_drafts(bulk_upload_id)
  WHERE bulk_upload_id IS NOT NULL;

-- Comments
COMMENT ON TABLE public.item_drafts IS 'Auto-saved listing creation drafts. Expire after 7 days. Max 5 per seller (trigger-enforced).';
COMMENT ON COLUMN public.item_drafts.draft_data IS 'JSONB payload: { title, description, price, category_id, condition, age_group, gender, brand, color[], photo_urls[], items[] (for bulk) }';
COMMENT ON COLUMN public.item_drafts.photo_urls IS 'Array of photo URLs uploaded but not yet published';
COMMENT ON COLUMN public.item_drafts.ai_suggestions IS 'JSONB: raw AI analysis results for resume/review';
COMMENT ON COLUMN public.item_drafts.step IS 'Current step in creation flow: photos | grouping | details | price | review';
COMMENT ON COLUMN public.item_drafts.expires_at IS '7-day TTL from creation; cron job deletes expired rows';

-- ================================================================
-- VERIFICATION QUERIES (run after applying migration):
-- ================================================================

-- Verify table exists with correct columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'item_drafts'
-- ORDER BY ordinal_position;

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'item_drafts';

-- Verify policies exist
-- SELECT policyname, cmd, permissive, roles
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'item_drafts';

-- Verify triggers exist
-- SELECT tgname, tgtype, tgenabled, pg_get_triggerdef(oid) AS definition
-- FROM pg_trigger
-- WHERE tgrelid = 'public.item_drafts'::regclass
--   AND tgisinternal = false;

-- Verify functions exist
-- SELECT proname, prosrc FROM pg_proc
-- WHERE proname IN ('update_item_drafts_updated_at', 'enforce_max_drafts');

-- Verify CHECK constraint on step
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.item_drafts'::regclass
--   AND contype = 'c';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'item_drafts';
