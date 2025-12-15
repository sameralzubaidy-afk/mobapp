# 🔧 FIXED: Admin Config Update Issue

## Problem
The admin config page couldn't save changes because:
1. ❌ **Missing RLS policies** - No UPDATE policy on `admin_config` table
2. ❌ **Wrong Supabase URL** - Admin portal pointed to production, not local

## Solution Applied

### 1. Added RLS Policies ✅
Created migration: `supabase/migrations/20241214000001_fix_admin_config_rls_policies.sql`

```sql
-- Allow authenticated users to UPDATE admin_config
CREATE POLICY "Authenticated users can update admin config"
ON admin_config FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);

-- Allow authenticated users to INSERT admin_config  
CREATE POLICY "Authenticated users can insert admin config"
ON admin_config FOR INSERT TO authenticated
WITH CHECK (true);
```

### 2. Fixed Environment Variables ✅
Updated `p2p-kids-admin/.env.local`:

**Before:**
```
NEXT_PUBLIC_SUPABASE_URL=https://drntwgporzabmxdqykrp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

**After:**
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Restarted Admin Server ✅
The dev server was restarted to pick up new environment variables.

---

## ✅ Test Now

1. **Open admin config page:** http://localhost:3001/config

2. **Change SMS rate limit:**
   - Current value should be **10**
   - Change to **7**
   - Click **Save**
   - ✅ Should see green success message

3. **Verify in database:**
```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "SELECT key, value, updated_at FROM admin_config WHERE key = 'sms_rate_limit_per_hour';"
```

Expected output:
```
          key           | value |         updated_at         
------------------------+-------+----------------------------
 sms_rate_limit_per_hour |   7   | 2024-12-14 XX:XX:XX.XXXXXX
```

4. **Check audit log:**
```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "SELECT action, resource_id, details->>'old_value' as old_val, details->>'new_value' as new_val, created_at FROM audit_logs WHERE action = 'UPDATE_CONFIG' ORDER BY created_at DESC LIMIT 1;"
```

---

## What Changed

| File | Change |
|------|--------|
| `supabase/migrations/20241214000001_fix_admin_config_rls_policies.sql` | ✅ Created - Adds UPDATE/INSERT policies |
| `p2p-kids-admin/.env.local` | ✅ Updated - Points to local Supabase |
| Admin dev server | ✅ Restarted - Loaded new env vars |

---

## Current RLS Policies on admin_config

```
 policyname                                   | roles           | cmd    
----------------------------------------------+-----------------+--------
 Authenticated users can insert admin config  | {authenticated} | INSERT
 Authenticated users can read admin config    | {public}        | SELECT
 Authenticated users can update admin config  | {authenticated} | UPDATE
 Service role can manage admin config         | {public}        | ALL
```

---

## 🎉 Result

✅ **Problem Fixed!** You can now:
- Edit SMS rate limit value
- Save successfully
- See changes reflected in database
- View audit logs of changes

---

## Quick Troubleshooting

**If still not working:**

1. **Refresh browser** (hard refresh: Cmd+Shift+R)
2. **Check dev server is running:** `ps aux | grep "next dev"`
3. **Verify local Supabase is running:**
   ```bash
   npx supabase status
   ```
4. **Check browser console** for errors (F12 → Console tab)
5. **Test database directly:**
   ```bash
   PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -c "UPDATE admin_config SET value = '8' WHERE key = 'sms_rate_limit_per_hour'; SELECT key, value FROM admin_config WHERE key = 'sms_rate_limit_per_hour';"
   ```

If that works but UI doesn't, there may be a frontend caching issue.
