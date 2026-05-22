-- =====================================================
-- Migration: 309_ensure_public_id_badge_approved_read.sql
-- Description: Ensure authenticated users can read approved seller ID badge status
-- Reason: Public Seller Profile must show approved identity verification reliably
-- Mode: Idempotent rerunnable migration
-- =====================================================

ALTER TABLE public.id_badge_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view approved ID badge status" ON public.id_badge_verification_requests;
CREATE POLICY "Anyone can view approved ID badge status"
  ON public.id_badge_verification_requests
  FOR SELECT
  TO authenticated
  USING (status = 'approved');

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- 1) Verify RLS is enabled
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND tablename = 'id_badge_verification_requests';

-- 2) Verify policy exists
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'id_badge_verification_requests'
-- ORDER BY policyname;

-- 3) Verify approved status is readable
-- SELECT status, user_id, submitted_at
-- FROM public.id_badge_verification_requests
-- WHERE user_id = '<seller-user-id-uuid>'
--   AND status = 'approved'
-- ORDER BY submitted_at DESC
-- LIMIT 1;
