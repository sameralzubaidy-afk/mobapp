# AUTH-V3-001 Manual Testing Guide

**Task:** AUTH-V3-001 — Schema Migrations (Linked Providers View, Phone Verification Columns, Link RPC, OTP Table)
**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN.md  
**Created:** April 30, 2026  
**Platform:** iOS & Android Simulators  

---

## 🎯 Prerequisites

Before testing, you MUST:

1. **Apply SQL migrations in Supabase Production** using the deployment script:
   - Run: `AUTH-V3-001-SQL-DEPLOYMENT.sql` in Supabase SQL Editor
   
2. **Verify environment setup:**
   - Supabase project is accessible
   - You have admin/service_role access to run verification queries

---

## 📋 Test Cases

### **TC-001: Verify user_linked_providers View Creation**

**Objective:** Confirm the view exists and is accessible to authenticated users.

**Steps:**
1. Open Supabase SQL Editor
2. Run verification query:
   ```sql
   SELECT table_name, table_type
   FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'user_linked_providers';
   ```

**Expected Result:**
- ✅ Returns 1 row with `table_name = 'user_linked_providers'` and `table_type = 'VIEW'`

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-002: Verify View Grants for Authenticated Role**

**Objective:** Confirm authenticated users can SELECT from the view.

**Steps:**
1. In Supabase SQL Editor, run:
   ```sql
   SELECT table_name, grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_name = 'user_linked_providers' AND grantee = 'authenticated';
   ```

**Expected Result:**
- ✅ Returns at least 1 row with `privilege_type = 'SELECT'`

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-003: Verify View Columns**

**Objective:** Confirm all required columns are present in the view.

**Steps:**
1. Run:
   ```sql
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'user_linked_providers'
   ORDER BY ordinal_position;
   ```

**Expected Result:**
- ✅ Returns columns: `user_id`, `provider`, `provider_email`, `provider_name`, `provider_avatar`, `last_sign_in_at`, `created_at`

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-004: Verify phone_verification_method Column**

**Objective:** Confirm `phone_verification_method` column exists in profiles table with CHECK constraint.

**Steps:**
1. Run:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'profiles'
     AND column_name = 'phone_verification_method';
   ```

**Expected Result:**
- ✅ Returns 1 row with `data_type = 'text'` and `is_nullable = 'YES'`

**Actual Result:** _____________________________

2. Verify CHECK constraint:
   ```sql
   SELECT conname, pg_get_constraintdef(oid) AS definition
   FROM pg_constraint
   WHERE conrelid = 'public.profiles'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%phone_verification_method%';
   ```

**Expected Result:**
- ✅ Returns constraint containing `IN ('sms', 'social_auto', 'manual')`

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-005: Verify Partial Index for Unverified Phones**

**Objective:** Confirm partial index exists for fast lookup of unverified users.

**Steps:**
1. Run:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'profiles'
     AND indexname = 'idx_profiles_phone_verified';
   ```

**Expected Result:**
- ✅ Returns 1 row with `indexdef` containing `WHERE (phone_verified_at IS NULL)`

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-006: Verify link_social_account RPC Exists**

**Objective:** Confirm the RPC function is created with SECURITY DEFINER.

**Steps:**
1. Run:
   ```sql
   SELECT p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) AS args
   FROM pg_proc p
   JOIN pg_namespace n ON p.pronamespace = n.oid
   WHERE n.nspname = 'public' AND p.proname = 'link_social_account';
   ```

**Expected Result:**
- ✅ Returns 1 row with `proname = 'link_social_account'`, `prosecdef = true`, and args showing 4 TEXT/JSONB parameters

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-007: Verify phone_verification_codes Table Schema**

**Objective:** Confirm V3 table structure with hashed codes.

**Steps:**
1. Run:
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'phone_verification_codes'
   ORDER BY ordinal_position;
   ```

**Expected Result:**
- ✅ Returns columns: `id`, `user_id`, `phone`, `code_hash`, `attempts`, `created_at`, `expires_at`
- ✅ `code_hash` is TEXT (not `code`)
- ✅ `attempts` has default 0

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-008: Verify V3 Indexes on phone_verification_codes**

**Objective:** Confirm rate-limit indexes exist.

**Steps:**
1. Run:
   ```sql
   SELECT indexname, indexdef
   FROM pg_indexes
   WHERE tablename = 'phone_verification_codes'
     AND indexname IN ('idx_phone_verification_codes_user_expires', 'idx_phone_verification_codes_phone_created')
   ORDER BY indexname;
   ```

**Expected Result:**
- ✅ Returns 2 rows:
  - `idx_phone_verification_codes_user_expires` on `(user_id, expires_at)`
  - `idx_phone_verification_codes_phone_created` on `(phone, created_at)`

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-009: Verify RLS Enabled on phone_verification_codes**

**Objective:** Confirm Row Level Security is enabled.

**Steps:**
1. Run:
   ```sql
   SELECT relname, relrowsecurity
   FROM pg_class
   WHERE relname = 'phone_verification_codes';
   ```

**Expected Result:**
- ✅ Returns 1 row with `relrowsecurity = t` (true)

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-010: Verify RLS Policies on phone_verification_codes**

**Objective:** Confirm 4 policies exist (SELECT/INSERT/UPDATE/DELETE).

**Steps:**
1. Run:
   ```sql
   SELECT policyname, cmd, roles
   FROM pg_policies
   WHERE tablename = 'phone_verification_codes'
   ORDER BY policyname;
   ```

**Expected Result:**
- ✅ Returns 4 rows:
  - Policy for SELECT (authenticated)
  - Policy for INSERT (service_role)
  - Policy for UPDATE (service_role)
  - Policy for DELETE (service_role)

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-011: Test link_social_account Email Mismatch Guard** ⚠️

**Objective:** Confirm RPC throws EmailMismatchError when emails don't match.

**Prerequisites:** You must be authenticated as a user with a known email.

**Steps:**
1. Sign in to your app as a test user (or use Supabase Auth to get a JWT)
2. Note your user's email from `auth.users` table
3. In Supabase SQL Editor, run (replace with test email different from yours):
   ```sql
   SELECT public.link_social_account(
     'google',
     'test123',
     'wrong-email@example.com',
     '{}'::jsonb
   );
   ```

**Expected Result:**
- ✅ Query fails with ERROR containing `EmailMismatchError`
- ✅ Error message shows both your actual email and the mismatched provider email

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

### **TC-012: Verify Audit Log Writes on Successful Link** ⚠️

**Objective:** Confirm audit log entry is created when link_social_account succeeds.

**Prerequisites:** 
- You must be authenticated
- Your email must match the provider email you're testing with

**Steps:**
1. Run link_social_account with MATCHING email:
   ```sql
   -- Replace 'your-actual-email@example.com' with your auth.users.email
   SELECT public.link_social_account(
     'google',
     'google-user-123',
     'your-actual-email@example.com',
     '{"picture": "https://example.com/avatar.jpg"}'::jsonb
   );
   ```

2. Verify audit log was written:
   ```sql
   SELECT actor_id, action, entity_type, details->>'provider' AS provider, created_at
   FROM public.admin_audit_logs
   WHERE action = 'link_social_account'
   ORDER BY created_at DESC
   LIMIT 3;
   ```

**Expected Result:**
- ✅ First query succeeds (no error)
- ✅ Second query returns at least 1 row with `action = 'link_social_account'`
- ✅ `details` JSONB contains provider name and email

**Actual Result:** _____________________________

**Status:** ☐ PASS ☐ FAIL

---

## 📊 Test Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| TC-001 | ☐ | View creation |
| TC-002 | ☐ | View grants |
| TC-003 | ☐ | View columns |
| TC-004 | ☐ | phone_verification_method column |
| TC-005 | ☐ | Partial index |
| TC-006 | ☐ | link_social_account RPC |
| TC-007 | ☐ | phone_verification_codes schema |
| TC-008 | ☐ | V3 indexes |
| TC-009 | ☐ | RLS enabled |
| TC-010 | ☐ | RLS policies |
| TC-011 | ☐ | Email mismatch guard |
| TC-012 | ☐ | Audit log writes |

**Total:** _____ / 12 PASSED

---

## ⚠️ Known Limitations

1. **No Mobile UI Testing Yet:** AUTH-V3-001 is schema-only. Mobile UI testing will come in AUTH-V3-007 and AUTH-V3-008.

2. **OAuth Provider Enablement:** This task does NOT enable OAuth providers in Supabase dashboard. That's covered in AUTH-V3-003 prerequisites.

3. **Manual Email Test Required:** TC-011 and TC-012 require you to be authenticated, so they must be run with a valid session JWT or via Supabase dashboard with your user context.

---

## 🔄 Rollback Procedure

If you need to rollback these migrations:

```sql
-- Rollback in reverse order

-- 1. Drop phone_verification_codes table (V3 version)
DROP TABLE IF EXISTS public.phone_verification_codes CASCADE;

-- 2. Drop link_social_account RPC
DROP FUNCTION IF EXISTS public.link_social_account(TEXT, TEXT, TEXT, JSONB) CASCADE;

-- 3. Drop phone_verification_method column and index
DROP INDEX IF EXISTS public.idx_profiles_phone_verified;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_verification_method;

-- 4. Drop user_linked_providers view
DROP VIEW IF EXISTS public.user_linked_providers CASCADE;
```

**Note:** After rollback, you'll need to restore the old `phone_verification_codes` table from migration `20241214000002_phone_verification_codes.sql` if needed.

---

## ✅ Sign-off

**Tester:** _____________________  
**Date:** _____________________  
**Result:** ☐ ALL PASS — Ready for AUTH-V3-002 ☐ ISSUES FOUND (see notes)
