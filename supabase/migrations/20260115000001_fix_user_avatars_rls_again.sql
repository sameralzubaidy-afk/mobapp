-- Fix RLS policies for user-avatars bucket (restore correct, path-based checks)
--
-- Problem:
-- A later migration introduced a policy that extracted the user_id incorrectly from `storage.objects.name`,
-- which can block legitimate uploads to paths like: avatars/<USER_ID>-<TIMESTAMP>.jpg
--
-- Expected upload path format (mobile app): avatars/USER_ID-TIMESTAMP.jpg
--
-- This migration is idempotent and safe to re-run.

-- BLOCK 1 — Schema
-- (no schema changes)

-- Verification (pre): confirm bucket exists
-- SELECT id, name, public FROM storage.buckets WHERE id = 'user-avatars';


-- BLOCK 2 — Security + Performance

-- Drop then recreate policies (Postgres does not support CREATE POLICY IF NOT EXISTS)
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- Allow authenticated users to upload only their own avatar objects
CREATE POLICY "Users can upload their own avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND name LIKE 'avatars/' || auth.uid()::text || '-%'
  );

-- Allow authenticated users to update only their own avatar objects
CREATE POLICY "Users can update their own avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND name LIKE 'avatars/' || auth.uid()::text || '-%'
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND name LIKE 'avatars/' || auth.uid()::text || '-%'
  );

-- Allow authenticated users to delete only their own avatar objects
CREATE POLICY "Users can delete their own avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND name LIKE 'avatars/' || auth.uid()::text || '-%'
  );

-- Allow public read access to all avatars (matches current app behavior: public URLs)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'user-avatars');

-- Verification (post): list the policies we expect
-- SELECT policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
--   AND policyname IN (
--     'Users can upload their own avatars',
--     'Users can update their own avatars',
--     'Users can delete their own avatars',
--     'Anyone can view avatars'
--   )
-- ORDER BY policyname;
