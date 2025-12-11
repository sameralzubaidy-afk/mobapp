-- Migration: 002_rls_admin_fix.sql
-- Purpose: Avoid infinite recursion in RLS policies by using a SECURITY DEFINER function
-- Instructions: Run this from Supabase SQL Editor as the DB owner or via a service_role key

-- 1) Create a security-definer function that checks whether the current user is an admin.
--    This function runs with owner privileges and avoids RLS recursion when used inside policies.
CREATE OR REPLACE FUNCTION public.is_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;
  SELECT role INTO v_role FROM public.users WHERE id = p_uid;
  RETURN (v_role = 'admin');
END;
$$;

-- Note: Ensure the function owner is a database superuser or another appropriate owner
-- (the SQL editor should run this as the DB owner in Supabase.)

-- 2) Replace RLS policies that used queries on `users` (which caused recursion) with calls to public.is_admin().
-- Drop and recreate policies for users and other tables that relied on checking the role in the users table.

-- USERS
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all users" ON public.users
  FOR UPDATE USING (public.is_admin());

-- NODES
DROP POLICY IF EXISTS "Admins can manage nodes" ON public.nodes;
CREATE POLICY "Admins can manage nodes" ON public.nodes
  FOR ALL USING (public.is_admin());

-- ITEMS
DROP POLICY IF EXISTS "Admins can manage all items" ON public.items;
CREATE POLICY "Admins can manage all items" ON public.items
  FOR ALL USING (public.is_admin());

-- TRADES
DROP POLICY IF EXISTS "Admins can view all trades" ON public.trades;
CREATE POLICY "Admins can view all trades" ON public.trades
  FOR SELECT USING (public.is_admin());

-- MESSAGES - let admin view messages (only changed if previously used users query)
DROP POLICY IF EXISTS "Admins can view messages" ON public.messages;
CREATE POLICY "Admins can view messages" ON public.messages
  FOR SELECT USING (public.is_admin());

-- MODERATION_QUEUE
DROP POLICY IF EXISTS "Admins can view moderation queue" ON public.moderation_queue;
DROP POLICY IF EXISTS "Admins can manage queue" ON public.moderation_queue;
CREATE POLICY "Admins can view moderation queue" ON public.moderation_queue
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can manage queue" ON public.moderation_queue
  FOR ALL USING (public.is_admin());

-- AI_MODERATION_LOGS
DROP POLICY IF EXISTS "Admins can view AI logs" ON public.ai_moderation_logs;
CREATE POLICY "Admins can view AI logs" ON public.ai_moderation_logs
  FOR SELECT USING (public.is_admin());

-- CPSC_RECALLS
DROP POLICY IF EXISTS "Admins can manage recalls" ON public.cpsc_recalls;
CREATE POLICY "Admins can manage recalls" ON public.cpsc_recalls
  FOR ALL USING (public.is_admin());

-- BOOST_LISTINGS
DROP POLICY IF EXISTS "Admins can view all boosts" ON public.boost_listings;
CREATE POLICY "Admins can view all boosts" ON public.boost_listings
  FOR SELECT USING (public.is_admin());

-- POINTS_TRANSACTIONS
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.points_transactions;
CREATE POLICY "Admins can view all transactions" ON public.points_transactions
  FOR SELECT USING (public.is_admin());

-- ADMIN_CONFIG
DROP POLICY IF EXISTS "Admins can manage config" ON public.admin_config;
CREATE POLICY "Admins can manage config" ON public.admin_config
  FOR ALL USING (public.is_admin());

-- SUBSCRIPTION_TIERS
DROP POLICY IF EXISTS "Admins can manage tiers" ON public.subscription_tiers;
CREATE POLICY "Admins can manage tiers" ON public.subscription_tiers
  FOR ALL USING (public.is_admin());

-- If you have other policies referencing the users table directly, replace those with public.is_admin() as well.

-- 3) Optional: sanity check helper function (can be used to test as the DB owner)
-- SELECT public.is_admin();  -- returns boolean for current session user (auth.uid())

-- Note: Run this migration with a superuser or service role to avoid RLS blocking when creating the function.
