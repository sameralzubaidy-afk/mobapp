-- NODE-003: Automatic Node Assignment on Signup with Waitlist Support
-- File: supabase/migrations/006_resolve_active_node_and_waitlist.sql
-- 
-- Creates:
-- 1. resolve_active_node_for_signup() RPC - finds exact ZIP match OR nearest active node
-- 2. zip_waitlist table - stores users who requested non-active ZIPs
-- 3. increment/decrement node member count RPCs

-- ============================================================================
-- 1. CREATE ZIP WAITLIST TABLE (only if nodes table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nodes') THEN
    CREATE TABLE IF NOT EXISTS public.zip_waitlist (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      requested_zip TEXT NOT NULL,
      assigned_node_id UUID REFERENCES public.nodes(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'joined')),
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT zip_waitlist_unique UNIQUE (user_id, requested_zip)
    );
  END IF;
END $$;

-- Enable RLS on zip_waitlist (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zip_waitlist') THEN
    ALTER TABLE public.zip_waitlist ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS: Users can only view/insert their own waitlist entries
-- Drop and recreate policies safely (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zip_waitlist') THEN
    DROP POLICY IF EXISTS "zip_waitlist_user_select" ON public.zip_waitlist;
    DROP POLICY IF EXISTS "zip_waitlist_user_insert" ON public.zip_waitlist;
    DROP POLICY IF EXISTS "zip_waitlist_user_update" ON public.zip_waitlist;
    DROP POLICY IF EXISTS "zip_waitlist_admin_all" ON public.zip_waitlist;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'zip_waitlist') THEN
    CREATE POLICY "zip_waitlist_user_select" ON public.zip_waitlist
      FOR SELECT USING (auth.uid() = user_id);

    CREATE POLICY "zip_waitlist_user_insert" ON public.zip_waitlist
      FOR INSERT WITH CHECK (auth.uid() = user_id);

    CREATE POLICY "zip_waitlist_user_update" ON public.zip_waitlist
      FOR UPDATE USING (auth.uid() = user_id);

    -- RLS: Admin can view all waitlist entries (for monitoring/notifications)
    CREATE POLICY "zip_waitlist_admin_all" ON public.zip_waitlist
      FOR ALL USING ((SELECT is_admin(auth.uid())));

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_zip_waitlist_user_id ON public.zip_waitlist(user_id);
    CREATE INDEX IF NOT EXISTS idx_zip_waitlist_requested_zip ON public.zip_waitlist(requested_zip);
    CREATE INDEX IF NOT EXISTS idx_zip_waitlist_status ON public.zip_waitlist(status);
    CREATE INDEX IF NOT EXISTS idx_zip_waitlist_created_at ON public.zip_waitlist(created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- 2. CREATE RPC: resolve_active_node_for_signup (only if nodes table exists)
-- ============================================================================
-- Purpose: Find the best node for a user signing up with a ZIP code
-- Logic:
--   a) If there's an ACTIVE node with exact ZIP match → return that (match_type='zip')
--   b) Otherwise, return NEAREST ACTIVE node by distance (match_type='nearest')
--   c) If NO active nodes exist → return empty result
--
-- Returns table with:
--   - id, name, zip_code, city, state, latitude, longitude (node details)
--   - distance_km (null if exact ZIP match, distance in km if nearest)
--   - match_type ('zip' or 'nearest')

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nodes') THEN
    CREATE OR REPLACE FUNCTION public.resolve_active_node_for_signup(
      requested_zip TEXT,
      user_lat DOUBLE PRECISION,
      user_lng DOUBLE PRECISION
    )
    RETURNS TABLE (
      id UUID,
      name TEXT,
      zip_code TEXT,
      city TEXT,
      state TEXT,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      distance_km DOUBLE PRECISION,
      match_type TEXT
    ) AS $func$
    DECLARE
      exact_match_count INT;
    BEGIN
      -- First, check if there's an ACTIVE node with exact ZIP match
      SELECT COUNT(*) INTO exact_match_count
      FROM public.nodes
      WHERE public.nodes.zip_code = requested_zip AND public.nodes.is_active = TRUE;

      -- If exact ZIP match exists → return it
      IF exact_match_count > 0 THEN
        RETURN QUERY
        SELECT
          n.id,
          n.name,
          n.zip_code,
          n.city,
          n.state,
          n.latitude,
          n.longitude,
          NULL::DOUBLE PRECISION as distance_km,
          'zip'::TEXT as match_type
        FROM public.nodes n
        WHERE n.zip_code = requested_zip AND n.is_active = TRUE
        LIMIT 1;
        RETURN;
      END IF;

      -- Otherwise, return NEAREST ACTIVE node by PostGIS distance
      RETURN QUERY
      SELECT
        n.id,
        n.name,
        n.zip_code,
        n.city,
        n.state,
        n.latitude,
        n.longitude,
        (ST_DistanceSphere(
          ST_MakePoint(user_lng, user_lat),
          ST_MakePoint(n.longitude, n.latitude)
        ) / 1000.0) as distance_km,
        'nearest'::TEXT as match_type
      FROM public.nodes n
      WHERE n.is_active = TRUE
      ORDER BY ST_DistanceSphere(
        ST_MakePoint(user_lng, user_lat),
        ST_MakePoint(n.longitude, n.latitude)
      ) ASC
      LIMIT 1;
    END;
    $func$ LANGUAGE plpgsql STABLE;
  END IF;
END $$;

-- ============================================================================
-- 3. CREATE RPC: increment_node_member_count (only if nodes table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nodes') THEN
    CREATE OR REPLACE FUNCTION public.increment_node_member_count(node_id UUID)
    RETURNS VOID AS $func$
    BEGIN
      UPDATE public.nodes
      SET member_count = COALESCE(member_count, 0) + 1,
          updated_at = now()
      WHERE id = node_id;
    END;
    $func$ LANGUAGE plpgsql SECURITY INVOKER;

    GRANT EXECUTE ON FUNCTION public.increment_node_member_count(UUID) TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- 4. CREATE RPC: decrement_node_member_count (only if nodes table exists)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nodes') THEN
    CREATE OR REPLACE FUNCTION public.decrement_node_member_count(node_id UUID)
    RETURNS VOID AS $func$
    BEGIN
      UPDATE public.nodes
      SET member_count = GREATEST(COALESCE(member_count, 0) - 1, 0),
          updated_at = now()
      WHERE id = node_id;
    END;
    $func$ LANGUAGE plpgsql SECURITY INVOKER;

    GRANT EXECUTE ON FUNCTION public.decrement_node_member_count(UUID) TO authenticated, anon;
  END IF;
END $$;

-- ============================================================================
-- 5. ENSURE PostGIS EXTENSION (required for ST_DistanceSphere)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;

-- ============================================================================
-- VERIFICATION QUERY (run after migration applied)
-- ============================================================================
-- SELECT 'zip_waitlist table created' as check1,
--        COUNT(*) as waitlist_rows
-- FROM public.zip_waitlist;
--
-- SELECT 'resolve_active_node_for_signup function exists' as check2,
--        proname as function_name
-- FROM pg_proc
-- WHERE proname = 'resolve_active_node_for_signup';
--
-- SELECT 'increment_node_member_count function exists' as check3,
--        proname as function_name
-- FROM pg_proc
-- WHERE proname = 'increment_node_member_count';
--
-- SELECT 'decrement_node_member_count function exists' as check4,
--        proname as function_name
-- FROM pg_proc
-- WHERE proname = 'decrement_node_member_count';
