-- File: supabase/migrations/007_add_member_count_to_nodes.sql
-- Purpose: Add member_count tracking to nodes table for NODE-003
-- Description: Tracks the number of members in each geographic node
-- Date: December 17, 2025

-- ============================================================================
-- 1. ADD member_count column to nodes table
-- ============================================================================

ALTER TABLE public.nodes
ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 0
  CHECK (member_count >= 0);

-- Create index for efficient member count queries
CREATE INDEX IF NOT EXISTS idx_nodes_member_count ON public.nodes(member_count DESC);

-- Add comment for documentation
COMMENT ON COLUMN public.nodes.member_count IS 'Tracks the number of active members in this geographic node';

-- ============================================================================
-- 2. VERIFY: Ensure all nodes have valid member_count
-- ============================================================================

UPDATE public.nodes
SET member_count = COALESCE(member_count, 0)
WHERE member_count IS NULL;

-- ============================================================================
-- 3. FINAL VERIFICATION
-- ============================================================================

-- Verify the column exists and has correct constraint
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nodes'
  AND column_name = 'member_count';

-- Should return:
-- | member_count | integer | NO | 0 |
