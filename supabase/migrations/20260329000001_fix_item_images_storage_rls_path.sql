-- Migration: Fix item-images storage RLS path parsing for SAFETY-P002 uploads
-- Mode: B (idempotent rerunnable migration)
-- Purpose:
--   Align storage.objects RLS policies with upload path item-images/{seller_id}/{item_id}/{index}.jpg
--   while preserving backward compatibility with legacy path item-images/{item_id}/{filename}

-- BLOCK 1 — Schema / Security Preconditions
-- (No table schema changes needed in this migration)

-- Verification: bucket exists
-- SELECT id, name, public FROM storage.buckets WHERE id = 'item-images';

-- BLOCK 2 — Security + Performance

DROP POLICY IF EXISTS "Sellers can upload images for own listings" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update images for own listings" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can delete images for own listings" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view item listing images" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to item images" ON storage.objects;

-- INSERT policy supports both:
-- 1) preferred: {seller_id}/{item_id}/{filename}
-- 2) legacy:    {item_id}/{filename}
CREATE POLICY "Sellers can upload images for own listings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images'
  AND (
    (
      array_length(string_to_array(name, '/'), 1) >= 3
      AND (string_to_array(name, '/'))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[2]
          AND i.seller_id = auth.uid()
      )
    )
    OR
    (
      array_length(string_to_array(name, '/'), 1) >= 2
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[1]
          AND i.seller_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Sellers can update images for own listings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (
    (
      array_length(string_to_array(name, '/'), 1) >= 3
      AND (string_to_array(name, '/'))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[2]
          AND i.seller_id = auth.uid()
      )
    )
    OR
    (
      array_length(string_to_array(name, '/'), 1) >= 2
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[1]
          AND i.seller_id = auth.uid()
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'item-images'
  AND (
    (
      array_length(string_to_array(name, '/'), 1) >= 3
      AND (string_to_array(name, '/'))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[2]
          AND i.seller_id = auth.uid()
      )
    )
    OR
    (
      array_length(string_to_array(name, '/'), 1) >= 2
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[1]
          AND i.seller_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Sellers can delete images for own listings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (
    (
      array_length(string_to_array(name, '/'), 1) >= 3
      AND (string_to_array(name, '/'))[1] = auth.uid()::text
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[2]
          AND i.seller_id = auth.uid()
      )
    )
    OR
    (
      array_length(string_to_array(name, '/'), 1) >= 2
      AND EXISTS (
        SELECT 1
        FROM public.items i
        WHERE i.id::text = (string_to_array(name, '/'))[1]
          AND i.seller_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Anyone can view item listing images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'item-images');

CREATE POLICY "Service role full access to item images"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'item-images')
WITH CHECK (bucket_id = 'item-images');

-- Verification Queries
-- 1) RLS exists
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects';
--
-- 2) Policies present
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%item%image%'
-- ORDER BY policyname;
--
-- 3) Constraint/policy debug helper
-- SELECT policyname, qual, with_check FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Sellers can upload images for own listings';

-- Common failure modes
-- - RLS policy still checks wrong path segment for item_id
-- - uploads use preferred path but DB still has legacy policy only
-- - auth.uid() missing due missing Authorization bearer JWT in client session
