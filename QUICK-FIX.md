# QUICK FIX - Copy & Paste Instructions

## STEP 1️⃣: Update RLS Policies (5 min)

1. **Open Supabase Dashboard**:
   https://app.supabase.com → Select "kids_marketplace_app" project

2. **Go to SQL Editor**:
   Left sidebar → "SQL Editor" → "+ New Query"

3. **Paste this SQL** (copy exactly):

```sql
DROP POLICY IF EXISTS "Admins can view config" ON admin_config;
DROP POLICY IF EXISTS "Admins can update config" ON admin_config;
DROP POLICY IF EXISTS "Admin config: allow update via API" ON admin_config;
DROP POLICY IF EXISTS "Admin config: public select" ON admin_config;

CREATE POLICY "admin_config_select_all"
  ON admin_config FOR SELECT
  USING (TRUE);

CREATE POLICY "admin_config_update_all"
  ON admin_config FOR UPDATE  
  USING (TRUE)
  WITH CHECK (TRUE);

SELECT policyname, cmd FROM pg_policies WHERE tablename = 'admin_config' ORDER BY policyname;
```

4. **Click "Run"**

5. **Verify output shows**:
   ```
   admin_config_select_all | SELECT
   admin_config_update_all | UPDATE
   ```

✅ If you see both policies → RLS is fixed!

---

## STEP 2️⃣: Test Admin Config Update (2 min)

1. **Admin Portal already running** on http://localhost:3001/admin/config

2. **Find** "subscription_price_monthly" field (shows 7.99)

3. **Change value** to 12.00

4. **Click "Save"**

5. **Expected result**:
   - ✅ Green success message appears
   - ✅ Refresh page, value still shows 12.00

---

## STEP 3️⃣: Verify Mobile App (2 min)

1. **Start mobile app**:
   ```bash
   cd /Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace
   npm run dev
   ```

2. **Signup or login** (takes you to SubscriptionChoiceScreen)

3. **Verify price shows 12.00** (from admin_config)

✅ If shows 12.00 → System is working end-to-end!

---

## If You Get Errors

### "Invalid API key" error
- Admin RLS policies weren't updated (go back to STEP 1)
- Or try: Refresh admin portal page (F5)

### "Cannot save config"
- Make sure you're in production Supabase (check URL is correct)
- Check browser DevTools (F12 → Network → PATCH request)

### Mobile app still shows old price
- Restart mobile app: 
  ```bash
  pkill -f "expo|react-native"
  npm run dev
  ```
- Go through signup again

---

## Status Check Commands

```bash
# Check admin portal is running
curl -s http://localhost:3001/admin/config | head -c 100

# Check RLS policies in Supabase (if you have psql)
psql postgresql://[user]:[pass]@db.drntwgporzabmxdqykrp.supabase.co/postgres \
  -c "SELECT policyname FROM pg_policies WHERE tablename='admin_config';"
```

---

## Summary of Changes

| Component | Change | Status |
|-----------|--------|--------|
| Admin API (`route.ts`) | Now uses REST API instead of Supabase client | ✅ Done |
| Mobile App (`SubscriptionChoiceScreen.tsx`) | Now uses useFocusEffect for live config | ✅ Done |
| RLS Policies | Need to allow anon key | ⏳ YOUR ACTION |
| Database | Already has all 36 config values | ✅ Done |

---

**Everything is ready! Just run the SQL in Supabase dashboard and test.**
