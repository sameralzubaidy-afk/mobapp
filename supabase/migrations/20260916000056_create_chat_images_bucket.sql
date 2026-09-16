-- ================================================================
-- Migration: 082_create_chat_images_bucket.sql
-- Module: MODULE-07 MSG-003 - Image Sharing in Chat
-- Description: Create chat-images storage bucket with RLS policies for image sharing
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Storage Bucket Creation
-- ================================================================

-- Create the storage bucket for chat images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  true,  -- Public bucket so chat images can be accessed via public URLs
  10485760,  -- 10MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- BLOCK 2: RLS Policies
-- ================================================================

-- Drop existing policies (for idempotency)
DROP POLICY IF EXISTS "Users can upload images to their trade chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can view images from their trade chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat images" ON storage.objects;

-- RLS Policy: Allow authenticated users to upload images to trades they participate in
-- File naming convention: chat-images/{trade_id}/{sender_id}-{timestamp}-{uuid}.jpg
CREATE POLICY "Users can upload images to their trade chats"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (string_to_array(name, '-'))[2]  -- sender_id is second part
  AND EXISTS (
    SELECT 1 FROM trades 
    WHERE trades.id::text = (string_to_array(name, '/'))[2]  -- trade_id is folder name
    AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
  )
);

-- RLS Policy: Allow users to view images from trades they participate in
CREATE POLICY "Users can view images from their trade chats"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND EXISTS (
    SELECT 1 FROM trades 
    WHERE trades.id::text = (string_to_array(name, '/'))[2]  -- trade_id is folder name
    AND (trades.buyer_id = auth.uid() OR trades.seller_id = auth.uid())
  )
);

-- RLS Policy: Allow users to delete their own chat images
CREATE POLICY "Users can delete their own chat images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND auth.uid()::text = (string_to_array(name, '-'))[2]  -- sender_id is second part
);

-- ================================================================
-- BLOCK 3: Verification Queries
-- ================================================================

-- Verify bucket exists
-- SELECT id, name, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'chat-images';

-- Verify RLS policies
-- SELECT policyname, permissive, roles, cmd FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%chat%';

-- Test file path parsing (example)
-- SELECT 
--   (string_to_array('chat/{trade_id}/{sender_id}-1234567890-uuid.jpg', '/'))[2] as trade_id,
--   (string_to_array('chat/{trade_id}/{sender_id}-1234567890-uuid.jpg', '-'))[2] as sender_id;