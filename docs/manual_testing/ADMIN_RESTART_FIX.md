# 🔧 CRITICAL: Restart Admin Portal to Apply Changes

## The Problem
The admin portal needs to be **completely restarted** to pick up the new environment variables and code changes.

## Fix: Kill and Restart Admin Server

### Step 1: Stop the Current Admin Portal Process
In the terminal where admin portal is running (or new terminal):

```bash
# Kill existing process
pkill -f "next dev"

# OR if that doesn't work, do this:
lsof -ti:3001 | xargs kill -9

# Verify port is free
lsof -i :3001
# Should show: command not found or no output
```

### Step 2: Start Admin Portal Fresh
```bash
cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin

# Clear Next.js cache
rm -rf .next

# Start fresh
npm run dev
```

You should see:
```
> p2p-kids-admin@0.1.0 dev
> next dev -p 3001

  ▲ Next.js 14.x.x
  - Local:        http://localhost:3001

✅ [Admin Config API] Initializing with: {
  hasServiceKey: true,
  serviceKeyLength: 283,
  supabaseUrl: 'https://drntwgporzabmxdqykrp.supabase.co',
  hasAdminSecret: true
}
✅ Admin API initialized with service role key
```

### Step 3: Test Config Change Again
1. Open http://localhost:3001/config
2. Find "Subscription Price Monthly" (should show 7.99 or 12.00 depending on current state)
3. Change value (e.g., 7.99 → 13.00)
4. Click Save
5. **Check browser console** (F12 → Console) for:
   ```
   [Config Save] Attempting to save subscription_price_monthly with value: 13.00
   [Config Save] Response status: 200
   [Config Save] Response body: { data: {...} }
   [Config Save] ✅ Success! Updated: subscription_price_monthly = 13.00
   ```
6. You should see green "Successfully updated" message
7. Refresh page - should still show 13.00

### Step 4: Verify in Database
```bash
# Via Supabase Dashboard or CLI
SELECT key, value, updated_at FROM admin_config 
WHERE key = 'subscription_price_monthly';

# Should show: value = 13.00
```

## Why This Matters
- Environment variables (`SUPABASE_SERVICE_ROLE_KEY`, etc.) are only loaded when Node.js starts
- Code changes to API routes require restart
- Next.js builds require fresh cache

## If Still Not Working

### Check 1: Verify Environment Variables Loaded
Open any page at http://localhost:3001, then:
1. Press F12 to open Developer Tools
2. Go to Network tab
3. Reload page
4. Look for any API call in "Fetch/XHR"
5. Click on `/api/admin/config` call
6. Check "Response" tab

Should show:
```json
{
  "data": [...config items...],
  "can_write": true
}
```

If `can_write` is false:
- Service role key is not loaded
- **Restart admin portal again**

### Check 2: Verify Service Role Key
In admin portal terminal, look for this on startup:
```
✅ [Admin Config API] Initializing with: {
  hasServiceKey: true,
  serviceKeyLength: 283,  <-- Should be > 200
```

If `hasServiceKey: false` or `serviceKeyLength: 0`:
- `.env.local` file not being read
- Check file exists: `ls -la p2p-kids-admin/.env.local`
- Verify no syntax errors in `.env.local`

### Check 3: Manual API Test
In terminal:
```bash
curl -X GET "http://localhost:3001/api/admin/config" \
  -H "x-admin-secret: kids_admin_secret_2024_prod"
```

Should return config data with `"can_write": true`

If `"can_write": false`:
```bash
# Check what secret header is being sent
echo $ADMIN_UI_SECRET

# Manually test
curl -X PATCH "http://localhost:3001/api/admin/config" \
  -H "x-admin-secret: kids_admin_secret_2024_prod" \
  -H "Content-Type: application/json" \
  -d '{"key": "subscription_price_monthly", "value": "15.00"}'
```

## Expected Success Flow

```
Admin Portal Start
   ↓
✅ Load .env.local variables
   ↓
✅ Initialize API route with SERVICE_ROLE_KEY
   ↓
Admin changes price: 7.99 → 13.00
   ↓
Click Save
   ↓
API receives request with x-admin-secret header
   ↓
✅ Service role key validated
   ↓
✅ Create Supabase client with service_role key
   ↓
✅ Update admin_config table
   ↓
✅ Return updated record
   ↓
✅ Show green success message
   ↓
Reload config from API
   ↓
✅ Display new price: 13.00
```

---

**TLDR**: 
1. Kill existing admin server: `pkill -f "next dev"`
2. Restart: `cd p2p-kids-admin && npm run dev`
3. Verify startup shows `✅ Admin API initialized with service role key`
4. Test config change again
