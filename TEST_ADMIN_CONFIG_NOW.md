# ✅ Admin Portal Restarted - NOW TEST THE FIX

## Status: ✅ Admin Portal Running
- URL: http://localhost:3001
- Port: 3001
- Status: Ready
- API Routes: Loaded with fresh environment variables

## 🧪 Test the Fix (5 minutes)

### Step 1: Open Admin Portal Config Page
1. Open browser
2. Go to: **http://localhost:3001/config**
3. Scroll to "Subscription" category
4. Find "Subscription Price Monthly" field
5. Current value should be: **7.99** (or 12.00 if from previous attempt)

### Step 2: Change the Price
1. Click on the input field next to "Subscription Price Monthly"
2. Clear the current value
3. Type new value: **14.99**
4. Click the blue **"Save"** button

### Step 3: Watch for Success Message
You should see a **GREEN** message appear:
```
✅ Successfully updated subscription_price_monthly
```

**IMPORTANT**: Check the browser console (F12) for debug logs:
```
[Config Save] Attempting to save subscription_price_monthly with value: 14.99
[Config Save] Response status: 200
[Config Save] ✅ Success! Updated: subscription_price_monthly = 14.99
```

### Step 4: Refresh the Page
1. Press **F5** (or Cmd+R on Mac) to refresh
2. Page reloads
3. Scroll to "Subscription Price Monthly"
4. Value should still show: **14.99** ✅

If it shows **7.99**, there's still an issue. Check:
- Did you see the green success message?
- Did the console show error logs?
- Is the admin portal port 3001 correct?

### Step 5: Verify in Database (Optional)
To double-check the value was saved:

1. Go to: https://app.supabase.com
2. Select project: **kids_marketplace_app**
3. Click **SQL Editor**
4. Click **+ New Query**
5. Run this SQL:
```sql
SELECT key, value, updated_at 
FROM admin_config 
WHERE key = 'subscription_price_monthly' 
LIMIT 1;
```

Expected result:
| key | value | updated_at |
|-----|-------|-----------|
| subscription_price_monthly | 14.99 | 2025-12-16 (recent) |

### Step 6: Test Mobile App (Optional)
1. Start mobile app: `yarn start` in `p2p-kids-marketplace`
2. Go through signup to SubscriptionChoiceScreen
3. Should show: **"$14.99/month"** (your new price!)

## 🔍 Troubleshooting

### Issue 1: No green success message, but no error either
**Symptom**: Click Save, nothing happens
**Cause**: Admin secret header not matching
**Fix**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error about "Unauthorized"
4. Check that `.env.local` has correct `ADMIN_UI_SECRET`

### Issue 2: Error message appears
**Symptom**: Red error message like "Service role key not configured"
**Cause**: Environment variables not loaded
**Fix**:
1. Stop admin portal: Ctrl+C in terminal
2. Verify `.env.local` exists and has content:
   ```bash
   cat /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-admin/.env.local | grep SUPABASE
   ```
3. Restart: `npm run dev`
4. Check terminal output for:
   ```
   ✅ Admin API initialized with service role key
   ```

### Issue 3: Changes saved but page still shows old value after refresh
**Symptom**: Green success, but after refresh shows old value
**Cause**: Config not being reloaded from API
**Fix**:
1. Check browser console for any errors in `loadConfigFromApi()`
2. Make sure Supabase connection works: try GET request first
3. Hard refresh: Ctrl+Shift+R (clear cache)

### Issue 4: "Update did not affect any rows" error
**Symptom**: Error message: "Update did not affect any rows"
**Cause**: Database key doesn't exist or RLS blocking update
**Fix**:
1. Verify key exists in database:
   ```sql
   SELECT key FROM admin_config WHERE key = 'subscription_price_monthly';
   ```
2. Verify RLS policies exist:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'admin_config';
   ```
3. Should see policies for: SELECT, UPDATE (service_role)

## ✅ What Should Happen

```
Admin Portal (http://localhost:3001)
    ↓
Change: 7.99 → 14.99
    ↓
Click: Save
    ↓
Send: PATCH /api/admin/config
      { key: 'subscription_price_monthly', value: '14.99' }
    ↓
API validates service role key ✅
    ↓
Create Supabase client with service_role ✅
    ↓
UPDATE admin_config SET value='14.99' WHERE key='subscription_price_monthly' ✅
    ↓
Return: { data: { key: 'subscription_price_monthly', value: '14.99', updated_at: '2025-12-16...' } }
    ↓
Show: GREEN "Successfully updated subscription_price_monthly" ✅
    ↓
Reload config from API ✅
    ↓
Display: 14.99 in form field ✅
```

## 📋 Quick Checklist

Before testing, verify:
- [ ] Admin portal running on http://localhost:3001
- [ ] Can access config page
- [ ] Fields are editable (not grayed out)
- [ ] Terminal shows no errors on startup
- [ ] `.env.local` has SUPABASE_SERVICE_ROLE_KEY set
- [ ] `.env.local` has ADMIN_UI_SECRET set

## 🚀 Ready?

1. Try changing a value
2. Watch for green success message
3. Refresh page
4. Value should persist

**Report back what you see!** Include:
- Did you see green success message? (Y/N)
- What was the error message if any?
- After refresh, did value stay the same?
- Any console errors? (F12 → Console)
