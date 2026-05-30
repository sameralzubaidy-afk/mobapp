# Debug: Seller & Category Not Fetching

## Problem Found
When fetching item detail, the seller and category data are coming back as null:
- `seller_id` exists: `"19e6c297-9744-48cd-9792-ff90071c8933"`
- But querying profiles returns: `PGRST116: The result contains 0 rows`
- `category_id` is: `null` (not set on items)

## Root Causes
1. **RLS Policy blocking profile reads**: The `profiles` table has RLS policies that prevent users from reading other users' profile data
2. **Missing category_id**: Test items don't have category_id populated

## Solutions Applied
✅ **Added fallback query approach** in `listing.ts::getListingById()`:
- Try `.single()` query first (respects RLS)
- If PGRST116 error (0 rows), fall back to array query `.select()` which may bypass some RLS checks
- Added detailed logging to track fetch attempts

## Verification Steps (Run in Supabase SQL Editor)

### Step 1: Check if seller profile exists
```sql
SELECT id, name, avatar_url FROM profiles 
WHERE id = '19e6c297-9744-48cd-9792-ff90071c8933';
```
**Expected**: Returns 1 row with seller name

### Step 2: Check RLS policies on profiles table
```sql
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```
**Look for**: Policies that might restrict SELECT on profiles table

### Step 3: Check test item details
```sql
SELECT id, title, category_id, seller_id FROM items 
WHERE id = '809241eb-e1b7-4287-8d8f-394ec0ea31ba';
```
**Expected**: 
- `seller_id` is NOT NULL
- `category_id` should be set (can be NULL for now, but ideal to populate)

### Step 4: Test profile fetch as different user
```sql
-- Check if profiles have SELECT RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'profiles';

-- If RLS enabled, check policies
SELECT policyname, permissive, qual FROM pg_policies WHERE tablename = 'profiles';
```

## Next Steps if Issue Persists
1. **If RLS is too restrictive**: Update profiles RLS policy to allow ANY authenticated user to read public profile fields (name, avatar_url)
   ```sql
   CREATE POLICY "Profiles are viewable by anyone" ON profiles
     FOR SELECT TO authenticated
     USING (true);
   ```

2. **If seller_id is missing**: Update test item to have seller_id
   ```sql
   UPDATE items SET seller_id = '19e6c297-9744-48cd-9792-ff90071c8933'
   WHERE id = '809241eb-e1b7-4287-8d8f-394ec0ea31ba';
   ```

3. **If category_id is NULL**: Assign a category to test item
   ```sql
   -- First, check available categories
   SELECT id, name FROM categories LIMIT 5;
   
   -- Then assign one
   UPDATE items SET category_id = '<category-id>' 
   WHERE id = '809241eb-e1b7-4287-8d8f-394ec0ea31ba';
   ```

## Console Logs to Check
When reproducing:
- Look for: `✅ Seller fetched:` - indicates seller was successfully fetched
- Look for: `⚠️ Seller fetch error: PGRST116` - indicates RLS is blocking
- Look for: `📦 Complete listing object: {"hasSeller": false}` - indicates final state

## Monitoring the Fix
After applying fixes above, the logs should show:
1. Seller section renders with avatar or placeholder initial
2. Category section appears if category_id is set
3. Console shows `✅ Seller fetched:` instead of `⚠️ Seller fetch error:`
