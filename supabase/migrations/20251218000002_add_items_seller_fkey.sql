-- ================================================================
-- Migration: 20251218000002_add_items_seller_fkey.sql
-- Module: MODULE-04 LISTING-V2 - Add foreign key for seller relationship
-- Description: Adds FK constraint from items.seller_id to profiles.id
--              This enables PostgREST relationship expansion
-- ================================================================

-- Add foreign key constraint if it doesn't exist
-- NOTE (FIX-Task-40): an equivalent `items_seller_id_fkey` is already created
-- earlier in the chain (referencing auth.users(id), which is the correct target —
-- `items.seller_id` holds an auth user id, not a profiles.id).  Declaring it again
-- unconditionally aborted the whole replay with "constraint already exists", so
-- the add is now guarded and becomes a no-op when the constraint is present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'items_seller_id_fkey'
      AND conrelid = 'public.items'::regclass
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_seller_id_fkey
      FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION QUERY (run after migration)
-- =============================================================================

-- Verify foreign key was created:
-- SELECT constraint_name, table_name, column_name, foreign_table_name, foreign_column_name
-- FROM information_schema.key_column_usage
-- WHERE table_name = 'items' AND column_name = 'seller_id';

-- Expected result:
-- items_seller_id_fkey | items | seller_id | profiles | id
