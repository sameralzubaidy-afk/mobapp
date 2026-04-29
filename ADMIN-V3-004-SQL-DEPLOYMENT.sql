-- ADMIN-V3-004 SQL DEPLOYMENT SCRIPT
-- Run these migrations in Supabase SQL Editor in sequence
-- Date: 2026-04-29
-- Task: ADMIN-V3-004 (Category Management Page)

-- ============================================================================
-- STEP 1: Add Category Management Columns
-- File: supabase/migrations/20260420000006_add_category_management_columns.sql
-- ============================================================================
-- Run this first to add all new columns to categories table

-- ============================================================================
-- STEP 2: Create Category Suggestions Table
-- File: supabase/migrations/20260420000007_create_category_suggestions.sql
-- ============================================================================
-- Creates table for seller-requested categories ("Other" flow)

-- ============================================================================
-- STEP 3: Create Item Count Trigger
-- File: supabase/migrations/20260420000008_category_item_count_trigger.sql
-- ============================================================================
-- Automatically maintains categories.item_count (readonly from app code)

-- ============================================================================
-- STEP 4: Create Reorder Categories RPC
-- File: supabase/migrations/20260420000009_reorder_categories_rpc.sql
-- ============================================================================
-- Admin-only function for batch display_order updates (drag-and-drop)

-- ============================================================================
-- STEP 5: Create Category Icons Storage Bucket
-- File: supabase/migrations/20260420000010_create_category_icons_storage_bucket.sql
-- ============================================================================
-- Storage bucket for custom category icons (public read, admin write)

-- ============================================================================
-- VERIFICATION QUERIES (run after all migrations)
-- ============================================================================

-- 1. Verify new columns exist in categories table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'categories'
ORDER BY ordinal_position;

-- Expected columns (partial list):
-- is_active (boolean, NOT NULL, DEFAULT true)
-- item_count (integer, NOT NULL, DEFAULT 0)
-- display_order (integer, NOT NULL, DEFAULT 0)
-- description (text)
-- icon (text)
-- icon_url (text)
-- bonus_badge_icon_url (text)
-- sp_earning_multiplier (numeric, NOT NULL, DEFAULT 1.10)
-- sp_spending_cap_percent (integer, NOT NULL, DEFAULT 70)
-- sp_config_notes (text)
-- sp_rate_change_notify (boolean, NOT NULL, DEFAULT false)

-- 2. Verify CHECK constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'categories'::regclass
  AND contype = 'c';

-- Expected constraints:
-- categories_description_check (LENGTH(description) <= 200)
-- categories_icon_check (LENGTH(icon) <= 50)
-- categories_sp_config_notes_check (LENGTH(sp_config_notes) <= 500)
-- categories_sp_earning_multiplier_check (sp_earning_multiplier >= 1.05 AND <= 1.40)
-- categories_sp_spending_cap_percent_check (sp_spending_cap_percent >= 50 AND <= 80)

-- 3. Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'categories';

-- Expected indexes:
-- idx_categories_active (WHERE is_active = true)
-- idx_categories_item_count
-- idx_categories_bonus (WHERE sp_earning_multiplier > 1.10)

-- 4. Verify category_suggestions table
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'category_suggestions';

-- Expected: 1 row

-- 5. Verify trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'items'
  AND trigger_name = 'update_category_item_count_trigger';

-- Expected: 1 row (AFTER INSERT OR UPDATE OR DELETE)

-- 6. Verify RPC function exists
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'reorder_categories';

-- Expected: 1 row

-- 7. Verify storage bucket exists
SELECT name, public
FROM storage.buckets
WHERE name = 'category-icons';

-- Expected: 1 row (public = true)

-- 8. Verify RLS policies on category_suggestions
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'category_suggestions';

-- Expected policies:
-- category_suggestions_admin_all (FOR ALL, admin role via user_roles)
-- category_suggestions_seller_select (FOR SELECT, seller can view own)

-- ============================================================================
-- SEED DATA (Optional — run if categories table is empty)
-- ============================================================================

-- Check if categories table is empty
SELECT COUNT(*) FROM categories;

-- If count is 0, insert seed data:
INSERT INTO categories (name, is_active, display_order, sp_earning_multiplier, sp_spending_cap_percent, description, icon)
VALUES
  ('Other', true, 999, 1.10, 70, 'Items that don''t fit other categories', '📦'),
  ('Toys', true, 1, 1.15, 75, 'Toys and games', '🧸'),
  ('Books', true, 2, 1.20, 70, 'Books and educational materials', '📚'),
  ('Clothing', true, 3, 1.10, 65, 'Kids clothing and accessories', '👕')
ON CONFLICT (name) DO NOTHING;

-- Verify seed data
SELECT id, name, is_active, display_order, item_count, sp_earning_multiplier, sp_spending_cap_percent
FROM categories
ORDER BY display_order;

-- ============================================================================
-- POST-DEPLOYMENT SMOKE TEST
-- ============================================================================

-- 1. Test unique constraint (case-insensitive)
-- This should fail:
INSERT INTO categories (name) VALUES ('TOYS');
-- Expected: ERROR: duplicate key value violates unique constraint

-- 2. Test sp_earning_multiplier bounds
-- This should fail:
INSERT INTO categories (name, sp_earning_multiplier) VALUES ('Test1', 1.50);
-- Expected: ERROR: new row violates check constraint "categories_sp_earning_multiplier_check"

-- 3. Test sp_spending_cap_percent bounds
-- This should fail:
INSERT INTO categories (name, sp_spending_cap_percent) VALUES ('Test2', 90);
-- Expected: ERROR: new row violates check constraint "categories_sp_spending_cap_percent_check"

-- 4. Test reorder_categories RPC (requires admin session)
-- Example call:
SELECT reorder_categories('[
  {"id": "cat-id-1", "display_order": 1},
  {"id": "cat-id-2", "display_order": 2}
]'::jsonb);

-- 5. Test item_count trigger
-- Insert a test item and verify category.item_count increments
-- (requires items table setup)

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================

-- WARNING: These commands will DELETE all category management data!
-- Only run if you need to completely undo the migrations.

-- Drop trigger
DROP TRIGGER IF EXISTS update_category_item_count_trigger ON items;
DROP FUNCTION IF EXISTS update_category_item_count();

-- Drop RPC
DROP FUNCTION IF EXISTS reorder_categories(jsonb);

-- Drop table
DROP TABLE IF EXISTS category_suggestions CASCADE;

-- Drop storage bucket (via Supabase Dashboard UI)
-- Storage → category-icons → Delete Bucket

-- Drop indexes
DROP INDEX IF EXISTS idx_categories_active;
DROP INDEX IF EXISTS idx_categories_item_count;
DROP INDEX IF EXISTS idx_categories_bonus;

-- Drop constraints (revert columns)
ALTER TABLE categories
  DROP COLUMN IF EXISTS is_active CASCADE,
  DROP COLUMN IF EXISTS item_count CASCADE,
  DROP COLUMN IF EXISTS display_order CASCADE,
  DROP COLUMN IF EXISTS description CASCADE,
  DROP COLUMN IF EXISTS icon CASCADE,
  DROP COLUMN IF EXISTS icon_url CASCADE,
  DROP COLUMN IF EXISTS bonus_badge_icon_url CASCADE,
  DROP COLUMN IF EXISTS sp_earning_multiplier CASCADE,
  DROP COLUMN IF EXISTS sp_spending_cap_percent CASCADE,
  DROP COLUMN IF EXISTS sp_config_notes CASCADE,
  DROP COLUMN IF EXISTS sp_rate_change_notify CASCADE;

-- ============================================================================
-- END OF DEPLOYMENT SCRIPT
-- ============================================================================
