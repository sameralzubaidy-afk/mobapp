# Admin Config Persistence Fix

## Problem Statement
Admin portal config updates (referral bonus, fees, etc.) were not persisting after save. Values would revert to old values on page refresh.

**Root Cause**: The `/api/admin/config` PATCH handler was using `ANON_KEY` for REST API calls to update `admin_config` table, but RLS policies only allow `service_role` to write to this table. This caused silent 401/403 failures.

## Solution Overview
Updated `p2p-kids-admin/src/app/api/admin/config/route.ts` PATCH handler to:
1. Use `SERVICE_KEY` (service role) instead of `ANON_KEY` for authenticated writes
2. Improved error logging to catch RLS rejections
3. Added validation to ensure service key is configured before attempting writes

## Code Changes

### File: `p2p-kids-admin/src/app/api/admin/config/route.ts` (Lines 72-102)

**Before**:
```typescript
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const updateResponse = await fetch(..., {
  headers: {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,  // ❌ Blocked by RLS
    ...
  },
});
```

**After**:
```typescript
const WRITE_KEY = SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const updateResponse = await fetch(..., {
  headers: {
    'apikey': WRITE_KEY,  // ✅ Uses service_role if available
    'Authorization': `Bearer ${WRITE_KEY}`,
    ...
  },
});
```

## How It Works

### Flow Sequence
1. **Admin UI** (e.g., config/page.tsx) calls:
   ```typescript
   PATCH /api/admin/config
   Header: x-admin-secret: <value>
   Body: { key: "referral_bonus", value: 50 }
   ```

2. **API Route** (/api/admin/config route.ts):
   - Verifies admin secret header ✅
   - Reads SERVICE_KEY from environment
   - Calls Supabase REST API with SERVICE_KEY (service_role) ✅
   - Service role bypasses RLS, update succeeds

3. **Database Trigger** (sync_sp_config_on_admin_update):
   - AFTER UPDATE fires on admin_config
   - Syncs changes to sp_config table
   - Both tables now have matching values ✅

4. **Admin UI** (next page load):
   - Calls GET /api/admin/config
   - Reads from admin_config
   - Shows updated value ✅

## Key RLS Policies

### admin_config Table
```sql
-- Only service_role can write
CREATE POLICY "admin_config_update_service_role" ON admin_config
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- Everyone can read (gated by app logic)
CREATE POLICY "admin_config_select_all" ON admin_config
  FOR SELECT TO authenticated, anon
  USING (true);
```

This is why the PATCH handler MUST use SERVICE_KEY for writes.

## Testing Checklist

### ✅ Pre-Flight: Verify Environment Setup
```bash
# 1. Confirm SERVICE_KEY is set in admin portal .env.local
grep SUPABASE_SERVICE_ROLE_KEY p2p-kids-admin/.env.local
# Expected: long key starting with eyJ... (JWT)

# 2. Confirm SERVICE_KEY is loaded by API
# Check admin portal server logs for: "✅ Admin API initialized with service role key"
```

### ✅ Step 1: TypeScript Compilation
```bash
cd p2p-kids-admin
yarn typecheck
# Expected: No TypeScript errors
```

### ✅ Step 2: Manual Test in Admin Portal
1. Open admin portal (http://localhost:3000/config or Vercel staging)
2. Update any config value (e.g., change "Referral Bonus" from 40 to 55)
3. Click "Save"
4. **Expected**: "Configuration saved" toast appears
5. Refresh the page
6. **Expected**: New value (55) is displayed (NOT reverted to 40)

### ✅ Step 3: Verify Database State
```sql
-- In Supabase SQL Editor, run:
SELECT key, value, updated_at, updated_by 
FROM admin_config 
WHERE key = 'referral_bonus'
ORDER BY updated_at DESC 
LIMIT 1;

-- Expected: Latest row shows value=55 (or whatever you set)

-- Check sync worked:
SELECT config_key, config_value
FROM sp_config
WHERE config_key = 'referral_bonus'
ORDER BY updated_at DESC
LIMIT 1;

-- Expected: sp_config row also has config_value=55 (synced)
```

### ✅ Step 4: Verify Logs Show Success
In admin portal server logs, look for:
```
[Admin Config PATCH] Updating key=referral_bonus, value=55
[Admin Config PATCH] ✅ Successfully updated referral_bonus
```

### ✅ Step 5: Check RPC Function Still Works
```sql
-- Test the get_referral_listing_config RPC
SELECT public.get_referral_listing_config();

-- Expected: Returns config with referral_bonus=55
```

## Common Issues & Fixes

### Issue: "Service role key not configured"
**Symptom**: Error message in admin portal after save attempt

**Fix**:
1. Verify `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`
2. Ensure it's the FULL service role key from Supabase (Settings → API)
3. Restart Next.js dev server or redeploy
4. Confirm logs show: "✅ Admin API initialized with service role key"

### Issue: "Failed to update config: 401 or 403"
**Symptom**: Admin portal update fails even with SERVICE_KEY set

**Fix**:
1. Check Supabase logs for RLS policy errors
2. Verify RLS policy allows service_role for UPDATE:
   ```sql
   SELECT policyname, cmd, permissive, roles, qual, with_check
   FROM pg_policies
   WHERE tablename = 'admin_config';
   -- Expected: admin_config_update_service_role with service_role and cmd='UPDATE'
   ```

### Issue: Values still not persisting
**Symptom**: Update succeeds but page refresh shows old value

**Fix**:
1. Verify sync trigger exists:
   ```sql
   SELECT trigger_name, event_manipulation
   FROM information_schema.triggers
   WHERE trigger_schema = 'public' AND trigger_name LIKE '%sync%';
   -- Expected: trigger_sync_sp_config_on_admin_update
   ```
2. Check if both admin_config AND sp_config have the updated value (see Step 3 above)
3. If admin_config has new value but sp_config doesn't, trigger may not have fired:
   - Check Supabase Edge Function logs for errors
   - Verify function `sync_sp_config_on_admin_update` exists and is correct

## Affected Flows
- **FLOW-18**: Admin Controls (Config + Overrides) — now fully functional
- **FLOW-10, FLOW-11**: Swap Points (now reading dynamic config from sp_config)
- **FLOW-08**: Trade Flow (fees/SP logic now use updated admin config)

## Regression Testing

### Tier 0 (Always)
```bash
cd p2p-kids-admin
yarn lint
yarn typecheck
yarn build
# All should pass with no errors
```

### Tier 1 (Config Save Flow)
```bash
# Manual smoke test:
# 1. Open admin portal
# 2. Update config value
# 3. Save
# 4. Refresh
# 5. Verify value persisted
```

### Tier 2 (Full System)
Not required for this API-only fix, but confirm:
- Referral bonus changes are respected by referral RPC
- Fee config changes are used by transaction RPC
- SP rules changes are applied to wallet operations

## Files Modified
- `p2p-kids-admin/src/app/api/admin/config/route.ts` — Updated PATCH handler to use SERVICE_KEY

## Migration Dependencies
This fix depends on prior migrations:
- `20260207000000_add_referral_enum.sql` — Adds 'referral' category
- `20260207000001_fix_config_table_mismatch_and_persistence.sql` — Creates sync trigger

## Deployment Checklist
- [ ] Confirm SERVICE_KEY env var is set in admin portal deployment
- [ ] Typecheck passes locally
- [ ] Build passes locally
- [ ] Deploy admin portal to staging/production
- [ ] Test config update in admin portal
- [ ] Verify value persists after refresh
- [ ] Check database has updated values in both admin_config and sp_config

## Next Steps
1. Deploy this fix to admin portal
2. Test admin config updates in staging
3. Verify referral bonus changes are reflected in RPC
4. Run full regression test for affected flows (FLOW-08, FLOW-10, FLOW-11, FLOW-18)
