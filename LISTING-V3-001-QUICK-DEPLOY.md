# LISTING-V3-001: Quick Deploy Guide (Copy-Paste Ready)

**⚠️ Run these in Supabase SQL Editor (Production Project) in ORDER**

---

## Step 1: Verify Prerequisites

```sql
-- MUST return 4 rows (MODULE-05 V3 columns)
-- If NOT: STOP and apply MODULE-05 V3 first
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'items'
  AND column_name IN ('age_group', 'gender', 'brand', 'color')
ORDER BY column_name;
```

**Expected:** 4 rows returned (age_group, brand, color, gender)  
**If different:** ❌ STOP — Apply MODULE-05 V3 migrations first

---

## Step 2: Apply Migration 1 — item_bulk_uploads

**File:** `supabase/migrations/20260420000003_create_item_bulk_uploads.sql`

**Instructions:**
1. Open the file in your editor
2. Copy ENTIRE contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Verify: "Success. No rows returned"

**Verification:**
```sql
-- Should return 1 row with rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'item_bulk_uploads';

-- Should return 2 policies
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'item_bulk_uploads';
```

---

## Step 3: Apply Migration 2 — item_drafts

**File:** `supabase/migrations/20260420000004_create_item_drafts.sql`

**Instructions:**
1. Open the file in your editor
2. Copy ENTIRE contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Verify: "Success. No rows returned"

**Verification:**
```sql
-- Should return 1 row with rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'item_drafts';

-- Should return 2 triggers
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.item_drafts'::regclass
  AND tgisinternal = false;
```

---

## Step 4: Apply Migration 3 — items columns

**File:** `supabase/migrations/20260420000005_add_bulk_listing_columns_to_items.sql`

**Instructions:**
1. Open the file in your editor
2. Copy ENTIRE contents
3. Paste into Supabase SQL Editor
4. Click "Run"
5. Verify: "Success. No rows returned"

**Verification:**
```sql
-- Should return 2 rows
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'items'
  AND column_name IN ('bulk_upload_id', 'requested_category_name')
ORDER BY column_name;
```

---

## Step 5: Final Verification (All-In-One)

```sql
-- ============================================
-- COMPREHENSIVE POST-DEPLOYMENT CHECK
-- ============================================

-- 1. Tables exist and RLS enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('item_bulk_uploads', 'item_drafts')
ORDER BY tablename;
-- Expected: 2 rows, both with rowsecurity = true

-- 2. New items columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'items'
  AND column_name IN ('bulk_upload_id', 'requested_category_name')
ORDER BY column_name;
-- Expected: 2 rows (bulk_upload_id uuid YES, requested_category_name text YES)

-- 3. Triggers exist
SELECT tgname, tgrelid::regclass::text AS table_name
FROM pg_trigger
WHERE tgrelid IN ('public.item_drafts'::regclass)
  AND tgisinternal = false
ORDER BY tgname;
-- Expected: 2 rows (enforce_max_drafts, update_item_drafts_updated_at)

-- 4. Policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('item_bulk_uploads', 'item_drafts')
ORDER BY tablename, policyname;
-- Expected: 3 rows total
--   - item_bulk_uploads: "Admin can view all bulk uploads", "Seller can manage own bulk uploads"
--   - item_drafts: "Seller can manage own drafts"

-- 5. CHECK constraints exist
SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public.item_bulk_uploads'::regclass, 'public.item_drafts'::regclass, 'public.items'::regclass)
  AND contype = 'c'
  AND (
    conname LIKE '%bulk%'
    OR conname LIKE '%requested_category%'
    OR conname LIKE 'item_drafts%'
  )
ORDER BY table_name, conname;
-- Expected: At least 5 constraints (status enums, total limits, length check)

-- 6. Indexes exist
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_item_bulk_uploads%'
    OR indexname LIKE 'idx_item_drafts%'
    OR indexname LIKE 'idx_items_bulk%'
    OR indexname LIKE 'idx_items_requested%'
  )
ORDER BY tablename, indexname;
-- Expected: At least 7 indexes

-- ============================================
-- ✅ If all queries return expected counts: SUCCESS!
-- ============================================
```

---

## Step 6: Test Trigger Behavior (Optional but Recommended)

### Test updated_at trigger:
```sql
-- Insert test draft
INSERT INTO public.item_drafts (seller_id, draft_data, photo_urls)
VALUES (auth.uid(), '{"title": "Test"}', '{}')
RETURNING id, created_at, updated_at;
-- Save the ID from above: <test_draft_id>

-- Wait 2 seconds, then update
SELECT pg_sleep(2);

UPDATE public.item_drafts
SET draft_data = '{"title": "Updated"}'
WHERE id = '<test_draft_id>'
RETURNING updated_at;
-- ✅ updated_at should be ~2 seconds after created_at

-- Cleanup
DELETE FROM public.item_drafts WHERE id = '<test_draft_id>';
```

### Test max-5 drafts enforcement:
```sql
-- Insert 7 drafts (trigger should keep only 5)
DO $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..7 LOOP
    INSERT INTO public.item_drafts (seller_id, draft_data, photo_urls)
    VALUES (auth.uid(), jsonb_build_object('test', i), '{}');
    PERFORM pg_sleep(0.1);
  END LOOP;
END $$;

-- Count (should be exactly 5)
SELECT COUNT(*) FROM public.item_drafts WHERE seller_id = auth.uid();
-- ✅ Expected: 5

-- Verify most recent kept (items 3-7 should exist, 1-2 deleted)
SELECT (draft_data->>'test')::int AS test_number
FROM public.item_drafts
WHERE seller_id = auth.uid()
ORDER BY updated_at ASC;
-- ✅ Expected: 3, 4, 5, 6, 7 (oldest 2 deleted)

-- Cleanup
DELETE FROM public.item_drafts WHERE seller_id = auth.uid();
```

---

## Troubleshooting

### Error: "relation does not exist"
- **Cause:** Previous migration not applied
- **Fix:** Apply migrations in order (1 → 2 → 3)

### Error: "column already exists"
- **Cause:** Migration already applied (this is OK if idempotent)
- **Fix:** Re-run should succeed silently due to `IF NOT EXISTS`

### Error: "foreign key constraint violation"
- **Cause:** `item_bulk_uploads` doesn't exist yet
- **Fix:** Apply migration 20260420000003 first

### Error: "user_roles table not found"
- **Cause:** Admin role system not set up
- **Fix:** This is OK for development; admin policy will work once user_roles exists

---

## Success Criteria

✅ **All migrations applied without errors**  
✅ **All verification queries return expected results**  
✅ **Triggers fire correctly (updated_at, max-5)**  
✅ **RLS policies active (seller owns, admin views)**  
✅ **Foreign keys work (ON DELETE SET NULL)**  

**Next:** Complete `LISTING-V3-001-MANUAL-TESTING-GUIDE.md` (15 test cases)

---

## Quick Copy-Paste: Verification Query

```sql
-- ONE QUERY TO CHECK EVERYTHING
SELECT
  'item_bulk_uploads table' AS check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='item_bulk_uploads') THEN '✅' ELSE '❌' END AS status
UNION ALL SELECT 'item_drafts table', CASE WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='item_drafts') THEN '✅' ELSE '❌' END
UNION ALL SELECT 'items.bulk_upload_id column', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='items' AND column_name='bulk_upload_id') THEN '✅' ELSE '❌' END
UNION ALL SELECT 'items.requested_category_name column', CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='items' AND column_name='requested_category_name') THEN '✅' ELSE '❌' END
UNION ALL SELECT 'update_item_drafts_updated_at trigger', CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.item_drafts'::regclass AND tgname='update_item_drafts_updated_at' AND tgisinternal=false) THEN '✅' ELSE '❌' END
UNION ALL SELECT 'enforce_max_drafts trigger', CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.item_drafts'::regclass AND tgname='enforce_max_drafts' AND tgisinternal=false) THEN '✅' ELSE '❌' END
UNION ALL SELECT 'RLS on item_bulk_uploads', CASE WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='item_bulk_uploads') THEN '✅' ELSE '❌' END
UNION ALL SELECT 'RLS on item_drafts', CASE WHEN (SELECT rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='item_drafts') THEN '✅' ELSE '❌' END;

-- Expected: All rows show ✅
```
