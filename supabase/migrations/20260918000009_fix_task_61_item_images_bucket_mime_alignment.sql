-- Migration: Align item-images bucket allowed_mime_types with the client MIME contract
-- Purpose: The client photo contract (p2p-kids-marketplace/src/constants/photoRules.ts
--   -> SUPPORTED_PHOTO_MIME_TYPES) accepts JPEG / PNG / WebP / HEIC, but the bucket
--   created by 20260328000100_create_item_images_bucket.sql still allows:
--     ['image/jpeg','image/jpg','image/png','image/webp','image/gif']
--   Two mismatches result:
--     1. `image/gif` is ALLOWED server-side while the client rejects it — so the
--        contract is enforced only in the app, and any non-app writer can store a
--        GIF in a listing bucket (AUTH Android R3 used a GIF to prove the client
--        gate is the only gate).
--     2. `image/heic` / `image/heif` are ACCEPTED client-side but absent from the
--        bucket allow-list. Today the client re-encodes to JPEG before upload so
--        this is masked, but the two contracts disagree and would break the moment
--        an upload path stops re-encoding.
--   This migration makes the server allow-list equal the client contract.
--
--   NOTE: this file deliberately does NOT touch file_size_limit. It was already
--   aligned to 10MB by 20260824000001_update_item_images_bucket_file_size_limit.sql,
--   and re-writing it here would risk clobbering a deliberate operator change. The
--   verification queries below cross-check BOTH halves of the contract.
--
-- Date: 2026-09-18
-- Task: FIX-Task-61 (adjacent validation gap, owner-approved)
-- Mode: B — idempotent rerunnable (a single UPDATE; safe to re-run).
--
-- Safety notes:
--   * `storage.buckets.allowed_mime_types` gates NEW uploads only — objects already
--     in the bucket remain readable and unaffected.
--   * Run the PRE-CHECK below first. If it returns a non-zero count, existing GIF
--     objects are in the bucket and should be inspected before the allow-list tightens
--     (they keep working; this is an inventory step, not a blocker).
--   * The DO block FAILS LOUD when the bucket row is missing, so a silent no-op
--     cannot masquerade as a successful alignment.

-- =============================================================================
-- PRE-CHECK (read-only — inspect before applying, do not fail the migration on it)
-- =============================================================================

-- Are there any GIF objects already stored in the listing bucket?
-- SELECT count(*) AS gif_object_count
-- FROM storage.objects
-- WHERE bucket_id = 'item-images'
--   AND name ILIKE '%.gif';
-- Expected: 0. A non-zero count is NOT a blocker (existing objects stay readable)
-- but should be reported, since the client contract never allowed GIF uploads.

-- =============================================================================
-- STEP 1: ALIGN allowed_mime_types WITH THE CLIENT CONTRACT
-- =============================================================================

DO $$
DECLARE
  v_rows_updated integer;
  v_allowed_mime_types text[] := ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ];
BEGIN
  UPDATE storage.buckets
  SET allowed_mime_types = v_allowed_mime_types
  WHERE id = 'item-images';

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION
      'item-images row not found in storage.buckets — MIME allow-list was NOT aligned';
  END IF;

  RAISE NOTICE 'item-images allowed_mime_types aligned to client contract (% types)', 
    array_length(v_allowed_mime_types, 1);
END $$;

-- =============================================================================
-- VERIFICATION QUERIES (RUN AFTER MIGRATION)
-- =============================================================================

-- 1. Both halves of the photo contract, server-side.
-- SELECT b.id,
--        b.file_size_limit,
--        b.file_size_limit / (1024 * 1024) AS max_size_mb,
--        b.allowed_mime_types
-- FROM storage.buckets b
-- WHERE b.id = 'item-images';
-- Expected: file_size_limit = 10485760 (10MB) and allowed_mime_types =
--           {image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif}

-- 2. The removed type must be gone and the added types present.
-- SELECT 'image/gif'  AS mime_type, ('image/gif'  = ANY(b.allowed_mime_types)) AS allowed
-- FROM storage.buckets b WHERE b.id = 'item-images'
-- UNION ALL
-- SELECT 'image/heic', ('image/heic' = ANY(b.allowed_mime_types))
-- FROM storage.buckets b WHERE b.id = 'item-images'
-- UNION ALL
-- SELECT 'image/heif', ('image/heif' = ANY(b.allowed_mime_types))
-- FROM storage.buckets b WHERE b.id = 'item-images';
-- Expected: image/gif -> f (false), image/heic -> t, image/heif -> t

-- 3. Bucket still exists exactly once (guards against an accidental duplicate row).
-- SELECT count(*) AS bucket_rows FROM storage.buckets WHERE id = 'item-images';
-- Expected: 1

-- =============================================================================
-- ROLLBACK
-- =============================================================================
-- Restores the previous allow-list verbatim (GIF re-permitted, HEIC/HEIF removed):
--
-- UPDATE storage.buckets
-- SET allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
-- WHERE id = 'item-images';
--
-- Verify the rollback succeeded with verification query 1 above: allowed_mime_types
-- must again read {image/jpeg,image/jpg,image/png,image/webp,image/gif}.
