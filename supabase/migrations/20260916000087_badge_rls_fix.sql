-- 3. Fix Storage Policies for badge-icons bucket
-- =============================================================================

-- Drop problematic subquery-based policies
DROP POLICY IF EXISTS "Admin users can upload badge icons" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can update badge icons" ON storage.objects;
DROP POLICY IF EXISTS "Admin users can delete badge icons" ON storage.objects;

-- Allow admins to upload badge icons
-- NOTE (FIX-Task-40): `public.is_admin(uuid)` exists nowhere — not in any
-- migration and not in the live database.  Replaced with the repo's canonical
-- admin predicate, user_has_role().
CREATE POLICY "Admin users can upload badge icons"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'badge-icons'
  AND public.user_has_role(auth.uid(), 'admin'::text)
);

-- Allow admins to update badge icons
CREATE POLICY "Admin users can update badge icons"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'badge-icons'
  AND public.user_has_role(auth.uid(), 'admin'::text)
)
WITH CHECK (
  bucket_id = 'badge-icons'
  AND public.user_has_role(auth.uid(), 'admin'::text)
);

-- Allow admins to delete badge icons
CREATE POLICY "Admin users can delete badge icons"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'badge-icons'
  AND public.user_has_role(auth.uid(), 'admin'::text)
);

-- =============================================================================
-- 4. Fix Badges Table Policies
-- =============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can update badges" ON public.badges;
DROP POLICY IF EXISTS "Admins can insert badges" ON public.badges;
DROP POLICY IF EXISTS "Admins can delete badges" ON public.badges;

-- Allow admins to update badge details (used for Save Changes)
CREATE POLICY "Admins can update badges"
ON public.badges FOR UPDATE
TO authenticated
USING (public.user_has_role(auth.uid(), 'admin'::text))
WITH CHECK (public.user_has_role(auth.uid(), 'admin'::text));

-- Allow admins to insert new badges
CREATE POLICY "Admins can insert badges"
ON public.badges FOR INSERT
TO authenticated
WITH CHECK (public.user_has_role(auth.uid(), 'admin'::text));

-- =============================================================================
-- 5. Fix Audit Logs Policies
-- =============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.badge_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.badge_audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.badge_audit_logs;

-- Allow admins to view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.badge_audit_logs FOR SELECT
TO authenticated
USING (public.user_has_role(auth.uid(), 'admin'::text));

-- Allow admins to insert audit logs (for manual awards)
CREATE POLICY "Admins can insert audit logs"
ON public.badge_audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.user_has_role(auth.uid(), 'admin'::text));

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify both overloads exist
SELECT proname, proargtypes 
FROM pg_proc 
WHERE proname = 'user_has_role';

-- Verify policies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'badges' AND schemaname = 'public';
