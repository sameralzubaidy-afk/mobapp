-- File: supabase/migrations/081_fix_messages_sender_id_fk.sql
-- Fix messages.sender_id foreign key to point to profiles(user_id)
-- This allows PostgREST to join to the profiles table properly.

-- 1. Correct sender_id FK
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;

-- We reference profiles(user_id) because Profiles is in the public schema
-- and PostgREST can easily join to it.
ALTER TABLE messages 
  ADD CONSTRAINT messages_sender_id_fkey 
  FOREIGN KEY (sender_id) 
  REFERENCES profiles(user_id) 
  ON DELETE CASCADE;

-- 2. Verify the relationship exists (PostgREST cache often needs this)
COMMENT ON CONSTRAINT messages_sender_id_fkey ON messages IS 'Relationship for sender profile';
