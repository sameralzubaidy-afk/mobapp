# QUICK FIX: Deleted Items Not Showing (30-Second Version)

## The Problem
- ❌ Search shows: "Results (0)" for deleted items
- ✅ Analytics shows: "Deleted Listings: 1"
- Root cause: RLS policy blocks admin access to deleted items

## The Fix (Copy-Paste)

**Step 1**: Go to https://app.supabase.com → SQL Editor → New Query

**Step 2**: Copy & Paste this:
```sql
DROP POLICY IF EXISTS "Anyone can view available items" ON items;
CREATE POLICY "Public can view available items" ON items FOR SELECT USING (status = 'available');
CREATE POLICY "Sellers can view own items" ON items FOR SELECT USING (seller_id = auth.uid());
CREATE POLICY "Admins can view all items" ON items FOR SELECT USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_user_meta_data->>'is_admin' = 'true'));
```

**Step 3**: Click "Run"

**Step 4**: Hard refresh browser (`Cmd+Shift+R`)

**Step 5**: Admin Portal → Listings → Search & Manage → Status: "Deleted" → Search

✅ Should now show "Results (1)" with the deleted item!

---

## Also Fixed in Code
- TypeScript interface updated ✅
- Status mapping corrected ✅
- Compilation: 0 errors ✅
