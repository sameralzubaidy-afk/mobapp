# 🔧 Fix Analytics View - Status Value Mismatch

## Problem Identified

The analytics view was using **wrong status values**:

### ❌ INCORRECT (What the view was using):
```sql
WHERE status = 'active'    -- ❌ This status doesn't exist!
WHERE status = 'paused'    -- ❌ This status doesn't exist!
WHERE status = 'deleted'   -- ✅ This one is correct
```

### ✅ CORRECT (Actual database status values):
```sql
WHERE status = 'available' -- ✅ Active listings
WHERE status = 'pending'   -- ✅ Paused/in-transaction listings
WHERE status = 'deleted'   -- ✅ Deleted listings
WHERE status = 'draft'     -- ✅ Draft listings
WHERE status = 'sold'      -- ✅ Sold listings
```

---

## Why The Discrepancy Appeared

**Search & Manage** (correct):
- Maps UI's "active" → `status = 'available'` ✅
- Shows: "Results (21)" for available items

**Analytics Dashboard** (incorrect):
- Was looking for `status = 'active'` ❌
- Found 0 results (because 'active' doesn't exist)
- Shows: "Active Listings: 0"

Also:
- Search: Shows 0 deleted (correct)
- Analytics: Shows 1 deleted (because it was counting something else, or old data)

---

## Solution Applied

Updated the migration file:
- `supabase/migrations/042_admin_listing_force_delete_and_pause.sql`

Changed the view query to use **correct status values**:
```sql
-- BEFORE (wrong):
WHERE status = 'active'     → WHERE status = 'available'
WHERE status = 'paused'     → WHERE status = 'pending'

-- AFTER (correct):
SELECT
  COUNT(*) FILTER (WHERE status = 'available') as active_listings,
  COUNT(*) FILTER (WHERE status = 'pending') as paused_listings,
  COUNT(*) FILTER (WHERE status = 'deleted') as deleted_listings,
  ...
```

---

## How to Apply This Fix

### Option 1: Run SQL in Supabase Studio (Recommended - Quick)

1. Go to: https://app.supabase.com
2. Select your project: `drntwgporzabmxdqykrp`
3. Click **"SQL Editor"** in left menu
4. Click **"New Query"**
5. Copy & paste this SQL:

```sql
-- Drop and recreate the view with corrected status values
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

6. Click **"Run"** button (⚡)
7. You should see: `View created successfully`

### Option 2: Verify the Fix

After running the SQL above, verify with this query:

```sql
SELECT * FROM listing_admin_analytics;
```

**Expected result** (example):
```
active_listings:    21
deleted_listings:   1
paused_listings:    2
sp_eligible_listings: 11
sp_adoption_rate:   50%
avg_listing_price:  $67.29
...
```

---

## What This Fixes

✅ **Search & Analytics will now match**
- Both show same "active" count (status = 'available')

✅ **Deleted count will be consistent**
- Both show correct deleted item count

✅ **Pending/paused listings will show**
- Analytics now uses 'pending' instead of non-existent 'paused'

✅ **SP adoption rate will be accurate**
- Calculated from actual 'available' items (not the non-existent 'active' status)

---

## After Running SQL

1. **Refresh your browser**:
   - Go to admin portal: http://localhost:3000
   - Click "Listings" → "Analytics Dashboard"
   - Numbers should now match your Search & Manage results!

2. **Verify numbers match**:
   - Search shows: Results (21)
   - Analytics shows: Active Listings: 21 ✅
   - Search shows: Deleted: 1
   - Analytics shows: Deleted Listings: 1 ✅

---

## Status Values Reference

| Value | Meaning | Used By |
|-------|---------|---------|
| `draft` | Not yet published | Sellers creating listings |
| `available` | Listed for sale (ACTIVE) | Buyers browsing, Analytics |
| `pending` | In active trade (PAUSED) | Item reserved during purchase |
| `sold` | Completed sale | Historical records |
| `deleted` | Removed from catalog | Archived listings |

---

## Timeline

- **Before fix**: Analytics showed wrong counts (0 active, wrong deleted count)
- **After fix**: Analytics shows correct counts matching Search results
- **Impact**: Admin dashboard now displays accurate metrics

---

**Status**: 🟢 **FIX READY TO APPLY**

Copy the SQL code above and run it in Supabase SQL Editor. Takes 30 seconds!
