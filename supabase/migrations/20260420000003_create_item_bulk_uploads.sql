-- ================================================================
-- Migration: Create item_bulk_uploads Table
-- Date: 2026-04-20
-- Task: LISTING-V3-001
-- Description: Tracks bulk upload sessions for grouping related items.
--              Max 30 photos, 15 items per session.
-- ================================================================

-- Create table
CREATE TABLE IF NOT EXISTS public.item_bulk_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'partial', 'failed')),
  total_photos    INT NOT NULL DEFAULT 0,
  total_items     INT NOT NULL DEFAULT 0,
  published_items INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,

  CONSTRAINT bulk_uploads_items_check CHECK (total_items <= 15),
  CONSTRAINT bulk_uploads_photos_check CHECK (total_photos <= 30)
);

-- Enable RLS
ALTER TABLE public.item_bulk_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Seller can manage own bulk uploads
DROP POLICY IF EXISTS "Seller can manage own bulk uploads" ON public.item_bulk_uploads;
CREATE POLICY "Seller can manage own bulk uploads"
  ON public.item_bulk_uploads
  FOR ALL
  USING (seller_id = auth.uid());

-- Policy: Admin can view all bulk uploads
-- Note: This policy is commented out because public.user_roles does not exist yet.
-- It can be added later when the admin roles system is implemented.
DROP POLICY IF EXISTS "Admin can view all bulk uploads" ON public.item_bulk_uploads;
/*
CREATE POLICY "Admin can view all bulk uploads"
  ON public.item_bulk_uploads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
*/

-- Index for seller lookup
CREATE INDEX IF NOT EXISTS idx_item_bulk_uploads_seller_id
  ON public.item_bulk_uploads(seller_id, created_at DESC);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_item_bulk_uploads_status
  ON public.item_bulk_uploads(status)
  WHERE status IN ('pending', 'processing');

-- Comment
COMMENT ON TABLE public.item_bulk_uploads IS 'Tracks bulk upload sessions for grouping related items. Max 30 photos, 15 items per session.';
COMMENT ON COLUMN public.item_bulk_uploads.status IS 'Session status: pending → processing → completed/partial/failed';
COMMENT ON COLUMN public.item_bulk_uploads.total_photos IS 'Total photos uploaded in session (max 30)';
COMMENT ON COLUMN public.item_bulk_uploads.total_items IS 'Total items created from photos (max 15)';
COMMENT ON COLUMN public.item_bulk_uploads.published_items IS 'Count of successfully published items';

-- ================================================================
-- VERIFICATION QUERIES (run after applying migration):
-- ================================================================

-- Verify table exists with correct columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'item_bulk_uploads'
-- ORDER BY ordinal_position;

-- Verify RLS is enabled
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'item_bulk_uploads';

-- Verify policies exist
-- SELECT policyname, cmd, permissive, roles, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'item_bulk_uploads';

-- Verify CHECK constraints
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.item_bulk_uploads'::regclass
--   AND contype = 'c';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'item_bulk_uploads';
