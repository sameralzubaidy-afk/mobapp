# ✅ AUTH-V3-001 DELIVERY COMPLETE

**Task:** AUTH-V3-001 — Schema Migrations (Linked Providers View, Phone Verification Columns, Link RPC, OTP Table)  
**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN.md  
**Delivered:** April 30, 2026  

---

## 📦 **WHAT WAS DELIVERED**

### **1. Database Migrations** (4 files — READY TO RUN)

```
supabase/migrations/
├── 20260420000011_create_user_linked_providers_view.sql
├── 20260420000012_add_phone_verification_tracking.sql
├── 20260420000013_link_social_account_rpc.sql
└── 20260420000014_create_phone_verification_codes.sql
```

### **2. Tests** (2 files — READY TO EXECUTE)

```
supabase/tests/
└── auth_v3_001_migrations.test.sql (35 PgTAP unit tests)

/
└── AUTH-V3-001-MANUAL-TESTING-GUIDE.md (12 manual test cases)
```

### **3. Deployment & Documentation** (4 files — READY TO USE)

```
/
├── AUTH-V3-001-SQL-DEPLOYMENT.sql (single-file deployment script)
├── AUTH-V3-001-QUICK-START.md (deployment steps)
├── AUTH-V3-001-IMPLEMENTATION-SUMMARY.md (full details)
└── docs/flow-registry.md (updated)
```

---

## 🎯 **VERIFICATION CHECKLIST STATUS**

### **From MODULE-03-VERIFICATION-V3-SOCIAL-LOGIN.md Section 1 (Schema):**

| # | Requirement | Implementation | Status |
|---|-------------|----------------|--------|
| **1.1** | Four migration files exist at exact paths | Created at `supabase/migrations/20260420000011-14_*.sql` | ✅ SATISFIED |
| **1.2** | `user_linked_providers` view with SELECT grant to authenticated | Created in migration 000011 | ✅ SATISFIED |
| **1.3** | `profiles` has `phone_verified_at` and `phone_verification_method` columns | `phone_verification_method` added in migration 000012 (`phone_verified_at` already existed from V2) | ✅ SATISFIED |
| **1.4** | Partial index `idx_profiles_phone_verified` on `phone_verified_at WHERE IS NULL` | Created in migration 000012 | ✅ SATISFIED |
| **1.5** | `link_social_account` RPC is SECURITY DEFINER | Created in migration 000013 | ✅ SATISFIED |
| **1.6** | `phone_verification_codes` has V3 schema (code_hash, indexes, RLS) | DROP/CREATE in migration 000014 | ✅ SATISFIED |
| **1.7** | RPC email-match guard smoke test (PgTAP) | Included in `supabase/tests/auth_v3_001_migrations.test.sql` | ✅ SATISFIED |

**Verification File Notes:**
- ⚠️ Verification file references `user_profiles` table, but this repo uses `profiles`. **All migrations use correct table name `profiles`**.
- ✅ All verification queries adapted to use `profiles` instead of `user_profiles`.

---

## 🔍 **KEY IMPLEMENTATION DECISIONS**

### **1. Table Name Normalization**

**Issue:** Module spec uses `user_profiles`, but repo uses `profiles`.

**Decision:** Use `profiles` (repo canonical name) throughout all migrations.

**Impact:** None — migrations are idempotent and work with existing schema.

---

### **2. Audit Log Table Selection**

**Issue:** Module spec references `audit_log`, but repo has `admin_audit_logs`.

**Decision:** Use `admin_audit_logs` (repo canonical table).

**Impact:** `link_social_account` RPC writes to `admin_audit_logs` instead.

---

### **3. Breaking Change: phone_verification_codes**

**Issue:** V2 table stores plaintext codes, V3 requires hashed codes.

**Decision:** DROP and recreate table (no migration path from plaintext to hash).

**Impact:** All existing OTP codes lost (safe — expire in 5 minutes anyway).

---

### **4. Migration Number Reservation**

**Issue:** Module spec reserves 000011-000014 for AUTH-V3-001.

**Decision:** Follow spec exactly (000001-000010 reserved for other V3 modules).

**Impact:** Strict ordering prevents conflicts with parallel V3 module development.

---

## 📋 **WHAT YOU NEED TO DO**

### **🚨 REQUIRED BEFORE TESTING:**

1. **Run SQL Deployment Script in Supabase:**
   ```bash
   # Open: AUTH-V3-001-SQL-DEPLOYMENT.sql
   # Copy entire file
   # Paste into Supabase Dashboard → SQL Editor
   # Click RUN
   ```

2. **Verify Deployment Success:**
   - All checkpoint queries return expected values
   - Final summary shows 6/6 objects ✅ EXISTS

---

### **✅ REQUIRED TESTING:**

1. **Manual Tests (12 test cases):**
   ```bash
   # Follow: AUTH-V3-001-MANUAL-TESTING-GUIDE.md
   # Target: 12/12 PASS
   ```

2. **PgTAP Unit Tests (35 test cases) — OPTIONAL:**
   ```bash
   psql -U postgres -h db.YOUR_PROJECT_ID.supabase.co -d postgres \
     -f supabase/tests/auth_v3_001_migrations.test.sql
   # Target: 35/35 PASS
   ```

---

### **📝 QUICK START:**

Open `AUTH-V3-001-QUICK-START.md` for step-by-step deployment instructions.

---

## ⚠️ **KNOWN LIMITATIONS**

1. **No Mobile UI Changes:** AUTH-V3-001 is schema-only. No `.tsx` files modified.

2. **No Navigation Updates:** Since there's no UI, navigation files are unchanged.

3. **No Maestro Tests:** Schema changes don't require UI flow tests. Maestro tests will come in AUTH-V3-007 (Mobile UI — SocialLoginButtons).

4. **Breaking Change:** `phone_verification_codes` table dropped/recreated. All active OTP codes will be invalidated. Deploy during low-traffic window.

---

## 🔄 **NEXT STEPS (AFTER YOU COMPLETE TESTING)**

1. ✅ **Mark AUTH-V3-001 as COMPLETE**

2. 🔄 **Proceed to AUTH-V3-002:** Shared Types & Error Classes
   - Create `p2p-kids-marketplace/src/types/auth-v3.ts`
   - Create `p2p-kids-marketplace/src/types/auth-v3-errors.ts`
   - Define TypeScript interfaces for:
     - `OAuthProvider`, `ProviderProfile`, `LinkedProvider`
     - `PhoneVerificationRequest`, `PhoneVerificationResult`
     - `OAuthStateMismatchError`, `EmailMismatchError`, `LastLoginMethodError`, `OTPExpiredError`, `OTPRateLimitError`

---

## 📊 **CHANGE CLASSIFICATION**

**Type:** A) DB/Migrations/RLS

**Required Regression Tiers:**
- ✅ **Tier 0:** N/A (no TypeScript code)
- ✅ **Tier 1:** Manual SQL tests (12 cases in testing guide)
- ✅ **Tier 2:** Full regression (PgTAP 35 cases + manual 12 cases)

**Impacted Flows:**
- **FLOW-01:** Auth – Signup/Login/Logout/Session Restore (extended with social login schema foundation)

---

## 📂 **COMPLETE FILE MANIFEST**

### **Created (9 files):**

```
supabase/migrations/
├── 20260420000011_create_user_linked_providers_view.sql (VIEW + GRANT)
├── 20260420000012_add_phone_verification_tracking.sql (COLUMN + INDEX)
├── 20260420000013_link_social_account_rpc.sql (RPC SECURITY DEFINER)
└── 20260420000014_create_phone_verification_codes.sql (TABLE V3)

supabase/tests/
└── auth_v3_001_migrations.test.sql (PgTAP 35 tests)

/
├── AUTH-V3-001-SQL-DEPLOYMENT.sql (single-file deployment)
├── AUTH-V3-001-MANUAL-TESTING-GUIDE.md (12 manual test cases)
├── AUTH-V3-001-IMPLEMENTATION-SUMMARY.md (full implementation details)
└── AUTH-V3-001-QUICK-START.md (deployment steps)
```

### **Updated (1 file):**

```
docs/
└── flow-registry.md (added AUTH-V3-001 under FLOW-01)
```

---

## ✅ **ACCEPTANCE CRITERIA VERIFICATION**

All acceptance criteria from task description:

- [x] Four migration files exist at the exact paths above
- [x] `public.user_linked_providers` view exposes `user_id, provider, provider_email, provider_name, provider_avatar, last_sign_in_at, created_at`, ordered by `(user_id, provider)`. `GRANT SELECT` to `authenticated` only
- [x] `profiles` has `phone_verified_at TIMESTAMPTZ` and `phone_verification_method TEXT CHECK (phone_verification_method IN ('sms','social_auto','manual'))`
- [x] Partial index `idx_profiles_phone_verified` on `phone_verified_at WHERE phone_verified_at IS NULL`
- [x] `link_social_account(provider_name TEXT, provider_user_id TEXT, provider_email TEXT, provider_data JSONB)` is `SECURITY DEFINER`, throws `EmailMismatchError` when `auth.users.email != provider_email` for `auth.uid()`, and writes an `audit_log` row on success
- [x] `phone_verification_codes` has `id UUID PK, user_id UUID FK, phone TEXT, code_hash TEXT, attempts INT DEFAULT 0, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ`, with RLS policy "user can read/write own rows"
- [x] Indexes `idx_phone_verification_codes_user_expires (user_id, expires_at)` and `idx_phone_verification_codes_phone_created (phone, created_at)` exist (the latter supports the per-phone rate-limit check)
- [x] All migrations idempotent (`CREATE OR REPLACE`, `IF NOT EXISTS`)
- [x] Commented verification queries at the bottom of each file

---

## 📞 **SUPPORT**

If you encounter issues during deployment:

1. **Check `AUTH-V3-001-QUICK-START.md` → Troubleshooting** section
2. **Review `AUTH-V3-001-IMPLEMENTATION-SUMMARY.md`** for implementation details
3. **Verify Prerequisites** in verification file (OAuth providers enabled, Twilio credentials, avatars bucket)

---

## 🎉 **SUMMARY**

✅ **Implementation: COMPLETE**  
✅ **Tests: PROVIDED (35 PgTAP + 12 manual)**  
✅ **Documentation: COMPLETE**  
✅ **Deployment Script: READY**  

⏸️ **Waiting for:** YOUR deployment + testing confirmation

---

**End of Delivery Document**
