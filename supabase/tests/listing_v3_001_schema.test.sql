-- ================================================================
-- PgTAP Test: item_bulk_uploads, item_drafts, and items columns
-- Task: LISTING-V3-001
-- Test file: supabase/tests/listing_v3_001_schema.test.sql
-- Run: supabase test db
-- ================================================================

BEGIN;
SELECT plan(50); -- Adjust count based on actual test count below

-- ================================================================
-- TEST 1: item_bulk_uploads table structure
-- ================================================================

SELECT has_table('public', 'item_bulk_uploads', 'Table item_bulk_uploads should exist');

SELECT has_column('public', 'item_bulk_uploads', 'id', 'Column id exists');
SELECT has_column('public', 'item_bulk_uploads', 'seller_id', 'Column seller_id exists');
SELECT has_column('public', 'item_bulk_uploads', 'status', 'Column status exists');
SELECT has_column('public', 'item_bulk_uploads', 'total_photos', 'Column total_photos exists');
SELECT has_column('public', 'item_bulk_uploads', 'total_items', 'Column total_items exists');
SELECT has_column('public', 'item_bulk_uploads', 'published_items', 'Column published_items exists');
SELECT has_column('public', 'item_bulk_uploads', 'created_at', 'Column created_at exists');
SELECT has_column('public', 'item_bulk_uploads', 'completed_at', 'Column completed_at exists');

SELECT col_type_is('public', 'item_bulk_uploads', 'id', 'uuid', 'id is UUID');
SELECT col_type_is('public', 'item_bulk_uploads', 'seller_id', 'uuid', 'seller_id is UUID');
SELECT col_type_is('public', 'item_bulk_uploads', 'status', 'text', 'status is TEXT');
SELECT col_type_is('public', 'item_bulk_uploads', 'total_photos', 'integer', 'total_photos is INTEGER');
SELECT col_type_is('public', 'item_bulk_uploads', 'total_items', 'integer', 'total_items is INTEGER');

SELECT col_not_null('public', 'item_bulk_uploads', 'id', 'id is NOT NULL');
SELECT col_not_null('public', 'item_bulk_uploads', 'seller_id', 'seller_id is NOT NULL');
SELECT col_not_null('public', 'item_bulk_uploads', 'status', 'status is NOT NULL');
SELECT col_not_null('public', 'item_bulk_uploads', 'created_at', 'created_at is NOT NULL');

SELECT col_has_default('public', 'item_bulk_uploads', 'id', 'id has default (gen_random_uuid)');
SELECT col_has_default('public', 'item_bulk_uploads', 'status', 'status has default (pending)');
SELECT col_has_default('public', 'item_bulk_uploads', 'total_photos', 'total_photos has default (0)');
SELECT col_has_default('public', 'item_bulk_uploads', 'total_items', 'total_items has default (0)');
SELECT col_has_default('public', 'item_bulk_uploads', 'published_items', 'published_items has default (0)');
SELECT col_has_default('public', 'item_bulk_uploads', 'created_at', 'created_at has default (now)');

-- CHECK constraints
SELECT col_has_check('public', 'item_bulk_uploads', 'total_items', 'total_items has CHECK constraint (<=15)');
SELECT col_has_check('public', 'item_bulk_uploads', 'total_photos', 'total_photos has CHECK constraint (<=30)');
SELECT col_has_check('public', 'item_bulk_uploads', 'status', 'status has CHECK constraint (enum)');

-- RLS enabled
SELECT results_eq(
  'SELECT rowsecurity FROM pg_tables WHERE schemaname = ''public'' AND tablename = ''item_bulk_uploads''',
  ARRAY[true],
  'RLS is enabled on item_bulk_uploads'
);

-- ================================================================
-- TEST 2: item_drafts table structure
-- ================================================================

SELECT has_table('public', 'item_drafts', 'Table item_drafts should exist');

SELECT has_column('public', 'item_drafts', 'id', 'Column id exists');
SELECT has_column('public', 'item_drafts', 'seller_id', 'Column seller_id exists');
SELECT has_column('public', 'item_drafts', 'bulk_upload_id', 'Column bulk_upload_id exists');
SELECT has_column('public', 'item_drafts', 'draft_data', 'Column draft_data exists');
SELECT has_column('public', 'item_drafts', 'photo_urls', 'Column photo_urls exists');
SELECT has_column('public', 'item_drafts', 'ai_suggestions', 'Column ai_suggestions exists');
SELECT has_column('public', 'item_drafts', 'step', 'Column step exists');
SELECT has_column('public', 'item_drafts', 'created_at', 'Column created_at exists');
SELECT has_column('public', 'item_drafts', 'updated_at', 'Column updated_at exists');
SELECT has_column('public', 'item_drafts', 'expires_at', 'Column expires_at exists');

SELECT col_type_is('public', 'item_drafts', 'id', 'uuid', 'id is UUID');
SELECT col_type_is('public', 'item_drafts', 'seller_id', 'uuid', 'seller_id is UUID');
SELECT col_type_is('public', 'item_drafts', 'bulk_upload_id', 'uuid', 'bulk_upload_id is UUID');
SELECT col_type_is('public', 'item_drafts', 'draft_data', 'jsonb', 'draft_data is JSONB');
SELECT col_type_is('public', 'item_drafts', 'photo_urls', 'text[]', 'photo_urls is TEXT[]');
SELECT col_type_is('public', 'item_drafts', 'ai_suggestions', 'jsonb', 'ai_suggestions is JSONB');
SELECT col_type_is('public', 'item_drafts', 'step', 'text', 'step is TEXT');

SELECT col_not_null('public', 'item_drafts', 'seller_id', 'seller_id is NOT NULL');
SELECT col_not_null('public', 'item_drafts', 'draft_data', 'draft_data is NOT NULL');
SELECT col_not_null('public', 'item_drafts', 'photo_urls', 'photo_urls is NOT NULL');

-- RLS enabled
SELECT results_eq(
  'SELECT rowsecurity FROM pg_tables WHERE schemaname = ''public'' AND tablename = ''item_drafts''',
  ARRAY[true],
  'RLS is enabled on item_drafts'
);

-- ================================================================
-- TEST 3: Triggers on item_drafts
-- ================================================================

SELECT has_trigger('public', 'item_drafts', 'update_item_drafts_updated_at', 'Trigger update_item_drafts_updated_at exists');
SELECT has_trigger('public', 'item_drafts', 'enforce_max_drafts', 'Trigger enforce_max_drafts exists');

SELECT has_function('public', 'update_item_drafts_updated_at', 'Function update_item_drafts_updated_at exists');
SELECT has_function('public', 'enforce_max_drafts', 'Function enforce_max_drafts exists');

-- ================================================================
-- TEST 4: items table new columns
-- ================================================================

SELECT has_column('public', 'items', 'bulk_upload_id', 'Column items.bulk_upload_id exists');
SELECT has_column('public', 'items', 'requested_category_name', 'Column items.requested_category_name exists');

SELECT col_type_is('public', 'items', 'bulk_upload_id', 'uuid', 'items.bulk_upload_id is UUID');
SELECT col_type_is('public', 'items', 'requested_category_name', 'text', 'items.requested_category_name is TEXT');

SELECT col_is_null('public', 'items', 'bulk_upload_id', 'items.bulk_upload_id is nullable');
SELECT col_is_null('public', 'items', 'requested_category_name', 'items.requested_category_name is nullable');

-- CHECK constraint on requested_category_name length
SELECT col_has_check('public', 'items', 'requested_category_name', 'items.requested_category_name has CHECK constraint (length <=100)');

-- ================================================================
-- TEST 5: Foreign keys
-- ================================================================

SELECT has_fk('public', 'item_bulk_uploads', 'FK item_bulk_uploads → auth.users exists');
SELECT has_fk('public', 'item_drafts', 'FK item_drafts → auth.users exists');
SELECT has_fk('public', 'item_drafts', 'FK item_drafts → item_bulk_uploads exists');
SELECT has_fk('public', 'items', 'FK items → item_bulk_uploads exists');

-- ================================================================
-- TEST 6: Indexes
-- ================================================================

SELECT has_index('public', 'item_bulk_uploads', 'idx_item_bulk_uploads_seller_id', 'seller_id', 'Index idx_item_bulk_uploads_seller_id exists');
SELECT has_index('public', 'item_bulk_uploads', 'idx_item_bulk_uploads_status', 'status', 'Index idx_item_bulk_uploads_status exists');

SELECT has_index('public', 'item_drafts', 'idx_item_drafts_seller_id', 'seller_id', 'Index idx_item_drafts_seller_id exists');
SELECT has_index('public', 'item_drafts', 'idx_item_drafts_expires_at', 'expires_at', 'Index idx_item_drafts_expires_at exists');
SELECT has_index('public', 'item_drafts', 'idx_item_drafts_bulk_upload_id', 'bulk_upload_id', 'Index idx_item_drafts_bulk_upload_id exists');

SELECT has_index('public', 'items', 'idx_items_bulk_upload_id', 'bulk_upload_id', 'Index idx_items_bulk_upload_id exists');
SELECT has_index('public', 'items', 'idx_items_requested_category', 'requested_category_name', 'Index idx_items_requested_category exists');

SELECT * FROM finish();
ROLLBACK;
