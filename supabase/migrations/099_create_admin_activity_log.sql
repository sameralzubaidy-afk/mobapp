-- Migration 099: Create admin_activity_log table used by admin_approve_listing()
-- Mode: Idempotent rerunnable migration

-- BLOCK 1 — Schema
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_id ON public.admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_created_at ON public.admin_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action_type ON public.admin_activity_log(action_type);

-- Verification: table exists
-- SELECT to_regclass('public.admin_activity_log') AS admin_activity_log_regclass;

-- BLOCK 2 — Security
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin activity log" ON public.admin_activity_log;
CREATE POLICY "Admins can view admin activity log"
  ON public.admin_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.role_based_access_control rbac
      WHERE rbac.user_id = auth.uid()
        AND rbac.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert own admin activity log" ON public.admin_activity_log;
CREATE POLICY "Admins can insert own admin activity log"
  ON public.admin_activity_log FOR INSERT
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.role_based_access_control rbac
      WHERE rbac.user_id = auth.uid()
        AND rbac.role = 'admin'
    )
  );

-- Verification: policies exist
-- SELECT polname FROM pg_policies WHERE schemaname='public' AND tablename='admin_activity_log';
