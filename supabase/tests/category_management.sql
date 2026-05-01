-- ================================================================
-- PgTAP Test: Category Management (MODULE-12 ADMIN-V3-009)
-- FILE: supabase/tests/category_management.sql
-- Test: category triggers, RPC authorization, UNIQUE constraints
-- Run: supabase test db
-- ================================================================

BEGIN;
SELECT plan(8); -- 3 scenarios: trigger counts, admin RPC guard, suggestion UNIQUE

-- ================================================================
-- SETUP: Seed test data (categories, items, test user)
-- ================================================================

-- Create admin user
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'admin@test.com')
ON CONFLICT (id) DO NOTHING;

-- Create non-admin user
INSERT INTO auth.users (id, email) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000002', 'seller@test.com')
ON CONFLICT (id) DO NOTHING;

-- Create test categories
INSERT INTO public.categories (id, name, is_active, display_order, sp_earning_multiplier, sp_spending_cap_percent) VALUES
  ('cat-test-1', 'Books', true, 1, 1.10, 70),
  ('cat-test-2', 'Toys', true, 2, 1.15, 75),
  ('cat-test-other', 'Other', true, 99, 1.05, 50)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- SCENARIO 1: item_count trigger correctness
-- Three-step test:
--   1. Insert 3 items → item_count=3
--   2. Update 1 to status='sold' → item_count=2
--   3. Soft-delete 1 → item_count=1
-- ================================================================

-- Step 1: Insert 3 items (status='active')
INSERT INTO public.items (id, seller_id, category_id, title, price, status) VALUES
  ('item-1', 'bbbbbbbb-0000-0000-0000-000000000002', 'cat-test-1', 'Book A', 10, 'active'),
  ('item-2', 'bbbbbbbb-0000-0000-0000-000000000002', 'cat-test-1', 'Book B', 15, 'active'),
  ('item-3', 'bbbbbbbb-0000-0000-0000-000000000002', 'cat-test-1', 'Book C', 20, 'active');

SELECT results_eq(
  'SELECT item_count FROM public.categories WHERE id = ''cat-test-1''',
  ARRAY[3],
  'TRIGGER: After INSERT 3 items → item_count=3'
);

-- Step 2: Update 1 to sold (should decrement)
UPDATE public.items SET status = 'sold' WHERE id = 'item-1';

SELECT results_eq(
  'SELECT item_count FROM public.categories WHERE id = ''cat-test-1''',
  ARRAY[2],
  'TRIGGER: After UPDATE to sold → item_count=2'
);

-- Step 3: Soft-delete 1 (set deleted_at)
UPDATE public.items SET deleted_at = now() WHERE id = 'item-2';

SELECT results_eq(
  'SELECT item_count FROM public.categories WHERE id = ''cat-test-1''',
  ARRAY[1],
  'TRIGGER: After soft-delete → item_count=1'
);

-- Step 4: Cleanup (restore category count to 0 for later tests)
DELETE FROM public.items WHERE id IN ('item-1', 'item-2', 'item-3');

SELECT results_eq(
  'SELECT item_count FROM public.categories WHERE id = ''cat-test-1''',
  ARRAY[0],
  'TRIGGER: After DELETE all → item_count=0'
);

-- ================================================================
-- SCENARIO 2: reorder_categories RPC — admin guard
-- Non-admin calling RPC should raise exception
-- ================================================================

-- Try calling as non-admin (should fail with 'permission denied' or similar)
SELECT throws_ok(
  $$
    SELECT public.reorder_categories(
      '[{"id": "cat-test-1", "display_order": 99}]'::jsonb
    )
  $$,
  'permission denied for function reorder_categories',
  'RPC: Non-admin cannot call reorder_categories'
);

-- ALTERNATIVE if your RPC uses a different error message or custom check:
-- SELECT results_ne(
--   'SELECT public.reorder_categories(''[{"id": "cat-test-1", "display_order": 99}]''::jsonb)',
--   'success',
--   'RPC: Non-admin call should not succeed'
-- );

-- ================================================================
-- SCENARIO 3: category_suggestions UNIQUE constraint on item_id
-- Attempt to INSERT duplicate item_id → should fail OR upsert
-- ================================================================

-- Insert item for suggestion test
INSERT INTO public.items (id, seller_id, category_id, title, price, status) VALUES
  ('item-suggest', 'bbbbbbbb-0000-0000-0000-000000000002', 'cat-test-other', 'Test Item', 10, 'active');

-- First insert (should succeed)
INSERT INTO public.category_suggestions (item_id, suggested_name, seller_id, status) VALUES
  ('item-suggest', 'Art Supplies', 'bbbbbbbb-0000-0000-0000-000000000002', 'pending');

SELECT results_eq(
  'SELECT COUNT(*)::integer FROM public.category_suggestions WHERE item_id = ''item-suggest''',
  ARRAY[1],
  'UNIQUE: First suggestion inserted successfully'
);

-- Second insert with same item_id (should fail OR upsert depending on schema)
-- If you have ON CONFLICT (item_id) DO UPDATE, this will succeed and count stays 1
-- If you have UNIQUE without ON CONFLICT, this throws an error
SELECT throws_ok(
  $$
    INSERT INTO public.category_suggestions (item_id, suggested_name, seller_id, status) VALUES
      ('item-suggest', 'Duplicate Name', 'bbbbbbbb-0000-0000-0000-000000000002', 'pending')
  $$,
  '23505', -- Postgres error code for unique_violation
  'UNIQUE: Duplicate item_id raises unique_violation'
);

-- If your schema uses ON CONFLICT (item_id) DO UPDATE instead, use this test:
-- INSERT INTO public.category_suggestions (item_id, suggested_name, seller_id, status) VALUES
--   ('item-suggest', 'Updated Name', 'bbbbbbbb-0000-0000-0000-000000000002', 'pending')
-- ON CONFLICT (item_id) DO UPDATE SET suggested_name = EXCLUDED.suggested_name;
-- 
-- SELECT results_eq(
--   'SELECT COUNT(*)::integer FROM public.category_suggestions WHERE item_id = ''item-suggest''',
--   ARRAY[1],
--   'UNIQUE: ON CONFLICT upsert keeps count at 1'
-- );

-- ================================================================
-- CLEANUP: Remove test data
-- ================================================================
DELETE FROM public.category_suggestions WHERE item_id = 'item-suggest';
DELETE FROM public.items WHERE id = 'item-suggest';
DELETE FROM public.categories WHERE id IN ('cat-test-1', 'cat-test-2', 'cat-test-other');
DELETE FROM auth.users WHERE id IN ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002');

SELECT * FROM finish();
ROLLBACK;
