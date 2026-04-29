# ADMIN-V3-001 Manual Testing Guide

**Task:** Schema Migrations — Category Columns, Suggestions, Trigger, RPC, Storage  
**Module:** MODULE-12-ADMIN-V3-CATEGORIES  
**Status:** Implementation Complete — Awaiting SQL Execution  
**Date:** April 27, 2026

---

## ⚠️ PREREQUISITE: Run SQL Migrations First

**IMPORTANT:** Before any testing, you MUST run the 5 migration files in Supabase SQL Editor in STRICT ORDER:

1. `20260420000006_add_category_management_columns.sql`
2. `20260420000007_create_category_suggestions.sql`
3. `20260420000008_category_item_count_trigger.sql`
4. `20260420000009_reorder_categories_rpc.sql`
5. `20260420000010_create_category_icons_storage_bucket.sql`

**How to run:**
1. Open Supabase Dashboard → Your Project → SQL Editor
2. Copy-paste each file's content into a new query tab
3. Execute in order (wait for success before next)
4. Verify no errors in output

---

## Test Environment

- **Supabase:** Production (staging not used per user preference)
- **Platforms:** iOS Simulator + Android Emulator
- **Test Data:** Existing categories + items from production

---

## Test Cases

### TC-001: Verify Category Management Columns Added

**Objective:** Confirm all 11 new columns exist on `categories` table

**Prerequisites:** Migration `20260420000006` executed successfully

**Steps:**
1. Open Supabase Dashboard → Table Editor → `categories` table
2. Click on any category row to view details

**Expected Results:**
- ✅ Column `description` (nullable TEXT)
- ✅ Column `icon_url` (nullable TEXT)
- ✅ Column `bonus_badge_icon_url` (nullable TEXT)
- ✅ Column `sp_earning_multiplier` (DECIMAL, default 1.10)
- ✅ Column `sp_spending_cap_percent` (INT, default 70)
- ✅ Column `sp_config_notes` (nullable TEXT)
- ✅ Column `sp_rate_change_notify` (BOOLEAN, default FALSE)
- ✅ Column `item_count` (INT, default 0)
- ✅ Existing columns preserved: `id`, `name`, `icon`, `display_order`, `is_active`, `created_at`

**SQL Verification:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'categories' 
  AND column_name IN (
    'description', 'icon_url', 'bonus_badge_icon_url', 
    'sp_earning_multiplier', 'sp_spending_cap_percent', 
    'sp_config_notes', 'sp_rate_change_notify', 'item_count'
  )
ORDER BY column_name;
```

**Pass Criteria:** All 8 new columns present with correct data types

---

### TC-002: Verify CHECK Constraints

**Objective:** Confirm SP rate bounds and length constraints are enforced

**Prerequisites:** Migration `20260420000006` executed

**Steps:**
1. In Supabase SQL Editor, try to insert invalid SP earning multiplier:
```sql
UPDATE categories 
SET sp_earning_multiplier = 2.0 
WHERE name = 'Toys';
```

2. Try invalid SP spending cap:
```sql
UPDATE categories 
SET sp_spending_cap_percent = 100 
WHERE name = 'Toys';
```

3. Try overly long description:
```sql
UPDATE categories 
SET description = REPEAT('a', 201) 
WHERE name = 'Toys';
```

**Expected Results:**
- ❌ Step 1: ERROR - `categories_sp_earning_multiplier_check` violation (value must be between 1.05 and 1.40)
- ❌ Step 2: ERROR - `categories_sp_spending_cap_percent_check` violation (value must be between 50 and 80)
- ❌ Step 3: ERROR - `categories_description_length_check` violation (max 200 chars)

**SQL Verification:**
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.categories'::regclass
  AND contype = 'c'
ORDER BY conname;
```

**Pass Criteria:** All 5 CHECK constraints exist and reject invalid data

---

### TC-003: Verify display_order Backfill

**Objective:** Confirm existing categories have sequential display_order

**Prerequisites:** Migration `20260420000006` executed

**Steps:**
1. Query categories table:
```sql
SELECT name, display_order 
FROM categories 
ORDER BY display_order;
```

**Expected Results:**
- ✅ All categories have `display_order > 0`
- ✅ Values are sequential (1, 2, 3, ...)
- ✅ No gaps in sequence
- ✅ Order matches existing category creation order

**Pass Criteria:** No category has `display_order = 0` or NULL

---

### TC-004: Verify Indexes Created

**Objective:** Confirm performance indexes exist

**Prerequisites:** Migration `20260420000006` executed

**Steps:**
1. Query pg_indexes:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'categories'
  AND indexname IN ('idx_categories_active', 'idx_categories_item_count', 'idx_categories_bonus')
ORDER BY indexname;
```

**Expected Results:**
- ✅ `idx_categories_active` exists (partial, WHERE is_active = TRUE)
- ✅ `idx_categories_item_count` exists (partial, WHERE item_count > 0)
- ✅ `idx_categories_bonus` exists (partial, WHERE sp_earning_multiplier > 1.10)

**Pass Criteria:** All 3 indexes present with correct predicates

---

### TC-005: Verify category_suggestions Table Created

**Objective:** Confirm category_suggestions table exists with correct schema

**Prerequisites:** Migration `20260420000007` executed

**Steps:**
1. In Supabase Dashboard → Table Editor, find `category_suggestions` table
2. View table structure

**Expected Results:**
- ✅ Table exists
- ✅ Columns: `id, suggested_name, seller_id, item_id, status, approved_by, merged_to_category_id, admin_note, created_at, reviewed_at`
- ✅ `UNIQUE` constraint on `item_id`
- ✅ `status` CHECK constraint allows only: 'pending', 'approved', 'rejected', 'merged'

**SQL Verification:**
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'category_suggestions'
ORDER BY ordinal_position;
```

**Pass Criteria:** All 10 columns present

---

### TC-006: Verify category_suggestions RLS Policies

**Objective:** Confirm sellers can view own suggestions, admins can manage all

**Prerequisites:** Migration `20260420000007` executed

**Steps:**
1. Query RLS policies:
```sql
SELECT tablename, policyname, cmd, permissive, roles
FROM pg_policies
WHERE tablename = 'category_suggestions'
ORDER BY policyname;
```

**Expected Results:**
- ✅ Policy "Admin can manage all category suggestions" (FOR ALL, checks `public.admin_has_role(auth.uid())`)
- ✅ Policy "Seller can view own category suggestions" (FOR SELECT, checks seller_id = auth.uid())

**Pass Criteria:** 2 policies exist with correct permissions

---

### TC-007: Verify category_suggestions Indexes

**Objective:** Confirm indexes for performance

**Prerequisites:** Migration `20260420000007` executed

**Steps:**
1. Query indexes:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'category_suggestions'
ORDER BY indexname;
```

**Expected Results:**
- ✅ `idx_category_suggestions_status` (partial, WHERE status = 'pending')
- ✅ `idx_category_suggestions_seller` (on seller_id, created_at DESC)
- ✅ `idx_category_suggestions_item_id` (on item_id)

**Pass Criteria:** All 3 indexes present

---

### TC-008: Verify Trigger Function Created

**Objective:** Confirm update_category_item_count() function exists

**Prerequisites:** Migration `20260420000008` executed

**Steps:**
1. Query pg_proc:
```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'update_category_item_count';
```

**Expected Results:**
- ✅ Function exists
- ✅ `prosecdef = true` (SECURITY DEFINER)

**Pass Criteria:** Function found with SECURITY DEFINER

---

### TC-009: Verify Trigger Attached to items Table

**Objective:** Confirm trigger fires on items table changes

**Prerequisites:** Migration `20260420000008` executed

**Steps:**
1. Query pg_trigger:
```sql
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.items'::regclass
  AND tgname = 'update_category_item_count_trigger';
```

**Expected Results:**
- ✅ Trigger `update_category_item_count_trigger` exists
- ✅ Attached to `public.items` table
- ✅ `tgenabled = 'O'` (trigger is enabled)

**Pass Criteria:** Trigger exists and is enabled

---

### TC-010: Verify item_count Backfill

**Objective:** Confirm existing categories have correct item counts

**Prerequisites:** Migration `20260420000008` executed

**Steps:**
1. Query categories with counts:
```sql
SELECT 
  c.name,
  c.item_count AS stored_count,
  (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id AND i.status = 'available') AS actual_count
FROM categories c
ORDER BY c.name;
```

**Expected Results:**
- ✅ `stored_count = actual_count` for every category
- ✅ Categories with no items have `item_count = 0`

**Pass Criteria:** All counts match (stored vs actual)

---

### TC-011: Test Trigger on INSERT

**Objective:** Verify trigger increments count when item added

**Prerequisites:** Migration `20260420000008` executed; at least 1 active user + node

**Steps:**
1. Get initial count for "Toys" category:
```sql
SELECT item_count FROM categories WHERE name = 'Toys';
```

2. Insert test item (replace UUIDs with actual values):
```sql
INSERT INTO items (title, description, price, seller_id, node_id, category_id, status)
VALUES (
  'Test Trigger Item',
  'Testing category count increment',
  10.00,
  '00000000-0000-0000-0000-000000000001',  -- Replace with real seller_id
  '00000000-0000-0000-0000-000000000002',  -- Replace with real node_id
  (SELECT id FROM categories WHERE name = 'Toys'),
  'available'
);
```

3. Check new count:
```sql
SELECT item_count FROM categories WHERE name = 'Toys';
```

4. Cleanup:
```sql
DELETE FROM items WHERE title = 'Test Trigger Item';
```

**Expected Results:**
- ✅ Step 3: Count increased by 1
- ✅ Step 4: Count returns to original value (trigger fires on DELETE too)

**Pass Criteria:** Count changes correctly on INSERT and DELETE

---

### TC-012: Test Trigger on UPDATE (status change)

**Objective:** Verify trigger adjusts count when item status changes

**Prerequisites:** At least 1 'available' item exists

**Steps:**
1. Get initial count for item's category:
```sql
SELECT c.name, c.item_count
FROM categories c
JOIN items i ON i.category_id = c.id
WHERE i.status = 'available'
LIMIT 1;
```

2. Update item status to 'sold':
```sql
UPDATE items
SET status = 'sold'
WHERE id = (SELECT id FROM items WHERE status = 'available' LIMIT 1)
RETURNING category_id;
```

3. Check count decreased:
```sql
SELECT item_count FROM categories WHERE id = '<category_id_from_step_2>';
```

4. Restore item:
```sql
WITH picked AS (
  SELECT id
  FROM items
  WHERE status = 'sold'
  ORDER BY updated_at DESC NULLS LAST, created_at DESC
  LIMIT 1
)
UPDATE items i
SET status = 'available'
FROM picked
WHERE i.id = picked.id;
```

**Expected Results:**
- ✅ Step 3: Count decreased by 1
- ✅ Step 4: Count restored to original

**Pass Criteria:** Count adjusts correctly on status change

---

### TC-013: Test Trigger on UPDATE (category_id change)

**Objective:** Verify trigger moves count between categories

**Prerequisites:** At least 1 'available' item exists; at least 2 categories exist

**Steps:**
1. Get initial counts:
```sql
SELECT name, item_count FROM categories WHERE name IN ('Toys', 'Books');
```

2. Move an item from Toys to Books:
```sql
WITH picked AS (
  SELECT i.id
  FROM items i
  WHERE i.category_id = (SELECT c.id FROM categories c WHERE c.name = 'Toys')
    AND i.status = 'available'
  ORDER BY i.created_at DESC
  LIMIT 1
)
UPDATE items i
SET category_id = (SELECT c.id FROM categories c WHERE c.name = 'Books')
FROM picked
WHERE i.id = picked.id;
```

3. Check updated counts:
```sql
SELECT name, item_count FROM categories WHERE name IN ('Toys', 'Books');
```

4. Restore item:
```sql
WITH picked AS (
  SELECT i.id
  FROM items i
  WHERE i.category_id = (SELECT c.id FROM categories c WHERE c.name = 'Books')
    AND i.status = 'available'
  ORDER BY i.updated_at DESC NULLS LAST, i.created_at DESC
  LIMIT 1
)
UPDATE items i
SET category_id = (SELECT c.id FROM categories c WHERE c.name = 'Toys')
FROM picked
WHERE i.id = picked.id;
```

**Expected Results:**
- ✅ Toys count decreased by 1
- ✅ Books count increased by 1
- ✅ Step 4: Counts restored

**Pass Criteria:** Counts move correctly between categories

---

### TC-014: Verify reorder_categories RPC Created

**Objective:** Confirm RPC function exists

**Prerequisites:** Migration `20260420000009` executed

**Steps:**
1. Query pg_proc:
```sql
SELECT proname, prosecdef, pg_get_function_arguments(oid) AS arguments
FROM pg_proc
WHERE proname = 'reorder_categories';
```

**Expected Results:**
- ✅ Function `reorder_categories` exists
- ✅ `prosecdef = true` (SECURITY DEFINER)
- ✅ Argument: `p_category_orders JSONB`

**Pass Criteria:** RPC exists with correct signature

---

### TC-015: Test reorder_categories RPC (Admin)

**Objective:** Verify admin can reorder categories

**Prerequisites:** Admin user exists and `SELECT public.admin_has_role(auth.uid());` returns `true`

**Steps:**
1. Get current order:
```sql
SELECT id, name, display_order FROM categories ORDER BY display_order;
```

2. Call RPC as admin (switch to admin user context first):
```sql
SELECT reorder_categories(
  jsonb_build_array(
    jsonb_build_object('id', '<category-1-id>', 'display_order', 99),
    jsonb_build_object('id', '<category-2-id>', 'display_order', 1)
  )
);
```

3. Verify new order:
```sql
SELECT id, name, display_order FROM categories ORDER BY display_order;
```

4. Restore original order (use RPC again or direct UPDATE)

**Expected Results:**
- ✅ Step 2: Success (no error)
- ✅ Step 3: display_order values match RPC input

**Pass Criteria:** Admin can reorder successfully

---

### TC-016: Test reorder_categories RPC (Non-Admin)

**Objective:** Verify non-admin users are rejected

**Prerequisites:** Non-admin user exists

**Steps:**
1. Switch to non-admin user context in Supabase Dashboard
2. Try calling RPC:
```sql
SELECT reorder_categories('[]'::JSONB);
```

**Expected Results:**
- ❌ ERROR: "Unauthorized: Admin role required"

**Pass Criteria:** Non-admin users cannot reorder

---

### TC-017: Test reorder_categories with Invalid Input

**Objective:** Verify validation rejects malformed input

**Prerequisites:** Migration `20260420000009` executed

**Steps:**
1. Try calling with non-array input:
```sql
SELECT reorder_categories('{"not": "an array"}'::JSONB);
```

**Expected Results:**
- ❌ ERROR: "Invalid input: category_orders must be a JSONB array"

**Pass Criteria:** Invalid input rejected with clear error message

---

### TC-018: Verify category-icons Storage Bucket Created

**Objective:** Confirm storage bucket exists

**Prerequisites:** Migration `20260420000010` executed

**Steps:**
1. In Supabase Dashboard → Storage, check for `category-icons` bucket
2. Or query:
```sql
SELECT id, name, public FROM storage.buckets WHERE id = 'category-icons';
```

**Expected Results:**
- ✅ Bucket `category-icons` exists
- ✅ `public = true` (publicly readable)

**Pass Criteria:** Bucket exists and is public

---

### TC-019: Verify category-icons Storage RLS Policies

**Objective:** Confirm public can read, admins can write

**Prerequisites:** Migration `20260420000010` executed

**Steps:**
1. Query storage policies:
```sql
SELECT policyname, cmd, permissive, roles
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%category icons%'
ORDER BY policyname;
```

**Expected Results:**
- ✅ "Public can view category icons" (FOR SELECT, TO public)
- ✅ "Admins can insert category icons" (FOR INSERT, checks `public.admin_has_role(auth.uid())`)
- ✅ "Admins can update category icons" (FOR UPDATE, checks `public.admin_has_role(auth.uid())`)
- ✅ "Admins can delete category icons" (FOR DELETE, checks `public.admin_has_role(auth.uid())`)

**Pass Criteria:** 4 policies exist

---

### TC-020: End-to-End Migration Idempotency Test

**Objective:** Verify migrations can be re-run safely

**Prerequisites:** All migrations executed once

**Steps:**
1. Re-run all 5 migrations in order (copy-paste into SQL Editor again)

**Expected Results:**
- ✅ No errors (all `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` clauses work)
- ✅ No duplicate columns
- ✅ No duplicate constraints
- ✅ No duplicate indexes
- ✅ No duplicate triggers
- ✅ No duplicate storage bucket

**Pass Criteria:** All migrations complete successfully without errors

---

## Post-Testing Checklist

After all test cases pass:

- [ ] All 5 migration files executed in production Supabase
- [ ] All 20 test cases passed
- [ ] No schema errors in Supabase Dashboard
- [ ] item_count values accurate for all categories
- [ ] Trigger responds to INSERT/UPDATE/DELETE on items
- [ ] RPC rejects non-admin users
- [ ] Storage bucket visible in Supabase Storage UI

---

## Known Issues / Limitations

1. **Manual bucket configuration required:** File size limits (500 KB) and allowed MIME types (PNG, SVG) must be set manually in Supabase Dashboard under Storage → category-icons → Settings.

2. **No rollback migration provided:** If schema needs to be reverted, manual DROP statements required (not recommended for production).

3. **Trigger performance:** For bulk inserts (>1000 items), trigger may slow down transaction. Consider disabling temporarily during bulk data loads.

---

## Next Steps

After verification:

1. Proceed to **ADMIN-V3-002** (Types & Error Classes)
2. Implement backend services (**ADMIN-V3-003**)
3. Build admin UI components (**ADMIN-V3-004**, **ADMIN-V3-005**)

---

## Test Summary

| Category | Total | Passed | Failed | Blocked |
|----------|-------|--------|--------|---------|
| Schema | 4 | - | - | - |
| Constraints | 2 | - | - | - |
| Table Structure | 2 | - | - | - |
| RLS Policies | 2 | - | - | - |
| Triggers | 5 | - | - | - |
| RPC Functions | 4 | - | - | - |
| Storage | 2 | - | - | - |
| **TOTAL** | **20** | **-** | **-** | **-** |

**Test Status:** ⏳ PENDING SQL EXECUTION

---

**Tester:** _____________  
**Date:** _____________  
**Build/Version:** ADMIN-V3-001  
**Notes:** _____________
