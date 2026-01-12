-- filepath: supabase/migrations/20260111000001_badge_icons_storage.sql
-- TASK: BADGES-V2-006 - Badge Icon Management & Supabase Storage

-- =============================================================================
-- 1. Create badge-icons storage bucket (if not exists)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'badge-icons', 
  'badge-icons', 
  true,  -- Public bucket for badge icons
  5242880,  -- 5MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. Set up RLS policies for badge-icons bucket
-- =============================================================================

-- Drop existing policies first (Postgres doesn't support IF NOT EXISTS for policies)
DROP POLICY IF EXISTS "Public read access for badge icons" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can upload badge icons" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can update badge icons" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can delete badge icons" ON storage.objects;

-- Allow public read access for badge icons
CREATE POLICY "Public read access for badge icons"
ON storage.objects FOR SELECT
USING (bucket_id = 'badge-icons');

-- Allow authenticated users with admin role to upload
CREATE POLICY "Admin users can upload badge icons"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'badge-icons'
  AND auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'is_admin' = 'true'
  )
);

-- Allow authenticated users with admin role to update
CREATE POLICY "Admin users can update badge icons"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'badge-icons'
  AND auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'is_admin' = 'true'
  )
)
WITH CHECK (
  bucket_id = 'badge-icons'
  AND auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'is_admin' = 'true'
  )
);

-- Allow authenticated users with admin role to delete
CREATE POLICY "Admin users can delete badge icons"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'badge-icons'
  AND auth.uid() IN (
    SELECT id FROM auth.users
    WHERE raw_user_meta_data->>'is_admin' = 'true'
  )
);

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================

-- Check that bucket was created
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'badge-icons';

-- Check RLS policies on storage.objects for badge-icons bucket
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%badge icon%';
