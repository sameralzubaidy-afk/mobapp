-- filepath: supabase/migrations/206_public_id_badge_status.sql
-- TASK BADGE-013: Allow public to see approved verification status
-- Module: MODULE-10-ID-BADGE-VERIFICATION-V2.md

-- Drop existing policy if it exists (using DO block for safety since DROP POLICY IF EXISTS ... ON table is standard but CREATE POLICY IF NOT EXISTS is not)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'id_badge_verification_requests' 
        AND policyname = 'Anyone can view approved ID badge status'
    ) THEN
        DROP POLICY "Anyone can view approved ID badge status" ON id_badge_verification_requests;
    END IF;
END
$$;

-- Allow anyone to view 'approved' identity verification status
-- This lets other users see the verification badge on someone's profile/avatar
CREATE POLICY "Anyone can view approved ID badge status"
  ON id_badge_verification_requests FOR SELECT
  USING (status = 'approved');
