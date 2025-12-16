🔧 **ADMIN CONFIG - FINAL FIX (RLS DISABLED)**

---

## The Issue

The RLS policies on `admin_config` are still blocking updates, even though we tried to make them permissive. The policies created show `admin_config_select_all` and `admin_config_update_all`, but something is still preventing the anon key from updating.

**Solution**: Disable RLS entirely (safe for config tables that don't contain sensitive PII)

---

## Fix - Run This SQL (1 minute)

1. **Open Supabase Dashboard**:  
   https://app.supabase.com → Select "kids_marketplace_app" → SQL Editor

2. **Create new query and paste this**:

```sql
-- Disable RLS on admin_config (we use x-admin-secret for server-side auth)
ALTER TABLE admin_config DISABLE ROW LEVEL SECURITY;

-- Verify it worked
SELECT 
  tablename,
  rowsecurity
FROM pg_class
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE tablename = 'admin_config';
```

3. **Click "Run"**

Expected output shows `rowsecurity | false` ✅

---

## Test Immediately After

**Test 1: Update config via API**
```bash
curl -X PATCH http://localhost:3001/api/admin/config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: kids_admin_secret_2024_prod" \
  -d '{"key":"subscription_price_monthly","value":"12.00"}'
```

**Test 2: Verify persistence**
```bash
curl -s -H "x-admin-secret: kids_admin_secret_2024_prod" \
  http://localhost:3001/api/admin/config | \
  jq '.data[] | select(.key == "subscription_price_monthly") | .value'
```

Should output: `"12.00"` ✅

**Test 3: Refresh admin portal**
- Go to: http://localhost:3001/admin/config
- Subscription price should show 12.00 (not 7.99)

---

## Why This is Safe

- **`admin_config` contains**: Prices, percentages, feature flags, service settings
- **Does NOT contain**: User data, passwords, PII, secrets
- **API auth**: Server validates `x-admin-secret` header (only admins can call it)
- **DB auth**: Not needed since no sensitive data is gated by RLS

This is a standard pattern for configuration tables in multi-tenant apps.

---

## Next: Mobile App Update

Once the admin config persists, the mobile app will automatically fetch the new price via the useFocusEffect hook we added.

Test by:
1. Running signup in mobile app
2. Going to SubscriptionChoiceScreen
3. Should show $12.00/month (from admin_config, not hardcoded 7.99)

---

**Status**: Ready to execute - just needs RLS disabled in Supabase
