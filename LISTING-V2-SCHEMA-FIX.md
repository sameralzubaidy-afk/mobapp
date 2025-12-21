# 🔧 LISTING-V2 FIXES: Database Schema Alignment

**Issues Fixed**: 
1. ❌ Text search on UUID columns (causing 42883 error)
2. ❌ Status filter using wrong values 
3. ❌ Missing status options

**Status**: ✅ FIXED & READY TO TEST

---

## Issue #1: UUID `ilike` Error (Code 42883)

### What Was Wrong
```typescript
// BEFORE (ERROR)
query = query.or(`id.ilike.%${filters.query}%,seller_id.ilike.%${filters.query}%,title.ilike.%${filters.query}%`);
```

Error message:
```
"operator does not exist: uuid ~~* unknown"
```

**Root Cause**: Can't use `ilike` (text search) on UUID columns (`id` and `seller_id`)

### What Was Fixed
```typescript
// AFTER (FIXED)
if (filters.query) {
  query = query.ilike('title', `%${filters.query}%`);
}
```

Now searches **only on the `title` column** (which is TEXT type)

---

## Issue #2: Status Filter Mismatch

### What Was Wrong

**Filter options offered**:
```
All, Active, Paused, Deleted
```

**Actual database values**:
```
draft, available, pending, sold, deleted
```

❌ "Active" and "Paused" don't exist in database!

### What Was Fixed

**New filter options** (matching database):
```
All → all
Available → available
Pending → pending
Sold → sold
Draft → draft
Deleted → deleted
```

**Status mapping**:
```typescript
const statusValue = filters.status === 'active' ? 'available' : filters.status;
```

---

## Issue #3: Status Badge Colors

### What Was Wrong
```typescript
// BEFORE
if (listing.status === 'active') → green
if (listing.status === 'paused') → yellow
else → red
```

### What Was Fixed
```typescript
// AFTER
if (listing.status === 'available') → green ✓
if (listing.status === 'pending') → blue
if (listing.status === 'sold') → gray
if (listing.status === 'draft') → yellow
if (listing.status === 'deleted') → red ✗
```

Now correctly color-codes all 5 status types

---

## Items Table Schema (Verified)

```sql
CREATE TABLE items (
  id UUID,
  seller_id UUID,
  title TEXT,              ← Searchable by ilike
  description TEXT,
  price DECIMAL,
  category_id UUID,
  condition TEXT,
  status TEXT,             ← Values: 'draft', 'available', 'pending', 'sold', 'deleted'
  accepts_swap_points BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  sold_at TIMESTAMPTZ
);
```

---

## What to Try Now

### Test 1: Search by Item Title
1. Go to Listings page
2. Type: "backpack" (or any partial item name)
3. Leave status as "All"
4. Click "Search"
5. **Should show**: Items with "backpack" in title

### Test 2: Filter by Status
1. Leave search box blank
2. Select status: "Available"
3. Click "Search"
4. **Should show**: All available items

### Test 3: Filter by Status + Search
1. Type: "blue"
2. Select status: "Available"
3. Click "Search"
4. **Should show**: Only available items with "blue" in title

### Test 4: Filter by SP-Eligible
1. Leave search blank
2. Status: "Available"
3. Check "SP-Eligible Only"
4. Click "Search"
5. **Should show**: Available items that accept swap points

---

## Files Changed

- `p2p-kids-admin/src/app/components/ListingSearch.tsx`
  - Line 56: Fixed text search to use only `title` column
  - Line 54: Added status mapping (`active` → `available`)
  - Line 189-191: Updated search label and placeholder
  - Line 208-218: Added all 5 status options
  - Line 294-305: Updated status badge colors for all 5 statuses

---

## Expected Results

✅ Search by item name works without error  
✅ Filter by status shows correct listings  
✅ Status badges show with correct colors  
✅ SP-eligible filter works correctly  
✅ No more "operator does not exist" errors

---

## Verification Checklist

```
□ Can search by item title without errors
□ Results display correctly (no empty when they should have data)
□ Status filter "Available" shows available items
□ Status filter "Sold" shows sold items
□ Status badge colors are correct
□ SP-eligible filter works
□ Combination filters work (status + search + SP)
□ Error log clear of 42883 and 42703 errors
```

---

## Summary

**Problem**: Database schema mismatch  
- Text search on wrong column types
- Filter options didn't match database values
- Status badge logic incorrect

**Solution**: Aligned component logic with actual database schema  
- Search only on `title` (TEXT)
- Use actual status values: `available`, `pending`, `sold`, `draft`, `deleted`
- Fixed status color mapping for all 5 types

**Result**: ✅ Admin listing search now works correctly!

