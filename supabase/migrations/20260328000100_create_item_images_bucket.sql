-- Migration: Create item-images storage bucket with RLS policies
-- Purpose: Allow authenticated users to upload/manage listing photos (SAFETY-P001)
-- Date: 2026-03-28
-- Module: MODULE-13-SAFETY-COMPLIANCE
-- Task: SAFETY-P001

-- =============================================================================
-- STEP 1: CREATE STORAGE BUCKET
-- =============================================================================

-- Create the storage bucket for item listing images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-images',
  'item-images',
  true,  -- Public bucket so listing images can be accessed via public URLs
  5242880,  -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 2: DROP EXISTING POLICIES (IDEMPOTENT)
-- =============================================================================

DROP POLICY IF EXISTS "Sellers can upload images for own listings" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can update images for own listings" ON storage.objects;
DROP POLICY IF EXISTS "Sellers can delete images for own listings" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view item listing images" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to item images" ON storage.objects;

-- =============================================================================
-- STEP 3: CREATE RLS POLICIES
-- =============================================================================

-- RLS Policy: Allow authenticated sellers to upload images for their own listings
-- Path format: item-images/{item_id}/{filename}
-- Verification: Must own the item (seller_id = auth.uid())
CREATE POLICY "Sellers can upload images for own listings"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images'
  AND (
    -- Verify the user owns the item referenced in the path
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id::TEXT = (string_to_array(name, '/'))[1]
        AND items.seller_id = auth.uid()
    )
  )
);

-- RLS Policy: Allow authenticated sellers to update images for their own listings
CREATE POLICY "Sellers can update images for own listings"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id::TEXT = (string_to_array(name, '/'))[1]
        AND items.seller_id = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'item-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id::TEXT = (string_to_array(name, '/'))[1]
        AND items.seller_id = auth.uid()
    )
  )
);

-- RLS Policy: Allow authenticated sellers to delete images for their own listings
CREATE POLICY "Sellers can delete images for own listings"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (
    EXISTS (
      SELECT 1 FROM public.items
      WHERE items.id::TEXT = (string_to_array(name, '/'))[1]
        AND items.seller_id = auth.uid()
    )
  )
);

-- RLS Policy: Allow public read access to all listing images (listings are public)
CREATE POLICY "Anyone can view item listing images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'item-images');

-- RLS Policy: Allow service_role full access for moderation/admin operations
CREATE POLICY "Service role full access to item images"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'item-images')
WITH CHECK (bucket_id = 'item-images');

-- =============================================================================
-- VERIFICATION QUERIES (RUN AFTER MIGRATION)
-- =============================================================================

-- Verify bucket creation
-- SELECT id, name, public, file_size_limit, allowed_mime_types 
-- FROM storage.buckets 
-- WHERE id = 'item-images';

-- Verify RLS policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE tablename = 'objects' 
--   AND policyname LIKE '%item%image%'
-- ORDER BY policyname;

-- Test upload permission (replace {user_id} and {item_id} with real values)
-- SET request.jwt.claims TO '{"sub": "{user_id}"}';
-- SELECT bucket_id, name
-- FROM storage.objects
-- WHERE bucket_id = 'item-images'
--   AND name LIKE '{item_id}/%';
