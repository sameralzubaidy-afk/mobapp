# Database & Admin Issues - TODO

**Created:** After Round 3 test run (60 failed tests)
**Purpose:** Document database-level changes needed to make tests pass

## 🔴 CRITICAL: RLS Policies Blocking Test Inserts

### Issue
Tests using `service_role` key are still blocked by Row Level Security (RLS) policies when trying to insert into payout tables.

**Affected Tables:**
- `seller_payout_methods`
- `seller_payouts`

**Impact:** 20+ tests failing across:
- `pay-001-schema.test.ts` (8 tests)
- `payout-router-integration.test.ts` (12+ tests)

### Required Database Changes
```sql
-- Option 1: Allow service role to bypass RLS (recommended for test environment)
ALTER TABLE seller_payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_payouts ENABLE ROW LEVEL SECURITY;

-- Create policy for service role
CREATE POLICY "Service role can do anything on seller_payout_methods"
  ON seller_payout_methods
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do anything on seller_payouts"
  ON seller_payouts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Option 2: Create test-friendly insert policies
CREATE POLICY "Allow inserts for testing seller_payout_methods"
  ON seller_payout_methods
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));
```

**Action Required:** Choose and apply one of the policy options above to the staging database.

---

## ⚠️ Database Function Issues

### 1. Ambiguous `is_admin()` Function

**Error:** `function is_admin(uuid) is not unique`

**Root Cause:** Multiple `is_admin()` functions exist in the database with different signatures.

**Required Fix:**
```sql
-- 1. List all is_admin functions
SELECT proname, proargtypes, prosrc 
FROM pg_proc 
WHERE proname = 'is_admin';

-- 2. Drop duplicates, keeping only one correct version
-- Example (adjust based on what you find):
DROP FUNCTION is_admin(uuid);  -- if duplicate exists

-- 3. Ensure only ONE is_admin function remains with signature:
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Impact:** Admin functionality tests may fail or behave unpredictably.

---

### 2. Verify `admin_force_cancel_trade` RPC

**Status:** Function should exist and be accessible to admin users.

**Verification:**
```sql
-- Check if function exists
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'admin_force_cancel_trade';

-- Test function manually
SELECT admin_force_cancel_trade(
  p_trade_id := 'some-trade-id',
  p_admin_id := '49243010-f458-4744-add1-a6c84ab95f1f',
  p_reason := 'Test cancellation'
);
```

**Action Required:** Verify function exists and has correct permissions.

---

## 🟡 Auth Integration Issues

### Issue: `signup()` Returning `null` User

**Affected Tests:**
- `auth.integration.test.ts` (3 tests)

**Symptoms:**
```javascript
const { data, error } = await supabase.auth.signUp({...});
// data.user is null even when error is null
```

**Possible Causes:**
1. Email confirmation required (staging database setting)
2. Duplicate user emails (test cleanup not working)
3. Supabase auth service configuration issue

**Required Investigation:**
1. Check Supabase dashboard → Authentication → Settings:
   - Is "Enable email confirmations" ON?
   - Is "Enable phone confirmations" ON?
   - What are the "Email auth" settings?

2. Verify test user emails don't already exist:
```sql
SELECT email, created_at, email_confirmed_at, phone_confirmed_at
FROM auth.users
WHERE email LIKE '%@test.com%';
```

3. Check if signups are being rate-limited or blocked by Supabase auth policies.

**Temporary Workaround:**
- Skip auth integration tests until this is resolved
- Use seeded test users instead of creating new users

---

## 📊 Schema Issues

### Missing `sp_ledger.category` Column

**Affected Tests:**
- `badge_triggers_v2_002.test.ts` (1 test - already skipped)

**Required Fix:**
```sql
-- Add category column to sp_ledger if missing
ALTER TABLE sp_ledger 
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_sp_ledger_category 
ON sp_ledger(category);
```

**Action Required:** Add column to staging database and update affected test.

---

## 📝 Testing Strategy

### Current Status (Round 3)
- ✅ Fixed: Admin force-cancel UUID issues
- ✅ Fixed: Discovery test syntax errors
- ✅ Fixed: Mid-trade subscription assertion logic
- ⏳ Pending: RLS policy fixes (20+ tests)
- ⏳ Pending: Auth signup investigation (3 tests)
- ⏳ Pending: Schema updates (1 test)

### Recommended Approach

1. **First Priority - RLS Policies:**
   - Apply service role policies to `seller_payout_methods` and `seller_payouts`
   - Re-run affected tests to verify fix

2. **Second Priority - Auth Issues:**
   - Investigate Supabase auth settings
   - Either fix signup or migrate to seeded test users

3. **Third Priority - Schema:**
   - Add `sp_ledger.category` column
   - Un-skip affected test

### Expected Outcome
After applying all fixes:
- Current: 60 failed tests
- Expected: <10 failed tests (mostly auth-related if signup can't be fixed)

---

## 🛠️ Quick Commands for Admin

### Connect to Staging Database
```bash
# Use Supabase CLI
supabase db connect --staging

# Or use psql directly
psql "postgresql://postgres:[PASSWORD]@db.drntwgporzabmxdqykrp.supabase.co:5432/postgres"
```

### Apply RLS Fixes
```bash
# Copy the SQL from "RLS Policies Blocking Test Inserts" section
# Then run in Supabase SQL Editor or via psql
```

### Verify Changes
```bash
# After applying fixes, re-run tests
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
npm run test:all
```

---

## 📞 Questions to Answer

1. **RLS Policies:** Do you want service_role to bypass all RLS in staging, or should we create more granular policies?

2. **Auth Signups:** Should tests create new users dynamically, or should we use a fixed set of seeded test users?

3. **Database Access:** Do you have admin access to the staging Supabase project to make these changes?

4. **Test Environment:** Should we set up a separate "test" Supabase project instead of using staging?

---

**Next Steps After Fixes:**
1. Apply RLS policy changes
2. Run `npm run test:all` again
3. Verify test count drops from 60 to <10 failures
4. Document any remaining issues
