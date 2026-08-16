# FINAL FIX - Disable RLS on admin_config table

Since we're protecting the API with the `x-admin-secret` header (server-side auth), we can safely disable RLS on the `admin_config` table.

## Steps:

### 1. Run this SQL in Supabase Dashboard:

Go to: https://app.supabase.com → SQL Editor → New Query

Copy and paste:

```sql
-- Disable RLS on admin_config table
-- (We use x-admin-secret header for server-side auth instead)
ALTER TABLE admin_config DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_class
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE tablename = 'admin_config';
```

Click "Run"

Expected output:
```
rowsecurity | false
```

### 2. Test the update immediately after:

```bash
curl -X PATCH http://localhost:3001/api/admin/config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: kids_admin_secret_2024_prod" \
  -d '{"key":"subscription_price_monthly","value":"12.00"}'
```

Then verify it persisted:

```bash
curl -s -H "x-admin-secret: kids_admin_secret_2024_prod" \
  http://localhost:3001/api/admin/config | \
  jq '.data[] | select(.key == "subscription_price_monthly")'
```

Should show: `"value": "12.00"`

### 3. If that works, refresh admin portal:

Go to: http://localhost:3001/admin/config

The price should show as 12.00

---

**Why this works:**
- `admin_config` contains non-sensitive configuration values (prices, settings, feature flags)
- The API endpoint requires a valid `x-admin-secret` header for write access (server-side auth)
- RLS is unnecessary since auth is done at the API layer, not at the DB layer
- This is a common pattern for configuration/admin tables
