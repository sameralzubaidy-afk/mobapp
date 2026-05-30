-- File: DIAGNOSE-SIGNUP-TRIGGER.sql
-- Run this in Supabase SQL Editor to diagnose signup trigger issues

-- 1. Check if handle_new_user function exists and is correct
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 2. Check if profiles table has required columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Check if trigger exists on auth.users
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users' AND trigger_schema = 'auth';

-- 4. Test manual profile insertion to see if RLS is blocking
INSERT INTO profiles (user_id, name, phone_verified, phone_verified_at)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Test User', false, NULL)
ON CONFLICT (user_id) DO NOTHING;

-- 5. Check for recent errors in profiles table insertions
-- Note: This depends on your logging setup
SELECT COUNT(*) as recent_profile_count FROM profiles ORDER BY created_at DESC LIMIT 10;

-- 6. Verify role_based_access_control table exists
SELECT * FROM role_based_access_control LIMIT 1;

-- 7. Check if sp_config was created successfully
SELECT COUNT(*) as config_count FROM sp_config;
