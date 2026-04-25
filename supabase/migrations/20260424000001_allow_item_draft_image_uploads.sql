-- Migration: Allow draft-stage item image uploads in item-images bucket
-- Mode: B (idempotent rerunnable migration)
-- Purpose:
--   Enable mobile draft flow uploads before an item row exists.
--   Draft uploads use path: drafts/{seller_id}/{timestamp}/{filename}

-- BLOCK 1 — Schema / Security Preconditions
-- (No table schema changes required)

-- Verification: Ensure item-images bucket exists
-- SELECT id, name, public
-- FROM storage.buckets
-- WHERE id = 'item-images';

-- BLOCK 2 — Security + Performance

DROP POLICY IF EXISTS "Sellers can upload draft staging images" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update draft staging images" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can delete draft staging images" ON storage.objects;

CREATE POLICY "Sellers can upload draft staging images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images'
  AND array_length(string_to_array(name, '/'), 1) >= 4
  AND (string_to_array(name, '/'))[1] = 'drafts'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);

CREATE POLICY "Sellers can update draft staging images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND array_length(string_to_array(name, '/'), 1) >= 4
  AND (string_to_array(name, '/'))[1] = 'drafts'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'item-images'
  AND array_length(string_to_array(name, '/'), 1) >= 4
  AND (string_to_array(name, '/'))[1] = 'drafts'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);

CREATE POLICY "Sellers can delete draft staging images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND array_length(string_to_array(name, '/'), 1) >= 4
  AND (string_to_array(name, '/'))[1] = 'drafts'
  AND (string_to_array(name, '/'))[2] = auth.uid()::text
);

-- Verification Queries
-- 1) Confirm policies are present
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'storage'
--   AND tablename = 'objects'
--   AND policyname ILIKE '%draft staging images%'
-- ORDER BY policyname;

-- 2) Inspect policy expressions
-- SELECT policyname, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'storage'
--   AND tablename = 'objects'
--   AND policyname IN (
--     'Sellers can upload draft staging images',
--     'Sellers can update draft staging images',
--     'Sellers can delete draft staging images'
--   );

-- Common failure modes
-- - Upload path does not start with drafts/{auth.uid()}/...
-- - Client session missing Authorization bearer token (auth.uid() is null)
-- - item-images bucket missing in target environment
