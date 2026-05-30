# DISCOVERY-V3-002 Manual Testing Guide

**Module:** MODULE-05-DISCOVERY-V3-FILTERS  
**Task:** DISCOVERY-V3-002 - Rewrite `search_listings` RPC + Add `get_popular_brands`  
**Date:** April 21, 2026  
**Platform:** iOS & Android Simulators  

---

## 🎯 PREREQUISITE: Run SQL in Supabase Dashboard

⚠️ **IMPORTANT:** Before running any tests, you MUST apply the migration SQL first.

### Step 1: Open Supabase Dashboard
1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**

### Step 2: Apply Migration
1. Copy the entire contents of `supabase/migrations/20260420000002_update_search_listings_rpc.sql`
2. Paste into SQL Editor
3. Click **Run**
4. Verify success message

### Step 3: Verify Migration
Run these verification queries in SQL Editor:

```sql
-- Verify new function signature (should show 13 params)
SELECT proname, pg_get_function_arguments(oid) AS signature
FROM pg_proc 
WHERE proname = 'search_listings' AND pronamespace = 'public'::regnamespace;

-- Verify get_popular_brands exists
SELECT proname, pg_get_function_arguments(oid) AS signature
FROM pg_proc 
WHERE proname = 'get_popular_brands' AND pronamespace = 'public'::regnamespace;
```

Expected output:
- `search_listings` with 13 parameters
- `get_popular_brands` with 1 parameter

---

## 🧪 TEST SUITE

### **TC-001: Basic Search (No Filters)**
**Objective:** Verify search returns results with relevance scoring

**Steps:**
1. Open Supabase SQL Editor
2. Run:
   ```sql
   SELECT id, title, price, relevance 
   FROM search_listings('bike') 
   LIMIT 5;
   ```

**Expected Result:**
- ✅ Returns 5 or fewer items
- ✅ All items have `status = 'available'`
- ✅ `relevance` column exists and contains values (0.5 to 2.0)
- ✅ Items with "bike" in title have higher relevance (1.5 or 2.0)

---

### **TC-002: Empty Query (Browse All)**
**Objective:** Verify empty query returns all active listings

**Steps:**
1. Run:
   ```sql
   SELECT id, title, relevance 
   FROM search_listings('', FALSE, 10) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Returns up to 10 active items
- ✅ All have `relevance = 1.0` (default for no query)
- ✅ Sorted by `created_at DESC` (newest first)

---

### **TC-003: Multi-Category Filter**
**Objective:** Verify multi-category array filter works

**Prerequisites:**
- Get 2 category UUIDs from your database:
  ```sql
  SELECT id, name FROM categories LIMIT 2;
  ```

**Steps:**
1. Replace `<uuid1>` and `<uuid2>` with actual UUIDs
2. Run:
   ```sql
   SELECT id, title, category_id 
   FROM search_listings(
     p_query := '',
     p_category_ids := ARRAY['<uuid1>'::UUID, '<uuid2>'::UUID]
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Returns only items from the specified categories
- ✅ All `category_id` values match one of the UUIDs

---

### **TC-004: Color Filter (Array Overlap)**
**Objective:** Verify color filter uses array overlap operator

**Steps:**
1. Run:
   ```sql
   SELECT id, title, color 
   FROM search_listings(
     p_query := '',
     p_colors := ARRAY['blue', 'red']
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Returns only items that have 'blue' OR 'red' in their `color` array
- ✅ Each item's `color` array contains at least one of ['blue', 'red']

---

### **TC-005: Brand Filter (Case-Insensitive)**
**Objective:** Verify brand filter is case-insensitive

**Prerequisites:**
- Get a brand name from your database:
  ```sql
  SELECT brand, COUNT(*) FROM items 
   WHERE brand IS NOT NULL AND brand != '' 
   GROUP BY brand LIMIT 1;
  ```

**Steps:**
1. Replace `<brand>` with actual brand name
2. Test UPPERCASE:
   ```sql
   SELECT id, title, brand 
   FROM search_listings(
     p_query := '',
     p_brand := '<BRAND_UPPERCASE>'
   ) 
   LIMIT 5;
   ```
3. Test lowercase:
   ```sql
   SELECT id, title, brand 
   FROM search_listings(
     p_query := '',
     p_brand := '<brand_lowercase>'
   ) 
   LIMIT 5;
   ```

**Expected Result:**
- ✅ Both queries return the same results
- ✅ All results have matching brand (case-insensitive)

---

### **TC-006: Price Range Filter**
**Objective:** Verify price min/max bounds work

**Steps:**
1. Run:
   ```sql
   SELECT id, title, price 
   FROM search_listings(
     p_query := '',
     p_min_price := 10,
     p_max_price := 50
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ All items have `price >= 10` AND `price <= 50`
- ✅ No items outside this range

---

### **TC-007: Sort by Price Ascending**
**Objective:** Verify price_asc sort works

**Steps:**
1. Run:
   ```sql
   SELECT id, title, price 
   FROM search_listings(
     p_query := '',
     p_sort_by := 'price_asc'
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Prices are in ascending order (low to high)
- ✅ First item has lowest price, last item has highest

---

### **TC-008: Sort by Price Descending**
**Objective:** Verify price_desc sort works

**Steps:**
1. Run:
   ```sql
   SELECT id, title, price 
   FROM search_listings(
     p_query := '',
     p_sort_by := 'price_desc'
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Prices are in descending order (high to low)
- ✅ First item has highest price, last item has lowest

---

### **TC-009: Sort by Newest**
**Objective:** Verify newest sort works

**Steps:**
1. Run:
   ```sql
   SELECT id, title, created_at 
   FROM search_listings(
     p_query := '',
     p_sort_by := 'newest'
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Items sorted by `created_at DESC`
- ✅ Most recent item first, oldest item last

---

### **TC-010: Condition Filter**
**Objective:** Verify condition filter works

**Steps:**
1. Run:
   ```sql
   SELECT id, title, condition 
   FROM search_listings(
     p_query := '',
     p_condition := 'like_new'
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ All items have `condition = 'like_new'`

---

### **TC-011: Age Group Filter**
**Objective:** Verify age_group filter works

**Steps:**
1. Run:
   ```sql
   SELECT id, title, age_group 
   FROM search_listings(
     p_query := '',
     p_age_group := '6-8'
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ All items have `age_group = '6-8'`

---

### **TC-012: Gender Filter**
**Objective:** Verify gender filter works

**Steps:**
1. Run:
   ```sql
   SELECT id, title, gender 
   FROM search_listings(
     p_query := '',
     p_gender := 'unisex'
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ All items have `gender = 'unisex'`

---

### **TC-013: SP Eligible Filter**
**Objective:** Verify SP-eligible-only filter works

**Steps:**
1. Run:
   ```sql
   SELECT id, title, accepts_swap_points 
   FROM search_listings(
     p_query := '',
     p_sp_eligible_only := TRUE
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ All items have `accepts_swap_points = true`

---

### **TC-014: Pagination (Offset)**
**Objective:** Verify pagination works without duplicates

**Steps:**
1. Get page 1:
   ```sql
   SELECT id, title FROM search_listings('', FALSE, 5, 0) LIMIT 5;
   ```
2. Get page 2:
   ```sql
   SELECT id, title FROM search_listings('', FALSE, 5, 5) LIMIT 5;
   ```

**Expected Result:**
- ✅ No overlapping IDs between page 1 and page 2
- ✅ Both pages return up to 5 items

---

### **TC-015: Combined Filters (AND Logic)**
**Objective:** Verify multiple filters work together with AND logic

**Steps:**
1. Run:
   ```sql
   SELECT id, title, condition, age_group, price 
   FROM search_listings(
     p_query := '',
     p_condition := 'good',
     p_age_group := '6-8',
     p_min_price := 10,
     p_max_price := 100
   ) 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ All items match ALL filters:
  - `condition = 'good'`
  - `age_group = '6-8'`
  - `price >= 10 AND price <= 100`

---

### **TC-016: get_popular_brands (Basic)**
**Objective:** Verify get_popular_brands returns brands ordered by count

**Steps:**
1. Run:
   ```sql
   SELECT brand, item_count 
   FROM get_popular_brands(10);
   ```

**Expected Result:**
- ✅ Returns up to 10 brands
- ✅ Sorted by `item_count DESC` (highest count first)
- ✅ No NULL or empty brand names

---

### **TC-017: get_popular_brands (Default Limit)**
**Objective:** Verify default limit is 50

**Steps:**
1. Run:
   ```sql
   SELECT COUNT(*) as total_brands FROM get_popular_brands();
   ```

**Expected Result:**
- ✅ Returns at most 50 brands

---

### **TC-018: Relevance Scoring Priority**
**Objective:** Verify FTS match > title ILIKE > description ILIKE

**Steps:**
1. Run:
   ```sql
   SELECT id, title, description, relevance 
   FROM search_listings('bike') 
   LIMIT 10;
   ```

**Expected Result:**
- ✅ Items with exact "bike" match in title: `relevance = 2.0`
- ✅ Items with "bike" substring in title: `relevance = 1.5`
- ✅ Items with "bike" in description only: `relevance = 1.0`
- ✅ Results sorted by relevance DESC (highest first)

---

### **TC-019: No Results Handling**
**Objective:** Verify graceful handling of no matches

**Steps:**
1. Run:
   ```sql
   SELECT id, title FROM search_listings('xyznonexistentquerystringabc123');
   ```

**Expected Result:**
- ✅ Returns empty result set (0 rows)
- ✅ No error

---

### **TC-020: Performance (< 200ms with 3 filters)**
**Objective:** Verify performance target

**Steps:**
1. Use Supabase SQL Editor "Analyze" tab
2. Run:
   ```sql
   EXPLAIN ANALYZE 
   SELECT id, title FROM search_listings(
     p_query := 'toy',
     p_condition := 'good',
     p_min_price := 10,
     p_max_price := 100
   ) 
   LIMIT 20;
   ```

**Expected Result:**
- ✅ Execution time < 200ms
- ✅ Query plan uses indexes (`idx_items_age_group`, `idx_items_price`, etc.)

---

## 📊 VERIFICATION SUMMARY

After completing all test cases, verify:

- [ ] TC-001 to TC-015: All search filters work correctly ✅
- [ ] TC-016 to TC-017: `get_popular_brands` works ✅
- [ ] TC-018: Relevance scoring is correct ✅
- [ ] TC-019: No results handled gracefully ✅
- [ ] TC-020: Performance target met (< 200ms) ✅

---

## 🔍 TROUBLESHOOTING

### Issue: "function search_listings(text, boolean, integer) does not exist"
**Solution:** Old V2 function still referenced. Verify migration ran successfully:
```sql
SELECT proname FROM pg_proc WHERE proname = 'search_listings';
```

### Issue: Color filter returns no results
**Solution:** Verify color column is TEXT[] not TEXT:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='items' AND column_name='color';
```

### Issue: Slow performance (> 200ms)
**Solution:** Verify partial indexes exist:
```sql
SELECT indexname FROM pg_indexes 
WHERE tablename = 'items' AND indexname LIKE 'idx_items_%';
```
Expected indexes:
- `idx_items_age_group`
- `idx_items_gender`
- `idx_items_brand`
- `idx_items_color`
- `idx_items_price`
- `idx_items_category_price`

---

## ✅ SIGN-OFF

| Role | Name | Date | Pass/Fail |
|------|------|------|-----------|
| Developer | | | |
| QA | | | |
| Tech Lead | | | |

**Notes:**
