-- ================================================================
-- Migration: 20251218000002_add_items_seller_fkey.sql
-- Module: MODULE-04 LISTING-V2 - Add foreign key for seller relationship
-- Description: Adds FK constraint from items.seller_id to profiles.id
--              This enables PostgREST relationship expansion
-- ================================================================

-- Add foreign key constraint if it doesn't exist
ALTER TABLE items
ADD CONSTRAINT items_seller_id_fkey 
FOREIGN KEY (seller_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- =============================================================================
-- VERIFICATION QUERY (run after migration)
-- =============================================================================

-- Verify foreign key was created:
-- SELECT constraint_name, table_name, column_name, foreign_table_name, foreign_column_name
-- FROM information_schema.key_column_usage
-- WHERE table_name = 'items' AND column_name = 'seller_id';

-- Expected result:
-- items_seller_id_fkey | items | seller_id | profiles | id
