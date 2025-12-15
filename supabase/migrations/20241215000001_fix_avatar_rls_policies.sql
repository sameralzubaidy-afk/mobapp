-- Fix RLS policies for user-avatars bucket
-- The upload path format is: avatars/USER_ID-TIMESTAMP.ext
-- We need to extract USER_ID from the path and compare with auth.uid()

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;

-- RLS Policy: Allow authenticated users to upload their own avatars
-- Path format: avatars/USER_ID-TIMESTAMP.ext
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars' 
  AND name LIKE 'avatars/' || auth.uid()::text || '-%'
);

-- RLS Policy: Allow authenticated users to update their own avatars
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

-- RLS Policy: Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars' 
  AND name LIKE 'avatars/' || auth.uid()::text || '-%'
);

-- RLS Policy: Allow public read access to all avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-avatars');
