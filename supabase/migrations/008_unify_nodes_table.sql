-- File: supabase/migrations/008_unify_nodes_table.sql
-- Purpose: Unify nodes and geographic_nodes tables (NODE-003 FIX)
-- Description: Add missing fields from geographic_nodes to nodes table, migrate data if needed
-- Date: December 17, 2025

-- ============================================================================
-- 1. ADD MISSING COLUMNS to nodes table
-- ============================================================================

-- Add city, state, zip_code (central node location)
ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS state VARCHAR(2),
ADD COLUMN IF NOT EXISTS zip_code VARCHAR(5);

-- Add radius_miles for distance-based node assignment
ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS radius_miles INTEGER DEFAULT 10 CHECK (radius_miles >= 1 AND radius_miles <= 100);

-- Add description for admin notes
ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add is_active (replaces status enum for simplicity)
ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add updated_at timestamp
ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 2. CREATE INDEXES for efficient queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_nodes_city_state ON public.nodes(city, state);
CREATE INDEX IF NOT EXISTS idx_nodes_zip_code ON public.nodes(zip_code);
CREATE INDEX IF NOT EXISTS idx_nodes_is_active ON public.nodes(is_active);
CREATE INDEX IF NOT EXISTS idx_nodes_updated_at ON public.nodes(updated_at DESC);

-- ============================================================================
-- 3. MIGRATE DATA from geographic_nodes (if exists)
-- ============================================================================

-- Check if geographic_nodes table exists and has data
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'geographic_nodes'
  ) THEN
    -- Migrate data from geographic_nodes to nodes (avoiding duplicates)
    INSERT INTO public.nodes (
      id,
      name,
      city,
      state,
      zip_code,
      latitude,
      longitude,
      radius_miles,
      description,
      is_active,
      member_count,
      status,
      created_at,
      updated_at
    )
    SELECT 
      gn.id::TEXT,  -- Convert UUID to TEXT
      gn.name,
      gn.city,
      gn.state,
      gn.zip_code,
      gn.latitude,
      gn.longitude,
      gn.radius_miles,
      gn.description,
      gn.is_active,
      COALESCE(gn.member_count, 0),
      CASE WHEN gn.is_active THEN 'active' ELSE 'inactive' END,
      gn.created_at,
      gn.updated_at
    FROM public.geographic_nodes gn
    WHERE NOT EXISTS (
      SELECT 1 FROM public.nodes n 
      WHERE n.zip_code = gn.zip_code
    )
    ON CONFLICT (id) DO NOTHING;

    RAISE NOTICE 'Data migrated from geographic_nodes to nodes';
  END IF;
END $$;

-- ============================================================================
-- 4. UPDATE EXISTING NODES with default values
-- ============================================================================

-- Set is_active based on status
UPDATE public.nodes
SET is_active = (status = 'active')
WHERE is_active IS NULL;

-- Ensure all nodes have radius_miles
UPDATE public.nodes
SET radius_miles = 10
WHERE radius_miles IS NULL;

-- Ensure all nodes have updated_at
UPDATE public.nodes
SET updated_at = created_at
WHERE updated_at IS NULL;

-- ============================================================================
-- 5. ADD COMMENTS for documentation
-- ============================================================================

COMMENT ON COLUMN public.nodes.city IS 'City of the node (central location)';
COMMENT ON COLUMN public.nodes.state IS 'State code (2 letters, e.g., CT)';
COMMENT ON COLUMN public.nodes.zip_code IS 'Primary ZIP code of the node center';
COMMENT ON COLUMN public.nodes.radius_miles IS 'Radius in miles for node coverage area';
COMMENT ON COLUMN public.nodes.description IS 'Admin notes about this node';
COMMENT ON COLUMN public.nodes.is_active IS 'Whether this node is accepting new members';
COMMENT ON COLUMN public.nodes.updated_at IS 'Last update timestamp';

-- ============================================================================
-- 6. DEPRECATE geographic_nodes table (optional)
-- ============================================================================

-- Option 1: Drop the table (if no longer needed)
-- DROP TABLE IF EXISTS public.geographic_nodes CASCADE;

-- Option 2: Add a deprecation notice (keep for rollback)
COMMENT ON TABLE public.geographic_nodes IS 'DEPRECATED: Use public.nodes table instead. This table will be removed in future migration.';

-- ============================================================================
-- 7. VERIFICATION
-- ============================================================================

-- Verify all columns exist
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nodes'
  AND column_name IN ('city', 'state', 'zip_code', 'radius_miles', 'description', 'is_active', 'updated_at', 'member_count')
ORDER BY column_name;

-- Verify node count
SELECT 
  COUNT(*) as total_nodes,
  SUM(CASE WHEN is_active THEN 1 ELSE 0 END) as active_nodes,
  SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive_nodes
FROM public.nodes;
