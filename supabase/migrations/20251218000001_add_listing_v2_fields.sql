-- ================================================================
-- Migration: 20251218000001_add_listing_v2_fields.sql
-- Module: MODULE-04 LISTING-V2-001 - Add V2 fields to items table
-- Description: Adds seller_subscription_status_at_creation field for audit trail
-- ================================================================

-- Note: accepts_swap_points and updated_at already exist in items table
-- This migration adds the missing audit field from V2 spec

-- =============================================================================
-- STEP 1: ADD V2 AUDIT FIELD
-- =============================================================================

-- Add seller subscription status at creation (audit trail for MODULE-04 V2)
ALTER TABLE items
ADD COLUMN IF NOT EXISTS seller_subscription_status_at_creation TEXT;

COMMENT ON COLUMN items.seller_subscription_status_at_creation IS 'V2: Seller subscription status when listing created (audit trail)';

-- =============================================================================
-- STEP 2: VERIFY REQUIRED V2 FIELDS EXIST
-- =============================================================================

-- Verify accepts_swap_points exists (should already exist from NODE-006 migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'accepts_swap_points'
  ) THEN
    RAISE EXCEPTION 'Missing required column: items.accepts_swap_points';
  END IF;
END $$;

-- Verify updated_at exists (should already exist from NODE-006 migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'items' AND column_name = 'updated_at'
  ) THEN
    RAISE EXCEPTION 'Missing required column: items.updated_at';
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================================================

-- Verify all V2 columns exist:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'items' 
-- AND column_name IN ('accepts_swap_points', 'seller_subscription_status_at_creation', 'updated_at')
-- ORDER BY column_name;

-- Expected results:
-- accepts_swap_points | boolean | NO
-- seller_subscription_status_at_creation | text | YES
-- updated_at | timestamp with time zone | NO
