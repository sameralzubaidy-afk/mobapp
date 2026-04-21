# DISCOVERY-V3-001: Manual Testing Guide
## Filter Columns & Indexes Migration

**Module:** MODULE-05-DISCOVERY-V3-FILTERS  
**Task:** DISCOVERY-V3-001  
**Migration File:** `supabase/migrations/20260420000001_add_item_filter_columns.sql`  
**Test Duration:** 15-20 minutes  
**Environment:** Supabase Production Dashboard

---

## Prerequisites

✅ You have access to Supabase Dashboard (https://app.supabase.com)  
✅ You are on the correct project (kids_marketplace_app production)  
✅ You have backed up production database (via Supabase Dashboard → Database → Backups)  
✅ Migration file `20260420000001_add_item_filter_columns.sql` is ready

---

## ⚠️ IMPORTANT: Run Migration First

Before testing, you MUST apply the migration:

### Step 1: Apply Migration via Supabase Dashboard

1. Open Supabase Dashboard → Your Project → SQL Editor
2. Click **"New query"**
3. Copy the ENTIRE contents of `supabase/migrations/20260420000001_add_item_filter_columns.sql`
4. Paste into SQL Editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. ✅ Verify you see: **"Success. No rows returned"**
7. ⚠️ If you see errors, STOP and report the exact error message

---

## Test Cases

### TC-001: Verify All 4 Columns Exist

**Objective:** Confirm all filter columns were added to items table

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'items' 
  AND column_name IN ('age_group', 'gender', 'brand', 'color')
ORDER BY column_name;
```

**Expected Result:**
| column_name | data_type | is_nullable | column_default |
|-------------|-----------|-------------|----------------|
| age_group   | text      | YES         | NULL           |
| brand       | text      | YES         | NULL           |
| color       | ARRAY     | YES         | NULL           |
| gender      | text      | YES         | NULL           |

✅ **PASS:** All 4 rows returned with correct types and nullable=YES  
❌ **FAIL:** Missing columns, wrong types, or not nullable

---

### TC-002: Verify CHECK Constraints Exist

**Objective:** Confirm CHECK constraints are enforced

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
SELECT 
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'items'::regclass
  AND contype = 'c'
  AND conname LIKE '%age_group%' 
     OR conname LIKE '%gender%' 
     OR conname LIKE '%brand%'
ORDER BY conname;
```

**Expected Result:**
- At least 3 constraints returned
- age_group constraint contains: `'0-2'`, `'3-5'`, `'6-8'`, `'9-12'`, `'13+'`
- gender constraint contains: `'boy'`, `'girl'`, `'unisex'`
- brand constraint contains: `length(brand) <= 100`

✅ **PASS:** All constraints exist with correct definitions  
❌ **FAIL:** Missing constraints or wrong values

---

### TC-003: Verify All 6 Indexes Exist

**Objective:** Confirm all partial indexes were created

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'items' 
  AND (
    indexname = 'idx_items_age_group'
    OR indexname = 'idx_items_gender'
    OR indexname = 'idx_items_brand'
    OR indexname = 'idx_items_color'
    OR indexname = 'idx_items_price'
    OR indexname = 'idx_items_category_price'
  )
ORDER BY indexname;
```

**Expected Result:**
- Exactly **6 rows** returned
- All indexdef contain: `WHERE (status = 'available'::text)`
- `idx_items_color` indexdef contains: `USING gin`

✅ **PASS:** All 6 indexes exist with partial WHERE clause  
❌ **FAIL:** Missing indexes or incorrect definitions

---

### TC-004: Test age_group Constraint (Valid Value)

**Objective:** Verify valid age_group values are accepted

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
-- Create a test item with valid age_group
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status,
  age_group
) VALUES (
  (SELECT id FROM auth.users LIMIT 1), -- Use existing user
  'TEST: Valid Age Group',
  'Testing age_group=6-8',
  12.99,
  'draft',
  '6-8'
) RETURNING id, age_group;
```

2. If insert succeeds, clean up:
```sql
DELETE FROM items WHERE title = 'TEST: Valid Age Group';
```

**Expected Result:**
- Insert succeeds
- Returns the item with `age_group = '6-8'`

✅ **PASS:** Insert successful, age_group saved correctly  
❌ **FAIL:** Insert rejected or age_group not saved

---

### TC-005: Test age_group Constraint (Invalid Value)

**Objective:** Verify invalid age_group values are rejected

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
-- Attempt to insert item with invalid age_group
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status,
  age_group
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'TEST: Invalid Age Group',
  'Testing age_group=invalid',
  12.99,
  'draft',
  'invalid-age' -- NOT in CHECK constraint
);
```

**Expected Result:**
- Insert **FAILS** with error containing: `violates check constraint`
- Error message mentions `age_group`

✅ **PASS:** Insert rejected with check constraint error  
❌ **FAIL:** Insert succeeds (constraint not working)

---

### TC-006: Test gender Constraint (Valid Value)

**Objective:** Verify valid gender values are accepted

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status,
  gender
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'TEST: Valid Gender',
  'Testing gender=unisex',
  9.99,
  'draft',
  'unisex'
) RETURNING id, gender;

-- Cleanup
DELETE FROM items WHERE title = 'TEST: Valid Gender';
```

**Expected Result:**
- Insert succeeds with `gender = 'unisex'`

✅ **PASS:** Insert successful  
❌ **FAIL:** Insert rejected

---

### TC-007: Test gender Constraint (Invalid Value)

**Objective:** Verify invalid gender values are rejected

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status,
  gender
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'TEST: Invalid Gender',
  'Testing gender=invalid',
  9.99,
  'draft',
  'invalid-gender'
);
```

**Expected Result:**
- Insert **FAILS** with check constraint error on gender

✅ **PASS:** Insert rejected  
❌ **FAIL:** Insert succeeds

---

### TC-008: Test brand Length Constraint (Valid)

**Objective:** Verify brand values ≤100 chars are accepted

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status,
  brand
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'TEST: Valid Brand',
  'Testing brand with 100 chars',
  19.99,
  'draft',
  REPEAT('A', 100) -- Exactly 100 characters
) RETURNING id, LENGTH(brand) AS brand_length;

-- Cleanup
DELETE FROM items WHERE title = 'TEST: Valid Brand';
```

**Expected Result:**
- Insert succeeds
- Returns `brand_length = 100`

✅ **PASS:** Insert successful  
❌ **FAIL:** Insert rejected

---

### TC-009: Test brand Length Constraint (Invalid)

**Objective:** Verify brand values >100 chars are rejected

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status,
  brand
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'TEST: Invalid Brand',
  'Testing brand with 101 chars',
  19.99,
  'draft',
  REPEAT('A', 101) -- 101 characters (exceeds limit)
);
```

**Expected Result:**
- Insert **FAILS** with check constraint error on brand

✅ **PASS:** Insert rejected  
❌ **FAIL:** Insert succeeds

---

### TC-010: Test color Array (Valid)

**Objective:** Verify color arrays are accepted (no CHECK constraint)

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status,
  color
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'TEST: Valid Color Array',
  'Testing color array',
  14.99,
  'draft',
  ARRAY['blue', 'red', 'green']::text[]
) RETURNING id, color;

-- Cleanup
DELETE FROM items WHERE title = 'TEST: Valid Color Array';
```

**Expected Result:**
- Insert succeeds
- Returns item with `color = {blue,red,green}`

✅ **PASS:** Insert successful with array  
❌ **FAIL:** Insert rejected

---

### TC-011: Test Backward Compatibility (NULL Values)

**Objective:** Verify existing items without filter values remain valid

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
-- Insert item WITHOUT any filter values (all NULL)
INSERT INTO items (
  seller_id, 
  title, 
  description, 
  price, 
  status
) VALUES (
  (SELECT id FROM auth.users LIMIT 1),
  'TEST: No Filters',
  'Testing backward compatibility',
  7.99,
  'draft'
  -- Intentionally omit age_group, gender, brand, color
) RETURNING id, age_group, gender, brand, color;

-- Cleanup
DELETE FROM items WHERE title = 'TEST: No Filters';
```

**Expected Result:**
- Insert succeeds
- All filter columns return NULL

✅ **PASS:** Insert successful with NULLs  
❌ **FAIL:** Insert rejected (columns not nullable)

---

### TC-012: Verify Idempotency (Re-run Migration)

**Objective:** Confirm migration can be safely re-run

**Steps:**
1. In Supabase Dashboard → SQL Editor
2. Paste the ENTIRE migration file again
3. Click **"Run"**

**Expected Result:**
- No errors (or only benign "already exists" info messages)
- Schema unchanged

✅ **PASS:** Migration runs without errors  
❌ **FAIL:** Errors occur on re-run

---

### TC-013: Verify Column Comments Exist

**Objective:** Confirm all columns have documentation comments

**Steps:**
1. In Supabase Dashboard → SQL Editor, run:
```sql
SELECT 
  column_name,
  col_description('items'::regclass, ordinal_position) AS comment
FROM information_schema.columns
WHERE table_name = 'items'
  AND column_name IN ('age_group', 'gender', 'brand', 'color')
ORDER BY column_name;
```

**Expected Result:**
- 4 rows returned
- All comments are non-NULL and contain descriptions mentioning "filter" or "discovery"

✅ **PASS:** All comments exist and are descriptive  
❌ **FAIL:** Missing comments

---

## Test Summary Checklist

After completing all test cases, verify:

- [ ] TC-001: All 4 columns exist with correct types ✅
- [ ] TC-002: All 3 CHECK constraints exist ✅
- [ ] TC-003: All 6 indexes exist with partial WHERE ✅
- [ ] TC-004: Valid age_group accepted ✅
- [ ] TC-005: Invalid age_group rejected ✅
- [ ] TC-006: Valid gender accepted ✅
- [ ] TC-007: Invalid gender rejected ✅
- [ ] TC-008: Valid brand (≤100 chars) accepted ✅
- [ ] TC-009: Invalid brand (>100 chars) rejected ✅
- [ ] TC-010: Color array accepted ✅
- [ ] TC-011: NULL filter values accepted (backward compat) ✅
- [ ] TC-012: Migration is idempotent ✅
- [ ] TC-013: Column comments exist ✅

**Overall Status:**  
✅ All tests passed → Migration successful, ready for app integration  
❌ Any test failed → Review errors, fix migration, re-apply

---

## Rollback Instructions (If Needed)

If migration causes issues, run this rollback SQL:

```sql
-- WARNING: This will DROP the columns and indexes
-- Only run if you need to undo the migration

-- Drop indexes first
DROP INDEX IF EXISTS idx_items_age_group;
DROP INDEX IF EXISTS idx_items_gender;
DROP INDEX IF EXISTS idx_items_brand;
DROP INDEX IF EXISTS idx_items_color;
DROP INDEX IF EXISTS idx_items_price;
DROP INDEX IF EXISTS idx_items_category_price;

-- Drop columns (CASCADE will remove constraints)
ALTER TABLE items DROP COLUMN IF EXISTS age_group CASCADE;
ALTER TABLE items DROP COLUMN IF EXISTS gender CASCADE;
ALTER TABLE items DROP COLUMN IF EXISTS brand CASCADE;
ALTER TABLE items DROP COLUMN IF EXISTS color CASCADE;
```

---

## Next Steps

After all tests pass:

1. ✅ Mark DISCOVERY-V3-001 as complete
2. 📝 Document test results with timestamp and tester name
3. ➡️ Proceed to DISCOVERY-V3-002 (RPC rewrite)
4. 🚀 No app deployment needed yet (schema-only change)

---

## Notes

- **Performance:** Indexes are partial on `status='available'` to keep size small
- **Backward Compatibility:** All columns are nullable - existing items unaffected
- **No UI Changes:** This task is schema-only; UI updates come in DISCOVERY-V3-005+
- **Staging First:** Test on staging before production (if you have staging environment)
