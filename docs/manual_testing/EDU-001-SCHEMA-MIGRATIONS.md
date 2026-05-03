# Manual Testing Guide: TASK EDU-001 - Education Schema Migrations

**Module:** MODULE-18 TRADING EDUCATION V1  
**Task:** EDU-001 (Schema Migrations — Sections, Examples, Analytics + Seed + Publish RPCs)  
**Test Environment:** Supabase Production (SQL Editor)  
**Test Date:** _____________  
**Tester:** _____________

---

## ⚠️ PRE-REQUISITES

Before running these tests:

1. **Backup database** (recommended before any schema changes)
2. **Admin access** to Supabase SQL Editor (production)
3. **Admin identity** is recognized by at least one supported source (`admin_has_role`, `is_admin`, `user_roles`, `role_based_access_control`, `profiles.role`, or `auth.users.raw_user_meta_data.is_admin=true`)
4. **Tables exist**: `profiles`, `categories` (from prior modules)

---

## 📋 TEST EXECUTION ORDER

Run SQL migrations in this exact order in Supabase SQL Editor:

### Step 1: Apply Migration 000018 (education_sections)
1. Open Supabase SQL Editor
2. Copy-paste content from: `supabase/migrations/20260420000018_create_education_sections.sql`
3. Execute
4. ✅ Expected: "Success. No rows returned"

### Step 2: Apply Migration 000019 (education_examples)
1. Copy-paste content from: `supabase/migrations/20260420000019_create_education_examples.sql`
2. Execute
3. ✅ Expected: "Success. No rows returned"

### Step 3: Apply Migration 000020 (education_analytics + seed)
1. Copy-paste content from: `supabase/migrations/20260420000020_create_education_analytics_and_seed.sql`
2. Execute
3. ✅ Expected: "Success. No rows returned" (seed data inserted silently)

### Step 4: Apply Migration 000021 (publish RPCs)
1. Copy-paste content from: `supabase/migrations/20260420000021_education_publish_rpcs.sql`
2. Execute
3. ✅ Expected: "Success. No rows returned"

---

## 🧪 TEST CASES

### TC-EDU-001-01: Verify Tables Created

**Objective:** Confirm all 3 new tables exist

**SQL Query:**
```sql
SELECT 
  to_regclass('public.education_sections') IS NOT NULL AS sections_exists,
  to_regclass('public.education_examples') IS NOT NULL AS examples_exists,
  to_regclass('public.education_analytics') IS NOT NULL AS analytics_exists;
```

**Expected Result:**
| sections_exists | examples_exists | analytics_exists |
|-----------------|-----------------|------------------|
| true            | true            | true             |

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-02: Verify RLS Enabled

**Objective:** Confirm RLS is enabled on all 3 tables

**SQL Query:**
```sql
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('education_sections', 'education_examples', 'education_analytics')
ORDER BY relname;
```

**Expected Result:**
| relname               | relrowsecurity |
|-----------------------|----------------|
| education_analytics   | t              |
| education_examples    | t              |
| education_sections    | t              |

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-03: Verify Partial Unique Index

**Objective:** Confirm partial unique index on education_sections

**SQL Query:**
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'education_sections'
  AND indexname = 'uq_education_sections_one_published_per_type';
```

**Expected Result:**
- 1 row returned
- `indexdef` contains `WHERE (is_published = true)`

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-04: Verify Profiles Columns Added

**Objective:** Confirm 4 new columns added to profiles table

**SQL Query:**
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN (
    'onboarding_completed_at',
    'onboarding_skipped_at',
    'education_prompts_seen',
    'education_prompts_suppressed_at'
  )
ORDER BY column_name;
```

**Expected Result:**
| column_name                      | data_type                   | column_default    |
|----------------------------------|-----------------------------|-------------------|
| education_prompts_seen           | jsonb                       | '[]'::jsonb       |
| education_prompts_suppressed_at  | timestamp with time zone    | NULL              |
| onboarding_completed_at          | timestamp with time zone    | NULL              |
| onboarding_skipped_at            | timestamp with time zone    | NULL              |

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-05: Verify Seed Sections

**Objective:** Confirm 4 published sections were seeded

**SQL Query:**
```sql
SELECT section_type, is_published, title
FROM public.education_sections
WHERE is_published = true
ORDER BY display_order;
```

**Expected Result:**
| section_type | is_published | title                              |
|--------------|--------------|-----------------------------------|
| sp_definition| true         | What are Swap Points?             |
| sp_earning   | true         | How do I earn Swap Points?        |
| sp_spending  | true         | How do I spend Swap Points?       |
| safety       | true         | Safety & Community Guidelines     |

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-06: Verify Seed Examples

**Objective:** Confirm 3 draft examples were seeded

**SQL Query:**
```sql
SELECT item_name, item_price, is_published, category_id
FROM public.education_examples
ORDER BY display_order;
```

**Expected Result:**
| item_name            | item_price | is_published | category_id |
|----------------------|------------|--------------|-------------|
| LEGO Star Wars Set   | 20.00      | false        | NULL        |
| Kids Book Collection | 10.00      | false        | NULL        |
| Toy Race Car         | 15.00      | false        | NULL        |

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-07: Verify Publish RPCs Exist

**Objective:** Confirm publish_section and unpublish_section RPCs are SECURITY DEFINER

**SQL Query:**
```sql
SELECT proname, prosecdef, pronargs
FROM pg_proc
WHERE proname IN ('publish_section', 'unpublish_section')
  AND pronamespace = 'public'::regnamespace;
```

**Expected Result:**
| proname           | prosecdef | pronargs |
|-------------------|-----------|----------|
| publish_section   | true      | 1        |
| unpublish_section | true      | 1        |

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-08: Test Publish Section (Admin)

**Objective:** Test publish_section RPC as admin user

**Pre-requisite:** You must be authenticated as an admin user

**Steps:**
1. Get a draft section ID:
   ```sql
   SELECT id, section_type, is_published 
   FROM public.education_sections 
   WHERE is_published = false 
   LIMIT 1;
   ```

2. If no draft sections, create one:
   ```sql
   INSERT INTO public.education_sections (
     title, body, section_type, is_published
   ) VALUES (
     'Test Section', 
     'This is a test section for publish RPC validation', 
     'general', 
     false
   ) RETURNING id;
   ```

3. Call publish_section RPC:
   ```sql
   SELECT public.publish_section('<insert-id-from-above>');
   ```

**Expected Result:**
- ✅ No error
- Section `is_published = true`
- `published_at` and `published_by` are set

**Verification Query:**
```sql
SELECT id, section_type, is_published, published_at, published_by
FROM public.education_sections
WHERE id = '<insert-id-from-above>';
```

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-09: Test Partial Unique Index Enforcement

**Objective:** Verify only one published row per section_type

**Pre-requisite:** TC-EDU-001-08 passed (you published a 'general' section)

**Steps:**
1. Create another 'general' section:
   ```sql
   INSERT INTO public.education_sections (
     title, body, section_type, is_published
   ) VALUES (
     'Another Test Section', 
     'This is another test section', 
     'general', 
     false
   ) RETURNING id;
   ```

2. Publish the new section:
   ```sql
   SELECT public.publish_section('<new-section-id>');
   ```

3. Verify ONLY the new section is published:
   ```sql
   SELECT id, section_type, is_published, title
   FROM public.education_sections
   WHERE section_type = 'general'
   ORDER BY is_published DESC;
   ```

**Expected Result:**
- ✅ Only 1 row with `is_published = true`
- The previous 'general' section is now `is_published = false`

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-10: Test Unpublish Section (Admin)

**Objective:** Test unpublish_section RPC as admin user

**Steps:**
1. Get a published section ID:
   ```sql
   SELECT id, section_type 
   FROM public.education_sections 
   WHERE is_published = true 
   LIMIT 1;
   ```

2. Call unpublish_section RPC:
   ```sql
   SELECT public.unpublish_section('<insert-id-from-above>');
   ```

**Expected Result:**
- ✅ No error
- Section `is_published = false`
- `published_at` and `published_by` are NULL

**Verification Query:**
```sql
SELECT id, section_type, is_published, published_at, published_by
FROM public.education_sections
WHERE id = '<insert-id-from-above>';
```

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-11: Test Analytics INSERT (Authenticated User)

**Objective:** Verify authenticated users can insert analytics events

**Pre-requisite:** Authenticated as a regular (non-admin) user

**SQL Query:**
```sql
INSERT INTO public.education_analytics (
  user_id, 
  event_type, 
  event_data
) VALUES (
  auth.uid(), 
  'onboarding_start', 
  '{"screen": "welcome"}'::jsonb
) RETURNING id, event_type, created_at;
```

**Expected Result:**
- ✅ 1 row inserted
- Returns `id`, `event_type='onboarding_start'`, `created_at`

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-12: Test Analytics UPDATE Blocked

**Objective:** Verify UPDATE is blocked by RLS (no policy grants it)

**Pre-requisite:** Authenticated as a regular (non-admin) user

**SQL Query:**
```sql
UPDATE public.education_analytics 
SET event_type = 'test_update' 
WHERE user_id = auth.uid();
```

**Expected Result:**
- ✅ 0 rows updated (silently blocked by RLS — no error, just no effect)

**Verification:**
```sql
SELECT COUNT(*) FROM public.education_analytics WHERE event_type = 'test_update';
-- Expected: 0
```

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-13: Test Analytics DELETE Blocked

**Objective:** Verify DELETE is blocked by RLS (no policy grants it)

**Pre-requisite:** Authenticated as a regular (non-admin) user

**SQL Query:**
```sql
DELETE FROM public.education_analytics 
WHERE user_id = auth.uid();
```

**Expected Result:**
- ✅ 0 rows deleted (silently blocked by RLS — no error, just no effect)

**Verification:**
```sql
SELECT COUNT(*) FROM public.education_analytics WHERE user_id = auth.uid();
-- Expected: At least the row from TC-EDU-001-11
```

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

### TC-EDU-001-14: Test Non-Admin Publish (Negative Test)

**Objective:** Verify non-admin users CANNOT publish sections

**Pre-requisite:** Authenticated as a regular (non-admin) user

**Steps:**
1. Get any section ID:
   ```sql
   SELECT id FROM public.education_sections LIMIT 1;
   ```

2. Attempt to publish as non-admin:
   ```sql
   SELECT public.publish_section('<section-id>');
   ```

**Expected Result:**
- ❌ ERROR: `UnauthorizedError: Only admins can publish sections`

**Status:** ☐ PASS ☐ FAIL  
**Notes:** ______________________________________

---

## 📊 SUMMARY

Total Test Cases: 14  
Passed: ____  
Failed: ____  
Pass Rate: ____%

---

## ✅ SIGN-OFF

- [ ] All migrations applied successfully
- [ ] All tables created with correct schema
- [ ] RLS enabled and policies verified
- [ ] Seed data present (4 sections + 3 examples)
- [ ] Publish/unpublish RPCs functional
- [ ] Admin authorization enforced
- [ ] Analytics INSERT-only verified
- [ ] Partial unique index working

**Tester Signature:** _____________________  
**Date:** _____________________

---

## 🚨 ROLLBACK PROCEDURE (if needed)

If testing fails and you need to rollback:

```sql
-- Rollback in reverse order
DROP FUNCTION IF EXISTS public.publish_section(UUID);
DROP FUNCTION IF EXISTS public.unpublish_section(UUID);

ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS onboarding_skipped_at,
  DROP COLUMN IF EXISTS education_prompts_seen,
  DROP COLUMN IF EXISTS education_prompts_suppressed_at;

DROP TABLE IF EXISTS public.education_analytics CASCADE;
DROP TABLE IF EXISTS public.education_examples CASCADE;
DROP TABLE IF EXISTS public.education_sections CASCADE;
DROP FUNCTION IF EXISTS public.update_education_sections_updated_at();
```

⚠️ **WARNING:** Rollback will delete all seeded content and analytics data.
