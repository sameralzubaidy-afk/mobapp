-- ================================================================
-- Migration: 20260109_fix_items_profiles_fk_ambiguity.sql
-- Purpose: Fix "Could not embed" error in PostgREST for items->profiles
-- Issue: items.seller_id has conflicting FKs to both auth.users and profiles
-- Solution: Keep only the auth.users FK (simpler, allows item visibility even if profile deleted)
--           Use explicit select aliasing for PostgREST to work correctly
-- ================================================================

-- STEP 1: Check and report current constraints
-- Run this to understand what we have:
-- SELECT conname, contype, a.attname, c.relname as fk_table
-- FROM pg_constraint
-- JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = conkey[1]
-- JOIN pg_class c ON c.oid = confrelid
-- WHERE conrelid = 'items'::regclass;

-- STEP 2: Drop conflicting FK to profiles if it exists
-- This allows us to rely on the simpler auth.users FK
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_items_seller_profile' AND conrelid = 'items'::regclass
  ) THEN
    ALTER TABLE items DROP CONSTRAINT fk_items_seller_profile;
    RAISE NOTICE 'Dropped fk_items_seller_profile constraint';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'items_seller_id_fkey' AND conrelid = 'items'::regclass
    AND confrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE items DROP CONSTRAINT items_seller_id_fkey;
    RAISE NOTICE 'Dropped items_seller_id_fkey (profiles) constraint';
  END IF;
END $$;

-- STEP 3: Verify items still has FK to auth.users
-- The original FK from creation should still be there:
-- REFERENCES auth.users(id) ON DELETE CASCADE

-- STEP 4: Verify via query
-- Confirmation: items.seller_id -> auth.users(id) should be the only FK

-- Run this query to confirm:
-- SELECT conname, pg_get_constraintdef(oid) as def
-- FROM pg_constraint
-- WHERE conrelid = 'items'::regclass AND contype = 'f';

-- Expected output:
-- conname                 | def
-- ----------------------- | -------
-- items_seller_id_fkey    | FOREIGN KEY (seller_id) REFERENCES auth.users(id) ON DELETE CASCADE
