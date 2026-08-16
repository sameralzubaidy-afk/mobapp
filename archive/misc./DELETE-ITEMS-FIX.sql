-- ================================================================
-- COPY-PASTE READY: Fix Deleted Items Not Showing in Search
-- ================================================================
-- This SQL adds admin viewing permissions to items table RLS policy
-- After running: Deleted items will appear in admin search
-- ================================================================

-- Drop old restrictive policy
DROP POLICY IF EXISTS "Anyone can view available items" ON items;

-- Create new policies

-- 1. Public users can see available items
CREATE POLICY "Public can view available items" ON items
  FOR SELECT USING (status = 'available');

-- 2. Sellers can see their own items (all statuses)
CREATE POLICY "Sellers can view own items" ON items
  FOR SELECT USING (seller_id = auth.uid());

-- 3. Admins can see ALL items (including deleted) ← THE FIX
-- Uses JWT metadata check (doesn't require auth.users table access)
CREATE POLICY "Admins can view all items" ON items
  FOR SELECT USING (
    (auth.jwt() ->> 'raw_user_meta_data')::jsonb ->> 'is_admin' = 'true'
  );
