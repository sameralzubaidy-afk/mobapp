-- filepath: supabase/migrations/071_enable_rls_and_policies_trades.sql

-- Mode B: Idempotent rerunnable migration
-- Enable Row Level Security on trades and create SELECT policy so only trade participants can view trades.

-- 1. Enable RLS on trades
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing select policy if present and add the restrictive one
DROP POLICY IF EXISTS "Users can view own trades" ON trades;
CREATE POLICY "Users can view own trades"
  ON trades FOR SELECT
  USING (
    buyer_id = auth.uid() OR seller_id = auth.uid()
  );

-- 3. Also add a policy that allows the trade creator or service to insert trades
DROP POLICY IF EXISTS "Users can insert trades" ON trades;
CREATE POLICY "Users can insert trades"
  ON trades FOR INSERT
  WITH CHECK (
    (buyer_id = auth.uid() OR seller_id = auth.uid())
  );

-- 4. Update policy for updates: allow buyer or seller to update specific fields via RPCs; keep this conservative
DROP POLICY IF EXISTS "Users can update their trades" ON trades;
CREATE POLICY "Users can update their trades"
  ON trades FOR UPDATE
  USING (buyer_id = auth.uid() OR seller_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid() OR seller_id = auth.uid());

-- Verification queries:
-- 1) Check RLS is enabled and policies exist:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'trades';
-- Use the correct columns from pg_policies to inspect policies
-- SELECT policyname, schemaname, tablename, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'trades';

-- 2) Test as a user (run in SQL editor with "Run as role: <test-user session token>"):
-- SELECT id, listing_id, status, created_at FROM trades WHERE buyer_id = '<TEST_BUYER_ID>' OR seller_id = '<TEST_BUYER_ID>' LIMIT 10;

-- 3) Confirm other users cannot see unrelated trades (run as different test user):
-- SELECT id FROM trades LIMIT 5; -- should return only trades where that user is buyer or seller
