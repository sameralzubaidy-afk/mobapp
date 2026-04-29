-- FILE: supabase/migrations/20260420000010_create_category_icons_storage_bucket.sql
-- ADMIN-V3-001: Create category-icons storage bucket + RLS
-- Module: MODULE-12-ADMIN-V3-CATEGORIES
-- Dependencies: storage.buckets, admin_has_role(UUID)

-- ===========================================================================
-- STEP 1: Create Storage Bucket
-- ===========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('category-icons', 'category-icons', true)
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- STEP 2: Enable RLS on Storage Objects
-- ===========================================================================

-- Storage RLS is enabled by default on objects table
-- This is just a safety check

DO $$
BEGIN
  -- RLS on storage.objects is managed by Supabase
  -- We only need to create policies
  NULL;
END
$$;

-- ===========================================================================
-- STEP 3: Create Storage RLS Policies
-- ===========================================================================

-- Policy: Anyone can view (SELECT) category icons (public read)
DROP POLICY IF EXISTS "Public can view category icons" 
  ON storage.objects;

CREATE POLICY "Public can view category icons"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'category-icons');

-- Policy: Admins can insert category icons
DROP POLICY IF EXISTS "Admins can insert category icons" 
  ON storage.objects;

CREATE POLICY "Admins can insert category icons"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'category-icons'
    AND public.admin_has_role(auth.uid())
  );

-- Policy: Admins can update category icons
DROP POLICY IF EXISTS "Admins can update category icons" 
  ON storage.objects;

CREATE POLICY "Admins can update category icons"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'category-icons'
    AND public.admin_has_role(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'category-icons'
    AND public.admin_has_role(auth.uid())
  );

-- Policy: Admins can delete category icons
DROP POLICY IF EXISTS "Admins can delete category icons" 
  ON storage.objects;

CREATE POLICY "Admins can delete category icons"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'category-icons'
    AND public.admin_has_role(auth.uid())
  );

-- ===========================================================================
-- STEP 4: Set Bucket Configuration (via Supabase Dashboard or API)
-- ===========================================================================

-- NOTE: File size limits and allowed MIME types are configured via Supabase Dashboard
-- Recommended settings (to be set manually or via Supabase Management API):
-- - Max file size: 500 KB
-- - Allowed MIME types: image/png, image/svg+xml
-- - File path pattern: {category_id}/{iconType}.{ext}
--   where iconType ∈ {'category', 'bonus_badge'}

DO $$
BEGIN
  COMMENT ON TABLE storage.buckets IS
    'Supabase Storage buckets for file uploads. category-icons bucket stores category and bonus badge icons.';
EXCEPTION
  WHEN insufficient_privilege THEN
    -- In some hosted environments, migration role is not owner of storage.buckets.
    RAISE NOTICE 'Skipping COMMENT ON storage.buckets: insufficient privilege';
END
$$;

-- ===========================================================================
-- VERIFICATION QUERIES (Commented)
-- ===========================================================================

/*
-- Verify bucket exists and is public
SELECT id, name, public, created_at
FROM storage.buckets
WHERE id = 'category-icons';

-- Verify storage RLS policies
SELECT 
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%category icons%'
ORDER BY policyname;

-- Test public read access (should work for anyone)
/*
-- This query tests if public can SELECT from storage.objects
SELECT name, bucket_id, created_at
FROM storage.objects
WHERE bucket_id = 'category-icons'
LIMIT 5;
*/

-- Test admin insert/update/delete access
/*
-- As admin user, try uploading a file via Supabase client:

const { data, error } = await supabase.storage
  .from('category-icons')
  .upload('test-category-id/category.png', fileBlob, {
    cacheControl: '3600',
    upsert: false
  });

-- Verify it appears in storage.objects
SELECT name, bucket_id, owner
FROM storage.objects
WHERE bucket_id = 'category-icons'
  AND name LIKE 'test-category-id%';

-- Clean up test
DELETE FROM storage.objects
WHERE bucket_id = 'category-icons'
  AND name = 'test-category-id/category.png';
*/

-- Test non-admin upload (should fail)
/*
-- As non-admin user, try uploading:
-- Expected: RLS policy violation
*/
*/
