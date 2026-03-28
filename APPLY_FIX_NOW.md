# 🔧 Apply Admin RPC Schema Fix

## ⚡ Quick Steps (2 minutes)

### Step 1: Apply SQL in Supabase Dashboard

1. **Open SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/drntwgporzabmxdqykrp/sql/new
   - Or: Dashboard → SQL Editor → New Query

2. **Copy & Paste SQL:**
   ```bash
   # From your terminal:
   cat supabase/migrations/20260325000015_fix_admin_rpcs_final_complete.sql | pbcopy
   ```
   
   Or manually copy content of:
   `supabase/migrations/20260325000015_fix_admin_rpcs_final_complete.sql`

3. **Run SQL:**
   - Paste into SQL Editor
   - Click **"Run"** button
   - Expected result: "Success. No rows returned"

### Step 2: Test Automatically

```bash
# Run automated test suite
cd p2p-kids-admin
node test_admin_rpcs.mjs
```

Expected output:
```
✅ admin_list_users RPC
✅ admin_get_user_detail RPC  
✅ API endpoints
🎉 All tests passed!
```

### Step 3: Verify in Browser

1. **Start admin portal** (if not running):
   ```bash
   cd p2p-kids-admin
   npm run dev
   ```

2. **Open Users page:**
   - http://localhost:3001/users

3. **Confirm:**
   - ✅ No error popup
   - ✅ Users list displays
   - ✅ Analytics cards show data
   - ✅ Console has no SQL errors

---

## 📋 What This Fixes

**3 schema mismatches in admin RPC functions:**

### 1. Table name: `transactions` → `trades`
- **Error:** `relation "transactions" does not exist`
- **Fix:** Changed all `FROM transactions t` to `FROM trades t`
- **Files:** 11 occurrences across 6 migration files

### 2. Column name: `sw.balance` → `sw.available_balance`
- **Error:** `column sw.balance does not exist`
- **Fix:** Changed all `sw.balance` to `sw.available_balance`
- **Added:** `pending_balance` to sp_wallet response
- **Files:** 6 occurrences across 6 migration files

### 3. Column removed: `ub.revoked_at`
- **Error:** `column ub.revoked_at does not exist`
- **Reason:** user_badges table uses UNIQUE constraint, not revoked_at column
- **Fix:** Removed all `AND ub.revoked_at IS NULL` filters
- **Files:** 9 occurrences across 6 migration files

---

## 🔍 Manual Verification (if automated test fails)

### Verify Functions Exist

Run in SQL Editor:
```sql
-- Check functions were created/updated
SELECT 
  proname as function_name,
  pronargs as arg_count,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname IN ('admin_list_users', 'admin_get_user_detail')
  AND pronamespace = 'public'::regnamespace;
```

Expected: 2 rows returned

### Verify No Schema Errors

```sql
-- Should return 0 (zero references to wrong table name)
SELECT count(*) 
FROM pg_proc 
WHERE prosrc LIKE '%FROM transactions %'
  AND proname IN ('admin_list_users', 'admin_get_user_detail');

-- Should return 0 (zero references to wrong column)
SELECT count(*) 
FROM pg_proc 
WHERE prosrc LIKE '%sw.balance%'
  AND proname IN ('admin_list_users', 'admin_get_user_detail');

-- Should return 0 (zero references to non-existent column)
SELECT count(*) 
FROM pg_proc 
WHERE prosrc LIKE '%ub.revoked_at%'
  AND proname IN ('admin_list_users', 'admin_get_user_detail');
```

All should return: `0`

### Test RPC Directly

```sql
-- Find an admin user
SELECT user_id FROM role_based_access_control WHERE role = 'admin' LIMIT 1;

-- Test admin_list_users (replace UUID with admin_user_id from above)
SELECT * FROM admin_list_users(
  p_admin_id := '00000000-0000-0000-0000-000000000000'::uuid,
  p_search := null,
  p_account_status := null,
  p_subscription_status := null,
  p_node_id := null,
  p_page := 1,
  p_page_size := 5
);

-- Test admin_get_user_detail (replace both UUIDs)
SELECT * FROM admin_get_user_detail(
  p_admin_id := '00000000-0000-0000-0000-000000000000'::uuid,
  p_user_id := '00000000-0000-0000-0000-000000000000'::uuid
);
```

Expected: JSONB data returned (not errors)

---

## 🚨 Troubleshooting

### "Cannot find function admin_list_users"
- **Cause:** SQL not applied yet
- **Fix:** Complete Step 1 above

### "relation transactions does not exist" (still)
- **Cause:** Old function definition still cached
- **Fix:** Run SQL again, or restart Supabase project

### Test script fails with "Missing env vars"
- **Cause:** .env.local missing SUPABASE_SERVICE_ROLE_KEY
- **Fix:** Add to p2p-kids-admin/.env.local:
  ```
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
  ```
  Get from: Supabase Dashboard → Settings → API

### "localhost:3001/api/admin/users returns 500"
- **Cause:** RPC not updated yet, or admin portal not restarted
- **Fix:** 
  1. Verify SQL applied (Step 1)
  2. Restart admin portal: `npm run dev`

---

## ✅ Success Criteria

All must be true:
- ✅ SQL runs without errors in Dashboard
- ✅ `node test_admin_rpcs.mjs` exits with code 0
- ✅ localhost:3001/users loads without error popup
- ✅ Users list displays with data
- ✅ Analytics cards show metrics
- ✅ Browser console has no SQL errors

---

## 📁 Files Modified in This Fix

**Main migration (apply this one):**
- `supabase/migrations/20260325000015_fix_admin_rpcs_final_complete.sql`

**Synchronized for consistency:**
- `supabase/migrations/126_admin_user_management.sql`
- `supabase/migrations/20260325000010_fix_admin_list_users_node_id_type.sql`
- `supabase/migrations/20260325000011_fix_admin_user_detail_tier_lookup.sql`
- `supabase/migrations/20260325000012_fix_admin_list_users_st_join.sql`
- `supabase/migrations/20260325000013_fix_admin_rpcs_transactions_to_trades.sql`  
- `supabase/migrations/20260325000014_fix_admin_rpcs_complete_schema_alignment.sql`

**Test tools created:**
- `supabase/migrations/SCHEMA_SMOKE_TEST.sql` (SQL-based verification)
- `p2p-kids-admin/verify_admin_schema.mjs` (Node.js schema checks)
- `p2p-kids-admin/test_admin_rpcs.mjs` (Full RPC + API test)

---

## 📖 Why CLI Couldn't Apply This

The Supabase CLI `db push --linked` command failed because:
- It detected 75+ local migrations that don't exist on remote database
- Requires `--include-all` flag to apply migrations in sequence
- Not suitable for hotfix deployment (would apply N migrations, not just our fix)

For production hotfixes, Supabase Dashboard SQL Editor is the standard approach.

---

**Timeline:**
- Issue reported: 6th iteration of SQL errors on Users tab
- Root cause: accumulated schema drift (transactions/trades, balance/available_balance, revoked_at removal)
- Fix validated: grep verification confirms 0 schema mismatches  
- Ready to deploy: idempotent migration, safe to run immediately
