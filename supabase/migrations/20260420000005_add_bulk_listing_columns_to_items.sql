-- ================================================================
-- Migration: Add Bulk Listing Columns to Items Table
-- Date: 2026-04-20
-- Task: LISTING-V3-001
-- Description: Adds bulk_upload_id (FK to item_bulk_uploads) and
--              requested_category_name (for "Other" category suggestion flow).
-- Note: age_group, gender, brand, color added in migration
--       20260420000001_add_item_filter_columns.sql (MODULE-05 V3)
-- ================================================================

-- Add bulk upload tracking column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'items'
      AND column_name = 'bulk_upload_id'
  ) THEN
    ALTER TABLE public.items
      ADD COLUMN bulk_upload_id UUID
      REFERENCES public.item_bulk_uploads(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add category suggestion column (for "Other" category flow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'items'
      AND column_name = 'requested_category_name'
  ) THEN
    ALTER TABLE public.items
      ADD COLUMN requested_category_name TEXT
      CHECK (LENGTH(requested_category_name) <= 100);
  END IF;
END $$;

-- Index for bulk upload grouping (partial index)
CREATE INDEX IF NOT EXISTS idx_items_bulk_upload_id
  ON public.items(bulk_upload_id)
  WHERE bulk_upload_id IS NOT NULL;

-- Index for admin review of category suggestions (partial index)
CREATE INDEX IF NOT EXISTS idx_items_requested_category
  ON public.items(requested_category_name)
  WHERE requested_category_name IS NOT NULL;

-- Comments
COMMENT ON COLUMN public.items.bulk_upload_id IS 'Groups items created in same bulk upload session; FK to item_bulk_uploads.id';
COMMENT ON COLUMN public.items.requested_category_name IS 'Seller-suggested category when "Other" selected; triggers admin review queue (MODULE-12)';

-- ================================================================
-- VERIFICATION QUERIES (run after applying migration):
-- ================================================================

-- Verify new columns exist
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'items'
--   AND column_name IN ('bulk_upload_id', 'requested_category_name')
-- ORDER BY column_name;

-- Verify foreign key constraint on bulk_upload_id
-- SELECT conname, contype, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.items'::regclass
--   AND conname LIKE '%bulk_upload%';

-- Verify CHECK constraint on requested_category_name
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.items'::regclass
--   AND contype = 'c'
--   AND pg_get_constraintdef(oid) LIKE '%requested_category_name%';

-- Verify partial indexes exist
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'items'
--   AND indexname IN ('idx_items_bulk_upload_id', 'idx_items_requested_category');

-- Verify MODULE-05 V3 columns still present (should not be re-added)
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'items'
--   AND column_name IN ('age_group', 'gender', 'brand', 'color')
-- ORDER BY column_name;
