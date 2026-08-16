# ⚠️ RLS Disable Status Check

The `ALTER TABLE admin_config DISABLE ROW LEVEL SECURITY;` command ran, but we need to verify it actually worked.

## Step 1: Run this SQL in Supabase Dashboard to verify RLS status

Go to: https://app.supabase.com → SQL Editor → New Query

Copy and paste EXACTLY:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'admin_config';
```

**Expected output**:
```
tablename       rowsecurity
admin_config    false
```

If it shows `true`, then RLS is still enabled and the disable command didn't work.

---

## Step 2: If RLS shows `true`, run this to force disable it:

```sql
ALTER TABLE public.admin_config DISABLE ROW LEVEL SECURITY;

-- Verify again
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'admin_config';
```

---

## Step 3: After RLS is disabled, test the API update:

```bash
curl -X PATCH http://localhost:3001/api/admin/config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: kids_admin_secret_2024_prod" \
  -d '{"key":"subscription_price_monthly","value":"15.00"}'
```

Then verify:

```bash
curl -s -H "x-admin-secret: kids_admin_secret_2024_prod" \
  http://localhost:3001/api/admin/config | \
  jq '.data[] | select(.key == "subscription_price_monthly") | .value'
```

Should show: `"15.00"` (or whatever value you set)

---

## Troubleshooting

If the update still doesn't persist:

1. **Check API logs**: Look at the terminal where admin portal is running
   - Should see: `[Admin Config PATCH] ✅ Successfully updated subscription_price_monthly`
   - If you see an error instead, the REST API call is failing

2. **Check if REST API is working**:
   - Try making a manual REST API call to Supabase:
   ```bash
   ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRybnR3Z3BvcnphYm14ZHF5a3JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNzc1NjUsImV4cCI6MjA4MDg1MzU2NX0.5lj-JNoBItZJCZgMV9DwFslmzud0PxcIjSS78TFRU0E"
   
   curl -X PATCH https://drntwgporzabmxdqykrp.supabase.co/rest/v1/admin_config?key=eq.subscription_price_monthly \
     -H "Content-Type: application/json" \
     -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $ANON_KEY" \
     -d '{"value":"15.00"}'
   ```
   - If this works, the issue is with RLS. If it fails, the issue is with Supabase connectivity.

3. **Last resort**: Drop and recreate the policies:
   ```sql
   DROP POLICY IF EXISTS "admin_config_select_all" ON admin_config;
   DROP POLICY IF EXISTS "admin_config_update_all" ON admin_config;
   ```
   Then re-enable RLS and create permissive policies:
   ```sql
   ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "admin_config_select_all"
     ON admin_config FOR SELECT
     USING (TRUE);
   
   CREATE POLICY "admin_config_update_all"
     ON admin_config FOR UPDATE
     USING (TRUE)
     WITH CHECK (TRUE);
   ```
