# BADGES-V2-007: RLS Fix - Edge Function Deployment

**Issue:** Icon upload fails with "new row violates row-level security policy"  
**Root Cause:** RLS policy on badges table prevents anon key from updating records  
**Solution:** Edge Function with service role key

---

## 🔧 Quick Fix (3 Steps)

### Step 1: Deploy Edge Function to Supabase

```bash
cd supabase/functions
supabase functions deploy badges-update-icon
```

**Expected Output:**
```
✓ Successfully deployed function badges-update-icon
```

If you get an error about Supabase CLI not found:
```bash
# Install Supabase CLI first
npm install -g supabase

# Then deploy
supabase functions deploy badges-update-icon
```

### Step 2: Verify Deployment

Check in Supabase Dashboard:
1. Go to **Edge Functions** section
2. Look for `badges-update-icon` function
3. Should show as "Active"

### Step 3: Test Icon Upload Again

1. Navigate to `/badges`
2. Click "Edit" on any badge
3. Click "Upload New Icon"
4. Upload a PNG/JPEG image
5. Should now succeed ✅

---

## 🤔 What Was Fixed

**Before (Broken):**
```typescript
// This uses anon key → RLS policies apply → FAILS
const { error } = await supabase
  .from('badges')
  .update({ icon_url: publicUrl })
  .eq('id', badge.id);
```

**After (Fixed):**
```typescript
// Edge Function uses service role → RLS bypassed → SUCCEEDS
const response = await fetch('/functions/v1/badges-update-icon', {
  headers: { 'Authorization': `Bearer ${jwt}` }
  body: { badge_id, icon_url }
});
```

---

## 📁 Files Changed

1. **Created:** `supabase/functions/badges-update-icon/index.ts`
   - New Edge Function
   - Uses service role key
   - Verifies admin access
   - Logs audit entry

2. **Updated:** `p2p-kids-admin/src/app/badges/BadgeEditor.tsx`
   - Calls Edge Function instead of direct DB update
   - Passes JWT token for auth verification
   - Better error handling

---

## 🔐 Security Details

The Edge Function:
- ✅ Verifies JWT token (user is authenticated)
- ✅ Checks `is_admin` flag (user is admin)
- ✅ Uses service role key (bypasses RLS safely)
- ✅ Logs to audit_logs table
- ✅ Returns helpful error messages

---

## ⚠️ Troubleshooting

### Issue: Supabase CLI not installed
```bash
npm install -g supabase
supabase functions deploy badges-update-icon
```

### Issue: "Function not found" error after upload
```bash
# Check function exists
supabase functions list

# If missing, redeploy
supabase functions deploy badges-update-icon
```

### Issue: Still getting RLS error
**Solution:** Your Supabase project may have RLS enabled on badges table.

**Option A: Disable RLS on badges table (if badges should be admin-managed)**
```sql
-- In Supabase SQL Editor:
ALTER TABLE badges DISABLE ROW LEVEL SECURITY;
```

**Option B: Add RLS policy for anon users (more secure)**
```sql
-- Allow authenticated users to select badges
CREATE POLICY "Anyone can view badges"
ON badges FOR SELECT
USING (true);

-- Allow authenticated admins to update badges
CREATE POLICY "Admins can update badges"
ON badges FOR UPDATE
USING (auth.uid() IN (
  SELECT id FROM auth.users 
  WHERE raw_user_meta_data->>'is_admin' = 'true'
));
```

---

## 📝 Next Steps

1. **Deploy function:**
   ```bash
   cd supabase/functions
   supabase functions deploy badges-update-icon
   ```

2. **Test TC-003 again:**
   - Upload badge icon
   - Verify success message
   - Check icon displays in list

3. **Run tests:**
   ```bash
   cd p2p-kids-admin
   npm test
   ```

---

## 🎯 Expected Result

After deploying Edge Function:
- ✅ Icon uploads successfully
- ✅ Public URL generated
- ✅ Badge record updated
- ✅ Icon displays in badge list
- ✅ No RLS errors

---

**Ready? Deploy the function now! 🚀**
