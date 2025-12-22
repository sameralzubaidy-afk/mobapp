-- ================================================================
-- Migration: FIX_ITEMS_PROFILES_RELATIONSHIP.sql
-- Description: Fixes the foreign key relationship between items and profiles
--              to enable PostgREST relationship expansion (joins).
-- ================================================================

-- 1. Drop the incorrect constraint if it exists
-- Some migrations might have created it pointing to profiles.id
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_seller_id_fkey;

-- 2. Add the correct constraint pointing to profiles(user_id)
-- items.seller_id contains the UUID from auth.users.id
-- profiles.user_id also contains the UUID from auth.users.id and is UNIQUE
-- This direct link allows PostgREST to perform: .select('*, seller:profiles(*)')
ALTER TABLE items
ADD CONSTRAINT items_seller_id_fkey 
FOREIGN KEY (seller_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;

-- 3. Ensure profiles -> nodes relationship is also correctly named for consistency
-- The code expects 'profiles_node_id_fkey' or 'fk_profiles_node_id'
-- Let's make sure it's consistent.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS fk_profiles_node_id;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_node_id_fkey;

ALTER TABLE profiles
ADD CONSTRAINT profiles_node_id_fkey 
FOREIGN KEY (node_id) 
REFERENCES nodes(id) 
ON DELETE SET NULL;

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- SELECT 
--     tc.table_name, 
--     kcu.column_name, 
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name 
-- FROM 
--     information_schema.table_constraints AS tc 
--     JOIN information_schema.key_column_usage AS kcu
--       ON tc.constraint_name = kcu.constraint_name
--       AND tc.table_schema = kcu.table_schema
--     JOIN information_schema.constraint_column_usage AS ccu
--       ON ccu.constraint_name = tc.constraint_name
--       AND ccu.table_schema = tc.table_schema
-- WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'items';
