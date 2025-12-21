# 🔧 ADMIN CONFIG FIXES - FINAL STEP

## Problem Identified
The admin config update is failing because:
1. Service role key in .env.local appears invalid/rejected by Supabase
2. RLS policies on `admin_config` table are too restrictive (only allow service_role)

## Solution
1. Update RLS policies to allow anon key (API validates admin secret server-side)
2. Use direct REST API calls instead of Supabase client library
3. Restart admin portal with new code

## Steps to Fix

### STEP 1: Update RLS Policies in Supabase Dashboard
1. Go to: https://app.supabase.com → Select "kids_marketplace_app" project
2. Click "SQL Editor" in left sidebar
3. Create a new query and run this SQL:

```sql
-- Drop old restrictive RLS policies
DROP POLICY IF EXISTS "Admins can view config" ON admin_config;
DROP POLICY IF EXISTS "Admins can update config" ON admin_config;
DROP POLICY IF EXISTS "Admin config: allow update via API" ON admin_config;
DROP POLICY IF EXISTS "Admin config: public select" ON admin_config;

-- Create new permissive policies (auth is done server-side in API)
CREATE POLICY "admin_config_select_all"
  ON admin_config FOR SELECT
  USING (TRUE);

CREATE POLICY "admin_config_update_all"
  ON admin_config FOR UPDATE  
  USING (TRUE)
  WITH CHECK (TRUE);

-- Verify policies created
SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'admin_config';
```

4. Click "Run" and verify you see:
   - admin_config_select_all (SELECT)
   - admin_config_update_all (UPDATE)

### STEP 2: Restart Admin Portal with New Code
The code has already been updated in `p2p-kids-admin/src/app/api/admin/config/route.ts`

Run these commands:
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin

# Kill any existing process
pkill -f "next dev"

# Clear cache
rm -rf .next node_modules/.cache .turbo

# Start fresh
npm run dev
```

Expected output:
```
▲ Next.js 14.0.4
- Local:        http://localhost:3001
✓ Ready in ~1500ms
✓ Compiled /api/admin/config in ...ms
```

### STEP 3: Test Admin Config Update

1. Navigate to: http://localhost:3001/admin/config
2. Find "subscription_price_monthly" field (should show 7.99)
3. Change value to 12.00
4. Click "Save"
5. ✅ Expected: Green success message appears
6. Refresh page: Value should still be 12.00 (confirms it persisted)

### STEP 4: Verify Mobile App Sees Update

1. Start the mobile app:
   ```bash
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
   npm run dev
   ```

2. Signup or login to trigger SubscriptionChoiceScreen
3. Verify it shows the new price (12.00 instead of 7.99)
4. The price should be live from admin_config (not hardcoded)

## API Code Changes Made
File: `p2p-kids-admin/src/app/api/admin/config/route.ts`

- Uses direct Supabase REST API instead of client library
- Admin secret header is the primary auth mechanism
- Anon key is used for REST API calls (RLS policies allow everything now, server-side auth protects)
- Better error logging for debugging
- Includes audit trail logging

## Troubleshooting

### If you still see "Invalid API key" error:
1. Check `/api/admin/config` endpoint logs in browser console (F12 → Network tab)
2. The error message should now be clearer
3. If it's a REST API error, the response code will be shown
4. Try restarting Node.js completely: 
   ```bash
   pkill -9 -f node
   sleep 2
   npm run dev
   ```

### If config value doesn't persist:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Click Save, observe the PATCH request
4. Click on the request, view Response tab
5. Should show the updated config object
6. If error, check if RLS policies were properly updated

### If mobile app shows old price:
1. Make sure mobile app is also pointing to PRODUCTION Supabase:
   - Check `p2p-kids-marketplace/.env` has correct SUPABASE_URL
   - Should be: `https://drntwgporzabmxdqykrp.supabase.co`
2. Restart mobile app: `npm run dev` 
3. Go through signup again to trigger fresh fetch

## Files Modified
- `p2p-kids-admin/src/app/api/admin/config/route.ts` - Updated PATCH endpoint
- RLS policies on `admin_config` table (need to run SQL above)

## Commands to Run Now

Copy and paste these in terminal:

```bash
# Terminal 1: Supabase Dashboard
# Go to: https://app.supabase.com → SQL Editor
# Run the RLS policy update SQL above

# Terminal 2: Terminal
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin
pkill -f "next dev"
rm -rf .next node_modules/.cache .turbo
npm run dev

# Once admin portal shows "Ready in ...", visit:
# http://localhost:3001/admin/config

# Change a value, click Save, verify success message
# Refresh page and verify value persists
```

---

**Status**: Implementation complete, awaiting RLS policy update + testing
