-- Migration: Update item-images bucket file_size_limit to 10MB
-- Purpose: Align the server-side Storage bucket cap with the client-side photo
--   validation cap (photoService.MAX_FILE_SIZE_MB = 10). ItemCreate / Bulk
--   Listing / EditListing (ImagePickerGrid) all enforce 10MB client-side; the
--   bucket previously capped uploads at 5MB (5242880), so a 6-10MB photo that
--   passed client validation would be rejected at upload. This closes that gap.
-- Date: 2026-08-24
-- Mode: B — idempotent rerunnable (safe to re-run; UPDATE is naturally idempotent).

-- =============================================================================
-- STEP 1: UPDATE BUCKET FILE SIZE LIMIT
-- =============================================================================

UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10MB (matches photoService.MAX_FILE_SIZE_MB)
WHERE id = 'item-images';

-- =============================================================================
-- VERIFICATION QUERIES (RUN AFTER MIGRATION)
-- =============================================================================

-- Verify bucket now enforces 10MB
-- SELECT id, name, public, file_size_limit, allowed_mime_types
-- FROM storage.buckets
-- WHERE id = 'item-images';
-- Expected: file_size_limit = 10485760 (10MB)

-- Cross-check the client-side cap still matches
-- SELECT 10 AS client_max_file_size_mb,
--        (SELECT file_size_limit / (1024 * 1024)
--         FROM storage.buckets WHERE id = 'item-images') AS bucket_max_file_size_mb;
-- Expected: both = 10
