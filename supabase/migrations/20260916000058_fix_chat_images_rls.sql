-- ================================================================
-- Migration: 083_fix_chat_images_rls.sql
-- Module: MODULE-07 MSG-003 - Image Sharing in Chat
-- Description: Fix incorrect RLS parsing logic in chat-images policies
-- Mode: B (Idempotent rerunnable migration)
-- ================================================================

-- BLOCK 1: Fix RLS Policies
-- ================================================================

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can upload images to their trade chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can view images from their trade chats" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat images" ON storage.objects;

-- RLS Policy: Allow authenticated users to upload images to trades they participate in
-- File naming convention: {trade_id}/{sender_id}/{timestamp}-{filename}
CREATE POLICY "Users can upload images to their trade chats"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  -- Extract sender_id: It's the second segment of the path
  AND auth.uid()::text = split_part(name, '/', 2)
  -- Extract trade_id: It's the first segment of the path
  AND EXISTS (
    SELECT 1 FROM trades 
    WHERE trades.id::text = split_part(name, '/', 1)
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
  -- Extract trade_id: It's the first segment of the path
  AND EXISTS (
    SELECT 1 FROM trades 
    WHERE trades.id::text = split_part(name, '/', 1)
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
  -- Extract sender_id: It's the second segment of the path
  AND auth.uid()::text = split_part(name, '/', 2)
);

-- ================================================================
-- BLOCK 2: Verification Queries
-- ================================================================

-- Verify file path parsing (example)
-- Path: 'trade-uuid/sender-uuid/timestamp-image.jpg'
-- SELECT 
--   split_part('trade-uuid/sender-uuid/timestamp-image.jpg', '/', 1) as trade_id,
--   split_part('trade-uuid/sender-uuid/timestamp-image.jpg', '/', 2) as sender_id;
