# LISTING-V3-001: Schema Migrations — Manual Testing Guide

**Task:** LISTING-V3-001  
**Module:** MODULE-04-ITEM-LISTING-V3  
**Date:** April 22, 2026  
**Tester:** _____________  
**Environment:** Supabase Production (staging project)

---

## Pre-Requisites

- [ ] Supabase CLI access to production project
- [ ] SQL Editor access to production Supabase dashboard
- [ ] MODULE-05 V3 migrations already applied (`age_group`, `gender`, `brand`, `color` columns exist)

---

## Step 1: Apply Migrations

### TC-001: Apply migration 20260420000003_create_item_bulk_uploads.sql

**Objective:** Create `item_bulk_uploads` table with correct schema and constraints

**Steps:**
1. Open Supabase SQL Editor for your production project
2. Copy entire contents of `supabase/migrations/20260420000003_create_item_bulk_uploads.sql`
3. Paste into SQL Editor
4. Click "Run"

**Expected Results:**
- ✅ Migration executes without errors
- ✅ Message: "Success. No rows returned"

**Verification Query:**
```sql
-- Verify table exists with correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'item_bulk_uploads'
ORDER BY ordinal_position;
```

**Expected Output:**
| column_name | data_type | is_nullable | column_default |
|------------|-----------|-------------|----------------|
| id | uuid | NO | gen_random_uuid() |
| seller_id | uuid | NO | NULL |
| status | text | NO | 'pending' |
| total_photos | integer | NO | 0 |
| total_items | integer | NO | 0 |
| published_items | integer | NO | 0 |
| created_at | timestamp with time zone | NO | now() |
| completed_at | timestamp with time zone | YES | NULL |

---

### TC-002: Verify RLS on item_bulk_uploads

**Objective:** Confirm RLS is enabled and policies are created

**Verification Query:**
```sql
-- Verify RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'item_bulk_uploads';

-- List policies
SELECT policyname, cmd, permissive, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'item_bulk_uploads';
```

**Expected Output:**
- RLS enabled: `rowsecurity = true`
- 2 policies exist:
  - "Seller can manage own bulk uploads" (cmd: ALL)
  - "Admin can view all bulk uploads" (cmd: SELECT)

**Pass/Fail:** [ ]

---

### TC-003: Verify CHECK constraints on item_bulk_uploads

**Objective:** Confirm max limits enforced

**Verification Query:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.item_bulk_uploads'::regclass
  AND contype = 'c';
```

**Expected Output:**
- `bulk_uploads_items_check`: `CHECK (total_items <= 15)`
- `bulk_uploads_photos_check`: `CHECK (total_photos <= 30)`
- `item_bulk_uploads_status_check`: `CHECK (status IN (...))`

**Pass/Fail:** [ ]

---

### TC-004: Apply migration 20260420000004_create_item_drafts.sql

**Objective:** Create `item_drafts` table with triggers and RLS

**Steps:**
1. Copy entire contents of `supabase/migrations/20260420000004_create_item_drafts.sql`
2. Paste into SQL Editor
3. Click "Run"

**Expected Results:**
- ✅ Migration executes without errors
- ✅ Table, triggers, and functions created

**Verification Query:**
```sql
-- Verify table exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'item_drafts'
ORDER BY ordinal_position;
```

**Expected Output:**
- 10 columns: `id`, `seller_id`, `bulk_upload_id`, `draft_data`, `photo_urls`, `ai_suggestions`, `step`, `created_at`, `updated_at`, `expires_at`

**Pass/Fail:** [ ]

---

### TC-005: Verify triggers on item_drafts

**Objective:** Confirm both triggers exist

**Verification Query:**
```sql
SELECT tgname, tgtype, tgenabled, tgisinternal
FROM pg_trigger
WHERE tgrelid = 'public.item_drafts'::regclass
  AND tgisinternal = false;
```

**Expected Output:**
- `update_item_drafts_updated_at` (BEFORE UPDATE)
- `enforce_max_drafts` (AFTER INSERT)

**Pass/Fail:** [ ]

---

### TC-006: Test updated_at trigger

**Objective:** Verify `updated_at` auto-updates on UPDATE

**Test Query:**
```sql
-- Insert test draft
INSERT INTO public.item_drafts (seller_id, draft_data, photo_urls)
VALUES (auth.uid(), '{"title": "Test"}', '{}')
RETURNING id, created_at, updated_at;

-- Wait 2 seconds, then update
SELECT pg_sleep(2);

UPDATE public.item_drafts
SET draft_data = '{"title": "Updated"}'
WHERE seller_id = auth.uid()
RETURNING updated_at;
```

**Expected Results:**
- ✅ `updated_at` timestamp is later than initial `created_at`

**Cleanup:**
```sql
DELETE FROM public.item_drafts WHERE seller_id = auth.uid();
```

**Pass/Fail:** [ ]

---

### TC-007: Test enforce_max_drafts trigger

**Objective:** Verify max 5 drafts enforced per seller

**Test Query:**
```sql
-- Insert 7 drafts (should keep only 5 most recent)
DO $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..7 LOOP
    INSERT INTO public.item_drafts (seller_id, draft_data, photo_urls)
    VALUES (auth.uid(), jsonb_build_object('test', i), '{}');
    PERFORM pg_sleep(0.1); -- Small delay to ensure updated_at differs
  END LOOP;
END $$;

-- Count drafts
SELECT COUNT(*) FROM public.item_drafts WHERE seller_id = auth.uid();
```

**Expected Results:**
- ✅ Exactly 5 drafts remain
- ✅ Drafts 6 and 7 exist (most recent)
- ✅ Drafts 1 and 2 deleted (oldest)

**Cleanup:**
```sql
DELETE FROM public.item_drafts WHERE seller_id = auth.uid();
```

**Pass/Fail:** [ ]

---

### TC-008: Apply migration 20260420000005_add_bulk_listing_columns_to_items.sql

**Objective:** Add `bulk_upload_id` and `requested_category_name` to `items` table

**Steps:**
1. Copy entire contents of `supabase/migrations/20260420000005_add_bulk_listing_columns_to_items.sql`
2. Paste into SQL Editor
3. Click "Run"

**Expected Results:**
- ✅ Migration executes without errors
- ✅ No "column already exists" errors (idempotent)

**Verification Query:**
```sql
-- Verify new columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'items'
  AND column_name IN ('bulk_upload_id', 'requested_category_name')
ORDER BY column_name;
```

**Expected Output:**
| column_name | data_type | is_nullable |
|------------|-----------|-------------|
| bulk_upload_id | uuid | YES |
| requested_category_name | text | YES |

**Pass/Fail:** [ ]

---

### TC-009: Verify FK constraint on items.bulk_upload_id

**Objective:** Confirm FK to `item_bulk_uploads` with ON DELETE SET NULL

**Verification Query:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.items'::regclass
  AND conname LIKE '%bulk_upload%';
```

**Expected Output:**
- FK constraint exists: `FOREIGN KEY (bulk_upload_id) REFERENCES item_bulk_uploads(id) ON DELETE SET NULL`

**Pass/Fail:** [ ]

---

### TC-010: Verify CHECK constraint on requested_category_name

**Objective:** Confirm length limit <= 100

**Verification Query:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.items'::regclass
  AND pg_get_constraintdef(oid) LIKE '%requested_category_name%';
```

**Expected Output:**
- CHECK constraint: `CHECK (LENGTH(requested_category_name) <= 100)`

**Pass/Fail:** [ ]

---

### TC-011: Verify partial indexes

**Objective:** Confirm partial indexes on new columns

**Verification Query:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'items'
  AND indexname IN ('idx_items_bulk_upload_id', 'idx_items_requested_category');
```

**Expected Output:**
- `idx_items_bulk_upload_id` with WHERE clause `bulk_upload_id IS NOT NULL`
- `idx_items_requested_category` with WHERE clause `requested_category_name IS NOT NULL`

**Pass/Fail:** [ ]

---

### TC-012: Verify MODULE-05 V3 columns not re-added

**Objective:** Confirm existing columns unchanged

**Verification Query:**
```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'items'
  AND column_name IN ('age_group', 'gender', 'brand', 'color')
ORDER BY column_name;
```

**Expected Output:**
- All 4 columns exist (added by MODULE-05 V3, not touched by V3-001)

**Pass/Fail:** [ ]

---

## Step 2: Idempotency Test

### TC-013: Re-run all migrations

**Objective:** Verify migrations can be re-run without errors

**Steps:**
1. Re-run migration 20260420000003 (bulk_uploads)
2. Re-run migration 20260420000004 (drafts)
3. Re-run migration 20260420000005 (items columns)

**Expected Results:**
- ✅ All migrations execute without errors
- ✅ No duplicate objects created
- ✅ No "already exists" errors

**Pass/Fail:** [ ]

---

## Step 3: Integration Test

### TC-014: Create bulk upload session with draft

**Objective:** Test end-to-end flow from bulk upload → draft → item

**Test Query:**
```sql
-- 1. Create bulk upload session
INSERT INTO public.item_bulk_uploads (seller_id, status, total_photos, total_items)
VALUES (auth.uid(), 'pending', 4, 2)
RETURNING id;
-- Save this ID as <bulk_upload_id>

-- 2. Create draft linked to bulk upload
INSERT INTO public.item_drafts (seller_id, bulk_upload_id, draft_data, photo_urls)
VALUES (
  auth.uid(),
  '<bulk_upload_id>',
  '{"items": [{"title": "Item 1"}, {"title": "Item 2"}]}',
  ARRAY['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg']
)
RETURNING id;
-- Save this ID as <draft_id>

-- 3. Create items linked to bulk upload (simulate publish)
-- Note: Replace category_id, node_id with valid values from your DB
INSERT INTO public.items (
  seller_id, bulk_upload_id, title, description, price,
  category_id, condition, node_id, photo_urls
)
VALUES
  (auth.uid(), '<bulk_upload_id>', 'Item 1', 'Desc 1', 10.00, '<category_id>', 'good', '<node_id>', ARRAY['photo1.jpg']),
  (auth.uid(), '<bulk_upload_id>', 'Item 2', 'Desc 2', 15.00, '<category_id>', 'like_new', '<node_id>', ARRAY['photo2.jpg'])
RETURNING id, bulk_upload_id;

-- 4. Update bulk upload status
UPDATE public.item_bulk_uploads
SET status = 'completed', published_items = 2, completed_at = now()
WHERE id = '<bulk_upload_id>';

-- 5. Delete draft after publish
DELETE FROM public.item_drafts WHERE id = '<draft_id>';

-- 6. Verify items are linked
SELECT id, title, bulk_upload_id FROM public.items
WHERE bulk_upload_id = '<bulk_upload_id>';
```

**Expected Results:**
- ✅ All queries execute without FK errors
- ✅ 2 items created with `bulk_upload_id` set
- ✅ Draft deleted successfully
- ✅ Bulk upload status = 'completed'

**Cleanup:**
```sql
DELETE FROM public.items WHERE bulk_upload_id = '<bulk_upload_id>';
DELETE FROM public.item_bulk_uploads WHERE id = '<bulk_upload_id>';
```

**Pass/Fail:** [ ]

---

### TC-015: Test ON DELETE SET NULL for bulk_upload_id

**Objective:** Verify items retain data when bulk upload deleted

**Test Query:**
```sql
-- 1. Create bulk upload + item
INSERT INTO public.item_bulk_uploads (seller_id, status)
VALUES (auth.uid(), 'completed')
RETURNING id;
-- Save as <bulk_id>

INSERT INTO public.items (
  seller_id, bulk_upload_id, title, description, price,
  category_id, condition, node_id, photo_urls
)
VALUES (
  auth.uid(), '<bulk_id>', 'Test Item', 'Test', 20.00,
  '<category_id>', 'good', '<node_id>', ARRAY['test.jpg']
)
RETURNING id;
-- Save as <item_id>

-- 2. Delete bulk upload
DELETE FROM public.item_bulk_uploads WHERE id = '<bulk_id>';

-- 3. Verify item.bulk_upload_id is NULL
SELECT id, title, bulk_upload_id FROM public.items WHERE id = '<item_id>';
```

**Expected Results:**
- ✅ Item exists with `bulk_upload_id = NULL`
- ✅ Item NOT deleted (ON DELETE SET NULL works)

**Cleanup:**
```sql
DELETE FROM public.items WHERE id = '<item_id>';
```

**Pass/Fail:** [ ]

---

## Summary

**Total Test Cases:** 15  
**Passed:** ____  
**Failed:** ____  
**Blocked:** ____  

**Sign-off:**
- [ ] All migrations applied successfully
- [ ] All verification queries returned expected results
- [ ] Idempotency verified (re-run succeeds)
- [ ] Integration tests passed
- [ ] Ready for LISTING-V3-002 (Edge Functions)

**Notes:**
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________

**Tester Signature:** ________________  **Date:** _______________
