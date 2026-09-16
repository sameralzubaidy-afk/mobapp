-- Migration: 091_fix_user_badges_fkey.sql
-- Module: MODULE-08 BADGES-V2
-- Purpose: Fix the foreign key on user_badges to correctly reference auth.users(id)
-- Reference: The previous migration (20260110000000_badges_v2.sql) incorrectly used REFERENCES users(id).

-- 1. Drop the incorrect constraint
ALTER TABLE public.user_badges DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;

-- 2. Add the correct constraint referencing auth.users(id)
ALTER TABLE public.user_badges
  ADD CONSTRAINT user_badges_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. Verify the fix by attempting the badge award again if it failed
-- This part is optional but helpful as the previous backfill in 090 might have failed.
-- Note: 091 is a separate migration, so we don't need to repeat the backfill here if the user re-runs 090.
