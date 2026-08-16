# AUTH-V3-001 Quick Start Guide

**Task:** AUTH-V3-001 — Schema Migrations  
**Status:** ✅ Implementation Complete — Ready for Deployment  
**Date:** April 30, 2026  

---

## 🚀 **Step 1: Deploy to Supabase Production**

1. **Open Supabase Dashboard:**
   - Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   - Navigate to **SQL Editor**

2. **Run the deployment script:**
   - Open file: `AUTH-V3-001-SQL-DEPLOYMENT.sql`
   - Copy entire contents
   - Paste into Supabase SQL Editor
   - Click **RUN**

3. **Verify success:**
   - All checkpoint queries should return ✅ status
   - Final summary should show 6/6 objects marked as "✅ EXISTS"

---

## ✅ **Step 2: Run Manual Tests**

Follow `AUTH-V3-001-MANUAL-TESTING-GUIDE.md`:

### **Quick Verification Queries** (run in Supabase SQL Editor):

```sql
-- 1. Verify view exists
SELECT COUNT(*) AS expected_1
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'user_linked_providers';

-- 2. Verify column exists
SELECT COUNT(*) AS expected_1
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'phone_verification_method';

-- 3. Verify index exists
SELECT COUNT(*) AS expected_1
FROM pg_indexes
WHERE tablename = 'profiles' AND indexname = 'idx_profiles_phone_verified';

-- 4. Verify RPC exists
SELECT proname, prosecdef AS expected_true
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'link_social_account';

-- 5. Verify V3 table structure
SELECT COUNT(*) AS expected_7_columns
FROM information_schema.columns
WHERE table_name = 'phone_verification_codes';

-- 6. Verify V3 indexes
SELECT COUNT(*) AS expected_2_indexes
FROM pg_indexes
WHERE tablename = 'phone_verification_codes'
  AND indexname IN ('idx_phone_verification_codes_user_expires', 'idx_phone_verification_codes_phone_created');
```

**Expected Results:** All queries return the expected count.

---

## 📋 **Step 3: Complete Full Manual Test Suite**

Open `AUTH-V3-001-MANUAL-TESTING-GUIDE.md` and complete all 12 test cases:

- **TC-001 to TC-010:** Schema verification (run as is)
- **TC-011:** Email mismatch guard (requires authenticated session)
- **TC-012:** Audit log writes (requires authenticated session)

**Target:** 12/12 PASS ✅

---

## 🧪 **Step 4: (Optional) Run PgTAP Unit Tests**

If you have PgTAP installed:

```bash
# Install PgTAP (if not already installed)
# macOS: brew install pgtap
# Linux: apt-get install postgresql-pgtap

# Run tests
psql -U postgres -h db.YOUR_PROJECT_ID.supabase.co -d postgres \
  -f supabase/tests/auth_v3_001_migrations.test.sql
```

**Expected:** 35/35 tests PASS

---

## 📂 **Files Reference**

| File | Purpose |
|------|---------|
| `AUTH-V3-001-SQL-DEPLOYMENT.sql` | Single-file deployment script (run this first) |
| `AUTH-V3-001-MANUAL-TESTING-GUIDE.md` | 12 test cases for verification |
| `AUTH-V3-001-IMPLEMENTATION-SUMMARY.md` | Full implementation details |
| `supabase/tests/auth_v3_001_migrations.test.sql` | PgTAP unit tests (35 cases) |
| `supabase/migrations/20260420000011_*.sql` | Migration 1: user_linked_providers view |
| `supabase/migrations/20260420000012_*.sql` | Migration 2: phone_verification_method column |
| `supabase/migrations/20260420000013_*.sql` | Migration 3: link_social_account RPC |
| `supabase/migrations/20260420000014_*.sql` | Migration 4: phone_verification_codes V3 |

---

## ⚠️ **Important Notes**

1. **Breaking Change:** `phone_verification_codes` table is **dropped and recreated**. All existing OTP codes will be lost (this is safe since OTPs expire in 5 minutes).

2. **No UI Changes:** AUTH-V3-001 is schema-only. No mobile app changes are needed yet.

3. **No Navigation Updates:** Since there's no UI, navigation files are NOT modified.

4. **Next Task:** After successful deployment → proceed to **AUTH-V3-002** (Shared Types & Error Classes).

---

## 🔄 **Rollback (If Needed)**

If you need to rollback:

```sql
-- Rollback in reverse order
DROP TABLE IF EXISTS public.phone_verification_codes CASCADE;
DROP FUNCTION IF EXISTS public.link_social_account(TEXT, TEXT, TEXT, JSONB) CASCADE;
DROP INDEX IF EXISTS public.idx_profiles_phone_verified;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_verification_method;
DROP VIEW IF EXISTS public.user_linked_providers CASCADE;
```

Then restore old `phone_verification_codes` table from `20241214000002_phone_verification_codes.sql` if needed.

---

## ✅ **Success Criteria**

- ✅ SQL deployment completes without errors
- ✅ All 6 objects exist in final verification summary
- ✅ Manual tests: 12/12 PASS
- ✅ PgTAP tests: 35/35 PASS (optional)
- ✅ `docs/flow-registry.md` updated with AUTH-V3-001 entry

---

## 📞 **Troubleshooting**

### **Error: "relation admin_audit_logs does not exist"**

**Cause:** The `link_social_account` RPC expects `admin_audit_logs` table.

**Fix:** Verify the table exists:
```sql
SELECT to_regclass('public.admin_audit_logs');
```

If NULL, create it or use `admin_audit_log` (singular) if that exists instead.

---

### **Error: "column code_hash does not exist"**

**Cause:** Migration 4 didn't execute properly.

**Fix:** Re-run just the phone_verification_codes migration:
```sql
DROP TABLE IF EXISTS public.phone_verification_codes CASCADE;
-- Then paste the CREATE TABLE statement from 20260420000014_*.sql
```

---

### **Error: "permission denied for view user_linked_providers"**

**Cause:** GRANT statement didn't execute.

**Fix:**
```sql
GRANT SELECT ON public.user_linked_providers TO authenticated;
```

---

## 🎯 **Next Steps**

After completing all steps above:

1. ✅ Mark AUTH-V3-001 as **COMPLETE**
2. 🔄 Proceed to **AUTH-V3-002:** Shared Types & Error Classes
   - Create `p2p-kids-marketplace/src/types/auth-v3.ts`
   - Create `p2p-kids-marketplace/src/types/auth-v3-errors.ts`
3. 📅 Schedule AUTH-V3-003 (OAuthService implementation)

---

**End of Quick Start Guide**
