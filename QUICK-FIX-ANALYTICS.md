# ⚡ QUICK FIX - Apply Now (30 seconds)

## The Issue

```
Search shows: 21 active items ✅
Analytics shows: 0 active items ❌
```

**Why?** Analytics view was using wrong status values.

---

## Copy & Paste Fix

### Step 1: Go to Supabase

Open: **https://app.supabase.com**

### Step 2: Select Your Project

Click on: **`drntwgporzabmxdqykrp`** (kids marketplace)

### Step 3: Open SQL Editor

1. Click **"SQL Editor"** (left sidebar)
2. Click **"New Query"** (blue button)

### Step 4: Copy This SQL

```sql
DROP VIEW IF EXISTS listing_admin_analytics CASCADE;

CREATE VIEW listing_admin_analytics AS
SELECT
  COUNT(*) FILTER (WHERE status = 'available') as active_listings,
  COUNT(*) FILTER (WHERE status = 'deleted') as deleted_listings,
  COUNT(*) FILTER (WHERE status = 'pending') as paused_listings,
  COUNT(*) FILTER (WHERE accepts_swap_points = true) as sp_eligible_listings,
  COUNT(*) FILTER (WHERE accepts_swap_points = true AND status = 'available') as active_sp_listings,
  ROUND(100.0 * COUNT(*) FILTER (WHERE accepts_swap_points = true) / NULLIF(COUNT(*), 0), 2) as sp_adoption_rate,
  AVG(CAST(price AS DECIMAL)) as avg_listing_price,
  MIN(price) as min_listing_price,
  MAX(price) as max_listing_price,
  COUNT(DISTINCT seller_id) as total_sellers,
  COUNT(DISTINCT DATE(created_at)) as days_active
FROM items
WHERE created_at > NOW() - INTERVAL '30 days';
```

### Step 5: Paste into Editor

Select all in SQL editor: **Ctrl+A** (or **Cmd+A** on Mac)

Paste the SQL: **Ctrl+V** (or **Cmd+V** on Mac)

### Step 6: Click "Run" ⚡

Expected message:
```
View created successfully
```

### Step 7: Verify

Run this query:
```sql
SELECT * FROM listing_admin_analytics;
```

Should show numbers that match your Search results!

---

## After Running SQL

### In Your Admin Portal

1. **Hard refresh browser**:
   - Windows: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`

2. **Go to**: Listings → Analytics Dashboard

3. **Check numbers**:
   ```
   Active Listings should show: 21 ✅
   (not 0 anymore)
   ```

---

## Done! ✅

That's it! The fix is applied.

**Before**: Search (21) vs Analytics (0) ❌  
**After**: Search (21) vs Analytics (21) ✅

---

## What Changed?

One line in the view:

```diff
- WHERE status = 'active'
+ WHERE status = 'available'
```

That's all! The 'active' status didn't exist in the database. Now it queries the correct 'available' status.

---

## Total Time: ⏱️ 30 seconds

- Copy SQL: 5 sec
- Paste into Supabase: 5 sec
- Run: 2 sec
- Verify: 10 sec
- Refresh browser: 3 sec
- Confirm fix: 5 sec

---

**Status**: 🟢 **APPLY NOW**

All files are ready. Just run the SQL!
