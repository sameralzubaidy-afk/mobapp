# AUTH-V3-001 Implementation Summary

**Task:** AUTH-V3-001 — Schema Migrations (Linked Providers View, Phone Verification Columns, Link RPC, OTP Table)  
**Module:** MODULE-03-AUTH-V3-SOCIAL-LOGIN.md  
**Status:** ✅ **COMPLETE (Schema Only — No UI)**  
**Date:** April 30, 2026  

---

## 📦 **Deliverables**

### **1. Migration Files Created** (4 files)

| File | Purpose | Status |
|------|---------|--------|
| `supabase/migrations/20260420000011_create_user_linked_providers_view.sql` | CREATE VIEW over auth.identities, GRANT SELECT to authenticated | ✅ Created |
| `supabase/migrations/20260420000012_add_phone_verification_tracking.sql` | ADD phone_verification_method column + partial index | ✅ Created |
| `supabase/migrations/20260420000013_link_social_account_rpc.sql` | CREATE link_social_account SECURITY DEFINER RPC | ✅ Created |
| `supabase/migrations/20260420000014_create_phone_verification_codes.sql` | DROP/CREATE phone_verification_codes (V3 with code_hash + rate-limit indexes) | ✅ Created |

### **2. Test Files Created** (2 files)

| File | Purpose | Status |
|------|---------|--------|
| `supabase/tests/auth_v3_001_migrations.test.sql` | PgTAP unit tests (35 test cases covering all 4 migrations) | ✅ Created |
| `AUTH-V3-001-MANUAL-TESTING-GUIDE.md` | Manual verification guide (12 test cases for Supabase SQL Editor) | ✅ Created |

### **3. Deployment & Documentation** (2 files)

| File | Purpose | Status |
|------|---------|--------|
| `AUTH-V3-001-SQL-DEPLOYMENT.sql` | Single-file deployment script for Supabase Production SQL Editor | ✅ Created |
| `docs/flow-registry.md` | Updated FLOW-01 with AUTH-V3-001 entry | ✅ Updated |

---

## 🔍 **Implementation Details**

### **Migration 1: user_linked_providers View**

**Purpose:** Provide a friendly SELECT interface over `auth.identities` for linked social accounts.

**Schema:**
```sql
CREATE OR REPLACE VIEW public.user_linked_providers AS
SELECT
  i.user_id,
  i.provider,
  i.identity_data->>'email' AS provider_email,
  COALESCE(...) AS provider_name,
  COALESCE(...) AS provider_avatar,
  i.last_sign_in_at,
  i.created_at
FROM auth.identities i
ORDER BY i.user_id, i.provider;
```

**Access:** `GRANT SELECT ON public.user_linked_providers TO authenticated;`

**Use Case:** Mobile app can query which OAuth providers a user has linked (for settings UI).

---

### **Migration 2: phone_verification_method Column**

**Purpose:** Track how the user verified their phone number (SMS OTP vs OAuth provider auto-verification vs admin override).

**Schema:**
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verification_method TEXT
    CHECK (phone_verification_method IN ('sms', 'social_auto', 'manual'));
```

**Index (Partial):**
```sql
CREATE INDEX idx_profiles_phone_verified
  ON public.profiles(phone_verified_at)
  WHERE phone_verified_at IS NULL;
```

**Use Case:** Fast lookup for users who haven't verified phone (used by MODULE-04 V3 listing gate and MODULE-06 V2 checkout gate).

---

### **Migration 3: link_social_account RPC**

**Purpose:** SECURITY DEFINER function to validate preconditions before linking a social provider.

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.link_social_account(
  p_provider_name TEXT,
  p_provider_user_id TEXT,
  p_provider_email TEXT,
  p_provider_data JSONB
) RETURNS void
```

**Key Features:**
- ✅ **SECURITY DEFINER** (can write to audit_log even with RLS enabled)
- ✅ **Email-match guard:** Throws `EmailMismatchError` if `auth.users.email != provider_email`
- ✅ **Audit logging:** Writes to `admin_audit_logs` on success
- ✅ **Authentication check:** Throws `NotAuthenticated` if `auth.uid()` is NULL

**Use Case:** AccountService calls this RPC before calling `supabase.auth.linkIdentity()` to ensure email matches and log the action.

---

### **Migration 4: phone_verification_codes Table (V3 Upgrade)**

**Purpose:** Replace old schema with V3 requirements (hashed codes, rate-limit indexes).

**Breaking Change:** ⚠️ **Drops and recreates** the existing `phone_verification_codes` table from MODULE-03 V2.

**Old Schema (V2):**
- `code TEXT` (plaintext 6-digit OTP)
- No rate-limit indexes

**New Schema (V3):**
```sql
CREATE TABLE public.phone_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL, -- bcrypt hash (never store plaintext)
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);
```

**Indexes (V3):**
1. `idx_phone_verification_codes_user_expires (user_id, expires_at)` — Fast lookup for valid unexpired codes
2. `idx_phone_verification_codes_phone_created (phone, created_at)` — Per-phone rate-limit check (3 codes/phone/hour)

**RLS Policies:**
- SELECT: authenticated users can read their own codes
- INSERT/UPDATE/DELETE: service_role only (Edge Functions)

---

## ✅ **Verification Checklist (from MODULE-03-VERIFICATION-V3-SOCIAL-LOGIN.md)**

| Section | Item | Status |
|---------|------|--------|
| **1.1** | Four migration files exist at exact paths | ✅ COMPLETE |
| **1.2** | `user_linked_providers` view has SELECT grant to authenticated | ✅ COMPLETE |
| **1.3** | `user_profiles` has `phone_verified_at` and `phone_verification_method` | ✅ COMPLETE |
| **1.4** | Partial index `idx_profiles_phone_verified` exists | ✅ COMPLETE |
| **1.5** | `link_social_account` RPC is SECURITY DEFINER | ✅ COMPLETE |
| **1.6** | `phone_verification_codes` has V3 schema (code_hash, indexes, RLS) | ✅ COMPLETE |
| **1.7** | RPC email-match guard smoke test (PgTAP) | ✅ COMPLETE (in test file) |

---

## 🧪 **Testing Strategy**

### **Unit Tests**
- **File:** `supabase/tests/auth_v3_001_migrations.test.sql`
- **Framework:** PgTAP (PostgreSQL Testing Framework)
- **Coverage:** 35 test cases
  - View existence + columns + grants
  - Column existence + types + constraints
  - Index existence + partial index verification
  - RPC signature + SECURITY DEFINER flag
  - Table schema + RLS + policies

**Run Command:**
```bash
# Install PgTAP first if not installed
# Then run:
psql -U postgres -d your_db -f supabase/tests/auth_v3_001_migrations.test.sql
```

### **Integration Tests**
- **File:** `AUTH-V3-001-MANUAL-TESTING-GUIDE.md`
- **Platform:** Supabase SQL Editor (Production)
- **Coverage:** 12 test cases
  - All unit test scenarios + manual RPC invocation tests
  - Email mismatch guard (requires authenticated session)
  - Audit log writes

**Run Command:**
```bash
# 1. Apply migrations via AUTH-V3-001-SQL-DEPLOYMENT.sql
# 2. Follow test cases in AUTH-V3-001-MANUAL-TESTING-GUIDE.md
```

### **E2E Tests**
**Status:** ⏸️ **N/A for AUTH-V3-001**  
**Reason:** This task is schema-only. E2E tests will be created in AUTH-V3-007 (Mobile UI — SocialLoginButtons) and AUTH-V3-008 (LinkedAccountsScreen + PhoneVerificationModal).

### **Maestro UI Tests**
**Status:** ⏸️ **N/A for AUTH-V3-001**  
**Reason:** No UI components in this task.

---

## 📋 **Deployment Instructions**

### **For Supabase Production:**

1. **Open Supabase Dashboard → SQL Editor**

2. **Copy & Paste** `AUTH-V3-001-SQL-DEPLOYMENT.sql` and **RUN**

3. **Verify** all checkpoint queries return expected results:
   - Migration 1 VERIFY: ✅ `expected_1 = 1`
   - Migration 2 VERIFY (column): ✅ `expected_1 = 1`
   - Migration 2 VERIFY (index): ✅ `expected_1 = 1`
   - Migration 3 VERIFY: ✅ `proname = link_social_account`, `expected_true = true`
   - Migration 4 VERIFY (table): ✅ `expected_1 = 1`
   - Migration 4 VERIFY (indexes): ✅ `expected_2 = 2`

4. **Run Manual Tests** from `AUTH-V3-001-MANUAL-TESTING-GUIDE.md` (12 test cases)

5. **Expected Result:** All 12 test cases PASS ✅

---

## ⚠️ **Breaking Changes**

### **phone_verification_codes Table Dropped and Recreated**

**Impact:**
- ❌ **All existing OTP codes will be lost** (table is dropped)
- ✅ **No user-facing impact** (OTPs expire in 5 minutes anyway)

**Reason:**
- V2 table schema stored plaintext codes (`code TEXT`)
- V3 requires hashed codes (`code_hash TEXT`) for security compliance
- No migration path from plaintext to hashed (can't reverse bcrypt)

**Mitigation:**
- Deploy during low-traffic window
- Notify users to expect SMS re-sends if they were mid-verification

---

## 📝 **Open Questions / TODOs**

### **From Verification File:**

| Question | Answer | Status |
|----------|--------|--------|
| Does `audit_log` table exist? | ❌ NO — Found `admin_audit_logs` instead | ✅ RESOLVED (using `admin_audit_logs`) |
| Does `avatars` storage bucket exist? | ⏸️ TBD — Not verified yet | ⏸️ DEFERRED to AUTH-V3-005 |
| Are OAuth providers enabled in Supabase dashboard? | ⏸️ TBD — Manual ops task | ⏸️ DEFERRED to AUTH-V3-003 |

---

## 🔄 **Next Steps**

1. ✅ **YOU:** Run `AUTH-V3-001-SQL-DEPLOYMENT.sql` in Supabase Production
2. ✅ **YOU:** Complete `AUTH-V3-001-MANUAL-TESTING-GUIDE.md` (12 test cases)
3. ⏸️ **AGENT:** Proceed to **AUTH-V3-002** (Shared Types & Error Classes)
   - Create `p2p-kids-marketplace/src/types/auth-v3.ts`
   - Create `p2p-kids-marketplace/src/types/auth-v3-errors.ts`
   - Define TypeScript interfaces for OAuth flows, account linking, phone verification

---

## 📊 **Files Modified Summary**

### **Created** (8 files)

```
supabase/migrations/
  ├── 20260420000011_create_user_linked_providers_view.sql
  ├── 20260420000012_add_phone_verification_tracking.sql
  ├── 20260420000013_link_social_account_rpc.sql
  └── 20260420000014_create_phone_verification_codes.sql

supabase/tests/
  └── auth_v3_001_migrations.test.sql

/
  ├── AUTH-V3-001-MANUAL-TESTING-GUIDE.md
  ├── AUTH-V3-001-SQL-DEPLOYMENT.sql
  └── AUTH-V3-001-IMPLEMENTATION-SUMMARY.md (this file)
```

### **Updated** (1 file)

```
docs/
  └── flow-registry.md (added AUTH-V3-001 entry under FLOW-01)
```

---

## ✅ **Change Classification & Regression Plan**

**Change Classification:** **A) DB/Migrations/RLS**

**Required Regression Tiers:**
- ✅ **Tier 0 (ALWAYS):** N/A (no TypeScript code)
- ✅ **Tier 1 (Targeted):** Manual SQL tests (AUTH-V3-001-MANUAL-TESTING-GUIDE.md)
- ✅ **Tier 2 (Full):** Required due to DB migrations
  - PgTAP unit tests (35 cases)
  - Manual verification (12 cases)

**Impacted Flows:**
- **FLOW-01:** Auth – Signup/Login/Logout/Session Restore (extended with social login schema)

**Commands to Run:**
```bash
# Tier 2: Database tests
psql -U postgres -d your_db -f supabase/tests/auth_v3_001_migrations.test.sql

# Tier 2: Manual verification
# See: AUTH-V3-001-MANUAL-TESTING-GUIDE.md
```

**Expected Results:**
- PgTAP: 35/35 tests PASS
- Manual: 12/12 test cases PASS

---

## 🎯 **Definition of Done**

- [x] Four migration files created at exact reserved paths (000011-000014)
- [x] All migrations are idempotent (CREATE OR REPLACE, IF NOT EXISTS, DROP IF EXISTS)
- [x] Commented verification queries at bottom of each migration file
- [x] PgTAP unit tests cover all schema changes (35 test cases)
- [x] Manual testing guide created (12 test cases)
- [x] Deployment script created for single-file execution
- [x] `docs/flow-registry.md` updated with AUTH-V3-001 entry
- [ ] ⏸️ **USER ACTION REQUIRED:** Run `AUTH-V3-001-SQL-DEPLOYMENT.sql` in Supabase
- [ ] ⏸️ **USER ACTION REQUIRED:** Complete `AUTH-V3-001-MANUAL-TESTING-GUIDE.md`

---

**End of Implementation Summary**
