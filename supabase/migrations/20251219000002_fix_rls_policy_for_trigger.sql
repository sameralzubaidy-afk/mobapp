-- Fix RLS policy to allow trigger inserts for profile creation
-- The trigger runs as SECURITY DEFINER but WITH CHECK still applies
-- Allow inserts when auth.uid() is null (trigger context) or matches user_id

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
FOR INSERT
WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id);